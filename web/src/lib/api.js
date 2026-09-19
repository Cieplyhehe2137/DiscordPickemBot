// Domyślnie ścieżka względna: w dev obsługuje ją proxy Vite, a w produkcji
// ten sam proces Express, który serwuje web/dist. Jedno źródło, więc ciasteczko
// sesji jest same-site i nie potrzeba CORS.
//
// VITE_API_URL ustawia się tylko wtedy, gdy front stoi na osobnym hoście
// (Cloudflare Pages). Wtedy backend musi mieć HTTPS, wpuszczać ten origin
// w CORS i wystawiać ciasteczko jako SameSite=None; Secure - patrz
// CROSS_ORIGIN_WEB w server/index.js.
import { translateApiMessage } from "./apiMessages.js";

const API_BASE_URL = `${String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "")}/api`;

// Adresy plików do pobrania budujemy tym samym prefiksem co zapytania.
//
// Wcześniej zwracały gołą ścieżkę `/api/...`, co działa tylko wtedy, gdy
// front i API stoją na jednym hoście. Na produkcji nie stoją: front jest
// na pickembot.pl, API na api.pickembot.pl, a reguła przekierowań w
// public/_redirects oddaje dla nieznanej ścieżki STRONĘ z kodem 200 zamiast
// czterysta-czterech. Kliknięcie w "Pobierz
// klasyfikację" pobierało więc plik HTML o nazwie .xlsx - bez błędu,
// bez ostrzeżenia, po prostu zły plik.
function plikUrl(path) {
  return `${API_BASE_URL.replace(/\/api$/, "")}${path}`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",

    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },

    ...options,
  });

  if (!response.ok) {
    // Bez treści z serwera zostaje sam kod HTTP. To też jest komunikat dla
    // człowieka, więc ma swój klucz jak każdy inny.
    let message = null;
    let code = null;

    // Cała odpowiedź, bo zdania z klamrą składają się po naszej stronie -
    // serwer odsyła wtedy treść klamry osobnym polem obok `code`.
    let zmienne = null;

    try {
      const data = await response.json();

      if (data?.error) {
        message = data.error;
        code = data.code ?? null;
        zmienne = data;
      }

      if (data?.message) {
        message = data.message;
        code = data.code ?? null;
        zmienne = data;
      }
    } catch {
      // Backend nie zwrócił JSON-a.
    }

    // Kod z serwera prowadzi do zdania w języku strony, a treść z serwera
    // zostaje zapasem - patrz lib/apiMessages.js.
    message =
      message === null
        ? translateApiMessage("api.httpError", `Błąd API: ${response.status}`)
            .replace("{status}", response.status)
        : translateApiMessage(code, message, zmienne);

    // Kod HTTP przy błędzie: pozwala odróżnić "zaloguj się" (401) od
    // awarii. Bez niego każdy nieudany strzał wyglądał na ekranie tak samo
    // - czerwona ramka z komunikatem, także wtedy, gdy trzeba było tylko
    // się zalogować.
    const error = new Error(message);
    error.status = response.status;

    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getActiveEvents() {
  return apiRequest("/events/active");
}

// Pełna lista turniejów - aktywne i zakończone. /events/active odfiltrowuje
// wszystko poza trwającym turniejem, przez co archiwum było nieosiągalne z UI.
export function getAllEvents() {
  return apiRequest("/public/events");
}

// Oficjalny wynik fazy + typ zalogowanego gracza + punkty.
// phase: stage1 | stage2 | stage3 | playin | playoffs | doubleelim
export function getPhaseResults(slug, phase) {
  return apiRequest(
    `/public/events/${encodeURIComponent(slug)}/phase-results/${encodeURIComponent(phase)}`,
  );
}

export function getEventSummary(slug) {
  return apiRequest(`/events/${slug}/summary`);
}

export function getEventMatches(slug) {
  return apiRequest(`/events/${slug}/matches`);
}

// Pojedynczy mecz w tym samym kształcie co element listy.
// Strona meczu pobierała wcześniej WSZYSTKIE mecze turnieju i wyszukiwała
// jeden po id — przy stu meczach to zauważalny narzut na każde wejście
// i każde odświeżenie po zdarzeniu realtime.
export function getPublicMatch(matchId) {
  return apiRequest(`/public/matches/${encodeURIComponent(matchId)}`);
}

// Ranking bywa duży - największy turniej ma ponad 500 graczy, a wcześniej
// endpoint ucinał go twardo na setce. Bez argumentów zwraca pierwszą stronę.
export function getEventLeaderboard(
  slug,
  { strona, naStronie, szukaj, znajdz } = {},
) {
  const parametry = new URLSearchParams();

  if (strona) parametry.set("strona", String(strona));
  if (naStronie) parametry.set("naStronie", String(naStronie));
  if (szukaj) parametry.set("szukaj", String(szukaj));
  if (znajdz) parametry.set("znajdz", String(znajdz));

  const zapytanie = parametry.toString();

  return apiRequest(
    `/events/${slug}/leaderboard${zapytanie ? `?${zapytanie}` : ""}`,
  );
}

export function saveMatchPrediction(matchId, prediction) {
  return apiRequest(`/public/matches/${matchId}/prediction`, {
    method: "POST",
    body: JSON.stringify(prediction),
  });
}
export function getMatchPrediction(matchId) {
  return apiRequest(`/public/matches/${matchId}/prediction`);
}

export function getCurrentUser() {
  return apiRequest("/auth/me");
}

export function logout() {
  return apiRequest("/auth/logout", {
    method: "POST",
  });
}

export function getMatch(matchId) {
  return apiRequest(`/matches/${matchId}`);
}

export function getMatchExactResult(matchId) {
  return apiRequest(`/matches/${matchId}/exact`);
}

export function getPublicMatchResult(matchId) {
  return apiRequest(`/public/matches/${matchId}/result`);
}

export function saveSwissPickem(slug, stage, prediction) {
  return apiRequest(`/public/events/${slug}/swiss-pickem/${stage}`, {
    method: "POST",
    body: JSON.stringify(prediction),
  });
}

export function getSwissPickem(slug, stage) {
  return apiRequest(`/public/events/${slug}/swiss-pickem/${stage}`);
}

export function getPlayinPickem(slug) {
  return apiRequest(`/public/events/${slug}/playin-pickem`);
}

export function savePlayinPickem(slug, teams) {
  return apiRequest(`/public/events/${slug}/playin-pickem`, {
    method: "POST",
    body: JSON.stringify({ teams }),
  });
}

export function getPlayoffsPickem(slug) {
  return apiRequest(`/public/events/${slug}/playoffs-pickem`);
}

export function savePlayoffsPickem(slug, prediction) {
  return apiRequest(`/public/events/${slug}/playoffs-pickem`, {
    method: "POST",
    body: JSON.stringify(prediction),
  });
}

export function getDoubleElimPickem(slug) {
  return apiRequest(`/public/events/${slug}/doubleelim-pickem`);
}

export function saveDoubleElimPickem(slug, prediction) {
  return apiRequest(`/public/events/${slug}/doubleelim-pickem`, {
    method: "POST",
    body: JSON.stringify(prediction),
  });
}

export function getAdminServers() {
  return apiRequest("/public/servers");
}

export function getAdminServer(slug) {
  return apiRequest(`/public/${encodeURIComponent(slug)}`);
}

export function setAdminEventStatus(slug, status) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function setAdminEventPhase(slug, phase) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/phase`, {
    method: "POST",
    body: JSON.stringify({ phase }),
  });
}

// Uruchamia typowanie tak, jak robi to komenda na Discordzie: zapisuje stan
// w bazie i zleca botowi opublikowanie panelu na kanale. Bot podnosi zlecenie
// w ciągu ~30 s, bo API i bot to osobne procesy - serwer nie ma klienta
// Discorda i nie może wysłać wiadomości sam.
export function startEventPickem(slug, faza, channelId) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/pickem/start`, {
    method: "POST",
    body: JSON.stringify(channelId ? { faza, channelId } : { faza }),
  });
}

export function getAdminEvents(guildId) {
  return apiRequest(`/guilds/${encodeURIComponent(guildId)}/events`);
}

export function createAdminEvent(guildId, payload) {
  return apiRequest(`/guilds/${encodeURIComponent(guildId)}/events`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createAdminMatch(guildId, eventSlug, payload) {
  return apiRequest(
    `/guilds/${encodeURIComponent(guildId)}/events/${encodeURIComponent(eventSlug)}/matches`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function getAdminTeams(guildId) {
  return apiRequest(
    `/guilds/${encodeURIComponent(guildId)}/teams?includeInactive=1`,
  );
}

export function setAdminDeadline(guildId, payload) {
  return apiRequest(`/guilds/${encodeURIComponent(guildId)}/deadline`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function clearAdminDeadline(guildId, payload) {
  return apiRequest(`/guilds/${encodeURIComponent(guildId)}/deadline`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export function getAdminDeadline(guildId, phase, stage = null) {
  const params = new URLSearchParams({
    phase,
  });

  if (stage !== null) {
    params.set("stage", stage);
  }

  return apiRequest(
    `/guilds/${encodeURIComponent(guildId)}/deadline?${params.toString()}`,
  );
}

export function setAdminMatchDeadline(guildId, payload) {
  return apiRequest(`/guilds/${encodeURIComponent(guildId)}/match-deadline`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAdminMatches(eventSlug) {
  return apiRequest(`/events/${encodeURIComponent(eventSlug)}/matches`);
}

export function setAdminMatchStart(matchId, startTimeUtc) {
  return apiRequest(`/matches/${encodeURIComponent(matchId)}/start`, {
    method: "POST",
    body: JSON.stringify({
      startTimeUtc,
    }),
  });
}

export function setAdminMatchLockMode(matchId, mode) {
  return apiRequest(`/matches/${encodeURIComponent(matchId)}/lock`, {
    method: "POST",
    body: JSON.stringify({
      mode,
    }),
  });
}

export function updateAdminMatch(matchId, payload) {
  return apiRequest(`/matches/${encodeURIComponent(matchId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getAdminMatchDeletePreview(matchId) {
  return apiRequest(`/matches/${encodeURIComponent(matchId)}/delete-preview`);
}

export function deleteAdminMatch(matchId) {
  return apiRequest(`/matches/${encodeURIComponent(matchId)}`, {
    method: "DELETE",
  });
}

export function createAdminTeam(guildId, payload) {
  return apiRequest(`/guilds/${encodeURIComponent(guildId)}/teams`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminTeam(guildId, teamId, payload) {
  return apiRequest(
    `/guilds/${encodeURIComponent(
      guildId,
    )}/teams/${encodeURIComponent(teamId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function deleteAdminTeam(guildId, teamId) {
  return apiRequest(
    `/guilds/${encodeURIComponent(
      guildId,
    )}/teams/${encodeURIComponent(teamId)}`,
    {
      method: "DELETE",
    },
  );
}

export function getEventPlayerProfile(slug, userId) {
  return apiRequest(`/public/events/${slug}/players/${userId}`);
}

// Rywale gracza w tym turnieju: kto obstawial te same mecze i jak mu
// przy nim szlo.
//
// OSOBNE ZADANIE, a nie pole w profilu. Wiersze potrzebne do bilansu
// licza sie 247 ms (mediana z pieciu prob na produkcji), a profil oddaje
// odpowiedz po jednej podrozy do bazy. Doklejone tam opoznilyby CALY
// profil dla sekcji na jego koncu; osobno leca rownolegle.
export function getPlayerRivals(slug, userId) {
  return apiRequest(
    `/public/events/${encodeURIComponent(slug)}/players/${encodeURIComponent(
      userId,
    )}/rivals`,
  );
}

// Druzyny sa wspolne dla wszystkich turniejow, wiec te trasy nie biora
// slugu eventu. Nazwa w adresie jest czytelna dla czlowieka - serwer sam
// sprowadza ja do klucza, wiec /teams/FUT i /teams/FUT%20Esports trafiaja
// w to samo miejsce.
export function getTeams() {
  return apiRequest("/public/teams");
}

// Stawki punktowe. Trasa nie dotyka bazy - oddaje stałe z rules/scoring.js,
// czyli z tego samego pliku, którym bot liczy ranking.
export function getScoring() {
  return apiRequest("/public/scoring");
}

export function getAllTime() {
  return apiRequest("/public/all-time");
}

export function getUpsets() {
  return apiRequest("/public/upsets");
}

// Profil gracza PONAD turniejami. Adres ma dwa segmenty po /public/,
// wiec jako jedyna z ostatnich stron nie koliduje z /public/:guildSlug.
export function getPlayerCareer(userId) {
  return apiRequest(`/public/players/${encodeURIComponent(userId)}`);
}

// Glosowanie na MVP turnieju. Cztery tabele w bazie, a do tej pory zero
// publicznych tras - MVP dalo sie zobaczyc wylacznie w panelu.
export function getEventMvp(slug) {
  return apiRequest(`/public/events/${encodeURIComponent(slug)}/mvp`);
}

// Czytanie wynikow map. Adres ma JEDEN segment po /public/, wiec trasa
// po stronie serwera musi byc zarejestrowana przed :guildSlug.
export function getMaps() {
  return apiRequest("/public/maps");
}

export function getTeam(name) {
  return apiRequest(`/public/teams/${encodeURIComponent(name)}`);
}

// Pojedynek dwoch graczy: wylacznie mecze, ktore obaj obstawili.
//
// Nazwy, awatary i statystyki obu stron bierze strona porownania z dwoch
// profili - ta trasa liczy sama czesc wspolna typow.
export function getHeadToHead(slug, userA, userB) {
  return apiRequest(
    `/public/events/${encodeURIComponent(slug)}/head-to-head/${encodeURIComponent(
      userA,
    )}/${encodeURIComponent(userB)}`,
  );
}

export function getEventStats(slug) {
  return apiRequest(`/events/${slug}/stats`);
}

export function getMatchPickStats(slug, matchId) {
  return apiRequest(`/events/${slug}/matches/${matchId}/pick-stats`);
}

// Te dwie szły wcześniej gołym `fetch("/api/...")`, z pominięciem
// API_BASE_URL. Przy jednym origin to działało; odkąd front stoi na
// Cloudflare Pages, a API pod osobną domeną, ścieżka rozwiązywała się
// względem FRONTU - a tam reguła z _redirects oddaje index.html na każdą
// nieznaną ścieżkę. Odpowiedzią na zapytanie o typy była więc strona HTML,
// a jedynym objawem "SyntaxError: unexpected character at line 1 column 1",
// bo `<` z <!doctype html> nie jest JSON-em.
//
// Stąd bez własnego fetch: apiRequest dokłada bazowy adres, ciasteczka
// i kod HTTP w błędzie - a jedna droga do API to jedno miejsce, w którym
// taka pomyłka jest możliwa.
export function getMyEventPredictions(slug, phase, page = 0) {
  return apiRequest(
    `/public/events/${encodeURIComponent(slug)}/my-predictions/${encodeURIComponent(phase)}?page=${page}`,
  );
}

export function getMyStats(slug) {
  return apiRequest(`/public/events/${encodeURIComponent(slug)}/my-stats`);
}

export function getMyMatchPoints(matchId) {
  return apiRequest(`/public/matches/${matchId}/my-points`);
}

export { apiRequest };

/* =========================================================
   PANEL ADMINA - operacje, ktore po przepisaniu frontu
   zostaly bez UI (backend i Discord robily je dalej).
   ========================================================= */

// --- Wyniki faz Pick'Em ---

export function getSwissResults(slug, stage) {
  return apiRequest(
    `/events/${encodeURIComponent(slug)}/swiss-results/${encodeURIComponent(stage)}`,
  );
}

export function saveSwissResults(slug, stage, payload) {
  return apiRequest(
    `/events/${encodeURIComponent(slug)}/swiss-results/${encodeURIComponent(stage)}`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function getPlayoffsResults(slug) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/playoffs-results`);
}

export function savePlayoffsResults(slug, payload) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/playoffs-results`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPlayinResults(slug) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/playin-results`);
}

export function savePlayinResults(slug, payload) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/playin-results`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDoubleElimResults(slug) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/doubleelim-results`);
}

export function saveDoubleElimResults(slug, payload) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/doubleelim-results`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// --- Punkty i cykl zycia turnieju ---

export function recalculateScores(slug) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/recalculate`, {
    method: "POST",
  });
}

export function endTournament(slug, payload) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/end-tournament`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// --- MVP ---

export function getMvp(slug) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/mvp`);
}

export function saveMvpCandidates(slug, entries) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/mvp/candidates`, {
    method: "POST",
    body: JSON.stringify({ entries }),
  });
}

export function deleteMvpCandidate(slug, candidateId) {
  return apiRequest(
    `/events/${encodeURIComponent(slug)}/mvp/candidates/${candidateId}`,
    { method: "DELETE" },
  );
}

export function deleteMvpCandidates(slug, ids) {
  return apiRequest(
    `/events/${encodeURIComponent(slug)}/mvp/candidates/delete`,
    { method: "POST", body: JSON.stringify({ ids }) },
  );
}

export function saveMvpResult(slug, candidateId) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/mvp/result`, {
    method: "POST",
    body: JSON.stringify({ candidateId }),
  });
}

// --- Mecze hurtem i czyszczenie fazy ---

export function createMatchesBulk(guildId, slug, payload) {
  return apiRequest(
    `/guilds/${encodeURIComponent(guildId)}/events/${encodeURIComponent(slug)}/matches/bulk`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function getClearPhasePreview(slug, phase) {
  return apiRequest(
    `/events/${encodeURIComponent(slug)}/phases/${encodeURIComponent(phase)}/clear-preview`,
  );
}

export function clearPhase(slug, phase) {
  return apiRequest(
    `/events/${encodeURIComponent(slug)}/phases/${encodeURIComponent(phase)}/clear`,
    { method: "POST" },
  );
}

// --- Propozycje wynikow z zewnetrznego dostawcy ---

export function getResultProposals(slug) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/result-proposals`);
}

export function syncResultProposals(slug) {
  return apiRequest(
    `/events/${encodeURIComponent(slug)}/result-proposals/sync`,
    { method: "POST" },
  );
}

export function acceptResultProposal(proposalId) {
  return apiRequest(
    `/result-proposals/${encodeURIComponent(proposalId)}/accept`,
    { method: "POST" },
  );
}

export function rejectResultProposal(proposalId) {
  return apiRequest(
    `/result-proposals/${encodeURIComponent(proposalId)}/reject`,
    { method: "POST" },
  );
}

export function setExternalLink(slug, payload) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/external-link`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// --- Kopie zapasowe ---

export function listBackups(guildId) {
  return apiRequest(`/guilds/${encodeURIComponent(guildId)}/backups`);
}

export function createBackup(guildId) {
  return apiRequest(`/guilds/${encodeURIComponent(guildId)}/backups`, {
    method: "POST",
  });
}

export function restoreBackup(guildId, fileName) {
  return apiRequest(
    `/guilds/${encodeURIComponent(guildId)}/backups/${encodeURIComponent(fileName)}/restore`,
    { method: "POST" },
  );
}

export function backupDownloadUrl(guildId, fileName) {
  return plikUrl(
    `/api/guilds/${encodeURIComponent(guildId)}/backups/${encodeURIComponent(fileName)}/download`,
  );
}

export function classificationExportUrl(slug) {
  return plikUrl(
    `/api/events/${encodeURIComponent(slug)}/export/classification`,
  );
}

// Archiwum turnieju dla każdego, nie tylko dla admina. Dostępne po
// zarchiwizowaniu turnieju - serwer odpowiada 409, dopóki trwa.
export function eventArchiveUrl(slug) {
  return plikUrl(
    `/api/public/events/${encodeURIComponent(slug)}/archive.xlsx`,
  );
}

// --- Konfiguracja typowania drużyn per event ---

export function getEventPickemConfig(slug) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/pickem-config`);
}

export function saveEventPickemConfig(slug, fazy) {
  return apiRequest(`/events/${encodeURIComponent(slug)}/pickem-config`, {
    method: "PUT",
    body: JSON.stringify({ fazy }),
  });
}

// --- Licznik odwiedzin ---

// Zapis wejścia. Celowo NIE rzuca przy błędzie: licznik odwiedzin nie jest
// powodem, żeby strona główna pokazała komunikat o awarii.
export function recordVisit() {
  return apiRequest("/public/visit", { method: "POST" }).catch(() => null);
}

export function getVisitStats() {
  return apiRequest("/public/visits");
}
