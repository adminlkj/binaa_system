import React from 'react';
import { Phone, Mail, Globe, MapPin } from 'lucide-react';
import { t, formatNumber, formatDate, RIYAL_SYMBOL } from '@/lib/utils-binaa';
import { buildZatcaQrPayload, zatcaQrImageUrl } from '@/lib/zatcaQr';

// عرض مبلغ مع رمز الريال مكبّراً قليلاً عن الرقم. دائماً LTR ليبقى الرقم والرمز
// بترتيب صحيح ومحاذاة ثابتة داخل الجداول والملخّص المالي.
function Money({ value, symbolSize = '1.35em' }) {
  return (
    <span dir="ltr" style={{ whiteSpace: 'nowrap', display: 'inline-block', fontVariantNumeric: 'tabular-nums' }}>
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

// صف ثنائي (عربي/إنجليزي) لعنوان الحقل — يُستخدم في بطاقة تفاصيل الفاتورة والبنك.
function FieldLabel({ ar, en, color }) {
  return (
    <div style={{ lineHeight: 1.25 }}>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: color || '#374151' }}>{ar}</span>
      <span style={{ display: 'block', fontSize: 9, color: '#9ca3af' }}>{en}</span>
    </div>
  );
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
  const clientNameEn = c.nameEn;
  const clientVat = invoice.clientVatNumber || c.taxNumber;

  const primary = settings.primaryColor || '#c8891f';
  const accent = settings.accentColor || '#1f2d3d';
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

  // فاتورة التأجير تُختم وتُؤرشف — لا نُظهر فيها المدفوع/المتبقّي، ونضيف خانتَي ختم.
  const isRental = invoice.invoiceType === 'RENTAL';

  const labelColor = '#6b7280';
  const border = '1px solid #e5e7eb';
  const cardShadow = '0 1px 3px rgba(0,0,0,0.06)';

  // فترة الإيجار كنص واحد إن توفّرت.
  const periodText = (invoice.periodFrom || invoice.periodTo)
    ? `${formatDate(invoice.periodFrom, lang)} — ${formatDate(invoice.periodTo, lang)}`
    : null;

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
        direction: lang === 'ar' ? 'rtl' : 'ltr',
        textAlign: lang === 'ar' ? 'right' : 'left',
      }}
    >
      {/* صورة هيدر مخصّصة إن رُفعت */}
      {settings.headerImageUrl && (
        <img src={settings.headerImageUrl} alt="header" style={{ width: '100%', display: 'block', marginBottom: 16 }} />
      )}

      {/* رأس الفاتورة — الشعار واسم الشركة يمين، شارة "فاتورة ضريبية" يسار */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {settings.logoUrl && (
            <img src={settings.logoUrl} alt="logo" style={{ height: 64, width: 64, objectFit: 'contain' }} />
          )}
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, color: accent }} dir="rtl">{settings.companyName}</div>
            {settings.companyNameEn && <div dir="ltr" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, color: '#6b7280' }}>{settings.companyNameEn}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ background: primary, color: '#fff', borderRadius: 10, padding: '10px 22px', fontSize: 15, fontWeight: 800 }}>
            {'فاتورة ضريبية'}
            <span style={{ display: 'block', fontSize: 11, fontWeight: 600, opacity: 0.9, letterSpacing: 1 }}>TAX INVOICE</span>
          </div>
          {settings.vatNumber && (
            <div style={{ fontSize: 9.5, color: labelColor, marginTop: 4 }}>
              {'الرقم الضريبي / VAT No.'}
              <span dir="ltr" style={{ display: 'block', fontWeight: 700, color: accent }}>{settings.vatNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* خط ذهبي فاصل تحت الهيدر */}
      <div style={{ height: 3, background: primary, borderRadius: 2, marginBottom: 16 }} />

      {/* بطاقتا العميل (يمين) وتفاصيل الفاتورة (يسار) */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
        {/* بيانات العميل */}
        <div style={{ flex: 1, border, borderRadius: 12, padding: 14, boxShadow: cardShadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <FieldLabel ar="بيانات العميل" en="Customer Details" color={accent} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: accent }}>{clientName}</div>
          {clientNameEn && <div dir="ltr" style={{ fontSize: 11, color: labelColor }}>{clientNameEn}</div>}
          {clientVat && (
            <div style={{ marginTop: 10, fontSize: 11, color: labelColor }}>
              {'الرقم الضريبي / VAT No.'}
              <span dir="ltr" style={{ display: 'block', fontWeight: 700, color: accent, fontSize: 13 }}>{clientVat}</span>
            </div>
          )}
        </div>

        {/* تفاصيل الفاتورة */}
        <div style={{ flex: 1, border, borderRadius: 12, overflow: 'hidden', boxShadow: cardShadow }}>
          {[
            { ar: 'رقم الفاتورة', en: 'Invoice No.', value: invoice.invoiceNo, big: true },
            { ar: 'تاريخ الفاتورة', en: 'Invoice Date', value: formatDate(invoice.date, lang) },
            invoice.dueDate && { ar: 'تاريخ الاستحقاق', en: 'Due Date', value: formatDate(invoice.dueDate, lang) },
            periodText && { ar: 'الفترة', en: 'Period', value: periodText },
            invoice.billingMonth && { ar: 'شهر التوصيل', en: 'Billing Month', value: invoice.billingMonth },
            invoice.clientPoNumber && { ar: 'رقم طلب الشراء', en: 'Purchase Order No.', value: invoice.clientPoNumber, big: true },
          ].filter(Boolean).map((row, i, arr) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < arr.length - 1 ? border : 'none' }}>
              <FieldLabel ar={row.ar} en={row.en} color={accent} />
              <span dir="ltr" style={{ fontWeight: 800, fontSize: row.big ? 17 : 13, color: row.big ? primary : accent }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* جدول البنود */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12, tableLayout: 'fixed', borderRadius: 12, overflow: 'hidden', boxShadow: cardShadow }}>
        <colgroup>
          <col style={{ width: '20%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '40%' }} />
          <col style={{ width: '8%' }} />
        </colgroup>
        <thead>
          <tr style={{ background: primary, color: '#fff', fontSize: 11 }}>
            <th style={{ padding: '10px 12px', textAlign: 'start' }}>{'الإجمالي'}<span style={{ display: 'block', fontSize: 9, fontWeight: 400, opacity: 0.9 }}>Amount (SAR)</span></th>
            <th style={{ padding: '10px 12px', textAlign: 'start' }}>{'سعر الوحدة'}<span style={{ display: 'block', fontSize: 9, fontWeight: 400, opacity: 0.9 }}>Unit Price</span></th>
            <th style={{ padding: '10px 12px', textAlign: 'center' }}>{'الكمية'}<span style={{ display: 'block', fontSize: 9, fontWeight: 400, opacity: 0.9 }}>Qty</span></th>
            <th style={{ padding: '10px 12px', textAlign: 'end' }}>{'الصنف / الخدمة'}<span style={{ display: 'block', fontSize: 9, fontWeight: 400, opacity: 0.9 }}>Item / Service</span></th>
            <th style={{ padding: '10px 12px', textAlign: 'center' }}>{'م'}<span style={{ display: 'block', fontSize: 9, fontWeight: 400, opacity: 0.9 }}>#</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} style={{ borderBottom: border, background: i % 2 ? '#fafafa' : '#fff' }}>
              <td style={{ padding: '11px 12px', textAlign: 'start', fontWeight: 700 }}><Money value={it.total} /></td>
              <td style={{ padding: '11px 12px', textAlign: 'start' }}><Money value={it.unitPrice} /></td>
              <td style={{ padding: '11px 12px', textAlign: 'center' }}>{it.qty ?? 1}</td>
              <td style={{ padding: '11px 12px', textAlign: 'end', wordBreak: 'break-word' }}>
                <span style={{ fontWeight: 700, color: accent }}>{it.description}</span>
                {it.descriptionEn && <span style={{ display: 'block', fontSize: 10, color: labelColor }}>{it.descriptionEn}</span>}
              </td>
              <td style={{ padding: '11px 12px', textAlign: 'center', color: labelColor }}>{i + 1}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* الملخّص المالي (يمين) + QR وشكر (يسار) */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', marginBottom: 18 }}>
        {/* الملخّص المالي */}
        <div style={{ flex: '0 0 46%', border, borderRadius: 12, overflow: 'hidden', boxShadow: cardShadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: border }}>
            <span style={{ fontWeight: 700 }}><Money value={subtotal} /></span>
            <FieldLabel ar="المجموع الفرعي" en="Subtotal" color={accent} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: border }}>
            <span style={{ fontWeight: 700 }}><Money value={vat} /></span>
            <FieldLabel ar={`ضريبة القيمة المضافة (${invoice.vatRate ? Math.round(invoice.vatRate * 100) : 15}%)`} en={`VAT (${invoice.vatRate ? Math.round(invoice.vatRate * 100) : 15}%)`} color={accent} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: primary, color: '#fff' }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}><Money value={total} symbolSize="1.25em" /></span>
            <div style={{ lineHeight: 1.25 }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800 }}>{'الإجمالي الكلي'}</span>
              <span style={{ display: 'block', fontSize: 9, opacity: 0.9 }}>Total Amount</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: accent, color: '#fff' }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}><Money value={isRental ? total : balance} symbolSize="1.25em" /></span>
            <div style={{ lineHeight: 1.25 }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800 }}>{'المبلغ المستحق'}</span>
              <span style={{ display: 'block', fontSize: 9, opacity: 0.9 }}>Amount Due</span>
            </div>
          </div>
        </div>

        {/* شكر وتعليمات QR — يمين الرمز (يسبقه في تدفّق RTL) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, textAlign: 'start' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: accent }}>{'شكراً لتعاملكم معنا'}</div>
            <div style={{ fontSize: 10, color: labelColor }}>Thank you for your business</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: accent }}>{'امسح رمز QR'}</div>
            <div style={{ fontSize: 9.5, color: labelColor }}>{'للدفع أو التحقق من الفاتورة'}</div>
            <div style={{ fontSize: 9, color: '#9ca3af' }}>Scan QR Code to pay or verify invoice</div>
          </div>
        </div>

        {/* QR */}
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {qrPayload ? (
            <img src={zatcaQrImageUrl(qrPayload, 130)} alt="ZATCA QR" style={{ width: 130, height: 130 }} />
          ) : settings.showQr !== false && !settings.vatNumber ? (
            <div style={{ width: 130, height: 130, border: `1px dashed ${labelColor}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 10, color: labelColor, padding: 8 }}>
              {t('أدخل الرقم الضريبي في الإعدادات لإظهار رمز QR', 'Add a VAT number in Settings to show the QR code', lang)}
            </div>
          ) : null}
        </div>
      </div>

      {/* تفاصيل الحساب البنكي — صف واحد بأعمدة مرتبة */}
      {(settings.iban || settings.bankName) && (
        <div style={{ border, borderRadius: 12, overflow: 'hidden', marginBottom: 16, boxShadow: cardShadow }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: border, color: accent, fontWeight: 800, fontSize: 12 }}>
            {'تفاصيل الحساب البنكي'}<span style={{ fontSize: 9, fontWeight: 500, color: labelColor }}>Bank Details</span>
          </div>
          <div style={{ display: 'flex', textAlign: 'center' }}>
            {[
              { ar: 'اسم الحساب', en: 'Account Name', value: settings.bankAccountName || settings.companyName },
              { ar: 'رقم الآيبان', en: 'IBAN', value: settings.iban, ltr: true },
              { ar: 'الفرع', en: 'Branch', value: settings.bankBranch },
              { ar: 'اسم البنك', en: 'Bank Name', value: settings.bankName },
              { ar: 'رقم الحساب', en: 'Account No.', value: settings.bankAccountNumber, ltr: true },
              { ar: 'رمز السويفت', en: 'SWIFT Code', value: settings.swiftCode, ltr: true },
            ].map((col, i, arr) => (
              <div key={i} style={{ flex: 1, padding: '10px 8px', borderInlineStart: i > 0 ? border : 'none' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: accent }}>{col.ar}</div>
                <div style={{ fontSize: 8.5, color: '#9ca3af', marginBottom: 4 }}>{col.en}</div>
                <div dir={col.ltr ? 'ltr' : undefined} style={{ fontSize: 11, fontWeight: 600, color: '#374151', wordBreak: 'break-word' }}>{col.value || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* خانتا التوقيع والختم */}
      <div style={{ display: 'flex', gap: 40, marginBottom: 16 }}>
        <div style={{ flex: 1, border, borderRadius: 12, padding: 12, textAlign: 'center', boxShadow: cardShadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: accent }}>{'توقيع وختم المستلم'}</div>
          <div style={{ fontSize: 9, color: labelColor, marginBottom: 6 }}>Receiver Signature & Stamp</div>
          <div style={{ height: 60 }} />
        </div>
        <div style={{ flex: 1, border, borderRadius: 12, padding: 12, textAlign: 'center', boxShadow: cardShadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: accent }}>{'توقيع وختم الشركة'}</div>
          <div style={{ fontSize: 9, color: labelColor, marginBottom: 6 }}>Company Signature & Stamp</div>
          <div style={{ height: 60 }} />
        </div>
      </div>

      {/* الشروط والأحكام — تظهر فقط إن أُدخلت في الإعدادات */}
      {settings.terms && (
        <div style={{ border, borderRadius: 12, padding: 12, fontSize: 11, color: labelColor, whiteSpace: 'pre-wrap', marginBottom: 16, boxShadow: cardShadow }}>
          <div style={{ fontWeight: 700, color: accent, marginBottom: 4 }}>{'الشروط والأحكام / Terms & Conditions'}</div>
          {settings.terms}
        </div>
      )}

      {/* الفوتر — بيانات التواصل والعنوان */}
      {settings.footerImageUrl ? (
        <img src={settings.footerImageUrl} alt="footer" style={{ width: '100%', display: 'block', marginTop: 8 }} />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', alignItems: 'center', borderTop: `2px solid ${primary}`, paddingTop: 12, fontSize: 10.5, color: '#374151' }}>
          {settings.phone && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Phone size={13} style={{ color: primary }} /><span dir="ltr" style={{ fontWeight: 600 }}>{settings.phone}</span>
            </span>
          )}
          {settings.email && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Mail size={13} style={{ color: primary }} /><span dir="ltr">{settings.email}</span>
            </span>
          )}
          {settings.website && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Globe size={13} style={{ color: primary }} /><span dir="ltr">{settings.website}</span>
            </span>
          )}
          {(settings.address || settings.city) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={13} style={{ color: primary }} /><span>{[settings.address, settings.city].filter(Boolean).join('، ')}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}