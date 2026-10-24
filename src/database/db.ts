import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Answer, Inspection, Photo, ReportRecord, Vehicle } from '../types';
import { AppError } from '../utils/errors';
import { newId, newInspectionCode, normalizeFleet, normalizePlate, todayLocal } from '../utils/format';
import { pendingText, summarize } from '../utils/progress';

interface Schema extends DBSchema {
  vehicles: { key: string; value: Vehicle };
  inspections: {
    key: string;
    value: Inspection;
    indexes: { 'by-status': string; 'by-vehicle': string };
  };
  photos: { key: string; value: Photo; indexes: { 'by-inspection': string } };
  reports: { key: string; value: ReportRecord; indexes: { 'by-inspection': string } };
}
type DB = IDBPDatabase<Schema>;

const DB_NAME = 'vistoria-veicular';
const DB_VERSION = 1;
let dbPromise: Promise<DB> | null = null;

export function getDB(): Promise<DB> {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('vehicles', { keyPath: 'id' });
        const insp = db.createObjectStore('inspections', { keyPath: 'id' });
        insp.createIndex('by-status', 'status');
        insp.createIndex('by-vehicle', 'vehicleId');
        const photos = db.createObjectStore('photos', { keyPath: 'id' });
        photos.createIndex('by-inspection', 'inspectionId');
        const reports = db.createObjectStore('reports', { keyPath: 'id' });
        reports.createIndex('by-inspection', 'inspectionId');
      },
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

export async function closeDB(): Promise<void> {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
}

/* ------------------------------ Veículos ------------------------------ */

export async function listVehicles(): Promise<Vehicle[]> {
  const all = await (await getDB()).getAll('vehicles');
  return all.sort((a, b) => a.fleet.localeCompare(b.fleet, 'pt-BR', { numeric: true }));
}

export async function saveVehicle(input: { id?: string; fleet: string; plate: string; tag: string }): Promise<Vehicle> {
  const fleet = input.fleet.trim();
  const plate = normalizePlate(input.plate);
  const tag = input.tag.trim();
  if (!fleet || !plate || !tag) throw new AppError('Preencha número de frota, placa e tag.');

  const db = await getDB();
  const tx = db.transaction('vehicles', 'readwrite');
  const all = await tx.store.getAll();
  for (const v of all) {
    if (v.id === input.id) continue;
    if (normalizeFleet(v.fleet) === normalizeFleet(fleet)) {
      throw new AppError(`Já existe um veículo cadastrado com a frota ${fleet}.`);
    }
    if (normalizePlate(v.plate) === plate) {
      throw new AppError(`Já existe um veículo cadastrado com a placa ${plate}.`);
    }
  }
  const now = new Date().toISOString();
  const existing = all.find((v) => v.id === input.id);
  const vehicle: Vehicle = {
    id: existing?.id ?? newId(),
    fleet, plate, tag,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await tx.store.put(vehicle);
  await tx.done;
  return vehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
  const db = await getDB();
  const insps = await db.getAllFromIndex('inspections', 'by-vehicle', id);
  if (insps.some((i) => i.status === 'in_progress')) {
    throw new AppError('Este veículo tem vistoria pendente. Conclua ou exclua a vistoria antes de remover o veículo.');
  }
  await db.delete('vehicles', id);
}

/* ------------------------------ Vistorias ------------------------------ */

export async function createInspection(v: Vehicle): Promise<Inspection> {
  const now = new Date();
  const insp: Inspection = {
    id: newId(),
    code: newInspectionCode(now),
    vehicleId: v.id,
    fleet: v.fleet, plate: v.plate, tag: v.tag,
    date: todayLocal(now),
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: 'in_progress',
    answers: {},
    photoCounts: {},
    revision: 1,
    editLog: [],
  };
  const db = await getDB();
  await db.put('inspections', insp);
  return insp;
}

export async function getInspection(id: string): Promise<Inspection | undefined> {
  return (await getDB()).get('inspections', id);
}

export async function listInspections(): Promise<Inspection[]> {
  const all = await (await getDB()).getAll('inspections');
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

async function mutateInspection(id: string, fn: (i: Inspection) => void): Promise<Inspection> {
  const db = await getDB();
  const tx = db.transaction('inspections', 'readwrite');
  const insp = await tx.store.get(id);
  if (!insp) throw new AppError('Vistoria não encontrada.');
  fn(insp);
  insp.updatedAt = new Date().toISOString();
  await tx.store.put(insp);
  await tx.done;
  return insp;
}

export async function setAnswer(id: string, itemId: number, answer: Answer): Promise<Inspection> {
  return mutateInspection(id, (i) => {
    if (i.status !== 'in_progress') throw new AppError('Esta vistoria já foi concluída.');
    i.answers[itemId] = answer;
  });
}

/* ------------------------------ Fotografias ------------------------------ */

export async function listPhotos(inspectionId: string, itemId?: number): Promise<Photo[]> {
  const all = await (await getDB()).getAllFromIndex('photos', 'by-inspection', inspectionId);
  return all
    .filter((p) => itemId === undefined || p.itemId === itemId)
    .sort((a, b) => a.itemId - b.itemId || a.order - b.order);
}

/** Grava a foto e atualiza o contador do item na MESMA transação. */
export async function addPhoto(
  inspectionId: string,
  itemId: number,
  data: { blob: Blob; width: number; height: number },
  replaceId?: string
): Promise<Inspection> {
  const db = await getDB();
  const tx = db.transaction(['photos', 'inspections'], 'readwrite');
  const insp = await tx.objectStore('inspections').get(inspectionId);
  if (!insp) throw new AppError('Vistoria não encontrada.');
  if (insp.status !== 'in_progress') throw new AppError('Esta vistoria já foi concluída.');
  const photosStore = tx.objectStore('photos');
  const now = new Date().toISOString();

  if (replaceId) {
    const old = await photosStore.get(replaceId);
    if (!old || old.inspectionId !== inspectionId || old.itemId !== itemId) {
      throw new AppError('Fotografia não encontrada para substituição.');
    }
    await photosStore.put({ ...old, ...data, createdAt: now });
  } else {
    const existing = (await photosStore.index('by-inspection').getAll(inspectionId)).filter((p) => p.itemId === itemId);
    const order = existing.reduce((m, p) => Math.max(m, p.order), 0) + 1;
    await photosStore.add({ id: newId(), inspectionId, itemId, order, createdAt: now, ...data });
    insp.photoCounts[itemId] = existing.length + 1;
  }
  insp.updatedAt = now;
  await tx.objectStore('inspections').put(insp);
  await tx.done;
  return insp;
}

export async function deletePhoto(photoId: string): Promise<Inspection> {
  const db = await getDB();
  const tx = db.transaction(['photos', 'inspections'], 'readwrite');
  const photo = await tx.objectStore('photos').get(photoId);
  if (!photo) throw new AppError('Fotografia não encontrada.');
  const insp = await tx.objectStore('inspections').get(photo.inspectionId);
  if (!insp) throw new AppError('Vistoria não encontrada.');
  if (insp.status !== 'in_progress') throw new AppError('Esta vistoria já foi concluída.');
  await tx.objectStore('photos').delete(photoId);
  insp.photoCounts[photo.itemId] = Math.max(0, (insp.photoCounts[photo.itemId] ?? 1) - 1);
  insp.updatedAt = new Date().toISOString();
  await tx.objectStore('inspections').put(insp);
  await tx.done;
  return insp;
}

/* ------------------------------ Conclusão e edição ------------------------------ */

export async function completeInspection(id: string): Promise<Inspection> {
  return mutateInspection(id, (i) => {
    const s = summarize(i);
    if (s.pending.length > 0) {
      throw new AppError('Existem pendências:\n' + s.pending.map(pendingText).join('\n'));
    }
    i.status = 'completed';
    i.completedAt = new Date().toISOString();
  });
}

/** Reabre uma vistoria concluída. O relatório anterior continua guardado; o próximo será uma nova revisão. */
export async function reopenInspection(id: string): Promise<Inspection> {
  return mutateInspection(id, (i) => {
    if (i.status !== 'completed') throw new AppError('Só é possível reabrir vistorias concluídas.');
    i.status = 'in_progress';
    i.completedAt = undefined;
    i.revision += 1;
    i.editLog.push({ at: new Date().toISOString(), note: `Reaberta para edição (revisão ${i.revision})` });
  });
}

export async function deleteInspection(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['inspections', 'photos', 'reports'], 'readwrite');
  const photoKeys = await tx.objectStore('photos').index('by-inspection').getAllKeys(id);
  for (const k of photoKeys) await tx.objectStore('photos').delete(k);
  const reportKeys = await tx.objectStore('reports').index('by-inspection').getAllKeys(id);
  for (const k of reportKeys) await tx.objectStore('reports').delete(k);
  await tx.objectStore('inspections').delete(id);
  await tx.done;
}

/* ------------------------------ Relatórios ------------------------------ */

export const reportId = (inspectionId: string, revision: number) => `${inspectionId}:${revision}`;

export async function saveReport(r: Omit<ReportRecord, 'id'>): Promise<void> {
  await (await getDB()).put('reports', { ...r, id: reportId(r.inspectionId, r.revision) });
}

export async function listReports(inspectionId: string): Promise<ReportRecord[]> {
  const all = await (await getDB()).getAllFromIndex('reports', 'by-inspection', inspectionId);
  return all.sort((a, b) => b.revision - a.revision);
}

/* ------------------------------ Backup / armazenamento ------------------------------ */

export async function getAllForBackup() {
  const db = await getDB();
  return {
    vehicles: await db.getAll('vehicles'),
    inspections: await db.getAll('inspections'),
    photos: await db.getAll('photos'),
  };
}

export async function importAll(data: { vehicles: Vehicle[]; inspections: Inspection[]; photos: Photo[] }): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['vehicles', 'inspections', 'photos'], 'readwrite');
  for (const v of data.vehicles) await tx.objectStore('vehicles').put(v);
  for (const i of data.inspections) await tx.objectStore('inspections').put(i);
  for (const p of data.photos) await tx.objectStore('photos').put(p);
  await tx.done;
}

export async function storageInfo(): Promise<{ usage?: number; quota?: number; persisted?: boolean }> {
  if (!navigator.storage) return {};
  const est = navigator.storage.estimate ? await navigator.storage.estimate() : {};
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : undefined;
  return { usage: est.usage, quota: est.quota, persisted };
}

export async function requestPersistence(): Promise<boolean> {
  try {
    return navigator.storage?.persist ? await navigator.storage.persist() : false;
  } catch {
    return false;
  }
}
