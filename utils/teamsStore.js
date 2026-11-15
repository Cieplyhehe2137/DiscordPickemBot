// utils/teamsStore.js
const fs = require("fs");
const path = require("path");
const { withGuild } = require("./guildContext");
const { logInfo } = require("./logger");
const { runInTransaction } = require("./runInTransaction");
const { planTeamsReplace } = require("./teamsReplacePlan");
const teamsState = require("./teamsState");

/* ===============================
   HELPERS
=============================== */

function normName(name) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/* ===============================
   READ
=============================== */

async function listTeams(source, { includeInactive = true } = {}) {
  return withGuild(source, async ({ guildId, pool }) => {
    const [rows] = await pool.query(
      `
      SELECT id, name, short_name, external_name, active, sort_order, created_at, updated_at
      FROM teams
      WHERE guild_id = ?
        AND (? = 1 OR active = 1)
      ORDER BY sort_order ASC, name ASC
      `,
      [guildId, includeInactive ? 1 : 0],
    );
    return rows;
  });
}

async function getTeamNames(source, opts = {}) {
  const rows = await listTeams(source, opts);
  return rows.map((r) => r.name);
}

/* ===============================
   WRITE
=============================== */

async function ensureSortOrder(source) {
  return withGuild(source, async ({ guildId, pool }) => {
    const [rows] = await pool.query(
      `SELECT id FROM teams WHERE guild_id = ? ORDER BY sort_order ASC, name ASC`,
      [guildId],
    );

    let i = 1;
    for (const r of rows) {
      await pool.query(
        `UPDATE teams SET sort_order = ? WHERE guild_id = ? AND id = ?`,
        [i, guildId, r.id],
      );
      i++;
    }
  });
}

// Rostery turniejów, które zniknęłyby razem z podanymi drużynami.
//
// Liczyć PRZED usunięciem - po nim nie ma już czego liczyć, bo CASCADE
// zabiera te wiersze razem z drużyną.
//
// Brak tabeli to poprawny stan, nie awaria: migracja 0014 mogła nie pójść,
// a cały mechanizm rostera jest zbudowany tak, żeby kolejność wdrożenia
// była dowolna (patrz utils/loadEventTeams.js).
async function rosteryDruzyn(conn, teamIds) {
  if (!teamIds.length) return { wierszy: 0, turnieje: [] };

  try {
    const [wiersze] = await conn.query(
      `
      SELECT e.name AS turniej, COUNT(*) AS ile
      FROM event_teams et
      JOIN events e
        ON e.id = et.event_id
      WHERE et.team_id IN (?)
      GROUP BY e.id, e.name
      ORDER BY e.id ASC
      `,
      [teamIds],
    );

    return {
      wierszy: wiersze.reduce((suma, w) => suma + Number(w.ile), 0),
      turnieje: wiersze.map((w) => w.turniej),
    };
  } catch (err) {
    if (err?.code === "ER_NO_SUCH_TABLE") return { wierszy: 0, turnieje: [] };

    throw err;
  }
}

/**
 * Doprowadza słownik drużyn serwera do podanej listy nazw.
 *
 * NIE KASUJE SŁOWNIKA I NIE ODTWARZA GO OD ZERA - drużyna, która została na
 * liście, zachowuje swoje `id`. To jest cała treść tej funkcji, bo od
 * migracji 0014 `event_teams` wskazuje drużynę przez `team_id` i ma
 * `ON DELETE CASCADE`: stare `DELETE` + `INSERT` zabierało po cichu rostery
 * wszystkich turniejów tego serwera, a przy okazji ręcznie wpisane
 * `external_name`, `short_name` i `logo_url`. Co z czym się dopasowuje
 * i dlaczego w tej kolejności - utils/teamsReplacePlan.js.
 *
 * CAŁOŚĆ W JEDNEJ TRANSAKCJI, i to też jest poprawka. Dotąd `DELETE`
 * i `INSERT` były dwoma osobnymi zapytaniami w autocommit, więc błąd przy
 * wstawianiu (na przykład `ER_DUP_ENTRY` - obsługiwany wprost w modalu bota,
 * czyli zdarzał się) zostawiał serwer z PUSTYM słownikiem.
 *
 * @returns {Promise<{imported:number, kept:number, added:number, removed:string[], rosterRowsRemoved:number, rosterEventsAffected:string[]}>}
 */
async function replaceTeams(source, names) {
  return withGuild(source, async ({ guildId, pool }) => {
    const cleaned = Array.from(new Set(names.map(normName).filter(Boolean)));

    // teamKey żyje w module ESM, a ten plik jest CommonJS. Mostek przez
    // dynamiczny import ma już w bocie precedens -
    // handlers/matches/matchMapsWatcher.js robi to samo z mapSync.js.
    const { teamKey } = await import("../server/lib/teamLogos.js");

    return runInTransaction(pool, async (conn) => {
      const [stare] = await conn.query(
        `
        SELECT id, name
        FROM teams
        WHERE guild_id = ?
        ORDER BY sort_order ASC, name ASC
        FOR UPDATE
        `,
        [guildId],
      );

      const plan = planTeamsReplace({
        stare,
        nowe: cleaned,
        klucz: teamKey,
      });

      const znikajaceId = plan.doUsuniecia.map((w) => w.id);

      const utracone = await rosteryDruzyn(conn, znikajaceId);

      if (znikajaceId.length) {
        // Tylko drużyny, które wypadły z listy. Kasowanie idzie PRZED
        // zmianami nazw, żeby zwolnić nazwy, które mogą być celem zmiany.
        await conn.query(`DELETE FROM teams WHERE guild_id = ? AND id IN (?)`, [
          guildId,
          znikajaceId,
        ]);
      }

      for (const w of plan.zostaja) {
        // Ustawiamy wyłącznie to, co import podał: nazwę, kolejność
        // i `active = 1` (tak samo jak przed tą zmianą). `short_name`,
        // `external_name` i `logo_url` zostają nietknięte.
        await conn.query(
          `
          UPDATE teams
          SET name = ?, active = 1, sort_order = ?, updated_at = CURRENT_TIMESTAMP
          WHERE guild_id = ? AND id = ?
          `,
          [w.name, w.sortOrder, guildId, w.id],
        );
      }

      if (plan.doWstawienia.length) {
        const values = plan.doWstawienia.map((w) => [
          guildId,
          w.name,
          null,
          1,
          w.sortOrder,
        ]);

        await conn.query(
          `INSERT INTO teams (guild_id, name, short_name, active, sort_order)
           VALUES ?`,
          [values],
        );
      }

      teamsState?.invalidateTeams?.(guildId);

      return {
        imported: cleaned.length,
        kept: plan.zostaja.length,
        added: plan.doWstawienia.length,
        removed: plan.doUsuniecia.map((w) => w.name),
        rosterRowsRemoved: utracone.wierszy,
        rosterEventsAffected: utracone.turnieje,
      };
    });
  });
}

async function addTeam(source, name, { shortName = null } = {}) {
  return withGuild(source, async ({ guildId, pool }) => {
    const clean = normName(name);
    if (!clean) throw new Error("EMPTY_TEAM_NAME");

    const [[maxRow]] = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS m FROM teams WHERE guild_id = ?`,
      [guildId],
    );

    const nextOrder = (maxRow?.m ?? 0) + 1;

    await pool.query(
      `
      INSERT INTO teams (guild_id, name, short_name, active, sort_order)
      VALUES (?, ?, ?, 1, ?)
      `,
      [guildId, clean, shortName, nextOrder],
    );

    teamsState?.invalidateTeams?.(guildId);
  });
}

async function renameTeam(source, teamId, newName, { shortName = null } = {}) {
  return withGuild(source, async ({ guildId, pool }) => {
    const clean = normName(newName);
    if (!clean) throw new Error("EMPTY_TEAM_NAME");

    await pool.query(
      `
      UPDATE teams
      SET name = ?, short_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE guild_id = ? AND id = ?
      `,
      [clean, shortName, guildId, Number(teamId)],
    );

    teamsState?.invalidateTeams?.(guildId);
  });
}

async function toggleTeamActive(source, teamId) {
  return withGuild(source, async ({ guildId, pool }) => {
    await pool.query(
      `
      UPDATE teams
      SET active = IF(active=1, 0, 1),
          updated_at = CURRENT_TIMESTAMP
      WHERE guild_id = ? AND id = ?
      `,
      [guildId, Number(teamId)],
    );

    teamsState?.invalidateTeams?.(guildId);
  });
}

// Usunięcie drużyny ze słownika wyjmuje ją TAKŻE z rosterów turniejów,
// w których gra (`event_teams` ma `ON DELETE CASCADE`). Jest to zachowanie
// poprawne - wiersz, na który roster wskazuje, przestaje istnieć - ale nie
// może być ciche, bo dotyczy turnieju przygotowanego na przyszłość, który
// jeszcze nie ma ani jednego meczu. Dlatego liczba idzie do logu i do
// odpowiedzi.
async function deleteTeams(source, teamIds) {
  return withGuild(source, async ({ guildId, pool }) => {
    const ids = (teamIds || []).map(Number).filter(Boolean);

    if (!ids.length) {
      return { deleted: 0, rosterRowsRemoved: 0, rosterEventsAffected: [] };
    }

    const utracone = await rosteryDruzyn(pool, ids);

    await pool.query(`DELETE FROM teams WHERE guild_id = ? AND id IN (?)`, [
      guildId,
      ids,
    ]);

    await ensureSortOrder(guildId);
    teamsState?.invalidateTeams?.(guildId);

    if (utracone.wierszy) {
      logInfo(
        "teams",
        "Usuniecie druzyn zabralo wiersze z rosterow turniejow",
        {
          guildId,
          teamIds: ids,
          rosterRowsRemoved: utracone.wierszy,
          rosterEventsAffected: utracone.turnieje,
        },
      );
    }

    return {
      deleted: ids.length,
      rosterRowsRemoved: utracone.wierszy,
      rosterEventsAffected: utracone.turnieje,
    };
  });
}

async function reorderTeams(source, orderedIds) {
  return withGuild(source, async ({ guildId, pool }) => {
    const ids = (orderedIds || []).map(Number).filter(Boolean);

    let i = 1;
    for (const id of ids) {
      await pool.query(
        `
        UPDATE teams
        SET sort_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE guild_id = ? AND id = ?
        `,
        [i, guildId, id],
      );
      i++;
    }

    teamsState?.invalidateTeams?.(guildId);
  });
}

/* ===============================
   IMPORT / MIGRATION
=============================== */

function parseTeamsJsonText(text) {
  let arr;
  try {
    arr = JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
  if (!Array.isArray(arr)) throw new Error("INVALID_JSON");
  return arr.map(normName).filter(Boolean);
}

// Oddaje PODSUMOWANIE, nie samą liczbę: import może zabrać rostery turniejów
// (drużyna wypadła z listy) i wołający ma o tym powiedzieć administratorowi,
// zamiast zostawiać to ciche. Modal bota był na obiekt przygotowany od
// początku - czytał `result?.imported`.
async function importTeamsFromJsonText(source, jsonText) {
  const names = parseTeamsJsonText(jsonText);

  return replaceTeams(source, names);
}

async function migrateTeamsJsonToDb(source) {
  const filePath = path.join(__dirname, "..", "teams.json");
  if (!fs.existsSync(filePath)) {
    throw new Error("TEAMS_JSON_NOT_FOUND");
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const names = parseTeamsJsonText(raw);

  const podsumowanie = await replaceTeams(source, names);

  logInfo("teams", "Migrated teams.json -> DB", {
    guildId: typeof source === "string" ? source : source?.guildId,
    count: podsumowanie.imported,
    rosterRowsRemoved: podsumowanie.rosterRowsRemoved,
  });

  return podsumowanie;
}

// alias dla starego kodu
const toggleTeam = toggleTeamActive;

module.exports = {
  listTeams,
  getTeamNames,
  addTeam,
  renameTeam,
  toggleTeamActive,
  toggleTeam,
  deleteTeams,
  reorderTeams,
  replaceTeams,
  importTeamsFromJsonText,
  migrateTeamsJsonToDb,
};
