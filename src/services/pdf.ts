import { jsPDF } from 'jspdf';
import { CHECKLIST } from '../data/checklist';
import type { Answer, ChecklistItem, Inspection, Photo } from '../types';
import { formatDateBR, formatDateTimeBR, reportFileName } from '../utils/format';
import { summarize } from '../utils/progress';
import { blobToDataURL } from './photos';

/* ---------- Medidas (mm, A4 retrato) ---------- */
const W = 210;
const H = 297;
const M = 12;
const CW = W - 2 * M; // 186
const COL_ITEM = 62;
const COL_COND = 22;
const COL_PHOTO = CW - COL_ITEM - COL_COND; // 102
const BOTTOM = H - 24; // área útil termina aqui; abaixo fica o rodapé
const HEADER_ROW = 8;
const MIN_ROW = 14;
const GAP = 3;

/* Seção de não conformidades */
const NC_COL_ITEM = 40;
const NC_COL_NC = 56;
const NC_COL_PROOF = CW - NC_COL_ITEM - NC_COL_NC; // 90
const NC_BW = 24;
const NC_BH = 18;
const PR_BW = 40;
const PR_BH = 30;
const MIN_NC_ROW = 22;

const COLORS = {
  ink: [23, 37, 42] as const,
  teal: [15, 82, 87] as const,
  grey: [110, 120, 126] as const,
  line: [185, 192, 196] as const,
  green: [31, 122, 61] as const,
  greenBg: [226, 244, 232] as const,
  red: [180, 35, 24] as const,
  redBg: [253, 236, 234] as const,
  slate: [91, 103, 112] as const,
  slateBg: [232, 235, 237] as const,
};

type RGB = readonly [number, number, number];
const fill = (d: jsPDF, c: RGB) => d.setFillColor(c[0], c[1], c[2]);
const stroke = (d: jsPDF, c: RGB) => d.setDrawColor(c[0], c[1], c[2]);
const ink = (d: jsPDF, c: RGB) => d.setTextColor(c[0], c[1], c[2]);

const ANSWER_LABEL: Record<Answer, string> = { C: 'Conforme', NC: 'Não conforme', NA: 'Não aplica' };

interface Logo {
  url: string;
  w: number;
  h: number;
  fmt: 'PNG' | 'JPEG';
}

/** Logomarca da empresa: arquivo public/logo.png. Se não existir, o relatório sai sem ela. */
async function loadLogo(): Promise<Logo | null> {
  try {
    const r = await fetch('/logo.png', { cache: 'no-cache' });
    if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) return null;
    const blob = await r.blob();
    const bmp = await createImageBitmap(blob);
    const logo: Logo = { url: await blobToDataURL(blob), w: bmp.width, h: bmp.height, fmt: blob.type.includes('png') ? 'PNG' : 'JPEG' };
    bmp.close();
    return logo;
  } catch {
    return null;
  }
}

function containBox(pw: number, ph: number, bw: number, bh: number) {
  const s = Math.min(bw / pw, bh / ph);
  return { w: pw * s, h: ph * s };
}

export async function buildReportPdf(
  insp: Inspection,
  photos: Photo[]
): Promise<{ blob: Blob; fileName: string; pages: number }> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: `Relatório de vistoria ${insp.code}`, subject: `Frota ${insp.fleet} - ${insp.plate}` });
  const logo = await loadLogo();
  const generatedAt = new Date().toISOString();

  // Separa fotos da vistoria e comprovações de manutenção, sempre só desta vistoria
  const byItem = new Map<number, Photo[]>();
  const proofByItem = new Map<number, Photo[]>();
  for (const p of [...photos].sort((a, b) => a.order - b.order)) {
    if (p.inspectionId !== insp.id) continue; // proteção: nunca misturar vistorias
    const target = p.kind === 'maintenance' ? proofByItem : byItem;
    target.set(p.itemId, [...(target.get(p.itemId) ?? []), p]);
  }

  let y = M;
  let pageTop = M;
  let mode: 'main' | 'nc' = 'main';

  /** Desenha uma grade de fotos (com a proporção original) e numera cada uma. */
  async function drawPhotoGrid(
    chunk: Photo[], itemId: number, firstNumber: number, prefix: string,
    x0: number, colW: number, perRow: number, bw: number, bh: number, top: number
  ) {
    const gridW = perRow * bw + (perRow - 1) * GAP;
    const gx = x0 + (colW - gridW) / 2;
    for (let i = 0; i < chunk.length; i++) {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      const bx = gx + c * (bw + GAP);
      const by = top + GAP + r * (bh + GAP);
      const p = chunk[i];
      const dim = containBox(p.width, p.height, bw, bh);
      stroke(doc, COLORS.line);
      doc.setLineWidth(0.2);
      doc.rect(bx, by, bw, bh);
      const url = await blobToDataURL(p.blob);
      doc.addImage(url, 'JPEG', bx + (bw - dim.w) / 2, by + (bh - dim.h) / 2, dim.w, dim.h, undefined, 'FAST');
      // numeração no canto (ex.: 11.2 = item 11, foto 2; M11.1 = comprovação de manutenção)
      const label = `${prefix}${itemId}.${firstNumber + i}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      fill(doc, [255, 255, 255]);
      doc.rect(bx, by, doc.getTextWidth(label) + 2, 4.2, 'F');
      ink(doc, COLORS.ink);
      doc.text(label, bx + 1, by + 3.1);
    }
  }

  /* ---------- Cabeçalho do documento (com logomarca) ---------- */
  function drawDocHeader() {
    if (logo) {
      const b = containBox(logo.w, logo.h, 64, 14);
      doc.addImage(logo.url, logo.fmt, M, y, b.w, b.h, undefined, 'FAST');
      y += b.h + 4;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    ink(doc, COLORS.teal);
    doc.text('RELATÓRIO DE VISTORIA VEICULAR', M, y + 5);
    y += 9;
    stroke(doc, COLORS.teal);
    doc.setLineWidth(0.6);
    doc.line(M, y, W - M, y);
    y += 5;

    const rows: [string, string][][] = [
      [['Código da vistoria', insp.code], ['Data da vistoria', formatDateBR(insp.date)]],
      [['Número de frota', insp.fleet], ['Placa', insp.plate]],
      [['Tag', insp.tag], ['Documento gerado em', formatDateTimeBR(generatedAt)]],
    ];
    if (insp.revision > 1) rows.push([['Revisão do relatório', String(insp.revision)], ['', '']]);
    for (const row of rows) {
      row.forEach(([label, value], i) => {
        if (!label) return;
        const x = M + i * (CW / 2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        ink(doc, COLORS.grey);
        doc.text(`${label}:`, x, y + 3);
        doc.setFontSize(10);
        ink(doc, COLORS.ink);
        doc.text(value, x + 38, y + 3);
      });
      y += 6;
    }
    y += 3;

    const s = summarize(insp);
    const boxes: [string, number, RGB, RGB][] = [
      ['Conformes (C)', s.c, COLORS.green, COLORS.greenBg],
      ['Não conformes (NC)', s.nc, COLORS.red, COLORS.redBg],
      ['Não aplica (NA)', s.na, COLORS.slate, COLORS.slateBg],
      ['Total inspecionado', s.total, COLORS.teal, [226, 238, 239]],
    ];
    const bw = (CW - 3 * 3) / 4;
    boxes.forEach(([label, n, fg, bg], i) => {
      const x = M + i * (bw + 3);
      fill(doc, bg);
      stroke(doc, fg);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, bw, 14, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      ink(doc, fg);
      doc.text(String(n), x + 4, y + 9.5);
      doc.setFontSize(8);
      doc.text(label, x + 14, y + 8.5);
    });
    y += 14 + 6;
  }

  /* ---------- Cabeçalhos de tabela (repetidos em todas as páginas) ---------- */
  function drawTableHeader() {
    fill(doc, COLORS.teal);
    doc.rect(M, y, CW, HEADER_ROW, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('Item inspecionado', M + 2, y + 5.4);
    doc.text('Condição', M + COL_ITEM + COL_COND / 2, y + 5.4, { align: 'center' });
    doc.text('Registro fotográfico', M + COL_ITEM + COL_COND + 3, y + 5.4);
    y += HEADER_ROW;
    pageTop = y;
  }

  function drawNcTableHeader() {
    fill(doc, COLORS.red);
    doc.rect(M, y, CW, HEADER_ROW, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('Item não conforme', M + 2, y + 5.4);
    doc.text('Registro da não conformidade', M + NC_COL_ITEM + 2, y + 5.4);
    doc.text('Comprovação da manutenção', M + NC_COL_ITEM + NC_COL_NC + 2, y + 5.4);
    y += HEADER_ROW;
    pageTop = y;
  }

  /** Página nova com cabeçalho corrido (código, frota, placa, data e logo pequena). */
  function startPage() {
    doc.addPage();
    y = M;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    ink(doc, COLORS.grey);
    doc.text(`Vistoria ${insp.code}  |  Frota ${insp.fleet}  |  Placa ${insp.plate}  |  ${formatDateBR(insp.date)}`, M, y + 3);
    if (logo) {
      const b = containBox(logo.w, logo.h, 30, 5);
      doc.addImage(logo.url, logo.fmt, W - M - b.w, y, b.w, b.h, undefined, 'FAST');
    }
    y += 7;
  }

  function newPage() {
    startPage();
    if (mode === 'main') drawTableHeader();
    else drawNcTableHeader();
  }

  /* ---------- Linha de um item da vistoria ---------- */
  async function drawItem(item: ChecklistItem, answer: Answer | undefined, itemPhotos: Photo[]) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(`${item.id}. ${item.description}`, COL_ITEM - 5) as string[];
    const textH = lines.length * 4.3 + 5;

    const single = itemPhotos.length === 1;
    const perRow = single ? 1 : 2;
    const bw = single ? 72 : 48;
    const bh = single ? 54 : 36;
    const totalRows = Math.ceil(itemPhotos.length / perRow);
    let rowIdx = 0;
    let continued = false;

    for (;;) {
      const left = totalRows - rowIdx;
      const need = (k: number) => Math.max(textH + (continued ? 5 : 0), k === 0 ? MIN_ROW : k * (bh + GAP) + GAP);
      let k = 0;
      while (k < left && need(k + 1) <= BOTTOM - y) k++;

      const doesNotFit = left > 0 ? k === 0 : need(0) > BOTTOM - y;
      if (doesNotFit) {
        if (y > pageTop + 0.5) {
          newPage();
          continue;
        }
        if (left > 0) k = 1;
      }

      const h = need(k);
      if (answer === 'NC') {
        fill(doc, COLORS.redBg);
        doc.rect(M, y, CW, h, 'F');
      }
      stroke(doc, COLORS.line);
      doc.setLineWidth(0.2);
      doc.rect(M, y, CW, h);
      doc.line(M + COL_ITEM, y, M + COL_ITEM, y + h);
      doc.line(M + COL_ITEM + COL_COND, y, M + COL_ITEM + COL_COND, y + h);
      if (answer === 'NC') {
        fill(doc, COLORS.red);
        doc.rect(M, y, 1.6, h, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      ink(doc, COLORS.ink);
      doc.text(lines, M + 3, y + 5);
      if (continued) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        ink(doc, COLORS.grey);
        doc.text('(continuação)', M + 3, y + 5 + lines.length * 4.3);
      }

      const cx = M + COL_ITEM + COL_COND / 2;
      if (answer) {
        const [bg, fg, solid]: [RGB, RGB, boolean] =
          answer === 'C' ? [COLORS.greenBg, COLORS.green, false]
          : answer === 'NC' ? [COLORS.red, [255, 255, 255], true]
          : [COLORS.slateBg, COLORS.slate, false];
        fill(doc, bg);
        stroke(doc, answer === 'NC' ? COLORS.red : fg);
        doc.setLineWidth(solid ? 0.2 : 0.4);
        doc.roundedRect(cx - 7, y + 3, 14, 7, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        ink(doc, fg);
        doc.text(answer, cx, y + 8, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        ink(doc, COLORS.ink);
        doc.text(ANSWER_LABEL[answer], cx, y + 13, { align: 'center' });
      } else {
        doc.setFontSize(9);
        ink(doc, COLORS.grey);
        doc.text('-', cx, y + 8, { align: 'center' });
      }

      const px0 = M + COL_ITEM + COL_COND;
      if (itemPhotos.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        ink(doc, COLORS.grey);
        doc.text(item.minPhotos === 0 ? 'Sem fotografia obrigatória' : 'Nenhuma fotografia anexada', px0 + COL_PHOTO / 2, y + h / 2 + 1, { align: 'center' });
      } else {
        const chunk = itemPhotos.slice(rowIdx * perRow, (rowIdx + k) * perRow);
        await drawPhotoGrid(chunk, item.id, rowIdx * perRow + 1, '', px0, COL_PHOTO, perRow, bw, bh, y);
      }

      y += h;
      rowIdx += k;
      if (rowIdx >= totalRows) break;
      continued = true;
      newPage();
    }
  }

  /* ---------- Linha de uma não conformidade (registro + comprovação) ---------- */
  async function drawNcRow(item: ChecklistItem, ncPhotos: Photo[], proof: Photo[]) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(`${item.id}. ${item.description}`, NC_COL_ITEM - 6) as string[];
    const textH = lines.length * 4 + 5;
    const ncRows = Math.ceil(ncPhotos.length / 2);
    const ncH = ncRows ? ncRows * (NC_BH + GAP) + GAP : 0;
    const pRows = Math.ceil(proof.length / 2);
    let pIdx = 0;
    let first = true;

    for (;;) {
      const left = pRows - pIdx;
      const need = (k: number) =>
        Math.max(textH + (first ? 0 : 5), first ? ncH : 0, k === 0 ? MIN_NC_ROW : k * (PR_BH + GAP) + GAP);
      let k = 0;
      while (k < left && need(k + 1) <= BOTTOM - y) k++;
      const doesNotFit = left > 0 ? k === 0 : need(0) > BOTTOM - y;
      if (doesNotFit) {
        if (y > pageTop + 0.5) {
          newPage();
          continue;
        }
        if (left > 0) k = 1;
      }

      const h = need(k);
      fill(doc, COLORS.redBg);
      doc.rect(M, y, NC_COL_ITEM, h, 'F');
      stroke(doc, COLORS.line);
      doc.setLineWidth(0.2);
      doc.rect(M, y, CW, h);
      doc.line(M + NC_COL_ITEM, y, M + NC_COL_ITEM, y + h);
      doc.line(M + NC_COL_ITEM + NC_COL_NC, y, M + NC_COL_ITEM + NC_COL_NC, y + h);
      fill(doc, COLORS.red);
      doc.rect(M, y, 1.6, h, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      ink(doc, COLORS.ink);
      doc.text(lines, M + 4, y + 5);
      if (!first) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        ink(doc, COLORS.grey);
        doc.text('(continuação)', M + 4, y + 5 + lines.length * 4);
      }

      const ncX = M + NC_COL_ITEM;
      if (first) {
        if (ncPhotos.length === 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          ink(doc, COLORS.grey);
          doc.text('Sem fotografia', ncX + NC_COL_NC / 2, y + h / 2 + 1, { align: 'center' });
        } else {
          await drawPhotoGrid(ncPhotos, item.id, 1, '', ncX, NC_COL_NC, 2, NC_BW, NC_BH, y);
        }
      }

      const prX = M + NC_COL_ITEM + NC_COL_NC;
      if (proof.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        ink(doc, COLORS.red);
        doc.text('Comprovação da manutenção não anexada', prX + NC_COL_PROOF / 2, y + h / 2 + 1, { align: 'center' });
      } else {
        const chunk = proof.slice(pIdx * 2, (pIdx + k) * 2);
        await drawPhotoGrid(chunk, item.id, pIdx * 2 + 1, 'M', prX, NC_COL_PROOF, 2, PR_BW, PR_BH, y);
      }

      y += h;
      pIdx += k;
      if (pIdx >= pRows) break;
      first = false;
      newPage();
    }
  }

  async function drawNcSection() {
    const ncItems = CHECKLIST.filter((i) => insp.answers[i.id] === 'NC');
    const withProof = ncItems.filter((i) => (proofByItem.get(i.id)?.length ?? 0) > 0).length;
    mode = 'nc';

    y += 6;
    if (BOTTOM - y < 7 + 6 + HEADER_ROW + MIN_NC_ROW + 4) startPage();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    ink(doc, COLORS.red);
    doc.text('NÃO CONFORMIDADES E COMPROVAÇÃO DE MANUTENÇÃO', M, y + 4);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    ink(doc, COLORS.grey);
    doc.text(
      ncItems.length === 0
        ? 'Nenhuma não conformidade registrada nesta vistoria.'
        : `${ncItems.length} não conformidade(s) registrada(s). Com comprovação de manutenção anexada: ${withProof} de ${ncItems.length}.`,
      M, y + 3
    );
    y += 7;
    if (ncItems.length === 0) return;

    drawNcTableHeader();
    for (const item of ncItems) {
      await drawNcRow(item, byItem.get(item.id) ?? [], proofByItem.get(item.id) ?? []);
    }
  }

  /* ---------- Montagem ---------- */
  drawDocHeader();
  drawTableHeader();
  for (const item of CHECKLIST) {
    await drawItem(item, insp.answers[item.id], byItem.get(item.id) ?? []);
  }
  await drawNcSection();

  /* ---------- Rodapé em todas as páginas ---------- */
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    stroke(doc, COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(M, H - 22, W - M, H - 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    ink(doc, COLORS.grey);
    doc.text(`Vistoria ${insp.code}  |  Frota ${insp.fleet}  |  ${formatDateBR(insp.date)}`, M, H - 18.5);
    doc.text(`Página ${p} de ${total}`, W - M, H - 18.5, { align: 'right' });
    stroke(doc, COLORS.ink);
    doc.setLineWidth(0.2);
    doc.line(M, H - 9.5, M + 85, H - 9.5);
    doc.setFontSize(7.5);
    doc.text('Assinatura do responsável pela vistoria', M, H - 6);
    doc.text('Data: ____/____/________', W - M, H - 6, { align: 'right' });
  }

  return { blob: doc.output('blob'), fileName: reportFileName(insp), pages: total };
}
