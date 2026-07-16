import { useEffect, useState } from 'react';
import { searchCommonsImage, type CommonsImage } from '../services/images';

/**
 * Foto del soggetto (da Wikimedia Commons, licenze libere) con credito.
 * Se non c'è rete o non si trova nulla, non mostra niente: la guida
 * funziona esattamente come prima.
 */
export default function GuideImage({ subject, alt }: { subject: string; alt: string }) {
  const [img, setImg] = useState<CommonsImage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setImg(null);
    setFailed(false);
    searchCommonsImage(subject).then((r) => { if (alive) setImg(r); });
    return () => { alive = false; };
  }, [subject]);

  if (!img || failed) return null;

  return (
    <figure className="space-y-1">
      <img
        src={img.url}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full max-h-72 object-cover rounded-2xl border border-[#e8ddca] dark:border-[#4a382c]"
      />
      <figcaption className="text-[10px] opacity-50 text-right">
        📷 <a href={img.pageUrl} target="_blank" rel="noreferrer" className="underline">{img.attribution}</a>
      </figcaption>
    </figure>
  );
}
