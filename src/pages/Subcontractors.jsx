import React, { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency } from '@/lib/utils-binaa';
import ModuleLayout from '@/components/shared/ModuleLayout';
import { toast } from 'sonner';

const empty = { code: '', name: '', specialty: '', phone: '', email: '', taxNumber: '', contactPerson: '', totalContracts: '', totalPaid: '', notes: '' };

export default function Subcontractors() {
  const { lang } = useStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => { setLoading(true); setItems(await base44.entities.Subcontractor.list('-created_date')); setLoading(false); };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.code?.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...empty, ...item }); setDialogOpen(true); };

  const save = async () => {
    if (!form.code || !form.name) return toast.error(t('الكود والاسم مطلوبان', 'Code and name required', lang));
    setSaving(true);
    const data = { ...form, totalContracts: parseFloat(form.totalContracts) || 0, totalPaid: parseFloat(form.totalPaid) || 0 };
    if (editing) { await base44.entities.Subcontractor.update(editing.id, data); toast.success(t('تم التحديث', 'Updated', lang)); }
    else { await base44.entities.Subcontractor.create(data); toast.success(t('تمت الإضافة', 'Added', lang)); }
    setSaving(false); setDialogOpen(false); load();
  };

  const remove = async (id) => {
    if (!confirm(t('حذف؟', 'Delete?', lang))) return;
    await base44.entities.Subcontractor.delete(id); toast.success(t('تم الحذف', 'Deleted', lang)); load();
  };

  const fields = [['code', t('الكود', 'Code', lang)], ['name', t('الاسم', 'Name', lang)], ['specialty', t('التخصص', 'Specialty', lang)], ['phone', t('الهاتف', 'Phone', lang)], ['email', t('البريد', 'Email', lang)], ['taxNumber', t('الرقم الضريبي', 'Tax No.', lang)], ['contactPerson', t('شخص التواصل', 'Contact', lang)]];

  return (
    <ModuleLayout
      title={t('مقاولو الباطن', 'Subcontractors', lang)}
      subtitle={t('إدارة بيانات مقاولي الباطن', 'Manage subcontractor records', lang)}
      actions={<Button onClick={openNew} className="gap-2 bg-orange-600 hover:bg-orange-700"><Plus className="size-4" />{t('مقاول جديد', 'New Subcontractor', lang)}</Button>}
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
                <TableHead>{t('الكود', 'Code', lang)}</TableHead>
                <TableHead>{t('الاسم', 'Name', lang)}</TableHead>
                <TableHead>{t('التخصص', 'Specialty', lang)}</TableHead>
                <TableHead>{t('الهاتف', 'Phone', lang)}</TableHead>
                <TableHead>{t('إجمالي العقود', 'Total Contracts', lang)}</TableHead>
                <TableHead>{t('إجمالي المدفوع', 'Total Paid', lang)}</TableHead>
                <TableHead>{t('الإجراءات', 'Actions', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>)
                : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t('لا يوجد مقاولو باطن', 'No subcontractors', lang)}</TableCell></TableRow>
                : filtered.map(item => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-medium">{item.code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm">{item.specialty || '—'}</TableCell>
                    <TableCell className="text-sm">{item.phone || '—'}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(item.totalContracts, lang)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(item.totalPaid, lang)}</TableCell>
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? t('تعديل مقاول', 'Edit Subcontractor', lang) : t('مقاول جديد', 'New Subcontractor', lang)}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {fields.map(([field, label]) => <div key={field} className="space-y-1.5"><Label>{label}</Label><Input value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} /></div>)}
            <div className="space-y-1.5"><Label>{t('إجمالي العقود', 'Total Contracts', lang)}</Label><Input type="number" value={form.totalContracts} onChange={e => setForm(f => ({ ...f, totalContracts: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('إجمالي المدفوع', 'Total Paid', lang)}</Label><Input type="number" value={form.totalPaid} onChange={e => setForm(f => ({ ...f, totalPaid: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1.5"><Label>{t('ملاحظات', 'Notes', lang)}</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('إلغاء', 'Cancel', lang)}</Button>
            <Button onClick={save} disabled={saving} className="bg-orange-600 hover:bg-orange-700">{saving ? t('جاري الحفظ...', 'Saving...', lang) : t('حفظ', 'Save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  );
}