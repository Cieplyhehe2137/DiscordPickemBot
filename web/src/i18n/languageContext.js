import { createContext } from "react";

// Sam kontekst mieszka osobno od LanguageProvider, bo Fast Refresh działa
// tylko wtedy, gdy plik z komponentem eksportuje wyłącznie komponenty.
// Tak samo stoi to przy logowaniu (auth/authContext.js).
export const LanguageContext = createContext(null);
