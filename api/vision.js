/**
 * /api/vision — "Occhio di viaggio": guarda una foto e
 *  - task 'translate': legge il testo e lo traduce in italiano
 *  - task 'identify': spiega cosa si vede, da guida turistica
 * Stessa chiave di /api/ai (OPENAI_API_KEY). La foto non viene salvata.
 */
const hourly = new Map();
const MAX_PER_HOUR = 15;

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
  else if (slot.count >= MAX_PER_HOUR) return res.status(429).json({ error: 'Troppe foto in quest\u2019ora: riprova più tardi.' });
  else slot.count += 1;

  const { image, task } = req.body || {};
  if (!image || !String(image).startsWith('data:image/')) return res.status(400).json({ error: 'Serve una foto.' });
  if (String(image).length > 1_800_000) return res.status(400).json({ error: 'Foto troppo grande: riprova (l\u2019app dovrebbe ridurla da sola).' });

  const prompt = task === 'translate'
    ? `Leggi TUTTO il testo presente nella foto (insegna, menù, cartello, etichetta…) e traducilo in ITALIANO.
Formato: prima la traduzione chiara e ordinata; poi una riga "Testo originale (lingua):" con il testo letto.
Se il testo è un menù, mantieni la struttura a voci. Se non c'è testo leggibile, dillo con gentilezza.`
    : `Sei ZainoInSpalla, guida di viaggio. Guarda la foto e spiega in ITALIANO cosa si vede (monumento, statua, piatto, oggetto, panorama…).
Dai 2-3 curiosità interessanti da guida. Se non riconosci il soggetto con certezza, dillo onestamente e proponi l'ipotesi più probabile motivandola. Massimo 180 parole. Non inventare nomi, date o prezzi.`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 700,
        temperature: 0.4,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image, detail: 'low' } },
          ],
        }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'Errore del fornitore AI' });
    const data = await r.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) return res.status(502).json({ error: 'Nessuna risposta: riprova.' });
    return res.status(200).json({ answer });
  } catch {
    return res.status(500).json({ error: 'Errore interno' });
  }
}
