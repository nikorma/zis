/**
 * /api/guide — Genera la GUIDA INTERNA di un'attrazione (punto per punto),
 * come una vera audioguida. Stessa chiave di /api/ai (OPENAI_API_KEY).
 * Risponde: { points: [ { name, text } ] }
 */
const hourly = new Map();
const MAX_PER_HOUR = 12;

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Backend non configurato: manca OPENAI_API_KEY' });

  const ip = (req.headers['x-forwarded-for'] || 'unknown').toString().split(',')[0].trim();
  const now = Date.now();
  const slot = hourly.get(ip);
  if (!slot || now > slot.resetTs) hourly.set(ip, { count: 1, resetTs: now + 3600_000 });
  else if (slot.count >= MAX_PER_HOUR) return res.status(429).json({ error: 'Troppe guide generate in quest’ora: riprova più tardi.' });
  else slot.count += 1;

  const { title, address } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Serve il nome dell’attrazione.' });

  const system = `Sei un'audioguida museale esperta. Rispondi ESCLUSIVAMENTE con JSON valido, senza testo attorno.
Schema: {"points":[{"name":"nome del punto/sala","text":"testo dell'audioguida"}]}
Regole:
- Da 6 a 10 punti che seguono il percorso di visita REALE del luogo (ingresso → sale principali → uscita).
- Ogni "text": 120-170 parole, in italiano, tono caldo, scritto per l'ASCOLTO: indica dove guardare ("alza lo sguardo...", "alla tua destra...").
- Racconta storia, aneddoti e dettagli da osservare. NON inventare prezzi, orari o regole: se servono, di' di verificare sul posto.
- Se il luogo non si visita all'interno (piazza, ponte, quartiere), fai i punti del percorso esterno.
- Se non conosci il luogo con certezza, resta su ciò che è tipico e verificabile del genere di luogo, senza inventare nomi di opere.`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 3200,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Attrazione: ${title}${address ? ' — ' + address : ''}` },
        ],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'Errore del fornitore AI' });
    const data = await r.json();
    let out;
    try { out = JSON.parse(data.choices?.[0]?.message?.content ?? '{}'); } catch { out = null; }
    if (!out || !Array.isArray(out.points) || out.points.length === 0) {
      return res.status(502).json({ error: 'Guida non generata: riprova.' });
    }
    return res.status(200).json({ points: out.points.slice(0, 12) });
  } catch {
    return res.status(500).json({ error: 'Errore interno' });
  }
}
