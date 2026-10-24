import { useCallback, useRef, useState } from 'react';
import { friendlyError } from '../utils/errors';

export type SaveStatus = 'saving' | 'saved' | 'error';

/** Só mostra "Salvo" depois que a gravação no IndexedDB terminar com sucesso. */
export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [message, setMessage] = useState('');
  const pending = useRef(0);

  const track = useCallback(async <T>(p: Promise<T>): Promise<T> => {
    pending.current++;
    setStatus('saving');
    try {
      const r = await p;
      pending.current--;
      if (pending.current === 0) setStatus('saved');
      return r;
    } catch (e) {
      pending.current--;
      setStatus('error');
      setMessage(friendlyError(e));
      throw e;
    }
  }, []);

  return { status, message, track };
}
