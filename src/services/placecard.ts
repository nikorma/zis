import { apiUrl } from '../lib/api';
import type { PlaceCard } from '../types';

export async function generatePlaceCard(
  title: string, address?: string, city?: string, lang: string = 'it'
): Promise<{ ok: true; card: PlaceCard } | { ok: false; error: string }> {
  try {
    const month = new Date().toLocaleDateString('it-IT', { month: 'long' });
    const res = await fetch(apiUrl('/api/place'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, address, city, month, lang }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: j.error?.includes('non configurato')
        ? 'La scheda dettagliata richiede il backend AI: aggiungi OPENAI_API_KEY su Vercel (vedi README).'
        : (j.error || 'Generazione non riuscita: riprova.') };
    }
    if (!j.summary) return { ok: false, error: 'Scheda vuota: riprova.' };
    return { ok: true, card: j as PlaceCard };
  } catch {
    return { ok: false, error: 'Connessione assente: riprova quando sei online.' };
  }
}
