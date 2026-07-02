import React from 'react';
import { t, formatNumber, formatDate, RIYAL_SYMBOL, INVOICE_STATUS } from '@/lib/utils-binaa';
import { buildZatcaQrPayload, zatcaQrImageUrl } from '@/lib/zatcaQr';

// عرض مبلغ مع رمز الريال مكبّراً قليلاً عن الرقم.
function Money({ value, symbolSize = '1.35em' }) {
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: symbolSize, verticalAlign: '-0.05em', margin: '0 2px', fontFamily: "'saudi_riyal'" }}>{RIYAL_SYMBOL}</span>
      {formatNumber(value)}
    </span>
  );
}

const TYPE_LABEL = {
  CONSTRUCTION: { ar: 'فاتورة أعمال تنفيذية', en: 'Construction Invoice' },
  SERVICE: { ar: 'فاتورة خدمات', en: 'Service Invoice' },
  RENTAL: { ar: 'فاتورة تأجير', en: 'Rental Invoice' },
};

// يبني قائمة بنود الفاتورة. إن لم توجد بنود تفصيلية نُنشئ بنداً واحداً من الوصف والصافي.
function resolveLineItems(invoice, lang) {
  if (Array.isArray(invoice.lineItems) && invoice.lineItems.length) return invoice.lineItems;
  const net = (invoice.totalAmount || 0) - (invoice.vatAmount || 0);
  return [{
    description: invoice.description || (lang === 'ar' ? 'قيمة الأعمال / الخدمات' : 'Works / Services value'),
    qty: 1,
    unitPrice: net,
    total: net,
  }];
}

/**
 * مستند فاتورة ضريبية احترافي موحّد للمشاريع والتأجير — متوافق مع متطلبات ZATCA.
 * يتحكم فيه القالب (template) والألوان (primary/accent) وبيانات الشركة من الإعدادات.
 * innerRef يُمرّر إلى العنصر الجذر لالتقاط HTML عند الطباعة.
 */
export default function InvoiceDocument({ invoice, settings, lang = 'ar', innerRef }) {
  if (!invoice) return null;

  const primary = settings.primaryColor || '#059669';
  const accent = settings.accentColor || '#047857';
  const template = settings.template || 'MODERN';
  const st = INVOICE_STATUS[invoice.status] || INVOICE_STATUS.DRAFT;
  const typeLabel = TYPE_LABEL[invoice.invoiceType] || TYPE_LABEL.RENTAL;

  const subtotal = invoice.subtotal != null ? invoice.subtotal : (invoice.totalAmount || 0) - (invoice.vatAmount || 0);
  const vat = invoice.vatAmount || 0;
  const total = invoice.totalAmount || 0;
  const paid = invoice.paidAmount || 0;
  const balance = total - paid;
  const items = resolveLineItems(invoice, lang);

  const companyName = lang === 'ar' ? settings.companyName : (settings.companyNameEn || settings.companyName);

  // نُظهر رمز QR طالما يوجد رقم ضريبي، إلا إذا عُطّل صراحةً في الإعدادات (showQr === false).
  const qrPayload = settings.showQr !== false && settings.vatNumber
    ? buildZatcaQrPayload({
        sellerName: settings.companyName,
        vatNumber: settings.vatNumber,
        timestamp: invoice.date ? new Date(invoice.date).toISOString() : new Date().toISOString(),
        total,
        vatTotal: vat,
      })
    : null;

  const isMinimal = template === 'MINIMAL';
  const isClassic = template === 'CLASSIC';
  // فاتورة التأجير تُختم وتُؤرشف — لا نُظهر فيها المدفوع/المتبقّي، ونضيف خانتَي ختم.
  const isRental = invoice.invoiceType === 'RENTAL';

  const labelColor = '#6b7280';
  const border = '1px solid #e5e7eb';

  return (
    <div
      ref={innerRef}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      style={{
        background: '#fff',
        color: '#111827',
        fontFamily: "'saudi_riyal','Cairo',sans-serif",
        fontSize: 13,
        lineHeight: 1.6,
        width: '100%',
      }}
    >
      {/* صورة هيدر مخصّصة إن رُفعت */}
      {settings.headerImageUrl && (
        <img src={settings.headerImageUrl} alt="header" style={{ width: '100%', display: 'block', marginBottom: 16 }} />
      )}

      {/* رأس الفاتورة */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          padding: isMinimal ? '0 0 14px' : '18px 20px',
          borderRadius: isMinimal ? 0 : 12,
          background: isMinimal ? 'transparent' : (isClassic ? '#f9fafb' : primary),
          color: isMinimal || isClassic ? '#111827' : '#fff',
          borderBottom: isMinimal ? `3px solid ${primary}` : 'none',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {settings.logoUrl && (
            <img src={settings.logoUrl} alt="logo" style={{ height: 52, width: 52, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 4 }} />
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{companyName}</div>
            {settings.vatNumber && (
              <div style={{ fontSize: 11, opacity: 0.85 }}>{t('الرقم الضريبي', 'VAT No', lang)}: {settings.vatNumber}</div>
            )}
            {settings.crNumber && (
              <div style={{ fontSize: 11, opacity: 0.85 }}>{t('السجل التجاري', 'CR No', lang)}: {settings.crNumber}</div>
            )}
          </div>
        </div>
        <div style={{ textAlign: lang === 'ar' ? 'left' : 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t('فاتورة ضريبية', 'Tax Invoice', lang)}</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>{lang === 'ar' ? typeLabel.ar : typeLabel.en}</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{invoice.invoiceNo}</div>
        </div>
      </div>

      {/* شريط بيانات الشركة والعميل */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, border, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: primary, marginBottom: 6 }}>{t('بيانات المُصدِر', 'Issued By', lang)}</div>
          <div style={{ fontWeight: 600 }}>{companyName}</div>
          {settings.address && <div style={{ fontSize: 11, color: labelColor }}>{settings.address}{settings.city ? `، ${settings.city}` : ''}</div>}
          {settings.phone && <div style={{ fontSize: 11, color: labelColor }}>{t('هاتف', 'Phone', lang)}: {settings.phone}</div>}
          {settings.email && <div style={{ fontSize: 11, color: labelColor }}>{settings.email}</div>}
        </div>
        <div style={{ flex: 1, border, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: primary, marginBottom: 6 }}>{t('بيانات العميل', 'Bill To', lang)}</div>
          <div style={{ fontWeight: 600 }}>{invoice.clientName || '—'}</div>
          {invoice.projectName && <div style={{ fontSize: 11, color: labelColor }}>{t('المشروع', 'Project', lang)}: {invoice.projectName}</div>}
          {invoice.clientVatNumber && <div style={{ fontSize: 11, color: labelColor }}>{t('الرقم الضريبي', 'VAT No', lang)}: {invoice.clientVatNumber}</div>}
        </div>
      </div>

      {/* تفاصيل الفاتورة والعقد */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
        <tbody>
          <tr>
            <td style={{ color: labelColor, padding: '5px 8px', width: '22%' }}>{t('تاريخ الإصدار', 'Issue Date', lang)}</td>
            <td style={{ fontWeight: 600, padding: '5px 8px' }}>{formatDate(invoice.date, lang)}</td>
            <td style={{ color: labelColor, padding: '5px 8px', width: '22%' }}>{t('تاريخ الاستحقاق', 'Due Date', lang)}</td>
            <td style={{ fontWeight: 600, padding: '5px 8px' }}>{formatDate(invoice.dueDate, lang)}</td>
          </tr>
          {invoice.contractNo && (
            <tr>
              <td style={{ color: labelColor, padding: '5px 8px' }}>{t('رقم العقد', 'Contract No', lang)}</td>
              <td style={{ fontWeight: 600, padding: '5px 8px' }}>{invoice.contractNo}</td>
              {invoice.certificateNo ? (
                <>
                  <td style={{ color: labelColor, padding: '5px 8px' }}>{t('رقم المستخلص', 'Certificate No', lang)}</td>
                  <td style={{ fontWeight: 600, padding: '5px 8px' }}>{invoice.certificateNo}</td>
                </>
              ) : <td colSpan={2} />}
            </tr>
          )}
          {!invoice.contractNo && invoice.certificateNo && (
            <tr>
              <td style={{ color: labelColor, padding: '5px 8px' }}>{t('رقم المستخلص', 'Certificate No', lang)}</td>
              <td colSpan={3} style={{ fontWeight: 600, padding: '5px 8px' }}>{invoice.certificateNo}</td>
            </tr>
          )}
          {(invoice.deliveryOrderNo || invoice.billingMonth) && (
            <tr>
              {invoice.deliveryOrderNo ? (
                <>
                  <td style={{ color: labelColor, padding: '5px 8px' }}>{t('رقم أمر التوصيل', 'Delivery Order No', lang)}</td>
                  <td style={{ fontWeight: 600, padding: '5px 8px' }}>{invoice.deliveryOrderNo}</td>
                </>
              ) : <td colSpan={2} />}
              {invoice.billingMonth ? (
                <>
                  <td style={{ color: labelColor, padding: '5px 8px' }}>{t('شهر العمل', 'Billing Month', lang)}</td>
                  <td style={{ fontWeight: 600, padding: '5px 8px' }}>{invoice.billingMonth}</td>
                </>
              ) : <td colSpan={2} />}
            </tr>
          )}
          {(invoice.periodFrom || invoice.periodTo) && (
            <tr>
              <td style={{ color: labelColor, padding: '5px 8px' }}>{t('فترة الإيجار', 'Rental Period', lang)}</td>
              <td colSpan={3} style={{ fontWeight: 600, padding: '5px 8px' }}>{formatDate(invoice.periodFrom, lang)} — {formatDate(invoice.periodTo, lang)}</td>
            </tr>
          )}
          {invoice.equipmentName && (
            <tr>
              <td style={{ color: labelColor, padding: '5px 8px' }}>{t('المعدة', 'Equipment', lang)}</td>
              <td colSpan={3} style={{ fontWeight: 600, padding: '5px 8px' }}>{invoice.equipmentName}</td>
            </tr>
          )}
          {invoice.totalHours != null && Number(invoice.totalHours) > 0 && (
            <tr>
              <td style={{ color: labelColor, padding: '5px 8px' }}>{t('عدد ساعات التشغيل', 'Operating Hours', lang)}</td>
              <td colSpan={3} style={{ fontWeight: 600, padding: '5px 8px' }}>{formatNumber(invoice.totalHours, 0)} {t('ساعة', 'hrs', lang)}</td>
            </tr>
          )}
          <tr>
            <td style={{ color: labelColor, padding: '5px 8px' }}>{t('الحالة', 'Status', lang)}</td>
            <td colSpan={3} style={{ padding: '5px 8px' }}>
              <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 999, background: '#ecfdf5', color: accent, fontWeight: 600 }}>
                {lang === 'ar' ? st.ar : st.en}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* جدول البنود */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
        <thead>
          <tr style={{ background: isMinimal ? '#f3f4f6' : primary, color: isMinimal ? '#111827' : '#fff' }}>
            <th style={{ padding: '8px 10px', textAlign: 'start' }}>{t('الوصف', 'Description', lang)}</th>
            <th style={{ padding: '8px 10px', textAlign: 'center', width: '12%' }}>{t('الكمية', 'Qty', lang)}</th>
            <th style={{ padding: '8px 10px', textAlign: 'center', width: '20%' }}>{t('سعر الوحدة', 'Unit Price', lang)}</th>
            <th style={{ padding: '8px 10px', textAlign: 'center', width: '20%' }}>{t('الإجمالي', 'Total', lang)}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} style={{ borderBottom: border }}>
              <td style={{ padding: '8px 10px' }}>{it.description}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.qty ?? 1}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}><Money value={it.unitPrice} /></td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}><Money value={it.total} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* الملخص المالي + QR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          {qrPayload ? (
            <div style={{ textAlign: 'center', display: 'inline-block' }}>
              <img src={zatcaQrImageUrl(qrPayload, 120)} alt="ZATCA QR" style={{ width: 120, height: 120, border }} />
              <div style={{ fontSize: 9, color: labelColor, marginTop: 4 }}>{t('رمز الاستجابة الضريبي', 'ZATCA QR', lang)}</div>
            </div>
          ) : settings.showQr !== false && !settings.vatNumber ? (
            <div style={{ width: 120, height: 120, border: `1px dashed ${labelColor}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 10, color: labelColor, padding: 8 }}>
              {t('أدخل الرقم الضريبي في الإعدادات لإظهار رمز QR', 'Add a VAT number in Settings to show the QR code', lang)}
            </div>
          ) : null}
        </div>
        <div style={{ width: 280 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: border }}>
            <span style={{ color: labelColor }}>{t('المبلغ قبل الضريبة', 'Subtotal', lang)}</span>
            <span style={{ fontWeight: 600 }}><Money value={subtotal} /></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: border }}>
            <span style={{ color: labelColor }}>{t('ضريبة القيمة المضافة', 'VAT', lang)} (15%)</span>
            <span style={{ fontWeight: 600 }}><Money value={vat} /></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: `2px solid ${primary}`, marginTop: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{t('الإجمالي', 'Total', lang)}</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: primary }}><Money value={total} symbolSize="1.25em" /></span>
          </div>
          {!isRental && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: labelColor }}>
                <span>{t('المدفوع', 'Paid', lang)}</span>
                <span><Money value={paid} /></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontWeight: 700, color: balance > 0 ? '#dc2626' : accent }}>
                <span>{t('المتبقي', 'Balance Due', lang)}</span>
                <span><Money value={balance} /></span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* خانتا الختم — للشركة وللعميل (فواتير التأجير المؤرشفة) */}
      {isRental && (
        <div style={{ display: 'flex', gap: 40, marginBottom: 16 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: primary, marginBottom: 6 }}>{t('ختم واعتماد الشركة', 'Company Stamp & Approval', lang)}</div>
            <div style={{ height: 90, border: `1px dashed ${labelColor}`, borderRadius: 8 }} />
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: primary, marginBottom: 6 }}>{t('ختم واستلام العميل', 'Client Stamp & Receipt', lang)}</div>
            <div style={{ height: 90, border: `1px dashed ${labelColor}`, borderRadius: 8 }} />
          </div>
        </div>
      )}

      {/* البيانات البنكية والشروط */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {(settings.iban || settings.bankName) && (
          <div style={{ flex: 1, border, borderRadius: 10, padding: 12, fontSize: 11 }}>
            <div style={{ fontWeight: 700, color: primary, marginBottom: 4 }}>{t('البيانات البنكية', 'Bank Details', lang)}</div>
            {settings.bankName && <div>{t('البنك', 'Bank', lang)}: {settings.bankName}</div>}
            {settings.bankAccountName && <div>{t('اسم الحساب', 'Account Name', lang)}: {settings.bankAccountName}</div>}
            {settings.iban && <div>{t('الآيبان', 'IBAN', lang)}: {settings.iban}</div>}
          </div>
        )}
        {settings.terms && (
          <div style={{ flex: 1, border, borderRadius: 10, padding: 12, fontSize: 11, color: labelColor, whiteSpace: 'pre-wrap' }}>
            <div style={{ fontWeight: 700, color: primary, marginBottom: 4 }}>{t('الشروط والأحكام', 'Terms & Conditions', lang)}</div>
            {settings.terms}
          </div>
        )}
      </div>

      {/* صورة فوتر مخصّصة إن رُفعت */}
      {settings.footerImageUrl ? (
        <img src={settings.footerImageUrl} alt="footer" style={{ width: '100%', display: 'block', marginTop: 8 }} />
      ) : (
        <p style={{ marginTop: 20, fontSize: 10, color: '#9ca3af', textAlign: 'center', borderTop: border, paddingTop: 10 }}>
          {t('فاتورة صادرة إلكترونياً — لا تحتاج إلى توقيع', 'Electronically generated invoice — no signature required', lang)}
          {settings.website ? ` · ${settings.website}` : ''}
        </p>
      )}
    </div>
  );
}