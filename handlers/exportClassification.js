const ExcelJS = require('exceljs');
const calculateScores = require('./calculateScores');
const path = require('path');
const fs = require('fs');
const { withGuild } = require('../utils/guildContext');
const { logInfo, logWarn, logError } = require('../utils/logger');
const { env } = require('process');
const { computeMapPoints } = require('../utils/matchScoring');
const { getMapLabel } = require('../utils/mapLabels');

function parseList(input) {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) { }
  return String(input)
    .replace(/[[\]"']/g, '')
    .split(/[;,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function prettifySheet(sheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount }
  };


  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true
  };
  header.height = 20;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: 'middle', wrapText: true };
  });

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });
}

const joinOrDash = (arr) => (Array.isArray(arr) && arr.length ? arr.join(', ') : '—');

function putOfficialBlock(sheet, startCol, startRow, title, rows) {
  sheet.getCell(startRow, startCol).value = title;
  sheet.getCell(startRow, startCol).font = { bold: true };

  rows.forEach((r, i) => {
    const [label, value] = r;
    sheet.getCell(startRow + 1 + i, startCol).value = label;
    sheet.getCell(startRow + 1 + i, startCol + 1).value = value;
  });

  [startCol, startCol + 1].forEach((c) => {
    let max = 12;
    sheet.getColumn(c).eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value ? String(cell.value) : '';
      max = Math.max(max, v.length);
    });
    sheet.getColumn(c).width = Math.min(max + 2, 60);
  });
}

async function fetchDisplayNamesFromDiscord(interaction, userIds) {
  const map = new Map();
  if (!interaction?.guild) return map;

  const unique = [...new Set(userIds)].filter(Boolean);
  const CONCURRENCY = 10;
  let i = 0;

  async function worker() {
    while (i < unique.length) {
      const id = unique[i++];
      try {
        const cached = interaction.guild.members.cache.get(id);
        if (cached?.displayName) {
          map.set(id, cached.displayName);
          continue;
        }

        const member = await interaction.guild.members.fetch(id);
        if (member?.displayName) map.set(id, member.displayName);
        else if (member?.user?.username) map.set(id, member.user.username);
      } catch (_) {
        try {
          const u = await interaction.client.users.fetch(id);
          if (u?.username) map.set(id, u.username);
        } catch (_) { }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return map;
}

function createEmptyUser(id, displayname = null) {
  return {
    displayname: displayname || id,
    swiss: {},
    playoffs: 0,
    double: 0,
    playin: 0,
    mvp: 0,
    matches: 0,
    picks: {}
  };
}

async function resolveEventId(pool, guildId) {
  const [[eventRow]] = await pool.query(
    `
    SELECT id
    FROM events
    WHERE guild_id = ?
      AND status = 'OPEN'
    ORDER BY id DESC
    LIMIT 1
    `,
    [guildId]
  );

  return eventRow?.id || null;
}

function getMatchSheetByPhase(phase, sheets) {
  const normalized = String(phase || '').trim().toLowerCase();

  if (normalized === 'swiss_stage1') return sheets.swiss1;
  if (normalized === 'swiss_stage2') return sheets.swiss2;
  if (normalized === 'swiss_stage3') return sheets.swiss3;
  if (normalized === 'playoffs') return sheets.playoffs;

  return null;
}

module.exports = async function exportClassification(arg) {
  const isInteraction =
    arg &&
    typeof arg === 'object' &&
    typeof arg.deferReply === 'function' &&
    arg.guildId;

  const interaction = isInteraction ? arg : arg?.interaction || null;
  const guildId = isInteraction ? arg.guildId : arg?.guildId;
  const outputPath = isInteraction ? null : arg?.outputPath;

  if (!guildId) {
    throw new Error('exportClassification: missing guildId');
  }

  if (interaction && !interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  await withGuild({ guildId }, async ({ pool, guildId }) => {
    const eventId = arg?.eventId || await resolveEventId(pool, guildId);

    if (!eventId) {
      throw new Error('exportClassification: missing eventId');
    }

    await calculateScores(guildId, eventId);
    logInfo('EXPORT_CLASSIFICATION_START', { guildId });

    const workbook = new ExcelJS.Workbook();

    const sheetMain = workbook.addWorksheet('Klasyfikacja ogólna');
    const sheetSwiss1 = workbook.addWorksheet('Swiss Stage 1');
    const sheetSwiss2 = workbook.addWorksheet('Swiss Stage 2');
    const sheetSwiss3 = workbook.addWorksheet('Swiss Stage 3');
    const sheetPlayoffs = workbook.addWorksheet('Playoffs');
    const sheetMvp = workbook.addWorksheet('MVP');
    const sheetDouble = workbook.addWorksheet('Double Elim');
    const sheetPlayIn = workbook.addWorksheet('Play-In');
    const sheetMatchesSwiss1 = workbook.addWorksheet('Mecze - Swiss 1');
    const sheetMatchesSwiss2 = workbook.addWorksheet('Mecze - Swiss 2');
    const sheetMatchesSwiss3 = workbook.addWorksheet('Mecze - Swiss 3');
    const sheetMatchesPlayoffs = workbook.addWorksheet('Mecze - Playoffs');
    const sheetMaps = workbook.addWorksheet('Mapy');
    const sheetMapsSummary = workbook.addWorksheet('Mapy (podgląd)');

    const users = {};

    sheetMapsSummary.columns = [
      { header: 'Faza', key: 'phase', width: 12 },
      { header: 'Mecz', key: 'match_no', width: 8 },
      { header: 'Team A', key: 'team_a', width: 20 },
      { header: 'Team B', key: 'team_b', width: 20 },
      { header: 'Nick', key: 'displayname', width: 18 },
      { header: 'User ID', key: 'user_id', width: 20 },
      { header: 'Mapy (TYP → OFF)', key: 'maps', width: 40 }
    ];

    // === Punkty Swiss
    const [swissRows] = await pool.query(
      `
      SELECT user_id, displayname, stage, points AS score
      FROM swiss_scores
      WHERE guild_id = ?
      AND event_id = ?
      `,
      [guildId, eventId]
    );

    for (const row of swissRows) {
      const id = row.user_id;
      if (!users[id]) {
        users[id] = createEmptyUser(id, row.displayname || id);
      } else if (!users[id].displayname || users[id].displayname === id) {
        users[id].displayname = row.displayname || id;
      }

      const stageNum = row.stage?.replace('stage', '');
      users[id].swiss[`swiss_stage_${stageNum}`] = row.score || 0;
    }

    // === Typy Swiss
    const [swissPredictions] = await pool.query(
      `
      SELECT *
      FROM swiss_predictions
      WHERE guild_id = ?
      AND event_id = ?
      `,
      [guildId, eventId]
    );

    for (const row of swissPredictions) {
      const id = row.user_id;
      if (!users[id]) {
        users[id] = createEmptyUser(id, row.displayname || row.username || id);
      }

      const normalizedStage = `swiss_stage_${row.stage?.replace('stage', '')}`;
      users[id].picks[normalizedStage] = {
        pick_3_0: parseList(row.pick_3_0),
        pick_0_3: parseList(row.pick_0_3),
        qualified: parseList(row.advancing)
      };
    }

    // === Playoffs
    const [playoffRows] = await pool.query(
      `
      SELECT user_id, displayname, points
      FROM playoffs_scores
      WHERE guild_id = ?
      AND event_id = ?
      `,
      [guildId, eventId]
    );

    for (const row of playoffRows) {
      const id = row.user_id;
      if (!users[id]) {
        users[id] = createEmptyUser(id, row.displayname || id);
      }
      users[id].playoffs = row.points || 0;
    }

    const [playoffPreds] = await pool.query(
      `
      SELECT *
      FROM playoffs_predictions
      WHERE guild_id = ?
      AND event_id = ?
      `,
      [guildId, eventId]
    );

    for (const row of playoffPreds) {
      const id = row.user_id;
      if (!users[id]) {
        users[id] = createEmptyUser(id, row.displayname || row.username || id);
      }
      users[id].picks.playoffs = {
        semifinalists: parseList(row.semifinalists),
        finalists: parseList(row.finalists),
        winner: row.winner || '',
        third_place_winner: row.third_place_winner || ''
      };
    }

    // === Double Elim
    const [doubleRows] = await pool.query(
      `
      SELECT user_id, displayname, points
      FROM doubleelim_scores
      WHERE guild_id = ?
      AND event_id = ?
      `,
      [guildId, eventId]
    );

    for (const row of doubleRows) {
      const id = row.user_id;
      if (!users[id]) {
        users[id] = createEmptyUser(id, row.displayname || id);
      }
      users[id].double = row.points || 0;
    }

    const [doublePreds] = await pool.query(
      `
      SELECT *
      FROM doubleelim_predictions
      WHERE guild_id = ?
      AND event_id = ?
      `,
      [guildId, eventId]
    );

    for (const row of doublePreds) {
      const id = row.user_id;
      if (!users[id]) {
        users[id] = createEmptyUser(id, row.displayname || row.username || id);
      }
      users[id].picks.double = {
        upper_final_a: parseList(row.upper_final_a),
        lower_final_a: parseList(row.lower_final_a),
        upper_final_b: parseList(row.upper_final_b),
        lower_final_b: parseList(row.lower_final_b)
      };
    }

    // === MVP
    const [mvpRows] = await pool.query(
      `
      SELECT user_id, displayname, points
      FROM mvp_scores
      WHERE guild_id = ?
      AND event_id = ?
      `,
      [guildId, eventId]
    );

    for (const row of mvpRows) {
      const id = row.user_id;
      if (!users[id]) {
        users[id] = createEmptyUser(id, row.displayname || id);
      }
      users[id].mvp = row.points || 0;
    }

    const [mvpPreds] = await pool.query(
      `
      SELECT *
      FROM mvp_predictions
      WHERE guild_id = ?
      AND event_id = ?
      `,
      [guildId, eventId]
    );

    for (const row of mvpPreds) {
      const id = row.user_id;
      if (!users[id]) {
        users[id] = createEmptyUser(id, row.username || id);
      }
      users[id].picks.mvp = {
        candidate_id: row.candidate_id
      };
    }

    const [mvpCandidatesRows] = await pool.query(
      `
      SELECT id, nickname, team_name
      FROM mvp_candidates
      WHERE guild_id = ?
      AND event_id = ?
      `,
      [guildId, eventId]
    );

    const mvpCandidatesMap = new Map(
      mvpCandidatesRows.map(r => [
        Number(r.id),
        {
          nickname: r.nickname,
          team_name: r.team_name
        }
      ])
    );

    // === Play-In
    const [playinRows] = await pool.query(
      `
      SELECT user_id, displayname, points
      FROM playin_scores
      WHERE guild_id = ?
      AND event_id = ?
      `,
      [guildId, eventId]
    );

    for (const row of playinRows) {
      const id = row.user_id;
      if (!users[id]) {
        users[id] = createEmptyUser(id, row.displayname || id);
      }
      users[id].playin = row.points || 0;
    }

    const [playinPreds] = await pool.query(
      `
      SELECT *
      FROM playin_predictions
      WHERE guild_id = ?
      AND event_id = ?
      `,
      [guildId, eventId]
    );

    for (const row of playinPreds) {
      const id = row.user_id;
      if (!users[id]) {
        users[id] = createEmptyUser(id, row.displayname || row.username || id);
      }
      users[id].picks.playin = parseList(row.teams);
    }

    // === MATCHES: suma punktów za wyniki meczów
    try {
      const [matchPointRows] = await pool.query(
        `
        SELECT user_id, SUM(points) AS points
        FROM match_points
        WHERE guild_id = ?
        AND event_id = ?
        GROUP BY user_id
        `,
        [guildId, eventId]
      );

      for (const row of matchPointRows) {
        const id = row.user_id;
        if (!users[id]) {
          users[id] = createEmptyUser(id, id);
        }
        users[id].matches = Number(row.points || 0);
      }
    } catch (e) {
      // pomijamy mecze, jeśli tabela/kolumny nie istnieją
    }

    // === Klasyfikacja ogólna
    sheetMain.columns = [
      { header: 'User ID', key: 'user_id' },
      { header: 'Nick', key: 'displayname' },
      { header: 'Play-In', key: 'playin' },
      { header: 'Swiss 1', key: 'swiss1' },
      { header: 'Swiss 2', key: 'swiss2' },
      { header: 'Swiss 3', key: 'swiss3' },
      { header: 'Playoffs', key: 'playoffs' },
      { header: 'MVP', key: 'mvp' },
      { header: 'Double Elim', key: 'double' },
      { header: 'Mecze', key: 'matches' },
      { header: 'Suma', key: 'total' }
    ];

    const summaryUserIds = Object.keys(users);
    const summaryDiscordNames = await fetchDisplayNamesFromDiscord(interaction, summaryUserIds);

    for (const [id, u] of Object.entries(users)) {
      if (!u.displayname || u.displayname === id) {
        u.displayname = summaryDiscordNames.get(id) || id;
      }
    }

    const summary = Object.entries(users).map(([user_id, u]) => {
      const swiss1 = u.swiss['swiss_stage_1'] || 0;
      const swiss2 = u.swiss['swiss_stage_2'] || 0;
      const swiss3 = u.swiss['swiss_stage_3'] || 0;
      const matches = u.matches || 0;
      const mvp = u.mvp || 0;

      const total =
        swiss1 +
        swiss2 +
        swiss3 +
        u.playoffs +
        u.double +
        u.playin +
        mvp +
        matches;

      return {
        user_id,
        displayname: u.displayname,
        playin: u.playin,
        swiss1,
        swiss2,
        swiss3,
        playoffs: u.playoffs,
        mvp,
        double: u.double,
        matches,
        total
      };
    });

    summary.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.displayname.localeCompare(b.displayname);
    });

    summary.forEach((row) => sheetMain.addRow(row));
    prettifySheet(sheetMain);

    sheetMain.columns.forEach((col) => {
      let maxLength = col.header.length;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const val = cell.value;
        if (val && val.toString().length > maxLength) {
          maxLength = val.toString().length;
        }
      });
      col.width = maxLength + 2;
    });

    const addSheet = (sheet, headers, dataRows) => {
      sheet.addRow(headers);
      dataRows.forEach((row) => sheet.addRow(row));

      sheet.columns.forEach((col) => {
        let maxLength = 10;
        col.eachCell({ includeEmpty: true }, (cell) => {
          const val = cell.value;
          if (val && val.toString().length > maxLength) {
            maxLength = val.toString().length;
          }
        });
        col.width = maxLength + 2;
      });
    };

    const exportSwiss = (sheet, stageNum) => {
      const stageKey = `swiss_stage_${stageNum}`;
      const rows = Object.entries(users)
        .filter(([, u]) => u.picks[stageKey])
        .map(([id, u]) => {
          const p = u.picks[stageKey];
          return [
            id,
            u.displayname,
            p.pick_3_0.join(', '),
            p.pick_0_3.join(', '),
            p.qualified.join(', '),
            u.swiss[stageKey] || 0
          ];
        })
        .sort((a, b) => b[5] - a[5]);

      addSheet(
        sheet,
        ['User ID', 'Nick', 'Pick 3-0', 'Pick 0-3', 'Awansujące', 'Punkty'],
        rows
      );
      prettifySheet(sheet);
    };

    exportSwiss(sheetSwiss1, 1);
    exportSwiss(sheetSwiss2, 2);
    exportSwiss(sheetSwiss3, 3);

    // === Oficjalne wyniki Swiss
    {
      const [s1] = await pool.query(
        `
        SELECT correct_3_0, correct_0_3, correct_advancing
        FROM swiss_results
        WHERE guild_id = ?
          AND event_id = ?
          AND active = 1
          AND stage = 'stage1'
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, eventId]
      );

      if (s1.length) {
        const col = sheetSwiss1.columnCount + 2;
        putOfficialBlock(sheetSwiss1, col, 1, 'Oficjalne — Swiss 1', [
          ['3-0', joinOrDash(parseList(s1[0].correct_3_0))],
          ['0-3', joinOrDash(parseList(s1[0].correct_0_3))],
          ['Awans', joinOrDash(parseList(s1[0].correct_advancing))]
        ]);
      }

      const [s2] = await pool.query(
        `
        SELECT correct_3_0, correct_0_3, correct_advancing
        FROM swiss_results
        WHERE guild_id = ?
          AND event_id = ?
          AND active = 1
          AND stage = 'stage2'
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, eventId]
      );

      if (s2.length) {
        const col = sheetSwiss2.columnCount + 2;
        putOfficialBlock(sheetSwiss2, col, 1, 'Oficjalne — Swiss 2', [
          ['3-0', joinOrDash(parseList(s2[0].correct_3_0))],
          ['0-3', joinOrDash(parseList(s2[0].correct_0_3))],
          ['Awans', joinOrDash(parseList(s2[0].correct_advancing))]
        ]);
      }

      const [s3] = await pool.query(
        `
        SELECT correct_3_0, correct_0_3, correct_advancing
        FROM swiss_results
        WHERE guild_id = ?
          AND event_id = ?
          AND active = 1
          AND stage = 'stage3'
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, eventId]
      );

      if (s3.length) {
        const col = sheetSwiss3.columnCount + 2;
        putOfficialBlock(sheetSwiss3, col, 1, 'Oficjalne — Swiss 3', [
          ['3-0', joinOrDash(parseList(s3[0].correct_3_0))],
          ['0-3', joinOrDash(parseList(s3[0].correct_0_3))],
          ['Awans', joinOrDash(parseList(s3[0].correct_advancing))]
        ]);
      }
    }

    // === Playoffs sheet
    const rowsPlayoffs = Object.entries(users)
      .filter(([, u]) => u.picks.playoffs)
      .map(([id, u]) => {
        const p = u.picks.playoffs;
        return [
          id,
          u.displayname,
          parseList(p.semifinalists).join(', '),
          parseList(p.finalists).join(', '),
          p.winner || '',
          p.third_place_winner || '',
          u.playoffs || 0
        ];
      })
      .sort((a, b) => b[6] - a[6]);

    addSheet(
      sheetPlayoffs,
      ['User ID', 'Nick', 'Półfinaliści', 'Finaliści', 'Zwycięzca', '3. miejsce', 'Punkty'],
      rowsPlayoffs
    );
    prettifySheet(sheetPlayoffs);

    try {
      const [po] = await pool.query(
        `
        SELECT correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner
        FROM playoffs_results
        WHERE guild_id = ?
          AND event_id = ?
          AND active = 1
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, eventId]
      );

      if (po && po.length) {
        const row = po[0];
        const semifinalists = parseList(row.correct_semifinalists);
        const finalists = parseList(row.correct_finalists);
        const winner = row.correct_winner || '—';
        const thirdPlace = row.correct_third_place_winner || '—';

        const usedCols = Math.max(
          sheetPlayoffs.actualColumnCount || 0,
          sheetPlayoffs.columnCount || 0,
          7
        );

        putOfficialBlock(sheetPlayoffs, usedCols + 2, 1, 'Oficjalne — Playoffs', [
          ['Półfinaliści', semifinalists.length ? semifinalists.join(', ') : '—'],
          ['Finaliści', finalists.length ? finalists.join(', ') : '—'],
          ['Zwycięzca', winner],
          ['3. miejsce', thirdPlace]
        ]);
      }
    } catch (e) {
      console.error('❌ Błąd Playoffs official block:', e);
    }

    // === MVP sheet
    const rowsMvp = Object.entries(users)
      .filter(([, u]) => u.picks.mvp)
      .map(([id, u]) => {
        const candidate = mvpCandidatesMap.get(Number(u.picks.mvp.candidate_id));

        const pickedMvp = candidate
          ? `${candidate.nickname}${candidate.team_name ? ` (${candidate.team_name})` : ''}`
          : `ID ${u.picks.mvp.candidate_id}`;

        return [
          id,
          u.displayname,
          pickedMvp,
          u.mvp || 0
        ];
      })
      .sort((a, b) => b[3] - a[3]);

    addSheet(
      sheetMvp,
      ['User ID', 'Nick', 'Typ MVP', 'Punkty'],
      rowsMvp
    );
    prettifySheet(sheetMvp);

    try {
      const [mvpOfficial] = await pool.query(
        `
        SELECT mr.candidate_id, mc.nickname, mc.team_name
        FROM mvp_results mr
        LEFT JOIN mvp_candidates mc
          ON mc.id = mr.candidate_id
        WHERE mr.guild_id = ?
          AND mr.active = 1
          AND mr.event_id = ?
        ORDER BY mr.id DESC
        LIMIT 1
        `,
        [guildId, eventId]
      );

      if (mvpOfficial.length) {
        const row = mvpOfficial[0];

        const officialMvp =
          row.nickname
            ? `${row.nickname}${row.team_name ? ` (${row.team_name})` : ''}`
            : `ID ${row.candidate_id}`;

        const col = sheetMvp.columnCount + 2;
        putOfficialBlock(sheetMvp, col, 1, 'Oficjalne — MVP', [
          ['MVP', officialMvp]
        ]);
      }
    } catch (e) {
      console.error('❌ Błąd MVP official block:', e);
    }

    // === Double Elim sheet
    const rowsDouble = Object.entries(users)
      .filter(([, u]) => u.picks.double)
      .map(([id, u]) => {
        const p = u.picks.double;
        const ufa = parseList(p.upper_final_a).join(', ');
        const lfa = parseList(p.lower_final_a).join(', ');
        const ufb = parseList(p.upper_final_b).join(', ');
        const lfb = parseList(p.lower_final_b).join(', ');

        return [
          id,
          u.displayname,
          ufa || '—',
          lfa || '—',
          ufb || '—',
          lfb || '—',
          u.double || 0
        ];
      })
      .sort((a, b) => b[6] - a[6]);

    addSheet(
      sheetDouble,
      ['User ID', 'Nick', 'Upper A', 'Lower A', 'Upper B', 'Lower B', 'Punkty'],
      rowsDouble
    );
    prettifySheet(sheetDouble);

    try {
      const [de] = await pool.query(
        `
        SELECT upper_final_a, lower_final_a, upper_final_b, lower_final_b
        FROM doubleelim_results
        WHERE guild_id = ?
          AND active = 1
          AND event_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, eventId]
      );

      if (de.length) {
        const col = sheetDouble.columnCount + 2;
        putOfficialBlock(sheetDouble, col, 1, 'Oficjalne — Double Elim', [
          ['Upper Final A', joinOrDash(parseList(de[0].upper_final_a))],
          ['Lower Final A', joinOrDash(parseList(de[0].lower_final_a))],
          ['Upper Final B', joinOrDash(parseList(de[0].upper_final_b))],
          ['Lower Final B', joinOrDash(parseList(de[0].lower_final_b))]
        ]);
      }
    } catch (e) { }

    // === Play-In sheet
    const rowsPlayIn = Object.entries(users)
      .filter(([, u]) => Array.isArray(u.picks.playin) && u.picks.playin.length > 0)
      .map(([id, u]) => [
        id,
        u.displayname,
        u.picks.playin.join(', '),
        u.playin || 0
      ])
      .sort((a, b) => b[3] - a[3]);

    addSheet(
      sheetPlayIn,
      ['User ID', 'Nick', 'Drużyny', 'Punkty'],
      rowsPlayIn
    );
    prettifySheet(sheetPlayIn);

    try {
      const [po] = await pool.query(
        `
        SELECT *
        FROM playin_results
        WHERE guild_id = ?
          AND active = 1
          AND event_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, eventId]
      );

      if (po && po.length) {
        const row = po[0];
        const teamsRaw = row.correct_teams ?? row.official_playin_teams ?? row.teams ?? null;
        const qualified = parseList(teamsRaw);

        const usedCols = Math.max(
          sheetPlayIn?.actualColumnCount || 0,
          sheetPlayIn?.columnCount || 0,
          3
        );

        putOfficialBlock(sheetPlayIn, usedCols + 2, 1, 'Oficjalne — Play-In', [
          ['Zakwalifikowane', joinOrDash(qualified)]
        ]);
      }
    } catch (e) {
      console.error('❌ Błąd Play-In official block:', e);
    }

    // === Mecze / Mapy
    try {
      const matchColumns = [
        { header: 'Faza', key: 'phase', width: 12 },
        { header: 'Match No', key: 'match_no', width: 9 },
        { header: 'Match ID', key: 'match_id', width: 9 },
        { header: 'Team A', key: 'team_a', width: 22 },
        { header: 'Team B', key: 'team_b', width: 22 },
        { header: 'BO', key: 'best_of', width: 5 },
        { header: 'OFF (seria)', key: 'official_series', width: 12 },
        { header: 'Typ (seria)', key: 'pred_series', width: 10 },
        { header: 'Suma', key: 'points', width: 7 },
        { header: 'Nick', key: 'displayname', width: 18 },
        { header: 'User ID', key: 'user_id', width: 20 }
      ];

      const matchSheets = {
        swiss1: sheetMatchesSwiss1,
        swiss2: sheetMatchesSwiss2,
        swiss3: sheetMatchesSwiss3,
        playoffs: sheetMatchesPlayoffs
      };

      for (const sheet of Object.values(matchSheets)) {
        sheet.columns = matchColumns;
      }

      sheetMaps.columns = [
        { header: 'Faza', key: 'phase', width: 12 },
        { header: 'Mecz', key: 'match_no', width: 8 },
        { header: 'Match ID', key: 'match_id', width: 9 },
        { header: 'Drużyna A', key: 'team_a', width: 22 },
        { header: 'Drużyna B', key: 'team_b', width: 22 },
        { header: 'BO', key: 'best_of', width: 5 },
        { header: 'Nick', key: 'displayname', width: 18 },
        { header: 'User ID', key: 'user_id', width: 20 },
        { header: 'Mapa', key: 'map_label', width: 14 },
        { header: 'TYP', key: 'pred', width: 10 },
        { header: 'OFF', key: 'off', width: 10 },
        { header: 'Pkt', key: 'points', width: 6 },
        { header: 'Ocena', key: 'rating', width: 12 }
      ];

      sheetMapsSummary.columns = [
        { header: 'Faza', key: 'phase', width: 12 },
        { header: 'Mecz', key: 'match_no', width: 8 },
        { header: 'Team A', key: 'team_a', width: 20 },
        { header: 'Team B', key: 'team_b', width: 20 },
        { header: 'Nick', key: 'displayname', width: 18 },
        { header: 'User ID', key: 'user_id', width: 20 },
        { header: 'Mapy (TYP → OFF)', key: 'maps', width: 70 }
      ];

      const [matchRows] = await pool.query(
        `
    SELECT
      m.id AS match_id,
      m.phase,
      m.match_no,
      m.team_a,
      m.team_b,
      m.best_of,
      r.res_a,
      r.res_b,
      p.user_id,
      p.pred_a,
      p.pred_b,
      mp.points
    FROM matches m
    JOIN match_predictions p
      ON p.match_id = m.id
     AND p.guild_id = m.guild_id
     AND p.event_id = m.event_id
    LEFT JOIN match_results r
      ON r.match_id = m.id
     AND r.guild_id = m.guild_id
     AND r.event_id = m.event_id
    LEFT JOIN match_points mp
      ON mp.match_id = m.id
     AND mp.guild_id = m.guild_id
     AND mp.event_id = m.event_id
     AND mp.user_id = p.user_id
    WHERE m.guild_id = ?
      AND m.event_id = ?
    ORDER BY
      m.phase,
      COALESCE(m.match_no, 999999),
      m.id,
      p.user_id
    `,
        [guildId, eventId]
      );

      const matchUserIds = matchRows.map((r) => r.user_id).filter(Boolean);
      const discordNames = await fetchDisplayNamesFromDiscord(interaction, matchUserIds);

      for (const r of matchRows) {
        const officialSeries =
          r.res_a === null || r.res_b === null ? '—' : `${r.res_a}:${r.res_b}`;

        const predSeries =
          r.user_id && r.pred_a !== null && r.pred_b !== null
            ? `${r.pred_a}:${r.pred_b}`
            : '—';

        const fromUsers = users?.[r.user_id]?.displayname;
        const fromDiscord = r.user_id ? discordNames.get(r.user_id) : null;

        const nick = !r.user_id
          ? '—'
          : fromUsers && fromUsers !== r.user_id
            ? fromUsers
            : fromDiscord || r.user_id;

        const targetSheet = getMatchSheetByPhase(r.phase, matchSheets);

        if (targetSheet) {
          targetSheet.addRow({
            phase: r.phase,
            match_no: r.match_no ?? '',
            match_id: r.match_id,
            team_a: r.team_a,
            team_b: r.team_b,
            best_of: r.best_of,
            official_series: officialSeries,
            pred_series: predSeries,
            points: r.points ?? 0,
            displayname: nick,
            user_id: r.user_id ?? '—'
          });
        }
      }

      const [mapRows] = await pool.query(
        `
    SELECT *
    FROM (
      SELECT
        m.phase,
        m.match_no,
        m.id AS match_id,
        m.team_a,
        m.team_b,
        m.best_of,
        p.user_id,
        1 AS map_no,
        p.pred_exact_a,
        p.pred_exact_b,
        r.exact_a,
        r.exact_b
      FROM match_predictions p
      JOIN matches m
        ON m.id = p.match_id
       AND m.guild_id = p.guild_id
       AND m.event_id = p.event_id
      LEFT JOIN match_results r
        ON r.match_id = p.match_id
       AND r.guild_id = p.guild_id
       AND r.event_id = p.event_id
      WHERE p.guild_id = ?
        AND p.event_id = ?
        AND m.best_of = 1
        AND p.pred_exact_a IS NOT NULL
        AND p.pred_exact_b IS NOT NULL

      UNION ALL

      SELECT
        m.phase,
        m.match_no,
        m.id AS match_id,
        m.team_a,
        m.team_b,
        m.best_of,
        p.user_id,
        p.map_no,
        p.pred_exact_a,
        p.pred_exact_b,
        r.exact_a,
        r.exact_b
      FROM match_map_predictions p
      JOIN matches m
        ON m.id = p.match_id
       AND m.guild_id = p.guild_id
       AND m.event_id = p.event_id
      LEFT JOIN match_map_results r
        ON r.match_id = p.match_id
       AND r.guild_id = p.guild_id
       AND r.event_id = p.event_id
       AND r.map_no = p.map_no
      WHERE p.guild_id = ?
        AND p.event_id = ?
        AND m.best_of IN (3, 5)
        AND p.pred_exact_a IS NOT NULL
        AND p.pred_exact_b IS NOT NULL
    ) x
    ORDER BY
      x.phase,
      COALESCE(x.match_no, 999999),
      x.match_id,
      x.user_id,
      x.map_no
    `,
        [guildId, eventId, guildId, eventId]
      );

      const mapUserIds = mapRows.map((r) => r.user_id).filter(Boolean);
      const discordNamesMaps = await fetchDisplayNamesFromDiscord(interaction, mapUserIds);

      const mapSummaryMap = new Map();

      for (const r of mapRows) {
        const fromUsers = users?.[r.user_id]?.displayname;
        const fromDiscord = r.user_id ? discordNamesMaps.get(r.user_id) : null;
        const nick = fromUsers && fromUsers !== r.user_id ? fromUsers : fromDiscord || r.user_id;

        const predScore = `${r.pred_exact_a}:${r.pred_exact_b}`;
        const offScore =
          r.exact_a == null || r.exact_b == null
            ? '—'
            : `${r.exact_a}:${r.exact_b}`;

        const points = computeMapPoints({
          predExactA: r.pred_exact_a,
          predExactB: r.pred_exact_b,
          exactA: r.exact_a,
          exactB: r.exact_b
        });

        const mapLabel = getMapLabel(r.map_no, r.best_of);

        let rating = '❌ Miss';

        if (points === 3) {
          rating = '🎯 Exact';
        } else if (points === 2) {
          rating = '🔥 Blisko';
        } else if (points === 1) {
          rating = '👍 Prawie';
        }

        const row = sheetMaps.addRow({
          phase: r.phase,
          match_no: r.match_no ?? '',
          match_id: r.match_id,
          team_a: r.team_a ?? '—',
          team_b: r.team_b ?? '—',
          best_of: r.best_of ?? '—',
          displayname: nick,
          user_id: r.user_id,
          map_label: mapLabel,
          pred: predScore,
          off: offScore,
          points,
          rating
        });

        const ratingCell = row.getCell('rating');

        if (points === 3) {
          ratingCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'D9EAD3' }
          };
        } else if (points === 2) {
          ratingCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2CC' }
          };
        } else if (points === 1) {
          ratingCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FCE5CD' }
          };
        } else {
          ratingCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F4CCCC' }
          };
        }

        ratingCell.alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };

        const summaryKey = [
          r.phase,
          r.match_no ?? '',
          r.team_a,
          r.team_b,
          r.user_id
        ].join('|');

        if (!mapSummaryMap.has(summaryKey)) {
          mapSummaryMap.set(summaryKey, {
            phase: r.phase,
            match_no: r.match_no,
            team_a: r.team_a,
            team_b: r.team_b,
            displayname: nick,
            user_id: r.user_id,
            maps: []
          });
        }

        mapSummaryMap.get(summaryKey).maps.push(
          `${mapLabel}: ${predScore} → ${offScore} (+${points} pkt)`
        );
      }

      for (const r of mapSummaryMap.values()) {
        sheetMapsSummary.addRow({
          phase: r.phase,
          match_no: r.match_no,
          team_a: r.team_a,
          team_b: r.team_b,
          displayname: r.displayname,
          user_id: r.user_id,
          maps: r.maps.join(' | ') || '—'
        });
      }

      for (const sheet of Object.values(matchSheets)) {
        prettifySheet(sheet);
      }

      prettifySheet(sheetMaps);
      prettifySheet(sheetMapsSummary);
    } catch (e) {
      logError('EXPORT_MATCHES_MAPS_FAILED', {
        guildId,
        eventId,
        message: e.message,
        stack: e.stack
      });

      throw e;
    }
    const buffer = await workbook.xlsx.writeBuffer();

    if (outputPath && typeof outputPath === 'string') {
      await fs.promises.writeFile(outputPath, buffer);
    } else {
      const filePath = path.join(__dirname, '../klasyfikacja.xlsx');
      await fs.promises.writeFile(filePath, buffer);
    }

    if (interaction && (interaction.deferred || interaction.replied)) {
      try {
        await interaction.editReply({
          content: '📤 Oto najnowsza klasyfikacja:',
          files: [{ attachment: buffer, name: 'klasyfikacja.xlsx' }]
        });
      } catch (err) {
        console.error('❌ Błąd przy wysyłaniu pliku na Discorda:', err);
      }
    }
  });
};