import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { G3ZKPProvider } from './contexts/G3ZKPContext';
import './index.css';

console.log('[MAIN] Starting React app...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[MAIN] Root element not found!');
  throw new Error('Root element not found');
}

console.log('[MAIN] Root element found, rendering React...');

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <G3ZKPProvider>
        <App />
      </G3ZKPProvider>
    </React.StrictMode>
  );
  console.log('[MAIN] React render called successfully');
} catch (error) {
  console.error('[MAIN] React render error:', error);
}
