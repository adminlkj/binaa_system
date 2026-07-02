import React, { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency, formatDate } from '@/lib/utils-binaa';
import ModuleLayout from '@/components/shared/ModuleLayout';
import { toast } from 'sonner';

const emptyLine = { accountCode: '', accountName: '', debit: '', credit: '', description: '' };
const empty = { entryNo: '', date: '', description: '', isPosted: false, sourceType: '', lines: [{ ...emptyLine }, { ...emptyLine }] };

export default function JournalEntries() {
  const { lang } = useStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => { setLoading(true); setItems(await base44.entities.JournalEntry.list('-created_date')); setLoading(false); };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => !search || i.entryNo?.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setEditing(null); setForm({ ...empty, lines: [{ ...emptyLine }, { ...emptyLine }] }); setDialogOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...empty, ...item, lines: item.lines?.length ? item.lines : [{ ...emptyLine }, { ...emptyLine }] }); setDialogOpen(true); };

  const updateLine = (idx, field, val) => {
    setForm(f => { const lines = [...f.lines]; lines[idx] = { ...lines[idx], [field]: val }; return { ...f, lines }; });
  };
  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { ...emptyLine }] }));
  const removeLine = (idx) => setForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));

  const totalDebit = form.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const save = async () => {
    if (!form.entryNo || !form.date) return toast.error(t('رقم القيد والتاريخ مطلوبان', 'Entry No. and date required', lang));
    if (!isBalanced) return toast.error(t('القيد غير متوازن', 'Entry is not balanced', lang));
    setSaving(true);
    const lines = form.lines.map(l => ({ ...l, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0 }));
    const data = { ...form, lines, totalDebit, totalCredit };
    if (editing) { await base44.entities.JournalEntry.update(editing.id, data); toast.success(t('تم التحديث', 'Updated', lang)); }
    else { await base44.entities.JournalEntry.create(data); toast.success(t('تمت الإضافة', 'Added', lang)); }
    setSaving(false); setDialogOpen(false); load();
  };

  const remove = async (id) => {
    if (!confirm(t('حذف؟', 'Delete?', lang))) return;
    await base44.entities.JournalEntry.delete(id); toast.success(t('تم الحذف', 'Deleted', lang)); load();
  };

  return (
    <ModuleLayout
      title={t('دفتر اليومية', 'Journal Entries', lang)}
      subtitle={t('القيود المحاسبية اليومية', 'Daily accounting entries', lang)}
      actions={<Button onClick={openNew} className="gap-2 bg-teal-600 hover:bg-teal-700"><Plus className="size-4" />{t('قيد جديد', 'New Entry', lang)}</Button>}
    >
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('بحث...', 'Search...', lang)} className="ps-9" />
        </div>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="size-4" /></Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('رقم القيد', 'Entry No.', lang)}</TableHead>
                <TableHead>{t('التاريخ', 'Date', lang)}</TableHead>
                <TableHead>{t('الوصف', 'Description', lang)}</TableHead>
                <TableHead>{t('إجمالي المدين', 'Total Debit', lang)}</TableHead>
                <TableHead>{t('إجمالي الدائن', 'Total Credit', lang)}</TableHead>
                <TableHead>{t('الحالة', 'Status', lang)}</TableHead>
                <TableHead>{t('الإجراءات', 'Actions', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>)
                : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t('لا توجد قيود', 'No entries', lang)}</TableCell></TableRow>
                : filtered.map(item => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-medium">{item.entryNo}</TableCell>
                    <TableCell className="text-xs">{formatDate(item.date, lang)}</TableCell>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell>{formatCurrency(item.totalDebit, lang)}</TableCell>
                    <TableCell>{formatCurrency(item.totalCredit, lang)}</TableCell>
                    <TableCell>
                      {item.isPosted
                        ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle className="size-3" />{t('مرحّل', 'Posted', lang)}</span>
                        : <span className="text-xs text-muted-foreground">{t('مسودة', 'Draft', lang)}</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(item)}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => remove(item.id)}><Trash2 className="size-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t('تعديل القيد', 'Edit Entry', lang) : t('قيد جديد', 'New Journal Entry', lang)}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>{t('رقم القيد', 'Entry No.', lang)} *</Label><Input value={form.entryNo} onChange={e => setForm(f => ({ ...f, entryNo: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>{t('التاريخ', 'Date', lang)} *</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>{t('المصدر', 'Source', lang)}</Label><Input value={form.sourceType} onChange={e => setForm(f => ({ ...f, sourceType: e.target.value }))} /></div>
              <div className="col-span-3 space-y-1.5"><Label>{t('الوصف', 'Description', lang)}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            </div>

            {/* Lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t('بنود القيد', 'Entry Lines', lang)}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="size-3.5 me-1" />{t('إضافة بند', 'Add Line', lang)}</Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">{t('كود الحساب', 'Account Code', lang)}</TableHead>
                      <TableHead className="text-xs">{t('اسم الحساب', 'Account Name', lang)}</TableHead>
                      <TableHead className="text-xs">{t('مدين', 'Debit', lang)}</TableHead>
                      <TableHead className="text-xs">{t('دائن', 'Credit', lang)}</TableHead>
                      <TableHead className="text-xs">{t('بيان', 'Note', lang)}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.lines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="p-1"><Input value={line.accountCode} onChange={e => updateLine(idx, 'accountCode', e.target.value)} className="h-8 text-xs" /></TableCell>
                        <TableCell className="p-1"><Input value={line.accountName} onChange={e => updateLine(idx, 'accountName', e.target.value)} className="h-8 text-xs" /></TableCell>
                        <TableCell className="p-1"><Input type="number" value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)} className="h-8 text-xs" /></TableCell>
                        <TableCell className="p-1"><Input type="number" value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)} className="h-8 text-xs" /></TableCell>
                        <TableCell className="p-1"><Input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} className="h-8 text-xs" /></TableCell>
                        <TableCell className="p-1"><Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => removeLine(idx)}><Trash2 className="size-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell colSpan={2} className="text-xs">{t('الإجمالي', 'Total', lang)}</TableCell>
                      <TableCell className="text-xs">{formatCurrency(totalDebit, lang)}</TableCell>
                      <TableCell className="text-xs">{formatCurrency(totalCredit, lang)}</TableCell>
                      <TableCell colSpan={2} className="text-xs">
                        {isBalanced ? <span className="text-emerald-600">{t('✓ متوازن', '✓ Balanced', lang)}</span> : <span className="text-rose-600">{t('غير متوازن', 'Not balanced', lang)}</span>}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('إلغاء', 'Cancel', lang)}</Button>
            <Button onClick={save} disabled={saving || !isBalanced} className="bg-teal-600 hover:bg-teal-700">{saving ? t('جاري الحفظ...', 'Saving...', lang) : t('حفظ', 'Save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  );
}