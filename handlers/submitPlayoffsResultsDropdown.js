// submitPlayoffsResultsDropdown.js
const fs = require("fs/promises");
const path = require("path");
const pool = require("../db");
const logger = require("../logger");

// GLOBAL CACHE
if (!global._resultsPlayoffsCache) global._resultsPlayoffsCache = {};
const cache = global._resultsPlayoffsCache;

async function loadTeams() {
  const filePath = path.join(process.cwd(), "data", "teams.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function cleanList(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr || []) {
    const s = String(v).trim();
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}

async function getCurrentPlayoffs() {
  const [rows] = await pool.query(
    `SELECT correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner
     FROM playoffs_results
     WHERE active = 1
     ORDER BY id DESC LIMIT 1`
  );

  if (!rows.length) {
    return { semifinalists: [], finalists: [], winner: [], third: [] };
  }

  const row = rows[0];
  const toArr = (s) => !s ? [] : String(s).split(",").map(x => x.trim()).filter(Boolean);

  return {
    semifinalists: toArr(row.correct_semifinalists),
    finalists: toArr(row.correct_finalists),
    winner: toArr(row.correct_winner),
    third: toArr(row.correct_third_place_winner)
  };
}

// działanie JAK W SWISS – dokładamy partiami
// działanie JAK W SWISS – dokładamy partiami
// ✅ wyjątek: cap=1 => ZASTĄP (winner/3rd) zamiast dopisywać
function pickOrKeep(baseArr, addArr, cap) {
  baseArr = baseArr || [];

  // ✅ cap=1 zawsze podmienia na ostatni wybór z dropdowna
  if (cap === 1) {
    const add = Array.isArray(addArr) ? addArr : [];
    const picked = add.length
      ? String(add[add.length - 1]).trim()
      : String(baseArr[0] || "").trim();

    return { ok: true, merged: picked ? [picked] : [] };
  }

  // reszta jak było (dopisywanie)
  if (addArr && addArr.length) {
    const merged = cleanList([...baseArr, ...addArr]);
    if (merged.length > cap) {
      return { ok: false, merged, err: `Przekroczono limit ${cap} (jest ${merged.length})` };
    }
    return { ok: true, merged };
  }

  return { ok: true, merged: cleanList(baseArr) };
}


module.exports = async (interaction) => {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // DROPDOWN HANDLING
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("results_playoffs_")) {
    const type = interaction.customId.replace("results_playoffs_", "");

    if (!cache[userId]) cache[userId] = {};
    cache[userId][type] = interaction.values;

    logger.info(`[Playoffs Results] ${username} wybrał dla ${type}: ${interaction.values.join(", ")}`);

    await interaction.deferUpdate();
    return interaction.followUp({
      content: `📝 Zapisano wybór dla **${type}** (lokalnie). Kliknij **Zatwierdź**, aby zapisać w bazie.`,
      ephemeral: true
    });
  }

  // ZATWIERDZANIE DO BAZY
  if (interaction.isButton() && interaction.customId === "confirm_playoffs_results") {
    await interaction.deferReply({ ephemeral: true });

    const picks = cache[userId] || {};
    const current = await getCurrentPlayoffs();

    const mSemi = pickOrKeep(current.semifinalists, picks.semifinalists, 4);
    if (!mSemi.ok) return interaction.editReply(`⚠️ Półfinaliści: ${mSemi.err}`);

    const mFinal = pickOrKeep(current.finalists, picks.finalists, 2);
    if (!mFinal.ok) return interaction.editReply(`⚠️ Finaliści: ${mFinal.err}`);

    const mWinner = pickOrKeep(current.winner, picks.winner, 1);
    if (!mWinner.ok) return interaction.editReply(`⚠️ Zwycięzca: ${mWinner.err}`);

    const mThird = pickOrKeep(current.third, picks.third_place_winner, 1);
    if (!mThird.ok) return interaction.editReply(`⚠️ 3. miejsce: ${mThird.err}`);

    // LOGIKA ZALEŻNOŚCI
    if (mFinal.merged.length && !mFinal.merged.every(t => mSemi.merged.includes(t))) {
      return interaction.editReply("⚠️ Finaliści muszą być wśród półfinalistów.");
    }
    if (mWinner.merged.length && !mFinal.merged.includes(mWinner.merged[0])) {
      return interaction.editReply("⚠️ Zwycięzca musi być finalistą.");
    }
    if (mThird.merged.length) {
      if (!mSemi.merged.includes(mThird.merged[0])) {
        return interaction.editReply("⚠️ 3. miejsce musi być wśród półfinalistów.");
      }
      if (mWinner.merged[0] && mThird.merged[0] === mWinner.merged[0]) {
        return interaction.editReply("⚠️ Zwycięzca nie może być jednocześnie 3. miejscem.");
      }
    }

    // WALIDACJA
    const teams = await loadTeams();
    const allSelected = [...mSemi.merged, ...mFinal.merged, ...mWinner.merged, ...mThird.merged];
    const invalid = allSelected.filter(t => !teams.includes(t));
    if (invalid.length) {
      return interaction.editReply(`⚠️ Nieznane drużyny: ${invalid.join(", ")}`);
    }

    // NIE ZAPISUJEMY PUSTEGO REKORDU
    if (
      mSemi.merged.length === 0 &&
      mFinal.merged.length === 0 &&
      mWinner.merged.length === 0 &&
      mThird.merged.length === 0
    ) {
      return interaction.editReply("⚠️ Nie wybrano żadnych wyników — nic nie zapisano.");
    }

    // ZAPIS DO BAZY
    try {
      await pool.query(`UPDATE playoffs_results SET active = 0`);
      await pool.query(
        `INSERT INTO playoffs_results
          (correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner, active)
         VALUES (?, ?, ?, ?, 1)`,
        [
          mSemi.merged.join(", "),
          mFinal.merged.join(", "),
          mWinner.merged.join(", "),
          mThird.merged.length ? mThird.merged.join(", ") : null
        ]
      );

      delete cache[userId];

      return interaction.editReply(
        `✅ Zapisano wyniki Playoffs!\n` +
        `• Półfinaliści: **${mSemi.merged.join(", ") || "—"}**\n` +
        `• Finaliści: **${mFinal.merged.join(", ") || "—"}**\n` +
        `• Zwycięzca: **${mWinner.merged.join(", ") || "—"}**\n` +
        `• 3. miejsce: **${mThird.merged.join(", ") || "—"}**`
      );
    } catch (err) {
      logger.error("[Playoffs Results] Błąd zapisu:", err);
      return interaction.editReply("❌ Błąd podczas zapisu wyników.");
    }
  }
};
