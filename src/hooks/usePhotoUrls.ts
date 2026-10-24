import { useEffect, useState } from 'react';
import type { Photo } from '../types';

/** Cria URLs temporárias só para EXIBIR as fotos; o dado real fica no IndexedDB. */
export function usePhotoUrls(photos: Photo[]): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const m = new Map<string, string>();
    photos.forEach((p) => m.set(p.id, URL.createObjectURL(p.blob)));
    setUrls(m);
    return () => m.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);
  return urls;
}
