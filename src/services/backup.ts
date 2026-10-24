import { getAllForBackup, importAll } from '../database/db';
import type { Inspection, Photo, Vehicle } from '../types';
import { AppError } from '../utils/errors';
import { todayLocal } from '../utils/format';
import { blobToDataURL } from './photos';

interface BackupFile {
  app: 'vistoria-veicular';
  version: 1;
  exportedAt: string;
  vehicles: Vehicle[];
  inspections: Inspection[];
  photos: (Omit<Photo, 'blob'> & { data: string })[];
}

/** Gera o backup completo (veículos, vistorias e fotografias) como arquivo JSON. */
export async function exportBackup(): Promise<{ blob: Blob; fileName: string }> {
  const { vehicles, inspections, photos } = await getAllForBackup();
  const encoded: BackupFile['photos'] = [];
  for (const p of photos) {
    const { blob, ...rest } = p;
    encoded.push({ ...rest, data: await blobToDataURL(blob) });
  }
  const file: BackupFile = {
    app: 'vistoria-veicular', version: 1, exportedAt: new Date().toISOString(),
    vehicles, inspections, photos: encoded,
  };
  return {
    blob: new Blob([JSON.stringify(file)], { type: 'application/json' }),
    fileName: `Backup_Vistorias_${todayLocal()}.json`,
  };
}

/** Restaura um backup. Registros com o mesmo identificador são sobrescritos; os demais são mantidos. */
export async function importBackup(file: File): Promise<{ vehicles: number; inspections: number; photos: number }> {
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(await file.text()) as BackupFile;
  } catch {
    throw new AppError('Arquivo inválido: não é um backup do aplicativo.');
  }
  if (parsed.app !== 'vistoria-veicular' || !Array.isArray(parsed.vehicles) || !Array.isArray(parsed.inspections)) {
    throw new AppError('Arquivo inválido: não é um backup do aplicativo.');
  }
  const photos: Photo[] = [];
  for (const p of parsed.photos ?? []) {
    const { data, ...rest } = p;
    const blob = await (await fetch(data)).blob();
    photos.push({ ...rest, blob });
  }
  await importAll({ vehicles: parsed.vehicles, inspections: parsed.inspections, photos });
  return { vehicles: parsed.vehicles.length, inspections: parsed.inspections.length, photos: photos.length };
}
