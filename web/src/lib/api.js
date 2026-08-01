const API_BASE = '/api';

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    const text = await res.text();

    // Serwer odpowiada {"error":"..."} - wyciągamy sam komunikat, żeby
    // wywołujący dostał zdanie dla człowieka, a nie surowy JSON.
    let message = text;
    try {
      const body = JSON.parse(text);
      if (body?.error) message = body.error;
    } catch { /* nie JSON - zostaje treść odpowiedzi */ }

    const err = new Error(message || `API error ${res.status}`);
    err.status = res.status;
    err.serverMessage = message || null;
    throw err;
  }

  return res.json();
}

// Zamienia błąd z apiFetch na komunikat dla admina - inaczej kliknięcie
// przycisku po prostu nic nie robi, a prawdziwa przyczyna ląduje wyłącznie
// w konsoli.
export function describeActionError(err, actionLabel) {
  if (err?.status === 401) {
    return `Musisz być zalogowany, aby ${actionLabel}.`;
  }

  if (err?.status === 403) {
    return `Nie masz uprawnień, aby ${actionLabel} na tym serwerze.`;
  }

  // Przy 4xx serwer tłumaczy, co jest nie tak z żądaniem, i to wyjaśnienie
  // jest cenniejsze niż nasze ogólne zdanie - np. odmowa przeliczenia
  // zarchiwizowanego turnieju opisuje powód i co zrobić dalej. Przy 5xx
  // odwrotnie: to awaria wewnętrzna, a jej treść ("Database error") nic
  // adminowi nie mówi.
  if (err?.status >= 400 && err.status < 500 && err.serverMessage) {
    return err.serverMessage;
  }

  return `Nie udało się ${actionLabel}.`;
}

export function getMe() {
  return apiFetch('/auth/me');
}

export function logout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export function getActiveEvents() {
  return apiFetch('/events/active');
}

export async function getEventSummary(slug) {
  return apiFetch(`/events/${slug}/summary`);
}

export async function getEventMatches(slug) {
  return apiFetch(`/events/${slug}/matches`);
}

export async function getEventLeaderboard(slug) {
  return apiFetch(`/events/${slug}/leaderboard`);
}

export async function updateEventPhase(slug, phase) {
  return apiFetch(`/events/${slug}/phase`, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      phase
    })
  });
}

export async function getGuilds() {
  return apiFetch('/guilds');
}

export async function getGuildEvents(guildId) {
  return apiFetch(`/guilds/${guildId}/events`);
}

export async function getTeams(guildId, { includeInactive = true } = {}) {
  return apiFetch(`/guilds/${guildId}/teams${includeInactive ? '?includeInactive=1' : ''}`);
}

export async function createTeam(guildId, payload) {
  return apiFetch(`/guilds/${guildId}/teams`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateTeam(guildId, teamId, payload) {
  return apiFetch(`/guilds/${guildId}/teams/${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteTeam(guildId, teamId) {
  return apiFetch(`/guilds/${guildId}/teams/${teamId}`, {
    method: 'DELETE'
  });
}

export async function setDeadline(guildId, { phase, data, stage }) {
  return apiFetch(`/guilds/${guildId}/deadline`, {
    method: 'POST',
    body: JSON.stringify({ phase, data, stage })
  });
}

export async function setMatchDeadline(guildId, { phase, data }) {
  return apiFetch(`/guilds/${guildId}/match-deadline`, {
    method: 'POST',
    body: JSON.stringify({ phase, data })
  });
}

export async function importTeams(guildId, jsonText) {
  return apiFetch(`/guilds/${guildId}/teams/import`, {
    method: 'POST',
    body: JSON.stringify({ jsonText })
  });
}

export async function reorderTeams(guildId, orderedIds) {
  return apiFetch(`/guilds/${guildId}/teams/reorder`, {
    method: 'POST',
    body: JSON.stringify({ orderedIds })
  });
}

export async function createMatch(guildId, slug, payload) {
  return apiFetch(`/guilds/${guildId}/events/${slug}/matches`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function submitMatchResult(matchId, resA, resB) {
  return apiFetch(`/matches/${matchId}/result`, {
    method: 'POST',
    body: JSON.stringify({ resA, resB })
  });
}

export async function getSwissResults(slug, stage) {
  return apiFetch(`/events/${slug}/swiss-results/${stage}`);
}

export async function saveSwissResults(slug, stage, payload) {
  return apiFetch(`/events/${slug}/swiss-results/${stage}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getPlayoffsResults(slug) {
  return apiFetch(`/events/${slug}/playoffs-results`);
}

export async function savePlayoffsResults(slug, payload) {
  return apiFetch(`/events/${slug}/playoffs-results`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getDoubleElimResults(slug) {
  return apiFetch(`/events/${slug}/doubleelim-results`);
}

export async function saveDoubleElimResults(slug, payload) {
  return apiFetch(`/events/${slug}/doubleelim-results`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getPlayinResults(slug) {
  return apiFetch(`/events/${slug}/playin-results`);
}

export async function savePlayinResults(slug, teams) {
  return apiFetch(`/events/${slug}/playin-results`, {
    method: 'POST',
    body: JSON.stringify({ teams })
  });
}

export async function getMatchExactScores(matchId) {
  return apiFetch(`/matches/${matchId}/exact`);
}

export async function saveMatchExactScores(matchId, maps) {
  return apiFetch(`/matches/${matchId}/exact`, {
    method: 'POST',
    body: JSON.stringify({ maps })
  });
}

export async function getGuildArchive(guildId) {
  return apiFetch(`/guilds/${guildId}/archive`);
}

export async function getArchivedTournament(slug) {
  return apiFetch(`/events/${slug}/archive`);
}

export async function getMvp(slug) {
  return apiFetch(`/events/${slug}/mvp`);
}

export async function saveMvpCandidates(slug, entries) {
  return apiFetch(`/events/${slug}/mvp/candidates`, {
    method: 'POST',
    body: JSON.stringify({ entries })
  });
}

export async function setMvpResult(slug, candidateId) {
  return apiFetch(`/events/${slug}/mvp/result`, {
    method: 'POST',
    body: JSON.stringify({ candidateId })
  });
}

export async function getPhaseClearPreview(slug, phase) {
  return apiFetch(`/events/${slug}/phases/${phase}/clear-preview`);
}

export async function clearEventPhase(slug, phase) {
  return apiFetch(`/events/${slug}/phases/${phase}/clear`, {
    method: 'POST'
  });
}

export function getClassificationExportUrl(slug) {
  return `${API_BASE}/events/${slug}/export/classification`;
}

export async function bulkCreateMatches(guildId, slug, body) {
  return apiFetch(`/guilds/${guildId}/events/${slug}/matches/bulk`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function getResultProposals(slug) {
  return apiFetch(`/events/${slug}/result-proposals`);
}

export async function syncResultProposals(slug) {
  return apiFetch(`/events/${slug}/result-proposals/sync`, { method: 'POST' });
}

export async function acceptResultProposal(proposalId) {
  return apiFetch(`/result-proposals/${proposalId}/accept`, { method: 'POST' });
}

export async function rejectResultProposal(proposalId) {
  return apiFetch(`/result-proposals/${proposalId}/reject`, { method: 'POST' });
}

export async function setEventExternalLink(slug, externalTournamentId) {
  return apiFetch(`/events/${slug}/external-link`, {
    method: 'PATCH',
    body: JSON.stringify({ externalTournamentId })
  });
}

export function getBackupDownloadUrl(guildId, fileName) {
  return `${API_BASE}/guilds/${guildId}/backups/${encodeURIComponent(fileName)}/download`;
}

export async function getPublicOverview(slug) {
  return apiFetch(`/public/${slug}/overview`);
}

export async function createGuildEvent(guildId, payload) {
  return apiFetch(`/guilds/${guildId}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

export async function updateEventStatus(slug, status) {
  return apiFetch(`/events/${slug}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status
    })
  });
}

export async function recalculateEvent(slug) {
  return apiFetch(`/events/${slug}/recalculate`, {
    method: 'POST'
  });
}

export async function updateMatchLock(matchId, locked) {
  return apiFetch(`/matches/${matchId}/lock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      locked
    })
  });
}

export async function getMatchStats(matchId) {
  return apiFetch(`/matches/${matchId}/stats`);
}

export async function getPublicServers() {
  return apiFetch('/public/servers');
}

export async function getPublicGuild(guildSlug) {
  return apiFetch(`/public/${guildSlug}`);
}

export async function getPublicUser(userId) {
  return apiFetch(`/public/users/${userId}`);
}

export async function savePublicPrediction(matchId, payload) {
  return apiFetch(`/public/matches/${matchId}/prediction`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getPublicPrediction(matchId, userId) {
  return apiFetch(`/public/matches/${matchId}/prediction/${userId}`);
}

export async function getPublicEventPredictions(eventId, userId) {
  return apiFetch(`/public/events/${eventId}/predictions/${userId}`);
}

export async function getMyPublicPredictions() {
  return apiFetch('/public/me/predictions');
}

export async function getPublicLeaderboard() {
  return apiFetch('/public/leaderboard');
}

export async function getSwissPickem(slug, stage) {
  return apiFetch(`/public/events/${slug}/swiss-pickem/${stage}`);
}

export async function saveSwissPickem(slug, stage, payload) {
  return apiFetch(`/public/events/${slug}/swiss-pickem/${stage}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getPublicEventLeaderboard(slug) {
  return apiFetch(`/public/events/${slug}/leaderboard`);
}

export async function getSwissStats(slug, stage) {
  return apiFetch(`/public/events/${slug}/swiss-stats/${stage}`);
}

export async function getPublicEventMatchStats(slug) {
  return apiFetch(`/public/events/${slug}/match-stats`);
}

export async function getPlayinPickem(slug) {
  return apiFetch(`/public/events/${slug}/playin-pickem`);
}

export async function savePlayinPickem(slug, payload) {
  return apiFetch(`/public/events/${slug}/playin-pickem`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getPlayoffsPickem(slug) {
  return apiFetch(`/public/events/${slug}/playoffs-pickem`);
}

export async function savePlayoffsPickem(slug, payload) {
  return apiFetch(`/public/events/${slug}/playoffs-pickem`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getDoubleElimPickem(slug) {
  return apiFetch(`/public/events/${slug}/doubleelim-pickem`);
}

export async function saveDoubleElimPickem(slug, payload) {
  return apiFetch(`/public/events/${slug}/doubleelim-pickem`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getPublicArchives() {
  return apiFetch('/public/archives');
}

export async function getGuildBackups(guildId) {
  return apiFetch(`/guilds/${guildId}/backups`);
}

export async function createGuildBackup(guildId) {
  return apiFetch(`/guilds/${guildId}/backups`, {
    method: 'POST'
  });
}

export async function restoreGuildBackup(guildId, fileName) {
  return apiFetch(`/guilds/${guildId}/backups/${encodeURIComponent(fileName)}/restore`, {
    method: 'POST'
  });
}

export async function endTournament(slug, payload) {
  return apiFetch(`/events/${slug}/end-tournament`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}