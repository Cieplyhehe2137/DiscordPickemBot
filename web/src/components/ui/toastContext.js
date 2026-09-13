import { createContext } from "react";

// Kontekst mieszka osobno od providera - Fast Refresh działa tylko wtedy, gdy
// plik z komponentem eksportuje wyłącznie komponenty. Ten sam podział co
// w auth/authContext.js.
export const ToastContext = createContext(null);
