import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/AppStore';
import { firebaseReady, fetchStayByCode, type Stay } from '../services/group';
import { t, LANG_NAMES, LANG_LOCALE } from '../lib/i18n';
import type { Lang } from '../types';

const REST_LS = 'zaino-stay-rest-';

export default function WelcomePage() {
  const { code } = useParams<{ code: string }>();
  const { data, update } = useApp();
  const nav = useNavigate();
  const [stay, setStay] = useState<Stay | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'noconfig'>('loading');
  const lang = data.settings.lang;
  const loc = LANG_LOCALE[lang];

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
      <div className="flex gap-1.5 anim-rise" role="group" aria-label="Lingua">
        {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
          <button key={l} className={`px-2 py-1 rounded-lg text-lg ${lang === l ? 'bg-white/25' : 'opacity-60'}`}
            onClick={() => update({ settings: { ...data.settings, lang: l } })}>
            {LANG_NAMES[l].split(' ')[0]}
          </button>
        ))}
      </div>

      {state === 'loading' && <p className="opacity-80 animate-pulse">{t('wLoading', lang)}</p>}

      {state === 'ok' && stay && (
        <>
          <div className="hero-panel anim-rise-1 max-w-sm">
            <p className="text-[10px] uppercase tracking-[0.18em] text-oro font-bold">{t('welcomeBy', lang)}</p>
            <p className="font-display font-bold text-2xl">🏡 {stay.structure}</p>
            <p className="text-sm opacity-90 mt-1">
              {stay.guestName ? `${t('wHello', lang)} ${stay.guestName}! ` : ''}{t('wPrepared', lang)}
              {stay.checkin && <> {t('wFrom', lang)} <strong>{new Date(stay.checkin + 'T12:00').toLocaleDateString(loc, { day: 'numeric', month: 'long' })}</strong></>}
              {stay.checkout && <> {t('wTo', lang)} <strong>{new Date(stay.checkout + 'T12:00').toLocaleDateString(loc, { day: 'numeric', month: 'long' })}</strong></>}
              : {stay.days.length} {t('daysW', lang)}{stay.restaurants.length > 0 ? ` · ${stay.restaurants.length} ${t('wRests', lang)}` : ''}. 🎒
            </p>
          </div>
          <button className="btn-gold text-base !min-h-[52px] px-6 anim-rise-2" onClick={accept}>
            ✨ {t('wOpen', lang)}
          </button>
          <p className="text-xs opacity-60 anim-rise-3">{t('wInstall', lang)}</p>
        </>
      )}

      {state === 'notfound' && (
        <div className="hero-panel max-w-sm">
          <p className="font-semibold">😕 {t('wNotFound', lang)}</p>
          <p className="text-sm opacity-90 mt-1">{t('wNotFoundText', lang)}</p>
          <button className="btn-gold w-full mt-3 !min-h-[44px]" onClick={() => nav('/')}>{t('wGoApp', lang)}</button>
        </div>
      )}

      {state === 'noconfig' && (
        <div className="hero-panel max-w-sm">
          <p className="text-sm">Questa installazione non ha il backend configurato.</p>
          <button className="btn-gold w-full mt-3 !min-h-[44px]" onClick={() => nav('/')}>{t('wGoApp', lang)}</button>
        </div>
      )}
    </div>
  );
}
