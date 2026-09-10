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

    if (error == null) continue;

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

function calculateContrarianStats(userRows, communityRows) {
  const communityByMatch = new Map();

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
    } else if (pickedPercent > 50) {
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

function calculateCommunityAnalysis(communityRows) {
  const matches = new Map();
  const teamPicks = new Map();
  const seriesScores = new Map();

  let totalWinnerPicks = 0;

  for (const row of communityRows) {
    const matchId = String(row.match_id);

    if (!matches.has(matchId)) {
      matches.set(matchId, {
        matchId,
        matchNo: row.match_no,
        teamA: row.team_a,
        teamB: row.team_b,
        teamAChoices: 0,
        teamBChoices: 0,
        total: 0,
      });
    }

    const match = matches.get(matchId);

    const side = winnerSide(row.pred_a, row.pred_b);

    if (side === 1) {
      match.teamAChoices += 1;
      match.total += 1;

      teamPicks.set(row.team_a, (teamPicks.get(row.team_a) || 0) + 1);

      totalWinnerPicks += 1;
    } else if (side === -1) {
      match.teamBChoices += 1;
      match.total += 1;

      teamPicks.set(row.team_b, (teamPicks.get(row.team_b) || 0) + 1);

      totalWinnerPicks += 1;
    }

    if (Number(row.best_of) > 1 && row.pred_a != null && row.pred_b != null) {
      const score = `${Number(row.pred_a)}:${Number(row.pred_b)}`;

      seriesScores.set(score, (seriesScores.get(score) || 0) + 1);
    }
  }

  const matchStats = [...matches.values()]
    .filter((match) => match.total >= 2)
    .map((match) => {
      const teamAPercent = (match.teamAChoices / match.total) * 100;

      const teamBPercent = (match.teamBChoices / match.total) * 100;

      return {
        ...match,

        teamAPercent,
        teamBPercent,

        difference: Math.abs(teamAPercent - teamBPercent),

        majorityPercent: Math.max(teamAPercent, teamBPercent),

        majorityTeam: teamAPercent >= teamBPercent ? match.teamA : match.teamB,
      };
    });

  const mostOneSided =
    [...matchStats].sort((a, b) => b.difference - a.difference)[0] || null;

  const mostDivided =
    [...matchStats].sort((a, b) => a.difference - b.difference)[0] || null;

  let mostPopularTeam = null;

  for (const [team, count] of teamPicks) {
    if (!mostPopularTeam || count > mostPopularTeam.count) {
      mostPopularTeam = {
        team,
        count,
      };
    }
  }

  if (mostPopularTeam) {
    mostPopularTeam.percent = totalWinnerPicks
      ? (mostPopularTeam.count / totalWinnerPicks) * 100
      : 0;
  }

  let mostPopularScore = null;

  let totalSeriesScores = 0;

  for (const count of seriesScores.values()) {
    totalSeriesScores += count;
  }

  for (const [score, count] of seriesScores) {
    if (!mostPopularScore || count > mostPopularScore.count) {
      mostPopularScore = {
        score,
        count,
      };
    }
  }

  if (mostPopularScore) {
    mostPopularScore.percent = totalSeriesScores
      ? (mostPopularScore.count / totalSeriesScores) * 100
      : 0;
  }

  return {
    mostOneSided,
    mostDivided,
    mostPopularTeam,
    mostPopularScore,

    totalWinnerPicks,
    matchesAnalyzed: matchStats.length,
  };
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

  if (settledMaps >= 5 && mapAccuracy >= 75) {
    return {
      emoji: "🗺️",
      name: "Map Expert",
      description: "Największą przewagę budujesz na typowaniu wyników map.",
    };
  }

  if (settledMatches >= 5 && exactAccuracy >= 30) {
    return {
      emoji: "🎯",
      name: "Snajper",
      description: "Masz wyjątkowo dobre oko do dokładnych wyników serii.",
    };
  }

  if (majorityRate >= 70 && majorityAccuracy >= 60) {
    return {
      emoji: "🛡️",
      name: "Bezpieczny gracz",
      description:
        "Najczęściej wybierasz stronę popieraną przez większość społeczności.",
    };
  }

  if (winnerAccuracy >= 70) {
    return {
      emoji: "📈",
      name: "Regularny",
      description:
        "Nie kombinujesz bez potrzeby — po prostu regularnie trafiasz zwycięzców.",
    };
  }

  if (settledMaps >= 5 && mapExactAccuracy >= 25) {
    return {
      emoji: "💯",
      name: "Map Sniper",
      description: "Masz dobre wyczucie dokładnych wyników poszczególnych map.",
    };
  }

  if (contrarianRate >= 30) {
    return {
      emoji: "🎲",
      name: "Ryzykant",
      description:
        "Lubisz iść własną drogą, nawet gdy większość typuje przeciwnie.",
    };
  }

  return {
    emoji: "⚖️",
    name: "Zbalansowany",
    description:
      "Łączysz bezpieczne wybory z własnym wyczuciem i nie trzymasz się jednego schematu.",
  };
}

module.exports = {
  pct,
  percentageNumber,
  winnerSide,
  isWinnerCorrect,
  isSeriesExact,
  isMapWinnerCorrect,
  isMapExact,
  calculateStreaks,
  calculateRecentForm,
  getBoStats,
  getMapMarginError,
  calculateMapAccuracy,
  calculateTeamStats,
  calculateContrarianStats,
  calculateCommunityAnalysis,
  calculateTrendStats,
  calculatePlayerStyle,
};
