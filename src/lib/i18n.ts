import type { Lang } from '../types';

/**
 * Struttura multilingua: l'italiano è completo; spagnolo, inglese e greco
 * hanno le chiavi principali e ricadono sull'italiano per quelle mancanti.
 */
type Dict = Record<string, string>;

const it: Dict = {
  appName: 'viaggio – Guida personale di Nikos',
  home: 'Home',
  itinerary: 'Itinerario',
  map: 'Mappa',
  tickets: 'Biglietti',
  audio: 'Audioguida',
  tapas: 'Tapas',
  assistant: 'Chiedi alla guida',
  settings: 'Impostazioni',
  admin: 'Admin',
  startDay: 'Inizia giornata',
  openItinerary: 'Apri itinerario',
  enableGps: 'Attiva geolocalizzazione',
  listenAudio: 'Ascolta audioguida',
  nextStop: 'Prossima tappa',
  distance: 'Distanza',
  suggestedTime: 'Orario consigliato',
  temperature: 'Temperatura',
  ticketStatus: 'Stato biglietto',
  toBuy: 'Da acquistare',
  bought: 'Acquistato',
  arrivedAt: 'Sei arrivato alla destinazione:',
  visited: 'Visitata',
  markVisited: 'Segna come visitata',
  takeMeThere: 'Portami qui',
  buyTicket: 'Acquista biglietto',
  offlineAvailable: 'Disponibile offline',
  needsInternet: 'Richiede internet',
};

const es: Dict = {
  appName: 'Zaino in Spalla',
  home: 'Inicio', itinerary: 'Itinerario', map: 'Mapa', tickets: 'Entradas',
  audio: 'Audioguía', tapas: 'Tapas', assistant: 'Pregunta a la guía',
  settings: 'Ajustes', startDay: 'Empezar el día', nextStop: 'Próxima parada',
  arrivedAt: 'Has llegado al destino:',
};

const en: Dict = {
  appName: 'Zaino in Spalla',
  home: 'Home', itinerary: 'Itinerary', map: 'Map', tickets: 'Tickets',
  audio: 'Audio guide', tapas: 'Tapas', assistant: 'Ask the guide',
  settings: 'Settings', startDay: 'Start the day', nextStop: 'Next stop',
  arrivedAt: 'You have arrived at:',
};

const el: Dict = {
  appName: 'Σεβίλλη – Προσωπικός οδηγός του Νίκου',
  home: 'Αρχική', itinerary: 'Πρόγραμμα', map: 'Χάρτης', tickets: 'Εισιτήρια',
  audio: 'Ηχητικός οδηγός', tapas: 'Τάπας', assistant: 'Ρώτα τον οδηγό',
  settings: 'Ρυθμίσεις', startDay: 'Ξεκίνα τη μέρα', nextStop: 'Επόμενη στάση',
  arrivedAt: 'Έφτασες στον προορισμό:',
};

const dicts: Record<Lang, Dict> = { it, es, en, el };

export function t(key: string, lang: Lang = 'it'): string {
  return dicts[lang]?.[key] ?? it[key] ?? key;
}

export const LANG_NAMES: Record<Lang, string> = {
  it: 'Italiano', es: 'Español', en: 'English', el: 'Ελληνικά',
};
