import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Sonko — Ugandan Courtyard Hopscotch',
          short_name: 'Sonko',
          description:
            'Traditional Ugandan courtyard hopscotch of stone tossing, single-foot balance, and claiming houses on sunlit red earth.',
          theme_color: '#1F100B',
          background_color: '#1F100B',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff,woff2,txt,mp3,ogg,wav}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/ws/,
            /^\/ads\.txt$/,
            /^\/robots\.txt$/,
            /^\/sitemap\.xml$/,
            /^\/(about|how-to-play|privacy-policy|terms|contact)(\.html)?$/,
          ],
          runtimeCaching: [
            {
              urlPattern: /^\/src\/assets\/images\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'sonko-courtyard-images',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          // Disabled in dev because HMR WebSockets are off in AI Studio preview (production build retains full SW)
          enabled: false,
        },
      }),
      {
        name: 'inject-adsense-head-build',
        apply: 'build',
        transformIndexHtml(html: string): string {
          const clientId = String(
            process.env.ADSENSE_CLIENT_ID || process.env.VITE_ADSENSE_CLIENT_ID || ''
          ).trim();
          if (!/^ca-pub-\d{10,20}$/.test(clientId)) {
            return html;
          }
          if (html.includes('name="google-adsense-account"')) {
            return html;
          }
          const testAttr =
            String(process.env.ADSENSE_TEST_MODE || process.env.VITE_ADSENSE_TEST_MODE || '')
              .trim()
              .toLowerCase() === 'true'
              ? ' data-adbreak-test="on"'
              : '';
          const snippet = [
            `    <meta name="google-adsense-account" content="${clientId}" />`,
            `    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}" crossorigin="anonymous"${testAttr}></script>`,
            `    <script>window.adsbygoogle=window.adsbygoogle||[];var adBreak=adConfig=function(o){window.adsbygoogle.push(o);};</script>`,
          ].join('\n');
          return html.replace('</head>', `${snippet}\n  </head>`);
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
