import { CHECKLIST } from '../data/checklist';
import type { Inspection } from '../types';
import { itemState } from '../utils/progress';

export default function ItemIndex({ insp, current, onPick }: { insp: Inspection; current: number; onPick: (n: number) => void }) {
  return (
    <div className="item-index" role="navigation" aria-label="Lista de itens">
      {CHECKLIST.map((item) => {
        const s = itemState(item, insp);
        return (
          <button
            key={item.id}
            className={`idx idx-${s} ${item.id === current ? 'current' : ''}`}
            onClick={() => onPick(item.id)}
            aria-label={`Item ${item.id}`}
          >
            {item.id}
          </button>
        );
      })}
    </div>
  );
}
