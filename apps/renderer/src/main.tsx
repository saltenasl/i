import ReactDOM from 'react-dom/client';
import { RpcProvider } from './ApiProvider.js';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <RpcProvider>
    <App />
  </RpcProvider>,
);
