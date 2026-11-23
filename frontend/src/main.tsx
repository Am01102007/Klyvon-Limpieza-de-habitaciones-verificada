import '@/index.css';
import '@/i18n';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

const contenedor = document.getElementById('root');

if (!contenedor) {
  throw new Error('No se encontró el contenedor raíz #root');
}

createRoot(contenedor).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
