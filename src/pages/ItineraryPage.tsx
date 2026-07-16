import { useState } from 'react';
import { Link } from 'react-router-dom';
import AudioControls from '../components/AudioControls';
import GuideImage from '../components/GuideImage';
import { googleMapsDirectionsUrl, type TravelMode } from '../lib/geo';
import { generatePresentation } from '../services/group';
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

function StopDetails({ stop, onSave }: { stop: Stop; onSave: (patch: Partial<Stop>) => void }) {
  const [mode, setMode] = useState<TravelMode>('walking');
  const [gen, setGen] = useState(false);

  const makePresentation = async () => {
    setGen(true);
    const text = await generatePresentation(stop.title, stop.notes || stop.description);
    onSave({ presentation: text });
    setGen(false);
  };

  return (
    <div className="mt-3 space-y-3 border-t border-dashed border-[#E4D7BC] dark:border-[#33406B] pt-3">
      <GuideImage subject={`${stop.title}${stop.address ? ' ' + stop.address : ''}`} alt={stop.title} />

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
      ) : (
        <p className="text-xs opacity-60">📍 Nessuna posizione: modifica la tappa (✏️) e cerca il luogo per attivare il navigatore.</p>
      )}

      {stop.presentation ? (
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
      )}
    </div>
  );
}

export default function ItineraryPage() {
  const { data, update } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<{ dayId: string; index: number } | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [openStop, setOpenStop] = useState<string | null>(null);

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
        <h1 className="page-title">Itinerario</h1>
        <div className="flex gap-1.5">
          <button className="btn-gold !min-h-[40px] !py-1.5" onClick={addDay}>＋ Giornata</button>
          {data.days.length > 0 && (
            <button
              className="btn-ghost !min-h-[40px] !py-1.5 text-red-700 dark:text-red-300"
              aria-label="Elimina tutto l'itinerario"
              onClick={() => {
                if (confirm(`Eliminare TUTTO l'itinerario (${data.days.length} giornate)? Biglietti e impostazioni non vengono toccati.`) && confirm('Sicuro sicuro? Non si può annullare. 🎒')) {
                  update({ days: [] });
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
                        {s.time && <span className="tabular-nums mr-2">{s.time}</span>}
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
                    <StopDetails stop={s} onSave={(patch) => setDays(it.updateStop(data.days, day.id, s.id, patch))} />
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
