/**
 * /api/ai — Funzione serverless (formato Vercel) per "Chiedi alla guida".
 *
 * ⚠️ Questo file NON fa parte della build frontend (tsconfig include solo src/):
 * va pubblicato su Vercel/Netlify Functions. La chiave API vive SOLO qui,
 * nelle variabili d'ambiente del server (mai nel client).
 *
 * Variabili d'ambiente richieste:
 *   OPENAI_API_KEY            chiave del fornitore AI
 *   AI_MAX_REQUESTS_PER_HOUR  es. "20"
 *   AI_DAILY_TOKEN_LIMIT      es. "100000"
 *
 * Protezioni incluse:
 *   - limite richieste per ora per IP (memoria del processo; per produzione
 *     seria usare KV/Upstash, vedi commento sotto);
 *   - limite token giornaliero globale;
 *   - domande fuori tema rifiutate dal system prompt;
 *   - risposta con conteggio token per il monitoraggio lato app.
 */

// Nota: in ambiente Vercel Node 18+ fetch è globale.

const hourlyByIp = new Map(); // ip -> { count, resetTs } — sostituire con KV in produzione
let dailyTokens = { day: '', used: 0 };

const SYSTEM_PROMPT = `Sei "ZainoInSpalla", una guida di viaggio personale esperta di tutto il mondo.
Rispondi a domande su viaggi: storia, arte, monumenti, cultura, gastronomia, consigli pratici, frasi utili nelle lingue locali.
Rispondi in italiano, tono caldo da guida esperta, massimo 250 parole.
Non inventare MAI prezzi, orari o numeri di telefono: se servono, invita a verificare sul sito ufficiale.
Se la domanda non riguarda i viaggi, rifiuta con gentilezza e riporta la conversazione sul viaggio.\nSe parli dell'app che ti ospita, chiamala sempre \"ZainoInSpalla\".`;

export default async function handler(req, res) {
  // CORS per la PWA
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Backend non configurato: manca OPENAI_API_KEY' });

  const maxPerHour = Number(process.env.AI_MAX_REQUESTS_PER_HOUR || 20);
  const dailyLimit = Number(process.env.AI_DAILY_TOKEN_LIMIT || 100000);

  // --- Rate limit per IP (per ora) ---
  const ip = (req.headers['x-forwarded-for'] || 'unknown').toString().split(',')[0].trim();
  const now = Date.now();
  const slot = hourlyByIp.get(ip);
  if (!slot || now > slot.resetTs) {
    hourlyByIp.set(ip, { count: 1, resetTs: now + 3600_000 });
  } else if (slot.count >= maxPerHour) {
    return res.status(429).json({ error: 'Troppe richieste in quest’ora: riprova più tardi.' });
  } else {
    slot.count += 1;
  }

  // --- Limite token giornaliero globale ---
  const today = new Date().toISOString().slice(0, 10);
  if (dailyTokens.day !== today) dailyTokens = { day: today, used: 0 };
  if (dailyTokens.used >= dailyLimit) {
    return res.status(429).json({ error: 'Limite giornaliero raggiunto: l’assistente torna disponibile domani.' });
  }

  const question = (req.body?.question || '').toString().slice(0, 500);
  if (!question.trim()) return res.status(400).json({ error: 'Domanda mancante' });

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        max_tokens: 500,
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question },
        ],
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: 'Errore del fornitore AI', detail: detail.slice(0, 200) });
    }
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content ?? 'Nessuna risposta.';
    const totalTokens = data.usage?.total_tokens ?? 0;
    dailyTokens.used += totalTokens;

    return res.status(200).json({
      text,
      tokens: totalTokens,
      remainingToday: Math.max(0, dailyLimit - dailyTokens.used),
    });
  } catch (e) {
    return res.status(500).json({ error: 'Errore interno del backend AI' });
  }
}

/* Per un rate limiting robusto in produzione (persistente tra le istanze):
   usare Vercel KV o Upstash Redis:
     const { kv } = require('@vercel/kv');
     await kv.incr(`ai:${ip}:${hourKey}`); await kv.expire(...);
*/
