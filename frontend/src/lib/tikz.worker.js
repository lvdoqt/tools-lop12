import { Buffer } from 'buffer';
import { tex } from 'tikzjax-tex';
import { TikzResources } from './tikzResources';
import { dvi2html } from '@prinsss/dvi2html';

globalThis.Buffer = Buffer;
const loader = new TikzResources(new URL(`${import.meta.env.BASE_URL}tikzjax-assets/tex`, self.location.origin).href);

self.onmessage = async ({ data: source }) => {
  const log = console.log;
  const errors = [];
  console.log = (...parts) => {
    const line = parts.join(' ');
    if (/^!|^l\.\d+|Missing character:/.test(line)) errors.push(line);
  };
  try {
    const dvi = await tex(`\\begin{document}\n${source}\n\\end{document}`, {
      texPackages: { amsmath: '', amssymb: '' },
      tikzLibraries: 'arrows,arrows.meta,calc,angles,quotes,intersections,patterns,positioning,decorations.markings,shapes.geometric',
      showConsole: true,
    }, loader);
    if (errors.length) throw new Error(errors.slice(0, 6).join('\n'));
    // Only use the DVI converter: the package's optional DOM/SVGO path is Node-only.
    let svg = '';
    async function* chunks() { yield dvi; }
    await dvi2html(chunks(), { write(chunk) { svg += chunk.toString(); } });
    self.postMessage({ svg: svg.replaceAll('&#173;', '&#172;') });
  } catch (error) {
    self.postMessage({ error: error.message });
  } finally { console.log = log; }
};
