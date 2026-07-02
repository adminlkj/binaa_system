import React from 'react';
import SubAggregateList from '@/components/subcontractors/SubAggregateList';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/utils-binaa';

const METHODS = { CASH: { ar: 'نقدي', en: 'Cash' }, BANK_TRANSFER: { ar: 'تحويل', en: 'Transfer' }, CHEQUE: { ar: 'شيك', en: 'Cheque' }, CARD: { ar: 'بطاقة', en: 'Card' } };

export default function SubPaymentsAll() {
  const { lang } = useStore();
  return (
    <SubAggregateList
      entityName="SubcontractorPayment"
      searchField="paymentNo"
      title={{ ar: 'سداد مقاولي الباطن', en: 'Subcontractor Payments' }}
      subtitle={{ ar: 'كل سندات الصرف لمقاولي الباطن', en: 'All payments to subcontractors' }}
      columns={[
        { header: { ar: 'رقم السند', en: 'No' }, cell: r => <span className="font-mono text-xs">{r.paymentNo}</span> },
        { header: { ar: 'التاريخ', en: 'Date' }, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.date, lang)}</span> },
        { header: { ar: 'الطريقة', en: 'Method' }, cell: r => <span className="text-xs text-muted-foreground">{lang === 'ar' ? METHODS[r.method]?.ar : METHODS[r.method]?.en}</span> },
        { header: { ar: 'المرجع', en: 'Reference' }, cell: r => <span className="text-xs">{r.reference || '—'}</span> },
        { header: { ar: 'المبلغ', en: 'Amount' }, align: 'end', cell: r => <span className="text-emerald-600 font-medium">{formatCurrency(r.amount, lang)}</span> },
      ]}
    />
  );
}