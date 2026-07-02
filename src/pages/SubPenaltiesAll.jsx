import React from 'react';
import SubAggregateList from '@/components/subcontractors/SubAggregateList';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/utils-binaa';

const STATUS = {
  PENDING: { ar: 'معلقة', en: 'Pending', color: 'bg-amber-100 text-amber-700' },
  APPLIED: { ar: 'مطبّقة', en: 'Applied', color: 'bg-rose-100 text-rose-700' },
  WAIVED: { ar: 'معفاة', en: 'Waived', color: 'bg-gray-100 text-gray-600' },
};
const REASONS = { DELAY: { ar: 'تأخير', en: 'Delay' }, QUALITY: { ar: 'جودة', en: 'Quality' }, SAFETY: { ar: 'سلامة', en: 'Safety' }, OTHER: { ar: 'أخرى', en: 'Other' } };

export default function SubPenaltiesAll() {
  const { lang } = useStore();
  return (
    <SubAggregateList
      entityName="SubcontractorPenalty"
      searchField="penaltyNo"
      title={{ ar: 'غرامات مقاولي الباطن', en: 'Subcontractor Penalties' }}
      subtitle={{ ar: 'كل الغرامات على مقاولي الباطن', en: 'All penalties on subcontractors' }}
      columns={[
        { header: { ar: 'الرقم', en: 'No' }, cell: r => <span className="font-mono text-xs">{r.penaltyNo}</span> },
        { header: { ar: 'السبب', en: 'Reason' }, cell: r => <span className="text-xs text-muted-foreground">{lang === 'ar' ? REASONS[r.reason]?.ar : REASONS[r.reason]?.en}</span> },
        { header: { ar: 'الوصف', en: 'Description' }, cell: r => <span className="text-sm">{r.description || '—'}</span> },
        { header: { ar: 'التاريخ', en: 'Date' }, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.date, lang)}</span> },
        { header: { ar: 'القيمة', en: 'Amount' }, align: 'end', cell: r => <span className="text-rose-600">{formatCurrency(r.amount, lang)}</span> },
        { header: { ar: 'الحالة', en: 'Status' }, cell: r => { const s = STATUS[r.status] || STATUS.PENDING; return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>{lang === 'ar' ? s.ar : s.en}</span>; } },
      ]}
    />
  );
}