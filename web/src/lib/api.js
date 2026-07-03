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
    const err = new Error(text || `API error ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

// Turns a thrown apiFetch error into a user-facing message for admin action
// handlers (button clicks that can 401/403 if the session expired or the
// user isn't an admin of this guild), instead of the action silently doing
// nothing while the real error only shows up in the console.
export function describeActionError(err, actionLabel) {
  if (err?.status === 401) {
    return `You need to be logged in to ${actionLabel}.`;
  }

  if (err?.status === 403) {
    return `You don't have permission to ${actionLabel} on this server.`;
  }

  return `Could not ${actionLabel}.`;
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