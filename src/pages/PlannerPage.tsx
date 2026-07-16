import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppStore';
import PlaceSearch, { type FoundPlace } from '../components/PlaceSearch';
import { uid } from '../lib/itinerary';
import type { Day, Stop } from '../types';
import { firebaseReady, getSavedGroupId, addGroupStop } from '../services/group';
import WorkingScreen from '../components/WorkingScreen';

interface PlanStop { title: string; time?: string; durationMinutes?: number; description?: string; address?: string; paid?: boolean | null; officialSite?: string | null }
interface PlanDay { date: string; title: string; stops: PlanStop[] }

export default function PlannerPage() {
  const { data, update } = useApp();
  const nav = useNavigate();

  // Passo 1: dati base
  const [dest, setDest] = useState('');
  const [destPicked, setDestPicked] = useState<FoundPlace | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [checkin, setCheckin] = useState('15:00');
  const [checkout, setCheckout] = useState('10:00');
  const [notes, setNotes] = useState('');

  // Passo 2: le DOMANDE OBBLIGATORIE prima di generare
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [siesta, setSiesta] = useState<boolean | null>(null);
  const [lunchOut, setLunchOut] = useState<boolean | null>(null);
  const [dinnerOut, setDinnerOut] = useState<boolean | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanDay[] | null>(null);

  const canStep2 = (destPicked || dest.trim().length >= 3) && start && end && start <= end;
  const canGenerate = siesta !== null && lunchOut !== null && dinnerOut !== null;

  const generate = async () => {
    setBusy(true); setErr(null); setPlan(null);
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: destPicked ? `${destPicked.name} (${destPicked.address})` : dest,
          startDate: start, endDate: end,
          checkinTime: checkin, checkoutTime: checkout,
          afternoonBreak: siesta, lunchOut, dinnerOut, notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generazione non riuscita');
      setPlan(json.days as PlanDay[]);
      setStep(3);
    } catch (e) {
      setErr(
        (e as Error).message.includes('non configurato')
          ? 'Il planner richiede il backend AI: aggiungi OPENAI_API_KEY nelle variabili d\u2019ambiente su Vercel (vedi README).'
          : `${(e as Error).message}`
      );
    }
    setBusy(false);
  };

  const toDays = (p: PlanDay[]): Day[] =>
    p.map((d) => ({
      id: uid('day'),
      date: d.date,
      title: d.title || `Giornata a ${destPicked?.name ?? dest}`,
      stops: d.stops.map((s): Stop => ({
        id: uid('stop'),
        title: s.title,
        time: s.time,
        durationMinutes: s.durationMinutes,
        description: s.description,
        address: s.address || (destPicked?.name ?? dest),
        paid: typeof s.paid === 'boolean' ? s.paid : undefined,
        officialSite: s.officialSite || undefined,
        visited: false,
      })),
    }));

  const save = (mode: 'replace' | 'append') => {
    if (!plan) return;
    const days = toDays(plan);
    update({ days: mode === 'replace' ? days : [...data.days, ...days].sort((a, b) => a.date.localeCompare(b.date)) });
    nav('/itinerario');
  };

  const shareText = () => {
    if (!plan) return;
    const txt = plan.map((d) =>
      `📅 ${d.date} — ${d.title}\n` + d.stops.map((s) => `  ${s.time ?? ''} ${s.title}${s.address ? ` (${s.address})` : ''}`).join('\n')
    ).join('\n\n');
    const full = `Itinerario ${destPicked?.name ?? dest} (${start} → ${end})\n\n${txt}\n\nCreato con Zaino in Spalla 🎒`;
    if (navigator.share) navigator.share({ text: full }).catch(() => {});
    else navigator.clipboard.writeText(full).then(() => alert('Itinerario copiato: incollalo dove vuoi!'));
  };

  const sendToGroup = async () => {
    const gid = getSavedGroupId();
    if (!firebaseReady() || !gid || !plan) { alert('Prima entra in un Gruppo di viaggio (Altro → Gruppo).'); return; }
    setBusy(true);
    try {
      for (const d of plan) for (const s of d.stops) {
        await addGroupStop(gid, { title: s.title, date: d.date, time: s.time, address: s.address, notes: 'dal planner' }, s.description || s.title);
      }
      alert('Itinerario inviato al gruppo! 🎉');
    } catch (e) { setErr(String((e as Error).message)); }
    setBusy(false);
  };

  const YesNo = ({ value, onChange, yes, no }: { value: boolean | null; onChange: (v: boolean) => void; yes: string; no: string }) => (
    <div className="grid grid-cols-2 gap-2">
      <button className={value === true ? 'chip-on justify-center !py-2' : 'chip-off justify-center !py-2'} onClick={() => onChange(true)}>{yes}</button>
      <button className={value === false ? 'chip-on justify-center !py-2' : 'chip-off justify-center !py-2'} onClick={() => onChange(false)}>{no}</button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      {busy && !plan && <WorkingScreen />}
      <h1 className="page-title">Pianifica un viaggio</h1>
      <div className="azulejo-band" aria-hidden />
      <p className="text-sm opacity-80">Qualsiasi destinazione: dimmi periodo, orari e luogo — al resto pensa la guida. 🌍</p>
      {err && <p className="card text-sm text-red-700 dark:text-red-300" role="alert">{err}</p>}

      {step === 1 && (
        <section className="card space-y-3">
          <h2 className="font-display text-lg">1 · Il viaggio</h2>
          <div>
            <span className="label">Destinazione</span>
            <PlaceSearch placeholder="es. Lisbona, Atene, Parigi…" onSelect={(p) => { setDestPicked(p); setDest(p.name); }} />
            {destPicked
              ? <p className="text-xs badge-ok mt-1">📍 {destPicked.name} — {destPicked.address}</p>
              : <input className="input mt-2" placeholder="…oppure scrivila qui" value={dest} onChange={(e) => setDest(e.target.value)} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="label">Arrivo<input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="label">Partenza<input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
            <label className="label">Orario check-in<input className="input" type="time" value={checkin} onChange={(e) => setCheckin(e.target.value)} /></label>
            <label className="label">Orario check-out<input className="input" type="time" value={checkout} onChange={(e) => setCheckout(e.target.value)} /></label>
          </div>
          <label className="label">Preferenze extra (facoltativo)<input className="input" placeholder="es. viaggio con bambini, amo i musei…" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <button className="btn-primary w-full" disabled={!canStep2} onClick={() => setStep(2)}>Avanti →</button>
        </section>
      )}

      {step === 2 && (
        <section className="card space-y-4">
          <h2 className="font-display text-lg">2 · Due domande prima di creare l\u2019itinerario</h2>
          <div className="space-y-2">
            <p className="font-medium">🛌 Il giro dev\u2019essere senza sosta pomeridiana?</p>
            <YesNo value={siesta === null ? null : !siesta} onChange={(v) => setSiesta(!v)} yes="Sì, tutto di fila" no="No, voglio la pausa" />
          </div>
          <div className="space-y-2">
            <p className="font-medium">🍽️ Preferisci pranzare fuori?</p>
            <YesNo value={lunchOut} onChange={setLunchOut} yes="Sì, pranzo fuori" no="No" />
          </div>
          <div className="space-y-2">
            <p className="font-medium">🌙 E cenare fuori?</p>
            <YesNo value={dinnerOut} onChange={setDinnerOut} yes="Sì, cena fuori" no="No" />
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setStep(1)}>← Indietro</button>
            <button className="btn-primary flex-1" disabled={!canGenerate || busy} onClick={generate}>
              {busy ? '⏳ Creo l\u2019itinerario…' : '✨ Crea itinerario'}
            </button>
          </div>
        </section>
      )}

      {step === 3 && plan && (
        <>
          <section className="space-y-3">
            {plan.map((d, i) => (
              <div key={i} className="card">
                <p className="font-display">{new Date(d.date + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} — {d.title}</p>
                <ul className="mt-1 text-sm space-y-0.5">
                  {d.stops.map((s, j) => (
                    <li key={j}><span className="tabular-nums opacity-70">{s.time ?? '—'}</span> <strong>{s.title}</strong>{s.description ? ` · ${s.description}` : ''}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
          <section className="card space-y-2">
            <h2 className="font-display text-lg">💾 Salva e condividi</h2>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary" onClick={() => save('append')}>➕ Aggiungi al mio itinerario</button>
              <button className="btn-secondary" onClick={() => { if (confirm('Sostituire tutto l\u2019itinerario attuale?')) save('replace'); }}>♻️ Sostituisci itinerario</button>
              <button className="btn-secondary" onClick={shareText}>📤 Condividi (WhatsApp…)</button>
              <button className="btn-secondary" disabled={busy} onClick={sendToGroup}>👥 Invia al Gruppo</button>
            </div>
            <button className="btn-ghost w-full" onClick={() => { setPlan(null); setStep(2); }}>🔄 Rigenera con altre scelte</button>
            <p className="text-xs opacity-60">⚠️ Orari di apertura e prezzi non sono garantiti: l\u2019itinerario è una proposta da verificare sui siti ufficiali.</p>
          </section>
        </>
      )}
    </div>
  );
}
