import { describe, expect, it } from 'vitest';
import { CHECKLIST } from '../data/checklist';
import { itemState, requiredPhotos, summarize } from '../utils/progress';
import { reportFileName } from '../utils/format';

describe('checklist', () => {
  it('tem 29 itens com as quantidades mínimas oficiais', () => {
    expect(CHECKLIST).toHaveLength(29);
    const min = Object.fromEntries(CHECKLIST.map((i) => [i.id, i.minPhotos]));
    expect(min[10]).toBe(0);
    expect(min[14]).toBe(0);
    expect(min[11]).toBe(2);
    expect(min[22]).toBe(2);
    expect(min[23]).toBe(3);
    expect(min[24]).toBe(3);
    expect(min[25]).toBe(4);
    expect(min[26]).toBe(4);
    expect(CHECKLIST.filter((i) => i.minPhotos === 1)).toHaveLength(21);
  });

  it('NA NÃO dispensa fotos por padrão', () => {
    expect(requiredPhotos(CHECKLIST[0], 'NA')).toBe(1);
    expect(requiredPhotos({ ...CHECKLIST[0], naExemptsPhotos: true }, 'NA')).toBe(0);
  });

  it('estados do item: pendente de resposta, de foto e completo', () => {
    const item = CHECKLIST.find((i) => i.id === 11)!;
    expect(itemState(item, { answers: {}, photoCounts: {} })).toBe('pending-answer');
    expect(itemState(item, { answers: { 11: 'C' }, photoCounts: { 11: 1 } })).toBe('pending-photo');
    expect(itemState(item, { answers: { 11: 'NC' }, photoCounts: { 11: 2 } })).toBe('complete');
    expect(itemState(item, { answers: { 11: 'NC' }, photoCounts: { 11: 5 } })).toBe('complete');
  });

  it('item sem exigência de foto fica completo só com a resposta', () => {
    const horn = CHECKLIST.find((i) => i.id === 10)!;
    expect(itemState(horn, { answers: { 10: 'C' }, photoCounts: {} })).toBe('complete');
  });

  it('resumo conta C, NC, NA e pendências', () => {
    const s = summarize({ answers: { 1: 'C', 2: 'NC', 3: 'NA' }, photoCounts: { 1: 1, 2: 0, 3: 1 } });
    expect([s.c, s.nc, s.na, s.unanswered, s.complete]).toEqual([1, 1, 1, 26, 2]);
    expect(s.pending.find((p) => p.item.id === 2)?.state).toBe('pending-photo');
  });

  it('nome do arquivo do PDF', () => {
    expect(reportFileName({ fleet: '11100', date: '2026-10-20', revision: 1 })).toBe('Frota_11100_2026-10-20.pdf');
    expect(reportFileName({ fleet: '11100', date: '2026-10-20', revision: 2 })).toBe('Frota_11100_2026-10-20_rev2.pdf');
  });
});
