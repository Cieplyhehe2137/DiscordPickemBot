import { createContext, useContext } from 'react';

// Sam kontekst i hook, bez komponentu - provider siedzi w
// PublicAuthProvider.jsx. Powód rozdzielenia jak w AppContext.js.
export const PublicAuthContext = createContext(null);

export function usePublicAuth() {
    return useContext(PublicAuthContext);
}
