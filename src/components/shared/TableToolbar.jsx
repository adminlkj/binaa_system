import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, FileDown } from 'lucide-react';
import { useStore } from '@/lib/store';
import { t } from '@/lib/utils-binaa';

/**
 * Shared print + CSV-export toolbar for any data table.
 *
 * Props:
 *  - columns: [{ header:{ar,en}|string, value:(row)=>string|number }]
 *  - rows: array of records to print/export
 *  - title: { ar, en } | string  — heading shown on the printed page & file name
 *  - fileName: optional base name for the CSV file (defaults to the title)
 */
export default function TableToolbar({ columns, rows, title, fileName }) {
  const { lang } = useStore();

  const label = (h) => (typeof h === 'string' ? h : t(h.ar, h.en, lang));
  const heading = typeof title === 'string' ? title : t(title.ar, title.en, lang);
  const base = (fileName || heading || 'export').replace(/[^\p{L}\p{N}_-]+/gu, '_');

  const cell = (row, col) => {
    const v = col.value(row);
    return v === null || v === undefined ? '' : String(v);
  };

  const exportCsv = () => {
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const header = columns.map((c) => esc(label(c.header))).join(',');
    const body = rows.map((r) => columns.map((c) => esc(cell(r, c))).join(',')).join('\n');
    // BOM so Excel reads Arabic/UTF-8 correctly.
    const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = () => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const th = columns.map((c) => `<th>${label(c.header)}</th>`).join('');
    const trs = rows
      .map((r) => `<tr>${columns.map((c) => `<td>${cell(r, c)}</td>`).join('')}</tr>`)
      .join('');
    const html = `<!doctype html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8"><title>${heading}</title>
      <style>
        *{font-family:'Cairo',Arial,sans-serif}
        body{padding:24px;color:#0f172a}
        h1{font-size:18px;margin:0 0 4px}
        .meta{color:#64748b;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:${dir === 'rtl' ? 'right' : 'left'}}
        th{background:#f1f5f9;font-weight:600}
        tr:nth-child(even) td{background:#f8fafc}
      </style></head><body>
      <h1>${heading}</h1>
      <div class="meta">${rows.length} ${t('سجل', 'records', lang)} — ${new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}</div>
      <table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={print} className="gap-1.5" disabled={!rows.length}>
        <Printer className="size-4" /> {t('طباعة', 'Print', lang)}
      </Button>
      <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5" disabled={!rows.length}>
        <FileDown className="size-4" /> {t('تصدير', 'Export', lang)}
      </Button>
    </div>
  );
}