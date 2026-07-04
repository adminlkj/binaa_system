import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useStore } from '@/lib/store';
import { t } from '@/lib/utils-binaa';
import { APP_ROLES, resolveUserModules } from '@/lib/permissions';
import ModuleLayout from '@/components/shared/ModuleLayout';
import InviteUserDialog from '@/components/users/InviteUserDialog';
import EditUserDialog from '@/components/users/EditUserDialog';
import ApproveRegistrationDialog from '@/components/users/ApproveRegistrationDialog';
import { UserPlus, Search, Pencil, ShieldCheck, ShieldAlert, Users as UsersIcon, Crown, Ban, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function Users() {
  const { lang } = useStore();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [approveRequest, setApproveRequest] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const current = await base44.auth.me();
      const [list, pendingRequests] = await Promise.all([
        base44.entities.User.list('-created_date', 200),
        current.role === 'admin' ? base44.users.listRegistrationRequests() : Promise.resolve([]),
      ]);
      setUsers(list);
      setRequests(pendingRequests);
      setMe(current);
    } catch (e) {
      toast({ title: t('تعذر تحميل المستخدمين', 'Failed to load users', lang), description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const isAdmin = me?.role === 'admin' || me?.appRole === 'OWNER';

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const toggleActive = async (u) => {
    try {
      await base44.entities.User.update(u.id, { isActive: u.isActive === false });
      toast({ title: t('تم التحديث', 'Updated', lang) });
      load();
    } catch (e) {
      toast({ title: t('تعذر التحديث', 'Update failed', lang), description: e.message, variant: 'destructive' });
    }
  };

  const handleUserSaved = (updatedUser, passwordChanged) => {
    if (passwordChanged && updatedUser?.id === me?.id) {
      base44.auth.logout();
      window.location.href = '/login';
      return;
    }
    load();
  };

  const rejectRequest = async (request) => {
    try {
      await base44.users.rejectRegistrationRequest(request.id);
      toast({ title: t('تم رفض الطلب', 'Request rejected', lang) });
      load();
    } catch (e) {
      toast({ title: t('تعذر رفض الطلب', 'Could not reject request', lang), description: e.message, variant: 'destructive' });
    }
  };

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin' || u.appRole === 'OWNER').length,
    active: users.filter(u => u.isActive !== false).length,
    inactive: users.filter(u => u.isActive === false).length,
    pending: requests.length,
  };

  if (!loading && !isAdmin) {
    return (
      <ModuleLayout title={t('المستخدمون والصلاحيات', 'Users & Permissions', lang)}>
        <Card><CardContent className="py-16 text-center">
          <ShieldAlert className="size-12 mx-auto text-amber-500 mb-3" />
          <p className="font-medium">{t('لا تملك صلاحية الوصول لهذه الصفحة', 'You don\'t have access to this page', lang)}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('إدارة المستخدمين متاحة للمدراء فقط.', 'User management is available to admins only.', lang)}</p>
        </CardContent></Card>
      </ModuleLayout>
    );
  }

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <div className={`size-10 rounded-lg flex items-center justify-center ${color}`}><Icon className="size-5" /></div>
      <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
    </CardContent></Card>
  );

  return (
    <ModuleLayout
      title={t('المستخدمون والصلاحيات', 'Users & Permissions', lang)}
      subtitle={t('إدارة مستخدمي النظام وأدوارهم وصلاحياتهم', 'Manage system users, roles and permissions', lang)}
      actions={
        <Button onClick={() => setInviteOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <UserPlus className="size-4" />{t('دعوة مستخدم', 'Invite User', lang)}
        </Button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={UsersIcon} label={t('إجمالي المستخدمين', 'Total Users', lang)} value={stats.total} color="bg-slate-100 text-slate-600" />
        <StatCard icon={Crown} label={t('مدراء', 'Admins', lang)} value={stats.admins} color="bg-violet-100 text-violet-600" />
        <StatCard icon={CheckCircle2} label={t('نشط', 'Active', lang)} value={stats.active} color="bg-emerald-100 text-emerald-600" />
        <StatCard icon={Ban} label={t('معطّل', 'Inactive', lang)} value={stats.inactive} color="bg-rose-100 text-rose-600" />
        <StatCard icon={Clock} label={t('طلبات التسجيل', 'Registration Requests', lang)} value={stats.pending} color="bg-amber-100 text-amber-700" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-4 text-amber-600" />
            <h2 className="font-semibold text-sm">{t('طلبات التسجيل بانتظار الاعتماد', 'Registration requests pending approval', lang)}</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('الاسم', 'Name', lang)}</TableHead>
                  <TableHead>{t('البريد', 'Email', lang)}</TableHead>
                  <TableHead>{t('تاريخ الطلب', 'Requested at', lang)}</TableHead>
                  <TableHead className="text-end">{t('إجراءات', 'Actions', lang)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      {t('لا توجد طلبات تسجيل معلّقة حالياً. عند تسجيل مستخدم جديد ستظهر طلباته هنا للموافقة أو الرفض.', 'No pending registration requests. New user requests will appear here for approval or rejection.', lang)}
                    </TableCell>
                  </TableRow>
                ) : requests.map(request => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.fullName || '—'}</TableCell>
                    <TableCell dir="ltr" className="text-sm text-muted-foreground">{request.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{request.requestedDate ? new Date(request.requestedDate).toLocaleString('ar-SA') : '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" onClick={() => setApproveRequest(request)} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                          <CheckCircle2 className="size-3.5" />{t('اعتماد', 'Approve', lang)}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => rejectRequest(request)} className="gap-1 text-rose-600">
                          <XCircle className="size-3.5" />{t('رفض', 'Reject', lang)}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm mb-4">
            <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input className="ps-9" placeholder={t('بحث بالاسم أو البريد...', 'Search by name or email...', lang)} value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">{t('جارٍ التحميل...', 'Loading...', lang)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('المستخدم', 'User', lang)}</TableHead>
                    <TableHead>{t('الدور الوظيفي', 'Role', lang)}</TableHead>
                    <TableHead>{t('القسم', 'Department', lang)}</TableHead>
                    <TableHead>{t('الصلاحيات', 'Access', lang)}</TableHead>
                    <TableHead>{t('الحالة', 'Status', lang)}</TableHead>
                    <TableHead className="text-end">{t('إجراءات', 'Actions', lang)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => {
                    const roleMeta = APP_ROLES[u.appRole || 'VIEWER'];
                    const moduleCount = resolveUserModules(u).length;
                    const active = u.isActive !== false;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center shrink-0">
                              {(u.full_name || u.email || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate flex items-center gap-1">
                                {u.full_name || '—'}
                                {(u.role === 'admin' || u.appRole === 'OWNER') && <Crown className="size-3 text-violet-500" />}
                              </div>
                              <div className="text-xs text-muted-foreground truncate" dir="ltr">{u.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleMeta.color}`}>
                            {lang === 'ar' ? roleMeta.ar : roleMeta.en}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.department || '—'}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <ShieldCheck className="size-3.5 text-emerald-500" />
                            {(u.role === 'admin' || u.appRole === 'OWNER')
                              ? t('كامل', 'Full', lang)
                              : `${moduleCount} ${t('وحدة', 'modules', lang)}`}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {active ? t('نشط', 'Active', lang) : t('معطّل', 'Inactive', lang)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditUser(u)} className="gap-1">
                              <Pencil className="size-3.5" />{t('تعديل', 'Edit', lang)}
                            </Button>
                            {u.id !== me?.id && (
                              <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}
                                className={active ? 'text-rose-600' : 'text-emerald-600'}>
                                {active ? <Ban className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      {t('لا يوجد مستخدمون', 'No users found', lang)}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={load} lang={lang} />
      <EditUserDialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)} user={editUser} onSaved={handleUserSaved} lang={lang} />
      <ApproveRegistrationDialog open={!!approveRequest} onOpenChange={(o) => !o && setApproveRequest(null)} request={approveRequest} onDone={load} lang={lang} />
    </ModuleLayout>
  );
}