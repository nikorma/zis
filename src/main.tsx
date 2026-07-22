import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AppStoreProvider } from './state/AppStore';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppStoreProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AppStoreProvider>
  </React.StrictMode>
);
