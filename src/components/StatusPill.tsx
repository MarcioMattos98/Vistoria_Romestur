import type { ItemState } from '../utils/progress';

const MAP: Record<ItemState, [string, string]> = {
  'pending-answer': ['Pendente de resposta', 'pill-warn'],
  'pending-photo': ['Pendente de fotografia', 'pill-warn'],
  complete: ['Completo', 'pill-ok'],
};

export default function StatusPill({ state }: { state: ItemState }) {
  const [text, cls] = MAP[state];
  return <span className={`pill ${cls}`}>{text}</span>;
}
