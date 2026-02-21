import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface Window {
    __pwa_deferred_prompt?: BeforeInstallPromptEvent | null
    __show_pwa_install_prompt?: () => void
  }
}

window.addEventListener('beforeinstallprompt', (event: Event) => {
  event.preventDefault()
  const promptEvent = event as BeforeInstallPromptEvent
  window.__pwa_deferred_prompt = promptEvent
  window.dispatchEvent(new Event('pwa:available'))
})

window.addEventListener('appinstalled', () => {
  window.__pwa_deferred_prompt = null
  window.dispatchEvent(new Event('pwa:installed'))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
