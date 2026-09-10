// Konfiguracja ESLinta z jedna regula: no-undef.
//
// Serwer nie ma lintera, a przy rozbijaniu app.js to wlasnie ta regula lapie
// blad, ktorego nie zlapie nic innego. Kontrola tablicy tras (npm run routes)
// dowodzi, ze trasy sie rejestruja - nie dowodzi, ze handlery dzialaja. Jesli
// przy przenoszeniu grupy tras zapomne przekazac jednej zaleznosci, plik nadal
// sie sparsuje, trasy nadal sie zarejestruja, a ReferenceError wyjdzie dopiero
// przy zapytaniu na produkcji. no-undef widzi to statycznie.
//
// Zadnych regul stylu - to nie jest miejsce na porzadkowanie 11 tysiecy linii,
// tylko na jedna klase realnych bledow.
//
// Globalne wypisane recznie, zeby konfiguracja nie zalezala od pakietu
// `globals` - dzieki temu dziala tak samo lokalnie i w CI.

const NODE_GLOBALS = {
  AbortController: "readonly",
  AbortSignal: "readonly",
  Blob: "readonly",
  Buffer: "readonly",
  Headers: "readonly",
  Request: "readonly",
  Response: "readonly",
  TextDecoder: "readonly",
  TextEncoder: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  clearImmediate: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  exports: "writable",
  fetch: "readonly",
  global: "readonly",
  globalThis: "readonly",
  module: "writable",
  process: "readonly",
  queueMicrotask: "readonly",
  require: "readonly",
  setImmediate: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  structuredClone: "readonly",
};

export default [
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: NODE_GLOBALS,
    },
    rules: {
      "no-undef": "error",
    },
  },
];
