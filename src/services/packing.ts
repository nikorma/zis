/**
 * Valigia intelligente — funziona SENZA chiavi e anche per date lontane:
 * stima il clima della destinazione usando Open-Meteo (geocoding gratuito +
 * archivio storico: stesse date dell'anno scorso) e calcola una lista di
 * capi con quantità in base a giorni, genere, taglie, bagaglio e mezzo.
 */

export type Gender = 'uomo' | 'donna';
export type Luggage = 'zaino' | 'bagaglio-a-mano' | 'valigia-stiva' | 'combinato';
export type Transport = 'aereo' | 'auto' | 'treno' | 'nave' | 'combinato';

export interface Sizes { top: string; bottom: string; shoes: string }

export interface PackingInput {
  destination: string;
  startDate: string;
  endDate: string;
  gender: Gender;
  sizes: Sizes;
  luggage: Luggage;
  transport: Transport;
}

export interface ClimateEstimate {
  tMax: number; tMin: number; rainyDays: number; label: string; source: string;
}

export interface PackingItem {
  name: string; qty: number; note?: string; category: string;
  /** volume in litri per unità (stima) */ vol: number;
  /** priorità di riduzione se il bagaglio non basta (più alta = si taglia prima); 0 = intoccabile */ trim: number;
  /** quantità minima sotto cui non scendere */ min: number;
}

export interface PackingResult {
  days: number;
  climate: ClimateEstimate | null;
  items: PackingItem[];
  tips: string[];
  laundry: boolean;
  /** capi ridotti/eliminati per far entrare tutto */ reductions: string[];
  /** true se anche dopo le riduzioni lo spazio non basta */ overCapacity: boolean;
  /** litri utilizzabili del bagaglio scelto */ capacityL: number;
  /** litri stimati occupati dalla lista finale */ usedL: number;
}

/** Capienza reale (litri) per tipo di bagaglio. */
export const LUGGAGE_CAPACITY_L: Record<Luggage, number> = {
  'zaino': 32,
  'bagaglio-a-mano': 40,
  'valigia-stiva': 85,
  'combinato': 120,
};

export function tripDays(startDate: string, endDate: string): number {
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

/** Stima clima: media max/min e giorni di pioggia sulle stesse date dell'anno precedente. */
export async function estimateClimate(destination: string, startDate: string, endDate: string): Promise<ClimateEstimate | null> {
  try {
    const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=it&name=${encodeURIComponent(destination)}`);
    const gj = await g.json();
    const loc = gj?.results?.[0];
    if (!loc) return null;

    const shift = (d: string) => {
      const x = new Date(d); x.setFullYear(x.getFullYear() - 1);
      return x.toISOString().slice(0, 10);
    };
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${loc.latitude}&longitude=${loc.longitude}` +
      `&start_date=${shift(startDate)}&end_date=${shift(endDate)}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    const r = await fetch(url);
    const j = await r.json();
    const max: number[] = j?.daily?.temperature_2m_max ?? [];
    const min: number[] = j?.daily?.temperature_2m_min ?? [];
    const rain: number[] = j?.daily?.precipitation_sum ?? [];
    if (!max.length) return null;
    const avg = (a: number[]) => a.reduce((x, y) => x + (y ?? 0), 0) / a.length;
    const tMax = Math.round(avg(max));
    const tMin = Math.round(avg(min));
    const rainyDays = rain.filter((x) => (x ?? 0) >= 1).length;
    const label =
      tMax >= 32 ? 'molto caldo' : tMax >= 25 ? 'caldo' : tMax >= 18 ? 'mite' : tMax >= 10 ? 'fresco' : 'freddo';
    return { tMax, tMin, rainyDays, label, source: `storico ${loc.name} (stesse date, anno precedente)` };
  } catch {
    return null;
  }
}

const cap = (n: number, laundry: boolean) => (laundry ? Math.min(n, 8) : n);

export function buildPackingList(input: PackingInput, climate: ClimateEstimate | null): PackingResult {
  const days = tripDays(input.startDate, input.endDate);
  const laundry = days > 8; // per viaggi lunghi si assume un lavaggio a metà
  const hot = climate ? climate.tMax >= 27 : true;
  const cold = climate ? climate.tMax < 15 : false;
  const mild = !hot && !cold;
  const rainy = climate ? climate.rainyDays >= Math.ceil(days / 4) : false;
  const eveningCool = climate ? climate.tMin <= 17 : false;

  const it: PackingItem[] = [];
  const add = (category: string, name: string, qty: number, vol: number, trim: number, min: number, note?: string) => {
    if (qty > 0) it.push({ category, name, qty, note, vol, trim, min });
  };
  const S = input.sizes;
  const ts = (s: string) => (s ? ` (taglia ${s})` : '');

  // — Intimo e base —
  add('Intimo', `Slip/boxer${ts(S.bottom)}`, cap(days + 1, laundry), 0.15, 1, 4);
  add('Intimo', 'Paia di calze', cap(hot ? Math.ceil(days / 2) + 1 : days + 1, laundry), 0.12, 1, 3, hot ? 'con sandali/sneaker traspiranti ne servono meno' : undefined);
  if (input.gender === 'donna') add('Intimo', 'Reggiseni', Math.min(Math.ceil(days / 2) + 1, 5), 0.2, 2, 2);
  add('Notte', 'Pigiama/maglia da notte', days > 4 ? 2 : 1, 0.7, 3, 1);

  // — Sopra —
  if (hot) {
    add('Abbigliamento', `T-shirt/canotte${ts(S.top)}`, cap(days + 1, laundry), 0.45, 2, 3);
    if (input.gender === 'donna') add('Abbigliamento', `Vestiti leggeri${ts(S.top)}`, Math.min(Math.ceil(days / 3), 3), 0.8, 4, 1, 'comodi per sera');
    else add('Abbigliamento', `Camicie leggere${ts(S.top)}`, Math.min(Math.ceil(days / 3), 3), 0.7, 4, 1, 'per la sera');
  } else if (mild) {
    add('Abbigliamento', `T-shirt${ts(S.top)}`, cap(Math.ceil(days * 0.7) + 1, laundry), 0.45, 2, 3);
    add('Abbigliamento', `Maglie maniche lunghe${ts(S.top)}`, Math.min(Math.ceil(days / 3) + 1, 4), 0.8, 3, 1);
    add('Abbigliamento', 'Felpa o maglioncino', 2, 1.6, 5, 1);
  } else {
    add('Abbigliamento', `Maglie termiche/manica lunga${ts(S.top)}`, cap(days, laundry), 0.6, 2, 3);
    add('Abbigliamento', 'Maglioni', Math.min(Math.ceil(days / 3) + 1, 4), 2.6, 5, 1, 'il più pesante indossalo in viaggio');
  }

  // — Sotto —
  if (hot) {
    add('Abbigliamento', `Pantaloncini/gonne${ts(S.bottom)}`, Math.min(Math.ceil(days / 2), 5), 0.55, 3, 2);
    add('Abbigliamento', `Pantaloni lunghi leggeri${ts(S.bottom)}`, 1, 1.0, 4, 1, 'sere, luoghi di culto, aria condizionata');
  } else {
    add('Abbigliamento', `Pantaloni${ts(S.bottom)}`, Math.min(Math.ceil(days / 3) + 1, 4), 1.2, 3, 2, 'uno indossalo in viaggio');
  }

  // — Strati e pioggia —
  if (eveningCool && hot) add('Abbigliamento', 'Felpa leggera o scialle', 1, 1.2, 4, 1, 'per la sera');
  if (mild || cold) add('Abbigliamento', cold ? 'Giacca calda/piumino' : 'Giacca leggera', 1, cold ? 3.5 : 1.5, 0, 1, 'indossala in viaggio: non conta nel bagaglio');
  if (rainy) { add('Abbigliamento', 'K-way o ombrello pieghevole', 1, 0.6, 4, 1, `~${climate?.rainyDays} giorni di pioggia attesi`); }

  // — Scarpe —
  add('Scarpe', `Scarpe comode da cammino${ts(S.shoes)}`, 1, 0, 0, 1, 'già collaudate, mai nuove! Indossale in viaggio');
  if (hot) add('Scarpe', `Sandali${ts(S.shoes)}`, 1, 1.6, 4, 1);
  add('Scarpe', `Scarpe per la sera${ts(S.shoes)}`, 1, 2.8, 6, 0, 'facoltative');

  // — Mare / caldo —
  if (hot) {
    add('Accessori', 'Costume da bagno', input.transport === 'nave' ? 2 : 1, 0.3, 3, 1);
    add('Accessori', 'Cappello + occhiali da sole', 1, 0.5, 2, 1);
    add('Cura', 'Crema solare alta protezione', 1, 0.3, 1, 1, input.luggage === 'bagaglio-a-mano' ? '≤100 ml in cabina!' : undefined);
    add('Accessori', 'Borraccia', 1, 0.8, 3, 1);
  }

  // — Cura e salute —
  add('Cura', 'Beauty case (spazzolino, deodorante…)', 1, 2.2, 1, 1, input.luggage === 'bagaglio-a-mano' || (input.luggage === 'combinato' && input.transport === 'aereo') ? 'liquidi ≤100 ml in busta trasparente' : undefined);
  add('Cura', 'Medicinali personali + cerotti', 1, 0.5, 0, 1);

  // — Tech e documenti —
  add('Tech', 'Caricatore + powerbank', 1, 0.5, 0, 1, input.transport === 'aereo' ? 'powerbank SEMPRE in cabina, mai in stiva' : undefined);
  add('Documenti', 'Documento/passaporto + tessera sanitaria', 1, 0.05, 0, 1);
  if (input.transport === 'aereo' || input.transport === 'combinato') add('Documenti', 'Carte d\u2019imbarco scaricate offline', 1, 0, 0, 1);
  if (input.transport === 'nave') add('Cura', 'Cerotti/pastiglie anti mal di mare', 1, 0.1, 0, 1);
  if (input.transport === 'auto') add('Documenti', 'Patente + documenti auto', 1, 0.05, 0, 1);
  add('Accessori', 'Zainetto pieghevole per il giorno', 1, 0.5, 3, 1);

  // — Consigli su misura —
  const tips: string[] = [];
  if (climate) tips.push(`Clima stimato a ${input.destination}: ${climate.label}, max ~${climate.tMax}°C / min ~${climate.tMin}°C (fonte: ${climate.source}). Ricontrolla il meteo la settimana prima.`);
  else tips.push('Non sono riuscito a stimare il clima (offline?): lista calcolata su ipotesi prudenti — riapri con la connessione per il calcolo preciso.');
  if (laundry) tips.push(`Viaggio di ${days} giorni: le quantità sono calcolate prevedendo UN lavaggio a metà viaggio (lavanderia o lavaggio a mano).`);
  if (input.luggage === 'zaino') tips.push('Zaino: arrotola i vestiti invece di piegarli e indossa il capo più pesante in viaggio.');
  if (input.luggage === 'bagaglio-a-mano') tips.push('Bagaglio a mano: liquidi max 100 ml in busta trasparente da 1 L; niente forbici/coltelli; pesa il trolley prima di partire (spesso max 8-10 kg).');
  if (input.luggage === 'valigia-stiva') tips.push('Valigia in stiva: metti un cambio completo e i medicinali nel bagaglio a mano, per sicurezza.');
  if (input.transport === 'treno') tips.push('Treno: preferisci un bagaglio che sali in cappelliera da solo; lucchetto se viaggi di notte.');
  if (input.transport === 'combinato') tips.push('Viaggio combinato: valgono le regole dell\u2019aereo per i liquidi anche se solo una tratta è in volo.');

  // ---- Adattamento alla CAPIENZA del bagaglio ----
  const capacityL = LUGGAGE_CAPACITY_L[input.luggage];
  const usable = capacityL * 0.9; // un po' di margine per gli spazi vuoti
  const used = () => it.reduce((a, i) => a + i.vol * i.qty, 0);
  const reductions: string[] = [];

  // riduco partendo dai capi con priorità di taglio più alta, senza scendere sotto i minimi
  let guard = 200;
  while (used() > usable && guard-- > 0) {
    const candidates = it.filter((i) => i.trim > 0 && i.qty > i.min);
    if (candidates.length === 0) break;
    candidates.sort((a, b) => b.trim - a.trim || b.vol - a.vol);
    const victim = candidates[0];
    victim.qty -= 1;
    reductions.push(victim.name);
  }
  // capi azzerati: fuori dalla lista
  for (let i = it.length - 1; i >= 0; i--) if (it[i].qty === 0) { reductions.push(it[i].name + ' (eliminato)'); it.splice(i, 1); }

  const usedL = Math.round(used());
  const counts: Record<string, number> = {};
  for (const r of reductions) counts[r] = (counts[r] ?? 0) + 1;
  const reductionList = Object.entries(counts).map(([n, c]) => `${n} −${c}`);
  const overCapacity = used() > usable;
  if (reductions.length === 0) {
    tips.push(`🧳 Occupazione stimata: ~${usedL} L su ${capacityL} L disponibili — ci sta tutto${usedL < usable * 0.7 ? ', con spazio per i souvenir' : ''}.`);
  }

  return { days, climate, items: it, tips, laundry, reductions: reductionList, overCapacity, capacityL, usedL };
}
