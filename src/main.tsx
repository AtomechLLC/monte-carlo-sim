import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted type, LATIN SUBSETS ONLY — no CDN, because a static bundle that has to work
// offline cannot depend on a third party being reachable. Three files, deliberately: the
// display face at its one variable weight axis, and the sans at exactly the two weights the
// app's locked type scale uses (400 and 600). Adding a fourth import means adding a weight or
// a subset, which is a type-scale decision, not a plumbing one. See src/fonts.css for why
// Bodoni is declared by hand while Plex comes straight from its package entry points.
import './fonts.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
