import { useCallback, useEffect, useState } from 'react';
import AnswerButtons from '../components/AnswerButtons';
import { useConfirm } from '../components/ConfirmDialog';
import ItemIndex from '../components/ItemIndex';
import Layout from '../components/Layout';
import PhotoSection from '../components/PhotoSection';
import PhotoViewer from '../components/PhotoViewer';
import ProgressBar from '../components/ProgressBar';
import SaveBadge from '../components/SaveBadge';
import StatusPill from '../components/StatusPill';
import { useToast } from '../components/Toast';
import { CHECKLIST, getItem } from '../data/checklist';
import { addPhoto, deletePhoto, getInspection, listPhotos, setAnswer as saveAnswer } from '../database/db';
import { navigate } from '../hooks/useRoute';
import { usePhotoUrls } from '../hooks/usePhotoUrls';
import { useSaveStatus } from '../hooks/useSaveStatus';
import { processImage } from '../services/photos';
import type { Answer, Inspection, Photo } from '../types';
import { friendlyError } from '../utils/errors';
import { itemState, requiredPhotos, summarize } from '../utils/progress';

export default function InspectionPage({ id, itemNo }: { id: string; itemNo: number }) {
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [viewer, setViewer] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const { status, message, track } = useSaveStatus();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const item = getItem(itemNo) ?? CHECKLIST[0];
  const urls = usePhotoUrls(photos);

  useEffect(() => {
    let alive = true;
    getInspection(id)
      .then((i) => {
        if (!alive) return;
        if (!i) return navigate('/');
        if (i.status !== 'in_progress') return navigate(`/relatorio/${id}`);
        setInsp(i);
      })
      .catch((e) => toast(friendlyError(e), 'error'));
    return () => {
      alive = false;
    };
  }, [id, toast]);

  const reloadPhotos = useCallback(async () => {
    try {
      setPhotos(await listPhotos(id, item.id));
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  }, [id, item.id, toast]);

  useEffect(() => {
    setPhotos([]);
    setViewer(null);
    void reloadPhotos();
  }, [reloadPhotos]);

  if (!insp) return <Layout title="Vistoria" back="/"><p className="muted">Carregando…</p></Layout>;

  const answer = insp.answers[item.id];
  const state = itemState(item, insp);
  const summary = summarize(insp);
  const go = (n: number) => {
    setShowIndex(false);
    navigate(`/vistoria/${id}/${n}`);
  };

  const onAnswer = async (a: Answer) => {
    try {
      setInsp(await track(saveAnswer(id, item.id, a)));
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  const addFiles = async (files: File[], replaceId?: string) => {
    setBusy(true);
    try {
      for (const f of files) {
        const data = await processImage(f);
        setInsp(await track(addPhoto(id, item.id, data, replaceId)));
      }
      await reloadPhotos();
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async (p: Photo) => {
    const ok = await confirm({ title: 'Excluir fotografia?', message: 'A fotografia será removida deste item.', confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    try {
      setInsp(await track(deletePhoto(p.id)));
      setViewer(null);
      await reloadPhotos();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  const idx = photos.findIndex((p) => p.id === viewer?.id);
  const last = item.id === CHECKLIST.length;

  return (
    <Layout
      title={`Item ${item.id} de ${CHECKLIST.length}`}
      back="/"
      right={
        <>
          <SaveBadge status={status} message={message} />
          <button className="btn btn-light" onClick={() => setShowIndex((s) => !s)}>Itens</button>
        </>
      }
      footer={
        <>
          <button className="btn" disabled={item.id === 1} onClick={() => go(item.id - 1)}>‹ Anterior</button>
          <button className="btn" onClick={() => { toast('Vistoria salva'); navigate('/'); }}>Salvar e sair</button>
          {last ? (
            <button className="btn btn-primary" onClick={() => navigate(`/revisao/${id}`)}>Revisar</button>
          ) : (
            <button className="btn btn-primary" onClick={() => go(item.id + 1)}>Próximo ›</button>
          )}
        </>
      }
    >
      <div className="muted">Frota {insp.fleet} &nbsp; Placa {insp.plate} &nbsp; Tag {insp.tag}</div>
      <ProgressBar value={summary.percent} label="Progresso da vistoria" />
      <div className="muted">{summary.answered} de {summary.total} respondidos, {summary.complete} completos</div>

      {showIndex && (
        <div className="card">
          <ItemIndex insp={insp} current={item.id} onPick={go} />
          <button className="btn btn-primary" onClick={() => navigate(`/revisao/${id}`)}>Revisar vistoria</button>
        </div>
      )}

      <article className="card">
        <div className="row between">
          <h2 className="item-title"><span className="item-num">{item.id}</span>{item.description}</h2>
        </div>
        <StatusPill state={state} />
        <AnswerButtons value={answer} onChange={onAnswer} />
        <PhotoSection
          photos={photos}
          urls={urls}
          required={requiredPhotos(item, answer)}
          busy={busy}
          onAddFiles={(f) => addFiles(f)}
          onOpen={setViewer}
        />
      </article>

      {viewer && urls.get(viewer.id) && (
        <PhotoViewer
          url={urls.get(viewer.id)!}
          title={`Item ${item.id} - foto ${idx + 1} de ${photos.length}`}
          onClose={() => setViewer(null)}
          onDelete={() => removePhoto(viewer)}
          onReplace={async (f) => {
            await addFiles([f], viewer.id);
            setViewer(null);
          }}
        />
      )}
      {dialog}
    </Layout>
  );
}
