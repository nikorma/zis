/**
 * /api/place — Scheda dettagliata di un luogo, in stile guida cartacea:
 * sommario, descrizione, storia strutturata, curiosità, leggende, cosa vedere,
 * informazioni pratiche e (se noto con certezza) sito ufficiale.
 * Stessa chiave di /api/ai (OPENAI_API_KEY). Risponde JSON.
 */
const hourly = new Map();
const MAX_PER_HOUR = 20;
const LANG_NAMES = { it: 'italiano', en: 'inglese (English)', fr: 'francese (français)', es: 'spagnolo (español)', el: 'greco (ελληνικά)' };

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
  else if (slot.count >= MAX_PER_HOUR) return res.status(429).json({ error: 'Troppe schede in quest\u2019ora: riprova più tardi.' });
  else slot.count += 1;

  const { title, address, city, month, lang } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Serve il nome del luogo.' });
  const langName = LANG_NAMES[lang] || 'italiano';

  const system = `Sei l'autore di una guida turistica di alto livello. Rispondi ESCLUSIVAMENTE con JSON valido, senza testo attorno.
Scrivi TUTTO in ${langName}.
Schema ESATTO:
{
  "summary": "2-3 frasi da copertina, evocative ma concrete",
  "type": "es. Monumento, Museo, Piazza, Chiesa, Parco…",
  "period": "es. X–XVI secolo, o null se non pertinente",
  "description": "3-5 frasi ricche e informative sul luogo",
  "history": "paragrafo di storia con date e fatti (o breve e onesto se sai poco)",
  "style": "stile architettonico/artistico o null",
  "originalUse": "uso originario o null",
  "currentUse": "uso attuale o null",
  "people": ["personaggi storici legati al luogo"],
  "curiosities": ["2-4 curiosità o aneddoti VERI"],
  "legends": ["0-2 leggende note, se esistono davvero"],
  "toSee": ["3-6 cose concrete da non perdere sul posto"],
  "practical": {
    "duration": "es. ~90 min",
    "bestTime": "momento migliore per la visita${month ? ' (contesto: mese ' + month + ')' : ''}",
    "accessibility": "note accessibilità o null",
    "tips": ["1-3 consigli pratici"]
  },
  "paid": true/false,
  "officialSite": "URL ufficiale SOLO se lo conosci con CERTEZZA, altrimenti null",
  "confident": true/false
}
REGOLE FERREE:
- Usa SOLO fatti che conosci con certezza. Se il luogo ti è poco noto: "confident": false, riempi solo i campi sicuri, lascia gli altri null/[] e NON inventare nomi, date, opere, leggende o URL.
- "officialSite": mai inventato. Solo domini ufficiali certi (grandi monumenti/musei). In dubbio: null.
- Niente frasi da cartolina ("prenditi un momento", "lasciati trasportare"): solo contenuto.
- Vietato ripetere lo stesso concetto in campi diversi.`;

  const user = `Luogo: ${title}${address ? ' — ' + address : ''}${city ? ' (città: ' + city + ')' : ''}`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        max_tokens: 2200,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'Errore del fornitore AI' });
    const data = await r.json();
    let card;
    try { card = JSON.parse(data.choices?.[0]?.message?.content ?? '{}'); } catch { card = null; }
    if (!card || !card.summary) return res.status(502).json({ error: 'Scheda non generata: riprova.' });
    return res.status(200).json(card);
  } catch {
    return res.status(500).json({ error: 'Errore interno' });
  }
}
