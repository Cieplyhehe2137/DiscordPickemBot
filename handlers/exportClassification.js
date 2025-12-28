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

module.exports = async function exportClassification(interaction = null, outputPath = null) {
  if (interaction?.deferReply) {
    await interaction.deferReply({ ephemeral: true });
  }

  await calculateScores();
  const workbook = new ExcelJS.Workbook();

  const sheetMain = workbook.addWorksheet('Klasyfikacja ogólna');
  const sheetSwiss1 = workbook.addWorksheet('Swiss Stage 1');
  const sheetSwiss2 = workbook.addWorksheet('Swiss Stage 2');
  const sheetSwiss3 = workbook.addWorksheet('Swiss Stage 3');
  const sheetPlayoffs = workbook.addWorksheet('Playoffs');
  const sheetDouble = workbook.addWorksheet('Double Elim');
  const sheetPlayIn = workbook.addWorksheet('Play-In');
  const sheetMatches = workbook.addWorksheet('Mecze');

  const users = {};

  // === Punkty Swiss
  const [swissRows] = await pool.query(`SELECT user_id, displayname, stage, points AS score FROM swiss_scores`);
  for (const row of swissRows) {
    const id = row.user_id;
    if (!users[id]) users[id] = { displayname: row.displayname || id, swiss: {}, playoffs: 0, double: 0, playin: 0, picks: {} };
    else if (!users[id].displayname || users[id].displayname === id) users[id].displayname = row.displayname || id;
    const stageNum = row.stage?.replace('stage', '');
    users[id].swiss[`swiss_stage_${stageNum}`] = row.score || 0;
  }

  // === Typy Swiss
  const [swissPredictions] = await pool.query(`SELECT * FROM swiss_predictions`);
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
  const [playoffRows] = await pool.query(`SELECT user_id, displayname, points FROM playoffs_scores`);
  for (const row of playoffRows) {
    const id = row.user_id;
    if (!users[id]) users[id] = { displayname: row.displayname || id, swiss: {}, playoffs: 0, double: 0, playin: 0, picks: {} };
    users[id].playoffs = row.points || 0;
  }

  const [playoffPreds] = await pool.query(`SELECT * FROM playoffs_predictions`);
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
  const [doubleRows] = await pool.query(`SELECT user_id, displayname, points FROM doubleelim_scores`);
  for (const row of doubleRows) {
    const id = row.user_id;
    if (!users[id]) users[id] = { displayname: row.displayname || id, swiss: {}, playoffs: 0, double: 0, playin: 0, picks: {} };
    users[id].double = row.points || 0;
  }

  const [doublePreds] = await pool.query(`SELECT * FROM doubleelim_predictions`);
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
  const [playinRows] = await pool.query(`SELECT user_id, displayname, points FROM playin_scores`);
  for (const row of playinRows) {
    const id = row.user_id;
    if (!users[id]) users[id] = { displayname: row.displayname || id, swiss: {}, playoffs: 0, double: 0, playin: 0, picks: {} };
    users[id].playin = row.points || 0;
  }

  const [playinPreds] = await pool.query(`SELECT * FROM playin_predictions`);
  for (const row of playinPreds) {
    const id = row.user_id;
    if (!users[id]) continue;
    users[id].picks.playin = parseList(row.teams);
  }

  // === MATCHES: suma punktów za wyniki meczów ===
  try {
    const [matchPointRows] = await pool.query(`
    SELECT user_id, SUM(points) AS points
    FROM match_points
    GROUP BY user_id
  `);

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

  summary.sort((a, b) => b.total - a.total);
  summary.forEach(row => sheetMain.addRow(row));
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

  // === Oficjalne wyniki na arkuszu Playoffs ===
  try {
    const [po] = await pool.query(`
    SELECT correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner
    FROM playoffs_results
    WHERE active = 1
    ORDER BY id DESC
    LIMIT 1
  `);

    const parseList = (val) => {
      if (!val) return [];
      try {
        const j = JSON.parse(val);
        if (Array.isArray(j)) return j;
      } catch { }
      return String(val)
        .replace(/[[\]"']/g, '')
        .split(/[;,]+/)
        .map(s => s.trim())
        .filter(Boolean);
    };

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
    rowsDouble
  );

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
    .filter(([, u]) => u.picks.playin)
    .map(([id, u]) => {
      const picks = parseList(u.picks.playin);
      return [id, u.displayname, picks.join(', '), u.playin || 0];
    }).sort((a, b) => b[3] - a[3]);

  addSheet(sheetPlayIn, ['User ID', 'Nick', 'Drużyny', 'Punkty'], rowsPlayIn);

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
    const parseList = (val) => {
      if (!val) return [];
      try {
        const j = JSON.parse(val);
        if (Array.isArray(j)) return j;
      } catch { }
      return String(val)
        .replace(/[[\]"']/g, '')
        .split(/[;,]+/)
        .map(s => s.trim())
        .filter(Boolean);
    };
    const joinOrDash = arr => (Array.isArray(arr) && arr.length ? arr.join(', ') : '—');

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


  // === Arkusz: Mecze (typy + wyniki + punkty) ===
  try {
    sheetMatches.columns = [
      { header: 'Faza', key: 'phase' },
      { header: 'Match No', key: 'match_no' },
      { header: 'Match ID', key: 'match_id' },
      { header: 'Team A', key: 'team_a' },
      { header: 'Team B', key: 'team_b' },
      { header: 'BO', key: 'best_of' },
      { header: 'Wynik oficjalny', key: 'official' },
      { header: 'User ID', key: 'user_id' },
      { header: 'Nick', key: 'displayname' },
      { header: 'Typ', key: 'pred' },
      { header: 'Punkty', key: 'points' }
    ];

    const [matchRows] = await pool.query(`
  SELECT
    m.id AS match_id,
    m.phase,
    m.match_no,
    m.team_a,
    m.team_b,
    m.best_of,

    -- oficjalny: preferuj exact_* (u Ciebie istnieje)
    COALESCE(r.exact_a, r.res_a) AS off_a,
    COALESCE(r.exact_b, r.res_b) AS off_b,

    p.user_id,
    p.pred_a,
    p.pred_b,
    p.pred_exact_a,
    p.pred_exact_b,

    mp.points
  FROM matches m
  LEFT JOIN match_results r ON r.match_id = m.id

  -- KLUCZ: LEFT JOIN zamiast JOIN, żeby nie wycinało wszystkiego
  LEFT JOIN match_predictions p ON p.match_id = m.id

  -- punkty zsumowane, żeby nie dublowało
  LEFT JOIN (
    SELECT match_id, user_id, SUM(points) AS points
    FROM match_points
    GROUP BY match_id, user_id
  ) mp ON mp.match_id = m.id AND mp.user_id = p.user_id

  ORDER BY
    m.phase ASC,
    COALESCE(m.match_no, 999999) ASC,
    m.id ASC,
    p.user_id ASC
`);

    for (const r of matchRows) {
      const official =
        (r.off_a === null || r.off_b === null) ? '—' : `${r.off_a}:${r.off_b}`;

      const prA = (r.pred_exact_a ?? r.pred_a);
      const prB = (r.pred_exact_b ?? r.pred_b);
      const pred =
        (r.user_id && prA !== null && prB !== null) ? `${prA}:${prB}` : '—';

      const nick = r.user_id ? (users?.[r.user_id]?.displayname || r.user_id) : '—';

      sheetMatches.addRow({
        phase: r.phase,
        match_no: r.match_no ?? '',
        match_id: r.match_id,
        team_a: r.team_a,
        team_b: r.team_b,
        best_of: r.best_of,
        official,
        user_id: r.user_id ?? '—',
        displayname: nick,
        pred,
        points: (r.points ?? '')
      });
    }



    // autosize
    sheetMatches.columns.forEach(col => {
      let maxLength = col.header.length;
      col.eachCell({ includeEmpty: true }, cell => {
        const val = cell.value;
        const len = val ? String(val).length : 0;
        if (len > maxLength) maxLength = len;
      });
      col.width = Math.min(maxLength + 2, 60);
    });
  } catch (e) {
    console.log('⚠️ MATCHES: nie udało się wygenerować arkusza "Mecze" (pomijam):', e?.message || e);
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
