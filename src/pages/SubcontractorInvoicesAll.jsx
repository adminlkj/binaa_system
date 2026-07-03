import React, { useState, useEffect } from 'react';
import { ReceiptText, RefreshCw, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency, formatDate, STATUS_TONE } from '@/lib/utils-binaa';
import ModuleLayout from '@/components/shared/ModuleLayout';
import TableToolbar from '@/components/shared/TableToolbar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STATUS = {
  DRAFT: { ar: 'مسودة', en: 'Draft', color: STATUS_TONE.NEUTRAL },
  SUBMITTED: { ar: 'مقدّمة', en: 'Submitted', color: STATUS_TONE.INFO },
  APPROVED: { ar: 'معتمدة', en: 'Approved', color: STATUS_TONE.INFO },
  PARTIALLY_PAID: { ar: 'مدفوعة جزئياً', en: 'Partial', color: STATUS_TONE.PENDING },
  PAID: { ar: 'مدفوعة', en: 'Paid', color: STATUS_TONE.SUCCESS },
  REJECTED: { ar: 'مرفوضة', en: 'Rejected', color: STATUS_TONE.DANGER },
};

// عرض موحّد لكل مستخلصات مقاولي الباطن عبر النظام (للقراءة والمتابعة).
export default function SubcontractorInvoicesAll() {
  const { lang, setSubcontractorContext, setActiveItem } = useStore();
  const [rows, setRows] = useState([]);
  const [subs, setSubs] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [inv, subList] = await Promise.all([
        base44.entities.SubcontractorInvoice.list('-date', 500),
        base44.entities.Subcontractor.list('-created_date', 500),
      ]);
      setRows(inv);
      setSubs(Object.fromEntries(subList.map(s => [s.id, s])));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    const name = subs[r.subcontractorId]?.name || '';
    return !search || r.invoiceNo?.toLowerCase().includes(search.toLowerCase()) || name.toLowerCase().includes(search.toLowerCase());
  });

  const openSub = (id) => { const s = subs[id]; if (s) { setSubcontractorContext(s.id, s.name); setActiveItem('subcontractor-workspace'); } };

  const exportColumns = [
    { header: { ar: 'الرقم', en: 'No' }, value: (r) => r.invoiceNo },
    { header: { ar: 'المقاول', en: 'Subcontractor' }, value: (r) => subs[r.subcontractorId]?.name || '' },
    { header: { ar: 'التاريخ', en: 'Date' }, value: (r) => r.date },
    { header: { ar: 'الإجمالي', en: 'Total' }, value: (r) => r.totalAmount || 0 },
    { header: { ar: 'المدفوع', en: 'Paid' }, value: (r) => r.paidAmount || 0 },
    { header: { ar: 'الحالة', en: 'Status' }, value: (r) => { const st = STATUS[r.status]; return st ? (lang === 'ar' ? st.ar : st.en) : r.status; } },
  ];

  return (
    <ModuleLayout
      title={t('مستخلصات وفواتير مقاولي الباطن', 'Subcontractor Invoices', lang)}
      subtitle={t('كل المستخلصات المقدّمة من مقاولي الباطن', 'All invoices submitted by subcontractors', lang)}
      actions={
        <div className="flex items-center gap-2">
          <TableToolbar columns={exportColumns} rows={filtered} title={{ ar: 'مستخلصات مقاولي الباطن', en: 'Subcontractor Invoices' }} />
          <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="size-4" />{t('تحديث', 'Refresh', lang)}</Button>
        </div>
      }
    >
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('بحث بالرقم أو المقاول...', 'Search by number or subcontractor...', lang)} className="ps-9" />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('الرقم', 'No', lang)}</TableHead>
                <TableHead>{t('المقاول', 'Subcontractor', lang)}</TableHead>
                <TableHead>{t('التاريخ', 'Date', lang)}</TableHead>
                <TableHead className="text-end">{t('الإجمالي', 'Total', lang)}</TableHead>
                <TableHead className="text-end">{t('المدفوع', 'Paid', lang)}</TableHead>
                <TableHead>{t('الحالة', 'Status', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{t('جاري التحميل...', 'Loading...', lang)}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><ReceiptText className="size-10 mx-auto mb-2 text-muted-foreground/40" />{t('لا توجد مستخلصات', 'No invoices', lang)}</TableCell></TableRow>
              ) : filtered.map(r => {
                const s = STATUS[r.status] || STATUS.DRAFT;
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openSub(r.subcontractorId)}>
                    <TableCell className="font-mono text-xs">{r.invoiceNo}</TableCell>
                    <TableCell className="font-medium">{subs[r.subcontractorId]?.name || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(r.date, lang)}</TableCell>
                    <TableCell className="text-end">{formatCurrency(r.totalAmount, lang)}</TableCell>
                    <TableCell className="text-end text-emerald-600">{formatCurrency(r.paidAmount, lang)}</TableCell>
                    <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>{lang === 'ar' ? s.ar : s.en}</span></TableCell>
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