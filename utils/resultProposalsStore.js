// Dostęp do kolejki propozycji wyników (match_result_proposals).
//
// Rozdzielone od utils/matchProposals.js celowo: tam jest czysta logika
// dopasowywania, testowalna bez bazy, tutaj wyłącznie SQL.

const { matchProviderResults } = require("./matchProposals");

// Mecze eventu wraz z aktualnym wynikiem, jeśli już jest. Wynik jest
// potrzebny, żeby panel pokazał adminowi, czy propozycja coś zmienia, czy
// tylko potwierdza to, co już wpisano ręcznie.
async function loadEventMatches(pool, guildId, eventId) {
  const [rows] = await pool.query(
    `
        SELECT
            m.id, m.team_a, m.team_b, m.best_of, m.phase, m.match_no, m.event_id,
            r.res_a AS obecny_res_a,
            r.res_b AS obecny_res_b
        FROM matches m
        LEFT JOIN match_results r
            ON r.match_id = m.id
           AND r.guild_id = m.guild_id
           AND r.event_id = m.event_id
        WHERE m.guild_id = ?
          AND m.event_id = ?
        ORDER BY m.match_no
        `,
    [guildId, eventId],
  );

  return rows;
}

async function loadTeamsForMatching(pool, guildId) {
  const [rows] = await pool.query(
    `SELECT name, short_name, external_name FROM teams WHERE guild_id = ?`,
    [guildId],
  );

  return rows;
}

// Pobiera wyniki od dostawcy, dopasowuje do meczów eventu i zapisuje
// propozycje. Nie dotyka match_results - to robi dopiero zatwierdzenie.
async function syncProposals(pool, { guildId, event, provider }) {
  if (!event.external_tournament_id) {
    const err = new Error(
      "Event nie ma przypisanego turnieju u dostawcy (external_tournament_id)",
    );
    err.code = "NO_EXTERNAL_TOURNAMENT";
    throw err;
  }

  const providerMatches = await provider.fetchFinishedMatches({
    tournamentId: event.external_tournament_id,
  });

  const [localMatches, teams] = await Promise.all([
    loadEventMatches(pool, guildId, event.id),
    loadTeamsForMatching(pool, guildId),
  ]);

  const wynik = matchProviderResults({ localMatches, providerMatches, teams });

  let zapisane = 0;

  for (const d of wynik.dopasowane) {
    // Ponowna synchronizacja aktualizuje istniejącą propozycję zamiast
    // mnożyć duplikaty w kolejce. Rozstrzygnięte propozycje (ACCEPTED /
    // REJECTED) wracają do PENDING tylko wtedy, gdy dostawca podaje INNY
    // wynik niż poprzednio - inaczej odrzucona propozycja wracałaby przy
    // każdej synchronizacji.
    await pool.query(
      `
            INSERT INTO match_result_proposals
                (guild_id, event_id, match_id, source, external_match_id,
                 res_a, res_b, payload, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
            ON DUPLICATE KEY UPDATE
                external_match_id = VALUES(external_match_id),
                payload           = VALUES(payload),
                status = IF(
                    res_a <> VALUES(res_a) OR res_b <> VALUES(res_b),
                    'PENDING',
                    status
                ),
                res_a = VALUES(res_a),
                res_b = VALUES(res_b)
            `,
      [
        guildId,
        event.id,
        d.match.id,
        provider.name,
        d.provider.externalId,
        d.resA,
        d.resB,
        JSON.stringify(d.provider.raw ?? d.provider),
      ],
    );

    zapisane++;
  }

  return {
    pobranych: providerMatches.length,
    zapisanych: zapisane,
    nierozpoznaneDruzyny: wynik.nierozpoznaneDruzyny
      .map((x) => x.nierozpoznane)
      .flat(),
    brakMeczu: wynik.brakMeczu.length,
    niejednoznaczne: wynik.niejednoznaczne.length,
  };
}

async function listProposals(pool, guildId, eventId, status = "PENDING") {
  const [rows] = await pool.query(
    `
        SELECT
            p.id, p.match_id, p.source, p.external_match_id,
            p.res_a, p.res_b, p.status, p.created_at,
            m.team_a, m.team_b, m.best_of, m.phase, m.match_no,
            r.res_a AS obecny_res_a,
            r.res_b AS obecny_res_b
        FROM match_result_proposals p
        JOIN matches m
            ON m.id = p.match_id
           AND m.guild_id = p.guild_id
        LEFT JOIN match_results r
            ON r.match_id = p.match_id
           AND r.guild_id = p.guild_id
           AND r.event_id = p.event_id
        WHERE p.guild_id = ?
          AND p.event_id = ?
          AND p.status = ?
        ORDER BY m.match_no
        `,
    [guildId, eventId, status],
  );

  return rows;
}

async function getProposal(pool, guildId, proposalId) {
  const [[row]] = await pool.query(
    `SELECT * FROM match_result_proposals WHERE id = ? AND guild_id = ? LIMIT 1`,
    [proposalId, guildId],
  );

  return row || null;
}

async function markResolved(pool, guildId, proposalId, status, userId) {
  await pool.query(
    `
        UPDATE match_result_proposals
        SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
        WHERE id = ? AND guild_id = ?
        `,
    [status, userId || null, proposalId, guildId],
  );
}

module.exports = {
  syncProposals,
  listProposals,
  getProposal,
  markResolved,
  loadEventMatches,
};
