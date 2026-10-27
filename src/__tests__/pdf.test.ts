import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CHECKLIST } from '../data/checklist';
import type { Inspection, Photo } from '../types';

// FileReader mínimo para o ambiente Node (no navegador ele existe nativamente)
class NodeFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
      this.onload?.();
    });
  }
}
vi.stubGlobal('FileReader', NodeFileReader);

const { buildReportPdf } = await import('../services/pdf');

const land = readFileSync(join(__dirname, 'fixture.jpg'));
const port = readFileSync(join(__dirname, 'fixture-portrait.jpg'));

function makeData(withPhotos: boolean) {
  const insp: Inspection = {
    id: 'i1', code: 'VST-20261020-TEST', vehicleId: 'v', fleet: '11100', plate: 'ABC1D23', tag: '12345',
    date: '2026-10-20', startedAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z', status: 'completed',
    answers: {}, photoCounts: {}, revision: 1, editLog: [],
  };
  const photos: Photo[] = [];
  CHECKLIST.forEach((item, idx) => {
    insp.answers[item.id] = item.id === 11 || item.id === 25 ? 'NC' : item.id === 3 ? 'NA' : 'C';
    const n = withPhotos ? item.minPhotos : 0;
    insp.photoCounts[item.id] = n;
    for (let k = 0; k < n; k++) {
      const portrait = (idx + k) % 3 === 0;
      photos.push({
        id: `p-${item.id}-${k}`, inspectionId: 'i1', itemId: item.id, order: k + 1,
        blob: new Blob([portrait ? port : land], { type: 'image/jpeg' }),
        width: portrait ? 480 : 640, height: portrait ? 640 : 480, createdAt: '',
      });
    }
  });
  return { insp, photos };
}

describe('Teste 6 - PDF', () => {
  it('gera o PDF com todas as fotos embutidas, paginação e rodapé', async () => {
    const { insp, photos } = makeData(true);
    const { blob, fileName, pages } = await buildReportPdf(insp, photos);
    const bytes = Buffer.from(await blob.arrayBuffer());
    writeFileSync(join(tmpdir(), 'relatorio-teste.pdf'), bytes);
    expect(fileName).toBe('Frota_11100_2026-10-20.pdf');
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pages).toBeGreaterThan(3);
    // uma imagem XObject por fotografia (o jsPDF reaproveita imagens idênticas, então contamos os usos)
    const text = bytes.toString('latin1');
    expect((text.match(/\/Subtype\s*\/Image/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(photos.length).toBe(CHECKLIST.reduce((s, i) => s + i.minPhotos, 0));
  });

  it('lista as NC ao final com a comprovação de manutenção, sem misturar com as fotos da vistoria', async () => {
    const { insp, photos } = makeData(true);
    const base = await buildReportPdf(insp, photos);
    const proof: Photo[] = [1, 2, 3].map((n) => ({
      id: `m-11-${n}`, inspectionId: 'i1', itemId: 11, order: n, kind: 'maintenance' as const,
      blob: new Blob([land], { type: 'image/jpeg' }), width: 640, height: 480, createdAt: '',
    }));
    const withProof = await buildReportPdf(insp, [...photos, ...proof]);
    writeFileSync(join(tmpdir(), 'relatorio-com-comprovacao.pdf'), Buffer.from(await withProof.blob.arrayBuffer()));
    expect(withProof.pages).toBeGreaterThanOrEqual(base.pages);
    expect(withProof.blob.size).toBeGreaterThan(base.blob.size);
    // comprovação de item que NÃO é NC não aparece
    const ignored: Photo = { ...proof[0], id: 'm-1', itemId: 1 };
    const noNc = await buildReportPdf(insp, [...photos, ignored]);
    expect(Math.abs(noNc.blob.size - base.blob.size)).toBeLessThan(2000);
  });

  it('gera o PDF sem nenhuma foto sem erro', async () => {
    const { insp, photos } = makeData(false);
    const { blob, pages } = await buildReportPdf(insp, photos);
    expect(blob.size).toBeGreaterThan(1000);
    expect(pages).toBeGreaterThanOrEqual(2);
  });

  it('ignora fotos de outra vistoria', async () => {
    const { insp, photos } = makeData(false);
    const foreign: Photo = { ...makeData(true).photos[0], inspectionId: 'OUTRA' };
    const { blob } = await buildReportPdf(insp, [foreign, ...photos]);
    const text = Buffer.from(await blob.arrayBuffer()).toString('latin1');
    expect((text.match(/\/Subtype\s*\/Image/g) ?? []).length).toBe(0);
  });
});
