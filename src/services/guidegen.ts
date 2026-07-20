import type { LatLng } from '../types';

export interface GeocodeHit {
  coords: LatLng;
  address: string;
  phone?: string;
  website?: string;
  kind?: string;
}

function fmtAddress(r: any): string {
  const a = r.address || {};
  const street = [a.road, a.house_number].filter(Boolean).join(' ');
  const city = a.city || a.town || a.village || '';
  return [street, city].filter(Boolean).join(', ') || (r.display_name || '').split(',').slice(0, 2).join(',');
}

async function nominatim(q: string, extra = ''): Promise<any[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=5' +
    `&accept-language=it${extra}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  return (await res.json()) as any[];
}

const GENERIC = /\b(pranzo|cena|colazione|pausa|siesta|riposo|check-?in|check-?out|passeggiata|tramonto|aperitivo|shopping|tempo libero)\b/i;
const GOOD_CLASSES = new Set(['tourism', 'historic', 'amenity', 'leisure', 'building', 'man_made', 'place', 'natural', 'railway', 'aeroway']);

function score(r: any, title: string): number {
  let sc = Number(r.importance ?? 0);
  if (GOOD_CLASSES.has(r.class)) sc += 0.4;
  if (r.class === 'highway') sc -= 0.6; // evita di piazzare il pin su una strada qualsiasi
  const name = String(r.name || (r.display_name || '').split(',')[0]).toLowerCase();
  const tokens = title.toLowerCase().split(/[^a-zà-ú0-9]+/).filter((t) => t.length > 3);
  const hits = tokens.filter((t) => name.includes(t)).length;
  sc += hits * 0.35;
  return sc;
}

/**
 * Geocodifica precisa di una tappa: prova più varianti di ricerca,
 * scarta i risultati generici (strade) e sceglie il candidato migliore
 * per importanza + somiglianza del nome. Riporta anche telefono/sito se noti.
 */
export async function geocodeOne(title: string, address?: string): Promise<GeocodeHit | null> {
  try {
    const cleanTitle = title.replace(GENERIC, '').replace(/\s+/g, ' ').trim() || title;
    const variants = [
      address ? `${cleanTitle}, ${address}` : cleanTitle,
      address ? `${cleanTitle} ${address.split(',').pop()?.trim() ?? ''}` : '',
      address ?? '',
    ].filter((v, i, arr) => v.trim().length >= 3 && arr.indexOf(v) === i);

    let best: any = null; let bestScore = -Infinity;
    for (const v of variants) {
      const rs = await nominatim(v);
      for (const r of rs) {
        const sc = score(r, title);
        if (sc > bestScore) { bestScore = sc; best = r; }
      }
      // primo tentativo con un buon match di nome: basta così (risparmia richieste)
      if (best && bestScore >= 0.9) break;
    }
    if (!best) return null;
    const t = best.extratags || {};
    return {
      coords: { lat: Number(best.lat), lng: Number(best.lon) },
      address: fmtAddress(best),
      phone: t.phone || t['contact:phone'] || undefined,
      website: t.website || t['contact:website'] || undefined,
      kind: best.type,
    };
  } catch {
    return null;
  }
}

export interface FoodPlace {
  name: string;
  address: string;
  coords: LatLng;
  meters: number;
  cuisine?: string;
  phone?: string;
  website?: string;
}

const CHEAP = /pizzer|trattor|oster|taverna|kebab|paninotec|piadin|rosticc|friggitor|tavola calda|street/i;

/** Ristoranti vicino a un punto (raggio ~1.2 km), ordinati per distanza.
 *  Motore principale: Overpass API (OpenStreetMap), fatto apposta per i locali
 *  in zona; riserva: Nominatim. */
export let foodDebug = '';

export async function findRestaurants(center: LatLng, budgetAlto: boolean): Promise<FoodPlace[]> {
  foodDebug = '';
  const dist = (a: LatLng, b: LatLng) => {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(x)));
  };

  let list: FoodPlace[] = [];

  // --- Overpass (più mirror: se uno è pieno si passa al successivo) ---
  const q = `[out:json][timeout:10];
(
  node(around:1500,${center.lat},${center.lng})["amenity"~"^(restaurant|fast_food|food_court|cafe)$"]["name"];
  way(around:1500,${center.lat},${center.lng})["amenity"~"^(restaurant|fast_food|food_court|cafe)$"]["name"];
);
out center 40;`;
  const MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
  ];
  for (const base of MIRRORS) {
    if (list.length > 0) break;
    try {
      const res = await fetch(`${base}?data=${encodeURIComponent(q)}`);
      if (res.ok) {
      const j = await res.json();
      list = (j.elements ?? []).map((e: any) => {
        const t = e.tags ?? {};
        const coords = { lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon };
        const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
        return {
          name: t.name,
          address: street || t['addr:city'] || '',
          coords,
          meters: dist(center, coords),
          cuisine: t.cuisine ? String(t.cuisine).replace(/;/g, ', ').replace(/_/g, ' ') : undefined,
          phone: t.phone || t['contact:phone'] || undefined,
          website: t.website || t['contact:website'] || undefined,
        } as FoodPlace;
      }).filter((p: FoodPlace) => p.name && p.coords.lat);
      }
    } catch (e) { foodDebug += 'overpass:' + String(e).slice(0, 40) + ' '; }
  }

  // --- Riserva 1: Photon (komoot) ---
  if (list.length === 0) {
    try {
      const r = await fetch(`https://photon.komoot.io/api/?q=restaurant&lat=${center.lat}&lon=${center.lng}&limit=15&lang=it`);
      if (r.ok) {
        const j = await r.json();
        list = (j.features ?? []).map((f: any) => {
          const pr = f.properties ?? {};
          const coords = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
          return {
            name: pr.name,
            address: [pr.street, pr.housenumber, pr.city].filter(Boolean).join(' '),
            coords, meters: dist(center, coords), cuisine: undefined,
          } as FoodPlace;
        }).filter((p: FoodPlace) => p.name);
      } else foodDebug += 'photon:' + r.status + ' ';
    } catch (e) { foodDebug += 'photon:' + String(e).slice(0, 40) + ' '; }
  }

  // --- Riserva 2: Nominatim ---
  if (list.length === 0) {
    try {
      const d = 0.011;
      const viewbox = `${center.lng - d},${center.lat + d},${center.lng + d},${center.lat - d}`;
      const rs = await nominatim('ristorante', `&bounded=1&viewbox=${viewbox}&limit=15`);
      list = rs.filter((r) => r.class === 'amenity').map((r) => {
        const t = r.extratags || {};
        const coords = { lat: Number(r.lat), lng: Number(r.lon) };
        return {
          name: r.name || (r.display_name || '').split(',')[0],
          address: fmtAddress(r),
          coords,
          meters: dist(center, coords),
          cuisine: t.cuisine ? String(t.cuisine).replace(/;/g, ', ').replace(/_/g, ' ') : undefined,
          phone: t.phone || t['contact:phone'] || undefined,
          website: t.website || t['contact:website'] || undefined,
        } as FoodPlace;
      }).filter((p) => p.name);
    } catch { /* pazienza */ }
  }

  if (!budgetAlto) {
    const cheap = list.filter((p) => CHEAP.test(p.name) || CHEAP.test(p.cuisine ?? ''));
    if (cheap.length >= 3) list = cheap;
  }
  list.sort((a, b) => a.meters - b.meters);
  return list.slice(0, 8);
}

export interface GuidePoint { name: string; text: string }

/** Genera la guida interna punto-per-punto via /api/guide (richiede backend AI). */
export async function generateInteriorGuide(title: string, address?: string, lang: string = 'it'): Promise<{ ok: true; points: GuidePoint[] } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, address, lang }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error?.includes('non configurato')
        ? 'La guida interna richiede il backend AI: aggiungi OPENAI_API_KEY su Vercel (vedi README).'
        : (json.error || 'Generazione non riuscita: riprova.') };
    }
    const points = (json.points as GuidePoint[]).filter((p) => p?.name && p?.text);
    if (points.length === 0) return { ok: false, error: 'Guida vuota: riprova.' };
    return { ok: true, points };
  } catch {
    return { ok: false, error: 'Connessione assente: riprova quando sei online.' };
  }
}
