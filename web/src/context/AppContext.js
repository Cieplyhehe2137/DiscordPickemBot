import { createContext, useContext } from "react";

// Sam kontekst i hook, bez komponentu - provider siedzi w AppProvider.jsx.
// Plik zawierający komponent może eksportować wyłącznie komponenty, inaczej
// Vite wyłącza dla niego fast refresh (react-refresh/only-export-components).
export const AppContext = createContext();

export function useApp() {
  return useContext(AppContext);
}
