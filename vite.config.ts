import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const phaserRoot = dirname(createRequire(import.meta.url).resolve('phaser/package.json'));
const videoPolyfill = readFileSync(join(phaserRoot, 'src/polyfills/requestVideoFrame.js'), 'utf8')
  .replaceAll('\r\n', '\n').trim();
const phaserModule = join(phaserRoot, 'dist/phaser.esm.js').replaceAll('\\', '/');

const omitUnusedVideo: Plugin = {
  name: 'omit-unused-video-polyfill',
  enforce: 'pre',
  transform(code, id) {
    if (id.replaceAll('\\', '/').split('?')[0] !== phaserModule) return;
    // Phaser includes a GPL video polyfill. This game uses no video.
    const source = code.replaceAll('\r\n', '\n');
    const first = source.indexOf(videoPolyfill);
    if (!videoPolyfill || first < 0 || first !== source.lastIndexOf(videoPolyfill)) {
      this.error('Phaser video polyfill changed; review its removal before upgrading Phaser.');
    }
    const stripped = source.replace(videoPolyfill, '');
    // The optimizer otherwise puts the original source back into its debug map.
    return {
      code: stripped,
      map: { version: 3, sources: [id], sourcesContent: [stripped], names: [], mappings: '' },
    };
  },
};

export default defineConfig({
  base: '/',
  // Apply the same omission before development pre-bundling and production builds.
  optimizeDeps: { rolldownOptions: { plugins: [omitUnusedVideo] } },
  plugins: [omitUnusedVideo],
  build: { target: 'es2022' },
});
