import type { SaveStatus } from '../hooks/useSaveStatus';

const TEXT: Record<SaveStatus, string> = { saving: 'Salvando…', saved: 'Salvo', error: 'Erro ao salvar' };

export default function SaveBadge({ status, message }: { status: SaveStatus; message?: string }) {
  return (
    <span className={`save-badge save-${status}`} title={status === 'error' ? message : undefined} aria-live="polite">
      {TEXT[status]}
    </span>
  );
}
