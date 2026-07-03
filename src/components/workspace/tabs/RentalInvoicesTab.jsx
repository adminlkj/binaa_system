import React, { useState, useEffect } from 'react';
import { Printer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency, formatDate, genInvoiceNo, INVOICE_STATUS } from '@/lib/utils-binaa';
import CrudTab from '@/components/workspace/CrudTab';
import { OperationEngine } from '@/lib/businessEngine';
import InvoicePrintDialog from '@/components/shared/InvoicePrintDialog';
import { monthBounds, monthLabel, recentMonths, sumHoursForMonth, addDays } from '@/lib/rentalBilling';

// تحويل سجل فاتورة التأجير إلى الشكل الذي يتوقعه مستند الفاتورة الموحّد.
const toInvoiceDoc = (r) => ({
  ...r,
  invoiceType: 'RENTAL',
  subtotal: (Number(r.baseAmount) || 0) + (Number(r.extraCharges) || 0),
});

const computeTotal = (f) => {
  const base = Number(f.baseAmount) || 0;
  const extra = Number(f.extraCharges) || 0;
  const net = base + extra;
  const vat = Math.round(net * 0.15 * 100) / 100;
  return { net, vat, total: net + vat };
};

export default function RentalInvoicesTab({ equipmentId }) {
  const { lang } = useStore();
  const [printInvoice, setPrintInvoice] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [hoursRows, setHoursRows] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.RentalContract.filter({ equipmentId }).catch(() => []),
      base44.entities.DeliveryOrder.filter({ equipmentId }).catch(() => []),
      base44.entities.OperatingHours.filter({ equipmentId }).catch(() => []),
    ]).then(([c, d, h]) => { setContracts(c); setDeliveryOrders(d); setHoursRows(h); });
  }, [equipmentId]);

  return (
    <>
    <CrudTab
      entityName="RentalInvoice"
      operationHandlers={{
        create: (payload) => OperationEngine.createRentalInvoice(payload),
        update: (id, payload) => OperationEngine.updateRentalInvoice(id, payload),
      }}
      rowActions={(row) => (
        <Button size="icon" variant="ghost" className="size-8 text-emerald-600 hover:text-emerald-700" onClick={() => setPrintInvoice(toInvoiceDoc(row))}>
          <Printer className="size-3.5" />
        </Button>
      )}
      filter={{ equipmentId }}
      defaults={(rows) => ({
        equipmentId,
        invoiceNo: genInvoiceNo('RINV', new Date().getFullYear(), rows.length + 1),
        rentalContractId: '',
        contractNo: '',
        deliveryOrderId: '',
        deliveryOrderNo: '',
        billingMonth: '',
        paymentTermDays: 30,
        equipmentName: '',
        clientName: '',
        date: new Date().toISOString().slice(0, 10),
        dueDate: addDays(new Date().toISOString().slice(0, 10), 30),
        periodFrom: '',
        periodTo: '',
        totalHours: 0,
        baseAmount: 0,
        extraCharges: 0,
        paidAmount: 0,
        status: 'DRAFT',
        notes: '',
      })}
      validate={(f) => {
        if (!f.invoiceNo?.trim()) return t('أدخل رقم الفاتورة', 'Enter invoice number', lang);
        if (!f.rentalContractId) return t('اختر عقد التأجير أولاً', 'Select a rental contract first', lang);
        if (!f.billingMonth) return t('اختر شهر العمل', 'Select the billing month', lang);
        return null;
      }}
      // منع إنشاء فاتورتين لنفس الشهر ولنفس المعدة.
      beforeSave={async (f, editingId) => {
        if (!f.billingMonth) return null;
        const existing = await base44.entities.RentalInvoice.filter({ equipmentId, billingMonth: f.billingMonth });
        const dup = existing.find(x => x.id !== editingId);
        if (dup) return t(`توجد فاتورة لهذا الشهر بالفعل (${dup.invoiceNo})`, `An invoice already exists for this month (${dup.invoiceNo})`, lang);
        return null;
      }}
      buildPayload={(f) => {
        const { vat, total } = computeTotal(f);
        return {
          equipmentId,
          rentalContractId: f.rentalContractId || '',
          contractNo: f.contractNo || '',
          deliveryOrderId: f.deliveryOrderId || '',
          deliveryOrderNo: f.deliveryOrderNo || '',
          billingMonth: f.billingMonth || '',
          equipmentName: f.equipmentName || '',
          invoiceNo: f.invoiceNo,
          clientName: f.clientName,
          date: f.date || null,
          dueDate: f.dueDate || null,
          periodFrom: f.periodFrom || null,
          periodTo: f.periodTo || null,
          totalHours: Number(f.totalHours) || 0,
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
        { header: { ar: 'رقم العقد', en: 'Contract' }, cell: r => <span className="font-mono text-xs">{r.contractNo || '—'}</span> },
        { header: { ar: 'أمر التوصيل', en: 'Delivery' }, cell: r => <span className="font-mono text-xs">{r.deliveryOrderNo || '—'}</span> },
        { header: { ar: 'شهر العمل', en: 'Month' }, cell: r => <span className="text-xs">{r.billingMonth ? monthLabel(r.billingMonth, lang) : '—'}</span> },
        { header: { ar: 'الساعات', en: 'Hours' }, cell: r => <span className="tabular-nums">{r.totalHours || 0}</span> },
        { header: { ar: 'التاريخ', en: 'Date' }, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.date, lang)}</span> },
        { header: { ar: 'الاستحقاق', en: 'Due' }, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.dueDate, lang)}</span> },
        { header: { ar: 'الإجمالي', en: 'Total' }, cell: r => formatCurrency(r.totalAmount, lang) },
        { header: { ar: 'الحالة', en: 'Status' }, cell: r => {
          const s = INVOICE_STATUS[r.status] || INVOICE_STATUS.DRAFT;
          return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>{lang === 'ar' ? s.ar : s.en}</span>;
        } },
      ]}
      fields={(form, set) => {
        const { net, vat, total } = computeTotal(form);

        // عند اختيار العقد: جلب رقمه واسم المعدة والعميل وشروط الدفع، وربط أول أمر توصيل لعميله.
        const onContract = (v) => {
          if (v === 'none') { set('rentalContractId', ''); set('contractNo', ''); set('paymentTermDays', 30); return; }
          const c = contracts.find(x => x.id === v);
          set('rentalContractId', v);
          set('contractNo', c?.contractNo || '');
          set('equipmentName', c?.equipmentName || '');
          set('paymentTermDays', c?.paymentTermDays || 30);
          if (c?.clientName) set('clientName', c.clientName);
          if (c?.rate && !Number(form.baseAmount)) set('baseAmount', c.rate);
          // إعادة حساب الاستحقاق إن كان هناك شهر مختار
          if (form.date) set('dueDate', addDays(form.date, c?.paymentTermDays || 30));
        };

        // عند اختيار شهر العمل: تحديد فترة العمل وجمع ساعاتها فقط —
        // تاريخ الإصدار يبقى تاريخ اليوم، والاستحقاق يُحسب منه.
        const onMonth = (v) => {
          set('billingMonth', v);
          const { from, to } = monthBounds(v);
          set('periodFrom', from);
          set('periodTo', to);
          set('totalHours', sumHoursForMonth(hoursRows, v));
        };

        const contractDeliveries = deliveryOrders; // كل أوامر التوصيل لهذه المعدة

        return (
          <>
            <div className="space-y-1.5">
              <Label>{t('رقم الفاتورة', 'Invoice No', lang)} *</Label>
              <Input value={form.invoiceNo || ''} onChange={e => set('invoiceNo', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('عقد التأجير', 'Rental Contract', lang)} *</Label>
              <Select value={form.rentalContractId || 'none'} onValueChange={onContract}>
                <SelectTrigger><SelectValue placeholder={t('اختر عقداً', 'Select contract', lang)} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('بدون عقد', 'No contract', lang)}</SelectItem>
                  {contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.contractNo} — {c.clientName || ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('أمر التوصيل', 'Delivery Order', lang)}</Label>
              <Select
                value={form.deliveryOrderId || 'none'}
                onValueChange={v => {
                  if (v === 'none') { set('deliveryOrderId', ''); set('deliveryOrderNo', ''); return; }
                  const d = contractDeliveries.find(x => x.id === v);
                  set('deliveryOrderId', v);
                  set('deliveryOrderNo', d?.orderNo || '');
                }}
              >
                <SelectTrigger><SelectValue placeholder={t('اختر أمر توصيل', 'Select delivery order', lang)} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('بدون', 'None', lang)}</SelectItem>
                  {contractDeliveries.map(d => <SelectItem key={d.id} value={d.id}>{d.orderNo} — {formatDate(d.date, lang)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('شهر العمل', 'Billing Month', lang)} *</Label>
              <Select value={form.billingMonth || ''} onValueChange={onMonth}>
                <SelectTrigger><SelectValue placeholder={t('اختر الشهر', 'Select month', lang)} /></SelectTrigger>
                <SelectContent>
                  {recentMonths(12).map(m => <SelectItem key={m} value={m}>{monthLabel(m, lang)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('العميل', 'Client', lang)}</Label>
              <Input value={form.clientName || ''} onChange={e => set('clientName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('عدد ساعات الشهر', 'Monthly Hours', lang)}</Label>
              <Input type="number" value={form.totalHours ?? 0} onChange={e => set('totalHours', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('تاريخ الفاتورة', 'Invoice Date', lang)}</Label>
              <Input type="date" value={form.date || ''} onChange={e => { set('date', e.target.value); set('dueDate', addDays(e.target.value, form.paymentTermDays || 30)); }} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('تاريخ الاستحقاق', 'Due Date', lang)}</Label>
              <Input type="date" value={form.dueDate || ''} readOnly className="bg-muted" />
              <p className="text-[11px] text-muted-foreground">{t(`شروط الدفع: ${form.paymentTermDays || 30} يوم`, `Payment terms: ${form.paymentTermDays || 30} days`, lang)}</p>
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
    <InvoicePrintDialog open={!!printInvoice} onOpenChange={(o) => !o && setPrintInvoice(null)} invoice={printInvoice} />
    </>
  );
}