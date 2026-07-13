import React from 'react';
import { Phone, Mail, Globe, MapPin, Receipt, Landmark } from 'lucide-react';
import { t } from '@/lib/utils-binaa';

/**
 * CompanyHeader — هيدر افتراضي للمستندات يُبنى من بيانات الشركة فقط.
 *
 * القواعد (متفق عليها مع المستخدم):
 *   1. إن رفع المستخدم headerImageUrl → يُستخدم فقط، ولا يُعرض هذا الهيدر الافتراضي.
 *   2. إن لم يُرفع headerImageUrl → يُعرض هذا الهيدر، بشرط وجود companyName.
 *   3. إن لم يُدخل companyName → لا يُعرض أي هيدر إطلاقاً (يُرجع null).
 *   4. كل عنصر فرعي (phone/email/vat/cr…) يظهر فقط إن أُدخل.
 *   5. لا توجد قيم افتراضية مولّدة — كل البيانات من settings.
 *
 * الاستخدام:
 *   <CompanyHeader settings={settings} lang={lang} docTitle="فاتورة ضريبية" docNo="INV-001" />
 *
 * أو لاستخدامه داخل مكون أكبر (بدون شريط عنوان المستند):
 *   <CompanyHeader settings={settings} lang={lang} />
 */
export default function CompanyHeader({ settings = {}, lang = 'ar', docTitle, docNo, docSubtitle, primary: primaryOverride }) {
  const rtl = lang === 'ar';
  const primary = primaryOverride || settings.primaryColor || '#059669';
  const accent = settings.accentColor || primary;

  // القاعدة 3: لا هيدر إن لم يُدخل اسم الشركة
  const companyName = rtl
    ? settings.companyName || settings.companyNameEn || ''
    : settings.companyNameEn || settings.companyName || '';

  if (!companyName) return null;

  // القاعدة 1: إن رُفع headerImageUrl يُستخدم فقط — لكن استدعاء CompanyHeader أصلاً يعني
  // أن المستند قرّر استخدام الهيدر الافتراضي (المستند نفسه يتحقق من headerImageUrl قبل استدعائنا).
  // لذا نكمل بناء الهيدر الافتراضي هنا.

  // بناء عناصر الاتصال — يظهر كل عنصر فقط إن وُجد
  const contactBits = [];
  if (settings.phone) contactBits.push({ icon: Phone, value: settings.phone, ltr: true });
  if (settings.email) contactBits.push({ icon: Mail, value: settings.email, ltr: true });
  if (settings.website) contactBits.push({ icon: Globe, value: settings.website, ltr: true });
  // العنوان: المدينة + العنوان (مختصر)
  const addressParts = [settings.city, settings.address].filter(Boolean);
  if (addressParts.length > 0) {
    contactBits.push({ icon: MapPin, value: addressParts.join('، '), ltr: false });
  }
  if (settings.vatNumber) {
    contactBits.push({ icon: Receipt, value: `${t('الرقم الضريبي', 'VAT', lang)}: ${settings.vatNumber}`, ltr: true });
  }
  if (settings.crNumber) {
    contactBits.push({ icon: Landmark, value: `${t('السجل التجاري', 'CR', lang)}: ${settings.crNumber}`, ltr: false });
  }

  return (
    <div style={{ borderBottom: `3px solid ${primary}`, paddingBottom: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        {/* يمين: اللوغو (إن وُجد) + اسم الشركة */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {settings.logoUrl && (
            <img
              src={settings.logoUrl}
              alt="logo"
              style={{ height: 60, width: 60, objectFit: 'contain', flexShrink: 0 }}
            />
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: 19, color: primary, lineHeight: 1.2 }}>
              {companyName}
            </div>
            {rtl && settings.companyNameEn && (
              <div dir="ltr" style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 600, letterSpacing: 0.5 }}>
                {settings.companyNameEn}
              </div>
            )}
            {!rtl && settings.companyName && settings.companyNameEn !== settings.companyName && (
              <div dir="rtl" style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {settings.companyName}
              </div>
            )}
          </div>
        </div>

        {/* يسار: عنوان المستند ورقمه (إن مُرّر) */}
        {(docTitle || docNo) && (
          <div style={{ textAlign: rtl ? 'left' : 'right', maxWidth: '46%' }}>
            {docTitle && (
              <div style={{ fontWeight: 800, fontSize: 20, color: primary, lineHeight: 1.2 }}>
                {docTitle}
              </div>
            )}
            {docNo && (
              <div style={{ fontSize: 13, color: '#374151', fontFamily: 'monospace', marginTop: 2 }} dir="ltr">
                {docNo}
              </div>
            )}
            {docSubtitle && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {docSubtitle}
              </div>
            )}
          </div>
        )}
      </div>

      {/* صف بيانات الاتصال — يظهر فقط إن وُجد عنصر واحد على الأقل */}
      {contactBits.length > 0 && (
        <div
          dir={rtl ? 'rtl' : 'ltr'}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 14px',
            marginTop: 10,
            fontSize: 10.5,
            color: '#475569',
            lineHeight: 1.5,
          }}
        >
          {contactBits.map((bit, i) => {
            const Icon = bit.icon;
            return (
              <span
                key={i}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
              >
                <Icon size={11} style={{ color: accent, flexShrink: 0 }} />
                <span dir={bit.ltr ? 'ltr' : undefined}>{bit.value}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
