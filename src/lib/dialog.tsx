import { createRoot } from 'react-dom/client';

/**
 * Finestra di conferma con il nome dell'app (al posto del popup del browser
 * che mostra l'indirizzo del sito). Uso: `if (await appConfirm('Eliminare?')) …`
 */
export function appConfirm(message: string, okLabel = 'OK', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const close = (v: boolean) => {
      root.unmount();
      host.remove();
      resolve(v);
    };
    root.render(
      <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(20,28,51,0.55)' }} role="dialog" aria-modal="true">
        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#202B49] p-4 space-y-3 shadow-xl">
          <p className="font-display font-black text-lg">🎒 ZainoInSpalla</p>
          <p className="text-sm whitespace-pre-wrap">{message}</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button className="btn-secondary !min-h-[44px]" onClick={() => close(false)}>Annulla</button>
            <button
              className="btn !min-h-[44px] text-white"
              style={{ background: danger ? '#C62828' : 'linear-gradient(120deg, #FF6B4A, #E14E2E)' }}
              onClick={() => close(true)}
            >{okLabel}</button>
          </div>
        </div>
      </div>
    );
  });
}
