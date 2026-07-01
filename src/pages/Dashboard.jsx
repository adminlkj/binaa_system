import React, { useState, useEffect } from 'react';
import {
  Building2, Truck, Users, Package, Calculator, TrendingUp, TrendingDown,
  DollarSign, CreditCard, AlertTriangle, Clock, Wallet, ArrowRight, ArrowLeft,
  FileText, BarChart3, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency, formatNumber, PROJECT_STATUS, EQUIPMENT_STATUS } from '@/lib/utils-binaa';

function KPICard({ title, value, subtitle, icon: Icon, iconColor, trend }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`size-11 rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon className="size-5 text-white" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {trend >= 0 ? '+' : ''}{formatNumber(trend)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { lang, setActiveItem } = useStore();
  const [projects, setProjects] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [p, eq, emp, inv, exp] = await Promise.all([
        base44.entities.Project.list('-created_date', 50),
        base44.entities.Equipment.list('-created_date', 50),
        base44.entities.Employee.filter({ isActive: true }),
        base44.entities.SalesInvoice.list('-created_date', 50),
        base44.entities.Expense.list('-created_date', 50),
      ]);
      setProjects(p); setEquipment(eq); setEmployees(emp); setInvoices(inv); setExpenses(exp);
      setLoading(false);
    };
    load();
  }, []);

  const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
  const totalContractValue = projects.reduce((s, p) => s + (p.contractValue || 0), 0);
  const totalRevenue = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (i.totalAmount || 0), 0);
  const pendingRevenue = invoices.filter(i => ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status)).reduce((s, i) => s + ((i.totalAmount || 0) - (i.paidAmount || 0)), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
  const availableEquip = equipment.filter(e => e.status === 'AVAILABLE').length;
  const rentedEquip = equipment.filter(e => e.status === 'RENTED').length;
  const maintenanceEquip = equipment.filter(e => e.status === 'MAINTENANCE').length;

  const equipStatusGroups = EQUIPMENT_STATUS;

  const recentProjects = projects.slice(0, 5);
  const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE');

  const constructionWorkflow = [
    { ar: 'العميل', en: 'Client', key: 'clients' },
    { ar: 'المشروع', en: 'Project', key: 'projects' },
    { ar: 'العقد', en: 'Contract', key: 'contracts' },
    { ar: 'BOQ', en: 'BOQ', key: 'boq' },
    { ar: 'الفاتورة', en: 'Invoice', key: 'sales' },
    { ar: 'التحصيل', en: 'Collection', key: 'client-payments' },
  ];
  const rentalWorkflow = [
    { ar: 'المعدة', en: 'Equipment', key: 'equipment' },
    { ar: 'عقد التأجير', en: 'Rental Contract', key: 'rental-contracts' },
    { ar: 'أمر التوصيل', en: 'Delivery Order', key: 'delivery-orders' },
    { ar: 'ساعات التشغيل', en: 'Timesheets', key: 'timesheets' },
    { ar: 'الفاتورة', en: 'Invoice', key: 'rental-invoices' },
    { ar: 'التحصيل', en: 'Collection', key: 'rental-payments' },
  ];

  const isRTL = lang === 'ar';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5"><div className="h-20 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('لوحة التحكم', 'Dashboard', lang)}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('نظرة عامة على أداء الشركة', 'Company performance overview', lang)}</p>
      </div>

      {/* Alerts */}
      {overdueInvoices.length > 0 && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4">
          <AlertTriangle className="size-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rose-700">{t('تحذير: فواتير متأخرة', 'Warning: Overdue Invoices', lang)}</p>
            <p className="text-xs text-rose-600 mt-0.5">{overdueInvoices.length} {t('فاتورة متأخرة السداد', 'overdue invoices pending collection', lang)}</p>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title={t('مشاريع نشطة', 'Active Projects', lang)} value={activeProjects} subtitle={`${t('إجمالي', 'Total', lang)}: ${projects.length}`} icon={Building2} iconColor="bg-emerald-500" />
        <KPICard title={t('إجمالي قيمة العقود', 'Total Contract Value', lang)} value={formatCurrency(totalContractValue, lang)} icon={FileText} iconColor="bg-blue-500" />
        <KPICard title={t('الإيرادات المحصلة', 'Collected Revenue', lang)} value={formatCurrency(totalRevenue, lang)} icon={TrendingUp} iconColor="bg-teal-500" />
        <KPICard title={t('الذمم المدينة', 'Outstanding Receivables', lang)} value={formatCurrency(pendingRevenue, lang)} icon={CreditCard} iconColor="bg-amber-500" />
        <KPICard title={t('إجمالي المعدات', 'Total Equipment', lang)} value={equipment.length} subtitle={`${t('متاحة', 'Available', lang)}: ${availableEquip}`} icon={Truck} iconColor="bg-cyan-500" />
        <KPICard title={t('المعدات المؤجرة', 'Rented Equipment', lang)} value={rentedEquip} subtitle={`${t('صيانة', 'Maintenance', lang)}: ${maintenanceEquip}`} icon={Package} iconColor="bg-purple-500" />
        <KPICard title={t('الموظفون النشطون', 'Active Employees', lang)} value={employees.length} icon={Users} iconColor="bg-violet-500" />
        <KPICard title={t('إجمالي المصروفات', 'Total Expenses', lang)} value={formatCurrency(totalExpenses, lang)} icon={DollarSign} iconColor="bg-rose-500" />
      </div>

      {/* Two Hub Panels */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Construction Hub */}
        <Card className="border-t-4 border-t-emerald-500">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Building2 className="size-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">{t('محور المشاريع التنفيذية', 'Construction Hub', lang)}</CardTitle>
                <p className="text-xs text-muted-foreground">{activeProjects} {t('مشروع نشط', 'active projects', lang)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Workflow */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t('سير العمل', 'Workflow', lang)}</p>
              <div className="flex items-center gap-1 flex-wrap">
                {constructionWorkflow.map((step, i) => (
                  <React.Fragment key={step.key}>
                    <button
                      onClick={() => setActiveItem(step.key)}
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap"
                    >
                      {lang === 'ar' ? step.ar : step.en}
                    </button>
                    {i < constructionWorkflow.length - 1 && <ArrowIcon className="size-3 text-emerald-400 shrink-0" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-50 rounded-lg p-2">
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalContractValue, lang)}</p>
                <p className="text-[10px] text-muted-foreground">{t('قيمة العقود', 'Contract Value', lang)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2">
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalRevenue, lang)}</p>
                <p className="text-[10px] text-muted-foreground">{t('الإيرادات', 'Revenue', lang)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2">
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalExpenses, lang)}</p>
                <p className="text-[10px] text-muted-foreground">{t('التكاليف', 'Costs', lang)}</p>
              </div>
            </div>
            {/* Recent Projects */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t('أحدث المشاريع', 'Recent Projects', lang)}</p>
              {recentProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">{t('لا توجد مشاريع', 'No projects yet', lang)}</p>
              ) : (
                <div className="space-y-1.5">
                  {recentProjects.map(p => {
                    const st = PROJECT_STATUS[p.status] || PROJECT_STATUS.PLANNING;
                    return (
                      <div key={p.id} className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-2">
                        <span className="font-medium text-foreground truncate">{p.name}</span>
                        <span className={`ms-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.color}`}>{lang === 'ar' ? st.ar : st.en}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <Button onClick={() => setActiveItem('projects')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2" size="sm">
              {t('عرض جميع المشاريع', 'View All Projects', lang)}
              <ArrowIcon className="size-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Rental Hub */}
        <Card className="border-t-4 border-t-cyan-500">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                <Truck className="size-5 text-cyan-600" />
              </div>
              <div>
                <CardTitle className="text-base">{t('محور تأجير المعدات', 'Equipment Rental Hub', lang)}</CardTitle>
                <p className="text-xs text-muted-foreground">{rentedEquip} {t('معدة مؤجرة', 'equipment rented', lang)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Workflow */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t('سير العمل', 'Workflow', lang)}</p>
              <div className="flex items-center gap-1 flex-wrap">
                {rentalWorkflow.map((step, i) => (
                  <React.Fragment key={step.key}>
                    <button
                      onClick={() => setActiveItem(step.key)}
                      className="rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[10px] font-medium text-cyan-700 hover:bg-cyan-100 transition-colors whitespace-nowrap"
                    >
                      {lang === 'ar' ? step.ar : step.en}
                    </button>
                    {i < rentalWorkflow.length - 1 && <ArrowIcon className="size-3 text-cyan-400 shrink-0" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
            {/* Equipment Status */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t('حالة المعدات', 'Equipment Status', lang)}</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(EQUIPMENT_STATUS).map(([status, cfg]) => {
                  const count = equipment.filter(e => e.status === status).length;
                  return (
                    <div key={status} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-xs text-muted-foreground">{lang === 'ar' ? cfg.ar : cfg.en}</span>
                      <span className="text-sm font-bold text-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-cyan-50 rounded-lg p-2">
                <p className="text-lg font-bold text-cyan-700">{availableEquip}</p>
                <p className="text-[10px] text-muted-foreground">{t('متاحة', 'Available', lang)}</p>
              </div>
              <div className="bg-cyan-50 rounded-lg p-2">
                <p className="text-lg font-bold text-cyan-700">{rentedEquip}</p>
                <p className="text-[10px] text-muted-foreground">{t('مؤجرة', 'Rented', lang)}</p>
              </div>
            </div>
            <Button onClick={() => setActiveItem('equipment')} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white gap-2" size="sm">
              {t('عرض جميع المعدات', 'View All Equipment', lang)}
              <ArrowIcon className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('الملخص المالي', 'Financial Summary', lang)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-emerald-50 rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">{t('إجمالي الإيرادات', 'Total Revenue', lang)}</p>
              <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalRevenue, lang)}</p>
            </div>
            <div className="text-center p-4 bg-rose-50 rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">{t('إجمالي المصروفات', 'Total Expenses', lang)}</p>
              <p className="text-xl font-bold text-rose-700">{formatCurrency(totalExpenses, lang)}</p>
            </div>
            <div className={`text-center p-4 rounded-xl ${totalRevenue - totalExpenses >= 0 ? 'bg-teal-50' : 'bg-amber-50'}`}>
              <p className="text-xs text-muted-foreground mb-1">{t('صافي الربح', 'Net Profit', lang)}</p>
              <p className={`text-xl font-bold ${totalRevenue - totalExpenses >= 0 ? 'text-teal-700' : 'text-amber-700'}`}>
                {formatCurrency(totalRevenue - totalExpenses, lang)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}