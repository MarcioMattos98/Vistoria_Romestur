import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import ProgressBar from '../components/ProgressBar';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { deleteInspection, listInspections } from '../database/db';
import type { Inspection } from '../types';
import { friendlyError } from '../utils/errors';
import { formatDateBR, todayLocal } from '../utils/format';
import { summarize } from '../utils/progress';

export default function Home() {
  const [pending, setPending] = useState<Inspection[] | null>(null);
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const all = await listInspections();
      setPending(all.filter((i) => i.status === 'in_progress').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch (e) {
      toast(friendlyError(e), 'error');
      setPending([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (i: Inspection) => {
    const ok = await confirm({
      title: 'Excluir vistoria?',
      message: `A vistoria da frota ${i.fleet} (${i.plate}) e todas as suas fotografias serão apagadas. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteInspection(i.id);
      toast('Vistoria excluída');
      await load();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  return (
    <Layout
      title="VISTORIA VEICULAR"
      right={<a className="btn btn-light" href="#/ajustes">Ajustes</a>}
    >
      <div className="today">Hoje: {formatDateBR(todayLocal())}</div>

      <div className="home-actions">
        <a className="btn btn-primary wide" href="#/nova">Iniciar nova vistoria</a>
        <a className="btn" href="#/veiculos?novo">Cadastrar veículo</a>
        <a className="btn" href="#/veiculos">Veículos cadastrados</a>
        <a className="btn wide" href="#/historico">Histórico de vistorias</a>
      </div>

      <h2>Vistorias pendentes</h2>
      {pending === null && <p className="muted">Carregando…</p>}
      {pending?.length === 0 && <div className="card empty">Nenhuma vistoria em andamento. Toque em “Iniciar nova vistoria”.</div>}
      {pending?.map((i) => {
        const s = summarize(i);
        return (
          <article className="card" key={i.id}>
            <div className="row between">
              <h3>Vistoria pendente - Frota {i.fleet}</h3>
              <span className="pill pill-warn">{s.percent}%</span>
            </div>
            <div className="muted">
              Placa: <b>{i.plate}</b> &nbsp; Tag: <b>{i.tag}</b>
              <br />
              Data: {formatDateBR(i.date)}
            </div>
            <ProgressBar value={s.percent} label="Conclusão da vistoria" />
            <div>
              {s.answered} de {s.total} itens respondidos. {s.total - s.complete} pendente{s.total - s.complete === 1 ? '' : 's'}.
            </div>
            <div className="row">
              <a className="btn btn-primary" style={{ flex: 1 }} href={`#/vistoria/${i.id}/1`}>Continuar vistoria</a>
              <button className="btn btn-ghost-danger" onClick={() => remove(i)}>Excluir vistoria</button>
            </div>
          </article>
        );
      })}
      {dialog}
    </Layout>
  );
}
