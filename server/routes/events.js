// Rdzen API turnieju - spis tresci.
//
// Stalo tu 1744 linie: piec tras i w srodku nich funkcja na 864 linie,
// liczaca caly ranking. Nie byla to jedna dziedzina, tylko jeden ciag
// rejestracji - lista turniejow, strona turnieju, jego mecze, ranking
// i zmiana stanu.
//
// KOLEJNOSC WYWOLAN PONIZEJ JEST KONTRAKTEM. Express bierze pierwsza
// pasujaca trase, wiec przestawienie dwoch wierszy w tej funkcji potrafi
// zmienic zachowanie, nie zmieniajac ani jednej linii w handlerach. Stoja
// wiec w tej samej kolejnosci, w jakiej staly trasy przed podzialem, a
// npm run routes porownuje cala tablice tras - w obu trybach i z kolejnoscia -
// ze wzorcem.
//
// Zaleznosci (22) ida dalej JAWNYMI listami, osobno do kazdego modulu.
// npm run deps porownuje liste podana w wywolaniu z lista destrukturyzowana
// w module i zglasza zarowno brak, jak i nadmiar - ale umie to zrobic
// wylacznie dla literalu wypisanego na miejscu, nie dla worka podanego
// zmienna. To jedyna kontrola, ktora widzi brakujaca zaleznosc STATYCZNIE:
// bez niej trasa rejestruje sie normalnie i wywala sie dopiero przy zapytaniu.

import { registerActiveEventRoutes } from "./activeEvents.js";
import { registerEventLeaderboardRoutes } from "./eventLeaderboard.js";
import { registerEventMatchListRoutes } from "./eventMatchList.js";
import { registerEventStatusRoutes } from "./eventStatus.js";
import { registerEventSummaryRoutes } from "./eventSummary.js";

export function registerEventRoutes(
  app,
  {
    countParticipants,
    VALID_PHASES,
    assertPredictionsAllowed,
    emitDashboardRefresh,
    findPanelForDeadline,
    findPanelForMatchDeadline,
    getEventPickemConfig,
    getOpenEventId,
    guildIdFromEventSlug,
    guildRegistry,
    hasAdminPermission,
    io,
    normalizePhase,
    parseDeadlineInput,
    checkPickemGate,
    pool,
    registerGuildRoutes,
    requireGuildAdmin,
    // Stawka za trafionego zwyciezce serii, z rules/scoring.js. Tak samo
    // jak w trasie profilu: trzecia os rankingu wycenia zarobione trafienia
    // ta sama liczba, co kafelek na profilu, zamiast miec wlasna kopie.
    scoring,
    buildMatchesWithPickSql,
    resolveMatchPredictionState,
    teamsStore,
  },
) {
  // GET /api/events/active
  registerActiveEventRoutes(app, { pool });

  // GET /api/events/:slug/summary
  registerEventSummaryRoutes(app, {
    checkPickemGate,
    countParticipants,
    getEventPickemConfig,
    getOpenEventId,
    normalizePhase,
    pool,
  });

  // GET /api/events/:slug/matches
  registerEventMatchListRoutes(app, {
    assertPredictionsAllowed,
    buildMatchesWithPickSql,
    pool,
    resolveMatchPredictionState,
  });

  // GET /api/events/:slug/leaderboard
  registerEventLeaderboardRoutes(app, {
    countParticipants,
    pool,
    scoring,
  });

  // POST /api/events/:slug/status
  registerEventStatusRoutes(app, {
    emitDashboardRefresh,
    guildIdFromEventSlug,
    io,
    pool,
    requireGuildAdmin,
  });

  // Trasy /api/guilds siedza w server/routes/guilds.js. Wywolanie stoi tam,
  // gdzie byly - kolejnosc rejestracji jest czescia zachowania.
  registerGuildRoutes(app, {
    pool,
    guildRegistry,
    teamsStore,
    requireGuildAdmin,
    hasAdminPermission,
    VALID_PHASES,
    parseDeadlineInput,
    findPanelForDeadline,
    findPanelForMatchDeadline,
  });
}
