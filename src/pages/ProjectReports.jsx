import React, { useState, useEffect } from 'react';
import { PieChart, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency } from '@/lib/utils-binaa';
import ModuleLayout from '@/components/shared/ModuleLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PROJECT_STATUS } from '@/lib/utils-binaa';
import TableToolbar from '@/components/shared/TableToolbar';

// تقرير محفظة المشاريع: الإيراد والتكلفة والربح لكل مشروع.
export default function ProjectReports() {
  const { lang } = useStore();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [supplierInvoices, setSupplierInvoices] = useState([]);
  const [subcontractorInvoices, setSubcontractorInvoices] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [pr, inv, po, exp, sm, si, subInv] = await Promise.all([
        base44.entities.Project.list('-created_date', 500),
        base44.entities.SalesInvoice.list('-date', 1000),
        base44.entities.PurchaseOrder.list('-date', 1000),
        base44.entities.Expense.list('-date', 1000),
        base44.entities.StockMovement.list('-date', 1000),
        base44.entities.SupplierInvoice.list('-date', 1000),
        base44.entities.SubcontractorInvoice.list('-date', 1000),
      ]);
      setProjects(pr); setInvoices(inv); setPurchases(po); setExpenses(exp);
      setStockMovements(sm); setSupplierInvoices(si); setSubcontractorInvoices(subInv);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const inPeriod = (date) => (!from || (date && date >= from)) && (!to || (date && date <= to));
  const postedInvoiceStatuses = ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];
  const rows = projects.map(p => {
    const revenue = invoices.filter(i => i.projectId === p.id && postedInvoiceStatuses.includes(i.status) && inPeriod(i.date)).reduce((s, i) => s + (i.totalAmount || 0), 0);
    const expenseCost = expenses.filter(e => e.projectId === p.id && inPeriod(e.date)).reduce((s, e) => s + (e.totalAmount || e.amount || 0), 0);
    const stockCost = stockMovements.filter(m => m.projectId === p.id && m.type === 'ISSUE' && inPeriod(m.date)).reduce((s, m) => s + (m.totalCost || 0), 0);
    const supplierCost = supplierInvoices.filter(i => i.projectId === p.id && !i.goodsReceiptId && ['APPROVED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].includes(i.status) && inPeriod(i.date)).reduce((s, i) => s + (i.totalAmount || 0), 0);
    const subcontractorCost = subcontractorInvoices.filter(i => i.projectId === p.id && ['APPROVED', 'PARTIALLY_PAID', 'PAID'].includes(i.status) && inPeriod(i.date)).reduce((s, i) => s + (i.totalAmount || 0), 0);
    const cost = expenseCost + stockCost + supplierCost + subcontractorCost;
    const profit = revenue - cost;
    const margin = revenue ? (profit / revenue) * 100 : 0;
    return { ...p, revenue, cost, profit, margin };
  });

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const columns = [
    { header: { ar: 'المشروع', en: 'Project' }, value: r => r.name },
    { header: { ar: 'الإيراد', en: 'Revenue' }, value: r => formatCurrency(r.revenue, lang) },
    { header: { ar: 'التكلفة', en: 'Cost' }, value: r => formatCurrency(r.cost, lang) },
    { header: { ar: 'الربح', en: 'Profit' }, value: r => formatCurrency(r.profit, lang) },
    { header: { ar: 'الهامش', en: 'Margin' }, value: r => `${r.margin.toFixed(1)}%` },
  ];

  return (
    <ModuleLayout
      title={t('تقارير المشاريع', 'Project Reports', lang)}
      subtitle={t('ربحية محفظة المشاريع', 'Project portfolio profitability', lang)}
      actions={<div className="flex gap-2"><TableToolbar columns={columns} rows={rows} title={{ ar: 'تقارير المشاريع التفصيلية', en: 'Detailed Project Reports' }} /><Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="size-4" />{t('تحديث', 'Refresh', lang)}</Button></div>}
    >
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1"><Label className="text-xs">{t('من تاريخ', 'From Date', lang)}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">{t('إلى تاريخ', 'To Date', lang)}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button variant="outline" onClick={() => { setFrom(''); setTo(''); }}>{t('مسح الفترة', 'Clear Period', lang)}</Button>
        </div>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-t-4 border-t-emerald-500"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{t('إجمالي الإيرادات', 'Total Revenue', lang)}</p><p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalRevenue, lang)}</p></CardContent></Card>
        <Card className="border-t-4 border-t-rose-500"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{t('إجمالي التكاليف', 'Total Costs', lang)}</p><p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(totalCost, lang)}</p></CardContent></Card>
        <Card className={`border-t-4 ${totalProfit >= 0 ? 'border-t-teal-500' : 'border-t-amber-500'}`}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{t('صافي الربح', 'Net Profit', lang)}</p><p className={`text-2xl font-bold mt-1 ${totalProfit >= 0 ? 'text-teal-600' : 'text-amber-600'}`}>{formatCurrency(totalProfit, lang)}</p></CardContent></Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('المشروع', 'Project', lang)}</TableHead>
                <TableHead>{t('الحالة', 'Status', lang)}</TableHead>
                <TableHead className="text-end">{t('الإيراد', 'Revenue', lang)}</TableHead>
                <TableHead className="text-end">{t('التكلفة', 'Cost', lang)}</TableHead>
                <TableHead className="text-end">{t('الربح', 'Profit', lang)}</TableHead>
                <TableHead className="text-end">{t('الهامش', 'Margin', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{t('جاري التحميل...', 'Loading...', lang)}</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><PieChart className="size-10 mx-auto mb-2 text-muted-foreground/40" />{t('لا توجد مشاريع', 'No projects', lang)}</TableCell></TableRow>
              ) : rows.map(r => {
                const st = PROJECT_STATUS[r.status] || PROJECT_STATUS.PLANNING;
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{lang === 'ar' ? st.ar : st.en}</span></TableCell>
                    <TableCell className="text-end">{formatCurrency(r.revenue, lang)}</TableCell>
                    <TableCell className="text-end">{formatCurrency(r.cost, lang)}</TableCell>
                    <TableCell className={`text-end font-medium ${r.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(r.profit, lang)}</TableCell>
                    <TableCell className={`text-end ${r.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{r.margin.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </ModuleLayout>
  );
}