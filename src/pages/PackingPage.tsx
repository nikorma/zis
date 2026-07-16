import { useEffect, useState } from 'react';
import {
  buildPackingList, estimateClimate, tripDays,
  type Gender, type Luggage, type Transport, type PackingResult, type PackingInput,
} from '../services/packing';

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

  // ripristina l'ultima lista
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS) || 'null') as Saved | null;
      if (s) { setInput(s.input); setResult(s.result); setChecked(new Set(s.checked)); }
    } catch { /* ignora */ }
  }, []);

  const persist = (inp: PackingInput, res: PackingResult, chk: Set<string>) =>
    localStorage.setItem(LS, JSON.stringify({ input: inp, result: res, checked: [...chk] } satisfies Saved));

  const set = <K extends keyof PackingInput>(k: K, v: PackingInput[K]) => setInput((i) => ({ ...i, [k]: v }));

  const generate = async () => {
    setBusy(true);
    const climate = await estimateClimate(input.destination, input.startDate, input.endDate);
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
        <label className="label">Destinazione<input className="input" placeholder="es. Lisbona, Atene, Oslo…" value={input.destination} onChange={(e) => set('destination', e.target.value)} /></label>
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
            <Chip v={'zaino' as Luggage} cur={input.luggage} on={(l) => set('luggage', l)} label="🎒 Zaino (~32 L)" />
            <Chip v={'bagaglio-a-mano' as Luggage} cur={input.luggage} on={(l) => set('luggage', l)} label="🧳 Bagaglio a mano (~40 L)" />
            <Chip v={'valigia-stiva' as Luggage} cur={input.luggage} on={(l) => set('luggage', l)} label="🛄 Valigia da stiva (~85 L)" />
            <Chip v={'combinato' as Luggage} cur={input.luggage} on={(l) => set('luggage', l)} label="➕ Combinato (~120 L)" />
          </div>
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
          {(result.reductions.length > 0 || result.overCapacity) && (
            <section className={`card border-2 ${result.overCapacity ? 'border-red-500 bg-red-50 dark:bg-red-900/25' : 'border-oro bg-oro-tenue/30 dark:bg-oro/10'} space-y-1`} role="alert">
              <p className="font-display font-bold text-lg">{result.overCapacity ? '🚨 Il bagaglio NON basta!' : '⚠️ Bagaglio pieno: ho ridotto la lista'}</p>
              {result.reductions.length > 0 && (
                <p className="text-sm">Per farci stare tutto ho tolto: <strong>{result.reductions.join(' · ')}</strong>.</p>
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
            {Object.entries(byCat).map(([cat, items]) => (
              <div key={cat} className="card">
                <h3 className="font-display mb-1">{cat}</h3>
                <ul className="space-y-1">
                  {items.map((i) => (
                    <li key={i.name}>
                      <label className={`flex items-start gap-2 cursor-pointer ${checked.has(i.name) ? 'opacity-50 line-through' : ''}`}>
                        <input type="checkbox" className="mt-1" checked={checked.has(i.name)} onChange={() => toggle(i.name)} />
                        <span><strong>{i.qty}×</strong> {i.name}{i.note && <span className="block text-xs opacity-70 no-underline">↳ {i.note}</span>}</span>
                      </label>
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
