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

export interface GroupInfo { id: string; name: string; code: string; createdBy: string }

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

export async function createGroup(name: string): Promise<GroupInfo> {
  const d = ensure();
  const user = await ensureUser();
  const code = makeCode();
  const ref = await addDoc(collection(d, 'groups'), {
    name: name.trim() || 'Il nostro viaggio',
    code,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });
  saveGroupId(ref.id);
  return { id: ref.id, name, code, createdBy: user.uid };
}

export async function joinGroup(code: string): Promise<GroupInfo> {
  const d = ensure();
  await ensureUser();
  const q = query(collection(d, 'groups'), where('code', '==', code.trim().toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Codice non trovato: controlla maiuscole e trattino (es. ZIS-A2B3C).');
  const g = snap.docs[0];
  saveGroupId(g.id);
  const data = g.data();
  return { id: g.id, name: data.name, code: data.code, createdBy: data.createdBy };
}

export function leaveGroup() { saveGroupId(null); }

export function subscribeGroup(
  groupId: string,
  onGroup: (g: GroupInfo | null) => void,
  onStops: (s: GroupStop[]) => void,
  onRequests: (r: ChangeRequest[]) => void
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
  return () => { offG(); offS(); offR(); };
}

// ---------- Tappe ----------

/**
 * Genera la presentazione "da guida" per una nuova tappa.
 * Prova /api/ai; se non disponibile usa un testo-modello dignitoso
 * (sempre modificabile a mano dal proprietario).
 */
export async function generatePresentation(title: string, notes?: string): Promise<string> {
  const fallback =
    `${title}. Questa tappa è stata aggiunta all'itinerario di gruppo` +
    `${notes ? ` con questa nota: ${notes}.` : '.'} ` +
    'Quando arrivate, prendetevi un momento per guardarvi intorno: in viaggio anche gli angoli fuori programma ' +
    'hanno sempre qualcosa da raccontare — un dettaglio su una porta, un cortile, un profumo nuovo. ' +
    'Il proprietario della tappa può sostituire questo testo con una presentazione personalizzata.';
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question:
          `Scrivi una presentazione da audioguida (120-160 parole, tono caldo, in italiano, seconda persona plurale) ` +
          `per questa tappa di un viaggio di gruppo: "${title}"` +
          (notes ? ` — nota di chi l'ha proposta: ${notes}` : '') +
          `. Se è un luogo che non conosci con certezza, resta generico e non inventare orari, prezzi o dettagli storici. Se citi l'app, chiamala \"ZainoInSpalla\".`,
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
  await addDoc(collection(d, 'groups', groupId, 'stops'), {
    ...stop,
    presentation,
    ownerId: user.uid,
    ownerName: getDisplayName() || 'Senza nome',
    createdAt: serverTimestamp(),
  });
}

/** Modifica diretta: consentita SOLO al proprietario (la UI la mostra solo a lui). */
export async function updateOwnStop(groupId: string, stopId: string, patch: Partial<GroupStop>): Promise<void> {
  const d = ensure();
  const { id: _i, ownerId: _o, ownerName: _n, ...safe } = patch as GroupStop;
  await updateDoc(doc(d, 'groups', groupId, 'stops', stopId), safe as Record<string, unknown>);
}

export async function deleteOwnStop(groupId: string, stopId: string): Promise<void> {
  const d = ensure();
  await deleteDoc(doc(d, 'groups', groupId, 'stops', stopId));
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
  await addDoc(collection(d, 'groups', groupId, 'requests'), {
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
  });
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
      await updateDoc(doc(d, 'groups', groupId, 'stops', req.stopId), req.patch as Record<string, unknown>);
    }
  }
  await setDoc(doc(d, 'groups', groupId, 'requests', req.id), { status: approve ? 'approvata' : 'rifiutata' }, { merge: true });
}
