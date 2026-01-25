// handlers/submitPlayoffsResultsDropdown.js

const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');

/* ===============================
   CACHE (TTL, per guild + admin)
=============================== */
const CACHE_TTL = 15 * 60 * 1000; // 15 min
const cache = new Map(); // key = `${guildId}:${adminId}`

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { ts: Date.now(), data });
}

/* ===============================
   DB HELPERS
=============================== */
async function loadTeamsFromDB(pool, guildId) {
  const [rows] = await pool.query(
    `SELECT name
     FROM teams
     WHERE guild_id = ?
       AND active = 1
     ORDER BY name ASC`,
    [guildId]
  );
  return rows.map(r => r.name);
}

async function getCurrentPlayoffs(pool, guildId) {
  const [rows] = await pool.query(
    `SELECT correct_semifinalists,
            correct_finalists,
            correct_winner,
            correct_third_place_winner
     FROM playoffs_results
     WHERE guild_id = ?
       AND active = 1
     ORDER BY id DESC
     LIMIT 1`,
    [guildId]
  );

  if (!rows.length) {
    return { semifinalists: [], finalists: [], winner: [], third: [] };
  }

  const toArr = (s) =>
    !s ? [] : String(s).split(',').map(v => v.trim()).filter(Boolean);

  const r = rows[0];
  return {
    semifinalists: toArr(r.correct_semifinalists),
    finalists: toArr(r.correct_finalists),
    winner: toArr(r.correct_winner),
    third: toArr(r.correct_third_place_winner),
  };
}

/* ===============================
   UTILS
=============================== */
function uniqueCaseInsensitive(arr = []) {
  const seen = new Set();
  return arr.filter(v => {
    const k = String(v).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// cap = 1 → replace, >1 → merge z limitem
function pickOrKeep(base = [], add = [], cap) {
  if (cap === 1) {
    const pick = add?.length ? String(add.at(-1)) : base[0];
    return { ok: true, merged: pick ? [pick] : [] };
  }

  if (add?.length) {
    const merged = uniqueCaseInsensitive([...base, ...add]);
    if (merged.length > cap) {
      return { ok: false, err: `Limit ${cap} (jest ${merged.length})` };
    }
    return { ok: true, merged };
  }

  return { ok: true, merged: base };
}

/* ===============================
   HANDLER
=============================== */
module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
  if (!interaction.guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    });
  }

  const guildId = interaction.guildId;
  const adminId = interaction.user.id;
  const username = interaction.user.username;
  const cacheKey = `${guildId}:${adminId}`;

  const local = getCache(cacheKey) || {};

  /* ===============================
     DROPDOWNS
  =============================== */
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId.startsWith('results_playoffs_')
  ) {
    const type = interaction.customId.replace('results_playoffs_', '');
    local[type] = interaction.values;

    setCache(cacheKey, local);

    logger.info('playoffs_results', 'slot updated', {
      guildId,
      adminId,
      type,
      values: interaction.values
    });

    await interaction.deferUpdate().catch(() => {});
    return;
  }

  /* ===============================
     CONFIRM
  =============================== */
  if (interaction.isButton() && interaction.customId === 'confirm_playoffs_results') {
    await interaction.deferReply({ ephemeral: true });

    await withGuild(interaction, async ({ pool, guildId }) => {
      const current = await getCurrentPlayoffs(pool, guildId);

      const mSemi   = pickOrKeep(current.semifinalists, local.semifinalists, 4);
      const mFinal  = pickOrKeep(current.finalists, local.finalists, 2);
      const mWinner = pickOrKeep(current.winner, local.winner, 1);
      const mThird  = pickOrKeep(current.third, local.third_place_winner, 1);

      if (!mSemi.ok)   return interaction.editReply(`⚠️ Półfinaliści: ${mSemi.err}`);
      if (!mFinal.ok)  return interaction.editReply(`⚠️ Finaliści: ${mFinal.err}`);
      if (!mWinner.ok) return interaction.editReply(`⚠️ Zwycięzca: ${mWinner.err}`);
      if (!mThird.ok)  return interaction.editReply(`⚠️ 3. miejsce: ${mThird.err}`);

      // relacje logiczne
      if (mFinal.merged.some(t => !mSemi.merged.includes(t)))
        return interaction.editReply('⚠️ Finaliści muszą być półfinalistami.');

      if (mWinner.merged[0] && !mFinal.merged.includes(mWinner.merged[0]))
        return interaction.editReply('⚠️ Zwycięzca musi być finalistą.');

      if (
        mThird.merged[0] &&
        (mThird.merged[0] === mWinner.merged[0] ||
         !mSemi.merged.includes(mThird.merged[0]))
      )
        return interaction.editReply('⚠️ Niepoprawne 3. miejsce.');

      // walidacja drużyn
      const teams = await loadTeamsFromDB(pool, guildId);
      const all = [
        ...mSemi.merged,
        ...mFinal.merged,
        ...mWinner.merged,
        ...mThird.merged
      ];
      const invalid = all.filter(t => !teams.includes(t));
      if (invalid.length)
        return interaction.editReply(`⚠️ Nieznane drużyny: ${invalid.join(', ')}`);

      /* ===============================
         DB SAVE (TRANSAKCJA)
      =============================== */
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        await conn.query(
          `UPDATE playoffs_results
           SET active = 0
           WHERE guild_id = ?`,
          [guildId]
        );

        await conn.query(
          `INSERT INTO playoffs_results
            (guild_id, correct_semifinalists, correct_finalists,
             correct_winner, correct_third_place_winner, active)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [
            guildId,
            mSemi.merged.join(', '),
            mFinal.merged.join(', '),
            mWinner.merged.join(', '),
            mThird.merged[0] || null
          ]
        );

        await conn.commit();
        cache.delete(cacheKey);

        return interaction.editReply(
          `✅ Zapisano wyniki Playoffs:\n` +
          `• SF: ${mSemi.merged.join(', ') || '—'}\n` +
          `• F: ${mFinal.merged.join(', ') || '—'}\n` +
          `• 🏆: ${mWinner.merged.join(', ') || '—'}\n` +
          `• 🥉: ${mThird.merged.join(', ') || '—'}`
        );
      } catch (err) {
        await conn.rollback();
        logger.error('playoffs_results', 'DB error', {
          guildId,
          adminId,
          message: err.message,
          stack: err.stack
        });
        return interaction.editReply('❌ Błąd zapisu wyników.');
      } finally {
        conn.release();
      }
    });
  }
};
