import PDFDocument from 'pdfkit';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { exportLabel, exportValue, type ExportAsset, type ExportColumn } from '@/lib/asset-export';

export type AssetReport = {
  title: string;
  scope: string;
  generatedAt: Date;
  columns: ExportColumn[];
  rows: ExportAsset[];
};

function reportMeta(report: AssetReport): string {
  return `${report.scope} · ${report.rows.length} assets · Generated ${report.generatedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;
}

export async function makePdf(report: AssetReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: report.title, Author: 'Lab Asset Manager' } });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fillColor('#302824').font('Helvetica-Bold').fontSize(19).text(report.title);
    doc.moveDown(0.25).fillColor('#63564e').font('Helvetica').fontSize(9).text(reportMeta(report));
    doc.moveDown(1);
    if (report.rows.length === 0) {
      doc.fontSize(11).text('No assets match these filters.');
    }
    report.rows.forEach((row, index) => {
      if (doc.y > 705) doc.addPage();
      doc.fillColor('#a64f35').font('Helvetica-Bold').fontSize(11).text(`${index + 1}. ${row.asset.name}`, { width: 500 });
      doc.moveDown(0.3);
      for (const column of report.columns) {
        if (column === 'name') continue;
        doc.fillColor('#302824').font('Helvetica').fontSize(9).text(`${exportLabel(column)}: ${exportValue(row, column)}`, { width: 500 });
      }
      doc.moveDown(0.8);
      doc.strokeColor('#e4d6c8').moveTo(48, doc.y).lineTo(547, doc.y).stroke();
      doc.moveDown(0.8);
    });
    doc.end();
  });
}

export async function makeWord(report: AssetReport): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: reportMeta(report), spacing: { after: 300 } }),
  ];
  if (report.rows.length === 0) children.push(new Paragraph('No assets match these filters.'));
  report.rows.forEach((row, index) => {
    children.push(new Paragraph({ text: `${index + 1}. ${row.asset.name}`, heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 80 } }));
    for (const column of report.columns) {
      if (column === 'name') continue;
      children.push(new Paragraph({
        children: [new TextRun({ text: `${exportLabel(column)}: `, bold: true }), new TextRun(exportValue(row, column))],
        spacing: { after: 70 },
      }));
    }
  });
  const document = new Document({
    creator: 'Lab Asset Manager',
    title: report.title,
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(document);
}

function csvCell(value: string): string {
  // Spreadsheet apps may evaluate untrusted asset names or notes as formulas.
  const safe = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function makeCsv(report: AssetReport): Buffer {
  const header = report.columns.map(column => csvCell(exportLabel(column))).join(',');
  const rows = report.rows.map(row => report.columns.map(column => csvCell(exportValue(row, column))).join(','));
  // UTF-8 BOM helps Excel open names and notes without losing non-ASCII text.
  return Buffer.from(`\uFEFF${[header, ...rows].join('\r\n')}\r\n`, 'utf8');
}

export async function makeZip(report: AssetReport, basename: string): Promise<Buffer> {
  const [pdf, word] = await Promise.all([makePdf(report), makeWord(report)]);
  const zip = new JSZip();
  zip.file(`${basename}.pdf`, pdf);
  zip.file(`${basename}.docx`, word);
  zip.file(`${basename}.csv`, makeCsv(report));
  zip.file('README.txt', `${report.title}\n${reportMeta(report)}\n\nThis archive contains the same asset list in PDF, Word, and CSV formats.\n`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function makePrintHtml(report: AssetReport): string {
  const items = report.rows.length ? report.rows.map((row, index) => `
    <article class="asset">
      <h2>${index + 1}. ${escapeHtml(row.asset.name)}</h2>
      <dl>${report.columns.filter(column => column !== 'name').map(column => `
        <dt>${escapeHtml(exportLabel(column))}</dt><dd>${escapeHtml(exportValue(row, column))}</dd>
      `).join('')}</dl>
    </article>`).join('') : '<p>No assets match these filters.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(report.title)}</title>
    <style>body{font:14px/1.5 system-ui,sans-serif;color:#302824;max-width:800px;margin:32px auto;padding:0 20px}h1{font-size:26px;margin-bottom:4px}.meta{color:#63564e;margin:0 0 24px}.asset{border-top:1px solid #d8c9bc;padding:14px 0;break-inside:avoid}.asset h2{font-size:17px;margin:0 0 8px;color:#85412d}dl{display:grid;grid-template-columns:150px 1fr;gap:3px 14px;margin:0}dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere}.print{padding:10px 18px;margin-bottom:24px;border:0;border-radius:8px;background:#a64f35;color:white;cursor:pointer}@media print{body{max-width:none;margin:0;padding:0}.print{display:none}.asset{break-inside:avoid}}@media(max-width:600px){dl{grid-template-columns:1fr}dt{margin-top:7px}}</style>
    </head><body><button class="print" onclick="window.print()">Print asset list</button><h1>${escapeHtml(report.title)}</h1><p class="meta">${escapeHtml(reportMeta(report))}</p>${items}</body></html>`;
}
