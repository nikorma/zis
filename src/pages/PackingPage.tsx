import { useEffect, useState } from 'react';
import {
  buildPackingList, estimateClimate, tripDays, LUGGAGE_CAPACITY_L,
  type Gender, type Luggage, type Transport, type PackingResult, type PackingInput,
} from '../services/packing';
import PlaceSearch from '../components/PlaceSearch';
import MapView from '../components/MapView';

const LS = 'zaino-packing-v1';

interface Saved { input: PackingInput; result: PackingResult; checked: string[] }

export default function PackingPage() {
  const [input, setInput] = useState<PackingInput>({
    destination: '', startDate: '', endDate: '',
    gender: 'uomo', sizes: { top: '', bottom: '', shoes: '' },
    luggage: 'bagaglio-a-mano', transport: 'aereo',
  });
  const [result, setResult] = useState<PackingResult | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState({ name: '', qty: 1, vol: 0.5 });

  // ripristina l'ultima lista
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS) || 'null') as Saved | null;
      // Migrazione: i salvataggi creati prima della capienza-bagaglio non hanno
      // reductions/capacityL → vanno scartati (altrimenti la pagina va in errore).
      const valid = s && s.result && Array.isArray(s.result.items)
        && Array.isArray((s.result as PackingResult).reductions)
        && typeof (s.result as PackingResult).capacityL === 'number'
        && s.result.items.every((i) => typeof (i as { vol?: unknown }).vol === 'number');
      if (valid && s) { setInput(s.input); setResult(s.result); setChecked(new Set(s.checked)); }
      else if (s) localStorage.removeItem(LS);
    } catch { localStorage.removeItem(LS); }
  }, []);

  const persist = (inp: PackingInput, res: PackingResult, chk: Set<string>) =>
    localStorage.setItem(LS, JSON.stringify({ input: inp, result: res, checked: [...chk] } satisfies Saved));

  const set = <K extends keyof PackingInput>(k: K, v: PackingInput[K]) => setInput((i) => ({ ...i, [k]: v }));

  const generate = async () => {
    setBusy(true);
    const climate = await estimateClimate(input.destination, input.startDate, input.endDate, input.coords);
    const res = buildPackingList(input, climate);
    setResult(res);
    const chk = new Set<string>();
    setChecked(chk);
    persist(input, res, chk);
    setBusy(false);
  };

  const toggle = (name: string) => {
    const c = new Set(checked);
    if (c.has(name)) c.delete(name); else c.add(name);
    setChecked(c);
    if (result) persist(input, result, c);
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

  const byCat: Record<string, PackingResult['items']> = {};
  if (result) for (const i of result.items) (byCat[i.category] ??= []).push(i);
  const done = result ? result.items.filter((i) => checked.has(i.name)).length : 0;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="page-title">Valigia intelligente 🧳</h1>
      <div className="azulejo-band" aria-hidden />

      <section className="card space-y-3">
        <div>
          <span className="label">Destinazione</span>
          <PlaceSearch placeholder="Cerca la destinazione (es. Lisbona, Atene, Oslo…)" onSelect={(p) => { set('destination', p.name); setInput((i) => ({ ...i, destination: p.name, coords: { lat: p.lat, lng: p.lng } })); }} />
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
          <p className="label !mb-0">🧳 Che bagaglio avrai?</p>
          <div className="flex flex-wrap gap-2">
            <Chip v={'zaino' as Luggage} cur={input.luggage} on={(l) => setInput((i) => ({ ...i, luggage: l, capacityL: undefined }))} label="🎒 Zaino (~32 L)" />
            <Chip v={'bagaglio-a-mano' as Luggage} cur={input.luggage} on={(l) => setInput((i) => ({ ...i, luggage: l, capacityL: undefined }))} label="🧳 Bagaglio a mano (~40 L)" />
            <Chip v={'valigia-stiva' as Luggage} cur={input.luggage} on={(l) => setInput((i) => ({ ...i, luggage: l, capacityL: undefined }))} label="🛄 Valigia da stiva (~85 L)" />
            <Chip v={'combinato' as Luggage} cur={input.luggage} on={(l) => setInput((i) => ({ ...i, luggage: l, capacityL: undefined }))} label="➕ Combinato (~120 L)" />
          </div>
          <label className="label mt-2">Capienza esatta del TUO bagaglio (litri)
            <input
              className="input" type="number" min={8} max={250}
              value={input.capacityL ?? LUGGAGE_CAPACITY_L[input.luggage]}
              onChange={(e) => set('capacityL', Number(e.target.value) || undefined)}
            />
          </label>
          <p className="text-xs opacity-60">Se il tuo zaino/valigia ha un litraggio diverso da quello standard, scrivilo qui: la lista si adatta.</p>
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
          {busy ? '⏳ Controllo il clima e calcolo…' : '✨ Prepara la lista'}
        </button>
        {!ready && <p className="text-xs opacity-60">Compila destinazione, date e le tre taglie per continuare.</p>}
      </section>

      {result && (
        <>
          {(((result.reductions?.length ?? 0) > 0) || result.overCapacity) && (
            <section className={`card border-2 ${result.overCapacity ? 'border-red-500 bg-red-50 dark:bg-red-900/25' : 'border-oro bg-oro-tenue/30 dark:bg-oro/10'} space-y-1`} role="alert">
              <p className="font-display font-bold text-lg">{result.overCapacity ? '🚨 Il bagaglio NON basta!' : '⚠️ Bagaglio pieno: ho ridotto la lista'}</p>
              {(result.reductions?.length ?? 0) > 0 && (
                <p className="text-sm">Per farci stare tutto ho tolto: <strong>{(result.reductions ?? []).join(' · ')}</strong>.</p>
              )}
              <p className="text-sm">
                {result.overCapacity
                  ? 'Anche al minimo indispensabile lo spazio non è sufficiente: scegli un bagaglio più grande o riduci i giorni di autonomia (lavaggio più frequente).'
                  : 'Trucco da viaggiatore: indossa i capi più ingombranti durante il viaggio.'}
              </p>
            </section>
          )}
          <section className="card space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">🧳 Spazio nel bagaglio</span>
              <span className="tabular-nums">{result.usedL} / {result.capacityL} L</span>
            </div>
            <div className="w-full bg-crema dark:bg-[#141C33] rounded-full h-3" role="progressbar" aria-valuenow={result.usedL} aria-valuemax={result.capacityL} aria-label="Occupazione del bagaglio">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (result.usedL / result.capacityL) * 100)}%`,
                  background: result.usedL > result.capacityL * 0.9 ? '#E14E2E' : result.usedL > result.capacityL * 0.7 ? '#FFC145' : '#3FBF9B',
                }}
              />
            </div>
          </section>
          <section className="card space-y-1 text-sm">
            {result.tips.map((t, i) => <p key={i}>💡 {t}</p>)}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">La tua lista ({done}/{result.items.length})</h2>
              <button className="btn-secondary !min-h-[40px] !py-1.5" onClick={share}>📤 Condividi</button>
            </div>
            <div className="w-full bg-crema dark:bg-[#231913] rounded-full h-2" role="progressbar" aria-valuenow={done} aria-valuemax={result.items.length}>
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
                      {i.custom && <button className="text-xs opacity-60 underline ml-6" onClick={() => removeItem(i.name)}>✕ togli</button>}
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
