import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { ToastProvider } from "./components/ui/ToastProvider.jsx";
import { ConfirmProvider } from "./components/ui/ConfirmProvider.jsx";

import { registerServiceWorker } from "./lib/serviceWorker.js";

import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/* Powiadomienia i okno "na pewno?" stoją nad całą aplikacją, bo
            sięga po nie każda strona, a obie rzeczy mają istnieć w jednym
            egzemplarzu - inaczej dwa stosy powiadomień zasłaniałyby się
            nawzajem. */}
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

registerServiceWorker();
