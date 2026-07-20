import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppStore';
import PlaceSearch, { type FoundPlace } from '../components/PlaceSearch';
import { uid } from '../lib/itinerary';
import type { Day, Stop, Trip } from '../types';
import { firebaseReady, getSavedGroupId, addGroupStop, createGroup, type GroupInfo } from '../services/group';
import WorkingScreen from '../components/WorkingScreen';

interface PlanStop { title: string; time?: string; durationMinutes?: number; description?: string; address?: string; paid?: boolean | null; officialSite?: string | null }
interface PlanDay { date: string; title: string; stops: PlanStop[] }

const MEAL_LS = 'zaino-orari-v1';
interface MealPrefs { wake: string; breakfast: string; lunch: string; dinner: string }
const DEFAULT_MEALS: MealPrefs = { wake: '07:30', breakfast: '08:00', lunch: '13:00', dinner: '20:30' };
function loadMeals(): MealPrefs {
  try { return { ...DEFAULT_MEALS, ...JSON.parse(localStorage.getItem(MEAL_LS) || '{}') }; } catch { return DEFAULT_MEALS; }
}

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
  const [mode, setMode] = useState<'auto' | 'manuale'>('auto');
  const [timeMode, setTimeMode] = useState<'orari' | 'ordine'>('orari');
  const [groupFlow] = useState<boolean>(() => sessionStorage.getItem('zaino-gflow') === '1');
  const [newGroup, setNewGroup] = useState<GroupInfo | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [progress, setProgress] = useState<string>('');
  const [wishlist, setWishlist] = useState('');

  // Passo 2: le DOMANDE OBBLIGATORIE prima di generare
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [siesta, setSiesta] = useState<boolean | null>(null);
  const [lunchOut, setLunchOut] = useState<boolean | null>(null);
  const [dinnerOut, setDinnerOut] = useState<boolean | null>(null);
  const [meals, setMeals] = useState<MealPrefs>(loadMeals());

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanDay[] | null>(null);

  const canStep2 = (destPicked || dest.trim().length >= 3) && start && end && start <= end
    && (mode === 'auto' || wishlist.trim().length >= 3);
  const canGenerate = siesta !== null && lunchOut !== null && dinnerOut !== null;

  const generate = async () => {
    localStorage.setItem(MEAL_LS, JSON.stringify(meals));
    setBusy(true); setErr(null); setPlan(null); setProgress('');
    try {
      // 📦 Viaggi lunghi: si genera a blocchi di 6 giorni (l'AI non regge un mese in un colpo)
      const addDays = (iso: string, n: number) => {
        const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
      };
      const totalDays = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
      const CHUNK = 6;
      const parts: { s: string; e: string }[] = [];
      for (let off = 0; off < totalDays; off += CHUNK) {
        parts.push({ s: addDays(start, off), e: addDays(start, Math.min(off + CHUNK - 1, totalDays - 1)) });
      }

      const generated: PlanDay[] = [];
      const allWarnings: string[] = [];
      const usedPlaces: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        if (parts.length > 1) setProgress(`Blocco ${i + 1} di ${parts.length} · giorni ${parts[i].s.slice(8)}–${parts[i].e.slice(8)}`);
        const res = await fetch('/api/planner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: destPicked ? `${destPicked.name} (${destPicked.address})` : dest,
            startDate: parts[i].s, endDate: parts[i].e,
            checkinTime: checkin, checkoutTime: checkout,
            afternoonBreak: siesta, lunchOut, dinnerOut, notes,
            mealTimes: meals,
            mode, wishlist: mode === 'manuale' ? wishlist : undefined,
            timeMode,
            tripStart: start, tripEnd: end,
            partIndex: i + 1, partTotal: parts.length,
            usedPlaces: usedPlaces.slice(-60),
            lang: data.settings.lang,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Generazione non riuscita (blocco ${i + 1}/${parts.length})`);
        const days = json.days as PlanDay[];
        generated.push(...days);
        if (Array.isArray(json.warnings)) allWarnings.push(...(json.warnings as string[]));
        for (const d of days) for (const st of d.stops) usedPlaces.push(st.title);
      }
      setProgress('');
      setPlan(generated);
      setWarnings(allWarnings.slice(0, 8));
      // 💾 Salvataggio automatico tra "I miei viaggi" (e diventa l'itinerario aperto)
      const days = toDaysFrom(generated);
      const trip: Trip = {
        id: uid('trip'),
        name: `${destPicked?.name ?? dest} · ${start}`,
        destination: destPicked?.name ?? dest,
        days,
        createdAt: new Date().toISOString(),
      };
      if (groupFlow && firebaseReady()) {
        // 👥 Flusso unico: crea il gruppo, invia tutte le tappe (con presentazioni), collega il viaggio
        try {
          const g = await createGroup(`Viaggio a ${destPicked?.name ?? dest}`, start, end);
          for (const d of generated) for (const st of d.stops) {
            await addGroupStop(g.id, { title: st.title, date: d.date, time: st.time, address: st.address, notes: st.description }, st.description || st.title);
          }
          trip.groupId = g.id;
          trip.name = `${destPicked?.name ?? dest} 👥`;
          setNewGroup(g);
          sessionStorage.removeItem('zaino-gflow');
        } catch (e) { setErr('Itinerario creato, ma il gruppo no: ' + String((e as Error).message)); }
      }
      update({ trips: [...data.trips, trip], days, activeTripId: trip.id });
      setStep(3);
    } catch (e) {
      setErr(
        (e as Error).message.includes('non configurato')
          ? 'Il planner richiede il backend AI: aggiungi OPENAI_API_KEY nelle variabili d’ambiente su Vercel (vedi README).'
          : `${(e as Error).message}`
      );
    }
    setBusy(false);
  };

  const toDaysFrom = (p: PlanDay[]): Day[] =>
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



  const shareText = () => {
    if (!plan) return;
    const txt = plan.map((d) =>
      `📅 ${d.date} — ${d.title}\n` + d.stops.map((s) => `  ${s.time ?? ''} ${s.title}${s.address ? ` (${s.address})` : ''}`).join('\n')
    ).join('\n\n');
    const full = `Itinerario ${destPicked?.name ?? dest} (${start} → ${end})\n\n${txt}\n\nCreato con ZainoInSpalla 🎒`;
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
      {busy && !plan && <WorkingScreen progress={progress} />}
      <h1 className="page-title">Pianifica un viaggio</h1>
      <div className="azulejo-band" aria-hidden />
      {groupFlow && !newGroup && <p className="badge-warn !flex w-full justify-center">👥 Stai creando un VIAGGIO DI GRUPPO: alla fine avrai anche il codice da mandare agli amici</p>}
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
          <div className="space-y-1">
            <p className="label !mb-0">🕘 Come vuoi le tappe?</p>
            <div className="grid grid-cols-2 gap-2">
              <button className={timeMode === 'orari' ? 'chip-on justify-center !py-2' : 'chip-off justify-center !py-2'} onClick={() => setTimeMode('orari')}>⏰ Con orari precisi</button>
              <button className={timeMode === 'ordine' ? 'chip-on justify-center !py-2' : 'chip-off justify-center !py-2'} onClick={() => setTimeMode('ordine')}>🔢 Solo ordine di visita</button>
            </div>
            {timeMode === 'ordine' && <p className="text-xs opacity-60">Niente orologio: tappe numerate 1, 2, 3… nell'ordine migliore. Pranzo e cena restano al posto giusto della sequenza.</p>}
          </div>
          <div className="space-y-1">
            <p className="label !mb-0">Chi sceglie le cose da vedere?</p>
            <div className="grid grid-cols-2 gap-2">
              <button className={mode === 'auto' ? 'chip-on justify-center !py-2' : 'chip-off justify-center !py-2'} onClick={() => setMode('auto')}>🤖 Fa tutto ZainoInSpalla</button>
              <button className={mode === 'manuale' ? 'chip-on justify-center !py-2' : 'chip-off justify-center !py-2'} onClick={() => setMode('manuale')}>✍️ Scrivo io cosa vedere</button>
            </div>
            {mode === 'manuale' && (
              <label className="label">Le cose che VUOI vedere (una per riga)
                <textarea className="input" rows={5} placeholder={'Acropoli\nMuseo Archeologico\nQuartiere Plaka\nTempio di Poseidone a Sounio'} value={wishlist} onChange={(e) => setWishlist(e.target.value)} />
              </label>
            )}
          </div>
          <label className="label">Preferenze extra (facoltativo)<input className="input" placeholder="es. viaggio con bambini, amo i musei…" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <button className="btn-primary w-full" disabled={!canStep2} onClick={() => setStep(2)}>Avanti →</button>
        </section>
      )}

      {step === 2 && (
        <section className="card space-y-4">
          <h2 className="font-display text-lg">2 · I tuoi orari e due domande</h2>
          <div className="space-y-1">
            <p className="font-medium">🕰️ I tuoi orari abituali (li ricordo per i prossimi viaggi):</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="label">⏰ Sveglia<input className="input" type="time" value={meals.wake} onChange={(e) => setMeals({ ...meals, wake: e.target.value })} /></label>
              <label className="label">☕ Colazione<input className="input" type="time" value={meals.breakfast} onChange={(e) => setMeals({ ...meals, breakfast: e.target.value })} /></label>
              <label className="label">🍝 Pranzo<input className="input" type="time" value={meals.lunch} onChange={(e) => setMeals({ ...meals, lunch: e.target.value })} /></label>
              <label className="label">🍷 Cena<input className="input" type="time" value={meals.dinner} onChange={(e) => setMeals({ ...meals, dinner: e.target.value })} /></label>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-medium">🛌 Il giro dev’essere senza sosta pomeridiana?</p>
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
              {busy ? '⏳ Creo l’itinerario…' : '✨ Crea itinerario'}
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
          {warnings.length > 0 && (
            <section className="card border-2 border-oro bg-oro-tenue/30 dark:bg-oro/10 space-y-1" role="alert">
              <p className="font-display font-bold">🤔 Da controllare</p>
              {warnings.map((w, i) => <p key={i} className="text-sm">⚠️ {w}</p>)}
              <p className="text-xs opacity-70">Se qualcosa non torna, premi "Rigenera con altre scelte" e correggi la lista.</p>
            </section>
          )}
          <section className="card space-y-2">
            {newGroup && (
              <div className="rounded-xl border-2 border-oro p-3 space-y-1.5 text-center">
                <p className="font-display font-bold">👥 Gruppo creato!</p>
                <p className="text-sm">Codice invito: <strong className="font-mono text-lg">{newGroup.code}</strong></p>
                <button className="btn-gold w-full !min-h-[42px]" onClick={() => {
                  const txt = `🎒 Unisciti al nostro viaggio su ZainoInSpalla!\nApri ${location.origin} → Gruppo → Entra con il codice: ${newGroup.code}`;
                  if (navigator.share) navigator.share({ text: txt }).catch(() => {});
                  else navigator.clipboard.writeText(txt).then(() => alert('Invito copiato!'));
                }}>📤 Invita gli amici</button>
                <p className="text-[11px] opacity-60">L'itinerario è già nel gruppo con presentazioni e audioguide, e collegato al tuo itinerario personale.</p>
              </div>
            )}
            <p className="badge-ok !flex w-full justify-center">✅ Salvato automaticamente in "I miei viaggi" (lo trovi nella Home)</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary" onClick={() => nav('/itinerario')}>🗓️ Apri l’itinerario</button>
              <button className="btn-secondary" onClick={shareText}>📤 Condividi (WhatsApp…)</button>
              <button className="btn-secondary col-span-2" disabled={busy} onClick={sendToGroup}>👥 Invia al Gruppo</button>
            </div>
            <button className="btn-ghost w-full" onClick={() => { setPlan(null); setStep(2); }}>🔄 Rigenera con altre scelte</button>
            <p className="text-xs opacity-60">⚠️ Orari di apertura e prezzi non sono garantiti: l’itinerario è una proposta da verificare sui siti ufficiali.</p>
          </section>
        </>
      )}
    </div>
  );
}
