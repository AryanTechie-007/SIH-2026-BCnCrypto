import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// The built UI runs from disk inside the desktop app and may load nothing from the network.
// Only for builds: the dev server's hot reload needs inline scripts.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

const contentSecurityPolicy = (): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }
  ]
})

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths: the desktop app loads the build from a file:// URL.
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  }
})
