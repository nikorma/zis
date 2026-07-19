import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AudioControls from '../components/AudioControls';
import GuideImage from '../components/GuideImage';
import { googleMapsDirectionsUrl, type TravelMode } from '../lib/geo';
import { generatePresentation } from '../services/group';
import { geocodeOne, generateInteriorGuide, findRestaurants, type FoodPlace } from '../services/guidegen';
import { hourForecast, forecastAvailable, type HourForecast } from '../services/forecast';
import { appConfirm } from '../lib/dialog';
import MapView from '../components/MapView';
import { formatDistance } from '../lib/geo';
import WorkingScreen from '../components/WorkingScreen';
import { useApp } from '../state/AppStore';
import * as it from '../lib/itinerary';
import type { Day, Stop } from '../types';
import PlaceSearch from '../components/PlaceSearch';

function StopEditor({ day, stop, onClose }: { day: Day; stop: Stop; onClose: () => void }) {
  const { data, update } = useApp();
  const [form, setForm] = useState<Stop>({ ...stop });
  const set = <K extends keyof Stop>(k: K, v: Stop[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    update({ days: it.updateStop(data.days, day.id, stop.id, form) });
    onClose();
  };

  return (
    <div className="card space-y-2 border-terra">
      <h3 className="font-display">Modifica tappa</h3>
      <PlaceSearch onSelect={(p) => setForm((f) => ({ ...f, title: p.name, address: p.address, coords: { lat: p.lat, lng: p.lng } }))} />
      <label className="label">Titolo<input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="label">Orario<input className="input" type="time" value={form.time ?? ''} onChange={(e) => set('time', e.target.value)} /></label>
        <label className="label">Durata (min)<input className="input" type="number" min={0} value={form.durationMinutes ?? 0} onChange={(e) => set('durationMinutes', Number(e.target.value))} /></label>
      </div>
      <label className="label">Descrizione<textarea className="input" rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></label>
      <label className="label">Costo<input className="input" value={form.cost ?? ''} onChange={(e) => set('cost', e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="label">Latitudine<input className="input" type="number" step="0.0001" value={form.coords?.lat ?? ''} onChange={(e) => set('coords', { lat: Number(e.target.value), lng: form.coords?.lng ?? 0 })} /></label>
        <label className="label">Longitudine<input className="input" type="number" step="0.0001" value={form.coords?.lng ?? ''} onChange={(e) => set('coords', { lat: form.coords?.lat ?? 0, lng: Number(e.target.value) })} /></label>
      </div>
      <label className="label">Indirizzo<input className="input" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} /></label>
      <label className="label">Sito ufficiale<input className="input" type="url" value={form.officialSite ?? ''} onChange={(e) => set('officialSite', e.target.value)} /></label>
      <label className="label">Link acquisto biglietto<input className="input" type="url" value={form.ticketUrl ?? ''} onChange={(e) => set('ticketUrl', e.target.value)} /></label>
      <label className="label">Note personali<textarea className="input" rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={save}>💾 Salva</button>
        <button className="btn-ghost" onClick={onClose}>Annulla</button>
      </div>
    </div>
  );
}

const MODES: { v: TravelMode; label: string }[] = [
  { v: 'walking', label: '🚶 A piedi' },
  { v: 'driving', label: '🚗 Auto' },
  { v: 'transit', label: '🚌 Mezzi' },
  { v: 'bicycling', label: '🚲 Bici' },
];

const FOOD_RE = /ristorant|trattor|pizzer|oster|taverna|pranz|cena|colazion|brunch|aperitiv|mangiare|tapas|bistro|sushi|kebab|street ?food|gelater|panin|bar\b/i;

function StopDetails({ stop, date, dayCoords, onSave }: { stop: Stop; date: string; dayCoords?: { lat: number; lng: number }; onSave: (patch: Partial<Stop>) => void }) {
  const isFood = FOOD_RE.test(stop.title) || FOOD_RE.test(stop.description ?? '');
  const [mode, setMode] = useState<TravelMode>('walking');
  const [gen, setGen] = useState(false);
  const [genGuide, setGenGuide] = useState(false);
  const [guideErr, setGuideErr] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locFailed, setLocFailed] = useState(false);
  const [pt, setPt] = useState(0);
  const [wx, setWx] = useState<HourForecast | null>(null);
  const [finder, setFinder] = useState<null | 'ask' | 'loading' | FoodPlace[]>(null);
  const [finderWhere, setFinderWhere] = useState<'te' | 'tappa'>('tappa');

  // 🌦️ Previsioni per l'ORA e il LUOGO della tappa (solo entro 7 giorni, sempre fresche)
  useEffect(() => {
    let alive = true;
    setWx(null);
    if (stop.coords && forecastAvailable(date)) {
      hourForecast(stop.coords, date, stop.time).then((r) => { if (alive) setWx(r); });
    }
    return () => { alive = false; };
  }, [stop.coords, date, stop.time]);

  const openFinder = () => setFinder('ask');
  const searchFood = async (alto: boolean) => {
    setFinder('loading');
    // 📍 Prima provo la TUA posizione (i ristoranti "vicino a me"); se non c'è, uso la tappa
    const center = await new Promise<{ lat: number; lng: number } | null>((ok) => {
      if (!navigator.geolocation) return ok(null);
      navigator.geolocation.getCurrentPosition(
        (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => ok(null),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    });
    const base = center ?? stop.coords ?? dayCoords;
    setFinderWhere(center ? 'te' : 'tappa');
    if (!base) { setFinder([]); return; }
    let r = await findRestaurants(base, alto);
    // se vicino a te non c'è nulla, riprovo vicino alla tappa
    if (r.length === 0 && center && stop.coords) {
      setFinderWhere('tappa');
      r = await findRestaurants(stop.coords, alto);
    }
    setFinder(r);
  };

  // 📍 Geocodifica automatica: se la tappa non ha coordinate, le cerca da sola (una volta)
  useEffect(() => {
    let alive = true;
    if (!stop.coords && !locFailed && navigator.onLine) {
      setLocating(true);
      geocodeOne(stop.title, stop.address).then((r) => {
        if (!alive) return;
        setLocating(false);
        if (r) onSave({
          coords: r.coords,
          address: stop.address || r.address,
          phone: stop.phone || r.phone,
          officialSite: stop.officialSite || r.website,
        });
        else setLocFailed(true);
      });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop.id, stop.coords]);

  const makePresentation = async () => {
    setGen(true);
    const text = await generatePresentation(stop.title, stop.notes || stop.description);
    onSave({ presentation: text });
    setGen(false);
  };

  const makeGuide = async () => {
    setGenGuide(true); setGuideErr(null);
    const res = await generateInteriorGuide(stop.title, stop.address);
    setGenGuide(false);
    if (res.ok) { onSave({ interiorGuide: res.points }); setPt(0); }
    else setGuideErr(res.error);
  };

  const g = stop.interiorGuide;
  const cur = g && g[Math.min(pt, g.length - 1)];
  const searchTickets = `https://www.google.com/search?q=${encodeURIComponent('biglietti ' + stop.title + ' sito ufficiale')}`;

  return (
    <div className="mt-3 space-y-3 border-t border-dashed border-[#E4D7BC] dark:border-[#33406B] pt-3">
      {genGuide && (
        <WorkingScreen
          title="Preparo la guida interna…"
          messages={[
            'Intervisto il custode del monumento… 🗝️',
            'Conto le sale per non perderne una… 🚪',
            'Cerco i dettagli che nessuno nota… 🔍',
            'Provo l’eco per l’audioguida… 🎙️',
            'Chiedo alle statue di stare ferme per la foto 🗿',
            'Sistemo gli aneddoti nei punti giusti ✨',
          ]}
        />
      )}
      <GuideImage subject={`${stop.title}${stop.address ? ' ' + stop.address : ''}`} alt={stop.title} />
      {wx && (
        <p className="text-sm font-semibold">
          {wx.emoji} Previsto {wx.temp}°C {stop.time ? `alle ${stop.time}` : 'a mezzogiorno'}
          {wx.precipProb >= 25 && <span className="badge-warn ml-2">☔ pioggia {wx.precipProb}%</span>}
        </p>
      )}
      {stop.description && <p className="text-sm leading-relaxed">{stop.description}</p>}

      {/* 📞 Contatti (tappe cibo) */}
      {isFood && (
        <div className="rounded-xl bg-crema dark:bg-[#141C33] p-3 space-y-1.5">
          {stop.address && <p className="text-sm">📍 {stop.address}</p>}
          {stop.phone
            ? <p className="text-sm">📞 <a className="underline font-semibold" href={`tel:${stop.phone.replace(/\s/g, '')}`}>{stop.phone}</a></p>
            : <p className="text-sm">📞 <a className="underline" href={`https://www.google.com/search?q=${encodeURIComponent(stop.title + ' ' + (stop.address ?? '') + ' telefono')}`} target="_blank" rel="noreferrer">cerca il numero</a></p>}
          {stop.officialSite
            ? <p className="text-sm">🌐 <a className="underline font-semibold" href={stop.officialSite} target="_blank" rel="noreferrer">sito del locale ↗</a></p>
            : <p className="text-sm">🌐 <a className="underline" href={`https://www.google.com/search?q=${encodeURIComponent(stop.title + ' ' + (stop.address ?? ''))}`} target="_blank" rel="noreferrer">cerca il sito</a></p>}
          <button className="btn-gold w-full !min-h-[42px]" onClick={openFinder}>🍽️ Cerca altri posti per mangiare qui vicino</button>
        </div>
      )}

      {/* 🍽️ Finder ristoranti */}
      {isFood && finder === 'ask' && (
        <div className="rounded-xl border-2 border-oro p-3 space-y-2">
          <p className="font-semibold text-sm">💶 Vuoi spendere tanto?</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary !min-h-[42px]" onClick={() => searchFood(true)}>Sì, si festeggia 🥂</button>
            <button className="btn-secondary !min-h-[42px]" onClick={() => searchFood(false)}>No, economico 👛</button>
          </div>
        </div>
      )}
      {isFood && finder === 'loading' && <p className="text-sm opacity-70 animate-pulse">🍝 Annuso le cucine del quartiere…</p>}
      {isFood && Array.isArray(finder) && (
        <div className="space-y-2">
          <p className="font-semibold text-sm">🍽️ {finderWhere === 'te' ? 'Vicino a TE (posizione GPS)' : 'Vicino alla tappa'} ({finder.length}):</p>
          {finderWhere === 'tappa' && <p className="text-[11px] opacity-60 -mt-1">💡 Per cercare vicino a te, consenti la posizione al browser quando la chiede.</p>}
          {finder.length === 0 && (
            <div className="text-sm opacity-80 space-y-2">
              <p>😕 Non ho trovato locali: {(!stop.coords && finderWhere === 'tappa') ? 'questa tappa non ha una posizione (aprila e lascia che la agganci, o consenti il GPS).' : 'zona senza locali mappati o servizio momentaneamente pieno.'}</p>
              <div className="flex gap-2">
                <button className="btn-secondary !min-h-[38px] !py-1 text-sm" onClick={() => setFinder('ask')}>🔄 Riprova</button>
                <a className="btn-secondary !min-h-[38px] !py-1 text-sm" target="_blank" rel="noreferrer"
                   href={`https://www.google.com/maps/search/ristoranti/@${stop.coords?.lat},${stop.coords?.lng},16z`}>🗺️ Apri su Google Maps</a>
              </div>
            </div>
          )}
          {finder.map((f) => (
            <div key={f.name + f.meters} className="rounded-xl bg-crema dark:bg-[#141C33] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-sm">{f.name}</p>
                <span className="text-xs tabular-nums shrink-0">📏 {formatDistance(f.meters)}</span>
              </div>
              <p className="text-xs opacity-70">{f.cuisine ? `🍴 ${f.cuisine} · ` : ''}{f.address}</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                <a className="btn-ghost !min-h-[34px] !py-1 text-xs" target="_blank" rel="noreferrer"
                   href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.name)}%20${f.coords.lat},${f.coords.lng}`}>
                  ⭐ Recensioni (Google)
                </a>
                <a className="btn-ghost !min-h-[34px] !py-1 text-xs" target="_blank" rel="noreferrer"
                   href={googleMapsDirectionsUrl(f.coords, undefined, 'walking')}>🧭 Portami lì</a>
                {f.phone && <a className="btn-ghost !min-h-[34px] !py-1 text-xs" href={`tel:${f.phone.replace(/\s/g, '')}`}>📞 Chiama</a>}
              </div>
            </div>
          ))}
          <p className="text-[11px] opacity-60">Distanze dalla tappa; le recensioni si aprono su Google Maps. Il filtro budget usa il tipo di locale: verifica il menù!</p>
        </div>
      )}

      {/* 🎟️ Biglietto */}
      {!isFood && (stop.paid !== undefined || stop.ticketUrl || stop.officialSite) && (
        <div className="rounded-xl bg-crema dark:bg-[#141C33] p-3 space-y-1.5">
          <p className="text-sm font-semibold">
            {stop.paid === true && <>🎟️ <span className="badge-warn">Biglietto a pagamento</span></>}
            {stop.paid === false && <>🎟️ <span className="badge-ok">Ingresso gratuito</span> <span className="text-xs opacity-60">(da verificare)</span></>}
            {stop.paid === undefined && <>🎟️ Biglietto: da verificare</>}
          </p>
          <div className="flex flex-wrap gap-2">
            {(stop.ticketUrl || stop.officialSite) && (
              <a className="btn-primary !min-h-[38px] !py-1 text-sm" href={stop.ticketUrl || stop.officialSite} target="_blank" rel="noreferrer">
                🛒 {stop.ticketUrl ? 'Acquista' : 'Sito ufficiale'} ↗
              </a>
            )}
            {stop.paid !== false && !stop.ticketUrl && (
              <a className="btn-secondary !min-h-[38px] !py-1 text-sm" href={searchTickets} target="_blank" rel="noreferrer">
                🔎 Cerca biglietti ufficiali
              </a>
            )}
          </div>
          <p className="text-[11px] opacity-60">Prezzi e orari non sono garantiti: compra solo su siti ufficiali.</p>
        </div>
      )}

      {/* 🧭 Navigatore */}
      {stop.coords ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Modalità di viaggio">
            {MODES.map((m) => (
              <button key={m.v} className={mode === m.v ? 'chip-on !py-1 !px-3 text-xs' : 'chip-off !py-1 !px-3 text-xs'} onClick={() => setMode(m.v)}>
                {m.label}
              </button>
            ))}
          </div>
          <a className="btn-primary w-full" href={googleMapsDirectionsUrl(stop.coords, undefined, mode)} target="_blank" rel="noreferrer">
            🧭 Portami qui ({MODES.find((m) => m.v === mode)?.label.split(' ')[1]})
          </a>
        </div>
      ) : locating ? (
        <p className="text-sm opacity-70 animate-pulse">📍 Cerco la posizione della tappa…</p>
      ) : (
        <p className="text-xs opacity-60">📍 Posizione non trovata automaticamente: modifica la tappa (✏️) e usa la ricerca luoghi.</p>
      )}

      {/* ✨ Presentazione + audio */}
      {!isFood && (stop.presentation ? (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{stop.presentation}</p>
          <AudioControls text={stop.presentation} audioKey={`stop-${stop.id}`} />
          <div className="flex gap-2">
            <button className="btn-ghost !min-h-[36px] !py-1 text-sm" onClick={() => {
              const t = prompt('Modifica la presentazione:', stop.presentation);
              if (t !== null) onSave({ presentation: t });
            }}>✏️ Modifica testo</button>
            <button className="btn-ghost !min-h-[36px] !py-1 text-sm" disabled={gen} onClick={makePresentation}>
              {gen ? '⏳…' : '🔄 Rigenera'}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-gold w-full" disabled={gen} onClick={makePresentation}>
          {gen ? '⏳ Scrivo la presentazione…' : '✨ Crea presentazione e audioguida'}
        </button>
      ))}

      {/* 🏛️ Guida interna punto per punto */}
      {!isFood && (g && cur ? (
        <div className="rounded-2xl border-2 border-oro/60 p-3 space-y-2 bg-oro-tenue/20 dark:bg-oro/10">
          <div className="flex items-center justify-between">
            <p className="font-display font-semibold">🏛️ Guida interna · {pt + 1}/{g.length}</p>
            <button className="btn-ghost !min-h-[32px] !py-0.5 !px-2 text-xs" disabled={genGuide} onClick={makeGuide}>{genGuide ? '⏳' : '🔄'}</button>
          </div>
          <p className="font-semibold">{cur.name}</p>
          <GuideImage subject={`${stop.title} ${cur.name}`} alt={cur.name} />
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{cur.text}</p>
          <AudioControls
            text={cur.text}
            audioKey={`stop-${stop.id}-int-${pt}`}
            onPrev={pt > 0 ? () => setPt(pt - 1) : undefined}
            onNext={pt < g.length - 1 ? () => setPt(pt + 1) : undefined}
          />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary !min-h-[40px] !py-1.5" disabled={pt === 0} onClick={() => setPt(pt - 1)}>⏮ Indietro</button>
            <button className="btn-secondary !min-h-[40px] !py-1.5" disabled={pt >= g.length - 1} onClick={() => setPt(pt + 1)}>Avanti ⏭</button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <button className="btn-secondary w-full" disabled={genGuide} onClick={makeGuide}>
            {genGuide ? '⏳ Preparo la guida interna…' : '🏛️ Crea guida interna (audio punto per punto)'}
          </button>
          {guideErr && <p className="text-xs text-red-700 dark:text-red-300" role="alert">{guideErr}</p>}
        </div>
      ))}
    </div>
  );
}

function wakeTime(): string | null {
  try { return JSON.parse(localStorage.getItem('zaino-orari-v1') || '{}').wake ?? null; } catch { return null; }
}

export default function ItineraryPage() {
  const { data, update } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<{ dayId: string; index: number } | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [openStop, setOpenStop] = useState<string | null>(null);
  const [openMapDay, setOpenMapDay] = useState<string | null>(null);

  const setDays = (days: Day[]) => update({ days });

  const addDay = () => {
    const last = data.days[data.days.length - 1];
    const nextDate = last
      ? new Date(new Date(last.date).getTime() + 86400000).toISOString().slice(0, 10)
      : '2026-08-05';
    setDays(it.addDay(data.days, nextDate, 'Nuova giornata'));
  };

  const addStop = (dayId: string) => {
    setDays(it.addStop(data.days, dayId, { title: 'Nuova tappa', time: '10:00', durationMinutes: 60 }));
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="page-title">Itinerario</h1>
          {data.trips.find((t) => t.id === data.activeTripId)?.groupId && (
            <p className="text-xs badge-ok mt-1">👥 Viaggio di gruppo · 🔗 sincronizzato in tempo reale</p>
          )}
        </div>
        <div className="flex gap-1.5">
          <button className="btn-gold !min-h-[40px] !py-1.5" onClick={addDay}>＋ Giornata</button>
          {data.days.length > 0 && (
            <button
              className="btn-ghost !min-h-[40px] !py-1.5 text-red-700 dark:text-red-300"
              aria-label="Elimina tutto l'itinerario"
              onClick={async () => {
                if (await appConfirm(`Eliminare TUTTO l'itinerario (${data.days.length} giornate)?\nNon si può annullare. Biglietti e impostazioni restano.`, 'Elimina tutto', true)) {
                  update({
                    days: [],
                    trips: data.trips.filter((t) => t.id !== data.activeTripId),
                    activeTripId: undefined,
                  });
                }
              }}
            >🗑️ Elimina itinerario</button>
          )}
        </div>
      </header>
      <div className="azulejo-band" aria-hidden />
      <p className="text-xs opacity-60">Tutte le modifiche vengono salvate automaticamente. Trascina le tappe per riordinarle (o usa le frecce ▲▼).</p>

      {data.days.map((day) => (
        <section key={day.id} className="card space-y-3">
          {editingDay === day.id ? (
            <div className="flex gap-2 items-end flex-wrap">
              <label className="label flex-1">Titolo<input className="input" value={day.title} onChange={(e) => setDays(it.updateDay(data.days, day.id, { title: e.target.value }))} /></label>
              <label className="label">Data<input className="input" type="date" value={day.date} onChange={(e) => setDays(it.updateDay(data.days, day.id, { date: e.target.value }))} /></label>
              <button className="btn-primary !min-h-[40px] !py-1.5" onClick={() => setEditingDay(null)}>OK</button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg">
                  {new Date(day.date + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                <p className="text-sm opacity-80">{day.title}</p>
                {day.stops.filter((st) => st.coords).length >= 2 && (
                  <button className="btn-ghost !min-h-[32px] !py-0.5 !px-2 text-xs" onClick={() => setOpenMapDay(openMapDay === day.id ? null : day.id)}>
                    {openMapDay === day.id ? '🗺️ Nascondi percorso ▲' : '🗺️ Anteprima percorso ▼'}
                  </button>
                )}
                {openMapDay === day.id && (() => {
                  const withCoords = day.stops.filter((st) => st.coords);
                  return (
                    <div className="mt-2">
                      <MapView
                        height="32vh"
                        markers={withCoords.map((st, idx) => ({
                          coords: st.coords as { lat: number; lng: number },
                          label: `${st.time ? st.time + ' · ' : idx + 1 + '. '}${st.title}`,
                          kind: 'stop' as const,
                        }))}
                        route={withCoords.map((st) => st.coords as { lat: number; lng: number })}
                      />
                      <p className="text-[11px] opacity-60 mt-1">Linea nell'ordine di visita. Le tappe senza posizione non compaiono: aprile una volta per agganciarla.</p>
                    </div>
                  );
                })()}
                {wakeTime() && day.stops.length > 0 && (
                  <p className="text-xs opacity-60">⏰ Sveglia consigliata: {wakeTime()} <span className="opacity-70">(impostala sul telefono: le app web non possono farlo da sole)</span></p>
                )}
              </div>
              <div className="flex gap-1">
                <Link to={`/mappa/${day.id}`} className="btn-ghost !min-h-[40px] !py-1.5" aria-label="Mappa della giornata">🗺️</Link>
                <button className="btn-ghost !min-h-[40px] !py-1.5" onClick={() => setEditingDay(day.id)} aria-label="Modifica giornata">✏️</button>
                <button
                  className="btn-ghost !min-h-[40px] !py-1.5"
                  aria-label="Elimina giornata"
                  onClick={() => { if (confirm(`Eliminare la giornata "${day.title}"?`)) setDays(it.removeDay(data.days, day.id)); }}
                >🗑️</button>
              </div>
            </div>
          )}

          <ol className="space-y-2 route">
            {day.stops.map((s, i) => {
              return (
                <li
                  key={s.id}
                  draggable
                  onDragStart={() => setDragFrom({ dayId: day.id, index: i })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom && dragFrom.dayId === day.id) {
                      setDays(it.moveStop(data.days, day.id, dragFrom.index, i));
                    }
                    setDragFrom(null);
                  }}
                  className={`rounded-xl border p-3 bg-white dark:bg-[#202B49] ${s.visited ? 'opacity-60 done' : ''} border-[#EAE0CB] dark:border-[#33406B]`}
                >
                  <div className="flex items-start gap-2">
                    <span className="cursor-grab select-none pt-1" aria-hidden title="Trascina per riordinare">⠿</span>
                    <div className="flex-1 min-w-0">
                      <button className="font-semibold text-left w-full" onClick={() => setOpenStop(openStop === s.id ? null : s.id)} aria-expanded={openStop === s.id}>
                        {s.time
                          ? <span className="tabular-nums mr-2">{s.time}</span>
                          : <span className="mr-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-terra text-white text-xs font-bold align-middle">{i + 1}</span>}
                        {s.title} <span className="opacity-40 text-xs">{openStop === s.id ? '▲' : '▼ tocca per guida e navigatore'}</span>
                      </button>
                      {s.description && <p className="text-sm opacity-80">{s.description}</p>}
                      <p className="text-xs opacity-60 mt-1">
                        {s.durationMinutes ? `⏱ ${s.durationMinutes} min · ` : ''}{s.cost ?? ''}
                        {s.transit && (
                          <>
                            {' · '}🚶 {s.transit.walkMinutes ?? '—'} min
                            {s.transit.bikeMinutes ? ` · 🚲 ${s.transit.bikeMinutes} min` : ''}
                            {s.transit.transitMinutes ? ` · 🚌 ${s.transit.transitMinutes} min (${s.transit.line ?? ''}${s.transit.fromStop ? `, da ${s.transit.fromStop}` : ''}${s.transit.toStop ? ` a ${s.transit.toStop}` : ''}${s.transit.changes ? `, cambi: ${s.transit.changes}` : ''})` : ''}
                            {s.transit.costNote ? ` · ${s.transit.costNote}` : ''}
                          </>
                        )}
                      </p>
                      {s.notes && <p className="text-xs mt-1 italic">📝 {s.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <div className="flex gap-1">
                        <button className="btn-ghost !min-h-[32px] !py-0.5 !px-2" aria-label="Sposta su" onClick={() => setDays(it.moveStop(data.days, day.id, i, i - 1))}>▲</button>
                        <button className="btn-ghost !min-h-[32px] !py-0.5 !px-2" aria-label="Sposta giù" onClick={() => setDays(it.moveStop(data.days, day.id, i, i + 1))}>▼</button>
                      </div>
                      <div className="flex gap-1">
                        <button className="btn-ghost !min-h-[32px] !py-0.5 !px-2" aria-label="Modifica tappa" onClick={() => setEditing(s.id)}>✏️</button>
                        <button className="btn-ghost !min-h-[32px] !py-0.5 !px-2" aria-label="Elimina tappa" onClick={() => { if (confirm(`Eliminare "${s.title}"?`)) setDays(it.removeStop(data.days, day.id, s.id)); }}>🗑️</button>
                      </div>
                      <label className="text-xs flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={s.visited} onChange={() => setDays(it.toggleVisited(data.days, day.id, s.id))} />
                        Visitata
                      </label>
                    </div>
                  </div>
                  {editing === s.id && <div className="mt-2"><StopEditor day={day} stop={s} onClose={() => setEditing(null)} /></div>}
                  {openStop === s.id && (
                    <StopDetails stop={s} date={day.date} dayCoords={day.stops.find((x) => x.coords)?.coords} onSave={(patch) => setDays(it.updateStop(data.days, day.id, s.id, patch))} />
                  )}
                </li>
              );
            })}
          </ol>
          <button className="btn-secondary w-full" onClick={() => addStop(day.id)}>＋ Aggiungi tappa</button>
        </section>
      ))}
    </div>
  );
}
