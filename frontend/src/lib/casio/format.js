/* Result formatting for Casio fx-580VN X: NORM/FIX/SCI, fractions, π, surds, DMS, ENG */
import { isNum, isC, isM, isV, isL, formatBase } from './engine.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };

/* Normal display with 10 significant digits */
function norm(x, mode) {
  if (x === 0) return '0';
  const a = Math.abs(x); const lim = mode === 2 ? [1e-9, 1e10] : [1e-2, 1e10];
  if (a < lim[0] || a >= lim[1]) return sci(x, 9);
  let s = Number(x.toPrecision(10)).toString();
  if (s.includes('e')) s = sci(x, 9);
  return s;
}
function sci(x, digits) {
  if (x === 0) return '0';
  const [m, e] = x.toExponential(digits).split('e'); const mant = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m;
  return `${mant}×10${e.startsWith('-') ? '^-' : '^'}${e.replace(/^[+-]0*/, '') || '0'}`;
}
function eng(x) {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)) / 3) * 3; const m = Number((x / 10 ** e).toPrecision(10));
  return `${m}×10${e < 0 ? '^-' : '^'}${Math.abs(e)}`;
}
export function fmtReal(x, fmt = {}) {
  if (!Number.isFinite(x)) return 'Math ERROR';
  if (Object.is(x, -0)) x = 0;
  if (fmt.eng) return eng(x);
  if (fmt.fixN != null) { const r = x.toFixed(fmt.fixN); return Number(r) === 0 ? (0).toFixed(fmt.fixN) : r; }
  if (fmt.sciN != null) { const n = fmt.sciN === 0 ? 10 : fmt.sciN; const [m, e] = x.toExponential(n - 1).split('e'); return `${m}×10${e.startsWith('-') ? '^-' : '^'}${e.replace(/^[+-]0*/, '') || '0'}`; }
  return norm(x, fmt.norm || 1);
}

/* ----- exact forms (MathO) ----- */
const squareFree = n => { let out = 1, rest = n; for (let p = 2; p * p <= rest; p++) { while (rest % (p * p) === 0) { out *= p; rest /= p * p; } } return [out, rest]; };

export function toFraction(x, maxDen = 99999) {
  if (!Number.isFinite(x) || Number.isInteger(x)) return null;
  const neg = x < 0; const a = Math.abs(x);
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = a;
  for (let i = 0; i < 40; i++) {
    const ai = Math.floor(b); const h2 = ai * h1 + h0, k2 = ai * k1 + k0;
    if (k2 > maxDen || h2 > 1e11) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(a - h1 / k1) < 1e-13 * Math.max(1, a)) { const g = gcd(h1, k1); return { n: (neg ? -h1 : h1) / g, d: k1 / g }; }
    b = 1 / (b - ai); if (!Number.isFinite(b)) break;
  }
  return null;
}
const fracStr = (n, d) => (d === 1 ? `${n}` : `${n}/${d}`);

/* Try forms: p/q, (p/q)π, (p√r)/q, ... returns string or null */
export function exactForm(x) {
  if (!Number.isFinite(x) || x === 0 || Number.isInteger(x) && Math.abs(x) < 1e10) return null;
  const f = toFraction(x); if (f && f.d <= 9999) return fracStr(f.n, f.d);
  const pi = toFraction(x / Math.PI, 360);
  if (pi && Math.abs(pi.n) <= 360) { const n = pi.n; const t = Math.abs(n) === 1 ? (n < 0 ? '-π' : 'π') : `${n}π`; return pi.d === 1 ? t : `${t}/${pi.d}`; }
  if (pi === null && Number.isInteger(x / Math.PI) && Math.abs(x / Math.PI) < 1e4) { const n = Math.round(x / Math.PI); return n === 1 ? 'π' : n === -1 ? '-π' : `${n}π`; }
  // surd: x = p√r / q  => x² rational
  const x2 = toFraction(x * x, 9999) || (Number.isInteger(x * x) ? { n: x * x, d: 1 } : null);
  if (x2 && Math.abs(x2.n) < 1e6) {
    const rnum = Math.round(x2.n * x2.d); // x² = n/d  -> x = √(n·d)/d
    const [out, rest] = squareFree(Math.abs(rnum)); const den = x2.d;
    if (rest > 1 || out > 1) {
      let coef = out; const g = gcd(coef, den); coef /= g; const d = den / g;
      const sign = x < 0 ? '-' : '';
      if (rest === 1) return null;
      const num = coef === 1 ? `√${rest}` : `${coef}√${rest}`;
      return d === 1 ? `${sign}${num}` : `${sign}${num}/${d}`;
    }
  }
  // a + b√r forms  (common for quadratics): try small r
  for (const r of [2, 3, 5, 6, 7, 10]) for (let q = 1; q <= 12; q++) for (let b = -12; b <= 12; b++) {
    if (b === 0) continue; const a = (x - (b * Math.sqrt(r)) / q) ; const af = toFraction(a, 12) || (Number.isInteger(a) ? { n: a, d: 1 } : null);
    if (af && Math.abs(a - af.n / af.d) < 1e-12 && Math.abs(af.n) <= 999) {
      const g = gcd(b, q); const bb = b / g, qq = q / g;
      const surd = `${Math.abs(bb) === 1 ? '' : Math.abs(bb)}√${r}`;
      const lcm = (af.d * qq) / gcd(af.d, qq);
      const an = af.n * (lcm / af.d), bn = bb * (lcm / qq);
      const gg = gcd(gcd(an, Math.abs(bn)), lcm); const A = an / gg, B = bn / gg, L = lcm / gg;
      const bs = `${Math.abs(B) === 1 ? '' : Math.abs(B)}√${r}`;
      const body = A === 0 ? (B < 0 ? `-${bs}` : bs) : `${A}${B < 0 ? '-' : '+'}${bs}`;
      void surd; return L === 1 ? body : (A === 0 ? `${body}/${L}` : `(${body})/${L}`);
    }
  }
  return null;
}

export function toDMS(x) {
  const neg = x < 0; let a = Math.abs(x); const d = Math.floor(a + 1e-12); a = (a - d) * 60; const m = Math.floor(a + 1e-9); let s = (a - m) * 60;
  s = Math.round(s * 1e4) / 1e4; let M = m, D = d; if (s >= 60) { s -= 60; M += 1; } if (M >= 60) { M -= 60; D += 1; }
  return `${neg ? '-' : ''}${D}°${M}′${s}″`;
}
export function mixed(n, d) {
  if (d === 1 || Math.abs(n) < d) return null;
  const whole = Math.trunc(n / d), r = Math.abs(n % d); return `${whole}⌟${r}⌟${d}`;
}

export function fmtComplex(c, fmt, polar, ctx) {
  const f = x => fmtReal(x, fmt);
  if (polar) { const r = Math.hypot(c.re, c.im); const th = Math.atan2(c.im, c.re); const a = ctx.angle === 'deg' ? th * 180 / Math.PI : ctx.angle === 'gra' ? th * 200 / Math.PI : th; return `${f(r)}∠${f(a)}`; }
  const re = f(c.re), im = f(Math.abs(c.im)); const sgn = c.im < 0 ? '-' : '+';
  const imS = Math.abs(c.im) === 1 && fmt.fixN == null ? 'i' : `${im}i`;
  return c.re === 0 ? `${c.im < 0 ? '-' : ''}${imS}` : `${re}${sgn}${imS}`;
}

/* ctx = { angle, base, fmt, exact, polar, dms, frac } */
export function formatValue(v, ctx, view = {}) {
  const fmt = ctx.fmt || {};
  if (v && v.t === 'bool') return v.v ? 'TRUE' : 'FALSE';
  if (isNum(v)) {
    if (ctx.base && ctx.base !== 10) return formatBase(v, ctx.base);
    if (ctx.base === 10) return String(v);
    if (view.dms) return toDMS(v);
    const plain = fmtReal(v, fmt);
    if (view.decimal || fmt.fixN != null || fmt.sciN != null || fmt.eng) return plain;
    if (ctx.exact) { const ex = exactForm(v); if (ex) return ex; }
    else if (!Number.isInteger(v)) { const f = toFraction(v); if (f && f.d <= 9999 && view.fraction) return mixed(f.n, f.d) || fracStr(f.n, f.d); }
    return plain;
  }
  if (isC(v)) return fmtComplex(v, fmt, ctx.polar, ctx);
  if (isM(v)) return `[${v.a.map(r => `[${r.map(x => fmtReal(x, fmt)).join(', ')}]`).join(', ')}]`;
  if (isV(v)) return `[${v.a.map(x => fmtReal(x, fmt)).join(', ')}]`;
  if (isL(v)) return v.a.map((x, i) => `${v.labels[i]}=${fmtReal(x, fmt)}`).join('  ');
  return String(v);
}
/* Decimal alternative for S⇔D */
export function decimalOf(v, ctx) { return isNum(v) ? fmtReal(v, ctx.fmt || {}) : null; }
export function hasExact(v, ctx) { return isNum(v) && !ctx.base && (exactForm(v) !== null || toFraction(v) !== null); }
