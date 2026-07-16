import { useMemo, useState } from 'react';
import { useApp } from '../state/AppStore';
import { DEFAULT_DAILY_REQUEST_LIMIT, requestsToday, tokensUsed, estimatedCostUsd } from '../services/ai';

/**
 * Pannello amministrativo.
 * ⚠️ SOLO DIMOSTRATIVO: la password è verificata lato client e serve
 * unicamente a evitare tocchi accidentali. In produzione l'autenticazione
 * va spostata sul backend (vedi README e api/ai.ts).
 */
const DEV_PASSWORD = 'zaino-dev-2026';

export default function AdminPage() {
  const { data, update } = useApp();
  const [pwd, setPwd] = useState('');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState(false);

  const usage = data.aiUsage;
  const today = useMemo(() => requestsToday(usage), [usage]);
  const tokens = useMemo(() => { const t = tokensUsed(usage); return t.prompt + t.completion; }, [usage]);
  const cost = useMemo(() => estimatedCostUsd(usage), [usage]);
  const cacheCount = Object.keys(data.aiCache).length;

  if (!open) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <h1 className="page-title">Pannello amministrativo</h1>
        <div className="azulejo-band" aria-hidden />
        <div className="card space-y-3">
          <p className="text-sm opacity-80">Area riservata alla manutenzione della guida.</p>
          <label className="label">Password
            <input className="input" type="password" value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(false); }}
              onKeyDown={(e) => e.key === 'Enter' && setOpen(pwd === DEV_PASSWORD) === undefined && (pwd === DEV_PASSWORD ? setOpen(true) : setErr(true))} />
          </label>
          {err && <p className="text-sm text-red-700 dark:text-red-300" role="alert">Password errata.</p>}
          <button className="btn-primary w-full" onClick={() => (pwd === DEV_PASSWORD ? setOpen(true) : setErr(true))}>Entra</button>
          <p className="text-xs opacity-60">⚠️ Demo: autenticazione lato client, da sostituire con login sul backend in produzione (README).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="page-title">Pannello amministrativo</h1>
      <div className="azulejo-band" aria-hidden />

      <section className="card space-y-2">
        <h2 className="font-display text-lg">📊 Utilizzo assistente AI</h2>
        <ul className="text-sm space-y-1">
          <li>Domande oggi: <strong>{today}</strong> / {DEFAULT_DAILY_REQUEST_LIMIT} (limite giornaliero)</li>
          <li>Domande totali registrate: <strong>{usage.length}</strong></li>
          <li>Token stimati consumati: <strong>{tokens.toLocaleString('it-IT')}</strong></li>
          <li>Costo stimato: <strong>${cost.toFixed(4)}</strong> <span className="opacity-60">(stima locale, non fattura reale)</span></li>
          <li>Risposte in cache offline: <strong>{cacheCount}</strong></li>
        </ul>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-ghost !min-h-[40px] !py-1.5" onClick={() => { if (confirm('Azzerare il registro di utilizzo AI?')) update({ aiUsage: [] }); }}>
            🧹 Azzera registro
          </button>
          <button className="btn-ghost !min-h-[40px] !py-1.5" onClick={() => { if (confirm('Svuotare la cache delle risposte?')) update({ aiCache: {} }); }}>
            🗑️ Svuota cache risposte
          </button>
        </div>
        <p className="text-xs opacity-60">I limiti veri (per ora e per giorno) vengono applicati anche dal backend /api/ai; questo pannello mostra il conteggio locale.</p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-display text-lg">📝 Contenuti della guida</h2>
        <p className="text-sm opacity-80">
          I testi generati (presentazioni delle tappe di gruppo) si modificano direttamente dall\u2019app; l\u2019itinerario personale si esporta/importa dalle Impostazioni.
        </p>
        <p className="text-sm opacity-80">
          <strong>Rigenera con IA (predisposto):</strong> con il backend attivo, l\u2019endpoint <code>/api/ai</code> genera le presentazioni delle nuove tappe e le risposte della guida; <code>/api/planner</code> genera gli itinerari.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-display text-lg">🔧 Stato dell\u2019app</h2>
        <ul className="text-sm space-y-1">
          <li>Giornate in itinerario: <strong>{data.days.length}</strong></li>
          <li>Tappe totali: <strong>{data.days.reduce((a, d) => a + d.stops.length, 0)}</strong></li>
          <li>Biglietti registrati: <strong>{Object.keys(data.tickets).length}</strong></li>
          <li>Audio scaricati: <strong>{data.downloadedAudio.length}</strong></li>
          <li>Preferiti: <strong>{data.favorites.length}</strong></li>
        </ul>
      </section>
    </div>
  );
}
