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

export async function updateEventStatus(slug, status) {
  return apiFetch(`/events/${slug}/status`, {
    method: 'POST',
    body: JSON.stringify({ status })
  });
}

export async function getGuilds() {
  return apiFetch('/guilds');
}

export async function getGuildEvents(guildId) {
  return apiFetch(`/guilds/${guildId}/events`);
}