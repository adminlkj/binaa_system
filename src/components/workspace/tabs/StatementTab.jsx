import React from 'react';
import { Info } from 'lucide-react';
import { useStore } from '@/lib/store';
import { t, formatCurrency, formatDate } from '@/lib/utils-binaa';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * كشف حساب المشروع — يعرض الإيرادات والتحصيلات والتكاليف في أعمدة منفصلة وواضحة.
 *
 * التصميم:
 *   - الإيرادات (مدين): فواتير العملاء المعتمدة
 *   - التحصيلات (دائن): سندات القبض من العميل
 *   - التكاليف (دائن): مصروفات + فواتير مورد + مستخلصات مقاول باطن + صرف مواد
 *   - الرصيد = الإيرادات - التحصيلات - التكاليف
 *
 * ملاحظة: هذا الكشف تجميعي من سجلات العمليات (وليس من قيود اليومية المرحّلة).
 *         كشف الحساب المحاسبي الرسمي للطرف (عميل/مورد) يعتمد على القيود المرحّلة
 *         فقط — تجده في: التقارير ← متابعة العملاء والموردين.
 */
export default function StatementTab({ invoices = [], expenses = [], clientPayments = [], stockMovements = [], supplierInvoices = [], subcontractorInvoices = [] }) {
  const { lang } = useStore();

  // الحالات المعتمدة محاسبياً
  const RECOGNIZED_STATUSES = ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];
  const SUB_RECOGNIZED_STATUSES = ['APPROVED', 'PARTIALLY_PAID', 'PAID'];

  // بناء الحركات مع تصنيف كل حركة كإيراد أو تحصيل أو تكلفة
  // كل الحركات تُعرض (بما فيها المسودات) مع تمييز الحالة
  const lines = [];

  // الإيرادات — كل فواتير العملاء (المعتمدة + المسودات)
  invoices.forEach(i => {
    const isDraft = !RECOGNIZED_STATUSES.includes(i.status);
    lines.push({
      date: i.date, ref: i.invoiceNo,
      type: t('فاتورة عميل', 'Client invoice', lang),
      category: 'revenue',
      debit: i.subtotal || i.totalAmount || 0, credit: 0,
      isDraft,
      status: i.status,
    });
  });

  // التحصيلات — سندات القبض
  clientPayments.forEach(p => lines.push({
    date: p.date, ref: p.paymentNo || p.reference || '—',
    type: t('سند قبض', 'Client receipt', lang),
    category: 'collection',
    debit: 0, credit: p.amount || 0,
    isDraft: false,
  }));

  // التكاليف — مصروفات المشروع (الكل)
  expenses.forEach(e => lines.push({
    date: e.date, ref: e.reference || e.code || '—',
    type: t('مصروف مشروع', 'Project expense', lang),
    category: 'cost',
    debit: 0, credit: e.totalAmount || e.amount || 0,
    isDraft: false,
  }));

  // التكاليف — صرف مواد للمشروع
  stockMovements.filter(m => m.type === 'ISSUE').forEach(m => lines.push({
    date: m.date, ref: m.movementNo || '—',
    type: t('صرف مواد', 'Materials issued', lang),
    category: 'cost',
    debit: 0, credit: m.totalCost || 0,
    isDraft: false,
  }));

  // التكاليف — كل فواتير الموردين (المعتمدة + المسودات)
  supplierInvoices.forEach(i => {
    const isDraft = !RECOGNIZED_STATUSES.includes(i.status);
    lines.push({
      date: i.date, ref: i.invoiceNo,
      type: t('فاتورة مورد', 'Supplier invoice', lang),
      category: 'cost',
      debit: 0, credit: i.totalAmount || 0,
      isDraft,
      status: i.status,
    });
  });

  // التكاليف — كل مستخلصات مقاولي الباطن (المعتمدة + المسودات)
  subcontractorInvoices.forEach(i => {
    const isDraft = !SUB_RECOGNIZED_STATUSES.includes(i.status);
    lines.push({
      date: i.date, ref: i.invoiceNo,
      type: t('مستخلص مقاول باطن', 'Subcontractor certificate', lang),
      category: 'cost',
      debit: 0, credit: i.totalAmount || 0,
      isDraft,
      status: i.status,
    });
  });

  lines.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // الرصيد = الإيرادات - التحصيلات - التكاليف (المعتمدة فقط)
  let running = 0;
  const withBalance = lines.map(l => {
    // الرصيد الجاري يحسب من المعتمد فقط (المسودات لا تؤثر على الرصيد)
    if (!l.isDraft) running += (l.debit - l.credit);
    return { ...l, balance: running };
  });

  // المجاميع — مفصولة بين معتمد ومسودة
  const totalRevenue = lines.filter(l => l.category === 'revenue' && !l.isDraft).reduce((s, l) => s + l.debit, 0);
  const draftRevenue = lines.filter(l => l.category === 'revenue' && l.isDraft).reduce((s, l) => s + l.debit, 0);
  const totalCollections = lines.filter(l => l.category === 'collection').reduce((s, l) => s + l.credit, 0);
  const totalCosts = lines.filter(l => l.category === 'cost' && !l.isDraft).reduce((s, l) => s + l.credit, 0);
  const draftCosts = lines.filter(l => l.category === 'cost' && l.isDraft).reduce((s, l) => s + l.credit, 0);
  const netProfit = totalRevenue - totalCosts;
  const outstanding = totalRevenue - totalCollections;

  // ألوان حسب نوع الحركة
  const categoryColor = (cat) => ({
    revenue: 'text-emerald-700',
    collection: 'text-blue-700',
    cost: 'text-rose-700',
  }[cat] || 'text-foreground');

  const categoryBg = (cat) => ({
    revenue: 'bg-emerald-50',
    collection: 'bg-blue-50',
    cost: 'bg-rose-50',
  }[cat] || '');

  return (
    <div className="space-y-4">
      {/* صندوق توضيحي ذكي يشرح مصدر البيانات */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800 flex items-start gap-2">
        <Info className="size-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">{t('كيف تُحسب هذه الأرقام؟', 'How are these numbers calculated?')}</p>
          <p>
            {t(
              'الإيرادات = فواتير العملاء المعتمدة · التحصيلات = سندات القبض · التكاليف = مصروفات + فواتير مورد + مستخلصات مقاول باطن + صرف مواد. الرصيد = الإيرادات − التحصيلات − التكاليف.',
              'Revenue = approved client invoices · Collections = receipt vouchers · Costs = expenses + supplier invoices + subcontractor certificates + materials issued. Balance = Revenue − Collections − Costs.'
            )}
          </p>
          <p className="text-blue-600">
            {t(
              'ملاحظة: هذا كشف تجميعي من سجلات العمليات. كشف الحساب المحاسبي الرسمي للطرف (عميل/مورد) يعتمد على القيود المرحّلة فقط — تجده في: التقارير ← متابعة العملاء والموردين.',
              'Note: This is an aggregate statement from operation records. The official accounting party statement relies on posted journal entries only — find it in: Reports ← Clients & Suppliers Follow-up.'
            )}
          </p>
        </div>
      </div>

      {/* بطاقات الملخص — 4 أرقام منفصلة وواضحة + مسودات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground">{t('الإيرادات', 'Revenue', lang)}</div>
          <div className="text-base font-bold text-emerald-700">{formatCurrency(totalRevenue, lang)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {t('فواتير معتمدة', 'Approved invoices', lang)}
            {draftRevenue > 0 && <span className="text-amber-600"> + {formatCurrency(draftRevenue, lang)} {t('مسودة', 'draft', lang)}</span>}
          </div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground">{t('التحصيلات', 'Collections', lang)}</div>
          <div className="text-base font-bold text-blue-700">{formatCurrency(totalCollections, lang)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{t('سندات قبض', 'Receipt vouchers', lang)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground">{t('التكاليف', 'Costs', lang)}</div>
          <div className="text-base font-bold text-rose-700">{formatCurrency(totalCosts, lang)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {t('مصروفات + فواتير + مستخلصات', 'Expenses + invoices + certificates', lang)}
            {draftCosts > 0 && <span className="text-amber-600"> + {formatCurrency(draftCosts, lang)} {t('مسودة', 'draft', lang)}</span>}
          </div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground">{t('صافي الربح', 'Net Profit', lang)}</div>
          <div className={`text-base font-bold ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(netProfit, lang)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{t('الإيرادات − التكاليف', 'Revenue − Costs', lang)}</div>
        </Card>
      </div>

      {/* الجدول التفصيلي */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('التاريخ', 'Date', lang)}</TableHead>
                <TableHead>{t('المرجع', 'Reference', lang)}</TableHead>
                <TableHead>{t('البيان', 'Description', lang)}</TableHead>
                <TableHead>{t('النوع', 'Type', lang)}</TableHead>
                <TableHead className="text-end">{t('مدين', 'Debit', lang)}</TableHead>
                <TableHead className="text-end">{t('دائن', 'Credit', lang)}</TableHead>
                <TableHead className="text-end">{t('الرصيد', 'Balance', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withBalance.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t('لا توجد حركات', 'No transactions', lang)}</TableCell></TableRow>
              ) : (
                withBalance.map((l, i) => (
                  <TableRow key={i} className={`hover:bg-muted/30 ${l.isDraft ? 'opacity-50' : ''}`}>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(l.date, lang)}</TableCell>
                    <TableCell className="font-mono text-xs">{l.ref}</TableCell>
                    <TableCell className="text-sm">
                      {l.type}
                      {l.isDraft && <span className="text-[10px] text-amber-600 ms-1">({t('مسودة', 'draft', lang)})</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${categoryBg(l.category)} ${categoryColor(l.category)}`}>
                        {l.category === 'revenue' && t('إيراد', 'Revenue', lang)}
                        {l.category === 'collection' && t('تحصيل', 'Collection', lang)}
                        {l.category === 'cost' && t('تكلفة', 'Cost', lang)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-end text-emerald-700">{l.debit ? formatCurrency(l.debit, lang) : '—'}</TableCell>
                    <TableCell className={`text-sm text-end ${categoryColor(l.category)}`}>{l.credit ? formatCurrency(l.credit, lang) : '—'}</TableCell>
                    <TableCell className="text-sm text-end font-medium">{l.isDraft ? '—' : formatCurrency(l.balance, lang)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ملخص سفلي */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span>{t('المحصّل من العميل', 'Collected from client', lang)}: <strong className="text-blue-700">{formatCurrency(totalCollections, lang)}</strong></span>
        <span>{t('المتبقي على العميل', 'Outstanding from client', lang)}: <strong className="text-amber-700">{formatCurrency(outstanding, lang)}</strong></span>
        <span>{t('إجمالي التكاليف', 'Total costs', lang)}: <strong className="text-rose-700">{formatCurrency(totalCosts, lang)}</strong></span>
        <span>{t('صافي الربح', 'Net profit', lang)}: <strong className={netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{formatCurrency(netProfit, lang)}</strong></span>
      </div>
    </div>
  );
}