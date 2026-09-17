import { mathjax } from 'mathjax-full/js/mathjax.js';
import { MathML } from 'mathjax-full/js/input/mathml.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const renderer = mathjax.document('', { InputJax: new MathML(), OutputJax: new SVG({ fontCache: 'none' }) });

export function renderFormula(formula) {
  const container = renderer.convert(formula.mathml, { display: false });
  const svg = adaptor.firstChild(container);
  if (adaptor.outerHTML(svg).includes('data-mjx-error')) throw new Error(`Không dựng được công thức: ${formula.latex}`);
  const [, y, w, h] = adaptor.getAttribute(svg, 'viewBox').split(/\s+/).map(Number);
  const width = Math.max(1, w * 12 / 1000);
  const height = Math.max(1, h * 12 / 1000);
  const baseline = Math.max(0, (y + h) * 12 / 1000);
  adaptor.setAttribute(svg, 'width', `${width}pt`);
  adaptor.setAttribute(svg, 'height', `${height}pt`);
  adaptor.setAttribute(svg, 'xmlns', 'http://www.w3.org/2000/svg');
  return { svg: adaptor.outerHTML(svg).replaceAll('currentColor', '#000000'), width, height, baseline };
}

if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.onmessage = ({ data }) => {
    try {
      const previews = {};
      for (const [index, formula] of data.entries()) {
        previews[formula.id] = renderFormula(formula);
        if (index % 10 === 0) self.postMessage({ progress: index + 1, total: data.length });
      }
      self.postMessage({ previews });
    } catch (error) { self.postMessage({ error: error.message }); }
  };
}
