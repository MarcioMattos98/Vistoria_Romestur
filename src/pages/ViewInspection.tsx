import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import PhotoViewer from '../components/PhotoViewer';
import StatusPill from '../components/StatusPill';
import { useToast } from '../components/Toast';
import { CHECKLIST } from '../data/checklist';
import { getInspection, listPhotos } from '../database/db';
import { usePhotoUrls } from '../hooks/usePhotoUrls';
import type { Inspection, Photo } from '../types';
import { friendlyError } from '../utils/errors';
import { formatDateBR } from '../utils/format';
import { itemState } from '../utils/progress';

export default function ViewInspection({ id }: { id: string }) {
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [open, setOpen] = useState<Photo | null>(null);
  const { toast } = useToast();
  const urls = usePhotoUrls(photos);

  useEffect(() => {
    (async () => {
      try {
        setInsp((await getInspection(id)) ?? null);
        setPhotos(await listPhotos(id));
      } catch (e) {
        toast(friendlyError(e), 'error');
      }
    })();
  }, [id, toast]);

  if (!insp) return <Layout title="Consulta" back="/historico"><p className="muted">Carregando…</p></Layout>;

  return (
    <Layout title="Consultar vistoria" back="/historico">
      <section className="card">
        <h2>Frota {insp.fleet} - {insp.plate}</h2>
        <div className="muted">{insp.code} - Tag {insp.tag} - {formatDateBR(insp.date)}</div>
        {insp.editLog.length > 0 && (
          <details>
            <summary>Registro de alterações</summary>
            <ul className="list-plain">{insp.editLog.map((l) => <li key={l.at}>{new Date(l.at).toLocaleString('pt-BR')} - {l.note}</li>)}</ul>
          </details>
        )}
        <div className="row">
          {insp.status === 'completed' && <a className="btn btn-primary btn-small" href={`#/relatorio/${id}`}>PDF</a>}
          {insp.status === 'in_progress' && <a className="btn btn-primary btn-small" href={`#/vistoria/${id}/1`}>Continuar</a>}
        </div>
      </section>
      {CHECKLIST.map((item) => {
        const a = insp.answers[item.id];
        const ph = photos.filter((p) => p.itemId === item.id);
        return (
          <article key={item.id} className={`card ${a === 'NC' ? 'nc' : ''}`}>
            <div className="row between">
              <strong>{item.id}. {item.description}</strong>
              {a ? <span className={`pill pill-${a}`}>{a}</span> : <StatusPill state={itemState(item, insp)} />}
            </div>
            {ph.length > 0 && (
              <div className="mini-thumbs">
                {ph.map((p, n) => urls.get(p.id) && <img key={p.id} src={urls.get(p.id)} alt={`Item ${item.id} foto ${n + 1}`} onClick={() => setOpen(p)} />)}
              </div>
            )}
          </article>
        );
      })}
      {open && urls.get(open.id) && <PhotoViewer url={urls.get(open.id)!} title={`Item ${open.itemId}`} onClose={() => setOpen(null)} />}
    </Layout>
  );
}
