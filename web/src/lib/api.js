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
    throw new Error(text || `API error ${res.status}`);
  }

  return res.json();
}

export function getMe() {
  return apiFetch('/auth/me');
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

export async function getPublicOverview(slug) {
  return apiFetch(`/public/${slug}/overview`);
}

export async function getGuildMeta(guildId) {
  return apiFetch(`/guilds/${guildId}/meta`);
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