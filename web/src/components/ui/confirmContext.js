import { createContext } from "react";

// Kontekst osobno od providera - Fast Refresh wymaga, żeby plik z komponentem
// eksportował wyłącznie komponenty.
export const ConfirmContext = createContext(null);
