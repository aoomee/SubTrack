import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/inter/wght.css'
import './index.css'
import './i18n/config' // Import i18n configuration
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Dismiss preloader smoothly on the next frame once React has mounted
requestAnimationFrame(() => {
  const preloader = document.getElementById('app-preloader')
  if (preloader && !preloader.classList.contains('is-hiding')) {
    preloader.classList.add('is-hiding')
    window.setTimeout(() => preloader.remove(), 200)
  }
})
