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
  const rows = flattenPostedLines(entries)
    .filter(r => r.accountCode === accountCode)
    .filter(r => (!period.from || r.date >= period.from) && (!period.to || r.date <= period.to))
    .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

  let running = 0;
  const movements = rows.map(r => {
    running += r.debit - r.credit;
    return { ...r, balance: +running.toFixed(2) };
  });
  const totalDebit = +rows.reduce((s, r) => s + r.debit, 0).toFixed(2);
  const totalCredit = +rows.reduce((s, r) => s + r.credit, 0).toFixed(2);
  return { movements, totalDebit, totalCredit, closingBalance: +running.toFixed(2) };
}