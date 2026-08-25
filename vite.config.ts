/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is only non-root for a production build: the app deploys as a GitHub Pages PROJECT
// site at https://atomechllc.github.io/monte-carlo-sim/, so built asset URLs must carry that
// prefix. `vite dev` and Vitest keep base '/' so `import.meta.env.BASE_URL` stays '/' there —
// that is what lets the runtime-composed card paths change for deployment without touching the
// test suites that pin literal '/cards/...' strings.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/monte-carlo-sim/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}))
