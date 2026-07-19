import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppStore';
import { appConfirm } from '../lib/dialog';
import { useGeolocation } from '../hooks/useGeolocation';
import { dayForDate, nextStop } from '../lib/itinerary';
import { distanceMeters, formatDistance, nearestTarget, googleMapsDirectionsUrl, clampRadius } from '../lib/geo';
import { announceArrival } from '../services/tts';
import type { Stop } from '../types';
import MapView from '../components/MapView';

export default function HomePage() {
  const { data, update } = useApp();
  const nav = useNavigate();
  const geo = useGeolocation();
  const [targetStopId, setTargetStopId] = useState<string | null>(null);
  const [arrivedMsg, setArrivedMsg] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  const todayIso = new Date().toISOString().slice(0, 10);
  const day = useMemo(() => dayForDate(data.days, todayIso), [data.days, todayIso]);
  const next = useMemo(() => nextStop(day), [day]);

  const stopsWithCoords = useMemo(
    () => (day?.stops ?? []).filter((s): s is Stop & { coords: NonNullable<Stop['coords']> } => !!s.coords),
    [day]
  );
  const target: Stop | null = useMemo(() => {
    if (targetStopId) return day?.stops.find((s) => s.id === targetStopId) ?? null;
    return next && next.coords ? next : stopsWithCoords[0] ?? null;
  }, [targetStopId, day, next, stopsWithCoords]);

  const distance = geo.position && target?.coords ? distanceMeters(geo.position, target.coords) : null;

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Rilevamento arrivo: avviso una sola volta per destinazione.
  useEffect(() => {
    if (!geo.position || !target?.coords) return;
    geo.detector.setRadius(clampRadius(data.settings.arrivalRadiusMeters));
    const res = geo.detector.update(target.id, geo.position, target.coords, geo.accuracy ?? 0);
    if (res === 'arrived') {
      setArrivedMsg(target.title);
      announceArrival(target.title, data.settings);
    }
  }, [geo.position, geo.accuracy, target, data.settings, geo.detector]);


  const enableGps = () => {
    update({ settings: { ...data.settings, geoConsent: true } });
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((p) =>
        update({ settings: { ...data.settings, geoConsent: true, notificationsConsent: p === 'granted' } })
      );
    }
    geo.start();
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <header className="hero-dusk anim-rise">
        <span className="shine" aria-hidden />
        <h1 className="font-display font-black text-3xl leading-none">Zaino <span className="text-oro">in Spalla</span></h1>
        <p className="opacity-75 text-sm mt-1">
          {day
            ? new Date(day.date + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
            : 'Il tuo compagno di viaggio'}
        </p>
        {next && (
          <div className="hero-panel max-w-[85%]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-oro font-bold">Prossima tappa</p>
            <p className="font-display font-semibold text-xl">{next.title}</p>
            <p className="text-xs opacity-90 mt-1">
              {next.time && <>🕘 {next.time} · </>}
              📍 {distance !== null ? formatDistance(distance) : geo.status === 'active' ? '—' : 'attiva il GPS'}
            </p>
          </div>
        )}
      </header>

      {!online && (
        <div className="card badge-warn !flex w-full justify-center" role="status">
          📴 Sei offline: itinerario, schede, guide interne e audio scaricati restano disponibili.
        </div>
      )}

      {data.trips.length > 0 && (
        <section className="card space-y-2 anim-rise-1">
          <h2 className="font-display text-lg">🗺️ I miei viaggi</h2>
          {data.trips.map((t) => {
            const active = t.id === data.activeTripId;
            const dates = t.days.length
              ? `${new Date(t.days[0].date + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} → ${new Date(t.days[t.days.length - 1].date + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`
              : 'vuoto';
            return (
              <div key={t.id} className={`flex items-center gap-2 rounded-xl p-2 ${active ? 'bg-crema dark:bg-[#141C33]' : ''}`}>
                <button className="flex-1 text-left" onClick={() => update({ days: t.days, activeTripId: t.id })}>
                  <span className="font-semibold text-sm">{t.groupId ? '👥' : '🧭'} {t.name}</span>
                  <span className="block text-xs opacity-60">{t.days.length} giornate · {dates}{t.groupId ? ' · 🔗 sincronizzato col gruppo' : ''}</span>
                </button>
                {active
                  ? <span className="badge-ok shrink-0">Aperto</span>
                  : <button className="btn-secondary !min-h-[36px] !py-1 text-sm shrink-0" onClick={() => update({ days: t.days, activeTripId: t.id })}>Apri</button>}
                <button className="btn-ghost !min-h-[36px] !py-1 !px-2 shrink-0" aria-label="Elimina viaggio" onClick={async () => {
                  if (await appConfirm(`Eliminare il viaggio "${t.name}"?\nLe sue giornate e tappe andranno perse.`, 'Elimina', true)) {
                    const trips = data.trips.filter((x) => x.id !== t.id);
                    update(active ? { trips, days: [], activeTripId: undefined } : { trips });
                  }
                }}>🗑️</button>
              </div>
            );
          })}
        </section>
      )}

      {data.days.length === 0 ? (
        <section className="card space-y-3 text-center anim-rise-2">
          <p className="text-5xl floaty" aria-hidden>🎒</p>
          <h2 className="font-display font-black text-xl">Il tuo prossimo viaggio parte da qui</h2>
          <p className="text-sm opacity-70">Crea l’itinerario in un minuto con il planner: verrà salvato qui automaticamente.</p>
          <div className="grid grid-cols-2 gap-2 pt-2 text-left stagger-lr">
            <Link to="/pianifica" className="btn-primary col-span-2 text-base justify-center">🌍 Pianifica un viaggio</Link>
            <Link to="/itinerario" className="btn-secondary justify-center">✏️ Crea a mano</Link>
            <Link to="/gruppo" className="btn-secondary justify-center">👥 Viaggio di gruppo</Link>
            <Link to="/valigia" className="btn-secondary col-span-2 justify-center">🧳 Valigia intelligente</Link>
          </div>
        </section>
      ) : (
      <section className="card space-y-2 anim-rise-2">
        {day && <p className="text-sm font-semibold">{day.title}</p>}
        {!day && <p className="text-sm opacity-70">Oggi non ci sono tappe in programma: goditi la giornata o apri l’itinerario.</p>}
        {day && !next && <p className="text-sm opacity-70">Tutte le tappe di oggi sono state visitate. 🎉</p>}
        <div className="grid grid-cols-2 gap-2 pt-2 stagger-lr">
          {data.days.length === 0 ? (
            <>
              <Link to="/pianifica" className="btn-primary col-span-2 text-base">🌍 Pianifica un viaggio</Link>
              <Link to="/itinerario" className="btn-secondary">✏️ Crea a mano</Link>
              <Link to="/gruppo" className="btn-secondary">👥 Viaggio di gruppo</Link>
            </>
          ) : (
            <>
              <button className="btn-primary col-span-2 text-base" onClick={() => nav('/itinerario')}>🥾 Zaino in spalla, si parte!</button>
              <Link to="/gruppo" className="btn-secondary">👥 Gruppo</Link>
              <Link to="/occhio" className="btn-secondary col-span-2">📸 Occhio di viaggio (traduci / riconosci)</Link>
              {geo.status === 'active' || geo.status === 'low-accuracy' || geo.status === 'stale' ? (
                <button className="btn-secondary" onClick={geo.stop}>🛑 Disattiva GPS</button>
              ) : (
                <button className="btn-gold" onClick={enableGps}>📡 Attiva GPS</button>
              )}
            </>
          )}
        </div>
      </section>
      )}

      {(geo.status !== 'idle') && (
        <section className="card space-y-3">
          <h2 className="font-display text-lg">Navigazione GPS</h2>
          {geo.errorMessage && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{geo.errorMessage}</p>}
          {geo.status === 'stale' && (
            <p className="text-sm badge-warn" role="status">
              ⚠️ Posizione non aggiornata: il browser sospende il GPS in background o a schermo spento. Riporta l’app in primo piano.
            </p>
          )}
          {arrivedMsg && (
            <div className="rounded-xl bg-green-100 dark:bg-green-900/40 p-3 text-green-900 dark:text-green-100" role="alert">
              ✅ Sei arrivato alla destinazione: <strong>{arrivedMsg}</strong>.
              <div className="mt-2 flex gap-2 flex-wrap">
                <button className="btn-ghost !min-h-[40px] !py-1.5" onClick={() => { geo.detector.reset(target?.id); setArrivedMsg(null); }}>
                  🔁 Ripeti avviso al prossimo passaggio
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center text-sm">
            <label className="label !mb-0">Seleziona destinazione:</label>
            <select
              className="input !w-auto"
              value={target?.id ?? ''}
              onChange={(e) => setTargetStopId(e.target.value || null)}
              aria-label="Seleziona destinazione"
            >
              {stopsWithCoords.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            <button
              className="btn-ghost !min-h-[40px] !py-1.5"
              onClick={() => {
                if (!geo.position) return;
                const best = nearestTarget(geo.position, stopsWithCoords);
                if (best) setTargetStopId(best.target.id);
              }}
            >
              🎯 Usa tappa più vicina
            </button>
            {target && (
              <button
                className="btn-ghost !min-h-[40px] !py-1.5"
                onClick={() => { if (target) { geo.detector.reset(target.id); setArrivedMsg(null); } }}
              >
                🔁 Ripeti avviso
              </button>
            )}
          </div>

          <MapView
            height="40vh"
            markers={[
              ...(geo.position ? [{ coords: geo.position, label: 'Tu sei qui', kind: 'user' as const }] : []),
              ...(target?.coords ? [{ coords: target.coords, label: target.title, kind: 'target' as const }] : []),
            ]}
            route={geo.position && target?.coords ? [geo.position, target.coords] : undefined}
            highlight={target?.coords ?? null}
          />
          {target?.coords && (
            <a className="btn-primary w-full" target="_blank" rel="noreferrer"
               href={googleMapsDirectionsUrl(target.coords, geo.position ?? undefined)}>
              🧭 Portami qui (Google Maps)
            </a>
          )}
          <p className="text-xs opacity-60">
            La posizione resta sul tuo dispositivo e non viene inviata a nessun server. I browser possono sospendere il GPS quando l’app è in background o lo schermo è spento: per la navigazione continua tieni lo schermo acceso o usa "Portami qui".
          </p>
        </section>
      )}
    </div>
  );
}
