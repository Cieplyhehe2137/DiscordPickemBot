import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './index.css';
import App from './App.jsx';

import { AppProvider } from './context/AppContext';
import { PublicAuthProvider } from './context/PublicAuthContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <PublicAuthProvider>
          <App />
        </PublicAuthProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
);