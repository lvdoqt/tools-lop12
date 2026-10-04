import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import './CasioCalculatorPage.css';
import {
  evaluate, solveEquation, freeVariables, CONSTANTS, CONV_GROUPS, BASES, isNum, isC, CasioError,
} from '../lib/casio/engine.js';
import { formatValue, fmtReal, fmtComplex } from '../lib/casio/format.js';
import * as M from '../lib/casio/modes.js';

/* ====================== static definitions ====================== */
const MODE_LIST = [
  { id: 'comp', n: '1', icon: '÷×', title: 'Tính toán', en: 'Calculate' },
  { id: 'cmplx', n: '2', icon: 'i', title: 'Số phức', en: 'Complex' },
  { id: 'base', n: '3', icon: 'N', title: 'Hệ cơ số', en: 'Base-N' },
  { id: 'matrix', n: '4', icon: '▦', title: 'Ma trận', en: 'Matrix' },
  { id: 'vector', n: '5', icon: '↗', title: 'Vectơ', en: 'Vector' },
  { id: 'stat', n: '6', icon: 'σ', title: 'Thống kê', en: 'Statistics' },
  { id: 'dist', n: '7', icon: '∩', title: 'Phân phối', en: 'Distribution' },
  { id: 'sheet', n: '8', icon: '▤', title: 'Bảng tính', en: 'Spreadsheet' },
  { id: 'table', n: '9', icon: 'f(x)', title: 'Bảng giá trị', en: 'Table' },
  { id: 'eqn', n: 'A', icon: 'x=', title: 'Phương trình / Hàm', en: 'Equation/Func' },
  { id: 'ineq', n: 'B', icon: '≥', title: 'Bất phương trình', en: 'Inequality' },
  { id: 'ratio', n: 'C', icon: 'a:b', title: 'Tỉ lệ', en: 'Ratio' },
  { id: 'verify', n: 'D', icon: '✓', title: 'Kiểm chứng', en: 'Verify' },
];
const EXPR_MODES = new Set(['comp', 'cmplx', 'base', 'matrix', 'vector', 'stat', 'verify']);
const MODE_TAG = { comp: 'COMP', cmplx: 'CMPLX', base: 'BASE', matrix: 'MAT', vector: 'VCT', stat: 'STAT', dist: 'DIST', sheet: 'SHEET', table: 'TABLE', eqn: 'EQN', ineq: 'INEQ', ratio: 'RATIO', verify: 'VERIFY' };

const STAT_TYPES = [
  ['1var', '1-Biến', 'x'], ['lin', 'A+BX', 'xy'], ['quad', '_+CX²', 'xy'], ['log', 'A+B·ln X', 'xy'], ['exp', 'A·e^(BX)', 'xy'],
  ['ab', 'A·B^X', 'xy'], ['pow', 'A·X^B', 'xy'], ['inv', 'A+B/X', 'xy'], ['cubic', '_+DX³', 'xy'], ['quart', '_+EX⁴', 'xy'],
];
const EQN_TYPES = [
  ['sim2', 'Hệ 2 ẩn', 2], ['sim3', 'Hệ 3 ẩn', 3], ['sim4', 'Hệ 4 ẩn', 4], ['poly2', 'Bậc 2', 2], ['poly3', 'Bậc 3', 3], ['poly4', 'Bậc 4', 4],
];
const DIST_DEFS = [
  { id: 'normpd', title: 'Normal PD', f: [['x', 'x', '0'], ['sig', 'σ', '1'], ['mu', 'μ', '0']], run: v => M.normPdf(v.x, v.mu, v.sig) },
  { id: 'normcd', title: 'Normal CD', f: [['lo', 'Cận dưới', '-1.96'], ['hi', 'Cận trên', '1.96'], ['sig', 'σ', '1'], ['mu', 'μ', '0']], run: v => M.normCdf(v.lo, v.hi, v.mu, v.sig) },
  { id: 'norminv', title: 'Inverse Normal', f: [['p', 'Diện tích', '0.975'], ['sig', 'σ', '1'], ['mu', 'μ', '0']], run: v => M.normInv(v.p, v.mu, v.sig) },
  { id: 'binpd', title: 'Binomial PD', f: [['x', 'x', '2'], ['n', 'N', '5'], ['p', 'p', '0.5']], run: v => M.binPdf(v.x, v.n, v.p) },
  { id: 'bincd', title: 'Binomial CD', f: [['x', 'x', '2'], ['n', 'N', '5'], ['p', 'p', '0.5']], run: v => M.binCdf(v.x, v.n, v.p) },
  { id: 'bininv', title: 'Inverse Binomial', f: [['a', 'Diện tích', '0.5'], ['n', 'N', '10'], ['p', 'p', '0.5']], run: v => M.discreteInv(k => M.binCdf(k, v.n, v.p), v.a) },
  { id: 'poipd', title: 'Poisson PD', f: [['x', 'x', '2'], ['l', 'λ', '3']], run: v => M.poiPdf(v.x, v.l) },
  { id: 'poicd', title: 'Poisson CD', f: [['x', 'x', '2'], ['l', 'λ', '3']], run: v => M.poiCdf(v.x, v.l) },
  { id: 'poiinv', title: 'Inverse Poisson', f: [['a', 'Diện tích', '0.4'], ['l', 'λ', '3']], run: v => M.discreteInv(k => M.poiCdf(k, v.l), v.a) },
];
const SHEET_COLS = ['A', 'B', 'C', 'D', 'E'];
const SHEET_ROWS = 45;
const VAR_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'M'];
const DEFAULT_SETUP = { exact: true, angle: 'deg', fmt: {}, mixed: false, polar: false, freq: false, tableG: false };
const emptyVars = () => Object.fromEntries(VAR_KEYS.map(k => [k, 0]));

/* ---------- key definitions (physical keypad) ---------- */
const KEYS = {
  shift: { l: 'SHIFT', cls: 'btn-dark btn-shift', top: ['', ''], d: 'Bật chức năng màu vàng in phía trên phím' },
  alpha: { l: 'ALPHA', cls: 'btn-dark btn-alpha', top: ['', ''], d: 'Bật chức năng màu đỏ (biến A–F, x, y, M)' },
  menu: { l: 'MENU', cls: 'btn-dark', top: ['SETUP', ''], d: 'Chọn chế độ tính toán. SHIFT+MENU = SETUP' },
  on: { l: 'ON', cls: 'btn-dark btn-on', top: ['', ''], d: 'Bật máy / khôi phục màn hình' },
  optn: { l: 'OPTN', cls: 'btn-fn', top: ['QR', ''], d: 'Menu tùy chọn theo chế độ đang dùng' },
  calc: { l: 'CALC', cls: 'btn-fn', top: ['SOLVE', '='], d: 'Tính giá trị biểu thức với các biến. SHIFT+CALC = SOLVE' },
  integral: { l: '∫dx', cls: 'btn-fn', top: ['d/dx', ':'], d: 'Tích phân xác định. SHIFT: đạo hàm tại một điểm' },
  varx: { l: 'x', cls: 'btn-fn it', top: ['', 'x'], d: 'Nhập biến x' },
  xinv: { l: 'x⁻¹', cls: 'btn-fn', top: ['x!', ''], d: 'Nghịch đảo. SHIFT: giai thừa' },
  logab: { l: 'log▫□', cls: 'btn-fn', top: ['Σ', ''], d: 'Logarit cơ số bất kỳ: logb(cơ số, số). SHIFT: tổng Σ' },
  frac: { l: '■/□', cls: 'btn-fn', top: ['a b/c', ''], d: 'Nhập phân số. SHIFT: đổi dạng hỗn số' },
  sqrt: { l: '√□', cls: 'btn-fn', top: ['³√', ''], d: 'Căn bậc hai. SHIFT: căn bậc ba' },
  sq: { l: 'x²', cls: 'btn-fn', top: ['x³', ''], d: 'Bình phương. SHIFT: lập phương' },
  pow: { l: 'x▫', cls: 'btn-fn', top: ['ʸ√', ''], d: 'Lũy thừa tùy ý. SHIFT: căn bậc n' },
  log: { l: 'log', cls: 'btn-fn', top: ['10ˣ', ''], d: 'Logarit thập phân. SHIFT: 10 mũ' },
  ln: { l: 'ln', cls: 'btn-fn', top: ['eˣ', ''], d: 'Logarit tự nhiên. SHIFT: e mũ' },
  neg: { l: '(−)', cls: 'btn-fn', top: ['∠', 'A'], d: 'Dấu âm. SHIFT: góc cực ∠. ALPHA: biến A' },
  dms: { l: '° ′ ″', cls: 'btn-fn', top: ['FACT', 'B'], d: 'Độ-phút-giây. SHIFT: phân tích thừa số nguyên tố. ALPHA: biến B' },
  hyp: { l: 'hyp', cls: 'btn-fn', top: ['Abs', 'C'], d: 'Hàm hyperbolic (hyp + sin/cos/tan). SHIFT: |x|. ALPHA: biến C' },
  sin: { l: 'sin', cls: 'btn-fn', top: ['sin⁻¹', 'D'], d: 'Sin. SHIFT: arcsin. ALPHA: biến D' },
  cos: { l: 'cos', cls: 'btn-fn', top: ['cos⁻¹', 'E'], d: 'Cos. SHIFT: arccos. ALPHA: biến E' },
  tan: { l: 'tan', cls: 'btn-fn', top: ['tan⁻¹', 'F'], d: 'Tan. SHIFT: arctan. ALPHA: biến F' },
  sto: { l: 'STO', cls: 'btn-fn', top: ['RCL', ''], d: 'Lưu giá trị vào biến. SHIFT: gọi biến' },
  eng: { l: 'ENG', cls: 'btn-fn', top: ['', ''], d: 'Kết quả dạng kỹ thuật (bội của 3)' },
  lp: { l: '(', cls: 'btn-fn', top: ['Abs(', ''], d: 'Mở ngoặc' },
  rp: { l: ')', cls: 'btn-fn', top: [',', 'x'], d: 'Đóng ngoặc. SHIFT: dấu phẩy. ALPHA: biến x' },
  sd: { l: 'S⇔D', cls: 'btn-fn', top: ['', 'y'], d: 'Đổi qua lại phân số/√/π ⇔ số thập phân. ALPHA: biến y' },
  mplus: { l: 'M+', cls: 'btn-fn', top: ['M−', 'M'], d: 'Cộng Ans vào M. SHIFT: trừ. ALPHA: biến M' },
  7: { l: '7', cls: 'btn-num', top: ['CONST', ''], d: 'Số 7. SHIFT: hằng số vật lý' },
  8: { l: '8', cls: 'btn-num', top: ['CONV', ''], d: 'Số 8. SHIFT: đổi đơn vị' },
  9: { l: '9', cls: 'btn-num', top: ['CLR', ''], d: 'Số 9. SHIFT: xóa/reset' },
  del: { l: 'DEL', cls: 'btn-del', top: ['INS', ''], d: 'Xóa ký tự trước con trỏ' },
  ac: { l: 'AC', cls: 'btn-ac', top: ['OFF', ''], d: 'Xóa sạch. SHIFT+AC = tắt máy' },
  4: { l: '4', cls: 'btn-num', top: ['MATRIX', ''], d: 'Số 4. SHIFT: menu ma trận' },
  5: { l: '5', cls: 'btn-num', top: ['VECTOR', ''], d: 'Số 5. SHIFT: menu vectơ' },
  6: { l: '6', cls: 'btn-num', top: ['', ''], d: 'Số 6' },
  mul: { l: '×', cls: 'btn-num btn-op', top: ['nPr', ''], d: 'Nhân. SHIFT: chỉnh hợp nPr' },
  div: { l: '÷', cls: 'btn-num btn-op', top: ['nCr', ''], d: 'Chia. SHIFT: tổ hợp nCr' },
  1: { l: '1', cls: 'btn-num', top: ['STAT', ''], d: 'Số 1. SHIFT: menu thống kê' },
  2: { l: '2', cls: 'btn-num', top: ['CMPLX', ''], d: 'Số 2. SHIFT: menu số phức' },
  3: { l: '3', cls: 'btn-num', top: ['BASE', ''], d: 'Số 3. SHIFT: menu hệ cơ số' },
  add: { l: '+', cls: 'btn-num btn-op', top: ['Pol', ''], d: 'Cộng. SHIFT: Pol (tọa độ cực)' },
  sub: { l: '−', cls: 'btn-num btn-op', top: ['Rec', ''], d: 'Trừ. SHIFT: Rec (tọa độ vuông góc)' },
  0: { l: '0', cls: 'btn-num', top: ['Rnd', ''], d: 'Số 0. SHIFT: làm tròn Rnd' },
  dot: { l: '•', cls: 'btn-num', top: ['Ran#', 'RanInt'], d: 'Dấu thập phân. SHIFT: số ngẫu nhiên. ALPHA: RanInt' },
  exp10: { l: '×10ˣ', cls: 'btn-num', top: ['π', 'e'], d: 'Nhân lũy thừa 10. SHIFT: π. ALPHA: số e' },
  ans: { l: 'Ans', cls: 'btn-num', top: ['%', ''], d: 'Kết quả trước. SHIFT: phần trăm' },
  equal: { l: '=', cls: 'btn-equal', top: ['', ''], d: 'Thực hiện phép tính' },
};
const KEYPAD_ROWS = [
  ['optn', 'calc', 'integral', 'varx', 'xinv', 'logab'],
  ['frac', 'sqrt', 'sq', 'pow', 'log', 'ln'],
  ['neg', 'dms', 'hyp', 'sin', 'cos', 'tan'],
  ['sto', 'eng', 'lp', 'rp', 'sd', 'mplus'],
  [7, 8, 9, 'del', 'ac'], [4, 5, 6, 'mul', 'div'], [1, 2, 3, 'add', 'sub'], [0, 'dot', 'exp10', 'ans', 'equal'],
];

/* ====================== sound ====================== */
let audioCtx;
function click(on, kind = 'click') {
  if (!on) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    audioCtx = audioCtx || new AC(); const ctx = audioCtx; const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; const [f0, f1, dur, vol] = kind === 'eq' ? [620, 940, 0.06, 0.1] : kind === 'ac' ? [320, 300, 0.05, 0.09] : [700, 220, 0.03, 0.07];
    o.frequency.setValueAtTime(f0, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(f1, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  } catch { /* audio unavailable */ }
}

const display = s => s.replace(/\*/g, '×').replace(/pi/g, 'π').replace(/sqrt\(/g, '√(').replace(/cbrt\(/g, '³√(').replace(/asin\(/g, 'sin⁻¹(').replace(/acos\(/g, 'cos⁻¹(').replace(/atan\(/g, 'tan⁻¹(').replace(/diff\(/g, 'd/dx(').replace(/int\(/g, '∫(');
const primeFactors = n => { const out = []; let m = n; for (let p = 2; p * p <= m; p++) { let c = 0; while (m % p === 0) { m /= p; c++; } if (c) out.push(c > 1 ? `${p}^${c}` : `${p}`); } if (m > 1) out.push(`${m}`); return out.join('×'); };

/* ====================== stable input (module level) ====================== */
const FieldCtx = createContext({ fields: {}, focus: '', setFocus: () => {}, setField: () => {} });
function Inp({ id, ph = '', cls = '' }) {
  const { fields, focus, setFocus, setField } = useContext(FieldCtx);
  return (
    <input id={`f-${id}`} className={`lcd-input ${cls} ${focus === id ? 'is-active' : ''}`} value={fields[id] ?? ''} placeholder={ph}
      onFocus={() => setFocus(id)} onChange={e => setField(id, e.target.value)} autoComplete="off" spellCheck={false} />
  );
}

/* ====================== component ====================== */
export default function CasioCalculatorPage() {
  const [power, setPower] = useState(true);
  const [mode, setMode] = useState('comp');
  const [setup, setSetup] = useState(DEFAULT_SETUP);
  const [shift, setShift] = useState(false);
  const [alpha, setAlpha] = useState(false);
  const [hyp, setHyp] = useState(false);
  const [sto, setSto] = useState(false);
  const [insertMode, setInsertMode] = useState(true);
  const [sound, setSound] = useState(true);
  const [fields, setFields] = useState({ expr: '' });
  const [focus, setFocus] = useState('expr');
  const [cursor, setCursor] = useState(0);
  const [vars, setVars] = useState(emptyVars);
  const [ans, setAns] = useState(0);
  const [result, setResult] = useState({ text: '0', value: 0, error: false, lines: null });
  const [view, setView] = useState({});
  const [history, setHistory] = useState([]);
  const [hIdx, setHIdx] = useState(-1);
  const [overlay, setOverlay] = useState(null);
  const [calcPrompt, setCalcPrompt] = useState(null);
  const [base, setBase] = useState(10);
  const [matSel, setMatSel] = useState('MatA');
  const [matDims, setMatDims] = useState({ MatA: [2, 2], MatB: [2, 2], MatC: [2, 2], MatD: [2, 2], VctA: [3, 0], VctB: [3, 0], VctC: [3, 0], VctD: [3, 0] });
  const [statType, setStatType] = useState('1var');
  const [statRows, setStatRows] = useState(8);
  const [reg, setReg] = useState(null);
  const [statVars, setStatVars] = useState({});
  const [eqnType, setEqnType] = useState('sim2');
  const [ineqDeg, setIneqDeg] = useState(2);
  const [ineqOp, setIneqOp] = useState('>');
  const [distId, setDistId] = useState('normcd');
  const [tableRows, setTableRows] = useState(null);
  const [ratioForm, setRatioForm] = useState('abcx');
  const [tab, setTab] = useState('guide');
  const [hover, setHover] = useState(null);
  const [toast, setToast] = useState('');
  const [tick, setTick] = useState(0);

  const notify = useCallback(m => { setToast(m); window.clearTimeout(notify.t); notify.t = window.setTimeout(() => setToast(''), 2400); }, []);
  const setField = useCallback((id, v) => setFields(f => ({ ...f, [id]: v })), []);

  /* ---- build evaluation context ---- */
  const buildMats = useCallback(() => {
    const out = {};
    Object.entries(matDims).forEach(([name, [r, c]]) => {
      const isVec = name.startsWith('Vct');
      const read = (i, j) => {
        const raw = fields[`m-${name}-${i}-${j}`]; if (raw === undefined || raw === '') return 0;
        const v = evaluate(raw, { angle: 'deg', vars: {}, complex: false, fmt: {} }); if (!isNum(v)) throw new CasioError('Argument ERROR'); return v;
      };
      if (isVec) out[name] = { t: 'v', a: Array.from({ length: r }, (_, i) => read(i, 0)) };
      else out[name] = { t: 'm', a: Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => read(i, j))) };
    });
    return out;
  }, [matDims, fields]);

  const makeCtx = useCallback((over = {}) => {
    const m = mode === 'cmplx' || over.complex; let mats = {};
    if (mode === 'matrix' || mode === 'vector' || mode === 'comp' || mode === 'cmplx') { try { mats = buildMats(); } catch { mats = {}; } }
    return {
      angle: setup.angle, fmt: setup.fmt, exact: setup.exact, polar: setup.polar, complex: !!m, ans, reg,
      base: mode === 'base' ? base : 0, vars: { ...vars, ...mats, ...statVars }, ...over,
    };
  }, [mode, setup, ans, reg, base, vars, statVars, buildMats]);

  const fmtCtx = ctx => ({ ...ctx, exact: setup.exact && !(mode === 'base') });
  const show = (v, ctx, vw = view) => formatValue(v, fmtCtx(ctx), vw);

  const numField = useCallback((id, ctx, dflt = 0) => {
    const raw = (fields[id] ?? '').trim(); if (raw === '') return dflt;
    const v = evaluate(raw, { ...ctx, base: 0, complex: false }); if (!isNum(v)) throw new CasioError('Argument ERROR'); return v;
  }, [fields]);

  /* ---- text editing ---- */
  const insert = useCallback(text => {
    if (focus === 'expr' && EXPR_MODES.has(mode)) {
      setFields(f => { const cur = f.expr || ''; const at = Math.min(cursor, cur.length); const next = cur.slice(0, at) + text + (insertMode ? cur.slice(at) : cur.slice(at + text.length)); return { ...f, expr: next }; });
      setCursor(c => c + text.length);
    } else setFields(f => ({ ...f, [focus]: (f[focus] || '') + text }));
    setHIdx(-1);
  }, [focus, mode, cursor, insertMode]);
  const backspace = useCallback(() => {
    if (focus === 'expr' && EXPR_MODES.has(mode)) {
      if (cursor <= 0) return; setFields(f => ({ ...f, expr: (f.expr || '').slice(0, cursor - 1) + (f.expr || '').slice(cursor) })); setCursor(c => c - 1);
    } else setFields(f => ({ ...f, [focus]: (f[focus] || '').slice(0, -1) }));
  }, [focus, mode, cursor]);

  /* ---- finish: record result ---- */
  const finish = useCallback((value, ctx, srcText, extra = {}) => {
    const text = show(value, ctx, {}); setResult({ text, value, error: false, lines: extra.lines || null });
    setView({}); setAns(value); setVars(v => ({ ...v })); setHIdx(-1);
    if (srcText) setHistory(h => [{ expr: srcText, text, value, mode }, ...h].slice(0, 60));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = e => setResult({ text: e instanceof CasioError ? e.message : 'Math ERROR', value: null, error: true, lines: null });

  /* ---- expression modes ---- */
  const computeExpr = useCallback((src = fields.expr || '', extraVars = null) => {
    if (!src.trim()) return;
    click(sound, 'eq');
    try {
      const ctx = makeCtx(); if (extraVars) ctx.vars = { ...ctx.vars, ...extraVars };
      const v = evaluate(src, ctx);
      if (v && v.t === 'l') { finish(v, ctx, src, { lines: v.a.map((x, i) => `${v.labels[i]} = ${fmtReal(x, setup.fmt)}`) }); setVars(p => ({ ...p, x: ctx.vars.x, y: ctx.vars.y })); return; }
      finish(v, ctx, src);
    } catch (e) { err(e); }
  }, [fields.expr, makeCtx, finish, sound, setup.fmt]);

  const doSolve = useCallback(() => {
    const src = fields.expr || ''; if (!src.trim()) return;
    try {
      const ctx = makeCtx(); const guess = isNum(vars.x) ? vars.x : 0;
      const { x, residual } = solveEquation(src, ctx, guess);
      setVars(p => ({ ...p, x })); setAns(x);
      setResult({ text: `x = ${show(x, ctx, {})}`, value: x, error: false, lines: [`x = ${show(x, ctx, {})}`, `L−R = ${fmtReal(Math.abs(residual) < 1e-10 ? 0 : residual, setup.fmt)}`] });
      setHistory(h => [{ expr: `SOLVE ${src}`, text: `x = ${show(x, ctx, {})}`, value: x, mode }, ...h].slice(0, 60));
    } catch (e) { err(e); }
  }, [fields.expr, makeCtx, vars.x, setup.fmt]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- standalone modes ---- */
  const computeMode = useCallback(() => {
    click(sound, 'eq');
    try {
      const ctx = makeCtx({ complex: false });
      const out = (lines) => setResult({ text: lines[0] || '', value: null, error: false, lines });
      const fm = x => show(x, ctx, {});
      if (mode === 'eqn') {
        const [, , n] = EQN_TYPES.find(t => t[0] === eqnType);
        if (eqnType.startsWith('sim')) {
          const Mx = Array.from({ length: n }, (_, i) => Array.from({ length: n + 1 }, (_, j) => numField(`e-${i}-${j}`, ctx)));
          const sol = M.solveSimultaneous(Mx); out(sol.map((v, i) => `${['x', 'y', 'z', 't'][i]} = ${fm(v)}`));
        } else {
          const co = Array.from({ length: n + 1 }, (_, i) => numField(`p-${i}`, ctx)); if (co[0] === 0) throw new CasioError('Math ERROR');
          const roots = M.polyRoots(co);
          out(roots.map((r, i) => `x${i + 1} = ${r.im === 0 ? fm(r.re) : fmtComplex({ re: r.re, im: r.im }, setup.fmt, false, ctx)}`));
        }
      } else if (mode === 'ineq') {
        const co = Array.from({ length: ineqDeg + 1 }, (_, i) => numField(`q-${i}`, ctx)); if (co[0] === 0) throw new CasioError('Math ERROR');
        const s = M.solveInequality(co, ineqOp);
        if (s.all) out(['Mọi số thực']); else if (s.none) out(['Vô nghiệm']);
        else out(s.intervals.map(o => {
          const L = o.lo === -Infinity, R = o.hi === Infinity;
          if (!L && !R && o.lo === o.hi) return `x = ${fm(o.lo)}`;
          if (L) return `x ${o.hiInc ? '≤' : '<'} ${fm(o.hi)}`; if (R) return `x ${o.loInc ? '≥' : '>'} ${fm(o.lo)}`;
          return `${fm(o.lo)} ${o.loInc ? '≤' : '<'} x ${o.hiInc ? '≤' : '<'} ${fm(o.hi)}`;
        }));
      } else if (mode === 'ratio') {
        const keys = ['a', 'b', 'c', 'd']; const raw = keys.map(k => (fields[`r-${k}`] ?? '').trim()); const empty = raw.filter(r => r === '').length;
        if (empty !== 1) throw new CasioError('Cần để trống đúng 1 ô');
        const vals = raw.map(r => (r === '' ? null : numField(`r-${keys[raw.indexOf(r)]}`, ctx)));
        const res = M.solveRatio(...vals); const name = keys[vals.indexOf(null)]; out([`${name} = ${fm(res)}`]);
      } else if (mode === 'dist') {
        const def = DIST_DEFS.find(d => d.id === distId); const v = {};
        def.f.forEach(([k, , dflt]) => { v[k] = numField(`d-${k}`, ctx, Number(dflt)); });
        const r = def.run(v); out([`${def.title}`, fm(r)]); setAns(r);
      } else if (mode === 'table') {
        const f = fields.tf || ''; if (!f.trim()) throw new CasioError('Syntax ERROR');
        const st = numField('ts', ctx, 1), en = numField('te', ctx, 5), sp = numField('tp', ctx, 1); if (sp <= 0 || en < st) throw new CasioError('Math ERROR');
        const cnt = Math.floor((en - st) / sp + 1e-9) + 1; if (cnt > 45) throw new CasioError('Quá 45 dòng');
        const rows = [];
        for (let i = 0; i < cnt; i++) {
          const xv = st + i * sp; const c2 = { ...ctx, vars: { ...ctx.vars, x: xv } }; const row = { x: xv, f: null, g: null };
          try { const r = evaluate(f, c2); row.f = isNum(r) ? r : null; } catch { row.f = null; }
          if (setup.tableG && (fields.tg || '').trim()) { try { const r = evaluate(fields.tg, c2); row.g = isNum(r) ? r : null; } catch { row.g = null; } }
          rows.push(row);
        }
        setTableRows(rows); setResult({ text: `${rows.length} dòng`, value: null, error: false, lines: null });
      } else if (mode === 'stat') {
        const cfg = STAT_TYPES.find(t => t[0] === statType); const xs = [], ys = [], fr = [];
        for (let i = 0; i < statRows; i++) {
          const rx = (fields[`sx-${i}`] ?? '').trim(); if (rx === '') continue; const x = numField(`sx-${i}`, ctx);
          const f = setup.freq ? numField(`sf-${i}`, ctx, 1) : 1;
          if (cfg[2] === 'xy') { const ry = (fields[`sy-${i}`] ?? '').trim(); if (ry === '') continue; ys.push(numField(`sy-${i}`, ctx)); }
          xs.push(x); fr.push(f);
        }
        if (!xs.length) throw new CasioError('No Data'); const lines = []; const f = x => fmtReal(x, setup.fmt); const sv = {};
        if (cfg[2] === 'x') {
          const s = M.oneVar(xs, fr);
          [['n', s.n], ['x̄', s.mean], ['Σx', s.sumX], ['Σx²', s.sumX2], ['σx', s.sigmaX], ['sx', s.sX], ['minX', s.minX], ['Q1', s.Q1], ['Med', s.Med], ['Q3', s.Q3], ['maxX', s.maxX]].forEach(([k, v]) => lines.push(`${k} = ${f(v)}`));
          Object.assign(sv, { nn: s.n, xbar: s.mean, sumx: s.sumX, sumx2: s.sumX2, sigmax: s.sigmaX, sdx: s.sX, minx: s.minX, maxx: s.maxX, q1: s.Q1, med: s.Med, q3: s.Q3 });
          setReg(null);
        } else {
          const s = M.twoVar(xs, ys, fr); const r = M.regression(statType, xs, ys, fr); setReg(r);
          [['n', s.n], ['x̄', s.meanX], ['ȳ', s.meanY], ['Σx', s.sumX], ['Σx²', s.sumX2], ['Σy', s.sumY], ['Σy²', s.sumY2], ['Σxy', s.sumXY], ['σx', s.sigmaX], ['σy', s.sigmaY], ['sx', s.sX], ['sy', s.sY]].forEach(([k, v]) => lines.push(`${k} = ${f(v)}`));
          lines.push('— Hồi quy ' + cfg[1] + ' —'); Object.entries(r.coef).forEach(([k, v]) => lines.push(`${k === 'R2' ? 'R²' : k} = ${f(v)}`));
          Object.assign(sv, { nn: s.n, xbar: s.meanX, ybar: s.meanY, sumx: s.sumX, sumx2: s.sumX2, sumy: s.sumY, sumy2: s.sumY2, sumxy: s.sumXY, sigmax: s.sigmaX, sigmay: s.sigmaY, sdx: s.sX, sdy: s.sY, regA: r.coef.A, regB: r.coef.B, regC: r.coef.C ?? 0, regR: r.coef.r ?? 0 });
        }
        setStatVars(sv); setResult({ text: lines[0], value: null, error: false, lines });
      } else if (mode === 'sheet') {
        const res = evalSheet(); setResult({ text: 'Đã tính bảng', value: null, error: false, lines: null }); void res;
      }
    } catch (e) { err(e); }
  }, [mode, eqnType, ineqDeg, ineqOp, distId, statType, statRows, fields, setup, makeCtx, numField, sound]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- spreadsheet evaluation ---- */
  const sheetValues = useMemo(() => {
    if (mode !== 'sheet') return {};
    const memo = {}; const stack = new Set(); const ctx = { angle: setup.angle, vars: emptyVars(), fmt: setup.fmt, complex: false };
    const cellVal = name => {
      if (name in memo) return memo[name]; if (stack.has(name)) throw new CasioError('Circular ERROR');
      const raw = (fields[`cell-${name}`] ?? '').trim(); if (raw === '') return 0;
      stack.add(name);
      let src = raw.startsWith('=') ? raw.slice(1) : raw;
      src = src.replace(/(SUM|AVG|MIN|MAX|COUNT)\(([A-E])(\d+):([A-E])(\d+)\)/gi, (_, fn, c1, r1, c2, r2) => {
        const vals = []; for (let c = c1.toUpperCase().charCodeAt(0); c <= c2.toUpperCase().charCodeAt(0); c++) for (let r = +r1; r <= +r2; r++) vals.push(cellVal(String.fromCharCode(c) + r));
        const F = fn.toUpperCase(); return `(${F === 'SUM' ? vals.reduce((a, b) => a + b, 0) : F === 'AVG' ? vals.reduce((a, b) => a + b, 0) / (vals.length || 1) : F === 'MIN' ? Math.min(...vals) : F === 'MAX' ? Math.max(...vals) : vals.length})`;
      }).replace(/\b([A-E])(\d{1,2})\b/g, (_, c, r) => `(${cellVal(c + r)})`);
      const v = evaluate(src, ctx); stack.delete(name); if (!isNum(v)) throw new CasioError('Argument ERROR'); memo[name] = v; return v;
    };
    const out = {};
    for (let r = 1; r <= SHEET_ROWS; r++) for (const c of SHEET_COLS) { const n = c + r; if ((fields[`cell-${n}`] ?? '').trim() !== '') { try { out[n] = fmtReal(cellVal(n), setup.fmt); } catch (e) { out[n] = e.message === 'Circular ERROR' ? 'CIRC' : 'ERR'; } } }
    return out;
  }, [mode, fields, setup]);
  const evalSheet = () => sheetValues;

  /* ---- menus / overlays ---- */
  const closeOverlay = () => setOverlay(null);
  const openList = (title, items, cols = 1) => setOverlay({ title, items, cols });
  const switchMode = id => {
    setMode(id); setFields({ expr: '' }); setCursor(0); setFocus(EXPR_MODES.has(id) ? 'expr' : ''); setResult({ text: '0', value: 0, error: false, lines: null });
    setView({}); setTableRows(null); setCalcPrompt(null); setOverlay(null); setHIdx(-1);
    if (id === 'cmplx') setSetup(s => ({ ...s })); if (id === 'base') setBase(10);
    notify(`Chế độ: ${MODE_LIST.find(m => m.id === id).title}`);
    if (id === 'stat') openList('STAT — Loại dữ liệu', STAT_TYPES.map(([k, n]) => ({ label: n, pick: () => { setStatType(k); closeOverlay(); } })), 2);
    if (id === 'eqn') openList('EQN — Loại', EQN_TYPES.map(([k, n]) => ({ label: n, pick: () => { setEqnType(k); setResult({ text: '', value: null, error: false, lines: null }); closeOverlay(); } })), 2);
    if (id === 'ineq') openList('INEQ — Bậc', [2, 3, 4].map(d => ({ label: `Bậc ${d}`, pick: () => { setIneqDeg(d); closeOverlay(); } })));
    if (id === 'dist') openList('DIST — Hàm', DIST_DEFS.map(d => ({ label: d.title, pick: () => { setDistId(d.id); closeOverlay(); } })), 1);
    if (id === 'ratio') openList('RATIO — Dạng', [{ label: 'a : b = c : d', pick: () => { setRatioForm('abcx'); closeOverlay(); } }]);
  };
  const openMenu = () => setOverlay({ title: 'MENU — Chọn chế độ', cols: 3, items: MODE_LIST.map(m => ({ label: `${m.n}: ${m.title}`, icon: m.icon, key: m.n, pick: () => switchMode(m.id) })) });

  const openSetup = () => {
    const choose = (title, items) => () => setOverlay({ title, cols: 1, items });
    setOverlay({
      title: 'SETUP — Cài đặt', cols: 1, items: [
        { label: '1: Nhập/Xuất (MathO / LineO)', key: '1', pick: choose('Nhập/Xuất', [{ label: '1: MathI/MathO (dạng chính xác)', pick: () => { setSetup(s => ({ ...s, exact: true })); closeOverlay(); } }, { label: '2: LineI/LineO (số thập phân)', pick: () => { setSetup(s => ({ ...s, exact: false })); closeOverlay(); } }]) },
        { label: '2: Đơn vị góc', key: '2', pick: choose('Đơn vị góc', [{ label: '1: Degree (độ)', pick: () => { setSetup(s => ({ ...s, angle: 'deg' })); closeOverlay(); } }, { label: '2: Radian', pick: () => { setSetup(s => ({ ...s, angle: 'rad' })); closeOverlay(); } }, { label: '3: Gradian', pick: () => { setSetup(s => ({ ...s, angle: 'gra' })); closeOverlay(); } }]) },
        {
          label: '3: Định dạng số', key: '3', pick: choose('Định dạng số', [
            { label: '1: Fix (số chữ số thập phân)', pick: () => openDigits('Fix', n => setSetup(s => ({ ...s, fmt: { fixN: n } }))) },
            { label: '2: Sci (số chữ số có nghĩa)', pick: () => openDigits('Sci', n => setSetup(s => ({ ...s, fmt: { sciN: n } })), 1) },
            { label: '3: Norm 1', pick: () => { setSetup(s => ({ ...s, fmt: { norm: 1 } })); closeOverlay(); } },
            { label: '4: Norm 2', pick: () => { setSetup(s => ({ ...s, fmt: { norm: 2 } })); closeOverlay(); } },
          ])
        },
        { label: '4: Kết quả phân số', key: '4', pick: choose('Phân số', [{ label: '1: a b/c (hỗn số)', pick: () => { setSetup(s => ({ ...s, mixed: true })); closeOverlay(); } }, { label: '2: d/c (phân số)', pick: () => { setSetup(s => ({ ...s, mixed: false })); closeOverlay(); } }]) },
        { label: '5: Số phức (a+bi / r∠θ)', key: '5', pick: choose('Số phức', [{ label: '1: a+bi', pick: () => { setSetup(s => ({ ...s, polar: false })); closeOverlay(); } }, { label: '2: r∠θ', pick: () => { setSetup(s => ({ ...s, polar: true })); closeOverlay(); } }]) },
        { label: '6: Thống kê (cột tần số)', key: '6', pick: choose('Tần số thống kê', [{ label: '1: FreqOn', pick: () => { setSetup(s => ({ ...s, freq: true })); closeOverlay(); } }, { label: '2: FreqOff', pick: () => { setSetup(s => ({ ...s, freq: false })); closeOverlay(); } }]) },
        { label: '7: Bảng giá trị (f / f,g)', key: '7', pick: choose('Bảng giá trị', [{ label: '1: f(x)', pick: () => { setSetup(s => ({ ...s, tableG: false })); closeOverlay(); } }, { label: '2: f(x), g(x)', pick: () => { setSetup(s => ({ ...s, tableG: true })); closeOverlay(); } }]) },
      ],
    });
  };
  const openDigits = (title, setter, min = 0) => setOverlay({
    title: `${title}: chọn số chữ số (${min}–9)`, cols: 5, items: Array.from({ length: 10 - min }, (_, i) => ({ label: String(i + min), key: String(i + min), pick: () => { setter(i + min); closeOverlay(); } })),
  });

  const optnItems = () => {
    const ins = (label, txt) => ({ label, pick: () => { closeOverlay(); insert(txt); } });
    const grp = (title, items) => ({ label: `${title} ▸`, pick: () => openList(title, items, 2) });
    const common = [
      grp('Hyperbolic', ['sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh'].map(n => ins(n, `${n}(`))),
      grp('Góc', [ins('° (độ)', 'deg'), ins('ʳ (radian)', 'rad'), ins('ᵍ (gradian)', 'gra')]),
      grp('Số nguyên', [ins('Int(', 'Int('), ins('Intg(', 'Intg('), ins('Rnd(', 'Rnd('), ins('GCD(', 'GCD('), ins('LCM(', 'LCM('), ins('Rmdr(', 'Rmdr('), ins('Quot(', 'Quot('), ins('sign(', 'sign('), ins('ceil(', 'ceil(')]),
      grp('Ngẫu nhiên', [ins('Ran#', 'Ran#'), ins('RanInt(', 'RanInt(')]),
    ];
    if (mode === 'cmplx') return [ins('Arg(', 'arg('), ins('Conjg(', 'Conjg('), ins('Re(', 'Re('), ins('Im(', 'Im('), ins('i', 'i'), ins('∠', '∠'),
      { label: '▸ r∠θ', pick: () => { setSetup(s => ({ ...s, polar: true })); closeOverlay(); } }, { label: '▸ a+bi', pick: () => { setSetup(s => ({ ...s, polar: false })); closeOverlay(); } }, ...common.slice(0, 3)];
    if (mode === 'base') return [ins('and', ' and '), ins('or', ' or '), ins('xor', ' xor '), ins('xnor', ' xnor '), ins('Not(', 'not('), ins('Neg(', 'neg('), ins('Shl(', 'shl('), ins('Shr(', 'shr(')];
    if (mode === 'matrix') return [grp('Ma trận', ['MatA', 'MatB', 'MatC', 'MatD'].map(n => ins(n, n))), ins('det(', 'det('), ins('Trn(', 'Trn('), ins('Inv(', 'Inv('), ins('Identity(', 'Identity('), ins('Ref(', 'Ref('), ins('Rref(', 'Rref('), ins('abs(', 'abs('), ...common.slice(0, 1)];
    if (mode === 'vector') return [grp('Vectơ', ['VctA', 'VctB', 'VctC', 'VctD'].map(n => ins(n, n))), ins('Dot(', 'Dot('), ins('Cross(', 'Cross('), ins('Angle(', 'Angle('), ins('UnitV(', 'UnitV('), ins('abs(', 'abs(')];
    if (mode === 'stat') return [ins('x̄', 'xbar'), ins('ȳ', 'ybar'), ins('σx', 'sigmax'), ins('σy', 'sigmay'), ins('sx', 'sdx'), ins('sy', 'sdy'), ins('n', 'nn'), ins('Σx', 'sumx'), ins('Σx²', 'sumx2'), ins('Σy', 'sumy'), ins('Σxy', 'sumxy'), ins('minX', 'minx'), ins('maxX', 'maxx'), ins('Q1', 'q1'), ins('Med', 'med'), ins('Q3', 'q3'), ins('A (hồi quy)', 'regA'), ins('B (hồi quy)', 'regB'), ins('C (hồi quy)', 'regC'), ins('r', 'regR'), ins('ŷ(', 'yhat('), ins('x̂(', 'xhat('), ...common.slice(0, 1)];
    if (mode === 'verify') return [ins('=', '='), ...common];
    return common;
  };

  const press = key => {
    const S = shift, A = alpha;
    if (!power && key !== 'on') return;
    const reset = () => { if (shift) setShift(false); if (alpha) setAlpha(false); };
    const sk = String(key);
    if (overlay) {
      if (/^[0-9A-D]$/.test(sk) && !S) { const it = overlay.items.find(i => i.key === sk) || (overlay.items[Number(sk) - 1]); if (it && /^[0-9]$/.test(sk)) { reset(); click(sound); it.pick(); return; } }
      if (key === 'ac' || key === 'del') { click(sound, 'ac'); closeOverlay(); reset(); return; }
    }
    if (calcPrompt && key === 'ac') { setCalcPrompt(null); }
    click(sound, key === 'equal' ? 'eq' : key === 'ac' ? 'ac' : 'click');
    if (sto && /^(neg|dms|hyp|sin|cos|tan|rp|sd|mplus|varx)$/.test(sk)) {
      const map = { neg: 'A', dms: 'B', hyp: 'C', sin: 'D', cos: 'E', tan: 'F', rp: 'x', sd: 'y', mplus: 'M', varx: 'x' };
      const n = map[sk]; setSto(false); reset(); const val = isNum(ans) || isC(ans) ? ans : result.value; setVars(v => ({ ...v, [n]: ans })); notify(`Đã lưu ${n} = ${show(val ?? ans, makeCtx(), {})}`); return;
    }
    if (sto) setSto(false);
    switch (key) {
      case 'shift': setShift(v => !v); setAlpha(false); return;
      case 'alpha': setAlpha(v => !v); setShift(false); return;
      case 'on': setPower(true); setOverlay(null); setCalcPrompt(null); setFields(f => ({ ...f, expr: '' })); setCursor(0); setResult({ text: '0', value: 0, error: false, lines: null }); reset(); return;
      case 'menu': reset(); if (S) openSetup(); else openMenu(); return;
      case 'optn': reset(); if (S) { notify('QR: tạo mã QR chưa hỗ trợ'); return; } openList('OPTN', optnItems(), 1); return;
      case 'calc':
        reset();
        if (S) { if (EXPR_MODES.has(mode)) doSolve(); return; }
        if (A) { insert('='); return; }
        if (!EXPR_MODES.has(mode)) { computeMode(); return; }
        {
          try { const fvars = freeVariables(fields.expr || '', makeCtx()).filter(v => !['k', 'n', 'j'].includes(v)); if (fvars.length) { setCalcPrompt({ vars: fvars }); setFocus(`c-${fvars[0]}`); fvars.forEach(v => setFields(f => ({ ...f, [`c-${v}`]: f[`c-${v}`] ?? String(isNum(vars[v]) ? vars[v] : 0) }))); } else computeExpr(); } catch (e) { err(e); }
        }
        return;
      case 'integral': reset(); if (A) insert(':'); else insert(S ? 'diff(' : 'int('); return;
      case 'varx': reset(); insert('x'); return;
      case 'xinv': reset(); insert(S ? '!' : '^(-1)'); return;
      case 'logab': reset(); insert(S ? 'sum(' : 'logb('); return;
      case 'frac': reset(); if (S) { setView(v => ({ ...v, fraction: !v.fraction })); setSetup(s => ({ ...s, mixed: !s.mixed })); notify('Đổi dạng hỗn số / phân số'); return; } insert('()/('); setCursor(c => c - 3); return;
      case 'sqrt': reset(); insert(S ? 'cbrt(' : 'sqrt('); return;
      case 'sq': reset(); insert(S ? '^3' : '^2'); return;
      case 'pow': reset(); if (S) { insert('root('); } else insert('^('); return;
      case 'log': reset(); insert(S ? '10^(' : 'log('); return;
      case 'ln': reset(); insert(S ? 'e^(' : 'ln('); return;
      case 'neg': reset(); if (A) insert('A'); else if (S) insert('∠'); else insert('-'); return;
      case 'dms': reset();
        if (A) { insert('B'); return; }
        if (S) { const src = (fields.expr || '').trim(); const t = src ? Number((() => { try { return evaluate(src, makeCtx()); } catch { return NaN; } })()) : Number(ans); if (Number.isInteger(t) && t > 1 && t < 1e12) setResult({ text: primeFactors(t), value: t, error: false, lines: [`${t} = ${primeFactors(t)}`] }); else err(new CasioError('Argument ERROR')); return; }
        if (!(fields.expr || '') && isNum(result.value)) { setView(v => ({ ...v, dms: !v.dms })); return; }
        { const e = fields.expr || ''; if (/°\d+(\.\d+)?'\d+(\.\d+)?$/.test(e)) insert('"'); else if (/°\d+(\.\d+)?$/.test(e)) insert("'"); else insert('°'); }
        return;
      case 'hyp': reset(); if (A) { insert('C'); return; } if (S) { insert('abs('); return; } setHyp(v => !v); return;
      case 'sin': case 'cos': case 'tan': {
        reset(); if (A) { insert({ sin: 'D', cos: 'E', tan: 'F' }[key]); return; }
        const pre = S ? 'a' : ''; const post = hyp ? 'h' : ''; setHyp(false); insert(`${pre}${key}${post}(`); return;
      }
      case 'sto': reset(); if (S) { openList('RCL — Gọi biến', [...VAR_KEYS, 'Ans', 'pi', 'e'].map(n => ({ label: `${n} = ${n === 'Ans' ? show(ans, makeCtx(), {}) : n === 'pi' ? 'π' : n === 'e' ? '2.718…' : show(vars[n], makeCtx(), {})}`, pick: () => { closeOverlay(); insert(n); } })), 2); return; } setSto(true); notify('STO: bấm A B C D E F x y M để lưu'); return;
      case 'eng': reset(); setSetup(s => ({ ...s, fmt: s.fmt.eng ? {} : { eng: true } })); return;
      case 'lp': reset(); insert(S ? 'abs(' : '('); return;
      case 'rp': reset(); insert(A ? 'x' : S ? ',' : ')'); return;
      case 'sd': reset(); if (A) { insert('y'); return; } if (result.value !== null && !error(result)) setView(v => ({ ...v, decimal: !v.decimal })); return;
      case 'mplus': reset(); if (A) { insert('M'); return; } if (isNum(ans)) { setVars(v => ({ ...v, M: v.M + (S ? -ans : ans) })); notify(S ? 'M− : đã trừ Ans khỏi M' : 'M+ : đã cộng Ans vào M'); } return;
      case 'del': reset(); if (S) { setInsertMode(v => !v); notify(insertMode ? 'Chế độ ghi đè' : 'Chế độ chèn'); return; } backspace(); return;
      case 'ac': reset(); if (S) { setPower(false); return; } setFields(f => ({ ...f, expr: '' })); setCursor(0); setResult({ text: '0', value: 0, error: false, lines: null }); setView({}); setHyp(false); setCalcPrompt(null); setOverlay(null); if (EXPR_MODES.has(mode)) setFocus('expr'); return;
      case 'mul': reset(); insert(S ? ' nPr ' : '*'); return;
      case 'div': reset(); insert(S ? ' nCr ' : '/'); return;
      case 'add': reset(); insert(S ? 'Pol(' : '+'); return;
      case 'sub': reset(); insert(S ? 'Rec(' : '-'); return;
      case 'dot': reset(); insert(A ? 'RanInt(' : S ? 'Ran#' : '.'); return;
      case 'exp10': reset(); insert(S ? 'π' : A ? 'e' : '*10^('); return;
      case 'ans': reset(); insert(S ? '%' : 'Ans'); return;
      case 'equal': reset(); if (calcPrompt) { runCalcPrompt(); return; } if (EXPR_MODES.has(mode)) computeExpr(); else computeMode(); return;
      default: break;
    }
    if (typeof key === 'number') {
      reset();
      if (S) {
        const m = { 7: () => openList('CONST — Hằng số vật lý', CONSTANTS.map(c => ({ label: `${c.id} · ${c.name}`, pick: () => { closeOverlay(); insert(`K_${c.id}`); } })), 1), 8: () => openList('CONV — Đổi đơn vị', CONV_GROUPS.map(g => ({ label: `${g.title} ▸`, pick: () => openList(g.title, g.items.map(([a, b]) => ({ label: `${a} ▸ ${b}`, pick: () => { closeOverlay(); insert(`${a}_${b}(`); } })), 2) })), 1), 9: () => openList('CLR — Xóa', [{ label: '1: Setup (cài đặt)', pick: () => { setSetup(DEFAULT_SETUP); closeOverlay(); notify('Đã đặt lại SETUP'); } }, { label: '2: Memory (biến nhớ)', pick: () => { setVars(emptyVars()); setAns(0); closeOverlay(); notify('Đã xóa bộ nhớ'); } }, { label: '3: All (tất cả)', pick: () => { setSetup(DEFAULT_SETUP); setVars(emptyVars()); setAns(0); setHistory([]); closeOverlay(); switchMode('comp'); } }], 1) };
        if (m[key]) { m[key](); return; }
        if (key === 4) { openList('MATRIX', [...['MatA', 'MatB', 'MatC', 'MatD'].map(n => ({ label: n, pick: () => { closeOverlay(); insert(n); } })), ...['det(', 'Trn(', 'Inv(', 'Identity(', 'Ref(', 'Rref('].map(n => ({ label: n, pick: () => { closeOverlay(); insert(n); } }))], 2); return; }
        if (key === 5) { openList('VECTOR', [...['VctA', 'VctB', 'VctC', 'VctD'].map(n => ({ label: n, pick: () => { closeOverlay(); insert(n); } })), ...['Dot(', 'Cross(', 'Angle(', 'UnitV('].map(n => ({ label: n, pick: () => { closeOverlay(); insert(n); } }))], 2); return; }
        if (key === 1) { openList('STAT', [{ label: 'Chuyển sang chế độ Thống kê', pick: () => switchMode('stat') }, { label: 'Biến thống kê (OPTN trong STAT)', pick: () => notify('Vào MENU ▸ 6 rồi dùng OPTN') }], 1); return; }
        if (key === 2) { openList('CMPLX', [{ label: 'Chuyển sang chế độ Số phức', pick: () => switchMode('cmplx') }], 1); return; }
        if (key === 3) { openList('BASE', [{ label: 'Chuyển sang chế độ Hệ cơ số', pick: () => switchMode('base') }], 1); return; }
        if (key === 0) { insert('Rnd('); return; }
      }
      insert(String(key));
    }
  };
  const error = r => r.error;

  const runCalcPrompt = () => {
    const nv = {}; try { calcPrompt.vars.forEach(v => { nv[v] = numField(`c-${v}`, makeCtx()); }); } catch (e) { err(e); return; }
    setVars(p => ({ ...p, ...nv })); computeExpr(fields.expr, nv);
  };

  /* ---- physical keyboard ---- */
  useEffect(() => {
    const onKey = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; const tag = e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') { if (e.key === 'Enter') { e.preventDefault(); press('equal'); } return; }
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(Number(e.key)); } else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); press('equal'); } else if (e.key === 'Backspace') { e.preventDefault(); press('del'); } else if (e.key === 'Escape') { e.preventDefault(); press('ac'); } else if (e.key === '+') { e.preventDefault(); press('add'); } else if (e.key === '-') { e.preventDefault(); press('sub'); } else if (e.key === '*') { e.preventDefault(); press('mul'); } else if (e.key === '/') { e.preventDefault(); press('div'); } else if (e.key === '(') { e.preventDefault(); press('lp'); } else if (e.key === ')') { e.preventDefault(); press('rp'); } else if (e.key === '.') { e.preventDefault(); press('dot'); } else if (e.key === '^') { e.preventDefault(); press('pow'); } else if (e.key === 'ArrowLeft') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); } else if (e.key === 'ArrowRight') { e.preventDefault(); setCursor(c => Math.min((fields.expr || '').length, c + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); replay(1); } else if (e.key === 'ArrowDown') { e.preventDefault(); replay(-1); } else if (e.key === ',') { e.preventDefault(); insert(','); } else if (/^[A-Fa-fxy]$/.test(e.key) && EXPR_MODES.has(mode)) { e.preventDefault(); insert(/^[a-f]$/.test(e.key) ? e.key.toUpperCase() : e.key); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { setTick(t => t + 1); }, [mode]);

  const replay = dir => {
    if (!history.length) return; const n = Math.max(-1, Math.min(history.length - 1, hIdx + dir));
    setHIdx(n); if (n === -1) { setFields(f => ({ ...f, expr: '' })); setCursor(0); return; }
    const it = history[n]; setFields(f => ({ ...f, expr: it.expr.replace(/^SOLVE /, '') })); setCursor(it.expr.length); setResult({ text: it.text, value: it.value, error: false, lines: null });
  };

  /* ---- result text with view toggles ---- */
  const resultText = useMemo(() => {
    if (!power) return '';
    if (result.error || result.value === null || result.value === undefined) return result.text;
    if (!EXPR_MODES.has(mode) && !result.lines) return result.text;
    const ctx = fmtCtx(makeCtx({ exact: setup.exact })); ctx.exact = setup.exact;
    return formatValue(result.value, ctx, { ...view, fraction: setup.mixed });
  }, [result, view, setup, mode, power, makeCtx]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- UI helpers ---- */
  const renderKey = id => {
    const k = KEYS[id]; const on = (id === 'shift' && shift) || (id === 'alpha' && alpha) || (id === 'sto' && sto) || (id === 'hyp' && hyp);
    return (
      <div className="key-slot" key={id}>
        <div className="key-dual-labels"><span className="label-gold">{k.top[0]}</span><span className="label-red">{k.top[1]}</span></div>
        <button className={`casio-btn ${k.cls} ${on ? 'active-pressed' : ''}`} onClick={() => press(id)} onMouseDown={e => e.preventDefault()}
          onMouseEnter={() => setHover({ l: k.l, d: k.d })} onMouseLeave={() => setHover(null)} aria-label={k.l} id={`key-${id}`}>
          <span>{k.l}</span>
        </button>
      </div>
    );
  };
  const modeTag = MODE_TAG[mode];
  const exprText = fields.expr || '';

  /* ---- body of LCD ---- */
  const body = () => {
    if (!power) return <div className="lcd-off" />;
    if (overlay) {
      return (
        <div className="lcd-overlay">
          <div className="lcd-ov-title">{overlay.title}</div>
          <div className={`lcd-ov-grid cols-${overlay.cols}`}>
            {overlay.items.map((it, i) => (
              <button key={i} className="lcd-ov-item" onClick={() => { click(sound); it.pick(); }} onMouseDown={e => e.preventDefault()}>
                {it.icon && <i>{it.icon}</i>}<span>{it.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    const exprBlock = (
      <>
        <div className="lcd-expression-line" onClick={() => { setFocus('expr'); setCursor(exprText.length); }}>
          {exprText ? (<><span>{display(exprText.slice(0, cursor))}</span><span className="lcd-cursor">{insertMode ? '▌' : '▁'}</span><span>{display(exprText.slice(cursor))}</span></>) : (<><span className="lcd-cursor">▌</span><span className="lcd-placeholder">{mode === 'verify' ? 'Nhập đẳng thức, vd: sin(x)^2+cos(x)^2=1' : 'Nhập biểu thức…'}</span></>)}
        </div>
        {calcPrompt && (
          <div className="calc-prompt">
            {calcPrompt.vars.map(v => (<label key={v}><b>{v}?</b><Inp id={`c-${v}`} /></label>))}
            <small>Nhập giá trị rồi bấm =</small>
          </div>
        )}
        <div className={`lcd-result-line ${result.error ? 'is-error' : ''}`}>
          {view.dms && <span className="sd-tag">DMS</span>}{view.decimal && <span className="sd-tag">S⇔D</span>}
          <span className="lcd-result-value">{resultText}</span>
        </div>
        {result.lines && <div className="lcd-lines">{result.lines.map((l, i) => <div key={i}>{l}</div>)}</div>}
      </>
    );
    const grid = (rows, cols, prefix, ph = '0', hdr = null) => (
      <table className="lcd-grid"><tbody>
        {hdr && <tr><th />{hdr.map(h => <th key={h}>{h}</th>)}</tr>}
        {Array.from({ length: rows }, (_, i) => (<tr key={i}><th>{i + 1}</th>{Array.from({ length: cols }, (_, j) => <td key={j}><Inp id={`${prefix}-${i}-${j}`} ph={ph} /></td>)}</tr>))}
      </tbody></table>
    );
    const out = result.lines && !EXPR_MODES.has(mode) ? <div className="lcd-lines big">{result.lines.map((l, i) => <div key={i} className={result.error ? 'is-error' : ''}>{l}</div>)}</div> : (result.error && <div className="lcd-lines big is-error">{result.text}</div>);
    switch (mode) {
      case 'matrix': case 'vector': {
        const names = mode === 'matrix' ? ['MatA', 'MatB', 'MatC', 'MatD'] : ['VctA', 'VctB', 'VctC', 'VctD']; const sel = names.includes(matSel) ? matSel : names[0]; const [r, c] = matDims[sel];
        return (<>
          <div className="lcd-tabs">{names.map(n => <button key={n} className={n === sel ? 'on' : ''} onClick={() => setMatSel(n)} onMouseDown={e => e.preventDefault()}>{n}</button>)}
            <span className="dims">Kích thước: <input type="number" min={1} max={4} value={r} onChange={e => setMatDims(d => ({ ...d, [sel]: [Math.max(1, Math.min(4, +e.target.value || 1)), d[sel][1]] }))} />{mode === 'matrix' && <> × <input type="number" min={1} max={4} value={c} onChange={e => setMatDims(d => ({ ...d, [sel]: [d[sel][0], Math.max(1, Math.min(4, +e.target.value || 1))] }))} /></>}</span></div>
          {grid(r, mode === 'matrix' ? c : 1, `m-${sel}`)}{exprBlock}
        </>);
      }
      case 'base': return (<>
        <div className="lcd-tabs">{Object.entries(BASES).map(([n, b]) => <button key={n} className={b === base ? 'on' : ''} onClick={() => { setBase(b); setResult({ text: '0', value: 0, error: false, lines: null }); setFields(f => ({ ...f, expr: '' })); setCursor(0); }} onMouseDown={e => e.preventDefault()}>{n}</button>)}<span className="dims">Chữ số hợp lệ: {'0123456789ABCDEF'.slice(0, base)}</span></div>
        {exprBlock}
        {isNum(result.value) && !result.error && <div className="lcd-lines">{Object.entries(BASES).map(([n, b]) => <div key={n}>{n}: {formatValue(result.value, { base: b, fmt: {} }, {})}</div>)}</div>}
      </>);
      case 'stat': {
        const cfg = STAT_TYPES.find(t => t[0] === statType); const two = cfg[2] === 'xy';
        return (<>
          <div className="lcd-tabs"><span className="chip">{cfg[1]}</span><button onClick={() => openList('STAT — Loại dữ liệu', STAT_TYPES.map(([k, n]) => ({ label: n, pick: () => { setStatType(k); closeOverlay(); } })), 2)} onMouseDown={e => e.preventDefault()}>Đổi loại</button><button onClick={() => setStatRows(r => r + 5)} onMouseDown={e => e.preventDefault()}>+5 dòng</button><button onClick={computeMode} onMouseDown={e => e.preventDefault()}>Tính ▸</button></div>
          <div className="lcd-scroll"><table className="lcd-grid"><tbody>
            <tr><th /><th>x</th>{two && <th>y</th>}{setup.freq && <th>Freq</th>}</tr>
            {Array.from({ length: statRows }, (_, i) => (<tr key={i}><th>{i + 1}</th><td><Inp id={`sx-${i}`} /></td>{two && <td><Inp id={`sy-${i}`} /></td>}{setup.freq && <td><Inp id={`sf-${i}`} ph="1" /></td>}</tr>))}
          </tbody></table></div>{out}{exprBlock}
        </>);
      }
      case 'eqn': {
        const [, , n] = EQN_TYPES.find(t => t[0] === eqnType); const sim = eqnType.startsWith('sim');
        return (<>
          <div className="lcd-tabs"><span className="chip">{EQN_TYPES.find(t => t[0] === eqnType)[1]}</span><button onClick={() => switchMode('eqn')} onMouseDown={e => e.preventDefault()}>Đổi loại</button><button onClick={computeMode} onMouseDown={e => e.preventDefault()}>Giải ▸</button></div>
          {sim ? (<table className="lcd-grid"><tbody>{Array.from({ length: n }, (_, i) => (<tr key={i}>{Array.from({ length: n + 1 }, (_, j) => (<td key={j}><Inp id={`e-${i}-${j}`} ph={j < n ? ['a', 'b', 'c', 'd'][j] : 'k'} /></td>))}</tr>))}</tbody></table>)
            : (<div className="lcd-poly">{Array.from({ length: n + 1 }, (_, i) => (<label key={i}><Inp id={`p-${i}`} ph={'abcde'[i]} /><span>{n - i > 1 ? `x${'⁰¹²³⁴'[n - i]}` : n - i === 1 ? 'x' : ''}{i < n ? ' +' : ' = 0'}</span></label>))}</div>)}
          {out}
        </>);
      }
      case 'ineq': return (<>
        <div className="lcd-tabs"><span className="chip">Bậc {ineqDeg}</span>{['>', '<', '≥', '≤'].map(o => { const v = { '≥': '>=', '≤': '<=' }[o] || o; return <button key={o} className={ineqOp === v ? 'on' : ''} onClick={() => setIneqOp(v)} onMouseDown={e => e.preventDefault()}>{o}</button>; })}<button onClick={computeMode} onMouseDown={e => e.preventDefault()}>Giải ▸</button></div>
        <div className="lcd-poly">{Array.from({ length: ineqDeg + 1 }, (_, i) => (<label key={i}><Inp id={`q-${i}`} ph={'abcde'[i]} /><span>{ineqDeg - i > 1 ? `x${'⁰¹²³⁴'[ineqDeg - i]}` : ineqDeg - i === 1 ? 'x' : ''}{i < ineqDeg ? ' +' : ` ${ineqOp.replace('>=', '≥').replace('<=', '≤')} 0`}</span></label>))}</div>{out}
      </>);
      case 'ratio': return (<>
        <div className="lcd-tabs"><span className="chip">a : b = c : d</span><span className="dims">Để trống 1 ô cần tìm</span><button onClick={computeMode} onMouseDown={e => e.preventDefault()}>Tính ▸</button></div>
        <div className="lcd-poly ratio"><Inp id="r-a" ph="a" /><b>:</b><Inp id="r-b" ph="b" /><b>=</b><Inp id="r-c" ph="c" /><b>:</b><Inp id="r-d" ph="d" /></div>{out}
        <div className="lcd-lines">{ratioForm && 'Công thức: a:b = c:d  ⇒  a·d = b·c'}</div>
      </>);
      case 'dist': {
        const def = DIST_DEFS.find(d => d.id === distId); return (<>
          <div className="lcd-tabs"><span className="chip">{def.title}</span><button onClick={() => switchMode('dist')} onMouseDown={e => e.preventDefault()}>Đổi hàm</button><button onClick={computeMode} onMouseDown={e => e.preventDefault()}>Tính ▸</button></div>
          <div className="lcd-poly col">{def.f.map(([k, lab, dflt]) => (<label key={k}><span>{lab}</span><Inp id={`d-${k}`} ph={dflt} /></label>))}</div>{out}
        </>);
      }
      case 'table': return (<>
        <div className="lcd-tabs"><button onClick={computeMode} onMouseDown={e => e.preventDefault()}>Tạo bảng ▸</button><span className="dims">tối đa 45 dòng</span></div>
        <div className="lcd-poly col"><label><span>f(x) =</span><Inp id="tf" ph="vd: x^2-3x+1" /></label>{setup.tableG && <label><span>g(x) =</span><Inp id="tg" ph="tùy chọn" /></label>}<label><span>Start</span><Inp id="ts" ph="1" /></label><label><span>End</span><Inp id="te" ph="5" /></label><label><span>Step</span><Inp id="tp" ph="1" /></label></div>
        {out}{tableRows && <div className="lcd-scroll short"><table className="lcd-grid readonly"><tbody><tr><th>x</th><th>f(x)</th>{setup.tableG && <th>g(x)</th>}</tr>{tableRows.map((r, i) => <tr key={i}><td>{fmtReal(r.x, setup.fmt)}</td><td>{r.f === null ? 'ERROR' : fmtReal(r.f, setup.fmt)}</td>{setup.tableG && <td>{r.g === null ? '' : fmtReal(r.g, setup.fmt)}</td>}</tr>)}</tbody></table></div>}
      </>);
      case 'sheet': return (<>
        <div className="lcd-tabs"><span className="dims">Ô nhận số, công thức (=A1+B1) và SUM(A1:A5) AVG MIN MAX COUNT</span></div>
        <div className="lcd-scroll"><table className="lcd-grid"><tbody>
          <tr><th />{SHEET_COLS.map(c => <th key={c}>{c}</th>)}</tr>
          {Array.from({ length: SHEET_ROWS }, (_, r) => (<tr key={r}><th>{r + 1}</th>{SHEET_COLS.map(c => { const n = c + (r + 1); return (<td key={c} className="sheet-cell"><Inp id={`cell-${n}`} />{(fields[`cell-${n}`] ?? '').trim() !== '' && <em className={sheetValues[n] === 'ERR' || sheetValues[n] === 'CIRC' ? 'bad' : ''}>{sheetValues[n]}</em>}</td>); })}</tr>))}
        </tbody></table></div>
      </>);
      default: return exprBlock;
    }
  };

  /* ====================== render ====================== */
  const modeInfo = MODE_LIST.find(m => m.id === mode);
  const helper = hover ? `Phím [${hover.l}] — ${hover.d}` : 'Rê chuột lên phím để xem hướng dẫn. Bấm MENU để chọn 13 chế độ như máy thật.';
  return (
    <FieldCtx.Provider value={{ fields, focus, setFocus, setField }}>
    <main className="main-content casio-hub-page" data-tick={tick}>
      <header className="casio-header-banner">
        <div className="casio-header-meta">
          <span className="casio-badge-tag">HỌC SINH & GIÁO VIÊN · THCS - THPT</span>
          <h1 className="casio-title">Giả Lập Máy Tính <span>Casio fx-580VN X</span></h1>
          <p className="casio-subtitle">Đầy đủ 13 chế độ như máy thật: Tính toán, Số phức, Hệ cơ số, Ma trận, Vectơ, Thống kê, Phân phối, Bảng tính, Bảng giá trị, Phương trình, Bất phương trình, Tỉ lệ, Kiểm chứng.</p>
        </div>
        <div className="casio-toolbar-actions">
          <div className="casio-angle-selector" title="Đơn vị góc (SETUP)">
            {[['deg', 'DEG'], ['rad', 'RAD'], ['gra', 'GRA']].map(([k, n]) => <button key={k} className={`angle-btn ${setup.angle === k ? 'active' : ''}`} onClick={() => setSetup(s => ({ ...s, angle: k }))}>{n}</button>)}
          </div>
          <button className={`sound-toggle-btn ${sound ? 'on' : ''}`} onClick={() => setSound(v => !v)}>{sound ? '🔊 Âm phím: Bật' : '🔇 Âm phím: Tắt'}</button>
        </div>
      </header>

      <div className="casio-workspace-grid">
        <aside className="casio-side-panel left-panel">
          <div className="panel-tab-nav">
            {[['guide', '⚙️ Hướng dẫn'], ['history', `🕒 Lịch sử (${history.length})`], ['memory', '💾 Biến nhớ']].map(([k, n]) => <button key={k} className={tab === k ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab(k)}>{n}</button>)}
          </div>
          <div className="panel-tab-body">
            {tab === 'guide' && (<div className="tab-pane-content">
              <section className="guide-card"><h3>🎯 Chế độ hiện tại</h3><p><strong>{modeInfo.title}</strong> ({modeInfo.en}). Bấm <code>MENU</code> để đổi chế độ, <code>SHIFT</code>+<code>MENU</code> để vào SETUP.</p></section>
              <section className="guide-card"><h3>🎨 Quy ước màu phím</h3><ul className="quick-guide-list"><li><strong className="tag-gold">Chữ vàng</strong>: bấm <b>SHIFT</b> trước.</li><li><strong className="tag-red">Chữ đỏ</strong>: bấm <b>ALPHA</b> trước.</li><li><strong className="tag-dark">OPTN</strong>: menu tùy chọn theo chế độ.</li><li><strong className="tag-dark">CALC</strong>: thay giá trị biến · <b>SHIFT+CALC</b> = SOLVE.</li></ul></section>
              <section className="guide-card shortcuts-card"><h3>⌨️ Phím tắt</h3>
                <div className="shortcut-row"><span>Số, phép tính</span><code>0-9 + - * /</code></div><div className="shortcut-row"><span>Tính</span><code>Enter</code></div><div className="shortcut-row"><span>Xóa / AC</span><code>Backspace / Esc</code></div><div className="shortcut-row"><span>Con trỏ</span><code>← →</code></div><div className="shortcut-row"><span>Lịch sử</span><code>↑ ↓</code></div><div className="shortcut-row"><span>Biến</span><code>A–F x y</code></div></section>
            </div>)}
            {tab === 'history' && (<div className="tab-pane-content history-pane">
              <div className="pane-header"><h3>Lịch sử phép tính</h3>{history.length > 0 && <button className="clear-history-btn" onClick={() => setHistory([])}>Xóa hết</button>}</div>
              {history.length === 0 ? <p className="empty-history">Chưa có phép tính nào.</p> : (<ol className="history-items-list">{history.map((h, i) => (<li key={i} className="history-item"><button onClick={() => { if (EXPR_MODES.has(mode)) { setFields(f => ({ ...f, expr: h.expr.replace(/^SOLVE /, '') })); setCursor(h.expr.length); } setResult({ text: h.text, value: h.value, error: false, lines: null }); }}><span className="hist-expr">{display(h.expr)}</span><span className="hist-res">= {h.text}</span></button></li>))}</ol>)}
            </div>)}
            {tab === 'memory' && (<div className="tab-pane-content memory-pane"><h3>Bộ nhớ & Biến số</h3>
              <div className="memory-row highlight"><span>Ans</span><strong>{show(ans, makeCtx(), {})}</strong></div>
              <div className="variables-grid">{VAR_KEYS.map(k => <div key={k} className="var-chip"><span>{k}:</span><strong>{isNum(vars[k]) ? fmtReal(vars[k], setup.fmt) : '…'}</strong></div>)}</div>
              <p className="note-text">Lưu biến: kết quả → <code>STO</code> → phím A…F, x, y, M. Gọi lại: <code>SHIFT</code>+<code>STO</code> (RCL).</p></div>)}
          </div>
        </aside>

        <section className="casio-center-stage">
          {toast && <div className="casio-toast-notification"><span>{toast}</span></div>}
          <div className="casio-device" id="casio-device">
            <div className="casio-top-chassis">
              <div className="casio-brand-row"><div className="casio-logo">CASIO</div><div className="casio-model-badge"><span className="model-name">fx-580VN X</span><span className="series-name">CLASSWIZ</span></div></div>
              <div className="casio-vpam-row"><span className="vpam-text">NATURAL-V.P.A.M.</span><div className="casio-solar-cell"><div className="solar-grid-line" /><div className="solar-grid-line" /><div className="solar-grid-line" /></div></div>
            </div>
            <div className="casio-screen-bezel"><div className="casio-screen-frame"><div className={`casio-lcd-panel ${EXPR_MODES.has(mode) ? '' : 'tall'}`}>
              {power && (<div className="lcd-status-line">
                <span className={`status-badge ${shift ? 'badge-on' : 'badge-off'}`}>S</span><span className={`status-badge ${alpha ? 'badge-on red' : 'badge-off'}`}>A</span>
                <span className={`status-badge ${hyp ? 'badge-on' : 'badge-off'}`}>hyp</span><span className={`status-badge ${vars.M !== 0 ? 'badge-on' : 'badge-off'}`}>M</span><span className={`status-badge ${sto ? 'badge-on' : 'badge-off'}`}>STO</span>
                <span className="status-badge badge-on deg-badge">{setup.angle === 'deg' ? 'D' : setup.angle === 'rad' ? 'R' : 'G'}</span>
                <span className="status-badge badge-on">{setup.fmt.fixN != null ? 'FIX' : setup.fmt.sciN != null ? 'SCI' : setup.fmt.eng ? 'ENG' : 'Math'}</span>
                <span className="status-badge badge-on mode-tag">{modeTag}</span>
                <div className="lcd-replay-arrows"><span className={history.length ? 'arrow-active' : ''}>▲</span><span className={history.length ? 'arrow-active' : ''}>▼</span></div>
              </div>)}
              <div className="lcd-body">{body()}</div>
            </div></div></div>
            <div className="casio-helper-ribbon"><span>{helper}</span></div>

            <div className="casio-keypad">
              <div className="keypad-nav-row">
                <div className="nav-side-col">{renderKey('shift')}{renderKey('alpha')}</div>
                <div className="replay-disc-container"><div className="replay-metallic-wheel">
                  <button className="replay-arrow-btn arrow-up" onClick={() => { click(sound); replay(1); }} aria-label="Replay Up" onMouseDown={e => e.preventDefault()}>▲</button>
                  <button className="replay-arrow-btn arrow-left" onClick={() => { click(sound); setCursor(c => Math.max(0, c - 1)); }} aria-label="Replay Left" onMouseDown={e => e.preventDefault()}>◄</button>
                  <div className="replay-center-hub"><span>REPLAY</span></div>
                  <button className="replay-arrow-btn arrow-right" onClick={() => { click(sound); setCursor(c => Math.min(exprText.length, c + 1)); }} aria-label="Replay Right" onMouseDown={e => e.preventDefault()}>►</button>
                  <button className="replay-arrow-btn arrow-down" onClick={() => { click(sound); replay(-1); }} aria-label="Replay Down" onMouseDown={e => e.preventDefault()}>▼</button>
                </div></div>
                <div className="nav-side-col">{renderKey('menu')}{renderKey('on')}</div>
              </div>
              {KEYPAD_ROWS.map((row, i) => <div key={i} className={`key-row ${row.length === 6 ? 'key-row-6' : 'key-row-5'}`}>{row.map(renderKey)}</div>)}
            </div>
            <div className="casio-bottom-chin" />
          </div>
          <p className="casio-disclaimer">Trình mô phỏng học tập độc lập, không phải sản phẩm chính thức của Casio. Không dùng trong phòng thi.</p>
        </section>

        <aside className="casio-side-panel right-panel">
          <div className="guide-header"><h3>📖 Cẩm nang bấm máy Casio 580</h3><span className="guide-badge">Kỳ thi THPT & Lớp 10-12</span></div>
          <div className="handbook-content">
            {[
              ['1. Phân số, căn, π (MathO)', <><p>• <span className="key-badge">■/□</span> nhập phân số; <span className="key-badge">S⇔D</span> đổi giữa <code>√2, 3/4, π/2</code> và số thập phân.</p><p>• <code>√8</code> → <code>2√2</code>; <code>sin(30)</code> → <code>1/2</code>.</p></>],
              ['2. Giải phương trình (SOLVE)', <><p>• Gõ <code>x^2=4</code> hoặc <code>2x+3=11</code> → <span className="key-badge gold">SHIFT</span>+<span className="key-badge">CALC</span>.</p><p>• Chế độ <b>A</b> (EQN): hệ 2–4 ẩn, đa thức bậc 2–4, nghiệm phức.</p></>],
              ['3. CALC: thay giá trị biến', <div key="calc-guide"><p>• Gõ <code>A*x^2+B</code> → <span className="key-badge">CALC</span> → nhập A, B, x → <span className="key-badge">=</span>. Lặp lại để đổi giá trị.</p></div>],
              ['4. Tích phân, đạo hàm, Σ', <><p>• <code>int(x^2,0,3)</code> = 9, <code>diff(x^3,2)</code> = 12.</p><p>• <code>sum(k^2,k,1,10)</code> = 385 (SHIFT + log▫).</p></>],
              ['5. Số phức / Ma trận / Vectơ', <><p>• MENU ▸ 2: <code>(1+2i)(3-i)</code>, Arg, Conjg, ∠.</p><p>• MENU ▸ 4/5: nhập MatA… rồi <code>MatA*MatB</code>, <code>det(MatA)</code>, <code>Dot(VctA,VctB)</code>.</p></>],
              ['6. Thống kê & Phân phối', <><p>• MENU ▸ 6: nhập dữ liệu → <b>Tính</b> → x̄, σ, Q1, Med, Q3, hồi quy A, B, r.</p><p>• MENU ▸ 7: Normal / Binomial / Poisson (PD, CD, Inverse).</p></>],
              ['7. Đổi cơ số, nCr, nPr, FACT', <><p>• MENU ▸ 3: DEC/HEX/BIN/OCT và and/or/xor.</p><p>• <span className="key-badge gold">SHIFT</span>+<span className="key-badge">÷</span> = nCr; <span className="key-badge gold">SHIFT</span>+<span className="key-badge">×</span> = nPr; <b>FACT</b> phân tích thừa số nguyên tố.</p></>],
            ].map(([t, c], i) => (<details key={t} className="handbook-item" open={i < 2}><summary>{t}</summary><div className="handbook-body">{c}</div></details>))}
          </div>
          <div className="support-box"><span className="dot-live" /><div><strong>Bàn phím tương tác 100%</strong><p>Bấm chuột trên máy hoặc gõ bàn phím. Trong các bảng nhập liệu, phím trên máy sẽ ghi vào ô đang chọn.</p></div></div>
        </aside>
      </div>
    </main>
    </FieldCtx.Provider>
  );
}
