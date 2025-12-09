import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import WorkflowWizard from './components/workflow-editor/WorkflowWizard.jsx'
import { QueryStateProvider } from './queryState.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <QueryStateProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/workflow-generator" element={<WorkflowWizard />} />
        </Routes>
      </QueryStateProvider>
    </BrowserRouter>
  </StrictMode>,
)
