const pool = require('../db.js');
const ExcelJS = require('exceljs');
const calculateScores = require('./calculateScores');
const path = require('path');
const fs = require('fs');

function parseList(input) {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) { }
  return String(input)
    .replace(/[[\]"']/g, '')
    .split(/[;,]+/)
    .map(s => s.trim())
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
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  header.height = 20;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: 'middle', wrapText: true };
  });
}

const joinOrDash = arr => (Array.isArray(arr) && arr.length ? arr.join(', ') : '—');

function putOfficialBlock(sheet, startCol, startRow, title, rows) {
  sheet.getCell(startRow, startCol).value = title;
  sheet.getCell(startRow, startCol).font = { bold: true };

  rows.forEach((r, i) => {
    const [label, value] = r;
    sheet.getCell(startRow + 1 + i, startCol).value = label;
    sheet.getCell(startRow + 1 + i, startCol + 1).value = value;
  });

  [startCol, startCol + 1].forEach(c => {
    let max = 12;
    sheet.getColumn(c).eachCell({ includeEmpty: true }, cell => {
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

  // prosta kontrola "równoległości", żeby nie zabić rate limitów
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
        // fallback: czasem user nie jest na serwerze / brak uprawnień
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


module.exports = async function exportClassification(interaction = null, outputPath = null) {
  
  const logger = require('../utils/logger');
  const guildId = interaction?.guildId;

  if (!guildId) {
    const error = new Error('exportClassification called without guild context');
    logger.error('export', 'exportClassification called without guild context', {});
    if (interaction?.editReply) {
      await interaction.editReply({ content: '❌ Błąd: brak kontekstu serwera.' });
    }
    throw error;
  }

  
  logger.info('export', 'Starting classification export', { guildId });



  await calculateScores(guildId);
  const workbook = new ExcelJS.Workbook();

  const sheetMain = workbook.addWorksheet('Klasyfikacja ogólna');
  const sheetSwiss1 = workbook.addWorksheet('Swiss Stage 1');
  const sheetSwiss2 = workbook.addWorksheet('Swiss Stage 2');
  const sheetSwiss3 = workbook.addWorksheet('Swiss Stage 3');
  const sheetPlayoffs = workbook.addWorksheet('Playoffs');
  const sheetDouble = workbook.addWorksheet('Double Elim');
  const sheetPlayIn = workbook.addWorksheet('Play-In');
  const sheetMatches = workbook.addWorksheet('Mecze');
  const sheetMaps = workbook.addWorksheet('Mapy')
  const sheetMapsSummary = workbook.addWorksheet('Mapy (podgląd)')

  const users = {};

  sheetMaps.columns = [
  { header: 'Faza', key: 'phase', width: 12 },
  { header: 'Mecz', key: 'match_no', width: 8 },
  { header: 'Match ID', key: 'match_id', width: 9 },
  { header: 'Drużyna A', key: 'team_a', width: 22 },
  { header: 'Drużyna B', key: 'team_b', width: 22 },
  { header: 'BO', key: 'best_of', width: 5 },
  { header: 'Nick', key: 'displayname', width: 18 },
  { header: 'User ID', key: 'user_id', width: 20 },
  { header: 'Mapa', key: 'map_no', width: 6 },
  { header: 'TYP', key: 'pred', width: 10 },
  { header: 'OFF', key: 'off', width: 10 },
];

sheetMapsSummary.columns = [
  { header: 'Faza', key: 'phase', width: 12 },
  { header: 'Mecz', key: 'match_no', width: 8 },
  { header: 'Team A', key: 'team_a', width: 20 },
  { header: 'Team B', key: 'team_b', width: 20 },
  { header: 'Nick', key: 'displayname', width: 18 },
  { header: 'User ID', key: 'user_id', width: 20 },
  { header: 'Mapy (TYP → OFF)', key: 'maps', width: 40 },
];



  // === Punkty Swiss
  const [swissRows] = await pool.query(`SELECT user_id, displayname, stage, points AS score FROM swiss_scores WHERE guild_id = ?`, [guildId]);
  for (const row of swissRows) {
    const id = row.user_id;
    if (!users[id]) users[id] = { displayname: row.displayname || id, swiss: {}, playoffs: 0, double: 0, playin: 0, picks: {} };
    else if (!users[id].displayname || users[id].displayname === id) users[id].displayname = row.displayname || id;
    const stageNum = row.stage?.replace('stage', '');
    users[id].swiss[`swiss_stage_${stageNum}`] = row.score || 0;
  }

  // === Typy Swiss
  const [swissPredictions] = await pool.query(`SELECT * FROM swiss_predictions WHERE guild_id = ?`, [guildId]);
  for (const row of swissPredictions) {
    const id = row.user_id;
    if (!users[id]) users[id] = {
      displayname: row.displayname || row.username || id,
      swiss: {},
      playoffs: 0,
      double: 0,
      playin: 0,
      picks: {}
    };
    const normalizedStage = `swiss_stage_${row.stage?.replace('stage', '')}`;
    users[id].picks[normalizedStage] = {
      pick_3_0: parseList(row.pick_3_0),
      pick_0_3: parseList(row.pick_0_3),
      qualified: parseList(row.advancing)
    };
  }

  // === Playoffs
  const [playoffRows] = await pool.query(`SELECT user_id, displayname, points FROM playoffs_scores WHERE guild_id = ?`, [guildId]);
  for (const row of playoffRows) {
    const id = row.user_id;
    if (!users[id]) users[id] = { displayname: row.displayname || id, swiss: {}, playoffs: 0, double: 0, playin: 0, picks: {} };
    users[id].playoffs = row.points || 0;
  }

  const [playoffPreds] = await pool.query(`SELECT * FROM playoffs_predictions WHERE guild_id = ?`, [guildId]);
  for (const row of playoffPreds) {
    const id = row.user_id;
    if (!users[id]) users[id] = {
      displayname: row.displayname || row.username || id,
      swiss: {},
      playoffs: 0,
      double: 0,
      playin: 0,
      picks: {}
    };
    users[id].picks.playoffs = {
      semifinalists: parseList(row.semifinalists),
      finalists: parseList(row.finalists),
      winner: row.winner || '',
      third_place_winner: row.third_place_winner || ''
    };
  }

  // === Double Elim
  const [doubleRows] = await pool.query(`SELECT user_id, displayname, points FROM doubleelim_scores WHERE guild_id = ?`, [guildId]);
  for (const row of doubleRows) {
    const id = row.user_id;
    if (!users[id]) users[id] = { displayname: row.displayname || id, swiss: {}, playoffs: 0, double: 0, playin: 0, picks: {} };
    users[id].double = row.points || 0;
  }

  const [doublePreds] = await pool.query(`SELECT * FROM doubleelim_predictions WHERE guild_id = ?`, [guildId]);
  for (const row of doublePreds) {
    const id = row.user_id;
    if (!users[id]) users[id] = {
      displayname: row.displayname || row.username || id,
      swiss: {},
      playoffs: 0,
      double: 0,
      playin: 0,
      picks: {}
    };
    users[id].picks.double = {
      upper_final_a: parseList(row.upper_final_a),
      lower_final_a: parseList(row.lower_final_a),
      upper_final_b: parseList(row.upper_final_b),
      lower_final_b: parseList(row.lower_final_b)
    };
  }

  // === Play-In
  const [playinRows] = await pool.query(`SELECT user_id, displayname, points FROM playin_scores WHERE guild_id = ?`, [guildId]);
  for (const row of playinRows) {
    const id = row.user_id;
    if (!users[id]) users[id] = { displayname: row.displayname || id, swiss: {}, playoffs: 0, double: 0, playin: 0, picks: {} };
    users[id].playin = row.points || 0;
  }

  const [playinPreds] = await pool.query(`SELECT * FROM playin_predictions WHERE guild_id = ?`, [guildId]);
  for (const row of playinPreds) {
    const id = row.user_id;
    if (!users[id]) {
      users[id] = {
        displayname: row.displayname || row.username || id,
        swiss: {},
        playoffs: 0,
        double: 0,
        playin: 0,
        picks: {}
      };
    }
    users[id].picks.playin = parseList(row.teams);
  }

  // === MATCHES: suma punktów za wyniki meczów ===
  try {
    const [matchPointRows] = await pool.query(`
    SELECT user_id, SUM(points) AS points
    FROM match_points
    WHERE guild_id = ?
    GROUP BY user_id
  `, [guildId]);

    for (const row of matchPointRows) {
      const id = row.user_id;
      if (!users[id]) {
        users[id] = { displayname: id, swiss: {}, playoffs: 0, double: 0, playin: 0, picks: {} };
      }
      users[id].matches = Number(row.points || 0);
    }
  } catch (e) {
    console.log('⚠️ MATCHES: nie udało się pobrać match_points (pomijam):', e?.message || e);
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
    { header: 'Double Elim', key: 'double' },
    { header: 'Mecze', key: 'matches' },
    { header: 'Suma', key: 'total' }
  ];

  const summary = Object.entries(users).map(([user_id, u]) => {
    const swiss1 = u.swiss['swiss_stage_1'] || 0;
    const swiss2 = u.swiss['swiss_stage_2'] || 0;
    const swiss3 = u.swiss['swiss_stage_3'] || 0;
    const matches = u.matches || 0;
    const total = swiss1 + swiss2 + swiss3 + u.playoffs + u.double + u.playin + matches;
    return { user_id, displayname: u.displayname, playin: u.playin, swiss1, swiss2, swiss3, playoffs: u.playoffs, double: u.double, matches, total };
  });

  summary.sort((a, b) => {
  if (b.total !== a.total) return b.total - a.total;
  return a.displayname.localeCompare(b.displayname);
});
  summary.forEach(row => sheetMain.addRow(row));
  prettifySheet(sheetMain);
  sheetMain.columns.forEach(col => {
    let maxLength = col.header.length;
    col.eachCell({ includeEmpty: true }, cell => {
      const val = cell.value;
      if (val && val.toString().length > maxLength) maxLength = val.toString().length;
    });
    col.width = maxLength + 2;
  });

  const addSheet = (sheet, headers, dataRows) => {
    sheet.addRow(headers);
    dataRows.forEach(row => sheet.addRow(row));
    sheet.columns.forEach(col => {
      let maxLength = 10;
      col.eachCell({ includeEmpty: true }, cell => {
        const val = cell.value;
        if (val && val.toString().length > maxLength) maxLength = val.toString().length;
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
        return [id, u.displayname, p.pick_3_0.join(', '), p.pick_0_3.join(', '), p.qualified.join(', '), u.swiss[stageKey] || 0];
      }).sort((a, b) => b[5] - a[5]);

    addSheet(sheet, ['User ID', 'Nick', 'Pick 3-0', 'Pick 0-3', 'Awansujące', 'Punkty'], rows);
    prettifySheet(sheet);
  };

  exportSwiss(sheetSwiss1, 1);
  exportSwiss(sheetSwiss2, 2);
  exportSwiss(sheetSwiss3, 3);

  // === Oficjalne wyniki dla Swiss 1/2/3 ===
  {
    const [s1] = await pool.query(`
    SELECT correct_3_0, correct_0_3, correct_advancing
    FROM swiss_results
    WHERE active=1 AND stage='stage1'
    ORDER BY id DESC LIMIT 1
  `);
    if (s1.length) {
      const col = sheetSwiss1.columnCount + 2;
      putOfficialBlock(sheetSwiss1, col, 1, 'Oficjalne — Swiss 1', [
        ['3-0', joinOrDash(parseList(s1[0].correct_3_0))],
        ['0-3', joinOrDash(parseList(s1[0].correct_0_3))],
        ['Awans', joinOrDash(parseList(s1[0].correct_advancing))],
      ]);
    }

    const [s2] = await pool.query(`
    SELECT correct_3_0, correct_0_3, correct_advancing
    FROM swiss_results
    WHERE active=1 AND stage='stage2'
    ORDER BY id DESC LIMIT 1
  `);
    if (s2.length) {
      const col = sheetSwiss2.columnCount + 2;
      putOfficialBlock(sheetSwiss2, col, 1, 'Oficjalne — Swiss 2', [
        ['3-0', joinOrDash(parseList(s2[0].correct_3_0))],
        ['0-3', joinOrDash(parseList(s2[0].correct_0_3))],
        ['Awans', joinOrDash(parseList(s2[0].correct_advancing))],
      ]);
    }

    const [s3] = await pool.query(`
    SELECT correct_3_0, correct_0_3, correct_advancing
    FROM swiss_results
    WHERE active=1 AND stage='stage3'
    ORDER BY id DESC LIMIT 1
  `);
    if (s3.length) {
      const col = sheetSwiss3.columnCount + 2;
      putOfficialBlock(sheetSwiss3, col, 1, 'Oficjalne — Swiss 3', [
        ['3-0', joinOrDash(parseList(s3[0].correct_3_0))],
        ['0-3', joinOrDash(parseList(s3[0].correct_0_3))],
        ['Awans', joinOrDash(parseList(s3[0].correct_advancing))],
      ]);
    }
  }





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
    }).sort((a, b) => b[6] - a[6]);

  addSheet(sheetPlayoffs, ['User ID', 'Nick', 'Półfinaliści', 'Finaliści', 'Zwycięzca', '3. miejsce', 'Punkty'], rowsPlayoffs);
  prettifySheet(sheetPlayoffs);

  // === Oficjalne wyniki na arkuszu Playoffs ===
  try {
    const [po] = await pool.query(`
    SELECT correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner
    FROM playoffs_results
    WHERE active = 1
    ORDER BY id DESC
    LIMIT 1
  `);


    if (po && po.length) {
      const row = po[0];

      const semifinalists = parseList(row.correct_semifinalists);
      const finalists = parseList(row.correct_finalists);
      const winner = row.correct_winner || '—';
      const thirdPlace = row.correct_third_place_winner || '—';

      const usedCols = Math.max(
        sheetPlayoffs.actualColumnCount || 0,
        sheetPlayoffs.columnCount || 0,
        7 // kolumny z danymi użytkowników
      );
      const startCol = usedCols + 2; // odstęp 1 kolumny
      const startRow = 1;

      putOfficialBlock(sheetPlayoffs, startCol, startRow, 'Oficjalne — Playoffs', [
        ['Półfinaliści', semifinalists.length ? semifinalists.join(', ') : '—'],
        ['Finaliści', finalists.length ? finalists.join(', ') : '—'],
        ['Zwycięzca', winner],
        ['3. miejsce', thirdPlace],
      ]);

      console.log('📘 Oficjalne Playoffs dodane do arkusza (kolumna)', startCol);
    } else {
      console.log('⚠️ Brak aktywnych oficjalnych wyników Playoffs');
    }
  } catch (e) {
    console.error('❌ Błąd Playoffs official block:', e);
  }


  // === Wiersze z typami użytkowników: Double Elim ===
  const rowsDouble = Object.entries(users)
    .filter(([, u]) => u.picks.double)
    .map(([id, u]) => {
      const p = u.picks.double;
      const ufa = parseList(p.upper_final_a).join(', ');
      const lfa = parseList(p.lower_final_a).join(', ');
      const ufb = parseList(p.upper_final_b).join(', ');
      const lfb = parseList(p.lower_final_b).join(', ');
      return [id, u.displayname, ufa || '—', lfa || '—', ufb || '—', lfb || '—', u.double || 0];
    })
    .sort((a, b) => b[6] - a[6]);

  addSheet(sheetDouble,
    ['User ID', 'Nick', 'Upper A', 'Lower A', 'Upper B', 'Lower B', 'Punkty'],
    rowsDouble);
  prettifySheet(sheetDouble)


  // === Oficjalne wyniki na arkuszu Double Elim ===
  try {
    const [de] = await pool.query(`
    SELECT upper_final_a, lower_final_a, upper_final_b, lower_final_b
    FROM doubleelim_results
    WHERE active=1 ORDER BY id DESC LIMIT 1
  `);
    if (de.length) {
      const col = sheetDouble.columnCount + 2;
      putOfficialBlock(sheetDouble, col, 1, 'Oficjalne — Double Elim', [
        ['Upper Final A', joinOrDash(parseList(de[0].upper_final_a))],
        ['Lower Final A', joinOrDash(parseList(de[0].lower_final_a))],
        ['Upper Final B', joinOrDash(parseList(de[0].upper_final_b))],
        ['Lower Final B', joinOrDash(parseList(de[0].lower_final_b))],
      ]);
    }
  } catch (e) { }


  const rowsPlayIn = Object.entries(users)
    .filter(([, u]) => Array.isArray(u.picks.playin) && u.picks.playin.length > 0)
    .map(([id, u]) => {
      return [
        id,
        u.displayname,
        u.picks.playin.join(', '),
        u.playin || 0
      ];
    })
    .sort((a, b) => b[3] - a[3]);

  addSheet(sheetPlayIn, ['User ID', 'Nick', 'Drużyny', 'Punkty'], rowsPlayIn);
  prettifySheet(sheetPlayIn);

  // === Oficjalne wyniki na arkuszu Play-In ===
  // === Oficjalne wyniki na arkuszu Play-In ===
  try {
    // jeśli masz kolumnę active – użyj pierwszego SELECT-a, w przeciwnym razie fallback
    let po;
    try {
      [po] = await pool.query(`
      SELECT *
      FROM playin_results
      WHERE active = 1
      ORDER BY id DESC
      LIMIT 1
    `);
    } catch (_) {
      [po] = await pool.query(`
      SELECT *
      FROM playin_results
      ORDER BY id DESC
      LIMIT 1
    `);
    }

    // parser list kompatybilny z JSON i CSV



    if (po && po.length) {
      const row = po[0];

      // akceptuj różne nazwy kolumn (u Ciebie standard to correct_teams)
      const teamsRaw =
        row.correct_teams ??
        row.official_playin_teams ??
        row.teams ??
        null;

      const qualified = parseList(teamsRaw);

      // ustal bezpieczny start kolumny (po danych użytkowników)
      const usedCols = Math.max(
        sheetPlayIn?.actualColumnCount || 0,
        sheetPlayIn?.columnCount || 0,
        3 // domyślnie: [User ID, Nick, Drużyny, Punkty] — dopasuj jeśli masz więcej
      );
      const startCol = usedCols + 2; // jedna kolumna odstępu
      const startRow = 1;

      putOfficialBlock(sheetPlayIn, startCol, startRow, 'Oficjalne — Play-In', [
        ['Zakwalifikowane', joinOrDash(qualified)],
      ]);

      console.log('📘 Oficjalne Play-In dodane do arkusza (kolumna)', startCol);
    } else {
      console.log('⚠️ Brak aktywnych oficjalnych wyników Play-In');
    }
  } catch (e) {
    console.error('❌ Błąd Play-In official block:', e);
  }


  // === Arkusz: Mecze (czytelnie: tylko seria) + Arkusz: Mapy (szczegóły) ===
  try {
    // Ustaw "Mecze" jako czytelny arkusz serii
    sheetMatches.columns = [
      { header: 'Faza', key: 'phase', width: 12 },
      { header: 'Match No', key: 'match_no', width: 9 },
      { header: 'Match ID', key: 'match_id', width: 9 },
      { header: 'Team A', key: 'team_a', width: 22 },
      { header: 'Team B', key: 'team_b', width: 22 },
      { header: 'BO', key: 'best_of', width: 5 },
      { header: 'OFF (seria)', key: 'official_series', width: 12 },
      { header: 'Typ (seria)', key: 'pred_series', width: 10 },
      { header: 'Punkty', key: 'points', width: 8 },
      { header: 'Nick', key: 'displayname', width: 18 },
      { header: 'User ID', key: 'user_id', width: 20 },
    ];




    // --- Query dla SERII (bez map)
    const [matchRows] = await pool.query(`
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
    pts.points
  FROM matches m
  JOIN match_predictions p
    ON p.match_id = m.id
   AND p.guild_id = m.guild_id
  LEFT JOIN match_results r
    ON r.match_id = m.id
   AND r.guild_id = m.guild_id
  LEFT JOIN (
    SELECT match_id, user_id, SUM(points) AS points
    FROM match_points
    WHERE guild_id = ?
    GROUP BY match_id, user_id
  ) pts
    ON pts.match_id = m.id
   AND pts.user_id = p.user_id
  WHERE m.guild_id = ?
  ORDER BY
    m.phase,
    COALESCE(m.match_no, 999999),
    m.id,
    p.user_id;
`, [guildId, guildId]);



    // === MAPY (PODGLĄD) – 1 wiersz = 1 user × 1 mecz ===
    const [mapSummaryRows] = await pool.query(`
SELECT
  m.phase,
  m.match_no,
  m.team_a,
  m.team_b,
  mp.user_id,
  GROUP_CONCAT(
    CONCAT(
      'M', mp.map_no, ': ',
      mp.pred_exact_a, ':', mp.pred_exact_b,
      CASE
        WHEN mr.exact_a IS NOT NULL AND mr.exact_b IS NOT NULL
          THEN CONCAT(' → ', mr.exact_a, ':', mr.exact_b)
        ELSE ''
      END
    )
    ORDER BY mp.map_no
    SEPARATOR ', '
  ) AS maps_summary
FROM matches m
JOIN match_map_predictions mp
  ON mp.match_id = m.id
LEFT JOIN match_map_results mr
  ON mr.match_id = mp.match_id AND mr.map_no = mp.map_no
GROUP BY
  m.phase, m.match_no, m.team_a, m.team_b, mp.user_id
ORDER BY
  m.phase,
  COALESCE(m.match_no, 999999),
  m.match_no,
  mp.user_id;
`);

    const mapSummaryUserIds = mapSummaryRows.map(r => r.user_id);
    const discordNamesSummary = await fetchDisplayNamesFromDiscord(interaction, mapSummaryUserIds);

    for (const r of mapSummaryRows) {
      const fromUsers = users?.[r.user_id]?.displayname;
      const fromDiscord = discordNamesSummary.get(r.user_id);

      const nick =
        (fromUsers && fromUsers !== r.user_id)
          ? fromUsers
          : (fromDiscord || r.user_id);

      sheetMapsSummary.addRow({
        phase: r.phase,
        match_no: r.match_no,
        team_a: r.team_a,
        team_b: r.team_b,
        displayname: nick,
        user_id: r.user_id,
        maps: r.maps_summary || '—',
      });
    }

    prettifySheet(sheetMapsSummary);



    // Dociągnij displayname z Discorda dla userów, którzy tu występują
    const matchUserIds = matchRows.map(r => r.user_id).filter(Boolean);
    const discordNames = await fetchDisplayNamesFromDiscord(interaction, matchUserIds);

    for (const r of matchRows) {
      const officialSeries =
        (r.res_a === null || r.res_b === null) ? '—' : `${r.res_a}:${r.res_b}`;

      const predSeries =
        (r.user_id && r.pred_a !== null && r.pred_b !== null) ? `${r.pred_a}:${r.pred_b}` : '—';

      const fromUsers = users?.[r.user_id]?.displayname;
      const fromDiscord = r.user_id ? discordNames.get(r.user_id) : null;

      const nick =
        (!r.user_id) ? '—'
          : (fromUsers && fromUsers !== r.user_id) ? fromUsers
            : (fromDiscord || r.user_id);

      sheetMatches.addRow({
        phase: r.phase,
        match_no: r.match_no ?? '',
        match_id: r.match_id,
        team_a: r.team_a,
        team_b: r.team_b,
        best_of: r.best_of,
        official_series: officialSeries,
        pred_series: predSeries,
        points: (r.points ?? ''),
        displayname: nick,
        user_id: r.user_id ?? '—',
      });
    }

    // --- Query dla MAP (po wierszach, czytelnie)
    // Uwaga: to zakłada, że match_map_results istnieje (w Twojej bazie istnieje).
    // Jeśli match_map_predictions nie istnieje, kolumna TYP będzie '—'.
    let mapRows = [];
    try {
      const [rows] = await pool.query(`
      SELECT
  m.phase,
  m.match_no,
  m.id AS match_id,
  m.team_a,
  m.team_b,
  m.best_of,
  mp.user_id,
  mp.map_no,
  CASE
    WHEN mr.exact_a IS NOT NULL AND mr.exact_b IS NOT NULL
      THEN CONCAT(mr.exact_a, ':', mr.exact_b)
    ELSE '—'
  END AS off_score,
  CONCAT(mp.pred_exact_a, ':', mp.pred_exact_b) AS pred_score
FROM match_map_predictions mp
JOIN matches m ON m.id = mp.match_id
LEFT JOIN match_map_results mr
  ON mr.match_id = mp.match_id
 AND mr.map_no = mp.map_no
ORDER BY
  m.phase,
  COALESCE(m.match_no, 999999),
  m.id,
  mp.user_id,
  mp.map_no;
`);
      mapRows = rows;
    } catch (e) {
      console.log('⚠️ MAPY: nie udało się pobrać map (pomijam):', e?.message || e);
    }

    const mapUserIds2 = mapRows.map(r => r.user_id).filter(Boolean);
    const discordNames2 = await fetchDisplayNamesFromDiscord(interaction, mapUserIds2);

    for (const r of mapRows) {
      const fromUsers = users?.[r.user_id]?.displayname;
      const fromDiscord = r.user_id ? discordNames2.get(r.user_id) : null;
      const nick =
        (fromUsers && fromUsers !== r.user_id) ? fromUsers : (fromDiscord || r.user_id);

      sheetMaps.addRow({
        phase: r.phase,
        match_no: r.match_no ?? '',
        match_id: r.match_id,
        team_a: r.team_a ?? '—',
        team_b: r.team_b ?? '—',
        best_of: r.best_of ?? '—',
        displayname: nick,
        user_id: r.user_id,
        map_no: r.map_no,
        off: r.off_score ?? '—',
        pred: r.pred_score ?? '—',
      });


    }




    prettifySheet(sheetMatches);
    prettifySheet(sheetMaps);

  } catch (e) {
    console.log('⚠️ MATCHES/MAPY: nie udało się wygenerować arkuszy (pomijam):', e?.message || e);
  }



  // === Zapis pliku
  const buffer = await workbook.xlsx.writeBuffer();

  if (outputPath && typeof outputPath === 'string') {
    await fs.promises.writeFile(outputPath, buffer);
    console.log('✅ Plik klasyfikacji zapisany jako archiwum:', outputPath);
  } else {
    const filePath = path.join(__dirname, '../klasyfikacja.xlsx');
    await fs.promises.writeFile(filePath, buffer);
    console.log('✅ Plik klasyfikacji zapisany lokalnie:', filePath);
  }

  if (interaction?.followUp) {
    try {
      await interaction.followUp({
        content: '📤 Oto najnowsza klasyfikacja (pełna historia):',
        files: [{ attachment: buffer, name: 'klasyfikacja.xlsx' }],
        ephemeral: true
      });
    } catch (err) {
      console.error('❌ Błąd przy wysyłaniu pliku na Discorda:', err);
    }
  }

  if (!interaction) {
    console.log('📤 Klasyfikacja wygenerowana bez interakcji (np. przy /end_tournament)');
  }
};
