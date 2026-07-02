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
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';

const STATUSES = { DRAFT: { ar: 'مسودة', en: 'Draft', color: 'bg-slate-100 text-slate-700' }, APPROVED: { ar: 'موافق عليه', en: 'Approved', color: 'bg-blue-100 text-blue-700' }, ORDERED: { ar: 'مطلوب', en: 'Ordered', color: 'bg-amber-100 text-amber-700' }, RECEIVED: { ar: 'مستلم', en: 'Received', color: 'bg-emerald-100 text-emerald-700' }, CANCELLED: { ar: 'ملغي', en: 'Cancelled', color: 'bg-rose-100 text-rose-700' } };
const VAT_RATE = 0.15;
const empty = { orderNo: '', supplierId: '', supplierName: '', projectId: '', projectName: '', date: '', expectedDelivery: '', totalAmount: '', vatAmount: '', status: 'DRAFT', description: '', notes: '' };

export default function PurchaseOrders() {
  const { lang } = useStore();
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [o, s, p] = await Promise.all([base44.entities.PurchaseOrder.list('-created_date', 200), base44.entities.Supplier.list(), base44.entities.Project.list()]);
      setItems(o); setSuppliers(s); setProjects(p);
    } catch { toast.error(t('فشل تحميل البيانات', 'Failed to load', lang)); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => {
    const match = !search || i.orderNo?.toLowerCase().includes(search.toLowerCase()) || i.supplierName?.toLowerCase().includes(search.toLowerCase());
    return match && (filterStatus === 'ALL' || i.status === filterStatus);
  });

  const openNew = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...empty, ...item }); setDialogOpen(true); };
  const askDelete = (id) => { setDeleteId(id); setConfirmOpen(true); };

  // Auto-calculate VAT
  const baseAmount = parseFloat(form.totalAmount) || 0;
  const vatAmt = +(baseAmount * VAT_RATE).toFixed(2);
  const grandTotal = +(baseAmount + vatAmt).toFixed(2);

  const save = async () => {
    if (!form.orderNo || !form.supplierId) return toast.error(t('رقم الأمر والمورد مطلوبان', 'Order No. and supplier required', lang));
    setSaving(true);
    try {
      const s = suppliers.find(s => s.id === form.supplierId);
      const p = projects.find(p => p.id === form.projectId);
      const data = { ...form, totalAmount: baseAmount, vatAmount: vatAmt, supplierName: s?.name || form.supplierName, projectName: p?.name || form.projectName };
      if (editing) { await base44.entities.PurchaseOrder.update(editing.id, data); toast.success(t('تم التحديث', 'Updated', lang)); }
      else { await base44.entities.PurchaseOrder.create(data); toast.success(t('تمت الإضافة', 'Added', lang)); }
      setDialogOpen(false); load();
    } catch { toast.error(t('فشل الحفظ', 'Save failed', lang)); }
    setSaving(false);
  };

  const remove = async () => {
    try { await base44.entities.PurchaseOrder.delete(deleteId); toast.success(t('تم الحذف', 'Deleted', lang)); load(); }
    catch { toast.error(t('فشل الحذف', 'Delete failed', lang)); }
  };

  const totalValue = filtered.reduce((s, i) => s + (i.totalAmount || 0) + (i.vatAmount || 0), 0);

  return (
    <ModuleLayout
      title={t('أوامر الشراء', 'Purchase Orders', lang)}
      subtitle={t('إدارة أوامر الشراء من الموردين', 'Manage purchase orders from suppliers', lang)}
      actions={<Button onClick={openNew} className="gap-2 bg-amber-600 hover:bg-amber-700"><Plus className="size-4" />{t('أمر شراء جديد', 'New Order', lang)}</Button>}
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

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('رقم الأمر', 'Order No.', lang)}</TableHead>
                <TableHead>{t('المورد', 'Supplier', lang)}</TableHead>
                <TableHead>{t('المشروع', 'Project', lang)}</TableHead>
                <TableHead>{t('التاريخ', 'Date', lang)}</TableHead>
                <TableHead>{t('المبلغ', 'Amount', lang)}</TableHead>
                <TableHead>{t('الضريبة 15%', 'VAT 15%', lang)}</TableHead>
                <TableHead>{t('الإجمالي', 'Grand Total', lang)}</TableHead>
                <TableHead>{t('الحالة', 'Status', lang)}</TableHead>
                <TableHead>{t('الإجراءات', 'Actions', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>)
                : filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">{t('لا توجد أوامر شراء', 'No purchase orders', lang)}</TableCell></TableRow>
                : filtered.map(item => {
                  const st = STATUSES[item.status] || STATUSES.DRAFT;
                  const computed_vat = (item.vatAmount !== undefined && item.vatAmount !== null) ? item.vatAmount : +(( item.totalAmount || 0) * VAT_RATE).toFixed(2);
                  const computed_total = (item.totalAmount || 0) + computed_vat;
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-medium">{item.orderNo}</TableCell>
                      <TableCell className="font-medium">{item.supplierName || '—'}</TableCell>
                      <TableCell className="text-sm">{item.projectName || '—'}</TableCell>
                      <TableCell className="text-xs">{formatDate(item.date, lang)}</TableCell>
                      <TableCell>{formatCurrency(item.totalAmount, lang)}</TableCell>
                      <TableCell className="text-amber-600">{formatCurrency(computed_vat, lang)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(computed_total, lang)}</TableCell>
                      <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{lang === 'ar' ? st.ar : st.en}</span></TableCell>
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
      <p className="text-sm text-muted-foreground">{filtered.length} {t('أمر شراء', 'orders', lang)} | {t('الإجمالي', 'Total', lang)}: <strong>{formatCurrency(totalValue, lang)}</strong></p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t('تعديل أمر الشراء', 'Edit Order', lang) : t('أمر شراء جديد', 'New Purchase Order', lang)}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5"><Label>{t('رقم الأمر', 'Order No.', lang)} *</Label><Input value={form.orderNo} onChange={e => setForm(f => ({ ...f, orderNo: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>{t('المورد', 'Supplier', lang)} *</Label>
              <Select value={form.supplierId} onValueChange={v => { const s = suppliers.find(s => s.id === v); setForm(f => ({ ...f, supplierId: v, supplierName: s?.name || '' })); }}>
                <SelectTrigger><SelectValue placeholder={t('اختر مورد', 'Select supplier', lang)} /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('المشروع', 'Project', lang)}</Label>
              <Select value={form.projectId} onValueChange={v => { const p = projects.find(p => p.id === v); setForm(f => ({ ...f, projectId: v, projectName: p?.name || '' })); }}>
                <SelectTrigger><SelectValue placeholder={t('اختر مشروع', 'Select project', lang)} /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('التاريخ', 'Date', lang)}</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('تاريخ التسليم المتوقع', 'Expected Delivery', lang)}</Label><Input type="date" value={form.expectedDelivery} min={form.date || undefined} onChange={e => setForm(f => ({ ...f, expectedDelivery: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('المبلغ قبل الضريبة', 'Amount (before VAT)', lang)}</Label><Input type="number" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('ضريبة القيمة المضافة 15%', 'VAT 15% (auto)', lang)}</Label><Input readOnly value={vatAmt.toFixed(2)} className="bg-muted" /></div>
            <div className="space-y-1.5"><Label>{t('الإجمالي شامل الضريبة', 'Grand Total incl. VAT', lang)}</Label><Input readOnly value={grandTotal.toFixed(2)} className="bg-muted font-bold" /></div>
            <div className="space-y-1.5">
              <Label>{t('الحالة', 'Status', lang)}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5"><Label>{t('الوصف', 'Description', lang)}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('إلغاء', 'Cancel', lang)}</Button>
            <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700">{saving ? t('جاري الحفظ...', 'Saving...', lang) : t('حفظ', 'Save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen}
        title={t('حذف أمر الشراء', 'Delete Purchase Order', lang)}
        description={t('سيتم حذف أمر الشراء نهائياً.', 'This purchase order will be permanently deleted.', lang)}
        onConfirm={remove} confirmLabel={t('حذف', 'Delete', lang)} />
    </ModuleLayout>
  );
}