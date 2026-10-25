// Publiczne API typowania - spis tresci.
//
// Stalo tu czternascie tras w jednym nieprzerwanym ciagu i 2939 linii:
// statystyki gracza, typy meczowe, cztery formularze faz i pobieranie
// archiwum. Nie byla to jedna dziedzina, tylko jeden ciag rejestracji - i
// wlasnie dlatego dalo sie go rozlozyc na moduly bez zmiany zachowania.
//
// KOLEJNOSC WYWOLAN PONIZEJ JEST KONTRAKTEM. Express bierze pierwsza pasujaca
// trase, wiec przestawienie dwoch wierszy w tej funkcji potrafi zmienic
// zachowanie, nie zmieniajac ani jednej linii w handlerach. Stoja wiec w tej
// samej kolejnosci, w jakiej staly trasy przed podzialem, a npm run routes
// porownuje cala tablice tras - w obu trybach i z kolejnoscia - ze wzorcem.
//
// Zaleznosci (33) ida dalej JAWNYMI listami, osobno do kazdego modulu, a nie
// jednym workiem. Nie jest to upodobanie: npm run deps porownuje liste podana
// w wywolaniu z lista destrukturyzowana w module i zglasza zarowno brak, jak
// i nadmiar - ale umie to zrobic wylacznie dla literalu wypisanego na miejscu.
// Worek podany zmienna jest dla tego narzedzia niewidoczny, a to narzedzie
// jest tu jedyna kontrola, ktora widzi brakujaca zaleznosc STATYCZNIE: bez
// niego trasa rejestruje sie normalnie i wywala sie dopiero przy zapytaniu.
//
// Wywolanie tej funkcji stoi w server/routes/matchOps.js - tam, gdzie te
// trasy staly w app.js - a nie w samym app.js, mimo ze to on podaje
// zaleznosci. Tak samo jak przy pozostalych modulach: wywolanie zostaje
// w miejscu, w ktorym byly trasy, bo kolejnosc jest zachowaniem.

import { registerPublicArchiveDownloadRoutes } from "./publicArchiveDownload.js";
import { registerPublicMyStatsRoutes } from "./publicMyStats.js";
import { registerPublicPickemDoubleElimRoutes } from "./publicPickemDoubleElim.js";
import { registerPublicPickemPlayinRoutes } from "./publicPickemPlayin.js";
import { registerPublicPickemPlayoffsRoutes } from "./publicPickemPlayoffs.js";
import { registerPublicPickemSwissRoutes } from "./publicPickemSwiss.js";
import { registerPublicPredictionRoutes } from "./publicPredictions.js";

export function registerPublicPickemRoutes(
  app,
  {
    assertPredictionsAllowed,
    calculateCommunityAnalysis,
    calculateContrarianStats,
    calculateMapAccuracy,
    calculatePlayerStyle,
    calculateRecentForm,
    calculateStreaks,
    calculateTeamStats,
    calculateTrendStats,
    fs,
    getBoStats,
    getOpenEventId,
    getPhaseLimits,
    isGuildMember,
    isMapExact,
    isMapWinnerCorrect,
    isMatchDeadlinePassed,
    isMatchLocked,
    isSeriesExact,
    isWinnerCorrect,
    toWebMessage,
    loadActiveTeams,
    matchPanelPhaseFor,
    parseCsvPick,
    path,
    percentageNumber,
    checkPickemGate,
    countParticipants,
    pool,
    runInTransaction,
    sprawdzTyp,
    validateCs2Score,
    validateSeriesMapOrder,
  },
) {
  // GET /api/public/events/:slug/my-stats
  registerPublicMyStatsRoutes(app, {
    calculateCommunityAnalysis,
    calculateContrarianStats,
    calculateMapAccuracy,
    calculatePlayerStyle,
    calculateRecentForm,
    calculateStreaks,
    calculateTeamStats,
    calculateTrendStats,
    countParticipants,
    getBoStats,
    isGuildMember,
    isMapExact,
    isMapWinnerCorrect,
    isSeriesExact,
    isWinnerCorrect,
    percentageNumber,
    pool,
  });

  // POST /api/public/matches/:matchId/prediction
  // GET  /api/public/matches/:matchId/prediction
  // GET  /api/public/events/:eventId/predictions/:userId
  registerPublicPredictionRoutes(app, {
    assertPredictionsAllowed,
    isGuildMember,
    isMatchDeadlinePassed,
    isMatchLocked,
    matchPanelPhaseFor,
    pool,
    runInTransaction,
    toWebMessage,
    validateCs2Score,
    validateSeriesMapOrder,
  });

  // POST /api/public/events/:slug/swiss-pickem/:stage
  // GET  /api/public/events/:slug/swiss-pickem/:stage
  // GET  /api/public/events/:slug/swiss-stats/:stage
  registerPublicPickemSwissRoutes(app, {
    checkPickemGate,
    getOpenEventId,
    getPhaseLimits,
    isGuildMember,
    loadActiveTeams,
    parseCsvPick,
    pool,
    sprawdzTyp,
    toWebMessage,
  });

  // GET  /api/public/events/:slug/playin-pickem
  // POST /api/public/events/:slug/playin-pickem
  registerPublicPickemPlayinRoutes(app, {
    checkPickemGate,
    getOpenEventId,
    getPhaseLimits,
    isGuildMember,
    loadActiveTeams,
    parseCsvPick,
    pool,
    sprawdzTyp,
    toWebMessage,
  });

  // GET  /api/public/events/:slug/playoffs-pickem
  // POST /api/public/events/:slug/playoffs-pickem
  registerPublicPickemPlayoffsRoutes(app, {
    checkPickemGate,
    getOpenEventId,
    getPhaseLimits,
    isGuildMember,
    loadActiveTeams,
    parseCsvPick,
    pool,
    sprawdzTyp,
    toWebMessage,
  });

  // GET  /api/public/events/:slug/doubleelim-pickem
  // POST /api/public/events/:slug/doubleelim-pickem
  registerPublicPickemDoubleElimRoutes(app, {
    checkPickemGate,
    getOpenEventId,
    getPhaseLimits,
    isGuildMember,
    loadActiveTeams,
    parseCsvPick,
    pool,
    sprawdzTyp,
    toWebMessage,
  });

  // GET /api/public/archives/:id/download
  //
  // Z typowaniem nie ma nic wspolnego i nigdy nie mialo. Wywolanie zostaje
  // na swoim miejscu w kolejnosci, bo przestawienie go byloby zmiana
  // zachowania - ale sam kod ma juz wlasny plik.
  registerPublicArchiveDownloadRoutes(app, { fs, path, pool });
}
