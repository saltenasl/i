import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApiProvider } from './ApiProvider.js';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ApiProvider>
      <App />
    </ApiProvider>
  </React.StrictMode>,
);
