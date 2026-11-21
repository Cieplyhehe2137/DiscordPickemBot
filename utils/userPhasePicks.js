// Typy DRUZYN jednego gracza w jednej fazie.
//
// Panel Pick'Em ma dwa osobne typowania: drużyny (kto pójdzie 3-0, kto
// awansuje, kto weźmie turniej) i mecze. Widok "Moje typy" pokazywał dotąd
// wyłącznie mecze, więc połowa tego, co gracz zapisał, nie miała gdzie się
// pokazać - a te typy decydują o większej części punktów.
//
// FAZA PRZYCISKU WYBIERA TABELE. Przycisk niesie `my_predictions:<faza>:...`,
// gdzie faza to ta sama wartość, co `matches.phase`. Dla SWISS_STAGE1 typy
// drużyn leżą w swiss_predictions ze stage='stage1', dla PLAYOFFS
// w playoffs_predictions i tak dalej. Dzięki temu gracz widzi typy tej fazy,
// którą właśnie ogląda, a nie wszystkiego naraz.
//
// NAZWY TABEL I KOLUMN POCHODZĄ WYŁĄCZNIE Z TEJ STAŁEJ, nigdy z żądania -
// dlatego wolno je wstawić w zapytanie.

const { parseTeamList } = require("./teamList");

const PHASE_PICK_SOURCES = {
  SWISS_STAGE1: {
    table: "swiss_predictions",
    stage: "stage1",
    groups: [
      { column: "pick_3_0", label: "Drużyny 3-0" },
      { column: "pick_0_3", label: "Drużyny 0-3" },
      { column: "advancing", label: "Awansujące" },
    ],
  },

  SWISS_STAGE2: {
    table: "swiss_predictions",
    stage: "stage2",
    groups: [
      { column: "pick_3_0", label: "Drużyny 3-0" },
      { column: "pick_0_3", label: "Drużyny 0-3" },
      { column: "advancing", label: "Awansujące" },
    ],
  },

  SWISS_STAGE3: {
    table: "swiss_predictions",
    stage: "stage3",
    groups: [
      { column: "pick_3_0", label: "Drużyny 3-0" },
      { column: "pick_0_3", label: "Drużyny 0-3" },
      { column: "advancing", label: "Awansujące" },
    ],
  },

  PLAYIN: {
    table: "playin_predictions",
    groups: [{ column: "teams", label: "Awansujące" }],
  },

  PLAYOFFS: {
    table: "playoffs_predictions",
    groups: [
      { column: "semifinalists", label: "Półfinaliści" },
      { column: "finalists", label: "Finaliści" },
      { column: "winner", label: "Mistrz" },
      { column: "third_place_winner", label: "3. miejsce" },
    ],
  },

  DOUBLEELIM: {
    table: "doubleelim_predictions",
    groups: [
      { column: "upper_final_a", label: "Górna drabinka — A" },
      { column: "upper_final_b", label: "Górna drabinka — B" },
      { column: "lower_final_a", label: "Dolna drabinka — A" },
      { column: "lower_final_b", label: "Dolna drabinka — B" },
    ],
  },
};

/**
 * Konfiguracja typów drużyn dla fazy, albo null gdy faza ich nie ma.
 */
function phasePickSource(phaseKey) {
  const key = String(phaseKey || "")
    .trim()
    .toUpperCase();

  return PHASE_PICK_SOURCES[key] || null;
}

/**
 * Typy drużyn gracza w podanej fazie.
 *
 * Oddaje `null`, gdy faza nie ma typowania drużyn albo gdy gracz nic w niej
 * nie zapisał - wywołujący ma wtedy po prostu nic nie dokładać do embeda.
 * Brak tabeli (starsza baza) też kończy się `null`, a nie wyjątkiem: widok
 * typów meczowych ma działać dalej.
 */
async function loadUserPhasePicks(pool, { guildId, eventId, userId, phaseKey }) {
  const source = phasePickSource(phaseKey);

  if (!source) return null;

  const columns = source.groups.map((g) => g.column);

  const warunekEtapu = source.stage ? " AND stage = ?" : "";

  const parametry = [guildId, eventId, String(userId)];

  if (source.stage) parametry.push(source.stage);

  let rows;

  try {
    [rows] = await pool.query(
      `
      SELECT ${columns.map((c) => `\`${c}\``).join(", ")}
      FROM \`${source.table}\`
      WHERE guild_id = ?
        AND event_id = ?
        AND user_id = ?${warunekEtapu}
      LIMIT 1
      `,
      parametry,
    );
  } catch (err) {
    if (err?.code === "ER_NO_SUCH_TABLE") return null;

    throw err;
  }

  const row = rows?.[0];

  if (!row) return null;

  const groups = source.groups
    .map((g) => ({ label: g.label, teams: parseTeamList(row[g.column]) }))
    .filter((g) => g.teams.length > 0);

  if (!groups.length) return null;

  return { phaseKey, stage: source.stage || null, groups };
}

/**
 * Typy drużyn jako tekst do embeda.
 *
 * Każda grupa w jednej linii, bo lista awansujących potrafi mieć sześć
 * nazw i rozbita na punkty zjadłaby pół ekranu telefonu.
 */
function formatPhasePicks(picks) {
  if (!picks?.groups?.length) return "";

  return picks.groups
    .map((g) => `**${g.label}:** ${g.teams.join(", ")}`)
    .join("\n");
}

module.exports = {
  PHASE_PICK_SOURCES,
  phasePickSource,
  loadUserPhasePicks,
  formatPhasePicks,
};
