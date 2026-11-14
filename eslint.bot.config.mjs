// Konfiguracja lintera dla BOTA - jedna regula, ta sama co na serwerze.
//
// PO CO. Serwer ma `npm run lint` z regula no-undef od czasu rozbijania
// app.js, bo to jedyna kontrola, ktora widzi STATYCZNIE zmienna poza
// zasiegiem. Bot nie mial lintera wcale - i to nie jest teoretyczny brak.
// Pierwsze uruchomienie tej konfiguracji na handlerach znalazlo jedenascie
// takich miejsc w trzech plikach, w tym cala niedzialajaca komende:
//
//   handlers/admin/confirmEndPickem.js    piec razy bare logWarn/logInfo/
//                                         logError przy `const logger = ...`,
//                                         czyli ReferenceError na pierwszym
//                                         logu NORMALNEJ sciezki - przycisk
//                                         "potwierdz zakonczenie typowania"
//                                         nie dzialal dla nikogo;
//   handlers/teams/teamsDeleteConfirm.js  blok catch z kopia sciezki sukcesu
//                                         na zmiennych spoza zasiegu;
//   utils/teamsStore.js                   bare logInfo w migracji teams.json.
//
// Zadnego z nich nie wylapaly testy, bo 118 handlerow bota nie ma testow -
// kazdy potrzebuje atrapy interakcji Discorda.
//
// CZEMU no-unused-vars JEST WYLACZONE, a na serwerze jest bledem. Bo w kodzie
// bota ma 56 trafien w 37 plikach i w 50 przypadkach jest to ta sama rzecz:
// plik bierze `{ logInfo, logWarn }`, a uzywa jednego z nich. Nic z tego nie
// psuje sie w dzialaniu. Ostrzezenie, ktorego nikt nie czyta, uczy ignorowania
// wyjscia lintera - a to kosztuje wiecej niz te 56 nieuzywanych nazw.
//
// Zeby je zobaczyc, gdyby ktos chcial je kiedys posprzatac:
//
//   node server/node_modules/eslint/bin/eslint.js --no-config-lookup \
//     --config server/tools/noUndef.config.mjs handlers utils commands
//
// LINTER BIERZE SIE Z server/node_modules. Korzen repozytorium nie ma zadnych
// devDependencies i nie dokladam ich dla jednej reguly: serwer i tak musi byc
// zainstalowany, zeby API dzialalo, a eslint stoi tam od dawna.

import bazowa from "./server/tools/noUndef.config.mjs";

export default [
  // Co NIE jest kodem bota. server/ i web/ maja wlasne lintery i wlasne
  // reguly; reszta to katalogi, ktore nie sa zrodlem.
  {
    ignores: [
      "node_modules/**",
      "server/**",
      "web/**",
      "archiwum/**",
      "backup/**",
      "logs/**",
      "data/**",
      ".claude/**",
    ],
  },

  ...bazowa,

  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    rules: {
      "no-unused-vars": "off",
    },
  },
];
