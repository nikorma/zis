import type { Lang } from '../types';

/**
 * Multilingua: italiano, inglese, francese, spagnolo, greco.
 * Tradotta l'interfaccia principale (navigazione, Home, menu, benvenuto ospite);
 * le pagine interne arrivano a lotti. Chiave mancante → italiano.
 */
type Dict = Record<string, string>;

const it: Dict = {
  appName: 'Zaino in Spalla', tagline: 'Il tuo compagno di viaggio',
  home: 'Home', itinerary: 'Itinerario', map: 'Mappa', plan: 'Pianifica', more: 'Altro',
  myTrips: 'I miei viaggi', open: 'Apri', opened: 'Aperto', daysW: 'giornate',
  emptyTitle: 'Il tuo prossimo viaggio parte da qui',
  emptyText: 'Crea l\u2019itinerario in un minuto con il planner: verrà salvato qui automaticamente.',
  planTrip: 'Pianifica un viaggio', createManual: 'Crea a mano', group: 'Gruppo',
  groupTrip: 'Viaggio di gruppo', suitcase: 'Valigia', lens: 'Occhio di viaggio',
  letsGo: 'Zaino in spalla, si parte!', gpsOn: 'Attiva GPS', gpsOff: 'Disattiva GPS',
  mLens: '📸 Occhio di viaggio (traduci e riconosci)', mHost: '🏡 Modalità struttura (B&B e host)',
  mSuitcase: '🧳 Valigia intelligente', mGroup: '👥 Gruppo di viaggio (itinerario condiviso)',
  mAssistant: '💬 Chiedi alla guida', mSettings: '⚙️ Impostazioni',
  mAdmin: '🔐 Pannello amministrativo', mPrivacy: '🛡️ Privacy e dati',
  language: 'Lingua dell\u2019interfaccia',
  langNote: 'Tradotta l\u2019interfaccia principale; le pagine interne arrivano nelle prossime versioni.',
  welcomeBy: 'Un benvenuto da', wHello: 'Ciao', wPrepared: 'Ti abbiamo preparato l\u2019itinerario per il tuo soggiorno',
  wFrom: 'dal', wTo: 'al', wRests: 'ristoranti consigliati', wOpen: 'Apri il mio itinerario',
  wInstall: 'Consiglio: dal menu del browser scegli "Aggiungi a schermata Home" per installare l\u2019app.',
  wLoading: 'Apro il tuo soggiorno…', wNotFound: 'Soggiorno non trovato',
  wNotFoundText: 'Il link potrebbe essere scaduto o incompleto: chiedi alla struttura di rimandartelo.',
  wGoApp: 'Vai all\u2019app',
};

const en: Dict = {
  appName: 'Zaino in Spalla', tagline: 'Your travel companion',
  home: 'Home', itinerary: 'Itinerary', map: 'Map', plan: 'Plan', more: 'More',
  myTrips: 'My trips', open: 'Open', opened: 'Open now', daysW: 'days',
  emptyTitle: 'Your next trip starts here',
  emptyText: 'Build your itinerary in a minute with the planner: it will be saved here automatically.',
  planTrip: 'Plan a trip', createManual: 'Build by hand', group: 'Group',
  groupTrip: 'Group trip', suitcase: 'Suitcase', lens: 'Travel Eye',
  letsGo: 'Pack up, let\u2019s go!', gpsOn: 'Enable GPS', gpsOff: 'Disable GPS',
  mLens: '📸 Travel Eye (translate & identify)', mHost: '🏡 Host mode (B&B)',
  mSuitcase: '🧳 Smart suitcase', mGroup: '👥 Group trip (shared itinerary)',
  mAssistant: '💬 Ask the guide', mSettings: '⚙️ Settings',
  mAdmin: '🔐 Admin panel', mPrivacy: '🛡️ Privacy & data',
  language: 'Interface language',
  langNote: 'Main interface translated; inner pages coming in the next versions.',
  welcomeBy: 'A welcome from', wHello: 'Hi', wPrepared: 'We prepared your stay itinerary for you',
  wFrom: 'from', wTo: 'to', wRests: 'recommended restaurants', wOpen: 'Open my itinerary',
  wInstall: 'Tip: use "Add to Home screen" in your browser menu to install the app.',
  wLoading: 'Opening your stay…', wNotFound: 'Stay not found',
  wNotFoundText: 'The link may be expired or incomplete: ask your host to send it again.',
  wGoApp: 'Go to the app',
};

const fr: Dict = {
  appName: 'Zaino in Spalla', tagline: 'Ton compagnon de voyage',
  home: 'Accueil', itinerary: 'Itinéraire', map: 'Carte', plan: 'Planifier', more: 'Plus',
  myTrips: 'Mes voyages', open: 'Ouvrir', opened: 'Ouvert', daysW: 'journées',
  emptyTitle: 'Ton prochain voyage commence ici',
  emptyText: 'Crée ton itinéraire en une minute avec le planificateur : il sera enregistré ici automatiquement.',
  planTrip: 'Planifier un voyage', createManual: 'Créer à la main', group: 'Groupe',
  groupTrip: 'Voyage de groupe', suitcase: 'Valise', lens: 'Œil de voyage',
  letsGo: 'Sac au dos, c\u2019est parti !', gpsOn: 'Activer le GPS', gpsOff: 'Désactiver le GPS',
  mLens: '📸 Œil de voyage (traduire et reconnaître)', mHost: '🏡 Mode hébergeur (B&B)',
  mSuitcase: '🧳 Valise intelligente', mGroup: '👥 Voyage de groupe (itinéraire partagé)',
  mAssistant: '💬 Demande au guide', mSettings: '⚙️ Réglages',
  mAdmin: '🔐 Panneau admin', mPrivacy: '🛡️ Confidentialité',
  language: 'Langue de l\u2019interface',
  langNote: 'Interface principale traduite ; les pages internes arrivent dans les prochaines versions.',
  welcomeBy: 'Bienvenue de la part de', wHello: 'Bonjour', wPrepared: 'Nous avons préparé l\u2019itinéraire de ton séjour',
  wFrom: 'du', wTo: 'au', wRests: 'restaurants recommandés', wOpen: 'Ouvrir mon itinéraire',
  wInstall: 'Astuce : dans le menu du navigateur, choisis « Ajouter à l\u2019écran d\u2019accueil ».',
  wLoading: 'Ouverture de ton séjour…', wNotFound: 'Séjour introuvable',
  wNotFoundText: 'Le lien est peut-être expiré ou incomplet : demande à ton hôte de le renvoyer.',
  wGoApp: 'Aller à l\u2019app',
};

const es: Dict = {
  appName: 'Zaino in Spalla', tagline: 'Tu compañero de viaje',
  home: 'Inicio', itinerary: 'Itinerario', map: 'Mapa', plan: 'Planificar', more: 'Más',
  myTrips: 'Mis viajes', open: 'Abrir', opened: 'Abierto', daysW: 'días',
  emptyTitle: 'Tu próximo viaje empieza aquí',
  emptyText: 'Crea tu itinerario en un minuto con el planificador: se guardará aquí automáticamente.',
  planTrip: 'Planificar un viaje', createManual: 'Crear a mano', group: 'Grupo',
  groupTrip: 'Viaje en grupo', suitcase: 'Maleta', lens: 'Ojo viajero',
  letsGo: '¡Mochila al hombro, en marcha!', gpsOn: 'Activar GPS', gpsOff: 'Desactivar GPS',
  mLens: '📸 Ojo viajero (traducir y reconocer)', mHost: '🏡 Modo anfitrión (B&B)',
  mSuitcase: '🧳 Maleta inteligente', mGroup: '👥 Viaje en grupo (itinerario compartido)',
  mAssistant: '💬 Pregunta al guía', mSettings: '⚙️ Ajustes',
  mAdmin: '🔐 Panel de administración', mPrivacy: '🛡️ Privacidad',
  language: 'Idioma de la interfaz',
  langNote: 'Interfaz principal traducida; las páginas internas llegan en próximas versiones.',
  welcomeBy: 'Una bienvenida de', wHello: 'Hola', wPrepared: 'Te hemos preparado el itinerario de tu estancia',
  wFrom: 'del', wTo: 'al', wRests: 'restaurantes recomendados', wOpen: 'Abrir mi itinerario',
  wInstall: 'Consejo: en el menú del navegador elige «Añadir a pantalla de inicio».',
  wLoading: 'Abriendo tu estancia…', wNotFound: 'Estancia no encontrada',
  wNotFoundText: 'El enlace puede haber caducado: pide a tu anfitrión que lo reenvíe.',
  wGoApp: 'Ir a la app',
};

const el: Dict = {
  appName: 'Zaino in Spalla', tagline: 'Ο ταξιδιωτικός σου σύντροφος',
  home: 'Αρχική', itinerary: 'Πρόγραμμα', map: 'Χάρτης', plan: 'Σχεδίασε', more: 'Άλλα',
  myTrips: 'Τα ταξίδια μου', open: 'Άνοιγμα', opened: 'Ανοιχτό', daysW: 'ημέρες',
  emptyTitle: 'Το επόμενο ταξίδι σου ξεκινά εδώ',
  emptyText: 'Φτιάξε το πρόγραμμά σου σε ένα λεπτό με τον σχεδιαστή: θα αποθηκευτεί εδώ αυτόματα.',
  planTrip: 'Σχεδίασε ένα ταξίδι', createManual: 'Φτιάξ\u2019 το μόνος σου', group: 'Ομάδα',
  groupTrip: 'Ομαδικό ταξίδι', suitcase: 'Βαλίτσα', lens: 'Ταξιδιωτικό μάτι',
  letsGo: 'Σακίδιο στην πλάτη, πάμε!', gpsOn: 'Ενεργοποίηση GPS', gpsOff: 'Απενεργοποίηση GPS',
  mLens: '📸 Ταξιδιωτικό μάτι (μετάφραση και αναγνώριση)', mHost: '🏡 Λειτουργία οικοδεσπότη (B&B)',
  mSuitcase: '🧳 Έξυπνη βαλίτσα', mGroup: '👥 Ομαδικό ταξίδι (κοινό πρόγραμμα)',
  mAssistant: '💬 Ρώτα τον οδηγό', mSettings: '⚙️ Ρυθμίσεις',
  mAdmin: '🔐 Πίνακας διαχείρισης', mPrivacy: '🛡️ Απόρρητο',
  language: 'Γλώσσα εφαρμογής',
  langNote: 'Μεταφρασμένο το βασικό περιβάλλον· οι εσωτερικές σελίδες έρχονται στις επόμενες εκδόσεις.',
  welcomeBy: 'Καλωσόρισμα από', wHello: 'Γεια σου', wPrepared: 'Σου ετοιμάσαμε το πρόγραμμα της διαμονής σου',
  wFrom: 'από', wTo: 'έως', wRests: 'προτεινόμενα εστιατόρια', wOpen: 'Άνοιξε το πρόγραμμά μου',
  wInstall: 'Συμβουλή: από το μενού του browser επίλεξε «Προσθήκη στην αρχική οθόνη».',
  wLoading: 'Ανοίγω τη διαμονή σου…', wNotFound: 'Η διαμονή δεν βρέθηκε',
  wNotFoundText: 'Ο σύνδεσμος ίσως έληξε: ζήτησε από τον οικοδεσπότη να τον ξαναστείλει.',
  wGoApp: 'Μετάβαση στην εφαρμογή',
};

const dicts: Record<Lang, Dict> = { it, en, fr, es, el };

export function t(key: string, lang: Lang = 'it'): string {
  return dicts[lang]?.[key] ?? it[key] ?? key;
}

export const LANG_NAMES: Record<Lang, string> = {
  it: '🇮🇹 Italiano', en: '🇬🇧 English', fr: '🇫🇷 Français', es: '🇪🇸 Español', el: '🇬🇷 Ελληνικά',
};

export const LANG_LOCALE: Record<Lang, string> = {
  it: 'it-IT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', el: 'el-GR',
};
