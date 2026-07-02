import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { t } from '@/lib/utils-binaa';
import { APP_ROLES, APP_ROLE_KEYS, MODULES, resolveUserModules } from '@/lib/permissions';
import { ShieldCheck } from 'lucide-react';

const GROUP_LABELS = {
  projects: { ar: 'المشاريع', en: 'Projects' },
  rental: { ar: 'المعدات والتأجير', en: 'Equipment & Rental' },
  costs: { ar: 'المشتريات والتكاليف', en: 'Procurement & Costs' },
  hr: { ar: 'الموارد البشرية', en: 'HR' },
  accounting: { ar: 'المالية والمحاسبة', en: 'Finance & Accounting' },
  settings: { ar: 'الإعدادات والبيانات', en: 'Settings & Master Data' },
};

export default function EditUserDialog({ open, onOpenChange, user, onSaved, lang }) {
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [customModules, setCustomModules] = useState([]);
  const [useCustom, setUseCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        appRole: user.appRole || 'VIEWER',
        role: user.role || 'user',
        jobTitle: user.jobTitle || '',
        department: user.department || '',
        phone: user.phone || '',
        isActive: user.isActive !== false,
      });
      const hasCustom = Array.isArray(user.allowedModules) && user.allowedModules.length > 0;
      setUseCustom(hasCustom);
      setCustomModules(hasCustom ? user.allowedModules : resolveUserModules(user));
    }
  }, [user]);

  if (!user) return null;

  const roleDefaultModules = resolveUserModules({ ...user, allowedModules: [], role: form.role, appRole: form.appRole });
  const effectiveModules = useCustom ? customModules : roleDefaultModules;

  const toggleModule = (key) => {
    setCustomModules(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        appRole: form.appRole,
        role: form.appRole === 'OWNER' ? 'admin' : form.role,
        jobTitle: form.jobTitle,
        department: form.department,
        phone: form.phone,
        isActive: form.isActive,
        allowedModules: useCustom ? customModules : [],
      };
      await base44.entities.User.update(user.id, payload);
      toast({ title: t('تم حفظ التغييرات', 'Changes saved', lang) });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({ title: t('تعذر الحفظ', 'Save failed', lang), description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const grouped = MODULES.reduce((acc, m) => {
    (acc[m.group] = acc[m.group] || []).push(m);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600" />
            {t('تعديل المستخدم', 'Edit User', lang)} — {user.full_name || user.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Profile fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('المسمى الوظيفي', 'Job Title', lang)}</Label>
              <Input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('القسم', 'Department', lang)}</Label>
              <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('الهاتف', 'Phone', lang)}</Label>
              <Input dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('الدور الوظيفي', 'Business Role', lang)}</Label>
              <Select value={form.appRole} onValueChange={v => setForm({ ...form, appRole: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APP_ROLE_KEYS.map(k => (
                    <SelectItem key={k} value={k}>{lang === 'ar' ? APP_ROLES[k].ar : APP_ROLES[k].en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t('حساب نشط', 'Active Account', lang)}</p>
              <p className="text-xs text-muted-foreground">{t('المستخدمون غير النشطين لا يمكنهم استخدام النظام', 'Inactive users cannot access the system', lang)}</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v })} />
          </div>

          {/* Custom permissions */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('صلاحيات مخصصة', 'Custom Permissions', lang)}</p>
                <p className="text-xs text-muted-foreground">{t('تجاوز الصلاحيات الافتراضية للدور', 'Override the role\'s default access', lang)}</p>
              </div>
              <Switch checked={useCustom} onCheckedChange={setUseCustom} disabled={form.appRole === 'OWNER'} />
            </div>

            {form.appRole === 'OWNER' && (
              <p className="text-xs text-violet-600">{t('المالك لديه صلاحية الوصول الكامل دائماً.', 'Owner always has full access.', lang)}</p>
            )}

            <div className="space-y-3">
              {Object.entries(grouped).map(([group, mods]) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">{lang === 'ar' ? GROUP_LABELS[group]?.ar : GROUP_LABELS[group]?.en}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {mods.map(m => {
                      const checked = effectiveModules.includes(m.key);
                      return (
                        <button
                          key={m.key}
                          type="button"
                          disabled={!useCustom || form.appRole === 'OWNER'}
                          onClick={() => toggleModule(m.key)}
                          className={`text-xs rounded-md border px-2 py-1.5 text-start transition-colors
                            ${checked ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-muted/40 border-transparent text-muted-foreground'}
                            ${(!useCustom || form.appRole === 'OWNER') ? 'cursor-not-allowed opacity-70' : 'hover:border-emerald-300'}`}
                        >
                          {lang === 'ar' ? m.ar : m.en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel', lang)}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? t('جارٍ الحفظ...', 'Saving...', lang) : t('حفظ', 'Save', lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}