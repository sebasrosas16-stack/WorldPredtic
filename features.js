let ELO_CACHE_KEY = "";
let ELO_CACHE_VALUE = null;
let BACKTEST_CACHE_KEY = "";
let BACKTEST_CACHE_VALUE = null;

function featureClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeDivide(a, b, fallback = 0) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return fallback;
  return a / b;
}

function featureTournamentWeight(match) {
  const name = String(match.tournament || "").toLowerCase();

  if (name.includes("world cup")) return 1.24;
  if (name.includes("euro")) return 1.15;
  if (name.includes("copa")) return 1.14;
  if (name.includes("africa")) return 1.12;
  if (name.includes("asian")) return 1.10;
  if (name.includes("qualif")) return 1.08;
  if (name.includes("friendly")) return 0.75;

  return 1;
}

function recencyWeight(index, mode = "normal") {
  if (mode === "strong") return Math.pow(0.84, index);
  if (mode === "soft") return Math.pow(0.94, index);
  return Math.pow(0.90, index);
}

function getGlobalFeatureAverages(results) {
  if (!results.length) {
    return {
      totalGoals: 2.7,
      goalsFor: 1.35,
      goalsAgainst: 1.35
    };
  }

  let goals = 0;
  let matches = 0;

  results.forEach(match => {
    if (typeof match.homeScore === "number" && typeof match.awayScore === "number") {
      goals += match.homeScore + match.awayScore;
      matches++;
    }
  });

  const totalGoals = matches ? goals / matches : 2.7;

  return {
    totalGoals,
    goalsFor: totalGoals / 2,
    goalsAgainst: totalGoals / 2
  };
}

function getTeamMatches(results, team, limit = 30, beforeDate = null) {
  return results
    .filter(match => {
      if (beforeDate && new Date(match.date) >= new Date(beforeDate)) return false;
      return match.home === team || match.away === team;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

function pointsFromScore(gf, ga) {
  if (gf > ga) return 3;
  if (gf === ga) return 1;
  return 0;
}

function resultValue(gf, ga) {
  if (gf > ga) return 1;
  if (gf === ga) return 0.5;
  return 0;
}

function summarizeTeamWindow(matches, team, windowSize, mode = "normal") {
  const selected = matches.slice(0, windowSize);

  if (!selected.length) {
    return {
      played: 0,
      goalsFor: 1.15,
      goalsAgainst: 1.15,
      pointsPerGame: 1.2,
      winRate: 0.33,
      drawRate: 0.28,
      lossRate: 0.39,
      cleanSheetRate: 0.22,
      failedScoreRate: 0.24,
      scoreRate: 0.76,
      resultScore: 0.45
    };
  }

  let weightSum = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let points = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let cleanSheets = 0;
  let failedScore = 0;
  let resultScore = 0;

  selected.forEach((match, index) => {
    const isHome = match.home === team;
    const gf = isHome ? match.homeScore : match.awayScore;
    const ga = isHome ? match.awayScore : match.homeScore;

    const weight = recencyWeight(index, mode) * featureTournamentWeight(match);

    weightSum += weight;
    goalsFor += gf * weight;
    goalsAgainst += ga * weight;
    points += pointsFromScore(gf, ga) * weight;
    resultScore += resultValue(gf, ga) * weight;

    if (gf > ga) wins += weight;
    else if (gf === ga) draws += weight;
    else losses += weight;

    if (ga === 0) cleanSheets += weight;
    if (gf === 0) failedScore += weight;
  });

  return {
    played: selected.length,
    goalsFor: goalsFor / weightSum,
    goalsAgainst: goalsAgainst / weightSum,
    pointsPerGame: points / weightSum,
    winRate: wins / weightSum,
    drawRate: draws / weightSum,
    lossRate: losses / weightSum,
    cleanSheetRate: cleanSheets / weightSum,
    failedScoreRate: failedScore / weightSum,
    scoreRate: 1 - failedScore / weightSum,
    resultScore: resultScore / weightSum
  };
}

function getTeamFeatures(results, team, limit = 34, beforeDate = null) {
  const matches = getTeamMatches(results, team, limit, beforeDate);

  const last5 = summarizeTeamWindow(matches, team, 5, "strong");
  const last10 = summarizeTeamWindow(matches, team, 10, "normal");
  const last25 = summarizeTeamWindow(matches, team, 25, "soft");

  const recencyBlend = {
    goalsFor: last5.goalsFor * 0.46 + last10.goalsFor * 0.34 + last25.goalsFor * 0.20,
    goalsAgainst: last5.goalsAgainst * 0.46 + last10.goalsAgainst * 0.34 + last25.goalsAgainst * 0.20,
    pointsPerGame: last5.pointsPerGame * 0.46 + last10.pointsPerGame * 0.34 + last25.pointsPerGame * 0.20,
    winRate: last5.winRate * 0.46 + last10.winRate * 0.34 + last25.winRate * 0.20,
    drawRate: last5.drawRate * 0.46 + last10.drawRate * 0.34 + last25.drawRate * 0.20,
    cleanSheetRate: last5.cleanSheetRate * 0.44 + last10.cleanSheetRate * 0.34 + last25.cleanSheetRate * 0.22,
    failedScoreRate: last5.failedScoreRate * 0.44 + last10.failedScoreRate * 0.34 + last25.failedScoreRate * 0.22,
    scoreRate: last5.scoreRate * 0.44 + last10.scoreRate * 0.34 + last25.scoreRate * 0.22
  };

  const momentum =
    (last5.pointsPerGame - last25.pointsPerGame) * 0.28 +
    (last5.goalsFor - last25.goalsFor) * 0.18 -
    (last5.goalsAgainst - last25.goalsAgainst) * 0.14;

  const attackScore =
    recencyBlend.goalsFor * 0.62 +
    recencyBlend.scoreRate * 0.80 +
    last5.goalsFor * 0.18;

  const defenseLeak =
    recencyBlend.goalsAgainst * 0.66 +
    recencyBlend.failedScoreRate * 0.10 -
    recencyBlend.cleanSheetRate * 0.22;

  const formScore =
    (recencyBlend.pointsPerGame - 1.25) +
    (recencyBlend.goalsFor - recencyBlend.goalsAgainst) * 0.42 +
    momentum;

  return {
    team,
    played: matches.length,
    last5,
    last10,
    last25,
    goalsFor: recencyBlend.goalsFor,
    goalsAgainst: recencyBlend.goalsAgainst,
    pointsPerGame: recencyBlend.pointsPerGame,
    winRate: recencyBlend.winRate,
    drawRate: recencyBlend.drawRate,
    cleanSheetRate: recencyBlend.cleanSheetRate,
    failedScoreRate: recencyBlend.failedScoreRate,
    scoreRate: recencyBlend.scoreRate,
    momentum,
    attackScore,
    defenseLeak,
    formScore
  };
}

function buildEloRatings(results) {
  const key = `${results.length}-${results[results.length - 1]?.date || "none"}`;

  if (ELO_CACHE_KEY === key && ELO_CACHE_VALUE) {
    return ELO_CACHE_VALUE;
  }

  const ratings = {};

  function getRating(team) {
    if (!ratings[team]) ratings[team] = 1500;
    return ratings[team];
  }

  results
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(match => {
      if (!match.home || !match.away) return;

      const homeRating = getRating(match.home);
      const awayRating = getRating(match.away);

      const expectedHome = 1 / (1 + Math.pow(10, (awayRating - homeRating) / 400));

      let actualHome = 0.5;
      if (match.homeScore > match.awayScore) actualHome = 1;
      if (match.homeScore < match.awayScore) actualHome = 0;

      const margin = Math.abs(match.homeScore - match.awayScore);
      const marginMultiplier = margin <= 1 ? 1 : Math.log(margin + 1) * 0.95;
      const k = 20 * featureTournamentWeight(match) * marginMultiplier;

      ratings[match.home] = homeRating + k * (actualHome - expectedHome);
      ratings[match.away] = awayRating + k * ((1 - actualHome) - (1 - expectedHome));
    });

  ELO_CACHE_KEY = key;
  ELO_CACHE_VALUE = ratings;

  return ratings;
}

function buildMatchFeatures(results, home, away, context = {}) {
  const global = getGlobalFeatureAverages(results);
  const homeStats = getTeamFeatures(results, home);
  const awayStats = getTeamFeatures(results, away);
  const elo = buildEloRatings(results);

  const homeElo = elo[home] || 1500;
  const awayElo = elo[away] || 1500;
  const eloDiff = homeElo - awayElo;

  const formDiff = homeStats.formScore - awayStats.formScore;
  const attackEdge = homeStats.attackScore - awayStats.attackScore;
  const defenseEdge = awayStats.defenseLeak - homeStats.defenseLeak;
  const momentumEdge = homeStats.momentum - awayStats.momentum;

  const homeAttackIndex = safeDivide(homeStats.goalsFor, global.goalsFor, 1);
  const awayAttackIndex = safeDivide(awayStats.goalsFor, global.goalsFor, 1);
  const homeDefenseLeakIndex = safeDivide(homeStats.goalsAgainst, global.goalsAgainst, 1);
  const awayDefenseLeakIndex = safeDivide(awayStats.goalsAgainst, global.goalsAgainst, 1);

  const factors = [];

  if (Math.abs(eloDiff) > 70) {
    factors.push(`${eloDiff > 0 ? "+" : "-"} Diferencia Elo relevante: ${eloDiff > 0 ? home : away} llega con mejor rating.`);
  }

  if (Math.abs(formDiff) > 0.18) {
    factors.push(`${formDiff > 0 ? "+" : "-"} Forma reciente favorece a ${formDiff > 0 ? home : away}.`);
  }

  if (Math.abs(attackEdge) > 0.18) {
    factors.push(`${attackEdge > 0 ? "+" : "-"} Producción ofensiva reciente favorece a ${attackEdge > 0 ? home : away}.`);
  }

  if (Math.abs(defenseEdge) > 0.16) {
    factors.push(`${defenseEdge > 0 ? "+" : "-"} Diferencia defensiva favorece a ${defenseEdge > 0 ? home : away}.`);
  }

  if (Math.abs(momentumEdge) > 0.10) {
    factors.push(`${momentumEdge > 0 ? "+" : "-"} Momentum reciente favorece a ${momentumEdge > 0 ? home : away}.`);
  }

  if (context?.importance) {
    factors.push(`⚠️ Contexto: ${context.importance}.`);
  }

  if (!factors.length) {
    factors.push("Lectura pareja: ningún factor reciente domina con fuerza.");
  }

  return {
    global,
    homeStats,
    awayStats,
    homeElo,
    awayElo,
    eloDiff,
    formDiff,
    attackEdge,
    defenseEdge,
    momentumEdge,
    homeAttackIndex,
    awayAttackIndex,
    homeDefenseLeakIndex,
    awayDefenseLeakIndex,
    factors
  };
}

function getBacktestSummary(results) {
  const key = `${results.length}-${results[results.length - 1]?.date || "none"}`;

  if (BACKTEST_CACHE_KEY === key && BACKTEST_CACHE_VALUE) {
    return BACKTEST_CACHE_VALUE;
  }

  const sorted = results
    .filter(match => match.date && match.home && match.away)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const sample = sorted.slice(-180);

  const counters = {
    favoriteWin: { hits: 0, total: 0, name: "Resultado favorito" },
    doubleChance: { hits: 0, total: 0, name: "Handicap +0.5 / doble oportunidad" },
    teamGoal: { hits: 0, total: 0, name: "Favorito gol +0.5" },
    under45: { hits: 0, total: 0, name: "Total goles -4.5" },
    btts: { hits: 0, total: 0, name: "Ambos anotan" }
  };

  sample.forEach(match => {
    const history = sorted.filter(row => new Date(row.date) < new Date(match.date));
    if (history.length < 200) return;

    const homeFeatures = getTeamFeatures(history, match.home, 25, match.date);
    const awayFeatures = getTeamFeatures(history, match.away, 25, match.date);

    const homeScore =
      homeFeatures.formScore * 0.42 +
      homeFeatures.attackScore * 0.26 -
      homeFeatures.defenseLeak * 0.18;

    const awayScore =
      awayFeatures.formScore * 0.42 +
      awayFeatures.attackScore * 0.26 -
      awayFeatures.defenseLeak * 0.18;

    const favoriteIsHome = homeScore >= awayScore;
    const favGoals = favoriteIsHome ? match.homeScore : match.awayScore;
    const dogGoals = favoriteIsHome ? match.awayScore : match.homeScore;

    counters.favoriteWin.total++;
    if (favGoals > dogGoals) counters.favoriteWin.hits++;

    counters.doubleChance.total++;
    if (favGoals >= dogGoals) counters.doubleChance.hits++;

    counters.teamGoal.total++;
    if (favGoals >= 1) counters.teamGoal.hits++;

    counters.under45.total++;
    if (match.homeScore + match.awayScore <= 4) counters.under45.hits++;

    counters.btts.total++;
    if (match.homeScore > 0 && match.awayScore > 0) counters.btts.hits++;
  });

  const rows = Object.values(counters).map(row => {
    const accuracy = row.total ? row.hits / row.total : 0;

    let reliability = "Media";
    if (accuracy >= 0.72) reliability = "Alta";
    if (accuracy < 0.56) reliability = "Baja";

    return {
      name: row.name,
      accuracy,
      sample: row.total,
      reliability
    };
  });

  BACKTEST_CACHE_KEY = key;
  BACKTEST_CACHE_VALUE = rows;

  return rows;
}
