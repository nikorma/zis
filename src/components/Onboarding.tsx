import { useState } from 'react';
import { useApp } from '../state/AppStore';
import { LANG_NAMES } from '../lib/i18n';
import type { Lang } from '../types';

const LS_DONE = 'zaino-onboarding-v1';

export function onboardingNeeded(): boolean {
  try { return localStorage.getItem(LS_DONE) !== '1'; } catch { return false; }
}

interface Slide { icon: string; title: string; text: string; accent: string }

const SLIDES: Record<Lang, Slide[]> = {
  it: [
    { icon: '🌍', title: 'Itinerari in un minuto', text: 'Dimmi dove e quando: penso io a tappe, orari e distanze.', accent: '#FF6B4A' },
    { icon: '🎧', title: 'Audioguide e traduzioni', text: 'Racconti da guida su ogni tappa. Fotografa un menù: te lo traduco.', accent: '#FFC145' },
    { icon: '👥', title: 'Viaggi di gruppo', text: 'Itinerario condiviso in tempo reale e spese divise senza litigare.', accent: '#3FBF9B' },
    { icon: '🧳', title: 'Valigia intelligente', text: 'Clima, giorni e litri del tuo bagaglio: la lista giusta, senza sorprese.', accent: '#8B6FD1' },
  ],
  en: [
    { icon: '🌍', title: 'Itineraries in a minute', text: 'Tell me where and when: I handle stops, times and distances.', accent: '#FF6B4A' },
    { icon: '🎧', title: 'Audio guides & translation', text: 'Guide-style stories at every stop. Snap a menu: I translate it.', accent: '#FFC145' },
    { icon: '👥', title: 'Group trips', text: 'A shared itinerary in real time and expenses split with no arguments.', accent: '#3FBF9B' },
    { icon: '🧳', title: 'Smart suitcase', text: 'Climate, days and your bag size: the right list, no surprises.', accent: '#8B6FD1' },
  ],
  fr: [
    { icon: '🌍', title: 'Itinéraires en une minute', text: 'Dis-moi où et quand : je gère étapes, horaires et distances.', accent: '#FF6B4A' },
    { icon: '🎧', title: 'Audioguides et traduction', text: 'Des récits de guide à chaque étape. Photographie un menu : je le traduis.', accent: '#FFC145' },
    { icon: '👥', title: 'Voyages de groupe', text: 'Itinéraire partagé en temps réel et dépenses partagées sans disputes.', accent: '#3FBF9B' },
    { icon: '🧳', title: 'Valise intelligente', text: 'Climat, jours et litres de ton bagage : la bonne liste, sans surprises.', accent: '#8B6FD1' },
  ],
  es: [
    { icon: '🌍', title: 'Itinerarios en un minuto', text: 'Dime dónde y cuándo: yo me ocupo de paradas, horarios y distancias.', accent: '#FF6B4A' },
    { icon: '🎧', title: 'Audioguías y traducción', text: 'Relatos de guía en cada parada. Fotografía un menú: te lo traduzco.', accent: '#FFC145' },
    { icon: '👥', title: 'Viajes en grupo', text: 'Itinerario compartido en tiempo real y gastos divididos sin discutir.', accent: '#3FBF9B' },
    { icon: '🧳', title: 'Maleta inteligente', text: 'Clima, días y litros de tu equipaje: la lista justa, sin sorpresas.', accent: '#8B6FD1' },
  ],
  el: [
    { icon: '🌍', title: 'Πρόγραμμα σε ένα λεπτό', text: 'Πες μου πού και πότε: αναλαμβάνω στάσεις, ώρες και αποστάσεις.', accent: '#FF6B4A' },
    { icon: '🎧', title: 'Ηχητικοί οδηγοί & μετάφραση', text: 'Αφηγήσεις σε κάθε στάση. Φωτογράφισε ένα μενού: το μεταφράζω.', accent: '#FFC145' },
    { icon: '👥', title: 'Ομαδικά ταξίδια', text: 'Κοινό πρόγραμμα σε πραγματικό χρόνο και μοιρασμένα έξοδα χωρίς γκρίνια.', accent: '#3FBF9B' },
    { icon: '🧳', title: 'Έξυπνη βαλίτσα', text: 'Κλίμα, μέρες και λίτρα της βαλίτσας: η σωστή λίστα, χωρίς εκπλήξεις.', accent: '#8B6FD1' },
  ],
};

const UI: Record<Lang, { pick: string; skip: string; next: string; start: string; sub: string }> = {
  it: { pick: 'Scegli la tua lingua', skip: 'Salta', next: 'Avanti', start: 'Iniziamo!', sub: 'Il tuo compagno di viaggio' },
  en: { pick: 'Choose your language', skip: 'Skip', next: 'Next', start: "Let's go!", sub: 'Your travel companion' },
  fr: { pick: 'Choisis ta langue', skip: 'Passer', next: 'Suivant', start: 'C\u2019est parti !', sub: 'Ton compagnon de voyage' },
  es: { pick: 'Elige tu idioma', skip: 'Saltar', next: 'Siguiente', start: '¡Empezamos!', sub: 'Tu compañero de viaje' },
  el: { pick: 'Διάλεξε γλώσσα', skip: 'Παράλειψη', next: 'Επόμενο', start: 'Ξεκινάμε!', sub: 'Ο ταξιδιωτικός σου σύντροφος' },
};

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { data, update } = useApp();
  const [step, setStep] = useState(0); // 0 = lingua, 1..4 = slide
  const lang = data.settings.lang;
  const ui = UI[lang];
  const slides = SLIDES[lang];

  const finish = () => {
    try { localStorage.setItem(LS_DONE, '1'); } catch { /* ok */ }
    onDone();
  };

  const slide = step > 0 ? slides[step - 1] : null;

  return (
    <div
      className="fixed inset-0 z-[3500] flex flex-col items-center justify-center px-8 text-center text-[#FDF6EA]"
      style={{ background: 'linear-gradient(150deg, #1E2A4A 0%, #2A3A63 55%, #4A3560 100%)' }}
      role="dialog"
      aria-modal="true"
    >
      {step > 0 && (
        <button className="absolute top-5 right-5 text-sm opacity-70 underline" onClick={finish}>
          {ui.skip} ✕
        </button>
      )}

      {step === 0 ? (
        <div className="flex flex-col items-center gap-5 max-w-sm">
          <img src="./icons/icon-192.png" alt="" className="w-24 h-24 rounded-3xl shadow-2xl" style={{ animation: 'logoPop 0.7s ease-out both' }} />
          <div className="anim-rise">
            <h1 className="font-display font-black text-3xl">Zaino <span className="text-oro">in Spalla</span></h1>
            <p className="text-sm opacity-70">{ui.sub}</p>
          </div>
          <p className="font-semibold anim-rise-1">🌐 {ui.pick}</p>
          <div className="w-full grid grid-cols-1 gap-2 anim-rise-2">
            {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
              <button
                key={l}
                className={`rounded-2xl py-3 px-4 text-base font-semibold border-2 transition ${
                  lang === l ? 'bg-white/20 border-oro' : 'bg-white/5 border-white/20'
                }`}
                onClick={() => {
                  update({ settings: { ...data.settings, lang: l } });
                  setStep(1);
                }}
              >
                {LANG_NAMES[l]}
              </button>
            ))}
          </div>
          <p className="text-[10px] opacity-40 pt-1">© {new Date().getFullYear()} nikorma — Orma Studio</p>
        </div>
      ) : slide ? (
        <div key={step} className="flex flex-col items-center gap-4 max-w-sm">
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center text-6xl floaty"
            style={{ background: `radial-gradient(circle at 35% 30%, ${slide.accent}, transparent 72%)`, boxShadow: `0 0 60px ${slide.accent}55` }}
            aria-hidden
          >
            {slide.icon}
          </div>
          <h2 className="font-display font-black text-3xl leading-tight anim-rise">{slide.title}</h2>
          <p className="text-base opacity-85 anim-rise-1">{slide.text}</p>

          <div className="flex gap-2 pt-2" aria-hidden>
            {slides.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === step - 1 ? 22 : 8, height: 8,
                  background: i === step - 1 ? '#FFC145' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </div>

          <button
            className="btn-gold text-base !min-h-[52px] px-8 mt-2 anim-rise-2"
            onClick={() => (step < slides.length ? setStep(step + 1) : finish())}
          >
            {step < slides.length ? `${ui.next} →` : `🎒 ${ui.start}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
