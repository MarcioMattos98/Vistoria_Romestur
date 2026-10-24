import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { deleteInspection, listInspections, reopenInspection } from '../database/db';
import { navigate } from '../hooks/useRoute';
import type { Inspection } from '../types';
import { friendlyError } from '../utils/errors';
import { formatDateBR, normalizePlate } from '../utils/format';
import { summarize } from '../utils/progress';

export default function History() {
  const [all, setAll] = useState<Inspection[]>([]);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('all');
  const [nc, setNc] = useState('all');
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      setAll(await listInspections());
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  }, [toast]);
  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const text = q.trim().toUpperCase();
    const plate = normalizePlate(q);
    return all.filter((i) => {
      if (text && !(i.fleet.toUpperCase().includes(text) || i.tag.toUpperCase().includes(text) || (plate && normalizePlate(i.plate).includes(plate)))) return false;
      if (from && i.date < from) return false;
      if (to && i.date > to) return false;
      if (status !== 'all' && i.status !== status) return false;
      const hasNc = summarize(i).nc > 0;
      if (nc === 'yes' && !hasNc) return false;
      if (nc === 'no' && hasNc) return false;
      return true;
    });
  }, [all, q, from, to, status, nc]);

  const reopen = async (i: Inspection) => {
    const ok = await confirm({
      title: 'Reabrir vistoria concluída?',
      message: 'A alteração será registrada e gerará uma nova revisão do relatório. O PDF original continua guardado.',
      confirmLabel: 'Reabrir para edição',
    });
    if (!ok) return;
    try {
      await reopenInspection(i.id);
      navigate(`/vistoria/${i.id}/1`);
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  const remove = async (i: Inspection) => {
    const ok = await confirm({
      title: 'Excluir vistoria?',
      message: `Apagar a vistoria ${i.code}, suas fotografias e relatórios? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteInspection(i.id);
      await load();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  return (
    <Layout title="Histórico" back="/">
      <div className="card">
        <input className="input" type="search" placeholder="Frota, placa ou tag" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar" />
        <div className="grid2">
          <div className="field"><label htmlFor="from">Data inicial</label><input id="from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field"><label htmlFor="to">Data final</label><input id="to" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="field">
            <label htmlFor="st">Status</label>
            <select id="st" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Todos</option>
              <option value="in_progress">Em andamento</option>
              <option value="completed">Concluída</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="nc">Não conformidades</label>
            <select id="nc" className="input" value={nc} onChange={(e) => setNc(e.target.value)}>
              <option value="all">Todas</option>
              <option value="yes">Com NC</option>
              <option value="no">Sem NC</option>
            </select>
          </div>
        </div>
      </div>

      {rows.length === 0 && <div className="card empty">Nenhuma vistoria encontrada.</div>}
      {rows.map((i) => {
        const s = summarize(i);
        return (
          <article key={i.id} className={`card ${s.nc > 0 ? 'nc' : ''}`}>
            <div className="row between">
              <h3>Frota {i.fleet} - {i.plate}</h3>
              <span className={`pill ${i.status === 'completed' ? 'pill-ok' : 'pill-warn'}`}>{i.status === 'completed' ? 'Concluída' : 'Em andamento'}</span>
            </div>
            <div className="muted">{i.code} - Tag {i.tag} - {formatDateBR(i.date)}{i.revision > 1 ? ` - rev. ${i.revision}` : ''}</div>
            <div>C {s.c} - NC {s.nc} - NA {s.na}{i.status !== 'completed' ? ` - ${s.percent}% completo` : ''}</div>
            <div className="row">
              {i.status === 'completed' ? (
                <>
                  <a className="btn btn-primary btn-small" href={`#/relatorio/${i.id}`}>PDF</a>
                  <a className="btn btn-small" href={`#/consulta/${i.id}`}>Consultar</a>
                  <button className="btn btn-small" onClick={() => reopen(i)}>Reabrir</button>
                </>
              ) : (
                <>
                  <a className="btn btn-primary btn-small" href={`#/vistoria/${i.id}/1`}>Continuar</a>
                  <a className="btn btn-small" href={`#/consulta/${i.id}`}>Consultar</a>
                </>
              )}
              <button className="btn btn-small btn-ghost-danger" onClick={() => remove(i)}>Excluir</button>
            </div>
          </article>
        );
      })}
      {dialog}
    </Layout>
  );
}
