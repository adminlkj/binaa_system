import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useStore } from '@/lib/store';
import { t } from '@/lib/utils-binaa';
import { clearAccountsCache } from '@/lib/postingEngine';
import { nextSerial } from '@/lib/businessEngine';
import ModuleLayout from '@/components/shared/ModuleLayout';
import ChartAccountDialog from '@/components/accounting/ChartAccountDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Search, Pencil, Trash2, Network, Tag } from 'lucide-react';

const TYPE_META = {
  ASSET: { ar: 'أصول', en: 'Assets', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  LIABILITY: { ar: 'خصوم', en: 'Liabilities', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  EQUITY: { ar: 'حقوق ملكية', en: 'Equity', color: 'text-violet-600 bg-violet-50 border-violet-200' },
  REVENUE: { ar: 'إيرادات', en: 'Revenue', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  EXPENSE: { ar: 'مصروفات', en: 'Expenses', color: 'text-rose-600 bg-rose-50 border-rose-200' },
};

export default function ChartAccounts() {
  const { lang } = useStore();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    const list = await base44.entities.ChartAccount.list('code', 1000);
    setAccounts(list || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Build parent → children map for tree rendering
  const roots = useMemo(() => accounts.filter(a => !a.parentCode), [accounts]);
  const childrenOf = (code) => accounts.filter(a => a.parentCode === code);

  const filtered = search
    ? accounts.filter(a =>
        a.code.includes(search) ||
        a.name.includes(search) ||
        (a.nameEn || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.semanticRole || '').toLowerCase().includes(search.toLowerCase()))
    : null;

  // ينشئ قيداً افتتاحياً متوازناً: طرف الحساب الجديد حسب طبيعته، والطرف المقابل
  // على حساب "رصيد افتتاحي — حقوق ملكية" ليبقى ميزان المراجعة متوازناً.
  const postOpeningBalance = async (acc) => {
    const equity = accounts.find(a => a.semanticRole === 'OPENING_BALANCE_EQUITY')
      || accounts.find(a => a.accountType === 'EQUITY');
    const equityCode = equity?.code || '3900';
    const equityName = equity?.name || 'رصيد افتتاحي';
    const amount = +Number(acc.openingBalance).toFixed(2);
    const onDebit = acc.nature === 'DEBIT';
    const desc = `رصيد افتتاحي — ${acc.name}`;
    const entryNo = await nextSerial(base44.entities.JournalEntry, 'entryNo', 'OB');
    await base44.entities.JournalEntry.create({
      entryNo,
      date: new Date().toISOString().slice(0, 10),
      description: desc,
      sourceType: 'OPENING_BALANCE',
      isPosted: true,
      totalDebit: amount,
      totalCredit: amount,
      lines: [
        { accountCode: acc.code, accountName: acc.name, debit: onDebit ? amount : 0, credit: onDebit ? 0 : amount, description: desc },
        { accountCode: equityCode, accountName: equityName, debit: onDebit ? 0 : amount, credit: onDebit ? amount : 0, description: desc },
      ],
    });
  };

  const handleSave = async (data, openingBalance = 0) => {
    if (editing) {
      await base44.entities.ChartAccount.update(editing.id, data);
    } else {
      await base44.entities.ChartAccount.create(data);
      if (openingBalance && Math.abs(openingBalance) > 0.001) {
        await postOpeningBalance({ ...data, openingBalance });
      }
    }
    clearAccountsCache();
    toast({ title: t('تم الحفظ', 'Saved', lang) });
    await load();
  };

  const handleDelete = async () => {
    await base44.entities.ChartAccount.delete(deleting.id);
    clearAccountsCache();
    setDeleting(null);
    toast({ title: t('تم الحذف', 'Deleted', lang) });
    await load();
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (acc) => { setEditing(acc); setDialogOpen(true); };

  const Row = ({ acc, depth }) => {
    const meta = TYPE_META[acc.accountType] || TYPE_META.ASSET;
    const kids = childrenOf(acc.code);
    return (
      <>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-lg group"
          style={{ paddingInlineStart: `${depth * 20 + 12}px` }}
        >
          <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">{acc.code}</span>
          <span className={`text-sm ${acc.isPostable ? 'font-medium' : 'font-bold'} truncate`}>
            {lang === 'ar' ? acc.name : (acc.nameEn || acc.name)}
          </span>
          {acc.semanticRole && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
              <Tag className="size-2.5" />{acc.semanticRole}
            </span>
          )}
          {!acc.isPostable && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{t('تجميعي', 'Group', lang)}</span>
          )}
          <span className={`ms-auto text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${meta.color}`}>
            {lang === 'ar' ? meta.ar : meta.en}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => openEdit(acc)} className="size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
              <Pencil className="size-3" />
            </button>
            <button onClick={() => setDeleting(acc)} className="size-6 flex items-center justify-center rounded hover:bg-rose-50 text-rose-500">
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
        {kids.map(k => <Row key={k.id} acc={k} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <ModuleLayout
      title={t('الدليل المحاسبي', 'Chart of Accounts', lang)}
      subtitle={t('شجرة الحسابات وأدوارها الدلالية — المصدر الموحّد للقيود', 'Accounts tree & semantic roles — single source for postings', lang)}
      actions={
        <Button onClick={openNew} className="bg-teal-600 hover:bg-teal-700 gap-1.5">
          <Plus className="size-4" />{t('حساب جديد', 'New Account', lang)}
        </Button>
      }
    >
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('بحث بالرقم أو الاسم أو الدور', 'Search code, name or role', lang)} className="ps-9" />
      </div>

      <Card>
        <CardContent className="p-2">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{t('جارٍ التحميل...', 'Loading...', lang)}</div>
          ) : accounts.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <Network className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">{t('لا توجد حسابات بعد', 'No accounts yet', lang)}</p>
            </div>
          ) : filtered ? (
            filtered.map(acc => <Row key={acc.id} acc={acc} depth={0} />)
          ) : (
            roots.map(acc => <Row key={acc.id} acc={acc} depth={0} />)
          )}
        </CardContent>
      </Card>

      <ChartAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
        parents={accounts}
        onSave={handleSave}
        lang={lang}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('حذف الحساب', 'Delete Account', lang)}
        description={t('هل أنت متأكد من حذف هذا الحساب؟', 'Are you sure you want to delete this account?', lang)}
        onConfirm={handleDelete}
      />
    </ModuleLayout>
  );
}