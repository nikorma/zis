import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configurazione dell'app nativa "Zaino in Spalla".
 *
 * MODALITÀ 1 — File dentro l'app (predefinita, OBBLIGATORIA per il Play Store)
 *   I file di dist/ vengono copiati dentro l'APK: l'app funziona anche senza rete
 *   al primo avvio. Per aggiornare i contenuti serve ricompilare (lo fa GitHub Actions).
 *
 * MODALITÀ 2 — "Guscio" dal vivo (solo per prove tra amici, NON per lo Store)
 *   Togli il commento al blocco `server` qui sotto: l'app carica sempre l'ultima
 *   versione pubblicata su Vercel, quindi si aggiorna da sola come la PWA.
 *   ⚠️ Google Play rifiuta le app che sono solo un contenitore di un sito web.
 */
const config: CapacitorConfig = {
  appId: 'app.zainoinspalla',
  appName: 'Zaino in Spalla',
  webDir: 'dist',

  // MODALITÀ 2 — decommenta per il guscio dal vivo:
  // server: {
  //   url: 'https://zis-omega.vercel.app',
  //   cleartext: false,
  // },

  android: {
    backgroundColor: '#1E2A4A',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#1E2A4A',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#FF6B4A',
    },
  },
};

export default config;
