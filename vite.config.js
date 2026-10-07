import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { APP_NAME, APP_SHORT_NAME } from './src/data/content.js'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // injectManifest (not generateSW): src/sw.js is our own service
      // worker (push notifications, offline fallback) — the plugin only
      // injects the precache list into it, it doesn't generate one for us.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        // App shell only — no Supabase requests are ever precached, they
        // aren't part of the build output this globs over.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: APP_NAME,
        short_name: APP_SHORT_NAME,
        lang: 'fr',
        // Relative, not "/…" — deployed to a GitHub Pages subpath
        // (windguimo.github.io/coach-app/) with HashRouter, so an
        // absolute start_url/scope would resolve to the wrong origin path.
        start_url: './?source=pwa',
        scope: './',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#c6f04a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
