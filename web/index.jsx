import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './global.css';
import App from './App';

// Entry point (index.html loads this). Mounts App into #root.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
