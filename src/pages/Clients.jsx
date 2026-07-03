import React, { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw, Users, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t } from '@/lib/utils-binaa';
import ModuleLayout from '@/components/shared/ModuleLayout';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import TableToolbar from '@/components/shared/TableToolbar';
import PartyStatementSection from '@/components/partners/PartyStatementSection';
import { toast } from 'sonner';

const empty = { code: '', name: '', nameAr: '', phone: '', email: '', address: '', taxNumber: '', contactPerson: '', notes: '' };

export default function Clients() {
  const { lang } = useStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('records'); // 'records' | 'statements'

  const load = async () => {
    setLoading(true);
    try { setItems(await base44.entities.Client.list('-created_date', 200)); }
    catch { toast.error(t('فشل تحميل البيانات', 'Failed to load', lang)); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.code?.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...empty, ...item }); setDialogOpen(true); };
  const askDelete = (id) => { setDeleteId(id); setConfirmOpen(true); };

  const save = async () => {
    if (!form.code || !form.name) return toast.error(t('الكود والاسم مطلوبان', 'Code and name are required', lang));
    setSaving(true);
    try {
      if (editing) { await base44.entities.Client.update(editing.id, form); toast.success(t('تم التحديث', 'Updated', lang)); }
      else { await base44.entities.Client.create(form); toast.success(t('تمت الإضافة', 'Added', lang)); }
      setDialogOpen(false); load();
    } catch { toast.error(t('فشل الحفظ', 'Save failed', lang)); }
    setSaving(false);
  };

  const remove = async () => {
    try { await base44.entities.Client.delete(deleteId); toast.success(t('تم الحذف', 'Deleted', lang)); load(); }
    catch { toast.error(t('فشل الحذف', 'Delete failed', lang)); }
  };

  const fields = [
    ['code', t('الكود', 'Code', lang)], ['name', t('الاسم', 'Name', lang)], ['nameAr', t('الاسم بالعربية', 'Name (Arabic)', lang)],
    ['phone', t('الهاتف', 'Phone', lang)], ['email', t('البريد الإلكتروني', 'Email', lang)],
    ['taxNumber', t('الرقم الضريبي', 'Tax Number', lang)], ['contactPerson', t('شخص التواصل', 'Contact Person', lang)],
  ];

  const exportColumns = [
    { header: { ar: 'الكود', en: 'Code' }, value: (r) => r.code },
    { header: { ar: 'الاسم', en: 'Name' }, value: (r) => r.name },
    { header: { ar: 'الهاتف', en: 'Phone' }, value: (r) => r.phone },
    { header: { ar: 'البريد الإلكتروني', en: 'Email' }, value: (r) => r.email },
    { header: { ar: 'الرقم الضريبي', en: 'Tax Number' }, value: (r) => r.taxNumber },
    { header: { ar: 'شخص التواصل', en: 'Contact' }, value: (r) => r.contactPerson },
  ];

  return (
    <ModuleLayout
      title={t('العملاء', 'Clients', lang)}
      subtitle={t('إدارة بيانات العملاء والكشوفات', 'Manage client records & statements', lang)}
      actions={view === 'records' ? (
        <div className="flex items-center gap-2">
          <TableToolbar columns={exportColumns} rows={filtered} title={{ ar: 'العملاء', en: 'Clients' }} />
          <Button onClick={openNew} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><Plus className="size-4" />{t('عميل جديد', 'New Client', lang)}</Button>
        </div>
      ) : null}
    >
      <div className="inline-flex rounded-lg border bg-muted/40 p-1 gap-1">
        <button onClick={() => setView('records')} className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition ${view === 'records' ? 'bg-background shadow text-emerald-700' : 'text-muted-foreground hover:text-foreground'}`}>
          <Users className="size-4" />{t('بيانات العملاء', 'Client Records', lang)}
        </button>
        <button onClick={() => setView('statements')} className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition ${view === 'statements' ? 'bg-background shadow text-emerald-700' : 'text-muted-foreground hover:text-foreground'}`}>
          <FileText className="size-4" />{t('الكشوفات والتحصيل', 'Statements & Collections', lang)}
        </button>
      </div>

      {view === 'statements' ? (
        <PartyStatementSection partyType="CLIENT" parties={items} />
      ) : (
      <>
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
                <TableHead>{t('الهاتف', 'Phone', lang)}</TableHead>
                <TableHead>{t('البريد الإلكتروني', 'Email', lang)}</TableHead>
                <TableHead>{t('الرقم الضريبي', 'Tax Number', lang)}</TableHead>
                <TableHead>{t('شخص التواصل', 'Contact', lang)}</TableHead>
                <TableHead>{t('الإجراءات', 'Actions', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>)
                : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t('لا يوجد عملاء', 'No clients found', lang)}</TableCell></TableRow>
                : filtered.map(item => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-medium">{item.code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.phone || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.email || '—'}</TableCell>
                    <TableCell className="text-sm">{item.taxNumber || '—'}</TableCell>
                    <TableCell className="text-sm">{item.contactPerson || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(item)}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => askDelete(item.id)}><Trash2 className="size-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <p className="text-sm text-muted-foreground">{filtered.length} {t('عميل', 'clients', lang)}</p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? t('تعديل العميل', 'Edit Client', lang) : t('عميل جديد', 'New Client', lang)}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {fields.map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <Label>{label}</Label>
                <Input value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
            <div className="col-span-2 space-y-1.5"><Label>{t('العنوان', 'Address', lang)}</Label><Textarea value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} /></div>
            <div className="col-span-2 space-y-1.5"><Label>{t('ملاحظات', 'Notes', lang)}</Label><Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('إلغاء', 'Cancel', lang)}</Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{saving ? t('جاري الحفظ...', 'Saving...', lang) : t('حفظ', 'Save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen}
        title={t('حذف العميل', 'Delete Client', lang)}
        description={t('سيتم حذف العميل نهائياً.', 'This client will be permanently deleted.', lang)}
        onConfirm={remove} confirmLabel={t('حذف', 'Delete', lang)} />
      </>
      )}
    </ModuleLayout>
  );
}