import { useRef, useState } from 'react';
import { useApp } from '../state/AppStore';
import { exportJson, importJson, clearAllData, resolveConflict } from '../lib/storage';
import { clampRadius } from '../lib/geo';
import { LANG_NAMES } from '../lib/i18n';
import type { Lang, Settings } from '../types';

export default function SettingsPage() {
  const { data, update, replaceAll } = useApp();
  const s = data.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const setS = (patch: Partial<Settings>) => update({ settings: { ...s, ...patch } });

  const doExport = () => {
    const blob = new Blob([exportJson(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zaino-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('✅ Backup esportato.');
  };

  const doImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const res = importJson(text);
      if (!res.ok) {
        setMsg(`❌ Import non riuscito: ${res.error}`);
      } else if (confirm('Sostituire i dati attuali con il backup? (Annulla = unisci in modo intelligente)')) {
        replaceAll(res.data);
        setMsg('✅ Backup importato (sostituzione completa).');
      } else {
        replaceAll(resolveConflict(data, res.data));
        setMsg('✅ Backup unito ai dati attuali (vince la versione più completa; preferiti e audio scaricati uniti).');
      }
    } catch {
      setMsg('❌ Import non riuscito: impossibile leggere il file.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const doDelete = () => {
    if (confirm('Eliminare TUTTI i dati salvati (itinerario, biglietti, preferenze, audio scaricati)? L\u2019operazione non è reversibile.')) {
      clearAllData();
      location.reload();
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="page-title">Impostazioni</h1>
      <div className="azulejo-band" aria-hidden />
      {msg && <p className="card text-sm" role="status">{msg}</p>}

      <section className="card space-y-3">
        <h2 className="font-display text-lg">Aspetto e lingua</h2>
        <label className="label">Tema
          <select className="input" value={s.theme} onChange={(e) => setS({ theme: e.target.value as Settings['theme'] })}>
            <option value="light">Chiaro</option>
            <option value="dark">Scuro</option>
            <option value="auto">Automatico (sistema)</option>
          </select>
        </label>
        <label className="label">Lingua dell\u2019interfaccia
          <select className="input" value={s.lang} onChange={(e) => setS({ lang: e.target.value as Lang })}>
            {(Object.keys(LANG_NAMES) as Lang[]).map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
          </select>
        </label>
        <p className="text-xs opacity-60">La struttura multilingua è pronta; i contenuti della guida sono per ora in italiano.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-lg">Accessibilità</h2>
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.largeText} onChange={(e) => setS({ largeText: e.target.checked })} /> Testo grande</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.highContrast} onChange={(e) => setS({ highContrast: e.target.checked })} /> Alto contrasto</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.reducedMotion} onChange={(e) => setS({ reducedMotion: e.target.checked })} /> Riduci animazioni</label>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-lg">GPS e avvisi di arrivo</h2>
        <label className="label">
          Raggio di arrivo: <strong>{clampRadius(s.arrivalRadiusMeters)} m</strong>
          <input type="range" min={40} max={100} step={5} value={clampRadius(s.arrivalRadiusMeters)}
            onChange={(e) => setS({ arrivalRadiusMeters: Number(e.target.value) })} className="w-full" />
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.notificationsConsent} onChange={(e) => {
          if (e.target.checked && 'Notification' in window) {
            Notification.requestPermission().then((p) => setS({ notificationsConsent: p === 'granted' }));
          } else setS({ notificationsConsent: false });
        }} /> Notifiche di arrivo</label>
        <p className="text-xs opacity-60">All\u2019arrivo il telefono vibra (se supportato), mostra una notifica e annuncia a voce il nome della destinazione.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-lg">Voce dell\u2019audioguida</h2>
        <label className="label">Modalità
          <select className="input" value={s.ttsMode} onChange={(e) => setS({ ttsMode: e.target.value as Settings['ttsMode'] })}>
            <option value="webspeech">Voce del dispositivo (funziona sempre, anche offline)</option>
            <option value="natural">Voce naturale via internet (richiede backend configurato)</option>
            <option value="offline">Voce naturale scaricata (usa i download offline)</option>
          </select>
        </label>
        <label className="label">Genere voce (se disponibile)
          <select className="input" value={s.voiceGender} onChange={(e) => setS({ voiceGender: e.target.value as Settings['voiceGender'] })}>
            <option value="femminile">Femminile</option>
            <option value="maschile">Maschile</option>
          </select>
        </label>
        <label className="label">Velocità: {s.voiceRate.toFixed(1)}×
          <input type="range" min={0.5} max={1.5} step={0.1} value={s.voiceRate} onChange={(e) => setS({ voiceRate: Number(e.target.value) })} className="w-full" />
        </label>
        <label className="label">Volume: {(s.voiceVolume * 100).toFixed(0)}%
          <input type="range" min={0} max={1} step={0.05} value={s.voiceVolume} onChange={(e) => setS({ voiceVolume: Number(e.target.value) })} className="w-full" />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.autoplayConsentGiven} onChange={(e) => setS({ autoplayConsentGiven: e.target.checked, autoplayAudio: e.target.checked })} />
          Consenti l\u2019avvio automatico dell\u2019audio all\u2019arrivo in un luogo
        </label>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-lg">Dati: backup e sincronizzazione</h2>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={doExport}>⬇️ Esporta JSON</button>
          <label className="btn-secondary cursor-pointer">
            ⬆️ Importa JSON
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => doImport(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <p className="text-xs opacity-60">
          I dati vivono solo su questo dispositivo (nessun account necessario). Per passare a un altro telefono: esporta qui, importa là. In caso di conflitto l\u2019unione intelligente mantiene, per ogni giornata e biglietto, la versione più completa (tappe visitate e acquisti non si perdono).
        </p>
        <button className="btn text-red-700 border border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 w-full" onClick={doDelete}>
          🗑️ Elimina tutti i miei dati
        </button>
      </section>
    </div>
  );
}
