import { useEffect, useMemo, useState } from 'react';
import AudioControls from '../components/AudioControls';
import GuideImage from '../components/GuideImage';
import PlaceSearch from '../components/PlaceSearch';
import { googleMapsDirectionsUrl } from '../lib/geo';
import {
  firebaseReady, ensureUser, getDisplayName, setDisplayName,
  getSavedGroupId, leaveGroup, createGroup, joinGroup, subscribeGroup,
  addGroupStop, updateOwnStop, deleteOwnStop, requestChange, resolveRequest, generatePresentation,
  type GroupInfo, type GroupStop, type ChangeRequest,
} from '../services/group';

export default function GroupPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState(getDisplayName());
  const [groupId, setGroupId] = useState<string | null>(getSavedGroupId());
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [stops, setStops] = useState<GroupStop[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form nuova tappa
  const [nt, setNt] = useState({ title: '', date: '2026-08-05', time: '', address: '', notes: '' });
  const [ntCoords, setNtCoords] = useState<{ lat: number; lng: number } | null>(null);
  // richiesta modifica aperta per stopId
  const [reqFor, setReqFor] = useState<string | null>(null);
  const [reqPatch, setReqPatch] = useState({ title: '', date: '', time: '', reason: '' });

  useEffect(() => {
    if (!firebaseReady()) return;
    ensureUser().then((u) => setUid(u.uid)).catch((e) => setErr(String(e.message || e)));
  }, []);

  useEffect(() => {
    if (!firebaseReady() || !groupId) return;
    const off = subscribeGroup(groupId, setGroup, setStops, setRequests);
    return off;
  }, [groupId]);

  const myPending = useMemo(
    () => requests.filter((r) => r.status === 'in-attesa' && r.ownerId === uid),
    [requests, uid]
  );
  const pendingByStop = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of requests) if (r.status === 'in-attesa') m[r.stopId] = (m[r.stopId] ?? 0) + 1;
    return m;
  }, [requests]);

  // ---------- Stati speciali ----------

  if (!firebaseReady()) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <h1 className="page-title">Gruppo di viaggio</h1>
        <div className="azulejo-band" aria-hidden />
        <div className="card space-y-2 text-sm leading-relaxed">
          <p className="font-semibold">Per attivare il gruppo serve un progetto Firebase gratuito (5 minuti):</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Vai su <span className="font-mono">console.firebase.google.com</span> → Aggiungi progetto (Analytics: no)</li>
            <li>Icona <span className="font-mono">&lt;/&gt;</span> → registra l\u2019app web → copia il blocco <span className="font-mono">firebaseConfig</span></li>
            <li>Incollalo nel file <span className="font-mono">src/firebaseConfig.ts</span> del progetto su GitHub</li>
            <li>Authentication → Sign-in method → abilita <strong>Anonimo</strong></li>
            <li>Firestore Database → Crea database → Regole: incolla quelle nel README → Pubblica</li>
          </ol>
          <p className="opacity-70">Fatto questo, Vercel ripubblica da solo e questa pagina diventa il vostro itinerario condiviso.</p>
        </div>
      </div>
    );
  }

  if (!groupId) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <h1 className="page-title">Gruppo di viaggio</h1>
        <div className="azulejo-band" aria-hidden />
        <p className="text-sm opacity-80">Un secondo itinerario, <strong>condiviso</strong>: il tuo piano personale resta intatto. Ognuno aggiunge tappe che tutti vedono; per modificare o cancellare la tappa di un altro serve la sua approvazione.</p>
        {err && <p className="card text-sm text-red-700 dark:text-red-300" role="alert">{err}</p>}
        <div className="card space-y-2">
          <label className="label">Il tuo nome (visibile agli altri)
            <input className="input" value={name} placeholder="es. Niko" onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <div className="card space-y-2">
          <h2 className="font-display text-lg">Crea un nuovo gruppo</h2>
          <button className="btn-primary w-full" disabled={busy || !name.trim()} onClick={async () => {
            setBusy(true); setErr(null);
            try { setDisplayName(name); const g = await createGroup('Il nostro viaggio'); setGroupId(g.id); }
            catch (e) { setErr(String((e as Error).message || e)); }
            setBusy(false);
          }}>✨ Crea gruppo e genera codice invito</button>
        </div>
        <div className="card space-y-2">
          <h2 className="font-display text-lg">Entra con un codice</h2>
          <JoinForm disabled={busy || !name.trim()} onJoin={async (code) => {
            setBusy(true); setErr(null);
            try { setDisplayName(name); const g = await joinGroup(code); setGroupId(g.id); }
            catch (e) { setErr(String((e as Error).message || e)); }
            setBusy(false);
          }} />
        </div>
      </div>
    );
  }

  // ---------- Gruppo attivo ----------

  const byDate: Record<string, GroupStop[]> = {};
  for (const s of stops) (byDate[s.date] ??= []).push(s);

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="page-title">{group?.name ?? 'Gruppo di viaggio'}</h1>
          <p className="text-sm opacity-70">Codice invito: <strong className="font-mono">{group?.code ?? '…'}</strong></p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <button className="btn-ghost !min-h-[36px] !py-1 text-sm" onClick={() => {
            if (group) navigator.share?.({ text: `Unisciti al nostro viaggio! Apri l'app e inserisci il codice ${group.code}` })
              ?? navigator.clipboard.writeText(group.code).then(() => alert('Codice copiato!'));
          }}>📤 Invita</button>
          <button className="btn-ghost !min-h-[36px] !py-1 text-sm" onClick={() => { if (confirm('Uscire dal gruppo su questo dispositivo? (le tappe restano nel gruppo)')) { leaveGroup(); setGroupId(null); } }}>🚪 Esci</button>
        </div>
      </header>
      <div className="azulejo-band" aria-hidden />
      {err && <p className="card text-sm text-red-700 dark:text-red-300" role="alert">{err}</p>}

      {myPending.length > 0 && (
        <section className="card border-oro space-y-2">
          <h2 className="font-display text-lg">🔔 Richieste per le tue tappe ({myPending.length})</h2>
          {myPending.map((r) => (
            <div key={r.id} className="rounded-xl bg-crema dark:bg-[#231913] p-3 text-sm space-y-1">
              <p><strong>{r.requesterName}</strong> chiede la <strong>{r.type}</strong> di «{r.stopTitle}»</p>
              {r.patch && <p className="opacity-80">Proposta: {[r.patch.title && `titolo → ${r.patch.title}`, r.patch.date && `data → ${r.patch.date}`, r.patch.time && `ora → ${r.patch.time}`].filter(Boolean).join(' · ')}</p>}
              {r.reason && <p className="italic opacity-80">Motivo: {r.reason}</p>}
              <div className="flex gap-2 pt-1">
                <button className="btn-primary !min-h-[36px] !py-1 flex-1" onClick={() => resolveRequest(groupId, r, true).catch((e) => setErr(String(e.message)))}>✅ Approva</button>
                <button className="btn-secondary !min-h-[36px] !py-1 flex-1" onClick={() => resolveRequest(groupId, r, false).catch((e) => setErr(String(e.message)))}>❌ Rifiuta</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="font-display text-lg">＋ Aggiungi una tappa</h2>
        <PlaceSearch onSelect={(p) => { setNt({ ...nt, title: p.name, address: p.address }); setNtCoords({ lat: p.lat, lng: p.lng }); }} />
        {ntCoords && <p className="text-xs badge-ok">📍 Posizione agganciata dalla ricerca — la tappa avrà il "Portami qui"</p>}
        <label className="label">Titolo<input className="input" value={nt.title} placeholder="es. Tramonto sul lungomare" onChange={(e) => setNt({ ...nt, title: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="label">Data<input className="input" type="date" value={nt.date} onChange={(e) => setNt({ ...nt, date: e.target.value })} /></label>
          <label className="label">Ora<input className="input" type="time" value={nt.time} onChange={(e) => setNt({ ...nt, time: e.target.value })} /></label>
        </div>
        <label className="label">Indirizzo (facoltativo)<input className="input" value={nt.address} onChange={(e) => setNt({ ...nt, address: e.target.value })} /></label>
        <label className="label">Nota per il gruppo<input className="input" value={nt.notes} placeholder="perché la proponi" onChange={(e) => setNt({ ...nt, notes: e.target.value })} /></label>
        <button className="btn-primary w-full" disabled={busy || !nt.title.trim()} onClick={async () => {
          setBusy(true); setErr(null);
          try {
            const pres = await generatePresentation(nt.title, nt.notes);
            await addGroupStop(groupId, { title: nt.title.trim(), date: nt.date, time: nt.time || undefined, address: nt.address || undefined, coords: ntCoords ?? undefined, notes: nt.notes || undefined }, pres);
            setNt({ title: '', date: nt.date, time: '', address: '', notes: '' });
            setNtCoords(null);
          } catch (e) { setErr(String((e as Error).message || e)); }
          setBusy(false);
        }}>{busy ? '⏳ Genero la presentazione…' : '✨ Aggiungi (con presentazione e audio automatici)'}</button>
        <p className="text-xs opacity-60">La presentazione viene scritta in automatico in stile guida (via /api/ai se configurato) ed è subito ascoltabile da tutti come audioguida.</p>
      </section>

      {Object.entries(byDate).map(([date, list]) => (
        <section key={date} className="space-y-2">
          <h2 className="font-display text-lg">{new Date(date + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          {list.map((s) => {
            const mine = s.ownerId === uid;
            return (
              <div key={s.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{s.time && <span className="tabular-nums mr-2">{s.time}</span>}{s.title}</p>
                    <p className="text-xs opacity-60">di {mine ? 'te' : s.ownerName}{s.address ? ` · 📍 ${s.address}` : ''}{pendingByStop[s.id] ? ` · 🔔 ${pendingByStop[s.id]} richiesta/e in attesa` : ''}</p>
                    {s.notes && <p className="text-xs italic opacity-80">📝 {s.notes}</p>}
                    {s.coords && <a className="text-xs underline" href={googleMapsDirectionsUrl(s.coords)} target="_blank" rel="noreferrer">🧭 Portami qui</a>}
                  </div>
                  {mine ? (
                    <button className="btn-ghost !min-h-[36px] !py-1 text-sm shrink-0" onClick={() => { if (confirm(`Eliminare la tua tappa "${s.title}"?`)) deleteOwnStop(groupId, s.id).catch((e) => setErr(String(e.message))); }}>🗑️</button>
                  ) : (
                    <button className="btn-ghost !min-h-[36px] !py-1 text-sm shrink-0" onClick={() => { setReqFor(reqFor === s.id ? null : s.id); setReqPatch({ title: '', date: '', time: '', reason: '' }); }}>✋ Richiedi</button>
                  )}
                </div>

                <GuideImage subject={`${s.title}${s.address ? ' ' + s.address : ''}`} alt={s.title} />
                <details>
                  <summary className="cursor-pointer text-sm font-semibold">🎧 Presentazione e audioguida</summary>
                  <p className="text-sm leading-relaxed mt-2 whitespace-pre-wrap">{s.presentation}</p>
                  <div className="mt-2"><AudioControls text={s.presentation} audioKey={`group-${s.id}`} /></div>
                  {mine && (
                    <button className="btn-ghost !min-h-[36px] !py-1 text-sm mt-1" onClick={() => {
                      const nuovo = prompt('Modifica la presentazione:', s.presentation);
                      if (nuovo !== null) updateOwnStop(groupId, s.id, { presentation: nuovo }).catch((e) => setErr(String(e.message)));
                    }}>✏️ Modifica testo</button>
                  )}
                </details>

                {reqFor === s.id && !mine && (
                  <div className="rounded-xl bg-crema dark:bg-[#231913] p-3 space-y-2 text-sm">
                    <p className="font-semibold">Richiesta a {s.ownerName} (decide lui/lei):</p>
                    <div className="grid grid-cols-3 gap-2">
                      <input className="input" placeholder="nuovo titolo" value={reqPatch.title} onChange={(e) => setReqPatch({ ...reqPatch, title: e.target.value })} />
                      <input className="input" type="date" value={reqPatch.date} onChange={(e) => setReqPatch({ ...reqPatch, date: e.target.value })} />
                      <input className="input" type="time" value={reqPatch.time} onChange={(e) => setReqPatch({ ...reqPatch, time: e.target.value })} />
                    </div>
                    <input className="input" placeholder="motivo (facoltativo)" value={reqPatch.reason} onChange={(e) => setReqPatch({ ...reqPatch, reason: e.target.value })} />
                    <div className="flex gap-2">
                      <button className="btn-secondary flex-1 !min-h-[36px] !py-1" onClick={() => {
                        const patch = { ...(reqPatch.title && { title: reqPatch.title }), ...(reqPatch.date && { date: reqPatch.date }), ...(reqPatch.time && { time: reqPatch.time }) };
                        requestChange(groupId, s, 'modifica', reqPatch.reason, patch).then(() => setReqFor(null)).catch((e) => setErr(String(e.message)));
                      }}>✏️ Chiedi modifica</button>
                      <button className="btn-secondary flex-1 !min-h-[36px] !py-1" onClick={() => {
                        requestChange(groupId, s, 'cancellazione', reqPatch.reason).then(() => setReqFor(null)).catch((e) => setErr(String(e.message)));
                      }}>🗑️ Chiedi cancellazione</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}

      {stops.length === 0 && <p className="card text-sm opacity-70">Nessuna tappa condivisa ancora: aggiungi la prima! 🎉</p>}
    </div>
  );
}

function JoinForm({ onJoin, disabled }: { onJoin: (code: string) => void; disabled: boolean }) {
  const [code, setCode] = useState('');
  return (
    <div className="flex gap-2">
      <input className="input flex-1 font-mono uppercase" placeholder="ZIS-XXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <button className="btn-secondary shrink-0" disabled={disabled || code.trim().length < 6} onClick={() => onJoin(code)}>Entra</button>
    </div>
  );
}
