import { useEffect, useRef, useState } from 'react';

/**
 * Ricerca luoghi "come su Google Maps" ma senza chiavi:
 * usa Nominatim (OpenStreetMap), in tutto il mondo,
 * con nome, indirizzo e coordinate pronte da usare.
 */
export interface FoundPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  kind: string; // es. bar, restaurant, attraction…
}

const ICONS: Record<string, string> = {
  bar: '🍺', pub: '🍺', restaurant: '🍽️', cafe: '☕', fast_food: '🥪',
  attraction: '📸', museum: '🏛️', monument: '🏛️', church: '⛪', place_of_worship: '⛪',
  hotel: '🏨', supermarket: '🛒', pharmacy: '💊', park: '🌳', viewpoint: '🌅',
};

export default function PlaceSearch({
  onSelect,
  placeholder = 'Cerca un luogo (es. "trattoria Trastevere")…',
}: {
  onSelect: (p: FoundPlace) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoundPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (q.trim().length < 3) { setResults([]); setOpen(false); return; }
    timer.current = window.setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      setLoading(true);
      try {
        const url =
          'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6' +
          `&accept-language=it&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { signal: ctrl.current.signal, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as any[];
        const list: FoundPlace[] = json.map((r) => {
          const a = r.address || {};
          const street = [a.road, a.house_number].filter(Boolean).join(' ');
          const zone = a.suburb || a.quarter || a.neighbourhood || a.city_district || '';
          return {
            name: r.name || (r.display_name || '').split(',')[0],
            address: [street, zone, a.city || a.town || a.village || a.country || ''].filter(Boolean).join(', '),
            lat: Number(r.lat),
            lng: Number(r.lon),
            kind: r.type || r.class || '',
          };
        }).filter((p) => p.name);
        setResults(list);
        setOpen(true);
      } catch { /* rete assente o annullata: silenzio */ }
      setLoading(false);
    }, 450); // debounce: rispetta il limite di Nominatim (1 richiesta/secondo)
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [q]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          className="input"
          value={q}
          placeholder={placeholder}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          aria-label="Cerca un luogo"
          autoComplete="off"
        />
        {loading && <span className="animate-pulse" aria-hidden>🔎</span>}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-xl border border-[#d8c9b0] dark:border-[#4a382c] bg-white dark:bg-[#2d211a] shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button
                className="w-full text-left px-3 py-2.5 hover:bg-crema dark:hover:bg-[#231913] flex gap-2 items-start"
                onClick={() => { onSelect(r); setQ(''); setResults([]); setOpen(false); }}
              >
                <span aria-hidden>{ICONS[r.kind] ?? '📍'}</span>
                <span className="min-w-0">
                  <span className="block font-medium truncate">{r.name}</span>
                  <span className="block text-xs opacity-60 truncate">{r.address}</span>
                </span>
              </button>
            </li>
          ))}
          <li className="px-3 py-1.5 text-[10px] opacity-50 border-t border-[#e8ddca] dark:border-[#4a382c]">
            Ricerca © OpenStreetMap/Nominatim
          </li>
        </ul>
      )}
      {open && !loading && results.length === 0 && q.trim().length >= 3 && (
        <p className="text-xs opacity-60 mt-1">Nessun risultato: prova con meno parole o compila i campi a mano.</p>
      )}
    </div>
  );
}
