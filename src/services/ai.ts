import type { AiUsageEntry, AppData } from '../types';

/**
 * Client per "Chiedi alla guida".
 * Le chiamate passano SOLO da /api/ai (funzione serverless che protegge il token).
 * Il frontend applica in più: cache locale delle risposte, conteggio richieste,
 * limite giornaliero configurabile e registro errori.
 */

export const DEFAULT_DAILY_REQUEST_LIMIT = 80;

export function cacheKey(question: string, context: string): string {
  return `${context}::${question.trim().toLowerCase()}`;
}

export function requestsToday(usage: AiUsageEntry[], now = Date.now()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return usage.filter((u) => u.ts >= start.getTime()).length;
}

export function tokensUsed(usage: AiUsageEntry[]): { prompt: number; completion: number } {
  return usage.reduce(
    (acc, u) => ({ prompt: acc.prompt + u.promptTokens, completion: acc.completion + u.completionTokens }),
    { prompt: 0, completion: 0 }
  );
}

/** Stima molto indicativa del costo (modello economico ~0.15/0.60 $ per 1M token). */
export function estimatedCostUsd(usage: AiUsageEntry[]): number {
  const t = tokensUsed(usage);
  return (t.prompt * 0.15 + t.completion * 0.6) / 1_000_000;
}

export type AskResult =
  | { ok: true; answer: string; cached: boolean }
  | { ok: false; error: string };

export async function askGuide(
  question: string,
  context: string,
  data: AppData,
  update: (patch: Partial<AppData>) => void,
  dailyLimit = DEFAULT_DAILY_REQUEST_LIMIT
): Promise<AskResult> {
  const key = cacheKey(question, context);
  const hit = data.aiCache[key];
  if (hit) {
    update({ aiUsage: [...data.aiUsage, { ts: Date.now(), promptTokens: 0, completionTokens: 0, cached: true, ok: true }] });
    return { ok: true, answer: hit.answer, cached: true };
  }
  if (requestsToday(data.aiUsage) >= dailyLimit) {
    return { ok: false, error: `Limite giornaliero di ${dailyLimit} richieste raggiunto. Riprova domani o alza il limite nel pannello admin.` };
  }
  if (!navigator.onLine) {
    return { ok: false, error: 'Sei offline: l\u2019assistente richiede internet. Le schede dei luoghi restano disponibili offline.' };
  }
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context }),
    });
    if (!res.ok) {
      const msg = res.status === 429
        ? 'Troppe richieste: il server ha applicato il limite. Attendi qualche minuto.'
        : `Il servizio IA non è raggiungibile (errore ${res.status}). Verifica di aver configurato OPENAI_API_KEY e pubblicato le funzioni /api.`;
      update({ aiUsage: [...data.aiUsage, { ts: Date.now(), promptTokens: 0, completionTokens: 0, cached: false, ok: false, error: msg }] });
      return { ok: false, error: msg };
    }
    const json = await res.json();
    const answer: string = json.answer ?? '';
    const entry: AiUsageEntry = {
      ts: Date.now(),
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      cached: false,
      ok: true,
    };
    update({
      aiUsage: [...data.aiUsage, entry],
      aiCache: { ...data.aiCache, [key]: { answer, ts: Date.now() } },
    });
    return { ok: true, answer, cached: false };
  } catch {
    const msg = 'Connessione al servizio IA non riuscita. In sviluppo locale l\u2019endpoint /api/ai è disponibile solo dopo la pubblicazione (vedi README).';
    update({ aiUsage: [...data.aiUsage, { ts: Date.now(), promptTokens: 0, completionTokens: 0, cached: false, ok: false, error: msg }] });
    return { ok: false, error: msg };
  }
}
