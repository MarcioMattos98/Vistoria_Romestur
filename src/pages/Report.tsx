import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { getInspection, listPhotos, listReports, saveReport } from '../database/db';
import { buildReportPdf } from '../services/pdf';
import { canShareFile, downloadBlob, sharePdf } from '../services/share';
import type { Inspection, ReportRecord } from '../types';
import { friendlyError } from '../utils/errors';
import { formatDateBR, formatDateTimeBR } from '../utils/format';
import { summarize } from '../utils/progress';

export default function Report({ id }: { id: string }) {
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const generate = useCallback(
    async (i: Inspection) => {
      setBusy(true);
      try {
        const photos = await listPhotos(i.id);
        const { blob, fileName } = await buildReportPdf(i, photos);
        await saveReport({ inspectionId: i.id, revision: i.revision, createdAt: new Date().toISOString(), fileName, blob });
        setReports(await listReports(i.id));
      } catch (e) {
        toast(friendlyError(e), 'error');
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    (async () => {
      try {
        const i = await getInspection(id);
        if (!i) return;
        setInsp(i);
        const rs = await listReports(id);
        setReports(rs);
        if (i.status === 'completed' && !rs.some((r) => r.revision === i.revision)) await generate(i);
      } catch (e) {
        toast(friendlyError(e), 'error');
      }
    })();
  }, [id, generate, toast]);

  const current = insp ? reports.find((r) => r.revision === insp.revision) : undefined;
  const older = reports.filter((r) => r !== current);

  useEffect(() => {
    if (!current) return setUrl('');
    const u = URL.createObjectURL(current.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [current]);

  if (!insp) return <Layout title="Relatório" back="/historico"><p className="muted">Carregando…</p></Layout>;

  if (insp.status !== 'completed') {
    return (
      <Layout title="Relatório" back="/">
        <div className="card">
          <p>Esta vistoria ainda está em andamento. O relatório é gerado quando ela for concluída.</p>
          <a className="btn btn-primary" href={`#/vistoria/${id}/1`}>Continuar vistoria</a>
        </div>
      </Layout>
    );
  }

  const s = summarize(insp);
  const shareOk = current ? canShareFile(current.blob, current.fileName) : false;

  const share = async () => {
    if (!current) return;
    try {
      const r = await sharePdf(current.blob, current.fileName, `Vistoria frota ${insp.fleet} - ${formatDateBR(insp.date)}`);
      if (r === 'unsupported') toast('Compartilhamento não disponível neste navegador. Baixe o PDF e anexe manualmente.', 'error');
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  return (
    <Layout title="Relatório da vistoria" back="/historico">
      <section className="card">
        <div className="row between">
          <h2>Vistoria concluída</h2>
          <span className="pill pill-ok">Concluída</span>
        </div>
        <div className="muted">
          {insp.code}
          <br />
          Frota {insp.fleet} - Placa {insp.plate} - Tag {insp.tag}
          <br />
          Data {formatDateBR(insp.date)}{insp.revision > 1 ? ` - revisão ${insp.revision}` : ''}
        </div>
        <div className="stats">
          <div className="stat"><b>{s.c}</b><small>C</small></div>
          <div className="stat"><b>{s.nc}</b><small>NC</small></div>
          <div className="stat"><b>{s.na}</b><small>NA</small></div>
        </div>
      </section>

      {busy && <div className="card">Gerando o PDF com as fotografias…</div>}

      {current && (
        <section className="card">
          <h2>Relatório em PDF</h2>
          <div className="muted">{current.fileName}</div>
          <a className="btn btn-primary" href={url} target="_blank" rel="noopener">Visualizar PDF</a>
          <button className="btn" onClick={() => downloadBlob(current.blob, current.fileName)}>Salvar PDF</button>
          <button className="btn" onClick={share}>Compartilhar PDF</button>
          {!shareOk && (
            <p className="muted">
              Este navegador não compartilha arquivos diretamente. Toque em “Salvar PDF” e anexe o arquivo manualmente no WhatsApp ou e-mail.
            </p>
          )}
          <button className="btn btn-small" disabled={busy} onClick={() => generate(insp)}>Gerar novamente</button>
        </section>
      )}

      {older.length > 0 && (
        <section className="card">
          <h3>Versões anteriores</h3>
          {older.map((r) => (
            <div className="row between" key={r.id}>
              <span>Revisão {r.revision} - {formatDateTimeBR(r.createdAt)}</span>
              <button className="btn btn-small" onClick={() => downloadBlob(r.blob, r.fileName)}>Baixar</button>
            </div>
          ))}
        </section>
      )}

      <a className="btn" href={`#/consulta/${id}`}>Ver respostas e fotografias</a>
    </Layout>
  );
}
