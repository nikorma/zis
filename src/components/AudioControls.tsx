import { useEffect, useState } from 'react';
import { ttsPlayer, type PlayerState } from '../services/tts';
import { useApp } from '../state/AppStore';

/**
 * Comandi audioguida: Play, Pausa, Riprendi, Stop, Avanti, Indietro,
 * Ripeti, Velocità, Scarica per uso offline.
 * L'audio non parte mai da solo finché l'utente non ha dato il consenso
 * alla riproduzione automatica (impostazioni).
 */
export default function AudioControls({
  text,
  audioKey,
  onNext,
  onPrev,
}: {
  text: string;
  audioKey: string;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  const { data, update } = useApp();
  const s = data.settings;
  const [state, setState] = useState<PlayerState>(ttsPlayer.state);
  const [downloading, setDownloading] = useState(false);
  const downloaded = data.downloadedAudio.includes(audioKey);

  useEffect(() => ttsPlayer.onChange(setState), []);
  useEffect(() => () => ttsPlayer.stop(), [audioKey]);

  const play = () => ttsPlayer.play(text, audioKey, s);
  const repeat = () => { ttsPlayer.stop(); play(); };
  const setRate = (r: number) =>
    update({ settings: { ...s, voiceRate: Math.min(1.5, Math.max(0.5, r)) } });

  const download = async () => {
    setDownloading(true);
    const ok = await ttsPlayer.download(text, audioKey, s);
    setDownloading(false);
    if (ok && !downloaded) {
      update({ downloadedAudio: [...data.downloadedAudio, audioKey] });
    } else if (!ok) {
      alert('Download non riuscito: la voce naturale richiede il backend /api/tts pubblicato (vedi README). In alternativa l\u2019audio funziona sempre con la voce del dispositivo.');
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap gap-2">
        {onPrev && <button className="btn-secondary" onClick={() => { ttsPlayer.stop(); onPrev(); }} aria-label="Indietro">⏮ Indietro</button>}
        {state === 'playing' ? (
          <button className="btn-primary" onClick={() => ttsPlayer.pause()} aria-label="Pausa">⏸ Pausa</button>
        ) : state === 'paused' ? (
          <button className="btn-primary" onClick={() => ttsPlayer.resume()} aria-label="Riprendi">▶ Riprendi</button>
        ) : (
          <button className="btn-primary" onClick={play} aria-label="Play">▶ Play</button>
        )}
        <button className="btn-secondary" onClick={() => ttsPlayer.stop()} aria-label="Stop">⏹ Stop</button>
        <button className="btn-secondary" onClick={repeat} aria-label="Ripeti">🔁 Ripeti</button>
        {onNext && <button className="btn-secondary" onClick={() => { ttsPlayer.stop(); onNext(); }} aria-label="Avanti">⏭ Avanti</button>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm flex items-center gap-2">
          Velocità
          <input
            type="range" min={0.5} max={1.5} step={0.1} value={s.voiceRate}
            onChange={(e) => setRate(Number(e.target.value))}
            aria-label="Velocità di lettura"
          />
          <span className="tabular-nums">{s.voiceRate.toFixed(1)}×</span>
        </label>
        <button className="btn-ghost text-sm" onClick={download} disabled={downloading}>
          {downloaded ? '✅ Scaricato per uso offline' : downloading ? '⏳ Scarico…' : '⬇️ Scarica per uso offline'}
        </button>
      </div>
      {state === 'error' && (
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          Riproduzione non riuscita. {ttsPlayer.lastError || 'Prova la modalità "Voce del dispositivo" nelle impostazioni.'}
        </p>
      )}
      <details className="text-sm opacity-80">
        <summary className="cursor-pointer">Trascrizione / sottotitoli</summary>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed">{text}</p>
      </details>
    </div>
  );
}
