export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function canShareFile(blob: Blob, fileName: string): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported';

/** Compartilha o ARQUIVO PDF (não um link). */
export async function sharePdf(blob: Blob, fileName: string, title: string): Promise<ShareResult> {
  if (!canShareFile(blob, fileName)) return 'unsupported';
  try {
    await navigator.share({ files: [new File([blob], fileName, { type: 'application/pdf' })], title, text: title });
    return 'shared';
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') return 'cancelled';
    throw e;
  }
}
