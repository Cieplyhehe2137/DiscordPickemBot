// utils/predictionDraftCache.js
//
// Shared in-memory draft cache for multi-step pick'em selections (Swiss,
// Playoffs, Double Elim, Play-In). Each phase handler used to keep its own
// copy of this get/set/TTL logic (some in a local Map, one bolted onto
// `client._playoffsCache`) - consolidated here so there's one cache backend
// and one TTL to reason about.

const CACHE_TTL_MS = 15 * 60 * 1000;
const store = new Map();

function fullKey(namespace, key) {
  return `${namespace}:${key}`;
}

function getDraft(namespace, key) {
  const entry = store.get(fullKey(namespace, key));
  if (!entry) return null;

  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    store.delete(fullKey(namespace, key));
    return null;
  }

  return entry.data;
}

function setDraft(namespace, key, data) {
  store.set(fullKey(namespace, key), { data, ts: Date.now() });
}

function clearDraft(namespace, key) {
  store.delete(fullKey(namespace, key));
}

module.exports = { getDraft, setDraft, clearDraft };
