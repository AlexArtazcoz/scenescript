import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La mateixa veu tipogràfica que el portfoli (alexartazcoz.github.io)
import '@fontsource-variable/archivo'
import './index.css'
import App from './App.tsx'
import { COL_W, COL_W_READING } from './constants'

// El CSS llegeix les mateixes amplades de columna que el codi (responsives
// en pantalles petites) — una sola font de veritat a constants.ts.
document.documentElement.style.setProperty('--column-width', `${COL_W}px`)
document.documentElement.style.setProperty('--column-width-reading', `${COL_W_READING}px`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
