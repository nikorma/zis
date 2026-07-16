/**
 * /api/tts — Funzione serverless (formato Vercel) per la voce naturale.
 * Proxy verso ElevenLabs: la chiave resta SOLO nelle variabili d'ambiente
 * del server. Il client riceve audio/mpeg pronto da riprodurre o salvare
 * in IndexedDB per l'uso offline.
 *
 * Variabili d'ambiente richieste:
 *   ELEVENLABS_API_KEY   chiave ElevenLabs
 *   ELEVENLABS_VOICE_F   (opzionale) id voce femminile italiana
 *   ELEVENLABS_VOICE_M   (opzionale) id voce maschile italiana
 */

const hourly = new Map(); // ip -> { count, resetTs }
const MAX_PER_HOUR = 40;
const MAX_CHARS = 2500; // ~4 minuti di audio

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Backend non configurato: manca ELEVENLABS_API_KEY' });

  const ip = (req.headers['x-forwarded-for'] || 'unknown').toString().split(',')[0].trim();
  const now = Date.now();
  const slot = hourly.get(ip);
  if (!slot || now > slot.resetTs) hourly.set(ip, { count: 1, resetTs: now + 3600_000 });
  else if (slot.count >= MAX_PER_HOUR) return res.status(429).json({ error: 'Troppe richieste audio in quest\u2019ora.' });
  else slot.count += 1;

  const text = (req.body?.text || '').toString().slice(0, MAX_CHARS);
  const gender = req.body?.gender === 'male' ? 'male' : 'female';
  if (!text.trim()) return res.status(400).json({ error: 'Testo mancante' });

  const voiceId =
    gender === 'male'
      ? process.env.ELEVENLABS_VOICE_M || 'onwK4e9ZLuTAKqWW03F9'
      : process.env.ELEVENLABS_VOICE_F || 'EXAVITQu4vr4xnSDxMaL';

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: 'Errore del fornitore TTS', detail: detail.slice(0, 200) });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: 'Errore interno del backend TTS' });
  }
}
