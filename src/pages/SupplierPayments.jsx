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

const METHODS = {
  CASH:          { ar: 'نقدي',       en: 'Cash' },
  BANK_TRANSFER: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
  CHEQUE:        { ar: 'شيك',        en: 'Cheque' },
  CARD:          { ar: 'بطاقة',      en: 'Card' },
};

const empty = {
  paymentNo: '', supplierId: '', supplierName: '', supplierInvoiceId: '',
  date: '', amount: '', method: 'BANK_TRANSFER', reference: '', notes: '',
};

export default function SupplierPayments() {
  const { lang } = useStore();
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pay, s, inv] = await Promise.all([
        base44.entities.SupplierPayment.list('-created_date', 200),
        base44.entities.Supplier.list(),
        base44.entities.SupplierInvoice.list('-created_date', 200),
      ]);
      setItems(pay); setSuppliers(s); setInvoices(inv);
    } catch { toast.error(t('فشل تحميل البيانات', 'Failed to load', lang)); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => !search || i.paymentNo?.toLowerCase().includes(search.toLowerCase()) || i.supplierName?.toLowerCase().includes(search.toLowerCase()));

  const supplierInvoices = invoices.filter(inv => inv.supplierId === form.supplierId);

  const openNew = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...empty, ...item }); setDialogOpen(true); };
  const askDelete = (id) => { setDeleteId(id); setConfirmOpen(true); };

  const save = async () => {
    if (!form.supplierId || !form.amount)
      return toast.error(t('المورد والمبلغ مطلوبان', 'Supplier and amount required', lang));
    setSaving(true);
    try {
      const data = { ...form, amount: parseFloat(form.amount) || 0 };
      if (editing) { await base44.entities.SupplierPayment.update(editing.id, data); toast.success(t('تم التحديث', 'Updated', lang)); }
      else { await base44.entities.SupplierPayment.create(data); toast.success(t('تمت الإضافة', 'Added', lang)); }
      setDialogOpen(false); load();
    } catch { toast.error(t('فشل الحفظ', 'Save failed', lang)); }
    setSaving(false);
  };

  const remove = async () => {
    try { await base44.entities.SupplierPayment.delete(deleteId); toast.success(t('تم الحذف', 'Deleted', lang)); load(); }
    catch { toast.error(t('فشل الحذف', 'Delete failed', lang)); }
  };

  const totalPaid = filtered.reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <ModuleLayout
      title={t('سداد الموردين', 'Supplier Payments', lang)}
      subtitle={t('سندات صرف ومدفوعات الموردين', 'Supplier payment vouchers', lang)}
      actions={<Button onClick={openNew} className="gap-2 bg-amber-600 hover:bg-amber-700"><Plus className="size-4" />{t('سند صرف جديد', 'New Payment', lang)}</Button>}
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
                <TableHead>{t('رقم السند', 'Voucher No.', lang)}</TableHead>
                <TableHead>{t('المورد', 'Supplier', lang)}</TableHead>
                <TableHead>{t('التاريخ', 'Date', lang)}</TableHead>
                <TableHead>{t('المبلغ', 'Amount', lang)}</TableHead>
                <TableHead>{t('طريقة الدفع', 'Method', lang)}</TableHead>
                <TableHead>{t('المرجع', 'Reference', lang)}</TableHead>
                <TableHead>{t('الإجراءات', 'Actions', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>)
                : filtered.length === 0
                  ? <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t('لا توجد سندات صرف', 'No payments', lang)}</TableCell></TableRow>
                  : filtered.map(item => {
                    const m = METHODS[item.method] || METHODS.BANK_TRANSFER;
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs font-medium">{item.paymentNo || '—'}</TableCell>
                        <TableCell className="font-medium">{item.supplierName || '—'}</TableCell>
                        <TableCell className="text-xs">{formatDate(item.date, lang)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(item.amount, lang)}</TableCell>
                        <TableCell><span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{lang === 'ar' ? m.ar : m.en}</span></TableCell>
                        <TableCell className="text-sm">{item.reference || '—'}</TableCell>
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

      <p className="text-sm text-muted-foreground">{filtered.length} {t('سند', 'payments', lang)} | {t('إجمالي المدفوع', 'Total Paid', lang)}: <strong className="text-amber-600">{formatCurrency(totalPaid, lang)}</strong></p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? t('تعديل سند الصرف', 'Edit Payment', lang) : t('سند صرف جديد', 'New Payment', lang)}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5"><Label>{t('رقم السند', 'Voucher No.', lang)}</Label><Input value={form.paymentNo} onChange={e => setForm(f => ({ ...f, paymentNo: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>{t('المورد', 'Supplier', lang)} *</Label>
              <Select value={form.supplierId} onValueChange={v => { const s = suppliers.find(s => s.id === v); setForm(f => ({ ...f, supplierId: v, supplierName: s?.name || '', supplierInvoiceId: '' })); }}>
                <SelectTrigger><SelectValue placeholder={t('اختر مورد', 'Select supplier', lang)} /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{t('الفاتورة المرتبطة', 'Linked Invoice', lang)}</Label>
              <Select value={form.supplierInvoiceId || 'none'} onValueChange={v => setForm(f => ({ ...f, supplierInvoiceId: v === 'none' ? '' : v }))} disabled={!form.supplierId}>
                <SelectTrigger><SelectValue placeholder={t('بدون', 'None', lang)} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('بدون', 'None', lang)}</SelectItem>
                  {supplierInvoices.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.invoiceNo} — {formatCurrency(inv.totalAmount, lang)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('التاريخ', 'Date', lang)}</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('المبلغ', 'Amount', lang)} *</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>{t('طريقة الدفع', 'Method', lang)}</Label>
              <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('المرجع / رقم الشيك', 'Reference', lang)}</Label><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1.5"><Label>{t('ملاحظات', 'Notes', lang)}</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('إلغاء', 'Cancel', lang)}</Button>
            <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700">{saving ? t('جاري الحفظ...', 'Saving...', lang) : t('حفظ', 'Save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen}
        title={t('حذف سند الصرف', 'Delete Payment', lang)}
        description={t('سيتم حذف سند الصرف نهائياً.', 'This payment will be permanently deleted.', lang)}
        onConfirm={remove} confirmLabel={t('حذف', 'Delete', lang)} />
    </ModuleLayout>
  );
}