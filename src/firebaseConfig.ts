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
export const firebaseConfig = {
  apiKey: 'INCOLLA-QUI',
  authDomain: 'INCOLLA-QUI.firebaseapp.com',
  projectId: 'INCOLLA-QUI',
  storageBucket: 'INCOLLA-QUI.appspot.com',
  messagingSenderId: 'INCOLLA-QUI',
  appId: 'INCOLLA-QUI',
};

export const isFirebaseConfigured = !firebaseConfig.apiKey.includes('INCOLLA');
