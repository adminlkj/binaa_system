import React, { useState, useEffect } from 'react';
import { PieChart, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency } from '@/lib/utils-binaa';
import ModuleLayout from '@/components/shared/ModuleLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PROJECT_STATUS } from '@/lib/utils-binaa';

// تقرير محفظة المشاريع: الإيراد والتكلفة والربح لكل مشروع.
export default function ProjectReports() {
  const { lang } = useStore();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [pr, inv, po, exp] = await Promise.all([
        base44.entities.Project.list('-created_date', 500),
        base44.entities.SalesInvoice.list('-date', 1000),
        base44.entities.PurchaseOrder.list('-date', 1000),
        base44.entities.Expense.list('-date', 1000),
      ]);
      setProjects(pr); setInvoices(inv); setPurchases(po); setExpenses(exp);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const rows = projects.map(p => {
    const revenue = invoices.filter(i => i.projectId === p.id).reduce((s, i) => s + (i.totalAmount || 0), 0);
    const cost = purchases.filter(po => po.projectId === p.id).reduce((s, po) => s + (po.totalAmount || 0) + (po.vatAmount || 0), 0)
      + expenses.filter(e => e.projectId === p.id).reduce((s, e) => s + (e.totalAmount || e.amount || 0), 0);
    const profit = revenue - cost;
    const margin = revenue ? (profit / revenue) * 100 : 0;
    return { ...p, revenue, cost, profit, margin };
  });

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <ModuleLayout
      title={t('تقارير المشاريع', 'Project Reports', lang)}
      subtitle={t('ربحية محفظة المشاريع', 'Project portfolio profitability', lang)}
      actions={<Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="size-4" />{t('تحديث', 'Refresh', lang)}</Button>}
    >
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