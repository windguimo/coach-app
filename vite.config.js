import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE } from './src/data/content.js'

// The real, deployed URL — needed as an absolute value for Open Graph/
// Twitter Card tags (link-preview crawlers don't reliably resolve relative
// image/url tags the way browsers do). Update if the app ever moves off
// this GitHub Pages path.
const SITE_URL = 'https://windguimo.github.io/coach-app/'

// Replaces %APP_NAME%/%APP_TAGLINE% in index.html so the app's name has
// exactly one source (src/data/content.js) instead of being hand-copied
// into the HTML too.
function injectAppInfo() {
  return {
    name: 'inject-app-info',
    transformIndexHtml(html) {
      return html.replaceAll('%APP_NAME%', APP_NAME).replaceAll('%APP_TAGLINE%', APP_TAGLINE).replaceAll('%SITE_URL%', SITE_URL)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    injectAppInfo(),
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
