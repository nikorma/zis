/**
 * Foto da Wikimedia Commons (licenze libere, nessuna chiave necessaria).
 * L'app cerca la foto migliore per un dato soggetto tramite l'API ufficiale,
 * salva il risultato in localStorage (così la ricerca si fa una volta sola)
 * e il service worker mette in cache l'immagine stessa per l'uso offline.
 *
 * In caso di rete assente o nessun risultato: nessuna foto, nessun errore.
 */

export interface CommonsImage {
  url: string;          // URL diretto dell'immagine (ridimensionata)
  pageUrl: string;      // pagina Commons del file
  attribution: string;  // autore/licenza per il credito
}

const LS_KEY = 'zaino-commons-cache-v1';
const WIDTH = 900; // larghezza thumbnail richiesta

type CacheMap = Record<string, CommonsImage | null>;

function readCache(): CacheMap {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function writeCache(c: CacheMap) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch { /* quota piena: pazienza */ }
}

function stripHtml(s: string): string {
  const d = document.createElement('div');
  d.innerHTML = s;
  return (d.textContent || '').trim();
}

/**
 * Cerca su Wikimedia Commons un'immagine per il soggetto dato.
 * Restituisce null se non trova nulla o se offline (senza lanciare errori).
 */
export async function searchCommonsImage(subject: string): Promise<CommonsImage | null> {
  const key = subject.trim().toLowerCase();
  const cache = readCache();
  if (key in cache) return cache[key];
  if (!navigator.onLine) return null; // non salvare: ritenta quando torna la rete

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${subject}`,
    gsrnamespace: '6',
    gsrlimit: '5',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(WIDTH),
  });

  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!res.ok) return null;
    const json = await res.json();
    const pages = json?.query?.pages ? (Object.values(json.query.pages) as any[]) : [];

    // 🎯 Pertinenza: il file deve contenere almeno una parola significativa del soggetto
    // (es. "nettuno" o "bologna"): meglio NESSUNA foto che la foto sbagliata.
    const STOPWORDS = new Set(['della', 'delle', 'dello', 'degli', 'museo', 'chiesa', 'piazza', 'palazzo', 'ponte', 'torre', 'porta', 'parco', 'giardino', 'centro', 'storico', 'santa', 'santo', 'basilica', 'cattedrale', 'fontana', 'mercato', 'teatro', 'castello', 'pranzo', 'cena', 'colazione', 'ristorante', 'italia', 'italy']);
    const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tokens = norm(subject).split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !STOPWORDS.has(t));
    const relevant = (title: string) => {
      if (tokens.length === 0) return true;
      const t = norm(title);
      return tokens.some((tok) => t.includes(tok));
    };

    // Preferisci jpeg/png, scarta svg/pdf/mappe e file NON pertinenti
    const candidates = pages
      .map((p) => ({ p, info: p.imageinfo?.[0] }))
      .filter(({ p, info }) => info?.thumburl && !/\.(svg|pdf|tif)/i.test(p.title || '') && relevant(p.title || ''))
      .sort((a, b) => {
        // più parole del soggetto nel nome del file = più in alto
        const score = (x: { p: any }) => tokens.filter((tok) => norm(x.p.title || '').includes(tok)).length;
        return score(b) - score(a) || (b.info.thumbwidth ?? 0) - (a.info.thumbwidth ?? 0);
      });

    const best = candidates[0];
    let result: CommonsImage | null = null;
    if (best) {
      const md = best.info.extmetadata || {};
      const artist = stripHtml(md.Artist?.value || '');
      const license = stripHtml(md.LicenseShortName?.value || '');
      result = {
        url: best.info.thumburl,
        pageUrl: best.info.descriptionurl || 'https://commons.wikimedia.org',
        attribution: [artist, license, 'Wikimedia Commons'].filter(Boolean).join(' · '),
      };
    }
    cache[key] = result; // salva anche il "nessun risultato" per non ripetere la ricerca
    writeCache(cache);
    return result;
  } catch {
    return null;
  }
}
