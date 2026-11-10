import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Simpan HTML awal (sebelum render) agar penampil bisa memuat salinan halaman di iframe pada build satu-file.
(window as unknown as { __selfHtml?: string }).__selfHtml = '<!doctype html>' + document.documentElement.outerHTML;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
