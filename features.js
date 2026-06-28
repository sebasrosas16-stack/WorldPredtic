let ELO_CACHE_KEY = "";
let ELO_CACHE_VALUE = null;
let FEATURE_CACHE = new Map();

function fClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fSafeDivide(a, b, fallback = 0) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return fallback;
  return a / b;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tournamentWeight(match) {
  const name = normalizeText(match.tournament);

  if (name.includes("world cup")) return 1.30;
  if (name.includes("euro")) return 1.16;
  if (name.includes("copa")) return 1.15;
  if (name.includes("africa")) return 1.12;
  if (name.includes("asian")) return 1.10;
  if (name.includes("qualif")) return 1.10;
  if (name.includes("friendly")) return 0.70;

  return 1;
}

function recencyDecay(index) {
  return Math.pow(0.86, index);
}

function getGlobalAverages(results) {
  const rows = results.filter(match => typeof match.homeScore === "number" && typeof match.awayScore === "number");
  if (!rows.length) {
    return { totalGoals: 2.62, goalsFor: 1.31, goalsAgainst: 1.31 };
  }

  const totalGoals = rows.reduce((sum, match) => sum + match.homeScore + match.awayScore, 0) / rows.length;
  return { totalGoals, goalsFor: totalGoals / 2, goalsAgainst: totalGoals / 2 };
}

function getTeamMatches(results, team, limit = 45, beforeDate = null) {
  const before = beforeDate ? new Date(beforeDate) : null;

  return results
    .filter(match => {
      if (before && new Date(match.date) >= before) return false;
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

function summarizeWindow(matches, team, size) {
  const selected = matches.slice(0, size);

  if (!selected.length) {
    return {
      played: 0,
      goalsFor: 1.12,
      goalsAgainst: 1.12,
      pointsPerGame: 1.25,
      winRate: 0.34,
      drawRate: 0.30,
      lossRate: 0.36,
      cleanSheetRate: 0.25,
      failedScoreRate: 0.25,
      scoreRate: 0.75,
      goalDiff: 0,
      stability: 0.50
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
  let absoluteSwings = 0;

  selected.forEach((match, index) => {
    const isHome = match.home === team;
    const gf = isHome ? match.homeScore : match.awayScore;
    const ga = isHome ? match.awayScore : match.homeScore;
    const weight = recencyDecay(index) * tournamentWeight(match);

    weightSum += weight;
    goalsFor += gf * weight;
    goalsAgainst += ga * weight;
    points += pointsFromScore(gf, ga) * weight;
    absoluteSwings += Math.abs(gf - ga) * weight;

    if (gf > ga) wins += weight;
    else if (gf === ga) draws += weight;
    else losses += weight;

    if (ga === 0) cleanSheets += weight;
    if (gf === 0) failedScore += weight;
  });

  const gfAvg = goalsFor / weightSum;
  const gaAvg = goalsAgainst / weightSum;
  const swing = absoluteSwings / weightSum;

  return {
    played: selected.length,
    goalsFor: gfAvg,
    goalsAgainst: gaAvg,
    pointsPerGame: points / weightSum,
    winRate: wins / weightSum,
    drawRate: draws / weightSum,
    lossRate: losses / weightSum,
    cleanSheetRate: cleanSheets / weightSum,
    failedScoreRate: failedScore / weightSum,
    scoreRate: 1 - failedScore / weightSum,
    goalDiff: gfAvg - gaAvg,
    stability: fClamp(1 - swing / 3.2, 0.10, 0.95)
  };
}

function getHistoricalBaseline(matches, team) {
  if (!matches.length) {
    return summarizeWindow([], team, 0);
  }

  const limited = matches.slice(0, 45);
  return summarizeWindow(limited, team, limited.length);
}

function getTeamFeatures(results, team, beforeDate = null) {
  const key = `${team}-${beforeDate || "now"}-${results.length}`;
  if (FEATURE_CACHE.has(key)) return FEATURE_CACHE.get(key);

  const matches = getTeamMatches(results, team, 55, beforeDate);

  const last3 = summarizeWindow(matches, team, 3);
  const last5 = summarizeWindow(matches, team, 5);
  const last10 = summarizeWindow(matches, team, 10);
  const last25 = summarizeWindow(matches, team, 25);
  const historical = getHistoricalBaseline(matches, team);

  const blend = {
    goalsFor: last3.goalsFor * 0.30 + last5.goalsFor * 0.28 + last10.goalsFor * 0.22 + last25.goalsFor * 0.15 + historical.goalsFor * 0.05,
    goalsAgainst: last3.goalsAgainst * 0.30 + last5.goalsAgainst * 0.28 + last10.goalsAgainst * 0.22 + last25.goalsAgainst * 0.15 + historical.goalsAgainst * 0.05,
    pointsPerGame: last3.pointsPerGame * 0.30 + last5.pointsPerGame * 0.28 + last10.pointsPerGame * 0.22 + last25.pointsPerGame * 0.15 + historical.pointsPerGame * 0.05,
    winRate: last3.winRate * 0.30 + last5.winRate * 0.28 + last10.winRate * 0.22 + last25.winRate * 0.15 + historical.winRate * 0.05,
    drawRate: last3.drawRate * 0.30 + last5.drawRate * 0.28 + last10.drawRate * 0.22 + last25.drawRate * 0.15 + historical.drawRate * 0.05,
    cleanSheetRate: last3.cleanSheetRate * 0.30 + last5.cleanSheetRate * 0.28 + last10.cleanSheetRate * 0.22 + last25.cleanSheetRate * 0.15 + historical.cleanSheetRate * 0.05,
    failedScoreRate: last3.failedScoreRate * 0.30 + last5.failedScoreRate * 0.28 + last10.failedScoreRate * 0.22 + last25.failedScoreRate * 0.15 + historical.failedScoreRate * 0.05,
    stability: last3.stability * 0.24 + last5.stability * 0.24 + last10.stability * 0.24 + last25.stability * 0.18 + historical.stability * 0.10
  };

  const momentum = fClamp(
    (last3.pointsPerGame - last25.pointsPerGame) * 0.30 +
    (last3.goalDiff - last25.goalDiff) * 0.18 +
    (last5.goalsFor - last25.goalsFor) * 0.12 -
    (last5.goalsAgainst - last25.goalsAgainst) * 0.10,
    -0.85,
    0.85
  );

  const attackScore = fClamp(
    blend.goalsFor * 0.62 +
    (1 - blend.failedScoreRate) * 0.72 +
    last3.goalsFor * 0.20 +
    momentum * 0.18,
    0.20,
    3.30
  );

  const defenseLeak = fClamp(
    blend.goalsAgainst * 0.72 +
    blend.failedScoreRate * 0.08 -
    blend.cleanSheetRate * 0.28 -
    momentum * 0.08,
    0.15,
    3.20
  );

  const formScore = fClamp(
    (blend.pointsPerGame - 1.22) * 0.55 +
    (blend.goalsFor - blend.goalsAgainst) * 0.38 +
    momentum * 0.62 +
    (blend.winRate - 0.34) * 0.34,
    -2.4,
    2.4
  );

  const output = {
    team,
    played: matches.length,
    last3,
    last5,
    last10,
    last25,
    historical,
    goalsFor: blend.goalsFor,
    goalsAgainst: blend.goalsAgainst,
    pointsPerGame: blend.pointsPerGame,
    winRate: blend.winRate,
    drawRate: blend.drawRate,
    cleanSheetRate: blend.cleanSheetRate,
    failedScoreRate: blend.failedScoreRate,
    scoreRate: 1 - blend.failedScoreRate,
    stability: blend.stability,
    momentum,
    attackScore,
    defenseLeak,
    formScore
  };

  FEATURE_CACHE.set(key, output);
  return output;
}

function buildEloRatings(results) {
  const key = `${results.length}-${results[results.length - 1]?.date || "none"}`;
  if (ELO_CACHE_KEY === key && ELO_CACHE_VALUE) return ELO_CACHE_VALUE;

  const ratings = {};
  const getRating = team => ratings[team] ?? 1500;

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
      const marginMultiplier = margin <= 1 ? 1 : Math.log(margin + 1) * 0.92;
      const k = 20 * tournamentWeight(match) * marginMultiplier;

      ratings[match.home] = homeRating + k * (actualHome - expectedHome);
      ratings[match.away] = awayRating + k * ((1 - actualHome) - (1 - expectedHome));
    });

  ELO_CACHE_KEY = key;
  ELO_CACHE_VALUE = ratings;
  return ratings;
}

function buildMatchFeatures(results, match) {
  const global = getGlobalAverages(results);
  const homeStats = getTeamFeatures(results, match.home);
  const awayStats = getTeamFeatures(results, match.away);
  const elo = buildEloRatings(results);

  const homeElo = elo[match.home] || 1500;
  const awayElo = elo[match.away] || 1500;
  const eloDiff = homeElo - awayElo;

  const formDiff = homeStats.formScore - awayStats.formScore;
  const momentumEdge = homeStats.momentum - awayStats.momentum;
  const attackEdge = homeStats.attackScore - awayStats.attackScore;
  const defenseEdge = awayStats.defenseLeak - homeStats.defenseLeak;

  const homeAttackIndex = fSafeDivide(homeStats.goalsFor, global.goalsFor, 1);
  const awayAttackIndex = fSafeDivide(awayStats.goalsFor, global.goalsFor, 1);
  const homeDefenseLeakIndex = fSafeDivide(homeStats.goalsAgainst, global.goalsAgainst, 1);
  const awayDefenseLeakIndex = fSafeDivide(awayStats.goalsAgainst, global.goalsAgainst, 1);

  const factors = [];

  if (Math.abs(momentumEdge) > 0.12) {
    factors.push(`${momentumEdge > 0 ? "+" : "-"} Momentum reciente favorece a ${momentumEdge > 0 ? match.home : match.away}.`);
  }

  if (Math.abs(formDiff) > 0.20) {
    factors.push(`${formDiff > 0 ? "+" : "-"} Forma ponderada reciente favorece a ${formDiff > 0 ? match.home : match.away}.`);
  }

  if (Math.abs(attackEdge) > 0.18) {
    factors.push(`${attackEdge > 0 ? "+" : "-"} Ataque reciente más fuerte para ${attackEdge > 0 ? match.home : match.away}.`);
  }

  if (Math.abs(defenseEdge) > 0.18) {
    factors.push(`${defenseEdge > 0 ? "+" : "-"} Diferencia defensiva favorece a ${defenseEdge > 0 ? match.home : match.away}.`);
  }

  if (Math.abs(eloDiff) > 85) {
    factors.push(`${eloDiff > 0 ? "+" : "-"} Elo histórico favorece a ${eloDiff > 0 ? match.home : match.away}.`);
  }

  if (match.trap) factors.push("⚠️ Partido trampa: baja ganador seco y sube protección/NO BET.");
  if (match.koRisk > 0.55) factors.push("⚠️ Riesgo KO alto: empate/prórroga afecta ganador en 90 minutos.");
  if (!factors.length) factors.push("Lectura balanceada: ningún factor domina con claridad.");

  return {
    global,
    homeStats,
    awayStats,
    homeElo,
    awayElo,
    eloDiff,
    formDiff,
    momentumEdge,
    attackEdge,
    defenseEdge,
    homeAttackIndex,
    awayAttackIndex,
    homeDefenseLeakIndex,
    awayDefenseLeakIndex,
    factors
  };
}
