import React from 'react';
import { t } from '@/lib/utils-binaa';

// ترويسة/تذييل موحّدة لكل المستندات الرسمية (سندات، استلام، رواتب، كشف حساب...).
// تعرض صورة الهيدر المرفوعة (إن وُجدت)، ثم اللوجو + كل بيانات الشركة،
// وشريط عنوان المستند. التذييل يعرض صورة الفوتر (إن وُجدت) وبيانات التواصل.

// شريط ترويسة الشركة الكامل — يُستخدم أعلى كل مستند.
export function DocumentHeader({ settings = {}, lang = 'ar', title, docNo, subtitle }) {
  const primary = settings.primaryColor || '#059669';
  const rtl = lang === 'ar';
  const companyName = rtl
    ? settings.companyName || settings.companyNameEn || ''
    : settings.companyNameEn || settings.companyName || '';

  const contactBits = [
    settings.address && [settings.address, settings.city].filter(Boolean).join('، '),
    settings.phone && `${t('هاتف', 'Tel', lang)}: ${settings.phone}`,
    settings.email,
    settings.website,
    settings.vatNumber && `${t('الرقم الضريبي', 'VAT', lang)}: ${settings.vatNumber}`,
    settings.crNumber && `${t('السجل التجاري', 'CR', lang)}: ${settings.crNumber}`,
  ].filter(Boolean);

  return (
    <>
      {settings.headerImageUrl && (
        <img src={settings.headerImageUrl} alt="" style={{ display: 'block', width: '100%', objectFit: 'cover', marginBottom: 12 }} />
      )}
      <div style={{ borderBottom: `3px solid ${primary}`, paddingBottom: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {settings.logoUrl
              ? <img src={settings.logoUrl} alt="logo" style={{ height: 60, width: 60, objectFit: 'contain' }} />
              : <div style={{ height: 60, width: 60, borderRadius: 14, background: settings.accentColor || primary, color: '#fff', fontWeight: 800, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(companyName || 'B').slice(0, 1)}</div>}
            <div>
              <div style={{ fontWeight: 800, fontSize: 19, color: primary, lineHeight: 1.2 }}>{companyName}</div>
              {rtl && settings.companyNameEn && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{settings.companyNameEn}</div>}
            </div>
          </div>
          <div style={{ textAlign: rtl ? 'left' : 'right', maxWidth: '46%' }}>
            {title && <div style={{ fontWeight: 800, fontSize: 20, color: primary }}>{title}</div>}
            {docNo && <div style={{ fontSize: 13, color: '#374151', fontFamily: 'monospace', marginTop: 2 }}>{docNo}</div>}
            {subtitle && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{subtitle}</div>}
          </div>
        </div>
        {contactBits.length > 0 && (
          <div style={{ fontSize: 10.5, color: '#475569', marginTop: 10, lineHeight: 1.7 }}>
            {contactBits.join('  •  ')}
          </div>
        )}
      </div>
    </>
  );
}

// تذييل الشركة الكامل — يُوضع أسفل كل مستند.
export function DocumentFooter({ settings = {}, lang = 'ar' }) {
  const primary = settings.primaryColor || '#059669';
  const rtl = lang === 'ar';
  const companyName = rtl
    ? settings.companyName || settings.companyNameEn || ''
    : settings.companyNameEn || settings.companyName || '';
  const bits = [
    settings.phone,
    settings.email,
    settings.vatNumber && `${t('الرقم الضريبي', 'VAT', lang)}: ${settings.vatNumber}`,
  ].filter(Boolean);

  if (!settings.footerImageUrl && bits.length === 0 && !companyName) return null;

  return (
    <div style={{ marginTop: 32 }}>
      {settings.footerImageUrl && (
        <img src={settings.footerImageUrl} alt="" style={{ display: 'block', width: '100%', objectFit: 'cover', marginBottom: 8 }} />
      )}
      <div style={{ borderTop: `2px solid ${primary}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#64748b' }}>
        <span>{companyName}</span>
        <span>{bits.join('  •  ')}</span>
      </div>
    </div>
  );
}