import { useRef } from 'react';
import type { Photo } from '../types';

interface Props {
  photos: Photo[];
  urls: Map<string, string>;
  required: number;
  busy: boolean;
  onAddFiles: (files: File[]) => void;
  onOpen: (photo: Photo) => void;
}

export default function PhotoSection({ photos, urls, required, busy, onAddFiles, onOpen }: Props) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const missing = Math.max(0, required - photos.length);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) onAddFiles(files);
  };

  return (
    <section className="photos" aria-label="Fotografias do item">
      <div className="photos-head">
        <strong>Fotografias</strong>
        <span className={missing > 0 ? 'need' : 'ok'}>
          {required === 0
            ? `${photos.length} anexada${photos.length === 1 ? '' : 's'} (não obrigatório)`
            : missing > 0
              ? `${photos.length} de ${required} - faltam ${missing}`
              : `${photos.length} de ${required} - completo`}
        </span>
      </div>

      <div className="photo-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => camera.current?.click()}>
          {busy ? 'Processando…' : 'Tirar foto'}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => gallery.current?.click()}>
          Galeria
        </button>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
        <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={handle} />
      </div>

      {photos.length > 0 && (
        <ul className="thumbs">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button type="button" onClick={() => onOpen(p)} aria-label={`Ampliar foto ${i + 1}`}>
                {urls.get(p.id) && <img src={urls.get(p.id)} alt={`Foto ${i + 1}`} />}
                <span>{i + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
