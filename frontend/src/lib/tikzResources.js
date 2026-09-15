// ResourceLoader interface used by TikZJax's tex() API.
// The .bin suffix prevents static servers from transparently decoding .gz twice.
export class TikzResources {
  constructor(base) { this.base = base; this.cache = new Map(); }

  load(name) {
    if (!this.cache.has(name)) {
      this.cache.set(name, (async () => {
        const response = await fetch(`${this.base}/${name}.bin`, { signal: AbortSignal.timeout(30_000) });
        if (!response.ok) throw new Error(`Không tải được tài nguyên TikZJax (${name}).`);
        const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      })());
    }
    return this.cache.get(name);
  }

  loadCoredump() { return this.load('core.dump.gz'); }
  loadBytecode() { return this.load('tex.wasm.gz'); }

  async loadTexFile(name) {
    if (!this.files) {
      this.files = this.load('tex_files.tar.gz').then(buffer => {
        const files = new Map();
        const decoder = new TextDecoder();
        const field = bytes => decoder.decode(bytes).split('\0')[0].trim();
        for (let offset = 0; offset + 512 <= buffer.length;) {
          const header = buffer.subarray(offset, offset + 512);
          if (header.every(byte => byte === 0)) break;
          const prefix = field(header.subarray(345, 500));
          const filename = (prefix ? prefix + '/' : '') + field(header.subarray(0, 100));
          const size = parseInt(field(header.subarray(124, 136)), 8);
          if (!Number.isFinite(size) || size < 0 || offset + 512 + size > buffer.length) throw new Error('Gói tài nguyên TeX không hợp lệ.');
          offset += 512;
          if (header[156] === 0 || header[156] === 48) {
            files.set(filename.replace(/^\.\//, '').replace(/^tex_files\//, ''), buffer.subarray(offset, offset + size));
          }
          offset += Math.ceil(size / 512) * 512;
        }
        return files;
      });
    }
    const files = await this.files;
    const key = name.replace(/^\//, '').replace(/^tex_files\//, '');
    if (!files.has(key)) throw new Error(`TikZJax không có gói ${key}.`);
    return files.get(key);
  }
}
