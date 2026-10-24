import { useCallback, useState, type ReactNode } from 'react';

interface Opts {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function useConfirm(): { confirm: (o: Opts) => Promise<boolean>; dialog: ReactNode } {
  const [state, setState] = useState<(Opts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: Opts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = state ? (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={state.title ?? 'Confirmação'}>
      <div className="dialog">
        {state.title && <h2>{state.title}</h2>}
        <p style={{ whiteSpace: 'pre-line' }}>{state.message}</p>
        <div className="dialog-actions">
          <button className="btn" onClick={() => close(false)}>
            {state.cancelLabel ?? 'Cancelar'}
          </button>
          <button className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
            {state.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  ) : null;
  return { confirm, dialog };
}
