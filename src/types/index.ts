// ============================================================
// Tipi centrali dell'app "viaggio – Guida personale di Nikos"
// ============================================================

export type LatLng = { lat: number; lng: number };

export type Lang = 'it' | 'en' | 'fr' | 'es' | 'el';

/** Informazione variabile con tracciabilità della fonte (mai inventata). */
export interface VerifiableInfo {
  value: string;
  /** Data ultimo aggiornamento in formato ISO (YYYY-MM-DD). */
  updatedAt: string;
  /** Nome della fonte, es. "Sito ufficiale Real Alcázar". */
  source: string;
  /** Link ufficiale. */
  url?: string;
  /** true quando il dato NON è stato confermato di recente. */
  toVerify: boolean;
}

export interface TransitHint {
  walkMinutes?: number;
  bikeMinutes?: number;
  transitMinutes?: number;
  line?: string;        // es. "Tram T1", "Bus C5"
  fromStop?: string;
  toStop?: string;
  changes?: string;     // eventuali cambi
  costNote?: string;    // costo indicativo (testuale, con "da verificare")
}

export interface InternalGuidePoint {
  order: number;
  id: string;
  name: string;               // nome della sala o area
  short: string;              // descrizione breve
  long: string;               // spiegazione approfondita (testo audioguida 2–4 min)
  lookFor: string[];          // cosa guardare
  direction?: string;         // "guarda a destra", "guarda in alto", "prosegui davanti"
  imageHint?: string;         // descrizione di foto/illustrazione da caricare
  audioMinutes: number;       // durata stimata dell'audio
}

export interface PlacePracticalInfo {
  accessibility?: string;
  toilets?: string;
  fountains?: string;
  stairs?: string;
  shade?: string;
  clothing?: string;
  photoRules?: string;
  photoSpots?: string[];
  augustTips?: string;
  nearbyTapas?: string[];   // id dei locali tapas
  nearbyStops?: string[];   // fermate mezzi vicine
}

export interface Place {
  id: string;
  name: string;
  category: 'monumento' | 'piazza' | 'quartiere' | 'museo' | 'mercato' | 'parco' | 'chiesa' | 'panorama' | 'via';
  address: string;
  coords: LatLng;
  photoHint: string;           // descrizione dell'immagine da caricare in admin
  intro: string;               // breve introduzione
  description: string;         // descrizione approfondita
  history?: string;
  builtPeriod?: string;
  people?: string[];           // personaggi collegati
  style?: string;              // stile architettonico
  originalUse?: string;
  currentUse?: string;
  curiosities?: string[];
  legends?: string[];
  whatToSee?: string[];
  dontMiss?: string[];
  suggestedMinutes?: number;
  bestTime?: string;
  cost?: VerifiableInfo;       // costo: sempre verificabile, mai inventato
  hours?: VerifiableInfo;      // orari: sempre verificabili
  officialSite?: string;
  ticketUrl?: string;
  practical?: PlacePracticalInfo;
  hasInternalGuide?: boolean;
  paid?: boolean;              // attrazione a pagamento
}

export interface Stop {
  id: string;
  placeId?: string;            // collegamento alla scheda luogo (se esiste)
  title: string;
  time?: string;               // orario consigliato "HH:MM"
  durationMinutes?: number;
  description?: string;
  cost?: string;
  coords?: LatLng;
  address?: string;
  officialSite?: string;
  ticketUrl?: string;
  phone?: string;              // telefono (utile per ristoranti)
  notes?: string;
  presentation?: string;       // presentazione "da guida" (generata o scritta a mano)
  paid?: boolean;              // richiede biglietto? (true/false; assente = non noto)
  interiorGuide?: { name: string; text: string }[]; // guida interna punto per punto
  visited: boolean;
  transit?: TransitHint;       // spostamento DALLA tappa precedente
}

export interface Trip {
  id: string;
  name: string;
  destination?: string;
  days: Day[];
  createdAt: string;
  groupId?: string;            // 🔗 se presente: specchio del Gruppo di viaggio
}

export interface Day {
  id: string;
  date: string;                // "YYYY-MM-DD"
  title: string;
  stops: Stop[];
}

export interface TicketState {
  placeId: string;
  status: 'da-acquistare' | 'acquistato';
  purchaseDate?: string;
  timeSlot?: string;
  bookingCode?: string;
  notes?: string;
  attachmentDataUrl?: string;  // foto/conferma del biglietto (base64)
  attachmentName?: string;
}


export interface Settings {
  theme: 'light' | 'dark' | 'auto';
  lang: Lang;
  arrivalRadiusMeters: number;    // 40–100
  voiceGender: 'femminile' | 'maschile';
  voiceRate: number;              // 0.5–1.5
  voiceVolume: number;            // 0–1
  autoplayAudio: boolean;
  autoplayConsentGiven: boolean;
  notificationsConsent: boolean;
  geoConsent: boolean;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  ttsMode: 'natural' | 'offline' | 'webspeech';
}

export interface AiUsageEntry {
  ts: number;
  promptTokens: number;
  completionTokens: number;
  cached: boolean;
  ok: boolean;
  error?: string;
}

export interface AppData {
  version: number;
  days: Day[];                     // itinerario ATTIVO (specchio del viaggio aperto)
  trips: Trip[];                   // tutti i viaggi salvati
  activeTripId?: string;
  tickets: Record<string, TicketState>;
  favorites: string[];             // placeId preferiti
  settings: Settings;
  completedGuidePoints: Record<string, string[]>; // placeId -> point ids
  aiUsage: AiUsageEntry[];
  aiCache: Record<string, { answer: string; ts: number }>;
  downloadedAudio: string[];       // chiavi audio salvate in IndexedDB
}
