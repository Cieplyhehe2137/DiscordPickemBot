import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { LanguageProvider } from "./i18n/LanguageProvider.jsx";
import { ToastProvider } from "./components/ui/ToastProvider.jsx";
import { ConfirmProvider } from "./components/ui/ConfirmProvider.jsx";

import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      {/* Język NAJWYŻEJ, nad wszystkim innym: po napisy sięgają nie tylko
          strony, ale też powiadomienia i okno "na pewno?", więc musi być
          dostępny, zanim tamte w ogóle powstaną. */}
      <LanguageProvider>
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
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
