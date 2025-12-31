import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/electron/main',
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  preload: {
    build: {
      outDir: 'dist/electron/preload'
    }
  },
  renderer: {
    root: './g3tzkp-messenger UI',
    build: {
      outDir: '../dist/electron/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'g3tzkp-messenger UI/index.html')
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'g3tzkp-messenger UI/src'),
        '@components': resolve(__dirname, 'g3tzkp-messenger UI/src/components'),
        '@stores': resolve(__dirname, 'g3tzkp-messenger UI/src/stores'),
        '@services': resolve(__dirname, 'g3tzkp-messenger UI/src/services'),
        '@types': resolve(__dirname, 'g3tzkp-messenger UI/src/types')
      }
    }
  }
});
