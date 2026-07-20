/**
 * Gruppo di viaggio — itinerario CONDIVISO (separato da quello personale).
 *
 * Modello dati (Firestore):
 *   groups/{gid}                 { name, code, createdBy, createdAt }
 *   groups/{gid}/stops/{sid}     tappa condivisa con ownerId/ownerName
 *   groups/{gid}/requests/{rid}  richieste di modifica/cancellazione
 *
 * Regole del gioco:
 *   - tutti i membri vedono tutto in tempo reale;
 *   - ognuno aggiunge tappe liberamente (con presentazione generata);
 *   - modificare/cancellare la tappa di un altro → parte una RICHIESTA
 *     che solo il proprietario della tappa può approvare o rifiutare.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDocs,
  query, where, onSnapshot, serverTimestamp, type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from '../firebaseConfig';

// ---------- Tipi ----------

export interface GroupInfo { id: string; name: string; code: string; createdBy: string; startDate?: string; endDate?: string }

export interface GroupStop {
  id: string;
  title: string;
  date: string;          // YYYY-MM-DD
  time?: string;
  address?: string;
  coords?: { lat: number; lng: number };
  notes?: string;
  presentation: string;  // testo "da guida" generato o manuale → è anche l'audioguida
  ownerId: string;
  ownerName: string;
  visited?: boolean;
}

/** Firestore rifiuta i valori undefined: li togliamo prima di ogni scrittura. */
function stripUndef<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
}

export interface Member { id: string; name: string }

export interface Expense {
  id: string;
  desc: string;
  amount: number;          // euro
  payerId: string;
  payerName: string;
  splitWith: string[];     // uid dei partecipanti che dividono (incluso chi ha pagato)
  place?: string;
  createdAt?: unknown;
}

export interface ChangeRequest {
  id: string;
  stopId: string;
  stopTitle: string;
  type: 'modifica' | 'cancellazione';
  reason?: string;
  patch?: Partial<Pick<GroupStop, 'title' | 'date' | 'time' | 'notes' | 'address'>>;
  requesterId: string;
  requesterName: string;
  ownerId: string;       // proprietario della tappa: solo lui decide
  status: 'in-attesa' | 'approvata' | 'rifiutata';
}

// ---------- Init ----------

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function firebaseReady(): boolean { return isFirebaseConfigured; }

function ensure(): Firestore {
  if (!isFirebaseConfigured) throw new Error('Firebase non configurato (vedi src/firebaseConfig.ts).');
  if (!app) { app = initializeApp(firebaseConfig); db = getFirestore(app); }
  return db!;
}

/** Login anonimo: nessuna registrazione, solo un id stabile per dispositivo. */
export function ensureUser(): Promise<User> {
  ensure();
  const auth = getAuth(app!);
  return new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, (u) => {
      if (u) { off(); resolve(u); }
    }, reject);
    if (!auth.currentUser) signInAnonymously(auth).catch(reject);
  });
}

// Nome visibile scelto dall'utente (memoria locale del dispositivo)
const NAME_KEY = 'zaino-display-name';
export function getDisplayName(): string { return localStorage.getItem(NAME_KEY) || ''; }
export function setDisplayName(n: string) { localStorage.setItem(NAME_KEY, n.trim()); }

// Gruppo corrente (memoria locale)
const GROUP_KEY = 'zaino-group-id';
export function getSavedGroupId(): string | null { return localStorage.getItem(GROUP_KEY); }
export function saveGroupId(id: string | null) {
  if (id) localStorage.setItem(GROUP_KEY, id); else localStorage.removeItem(GROUP_KEY);
}

// ---------- Gruppo ----------

function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return `ZIS-${c}`;
}

export async function createGroup(name: string, startDate?: string, endDate?: string): Promise<GroupInfo> {
  const d = ensure();
  const user = await ensureUser();
  const code = makeCode();
  const ref = await addDoc(collection(d, 'groups'), stripUndef({
    name: name.trim() || 'Il nostro viaggio',
    code,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    startDate, endDate,
  }));
  // il creatore è il primo partecipante (serve per la nota spese)
  await setDoc(doc(d, 'groups', ref.id, 'members', user.uid), { name: getDisplayName() || 'Senza nome' });
  saveGroupId(ref.id);
  return { id: ref.id, name, code, createdBy: user.uid, startDate, endDate };
}

export async function joinGroup(code: string): Promise<GroupInfo> {
  const d = ensure();
  await ensureUser();
  const q = query(collection(d, 'groups'), where('code', '==', code.trim().toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Codice non trovato: controlla maiuscole e trattino (es. ZIS-A2B3C).');
  const g = snap.docs[0];
  const me = await ensureUser();
  await setDoc(doc(d, 'groups', g.id, 'members', me.uid), { name: getDisplayName() || 'Senza nome' });
  saveGroupId(g.id);
  const data = g.data();
  return { id: g.id, name: data.name, code: data.code, createdBy: data.createdBy };
}

export function leaveGroup() { saveGroupId(null); }

export function subscribeGroup(
  groupId: string,
  onGroup: (g: GroupInfo | null) => void,
  onStops: (s: GroupStop[]) => void,
  onRequests: (r: ChangeRequest[]) => void,
  onMembers?: (m: Member[]) => void,
  onExpenses?: (e: Expense[]) => void
): () => void {
  const d = ensure();
  const offG = onSnapshot(doc(d, 'groups', groupId), (s) => {
    onGroup(s.exists() ? ({ id: s.id, ...(s.data() as Omit<GroupInfo, 'id'>) }) : null);
  });
  const offS = onSnapshot(collection(d, 'groups', groupId, 'stops'), (snap) => {
    const list = snap.docs.map((x) => ({ id: x.id, ...(x.data() as Omit<GroupStop, 'id'>) }));
    list.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
    onStops(list);
  });
  const offR = onSnapshot(collection(d, 'groups', groupId, 'requests'), (snap) => {
    onRequests(snap.docs.map((x) => ({ id: x.id, ...(x.data() as Omit<ChangeRequest, 'id'>) })));
  });
  const offM = onMembers
    ? onSnapshot(collection(d, 'groups', groupId, 'members'), (snap) => {
        onMembers(snap.docs.map((x) => ({ id: x.id, name: (x.data() as { name?: string }).name || 'Senza nome' })));
      })
    : () => {};
  const offE = onExpenses
    ? onSnapshot(collection(d, 'groups', groupId, 'expenses'), (snap) => {
        const list = snap.docs.map((x) => ({ id: x.id, ...(x.data() as Omit<Expense, 'id'>) }));
        list.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
        onExpenses(list);
      })
    : () => {};
  return () => { offG(); offS(); offR(); offM(); offE(); };
}

// ---------- Tappe ----------

/**
 * Genera la presentazione "da guida" per una nuova tappa.
 * Prova /api/ai; se non disponibile usa un testo-modello dignitoso
 * (sempre modificabile a mano dal proprietario).
 */
export async function generatePresentation(title: string, notes?: string, lang: string = 'it'): Promise<string> {
  const fallback =
    `${title}.` +
    `${notes ? ` ${notes}` : ''} ` +
    '(Presentazione automatica non disponibile in questo momento: tocca 🔄 Rigenera quando sei online per il testo completo da guida.)';
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question:
          `Scrivi una presentazione da audioguida (120-160 parole, tono caldo, in italiano, seconda persona plurale) ` +
          `per questa tappa di un viaggio di gruppo: "${title}"` +
          (notes ? ` — nota di chi l'ha proposta: ${notes}` : '') +
          `. Usa fatti SPECIFICI e VERI (storia, date, cosa guardare) solo se li conosci con certezza; se il luogo non lo conosci bene, dillo apertamente e limita il testo a ciò che è verificabile. MAI inventare. Se citi l'app, chiamala \"ZainoInSpalla\".`,
      }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    return (json.answer as string) || fallback;
  } catch {
    return fallback;
  }
}

export async function addGroupStop(
  groupId: string,
  stop: Omit<GroupStop, 'id' | 'ownerId' | 'ownerName' | 'presentation'>,
  presentation: string
): Promise<void> {
  const d = ensure();
  const user = await ensureUser();
  await addDoc(collection(d, 'groups', groupId, 'stops'), stripUndef({
    ...stop,
    presentation,
    ownerId: user.uid,
    ownerName: getDisplayName() || 'Senza nome',
    createdAt: serverTimestamp(),
  }));
}

/** Modifica diretta: consentita SOLO al proprietario (la UI la mostra solo a lui). */
export async function updateOwnStop(groupId: string, stopId: string, patch: Partial<GroupStop>): Promise<void> {
  const d = ensure();
  const { id: _i, ownerId: _o, ownerName: _n, ...safe } = patch as GroupStop;
  await updateDoc(doc(d, 'groups', groupId, 'stops', stopId), stripUndef(safe as Record<string, unknown>));
}

export async function deleteOwnStop(groupId: string, stopId: string): Promise<void> {
  const d = ensure();
  await deleteDoc(doc(d, 'groups', groupId, 'stops', stopId));
}

// ---------- 🔗 Specchio gruppo → itinerario personale ----------

import type { Day as PersonalDay, Stop as PersonalStop } from '../types';

/**
 * Converte le tappe del gruppo in giornate personali.
 * - id stabili ('g-<idGruppo>') così spunte "visitato", guide interne e biglietti
 *   personali SOPRAVVIVONO a ogni sincronizzazione;
 * - le tappe aggiunte a mano nel viaggio collegato (non del gruppo) vengono mantenute.
 */
export function stopsToDays(groupName: string, stops: GroupStop[], prevDays: PersonalDay[]): PersonalDay[] {
  const prevStops: Record<string, PersonalStop> = {};
  for (const d of prevDays) for (const st of d.stops) prevStops[st.id] = st;

  const byDate: Record<string, GroupStop[]> = {};
  for (const s of stops) (byDate[s.date] ??= []).push(s);
  const dates = new Set<string>([...Object.keys(byDate), ...prevDays.map((d) => d.date)]);

  const days: PersonalDay[] = [...dates].sort().map((date) => {
    const fromGroup: PersonalStop[] = (byDate[date] ?? []).map((g) => {
      const prev = prevStops['g-' + g.id];
      return {
        ...(prev ?? { visited: false }),
        id: 'g-' + g.id,
        title: g.title,
        time: g.time,
        address: g.address,
        coords: g.coords,
        description: g.notes,
        presentation: g.presentation || prev?.presentation,
        visited: prev?.visited ?? false,
      } as PersonalStop;
    });
    const prevDay = prevDays.find((d) => d.date === date);
    const manual = (prevDay?.stops ?? []).filter((st) => !st.id.startsWith('g-'));
    const merged = [...fromGroup, ...manual];
    const withTime = merged.filter((s) => s.time).sort((a, b) => (a.time as string).localeCompare(b.time as string));
    const noTime = merged.filter((s) => !s.time);
    return {
      id: prevDay?.id ?? 'gday-' + date,
      date,
      title: prevDay?.title && !prevDay.title.startsWith('Gruppo') ? prevDay.title : `Gruppo · ${groupName}`,
      stops: [...withTime, ...noTime],
    };
  }).filter((d) => d.stops.length > 0);
  return days;
}

// ---------- 💶 Nota spese di gruppo ----------

/** uid dell'utente corrente (se già autenticato). */
export function getCurrentUid(): string | null {
  try { return app ? getAuth(app).currentUser?.uid ?? null : null; } catch { return null; }
}

export async function addExpense(groupId: string, desc: string, amount: number, splitWith: string[], place?: string): Promise<void> {
  const d = ensure();
  const user = await ensureUser();
  await addDoc(collection(d, 'groups', groupId, 'expenses'), stripUndef({
    desc: desc.trim(), amount: Math.round(amount * 100) / 100,
    payerId: user.uid, payerName: getDisplayName() || 'Senza nome',
    splitWith, place: place ?? '', createdAt: serverTimestamp(),
  }));
}

export async function deleteExpense(groupId: string, exp: Expense): Promise<void> {
  const d = ensure();
  const user = await ensureUser();
  if (user.uid !== exp.payerId) throw new Error('Solo chi ha pagato può eliminare la spesa.');
  await deleteDoc(doc(d, 'groups', groupId, 'expenses', exp.id));
}

/** Saldi: quanto ha anticipato meno la propria quota. Positivo = deve ricevere. */
export function computeBalances(expenses: Expense[], members: Member[]): { member: Member; balance: number }[] {
  const bal: Record<string, number> = {};
  for (const m of members) bal[m.id] = 0;
  for (const e of expenses) {
    const share = e.amount / Math.max(1, e.splitWith.length);
    bal[e.payerId] = (bal[e.payerId] ?? 0) + e.amount;
    for (const uid of e.splitWith) bal[uid] = (bal[uid] ?? 0) - share;
  }
  return members.map((m) => ({ member: m, balance: Math.round((bal[m.id] ?? 0) * 100) / 100 }));
}

/** Suggerimenti "chi paga chi" per pareggiare (algoritmo semplice). */
export function settleUp(balances: { member: Member; balance: number }[]): string[] {
  const creditors = balances.filter((b) => b.balance > 0.005).map((b) => ({ ...b })).sort((a, b) => b.balance - a.balance);
  const debtors = balances.filter((b) => b.balance < -0.005).map((b) => ({ ...b })).sort((a, b) => a.balance - b.balance);
  const out: string[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(-debtors[i].balance, creditors[j].balance);
    out.push(`${debtors[i].member.name} deve dare €${pay.toFixed(2)} a ${creditors[j].member.name}`);
    debtors[i].balance += pay; creditors[j].balance -= pay;
    if (debtors[i].balance > -0.005) i++;
    if (creditors[j].balance < 0.005) j++;
  }
  return out;
}

// ---------- Richieste (per le tappe degli altri) ----------

export async function requestChange(
  groupId: string,
  stop: GroupStop,
  type: ChangeRequest['type'],
  reason?: string,
  patch?: ChangeRequest['patch']
): Promise<void> {
  const d = ensure();
  const user = await ensureUser();
  await addDoc(collection(d, 'groups', groupId, 'requests'), stripUndef({
    stopId: stop.id,
    stopTitle: stop.title,
    type,
    reason: reason ?? '',
    patch: patch ?? null,
    requesterId: user.uid,
    requesterName: getDisplayName() || 'Senza nome',
    ownerId: stop.ownerId,
    status: 'in-attesa',
    createdAt: serverTimestamp(),
  }));
}

/** Solo il proprietario della tappa decide. Se approva, la modifica viene applicata. */
export async function resolveRequest(
  groupId: string,
  req: ChangeRequest,
  approve: boolean
): Promise<void> {
  const d = ensure();
  const user = await ensureUser();
  if (user.uid !== req.ownerId) throw new Error('Solo chi ha creato la tappa può decidere su questa richiesta.');
  if (approve) {
    if (req.type === 'cancellazione') {
      await deleteDoc(doc(d, 'groups', groupId, 'stops', req.stopId));
    } else if (req.patch) {
      await updateDoc(doc(d, 'groups', groupId, 'stops', req.stopId), stripUndef(req.patch as Record<string, unknown>));
    }
  }
  await setDoc(doc(d, 'groups', groupId, 'requests', req.id), { status: approve ? 'approvata' : 'rifiutata' }, { merge: true });
}

// ---------- 🏡 Modalità struttura (B&B): soggiorni preparati per gli ospiti ----------

export interface StayRestaurant { name: string; address?: string; phone?: string; note?: string }

export interface Stay {
  id: string;
  code: string;              // BNB-XXXXX
  structure: string;         // nome della struttura
  guestName: string;
  checkin: string;           // YYYY-MM-DD
  checkout: string;
  days: PersonalDay[];
  restaurants: StayRestaurant[];
}

function makeStayCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return `BNB-${c}`;
}

/** Sposta le date delle giornate in sequenza a partire dal check-in. */
export function shiftDaysTo(days: PersonalDay[], checkin: string): PersonalDay[] {
  const addIso = (iso: string, n: number) => {
    const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  return days.map((d, i) => ({ ...d, date: addIso(checkin, i) }));
}

export async function createStay(
  structure: string, guestName: string, checkin: string, checkout: string,
  days: PersonalDay[], restaurants: StayRestaurant[]
): Promise<Stay> {
  const d = ensure();
  const user = await ensureUser();
  const code = makeStayCode();
  const shifted = shiftDaysTo(days, checkin);
  const ref = await addDoc(collection(d, 'stays'), {
    code,
    structure: structure.trim() || 'La tua struttura',
    guestName: guestName.trim(),
    checkin, checkout,
    daysJson: JSON.stringify(shifted),
    restaurantsJson: JSON.stringify(restaurants),
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, code, structure, guestName, checkin, checkout, days: shifted, restaurants };
}

export async function fetchStayByCode(code: string): Promise<Stay | null> {
  const d = ensure();
  await ensureUser(); // accesso anonimo anche per l'ospite
  const snap = await getDocs(query(collection(d, 'stays'), where('code', '==', code.toUpperCase().trim())));
  if (snap.empty) return null;
  const x = snap.docs[0];
  const v = x.data() as Record<string, unknown>;
  try {
    return {
      id: x.id,
      code: String(v.code),
      structure: String(v.structure ?? 'La struttura'),
      guestName: String(v.guestName ?? ''),
      checkin: String(v.checkin ?? ''),
      checkout: String(v.checkout ?? ''),
      days: JSON.parse(String(v.daysJson ?? '[]')) as PersonalDay[],
      restaurants: JSON.parse(String(v.restaurantsJson ?? '[]')) as StayRestaurant[],
    };
  } catch {
    return null;
  }
}

export async function deleteStay(id: string): Promise<void> {
  const d = ensure();
  await ensureUser();
  await deleteDoc(doc(d, 'stays', id));
}
