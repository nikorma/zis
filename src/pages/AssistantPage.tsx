import { useRef, useState } from 'react';
import { useApp } from '../state/AppStore';
import { askGuide } from '../services/ai';

const EXAMPLES = [
  'Cosa vedere in 3 giorni a Lisbona?',
  'Piatti tipici da provare ad Atene',
  'Come muoversi a Parigi con i mezzi?',
  'Curiosità storiche su Roma',
  'Consigli per viaggiare in agosto col caldo',
  'Frasi utili in spagnolo per il viaggio',
];

interface Msg { role: 'user' | 'assistant'; text: string; cached?: boolean }

export default function AssistantPage() {
  const { data, update } = useApp();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const send = async (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setLoading(true);
    const res = await askGuide(question, 'chat-generale', data, update);
    setMessages((m) => [
      ...m,
      res.ok
        ? { role: 'assistant', text: res.answer, cached: res.cached }
        : { role: 'assistant', text: `⚠️ ${res.error}` },
    ]);
    setLoading(false);
    setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="page-title">Chiedi alla guida</h1>
      <div className="azulejo-band" aria-hidden />
      <p className="text-sm opacity-80">
        Domande su storia, arte, cultura, cucina e consigli pratici di viaggio, per qualsiasi destinazione. Le risposte più comuni vengono salvate e restano disponibili offline; per domande nuove serve la connessione.
      </p>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button key={e} className="chip-off" onClick={() => send(e)}>{e}</button>
        ))}
      </div>

      <div ref={listRef} className="space-y-3 max-h-[45vh] overflow-y-auto pr-1" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`card ${m.role === 'user' ? 'bg-terra text-white ml-8' : 'mr-8'}`}>
            <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
            {m.cached && <p className="text-xs opacity-70 mt-1">📦 Risposta dalla memoria locale</p>}
          </div>
        ))}
        {loading && <div className="card mr-8 animate-pulse">La guida sta pensando…</div>}
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Fai una domanda di viaggio…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          aria-label="Domanda per la guida"
        />
        <button className="btn-primary shrink-0" onClick={() => send()} disabled={loading}>Invia</button>
      </div>

      <p className="text-xs opacity-60">
        Limite giornaliero di domande per contenere i costi (vedi pannello admin). Le richieste passano da un backend protetto: la chiave AI non è mai nel telefono. Se il backend non è configurato, l\u2019assistente risponde solo dalle risposte già salvate.
      </p>
    </div>
  );
}
