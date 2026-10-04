import { evaluate, solveEquation, formatBase } from '../src/lib/casio/engine.js';
import { formatValue } from '../src/lib/casio/format.js';
import * as M from '../src/lib/casio/modes.js';

let pass = 0, failed = 0;
const base = (o = {}) => ({ angle: 'deg', vars: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, M: 0, x: 0, y: 0 }, ans: 0, complex: false, fmt: {}, exact: true, ...o });
function t(src, expected, o = {}) {
  const ctx = base(o);
  let got;
  try { const v = evaluate(src, ctx); got = formatValue(v, ctx, {}); } catch (e) { got = 'ERR:' + e.message; }
  if (got === expected) pass++; else { failed++; console.log(`FAIL  ${src}  => ${got}   (expected ${expected})`); }
}
function close(name, got, exp, tol = 1e-8) {
  if (Math.abs(got - exp) <= tol * Math.max(1, Math.abs(exp))) pass++; else { failed++; console.log(`FAIL  ${name}: ${got} vs ${exp}`); }
}

// basic
t('1+2*3', '7'); t('(1+2)*3', '9'); t('2^10', '1024'); t('-2^2', '-4'); t('2(3+4)', '14');
t('1/3', '1/3'); t('0.5', '1/2'); t('1/3+1/6', '1/2'); t('6/4', '3/2'); t('7!', '5040');
t('sqrt(2)', '√2'); t('sqrt(8)', '2√2'); t('sqrt(9)', '3'); t('sqrt(1/4)', '1/2');
t('pi/2', 'π/2'); t('2pi', '2π'); t('sin(30)', '1/2'); t('cos(60)', '1/2'); t('tan(45)', '1');
t('sin(90)', '1'); t('cos(90)', '0'); t('asin(0.5)', '30'); t('atan(1)', '45');
t('sin(pi/6)', '1/2', { angle: 'rad' }); t('cos(pi)', '-1', { angle: 'rad' });
t('log(1000)', '3'); t('ln(e)', '1'); t('logb(2,8)', '3'); t('cbrt(27)', '3'); t('root(4,16)', '2');
t('(-8)^(1/3)', '-2'); t('abs(-5)', '5'); t('5 nCr 2', '10'); t('5 nPr 2', '20'); t('10 nCr 3', '120');
t('50%*200', '100'); t('GCD(12,18)', '6'); t('LCM(4,6)', '12'); t('Rmdr(17,5)', '2'); t('Quot(17,5)', '3');
t('Int(-2.7)', '-2'); t('Intg(-2.7)', '-3'); t('sign(-3)', '-1'); t('Abs(3-5)', '2');
t('1/0', 'ERR:Math ERROR'); t('sqrt(-1)', 'ERR:Math ERROR'); t('ln(0)', 'ERR:Math ERROR'); t('2+', 'ERR:Syntax ERROR');
t('tan(90)', 'ERR:Math ERROR'); t('1+(2', '3'); t('sinh(0)', '0'); t('2^0.5', '√2');
t('1.2*10^3', '1200'); t('15°30\'0"', '31/2'); t('(1+2i)(3-i)', '5+5i', { complex: true });
t('sqrt(-4)', '2i', { complex: true }); t('i^2', '-1', { complex: true }); t('abs(3+4i)', '5', { complex: true });
t('(1+i)^2', '2i', { complex: true }); t('Conjg(2+3i)', '2-3i', { complex: true }); t('Re(2+3i)', '2', { complex: true });
t('2∠90', '2i', { complex: true }); t('1/(1+i)', '0.5-0.5i', { complex: true }); t('ln(-1)', '3.141592654i', { complex: true });
t('Ans*2', '0', {});
// variables
t('A+B', '5', { vars: { A: 2, B: 3, C: 0, D: 0, E: 0, F: 0, M: 0, x: 0, y: 0 } });
t('2x', '6', { vars: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, M: 0, x: 3, y: 0 } });
// calculus
t('int(x^2,0,3)', '9'); t('int(sin(x),0,pi)', '2', { angle: 'rad' }); t('diff(x^3,2)', '12'); t('sum(k^2,k,1,10)', '385'); t('prod(k,k,1,5)', '120');
t('int(1/x,1,e)', '1'); t('diff(sin(x),0)', '1', { angle: 'rad' });
// matrices
const mx = { A: { t: 'm', a: [[1, 2], [3, 4]] }, B: { t: 'm', a: [[0, 1], [1, 0]] } };
t('det(A)', '-2', { vars: { ...base().vars, ...mx } }); t('A*B', '[[2, 1], [4, 3]]', { vars: { ...base().vars, ...mx } });
t('A+B', '[[1, 3], [4, 4]]', { vars: { ...base().vars, ...mx } }); t('Trn(A)', '[[1, 3], [2, 4]]', { vars: { ...base().vars, ...mx } });
t('A^-1', '[[-2, 1], [1.5, -0.5]]', { vars: { ...base().vars, ...mx } }); t('A^2', '[[7, 10], [15, 22]]', { vars: { ...base().vars, ...mx } });
t('2*A', '[[2, 4], [6, 8]]', { vars: { ...base().vars, ...mx } }); t('Inv(A)', '[[-2, 1], [1.5, -0.5]]', { vars: { ...base().vars, ...mx } });
// vectors
const vx = { A: { t: 'v', a: [1, 2, 3] }, B: { t: 'v', a: [4, 5, 6] } };
t('Dot(A,B)', '32', { vars: { ...base().vars, ...vx } }); t('Cross(A,B)', '[-3, 6, -3]', { vars: { ...base().vars, ...vx } });
t('abs(A)', '√14', { vars: { ...base().vars, ...vx } }); t('A+B', '[5, 7, 9]', { vars: { ...base().vars, ...vx } });
// base-N
t('1010+11', '1101', { base: 2 }); t('FF+1', '100', { base: 16 }); t('17+1', '20', { base: 8 }); t('10+5', '15', { base: 10 });
t('1100 and 1010', '1000', { base: 2 }); t('1100 or 1010', '1110', { base: 2 }); t('1100 xor 1010', '110', { base: 2 });
t('not(0)', '11111111111111111111111111111111', { base: 2 }); t('neg(1)', 'FFFFFFFF', { base: 16 });
// verify
t('2+2=4', 'TRUE'); t('2+2=5', 'FALSE'); t('sin(x)^2+cos(x)^2=1', 'TRUE', { vars: { ...base().vars, x: 0.7 } });
// constants / conversion
t('K_c0', '299792458'); t('in_cm(10)', '127/5'); t('C_F(100)', '212'); t('F_C(212)', '100');
// formatting modes
t('1/3', '0.3333333333', { exact: false }); t('2/3', '0.6666666667', { exact: false });
t('100000/3', '33333.33333', { exact: false }); t('1/3', '0.333', { fmt: { fixN: 3 } }); t('12345.6789', '1.235×10^4', { fmt: { sciN: 4 } });
t('10^12', '1×10^12', { exact: false }); t('0.0000012', '1.2×10^-6', { exact: false });

// solver
close('solve x^2=4', solveEquation('x^2=4', base(), 1).x, 2);
close('solve 2x+3=11', solveEquation('2x+3=11', base(), 0).x, 4);
close('solve sin(x)=0.5', solveEquation('sin(x)=0.5', base(), 10).x % 360, 30, 1e-6);
close('solve e^x=10', solveEquation('exp(x)=10', base(), 1).x, Math.log(10));

// modes
const eq = M.solveSimultaneous([[1, 1, 3], [1, -1, 1]]); close('sim x', eq[0], 2); close('sim y', eq[1], 1);
const r2 = M.polyRoots([1, -3, 2]); close('quad r1', r2[0].re, 2); close('quad r2', r2[1].re, 1);
const rc = M.polyRoots([1, 0, 1]); close('complex im', Math.abs(rc[0].im), 1);
const r3 = M.polyRoots([1, -6, 11, -6]); close('cubic', r3[0].re, 1); close('cubic2', r3[2].re, 3);
const r4 = M.polyRoots([1, 0, -5, 0, 4]).map(r => r.re); close('quartic', r4[0], -2); close('quartic2', r4[3], 2);
const ineq = M.solveInequality([1, -3, 2], '>'); close('ineq', ineq.intervals.length, 2);
const ineq2 = M.solveInequality([1, -3, 2], '<='); close('ineq2', ineq2.intervals[0].lo, 1);
const s1 = M.oneVar([1, 2, 3, 4, 5]); close('mean', s1.mean, 3); close('sigma', s1.sigmaX, Math.SQRT2); close('s', s1.sX, Math.sqrt(2.5)); close('med', s1.Med, 3); close('Q1', s1.Q1, 1.5); close('Q3', s1.Q3, 4.5);
const rg = M.regression('lin', [1, 2, 3, 4], [2, 4, 6, 8]); close('lin A', rg.coef.A, 0); close('lin B', rg.coef.B, 2); close('lin r', rg.coef.r, 1);
const rq = M.regression('quad', [1, 2, 3, 4], [1, 4, 9, 16]); close('quad C', rq.coef.C, 1); close('quad B', rq.coef.B, 0);
const re = M.regression('exp', [0, 1, 2], [1, Math.E, Math.E ** 2]); close('exp B', re.coef.B, 1); close('exp A', re.coef.A, 1);
const rp = M.regression('pow', [1, 2, 3], [1, 4, 9]); close('pow B', rp.coef.B, 2);
close('predictY', rg.predictY(5), 10); close('predictX', rg.predictX(10)[0], 5);
close('normcdf', M.normCdf(-1.96, 1.96), 0.9500042097, 1e-8); close('normpdf', M.normPdf(0), 0.3989422804, 1e-9); close('norminv', M.normInv(0.975), 1.959963985, 1e-7);
close('binpdf', M.binPdf(2, 5, 0.5), 0.3125); close('bincdf', M.binCdf(2, 5, 0.5), 0.5); close('poipdf', M.poiPdf(2, 3), 0.2240418077, 1e-8); close('poicdf', M.poiCdf(2, 3), 0.4231900811, 1e-8);
close('ratio', M.solveRatio(2, 3, 4, null), 6); close('ratio2', M.solveRatio(null, 3, 4, 12), 1);
close('binInv', M.discreteInv(k => M.binCdf(k, 10, 0.5), 0.5), 5);

console.log(`\n${pass} passed, ${failed} failed`);
void formatBase;
process.exit(failed ? 1 : 0);
