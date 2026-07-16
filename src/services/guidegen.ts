import type { LatLng } from '../types';

/** Geocodifica UNA tappa (Nominatim/OpenStreetMap, gratuito): restituisce coordinate o null. */
export async function geocodeOne(query: string): Promise<{ coords: LatLng; address: string } | null> {
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1' +
      `&accept-language=it&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const j = (await res.json()) as any[];
    const r = j?.[0];
    if (!r) return null;
    const a = r.address || {};
    const street = [a.road, a.house_number].filter(Boolean).join(' ');
    const city = a.city || a.town || a.village || '';
    return {
      coords: { lat: Number(r.lat), lng: Number(r.lon) },
      address: [street, city].filter(Boolean).join(', ') || (r.display_name || '').split(',').slice(0, 2).join(','),
    };
  } catch {
    return null;
  }
}

export interface GuidePoint { name: string; text: string }

/** Genera la guida interna punto-per-punto via /api/guide (richiede backend AI). */
export async function generateInteriorGuide(title: string, address?: string): Promise<{ ok: true; points: GuidePoint[] } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, address }),
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
