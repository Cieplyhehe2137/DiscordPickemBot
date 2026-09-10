// Domyślnie ścieżka względna: w dev obsługuje ją proxy Vite, a w produkcji
// ten sam proces Express, który serwuje web/dist. Jedno źródło, więc ciasteczko
// sesji jest same-site i nie potrzeba CORS.
//
// VITE_API_URL ustawia się tylko wtedy, gdy front stoi na osobnym hoście
// (Cloudflare Pages). Wtedy backend musi mieć HTTPS, wpuszczać ten origin
// w CORS i wystawiać ciasteczko jako SameSite=None; Secure - patrz
// CROSS_ORIGIN_WEB w server/index.js.
const API_BASE_URL = `${String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "")}/api`;

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
    let message = `Błąd API: ${response.status}`;

    try {
      const data = await response.json();

      if (data?.error) {
        message = data.error;
      }

      if (data?.message) {
        message = data.message;
      }
    } catch {
      // Backend nie zwrócił JSON-a.
    }

    throw new Error(message);
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
export function getEventLeaderboard(slug, { strona, naStronie } = {}) {
  const parametry = new URLSearchParams();

  if (strona) parametry.set("strona", String(strona));
  if (naStronie) parametry.set("naStronie", String(naStronie));

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

export function getEventStats(slug) {
  return apiRequest(`/events/${slug}/stats`);
}

export function getMatchPickStats(slug, matchId) {
  return apiRequest(`/events/${slug}/matches/${matchId}/pick-stats`);
}

export async function getMyEventPredictions(slug, phase, page = 0) {
  const response = await fetch(
    `/api/public/events/${encodeURIComponent(slug)}/my-predictions/${encodeURIComponent(phase)}?page=${page}`,
    {
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Nie udało się pobrać typów.");
  }

  return data;
}

export async function getMyStats(slug) {
  const response = await fetch(
    `/api/public/events/${encodeURIComponent(slug)}/my-stats`,
    {
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Nie udało się pobrać statystyk.");
  }

  return data;
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
  return `/api/guilds/${encodeURIComponent(guildId)}/backups/${encodeURIComponent(fileName)}/download`;
}

export function classificationExportUrl(slug) {
  return `/api/events/${encodeURIComponent(slug)}/export/classification`;
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
