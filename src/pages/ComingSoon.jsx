import React from 'react';
import { Construction, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { t } from '@/lib/utils-binaa';

export default function ComingSoon({ title, titleEn }) {
  const { lang, setActiveItem } = useStore();
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8">
      <div className="size-20 rounded-2xl bg-amber-100 flex items-center justify-center mb-5">
        <Construction className="size-10 text-amber-600" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">{title || titleEn || t('قيد التطوير', 'Coming Soon', lang)}</h2>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">{t('هذا القسم قيد التطوير وسيكون متاحاً قريباً.', 'This module is under development and will be available soon.', lang)}</p>
      <Button onClick={() => setActiveItem('dashboard')} variant="outline" className="gap-2">
        {t('العودة للرئيسية', 'Back to Dashboard', lang)}
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}