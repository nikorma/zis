/**
 * Base per le chiamate alle funzioni serverless.
 *
 * - Nel browser / PWA: stringa vuota → le chiamate restano relative ("/api/…")
 *   e vanno sullo stesso dominio (Vercel), come sempre.
 * - Nell'app nativa (Capacitor): la pagina è servita da dentro l'app
 *   (protocollo capacitor:// o file://), quindi "/api/…" non esisterebbe.
 *   Puntiamo esplicitamente al dominio pubblico su Vercel.
 */
const PUBLIC_API = 'https://zis-omega.vercel.app';

function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  const proto = window.location.protocol;
  // Capacitor usa capacitor:// (Android) o ionic://; file:// per pacchetti locali
  return proto === 'capacitor:' || proto === 'ionic:' || proto === 'file:';
}

/** Anteponi questa a ogni percorso "/api/…". */
export const apiBase: string = isNative() ? PUBLIC_API : '';

/** Comodo: apiUrl('/api/planner') → giusto sia su web che su app nativa. */
export function apiUrl(path: string): string {
  return apiBase + path;
}
