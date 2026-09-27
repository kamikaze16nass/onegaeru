import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import './mascot.css'
import './navigation.css'
import './ui-system.css'
import App from './App'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
