import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'ok' | 'error';
const Ctx = createContext<{ toast: (msg: string, kind?: Kind) => void }>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<{ msg: string; kind: Kind; key: number } | null>(null);
  const toast = useCallback((msg: string, kind: Kind = 'ok') => {
    const key = Date.now();
    setItem({ msg, kind, key });
    window.setTimeout(() => setItem((cur) => (cur && cur.key === key ? null : cur)), kind === 'error' ? 6000 : 2600);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {item && (
        <div className={`toast toast-${item.kind}`} role="status" aria-live="polite">
          {item.msg}
        </div>
      )}
    </Ctx.Provider>
  );
}
