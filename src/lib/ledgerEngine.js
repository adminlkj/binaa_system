/**
 * Ledger Engine — محرك الأستاذ والتقارير المالية
 *
 * يبني ميزان المراجعة ودفتر الأستاذ من القيود المُرحّلة فقط (isPosted=true).
 * المصدر الموحّد لأي تقرير رصيد حساب في النظام.
 */

/**
 * يستخرج كل سطور القيود المرحّلة مسطّحة مع بيانات القيد.
 */
export function flattenPostedLines(entries) {
  const rows = [];
  for (const je of entries) {
    if (!je.isPosted) continue;
    for (const line of je.lines || []) {
      rows.push({
        entryNo: je.entryNo,
        date: je.date,
        entryDescription: je.description,
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        description: line.description,
      });
    }
  }
  return rows;
}

/**
 * ميزان المراجعة: مجاميع مدين ودائن لكل حساب + الرصيد الصافي.
 * accounts (اختياري) لإثراء الأسماء والأنواع من الدليل المحاسبي.
 * فترة اختيارية { from, to } لتصفية التواريخ.
 */
export function buildTrialBalance(entries, accounts = [], period = {}) {
  const accByCode = Object.fromEntries((accounts || []).map(a => [a.code, a]));
  const map = {};
  for (const r of flattenPostedLines(entries)) {
    if (period.from && r.date < period.from) continue;
    if (period.to && r.date > period.to) continue;
    const key = r.accountCode || '—';
    if (!map[key]) {
      const acc = accByCode[key];
      map[key] = {
        accountCode: key,
        accountName: acc?.name || r.accountName || key,
        accountType: acc?.accountType || null,
        totalDebit: 0,
        totalCredit: 0,
      };
    }
    map[key].totalDebit += r.debit;
    map[key].totalCredit += r.credit;
  }
  const rows = Object.values(map).map(a => {
    const net = a.totalDebit - a.totalCredit;
    return {
      ...a,
      totalDebit: +a.totalDebit.toFixed(2),
      totalCredit: +a.totalCredit.toFixed(2),
      debitBalance: net > 0 ? +net.toFixed(2) : 0,
      creditBalance: net < 0 ? +Math.abs(net).toFixed(2) : 0,
    };
  }).sort((a, b) => (a.accountCode > b.accountCode ? 1 : -1));

  const totals = rows.reduce((s, r) => ({
    debit: s.debit + r.totalDebit,
    credit: s.credit + r.totalCredit,
    debitBal: s.debitBal + r.debitBalance,
    creditBal: s.creditBal + r.creditBalance,
  }), { debit: 0, credit: 0, debitBal: 0, creditBal: 0 });

  return {
    rows,
    totals: {
      debit: +totals.debit.toFixed(2),
      credit: +totals.credit.toFixed(2),
      debitBal: +totals.debitBal.toFixed(2),
      creditBal: +totals.creditBal.toFixed(2),
    },
    balanced: Math.abs(totals.debit - totals.credit) < 0.01,
  };
}

/**
 * دفتر أستاذ لحساب واحد: الحركات مرتبة بالتاريخ مع رصيد جارٍ.
 */
export function buildAccountLedger(entries, accountCode, period = {}) {
  const allRows = flattenPostedLines(entries)
    .filter(r => r.accountCode === accountCode)
    .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

  const openingBalance = +allRows
    .filter(r => period.from && r.date < period.from)
    .reduce((s, r) => s + r.debit - r.credit, 0)
    .toFixed(2);

  const rows = allRows
    .filter(r => (!period.from || r.date >= period.from) && (!period.to || r.date <= period.to));

  let running = openingBalance;
  const movements = rows.map(r => {
    running += r.debit - r.credit;
    return { ...r, balance: +running.toFixed(2) };
  });
  const totalDebit = +rows.reduce((s, r) => s + r.debit, 0).toFixed(2);
  const totalCredit = +rows.reduce((s, r) => s + r.credit, 0).toFixed(2);
  return { movements, totalDebit, totalCredit, openingBalance, closingBalance: +running.toFixed(2) };
}

/**
 * تحليل مراكز التكلفة: يجمّع الإيرادات والتكاليف لكل مركز تكلفة (مشروع).
 *
 * التكاليف = المصروفات المرتبطة بالمشروع + فواتير مقاولي الباطن للمشروع.
 * الإيرادات = مستخلصات/فواتير العملاء للمشروع (بالمبلغ قبل الضريبة).
 * الهامش = الإيراد − التكلفة، ونسبة الهامش منسوبة إلى الإيراد.
 *
 * period اختياري { from, to } لتصفية حسب تاريخ المستند.
 */
export function buildCostCenterAnalysis({ projects = [], expenses = [], subInvoices = [], salesInvoices = [] }, period = {}) {
  const inPeriod = (d) => (!period.from || (d && d >= period.from)) && (!period.to || (d && d <= period.to));

  // مركز لكل مشروع + مركز "غير مخصّص" للمصروفات بلا مشروع.
  const centers = {};
  const ensure = (projectId, name, code) => {
    const key = projectId || '__unassigned__';
    if (!centers[key]) {
      centers[key] = {
        projectId: projectId || null,
        code: code || (projectId ? '' : '—'),
        name: name || '',
        cost: 0,
        revenue: 0,
        expenseCost: 0,
        subCost: 0,
      };
    }
    return centers[key];
  };

  // تهيئة مراكز من قائمة المشاريع (تظهر حتى لو بلا حركة).
  for (const p of projects) {
    ensure(p.id, p.nameAr || p.name, p.costCenter || p.code);
  }

  for (const e of expenses) {
    if (!inPeriod(e.date)) continue;
    const c = ensure(e.projectId, e.projectName || (e.projectId ? '' : 'غير مخصّص'));
    const amt = Number(e.amount) || 0;
    c.cost += amt; c.expenseCost += amt;
  }

  for (const si of subInvoices) {
    if (!inPeriod(si.date)) continue;
    if (!si.projectId) continue;
    const c = ensure(si.projectId, si.projectName);
    const amt = Number(si.baseAmount) || 0;
    c.cost += amt; c.subCost += amt;
  }

  for (const inv of salesInvoices) {
    if (!inPeriod(inv.date)) continue;
    if (!inv.projectId) continue;
    const c = ensure(inv.projectId, inv.projectName);
    c.revenue += Number(inv.subtotal) || 0;
  }

  const rows = Object.values(centers)
    .map((c) => {
      const margin = c.revenue - c.cost;
      return {
        ...c,
        cost: +c.cost.toFixed(2),
        revenue: +c.revenue.toFixed(2),
        expenseCost: +c.expenseCost.toFixed(2),
        subCost: +c.subCost.toFixed(2),
        margin: +margin.toFixed(2),
        marginPercent: c.revenue > 0 ? +((margin / c.revenue) * 100).toFixed(1) : 0,
      };
    })
    // إخفاء المراكز الفارغة تماماً (لا تكلفة ولا إيراد)
    .filter((c) => c.cost !== 0 || c.revenue !== 0)
    .sort((a, b) => b.cost - a.cost);

  const totals = rows.reduce(
    (s, r) => ({
      cost: s.cost + r.cost,
      revenue: s.revenue + r.revenue,
      margin: s.margin + r.margin,
    }),
    { cost: 0, revenue: 0, margin: 0 }
  );

  return {
    rows,
    totals: {
      cost: +totals.cost.toFixed(2),
      revenue: +totals.revenue.toFixed(2),
      margin: +totals.margin.toFixed(2),
    },
  };
}