import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStore } from '@/lib/store';
import { t, formatCurrency, formatDate, genCode, INVOICE_STATUS } from '@/lib/utils-binaa';
import CrudTab from '@/components/workspace/CrudTab';

const computeTotal = (f) => {
  const base = Number(f.baseAmount) || 0;
  const extra = Number(f.extraCharges) || 0;
  const net = base + extra;
  const vat = Math.round(net * 0.15 * 100) / 100;
  return { net, vat, total: net + vat };
};

export default function RentalInvoicesTab({ equipmentId }) {
  const { lang } = useStore();

  return (
    <CrudTab
      entityName="RentalInvoice"
      filter={{ equipmentId }}
      defaults={(rows) => ({
        equipmentId,
        invoiceNo: genCode('RINV', rows.length + 1),
        clientName: '',
        date: new Date().toISOString().slice(0, 10),
        periodFrom: '',
        periodTo: '',
        baseAmount: 0,
        extraCharges: 0,
        paidAmount: 0,
        status: 'DRAFT',
        notes: '',
      })}
      validate={(f) => (!f.invoiceNo?.trim() ? t('أدخل رقم الفاتورة', 'Enter invoice number', lang) : null)}
      buildPayload={(f) => {
        const { vat, total } = computeTotal(f);
        return {
          equipmentId,
          invoiceNo: f.invoiceNo,
          clientName: f.clientName,
          date: f.date || null,
          periodFrom: f.periodFrom || null,
          periodTo: f.periodTo || null,
          baseAmount: Number(f.baseAmount) || 0,
          extraCharges: Number(f.extraCharges) || 0,
          vatAmount: vat,
          totalAmount: total,
          paidAmount: Number(f.paidAmount) || 0,
          status: f.status,
          notes: f.notes,
        };
      }}
      labels={{
        new: { ar: 'فاتورة تأجير', en: 'New Rental Invoice' },
        edit: { ar: 'تعديل الفاتورة', en: 'Edit Invoice' },
        empty: { ar: 'لا توجد فواتير تأجير لهذه المعدة', en: 'No rental invoices for this equipment' },
        title: { ar: 'حذف الفاتورة', en: 'Delete Invoice' },
      }}
      summary={(rows) => {
        const total = rows.reduce((s, r) => s + (r.totalAmount || 0), 0);
        const paid = rows.reduce((s, r) => s + (r.paidAmount || 0), 0);
        return (
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{t('الإجمالي', 'Total', lang)}: <span className="font-bold text-foreground">{formatCurrency(total, lang)}</span></span>
            <span>{t('المحصّل', 'Collected', lang)}: <span className="font-bold text-emerald-600">{formatCurrency(paid, lang)}</span></span>
            <span>{t('المتأخر', 'Outstanding', lang)}: <span className="font-bold text-rose-600">{formatCurrency(total - paid, lang)}</span></span>
          </span>
        );
      }}
      columns={[
        { header: { ar: 'الرقم', en: 'No' }, cell: r => <span className="font-mono text-xs">{r.invoiceNo}</span> },
        { header: { ar: 'العميل', en: 'Client' }, cell: r => <span className="text-sm">{r.clientName || '—'}</span> },
        { header: { ar: 'التاريخ', en: 'Date' }, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.date, lang)}</span> },
        { header: { ar: 'الإجمالي', en: 'Total' }, cell: r => formatCurrency(r.totalAmount, lang) },
        { header: { ar: 'المحصّل', en: 'Paid' }, cell: r => <span className="text-emerald-600">{formatCurrency(r.paidAmount, lang)}</span> },
        { header: { ar: 'الحالة', en: 'Status' }, cell: r => {
          const s = INVOICE_STATUS[r.status] || INVOICE_STATUS.DRAFT;
          return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>{lang === 'ar' ? s.ar : s.en}</span>;
        } },
      ]}
      fields={(form, set) => {
        const { net, vat, total } = computeTotal(form);
        return (
          <>
            <div className="space-y-1.5">
              <Label>{t('رقم الفاتورة', 'Invoice No', lang)} *</Label>
              <Input value={form.invoiceNo || ''} onChange={e => set('invoiceNo', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('العميل', 'Client', lang)}</Label>
              <Input value={form.clientName || ''} onChange={e => set('clientName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('التاريخ', 'Date', lang)}</Label>
              <Input type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('الحالة', 'Status', lang)}</Label>
              <Select value={form.status || 'DRAFT'} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INVOICE_STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('الفترة من', 'Period From', lang)}</Label>
              <Input type="date" value={form.periodFrom || ''} onChange={e => set('periodFrom', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('الفترة إلى', 'Period To', lang)}</Label>
              <Input type="date" value={form.periodTo || ''} onChange={e => set('periodTo', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('قيمة الإيجار', 'Base Amount', lang)}</Label>
              <Input type="number" value={form.baseAmount ?? 0} onChange={e => set('baseAmount', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('رسوم إضافية', 'Extra Charges', lang)}</Label>
              <Input type="number" value={form.extraCharges ?? 0} onChange={e => set('extraCharges', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('المحصّل', 'Paid Amount', lang)}</Label>
              <Input type="number" value={form.paidAmount ?? 0} onChange={e => set('paidAmount', e.target.value)} />
            </div>
            <div className="md:col-span-2 rounded-lg bg-muted/50 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('الصافي', 'Net', lang)}</span><span className="tabular-nums">{formatCurrency(net, lang)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('الضريبة 15%', 'VAT 15%', lang)}</span><span className="tabular-nums">{formatCurrency(vat, lang)}</span></div>
              <div className="flex justify-between font-bold pt-1 border-t"><span>{t('الإجمالي', 'Total', lang)}</span><span className="tabular-nums">{formatCurrency(total, lang)}</span></div>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t('ملاحظات', 'Notes', lang)}</Label>
              <Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </>
        );
      }}
    />
  );
}