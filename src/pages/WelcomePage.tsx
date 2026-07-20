import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/AppStore';
import { firebaseReady, fetchStayByCode, type Stay } from '../services/group';

const REST_LS = 'zaino-stay-rest-';

export default function WelcomePage() {
  const { code } = useParams<{ code: string }>();
  const { data, update } = useApp();
  const nav = useNavigate();
  const [stay, setStay] = useState<Stay | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'noconfig'>('loading');

  useEffect(() => {
    if (!firebaseReady()) { setState('noconfig'); return; }
    if (!code) { setState('notfound'); return; }
    fetchStayByCode(code)
      .then((s) => { if (s) { setStay(s); setState('ok'); } else setState('notfound'); })
      .catch(() => setState('notfound'));
  }, [code]);

  const accept = () => {
    if (!stay) return;
    const id = 'stay-' + stay.code;
    const trip = {
      id,
      name: `${stay.structure} 🏡`,
      destination: stay.structure,
      days: stay.days,
      createdAt: new Date().toISOString(),
    };
    try { localStorage.setItem(REST_LS + id, JSON.stringify({ structure: stay.structure, list: stay.restaurants })); } catch { /* ok */ }
    const exists = data.trips.some((t) => t.id === id);
    update({
      trips: exists ? data.trips.map((t) => (t.id === id ? trip : t)) : [...data.trips, trip],
      days: stay.days,
      activeTripId: id,
    });
    nav('/itinerario');
  };

  return (
    <div className="fixed inset-0 z-[2500] flex flex-col items-center justify-center gap-4 px-8 text-center text-[#FDF6EA]"
      style={{ background: 'linear-gradient(150deg, #1E2A4A 0%, #2A3A63 55%, #4A3560 100%)' }}>
      <img src="./icons/icon-192.png" alt="" className="w-24 h-24 rounded-3xl shadow-2xl" style={{ animation: 'logoPop 0.7s ease-out both' }} />
      <h1 className="font-display font-black text-3xl anim-rise">Zaino <span className="text-oro">in Spalla</span></h1>

      {state === 'loading' && <p className="opacity-80 animate-pulse">Apro il tuo soggiorno…</p>}

      {state === 'ok' && stay && (
        <>
          <div className="hero-panel anim-rise-1 max-w-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-oro font-bold">Un benvenuto da</p>
            <p className="font-display font-bold text-2xl">🏡 {stay.structure}</p>
            <p className="text-sm opacity-90 mt-1">
              {stay.guestName ? `Ciao ${stay.guestName}! ` : ''}Ti abbiamo preparato l'itinerario per il tuo soggiorno
              {stay.checkin && <> dal <strong>{new Date(stay.checkin + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</strong></>}
              {stay.checkout && <> al <strong>{new Date(stay.checkout + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</strong></>}
              : {stay.days.length} giornate{stay.restaurants.length > 0 ? ` e ${stay.restaurants.length} ristoranti consigliati` : ''}. 🎒
            </p>
          </div>
          <button className="btn-gold text-base !min-h-[52px] px-6 anim-rise-2" onClick={accept}>
            ✨ Apri il mio itinerario
          </button>
          <p className="text-xs opacity-60 anim-rise-3">Consiglio: dal menu del browser scegli "Aggiungi a schermata Home" per installare l'app.</p>
        </>
      )}

      {state === 'notfound' && (
        <div className="hero-panel max-w-sm">
          <p className="font-semibold">😕 Soggiorno non trovato</p>
          <p className="text-sm opacity-90 mt-1">Il link potrebbe essere scaduto o incompleto: chiedi alla struttura di rimandartelo.</p>
          <button className="btn-gold w-full mt-3 !min-h-[44px]" onClick={() => nav('/')}>Vai all'app</button>
        </div>
      )}

      {state === 'noconfig' && (
        <div className="hero-panel max-w-sm">
          <p className="text-sm">Questa installazione non ha il backend configurato.</p>
          <button className="btn-gold w-full mt-3 !min-h-[44px]" onClick={() => nav('/')}>Vai all'app</button>
        </div>
      )}
    </div>
  );
}
