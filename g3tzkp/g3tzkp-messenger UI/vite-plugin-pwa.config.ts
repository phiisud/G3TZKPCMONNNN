import { VitePWA } from 'vite-plugin-pwa';

export const pwaConfig = VitePWA({
  registerType: 'prompt',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
  manifest: {
    name: 'G3TZKP Messenger',
    short_name: 'G3TZKP',
    description: 'Zero-Knowledge Proof Messenger',
    theme_color: '#00f3ff',
    background_color: '#010401',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable any'
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable any'
      }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'osm-tiles',
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 60 * 60 * 24 * 30
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      {
        urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'nominatim-api',
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24
          }
        }
      }
    ]
  },
  devOptions: {
    enabled: false
  }
});
