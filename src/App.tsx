import { useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useApp } from './state/AppStore';
import HomePage from './pages/HomePage';
import ItineraryPage from './pages/ItineraryPage';
import MapPage from './pages/MapPage';
import AssistantPage from './pages/AssistantPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import PrivacyPage from './pages/PrivacyPage';
import GroupPage from './pages/GroupPage';
import PlannerPage from './pages/PlannerPage';
import PackingPage from './pages/PackingPage';

const NAV = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/itinerario', label: 'Itinerario', icon: '🗓️' },
  { to: '/mappa', label: 'Mappa', icon: '🗺️' },
  { to: '/pianifica', label: 'Pianifica', icon: '🌍' },
  { to: '/altro', label: 'Altro', icon: '🎒' },
];

function MorePage() {
  const main = [
    { to: '/valigia', label: '🧳 Valigia intelligente' },
    { to: '/gruppo', label: '👥 Gruppo di viaggio (itinerario condiviso)' },
    { to: '/assistente', label: '💬 Chiedi alla guida' },
    { to: '/impostazioni', label: '⚙️ Impostazioni' },
    { to: '/admin', label: '🔐 Pannello amministrativo' },
    { to: '/privacy', label: '🛡️ Privacy e dati' },
  ];
  return (
    <div className="p-4 space-y-3 max-w-xl mx-auto">
      <h1 className="page-title">Altro</h1>
      <div className="azulejo-band" aria-hidden />
      {main.map((l) => (
        <NavLink key={l.to} to={l.to} className="card block text-lg hover:border-terra">
          {l.label}
        </NavLink>
      ))}
    </div>
  );
}

export default function App() {
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
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
