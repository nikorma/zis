import { useState } from 'react';
import { useApp } from '../state/AppStore';
import { firebaseReady, createStay, deleteStay, type StayRestaurant } from '../services/group';
import { appConfirm } from '../lib/dialog';

const LS_NAME = 'zaino-host-name';
const LS_REST = 'zaino-host-restaurants';
const LS_STAYS = 'zaino-host-stays';

interface StayMeta { id: string; code: string; guest: string; checkin: string; link: string }

function load<T>(k: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(k) || '') as T; } catch { return fallback; }
}

export default function HostPage() {
  const { data } = useApp();
  const [structure, setStructure] = useState<string>(() => localStorage.getItem(LS_NAME) || '');
  const [guest, setGuest] = useState('');
  const [dates, setDates] = useState({ checkin: '', checkout: '' });
  const [rests, setRests] = useState<StayRestaurant[]>(() => load(LS_REST, []));
  const [nr, setNr] = useState<StayRestaurant>({ name: '', address: '', phone: '', note: '' });
  const [stays, setStays] = useState<StayMeta[]>(() => load(LS_STAYS, []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<StayMeta | null>(null);

  const saveRests = (r: StayRestaurant[]) => { setRests(r); localStorage.setItem(LS_REST, JSON.stringify(r)); };
  const saveStays = (s: StayMeta[]) => { setStays(s); localStorage.setItem(LS_STAYS, JSON.stringify(s)); };

  const addRest = () => {
    if (!nr.name.trim()) return;
    saveRests([...rests, { ...nr, name: nr.name.trim() }]);
    setNr({ name: '', address: '', phone: '', note: '' });
  };

  const ready = firebaseReady() && structure.trim() && guest.trim() && dates.checkin && dates.checkout
    && dates.checkin <= dates.checkout && data.days.length > 0;

  const create = async () => {
    setBusy(true); setErr(null); setCreated(null);
    localStorage.setItem(LS_NAME, structure.trim());
    try {
      const stay = await createStay(structure, guest, dates.checkin, dates.checkout, data.days, rests);
      const link = `${location.origin}${location.pathname}#/benvenuto/${stay.code}`;
      const meta: StayMeta = { id: stay.id, code: stay.code, guest: stay.guestName, checkin: stay.checkin, link };
      saveStays([meta, ...stays]);
      setCreated(meta);
      setGuest('');
    } catch (e) { setErr(String((e as Error).message || e)); }
    setBusy(false);
  };

  const share = (m: StayMeta) => {
    const txt = `🎒 Ciao ${m.guest}! ${structure || 'La tua struttura'} ti ha preparato l'itinerario per il tuo soggiorno su ZainoInSpalla.\n\n1) Apri questo link: ${m.link}\n2) Consiglio: aggiungi l'app alla schermata Home per averla sempre con te!`;
    if (navigator.share) navigator.share({ text: txt }).catch(() => {});
    else navigator.clipboard.writeText(txt).then(() => alert('Invito copiato!'));
  };

  if (!firebaseReady()) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-3">
        <h1 className="page-title">Modalità struttura 🏡</h1>
        <div className="azulejo-band" aria-hidden />
        <p className="card text-sm">Questa funzione usa lo stesso Firebase del Gruppo di viaggio: completa prima quella configurazione (istruzioni in <code>src/firebaseConfig.ts</code> e nel README).</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="page-title">Modalità struttura 🏡</h1>
      <div className="azulejo-band" aria-hidden />
      <p className="text-sm opacity-80">Prepara l'itinerario per un ospite: riceverà un link di benvenuto con le tappe già pronte e i tuoi ristoranti consigliati.</p>
      {err && <p className="card text-sm text-red-700 dark:text-red-300" role="alert">{err}</p>}

      <section className="card space-y-3">
        <h2 className="font-display text-lg">1 · La struttura e l'ospite</h2>
        <label className="label">Nome della struttura
          <input className="input" placeholder="es. B&B Casa Bella" value={structure} onChange={(e) => setStructure(e.target.value)} />
        </label>
        <label className="label">Nome dell'ospite
          <input className="input" placeholder="es. Marco" value={guest} onChange={(e) => setGuest(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="label">📅 Check-in<input className="input" type="date" value={dates.checkin} onChange={(e) => setDates({ ...dates, checkin: e.target.value })} /></label>
          <label className="label">📅 Check-out<input className="input" type="date" value={dates.checkout} onChange={(e) => setDates({ ...dates, checkout: e.target.value })} /></label>
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-display text-lg">2 · L'itinerario</h2>
        {data.days.length > 0 ? (
          <p className="text-sm">Verrà usato l'itinerario <strong>attualmente aperto</strong> ({data.days.length} giornate), con le date spostate al soggiorno dell'ospite. Preparalo prima con 🌍 Pianifica o a mano, poi torna qui.</p>
        ) : (
          <p className="text-sm badge-warn !inline-block">Nessun itinerario aperto: crealo prima con 🌍 Pianifica o ✏️ a mano.</p>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-display text-lg">3 · 🍽️ I tuoi ristoranti consigliati</h2>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Nome locale *" value={nr.name} onChange={(e) => setNr({ ...nr, name: e.target.value })} />
          <input className="input" placeholder="Telefono" value={nr.phone} onChange={(e) => setNr({ ...nr, phone: e.target.value })} />
        </div>
        <input className="input" placeholder="Indirizzo" value={nr.address} onChange={(e) => setNr({ ...nr, address: e.target.value })} />
        <input className="input" placeholder="Perché lo consigli (es. le migliori tagliatelle della zona)" value={nr.note} onChange={(e) => setNr({ ...nr, note: e.target.value })} />
        <button className="btn-gold w-full !min-h-[40px]" disabled={!nr.name.trim()} onClick={addRest}>➕ Aggiungi consiglio</button>
        {rests.map((r, i) => (
          <div key={i} className="rounded-xl bg-crema dark:bg-[#141C33] p-2.5 text-sm flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs opacity-70">{[r.address, r.phone].filter(Boolean).join(' · ')}{r.note ? ` · «${r.note}»` : ''}</p>
            </div>
            <button className="text-xs opacity-60 underline shrink-0" onClick={() => saveRests(rests.filter((_, j) => j !== i))}>✕ togli</button>
          </div>
        ))}
        <p className="text-[11px] opacity-60">I consigli restano salvati: li riusi per tutti i prossimi ospiti.</p>
      </section>

      <button className="btn-primary w-full text-base" disabled={!ready || busy} onClick={create}>
        {busy ? '⏳ Preparo il soggiorno…' : '🎁 Crea il link di benvenuto'}
      </button>
      {!ready && <p className="text-xs opacity-60">Servono: nome struttura, nome ospite, date valide e un itinerario aperto.</p>}

      {created && (
        <section className="card border-2 border-oro space-y-2 text-center" role="status">
          <p className="font-display font-bold text-lg">🎁 Pronto per {created.guest}!</p>
          <p className="text-sm">Codice: <strong className="font-mono text-lg">{created.code}</strong></p>
          <button className="btn-gold w-full" onClick={() => share(created)}>📤 Invia il link all'ospite</button>
        </section>
      )}

      {stays.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-display text-lg">📂 Soggiorni preparati</h2>
          {stays.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-xl p-2 bg-crema dark:bg-[#141C33]">
              <div className="flex-1 text-sm">
                <p className="font-semibold">👤 {m.guest} · <span className="font-mono">{m.code}</span></p>
                <p className="text-xs opacity-60">check-in {m.checkin}</p>
              </div>
              <button className="btn-secondary !min-h-[36px] !py-1 text-sm shrink-0" onClick={() => share(m)}>📤</button>
              <button className="btn-ghost !min-h-[36px] !py-1 !px-2 shrink-0" aria-label="Elimina soggiorno" onClick={async () => {
                if (await appConfirm(`Eliminare il soggiorno di ${m.guest}? Il link smetterà di funzionare.`, 'Elimina', true)) {
                  try { await deleteStay(m.id); } catch { /* già eliminato */ }
                  saveStays(stays.filter((x) => x.id !== m.id));
                }
              }}>🗑️</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
