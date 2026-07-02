import React from 'react';
import { useStore } from '@/lib/store';
import { t, formatCurrency, formatDate } from '@/lib/utils-binaa';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Unified project account statement: revenue (invoices) as debit-side to client,
// collections (paid) and costs (POs + expenses) combined into a chronological ledger.
export default function StatementTab({ invoices, purchases, expenses }) {
  const { lang } = useStore();

  const lines = [];
  invoices.forEach(i => {
    lines.push({ date: i.date, ref: i.invoiceNo, type: t('فاتورة عميل', 'Client Invoice', lang), debit: i.totalAmount || 0, credit: 0 });
    if (i.paidAmount) lines.push({ date: i.date, ref: i.invoiceNo, type: t('تحصيل', 'Collection', lang), debit: 0, credit: i.paidAmount });
  });
  purchases.forEach(p => {
    lines.push({ date: p.date, ref: p.orderNo, type: t('أمر شراء', 'Purchase Order', lang), debit: 0, credit: (p.totalAmount || 0) + (p.vatAmount || 0) });
  });
  expenses.forEach(e => {
    lines.push({ date: e.date, ref: e.reference || '—', type: t('مصروف', 'Expense', lang), debit: 0, credit: e.totalAmount || e.amount || 0 });
  });

  lines.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let running = 0;
  const withBalance = lines.map(l => { running += (l.debit - l.credit); return { ...l, balance: running }; });

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground">{t('إجمالي المدين', 'Total Debit', lang)}</div>
          <div className="text-base font-bold text-emerald-700">{formatCurrency(totalDebit, lang)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground">{t('إجمالي الدائن', 'Total Credit', lang)}</div>
          <div className="text-base font-bold text-rose-700">{formatCurrency(totalCredit, lang)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-muted-foreground">{t('الرصيد', 'Balance', lang)}</div>
          <div className="text-base font-bold text-blue-700">{formatCurrency(running, lang)}</div>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('التاريخ', 'Date', lang)}</TableHead>
                <TableHead>{t('المرجع', 'Reference', lang)}</TableHead>
                <TableHead>{t('البيان', 'Description', lang)}</TableHead>
                <TableHead>{t('مدين', 'Debit', lang)}</TableHead>
                <TableHead>{t('دائن', 'Credit', lang)}</TableHead>
                <TableHead>{t('الرصيد', 'Balance', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withBalance.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{t('لا توجد حركات', 'No transactions', lang)}</TableCell></TableRow>
              ) : withBalance.map((l, i) => (
                <TableRow key={i} className="hover:bg-muted/30">
                  <TableCell className="text-xs text-muted-foreground">{formatDate(l.date, lang)}</TableCell>
                  <TableCell className="font-mono text-xs">{l.ref}</TableCell>
                  <TableCell className="text-sm">{l.type}</TableCell>
                  <TableCell className="text-sm text-emerald-700">{l.debit ? formatCurrency(l.debit, lang) : '—'}</TableCell>
                  <TableCell className="text-sm text-rose-700">{l.credit ? formatCurrency(l.credit, lang) : '—'}</TableCell>
                  <TableCell className="text-sm font-medium">{formatCurrency(l.balance, lang)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}