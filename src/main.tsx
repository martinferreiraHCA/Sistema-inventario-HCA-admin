import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!;

try {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  root.innerHTML = `
    <div style="padding:40px;font-family:sans-serif;color:#252525">
      <h1 style="color:#BF1818">Error al iniciar la aplicacion</h1>
      <pre style="background:#f5f5f5;padding:16px;border-radius:8px;margin-top:16px;overflow:auto">${err}</pre>
    </div>
  `;
}
