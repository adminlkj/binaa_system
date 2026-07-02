import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { t } from '@/lib/utils-binaa';
import { APP_ROLES, APP_ROLE_KEYS } from '@/lib/permissions';
import { UserPlus } from 'lucide-react';

export default function InviteUserDialog({ open, onOpenChange, onInvited, lang }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [appRole, setAppRole] = useState('VIEWER');
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    if (!email || !email.includes('@')) {
      toast({ title: t('بريد غير صحيح', 'Invalid email', lang), variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      // System role: OWNER maps to admin, others to user
      const systemRole = appRole === 'OWNER' ? 'admin' : 'user';
      await base44.users.inviteUser(email, systemRole);
      toast({ title: t('تم إرسال الدعوة', 'Invitation sent', lang), description: email });
      setEmail('');
      setAppRole('VIEWER');
      onOpenChange(false);
      onInvited?.();
    } catch (e) {
      toast({ title: t('تعذر إرسال الدعوة', 'Could not send invite', lang), description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-emerald-600" />
            {t('دعوة مستخدم جديد', 'Invite New User', lang)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t('البريد الإلكتروني', 'Email', lang)}</Label>
            <Input type="email" dir="ltr" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('الدور الوظيفي', 'Business Role', lang)}</Label>
            <Select value={appRole} onValueChange={setAppRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APP_ROLE_KEYS.map(k => (
                  <SelectItem key={k} value={k}>{lang === 'ar' ? APP_ROLES[k].ar : APP_ROLES[k].en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('سيتم منح المستخدم صلاحيات هذا الدور. يمكنك تعديلها لاحقاً بعد قبوله الدعوة.',
                 'The user will get this role\'s permissions. You can adjust them after they accept.', lang)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel', lang)}</Button>
          <Button onClick={handleInvite} disabled={sending} className="bg-emerald-600 hover:bg-emerald-700">
            {sending ? t('جارٍ الإرسال...', 'Sending...', lang) : t('إرسال الدعوة', 'Send Invite', lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}