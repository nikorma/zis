import { useEffect, useState } from 'react';
import {
  buildPackingList, estimateClimate, tripDays, defaultCapacity, LUGGAGE_LABEL, LUGGAGE_CAPACITY_L,
  type Gender, type Luggage, type Transport, type PackingResult, type PackingInput,
} from '../services/packing';
import PlaceSearch from '../components/PlaceSearch';
import MapView from '../components/MapView';
import { appConfirm } from '../lib/dialog';

const LS_CASES = 'zaino-valigie-v1';
const LS_OLD = 'zaino-packing-v1';

interface Case {
  id: string;
  name: string;
  updatedAt: string;
  input: PackingInput;
  result: PackingResult | null;
  checked: string[];
}

function loadCases(): Record<string, Case> {
  try { return JSON.parse(localStorage.getItem(LS_CASES) || '{}'); } catch { return {}; }
}
function saveCases(c: Record<string, Case>) {
  try { localStorage.setItem(LS_CASES, JSON.stringify(c)); } catch { /* quota */ }
}
function validResult(r: PackingResult | null): boolean {
  return !!r && Array.isArray(r.items) && Array.isArray(r.reductions)
    && typeof r.capacityL === 'number'
    && r.items.every((i) => typeof (i as { vol?: unknown }).vol === 'number');
}

const EMPTY_INPUT: PackingInput = {
  destination: '', startDate: '', endDate: '',
  gender: 'uomo', sizes: { top: '', bottom: '', shoes: '' },
  luggages: ['bagaglio-a-mano'], capacityL: undefined, laundry: false, transport: 'aereo',
};

export default function PackingPage() {
  const [cases, setCases] = useState<Record<string, Case>>({});
  const [caseId, setCaseId] = useState<string | null>(null);
  const [input, setInput] = useState<PackingInput>(EMPTY_INPUT);
  const [result, setResult] = useState<PackingResult | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState({ name: '', qty: 1, vol: 0.5 });
  const [capText, setCapText] = useState<string>(String(defaultCapacity(EMPTY_INPUT.luggages)));

  // Tiene il campo litri allineato quando cambiano i bagagli o si apre una valigia,
  // senza però combattere con l'utente mentre digita.
  useEffect(() => {
    setCapText(String(input.capacityL ?? defaultCapacity(input.luggages)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, input.luggages.join(',')]);

  // Carica le valigie salvate (+ migrazione dal vecchio formato singolo)
  useEffect(() => {
    const c = loadCases();
    // rimuovi eventuali casi con formato non valido
    for (const k of Object.keys(c)) {
      if (!c[k]?.input || !Array.isArray(c[k].input.luggages) || (c[k].result && !validResult(c[k].result))) delete c[k];
    }
    try {
      const old = JSON.parse(localStorage.getItem(LS_OLD) || 'null');
      if (old?.input && validResult(old.result)) {
        const id = 'migrata-' + Date.now();
        const lug = old.input.luggage === 'combinato' ? ['bagaglio-a-mano', 'valigia-stiva'] : [old.input.luggage ?? 'bagaglio-a-mano'];
        c[id] = {
          id, name: `${old.input.destination || 'Viaggio'} (${old.input.startDate || ''})`, updatedAt: new Date().toISOString(),
          input: { ...EMPTY_INPUT, ...old.input, luggages: lug as Luggage[], laundry: !!old.result?.laundry },
          result: old.result, checked: old.checked ?? [],
        };
      }
      localStorage.removeItem(LS_OLD);
    } catch { localStorage.removeItem(LS_OLD); }
    setCases(c);
    saveCases(c);
  }, []);

  const persist = (nextInput: PackingInput, nextResult: PackingResult | null, nextChecked: Set<string>, id = caseId) => {
    if (!id) return;
    const name = `${nextInput.destination || 'Viaggio'} · ${nextInput.startDate || 'senza data'}`;
    const next = { ...cases, [id]: { id, name, updatedAt: new Date().toISOString(), input: nextInput, result: nextResult, checked: [...nextChecked] } };
    setCases(next);
    saveCases(next);
  };

  const openCase = (id: string) => {
    const c = cases[id];
    if (!c) return;
    setCaseId(id);
    setInput(c.input);
    setResult(c.result);
    setChecked(new Set(c.checked));
  };

  const newCase = () => {
    setCaseId(null);
    setInput(EMPTY_INPUT);
    setResult(null);
    setChecked(new Set());
  };

  const deleteCase = async (id: string) => {
    if (!(await appConfirm(`Eliminare la valigia "${cases[id]?.name}"?`, 'Elimina', true))) return;
    const next = { ...cases };
    delete next[id];
    setCases(next);
    saveCases(next);
    if (caseId === id) newCase();
  };

  const set = <K extends keyof PackingInput>(k: K, v: PackingInput[K]) => setInput((i) => ({ ...i, [k]: v }));

  const toggleLuggage = (l: Luggage) => {
    setInput((i) => {
      const has = i.luggages.includes(l);
      const luggages = has ? i.luggages.filter((x) => x !== l) : [...i.luggages, l];
      if (luggages.length === 0) return i; // almeno un bagaglio
      return { ...i, luggages, capacityL: undefined };
    });
  };

  const generate = async () => {
    setBusy(true);
    const climate = await estimateClimate(input.destination, input.startDate, input.endDate, input.coords);
    const res = buildPackingList(input, climate);
    const id = caseId ?? 'valigia-' + Date.now();
    setCaseId(id);
    setResult(res);
    const chk = new Set<string>();
    setChecked(chk);
    persist(input, res, chk, id);
    setBusy(false);
  };

  const toggle = (name: string) => {
    const c = new Set(checked);
    if (c.has(name)) c.delete(name); else c.add(name);
    setChecked(c);
    persist(input, result, c);
  };

  const applyItems = (items: PackingResult['items']) => {
    if (!result) return;
    const usable = result.capacityL * 0.9;
    const used = items.reduce((a, i) => a + i.vol * i.qty, 0);
    const next: PackingResult = { ...result, items, usedL: Math.round(used), overCapacity: used > usable };
    setResult(next);
    persist(input, next, checked);
  };

  const addExtra = () => {
    if (!result || !extra.name.trim()) return;
    applyItems([...result.items, {
      category: 'Aggiunti da me', name: extra.name.trim(), qty: Math.max(1, extra.qty),
      vol: Math.max(0, extra.vol), trim: 0, min: 0, custom: true,
    }]);
    setExtra({ name: '', qty: 1, vol: 0.5 });
  };

  const changeQty = (name: string, delta: number) => {
    if (!result) return;
    const items = result.items
      .map((i) => (i.name === name ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
      .filter((i) => i.qty > 0);
    applyItems(items);
  };

  const removeItem = (name: string) => {
    if (!result) return;
    applyItems(result.items.filter((i) => i.name !== name));
  };

  const share = () => {
    if (!result) return;
    const lines = result.items.map((i) => `${checked.has(i.name) ? '✅' : '⬜'} ${i.qty}× ${i.name}${i.note ? ` — ${i.note}` : ''}`);
    const txt = `🧳 Valigia per ${input.destination} (${result.days} giorni)\n\n${lines.join('\n')}\n\n${result.tips.map((t) => '💡 ' + t).join('\n')}`;
    if (navigator.share) navigator.share({ text: txt }).catch(() => {});
    else navigator.clipboard.writeText(txt).then(() => alert('Lista copiata!'));
  };

  const ready = input.destination.trim().length >= 3 && input.startDate && input.endDate && input.startDate <= input.endDate
    && input.sizes.top && input.sizes.bottom && input.sizes.shoes;

  const Chip = <T extends string>({ v, cur, on, label }: { v: T; cur: T; on: (x: T) => void; label: string }) => (
    <button className={cur === v ? 'chip-on' : 'chip-off'} onClick={() => on(v)}>{label}</button>
  );

  // 📏 Spazio calcolato DAL VIVO sui capi attuali: ogni −/＋ o aggiunta si vede subito
  const liveUsed = result ? Math.round(result.items.reduce((a, i) => a + i.vol * i.qty, 0)) : 0;
  const liveOver = result ? liveUsed > result.capacityL * 0.9 : false;
  const liveLeft = result ? Math.max(0, Math.round(result.capacityL * 0.9 - liveUsed)) : 0;

  const byCat: Record<string, PackingResult['items']> = {};
  if (result) for (const i of result.items) (byCat[i.category] ??= []).push(i);
  const done = result ? result.items.filter((i) => checked.has(i.name)).length : 0;
  const savedList = Object.values(cases).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="page-title">Valigia intelligente 🧳</h1>
      <div className="azulejo-band" aria-hidden />

      {savedList.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-display text-lg">📂 Le mie valigie</h2>
          {savedList.map((c) => (
            <div key={c.id} className={`flex items-center gap-2 rounded-xl p-2 ${caseId === c.id ? 'bg-crema dark:bg-[#141C33]' : ''}`}>
              <button className="flex-1 text-left" onClick={() => openCase(c.id)}>
                <span className="font-semibold text-sm">🧳 {c.name}</span>
                <span className="block text-xs opacity-60">
                  {c.result ? `${c.checked.length}/${c.result.items.length} nel bagaglio · ${c.result.usedL}/${c.result.capacityL} L` : 'da generare'}
                </span>
              </button>
              {caseId === c.id
                ? <span className="badge-ok shrink-0">Aperta</span>
                : <button className="btn-secondary !min-h-[36px] !py-1 text-sm shrink-0" onClick={() => openCase(c.id)}>Apri</button>}
              <button className="btn-ghost !min-h-[36px] !py-1 !px-2 shrink-0" aria-label="Elimina valigia" onClick={() => deleteCase(c.id)}>🗑️</button>
            </div>
          ))}
          <button className="btn-ghost w-full !min-h-[38px] !py-1 text-sm" onClick={newCase}>➕ Nuova valigia per un altro viaggio</button>
        </section>
      )}

      <section className="card space-y-3">
        <div>
          <span className="label">Destinazione</span>
          <PlaceSearch placeholder="Cerca la destinazione (es. Lisbona, Atene, Oslo…)" onSelect={(p) => setInput((i) => ({ ...i, destination: p.name, coords: { lat: p.lat, lng: p.lng } }))} />
          {input.coords ? (
            <div className="mt-2 space-y-1">
              <p className="text-xs badge-ok">📍 {input.destination} — è questo il posto giusto?</p>
              <MapView height="26vh" markers={[{ coords: input.coords, label: input.destination, kind: 'target' }]} highlight={input.coords} />
              <button className="btn-ghost !min-h-[34px] !py-1 text-xs" onClick={() => setInput((i) => ({ ...i, destination: '', coords: undefined }))}>✕ Cambia destinazione</button>
            </div>
          ) : (
            <input className="input mt-2" placeholder="…oppure scrivila a mano" value={input.destination} onChange={(e) => set('destination', e.target.value)} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="label">Partenza<input className="input" type="date" value={input.startDate} onChange={(e) => set('startDate', e.target.value)} /></label>
          <label className="label">Ritorno<input className="input" type="date" value={input.endDate} onChange={(e) => set('endDate', e.target.value)} /></label>
        </div>
        {input.startDate && input.endDate && input.startDate <= input.endDate && (
          <p className="text-xs opacity-70">📅 {tripDays(input.startDate, input.endDate)} giorni di viaggio</p>
        )}

        <div className="space-y-1">
          <p className="label !mb-0">Per chi è la valigia?</p>
          <div className="flex gap-2">
            <Chip v={'uomo' as Gender} cur={input.gender} on={(g) => set('gender', g)} label="👨 Uomo" />
            <Chip v={'donna' as Gender} cur={input.gender} on={(g) => set('gender', g)} label="👩 Donna" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="label">Taglia sopra<input className="input" placeholder="M / 48" value={input.sizes.top} onChange={(e) => set('sizes', { ...input.sizes, top: e.target.value })} /></label>
          <label className="label">Taglia sotto<input className="input" placeholder="32 / 46" value={input.sizes.bottom} onChange={(e) => set('sizes', { ...input.sizes, bottom: e.target.value })} /></label>
          <label className="label">Scarpe<input className="input" placeholder="43" value={input.sizes.shoes} onChange={(e) => set('sizes', { ...input.sizes, shoes: e.target.value })} /></label>
        </div>

        <div className="space-y-1">
          <p className="label !mb-0">🧳 Che bagagli avrai? (puoi sceglierne più di uno)</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LUGGAGE_LABEL) as Luggage[]).map((l) => (
              <button key={l} className={input.luggages.includes(l) ? 'chip-on' : 'chip-off'} onClick={() => toggleLuggage(l)} aria-pressed={input.luggages.includes(l)}>
                {LUGGAGE_LABEL[l]} (~{LUGGAGE_CAPACITY_L[l]} L)
              </button>
            ))}
          </div>
          <label className="label mt-2">Capienza totale (litri) — {input.luggages.map((l) => LUGGAGE_LABEL[l].split(' ').slice(1).join(' ')).join(' + ')}
            <input
              className="input" type="number" min={8} max={300} inputMode="numeric"
              value={capText}
              onChange={(e) => {
                const raw = e.target.value;
                setCapText(raw);
                const n = Number(raw);
                if (raw !== '' && !Number.isNaN(n) && n > 0) set('capacityL', n);
              }}
              onBlur={() => {
                const n = Number(capText);
                if (capText === '' || Number.isNaN(n) || n <= 0) {
                  set('capacityL', undefined);
                  setCapText(String(defaultCapacity(input.luggages)));
                }
              }}
            />
          </label>
          <p className="text-xs opacity-60">Somma dei bagagli scelti: puoi correggerla con il litraggio vero dei tuoi.</p>
        </div>

        <div className="space-y-1">
          <p className="label !mb-0">🧺 Potrai lavare i vestiti durante il viaggio?</p>
          <div className="flex gap-2">
            <button className={input.laundry ? 'chip-on' : 'chip-off'} onClick={() => set('laundry', true)}>Sì, potrò lavare</button>
            <button className={!input.laundry ? 'chip-on' : 'chip-off'} onClick={() => set('laundry', false)}>No</button>
          </div>
          <p className="text-xs opacity-60">Con i lavaggi bastano meno cambi: la lista si accorcia parecchio.</p>
        </div>

        <div className="space-y-1">
          <p className="label !mb-0">🚀 Come viaggi?</p>
          <div className="flex flex-wrap gap-2">
            <Chip v={'aereo' as Transport} cur={input.transport} on={(t) => set('transport', t)} label="✈️ Aereo" />
            <Chip v={'auto' as Transport} cur={input.transport} on={(t) => set('transport', t)} label="🚗 Auto" />
            <Chip v={'treno' as Transport} cur={input.transport} on={(t) => set('transport', t)} label="🚆 Treno" />
            <Chip v={'nave' as Transport} cur={input.transport} on={(t) => set('transport', t)} label="🚢 Nave" />
            <Chip v={'combinato' as Transport} cur={input.transport} on={(t) => set('transport', t)} label="🔀 Combinato" />
          </div>
        </div>

        <button className="btn-primary w-full" disabled={!ready || busy} onClick={generate}>
          {busy ? '⏳ Controllo il clima e calcolo…' : result ? '🔄 Ricalcola la lista' : '✨ Prepara la lista'}
        </button>
        {!ready && <p className="text-xs opacity-60">Compila destinazione, date e le tre taglie per continuare.</p>}
      </section>

      {result && (
        <>
          {((result.reductions?.length ?? 0) > 0 || liveOver) && (
            <section className={`card border-2 ${liveOver ? 'border-red-500 bg-red-50 dark:bg-red-900/25' : 'border-oro bg-oro-tenue/30 dark:bg-oro/10'} space-y-1`} role="alert">
              <p className="font-display font-bold text-lg">{liveOver ? '🚨 Il bagaglio NON basta!' : '⚠️ Bagaglio pieno: ho ridotto la lista'}</p>
              {(result.reductions?.length ?? 0) > 0 && (
                <p className="text-sm">Per farci stare tutto ho tolto: <strong>{(result.reductions ?? []).join(' · ')}</strong>.</p>
              )}
              <p className="text-sm">
                {liveOver
                  ? 'Lo spazio non basta: togli qualcosa con i pulsanti −, aggiungi un bagaglio, aumenta i litri o attiva i lavaggi.'
                  : 'Trucco da viaggiatore: indossa i capi più ingombranti durante il viaggio.'}
              </p>
            </section>
          )}

          <section className="card space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">🧳 Spazio nel bagaglio</span>
              <span className="tabular-nums">{liveUsed} / {result.capacityL} L</span>
            </div>
            <div className="w-full bg-crema dark:bg-[#141C33] rounded-full h-3" role="progressbar" aria-valuenow={result.usedL} aria-valuemax={result.capacityL} aria-label="Occupazione del bagaglio">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (liveUsed / result.capacityL) * 100)}%`,
                  background: liveOver ? '#E14E2E' : liveUsed > result.capacityL * 0.7 ? '#FFC145' : '#3FBF9B',
                }}
              />
            </div>
            <p className={`text-sm font-semibold ${liveOver ? 'text-red-700 dark:text-red-300' : ''}`}>
              {liveOver
                ? `🚨 Hai superato lo spazio di ~${liveUsed - Math.round(result.capacityL * 0.9)} L: togli qualcosa o aumenta la capienza.`
                : `✅ Spazio ancora libero: ~${liveLeft} L`}
            </p>
          </section>

          <section className="card space-y-1 text-sm">
            {result.tips.map((t, i) => <p key={i}>💡 {t}</p>)}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">La tua lista ({done}/{result.items.length})</h2>
              <button className="btn-secondary !min-h-[40px] !py-1.5" onClick={share}>📤 Condividi</button>
            </div>
            <div className="w-full bg-crema dark:bg-[#141C33] rounded-full h-2" role="progressbar" aria-valuenow={done} aria-valuemax={result.items.length}>
              <div className="bg-terra h-2 rounded-full transition-all" style={{ width: `${(done / result.items.length) * 100}%` }} />
            </div>

            <div className="card space-y-2">
              <h3 className="font-display">➕ Aggiungi alla lista</h3>
              <div className="grid grid-cols-[1fr_70px_86px] gap-2">
                <input className="input" placeholder="es. macchina fotografica" value={extra.name} onChange={(e) => setExtra({ ...extra, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addExtra()} />
                <input className="input" type="number" min={1} aria-label="Quantità" value={extra.qty} onChange={(e) => setExtra({ ...extra, qty: Number(e.target.value) || 1 })} />
                <input className="input" type="number" min={0} step={0.1} aria-label="Litri per pezzo" value={extra.vol} onChange={(e) => setExtra({ ...extra, vol: Number(e.target.value) })} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] opacity-60">quantità · ingombro in litri (es. libro 0.5 · asciugacapelli 1.5)</p>
                <button className="btn-gold !min-h-[38px] !py-1" disabled={!extra.name.trim()} onClick={addExtra}>Aggiungi</button>
              </div>
            </div>

            {Object.entries(byCat).map(([cat, items]) => (
              <div key={cat} className="card">
                <h3 className="font-display mb-1">{cat}</h3>
                <ul className="space-y-1">
                  {items.map((i) => (
                    <li key={i.name}>
                      <label className={`flex items-start gap-2 cursor-pointer ${checked.has(i.name) ? 'opacity-50 line-through' : ''}`}>
                        <input type="checkbox" className="mt-1" checked={checked.has(i.name)} onChange={() => toggle(i.name)} />
                        <span className="flex-1"><strong>{i.qty}×</strong> {i.name}{i.note && <span className="block text-xs opacity-70 no-underline">↳ {i.note}</span>}</span>
                      </label>
                      <span className="inline-flex items-center gap-1 ml-6">
                        <button className="btn-ghost !min-h-[28px] !py-0 !px-2 text-sm" aria-label={`Meno ${i.name}`} onClick={() => changeQty(i.name, -1)}>−</button>
                        <button className="btn-ghost !min-h-[28px] !py-0 !px-2 text-sm" aria-label={`Più ${i.name}`} onClick={() => changeQty(i.name, +1)}>＋</button>
                        {i.custom && <button className="text-xs opacity-60 underline ml-1" onClick={() => removeItem(i.name)}>✕ togli</button>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
