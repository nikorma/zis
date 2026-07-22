/** Versione dell'app, generata alla compilazione (vedi vite.config.ts). */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'V—';
export const BUILD_DATE: string = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';

/** Data di creazione leggibile: "22/07/2026 alle 12:36". */
export function buildDateLabel(): string {
  if (!BUILD_DATE) return '';
  const d = new Date(BUILD_DATE);
  return `${d.toLocaleDateString('it-IT')} alle ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
}
