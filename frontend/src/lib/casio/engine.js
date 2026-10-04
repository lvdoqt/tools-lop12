/* ==========================================================================
   Casio fx-580VN X engine: tokenizer, parser and evaluator.
   Value types:  number | {t:'c',re,im} | {t:'m',a:[[]]} | {t:'v',a:[]} | {t:'l',a,labels}
   ========================================================================== */
import { det, inverse, rref, matMul, transpose, identity } from './linalg.js';
import { CasioError } from './errors.js';

export { CasioError };
export const fail = (m = 'Math ERROR') => { throw new CasioError(m); };
export const isNum = v => typeof v === 'number';
export const isC = v => !!v && v.t === 'c';
export const isM = v => !!v && v.t === 'm';
export const isV = v => !!v && v.t === 'v';
export const isL = v => !!v && v.t === 'l';

export const E_SYN = 'Syntax ERROR';
export const E_ARG = 'Argument ERROR';
export const E_DIM = 'Dimension ERROR';

/* ---------- Physical constants (CONST) ---------- */
export const CONSTANTS = [
  ['mp', 'Khối lượng proton', 1.672621898e-27], ['mn', 'Khối lượng neutron', 1.674927471e-27],
  ['me', 'Khối lượng electron', 9.10938356e-31], ['mmu', 'Khối lượng muon', 1.883531594e-28],
  ['a0', 'Bán kính Bohr', 5.2917721067e-11], ['h', 'Hằng số Planck', 6.626070040e-34],
  ['muN', 'Magneton hạt nhân', 5.050783699e-27], ['muB', 'Magneton Bohr', 9.274009994e-24],
  ['hbar', 'Planck rút gọn', 1.054571800e-34], ['alpha', 'Cấu trúc tinh tế', 7.2973525664e-3],
  ['re', 'Bán kính electron', 2.8179403227e-15], ['lamc', 'Bước sóng Compton', 2.4263102367e-12],
  ['gamp', 'Tỉ số từ hồi chuyển proton', 2.675221900e8], ['lamcp', 'Compton proton', 1.32140985396e-15],
  ['lamcn', 'Compton neutron', 1.31959090481e-15], ['Rinf', 'Hằng số Rydberg', 10973731.568508],
  ['u', 'Đơn vị khối lượng nguyên tử', 1.660539040e-27], ['mup', 'Mômen từ proton', 1.4106067873e-26],
  ['mue', 'Mômen từ electron', -9.28476466e-24], ['mun', 'Mômen từ neutron', -9.6623650e-27],
  ['mumu', 'Mômen từ muon', -4.49044826e-26], ['F', 'Hằng số Faraday', 96485.33289],
  ['qe', 'Điện tích nguyên tố', 1.6021766208e-19], ['NA', 'Số Avogadro', 6.022140857e23],
  ['k', 'Hằng số Boltzmann', 1.38064852e-23], ['Vm', 'Thể tích mol khí lí tưởng', 0.022710947],
  ['R', 'Hằng số khí', 8.3144598], ['c0', 'Tốc độ ánh sáng', 299792458],
  ['c1', 'Hằng số bức xạ thứ nhất', 3.741771790e-16], ['c2', 'Hằng số bức xạ thứ hai', 1.43877736e-2],
  ['sigma', 'Stefan–Boltzmann', 5.670367e-8], ['eps0', 'Hằng số điện', 8.854187817e-12],
  ['mu0', 'Hằng số từ', 1.2566370614e-6], ['Phi0', 'Lượng tử từ thông', 2.067833831e-15],
  ['g', 'Gia tốc trọng trường', 9.80665], ['G0', 'Lượng tử độ dẫn', 7.7480917310e-5],
  ['Z0', 'Trở kháng chân không', 376.730313461], ['t', 'Nhiệt độ 0°C (K)', 273.15],
  ['G', 'Hằng số hấp dẫn', 6.67408e-11], ['atm', 'Áp suất khí quyển', 101325],
].map(([id, name, value]) => ({ id, name, value }));
const CONST_MAP = Object.fromEntries(CONSTANTS.map(c => [c.id, c.value]));

/* ---------- Unit conversion (CONV) ---------- */
export const CONV_GROUPS = [
  { title: 'Chiều dài', items: [['in', 'cm', 2.54], ['cm', 'in', 1 / 2.54], ['ft', 'm', 0.3048], ['m', 'ft', 1 / 0.3048], ['yd', 'm', 0.9144], ['m', 'yd', 1 / 0.9144], ['mile', 'km', 1.609344], ['km', 'mile', 1 / 1.609344], ['nmi', 'm', 1852], ['m', 'nmi', 1 / 1852]] },
  { title: 'Diện tích', items: [['acre', 'sqm', 4046.8564224], ['sqm', 'acre', 1 / 4046.8564224], ['ha', 'sqm', 10000], ['sqm', 'ha', 1 / 10000]] },
  { title: 'Thể tích', items: [['gal_us', 'l', 3.785411784], ['l', 'gal_us', 1 / 3.785411784], ['gal_uk', 'l', 4.54609], ['l', 'gal_uk', 1 / 4.54609]] },
  { title: 'Khối lượng', items: [['oz', 'g', 28.349523125], ['g', 'oz', 1 / 28.349523125], ['lb', 'kg', 0.45359237], ['kg', 'lb', 1 / 0.45359237]] },
  { title: 'Vận tốc', items: [['km_h', 'm_s', 1 / 3.6], ['m_s', 'km_h', 3.6], ['mile_h', 'km_h', 1.609344], ['km_h', 'mile_h', 1 / 1.609344]] },
  { title: 'Áp suất', items: [['atm', 'Pa', 101325], ['Pa', 'atm', 1 / 101325], ['mmHg', 'Pa', 133.322387415], ['Pa', 'mmHg', 1 / 133.322387415], ['kgf_cm_sq', 'Pa', 98066.5], ['Pa', 'kgf_cm_sq', 1 / 98066.5]] },
  { title: 'Năng lượng', items: [['J', 'cal', 1 / 4.1868], ['cal', 'J', 4.1868], ['kWh', 'J', 3.6e6], ['J', 'kWh', 1 / 3.6e6]] },
  { title: 'Công suất', items: [['hp', 'kW', 0.74569987158], ['kW', 'hp', 1 / 0.74569987158]] },
  { title: 'Nhiệt độ', items: [['F', 'C', null], ['C', 'F', null], ['Kel', 'C', null], ['C', 'Kel', null]] },
];
const CONV_FN = {};
CONV_GROUPS.forEach(g => g.items.forEach(([a, b, f]) => {
  const name = `${a}_${b}`;
  if (f !== null) CONV_FN[name] = x => x * f;
}));
CONV_FN.F_C = x => (x - 32) * 5 / 9; CONV_FN.C_F = x => x * 9 / 5 + 32;
CONV_FN.Kel_C = x => x - 273.15; CONV_FN.C_Kel = x => x + 273.15;

/* ---------- Complex helpers ---------- */
const simp = (re, im) => {
  if (!Number.isFinite(re) || !Number.isFinite(im)) fail();
  if (Math.abs(re) <= 1e-14 * Math.max(1, Math.abs(im))) re = 0;
  if (Math.abs(im) <= 1e-12 * Math.max(1, Math.abs(re))) return re;
  return { t: 'c', re, im };
};
const simpc = c => simp(c.re, c.im);
const cv = v => (isNum(v) ? { re: v, im: 0 } : v);
const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
const csub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv = (a, b) => {
  const d = b.re * b.re + b.im * b.im; if (d === 0) fail();
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const cabs = a => Math.hypot(a.re, a.im);
const carg = a => Math.atan2(a.im, a.re);
const cexp = a => { const m = Math.exp(a.re); return { re: m * Math.cos(a.im), im: m * Math.sin(a.im) }; };
const cln = a => { if (a.re === 0 && a.im === 0) fail(); return { re: Math.log(cabs(a)), im: carg(a) }; };
const csqrt = a => { const r = cabs(a); const re = Math.sqrt((r + a.re) / 2); let im = Math.sqrt(Math.max(0, (r - a.re) / 2)); if (a.im < 0) im = -im; return { re, im }; };
const cpowC = (a, b) => { if (a.re === 0 && a.im === 0) { if (b.re > 0) return { re: 0, im: 0 }; fail(); } return cexp(cmul(b, cln(a))); };
const cpowInt = (a, n) => {
  if (n < 0) return cdiv({ re: 1, im: 0 }, cpowInt(a, -n));
  let r = { re: 1, im: 0 }, b = a;
  while (n > 0) { if (n & 1) r = cmul(r, b); b = cmul(b, b); n >>= 1; }
  return r;
};
const csin = a => ({ re: Math.sin(a.re) * Math.cosh(a.im), im: Math.cos(a.re) * Math.sinh(a.im) });
const ccos = a => ({ re: Math.cos(a.re) * Math.cosh(a.im), im: -Math.sin(a.re) * Math.sinh(a.im) });
const csinh = a => ({ re: Math.sinh(a.re) * Math.cos(a.im), im: Math.cosh(a.re) * Math.sin(a.im) });
const ccosh = a => ({ re: Math.cosh(a.re) * Math.cos(a.im), im: Math.sinh(a.re) * Math.sin(a.im) });
const casin = z => cmul({ re: 0, im: -1 }, cln(cadd({ re: -z.im, im: z.re }, csqrt(csub({ re: 1, im: 0 }, cmul(z, z))))));
const cacos = z => csub({ re: Math.PI / 2, im: 0 }, casin(z));
const catan = z => cmul({ re: 0, im: -0.5 }, cln(cdiv(cadd({ re: 1, im: 0 }, { re: -z.im, im: z.re }), csub({ re: 1, im: 0 }, { re: -z.im, im: z.re }))));

/* ---------- Angles ---------- */
const toRad = (x, ctx) => (ctx.angle === 'deg' ? x * Math.PI / 180 : ctx.angle === 'gra' ? x * Math.PI / 200 : x);
const fromRad = (x, ctx) => (ctx.angle === 'deg' ? x * 180 / Math.PI : ctx.angle === 'gra' ? x * 200 / Math.PI : x);
const snap = x => (Math.abs(x) < 1e-15 ? 0 : x);

const ratioOf = x => { // find p/q (q<=99) for x
  for (let q = 1; q <= 99; q++) { const p = Math.round(x * q); if (Math.abs(x - p / q) < 1e-12) return { p, q }; }
  return null;
};

/* ---------- Arithmetic on values ---------- */
const int32 = x => Number(BigInt.asIntN(32, BigInt(Math.trunc(x))));
const mapM = (m, f) => ({ t: 'm', a: m.a.map(r => r.map(f)) });
const dims = m => [m.a.length, m.a[0].length];

function addV(a, b, s) {
  if (isNum(a) && isNum(b)) return a + s * b;
  if (isM(a) && isM(b)) {
    const [r1, c1] = dims(a), [r2, c2] = dims(b); if (r1 !== r2 || c1 !== c2) fail(E_DIM);
    return { t: 'm', a: a.a.map((r, i) => r.map((v, j) => v + s * b.a[i][j])) };
  }
  if (isV(a) && isV(b)) { if (a.a.length !== b.a.length) fail(E_DIM); return { t: 'v', a: a.a.map((v, i) => v + s * b.a[i]) }; }
  if ((isNum(a) || isC(a)) && (isNum(b) || isC(b))) { const x = cv(a), y = cv(b); return simp(x.re + s * y.re, x.im + s * y.im); }
  return fail(E_SYN);
}
function cross(a, b) {
  if (a.a.length !== 3 || b.a.length !== 3) fail(E_DIM);
  const [a1, a2, a3] = a.a, [b1, b2, b3] = b.a;
  return { t: 'v', a: [a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1] };
}
function mulV(a, b) {
  if (isNum(a) && isNum(b)) return a * b;
  if (isM(a) && isM(b)) { if (a.a[0].length !== b.a.length) fail(E_DIM); return { t: 'm', a: matMul(a.a, b.a) }; }
  if (isNum(a) && isM(b)) return mapM(b, v => a * v);
  if (isM(a) && isNum(b)) return mapM(a, v => b * v);
  if (isNum(a) && isV(b)) return { t: 'v', a: b.a.map(v => a * v) };
  if (isV(a) && isNum(b)) return { t: 'v', a: a.a.map(v => b * v) };
  if (isV(a) && isV(b)) return cross(a, b);
  if ((isNum(a) || isC(a)) && (isNum(b) || isC(b))) return simpc(cmul(cv(a), cv(b)));
  return fail(E_SYN);
}
function divV(a, b) {
  if (isNum(a) && isNum(b)) { if (b === 0) fail(); return a / b; }
  if (isM(a) && isNum(b)) { if (b === 0) fail(); return mapM(a, v => v / b); }
  if (isV(a) && isNum(b)) { if (b === 0) fail(); return { t: 'v', a: a.a.map(v => v / b) }; }
  if ((isNum(a) || isC(a)) && (isNum(b) || isC(b))) return simpc(cdiv(cv(a), cv(b)));
  return fail(E_SYN);
}
function powV(a, b, ctx) {
  if (isNum(a) && isNum(b)) {
    if (a === 0 && b <= 0) fail();
    if (a < 0 && !Number.isInteger(b)) {
      const fr = ratioOf(b);
      if (fr && fr.q % 2 === 1) { const r = Math.pow(-a, b); return fr.p % 2 === 0 ? r : -r; }
      if (ctx.complex) return simpc(cpowC(cv(a), cv(b)));
      fail();
    }
    const r = Math.pow(a, b); if (!Number.isFinite(r)) fail(); return r;
  }
  if (isM(a) && isNum(b) && Number.isInteger(b)) {
    const [r, c] = dims(a); if (r !== c) fail(E_DIM);
    if (b === 0) return { t: 'm', a: identity(r) };
    let base = a.a; if (b < 0) base = inverse(base);
    let res = base; for (let i = 1; i < Math.abs(b); i++) res = matMul(res, base);
    return { t: 'm', a: res };
  }
  if ((isNum(a) || isC(a)) && (isNum(b) || isC(b))) {
    if (isNum(b) && Number.isInteger(b) && Math.abs(b) <= 100) return simpc(cpowInt(cv(a), b));
    return simpc(cpowC(cv(a), cv(b)));
  }
  return fail(E_SYN);
}
const negV = a => {
  if (isNum(a)) return -a; if (isC(a)) return simp(-a.re, -a.im);
  if (isM(a)) return mapM(a, v => -v); if (isV(a)) return { t: 'v', a: a.a.map(v => -v) };
  return fail(E_SYN);
};

/* ---------- Tokenizer ---------- */
const NAME_OPS = new Set(['and', 'or', 'xor', 'xnor', 'nCr', 'nPr']);
const UNITS = new Set(['deg', 'rad', 'gra']);
const LAZY = new Set(['int', 'diff', 'sum', 'prod']);
const SINGLE_VARS = 'ABCDEFMxy';

export function tokenize(srcIn, ctx, isKnown) {
  const src = srcIn.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt').replace(/′/g, "'").replace(/″/g, '"').replace(/∫/g, 'int').replace(/Σ/g, 'sum');
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    if (/^\s/.test(rest)) { i++; continue; }
    let m;
    if (ctx.base && (m = rest.match(/^[0-9A-F]+/)) && !/^(Ans)/.test(rest) && !/^[a-z]/.test(rest)) {
      const digits = m[0];
      const valid = '0123456789ABCDEF'.slice(0, ctx.base);
      if ([...digits].some(d => !valid.includes(d))) fail(E_SYN);
      toks.push({ t: 'num', v: parseInt(digits, ctx.base) }); i += digits.length; continue;
    }
    if (!ctx.base && (m = rest.match(/^(\d+\.?\d*|\.\d+)/))) { toks.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; continue; }
    if ((m = rest.match(/^(Ran#|K_[A-Za-z0-9]+|[A-Za-z_]+)/))) {
      let name = m[0];
      while (name.length) {
        if (isKnown(name)) { toks.push({ t: 'name', v: name }); i += name.length; break; }
        let cut = name.length - 1;
        while (cut > 0 && !isKnown(name.slice(0, cut))) cut--;
        if (cut === 0) fail(E_SYN);
        toks.push({ t: 'name', v: name.slice(0, cut) }); i += cut; name = name.slice(cut);
      }
      continue;
    }
    const ch = src[i];
    if ('+-*/^(),!%=∠°\'"<>'.includes(ch)) { toks.push({ t: 'op', v: ch }); i++; continue; }
    fail(E_SYN);
  }
  return toks;
}

/* ---------- Parser ---------- */
export function parse(tokens, isFn) {
  let p = 0;
  const peek = (o = 0) => tokens[p + o];
  const next = () => tokens[p++];
  const isOp = (t, v) => !!t && t.t === 'op' && t.v === v;
  const isNm = (t, v) => !!t && t.t === 'name' && (v === undefined || t.v === v);
  const starts = t => !!t && (t.t === 'num' || (t.t === 'name' && !NAME_OPS.has(t.v) && !UNITS.has(t.v)) || isOp(t, '('));

  function parseLogic() {
    let l = parseAnd();
    while (peek() && peek().t === 'name' && ['or', 'xor', 'xnor'].includes(peek().v)) { const op = next().v; l = { t: 'bin', op, l, r: parseAnd() }; }
    return l;
  }
  function parseAnd() {
    let l = parseAdd();
    while (isNm(peek(), 'and')) { next(); l = { t: 'bin', op: 'and', l, r: parseAdd() }; }
    return l;
  }
  function parseAdd() {
    let l = parseTerm();
    while (isOp(peek(), '+') || isOp(peek(), '-')) { const op = next().v; l = { t: 'bin', op, l, r: parseTerm() }; }
    return l;
  }
  function parseTerm() {
    let l = parseAngle();
    while (isOp(peek(), '*') || isOp(peek(), '/')) { const op = next().v; l = { t: 'bin', op, l, r: parseAngle() }; }
    return l;
  }
  function parseAngle() {
    let l = parseNc();
    while (isOp(peek(), '∠')) { next(); l = { t: 'bin', op: '∠', l, r: parseNc() }; }
    return l;
  }
  function parseNc() {
    let l = parseImp();
    while (isNm(peek(), 'nCr') || isNm(peek(), 'nPr')) { const op = next().v; l = { t: 'bin', op, l, r: parseImp() }; }
    return l;
  }
  function parseImp() {
    let l = parseSigned();
    while (starts(peek())) l = { t: 'bin', op: '*', l, r: parsePower() };
    return l;
  }
  function parseSigned() {
    if (isOp(peek(), '-')) { next(); return { t: 'neg', v: parseSigned() }; }
    if (isOp(peek(), '+')) { next(); return parseSigned(); }
    return parsePower();
  }
  function parsePower() {
    const base = parsePostfix();
    if (isOp(peek(), '^')) { next(); return { t: 'bin', op: '^', l: base, r: parseSigned() }; }
    return base;
  }
  function parsePostfix() {
    let v = parsePrimary();
    for (;;) {
      if (isOp(peek(), '!')) { next(); v = { t: 'fact', v }; }
      else if (isOp(peek(), '%')) { next(); v = { t: 'pct', v }; }
      else if (peek() && peek().t === 'name' && UNITS.has(peek().v)) { v = { t: 'unit', v, unit: next().v }; }
      else break;
    }
    return v;
  }
  function parsePrimary() {
    const t = next();
    if (!t) fail(E_SYN);
    if (t.t === 'num') {
      if (isOp(peek(), '°')) {
        next(); let min = 0, sec = 0;
        if (peek() && peek().t === 'num' && isOp(peek(1), "'")) {
          min = next().v; next();
          if (peek() && peek().t === 'num' && isOp(peek(1), '"')) { sec = next().v; next(); }
        }
        return { t: 'dms', v: t.v + min / 60 + sec / 3600 };
      }
      return { t: 'num', v: t.v };
    }
    if (isOp(t, '(')) {
      const e = parseLogic();
      if (isOp(peek(), ')')) next(); else if (peek()) fail(E_SYN);
      return e;
    }
    if (t.t === 'name') {
      if (isFn(t.v) && isOp(peek(), '(')) {
        next(); const args = [];
        if (isOp(peek(), ')')) next();
        else {
          for (;;) {
            args.push(parseLogic());
            if (isOp(peek(), ',')) { next(); continue; }
            if (isOp(peek(), ')')) next(); else if (peek()) fail(E_SYN);
            break;
          }
        }
        return { t: 'call', name: t.v, args };
      }
      if (isFn(t.v) && !(t.v === 'Ran#')) fail(E_SYN);
      return { t: 'var', name: t.v };
    }
    return fail(E_SYN);
  }

  const left = parseLogic();
  let ast = left;
  if (isOp(peek(), '=')) { next(); ast = { t: 'eq', l: left, r: parseLogic() }; }
  if (p < tokens.length) fail(E_SYN);
  return ast;
}

/* ---------- Numeric helpers ---------- */
const fact = n => {
  if (!Number.isInteger(n) || n < 0 || n > 69) fail();
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
};
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
const needInt = x => { if (!isNum(x) || !Number.isInteger(x)) fail(E_ARG); return x; };
const nCr = (n, r) => {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) fail();
  r = Math.min(r, n - r); let res = 1;
  for (let i = 1; i <= r; i++) res = res * (n - r + i) / i;
  return Math.round(res);
};
const nPr = (n, r) => {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) fail();
  let res = 1; for (let i = 0; i < r; i++) res *= (n - i); return res;
};

const SUPERS = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const toSup = p => String(p).split('').map(d => SUPERS[d] || d).join('');

export function primeFactors(n) {
  if (!Number.isInteger(n) || n <= 1) return String(n);
  let rest = n;
  const parts = [];
  for (let p = 2; p * p <= rest; p = p === 2 ? 3 : p + 2) {
    if (rest % p === 0) {
      let count = 0;
      while (rest % p === 0) { count++; rest /= p; }
      parts.push(count === 1 ? `${p}` : `${p}${toSup(count)}`);
    }
  }
  if (rest > 1) parts.push(`${rest}`);
  return parts.join('×');
}

const GK_X = [0.991455371120812639, 0.949107912342758525, 0.864864423359769073, 0.741531185599394440, 0.586087235467691130, 0.405845151377397167, 0.207784955007898468, 0];
const GK_W = [0.022935322010529225, 0.063092092629978553, 0.104790010322250184, 0.140653259715525919, 0.169004726639267903, 0.190350578064785410, 0.204432940075298892, 0.209482141084727828];
const G_W = [0.129484966168869693, 0.279705391489276668, 0.381830050505118945, 0.417959183673469388];

function gk15(f, a, b) {
  const c = (a + b) / 2, h = (b - a) / 2;
  const fc = f(c);
  let k = fc * GK_W[7], g = fc * G_W[3];
  for (let j = 0; j < 7; j++) {
    const x = h * GK_X[j];
    const s = f(c - x) + f(c + x);
    k += GK_W[j] * s;
    if (j % 2 === 1) g += G_W[(j - 1) / 2] * s;
  }
  return { v: k * h, err: Math.abs((k - g) * h) };
}
export function integrate(f, a, b) {
  if (a === b) return 0;
  const sign = a > b ? -1 : 1; if (a > b) [a, b] = [b, a];
  let parts = [{ a, b, ...gk15(f, a, b) }];
  for (let it = 0; it < 400; it++) {
    const total = parts.reduce((s, p) => s + p.v, 0);
    const err = parts.reduce((s, p) => s + p.err, 0);
    if (err <= 1e-11 * Math.max(1, Math.abs(total))) break;
    let worst = 0; parts.forEach((p, i) => { if (p.err > parts[worst].err) worst = i; });
    const p = parts[worst]; const m = (p.a + p.b) / 2;
    parts.splice(worst, 1, { a: p.a, b: m, ...gk15(f, p.a, m) }, { a: m, b: p.b, ...gk15(f, m, p.b) });
  }
  const total = parts.reduce((s, p) => s + p.v, 0);
  if (!Number.isFinite(total)) fail();
  return sign * total;
}
function derivative(func, x) {
  let h = Math.max(Math.abs(x) * 0.05, 0.05);
  const con = 1.4, con2 = con * con, ntab = 10, safe = 2;
  const a = Array.from({ length: ntab }, () => Array(ntab).fill(0));
  a[0][0] = (func(x + h) - func(x - h)) / (2 * h);
  let err = 1e30, ans = a[0][0];
  for (let i = 1; i < ntab; i++) {
    h /= con; a[0][i] = (func(x + h) - func(x - h)) / (2 * h); let fac = con2;
    for (let j = 1; j <= i; j++) {
      a[j][i] = (a[j - 1][i] * fac - a[j - 1][i - 1]) / (fac - 1); fac *= con2;
      const errt = Math.max(Math.abs(a[j][i] - a[j - 1][i]), Math.abs(a[j][i] - a[j - 1][i - 1]));
      if (errt <= err) { err = errt; ans = a[j][i]; }
    }
    if (Math.abs(a[i][i] - a[i - 1][i - 1]) >= safe * err) break;
  }
  if (!Number.isFinite(ans)) fail();
  return ans;
}

/* ---------- Function table ---------- */
const FN = {};
const def = (names, f) => names.split(' ').forEach(n => { FN[n] = f; });
const real = (v, msg = E_ARG) => { if (!isNum(v)) fail(msg); return v; };
const mapc = (a, rf, cf) => (isNum(a) ? rf(a) : isC(a) ? simpc(cf(a)) : fail(E_ARG));

def('sin', ([a], ctx) => mapc(a, x => snap(Math.sin(toRad(x, ctx))), csin));
def('cos', ([a], ctx) => mapc(a, x => snap(Math.cos(toRad(x, ctx))), ccos));
def('tan', ([a], ctx) => mapc(a, x => {
  const r = toRad(x, ctx); const c = snap(Math.cos(r)); if (c === 0) fail(); return snap(Math.sin(r)) / c;
}, z => cdiv(csin(z), ccos(z))));
def('asin', ([a], ctx) => mapc(a, x => {
  if (x < -1 || x > 1) { if (ctx.complex) return simpc(casin({ re: x, im: 0 })); fail(); } return fromRad(Math.asin(x), ctx);
}, casin));
def('acos', ([a], ctx) => mapc(a, x => {
  if (x < -1 || x > 1) { if (ctx.complex) return simpc(cacos({ re: x, im: 0 })); fail(); } return fromRad(Math.acos(x), ctx);
}, cacos));
def('atan', ([a], ctx) => mapc(a, x => fromRad(Math.atan(x), ctx), catan));
def('sinh', ([a]) => mapc(a, Math.sinh, csinh));
def('cosh', ([a]) => mapc(a, Math.cosh, ccosh));
def('tanh', ([a]) => mapc(a, Math.tanh, z => cdiv(csinh(z), ccosh(z))));
def('asinh', ([a]) => Math.asinh(real(a)));
def('acosh', ([a]) => { if (real(a) < 1) fail(); return Math.acosh(a); });
def('atanh', ([a]) => { if (Math.abs(real(a)) >= 1) fail(); return Math.atanh(a); });
def('ln', ([a], ctx) => mapc(a, x => { if (x <= 0) { if (ctx.complex && x < 0) return simpc(cln({ re: x, im: 0 })); fail(); } return Math.log(x); }, cln));
def('log', ([a], ctx) => mapc(a, x => { if (x <= 0) { if (ctx.complex && x < 0) return simpc({ re: Math.log(-x) / Math.LN10, im: Math.PI / Math.LN10 }); fail(); } return snapLog(Math.log10(x)); }, z => { const l = cln(z); return { re: l.re / Math.LN10, im: l.im / Math.LN10 }; }));
const snapLog = v => { const r = Math.round(v); return Math.abs(v - r) < 1e-14 ? r : v; };
def('logb', ([b, x]) => { real(b); real(x); if (b <= 0 || b === 1 || x <= 0) fail(); return snapLog(Math.log(x) / Math.log(b)); });
def('exp', ([a]) => mapc(a, Math.exp, cexp));
def('sqrt', ([a], ctx) => mapc(a, x => { if (x < 0) { if (ctx.complex) return simp(0, Math.sqrt(-x)); fail(); } return Math.sqrt(x); }, csqrt));
def('cbrt', ([a]) => Math.cbrt(real(a)));
def('root', ([n, x], ctx) => {
  real(n); real(x); if (n === 0) fail();
  if (x < 0) { if (Number.isInteger(n) && n % 2 !== 0) return -Math.pow(-x, 1 / n); if (ctx.complex) return simpc(cpowC({ re: x, im: 0 }, { re: 1 / n, im: 0 })); fail(); }
  const r = Math.pow(x, 1 / n); const rr = Math.round(r); return Math.abs(r - rr) < 1e-12 && Math.abs(Math.pow(rr, n) - x) < 1e-9 * Math.max(1, Math.abs(x)) ? rr : r;
});
def('abs Abs', ([a]) => {
  if (isNum(a)) return Math.abs(a); if (isC(a)) return cabs(a);
  if (isV(a)) return Math.hypot(...a.a); if (isM(a)) return mapM(a, Math.abs);
  return fail(E_ARG);
});
def('arg', ([a], ctx) => fromRad(isNum(a) ? (a >= 0 ? 0 : Math.PI) : carg(a), ctx));
def('Conjg', ([a]) => (isNum(a) ? a : simp(a.re, -a.im)));
def('Re', ([a]) => (isNum(a) ? a : a.re));
def('Im', ([a]) => (isNum(a) ? 0 : a.im));
def('sign', ([a]) => Math.sign(real(a)));
def('Int', ([a]) => Math.trunc(real(a)));
def('Intg floor', ([a]) => Math.floor(real(a)));
def('ceil', ([a]) => Math.ceil(real(a)));
def('Rnd', ([a], ctx) => {
  real(a); const f = ctx.fmt || {};
  if (f.fixN != null) return Number(a.toFixed(f.fixN));
  if (f.sciN != null) return Number(a.toPrecision(f.sciN));
  return Number(a.toPrecision(10));
});
def('Rmdr', ([a, b]) => { if (real(b) === 0) fail(); return a % b; });
def('Quot', ([a, b]) => { if (real(b) === 0) fail(); return Math.trunc(a / b); });
def('GCD', args => args.map(needInt).reduce(gcd));
def('LCM', args => args.map(needInt).reduce((a, b) => (a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcd(a, b))));
def('fact', ([a]) => fact(real(a)));
def('Ran#', () => Math.floor(Math.random() * 1000) / 1000);
def('RanInt', ([a, b]) => { needInt(a); needInt(b); if (a > b) fail(E_ARG); return a + Math.floor(Math.random() * (b - a + 1)); });
def('Pol', ([x, y], ctx) => {
  real(x); real(y); const r = Math.hypot(x, y), th = fromRad(Math.atan2(y, x), ctx);
  ctx.vars.x = r; ctx.vars.y = th;
  return { t: 'l', a: [r, th], labels: ['r', 'θ'] };
});
def('Rec', ([r, th], ctx) => {
  real(r); real(th); const a = toRad(th, ctx);
  const x = snap(r * Math.cos(a)), y = snap(r * Math.sin(a));
  ctx.vars.x = x; ctx.vars.y = y;
  return { t: 'l', a: [x, y], labels: ['x', 'y'] };
});
def('not', ([a]) => int32(~int32(real(a))));
def('neg', ([a]) => int32(-real(a)));
def('shl', ([a, n]) => int32(real(a) * Math.pow(2, real(n))));
def('shr', ([a, n]) => Math.floor(int32(real(a)) / Math.pow(2, real(n))));
/* matrix & vector */
const needM = a => { if (!isM(a)) fail(E_ARG); return a; };
def('det', ([a]) => det(needM(a).a));
def('Trn', ([a]) => (isV(a) ? { t: 'm', a: a.a.map(v => [v]) } : { t: 'm', a: transpose(needM(a).a) }));
def('Inv', ([a]) => ({ t: 'm', a: inverse(needM(a).a) }));
def('Identity', ([n]) => { needInt(n); if (n < 1 || n > 4) fail(E_ARG); return { t: 'm', a: identity(n) }; });
def('Rref', ([a]) => ({ t: 'm', a: rref(needM(a).a) }));
def('Ref', ([a]) => ({ t: 'm', a: rref(needM(a).a, true) }));
def('Dot', ([a, b]) => { if (!isV(a) || !isV(b) || a.a.length !== b.a.length) fail(E_DIM); return a.a.reduce((s, v, i) => s + v * b.a[i], 0); });
def('Cross', ([a, b]) => { if (!isV(a) || !isV(b)) fail(E_ARG); return cross(a, b); });
def('Angle', ([a, b], ctx) => {
  if (!isV(a) || !isV(b) || a.a.length !== b.a.length) fail(E_DIM);
  const na = Math.hypot(...a.a), nb = Math.hypot(...b.a); if (!na || !nb) fail();
  const c = a.a.reduce((s, v, i) => s + v * b.a[i], 0) / (na * nb);
  return fromRad(Math.acos(Math.max(-1, Math.min(1, c))), ctx);
});
def('UnitV', ([a]) => { if (!isV(a)) fail(E_ARG); const n = Math.hypot(...a.a); if (!n) fail(); return { t: 'v', a: a.a.map(v => v / n) }; });
/* statistics regression (set by the page) */
def('yhat', ([x], ctx) => { if (!ctx.reg) fail(); return ctx.reg.predictY(real(x)); });
def('xhat', ([y], ctx) => { if (!ctx.reg) fail(); return ctx.reg.predictX(real(y))[0]; });
def('xhat2', ([y], ctx) => { if (!ctx.reg) fail(); const r = ctx.reg.predictX(real(y)); if (r.length < 2) fail(); return r[1]; });
Object.keys(CONV_FN).forEach(n => { FN[n] = ([a]) => CONV_FN[n](real(a)); });

export const FUNCTION_NAMES = new Set([...Object.keys(FN), ...LAZY]);
const isFnName = n => FUNCTION_NAMES.has(n) && n !== 'Ran#';

/* ---------- Evaluator ---------- */
function lookup(name, ctx) {
  switch (name) {
    case 'pi': return Math.PI;
    case 'e': return Math.E;
    case 'Ans': return ctx.ans === undefined ? 0 : ctx.ans;
    case 'Ran#': return FN['Ran#']([], ctx);
    case 'i': if (ctx.complex) return { t: 'c', re: 0, im: 1 }; return fail(E_SYN);
    default:
  }
  if (name.startsWith('K_')) { const v = CONST_MAP[name.slice(2)]; if (v === undefined) fail(E_SYN); return v; }
  if (name in ctx.vars) return ctx.vars[name];
  return fail(E_SYN);
}
const KEYWORDS = ['pi', 'e', 'Ans', 'Ran#', 'nCr', 'nPr', 'and', 'or', 'xor', 'xnor', 'deg', 'rad', 'gra'];
export const makeKnown = ctx => name => KEYWORDS.includes(name) || isFnName(name) || name.startsWith('K_') || name in ctx.vars || ['k', 'n', 'j'].includes(name) || (name === 'i' && !!ctx.complex);

export function evalNode(n, ctx) {
  switch (n.t) {
    case 'num': return n.v;
    case 'dms': return ctx.angle === 'rad' ? n.v * Math.PI / 180 : ctx.angle === 'gra' ? n.v * 10 / 9 : n.v;
    case 'var': return lookup(n.name, ctx);
    case 'neg': return negV(evalNode(n.v, ctx));
    case 'fact': return fact(real(evalNode(n.v, ctx)));
    case 'pct': return real(evalNode(n.v, ctx)) / 100;
    case 'unit': {
      const x = real(evalNode(n.v, ctx)); const rad = n.unit === 'rad' ? x : n.unit === 'gra' ? x * Math.PI / 200 : x * Math.PI / 180;
      return fromRad(rad, ctx);
    }
    case 'bin': return evalBin(n, ctx);
    case 'call': return evalCall(n, ctx);
    case 'eq': return fail(E_SYN);
    default: return fail(E_SYN);
  }
}
function evalBin(n, ctx) {
  const a = evalNode(n.l, ctx), b = evalNode(n.r, ctx);
  if (ctx.base) {
    const x = real(a), y = real(b);
    switch (n.op) {
      case '+': return int32(x + y); case '-': return int32(x - y);
      case '*': return Number(BigInt.asIntN(32, BigInt(x) * BigInt(y)));
      case '/': if (y === 0) fail(); return int32(Math.trunc(x / y));
      case 'and': return int32(x & y); case 'or': return int32(x | y);
      case 'xor': return int32(x ^ y); case 'xnor': return int32(~(x ^ y));
      default: return fail(E_SYN);
    }
  }
  switch (n.op) {
    case '+': return addV(a, b, 1);
    case '-': return addV(a, b, -1);
    case '*': return mulV(a, b);
    case '/': return divV(a, b);
    case '^': return powV(a, b, ctx);
    case 'nCr': return nCr(real(a), real(b));
    case 'nPr': return nPr(real(a), real(b));
    case '∠': { const r = real(a), th = toRad(real(b), ctx); return simp(r * Math.cos(th), r * Math.sin(th)); }
    default: return fail(E_SYN);
  }
}
function evalCall(n, ctx) {
  if (LAZY.has(n.name)) return evalLazy(n, ctx);
  const args = n.args.map(a => evalNode(a, ctx));
  return FN[n.name](args, ctx);
}
function withVar(ctx, name, fn) {
  const had = Object.prototype.hasOwnProperty.call(ctx.vars, name); const old = ctx.vars[name];
  try { return fn(); } finally { if (had) ctx.vars[name] = old; else delete ctx.vars[name]; }
}
function evalLazy(n, ctx) {
  const A = n.args;
  const f = (node, name = 'x') => v => { ctx.vars[name] = v; const r = evalNode(node, ctx); if (!isNum(r)) fail(E_ARG); return r; };
  if (n.name === 'int') {
    if (A.length < 3) fail(E_ARG);
    const lo = real(evalNode(A[1], ctx)), hi = real(evalNode(A[2], ctx));
    return withVar(ctx, 'x', () => integrate(f(A[0]), lo, hi));
  }
  if (n.name === 'diff') {
    if (A.length < 2) fail(E_ARG);
    const x0 = real(evalNode(A[1], ctx));
    return withVar(ctx, 'x', () => derivative(f(A[0]), x0));
  }
  if (A.length < 4 || A[1].t !== 'var') fail(E_ARG);
  const name = A[1].name, lo = needInt(real(evalNode(A[2], ctx))), hi = needInt(real(evalNode(A[3], ctx)));
  if (hi - lo > 1e6) fail(E_ARG);
  return withVar(ctx, name, () => {
    let acc = n.name === 'sum' ? 0 : 1; const g = f(A[0], name);
    for (let k = lo; k <= hi; k++) acc = n.name === 'sum' ? acc + g(k) : acc * g(k);
    if (!Number.isFinite(acc)) fail(); return acc;
  });
}

/* ---------- Public API ---------- */
export function compile(src, ctx) {
  const toks = tokenize(src, ctx, makeKnown(ctx));
  if (!toks.length) fail(E_SYN);
  return parse(toks, isFnName);
}
export function evaluate(src, ctx) {
  const ast = compile(src, ctx);
  if (ast.t === 'eq') {
    const l = evalNode(ast.l, ctx), r = evalNode(ast.r, ctx);
    const ok = isNum(l) && isNum(r) ? Math.abs(l - r) <= 1e-9 * Math.max(1, Math.abs(l), Math.abs(r)) : JSON.stringify(l) === JSON.stringify(r);
    return { t: 'bool', v: ok, l, r };
  }
  const v = evalNode(ast, ctx);
  if (isNum(v) && !Number.isFinite(v)) fail();
  return v;
}
export function freeVariables(src, ctx) {
  const ast = compile(src, ctx); const set = new Set();
  const walk = n => {
    if (!n) return;
    if (n.t === 'var' && n.name.length === 1 && SINGLE_VARS.includes(n.name)) set.add(n.name);
    ['l', 'r', 'v'].forEach(k => { if (n[k] && typeof n[k] === 'object') walk(n[k]); });
    if (n.args) n.args.forEach(walk);
  };
  walk(ast.t === 'eq' ? { t: 'bin', l: ast.l, r: ast.r } : ast);
  if (ast.t === 'call' && LAZY.has(ast.name)) return [];
  return [...set];
}

/* SOLVE: find x with L - R = 0 */
export function solveEquation(src, ctx, guess) {
  const ast = compile(src, ctx);
  const l = ast.t === 'eq' ? ast.l : ast, r = ast.t === 'eq' ? ast.r : { t: 'num', v: 0 };
  const F = x => withVar(ctx, 'x', () => { ctx.vars.x = x; const a = evalNode(l, ctx), b = evalNode(r, ctx); return real(a) - real(b); });
  const safe = x => { try { const v = F(x); return Number.isFinite(v) ? v : NaN; } catch { return NaN; } };
  let x = guess; let ok = false;
  for (let i = 0; i < 200; i++) {
    const fx = safe(x); if (Number.isNaN(fx)) break;
    if (Math.abs(fx) < 1e-14) { ok = true; break; }
    const h = Math.max(1e-7, Math.abs(x) * 1e-7);
    const d = (safe(x + h) - safe(x - h)) / (2 * h);
    if (!Number.isFinite(d) || d === 0) break;
    let step = fx / d, nx = x - step, tries = 0;
    while ((Number.isNaN(safe(nx)) || Math.abs(safe(nx)) > Math.abs(fx) * 2) && tries < 30) { step /= 2; nx = x - step; tries++; }
    if (Math.abs(nx - x) < 1e-15 * Math.max(1, Math.abs(x))) { x = nx; ok = Math.abs(safe(x)) < 1e-9; break; }
    x = nx;
  }
  if (!ok || Math.abs(safe(x)) > 1e-8) {
    // bracket search then bisection
    let found = null;
    for (let w = 1; w <= 1e6 && !found; w *= 2) {
      const N = 60; let prev = null;
      for (let i = 0; i <= N; i++) {
        const xx = guess - w + (2 * w * i) / N, v = safe(xx);
        if (Number.isNaN(v)) { prev = null; continue; }
        if (v === 0) { found = [xx, xx]; break; }
        if (prev && Math.sign(prev.v) !== Math.sign(v)) { found = [prev.x, xx]; break; }
        prev = { x: xx, v };
      }
    }
    if (!found) fail("Can't Solve");
    let [lo, hi] = found;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (Math.sign(safe(mid)) === Math.sign(safe(lo))) lo = mid; else hi = mid; }
    x = (lo + hi) / 2;
  }
  return { x, residual: safe(x) };
}

export function solveForVars(ctx) { return ctx; }
export const BASES = { DEC: 10, HEX: 16, BIN: 2, OCT: 8 };
export function formatBase(n, base) {
  if (!isNum(n)) return '';
  const v = int32(n);
  if (base === 10) return String(v);
  return (v >>> 0).toString(base).toUpperCase();
}
