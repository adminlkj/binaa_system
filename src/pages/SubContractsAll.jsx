import React from 'react';
import SubAggregateList from '@/components/subcontractors/SubAggregateList';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/utils-binaa';

const STATUS = {
  DRAFT: { ar: 'مسودة', en: 'Draft', color: 'bg-gray-100 text-gray-700' },
  ACTIVE: { ar: 'نشط', en: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  SUSPENDED: { ar: 'موقوف', en: 'Suspended', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed', color: 'bg-teal-100 text-teal-700' },
  TERMINATED: { ar: 'مفسوخ', en: 'Terminated', color: 'bg-rose-100 text-rose-700' },
};

export default function SubContractsAll() {
  const { lang } = useStore();
  return (
    <SubAggregateList
      entityName="SubcontractorContract"
      searchField="contractNo"
      title={{ ar: 'عقود مقاولي الباطن', en: 'Subcontractor Contracts' }}
      subtitle={{ ar: 'كل عقود الباطن عبر المشاريع', en: 'All subcontractor contracts across projects' }}
      columns={[
        { header: { ar: 'رقم العقد', en: 'Contract No' }, cell: r => <span className="font-mono text-xs">{r.contractNo}</span> },
        { header: { ar: 'العنوان', en: 'Title' }, cell: r => <span className="text-sm">{r.title || '—'}</span> },
        { header: { ar: 'المشروع', en: 'Project' }, cell: r => <span className="text-xs text-muted-foreground">{r.projectName || '—'}</span> },
        { header: { ar: 'التاريخ', en: 'Date' }, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.date, lang)}</span> },
        { header: { ar: 'القيمة', en: 'Value' }, align: 'end', cell: r => formatCurrency(r.value, lang) },
        { header: { ar: 'الحالة', en: 'Status' }, cell: r => { const s = STATUS[r.status] || STATUS.DRAFT; return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>{lang === 'ar' ? s.ar : s.en}</span>; } },
      ]}
    />
  );
}