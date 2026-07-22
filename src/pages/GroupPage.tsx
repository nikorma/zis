import { useEffect, useMemo, useState } from 'react';
import AudioControls from '../components/AudioControls';
import GuideImage from '../components/GuideImage';
import PlaceSearch from '../components/PlaceSearch';
import { googleMapsDirectionsUrl } from '../lib/geo';
import {
  firebaseReady, ensureUser, getDisplayName, setDisplayName,
  getSavedGroupId, leaveGroup, createGroup, joinGroup, subscribeGroup,
  addGroupStop, updateOwnStop, deleteOwnStop, requestChange, resolveRequest, generatePresentation,
  addExpense, deleteExpense, computeBalances, settleUp, stopsToDays, dedupeGroupStops,
  type GroupInfo, type GroupStop, type ChangeRequest, type Member, type Expense,
} from '../services/group';
import { useApp } from '../state/AppStore';
import { useNavigate } from 'react-router-dom';
import { appConfirm } from '../lib/dialog';

export default function GroupPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState(getDisplayName());
  const [groupId, setGroupId] = useState<string | null>(getSavedGroupId());
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [stops, setStops] = useState<GroupStop[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, update } = useApp();
  const nav = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  // form nota spese
  const [ex, setEx] = useState({ desc: '', amount: '', place: '' });
  const [split, setSplit] = useState<Set<string> | null>(null); // null = tutti
  const [exBusy, setExBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);

  // form creazione gruppo
  const [gname, setGname] = useState('Il nostro viaggio');
  const [gdates, setGdates] = useState({ start: '', end: '' });
  // form nuova tappa
  const [nt, setNt] = useState({ title: '', date: '', time: '', address: '', notes: '' });
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
    const off = subscribeGroup(groupId, setGroup, setStops, setRequests, setMembers, setExpenses);
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
            <li>Icona <span className="font-mono">&lt;/&gt;</span> → registra l’app web → copia il blocco <span className="font-mono">firebaseConfig</span></li>
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
          <h2 className="font-display text-lg">✨ Crea un viaggio di gruppo completo</h2>
          <p className="text-sm opacity-70">Destinazione, date e orari → l'app genera l'itinerario con presentazioni e audioguide, crea il gruppo e ti dà il codice da mandare agli amici. Tutto in un colpo.</p>
          <button className="btn-primary w-full" disabled={!name.trim()} onClick={() => { setDisplayName(name); sessionStorage.setItem('zaino-gflow', '1'); nav('/pianifica'); }}>
            ✨ Crea viaggio di gruppo con itinerario automatico
          </button>
          {!name.trim() && <p className="text-xs opacity-60">Prima scrivi il tuo nome qui sopra.</p>}
        </div>
        <div className="card space-y-2">
          <h2 className="font-display text-lg">➕ Oppure: gruppo vuoto</h2>
          <label className="label">Nome del viaggio
            <input className="input" value={gname} onChange={(e) => setGname(e.target.value)} placeholder="es. Atene 2026" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="label">📅 Partenza<input className="input" type="date" value={gdates.start} onChange={(e) => setGdates({ ...gdates, start: e.target.value })} /></label>
            <label className="label">📅 Ritorno<input className="input" type="date" value={gdates.end} onChange={(e) => setGdates({ ...gdates, end: e.target.value })} /></label>
          </div>
          <button className="btn-primary w-full"
            disabled={busy || !name.trim() || !gdates.start || !gdates.end || gdates.start > gdates.end}
            onClick={async () => {
              setBusy(true); setErr(null);
              try { setDisplayName(name); const g = await createGroup(gname, gdates.start, gdates.end); setGroupId(g.id); }
              catch (e) { setErr(String((e as Error).message || e)); }
              setBusy(false);
            }}>✨ Crea gruppo e genera codice invito</button>
          {(!gdates.start || !gdates.end) && <p className="text-xs opacity-60">Servono le date di partenza e ritorno: le tappe di tutti resteranno dentro quel periodo.</p>}
        </div>
        <div className="card space-y-2">
          <h2 className="font-display text-lg">Entra con un codice</h2>
          <p className="text-xs opacity-60">Codici <strong>ZIS-</strong> (gruppo di amici) e <strong>BNB-</strong> (soggiorno preparato da una struttura).</p>
          <JoinForm disabled={busy} onJoin={async (code) => {
            const c = code.toUpperCase().trim();
            // 🏡 Codice B&B: apre direttamente la schermata di benvenuto (non serve il nome)
            if (c.startsWith('BNB')) { nav('/benvenuto/' + c.replace(/^BNB-?/, 'BNB-')); return; }
            if (!name.trim()) { setErr('⬆️ Scrivi prima il TUO NOME nel campo in alto, poi premi Entra.'); return; }
            setBusy(true); setErr(null);
            try { setDisplayName(name); const g = await joinGroup(c); setGroupId(g.id); }
            catch (e) { setErr(String((e as Error).message || e)); }
            setBusy(false);
          }} />
        </div>
      </div>
    );
  }

  // ---------- Gruppo attivo ----------

  const splitSet: Set<string> = split ?? new Set(members.map((m) => m.id));
  const toggleSplit = (id: string) => {
    const next = new Set(splitSet);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSplit(next);
  };

  const suggestPlace = () => {
    if (!navigator.geolocation) { setErr('GPS non disponibile su questo dispositivo.'); return; }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
        const R = 6371000, toR = Math.PI / 180;
        const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
        const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(x));
      };
      // 1) tappa più vicina (gruppo + mio itinerario)
      const candidates: { title: string; coords: { lat: number; lng: number } }[] = [
        ...stops.filter((st) => st.coords).map((st) => ({ title: st.title, coords: st.coords as { lat: number; lng: number } })),
        ...data.days.flatMap((d) => d.stops.filter((st) => st.coords).map((st) => ({ title: st.title, coords: st.coords as { lat: number; lng: number } }))),
      ];
      let best: { title: string; m: number } | null = null;
      for (const c of candidates) {
        const m = dist(here, c.coords);
        if (!best || m < best.m) best = { title: c.title, m };
      }
      if (best && best.m <= 400) {
        setEx((e) => ({ ...e, place: best!.title, desc: e.desc || best!.title }));
        setLocBusy(false);
        return;
      }
      // 2) altrimenti: nome del posto dalla mappa (reverse geocoding)
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=it&lat=${here.lat}&lon=${here.lng}`);
        const j = await r.json();
        const name = j?.name || j?.address?.amenity || j?.address?.road || (j?.display_name || '').split(',')[0];
        if (name) setEx((e) => ({ ...e, place: name, desc: e.desc || name }));
      } catch { /* pazienza */ }
      setLocBusy(false);
    }, () => { setLocBusy(false); setErr('Non riesco a leggere la posizione: controlla i permessi GPS.'); }, { enableHighAccuracy: true, timeout: 8000 });
  };

  const submitExpense = async () => {
    const amount = Number(ex.amount.replace(',', '.'));
    if (!ex.desc.trim() || !amount || amount <= 0 || splitSet.size === 0 || !groupId) return;
    setExBusy(true); setErr(null);
    try {
      await addExpense(groupId, ex.desc, amount, [...splitSet], ex.place || undefined);
      setEx({ desc: '', amount: '', place: '' });
      setSplit(null);
    } catch (e) { setErr(String((e as Error).message || e)); }
    setExBusy(false);
  };

  const balances = computeBalances(expenses, members);
  const settlements = settleUp(balances);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  const byDate: Record<string, GroupStop[]> = {};
  for (const s of stops) (byDate[s.date] ??= []).push(s);

  const linkedTrip = data.trips.find((t) => t.groupId === groupId);
  const linkTrip = () => {
    if (!group || !groupId) return;
    const existing = data.trips.find((t) => t.groupId === groupId);
    const id = existing?.id ?? 'grp-' + groupId;
    const days = stopsToDays(group.name, stops, existing?.days ?? []);
    const trip = {
      id, name: `${group.name} 👥`, destination: group.name, days,
      createdAt: existing?.createdAt ?? new Date().toISOString(), groupId,
    };
    update({
      trips: existing ? data.trips.map((t) => (t.id === id ? trip : t)) : [...data.trips, trip],
      days, activeTripId: id,
    });
    nav('/itinerario');
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="page-title">{group?.name ?? 'Gruppo di viaggio'}</h1>
          <p className="text-sm opacity-70">Codice invito: <strong className="font-mono">{group?.code ?? '…'}</strong></p>
          {group?.startDate && group?.endDate && (
            <p className="text-xs opacity-70">📅 {new Date(group.startDate + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} → {new Date(group.endDate + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</p>
          )}
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

      <section className="card space-y-1.5">
        {(() => {
          const seen = new Set<string>();
          const hasDup = stops.some((st) => { const k = `${st.title}|${st.date}|${st.time ?? ''}`; if (seen.has(k)) return true; seen.add(k); return false; });
          return hasDup ? (
            <button className="btn-gold w-full !min-h-[42px] mb-1" onClick={async () => {
              const n = await dedupeGroupStops(groupId).catch(() => 0);
              setErr(n > 0 ? null : 'Doppioni non tuoi: solo chi ha creato la tappa può rimuoverla.');
            }}>🧹 Pulisci tappe doppie del gruppo</button>
          ) : null;
        })()}
        {linkedTrip ? (
          <>
            <p className="text-sm"><span className="badge-ok">🔗 Collegato al tuo itinerario</span> — le tappe del gruppo si aggiornano da sole anche lì, con meteo, audioguide e navigatore.</p>
            <button className="btn-secondary w-full !min-h-[42px]" onClick={linkTrip}>🗓️ Apri nell'itinerario</button>
          </>
        ) : (
          <>
            <button className="btn-gold w-full" onClick={linkTrip}>⬇️ Collega al mio itinerario</button>
            <p className="text-xs opacity-60">Crea in "I miei viaggi" una copia che resta sincronizzata in tempo reale col gruppo: la apri come un itinerario normale (meteo dell'ora, audioguide, guide interne, navigatore), e le spunte "visitato" restano tue.</p>
          </>
        )}
      </section>

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
          <label className="label">Data<input className="input" type="date" min={group?.startDate} max={group?.endDate} value={nt.date || group?.startDate || ''} onChange={(e) => setNt({ ...nt, date: e.target.value })} /></label>
          <label className="label">Ora<input className="input" type="time" value={nt.time} onChange={(e) => setNt({ ...nt, time: e.target.value })} /></label>
        </div>
        <label className="label">Indirizzo (facoltativo)<input className="input" value={nt.address} onChange={(e) => setNt({ ...nt, address: e.target.value })} /></label>
        <label className="label">Nota per il gruppo<input className="input" value={nt.notes} placeholder="perché la proponi" onChange={(e) => setNt({ ...nt, notes: e.target.value })} /></label>
        <button className="btn-primary w-full" disabled={busy || !nt.title.trim()} onClick={async () => {
          setBusy(true); setErr(null);
          try {
            const pres = await generatePresentation(nt.title, nt.notes, data.settings.lang);
            await addGroupStop(groupId, { title: nt.title.trim(), date: nt.date || group?.startDate || new Date().toISOString().slice(0, 10), time: nt.time || undefined, address: nt.address || undefined, coords: ntCoords ?? undefined, notes: nt.notes || undefined }, pres);
            setNt({ title: '', date: nt.date, time: '', address: '', notes: '' });
            setNtCoords(null);
          } catch (e) { setErr(String((e as Error).message || e)); }
          setBusy(false);
        }}>{busy ? '⏳ Genero la presentazione…' : '✨ Aggiungi (con presentazione e audio automatici)'}</button>
        <p className="text-xs opacity-60">La presentazione viene scritta in automatico in stile guida (via /api/ai se configurato) ed è subito ascoltabile da tutti come audioguida.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-lg">💶 Nota spese del gruppo</h2>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_96px] gap-2">
            <input className="input" placeholder="Cosa hai pagato? (es. cena da Panconplaino)" value={ex.desc} onChange={(e) => setEx({ ...ex, desc: e.target.value })} />
            <input className="input" type="text" inputMode="decimal" placeholder="€ 0,00" value={ex.amount} onChange={(e) => setEx({ ...ex, amount: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary !min-h-[38px] !py-1 text-sm" disabled={locBusy} onClick={suggestPlace}>
              {locBusy ? '⏳ Cerco dove sei…' : '📍 Usa il luogo dove sono'}
            </button>
            {ex.place && <span className="text-xs badge-ok">📍 {ex.place}</span>}
          </div>
          <div>
            <p className="label !mb-1">Da dividere con:</p>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <button key={m.id} className={splitSet.has(m.id) ? 'chip-on !py-1 !px-3 text-xs' : 'chip-off !py-1 !px-3 text-xs'} onClick={() => toggleSplit(m.id)} aria-pressed={splitSet.has(m.id)}>
                  {m.id === uid ? `${m.name} (io)` : m.name}
                </button>
              ))}
            </div>
            <p className="text-[11px] opacity-60 mt-1">La cifra si divide in parti uguali tra i selezionati (compreso chi ha pagato).</p>
          </div>
          <button className="btn-gold w-full" disabled={exBusy || !ex.desc.trim() || !Number(ex.amount.replace(',', '.')) || splitSet.size === 0} onClick={submitExpense}>
            {exBusy ? '⏳…' : `➕ Aggiungi spesa${splitSet.size > 0 && Number(ex.amount.replace(',', '.')) > 0 ? ` (€${(Number(ex.amount.replace(',', '.')) / splitSet.size).toFixed(2)} a testa)` : ''}`}
          </button>
        </div>

        {expenses.length > 0 && (
          <>
            <div className="space-y-1.5">
              {expenses.map((e) => (
                <div key={e.id} className="rounded-xl bg-crema dark:bg-[#141C33] p-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold">{e.desc}</p>
                    <p className="tabular-nums font-bold shrink-0">€{e.amount.toFixed(2)}</p>
                  </div>
                  <p className="text-xs opacity-70">
                    Ha pagato <strong>{e.payerName}</strong> · diviso per {e.splitWith.length} (€{(e.amount / Math.max(1, e.splitWith.length)).toFixed(2)} a testa)
                    {e.place ? <> · 📍 {e.place}</> : null}
                  </p>
                  <p className="text-[11px] opacity-60">Con: {e.splitWith.map(nameOf).join(', ')}</p>
                  {e.payerId === uid && (
                    <button className="text-xs opacity-60 underline mt-1" onClick={async () => { if (await appConfirm(`Eliminare la spesa "${e.desc}" (€${e.amount.toFixed(2)})?`, 'Elimina', true)) deleteExpense(groupId, e).catch((er) => setErr(String((er as Error).message))); }}>🗑️ elimina</button>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl border-2 border-menta/60 p-3 space-y-1.5">
              <p className="font-display font-semibold">⚖️ Come siamo messi</p>
              {balances.map((b) => (
                <p key={b.member.id} className="text-sm flex justify-between">
                  <span>{b.member.id === uid ? `${b.member.name} (io)` : b.member.name}</span>
                  <span className={`tabular-nums font-semibold ${b.balance > 0.005 ? 'text-[#0E7A5D]' : b.balance < -0.005 ? 'text-red-700 dark:text-red-300' : 'opacity-60'}`}>
                    {b.balance > 0.005 ? `deve ricevere €${b.balance.toFixed(2)}` : b.balance < -0.005 ? `deve dare €${(-b.balance).toFixed(2)}` : 'pari ✓'}
                  </span>
                </p>
              ))}
              {settlements.length > 0 && (
                <div className="pt-1 border-t border-dashed border-[#E4D7BC] dark:border-[#33406B]">
                  <p className="text-xs font-semibold mb-0.5">💸 Per pareggiare:</p>
                  {settlements.map((t, i) => <p key={i} className="text-sm">→ {t}</p>)}
                </div>
              )}
              <p className="text-[11px] opacity-60">Totale gruppo: €{expenses.reduce((a, e) => a + e.amount, 0).toFixed(2)}</p>
            </div>
          </>
        )}
        {expenses.length === 0 && <p className="text-sm opacity-60">Nessuna spesa ancora: la prima cena tocca a qualcuno… 😄</p>}
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
      <input className="input flex-1 font-mono uppercase" placeholder="ZIS-XXXXX o BNB-XXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <button className="btn-secondary shrink-0" disabled={disabled || code.trim().length < 6} onClick={() => onJoin(code)}>Entra</button>
    </div>
  );
}
