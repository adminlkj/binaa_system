import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, FileWarning, HandCoins, FileClock, Wrench, RefreshCw, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency, formatDate } from '@/lib/utils-binaa';

const DAY = 864e5;

export default function NotificationCenter() {
  const store = useStore();
  const { lang } = store;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const build = useCallback(async () => {
    setLoading(true);
    const now = Date.now();
    try {
      const [invoices, advances, docs, maintenance] = await Promise.all([
        base44.entities.SalesInvoice.list('-date', 300).catch(() => []),
        base44.entities.EmployeeAdvance.list('-date', 300).catch(() => []),
        base44.entities.EmployeeDocument.list('-created_date', 300).catch(() => []),
        base44.entities.MaintenanceRecord.list('-date', 300).catch(() => []),
      ]);
      const items = [];

      // Overdue / unpaid invoices past due date
      invoices.forEach(inv => {
        const unpaid = (inv.totalAmount || 0) - (inv.paidAmount || 0);
        const overdue = inv.dueDate && new Date(inv.dueDate).getTime() < now;
        if (unpaid > 0.5 && (overdue || inv.status === 'OVERDUE')) {
          items.push({
            id: `inv-${inv.id}`, Icon: FileWarning, tone: 'rose',
            titleAr: `فاتورة متأخرة: ${inv.invoiceNo}`, titleEn: `Overdue invoice: ${inv.invoiceNo}`,
            metaAr: `${inv.clientName || ''} · متبقٍ ${formatCurrency(unpaid, lang)}`,
            metaEn: `${inv.clientName || ''} · ${formatCurrency(unpaid, lang)} due`,
            go: () => store.setActiveItem('sales'),
          });
        }
      });

      // Open advances not settled
      advances.filter(a => a.status !== 'SETTLED').forEach(a => {
        const rem = (a.amount || 0) - (a.deductedAmount || 0);
        if (rem > 0.5) items.push({
          id: `adv-${a.id}`, Icon: HandCoins, tone: 'amber',
          titleAr: 'سلفة موظف مفتوحة', titleEn: 'Open employee advance',
          metaAr: `متبقٍ ${formatCurrency(rem, lang)}`, metaEn: `${formatCurrency(rem, lang)} remaining`,
          go: () => { store.setEmployeeContext(a.employeeId, ''); store.setActiveItem('employee-workspace'); },
        });
      });

      // Documents expiring within 30 days
      docs.filter(d => d.expiryDate && new Date(d.expiryDate).getTime() < now + 30 * DAY).forEach(d => {
        items.push({
          id: `doc-${d.id}`, Icon: FileClock, tone: 'orange',
          titleAr: `وثيقة تنتهي قريباً: ${d.name}`, titleEn: `Document expiring: ${d.name}`,
          metaAr: `تنتهي ${formatDate(d.expiryDate, lang)}`, metaEn: `Expires ${formatDate(d.expiryDate, lang)}`,
          go: () => { store.setEmployeeContext(d.employeeId, ''); store.setActiveItem('employee-workspace'); },
        });
      });

      // Open maintenance work orders
      maintenance.filter(m => m.status === 'OPEN' || m.status === 'IN_PROGRESS').forEach(m => {
        items.push({
          id: `mnt-${m.id}`, Icon: Wrench, tone: 'cyan',
          titleAr: 'صيانة قيد التنفيذ', titleEn: 'Maintenance in progress',
          metaAr: m.description || '', metaEn: m.description || '',
          go: () => { store.setEquipmentContext(m.equipmentId, ''); store.setActiveItem('equipment-workspace'); },
        });
      });

      setTasks(items);
    } finally { setLoading(false); }
  }, [lang, store]);

  useEffect(() => { build(); }, [build]);

  const tones = {
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    orange: 'bg-orange-50 text-orange-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };

  const count = tasks.length;

  return (
    <div className="relative font-body" ref={boxRef}>
      <button onClick={() => setOpen(o => !o)} className="relative size-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute top-1 end-1 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full end-0 mt-2 w-80 bg-white border border-border rounded-xl shadow-lg z-50 max-h-[70vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-bold">{t('المهام والتنبيهات', 'Tasks & Alerts', lang)}</span>
            <button onClick={build} className="size-7 flex items-center justify-center rounded-md hover:bg-muted">
              <RefreshCw className={`size-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">{t('جاري التحميل...', 'Loading...', lang)}</div>
            ) : count === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="size-10 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm text-muted-foreground">{t('لا توجد مهام معلقة', 'All caught up!', lang)}</p>
              </div>
            ) : (
              tasks.map(item => {
                const Icon = item.Icon;
                return (
                  <button key={item.id} onClick={() => { item.go(); setOpen(false); }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-muted/60 text-start border-b border-border/50 last:border-0 transition-colors">
                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${tones[item.tone]}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-tight">{lang === 'ar' ? item.titleAr : item.titleEn}</div>
                      {(lang === 'ar' ? item.metaAr : item.metaEn) && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{lang === 'ar' ? item.metaAr : item.metaEn}</div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}