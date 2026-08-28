const TTL_MS = 15 * 60 * 1000; // 15 minut

const sessions = new Map();

// ======================================================
// KEY
// ======================================================

function makeKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

// ======================================================
// CLEANUP
// ======================================================

function isExpired(session) {
  return !session || Date.now() - session.createdAt > TTL_MS;
}

function cleanupExpired() {
  const now = Date.now();

  for (const [key, session] of sessions.entries()) {
    if (!session || now - session.createdAt > TTL_MS) {
      sessions.delete(key);
    }
  }
}

// ======================================================
// SET
// ======================================================

function setMvpSession(guildId, userId, eventId) {
  if (!guildId || !userId || !eventId) {
    return null;
  }

  cleanupExpired();

  const session = {
    guildId: String(guildId),
    userId: String(userId),
    eventId: Number(eventId),
    createdAt: Date.now(),
  };

  sessions.set(makeKey(guildId, userId), session);

  return session;
}

// ======================================================
// GET
// ======================================================

function getMvpSession(guildId, userId) {
  if (!guildId || !userId) {
    return null;
  }

  const key = makeKey(guildId, userId);

  const session = sessions.get(key);

  if (!session) {
    return null;
  }

  if (isExpired(session)) {
    sessions.delete(key);
    return null;
  }

  return session;
}

// ======================================================
// CLEAR
// ======================================================

function clearMvpSession(guildId, userId) {
  if (!guildId || !userId) {
    return false;
  }

  return sessions.delete(makeKey(guildId, userId));
}

// ======================================================
// VALIDATE
// ======================================================

function validateMvpSession({ guildId, userId, eventId }) {
  const session = getMvpSession(guildId, userId);

  if (!session) {
    return {
      allowed: false,
      reason: "missing",
      message:
        "❌ Ten formularz MVP nie jest już aktualny.\n" +
        "Otwórz najnowszy panel Playoffs.",
    };
  }

  if (Number(session.eventId) !== Number(eventId)) {
    clearMvpSession(guildId, userId);

    return {
      allowed: false,
      reason: "event_mismatch",
      message:
        "❌ Ten formularz MVP pochodzi z poprzedniego eventu.\n" +
        "Otwórz najnowszy panel Playoffs.",
    };
  }

  return {
    allowed: true,
    session,
  };
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  setMvpSession,
  getMvpSession,
  clearMvpSession,
  validateMvpSession,
};
