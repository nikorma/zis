import { useRef, useState } from 'react';
import AudioControls from '../components/AudioControls';
import { useApp } from '../state/AppStore';
import WorkingScreen from '../components/WorkingScreen';

type Task = 'translate' | 'identify';

/** Riduce la foto a max 1024px lato lungo, JPEG compresso (per inviarla veloce). */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i); i.onerror = ko; i.src = url;
    });
    const MAX = 1024;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function LensPage() {
  const { data } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<Task | null>(null);
  const [result, setResult] = useState<{ task: Task; text: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr(null); setResult(null);
    try { setPhoto(await shrink(f)); }
    catch { setErr('Non riesco a leggere la foto: riprova.'); }
  };

  const ask = async (task: Task) => {
    if (!photo) return;
    setBusy(task); setErr(null); setResult(null);
    try {
      const r = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo, task, lang: data.settings.lang }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404) {
        setErr('Questa funzione non è ancora online: carica l\u2019ultimo zip su GitHub e attendi il deploy di Vercel.');
      } else if (!r.ok) {
        setErr(j.error?.includes('non configurato')
          ? 'Questa funzione richiede il backend AI: aggiungi OPENAI_API_KEY su Vercel (vedi README).'
          : (j.error || 'Non ha funzionato: riprova.'));
      } else {
        setResult({ task, text: j.answer });
      }
    } catch {
      setErr('Serve la connessione: riprova quando sei online.');
    }
    setBusy(null);
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      {busy && (
        <WorkingScreen
          title={busy === 'translate' ? 'Traduco la foto…' : 'Guardo bene la foto…'}
          messages={busy === 'translate'
            ? ['Metto gli occhiali da lettura… 👓', 'Sfoglio il dizionario tascabile… 📖', 'Chiedo conferma a un madrelingua… 🗣️', 'Sistemo gli accenti al posto giusto ✍️']
            : ['Strizzo gli occhi come un intenditore… 🧐', 'Confronto con mille cartoline… 🖼️', 'Interrogo la mia memoria da guida… 🎓', 'Preparo le curiosità migliori ✨']}
        />
      )}
      <h1 className="page-title">Occhio di viaggio 📸</h1>
      <div className="azulejo-band" aria-hidden />
      <p className="text-sm opacity-80">Scatta una foto a un cartello, un menù o un monumento: te lo <strong>traduco</strong> o ti <strong>racconto cos'è</strong>.</p>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => pick(e.target.files?.[0])} />

      {!photo ? (
        <button className="btn-primary w-full text-base !min-h-[56px]" onClick={() => fileRef.current?.click()}>
          📷 Scatta o scegli una foto
        </button>
      ) : (
        <div className="card space-y-3">
          <img src={photo} alt="La tua foto" className="rounded-xl w-full max-h-[45vh] object-contain bg-crema dark:bg-[#141C33]" />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-primary" disabled={!!busy} onClick={() => ask('translate')}>🌐 Traduci</button>
            <button className="btn-gold" disabled={!!busy} onClick={() => ask('identify')}>🧐 Cos'è questo?</button>
          </div>
          <button className="btn-ghost w-full !min-h-[38px] !py-1 text-sm" onClick={() => { setPhoto(null); setResult(null); setErr(null); if (fileRef.current) fileRef.current.value = ''; }}>
            🔄 Altra foto
          </button>
        </div>
      )}

      {err && <p className="card text-sm text-red-700 dark:text-red-300" role="alert">{err}</p>}

      {result && (
        <section className="card space-y-2">
          <h2 className="font-display text-lg">{result.task === 'translate' ? '🌐 Traduzione' : '🧐 Ecco cosa vedo'}</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.text}</p>
          <AudioControls text={result.text} audioKey={`lens-${result.task}`} />
          <p className="text-[11px] opacity-60">💡 La foto viene analizzata al volo e non viene salvata da nessuna parte. L'AI può sbagliare: per informazioni importanti (allergeni, divieti…) verifica di persona.</p>
        </section>
      )}
    </div>
  );
}
