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
import { t, formatCurrency, formatDate } from '@/lib/utils-binaa';
import ModuleLayout from '@/components/shared/ModuleLayout';
import { toast } from 'sonner';

const STATUSES = { ACTIVE: { ar: 'نشط', en: 'Active', color: 'bg-emerald-100 text-emerald-700' }, ON_LEAVE: { ar: 'إجازة', en: 'On Leave', color: 'bg-amber-100 text-amber-700' }, TERMINATED: { ar: 'منتهي', en: 'Terminated', color: 'bg-rose-100 text-rose-700' } };
const empty = { code: '', name: '', nameAr: '', position: '', department: '', phone: '', email: '', nationalId: '', nationality: '', hireDate: '', salary: '', allowances: '', status: 'ACTIVE', notes: '' };

export default function Employees() {
  const { lang } = useStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => { setLoading(true); setItems(await base44.entities.Employee.list('-created_date')); setLoading(false); };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => {
    const matchSearch = !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.code?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || i.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openNew = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...empty, ...item }); setDialogOpen(true); };

  const save = async () => {
    if (!form.code || !form.name) return toast.error(t('الكود والاسم مطلوبان', 'Code and name are required', lang));
    setSaving(true);
    const data = { ...form, salary: parseFloat(form.salary) || 0, allowances: parseFloat(form.allowances) || 0, isActive: form.status === 'ACTIVE' };
    if (editing) { await base44.entities.Employee.update(editing.id, data); toast.success(t('تم التحديث', 'Updated', lang)); }
    else { await base44.entities.Employee.create(data); toast.success(t('تمت الإضافة', 'Added', lang)); }
    setSaving(false); setDialogOpen(false); load();
  };

  const remove = async (id) => {
    if (!confirm(t('هل أنت متأكد من الحذف؟', 'Delete?', lang))) return;
    await base44.entities.Employee.delete(id); toast.success(t('تم الحذف', 'Deleted', lang)); load();
  };

  const totalSalaries = filtered.reduce((s, e) => s + (e.salary || 0) + (e.allowances || 0), 0);

  return (
    <ModuleLayout
      title={t('الموظفون', 'Employees', lang)}
      subtitle={t('إدارة بيانات الموظفين والرواتب', 'Manage employee records', lang)}
      actions={<Button onClick={openNew} className="gap-2 bg-violet-600 hover:bg-violet-700"><Plus className="size-4" />{t('موظف جديد', 'New Employee', lang)}</Button>}
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('بحث...', 'Search...', lang)} className="ps-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('الكل', 'All', lang)}</SelectItem>
            {Object.entries(STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="size-4" /></Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Object.entries(STATUSES).map(([s, cfg]) => (
          <div key={s} className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold">{items.filter(i => i.status === s).length}</p>
            <p className="text-xs text-muted-foreground">{lang === 'ar' ? cfg.ar : cfg.en}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('الكود', 'Code', lang)}</TableHead>
                <TableHead>{t('الاسم', 'Name', lang)}</TableHead>
                <TableHead>{t('المنصب', 'Position', lang)}</TableHead>
                <TableHead>{t('القسم', 'Department', lang)}</TableHead>
                <TableHead>{t('الراتب', 'Salary', lang)}</TableHead>
                <TableHead>{t('الجنسية', 'Nationality', lang)}</TableHead>
                <TableHead>{t('الحالة', 'Status', lang)}</TableHead>
                <TableHead>{t('الإجراءات', 'Actions', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>)
                : filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{t('لا يوجد موظفون', 'No employees', lang)}</TableCell></TableRow>
                : filtered.map(item => {
                  const st = STATUSES[item.status] || STATUSES.ACTIVE;
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-medium">{item.code}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-sm">{item.position || '—'}</TableCell>
                      <TableCell className="text-sm">{item.department || '—'}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(item.salary, lang)}</TableCell>
                      <TableCell className="text-sm">{item.nationality || '—'}</TableCell>
                      <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{lang === 'ar' ? st.ar : st.en}</span></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(item)}><Pencil className="size-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => remove(item.id)}><Trash2 className="size-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="text-sm text-muted-foreground">{filtered.length} {t('موظف', 'employees', lang)} | {t('إجمالي الرواتب', 'Total salaries', lang)}: {formatCurrency(totalSalaries, lang)}</p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t('تعديل موظف', 'Edit Employee', lang) : t('موظف جديد', 'New Employee', lang)}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {[['code', t('الكود', 'Code', lang)], ['name', t('الاسم', 'Name', lang)], ['nameAr', t('الاسم بالعربية', 'Name (Arabic)', lang)], ['position', t('المنصب', 'Position', lang)], ['department', t('القسم', 'Department', lang)], ['phone', t('الهاتف', 'Phone', lang)], ['email', t('البريد الإلكتروني', 'Email', lang)], ['nationalId', t('رقم الهوية', 'National ID', lang)], ['nationality', t('الجنسية', 'Nationality', lang)]].map(([field, label]) => (
              <div key={field} className="space-y-1.5"><Label>{label}</Label><Input value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} /></div>
            ))}
            <div className="space-y-1.5"><Label>{t('تاريخ التعيين', 'Hire Date', lang)}</Label><Input type="date" value={form.hireDate} onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('الراتب الأساسي', 'Basic Salary', lang)}</Label><Input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('البدلات', 'Allowances', lang)}</Label><Input type="number" value={form.allowances} onChange={e => setForm(f => ({ ...f, allowances: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>{t('الحالة', 'Status', lang)}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5"><Label>{t('ملاحظات', 'Notes', lang)}</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('إلغاء', 'Cancel', lang)}</Button>
            <Button onClick={save} disabled={saving} className="bg-violet-600 hover:bg-violet-700">{saving ? t('جاري الحفظ...', 'Saving...', lang) : t('حفظ', 'Save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  );
}