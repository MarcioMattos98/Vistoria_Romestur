import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHECKLIST } from '../data/checklist';
import * as db from '../database/db';

const jpg = () => ({ blob: new Blob(['x'], { type: 'image/jpeg' }), width: 640, height: 480 });

beforeEach(async () => {
  await db.closeDB();
  await new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase('vistoria-veicular');
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
});

async function fillAll(id: string, skipPhotosOf: number[] = []) {
  for (const item of CHECKLIST) {
    await db.setAnswer(id, item.id, item.id % 5 === 0 ? 'NC' : 'C');
    if (skipPhotosOf.includes(item.id)) continue;
    for (let n = 0; n < item.minPhotos; n++) await db.addPhoto(id, item.id, jpg());
  }
}

describe('Teste 1 - cadastro', () => {
  it('cadastra, lista e bloqueia duplicidade de frota e placa', async () => {
    await db.saveVehicle({ fleet: '11100', plate: 'abc-1d23', tag: '12345' });
    expect((await db.listVehicles()).map((v) => v.plate)).toEqual(['ABC1D23']);
    await expect(db.saveVehicle({ fleet: '11100', plate: 'ZZZ9Z99', tag: '1' })).rejects.toThrow(/frota 11100/);
    await expect(db.saveVehicle({ fleet: '22200', plate: 'ABC 1D23', tag: '1' })).rejects.toThrow(/placa ABC1D23/);
    await expect(db.saveVehicle({ fleet: '', plate: 'AAA1A11', tag: '1' })).rejects.toThrow(/Preencha/);
  });

  it('permite editar sem acusar duplicidade consigo mesmo', async () => {
    const v = await db.saveVehicle({ fleet: '1', plate: 'AAA1A11', tag: 't' });
    const e = await db.saveVehicle({ id: v.id, fleet: '1', plate: 'AAA1A11', tag: 'novo' });
    expect(e.tag).toBe('novo');
    expect(await db.listVehicles()).toHaveLength(1);
  });
});

describe('Teste 2 e 3 - vistorias simultâneas e persistência', () => {
  it('duas vistorias pendentes ficam independentes e sobrevivem ao fechamento do banco', async () => {
    const a = await db.saveVehicle({ fleet: 'A', plate: 'AAA1A11', tag: '1' });
    const b = await db.saveVehicle({ fleet: 'B', plate: 'BBB2B22', tag: '2' });
    const ia = await db.createInspection(a);
    const ib = await db.createInspection(b);

    await db.setAnswer(ia.id, 1, 'C');
    await db.addPhoto(ia.id, 1, jpg());
    await db.setAnswer(ib.id, 1, 'NC');
    await db.addPhoto(ib.id, 11, jpg());
    await db.addPhoto(ib.id, 11, jpg());

    await db.closeDB(); // simula fechar e reabrir o app

    const pend = (await db.listInspections()).filter((i) => i.status === 'in_progress');
    expect(pend).toHaveLength(2);
    const ra = await db.getInspection(ia.id);
    const rb = await db.getInspection(ib.id);
    expect(ra?.answers[1]).toBe('C');
    expect(rb?.answers[1]).toBe('NC');
    expect(ra?.photoCounts).toEqual({ 1: 1 });
    expect(rb?.photoCounts).toEqual({ 11: 2 });
    expect(await db.listPhotos(ia.id)).toHaveLength(1);
    expect(await db.listPhotos(ib.id)).toHaveLength(2);
    expect((await db.listPhotos(ib.id, 11)).map((p) => p.order)).toEqual([1, 2]);
  });

  it('excluir uma vistoria não afeta a outra', async () => {
    const a = await db.saveVehicle({ fleet: 'A', plate: 'AAA1A11', tag: '1' });
    const b = await db.saveVehicle({ fleet: 'B', plate: 'BBB2B22', tag: '2' });
    const ia = await db.createInspection(a);
    const ib = await db.createInspection(b);
    await db.addPhoto(ia.id, 1, jpg());
    await db.addPhoto(ib.id, 1, jpg());
    await db.deleteInspection(ia.id);
    expect(await db.listPhotos(ia.id)).toHaveLength(0);
    expect(await db.listPhotos(ib.id)).toHaveLength(1);
  });

  it('excluir foto atualiza o contador e substituir mantém a ordem', async () => {
    const v = await db.saveVehicle({ fleet: 'A', plate: 'AAA1A11', tag: '1' });
    const i = await db.createInspection(v);
    await db.addPhoto(i.id, 25, jpg());
    await db.addPhoto(i.id, 25, jpg());
    const [p1, p2] = await db.listPhotos(i.id, 25);
    const after = await db.addPhoto(i.id, 25, jpg(), p1.id);
    expect(after.photoCounts[25]).toBe(2);
    expect((await db.listPhotos(i.id, 25)).map((p) => p.id)).toEqual([p1.id, p2.id]);
    const del = await db.deletePhoto(p1.id);
    expect(del.photoCounts[25]).toBe(1);
  });

  it('veículo com vistoria pendente não pode ser excluído', async () => {
    const v = await db.saveVehicle({ fleet: 'A', plate: 'AAA1A11', tag: '1' });
    await db.createInspection(v);
    await expect(db.deleteVehicle(v.id)).rejects.toThrow(/pendente/);
  });
});

describe('Testes 4 e 5 - fotos obrigatórias e conclusão', () => {
  it('não conclui com respostas pendentes e informa os itens', async () => {
    const v = await db.saveVehicle({ fleet: 'A', plate: 'AAA1A11', tag: '1' });
    const i = await db.createInspection(v);
    await expect(db.completeInspection(i.id)).rejects.toThrow(/Item 1: sem resposta/);
  });

  it('não conclui com fotos pendentes (itens de 1, 2, 3 e 4 fotos)', async () => {
    const v = await db.saveVehicle({ fleet: 'A', plate: 'AAA1A11', tag: '1' });
    const i = await db.createInspection(v);
    await fillAll(i.id, [1, 11, 23, 25]);
    await expect(db.completeInspection(i.id)).rejects.toThrow(/Item 1: faltam 1 foto.*Item 11: faltam 2 fotos.*Item 23: faltam 3 fotos.*Item 25: faltam 4 fotos/s);
    // completa parcialmente o item de 4 fotos: ainda pendente
    for (let n = 0; n < 3; n++) await db.addPhoto(i.id, 25, jpg());
    await expect(db.completeInspection(i.id)).rejects.toThrow(/Item 25: faltam 1 foto/);
  });

  it('conclui quando tudo está correto e bloqueia alterações depois', async () => {
    const v = await db.saveVehicle({ fleet: 'A', plate: 'AAA1A11', tag: '1' });
    const i = await db.createInspection(v);
    await fillAll(i.id);
    const done = await db.completeInspection(i.id);
    expect(done.status).toBe('completed');
    await expect(db.setAnswer(i.id, 1, 'NC')).rejects.toThrow(/concluída/);
    // reabrir cria nova revisão e registra a alteração
    const re = await db.reopenInspection(i.id);
    expect(re.status).toBe('in_progress');
    expect(re.revision).toBe(2);
    expect(re.editLog).toHaveLength(1);
  });
});
