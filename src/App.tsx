import { NavLink, Route, Routes } from 'react-router-dom';
import { useApp } from './state/AppStore';
import { firebaseReady, subscribeGroup, stopsToDays, getCurrentUid, type GroupStop, type Expense } from './services/group';
import { t } from './lib/i18n';
import Onboarding, { onboardingNeeded } from './components/Onboarding';
import { useEffect, useRef, useState } from 'react';
import HomePage from './pages/HomePage';
import ItineraryPage from './pages/ItineraryPage';
import MapPage from './pages/MapPage';
import AssistantPage from './pages/AssistantPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import PrivacyPage from './pages/PrivacyPage';
import GroupPage from './pages/GroupPage';
import PlannerPage from './pages/PlannerPage';
import LensPage from './pages/LensPage';
import HostPage from './pages/HostPage';
import WelcomePage from './pages/WelcomePage';
import PackingPage from './pages/PackingPage';

const NAV = [
  { to: '/', tkey: 'home', icon: '🏠' },
  { to: '/itinerario', label: 'Itinerario', icon: '🗓️' },
  { to: '/mappa', tkey: 'map', icon: '🗺️' },
  { to: '/pianifica', tkey: 'plan', icon: '🌍' },
  { to: '/altro', tkey: 'more', icon: '🎒' },
];

function MorePage() {
  const { data } = useApp();
  const lang = data.settings.lang;
  const main = [
    { to: '/occhio', label: t('mLens', lang) },
    { to: '/struttura', label: t('mHost', lang) },
    { to: '/valigia', label: t('mSuitcase', lang) },
    { to: '/gruppo', label: t('mGroup', lang) },
    { to: '/assistente', label: t('mAssistant', lang) },
    { to: '/impostazioni', label: t('mSettings', lang) },
    { to: '/admin', label: t('mAdmin', lang) },
    { to: '/privacy', label: t('mPrivacy', lang) },
  ];
  return (
    <div className="p-4 space-y-3 max-w-xl mx-auto">
      <h1 className="page-title">{t('more', lang)}</h1>
      <div className="azulejo-band" aria-hidden />
      {main.map((l) => (
        <NavLink key={l.to} to={l.to} className="card block text-lg hover:border-terra">
          {l.label}
        </NavLink>
      ))}
    </div>
  );
}

/** 🔗 Tiene il viaggio collegato al gruppo sempre aggiornato (in tempo reale, ad app aperta). */
function GroupTripSync() {
  const { data, update } = useApp();
  const linked = data.trips.find((t) => t.groupId);
  const seenExpenses = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!linked?.groupId || !firebaseReady()) return;
    const off = subscribeGroup(
      linked.groupId,
      () => {},
      (stops: GroupStop[]) => {
        // aggiorna la copia personale ad ogni cambiamento del gruppo
        update((d) => {
          const t = d.trips.find((x) => x.id === linked.id);
          if (!t) return {};
          const days = stopsToDays(t.name.replace(' 👥', ''), stops, t.days);
          const trips = d.trips.map((x) => (x.id === t.id ? { ...x, days } : x));
          return t.id === d.activeTripId ? { trips, days } : { trips };
        });
      },
      () => {},
      undefined,
      (expenses: Expense[]) => {
        // 💶 Notifica: nuova spesa che mi riguarda (ad app aperta)
        const uid = getCurrentUid();
        if (seenExpenses.current === null) {
          seenExpenses.current = new Set(expenses.map((e) => e.id)); // primo giro: niente notifiche sul pregresso
          return;
        }
        for (const e of expenses) {
          if (seenExpenses.current.has(e.id)) continue;
          seenExpenses.current.add(e.id);
          if (!uid || e.payerId === uid || !e.splitWith.includes(uid)) continue;
          const share = (e.amount / Math.max(1, e.splitWith.length)).toFixed(2);
          const msg = `${e.payerName} ha pagato €${e.amount.toFixed(2)} per "${e.desc}"${e.place ? ' (' + e.place + ')' : ''}. La tua quota: €${share}`;
          try { navigator.vibrate?.([120, 60, 120]); } catch { /* niente */ }
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('💶 Nuova spesa nel gruppo', { body: msg, icon: './icons/icon-192.png' });
            }
          } catch { /* niente */ }
        }
      }
    );
    return off;
  }, [linked?.groupId, linked?.id]);
  return null;
}

function Splash() {
  const [gone, setGone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGone(true), 2200); return () => clearTimeout(t); }, []);
  if (gone) return null;
  return (
    <div className="splash" aria-hidden>
      <img src="./icons/icon-192.png" alt="" />
      <h1 className="font-display font-black text-3xl text-[#FDF6EA]">Zaino <span className="text-oro">in Spalla</span></h1>
      <p className="text-sm text-[#FDF6EA] opacity-70">Il tuo compagno di viaggio</p>
    </div>
  );
}

export default function App() {
  const { data: appData } = useApp();
  const lang = appData.settings.lang;
  const [intro, setIntro] = useState(() => onboardingNeeded());
  const { data } = useApp();
  const s = data.settings;

  useEffect(() => {
    const root = document.documentElement;
    const dark = s.theme === 'dark' || (s.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', dark);
    root.classList.toggle('large-text', s.largeText);
    root.classList.toggle('high-contrast', s.highContrast);
    root.classList.toggle('reduced-motion', s.reducedMotion);
    root.lang = s.lang;
  }, [s.theme, s.largeText, s.highContrast, s.reducedMotion, s.lang]);

  return (
    <div className="min-h-screen pb-20">
      {intro && <Onboarding onDone={() => setIntro(false)} />}
      <Splash />
      <GroupTripSync />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/itinerario" element={<ItineraryPage />} />
        <Route path="/mappa" element={<MapPage />} />
        <Route path="/mappa/:dayId" element={<MapPage />} />
        <Route path="/assistente" element={<AssistantPage />} />
        <Route path="/impostazioni" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/gruppo" element={<GroupPage />} />
        <Route path="/pianifica" element={<PlannerPage />} />
        <Route path="/occhio" element={<LensPage />} />
        <Route path="/struttura" element={<HostPage />} />
        <Route path="/benvenuto/:code" element={<WelcomePage />} />
        <Route path="/valigia" element={<PackingPage />} />
        <Route path="/altro" element={<MorePage />} />
      </Routes>

      <nav
        aria-label="Navigazione principale"
        className="fixed bottom-0 inset-x-0 z-[1000] bg-white/95 dark:bg-[#2d211a]/95 backdrop-blur border-t border-[#e8ddca] dark:border-[#4a382c]"
      >
        <div className="max-w-xl mx-auto flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-xs min-h-[56px] justify-center ${
                  isActive ? 'text-terra font-semibold' : 'opacity-70'
                }`
              }
            >
              <span aria-hidden className="text-xl leading-none">{n.icon}</span>
              {t(n.tkey as string, lang)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
