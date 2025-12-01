import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { QueryStateProvider } from './queryState.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryStateProvider>
      <App />
    </QueryStateProvider>
  </StrictMode>,
)
