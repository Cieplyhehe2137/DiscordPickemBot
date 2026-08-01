const recalculateMatchPoints = require('./recalculateMatchPoints');

// Zapis wyniku serii w jednym miejscu. Wcześniej ta para operacji (upsert do
// match_results + przeliczenie punktów) żyła wyłącznie w endpoincie ręcznego
// wpisywania wyniku. Zatwierdzenie propozycji z zewnętrznego dostawcy musi
// robić dokładnie to samo - gdyby to skopiować, dwie ścieżki mogłyby się z
// czasem rozjechać akurat w miejscu, które decyduje o punktach graczy.
module.exports = async function applyMatchResult(pool, { guildId, match, resA, resB }) {
    await pool.query(
        `
        INSERT INTO match_results
            (guild_id, event_id, match_id, res_a, res_b)
        VALUES
            (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            event_id = VALUES(event_id),
            res_a = VALUES(res_a),
            res_b = VALUES(res_b)
        `,
        [guildId, match.event_id, match.id, resA, resB]
    );

    await recalculateMatchPoints(pool, guildId, match.event_id, match.id, match.best_of);
};
