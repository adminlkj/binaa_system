import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useStore } from '@/lib/store';
import { t, formatDate } from '@/lib/utils-binaa';
import CrudTab from '@/components/workspace/CrudTab';

export default function DailyReportsTab({ projectId }) {
  const { lang } = useStore();

  return (
    <CrudTab
      entityName="DailyReport"
      filter={{ projectId }}
      defaults={{
        projectId,
        date: new Date().toISOString().slice(0, 10),
        workDone: '',
        workforce: 0,
        weather: '',
        notes: '',
      }}
      validate={(f) => (!f.date ? t('أدخل التاريخ', 'Enter date', lang) : null)}
      buildPayload={(f) => ({
        projectId,
        date: f.date || null,
        workDone: f.workDone,
        workforce: Number(f.workforce) || 0,
        weather: f.weather,
        notes: f.notes,
      })}
      labels={{
        new: { ar: 'تقرير يومي جديد', en: 'New Daily Report' },
        edit: { ar: 'تعديل التقرير اليومي', en: 'Edit Daily Report' },
        empty: { ar: 'لا توجد تقارير يومية لهذا المشروع', en: 'No daily reports for this project' },
        title: { ar: 'حذف التقرير', en: 'Delete Report' },
      }}
      summary={(rows) => (
        <>{t('التقارير اليومية', 'Daily reports', lang)}: <span className="font-bold text-foreground">{rows.length}</span></>
      )}
      columns={[
        { header: { ar: 'التاريخ', en: 'Date' }, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.date, lang)}</span> },
        { header: { ar: 'الأعمال المنجزة', en: 'Work Done' }, cell: r => <span className="text-sm line-clamp-1 max-w-[280px]">{r.workDone || '—'}</span> },
        { header: { ar: 'العمالة', en: 'Workforce' }, cell: r => <span className="tabular-nums">{r.workforce || 0}</span> },
        { header: { ar: 'الطقس', en: 'Weather' }, cell: r => <span className="text-sm text-muted-foreground">{r.weather || '—'}</span> },
      ]}
      fields={(form, set) => (
        <>
          <div className="space-y-1.5">
            <Label>{t('التاريخ', 'Date', lang)} *</Label>
            <Input type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('عدد العمالة', 'Workforce', lang)}</Label>
            <Input type="number" value={form.workforce ?? 0} onChange={e => set('workforce', e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('حالة الطقس', 'Weather', lang)}</Label>
            <Input value={form.weather || ''} onChange={e => set('weather', e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('الأعمال المنجزة', 'Work Done', lang)}</Label>
            <Textarea value={form.workDone || ''} onChange={e => set('workDone', e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('ملاحظات', 'Notes', lang)}</Label>
            <Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
        </>
      )}
    />
  );
}