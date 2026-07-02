import React, { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency, formatDate, EXPENSE_CATEGORIES } from '@/lib/utils-binaa';
import { calcVAT, OperationEngine } from '@/lib/businessEngine';
import ModuleLayout from '@/components/shared/ModuleLayout';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';

const empty = {
  category: 'OTHER', description: '', amount: '',
  date: '', projectId: '', projectName: '', reference: '', notes: '',
  _vatEnabled: false,
};

export default function Expenses() {
  const { lang, activeProjectId, activeProjectName } = useStore();
  const [items, setItems]       = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterCat, setFilterCat] = useState('ALL');
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId]       = useState(null);
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(empty);
  const [saving, setSaving]           = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [e, p] = await Promise.all([
        base44.entities.Expense.list('-created_date', 200),
        base44.entities.Project.list(),
      ]);
      setItems(e); setProjects(p);
    } catch { toast.error(t('فشل تحميل البيانات', 'Failed to load', lang)); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const buildDefaultForm = () => ({
    ...empty,
    projectId:   activeProjectId   || '',
    projectName: activeProjectName || '',
  });

  const filtered = items.filter(i => {
    const match = !search || i.description?.toLowerCase().includes(search.toLowerCase());
    return match && (filterCat === 'ALL' || i.category === filterCat);
  });

  const openNew  = () => { setEditing(null); setForm(buildDefaultForm()); setDialogOpen(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...empty, ...item, _vatEnabled: (item.vatAmount || 0) > 0 });
    setDialogOpen(true);
  };
  const askDelete = (id) => { setDeleteId(id); setConfirmOpen(true); };

  // SSOT: حساب الضريبة من Business Engine فقط
  const amt = parseFloat(form.amount) || 0;
  const { vat: vatAmt, total: totalAmt } = form._vatEnabled ? calcVAT(amt) : { vat: 0, total: amt };

  const save = async () => {
    if (!form.description || !form.amount)
      return toast.error(t('الوصف والمبلغ مطلوبان', 'Description and amount required', lang));
    setSaving(true);
    try {
      const data = { ...form, _vatEnabled: form._vatEnabled };
      if (editing) {
        await OperationEngine.updateExpense(editing.id, data, projects);
        toast.success(t('تم التحديث', 'Updated', lang));
      } else {
        await OperationEngine.createExpense(data, projects);
        toast.success(t('تمت الإضافة + تم إنشاء القيد المحاسبي', 'Added + Journal Entry created', lang));
      }
      setDialogOpen(false); load();
    } catch (e) { toast.error(e?.message || t('فشل الحفظ', 'Save failed', lang)); }
    setSaving(false);
  };

  const remove = async () => {
    try { await base44.entities.Expense.delete(deleteId); toast.success(t('تم الحذف', 'Deleted', lang)); load(); }
    catch { toast.error(t('فشل الحذف', 'Delete failed', lang)); }
  };

  const totalExpenses = filtered.reduce((s, i) => s + (i.totalAmount || 0), 0);

  return (
    <ModuleLayout
      title={t('المصروفات العامة', 'General Expenses', lang)}
      subtitle={t('تسجيل ومتابعة المصروفات التشغيلية', 'Track operational expenses', lang)}
      actions={<Button onClick={openNew} className="gap-2 bg-rose-600 hover:bg-rose-700"><Plus className="size-4" />{t('مصروف جديد', 'New Expense', lang)}</Button>}
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('بحث...', 'Search...', lang)} className="ps-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('كل الفئات', 'All Categories', lang)}</SelectItem>
            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{lang === 'ar' ? c.ar : c.en}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="size-4" /></Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('التاريخ', 'Date', lang)}</TableHead>
                <TableHead>{t('الفئة', 'Category', lang)}</TableHead>
                <TableHead>{t('الوصف', 'Description', lang)}</TableHead>
                <TableHead>{t('المشروع', 'Project', lang)}</TableHead>
                <TableHead>{t('المبلغ', 'Amount', lang)}</TableHead>
                <TableHead>{t('الضريبة', 'VAT', lang)}</TableHead>
                <TableHead>{t('الإجمالي', 'Total', lang)}</TableHead>
                <TableHead>{t('الإجراءات', 'Actions', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>)
                : filtered.length === 0
                  ? <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{t('لا توجد مصروفات', 'No expenses', lang)}</TableCell></TableRow>
                  : filtered.map(item => {
                    const cat = EXPENSE_CATEGORIES.find(c => c.key === item.category);
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs">{formatDate(item.date, lang)}</TableCell>
                        <TableCell><span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">{cat ? (lang === 'ar' ? cat.ar : cat.en) : item.category}</span></TableCell>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.projectName || '—'}</TableCell>
                        <TableCell>{formatCurrency(item.amount, lang)}</TableCell>
                        <TableCell className="text-sm">{item.vatAmount ? formatCurrency(item.vatAmount, lang) : '—'}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(item.totalAmount, lang)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(item)}><Pencil className="size-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => askDelete(item.id)}><Trash2 className="size-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="text-sm text-muted-foreground">{filtered.length} {t('مصروف', 'expenses', lang)} | {t('الإجمالي', 'Total', lang)}: <strong>{formatCurrency(totalExpenses, lang)}</strong></p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t('تعديل المصروف', 'Edit Expense', lang) : t('مصروف جديد', 'New Expense', lang)}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('الفئة', 'Category', lang)}</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{lang === 'ar' ? c.ar : c.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('التاريخ', 'Date', lang)}</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1.5"><Label>{t('الوصف', 'Description', lang)} *</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>{t('المشروع', 'Project', lang)}</Label>
              <Select value={form.projectId} onValueChange={v => { const p = projects.find(p => p.id === v); setForm(f => ({ ...f, projectId: v, projectName: p?.name || '' })); }}>
                <SelectTrigger><SelectValue placeholder={t('اختياري', 'Optional', lang)} /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('المرجع', 'Reference', lang)}</Label><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('المبلغ', 'Amount', lang)} *</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form._vatEnabled} onChange={e => setForm(f => ({ ...f, _vatEnabled: e.target.checked }))} className="rounded" />
                {t('إضافة ضريبة 15%', 'Add VAT 15%', lang)}
              </label>
              {form._vatEnabled && <Input readOnly value={vatAmt.toFixed(2)} className="bg-muted mt-1" />}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{t('الإجمالي (محسوب)', 'Total (auto)', lang)}</Label>
              <Input readOnly value={totalAmt.toFixed(2)} className="bg-muted font-bold" />
            </div>
            <div className="col-span-2 space-y-1.5"><Label>{t('ملاحظات', 'Notes', lang)}</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('إلغاء', 'Cancel', lang)}</Button>
            <Button onClick={save} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
              {saving ? t('جاري الحفظ...', 'Saving...', lang) : editing ? t('حفظ', 'Save', lang) : t('حفظ + قيد محاسبي', 'Save + Post JE', lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen}
        title={t('حذف المصروف', 'Delete Expense', lang)}
        description={t('سيتم حذف المصروف نهائياً.', 'This expense will be permanently deleted.', lang)}
        onConfirm={remove} confirmLabel={t('حذف', 'Delete', lang)} />
    </ModuleLayout>
  );
}