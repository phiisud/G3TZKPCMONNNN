import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [
    react()
  ],
  base: './',
  define: {
    'process.env': {},
    'global': 'globalThis',
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    strictPort: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    hmr: false,
    ...(mode === 'development' ? {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/media': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('[WS Proxy] Error:', err.message);
            });
            proxy.on('proxyReqWs', (_proxyReq, req, _socket) => {
              console.log('[WS Proxy] WebSocket request:', req.url);
            });
          },
        },
      },
    } : {}),
  },
  build: {
    target: 'ES2020',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 5000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'ui-vendor': ['lucide-react', 'zustand'],
        },
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'lucide-react',
      'zustand',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@assets': path.resolve(__dirname, './attached_assets'),
      '@zip.js/zip.js/lib/zip-no-worker.js': '@zip.js/zip.js',
      'libp2p': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/webrtc': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/websockets': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/websockets/filters': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/circuit-relay-v2': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/identify': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/ping': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/fetch': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/kad-dht': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/bootstrap': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/mplex': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/peer-id': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/crypto/keys': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/crypto': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@libp2p/interface': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@chainsafe/libp2p-noise': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@chainsafe/libp2p-gossipsub': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@chainsafe/libp2p-yamux': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
      '@multiformats/multiaddr': path.resolve(__dirname, './src/lib/libp2p-runtime.ts'),
    },
  },
  worker: {
    format: 'es',
  },
}))
