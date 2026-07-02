import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// القيم الافتراضية لإعدادات الشركة قبل حفظ أي إعدادات فعلية.
export const DEFAULT_COMPANY_SETTINGS = {
  companyName: 'نظام بِناء',
  companyNameEn: 'Binaa System',
  vatNumber: '',
  crNumber: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  logoUrl: '',
  headerImageUrl: '',
  footerImageUrl: '',
  template: 'MODERN',
  primaryColor: '#059669',
  accentColor: '#047857',
  bankName: '',
  bankAccountName: '',
  iban: '',
  terms: '',
  showQr: true,
};

// يحمّل سجل إعدادات الشركة الوحيد (أول سجل)، مدموجاً مع القيم الافتراضية.
// يعيد { settings, record, loading, reload } — record يحمل الـ id للتحديث.
export function useCompanySettings() {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const rows = await base44.entities.CompanySettings.list('-created_date', 1);
    setRecord(rows?.[0] || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const settings = { ...DEFAULT_COMPANY_SETTINGS, ...(record || {}) };
  return { settings, record, loading, reload: load };
}