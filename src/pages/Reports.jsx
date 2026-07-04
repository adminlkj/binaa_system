import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, FileText, RefreshCw, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency } from '@/lib/utils-binaa';
import ModuleLayout from '@/components/shared/ModuleLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import TableToolbar from '@/components/shared/TableToolbar';

export default function Reports({ initialReport = 'income', hideSelector = false }) {
  const { lang } = useStore();
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState(initialReport);

  useEffect(() => { setActiveReport(initialReport); }, [initialReport]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [journal, setJournal] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [inv, exp, je, pay, acc] = await Promise.all([
        base44.entities.SalesInvoice.list('-date'),
        base44.entities.Expense.list('-date'),
        base44.entities.JournalEntry.list('-date'),
        base44.entities.PayrollRun.list('-created_date'),
        base44.entities.ChartAccount.list('code'),
      ]);
      setInvoices(inv); setExpenses(exp); setJournal(je); setPayroll(pay); setAccounts(acc);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Income Statement
  const totalRevenue = invoices.filter(i => ['PAID', 'PARTIALLY_PAID'].includes(i.status))
    .reduce((s, i) => s + (i.paidAmount || i.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
  const totalPayroll = payroll.filter(p => p.status === 'PAID').reduce((s, p) => s + (p.netAmount || 0), 0);
  const totalCosts = totalExpenses + totalPayroll;
  const netProfit = totalRevenue - totalCosts;

  // Trial Balance from Journal Entries
  const postedEntries = journal.filter(j => j.isPosted);
  const totalDebit = postedEntries.reduce((s, j) => s + (j.totalDebit || 0), 0);
  const totalCredit = postedEntries.reduce((s, j) => s + (j.totalCredit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // VAT Report
  const vatCollected = invoices.reduce((s, i) => s + (i.vatAmount || 0), 0);
  const vatPaid = expenses.reduce((s, e) => s + (e.vatAmount || 0), 0);
  const vatNet = vatCollected - vatPaid;

  // Account balances from journal
  const accountBalances = {};
  postedEntries.forEach(entry => {
    (entry.lines || []).forEach(line => {
      const code = line.accountCode || 'MISC';
      const name = line.accountName || code;
      if (!accountBalances[code]) accountBalances[code] = { code, name, debit: 0, credit: 0 };
      accountBalances[code].debit += (line.debit || 0);
      accountBalances[code].credit += (line.credit || 0);
    });
  });
  const trialBalanceRows = Object.values(accountBalances);
  const accountMeta = Object.fromEntries(accounts.map(a => [a.code, a]));
  const balanceRows = trialBalanceRows.map(row => {
    const type = accountMeta[row.code]?.accountType || 'ASSET';
    const amount = type === 'ASSET' ? row.debit - row.credit : row.credit - row.debit;
    return { ...row, type, amount };
  }).filter(r => ['ASSET', 'LIABILITY', 'EQUITY'].includes(r.type));
  const totalAssets = balanceRows.filter(r => r.type === 'ASSET').reduce((s, r) => s + r.amount, 0);
  const totalLiabilities = balanceRows.filter(r => r.type === 'LIABILITY').reduce((s, r) => s + r.amount, 0);
  const totalEquity = balanceRows.filter(r => r.type === 'EQUITY').reduce((s, r) => s + r.amount, 0);

  const reports = [
    { key: 'income', ar: 'قائمة الدخل', en: 'Income Statement', groupAr: 'تقارير مالية', groupEn: 'Financial Reports' },
    { key: 'balance', ar: 'المركز المالي (الميزانية)', en: 'Balance Sheet', groupAr: 'تقارير مالية', groupEn: 'Financial Reports' },
    { key: 'cashflow', ar: 'التدفقات النقدية', en: 'Cash Flow', groupAr: 'تقارير مالية', groupEn: 'Financial Reports' },
    { key: 'trial', ar: 'ميزان المراجعة', en: 'Trial Balance', groupAr: 'تقارير مالية', groupEn: 'Financial Reports' },
    { key: 'vat', ar: 'تقرير ضريبة القيمة المضافة', en: 'VAT Report', groupAr: 'تقارير مالية', groupEn: 'Financial Reports' },
  ];

  const fmt = (n) => formatCurrency(n, lang);

  // ─── مجموعات بيانات الطباعة/التصدير لكل قائمة مالية ───
  const twoCol = [
    { header: { ar: 'البند', en: 'Item' }, value: (r) => r.label },
    { header: { ar: 'المبلغ', en: 'Amount' }, value: (r) => r.amount },
  ];

  const incomeRows = [
    { label: t('إجمالي الإيرادات', 'Total Revenue', lang), amount: fmt(totalRevenue) },
    { label: t('المصروفات التشغيلية', 'Operational Expenses', lang), amount: fmt(totalExpenses) },
    { label: t('الرواتب المدفوعة', 'Paid Payroll', lang), amount: fmt(totalPayroll) },
    { label: t('إجمالي التكاليف', 'Total Costs', lang), amount: fmt(totalCosts) },
    { label: t('صافي الربح / الخسارة', 'Net Profit / Loss', lang), amount: fmt(netProfit) },
  ];

  const trialColumns = [
    { header: { ar: 'كود الحساب', en: 'Account Code' }, value: (r) => r.code },
    { header: { ar: 'اسم الحساب', en: 'Account Name' }, value: (r) => r.name },
    { header: { ar: 'مدين', en: 'Debit' }, value: (r) => fmt(r.debit) },
    { header: { ar: 'دائن', en: 'Credit' }, value: (r) => fmt(r.credit) },
    { header: { ar: 'الرصيد', en: 'Balance' }, value: (r) => `${fmt(Math.abs(r.debit - r.credit))} ${r.debit >= r.credit ? t('مدين', 'Dr', lang) : t('دائن', 'Cr', lang)}` },
  ];

  const balanceColumns = [
    { header: { ar: 'النوع', en: 'Type' }, value: (r) => r.type },
    { header: { ar: 'كود الحساب', en: 'Account Code' }, value: (r) => r.code },
    { header: { ar: 'اسم الحساب', en: 'Account Name' }, value: (r) => r.name },
    { header: { ar: 'الرصيد', en: 'Balance' }, value: (r) => fmt(r.amount) },
  ];

  const vatRows = [
    { label: t('ضريبة محصلة (مبيعات)', 'VAT Collected (Sales)', lang), amount: fmt(vatCollected) },
    { label: t('ضريبة مدفوعة (مشتريات)', 'VAT Paid (Purchases)', lang), amount: fmt(vatPaid) },
    { label: t('صافي الضريبة المستحقة', 'Net VAT Due', lang), amount: fmt(vatNet) },
  ];

  const cashflowInflow = invoices.filter(i => ['PAID', 'PARTIALLY_PAID'].includes(i.status)).reduce((s, i) => s + (i.paidAmount || 0), 0);
  const cashflowRows = [
    { label: t('تحصيلات العملاء (تدفق داخل)', 'Client Collections (Inflow)', lang), amount: fmt(cashflowInflow) },
    { label: t('مدفوعات الموردين والمصروفات', 'Supplier & Expense Payments', lang), amount: fmt(totalExpenses) },
    { label: t('مسيرات الرواتب', 'Payroll', lang), amount: fmt(totalPayroll) },
    { label: t('صافي التدفق النقدي', 'Net Cash Flow', lang), amount: fmt(netProfit) },
  ];

  return (
    <ModuleLayout
      title={t('التقارير المالية', 'Financial Reports', lang)}
      subtitle={t('تقارير الأداء المالي الشاملة', 'Comprehensive financial performance reports', lang)}
      actions={<Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="size-4" />{t('تحديث', 'Refresh', lang)}</Button>}
    >
      {/* Report Selector */}
      <div className={`space-y-2 ${hideSelector ? 'hidden' : ''}`}>
        <p className="text-xs font-semibold text-muted-foreground">{t('تقارير مالية', 'Financial Reports', lang)}</p>
        <div className="flex gap-2 flex-wrap">
          {reports.map(r => (
            <button key={r.key} onClick={() => setActiveReport(r.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeReport === r.key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
              {t(r.ar, r.en, lang)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardContent className="p-5"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>)}</div>
      ) : (
        <>
          {/* Income Statement */}
          {activeReport === 'income' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-t-4 border-t-emerald-500">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('إجمالي الإيرادات', 'Total Revenue', lang)}</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalRevenue, lang)}</p>
                  </CardContent>
                </Card>
                <Card className="border-t-4 border-t-rose-500">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('إجمالي التكاليف', 'Total Costs', lang)}</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(totalCosts, lang)}</p>
                  </CardContent>
                </Card>
                <Card className={`border-t-4 ${netProfit >= 0 ? 'border-t-teal-500' : 'border-t-amber-500'}`}>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('صافي الربح / الخسارة', 'Net Profit / Loss', lang)}</p>
                    <p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? 'text-teal-600' : 'text-amber-600'}`}>{formatCurrency(netProfit, lang)}</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{t('تفاصيل قائمة الدخل', 'Income Statement Details', lang)}</CardTitle>
                  <TableToolbar columns={twoCol} rows={incomeRows} title={{ ar: 'قائمة الدخل', en: 'Income Statement' }} />
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      <TableRow className="font-semibold bg-emerald-50">
                        <TableCell>{t('الإيرادات', 'Revenue', lang)}</TableCell>
                        <TableCell className="text-end text-emerald-700">{formatCurrency(totalRevenue, lang)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="ps-8 text-muted-foreground">{t('← فواتير المبيعات المحصلة', '← Collected Sales Invoices', lang)}</TableCell>
                        <TableCell className="text-end">{formatCurrency(totalRevenue, lang)}</TableCell>
                      </TableRow>
                      <TableRow className="font-semibold bg-rose-50">
                        <TableCell>{t('التكاليف والمصروفات', 'Costs & Expenses', lang)}</TableCell>
                        <TableCell className="text-end text-rose-700">{formatCurrency(totalCosts, lang)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="ps-8 text-muted-foreground">{t('← المصروفات التشغيلية', '← Operational Expenses', lang)}</TableCell>
                        <TableCell className="text-end">{formatCurrency(totalExpenses, lang)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="ps-8 text-muted-foreground">{t('← الرواتب المدفوعة', '← Paid Payroll', lang)}</TableCell>
                        <TableCell className="text-end">{formatCurrency(totalPayroll, lang)}</TableCell>
                      </TableRow>
                      <TableRow className={`font-bold text-base ${netProfit >= 0 ? 'bg-teal-50' : 'bg-amber-50'}`}>
                        <TableCell>{t('صافي الربح', 'Net Profit', lang)}</TableCell>
                        <TableCell className={`text-end ${netProfit >= 0 ? 'text-teal-700' : 'text-amber-700'}`}>{formatCurrency(netProfit, lang)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Balance Sheet */}
          {activeReport === 'balance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-t-4 border-t-emerald-500"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{t('إجمالي الأصول', 'Total Assets', lang)}</p><p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalAssets, lang)}</p></CardContent></Card>
                <Card className="border-t-4 border-t-amber-500"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{t('إجمالي الالتزامات', 'Total Liabilities', lang)}</p><p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(totalLiabilities, lang)}</p></CardContent></Card>
                <Card className="border-t-4 border-t-sky-500"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{t('حقوق الملكية', 'Equity', lang)}</p><p className="text-2xl font-bold text-sky-600 mt-1">{formatCurrency(totalEquity, lang)}</p></CardContent></Card>
              </div>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{t('تفاصيل المركز المالي', 'Balance Sheet Details', lang)}</CardTitle>
                  <TableToolbar columns={balanceColumns} rows={balanceRows} title={{ ar: 'المركز المالي', en: 'Balance Sheet' }} />
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('نوع الحساب', 'Account Type', lang)}</TableHead>
                        <TableHead>{t('كود الحساب', 'Account Code', lang)}</TableHead>
                        <TableHead>{t('اسم الحساب', 'Account Name', lang)}</TableHead>
                        <TableHead className="text-end">{t('الرصيد', 'Balance', lang)}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balanceRows.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">{t('لا توجد أرصدة مرحّلة', 'No posted balances', lang)}</TableCell></TableRow>
                      ) : balanceRows.map(row => (
                        <TableRow key={row.code}>
                          <TableCell>{row.type === 'ASSET' ? t('أصول', 'Assets', lang) : row.type === 'LIABILITY' ? t('التزامات', 'Liabilities', lang) : t('حقوق ملكية', 'Equity', lang)}</TableCell>
                          <TableCell className="font-mono text-xs">{row.code}</TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-end font-semibold">{formatCurrency(row.amount, lang)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50"><TableCell colSpan={3}>{t('إجمالي الأصول', 'Total Assets', lang)}</TableCell><TableCell className="text-end text-emerald-700">{formatCurrency(totalAssets, lang)}</TableCell></TableRow>
                      <TableRow className="font-bold bg-muted/50"><TableCell colSpan={3}>{t('إجمالي الالتزامات وحقوق الملكية', 'Total Liabilities & Equity', lang)}</TableCell><TableCell className="text-end text-sky-700">{formatCurrency(totalLiabilities + totalEquity, lang)}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Trial Balance */}
          {activeReport === 'trial' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: isBalanced ? '#f0fdf4' : '#fff7ed', borderColor: isBalanced ? '#86efac' : '#fdba74' }}>
                <Calculator className={`size-5 ${isBalanced ? 'text-emerald-600' : 'text-amber-600'}`} />
                <div>
                  <p className={`font-semibold ${isBalanced ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {isBalanced ? t('✓ ميزان المراجعة متوازن', '✓ Trial Balance is Balanced', lang) : t('⚠ ميزان غير متوازن', '⚠ Trial Balance Unbalanced', lang)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('إجمالي المدين', 'Total Debit', lang)}: {formatCurrency(totalDebit, lang)} | {t('إجمالي الدائن', 'Total Credit', lang)}: {formatCurrency(totalCredit, lang)}</p>
                </div>
                <div className="ms-auto">
                  <TableToolbar columns={trialColumns} rows={trialBalanceRows} title={{ ar: 'ميزان المراجعة', en: 'Trial Balance' }} />
                </div>
              </div>
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('كود الحساب', 'Account Code', lang)}</TableHead>
                        <TableHead>{t('اسم الحساب', 'Account Name', lang)}</TableHead>
                        <TableHead className="text-end">{t('مدين', 'Debit', lang)}</TableHead>
                        <TableHead className="text-end">{t('دائن', 'Credit', lang)}</TableHead>
                        <TableHead className="text-end">{t('الرصيد', 'Balance', lang)}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trialBalanceRows.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">{t('لا توجد قيود مرحّلة', 'No posted entries', lang)}</TableCell></TableRow>
                      ) : trialBalanceRows.map(row => (
                        <TableRow key={row.code}>
                          <TableCell className="font-mono text-xs">{row.code}</TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-end">{formatCurrency(row.debit, lang)}</TableCell>
                          <TableCell className="text-end">{formatCurrency(row.credit, lang)}</TableCell>
                          <TableCell className={`text-end font-medium ${row.debit - row.credit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(Math.abs(row.debit - row.credit), lang)} {row.debit >= row.credit ? t('مدين', 'Dr', lang) : t('دائن', 'Cr', lang)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell colSpan={2}>{t('الإجمالي', 'Total', lang)}</TableCell>
                        <TableCell className="text-end">{formatCurrency(totalDebit, lang)}</TableCell>
                        <TableCell className="text-end">{formatCurrency(totalCredit, lang)}</TableCell>
                        <TableCell className={`text-end ${isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isBalanced ? t('✓ متوازن', '✓ Balanced', lang) : formatCurrency(Math.abs(totalDebit - totalCredit), lang)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}

          {/* VAT Report */}
          {activeReport === 'vat' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-t-4 border-t-emerald-500">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('ضريبة محصلة (مبيعات)', 'VAT Collected (Sales)', lang)}</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(vatCollected, lang)}</p>
                  </CardContent>
                </Card>
                <Card className="border-t-4 border-t-rose-500">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('ضريبة مدفوعة (مشتريات)', 'VAT Paid (Purchases)', lang)}</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(vatPaid, lang)}</p>
                  </CardContent>
                </Card>
                <Card className={`border-t-4 ${vatNet >= 0 ? 'border-t-teal-500' : 'border-t-amber-500'}`}>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('صافي الضريبة المستحقة', 'Net VAT Due', lang)}</p>
                    <p className={`text-2xl font-bold mt-1 ${vatNet >= 0 ? 'text-teal-600' : 'text-amber-600'}`}>{formatCurrency(vatNet, lang)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{vatNet >= 0 ? t('مستحق للهيئة', 'Due to Authority', lang) : t('مستحق للاسترداد', 'Due for Refund', lang)}</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{t('تفاصيل الضريبة', 'VAT Details', lang)}</CardTitle>
                  <TableToolbar columns={twoCol} rows={vatRows} title={{ ar: 'تقرير ضريبة القيمة المضافة', en: 'VAT Report' }} />
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('النوع', 'Type', lang)}</TableHead>
                        <TableHead>{t('عدد العمليات', 'Count', lang)}</TableHead>
                        <TableHead className="text-end">{t('إجمالي القاعدة', 'Taxable Amount', lang)}</TableHead>
                        <TableHead className="text-end">{t('مبلغ الضريبة', 'VAT Amount', lang)}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">{t('فواتير المبيعات', 'Sales Invoices', lang)}</TableCell>
                        <TableCell>{invoices.length}</TableCell>
                        <TableCell className="text-end">{formatCurrency(invoices.reduce((s, i) => s + (i.subtotal || 0), 0), lang)}</TableCell>
                        <TableCell className="text-end text-emerald-600">{formatCurrency(vatCollected, lang)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">{t('المصروفات', 'Expenses', lang)}</TableCell>
                        <TableCell>{expenses.length}</TableCell>
                        <TableCell className="text-end">{formatCurrency(expenses.reduce((s, e) => s + (e.amount || 0), 0), lang)}</TableCell>
                        <TableCell className="text-end text-rose-600">{formatCurrency(vatPaid, lang)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Cash Flow */}
          {activeReport === 'cashflow' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-t-4 border-t-emerald-500">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('التدفقات الداخلة', 'Cash Inflows', lang)}</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (i.paidAmount || i.totalAmount || 0), 0), lang)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('فواتير مدفوعة بالكامل', 'Fully paid invoices', lang)}</p>
                  </CardContent>
                </Card>
                <Card className="border-t-4 border-t-rose-500">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('التدفقات الخارجة', 'Cash Outflows', lang)}</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(totalCosts, lang)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('مصروفات + رواتب', 'Expenses + Payroll', lang)}</p>
                  </CardContent>
                </Card>
                <Card className={`border-t-4 ${netProfit >= 0 ? 'border-t-teal-500' : 'border-t-amber-500'}`}>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('صافي التدفق', 'Net Cash Flow', lang)}</p>
                    <p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? 'text-teal-600' : 'text-amber-600'}`}>{formatCurrency(netProfit, lang)}</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">{t('تفاصيل التدفق النقدي', 'Cash Flow Details', lang)}</CardTitle>
                  <TableToolbar columns={twoCol} rows={cashflowRows} title={{ ar: 'التدفق النقدي', en: 'Cash Flow' }} />
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      <TableRow className="font-semibold bg-emerald-50">
                        <TableCell>{t('الأنشطة التشغيلية — تدفق داخل', 'Operating Activities — Inflow', lang)}</TableCell>
                        <TableCell className="text-end text-emerald-700">{formatCurrency(totalRevenue, lang)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="ps-8 text-muted-foreground">{t('تحصيلات العملاء', 'Client Collections', lang)}</TableCell>
                        <TableCell className="text-end">{formatCurrency(invoices.filter(i => ['PAID', 'PARTIALLY_PAID'].includes(i.status)).reduce((s, i) => s + (i.paidAmount || 0), 0), lang)}</TableCell>
                      </TableRow>
                      <TableRow className="font-semibold bg-rose-50">
                        <TableCell>{t('الأنشطة التشغيلية — تدفق خارج', 'Operating Activities — Outflow', lang)}</TableCell>
                        <TableCell className="text-end text-rose-700">{formatCurrency(totalCosts, lang)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="ps-8 text-muted-foreground">{t('مدفوعات الموردين والمصروفات', 'Supplier & Expense Payments', lang)}</TableCell>
                        <TableCell className="text-end">{formatCurrency(totalExpenses, lang)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="ps-8 text-muted-foreground">{t('مسيرات الرواتب', 'Payroll', lang)}</TableCell>
                        <TableCell className="text-end">{formatCurrency(totalPayroll, lang)}</TableCell>
                      </TableRow>
                      <TableRow className={`font-bold text-base ${netProfit >= 0 ? 'bg-teal-50' : 'bg-amber-50'}`}>
                        <TableCell>{t('صافي التدفق النقدي', 'Net Cash Flow', lang)}</TableCell>
                        <TableCell className={`text-end ${netProfit >= 0 ? 'text-teal-700' : 'text-amber-700'}`}>{formatCurrency(netProfit, lang)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </ModuleLayout>
  );
}