/**
 * ============================================================
 * CONFIGURAZIONE FIREBASE — DA COMPILARE (solo per il Gruppo di viaggio)
 * ============================================================
 * 1. Vai su https://console.firebase.google.com → "Aggiungi progetto"
 *    (nome libero, es. "zaino-gruppo"; Analytics: NO)
 * 2. Nella pagina del progetto: icona </>  ("Web") → registra l'app
 *    → copia l'oggetto firebaseConfig che ti mostra e INCOLLALO qui sotto
 * 3. Menu "Authentication" → Inizia → scheda "Sign-in method"
 *    → abilita "Anonimo"
 * 4. Menu "Firestore Database" → Crea database → modalità PRODUZIONE
 *    → scheda "Regole" → incolla le regole che trovi nel README
 *    (sezione "Gruppo di viaggio") → Pubblica
 * 5. Ricarica i file su GitHub: Vercel ripubblica da solo.
 *
 * Nota: questa configurazione NON è un segreto (identifica solo il
 * progetto); la sicurezza la fanno le regole Firestore.
 */
/**
 * ⭐ MODO CONSIGLIATO (non si perde mai): metti i valori nelle
 * "Environment Variables" di Vercel, una volta sola:
 *   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
 *   VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
 * Così, quando ricarichi i file del progetto, la configurazione resta intatta.
 *
 * In alternativa (o come riserva) puoi scriverli qui sotto al posto di INCOLLA-QUI.
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const fromEnv = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const fromFile = {
  apiKey: 'INCOLLA-QUI',
  authDomain: 'INCOLLA-QUI.firebaseapp.com',
  projectId: 'INCOLLA-QUI',
  storageBucket: 'INCOLLA-QUI.appspot.com',
  messagingSenderId: 'INCOLLA-QUI',
  appId: 'INCOLLA-QUI',
};

export const firebaseConfig = fromEnv.apiKey ? (fromEnv as typeof fromFile) : fromFile;

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey) && !firebaseConfig.apiKey.includes('INCOLLA');
