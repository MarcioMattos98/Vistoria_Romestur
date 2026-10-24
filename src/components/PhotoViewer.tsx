import { useRef } from 'react';

interface Props {
  url: string;
  title: string;
  onClose: () => void;
  onDelete?: () => void;
  onReplace?: (file: File) => void;
}

export default function PhotoViewer({ url, title, onClose, onDelete, onReplace }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="overlay viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="viewer-bar">
        <span>{title}</span>
        <button className="btn" onClick={onClose}>Fechar</button>
      </div>
      <div className="viewer-img">
        <img src={url} alt={title} />
      </div>
      {(onDelete || onReplace) && (
        <div className="viewer-actions">
          {onReplace && (
            <>
              <button className="btn" onClick={() => input.current?.click()}>Substituir</button>
              <input
                ref={input}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) onReplace(f);
                }}
              />
            </>
          )}
          {onDelete && <button className="btn btn-danger" onClick={onDelete}>Excluir foto</button>}
        </div>
      )}
    </div>
  );
}
