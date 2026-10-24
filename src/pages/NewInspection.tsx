import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { listVehicles } from '../database/db';
import { navigate } from '../hooks/useRoute';
import { startInspection } from '../services/startInspection';
import type { Vehicle } from '../types';
import { friendlyError } from '../utils/errors';
import { normalizePlate } from '../utils/format';

export default function NewInspection() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [query, setQuery] = useState('');
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    listVehicles().then(setVehicles).catch((e) => {
      toast(friendlyError(e), 'error');
      setVehicles([]);
    });
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const qp = normalizePlate(query);
    if (!q || !vehicles) return vehicles ?? [];
    return vehicles.filter((v) => v.fleet.toUpperCase().includes(q) || v.tag.toUpperCase().includes(q) || (qp && normalizePlate(v.plate).includes(qp)));
  }, [vehicles, query]);

  const start = async (v: Vehicle) => {
    try {
      const id = await startInspection(v, confirm);
      navigate(`/vistoria/${id}/1`);
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  return (
    <Layout title="Nova vistoria" back="/">
      <p className="muted">Selecione o veículo que será vistoriado.</p>
      <input className="input" type="search" placeholder="Pesquisar por frota, placa ou tag" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Pesquisar veículos" />
      {vehicles && vehicles.length === 0 && (
        <div className="card empty">
          Nenhum veículo cadastrado.
          <br />
          <a className="btn btn-primary" style={{ marginTop: 10 }} href="#/veiculos?novo">Cadastrar veículo</a>
        </div>
      )}
      {filtered.map((v) => (
        <button key={v.id} className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => start(v)}>
          <h3>Frota {v.fleet}</h3>
          <span className="muted">Placa {v.plate} &nbsp; Tag {v.tag}</span>
        </button>
      ))}
      {dialog}
    </Layout>
  );
}
