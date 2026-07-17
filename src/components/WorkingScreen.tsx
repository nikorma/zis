import { useEffect, useState } from 'react';

const DEFAULT_MESSAGES = [
  'Sto convincendo i monumenti a mettersi in fila… 🏛️',
  'Chiedo ai piccioni locali i posti migliori 🐦',
  'Misuro le distanze coi passi di un turista pigro… 👣',
  'Prenoto il tramonto per l’ora giusta 🌅',
  'Tolgo le salite inutili dal percorso… ⛰️❌',
  'Assaggio virtualmente tutti i ristoranti 🍝',
  'Litigo con la mappa che si era piegata male… 🗺️',
  'Nascondo le trappole per turisti 🪤',
  'Chiedo conferma sui vicoli a un gatto del posto 🐈',
  'Ultimi ritocchi: lucido le tappe una a una ✨',
];

/**
 * Schermata "sto lavorando" a tutto schermo, con messaggi spiritosi
 * che ruotano mentre l'AI prepara il risultato.
 */
export default function WorkingScreen({ title = 'Preparo il tuo itinerario…', messages = DEFAULT_MESSAGES }: { title?: string; messages?: string[] }) {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setI((x) => (x + 1) % messages.length); setVisible(true); }, 250);
    }, 2600);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-5 px-8 text-center text-[#FDF6EA]"
      style={{ background: 'linear-gradient(150deg, #1E2A4A 0%, #2A3A63 55%, #4A3560 100%)' }}
      role="status"
      aria-live="polite"
    >
      <div className="text-7xl animate-bounce" aria-hidden>🎒</div>
      <h2 className="font-display font-black text-2xl">{title}</h2>
      <p
        className="min-h-[3.5rem] text-lg opacity-90 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {messages[i]}
      </p>
      <div className="flex gap-2" aria-hidden>
        <span className="w-2.5 h-2.5 rounded-full bg-oro animate-pulse" />
        <span className="w-2.5 h-2.5 rounded-full bg-terra animate-pulse" style={{ animationDelay: '0.25s' }} />
        <span className="w-2.5 h-2.5 rounded-full bg-menta animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>
      <p className="text-xs opacity-60">Un viaggio serio richiede un minutino di lavoro serio 😉</p>
    </div>
  );
}
