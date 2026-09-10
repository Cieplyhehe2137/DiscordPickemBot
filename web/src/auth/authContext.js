import { createContext } from "react";

// Sam kontekst mieszka osobno od AuthProvider, bo Fast Refresh dziala tylko
// wtedy, gdy plik z komponentem eksportuje wylacznie komponenty.
export const AuthContext = createContext(null);
