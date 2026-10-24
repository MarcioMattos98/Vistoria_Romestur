import { createInspection, listInspections } from '../database/db';
import type { Vehicle } from '../types';

type Confirm = (o: { title?: string; message: string; confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>;

/**
 * Inicia a vistoria de um veículo e devolve o id para navegar.
 * Vistorias pendentes de OUTROS veículos nunca bloqueiam. Se o MESMO veículo já tem uma pendente,
 * pergunta se o usuário quer continuar a existente ou criar outra.
 */
export async function startInspection(v: Vehicle, confirm: Confirm): Promise<string> {
  const existing = (await listInspections()).find((i) => i.vehicleId === v.id && i.status === 'in_progress');
  if (existing) {
    const keep = await confirm({
      title: 'Vistoria pendente deste veículo',
      message: `A frota ${v.fleet} já tem uma vistoria em andamento (${existing.code}). Deseja continuar a existente?`,
      confirmLabel: 'Continuar pendente',
      cancelLabel: 'Criar nova',
    });
    if (keep) return existing.id;
  }
  return (await createInspection(v)).id;
}
