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
import { t, formatCurrency, formatDate, genCode } from '@/lib/utils-binaa';
import ModuleLayout from '@/components/shared/ModuleLayout';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';

const STATUS = {
  DRAFT:     { ar: 'مسودة',  en: 'Draft',    color: 'bg-slate-100 text-slate-700' },
  RECEIVED:  { ar: 'مستلم',  en: 'Received', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { ar: 'ملغي',   en: 'Cancelled', color: 'bg-rose-100 text-rose-700' },
};
const INV = {
  PENDING:  { ar: 'بانتظار الفوترة', en: 'Pending', color: 'bg-amber-100 text-amber-700' },
  INVOICED: { ar: 'تمت الفوترة',     en: 'Invoiced', color: 'bg-blue-100 text-blue-700' },
};

const empty = {
  receiptNo: '', date: '', purchaseOrderId: '', orderNo: '',
  supplierId: '', supplierName: '', projectId: '', projectName: '',
  warehouseId: '', warehouseName: '', description: '', receivedAmount: '',
  status: 'RECEIVED', invoicedStatus: 'PENDING', notes: '',
};

export default function GoodsReceipts() {
  const { lang } = useStore();
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
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
      const [g, po, w] = await Promise.all([
        base44.entities.GoodsReceipt.list('-created_date', 200),
        base44.entities.PurchaseOrder.list('-created_date', 200),
        base44.entities.Warehouse.list(),
      ]);
      setItems(g); setOrders(po); setWarehouses(w);
    } catch { toast.error(t('فشل تحميل البيانات', 'Failed to load', lang)); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // أوامر الشراء القابلة للاستلام (معتمدة/مطلوبة/مستلمة).
  const receivableOrders = orders.filter(o => ['APPROVED', 'ORDERED', 'RECEIVED'].includes(o.status));

  const filtered = items.filter(i => {
    const match = !search || i.receiptNo?.toLowerCase().includes(search.toLowerCase()) || i.supplierName?.toLowerCase().includes(search.toLowerCase()) || i.orderNo?.toLowerCase().includes(search.toLowerCase());
    return match && (filterStatus === 'ALL' || i.status === filterStatus);
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, receiptNo: genCode('GRN', items.length + 1), date: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  };
  const openEdit = (item) => { setEditing(item); setForm({ ...empty, ...item }); setDialogOpen(true); };
  const askDelete = (id) => { setDeleteId(id); setConfirmOpen(true); };

  // عند اختيار أمر الشراء: جلب المورد والمشروع والمخزن والقيمة من السلسلة.
  const onOrder = (v) => {
    if (v === 'none') { setForm(f => ({ ...f, purchaseOrderId: '', orderNo: '' })); return; }
    const o = orders.find(x => x.id === v);
    setForm(f => ({
      ...f,
      purchaseOrderId: v,
      orderNo: o?.orderNo || '',
      supplierId: o?.supplierId || '',
      supplierName: o?.supplierName || '',
      projectId: o?.projectId || '',
      projectName: o?.projectName || '',
      warehouseId: o?.warehouseId || f.warehouseId,
      warehouseName: o?.warehouseName || f.warehouseName,
      receivedAmount: f.receivedAmount || o?.totalAmount || '',
      description: f.description || o?.description || '',
    }));
  };

  const onWarehouse = (v) => {
    const w = warehouses.find(x => x.id === v);
    // مخزن المشروع يوجّه التكلفة للمشروع تلقائياً.
    setForm(f => ({
      ...f,
      warehouseId: v,
      warehouseName: w?.name || '',
      projectId: w?.projectId || f.projectId,
      projectName: w?.projectName || f.projectName,
    }));
  };

  const save = async () => {
    if (!form.receiptNo?.trim()) return toast.error(t('رقم السند مطلوب', 'Receipt No. required', lang));
    if (!form.purchaseOrderId) return toast.error(t('اختر أمر الشراء أولاً', 'Select a purchase order first', lang));
    setSaving(true);
    try {
      const data = { ...form, receivedAmount: Number(form.receivedAmount) || 0 };
      if (editing) { await base44.entities.GoodsReceipt.update(editing.id, data); toast.success(t('تم التحديث', 'Updated', lang)); }
      else {
        await base44.entities.GoodsReceipt.create(data);
        // تحديث حالة أمر الشراء إلى مستلم.
        if (data.purchaseOrderId) await base44.entities.PurchaseOrder.update(data.purchaseOrderId, { status: 'RECEIVED' });
        toast.success(t('تم تسجيل الاستلام', 'Receipt recorded', lang));
      }
      setDialogOpen(false); load();
    } catch (e) { toast.error(e?.message || t('فشل الحفظ', 'Save failed', lang)); }
    setSaving(false);
  };

  const remove = async () => {
    try { await base44.entities.GoodsReceipt.delete(deleteId); toast.success(t('تم الحذف', 'Deleted', lang)); load(); }
    catch { toast.error(t('فشل الحذف', 'Delete failed', lang)); }
  };

  const totalReceived = filtered.reduce((s, i) => s + (i.receivedAmount || 0), 0);

  return (
    <ModuleLayout
      title={t('سندات الاستلام', 'Goods Receipts', lang)}
      subtitle={t('استلام البضاعة من أمر الشراء — ثم تُنشأ الفاتورة من السند', 'Receive goods from a purchase order — the invoice is then created from the receipt', lang)}
      actions={<Button onClick={openNew} className="gap-2 bg-amber-600 hover:bg-amber-700"><Plus className="size-4" />{t('سند استلام', 'New Receipt', lang)}</Button>}
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
            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="size-4" /></Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('رقم السند', 'Receipt No.', lang)}</TableHead>
                <TableHead>{t('أمر الشراء', 'PO', lang)}</TableHead>
                <TableHead>{t('المورد', 'Supplier', lang)}</TableHead>
                <TableHead>{t('المشروع/المخزن', 'Project / Warehouse', lang)}</TableHead>
                <TableHead>{t('التاريخ', 'Date', lang)}</TableHead>
                <TableHead>{t('القيمة', 'Amount', lang)}</TableHead>
                <TableHead>{t('الفوترة', 'Invoicing', lang)}</TableHead>
                <TableHead>{t('الحالة', 'Status', lang)}</TableHead>
                <TableHead>{t('الإجراءات', 'Actions', lang)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>)
                : filtered.length === 0
                  ? <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">{t('لا توجد سندات استلام', 'No goods receipts', lang)}</TableCell></TableRow>
                  : filtered.map(item => {
                    const st = STATUS[item.status] || STATUS.RECEIVED;
                    const iv = INV[item.invoicedStatus] || INV.PENDING;
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs font-medium">{item.receiptNo}</TableCell>
                        <TableCell className="font-mono text-xs">{item.orderNo || '—'}</TableCell>
                        <TableCell className="font-medium">{item.supplierName || '—'}</TableCell>
                        <TableCell className="text-sm">{item.projectName || item.warehouseName || '—'}</TableCell>
                        <TableCell className="text-xs">{formatDate(item.date, lang)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(item.receivedAmount, lang)}</TableCell>
                        <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${iv.color}`}>{lang === 'ar' ? iv.ar : iv.en}</span></TableCell>
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
      <p className="text-sm text-muted-foreground">{filtered.length} {t('سند استلام', 'receipts', lang)} | {t('إجمالي المستلم', 'Total received', lang)}: <strong>{formatCurrency(totalReceived, lang)}</strong></p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t('تعديل سند الاستلام', 'Edit Receipt', lang) : t('سند استلام جديد', 'New Goods Receipt', lang)}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5"><Label>{t('رقم السند', 'Receipt No.', lang)} *</Label><Input value={form.receiptNo} onChange={e => setForm(f => ({ ...f, receiptNo: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{t('التاريخ', 'Date', lang)}</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1.5">
              <Label>{t('أمر الشراء', 'Purchase Order', lang)} *</Label>
              <Select value={form.purchaseOrderId || 'none'} onValueChange={onOrder}>
                <SelectTrigger><SelectValue placeholder={t('اختر أمر شراء', 'Select a purchase order', lang)} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('اختر', 'Select', lang)}</SelectItem>
                  {receivableOrders.map(o => <SelectItem key={o.id} value={o.id}>{o.orderNo} — {o.supplierName || ''} ({formatCurrency(o.totalAmount, lang)})</SelectItem>)}
                </SelectContent>
              </Select>
              {receivableOrders.length === 0 && <p className="text-[11px] text-rose-600">{t('لا توجد أوامر شراء معتمدة قابلة للاستلام', 'No approved purchase orders to receive', lang)}</p>}
            </div>
            <div className="space-y-1.5"><Label>{t('المورد', 'Supplier', lang)}</Label><Input value={form.supplierName} readOnly className="bg-muted" /></div>
            <div className="space-y-1.5">
              <Label>{t('مخزن الاستلام', 'Receiving Warehouse', lang)}</Label>
              <Select value={form.warehouseId || 'none'} onValueChange={v => v === 'none' ? setForm(f => ({ ...f, warehouseId: '', warehouseName: '' })) : onWarehouse(v)}>
                <SelectTrigger><SelectValue placeholder={t('بدون', 'None', lang)} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('بدون', 'None', lang)}</SelectItem>
                  {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}{w.projectName ? ` — ${w.projectName}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('المشروع', 'Project', lang)}</Label><Input value={form.projectName} readOnly className="bg-muted" placeholder={t('يُحدد من المخزن/الأمر', 'From warehouse/PO', lang)} /></div>
            <div className="space-y-1.5"><Label>{t('قيمة المستلم قبل الضريبة', 'Received Amount', lang)}</Label><Input type="number" value={form.receivedAmount} onChange={e => setForm(f => ({ ...f, receivedAmount: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>{t('الحالة', 'Status', lang)}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5"><Label>{t('وصف الأصناف المستلمة', 'Received Items', lang)}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('إلغاء', 'Cancel', lang)}</Button>
            <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700">{saving ? t('جاري الحفظ...', 'Saving...', lang) : t('حفظ', 'Save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen}
        title={t('حذف سند الاستلام', 'Delete Receipt', lang)}
        description={t('سيتم حذف السند نهائياً.', 'This receipt will be permanently deleted.', lang)}
        onConfirm={remove} confirmLabel={t('حذف', 'Delete', lang)} />
    </ModuleLayout>
  );
}