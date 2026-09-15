import { cpSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Self-host the pinned package's WASM, TeX files and fonts for reliable rendering.
const source = new URL('../node_modules/isomorphic-tikzjax/', import.meta.url);
const destination = new URL('../public/tikzjax-assets/', import.meta.url);
mkdirSync(destination, { recursive: true });
for (const name of ['css', 'LICENSE']) {
  cpSync(fileURLToPath(new URL(name, source)), fileURLToPath(new URL(name, destination)), { recursive: true });
}
mkdirSync(new URL('tex/', destination), { recursive: true });
for (const name of ['core.dump.gz', 'tex.wasm.gz', 'tex_files.tar.gz']) {
  copyFileSync(new URL(`tex/${name}`, source), new URL(`tex/${name}.bin`, destination));
}
