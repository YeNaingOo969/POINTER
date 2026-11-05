import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// One HTML file per page. Add new pages here as they are built.
const pages = {
  main: 'index.html',
  explore: 'explore.html',
  place: 'place.html',
};

export default defineConfig({
  server: {
    // assets/ is source material only; keep Vite from watching large raw files.
    watch: { ignored: ['**/assets/**'] },
  },
  optimizeDeps: {
    // MapLibre 6 loads its tile worker as a separate file; serving the library unbundled keeps
    // the worker import (see src/map/map.js) pointing at the real file in dev.
    exclude: ['maplibre-gl'],
  },
  build: {
    target: 'es2022',
    // MapLibre alone is ~1 MB minified (~300 KB gzip); warn only above that.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(pages).map(([name, file]) => [name, resolve(import.meta.dirname, file)]),
      ),
      output: {
        // Vite 8 (Rolldown) only accepts the function form. MapLibre and Three.js get their own
        // chunks so app changes don't bust their cache.
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl/')) return 'maplibre';
          if (id.includes('node_modules/three/')) return 'three';
        },
      },
    },
  },
});
