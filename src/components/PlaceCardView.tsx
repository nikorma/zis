import { useState } from 'react';
import type { PlaceCard, Stop } from '../types';
import AudioControls from './AudioControls';
import GuideImage from './GuideImage';

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-dashed border-[#E4D7BC] dark:border-[#33406B] pt-2">
      <button className="w-full flex items-center gap-2 text-left font-semibold" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span aria-hidden>{open ? '▼' : '▶'}</span> {icon} {title}
      </button>
      {open && <div className="mt-2 text-sm leading-relaxed space-y-1">{children}</div>}
    </div>
  );
}

/** Testo completo della scheda, per l'audioguida. */
function cardToSpeech(c: PlaceCard, title: string): string {
  const parts = [title + '.', c.summary, c.description, c.history];
  if (c.curiosities?.length) parts.push('Curiosità: ' + c.curiosities.join(' '));
  if (c.toSee?.length) parts.push('Da non perdere: ' + c.toSee.join(', ') + '.');
  return parts.filter(Boolean).join(' ');
}

export default function PlaceCardView({
  card, stop, city, onRegenerate, regenerating,
}: {
  card: PlaceCard; stop: Stop; city?: string;
  onRegenerate: () => void; regenerating: boolean;
}) {
  const title = stop.title;
  const searchTickets = `https://www.google.com/search?q=${encodeURIComponent('biglietti ' + title + ' ' + (city ?? '') + ' sito ufficiale')}`;

  return (
    <div className="space-y-3">
      {/* Intestazione tipo/periodo */}
      <div>
        <p className="text-xs opacity-60 uppercase tracking-wide">
          {card.type || 'Luogo'}{card.period ? ` · ${card.period}` : ''}
        </p>
        <div className="azulejo-band mt-1" aria-hidden />
      </div>

      <GuideImage subject={`${title} ${city ?? ''}`.trim()} alt={title} />

      {/* Sommario evidenziato */}
      <p className="text-base font-medium leading-relaxed">{card.summary}</p>
      {card.description && <p className="text-sm leading-relaxed opacity-90">{card.description}</p>}

      {/* Audioguida della scheda */}
      <AudioControls text={cardToSpeech(card, title)} audioKey={`card-${stop.id}`} />

      {!card.confident && (
        <p className="text-xs badge-warn !inline-block">ℹ️ Informazioni limitate su questo luogo: la scheda riporta solo il verificabile.</p>
      )}

      {/* Storia strutturata */}
      {(card.history || card.style || card.people?.length) && (
        <Section icon="📜" title="Storia">
          {card.history && <p>{card.history}</p>}
          {card.style && <p><strong>Stile:</strong> {card.style}</p>}
          {card.originalUse && <p><strong>Uso originario:</strong> {card.originalUse}</p>}
          {card.currentUse && <p><strong>Uso attuale:</strong> {card.currentUse}</p>}
          {card.people && card.people.length > 0 && <p><strong>Personaggi:</strong> {card.people.join(', ')}</p>}
        </Section>
      )}

      {card.curiosities && card.curiosities.length > 0 && (
        <Section icon="💡" title="Curiosità e aneddoti">
          <ul className="list-disc pl-5 space-y-1">{card.curiosities.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Section>
      )}

      {card.legends && card.legends.length > 0 && (
        <Section icon="🧚" title="Leggende">
          <ul className="list-disc pl-5 space-y-1">{card.legends.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Section>
      )}

      {card.toSee && card.toSee.length > 0 && (
        <Section icon="👀" title="Cosa vedere">
          <ul className="list-disc pl-5 space-y-1">{card.toSee.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Section>
      )}

      {card.practical && (
        <Section icon="ℹ️" title="Informazioni pratiche">
          {card.practical.duration && <p><strong>Durata consigliata:</strong> {card.practical.duration}</p>}
          {card.practical.bestTime && <p><strong>Momento migliore:</strong> {card.practical.bestTime}</p>}
          {card.practical.accessibility && <p>♿ {card.practical.accessibility}</p>}
          {card.practical.tips?.map((tp, i) => <p key={i}>💡 {tp}</p>)}
          <p className="text-[11px] opacity-60 mt-1">⚠️ Prezzi e orari non sono garantiti: verifica sul sito ufficiale prima di andare.</p>
        </Section>
      )}

      {/* Biglietto / sito ufficiale */}
      <div className="rounded-xl bg-crema dark:bg-[#141C33] p-3 space-y-1.5">
        <p className="text-sm font-semibold">
          🎟️ {card.paid === true ? <span className="badge-warn">Biglietto a pagamento</span>
            : card.paid === false ? <span className="badge-ok">Ingresso gratuito</span>
            : 'Biglietto: da verificare'}
        </p>
        <div className="flex flex-wrap gap-2">
          {card.officialSite
            ? <a className="btn-primary !min-h-[40px] !py-1 text-sm" href={card.officialSite} target="_blank" rel="noreferrer">🌐 Sito ufficiale ↗</a>
            : <a className="btn-secondary !min-h-[40px] !py-1 text-sm" href={searchTickets} target="_blank" rel="noreferrer">🔎 Cerca sito/biglietti ufficiali</a>}
        </div>
      </div>

      <button className="btn-ghost w-full !min-h-[38px] !py-1 text-sm" disabled={regenerating} onClick={onRegenerate}>
        {regenerating ? '⏳ Rigenero…' : '🔄 Rigenera scheda'}
      </button>
    </div>
  );
}
