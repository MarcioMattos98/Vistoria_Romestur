import { AppError } from '../utils/errors';

const MAX_SIDE = 1280;
const QUALITY = 0.82;

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: Blob): Promise<Decoded> {
  // createImageBitmap com 'from-image' aplica a orientação EXIF (evita fotos giradas).
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      /* cai no fallback */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new AppError('Não foi possível ler esta imagem. Tente outro arquivo (JPG ou PNG).');
  }
}

/** Corrige orientação, reduz o tamanho e converte para JPEG (formato aceito pelo PDF). */
export async function processImage(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const d = await decode(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(d.width, d.height));
    const width = Math.max(1, Math.round(d.width * scale));
    const height = Math.max(1, Math.round(d.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new AppError('Seu navegador não conseguiu processar a imagem.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(d.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
    if (!blob) throw new AppError('Não foi possível converter a imagem.');
    canvas.width = canvas.height = 0;
    return { blob, width, height };
  } finally {
    d.release();
  }
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error('Falha ao ler arquivo'));
    r.readAsDataURL(blob);
  });
}
