import React, { useState, useEffect } from 'react';
import { LayoutGrid, FileText, ReceiptText, ShoppingCart, DollarSign, Building2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency, formatDate, INVOICE_STATUS } from '@/lib/utils-binaa';
import { PROJECT_STATUS } from '@/lib/utils-binaa';
import WorkspaceHeader from '@/components/workspace/WorkspaceHeader';
import WorkspaceTabs from '@/components/workspace/WorkspaceTabs';
import ProjectOverview from '@/components/workspace/ProjectOverview';
import RelatedList from '@/components/workspace/RelatedList';

export default function ProjectWorkspace() {
  const { lang, activeProjectId, activeProjectName, setActiveItem } = useStore();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    if (!activeProjectId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const [p, c, inv, po, exp] = await Promise.all([
          base44.entities.Project.filter({ id: activeProjectId }),
          base44.entities.Contract.filter({ projectId: activeProjectId }),
          base44.entities.SalesInvoice.filter({ projectId: activeProjectId }),
          base44.entities.PurchaseOrder.filter({ projectId: activeProjectId }),
          base44.entities.Expense.filter({ projectId: activeProjectId }),
        ]);
        setProject(p[0] || null);
        setContracts(c); setInvoices(inv); setPurchases(po); setExpenses(exp);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeProjectId]);

  if (!activeProjectId) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="size-14 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-bold">{t('لم يتم اختيار مشروع', 'No project selected', lang)}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {t('افتح مركز المشاريع واختر مشروعاً لعرض مركز عمله المتكامل.', 'Open the Projects module and pick a project to view its integrated workspace.', lang)}
          </p>
          <button onClick={() => setActiveItem('projects')} className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
            {t('الذهاب للمشاريع', 'Go to Projects', lang)}
          </button>
        </div>
      </div>
    );
  }

  if (loading || !project) {
    return (
      <div className="p-4 md:p-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  const revenue = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const costs = purchases.reduce((s, p) => s + (p.totalAmount || 0) + (p.vatAmount || 0), 0)
    + expenses.reduce((s, e) => s + (e.totalAmount || e.amount || 0), 0);

  const st = PROJECT_STATUS[project.status] || PROJECT_STATUS.PLANNING;
  const badge = <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{lang === 'ar' ? st.ar : st.en}</span>;

  const tabs = [
    { key: 'overview', ar: 'نظرة عامة', en: 'Overview', Icon: LayoutGrid },
    { key: 'contracts', ar: 'العقود', en: 'Contracts', Icon: FileText },
    { key: 'sales', ar: 'المبيعات', en: 'Sales', Icon: ReceiptText },
    { key: 'purchases', ar: 'المشتريات', en: 'Purchases', Icon: ShoppingCart },
    { key: 'expenses', ar: 'المصروفات', en: 'Expenses', Icon: DollarSign },
  ];

  return (
    <div className="p-4 md:p-6">
      <WorkspaceHeader
        title={project.name}
        subtitle={t('مركز عمل المشروع', 'Project Workspace', lang)}
        badge={badge}
        onBack={() => setActiveItem('projects')}
      />
      <WorkspaceTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && <ProjectOverview project={project} revenue={revenue} costs={costs} />}

      {tab === 'contracts' && (
        <RelatedList
          emptyText={t('لا توجد عقود لهذا المشروع', 'No contracts for this project', lang)}
          columns={[
            { header: { ar: 'رقم العقد', en: 'Contract No' }, cell: r => <span className="font-mono text-xs">{r.contractNo}</span> },
            { header: { ar: 'القيمة', en: 'Value' }, cell: r => formatCurrency(r.totalValue, lang) },
            { header: { ar: 'البداية', en: 'Start' }, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.startDate, lang)}</span> },
            { header: { ar: 'الحالة', en: 'Status' }, cell: r => <span className="text-xs">{r.status}</span> },
          ]}
          rows={contracts}
        />
      )}

      {tab === 'sales' && (
        <RelatedList
          emptyText={t('لا توجد فواتير لهذا المشروع', 'No invoices for this project', lang)}
          columns={[
            { header: { ar: 'رقم الفاتورة', en: 'Invoice No' }, cell: r => <span className="font-mono text-xs">{r.invoiceNo}</span> },
            { header: { ar: 'التاريخ', en: 'Date' }, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.date, lang)}</span> },
            { header: { ar: 'الإجمالي', en: 'Total' }, cell: r => formatCurrency(r.totalAmount, lang) },
            { header: { ar: 'المدفوع', en: 'Paid' }, cell: r => formatCurrency(r.paidAmount, lang) },
            { header: { ar: 'الحالة', en: 'Status' }, cell: r => {
              const s = INVOICE_STATUS?.[r.status];
              return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s?.color || 'bg-muted'}`}>{s ? (lang === 'ar' ? s.ar : s.en) : r.status}</span>;
            } },
          ]}
          rows={invoices}
        />
      )}

      {tab === 'purchases' && (
        <RelatedList
          emptyText={t('لا توجد أوامر شراء لهذا المشروع', 'No purchase orders for this project', lang)}
          columns={[
            { header: { ar: 'رقم الأمر', en: 'Order No' }, cell: r => <span className="font-mono text-xs">{r.orderNo}</span> },
            { header: { ar: 'المورد', en: 'Supplier' }, cell: r => <span className="text-sm">{r.supplierName || '—'}</span> },
            { header: { ar: 'التاريخ', en: 'Date' }, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.date, lang)}</span> },
            { header: { ar: 'القيمة', en: 'Amount' }, cell: r => formatCurrency((r.totalAmount || 0) + (r.vatAmount || 0), lang) },
            { header: { ar: 'الحالة', en: 'Status' }, cell: r => <span className="text-xs">{r.status}</span> },
          ]}
          rows={purchases}
        />
      )}

      {tab === 'expenses' && (
        <RelatedList
          emptyText={t('لا توجد مصروفات لهذا المشروع', 'No expenses for this project', lang)}
          columns={[
            { header: { ar: 'الوصف', en: 'Description' }, cell: r => <span className="text-sm">{r.description}</span> },
            { header: { ar: 'البند', en: 'Category' }, cell: r => <span className="text-xs text-muted-foreground">{r.category}</span> },
            { header: { ar: 'التاريخ', en: 'Date' }, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.date, lang)}</span> },
            { header: { ar: 'المبلغ', en: 'Amount' }, cell: r => formatCurrency(r.totalAmount || r.amount, lang) },
          ]}
          rows={expenses}
        />
      )}
    </div>
  );
}