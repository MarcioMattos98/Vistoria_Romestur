import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { deleteVehicle, listVehicles, saveVehicle } from '../database/db';
import { startInspection } from '../services/startInspection';
import type { Vehicle } from '../types';
import { friendlyError } from '../utils/errors';
import { normalizePlate } from '../utils/format';
import { navigate } from '../hooks/useRoute';

export default function Vehicles({ openForm }: { openForm: boolean }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(openForm ? 'new' : null);
  const [fleet, setFleet] = useState('');
  const [plate, setPlate] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      setVehicles(await listVehicles());
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  }, [toast]);
  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const qp = normalizePlate(query);
    if (!q) return vehicles;
    return vehicles.filter(
      (v) => v.fleet.toUpperCase().includes(q) || v.tag.toUpperCase().includes(q) || (qp && normalizePlate(v.plate).includes(qp))
    );
  }, [vehicles, query]);

  const openEditor = (v: Vehicle | 'new') => {
    setEditing(v);
    setError('');
    if (v === 'new') {
      setFleet('');
      setPlate('');
      setTag('');
    } else {
      setFleet(v.fleet);
      setPlate(v.plate);
      setTag(v.tag);
    }
  };
  useEffect(() => {
    if (openForm) openEditor('new');
  }, [openForm]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const saved = await saveVehicle({ id: editing && editing !== 'new' ? editing.id : undefined, fleet, plate, tag });
      toast(`Veículo ${saved.fleet} salvo`);
      setEditing(null);
      await load();
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const remove = async (v: Vehicle) => {
    const ok = await confirm({
      title: 'Excluir veículo?',
      message: `Remover a frota ${v.fleet} (${v.plate})? As vistorias já concluídas continuam no histórico.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteVehicle(v.id);
      toast('Veículo excluído');
      await load();
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  };

  const inspect = async (v: Vehicle) => {
    try {
      const id = await startInspection(v, confirm);
      navigate(`/vistoria/${id}/1`);
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  };

  return (
    <Layout title="Veículos" back="/">
      {editing ? (
        <form className="card" onSubmit={submit} noValidate>
          <h2>{editing === 'new' ? 'Cadastrar veículo' : 'Editar veículo'}</h2>
          <div className="field">
            <label htmlFor="fleet">Número de frota</label>
            <input id="fleet" className="input" value={fleet} onChange={(e) => setFleet(e.target.value)} inputMode="numeric" autoComplete="off" required />
          </div>
          <div className="field">
            <label htmlFor="plate">Placa</label>
            <input id="plate" className="input" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" maxLength={8} required />
          </div>
          <div className="field">
            <label htmlFor="tag">Tag</label>
            <input id="tag" className="input" value={tag} onChange={(e) => setTag(e.target.value)} autoComplete="off" required />
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <div className="row">
            <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Salvar veículo</button>
          </div>
        </form>
      ) : (
        <>
          <button className="btn btn-primary btn-block" onClick={() => openEditor('new')}>Cadastrar veículo</button>
          <input className="input" type="search" placeholder="Pesquisar por frota, placa ou tag" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Pesquisar veículos" />
          {filtered.length === 0 && <div className="card empty">{vehicles.length === 0 ? 'Nenhum veículo cadastrado ainda.' : 'Nenhum veículo encontrado.'}</div>}
          {filtered.map((v) => (
            <article className="card" key={v.id}>
              <div className="row between">
                <h3>Frota {v.fleet}</h3>
                <span className="muted">Placa {v.plate} &nbsp; Tag {v.tag}</span>
              </div>
              <div className="row">
                <button className="btn btn-primary btn-small" style={{ flex: 1 }} onClick={() => inspect(v)}>Vistoriar</button>
                <button className="btn btn-small" onClick={() => openEditor(v)}>Editar</button>
                <button className="btn btn-small btn-ghost-danger" onClick={() => remove(v)}>Excluir</button>
              </div>
            </article>
          ))}
        </>
      )}
      {dialog}
    </Layout>
  );
}
