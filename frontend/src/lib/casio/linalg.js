import { CasioError } from './errors.js';

const EPS = 1e-12;
const bad = (m = 'Math ERROR') => { throw new CasioError(m); };

export const identity = n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export const transpose = a => a[0].map((_, j) => a.map(r => r[j]));
export const matMul = (a, b) => a.map(r => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));

export function det(a) {
  const n = a.length; if (n !== a[0].length) bad('Dimension ERROR');
  const m = a.map(r => [...r]); let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < EPS) return 0;
    if (p !== c) { [m[p], m[c]] = [m[c], m[p]]; d = -d; }
    d *= m[c][c];
    for (let r = c + 1; r < n; r++) { const f = m[r][c] / m[c][c]; for (let k = c; k < n; k++) m[r][k] -= f * m[c][k]; }
  }
  return Math.abs(d - Math.round(d)) < 1e-9 ? Math.round(d) : d;
}

export function inverse(a) {
  const n = a.length; if (n !== a[0].length) bad('Dimension ERROR');
  const m = a.map((r, i) => [...r, ...identity(n)[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < EPS) bad('Math ERROR');
    [m[p], m[c]] = [m[c], m[p]];
    const pv = m[c][c]; for (let k = 0; k < 2 * n; k++) m[c][k] /= pv;
    for (let r = 0; r < n; r++) if (r !== c) { const f = m[r][c]; for (let k = 0; k < 2 * n; k++) m[r][k] -= f * m[c][k]; }
  }
  return m.map(r => r.slice(n).map(v => (Math.abs(v) < 1e-13 ? 0 : v)));
}

/* Gauss-Jordan (reduced = true) or Gaussian (reduced = false) */
export function rref(a, ref = false) {
  const m = a.map(r => [...r]); const R = m.length, C = m[0].length; let lead = 0;
  for (let r = 0; r < R && lead < C; r++) {
    let i = r; while (Math.abs(m[i][lead]) < EPS) { i++; if (i === R) { i = r; lead++; if (lead === C) return clean(m); } }
    [m[i], m[r]] = [m[r], m[i]];
    const pv = m[r][lead]; m[r] = m[r].map(v => v / pv);
    for (let k = ref ? r + 1 : 0; k < R; k++) if (k !== r) { const f = m[k][lead]; m[k] = m[k].map((v, j) => v - f * m[r][j]); }
    lead++;
  }
  return clean(m);
}
const clean = m => m.map(r => r.map(v => (Math.abs(v) < 1e-12 ? 0 : v)));

/* Solve linear system A x = b (Gaussian elimination, partial pivot). Returns array or throws. */
export function solveLinear(A, b) {
  const n = A.length; const m = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) bad('No unique solution');
    [m[p], m[c]] = [m[c], m[p]];
    for (let r = c + 1; r < n; r++) { const f = m[r][c] / m[c][c]; for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k]; }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = m[i][n]; for (let j = i + 1; j < n; j++) s -= m[i][j] * x[j]; x[i] = s / m[i][i]; }
  return x;
}
