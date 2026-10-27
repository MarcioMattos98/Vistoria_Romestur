import { CHECKLIST } from '../data/checklist';
import type { Answer, ChecklistItem, Inspection } from '../types';

export type ItemState = 'pending-answer' | 'pending-photo' | 'complete';

type Progressable = Pick<Inspection, 'answers' | 'photoCounts'>;

/** Quantas fotos o item exige dada a resposta atual. NA só dispensa se o item estiver configurado assim. */
export function requiredPhotos(item: ChecklistItem, answer?: Answer): number {
  if (answer === 'NA' && item.naExemptsPhotos) return 0;
  return item.minPhotos;
}

export function photoCount(insp: Progressable, itemId: number): number {
  return insp.photoCounts[itemId] ?? 0;
}

export function itemState(item: ChecklistItem, insp: Progressable): ItemState {
  const answer = insp.answers[item.id];
  if (!answer) return 'pending-answer';
  return photoCount(insp, item.id) < requiredPhotos(item, answer) ? 'pending-photo' : 'complete';
}

export interface PendingInfo {
  item: ChecklistItem;
  state: ItemState;
  missingPhotos: number;
}

export interface Summary {
  total: number;
  c: number;
  nc: number;
  na: number;
  unanswered: number;
  answered: number;
  photoPending: number;
  complete: number;
  percent: number;
  pending: PendingInfo[];
}

export function summarize(insp: Progressable): Summary {
  let c = 0, nc = 0, na = 0, unanswered = 0, photoPending = 0, complete = 0;
  const pending: PendingInfo[] = [];
  for (const item of CHECKLIST) {
    const a = insp.answers[item.id];
    const missing = Math.max(0, requiredPhotos(item, a) - photoCount(insp, item.id));
    if (missing > 0) photoPending++;
    if (!a) {
      unanswered++;
      pending.push({ item, state: 'pending-answer', missingPhotos: missing });
      continue;
    }
    if (a === 'C') c++;
    else if (a === 'NC') nc++;
    else na++;
    if (missing > 0) pending.push({ item, state: 'pending-photo', missingPhotos: missing });
    else complete++;
  }
  const total = CHECKLIST.length;
  return {
    total, c, nc, na, unanswered, answered: total - unanswered, photoPending, complete,
    percent: Math.round((complete / total) * 100), pending,
  };
}

export function pendingText(p: PendingInfo): string {
  const parts: string[] = [];
  if (p.state === 'pending-answer') parts.push('sem resposta (C, NC ou NA)');
  if (p.missingPhotos > 0) parts.push(`faltam ${p.missingPhotos} foto${p.missingPhotos > 1 ? 's' : ''}`);
  return `Item ${p.item.id}: ${parts.join(' e ')}`;
}

export function maintenanceCount(insp: Pick<Inspection, 'maintenanceCounts'>, itemId: number): number {
  return insp.maintenanceCounts?.[itemId] ?? 0;
}
