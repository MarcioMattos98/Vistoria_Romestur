export type Answer = 'C' | 'NC' | 'NA';
export type InspectionStatus = 'in_progress' | 'completed' | 'cancelled';

export interface ChecklistItem {
  id: number;
  description: string;
  /** Mínimo de fotografias para a documentação do item ser considerada completa. */
  minPhotos: number;
  /** Se true, marcar NA dispensa as fotografias. Por padrão NÃO dispensa. */
  naExemptsPhotos?: boolean;
}

export interface Vehicle {
  id: string;
  fleet: string;
  plate: string;
  tag: string;
  createdAt: string;
  updatedAt: string;
}

export interface Inspection {
  id: string;
  code: string;
  vehicleId: string;
  /** Cópia dos dados do veículo no momento da vistoria (o relatório não muda se o cadastro mudar). */
  fleet: string;
  plate: string;
  tag: string;
  /** Data local no formato YYYY-MM-DD, gravada ao iniciar. */
  date: string;
  startedAt: string;
  updatedAt: string;
  status: InspectionStatus;
  answers: Partial<Record<number, Answer>>;
  /** Quantidade de fotos por item (mantida na mesma transação que grava a foto). */
  photoCounts: Partial<Record<number, number>>;
  completedAt?: string;
  /** Versão do relatório. Aumenta quando uma vistoria concluída é reaberta. */
  revision: number;
  editLog: { at: string; note: string }[];
}

export interface Photo {
  id: string;
  inspectionId: string;
  itemId: number;
  order: number;
  blob: Blob;
  width: number;
  height: number;
  createdAt: string;
}

export interface ReportRecord {
  id: string;
  inspectionId: string;
  revision: number;
  createdAt: string;
  fileName: string;
  blob: Blob;
}
