import React from 'react';
import ReactDOM from 'react-dom/client';
import { RpcProvider } from './ApiProvider.js';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RpcProvider>
      <App />
    </RpcProvider>
  </React.StrictMode>,
);
