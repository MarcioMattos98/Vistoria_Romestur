import { useCallback, useEffect, useState } from 'react';
import { addPhoto, deletePhoto, listPhotos } from '../database/db';
import { usePhotoUrls } from '../hooks/usePhotoUrls';
import { processImage } from '../services/photos';
import type { ChecklistItem, Inspection, Photo } from '../types';
import { friendlyError } from '../utils/errors';
import { useConfirm } from './ConfirmDialog';
import PhotoSection from './PhotoSection';
import PhotoViewer from './PhotoViewer';
import { useToast } from './Toast';

interface Props {
  inspectionId: string;
  item: ChecklistItem;
  /** Opcional: liga o indicador "Salvando / Salvo" da tela que usa o componente. */
  track?: <T>(p: Promise<T>) => Promise<T>;
  onChanged: (insp: Inspection) => void;
}

/** Campo "Comprovação da manutenção" de um item NC. Funciona antes e depois de concluir a vistoria. */
export default function MaintenanceProof({ inspectionId, item, track, onChanged }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<Photo | null>(null);
  const urls = usePhotoUrls(photos);
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const run = <T,>(p: Promise<T>) => (track ? track(p) : p);

  const reload = useCallback(async () => {
    try {
      setPhotos(await listPhotos(inspectionId, item.id, 'maintenance'));
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  }, [inspectionId, item.id, toast]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const add = async (files: File[]) => {
    setBusy(true);
    try {
      for (const f of files) {
        const data = await processImage(f);
        onChanged(await run(addPhoto(inspectionId, item.id, data, undefined, 'maintenance')));
      }
      await reload();
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Photo) => {
    const ok = await confirm({ title: 'Excluir comprovação?', message: 'A fotografia será removida da comprovação de manutenção.', confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    try {
      onChanged(await run(deletePhoto(p.id)));
      setViewer(null);
      await reload();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  const idx = photos.findIndex((p) => p.id === viewer?.id);

  return (
    <section className="card proof">
      <h3>Item {item.id}: comprovação da manutenção</h3>
      <p className="muted">
        Anexe a foto que comprova a correção desta não conformidade. Pode ser feito agora ou depois, mesmo com a vistoria concluída.
      </p>
      <PhotoSection title="Comprovação da manutenção" photos={photos} urls={urls} required={0} busy={busy} onAddFiles={add} onOpen={setViewer} />
      {viewer && urls.get(viewer.id) && (
        <PhotoViewer
          url={urls.get(viewer.id)!}
          title={`Item ${item.id} - comprovação ${idx + 1} de ${photos.length}`}
          onClose={() => setViewer(null)}
          onDelete={() => remove(viewer)}
        />
      )}
      {dialog}
    </section>
  );
}
