import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { brl } from "./format";

type Cell = string | number;

export function downloadBlob(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCSV(filename: string, headers: string[], rows: Cell[][]) {
  // BOM so Excel detects UTF-8
  const sep = ";";
  const lines = [headers.map(escapeCSV).join(sep)];
  rows.forEach((r) => lines.push(r.map(escapeCSV).join(sep)));
  downloadBlob(filename, "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
}

export type PdfReportOptions = {
  title: string;
  subtitle?: string;
  meta?: Record<string, string>;
  headers: string[];
  rows: Cell[][];
  summary?: { label: string; value: string | number }[];
  filename: string;
  /** indexes of columns whose totals should be currency-formatted in footer */
  numericCols?: number[];
  /** column alignments */
  align?: ("left" | "right" | "center")[];
};

export function exportPDF(opts: PdfReportOptions) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 32;
  let y = margin;

  // Header band
  doc.setFillColor(5, 5, 5);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(209, 255, 0); // lime
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("[ CASHFLOW · COCKPIT FINANCEIRO ]", margin, 26);
  doc.setTextColor(244, 244, 232);
  doc.setFontSize(18);
  doc.text(opts.title.toUpperCase(), margin, 50);
  if (opts.subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 180);
    doc.text(opts.subtitle, margin, 62);
  }
  y = 90;

  // Meta block
  if (opts.meta && Object.keys(opts.meta).length) {
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    const metaText = Object.entries(opts.meta)
      .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
      .join("   ·   ");
    doc.text(metaText, margin, y);
    y += 16;
  }

  // Summary KPIs
  if (opts.summary && opts.summary.length) {
    const colW = (pageW - margin * 2) / opts.summary.length;
    opts.summary.forEach((s, i) => {
      const x = margin + colW * i;
      doc.setDrawColor(220, 220, 220);
      doc.rect(x, y, colW - 6, 44);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(s.label.toUpperCase(), x + 8, y + 14);
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.text(String(s.value), x + 8, y + 32);
      doc.setFont("helvetica", "normal");
    });
    y += 56;
  }

  autoTable(doc, {
    startY: y,
    head: [opts.headers],
    body: opts.rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c)))),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, lineColor: [220, 220, 220], lineWidth: 0.5 },
    headStyles: { fillColor: [5, 5, 5], textColor: [209, 255, 0], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 248, 245] },
    margin: { left: margin, right: margin },
    columnStyles: opts.align
      ? Object.fromEntries(opts.align.map((a, i) => [i, { halign: a }]))
      : undefined,
    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Gerado em ${new Date().toLocaleString("pt-BR")}`,
        margin,
        pageH - 16,
      );
      const pageNum = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      doc.text(`Página ${pageNum}`, pageW - margin, pageH - 16, { align: "right" });
    },
  });

  doc.save(opts.filename);
}

export { brl };
