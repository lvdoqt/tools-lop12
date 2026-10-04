import { CasioError } from './errors.js';
import { solveLinear, inverse, matMul } from './linalg.js';

const bad = (m = 'Math ERROR') => { throw new CasioError(m); };
const sum = a => a.reduce((s, v) => s + v, 0);
const clean = x => { if (Math.abs(x) < 1e-13) return 0; const r = Math.round(x); return Math.abs(x - r) < 1e-12 * Math.max(1, Math.abs(x)) ? r : x; };

/* ================= EQUATION MODE ================= */
export function solveSimultaneous(M) {
  const n = M.length; const A = M.map(r => r.slice(0, n)), b = M.map(r => r[n]);
  return solveLinear(A, b).map(clean);
}

/* roots of polynomial coefficients [a_n,...,a_0], returns [{re,im}] */
export function polyRoots(coef) {
  let c = [...coef]; while (c.length && c[0] === 0) c.shift();
  if (c.length < 2) bad('Math ERROR');
  const n = c.length - 1;
  if (n === 1) return [{ re: clean(-c[1] / c[0]), im: 0 }];
  if (n === 2) {
    const [a, b, k] = c; const D = b * b - 4 * a * k;
    if (D >= 0) { const s = Math.sqrt(D); return [{ re: clean((-b + s) / (2 * a)), im: 0 }, { re: clean((-b - s) / (2 * a)), im: 0 }]; }
    const s = Math.sqrt(-D); return [{ re: clean(-b / (2 * a)), im: clean(s / (2 * a)) }, { re: clean(-b / (2 * a)), im: clean(-s / (2 * a)) }];
  }
  const a = c.map(v => v / c[0]);
  const R = 1 + Math.max(...a.slice(1).map(Math.abs));
  let z = Array.from({ length: n }, (_, k) => ({ re: R * 0.6 * Math.cos(2 * Math.PI * k / n + 0.4), im: R * 0.6 * Math.sin(2 * Math.PI * k / n + 0.4) }));
  const mul = (p, q) => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re });
  const div = (p, q) => { const d = q.re * q.re + q.im * q.im; return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d }; };
  const ev = x => { let r = { re: 1, im: 0 }; for (let i = 1; i <= n; i++) { r = mul(r, x); r.re += a[i]; } return r; };
  for (let it = 0; it < 500; it++) {
    let delta = 0;
    z = z.map((zi, i) => {
      let den = { re: 1, im: 0 };
      z.forEach((zj, j) => { if (i !== j) den = mul(den, { re: zi.re - zj.re, im: zi.im - zj.im }); });
      if (den.re === 0 && den.im === 0) den = { re: 1e-12, im: 0 };
      const d = div(ev(zi), den); delta = Math.max(delta, Math.hypot(d.re, d.im));
      return { re: zi.re - d.re, im: zi.im - d.im };
    });
    if (delta < 1e-15) break;
  }
  // polish with Newton on real roots
  return z.map(r => ({ re: clean(r.re), im: Math.abs(r.im) < 1e-9 * Math.max(1, Math.abs(r.re)) ? 0 : clean(r.im) }))
    .sort((p, q) => p.re - q.re || p.im - q.im);
}

/* ================= INEQUALITY MODE ================= */
export function solveInequality(coef, op) {
  const roots = polyRoots(coef).filter(r => r.im === 0).map(r => r.re);
  const uniq = [...new Set(roots.map(r => Number(r.toPrecision(10))))].sort((a, b) => a - b);
  const f = x => coef.reduce((s, c) => s * x + c, 0);
  const strict = op === '>' || op === '<'; const want = op === '>' || op === '>=' ? 1 : -1;
  const pts = [-Infinity, ...uniq, Infinity]; const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const lo = pts[i], hi = pts[i + 1];
    const mid = lo === -Infinity ? hi - 1 : hi === Infinity ? lo + 1 : (lo + hi) / 2;
    if (Math.sign(f(mid)) === want) out.push({ lo, hi, loInc: !strict, hiInc: !strict });
  }
  if (!strict) uniq.forEach(r => { if (!out.some(o => o.lo <= r && r <= o.hi && (o.lo === r || o.hi === r))) out.push({ lo: r, hi: r, loInc: true, hiInc: true }); });
  out.sort((a, b) => a.lo - b.lo);
  const merged = [];
  out.forEach(o => {
    const p = merged[merged.length - 1];
    if (p && p.hi === o.lo && (p.hiInc || o.loInc)) { p.hi = o.hi; p.hiInc = o.hiInc; } else merged.push({ ...o });
  });
  return { intervals: merged, all: merged.length === 1 && merged[0].lo === -Infinity && merged[0].hi === Infinity, none: merged.length === 0 };
}

/* ================= STATISTICS MODE ================= */
export function oneVar(xs, freqs) {
  const fr = freqs || xs.map(() => 1); const n = sum(fr);
  if (n === 0) bad('Math ERROR');
  const sx = sum(xs.map((x, i) => x * fr[i])), sx2 = sum(xs.map((x, i) => x * x * fr[i]));
  const mean = sx / n; const pv = sx2 / n - mean * mean;
  const sigma = Math.sqrt(Math.max(0, pv)); const s = n > 1 ? Math.sqrt(Math.max(0, (sx2 - n * mean * mean) / (n - 1))) : NaN;
  const expanded = []; xs.forEach((x, i) => { for (let k = 0; k < fr[i]; k++) expanded.push(x); });
  expanded.sort((a, b) => a - b);
  const med = q => {
    const m = expanded.length; if (!m) return NaN;
    if (m % 2) return expanded[(m - 1) / 2]; return (expanded[m / 2 - 1] + expanded[m / 2]) / 2;
  };
  const half = expanded.length >> 1;
  const lower = expanded.slice(0, half), upper = expanded.slice(expanded.length % 2 ? half + 1 : half);
  const m2 = a => { const m = a.length; if (!m) return NaN; return m % 2 ? a[(m - 1) / 2] : (a[m / 2 - 1] + a[m / 2]) / 2; };
  return {
    n, mean, sumX: sx, sumX2: sx2, sigmaX: sigma, sX: s, minX: expanded[0], maxX: expanded[expanded.length - 1],
    Q1: m2(lower), Med: med(), Q3: m2(upper),
  };
}

const REG = {
  lin: { name: 'A+BX', terms: 2 }, quad: { name: '_+CX²', terms: 3 }, cubic: { name: '_+DX³', terms: 4 }, quart: { name: '_+EX⁴', terms: 5 },
  log: { name: 'A+B·ln X', terms: 2 }, exp: { name: 'A·e^(BX)', terms: 2 }, ab: { name: 'A·B^X', terms: 2 },
  pow: { name: 'A·X^B', terms: 2 }, inv: { name: 'A+B/X', terms: 2 },
};
export const REG_TYPES = REG;

function polyFit(xs, ys, ws, deg) {
  const m = deg + 1; const A = Array.from({ length: m }, () => Array(m).fill(0)), b = Array(m).fill(0);
  xs.forEach((x, k) => {
    const w = ws[k]; const pw = Array.from({ length: 2 * deg + 1 }, (_, p) => x ** p);
    for (let i = 0; i < m; i++) { b[i] += w * ys[k] * pw[i]; for (let j = 0; j < m; j++) A[i][j] += w * pw[i + j]; }
  });
  return solveLinear(A, b);
}
export function twoVar(xs, ys, freqs) {
  const w = freqs || xs.map(() => 1); const n = sum(w);
  const sx = sum(xs.map((x, i) => x * w[i])), sy = sum(ys.map((y, i) => y * w[i]));
  const sx2 = sum(xs.map((x, i) => x * x * w[i])), sy2 = sum(ys.map((y, i) => y * y * w[i])), sxy = sum(xs.map((x, i) => x * ys[i] * w[i]));
  const mx = sx / n, my = sy / n;
  return {
    n, meanX: mx, meanY: my, sumX: sx, sumY: sy, sumX2: sx2, sumY2: sy2, sumXY: sxy,
    sigmaX: Math.sqrt(Math.max(0, sx2 / n - mx * mx)), sigmaY: Math.sqrt(Math.max(0, sy2 / n - my * my)),
    sX: n > 1 ? Math.sqrt(Math.max(0, (sx2 - n * mx * mx) / (n - 1))) : NaN, sY: n > 1 ? Math.sqrt(Math.max(0, (sy2 - n * my * my) / (n - 1))) : NaN,
    sumX3: sum(xs.map((x, i) => x ** 3 * w[i])), sumX2Y: sum(xs.map((x, i) => x * x * ys[i] * w[i])), sumX4: sum(xs.map((x, i) => x ** 4 * w[i])),
    minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}
export function regression(type, xs, ys, freqs) {
  const w = freqs || xs.map(() => 1);
  let tx = xs, ty = ys, coef, predictY, predictX;
  const corr = (a, b) => {
    const n = sum(w), ma = sum(a.map((v, i) => v * w[i])) / n, mb = sum(b.map((v, i) => v * w[i])) / n;
    const sab = sum(a.map((v, i) => (v - ma) * (b[i] - mb) * w[i])), saa = sum(a.map((v, i) => (v - ma) ** 2 * w[i])), sbb = sum(b.map((v, i) => (v - mb) ** 2 * w[i]));
    return sab / Math.sqrt(saa * sbb);
  };
  if (type === 'lin' || type === 'log' || type === 'inv' || type === 'exp' || type === 'ab' || type === 'pow') {
    if (type === 'log') { if (xs.some(x => x <= 0)) bad(); tx = xs.map(Math.log); }
    if (type === 'inv') { if (xs.some(x => x === 0)) bad(); tx = xs.map(x => 1 / x); }
    if (type === 'exp' || type === 'ab') { if (ys.some(y => y <= 0)) bad(); ty = ys.map(Math.log); }
    if (type === 'pow') { if (xs.some(x => x <= 0) || ys.some(y => y <= 0)) bad(); tx = xs.map(Math.log); ty = ys.map(Math.log); }
    const [a0, b0] = polyFit(tx, ty, w, 1); const r = corr(tx, ty);
    if (type === 'lin') { coef = { A: a0, B: b0, r }; predictY = x => a0 + b0 * x; predictX = y => [(y - a0) / b0]; }
    if (type === 'log') { coef = { A: a0, B: b0, r }; predictY = x => a0 + b0 * Math.log(x); predictX = y => [Math.exp((y - a0) / b0)]; }
    if (type === 'inv') { coef = { A: a0, B: b0, r }; predictY = x => a0 + b0 / x; predictX = y => [b0 / (y - a0)]; }
    if (type === 'exp') { const A = Math.exp(a0); coef = { A, B: b0, r }; predictY = x => A * Math.exp(b0 * x); predictX = y => [Math.log(y / A) / b0]; }
    if (type === 'ab') { const A = Math.exp(a0), B = Math.exp(b0); coef = { A, B, r }; predictY = x => A * B ** x; predictX = y => [Math.log(y / A) / Math.log(B)]; }
    if (type === 'pow') { const A = Math.exp(a0); coef = { A, B: b0, r }; predictY = x => A * x ** b0; predictX = y => [(y / A) ** (1 / b0)]; }
  } else {
    const deg = { quad: 2, cubic: 3, quart: 4 }[type];
    if (xs.length < deg + 1) bad();
    const c = polyFit(xs, ys, w, deg); predictY = x => c.reduce((s, v, i) => s + v * x ** i, 0);
    const my = sum(ys.map((y, i) => y * w[i])) / sum(w);
    const ssr = sum(ys.map((y, i) => (predictY(xs[i]) - my) ** 2 * w[i])), sst = sum(ys.map((y, i) => (y - my) ** 2 * w[i]));
    coef = { A: c[0], B: c[1], C: c[2], D: c[3], E: c[4], R2: sst ? ssr / sst : 1 };
    predictX = y => (deg === 2 ? polyRoots([c[2], c[1], c[0] - y]).filter(r => r.im === 0).map(r => r.re) : polyRoots([...c].reverse().map((v, i, a) => (i === a.length - 1 ? v - y : v))).filter(r => r.im === 0).map(r => r.re));
  }
  Object.keys(coef).forEach(k => { if (coef[k] === undefined) delete coef[k]; else coef[k] = clean(coef[k]); });
  return { coef, predictY, predictX };
}

/* ================= DISTRIBUTION MODE ================= */
const lgam = z => {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgam(1 - z);
  z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};
export function erf(x) {
  const t = Math.abs(x); if (t < 3) { let s = t, term = t; for (let n = 1; n < 100; n++) { term *= -t * t / n; const d = term / (2 * n + 1); s += d; if (Math.abs(d) < 1e-17) break; } return Math.sign(x) * 2 / Math.sqrt(Math.PI) * s; }
  let f = 0; for (let k = 60; k >= 1; k--) f = k / 2 / (t + f);
  return Math.sign(x) * (1 - Math.exp(-t * t) / Math.sqrt(Math.PI) / (t + f));
}
export const normPdf = (x, mu = 0, s = 1) => Math.exp(-((x - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
export const normCdf = (a, b, mu = 0, s = 1) => { if (s <= 0) bad(); const F = x => 0.5 * (1 + erf((x - mu) / (s * Math.SQRT2))); return F(b) - F(a); };
export function normInv(p, mu = 0, s = 1) {
  if (p <= 0 || p >= 1 || s <= 0) bad();
  let lo = -40, hi = 40; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (0.5 * (1 + erf(m / Math.SQRT2)) < p) lo = m; else hi = m; }
  return mu + s * (lo + hi) / 2;
}
const lchoose = (n, k) => lgam(n + 1) - lgam(k + 1) - lgam(n - k + 1);
export const binPdf = (x, n, p) => { if (!Number.isInteger(x) || x < 0 || x > n || p < 0 || p > 1) bad(); if (p === 0) return x === 0 ? 1 : 0; if (p === 1) return x === n ? 1 : 0; return Math.exp(lchoose(n, x) + x * Math.log(p) + (n - x) * Math.log(1 - p)); };
export const binCdf = (x, n, p) => { let s = 0; for (let k = 0; k <= Math.min(Math.floor(x), n); k++) s += binPdf(k, n, p); return Math.min(1, s); };
export const poiPdf = (x, l) => { if (!Number.isInteger(x) || x < 0 || l <= 0) bad(); return Math.exp(x * Math.log(l) - l - lgam(x + 1)); };
export const poiCdf = (x, l) => { let s = 0; for (let k = 0; k <= Math.floor(x); k++) s += poiPdf(k, l); return Math.min(1, s); };
export function discreteInv(cdf, p, max = 100000) { if (p < 0 || p > 1) bad(); for (let k = 0; k < max; k++) if (cdf(k) >= p - 1e-14) return k; return bad(); }

/* ================= RATIO MODE ================= */
export function solveRatio(a, b, c, d) {
  // a : b = c : d ; exactly one is null
  const v = [a, b, c, d]; const idx = v.findIndex(x => x === null);
  if (idx < 0) bad();
  const [A, B, C, D] = v;
  if (idx === 0) { if (!D) bad(); return B * C / D; }
  if (idx === 1) { if (!C) bad(); return A * D / C; }
  if (idx === 2) { if (!B) bad(); return A * D / B; }
  if (!A) bad(); return B * C / A;
}

export { inverse, matMul };
