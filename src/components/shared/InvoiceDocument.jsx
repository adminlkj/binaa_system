import React from 'react';
import { t, formatNumber, formatDate, RIYAL_SYMBOL } from '@/lib/utils-binaa';
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
export default function InvoiceDocument({ invoice, settings, client, lang = 'ar', innerRef }) {
  if (!invoice) return null;

  // تفاصيل العميل: نأخذها من سجل العميل الكامل إن مُرّر، وإلا من حقول الفاتورة نفسها.
  const c = client || {};
  const clientName = invoice.clientName || (lang === 'ar' ? (c.nameAr || c.name) : c.name) || '—';
  const clientVat = invoice.clientVatNumber || c.taxNumber;
  const clientPhone = invoice.clientPhone || c.phone;
  const clientEmail = invoice.clientEmail || c.email;
  const clientAddress = invoice.clientAddress || c.address;
  const clientContact = c.contactPerson;

  const primary = settings.primaryColor || '#059669';
  const accent = settings.accentColor || '#047857';
  const template = settings.template || 'MODERN';
  const typeLabel = TYPE_LABEL[invoice.invoiceType] || TYPE_LABEL.RENTAL;

  const subtotal = invoice.subtotal != null ? invoice.subtotal : (invoice.totalAmount || 0) - (invoice.vatAmount || 0);
  const vat = invoice.vatAmount || 0;
  const total = invoice.totalAmount || 0;
  const paid = invoice.paidAmount || 0;
  const balance = total - paid;
  const items = resolveLineItems(invoice, lang);

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
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
              <span dir="rtl" style={{ display: 'block' }}>{settings.companyName}</span>
              {settings.companyNameEn && <span dir="ltr" style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>{settings.companyNameEn}</span>}
            </div>
            {settings.vatNumber && (
              <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 2 }}>{'الرقم الضريبي / VAT No'}: {settings.vatNumber}</div>
            )}
            {settings.crNumber && (
              <div style={{ fontSize: 10.5, opacity: 0.85 }}>{'السجل التجاري / CR No'}: {settings.crNumber}</div>
            )}
          </div>
        </div>
        <div style={{ textAlign: lang === 'ar' ? 'left' : 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{'فاتورة ضريبية'}<span style={{ display: 'block', fontSize: 12, opacity: 0.85 }}>Tax Invoice</span></div>
          <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 3 }}>{typeLabel.ar} / {typeLabel.en}</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{invoice.invoiceNo}</div>
        </div>
      </div>

      {/* شريط بيانات الشركة والعميل */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, border, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: primary, marginBottom: 6 }}>{'بيانات المُصدِر / Issued By'}</div>
          <div style={{ fontWeight: 600 }}>
            <span dir="rtl" style={{ display: 'block' }}>{settings.companyName}</span>
            {settings.companyNameEn && <span dir="ltr" style={{ display: 'block', fontSize: 11, opacity: 0.75 }}>{settings.companyNameEn}</span>}
          </div>
          {settings.crNumber && <div style={{ fontSize: 11, color: labelColor }}>{'السجل التجاري / CR No'}: {settings.crNumber}</div>}
          {settings.vatNumber && <div style={{ fontSize: 11, color: labelColor }}>{'الرقم الضريبي / VAT No'}: {settings.vatNumber}</div>}
          {(settings.address || settings.city) && <div style={{ fontSize: 11, color: labelColor }}>{'العنوان / Address'}: {[settings.address, settings.city].filter(Boolean).join('، ')}</div>}
          {settings.phone && <div style={{ fontSize: 11, color: labelColor }} dir="ltr">{'هاتف / Phone'}: {settings.phone}</div>}
          {settings.email && <div style={{ fontSize: 11, color: labelColor }} dir="ltr">{'البريد / Email'}: {settings.email}</div>}
          {settings.website && <div style={{ fontSize: 11, color: labelColor }} dir="ltr">{settings.website}</div>}
        </div>
        <div style={{ flex: 1, border, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: primary, marginBottom: 6 }}>{'بيانات العميل / Bill To'}</div>
          <div style={{ fontWeight: 600 }}>{clientName}</div>
          {clientContact && <div style={{ fontSize: 11, color: labelColor }}>{'جهة الاتصال / Contact'}: {clientContact}</div>}
          {clientVat && <div style={{ fontSize: 11, color: labelColor }}>{'الرقم الضريبي / VAT No'}: {clientVat}</div>}
          {clientAddress && <div style={{ fontSize: 11, color: labelColor }}>{'العنوان / Address'}: {clientAddress}</div>}
          {clientPhone && <div style={{ fontSize: 11, color: labelColor }} dir="ltr">{'هاتف / Phone'}: {clientPhone}</div>}
          {clientEmail && <div style={{ fontSize: 11, color: labelColor }} dir="ltr">{'البريد / Email'}: {clientEmail}</div>}
          {invoice.projectName && <div style={{ fontSize: 11, color: labelColor }}>{'المشروع / Project'}: {invoice.projectName}</div>}
        </div>
      </div>

      {/* تفاصيل الفاتورة والعقد */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
        <tbody>
          <tr>
            <td style={{ color: labelColor, padding: '5px 8px', width: '25%' }}>{'تاريخ الإصدار / Issue Date'}</td>
            <td style={{ fontWeight: 600, padding: '5px 8px' }} dir="ltr">{formatDate(invoice.date, lang)}</td>
            <td style={{ color: labelColor, padding: '5px 8px', width: '25%' }}>{'تاريخ الاستحقاق / Due Date'}</td>
            <td style={{ fontWeight: 600, padding: '5px 8px' }} dir="ltr">{formatDate(invoice.dueDate, lang)}</td>
          </tr>
          {invoice.contractNo && (
            <tr>
              <td style={{ color: labelColor, padding: '5px 8px' }}>{'رقم العقد / Contract No'}</td>
              <td style={{ fontWeight: 600, padding: '5px 8px' }}>{invoice.contractNo}</td>
              {invoice.certificateNo ? (
                <>
                  <td style={{ color: labelColor, padding: '5px 8px' }}>{'رقم المستخلص / Certificate No'}</td>
                  <td style={{ fontWeight: 600, padding: '5px 8px' }}>{invoice.certificateNo}</td>
                </>
              ) : <td colSpan={2} />}
            </tr>
          )}
          {!invoice.contractNo && invoice.certificateNo && (
            <tr>
              <td style={{ color: labelColor, padding: '5px 8px' }}>{'رقم المستخلص / Certificate No'}</td>
              <td colSpan={3} style={{ fontWeight: 600, padding: '5px 8px' }}>{invoice.certificateNo}</td>
            </tr>
          )}
          {(invoice.deliveryOrderNo || invoice.billingMonth) && (
            <tr>
              {invoice.deliveryOrderNo ? (
                <>
                  <td style={{ color: labelColor, padding: '5px 8px' }}>{'رقم أمر التوصيل / Delivery Order No'}</td>
                  <td style={{ fontWeight: 600, padding: '5px 8px' }}>{invoice.deliveryOrderNo}</td>
                </>
              ) : <td colSpan={2} />}
              {invoice.billingMonth ? (
                <>
                  <td style={{ color: labelColor, padding: '5px 8px' }}>{'شهر العمل / Billing Month'}</td>
                  <td style={{ fontWeight: 600, padding: '5px 8px' }} dir="ltr">{invoice.billingMonth}</td>
                </>
              ) : <td colSpan={2} />}
            </tr>
          )}
          {(invoice.periodFrom || invoice.periodTo) && (
            <tr>
              <td style={{ color: labelColor, padding: '5px 8px' }}>{'فترة الإيجار / Rental Period'}</td>
              <td colSpan={3} style={{ fontWeight: 600, padding: '5px 8px' }} dir="ltr">{formatDate(invoice.periodFrom, lang)} — {formatDate(invoice.periodTo, lang)}</td>
            </tr>
          )}
          {invoice.equipmentName && (
            <tr>
              <td style={{ color: labelColor, padding: '5px 8px' }}>{'المعدة / Equipment'}</td>
              <td colSpan={3} style={{ fontWeight: 600, padding: '5px 8px' }}>{invoice.equipmentName}</td>
            </tr>
          )}
          {invoice.totalHours != null && Number(invoice.totalHours) > 0 && (
            <tr>
              <td style={{ color: labelColor, padding: '5px 8px' }}>{'عدد ساعات التشغيل / Operating Hours'}</td>
              <td colSpan={3} style={{ fontWeight: 600, padding: '5px 8px' }}>{formatNumber(invoice.totalHours, 0)} {'ساعة / hrs'}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* جدول البنود */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
        <thead>
          <tr style={{ background: isMinimal ? '#f3f4f6' : primary, color: isMinimal ? '#111827' : '#fff', fontSize: 11 }}>
            <th style={{ padding: '8px 10px', textAlign: 'start' }}>{'الوصف'}<span style={{ display: 'block', fontSize: 9.5, fontWeight: 400, opacity: 0.85 }}>Description</span></th>
            <th style={{ padding: '8px 10px', textAlign: 'center', width: '12%' }}>{'الكمية'}<span style={{ display: 'block', fontSize: 9.5, fontWeight: 400, opacity: 0.85 }}>Qty</span></th>
            <th style={{ padding: '8px 10px', textAlign: 'center', width: '20%' }}>{'سعر الوحدة'}<span style={{ display: 'block', fontSize: 9.5, fontWeight: 400, opacity: 0.85 }}>Unit Price</span></th>
            <th style={{ padding: '8px 10px', textAlign: 'center', width: '20%' }}>{'الإجمالي'}<span style={{ display: 'block', fontSize: 9.5, fontWeight: 400, opacity: 0.85 }}>Total</span></th>
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
              <div style={{ fontSize: 9, color: labelColor, marginTop: 4 }}>{'رمز الاستجابة الضريبي / ZATCA QR'}</div>
            </div>
          ) : settings.showQr !== false && !settings.vatNumber ? (
            <div style={{ width: 120, height: 120, border: `1px dashed ${labelColor}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 10, color: labelColor, padding: 8 }}>
              {t('أدخل الرقم الضريبي في الإعدادات لإظهار رمز QR', 'Add a VAT number in Settings to show the QR code', lang)}
            </div>
          ) : null}
        </div>
        <div style={{ width: 280 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: border }}>
            <span style={{ color: labelColor, fontSize: 11 }}>{'المبلغ قبل الضريبة'}<span style={{ display: 'block', fontSize: 9.5, opacity: 0.8 }}>Subtotal</span></span>
            <span style={{ fontWeight: 600 }}><Money value={subtotal} /></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: border }}>
            <span style={{ color: labelColor, fontSize: 11 }}>{'ضريبة القيمة المضافة (15%)'}<span style={{ display: 'block', fontSize: 9.5, opacity: 0.8 }}>VAT (15%)</span></span>
            <span style={{ fontWeight: 600 }}><Money value={vat} /></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: `2px solid ${primary}`, marginTop: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{'الإجمالي'}<span style={{ display: 'block', fontSize: 10, fontWeight: 500, opacity: 0.8 }}>Total</span></span>
            <span style={{ fontWeight: 700, fontSize: 15, color: primary }}><Money value={total} symbolSize="1.25em" /></span>
          </div>
          {!isRental && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', color: labelColor }}>
                <span style={{ fontSize: 11 }}>{'المدفوع'}<span style={{ display: 'block', fontSize: 9.5, opacity: 0.8 }}>Paid</span></span>
                <span><Money value={paid} /></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontWeight: 700, color: balance > 0 ? '#dc2626' : accent }}>
                <span style={{ fontSize: 11 }}>{'المتبقي'}<span style={{ display: 'block', fontSize: 9.5, opacity: 0.8, fontWeight: 500 }}>Balance Due</span></span>
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
            <div style={{ fontSize: 11, fontWeight: 700, color: primary, marginBottom: 6 }}>{'ختم واعتماد الشركة'}<span style={{ display: 'block', fontSize: 9.5, fontWeight: 500, opacity: 0.8 }}>Company Stamp & Approval</span></div>
            <div style={{ height: 90, border: `1px dashed ${labelColor}`, borderRadius: 8 }} />
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: primary, marginBottom: 6 }}>{'ختم واستلام العميل'}<span style={{ display: 'block', fontSize: 9.5, fontWeight: 500, opacity: 0.8 }}>Client Stamp & Receipt</span></div>
            <div style={{ height: 90, border: `1px dashed ${labelColor}`, borderRadius: 8 }} />
          </div>
        </div>
      )}

      {/* البيانات البنكية والشروط */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {(settings.iban || settings.bankName) && (
          <div style={{ flex: 1, border, borderRadius: 10, padding: 12, fontSize: 11 }}>
            <div style={{ fontWeight: 700, color: primary, marginBottom: 4 }}>{'البيانات البنكية / Bank Details'}</div>
            {settings.bankName && <div>{'البنك / Bank'}: {settings.bankName}</div>}
            {settings.bankAccountName && <div>{'اسم الحساب / Account Name'}: {settings.bankAccountName}</div>}
            {settings.iban && <div dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>{'الآيبان / IBAN'}: {settings.iban}</div>}
          </div>
        )}
        {settings.terms && (
          <div style={{ flex: 1, border, borderRadius: 10, padding: 12, fontSize: 11, color: labelColor, whiteSpace: 'pre-wrap' }}>
            <div style={{ fontWeight: 700, color: primary, marginBottom: 4 }}>{'الشروط والأحكام / Terms & Conditions'}</div>
            {settings.terms}
          </div>
        )}
      </div>

      {/* صورة فوتر مخصّصة إن رُفعت */}
      {settings.footerImageUrl ? (
        <img src={settings.footerImageUrl} alt="footer" style={{ width: '100%', display: 'block', marginTop: 8 }} />
      ) : (
        <p style={{ marginTop: 20, fontSize: 10, color: '#9ca3af', textAlign: 'center', borderTop: border, paddingTop: 10 }}>
          {'فاتورة صادرة إلكترونياً — لا تحتاج إلى توقيع'}
          <span style={{ display: 'block' }}>Electronically generated invoice — no signature required</span>
          {settings.website ? settings.website : ''}
        </p>
      )}
    </div>
  );
}