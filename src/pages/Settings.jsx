import React from 'react';
import { Settings2, Globe, Palette, Building, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { t } from '@/lib/utils-binaa';
import ModuleLayout from '@/components/shared/ModuleLayout';

export default function Settings() {
  const { lang, toggleLang } = useStore();

  return (
    <ModuleLayout
      title={t('إعدادات النظام', 'System Settings', lang)}
      subtitle={t('تكوين النظام والتفضيلات', 'System configuration and preferences', lang)}
    >
      <div className="grid gap-5 max-w-2xl">
        {/* Language */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="size-4" />{t('اللغة', 'Language', lang)}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('اللغة الحالية للنظام', 'Current system language', lang)}: <strong>{lang === 'ar' ? 'العربية' : 'English'}</strong></p>
            <Button onClick={toggleLang} variant="outline" className="gap-2">
              <Globe className="size-4" />
              {lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            </Button>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Info className="size-4" />{t('معلومات النظام', 'System Info', lang)}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">{t('اسم النظام', 'System Name', lang)}</span>
              <span className="font-medium">بِنَاء ERP</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">{t('الإصدار', 'Version', lang)}</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">{t('المجال', 'Domain', lang)}</span>
              <span className="font-medium">{t('إدارة المقاولات', 'Construction Management', lang)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">{t('العملة', 'Currency', lang)}</span>
              <span className="font-medium">{t('ريال سعودي (SAR)', 'Saudi Riyal (SAR)', lang)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building className="size-4" />{t('روابط سريعة', 'Quick Links', lang)}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('استخدم قائمة التنقل للوصول إلى جميع أقسام النظام.', 'Use the navigation menu to access all system modules.', lang)}</p>
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  );
}