import React, { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { t, formatCurrency, formatDate, INVOICE_STATUS } from '@/lib/utils-binaa';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const TYPE_LABEL = {
  CONSTRUCTION: { ar: 'فاتورة أعمال تنفيذية', en: 'Construction Invoice' },
  SERVICE: { ar: 'فاتورة خدمات', en: 'Service Invoice' },
  RENTAL: { ar: 'فاتورة تأجير', en: 'Rental Invoice' },
};

// معاينة وطباعة فاتورة العميل. الطباعة تُنفّذ عبر نافذة مستقلة حتى تخرج
// الفاتورة وحدها بتنسيق نظيف دون باقي واجهة النظام.
export default function InvoicePrintDialog({ open, onOpenChange, invoice }) {
  const { lang } = useStore();
  const printRef = useRef(null);

  if (!invoice) return null;
  const st = INVOICE_STATUS[invoice.status] || INVOICE_STATUS.DRAFT;
  const typeLabel = TYPE_LABEL[invoice.invoiceType] || TYPE_LABEL.CONSTRUCTION;
  const balance = (invoice.totalAmount || 0) - (invoice.paidAmount || 0);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`
      <html dir="${lang === 'ar' ? 'rtl' : 'ltr'}" lang="${lang}">
        <head>
          <meta charset="utf-8" />
          <title>${invoice.invoiceNo || 'Invoice'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
            @font-face { font-family:'saudi_riyal'; src:url('https://cdn.jsdelivr.net/gh/emran-alhaddad/Saudi-Riyal-Font@1.1.1/fonts/regular/saudi_riyal.woff2') format('woff2'); unicode-range:U+20C1; }
            * { box-sizing: border-box; }
            body { font-family:'saudi_riyal','Cairo',sans-serif; color:#111; padding:32px; }
            table { width:100%; border-collapse:collapse; }
            td,th { padding:8px 10px; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const rowStyle = { borderBottom: '1px solid #eee' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold">{t('معاينة الفاتورة', 'Invoice Preview', lang)}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1 bg-emerald-600 hover:bg-emerald-700"><Printer className="size-3.5" />{t('طباعة', 'Print', lang)}</Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}><X className="size-4" /></Button>
          </div>
        </div>

        <div className="overflow-auto max-h-[80vh] bg-muted/30 p-4">
          <div ref={printRef} className="bg-white mx-auto max-w-2xl p-8 rounded shadow-sm" style={{ color: '#111' }}>
            {/* رأس الفاتورة */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #059669', paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#059669' }}>{t('نظام بِناء', 'Binaa System', lang)}</h1>
                <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0' }}>{lang === 'ar' ? typeLabel.ar : typeLabel.en}</p>
              </div>
              <div style={{ textAlign: lang === 'ar' ? 'left' : 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{invoice.invoiceNo}</div>
                <span style={{ display: 'inline-block', marginTop: 6, fontSize: 12, padding: '2px 10px', borderRadius: 999, background: '#ecfdf5', color: '#047857' }}>
                  {lang === 'ar' ? st.ar : st.en}
                </span>
              </div>
            </div>

            {/* بيانات العميل والمشروع */}
            <table style={{ marginBottom: 20, fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={{ color: '#666', width: '25%' }}>{t('العميل', 'Client', lang)}</td>
                  <td style={{ fontWeight: 600 }}>{invoice.clientName || '—'}</td>
                  <td style={{ color: '#666', width: '25%' }}>{t('التاريخ', 'Date', lang)}</td>
                  <td style={{ fontWeight: 600 }}>{formatDate(invoice.date, lang)}</td>
                </tr>
                <tr>
                  <td style={{ color: '#666' }}>{t('المشروع', 'Project', lang)}</td>
                  <td style={{ fontWeight: 600 }}>{invoice.projectName || '—'}</td>
                  <td style={{ color: '#666' }}>{t('الاستحقاق', 'Due Date', lang)}</td>
                  <td style={{ fontWeight: 600 }}>{formatDate(invoice.dueDate, lang)}</td>
                </tr>
                {invoice.certificateNo && (
                  <tr>
                    <td style={{ color: '#666' }}>{t('المستخلص', 'Certificate', lang)}</td>
                    <td colSpan={3} style={{ fontWeight: 600 }}>{invoice.certificateNo}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {invoice.description && (
              <div style={{ fontSize: 13, marginBottom: 16 }}>
                <span style={{ color: '#666' }}>{t('الوصف', 'Description', lang)}: </span>{invoice.description}
              </div>
            )}

            {/* جدول القيم */}
            <table style={{ fontSize: 14, marginTop: 8 }}>
              <tbody>
                <tr style={rowStyle}>
                  <td style={{ color: '#666' }}>{t('المبلغ قبل الضريبة', 'Subtotal', lang)}</td>
                  <td style={{ textAlign: lang === 'ar' ? 'left' : 'right', fontWeight: 600 }}>{formatCurrency(invoice.subtotal, lang)}</td>
                </tr>
                <tr style={rowStyle}>
                  <td style={{ color: '#666' }}>{t('ضريبة القيمة المضافة', 'VAT', lang)} ({((invoice.vatRate || 0) * 100).toFixed(0)}%)</td>
                  <td style={{ textAlign: lang === 'ar' ? 'left' : 'right', fontWeight: 600 }}>{formatCurrency(invoice.vatAmount, lang)}</td>
                </tr>
                <tr style={{ borderTop: '2px solid #059669' }}>
                  <td style={{ fontWeight: 700, fontSize: 16, paddingTop: 12 }}>{t('الإجمالي', 'Total', lang)}</td>
                  <td style={{ textAlign: lang === 'ar' ? 'left' : 'right', fontWeight: 700, fontSize: 16, color: '#059669', paddingTop: 12 }}>{formatCurrency(invoice.totalAmount, lang)}</td>
                </tr>
                <tr>
                  <td style={{ color: '#666' }}>{t('المدفوع', 'Paid', lang)}</td>
                  <td style={{ textAlign: lang === 'ar' ? 'left' : 'right' }}>{formatCurrency(invoice.paidAmount, lang)}</td>
                </tr>
                <tr>
                  <td style={{ color: '#666' }}>{t('المتبقي', 'Balance Due', lang)}</td>
                  <td style={{ textAlign: lang === 'ar' ? 'left' : 'right', fontWeight: 700, color: balance > 0 ? '#dc2626' : '#059669' }}>{formatCurrency(balance, lang)}</td>
                </tr>
              </tbody>
            </table>

            <p style={{ marginTop: 32, fontSize: 11, color: '#999', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 12 }}>
              {t('هذه فاتورة صادرة إلكترونياً من نظام بِناء', 'Electronically generated by Binaa System', lang)}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}