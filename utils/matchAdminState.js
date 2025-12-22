// utils/matchAdminState.js

const adminMatchState = new Map(); // key: admin userId, value: { matchId, teamA, teamB, bestOf }

module.exports = {
    set(adminUserId, data) { adminMatchState.set(adminUserId, data); },
    get(adminUserId) { return adminMatchState.get(adminUserId); },
    clear(adminUserId) { adminMatchState.delete(adminUserId); },
};