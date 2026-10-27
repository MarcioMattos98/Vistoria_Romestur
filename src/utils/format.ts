export const pad = (n: number) => String(n).padStart(2, '0');

/** Data local do aparelho no formato YYYY-MM-DD. */
export function todayLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function timeLocal(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  return `${formatDateBR(todayLocal(d))} ${timeLocal(d)}`;
}

export function normalizePlate(p: string): string {
  return p.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeFleet(f: string): string {
  return f.trim().toUpperCase();
}

export function safeFileName(s: string): string {
  return s.replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newInspectionCode(d: Date = new Date()): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) rand += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `VST-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${rand}`;
}

export function reportFileName(i: { fleet: string; date: string; revision: number }): string {
  const base = `Frota_${safeFileName(i.fleet)}_${i.date}`;
  return i.revision > 1 ? `${base}_rev${i.revision}.pdf` : `${base}.pdf`;
}
