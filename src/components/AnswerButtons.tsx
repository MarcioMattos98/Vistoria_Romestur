import type { Answer } from '../types';

const OPTIONS: { v: Answer; hint: string }[] = [
  { v: 'C', hint: 'Conforme' },
  { v: 'NC', hint: 'Não conforme' },
  { v: 'NA', hint: 'Não aplica' },
];

export default function AnswerButtons({ value, onChange }: { value?: Answer; onChange: (a: Answer) => void }) {
  return (
    <div className="answers" role="radiogroup" aria-label="Condição do item">
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          className={`answer a-${o.v} ${value === o.v ? 'on' : ''}`}
          onClick={() => onChange(o.v)}
        >
          <strong>{o.v}</strong>
          <small>{o.hint}</small>
        </button>
      ))}
    </div>
  );
}
