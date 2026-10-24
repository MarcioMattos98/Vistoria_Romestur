import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { CHECKLIST } from '../data/checklist';
import { completeInspection, getInspection, listPhotos, saveReport } from '../database/db';
import { navigate } from '../hooks/useRoute';
import { usePhotoUrls } from '../hooks/usePhotoUrls';
import { buildReportPdf } from '../services/pdf';
import type { Inspection, Photo } from '../types';
import { friendlyError } from '../utils/errors';
import { formatDateBR } from '../utils/format';
import { pendingText, summarize } from '../utils/progress';
import StatusPill from '../components/StatusPill';
import { itemState } from '../utils/progress';

export default function Review({ id }: { id: string }) {
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const urls = usePhotoUrls(photos);

  useEffect(() => {
    (async () => {
      try {
        const i = await getInspection(id);
        if (!i) return navigate('/');
        if (i.status === 'completed') return navigate(`/relatorio/${id}`);
        setInsp(i);
        setPhotos(await listPhotos(id));
      } catch (e) {
        toast(friendlyError(e), 'error');
      }
    })();
  }, [id, toast]);

  if (!insp) return <Layout title="Revisão" back="/"><p className="muted">Carregando…</p></Layout>;
  const s = summarize(insp);
  const ncItems = CHECKLIST.filter((i) => insp.answers[i.id] === 'NC');
  const photosOf = (itemId: number) => photos.filter((p) => p.itemId === itemId);

  const conclude = async () => {
    const ok = await confirm({
      title: 'Concluir vistoria?',
      message: 'Depois de concluída, a vistoria não poderá ser alterada sem reabertura. O relatório em PDF será gerado agora.',
      confirmLabel: 'Concluir vistoria',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const all = await listPhotos(id);
      const { blob, fileName } = await buildReportPdf(insp, all);
      const done = await completeInspection(id);
      await saveReport({ inspectionId: id, revision: done.revision, createdAt: new Date().toISOString(), fileName, blob });
      navigate(`/relatorio/${id}`);
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout
      title="Revisar vistoria"
      back={`/vistoria/${id}/1`}
      footer={
        <button className="btn btn-primary" disabled={s.pending.length > 0 || busy} onClick={conclude}>
          {busy ? 'Gerando relatório…' : 'Concluir vistoria'}
        </button>
      }
    >
      <section className="card">
        <h2>Frota {insp.fleet}</h2>
        <div className="muted">Placa {insp.plate} &nbsp; Tag {insp.tag} &nbsp; Data {formatDateBR(insp.date)}</div>
        <div className="stats">
          <div className="stat"><b>{s.total}</b><small>Itens</small></div>
          <div className="stat"><b>{s.c}</b><small>C</small></div>
          <div className="stat"><b>{s.nc}</b><small>NC</small></div>
          <div className="stat"><b>{s.na}</b><small>NA</small></div>
          <div className="stat"><b>{s.unanswered}</b><small>Sem resposta</small></div>
          <div className="stat"><b>{s.photoPending}</b><small>Fotos pendentes</small></div>
        </div>
      </section>

      {s.pending.length > 0 && (
        <section className="error" role="alert">
          <strong>Corrija estes itens para concluir:</strong>
          <ul className="list-plain">
            {s.pending.map((p) => (
              <li key={p.item.id}><a href={`#/vistoria/${id}/${p.item.id}`}>{pendingText(p)}</a></li>
            ))}
          </ul>
        </section>
      )}

      <h2>Não conformidades ({ncItems.length})</h2>
      {ncItems.length === 0 && <div className="card empty">Nenhum item não conforme.</div>}
      {ncItems.map((item) => (
        <a key={item.id} className="card nc review-item" href={`#/vistoria/${id}/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <strong>{item.id}. {item.description}</strong>
          <div className="mini-thumbs">
            {photosOf(item.id).map((p) => urls.get(p.id) && <img key={p.id} src={urls.get(p.id)} alt={`Foto do item ${item.id}`} />)}
          </div>
        </a>
      ))}

      <h2>Todos os itens</h2>
      <ul className="list-links">
        {CHECKLIST.map((item) => (
          <li key={item.id}>
            <a className="item-line" href={`#/vistoria/${id}/${item.id}`}>
              <span>
                <b>{item.id}.</b> {item.description}
                <br />
                <small className="muted">{insp.photoCounts[item.id] ?? 0} foto(s)</small>
              </span>
              <span className="stack" style={{ alignItems: 'flex-end' }}>
                {insp.answers[item.id] && <span className={`pill pill-${insp.answers[item.id]}`}>{insp.answers[item.id]}</span>}
                <StatusPill state={itemState(item, insp)} />
              </span>
            </a>
          </li>
        ))}
      </ul>
      {dialog}
    </Layout>
  );
}
