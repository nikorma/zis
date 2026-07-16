import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../state/AppStore';
import MapView, { type MapMarker } from '../components/MapView';
import { useGeolocation } from '../hooks/useGeolocation';
import { distanceMeters, walkMinutes, bikeMinutes, formatDistance, googleMapsDirectionsUrl } from '../lib/geo';
import type { LatLng } from '../types';

import { useEffect } from 'react';
function useEffectOnceForGeo(cond: boolean, start: () => void) {
  useEffect(() => { if (cond) start(); /* eslint-disable-next-line */ }, [cond]);
}

export default function MapPage() {
  const { data } = useApp();
  const geo = useGeolocation();
  // Se non c'è alcun itinerario e il consenso GPS è già stato dato, mostra dove sei
  const noStopsAtAll = data.days.every((d) => d.stops.every((st) => !st.coords));
  useEffectOnceForGeo(noStopsAtAll && data.settings.geoConsent, geo.start);
  const { dayId } = useParams();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(dayId ?? null);

  const day = useMemo(
    () => data.days.find((d) => d.id === (selectedDayId ?? dayId)) ?? data.days[0],
    [data.days, selectedDayId, dayId]
  );

  const coordsStops = useMemo(() => (day?.stops ?? []).filter((s) => s.coords), [day]);

  const markers: MapMarker[] = [
    ...(noStopsAtAll && geo.position ? [{ coords: geo.position, label: '📍 Tu sei qui', kind: 'user' as const }] : []),
    ...coordsStops.map((s, i) => ({
      coords: s.coords as LatLng,
      label: `${i + 1}. ${s.title}${s.time ? ` (${s.time})` : ''}`,
      kind: 'stop' as const,
    })),
  ];
  const route: LatLng[] = coordsStops.map((s) => s.coords as LatLng);

  // Tratte: distanza, tempi a piedi / bici (stimati) + trasporto pubblico se indicato.
  const legs = useMemo(() => {
    const out: { from: string; to: string; meters: number; walk: number; bike: number; transit?: string }[] = [];
    let prev: { name: string; coords: LatLng } | null = null;
    for (const s of coordsStops) {
      if (!prev) { prev = { name: s.title, coords: s.coords as LatLng }; continue; }
      const m = distanceMeters(prev.coords, s.coords as LatLng);
      const t = s.transit;
      out.push({
        from: prev.name,
        to: s.title,
        meters: m,
        walk: t?.walkMinutes ?? walkMinutes(m),
        bike: t?.bikeMinutes ?? bikeMinutes(m),
        transit: t?.transitMinutes
          ? `🚌 ${t.transitMinutes} min${t.line ? ` · ${t.line}` : ''}${t.fromStop ? ` · da ${t.fromStop}` : ''}${t.toStop ? ` a ${t.toStop}` : ''}${t.changes ? ` · cambi: ${t.changes}` : ''}${t.costNote ? ` · ${t.costNote}` : ''}`
          : undefined,
      });
      prev = { name: s.title, coords: s.coords as LatLng };
    }
    return out;
  }, [coordsStops]);

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="page-title">Mappa della giornata</h1>
      <div className="azulejo-band" aria-hidden />

      <select
        className="input"
        value={day?.id ?? ''}
        onChange={(e) => setSelectedDayId(e.target.value)}
        aria-label="Scegli giornata"
      >
        {data.days.map((d) => (
          <option key={d.id} value={d.id}>
            {new Date(d.date + 'T12:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} — {d.title}
          </option>
        ))}
      </select>

      <MapView markers={markers} route={route} height="50vh" />

      <section className="card">
        <h2 className="font-display text-lg mb-2">Percorso e tempi</h2>
        <p className="text-xs opacity-60 mb-3">
          Tempi a piedi e in bici stimati in linea d\u2019aria con margine urbano (ritmo tranquillo, caldo incluso). Bus/tram TUSSAM: linee indicative, orari e prezzi da verificare su <a className="underline" href="https://www.tussam.es" target="_blank" rel="noreferrer">tussam.es</a>. Bici pubbliche: Sevici.
        </p>
        <ol className="space-y-2">
          {legs.map((l, i) => (
            <li key={i} className="text-sm border-b border-dashed border-[#e0d3ba] dark:border-[#4a382c] pb-2 last:border-0">
              <span className="font-semibold">{l.from}</span> → <span className="font-semibold">{l.to}</span>
              <br />
              <span className="opacity-80">
                📏 {formatDistance(l.meters)} · 🚶 ~{l.walk} min · 🚲 ~{l.bike} min
                {l.transit && <><br />{l.transit}</>}
              </span>
            </li>
          ))}
        </ol>
        {coordsStops.length > 0 && (
          <a
            className="btn-primary w-full mt-3"
            target="_blank" rel="noreferrer"
            href={googleMapsDirectionsUrl(coordsStops[coordsStops.length - 1].coords as LatLng, coordsStops[0].coords as LatLng)}
          >
            🧭 Apri percorso in Google Maps
          </a>
        )}
      </section>

      <p className="text-xs opacity-60">
        Le posizioni dei luoghi sono approssimative (precisione da mappa, non da rilievo): usa "Portami qui" per la navigazione porta a porta. <Link className="underline" to="/">Torna alla Home</Link> per la navigazione GPS in tempo reale.
      </p>
    </div>
  );
}
