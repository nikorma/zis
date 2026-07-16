import type { AppData, Settings } from '../types';

const KEY = 'zaino-v1';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  lang: 'it',
  arrivalRadiusMeters: 60,
  voiceGender: 'femminile',
  voiceRate: 1,
  voiceVolume: 1,
  autoplayAudio: false,
  autoplayConsentGiven: false,
  notificationsConsent: false,
  geoConsent: false,
  largeText: false,
  highContrast: false,
  reducedMotion: false,
  ttsMode: 'webspeech',
};

export function emptyData(): AppData {
  return {
    version: 1,
    days: [],
    trips: [],
    activeTripId: undefined,
    tickets: {},
    favorites: [],
    settings: { ...DEFAULT_SETTINGS },
    completedGuidePoints: {},
    aiUsage: [],
    aiCache: {},
    downloadedAudio: [],
  };
}

export function loadData(): AppData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppData;
    return migrate(parsed);
  } catch {
    return null;
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Salvataggio non riuscito (spazio esaurito?)', e);
  }
}

export function clearAllData(): void {
  localStorage.removeItem(KEY);
}

/** Migrazione versioni future dei dati. */
export function migrate(data: AppData): AppData {
  const base = emptyData();
  return {
    ...base,
    ...data,
    settings: { ...base.settings, ...(data.settings ?? {}) },
    version: 1,
  };
}

// ---------- Esportazione / importazione JSON ----------

export function exportJson(data: AppData): string {
  return JSON.stringify(
    { app: 'zaino-in-spalla', exportedAt: new Date().toISOString(), data },
    null,
    2
  );
}

export type ImportResult =
  | { ok: true; data: AppData }
  | { ok: false; error: string };

export function importJson(text: string): ImportResult {
  try {
    const parsed = JSON.parse(text);
    const payload = parsed?.data ?? parsed;
    if (!payload || !Array.isArray(payload.days)) {
      return { ok: false, error: 'File non valido: manca l\u2019itinerario (days).' };
    }
    return { ok: true, data: migrate(payload as AppData) };
  } catch {
    return { ok: false, error: 'Il file non è un JSON valido.' };
  }
}

/**
 * Gestione conflitti semplice per la sincronizzazione manuale:
 * vince il dato con più tappe visitate + biglietti acquistati; a parità, il locale.
 * Preferiti e audio scaricati vengono comunque UNITI (mai persi).
 */
export function resolveConflict(local: AppData, remote: AppData): AppData {
  const score = (d: AppData) =>
    d.days.reduce((n, day) => n + day.stops.filter((s) => s.visited).length, 0) +
    Object.values(d.tickets).filter((t) => t.status === 'acquistato').length;
  const winner = score(remote) > score(local) ? remote : local;
  return {
    ...winner,
    favorites: Array.from(new Set([...local.favorites, ...remote.favorites])),
    downloadedAudio: Array.from(new Set([...local.downloadedAudio, ...remote.downloadedAudio])),
  };
}

// ---------- IndexedDB per audio scaricati ----------

const DB_NAME = 'zaino-audio';
const STORE = 'audio';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudio(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAudio(key: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAudio(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
