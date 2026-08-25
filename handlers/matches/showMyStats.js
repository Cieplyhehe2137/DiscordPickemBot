const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { withGuild } = require("../../utils/guildContext");
const { logError } = require("../../utils/logger");

// ======================================================
// HELPERY
// ======================================================

function pct(value, total) {
  if (!total) return "—";

  return `${((Number(value) / Number(total)) * 100)
    .toFixed(1)
    .replace(".0", "")}%`;
}

function percentageNumber(value, total) {
  if (!total) return 0;

  return (Number(value) / Number(total)) * 100;
}

function formatDifference(value) {
  const number = Number(value || 0);

  if (Math.abs(number) < 0.05) {
    return "**0 pp**";
  }

  const sign = number > 0 ? "+" : "";

  const emoji = number > 0 ? "🟢" : "🔴";

  return `${emoji} **${sign}${number.toFixed(1).replace(".0", "")} pp**`;
}

function formatPointsDifference(value) {
  const number = Number(value || 0);

  if (Math.abs(number) < 0.005) {
    return "**0.00 pkt**";
  }

  const sign = number > 0 ? "+" : "";

  const emoji = number > 0 ? "🟢" : "🔴";

  return `${emoji} **${sign}${number.toFixed(2)} pkt**`;
}

function winnerSide(a, b) {
  const left = Number(a);
  const right = Number(b);

  if (!Number.isFinite(left) || !Number.isFinite(right) || left === right) {
    return 0;
  }

  return left > right ? 1 : -1;
}

function isWinnerCorrect(row) {
  const predicted = winnerSide(row.pred_a, row.pred_b);

  const official = winnerSide(row.res_a, row.res_b);

  return predicted !== 0 && predicted === official;
}

function isSeriesExact(row) {
  // BO1 ma osobne exact score
  if (Number(row.best_of) === 1) {
    return (
      row.pred_exact_a != null &&
      row.pred_exact_b != null &&
      row.exact_a != null &&
      row.exact_b != null &&
      Number(row.pred_exact_a) === Number(row.exact_a) &&
      Number(row.pred_exact_b) === Number(row.exact_b)
    );
  }

  // BO3 / BO5
  return (
    row.pred_a != null &&
    row.pred_b != null &&
    row.res_a != null &&
    row.res_b != null &&
    Number(row.pred_a) === Number(row.res_a) &&
    Number(row.pred_b) === Number(row.res_b)
  );
}

function isMapWinnerCorrect(row) {
  const predicted = winnerSide(row.pred_exact_a, row.pred_exact_b);

  const official = winnerSide(row.exact_a, row.exact_b);

  return predicted !== 0 && predicted === official;
}

function isMapExact(row) {
  return (
    row.pred_exact_a != null &&
    row.pred_exact_b != null &&
    row.exact_a != null &&
    row.exact_b != null &&
    Number(row.pred_exact_a) === Number(row.exact_a) &&
    Number(row.pred_exact_b) === Number(row.exact_b)
  );
}

function calculateStreaks(rows) {
  let current = 0;
  let best = 0;

  for (const row of rows) {
    if (isWinnerCorrect(row)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return {
    current,
    best,
  };
}

function calculateRecentForm(rows, amount) {
  const recent = rows.slice(-amount);

  const hits = recent.filter(isWinnerCorrect).length;

  return {
    total: recent.length,
    hits,
    percentage: pct(hits, recent.length),
  };
}

function formatBestMatch(row) {
  if (!row) {
    return "—";
  }

  const label = row.match_no ? `#${row.match_no} • ` : "";

  return (
    `${label}${row.team_a} vs ${row.team_b}\n` +
    `⭐ **${Number(row.points || 0)} pkt**`
  );
}

function getBoStats(rows, bestOf) {
  const filtered = rows.filter((row) => Number(row.best_of) === Number(bestOf));

  const winnerHits = filtered.filter(isWinnerCorrect).length;

  const exactHits = filtered.filter(isSeriesExact).length;

  return {
    total: filtered.length,
    winnerHits,
    exactHits,
  };
}

function getMapMarginError(row) {
  const predA = Number(row.pred_exact_a);
  const predB = Number(row.pred_exact_b);

  const realA = Number(row.exact_a);
  const realB = Number(row.exact_b);

  if (
    !Number.isFinite(predA) ||
    !Number.isFinite(predB) ||
    !Number.isFinite(realA) ||
    !Number.isFinite(realB)
  ) {
    return null;
  }

  const predictedMargin = predA - predB;

  const realMargin = realA - realB;

  return Math.abs(predictedMargin - realMargin);
}

function calculateMapAccuracy(rows) {
  const result = {
    exact: 0,
    error1: 0,
    error2: 0,
    error3plus: 0,
    total: 0,
    errorSum: 0,
  };

  for (const row of rows) {
    const error = getMapMarginError(row);

    if (error == null) {
      continue;
    }

    result.total += 1;
    result.errorSum += error;

    if (error === 0) {
      result.exact += 1;
    } else if (error === 1) {
      result.error1 += 1;
    } else if (error === 2) {
      result.error2 += 1;
    } else {
      result.error3plus += 1;
    }
  }

  result.averageError = result.total ? result.errorSum / result.total : 0;

  return result;
}

function calculateTeamStats(rows) {
  const teams = new Map();

  function ensureTeam(name) {
    if (!teams.has(name)) {
      teams.set(name, {
        name,
        matches: 0,
        picked: 0,
        correct: 0,
      });
    }

    return teams.get(name);
  }

  for (const row of rows) {
    const teamA = ensureTeam(row.team_a);

    const teamB = ensureTeam(row.team_b);

    teamA.matches += 1;
    teamB.matches += 1;

    const predictedSide = winnerSide(row.pred_a, row.pred_b);

    const officialSide = winnerSide(row.res_a, row.res_b);

    if (predictedSide === 1) {
      teamA.picked += 1;

      if (officialSide === 1) {
        teamA.correct += 1;
      }
    } else if (predictedSide === -1) {
      teamB.picked += 1;

      if (officialSide === -1) {
        teamB.correct += 1;
      }
    }
  }

  const list = [...teams.values()]
    .filter((team) => team.picked > 0)
    .map((team) => ({
      ...team,

      accuracy: team.picked ? (team.correct / team.picked) * 100 : 0,
    }));

  const mostPicked = [...list].sort((a, b) => b.picked - a.picked)[0] || null;

  const qualified = list.filter((team) => team.picked >= 3);

  const best =
    [...qualified].sort((a, b) => {
      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }

      return b.picked - a.picked;
    })[0] || null;

  const nemesis =
    [...qualified].sort((a, b) => {
      if (a.accuracy !== b.accuracy) {
        return a.accuracy - b.accuracy;
      }

      return b.picked - a.picked;
    })[0] || null;

  return {
    best,
    nemesis,
    mostPicked,
  };
}

function formatPercentTrend(value) {
  const number = Number(value || 0);

  if (Math.abs(number) < 0.05) {
    return "➡️ **0 pp**";
  }

  if (number > 0) {
    return `📈 **+${number.toFixed(1).replace(".0", "")} pp**`;
  }

  return `📉 **${number.toFixed(1).replace(".0", "")} pp**`;
}

function formatPointsTrend(value) {
  const number = Number(value || 0);

  if (Math.abs(number) < 0.005) {
    return "➡️ **0.00 pkt**";
  }

  if (number > 0) {
    return `📈 **+${number.toFixed(2)} pkt**`;
  }

  return `📉 **${number.toFixed(2)} pkt**`;
}

function calculateTrendStats({ settledRows, mapRows, pointsByMatch }) {
  if (settledRows.length < 4) {
    return {
      enoughData: false,
      totalMatches: settledRows.length,
    };
  }

  const splitIndex = Math.floor(settledRows.length / 2);

  const firstHalf = settledRows.slice(0, splitIndex);
  const secondHalf = settledRows.slice(splitIndex);

  const firstIds = new Set(firstHalf.map((row) => String(row.match_id)));

  const secondIds = new Set(secondHalf.map((row) => String(row.match_id)));

  const firstMaps = mapRows.filter((row) => firstIds.has(String(row.match_id)));

  const secondMaps = mapRows.filter((row) =>
    secondIds.has(String(row.match_id)),
  );

  function buildHalfStats(rows, maps) {
    const matchCount = rows.length;

    const winnerHits = rows.filter(isWinnerCorrect).length;
    const seriesExacts = rows.filter(isSeriesExact).length;

    const mapExacts = maps.filter(isMapExact).length;

    const totalPoints = rows.reduce(
      (sum, row) => sum + Number(pointsByMatch.get(String(row.match_id)) || 0),
      0,
    );

    return {
      matches: matchCount,

      winnerHits,
      winnerAccuracy: percentageNumber(winnerHits, matchCount),

      seriesExacts,
      seriesExactAccuracy: percentageNumber(seriesExacts, matchCount),

      maps: maps.length,
      mapExacts,
      mapExactAccuracy: percentageNumber(mapExacts, maps.length),

      totalPoints,

      averagePoints: matchCount ? totalPoints / matchCount : 0,
    };
  }

  const first = buildHalfStats(firstHalf, firstMaps);

  const second = buildHalfStats(secondHalf, secondMaps);

  const winnerDelta = second.winnerAccuracy - first.winnerAccuracy;

  const seriesDelta = second.seriesExactAccuracy - first.seriesExactAccuracy;

  const mapDelta = second.mapExactAccuracy - first.mapExactAccuracy;

  const pointsDelta = second.averagePoints - first.averagePoints;

  const percentageDeltas = [
    {
      name: "Skuteczność zwycięzców",
      value: winnerDelta,
    },
    {
      name: "Exacty serii",
      value: seriesDelta,
    },
  ];

  if (first.maps > 0 && second.maps > 0) {
    percentageDeltas.push({
      name: "Exacty map",
      value: mapDelta,
    });
  }

  const averageTrend = percentageDeltas.length
    ? percentageDeltas.reduce((sum, item) => sum + item.value, 0) /
      percentageDeltas.length
    : 0;

  let direction = {
    emoji: "➡️",
    name: "Stabilna forma",
    description: "Twoje wyniki pozostają na podobnym poziomie.",
  };

  if (averageTrend >= 3) {
    direction = {
      emoji: "🔥",
      name: "Forma rośnie",
      description: "Druga część eventu wygląda lepiej niż początek.",
    };
  } else if (averageTrend <= -3) {
    direction = {
      emoji: "📉",
      name: "Forma spada",
      description: "W drugiej części eventu Twoja skuteczność jest niższa.",
    };
  }

  const sortedImprovements = [...percentageDeltas].sort(
    (a, b) => b.value - a.value,
  );

  const bestImprovement = sortedImprovements[0] || null;

  const worstChange =
    [...percentageDeltas].sort((a, b) => a.value - b.value)[0] || null;

  return {
    enoughData: true,

    first,
    second,

    winnerDelta,
    seriesDelta,
    mapDelta,
    pointsDelta,

    averageTrend,

    direction,
    bestImprovement,
    worstChange,
  };
}

function calculatePlayerStyle({
  settledMatches,
  winnerHits,
  seriesExacts,

  settledMaps,
  mapWinnerHits,
  exactMaps,

  contrarianPicks,
  contrarianHits,

  majorityPicks,
  majorityHits,
}) {
  if (settledMatches < 5) {
    return {
      emoji: "🌱",
      name: "Debiutant",
      description:
        "Potrzeba minimum 5 rozliczonych meczów, żeby określić Twój styl typowania.",
    };
  }

  const winnerAccuracy = percentageNumber(winnerHits, settledMatches);

  const exactAccuracy = percentageNumber(seriesExacts, settledMatches);

  const mapAccuracy = percentageNumber(mapWinnerHits, settledMaps);

  const mapExactAccuracy = percentageNumber(exactMaps, settledMaps);

  const contrarianRate = percentageNumber(contrarianPicks, settledMatches);

  const contrarianAccuracy = percentageNumber(contrarianHits, contrarianPicks);

  const majorityRate = percentageNumber(majorityPicks, settledMatches);

  const majorityAccuracy = percentageNumber(majorityHits, majorityPicks);

  // =========================================
  // UNDERDOG HUNTER
  // =========================================

  if (
    contrarianPicks >= 3 &&
    contrarianRate >= 30 &&
    contrarianAccuracy >= 50
  ) {
    return {
      emoji: "💎",
      name: "Underdog Hunter",
      description:
        "Często idziesz przeciwko większości i potrafisz trafiać takie wybory.",
    };
  }

  // =========================================
  // MAP EXPERT
  // =========================================

  if (settledMaps >= 5 && mapAccuracy >= 75) {
    return {
      emoji: "🗺️",
      name: "Map Expert",
      description: "Największą przewagę budujesz na typowaniu wyników map.",
    };
  }

  // =========================================
  // SNIPER
  // =========================================

  if (settledMatches >= 5 && exactAccuracy >= 30) {
    return {
      emoji: "🎯",
      name: "Snajper",
      description: "Masz wyjątkowo dobre oko do dokładnych wyników serii.",
    };
  }

  // =========================================
  // SAFE PLAYER
  // =========================================

  if (majorityRate >= 70 && majorityAccuracy >= 60) {
    return {
      emoji: "🛡️",
      name: "Bezpieczny gracz",
      description:
        "Najczęściej wybierasz stronę popieraną przez większość społeczności.",
    };
  }

  // =========================================
  // CONSISTENT
  // =========================================

  if (winnerAccuracy >= 70) {
    return {
      emoji: "📈",
      name: "Regularny",
      description:
        "Nie kombinujesz bez potrzeby — po prostu regularnie trafiasz zwycięzców.",
    };
  }

  // =========================================
  // MAP SNIPER
  // =========================================

  if (settledMaps >= 5 && mapExactAccuracy >= 25) {
    return {
      emoji: "💯",
      name: "Map Sniper",
      description: "Masz dobre wyczucie dokładnych wyników poszczególnych map.",
    };
  }

  // =========================================
  // RISK TAKER
  // =========================================

  if (contrarianRate >= 30) {
    return {
      emoji: "🎲",
      name: "Ryzykant",
      description:
        "Lubisz iść własną drogą, nawet gdy większość typuje przeciwnie.",
    };
  }

  // =========================================
  // BALANCED
  // =========================================

  return {
    emoji: "⚖️",
    name: "Zbalansowany",
    description:
      "Łączysz bezpieczne wybory z własnym wyczuciem i nie trzymasz się jednego schematu.",
  };
}

// ======================================================
// BUTTONY ZAKŁADEK
// ======================================================

function buildStatsButtons(eventId, activeTab) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`my_stats_tab:${eventId}:general`)
      .setLabel("Ogólne")
      .setEmoji("📊")
      .setStyle(
        activeTab === "general" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "general"),

    new ButtonBuilder()
      .setCustomId(`my_stats_tab:${eventId}:accuracy`)
      .setLabel("Skuteczność")
      .setEmoji("🎯")
      .setStyle(
        activeTab === "accuracy" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "accuracy"),

    new ButtonBuilder()
      .setCustomId(`my_stats_tab:${eventId}:form`)
      .setLabel("Forma")
      .setEmoji("🔥")
      .setStyle(
        activeTab === "form" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "form"),

    new ButtonBuilder()
      .setCustomId(`my_stats_tab:${eventId}:comparison`)
      .setLabel("Porównanie")
      .setEmoji("👥")
      .setStyle(
        activeTab === "comparison"
          ? ButtonStyle.Primary
          : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "comparison"),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`my_stats_tab:${eventId}:analysis`)
      .setLabel("Analiza")
      .setEmoji("🧠")
      .setStyle(
        activeTab === "analysis" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "analysis"),

    new ButtonBuilder()
      .setCustomId(`my_stats_tab:${eventId}:style`)
      .setLabel("Styl")
      .setEmoji("🎭")
      .setStyle(
        activeTab === "style" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "style"),

    new ButtonBuilder()
      .setCustomId(`my_stats_tab:${eventId}:trends`)
      .setLabel("Trendy")
      .setEmoji("📈")
      .setStyle(
        activeTab === "trends" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(activeTab === "trends"),
  );

  return [row1, row2];
}

function calculateContrarianStats(userRows, communityRows) {
  const communityByMatch = new Map();

  // =========================================
  // LICZYMY PICKI SPOŁECZNOŚCI PER MECZ
  // =========================================

  for (const row of communityRows) {
    const matchId = String(row.match_id);

    if (!communityByMatch.has(matchId)) {
      communityByMatch.set(matchId, {
        teamA: 0,
        teamB: 0,
        total: 0,
      });
    }

    const stats = communityByMatch.get(matchId);

    const side = winnerSide(row.pred_a, row.pred_b);

    if (side === 1) {
      stats.teamA += 1;
      stats.total += 1;
    } else if (side === -1) {
      stats.teamB += 1;
      stats.total += 1;
    }
  }

  let contrarianPicks = 0;
  let contrarianHits = 0;

  let majorityPicks = 0;
  let majorityHits = 0;

  let rarestHit = null;

  // =========================================
  // ANALIZA USERA
  // =========================================

  for (const row of userRows) {
    const stats = communityByMatch.get(String(row.match_id));

    if (!stats || !stats.total) {
      continue;
    }

    const predictedSide = winnerSide(row.pred_a, row.pred_b);

    if (!predictedSide) {
      continue;
    }

    const pickedCount = predictedSide === 1 ? stats.teamA : stats.teamB;

    const pickedPercent = (pickedCount / stats.total) * 100;

    const correct = isWinnerCorrect(row);

    // =====================================
    // PICK MNIEJSZOŚCIOWY
    // =====================================

    if (pickedPercent < 50) {
      contrarianPicks += 1;

      if (correct) {
        contrarianHits += 1;

        if (!rarestHit || pickedPercent < rarestHit.percent) {
          rarestHit = {
            team: predictedSide === 1 ? row.team_a : row.team_b,

            opponent: predictedSide === 1 ? row.team_b : row.team_a,

            percent: pickedPercent,

            matchNo: row.match_no,
          };
        }
      }
    }

    // =====================================
    // PICK WIĘKSZOŚCIOWY
    // =====================================
    else if (pickedPercent > 50) {
      majorityPicks += 1;

      if (correct) {
        majorityHits += 1;
      }
    }
  }

  return {
    contrarianPicks,
    contrarianHits,

    majorityPicks,
    majorityHits,

    rarestHit,
  };
}

// ======================================================
// EMBED: OGÓLNE
// ======================================================

function buildGeneralEmbed({
  event,
  playerName,
  playerAvatar,

  totalPredictions,
  settledMatches,

  winnerHits,
  seriesExacts,

  settledMaps,
  mapWinnerHits,
  exactMaps,

  totalPoints,
  seriesPoints,
  mapPoints,
  averagePoints,

  rank,
  participantCount,
  topPercent,

  style,
  trends,
}) {
  let formText = "➡️ Stabilna";

  if (trends?.direction?.name === "Forma rośnie") {
    formText = "📈 Rośnie";
  } else if (trends?.direction?.name === "Forma spada") {
    formText = "📉 Spada";
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📊 Twoje statystyki — ${event.name}`)
    .setDescription("Szybkie podsumowanie Twojego Pick'Ema.")
    .addFields(
      {
        name: "🏅 Ranking",
        value:
          participantCount > 0
            ? `**#${rank} / ${participantCount}**\nTOP **${topPercent}%**`
            : "Brak danych",
        inline: true,
      },

      {
        name: "⭐ Punkty",
        value: `**${totalPoints} pkt**\n` + `${averagePoints} pkt / mecz`,
        inline: true,
      },

      {
        name: "🎭 Profil",
        value: `**${style?.name || "—"}**\n` + formText,
        inline: true,
      },

      {
        name: "🎮 Typy",
        value:
          `Oddane: **${totalPredictions}**\n` +
          `Rozliczone: **${settledMatches}**`,
        inline: true,
      },

      {
        name: "🏆 Zwycięzcy",
        value:
          `**${winnerHits}/${settledMatches}**\n` +
          `${pct(winnerHits, settledMatches)}`,
        inline: true,
      },

      {
        name: "🎯 Exact serii",
        value:
          `**${seriesExacts}/${settledMatches}**\n` +
          `${pct(seriesExacts, settledMatches)}`,
        inline: true,
      },

      {
        name: "🗺️ Mapy",
        value:
          `Zwycięzca: **${mapWinnerHits}/${settledMaps}** ` +
          `(${pct(mapWinnerHits, settledMaps)})\n` +
          `Exact: **${exactMaps}/${settledMaps}** ` +
          `(${pct(exactMaps, settledMaps)})`,
        inline: false,
      },

      {
        name: "📦 Punkty",
        value:
          `Serie: **${seriesPoints} pkt** • ` + `Mapy: **${mapPoints} pkt**`,
        inline: false,
      },
    )
    .setFooter({
      text: "Szczegółowe dane znajdziesz w zakładkach poniżej.",
    });

  if (playerName) {
    embed.setAuthor({
      name: playerName,
      ...(playerAvatar ? { iconURL: playerAvatar } : {}),
    });
  }

  return embed;
}

// ======================================================
// EMBED: SKUTECZNOŚĆ
// ======================================================

function buildAccuracyEmbed({
  event,
  settledMatches,
  winnerHits,
  seriesExacts,
  settledMaps,
  mapWinnerHits,
  exactMaps,
  bo1,
  bo3,
  bo5,
}) {
  const formatBo = (label, stats) => {
    if (!stats.total) {
      return `${label}: **brak danych**`;
    }

    return (
      `${label}: **${stats.winnerHits}/${stats.total}** ` +
      `(${pct(stats.winnerHits, stats.total)})`
    );
  };

  const formatBoExact = (label, stats) => {
    if (!stats.total) {
      return `${label}: **brak danych**`;
    }

    return (
      `${label}: **${stats.exactHits}/${stats.total}** ` +
      `(${pct(stats.exactHits, stats.total)})`
    );
  };

  return new EmbedBuilder()
    .setTitle(`🎯 Skuteczność — ${event.name}`)
    .setColor(0x57f287)
    .setDescription("Dokładna analiza skuteczności Twoich typów.")
    .addFields(
      {
        name: "🏆 Zwycięzca meczu",
        value:
          `Trafione: **${winnerHits}/${settledMatches}**\n` +
          `Skuteczność: **${pct(winnerHits, settledMatches)}**`,
        inline: true,
      },

      {
        name: "🎯 Dokładny wynik serii",
        value:
          `Trafione: **${seriesExacts}/${settledMatches}**\n` +
          `Skuteczność: **${pct(seriesExacts, settledMatches)}**`,
        inline: true,
      },

      {
        name: "🗺️ Zwycięzca mapy",
        value:
          `Trafione: **${mapWinnerHits}/${settledMaps}**\n` +
          `Skuteczność: **${pct(mapWinnerHits, settledMaps)}**`,
        inline: true,
      },

      {
        name: "💯 Exact mapy",
        value:
          `Trafione: **${exactMaps}/${settledMaps}**\n` +
          `Skuteczność: **${pct(exactMaps, settledMaps)}**`,
        inline: true,
      },

      {
        name: "🎮 Zwycięzcy według formatu",
        value: [
          formatBo("BO1", bo1),
          formatBo("BO3", bo3),
          formatBo("BO5", bo5),
        ].join("\n"),
        inline: false,
      },

      {
        name: "🎯 Exact według formatu",
        value: [
          formatBoExact("BO1", bo1),
          formatBoExact("BO3", bo3),
          formatBoExact("BO5", bo5),
        ].join("\n"),
        inline: false,
      },
    )
    .setFooter({
      text: "Exact BO1 oznacza dokładny wynik mapy.",
    });
}

// ======================================================
// EMBED: FORMA
// ======================================================

function buildFormEmbed({
  event,
  settledRows,
  currentStreak,
  bestStreak,
  bestMatch,
}) {
  const last5 = calculateRecentForm(settledRows, 5);

  const last10 = calculateRecentForm(settledRows, 10);

  const form = settledRows
    .slice(-10)
    .map((row) => (isWinnerCorrect(row) ? "✅" : "❌"))
    .join(" ");

  return new EmbedBuilder()
    .setTitle(`🔥 Twoja forma — ${event.name}`)
    .setColor(0xfee75c)
    .setDescription(
      "Forma liczona jest na podstawie poprawnie wytypowanych zwycięzców meczów.",
    )
    .addFields(
      {
        name: "📈 Ostatnie mecze",
        value: form || "Brak rozliczonych typów.",
        inline: false,
      },

      {
        name: "⚡ Ostatnie 5",
        value: last5.total
          ? `**${last5.hits}/${last5.total}**\n` +
            `Skuteczność: **${last5.percentage}**`
          : "Brak danych.",
        inline: true,
      },

      {
        name: "📊 Ostatnie 10",
        value: last10.total
          ? `**${last10.hits}/${last10.total}**\n` +
            `Skuteczność: **${last10.percentage}**`
          : "Brak danych.",
        inline: true,
      },

      {
        name: "🔥 Aktualna seria",
        value:
          `**${currentStreak}** ` +
          (currentStreak === 1 ? "trafienie" : "trafień"),
        inline: true,
      },

      {
        name: "🏅 Rekordowa seria",
        value:
          `**${bestStreak}** ` + (bestStreak === 1 ? "trafienie" : "trafień"),
        inline: true,
      },

      {
        name: "💎 Najlepszy mecz",
        value: formatBestMatch(bestMatch),
        inline: false,
      },
    )
    .setFooter({
      text: "✅ poprawny zwycięzca • ❌ błędny zwycięzca",
    });
}

// ======================================================
// EMBED: PORÓWNANIE
// ======================================================

function buildComparisonEmbed({
  event,

  rank,
  participantCount,
  topPercent,

  winnerHits,
  settledMatches,

  communityWinnerHits,
  communitySettledMatches,

  seriesExacts,
  communitySeriesExacts,

  averagePoints,
  communityAveragePoints,

  totalPoints,
  communityAverageTotalPoints,
}) {
  const userWinnerAccuracy = percentageNumber(winnerHits, settledMatches);

  const communityWinnerAccuracy = percentageNumber(
    communityWinnerHits,
    communitySettledMatches,
  );

  const userExactAccuracy = percentageNumber(seriesExacts, settledMatches);

  const communityExactAccuracy = percentageNumber(
    communitySeriesExacts,
    communitySettledMatches,
  );

  const winnerDifference = userWinnerAccuracy - communityWinnerAccuracy;

  const exactDifference = userExactAccuracy - communityExactAccuracy;

  const pointsDifference =
    Number(averagePoints) - Number(communityAveragePoints);

  const totalPointsDifference =
    Number(totalPoints) - Number(communityAverageTotalPoints);

  let rankEmoji = "🏅";

  if (rank === 1) {
    rankEmoji = "🥇";
  } else if (rank === 2) {
    rankEmoji = "🥈";
  } else if (rank === 3) {
    rankEmoji = "🥉";
  }

  return new EmbedBuilder()
    .setTitle(`👥 Na tle graczy — ${event.name}`)
    .setColor(0xeb459e)
    .setDescription(
      "Zobacz, jak Twoje typowanie wypada na tle pozostałych uczestników eventu.",
    )
    .addFields(
      {
        name: `${rankEmoji} Ranking`,
        value:
          `Pozycja: **#${rank} / ${participantCount}**\n` +
          `TOP **${topPercent}%** graczy`,
        inline: true,
      },

      {
        name: "⭐ Punkty",
        value:
          `Ty: **${totalPoints} pkt**\n` +
          `Średnia: **${communityAverageTotalPoints.toFixed(2)} pkt**\n` +
          `Różnica: ${formatPointsDifference(totalPointsDifference)}`,
        inline: true,
      },

      {
        name: "📈 Punkty / mecz",
        value:
          `Ty: **${Number(averagePoints).toFixed(2)}**\n` +
          `Średnia: **${communityAveragePoints.toFixed(2)}**\n` +
          `Różnica: ${formatPointsDifference(pointsDifference)}`,
        inline: true,
      },

      {
        name: "🏆 Trafieni zwycięzcy",
        value:
          `Ty: **${pct(winnerHits, settledMatches)}**\n` +
          `Średnia eventu: **${pct(
            communityWinnerHits,
            communitySettledMatches,
          )}**\n` +
          `Różnica: ${formatDifference(winnerDifference)}`,
        inline: true,
      },

      {
        name: "🎯 Exact serii",
        value:
          `Ty: **${pct(seriesExacts, settledMatches)}**\n` +
          `Średnia eventu: **${pct(
            communitySeriesExacts,
            communitySettledMatches,
          )}**\n` +
          `Różnica: ${formatDifference(exactDifference)}`,
        inline: true,
      },

      {
        name: "👥 Próba porównawcza",
        value:
          `Graczy: **${participantCount}**\n` +
          `Rozliczonych typów: **${communitySettledMatches}**`,
        inline: true,
      },
    )
    .setFooter({
      text: "Średnie liczone są na podstawie rozliczonych typów w tym evencie.",
    });
}

// ======================================================
// EMBED: ANALIZA
// ======================================================

function buildAnalysisEmbed({ event, teamStats, mapAccuracy }) {
  const { best, nemesis, mostPicked } = teamStats;

  const formatTeam = (team) => {
    if (!team) {
      return "Brak wystarczającej liczby danych.";
    }

    return (
      `**${team.name}**\n` +
      `${team.correct}/${team.picked} trafień ` +
      `(**${team.accuracy.toFixed(1).replace(".0", "")}%**)`
    );
  };

  const formatMostPicked = (team) => {
    if (!team) {
      return "Brak danych.";
    }

    return (
      `**${team.name}**\n` +
      `Typowana na zwycięzcę: ` +
      `**${team.picked} razy**`
    );
  };

  return new EmbedBuilder()

    .setTitle(`🧠 Analiza — ${event.name}`)

    .setColor(0x9b59b6)

    .setDescription("Trochę głębsze spojrzenie na Twój styl typowania.")

    .addFields(
      {
        name: "🟢 Najlepiej typowana drużyna",

        value: formatTeam(best),

        inline: true,
      },

      {
        name: "😈 Nemesis",

        value: formatTeam(nemesis),

        inline: true,
      },

      {
        name: "❤️ Najczęściej wybierana",

        value: formatMostPicked(mostPicked),

        inline: true,
      },

      {
        name: "🗺️ Dokładność wyników map",

        value: mapAccuracy.total
          ? `💯 Exact: **${mapAccuracy.exact}/${mapAccuracy.total} ` +
            `(${pct(mapAccuracy.exact, mapAccuracy.total)})**\n` +
            `🟢 Błąd 1: **${mapAccuracy.error1}/${mapAccuracy.total} ` +
            `(${pct(mapAccuracy.error1, mapAccuracy.total)})**\n` +
            `🟡 Błąd 2: **${mapAccuracy.error2}/${mapAccuracy.total} ` +
            `(${pct(mapAccuracy.error2, mapAccuracy.total)})**\n` +
            `🔴 Błąd 3+: **${mapAccuracy.error3plus}/${mapAccuracy.total} ` +
            `(${pct(mapAccuracy.error3plus, mapAccuracy.total)})**`
          : "Brak danych.",

        inline: false,
      },

      {
        name: "📏 Średni błąd wyniku mapy",

        value: mapAccuracy.total
          ? `**${mapAccuracy.averageError.toFixed(2)} rundy**`
          : "Brak danych.",

        inline: true,
      },
    )

    .setFooter({
      text: "Statystyki drużyn wymagają minimum 3 typów na daną drużynę.",
    });
}

function buildStyleEmbed({ event, style, contrarianStats, settledMatches }) {
  const {
    contrarianPicks,
    contrarianHits,

    majorityPicks,
    majorityHits,

    rarestHit,
  } = contrarianStats;

  const contrarianRate = pct(contrarianPicks, settledMatches);

  const contrarianAccuracy = pct(contrarianHits, contrarianPicks);

  const majorityRate = pct(majorityPicks, settledMatches);

  const majorityAccuracy = pct(majorityHits, majorityPicks);

  let rarestHitText = "Brak trafionego picku przeciwko większości.";

  if (rarestHit) {
    const matchLabel = rarestHit.matchNo ? `#${rarestHit.matchNo} • ` : "";

    rarestHitText =
      `${matchLabel}**${rarestHit.team}** vs ${rarestHit.opponent}\n` +
      `Tylko **${rarestHit.percent
        .toFixed(1)
        .replace(".0", "")}%** graczy wybrało tę drużynę.`;
  }

  return new EmbedBuilder()

    .setTitle(`🎭 Styl gracza — ${event.name}`)

    .setColor(0xe67e22)

    .setDescription(
      `${style.emoji} Twój profil: **${style.name}**\n\n` + style.description,
    )

    .addFields(
      {
        name: "💎 Przeciwko większości",
        value:
          `Picki: **${contrarianPicks}/${settledMatches}** ` +
          `(${contrarianRate})\n` +
          `Trafione: **${contrarianHits}/${contrarianPicks}** ` +
          `(${contrarianAccuracy})`,
        inline: true,
      },

      {
        name: "👥 Z większością",
        value:
          `Picki: **${majorityPicks}/${settledMatches}** ` +
          `(${majorityRate})\n` +
          `Trafione: **${majorityHits}/${majorityPicks}** ` +
          `(${majorityAccuracy})`,
        inline: true,
      },

      {
        name: "💠 Najrzadszy trafiony pick",
        value: rarestHitText,
        inline: false,
      },
    )

    .setFooter({
      text: "Pick przeciwko większości = drużyna wybrana przez mniej niż 50% typujących.",
    });
}

// ======================================================
// EMBED: TRENDY
// ======================================================

function buildTrendsEmbed({ event, trends }) {
  if (!trends.enoughData) {
    return new EmbedBuilder()
      .setTitle(`📈 Trendy — ${event.name}`)
      .setColor(0x3498db)
      .setDescription(
        "Potrzeba trochę więcej danych, żeby sensownie porównać początek i późniejszą część eventu.",
      )
      .addFields({
        name: "📊 Aktualnie",
        value:
          `Rozliczone mecze: **${trends.totalMatches}**\n` +
          "Minimum do analizy trendów: **4 mecze**",
        inline: false,
      })
      .setFooter({
        text: "Trendy pojawią się automatycznie po rozegraniu większej liczby meczów.",
      });
  }

  const {
    first,
    second,
    winnerDelta,
    seriesDelta,
    mapDelta,
    pointsDelta,
    direction,
    bestImprovement,
    worstChange,
  } = trends;

  const firstMapText = first.maps > 0 ? pct(first.mapExacts, first.maps) : "—";

  const secondMapText =
    second.maps > 0 ? pct(second.mapExacts, second.maps) : "—";

  let improvementText = "Brak wyraźnej poprawy.";

  if (bestImprovement && bestImprovement.value > 0) {
    improvementText =
      `**${bestImprovement.name}**\n` +
      formatPercentTrend(bestImprovement.value);
  }

  let declineText = "Brak wyraźnego spadku.";

  if (worstChange && worstChange.value < 0) {
    declineText =
      `**${worstChange.name}**\n` + formatPercentTrend(worstChange.value);
  }

  return new EmbedBuilder()
    .setTitle(`📈 Trendy — ${event.name}`)
    .setColor(
      direction.name === "Forma rośnie"
        ? 0x57f287
        : direction.name === "Forma spada"
          ? 0xed4245
          : 0x3498db,
    )
    .setDescription(
      `${direction.emoji} **${direction.name}**\n\n` + direction.description,
    )
    .addFields(
      {
        name: "🏆 Skuteczność zwycięzców",
        value:
          `Początek: **${pct(first.winnerHits, first.matches)}**\n` +
          `Druga część: **${pct(second.winnerHits, second.matches)}**\n` +
          `Zmiana: ${formatPercentTrend(winnerDelta)}`,
        inline: true,
      },

      {
        name: "🎯 Exacty serii",
        value:
          `Początek: **${pct(first.seriesExacts, first.matches)}**\n` +
          `Druga część: **${pct(second.seriesExacts, second.matches)}**\n` +
          `Zmiana: ${formatPercentTrend(seriesDelta)}`,
        inline: true,
      },

      {
        name: "⭐ Punkty / mecz",
        value:
          `Początek: **${first.averagePoints.toFixed(2)}**\n` +
          `Druga część: **${second.averagePoints.toFixed(2)}**\n` +
          `Zmiana: ${formatPointsTrend(pointsDelta)}`,
        inline: true,
      },

      {
        name: "🗺️ Exacty map",
        value:
          `Początek: **${firstMapText}**\n` +
          `Druga część: **${secondMapText}**\n` +
          (first.maps > 0 && second.maps > 0
            ? `Zmiana: ${formatPercentTrend(mapDelta)}`
            : "Zmiana: **—**"),
        inline: true,
      },

      {
        name: "🚀 Największa poprawa",
        value: improvementText,
        inline: true,
      },

      {
        name: "⚠️ Największy spadek",
        value: declineText,
        inline: true,
      },

      {
        name: "📊 Podział danych",
        value:
          `Pierwsza część: **${first.matches} meczów**\n` +
          `Druga część: **${second.matches} meczów**`,
        inline: false,
      },
    )
    .setFooter({
      text: "Trendy porównują pierwszą i drugą połowę Twoich rozliczonych meczów.",
    });
}

// ======================================================
// MAIN
// ======================================================

module.exports = async function showMyStats(interaction) {
  try {
    const customId = String(interaction.customId || "");

    const parts = customId.split(":");

    const action = parts[0];

    let eventId;
    let activeTab = "general";

    // Pierwsze wejście:
    // my_stats:123
    if (action === "my_stats") {
      eventId = Number(parts[1]);
      activeTab = "general";
    }

    // Zmiana zakładki:
    // my_stats_tab:123:accuracy
    else if (action === "my_stats_tab") {
      eventId = Number(parts[1]);
      activeTab = parts[2] || "general";
    } else {
      return;
    }

    if (!eventId) {
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: "❌ Brak informacji o evencie.",
          ephemeral: true,
        });
      }

      return interaction.editReply({
        content: "❌ Brak informacji o evencie.",
        embeds: [],
        components: [],
      });
    }

    // ==================================================
    // DEFER
    // ==================================================

    if (!interaction.deferred && !interaction.replied) {
      if (action === "my_stats_tab") {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply({
          ephemeral: true,
        });
      }
    }

    return withGuild(interaction, async ({ pool, guildId }) => {
      const userId = interaction.user.id;

      // ==================================================
      // EVENT
      // ==================================================

      const [[event]] = await pool.query(
        `
          SELECT
            id,
            name
          FROM events
          WHERE id = ?
            AND guild_id = ?
          LIMIT 1
          `,
        [eventId, guildId],
      );

      if (!event) {
        return interaction.editReply({
          content: "❌ Nie znaleziono tego eventu.",
          embeds: [],
          components: [],
        });
      }

      // ==================================================
      // LICZBA WSZYSTKICH TYPÓW
      // ==================================================

      const [[predictionCount]] = await pool.query(
        `
            SELECT
              COUNT(*) AS total
            FROM match_predictions
            WHERE guild_id = ?
              AND event_id = ?
              AND user_id = ?
            `,
        [guildId, eventId, userId],
      );

      const totalPredictions = Number(predictionCount?.total || 0);

      if (!totalPredictions) {
        return interaction.editReply({
          content:
            `Nie masz jeszcze typów meczowych ` +
            `w evencie **${event.name}**.`,
          embeds: [],
          components: [],
        });
      }

      // ==================================================
      // ROZLICZONE MECZE USERA
      // ==================================================

      const [settledRows] = await pool.query(
        `
            SELECT
              m.id AS match_id,
              m.match_no,
              m.team_a,
              m.team_b,
              m.best_of,

              mp.pred_a,
              mp.pred_b,
              mp.pred_exact_a,
              mp.pred_exact_b,

              mr.res_a,
              mr.res_b,
              mr.exact_a,
              mr.exact_b,
              mr.finished_at

            FROM match_predictions mp

            INNER JOIN matches m
              ON m.id = mp.match_id
             AND m.guild_id = mp.guild_id
             AND m.event_id = mp.event_id

            INNER JOIN match_results mr
              ON mr.match_id = mp.match_id
             AND mr.guild_id = mp.guild_id
             AND mr.event_id = mp.event_id

            WHERE mp.guild_id = ?
              AND mp.event_id = ?
              AND mp.user_id = ?

            ORDER BY
              mr.finished_at ASC,
              m.id ASC
            `,
        [guildId, eventId, userId],
      );

      const settledMatches = settledRows.length;

      const winnerHits = settledRows.filter(isWinnerCorrect).length;

      const seriesExacts = settledRows.filter(isSeriesExact).length;

      // ==================================================
      // STREAK
      // ==================================================

      const { current: currentStreak, best: bestStreak } =
        calculateStreaks(settledRows);

      // ==================================================
      // BO STATS
      // ==================================================

      const bo1 = getBoStats(settledRows, 1);

      const bo3 = getBoStats(settledRows, 3);

      const bo5 = getBoStats(settledRows, 5);

      // ==================================================
      // MAPY
      // ==================================================

      const [mapRows] = await pool.query(
        `
            SELECT
              p.match_id,
              p.map_no,

              p.pred_exact_a,
              p.pred_exact_b,

              r.exact_a,
              r.exact_b

            FROM match_map_predictions p

            INNER JOIN match_map_results r
              ON r.guild_id = p.guild_id
             AND r.event_id = p.event_id
             AND r.match_id = p.match_id
             AND r.map_no = p.map_no

            WHERE p.guild_id = ?
              AND p.event_id = ?
              AND p.user_id = ?
            `,
        [guildId, eventId, userId],
      );

      // ==================================================
      // BO1 = JEDNA MAPA
      // ==================================================
      //
      // W BO1 dokładny wynik zapisujemy bezpośrednio
      // w match_predictions / match_results.
      // Dlatego dokładamy BO1 do statystyk map,
      // jeśli nie istnieje już wpis w tabelach mapowych.

      const existingMapKeys = new Set(
        mapRows.map((row) => `${row.match_id}:${row.map_no}`),
      );

      for (const row of settledRows) {
        if (Number(row.best_of) !== 1) {
          continue;
        }

        const key = `${row.match_id}:1`;

        // zabezpieczenie przed podwójnym policzeniem
        if (existingMapKeys.has(key)) {
          continue;
        }

        if (
          row.pred_exact_a == null ||
          row.pred_exact_b == null ||
          row.exact_a == null ||
          row.exact_b == null
        ) {
          continue;
        }

        mapRows.push({
          match_id: row.match_id,
          map_no: 1,

          pred_exact_a: row.pred_exact_a,
          pred_exact_b: row.pred_exact_b,

          exact_a: row.exact_a,
          exact_b: row.exact_b,
        });

        existingMapKeys.add(key);
      }

      const settledMaps = mapRows.length;

      const mapWinnerHits = mapRows.filter(isMapWinnerCorrect).length;

      const exactMaps = mapRows.filter(isMapExact).length;

      // ==================================================
      // ANALIZA
      // ==================================================

      const teamStats = calculateTeamStats(settledRows);

      const mapAccuracy = calculateMapAccuracy(mapRows);

      // ==================================================
      // PUNKTY USERA
      // ==================================================

      const [[points]] = await pool.query(
        `
            SELECT

              COALESCE(
                SUM(
                  CASE
                    WHEN source = 'series'
                    THEN points
                    ELSE 0
                  END
                ),
                0
              ) AS series_points,

              COALESCE(
                SUM(
                  CASE
                    WHEN source = 'map'
                    THEN points
                    ELSE 0
                  END
                ),
                0
              ) AS map_points,

              COALESCE(
                SUM(points),
                0
              ) AS total_points

            FROM match_points

            WHERE guild_id = ?
              AND event_id = ?
              AND user_id = ?
            `,
        [guildId, eventId, userId],
      );

      const totalPoints = Number(points?.total_points || 0);

      const seriesPoints = Number(points?.series_points || 0);

      const mapPoints = Number(points?.map_points || 0);

      const averagePoints = settledMatches
        ? (totalPoints / settledMatches).toFixed(2)
        : "0.00";

      // ==================================================
      // PUNKTY PER MECZ — TRENDY
      // ==================================================

      const [pointsPerMatchRows] = await pool.query(
        `
    SELECT
      match_id,
      COALESCE(
        SUM(points),
        0
      ) AS total_points

    FROM match_points

    WHERE guild_id = ?
      AND event_id = ?
      AND user_id = ?

    GROUP BY match_id
    `,
        [guildId, eventId, userId],
      );

      const pointsByMatch = new Map(
        pointsPerMatchRows.map((row) => [
          String(row.match_id),
          Number(row.total_points || 0),
        ]),
      );

      const trends = calculateTrendStats({
        settledRows,
        mapRows,
        pointsByMatch,
      });

      // ==================================================
      // PORÓWNANIE — WSZYSTKIE ROZLICZONE TYPY
      // ==================================================

      const [communityRows] = await pool.query(
        `
            SELECT
              mp.user_id,

              m.id AS match_id,
              m.best_of,

              mp.pred_a,
              mp.pred_b,
              mp.pred_exact_a,
              mp.pred_exact_b,

              mr.res_a,
              mr.res_b,
              mr.exact_a,
              mr.exact_b

            FROM match_predictions mp

            INNER JOIN matches m
              ON m.id = mp.match_id
             AND m.guild_id = mp.guild_id
             AND m.event_id = mp.event_id

            INNER JOIN match_results mr
              ON mr.match_id = mp.match_id
             AND mr.guild_id = mp.guild_id
             AND mr.event_id = mp.event_id

            WHERE mp.guild_id = ?
              AND mp.event_id = ?
            `,
        [guildId, eventId],
      );

      const communitySettledMatches = communityRows.length;

      const communityWinnerHits = communityRows.filter(isWinnerCorrect).length;

      const communitySeriesExacts = communityRows.filter(isSeriesExact).length;

      // ==================================================
      // STYL GRACZA / CONTRARIAN PICKS
      // ==================================================

      const contrarianStats = calculateContrarianStats(
        settledRows,
        communityRows,
      );

      const style = calculatePlayerStyle({
        settledMatches,
        winnerHits,
        seriesExacts,

        settledMaps,
        mapWinnerHits,
        exactMaps,

        contrarianPicks: contrarianStats.contrarianPicks,

        contrarianHits: contrarianStats.contrarianHits,

        majorityPicks: contrarianStats.majorityPicks,

        majorityHits: contrarianStats.majorityHits,
      });

      // ==================================================
      // UCZESTNICY
      // ==================================================

      const [participants] = await pool.query(
        `
            SELECT DISTINCT
              user_id
            FROM match_predictions
            WHERE guild_id = ?
              AND event_id = ?
            `,
        [guildId, eventId],
      );

      const participantCount = participants.length;

      // ==================================================
      // PUNKTY WSZYSTKICH GRACZY
      // ==================================================

      const [allPlayerPoints] = await pool.query(
        `
            SELECT
              user_id,

              COALESCE(
                SUM(points),
                0
              ) AS total_points

            FROM match_points

            WHERE guild_id = ?
              AND event_id = ?

            GROUP BY user_id
            `,
        [guildId, eventId],
      );

      const pointsByUser = new Map();

      for (const row of allPlayerPoints) {
        pointsByUser.set(String(row.user_id), Number(row.total_points || 0));
      }

      const ranking = participants
        .map((row) => ({
          userId: String(row.user_id),

          points: pointsByUser.get(String(row.user_id)) || 0,
        }))
        .sort((a, b) => b.points - a.points);

      const rank =
        ranking.filter((player) => Number(player.points) > Number(totalPoints))
          .length + 1;

      const topPercent = participantCount
        ? Math.max(0.1, (rank / participantCount) * 100)
            .toFixed(1)
            .replace(".0", "")
        : "—";

      // ==================================================
      // ŚREDNIE PUNKTY EVENTU
      // ==================================================

      const communityTotalPoints = ranking.reduce(
        (sum, player) => sum + Number(player.points || 0),
        0,
      );

      const communityAverageTotalPoints = participantCount
        ? communityTotalPoints / participantCount
        : 0;

      const communityAveragePoints = communitySettledMatches
        ? communityTotalPoints / communitySettledMatches
        : 0;

      // ==================================================
      // NAJLEPSZY MECZ
      // ==================================================

      const [[bestMatch]] = await pool.query(
        `
            SELECT
              m.id AS match_id,
              m.match_no,
              m.team_a,
              m.team_b,

              SUM(mp.points) AS points

            FROM match_points mp

            INNER JOIN matches m
              ON m.id = mp.match_id
             AND m.guild_id = mp.guild_id
             AND m.event_id = mp.event_id

            WHERE mp.guild_id = ?
              AND mp.event_id = ?
              AND mp.user_id = ?

            GROUP BY
              m.id,
              m.match_no,
              m.team_a,
              m.team_b

            ORDER BY
              points DESC,
              m.match_no ASC,
              m.id ASC

            LIMIT 1
            `,
        [guildId, eventId, userId],
      );

      // ==================================================
      // WYBÓR EMBEDA
      // ==================================================

      let embed;

      if (activeTab === "accuracy") {
        embed = buildAccuracyEmbed({
          event,

          settledMatches,
          winnerHits,
          seriesExacts,

          settledMaps,
          mapWinnerHits,
          exactMaps,

          bo1,
          bo3,
          bo5,
        });
      } else if (activeTab === "form") {
        embed = buildFormEmbed({
          event,
          settledRows,
          currentStreak,
          bestStreak,
          bestMatch,
        });
      } else if (activeTab === "comparison") {
        embed = buildComparisonEmbed({
          event,

          rank,
          participantCount,
          topPercent,

          winnerHits,
          settledMatches,

          communityWinnerHits,
          communitySettledMatches,

          seriesExacts,
          communitySeriesExacts,

          averagePoints,
          communityAveragePoints,

          totalPoints,
          communityAverageTotalPoints,
        });
      } else if (activeTab === "analysis") {
        embed = buildAnalysisEmbed({
          event,
          teamStats,
          mapAccuracy,
        });
      } else if (activeTab === "style") {
        embed = buildStyleEmbed({
          event,
          style,
          contrarianStats,
          settledMatches,
        });
      } else if (activeTab === "trends") {
        embed = buildTrendsEmbed({
          event,
          trends,
        });
      } else {
        activeTab = "general";

        embed = buildGeneralEmbed({
          event,

          totalPredictions,
          settledMatches,

          winnerHits,
          seriesExacts,

          settledMaps,
          mapWinnerHits,
          exactMaps,

          totalPoints,
          seriesPoints,
          mapPoints,
          averagePoints,
        });
      }

      // ==================================================
      // RESPONSE
      // ==================================================

      return interaction.editReply({
        content: "",
        embeds: [embed],
        components: buildStatsButtons(eventId, activeTab),
      });
    });
  } catch (err) {
    logError("matches", "showMyStats failed", {
      message: err.message,
      stack: err.stack,
    });

    try {
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({
          content: "❌ Nie udało się pobrać Twoich statystyk.",
          ephemeral: true,
        });
      }

      return interaction.editReply({
        content: "❌ Nie udało się pobrać Twoich statystyk.",
        embeds: [],
        components: [],
      });
    } catch (_) {
      return null;
    }
  }
};
