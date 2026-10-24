// Exact decimal arithmetic and EN 16931 totals.
// Values are rationals {n, d} of BigInt so nothing is lost to binary floats;
// money is rounded to 2 decimals, half away from zero, at the points EN 16931
// defines (line net amount, allowance/charge amount, VAT per category).

const TEN = 10n;

/** Parse a number or decimal string into an exact rational. */
export function dec(value) {
  if (value && typeof value === 'object' && 'n' in value && 'd' in value) return value;
  if (typeof value === 'bigint') return { n: value, d: 1n };
  if (value === undefined || value === null || value === '') return { n: 0n, d: 1n };
  let s = typeof value === 'number' ? numberToString(value) : String(value).trim();
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
  if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) throw new Error(`Not a decimal number: "${value}"`);
  const sign = m[1] === '-' ? -1n : 1n;
  const frac = m[3] || '';
  let n = BigInt((m[2] || '0') + frac) * sign;
  let d = TEN ** BigInt(frac.length);
  const exp = m[4] ? Number(m[4]) : 0;
  if (exp > 0) n *= TEN ** BigInt(exp);
  if (exp < 0) d *= TEN ** BigInt(-exp);
  return { n, d };
}

function numberToString(x) {
  if (!Number.isFinite(x)) throw new Error(`Not a finite number: ${x}`);
  return String(x);
}

export const add = (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
export const sub = (a, b) => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
export const mul = (a, b) => ({ n: a.n * b.n, d: a.d * b.d });
export const div = (a, b) => {
  if (b.n === 0n) throw new Error('Division by zero');
  return b.n < 0n ? { n: -a.n * b.d, d: a.d * -b.n } : { n: a.n * b.d, d: a.d * b.n };
};

/** Round to `places` decimals, half away from zero. Returns scaled BigInt (cents for 2). */
export function roundScaled(r, places = 2) {
  const num = r.n * TEN ** BigInt(places);
  const neg = num < 0n;
  const a = neg ? -num : num;
  const q = (a * 2n + r.d) / (2n * r.d);
  return neg ? -q : q;
}

/** Format a scaled BigInt with `places` decimals. */
export function formatScaled(v, places = 2) {
  const neg = v < 0n;
  let s = (neg ? -v : v).toString().padStart(places + 1, '0');
  const out = places ? `${s.slice(0, -places)}.${s.slice(-places)}` : s;
  return neg && v !== 0n ? `-${out}` : out;
}

/** Round a value to money (2 decimals) and return the string "123.45". */
export function money(value) {
  return formatScaled(roundScaled(dec(value), 2), 2);
}

/** Exact, shortest decimal string for a value (for quantities, prices, rates). */
export function decimalString(value, maxPlaces = 10) {
  const r = dec(value);
  for (let p = 0; p <= maxPlaces; p++) {
    const scaled = r.n * TEN ** BigInt(p);
    if (scaled % r.d === 0n) return formatScaled(scaled / r.d, p);
  }
  return formatScaled(roundScaled(r, maxPlaces), maxPlaces).replace(/0+$/, '');
}

const cents = (v) => roundScaled(dec(v), 2);
const fromCents = (c) => ({ n: c, d: 100n });
const isZero = (v) => v === undefined || v === null || v === '' || dec(v).n === 0n;

function acAmount(ac, defaultBase) {
  if (ac.amount !== undefined && ac.amount !== null && ac.amount !== '') return cents(ac.amount);
  if (ac.percent !== undefined && ac.percent !== null) {
    const base = ac.baseAmount !== undefined ? dec(ac.baseAmount) : defaultBase;
    if (!base) throw new Error('An allowance or charge with a percent needs a baseAmount');
    return roundScaled(div(mul(base, dec(ac.percent)), dec(100)), 2);
  }
  throw new Error('An allowance or charge needs an amount or a percent');
}

function acBase(ac, defaultBase) {
  if (ac.percent === undefined || ac.percent === null) return ac.baseAmount !== undefined ? cents(ac.baseAmount) : undefined;
  return ac.baseAmount !== undefined ? cents(ac.baseAmount) : roundScaled(defaultBase, 2);
}

function vatKey(category, rate) {
  return `${category}|${category === 'O' ? '' : decimalString(rate ?? 0)}`;
}

/**
 * Compute every EN 16931 total for an invoice.
 * All returned amounts are strings with 2 decimals.
 *
 * @param {import('./model.mjs').Invoice} invoice
 */
export function computeTotals(invoice) {
  const lines = (invoice.lines || []).map((line) => {
    const qty = dec(line.quantity);
    const basisQty = line.basisQuantity !== undefined ? dec(line.basisQuantity) : dec(1);
    const gross = div(mul(qty, dec(line.netPrice)), basisQty); // BT-146 x BT-129 / BT-149
    const grossCents = roundScaled(gross, 2);
    const allowances = (line.allowances || []).map((ac) => ({ ...ac, amountCents: acAmount(ac, fromCents(grossCents)), baseCents: acBase(ac, fromCents(grossCents)) }));
    const charges = (line.charges || []).map((ac) => ({ ...ac, amountCents: acAmount(ac, fromCents(grossCents)), baseCents: acBase(ac, fromCents(grossCents)) }));
    const netCents = grossCents + charges.reduce((s, c) => s + c.amountCents, 0n) - allowances.reduce((s, c) => s + c.amountCents, 0n);
    return { line, netCents, allowances, charges };
  });

  const lineTotalCents = lines.reduce((s, l) => s + l.netCents, 0n);
  const docAllowances = (invoice.allowances || []).map((ac) => ({ ...ac, amountCents: acAmount(ac, fromCents(lineTotalCents)), baseCents: acBase(ac, fromCents(lineTotalCents)) }));
  const docCharges = (invoice.charges || []).map((ac) => ({ ...ac, amountCents: acAmount(ac, fromCents(lineTotalCents)), baseCents: acBase(ac, fromCents(lineTotalCents)) }));
  const allowanceTotalCents = docAllowances.reduce((s, a) => s + a.amountCents, 0n);
  const chargeTotalCents = docCharges.reduce((s, a) => s + a.amountCents, 0n);

  // VAT breakdown: group by category and rate, compute VAT on the group basis.
  const groups = new Map();
  const group = (category, rate, src) => {
    const key = vatKey(category, rate);
    if (!groups.has(key)) groups.set(key, { category, rate: category === 'O' ? undefined : decimalString(rate ?? 0), basisCents: 0n, exemptionReason: undefined, exemptionReasonCode: undefined });
    const g = groups.get(key);
    if (!g.exemptionReason && src?.exemptionReason) g.exemptionReason = src.exemptionReason;
    if (!g.exemptionReasonCode && src?.exemptionReasonCode) g.exemptionReasonCode = src.exemptionReasonCode;
    return g;
  };
  for (const l of lines) group(l.line.vatCategory, l.line.vatRate, l.line).basisCents += l.netCents;
  for (const a of docCharges) group(a.vatCategory, a.vatRate, a).basisCents += a.amountCents;
  for (const a of docAllowances) group(a.vatCategory, a.vatRate, a).basisCents -= a.amountCents;

  const vatBreakdown = [...groups.values()].map((g) => {
    const ex = invoice.vatExemptions?.[g.category] || {};
    const taxCents = g.rate === undefined ? 0n : roundScaled(div(mul(fromCents(g.basisCents), dec(g.rate)), dec(100)), 2);
    return {
      category: g.category,
      rate: g.rate,
      basis: formatScaled(g.basisCents),
      tax: formatScaled(taxCents),
      taxCents,
      basisCents: g.basisCents,
      exemptionReason: g.exemptionReason || ex.reason,
      exemptionReasonCode: g.exemptionReasonCode || ex.code,
    };
  });

  const taxBasisCents = lineTotalCents - allowanceTotalCents + chargeTotalCents;
  const taxTotalCents = vatBreakdown.reduce((s, g) => s + g.taxCents, 0n);
  const grandCents = taxBasisCents + taxTotalCents;
  const prepaidCents = isZero(invoice.prepaidAmount) ? 0n : cents(invoice.prepaidAmount);
  const dueCents = grandCents - prepaidCents;

  return {
    lines: lines.map((l) => ({
      id: l.line.id,
      netAmount: formatScaled(l.netCents),
      allowances: l.allowances.map((a) => ({ amount: formatScaled(a.amountCents), baseAmount: a.baseCents !== undefined ? formatScaled(a.baseCents) : undefined })),
      charges: l.charges.map((a) => ({ amount: formatScaled(a.amountCents), baseAmount: a.baseCents !== undefined ? formatScaled(a.baseCents) : undefined })),
    })),
    allowances: docAllowances.map((a) => ({ amount: formatScaled(a.amountCents), baseAmount: a.baseCents !== undefined ? formatScaled(a.baseCents) : undefined })),
    charges: docCharges.map((a) => ({ amount: formatScaled(a.amountCents), baseAmount: a.baseCents !== undefined ? formatScaled(a.baseCents) : undefined })),
    vatBreakdown: vatBreakdown.map(({ taxCents, basisCents, ...g }) => g),
    lineTotal: formatScaled(lineTotalCents),
    allowanceTotal: formatScaled(allowanceTotalCents),
    chargeTotal: formatScaled(chargeTotalCents),
    taxBasisTotal: formatScaled(taxBasisCents),
    taxTotal: formatScaled(taxTotalCents),
    grandTotal: formatScaled(grandCents),
    prepaid: formatScaled(prepaidCents),
    duePayable: formatScaled(dueCents),
    currency: invoice.currency,
  };
}
