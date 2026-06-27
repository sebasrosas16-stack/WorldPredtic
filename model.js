function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function factorial(n) {
  if (n <= 1) return 1;
  let total = 1;
  for (let i = 2; i <= n; i++) total *= i;
  return total;
}

function poisson(k, lambda) {
  if (!Number.isFinite(lambda) || lambda <= 0) return 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function probabilityOver(expected, line, slope = 1.05) {
  return clamp(sigmoid((expected - line) * slope), 0.04, 0.96);
}

function probabilityUnder(expected, line, slope = 1.05) {
  return clamp(sigmoid((line - expected) * slope), 0.04, 0.96);
}

function getGlobalAverages(results) {
  if (!results.length) {
    return {
      goalsFor: 1.35,
      goalsAgainst: 1.35,
      totalGoals: 2.7
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
    goalsFor: totalGoals / 2,
    goalsAgainst: totalGoals / 2,
    totalGoals
  };
}

function tournamentWeight(match) {
  const name = String(match.tournament || "").toLowerCase();

  if (name.includes("world cup")) return 1.22;
  if (name.includes("euro")) return 1.14;
  if (name.includes("copa")) return 1.14;
  if (name.includes("africa")) return 1.12;
  if (name.includes("asian")) return 1.10;
  if (name.includes("qualif")) return 1.08;
  if (name.includes("friendly")) return 0.78;

  return 1;
}

function getWeightedTeamStats(results, team, limit = 34) {
  const matches = results
    .filter(match => match.home === team || match.away === team)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);

  if (!matches.length) {
    return {
      played: 0,
      goalsFor: 1.18,
      goalsAgainst: 1.18,
      goalDiff: 0,
      pointsPerGame: 1.25,
      winRate: 0.34,
      drawRate: 0.28,
      lossRate: 0.38,
      cleanSheetRate: 0.23,
      failedScoreRate: 0.24,
      formScore: 0
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

  matches.forEach((match, index) => {
    const isHome = match.home === team;
    const gf = isHome ? match.homeScore : match.awayScore;
    const ga = isHome ? match.awayScore : match.homeScore;

    const recency = Math.pow(0.925, index);
    const weight = recency * tournamentWeight(match);

    weightSum += weight;
    goalsFor += gf * weight;
    goalsAgainst += ga * weight;

    if (gf > ga) {
      points += 3 * weight;
      wins += weight;
    } else if (gf === ga) {
      points += 1 * weight;
      draws += weight;
    } else {
      losses += weight;
    }

    if (ga === 0) cleanSheets += weight;
    if (gf === 0) failedScore += weight;
  });

  const avgFor = goalsFor / weightSum;
  const avgAgainst = goalsAgainst / weightSum;
  const ppg = points / weightSum;

  return {
    played: matches.length,
    goalsFor: avgFor,
    goalsAgainst: avgAgainst,
    goalDiff: avgFor - avgAgainst,
    pointsPerGame: ppg,
    winRate: wins / weightSum,
    drawRate: draws / weightSum,
    lossRate: losses / weightSum,
    cleanSheetRate: cleanSheets / weightSum,
    failedScoreRate: failedScore / weightSum,
    formScore: (ppg - 1.25) + (avgFor - avgAgainst) * 0.42
  };
}

function buildEloRatings(results) {
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
      const k = 20 * tournamentWeight(match) * marginMultiplier;

      ratings[match.home] = homeRating + k * (actualHome - expectedHome);
      ratings[match.away] = awayRating + k * ((1 - actualHome) - (1 - expectedHome));
    });

  return ratings;
}

function normalizeOutcome(probs) {
  const total = probs.home + probs.draw + probs.away;

  if (!Number.isFinite(total) || total <= 0) {
    return { home: 0.34, draw: 0.30, away: 0.36 };
  }

  return {
    home: probs.home / total,
    draw: probs.draw / total,
    away: probs.away / total
  };
}

function threeWayFromStrength(strengthDiff, expectedGoals) {
  const absDiff = Math.abs(strengthDiff);

  let draw = 0.285 - absDiff * 0.075;
  draw += clamp((2.55 - expectedGoals) * 0.035, -0.025, 0.04);
  draw = clamp(draw, 0.17, 0.33);

  const nonDraw = 1 - draw;
  const homeShare = sigmoid(strengthDiff * 2.35);

  return normalizeOutcome({
    home: nonDraw * homeShare,
    draw,
    away: nonDraw * (1 - homeShare)
  });
}

function buildScoreMatrix(homeLambda, awayLambda, maxGoals = 8) {
  const cells = [];
  let total = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const probability = poisson(h, homeLambda) * poisson(a, awayLambda);
      cells.push({ h, a, probability });
      total += probability;
    }
  }

  return { cells, total };
}

function outcomeFromMatrix(matrix) {
  let home = 0;
  let draw = 0;
  let away = 0;

  matrix.cells.forEach(cell => {
    const p = matrix.total ? cell.probability / matrix.total : 0;

    if (cell.h > cell.a) home += p;
    else if (cell.h === cell.a) draw += p;
    else away += p;
  });

  return normalizeOutcome({ home, draw, away });
}

function modelDisagreement(models, ensemble) {
  const values = Object.values(models);
  if (!values.length) return 0;

  const total = values.reduce((sum, model) => {
    return sum +
      Math.abs(model.home - ensemble.home) +
      Math.abs(model.draw - ensemble.draw) +
      Math.abs(model.away - ensemble.away);
  }, 0);

  return total / values.length;
}

function confidenceFromPrediction(models, ensemble) {
  const disagreement = modelDisagreement(models, ensemble);
  const sorted = [ensemble.home, ensemble.draw, ensemble.away].sort((a, b) => b - a);
  const gap = sorted[0] - sorted[1];

  let score = 58;
  score += gap * 82;
  score -= disagreement * 55;
  score -= ensemble.draw * 12;

  score = clamp(Math.round(score), 34, 93);

  let label = "Media";
  if (score >= 76) label = "Alta";
  if (score < 56) label = "Baja";

  return { score, label, disagreement };
}

function roundProbs(probs) {
  let home = Math.round(probs.home * 100);
  let draw = Math.round(probs.draw * 100);
  let away = Math.round(probs.away * 100);

  const diff = 100 - (home + draw + away);

  if (diff !== 0) {
    const maxKey = [
      ["home", home],
      ["draw", draw],
      ["away", away]
    ].sort((a, b) => b[1] - a[1])[0][0];

    if (maxKey === "home") home += diff;
    if (maxKey === "draw") draw += diff;
    if (maxKey === "away") away += diff;
  }

  return { home, draw, away };
}

function applyContextToLambdas(homeLambda, awayLambda, context) {
  const model = context?.model || {};

  let h = homeLambda;
  let a = awayLambda;

  if (model.underBias) {
    h *= 1 - model.underBias;
    a *= 1 - model.underBias;
  }

  if (model.openLateRisk) {
    h *= 1 + model.openLateRisk * 0.42;
    a *= 1 + model.openLateRisk * 0.42;
  }

  if (model.motivationHome) h *= 1 + model.motivationHome;
  if (model.motivationAway) a *= 1 + model.motivationAway;
  if (model.rotationHome) h *= 1 - model.rotationHome;
  if (model.rotationAway) a *= 1 - model.rotationAway;
  if (model.defensiveHome) a *= 1 - model.defensiveHome;
  if (model.defensiveAway) h *= 1 - model.defensiveAway;

  return {
    homeLambda: clamp(h, 0.25, 3.75),
    awayLambda: clamp(a, 0.25, 3.75)
  };
}

function applyContextToOutcome(outcome, context) {
  const model = context?.model || {};

  let home = outcome.home;
  let draw = outcome.draw;
  let away = outcome.away;

  if (model.drawBoost) {
    home *= 1 - model.drawBoost * 0.45;
    away *= 1 - model.drawBoost * 0.45;
    draw += model.drawBoost;
  }

  if (model.homeUrgency) {
    home += model.homeUrgency * 0.50;
    draw -= model.homeUrgency * 0.24;
    away -= model.homeUrgency * 0.16;
  }

  if (model.awayUrgency) {
    away += model.awayUrgency * 0.50;
    draw -= model.awayUrgency * 0.24;
    home -= model.awayUrgency * 0.16;
  }

  if (model.favoriteRotationRisk) {
    if (home >= away) home *= 1 - model.favoriteRotationRisk;
    else away *= 1 - model.favoriteRotationRisk;

    draw += model.favoriteRotationRisk * 0.55;
  }

  return normalizeOutcome({
    home: Math.max(0.02, home),
    draw: Math.max(0.02, draw),
    away: Math.max(0.02, away)
  });
}

function blendOutcomes(models, weights) {
  const blended = { home: 0, draw: 0, away: 0 };

  Object.entries(models).forEach(([key, probs]) => {
    const weight = weights[key] || 0;
    blended.home += probs.home * weight;
    blended.draw += probs.draw * weight;
    blended.away += probs.away * weight;
  });

  return normalizeOutcome(blended);
}

function chooseBestLine(options, minimumProbability = 0.58) {
  const ranked = options
    .map(option => {
      let score = option.probability * 100;

      if (option.dataQuality === "proxy") score -= 8;
      if (option.direction === "UNDER" && option.lineValue > 10.5 && option.market.includes("córners")) score -= 4;
      if (option.direction === "UNDER" && option.lineValue > 5.5 && option.market.includes("tarjetas")) score -= 4;
      if (option.probability > 0.86) score -= 5;

      return { ...option, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];

  if (!best || best.probability < minimumProbability) {
    return {
      ...(best || {}),
      text: best?.market ? `${best.market}: NO BET` : "NO BET",
      line: "NO BET",
      direction: "NO BET",
      probability: best?.probability || 0,
      noBet: true,
      reason: "El modelo no ve ventaja suficiente en este mercado."
    };
  }

  if (second && Math.abs(best.probability - second.probability) < 0.018 && best.probability < 0.63) {
    return {
      ...best,
      text: `${best.market}: NO BET`,
      line: "NO BET",
      direction: "NO BET",
      noBet: true,
      reason: "Las líneas están demasiado parejas; no hay lectura clara."
    };
  }

  return {
    ...best,
    noBet: false,
    reason: best.direction === "OVER"
      ? "La señal favorece ritmo, presión o empuje ofensivo."
      : "La señal favorece partido más controlado o línea alta."
  };
}

function calculateMarketPack(prediction, matrix) {
  const favoriteSide = prediction.favorite.side;
  const favoriteLambda = prediction.favorite.lambda;
  const favoriteWinProb = prediction.favorite.prob;
  const drawProb = prediction.rawProbs.draw;

  let under45 = 0;
  let bothScore = 0;
  let matchOver05 = 0;
  let favoriteWinUnder45 = 0;
  let favoriteWinToNil = 0;

  matrix.cells.forEach(cell => {
    const p = matrix.total ? cell.probability / matrix.total : 0;
    const totalGoals = cell.h + cell.a;
    const favWins = favoriteSide === "home" ? cell.h > cell.a : cell.a > cell.h;
    const favConcedesZero = favoriteSide === "home" ? cell.a === 0 : cell.h === 0;

    if (totalGoals <= 4) under45 += p;
    if (cell.h > 0 && cell.a > 0) bothScore += p;
    if (totalGoals >= 1) matchOver05 += p;
    if (favWins && totalGoals <= 4) favoriteWinUnder45 += p;
    if (favWins && favConcedesZero) favoriteWinToNil += p;
  });

  const favoriteOver05 = 1 - poisson(0, favoriteLambda);

  const cornersExpected = prediction.expectedCorners.total;
  const cardsExpected = prediction.expectedCards;

  const cornerOptions = [
    {
      key: "cornersOver75",
      market: "Total córners",
      line: "+7.5",
      lineValue: 7.5,
      direction: "OVER",
      text: "Total córners +7.5",
      probability: probabilityOver(cornersExpected, 7.5, 0.95),
      dataQuality: "proxy"
    },
    {
      key: "cornersOver85",
      market: "Total córners",
      line: "+8.5",
      lineValue: 8.5,
      direction: "OVER",
      text: "Total córners +8.5",
      probability: probabilityOver(cornersExpected, 8.5, 0.95),
      dataQuality: "proxy"
    },
    {
      key: "cornersOver95",
      market: "Total córners",
      line: "+9.5",
      lineValue: 9.5,
      direction: "OVER",
      text: "Total córners +9.5",
      probability: probabilityOver(cornersExpected, 9.5, 0.95),
      dataQuality: "proxy"
    },
    {
      key: "cornersUnder105",
      market: "Total córners",
      line: "-10.5",
      lineValue: 10.5,
      direction: "UNDER",
      text: "Total córners -10.5",
      probability: probabilityUnder(cornersExpected, 10.5, 0.95),
      dataQuality: "proxy"
    },
    {
      key: "cornersUnder115",
      market: "Total córners",
      line: "-11.5",
      lineValue: 11.5,
      direction: "UNDER",
      text: "Total córners -11.5",
      probability: probabilityUnder(cornersExpected, 11.5, 0.95),
      dataQuality: "proxy"
    }
  ];

  const cardOptions = [
    {
      key: "cardsOver35",
      market: "Total tarjetas",
      line: "+3.5",
      lineValue: 3.5,
      direction: "OVER",
      text: "Total tarjetas +3.5",
      probability: probabilityOver(cardsExpected, 3.5, 1.05),
      dataQuality: "proxy"
    },
    {
      key: "cardsOver45",
      market: "Total tarjetas",
      line: "+4.5",
      lineValue: 4.5,
      direction: "OVER",
      text: "Total tarjetas +4.5",
      probability: probabilityOver(cardsExpected, 4.5, 1.05),
      dataQuality: "proxy"
    },
    {
      key: "cardsUnder55",
      market: "Total tarjetas",
      line: "-5.5",
      lineValue: 5.5,
      direction: "UNDER",
      text: "Total tarjetas -5.5",
      probability: probabilityUnder(cardsExpected, 5.5, 1.05),
      dataQuality: "proxy"
    },
    {
      key: "cardsUnder65",
      market: "Total tarjetas",
      line: "-6.5",
      lineValue: 6.5,
      direction: "UNDER",
      text: "Total tarjetas -6.5",
      probability: probabilityUnder(cardsExpected, 6.5, 1.05),
      dataQuality: "proxy"
    }
  ];

  const bestCorners = chooseBestLine(cornerOptions, 0.58);
  const bestCards = chooseBestLine(cardOptions, 0.58);

  const markets = {
    favoriteWin: clamp(favoriteWinProb, 0.01, 0.97),
    favoriteDoubleChance: clamp(favoriteWinProb + drawProb, 0.01, 0.98),
    favoriteOver05: clamp(favoriteOver05, 0.01, 0.98),
    under45: clamp(under45, 0.01, 0.99),
    bothScore: clamp(bothScore, 0.01, 0.96),
    matchOver05: clamp(matchOver05, 0.01, 0.99),
    favoriteWinUnder45: clamp(favoriteWinUnder45, 0.01, 0.86),
    favoriteWinToNil: clamp(favoriteWinToNil, 0.01, 0.76),
    topScore: clamp(prediction.topScores[0]?.probability || 0.05, 0.01, 0.24)
  };

  cornerOptions.forEach(option => markets[option.key] = option.probability);
  cardOptions.forEach(option => markets[option.key] = option.probability);

  return {
    markets,
    marketLines: {
      corners: {
        best: bestCorners,
        alternatives: cornerOptions.sort((a, b) => b.probability - a.probability)
      },
      cards: {
        best: bestCards,
        alternatives: cardOptions.sort((a, b) => b.probability - a.probability)
      }
    }
  };
}

function predictMatch(results, home, away, context = {}) {
  const global = getGlobalAverages(results);
  const homeStats = getWeightedTeamStats(results, home);
  const awayStats = getWeightedTeamStats(results, away);
  const ratings = buildEloRatings(results);

  const homeElo = ratings[home] || 1500;
  const awayElo = ratings[away] || 1500;
  const eloDiff = homeElo - awayElo;

  const homeAttack = clamp(homeStats.goalsFor / global.goalsFor, 0.45, 2.20);
  const awayAttack = clamp(awayStats.goalsFor / global.goalsFor, 0.45, 2.20);
  const homeDefenseLeak = clamp(homeStats.goalsAgainst / global.goalsAgainst, 0.45, 2.20);
  const awayDefenseLeak = clamp(awayStats.goalsAgainst / global.goalsAgainst, 0.45, 2.20);

  const eloHomeScale = Math.exp(clamp(eloDiff, -420, 420) / 980);
  const eloAwayScale = Math.exp(clamp(-eloDiff, -420, 420) / 980);

  const formDiff = homeStats.formScore - awayStats.formScore;
  const formHomeScale = Math.exp(clamp(formDiff, -1.4, 1.4) / 5.2);
  const formAwayScale = Math.exp(clamp(-formDiff, -1.4, 1.4) / 5.2);

  let homeLambda = global.goalsFor * homeAttack * awayDefenseLeak * eloHomeScale * formHomeScale;
  let awayLambda = global.goalsFor * awayAttack * homeDefenseLeak * eloAwayScale * formAwayScale;

  const adjusted = applyContextToLambdas(homeLambda, awayLambda, context);
  homeLambda = adjusted.homeLambda;
  awayLambda = adjusted.awayLambda;

  const expectedGoals = homeLambda + awayLambda;
  const matrix = buildScoreMatrix(homeLambda, awayLambda, 8);

  const poissonModel = outcomeFromMatrix(matrix);
  const eloModel = threeWayFromStrength(eloDiff / 390, expectedGoals);
  const formModel = threeWayFromStrength(formDiff / 1.75, expectedGoals);

  const logisticDiff =
    (eloDiff / 420) * 0.58 +
    (formDiff / 1.6) * 0.23 +
    ((homeAttack - awayAttack) + (awayDefenseLeak - homeDefenseLeak)) * 0.22;

  const logisticModel = threeWayFromStrength(logisticDiff, expectedGoals);

  const models = {
    poisson: poissonModel,
    elo: eloModel,
    form: formModel,
    logistic: logisticModel
  };

  const weights = {
    poisson: 0.44,
    elo: 0.24,
    form: 0.17,
    logistic: 0.15
  };

  let ensemble = blendOutcomes(models, weights);
  ensemble = applyContextToOutcome(ensemble, context);

  const rounded = roundProbs(ensemble);

  const favoriteSide = ensemble.home >= ensemble.away ? "home" : "away";
  const favoriteTeam = favoriteSide === "home" ? home : away;
  const favoriteLambda = favoriteSide === "home" ? homeLambda : awayLambda;
  const favoriteProb = favoriteSide === "home" ? ensemble.home : ensemble.away;

  const topScores = matrix.cells
    .map(cell => ({
      score: `${cell.h}-${cell.a}`,
      home: cell.h,
      away: cell.a,
      probability: matrix.total ? cell.probability / matrix.total : 0
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 6);

  const model = context?.model || {};
  const urgency =
    Math.abs(model.homeUrgency || 0) +
    Math.abs(model.awayUrgency || 0) +
    Math.abs(model.motivationHome || 0) +
    Math.abs(model.motivationAway || 0);

  const brokenRisk = clamp(
    (model.openLateRisk || 0) * 5 +
    urgency * 4 +
    (context.volatilityBoost || 0) / 35,
    0,
    1
  );

  const balance = 1 - Math.abs(ensemble.home - ensemble.away);

  const cornersHome = clamp(
    3.35 + homeLambda * 0.9 + (homeAttack - 1) * 0.55 + Math.max(0, homeStats.formScore) * 0.22,
    2.2,
    7.2
  );

  const cornersAway = clamp(
    3.35 + awayLambda * 0.9 + (awayAttack - 1) * 0.55 + Math.max(0, awayStats.formScore) * 0.22,
    2.2,
    7.2
  );

  const expectedCornersTotal = clamp(
    cornersHome + cornersAway + brokenRisk * 1.7 + urgency * 1.4 - (model.underBias || 0) * 1.2,
    5.5,
    13.5
  );

  const expectedCards = clamp(
    3.1 +
      balance * 0.9 +
      (context.volatilityBoost || 0) * 0.018 +
      brokenRisk * 1.15 +
      urgency * 5.0 +
      (model.drawBoost || 0) * 2.0,
    2.4,
    7.3
  );

  const confidence = confidenceFromPrediction(models, ensemble);

  const prediction = {
    modelLabel: "MatchIQ Engine v1.8",
    homeTeam: home,
    awayTeam: away,
    homeLambda,
    awayLambda,
    homeElo,
    awayElo,
    homeStats,
    awayStats,
    rawProbs: ensemble,
    probs: rounded,
    models,
    confidence,
    brokenRisk,
    favorite: {
      side: favoriteSide,
      team: favoriteTeam,
      prob: favoriteProb,
      lambda: favoriteLambda
    },
    score: topScores[0]?.score || "1-1",
    topScores,
    corners: {
      home: Number(cornersHome.toFixed(1)),
      away: Number(cornersAway.toFixed(1))
    },
    expectedCorners: {
      total: Number(expectedCornersTotal.toFixed(1)),
      home: Number(cornersHome.toFixed(1)),
      away: Number(cornersAway.toFixed(1))
    },
    expectedCards: Number(expectedCards.toFixed(1))
  };

  const marketPack = calculateMarketPack(prediction, matrix);

  prediction.markets = marketPack.markets;
  prediction.marketLines = marketPack.marketLines;
  prediction.under45 = Math.round(prediction.markets.under45 * 100);
  prediction.bothScore = Math.round(prediction.markets.bothScore * 100);

  return prediction;
}

function generatePicks(prediction) {
  const favorite = prediction.favorite.team;
  const score = prediction.score;
  const cornerBest = prediction.marketLines.corners.best;
  const cardBest = prediction.marketLines.cards.best;

  const safeMarket = prediction.markets.favoriteOver05 >= prediction.markets.under45
    ? {
        id: "safe",
        type: "safe",
        label: "Seguro",
        emoji: "🛡️",
        market: `Goles ${favorite}`,
        line: "+0.5",
        direction: "OVER",
        text: `Goles ${favorite} +0.5`,
        marketKey: "favoriteOver05",
        dataQuality: "strong",
        noBet: false,
        rationale: "Mercado basado directamente en goles esperados y producción ofensiva."
      }
    : {
        id: "safe",
        type: "safe",
        label: "Seguro",
        emoji: "🛡️",
        market: "Total goles",
        line: "-4.5",
        direction: "UNDER",
        text: "Total goles -4.5",
        marketKey: "under45",
        dataQuality: "strong",
        noBet: false,
        rationale: "Mercado basado directamente en distribución de goles del modelo."
      };

  return [
    safeMarket,
    {
      id: "balanced",
      type: "balanced",
      label: "Balanceado",
      emoji: "⚖️",
      market: `Handicap ${favorite}`,
      line: "+0.5",
      direction: "HANDICAP",
      text: `${favorite} +0.5 handicap`,
      marketKey: "favoriteDoubleChance",
      dataQuality: "strong",
      noBet: false,
      rationale: "Equivale a doble oportunidad: gana o empata."
    },
    {
      id: "aggressive",
      type: "aggressive",
      label: "Agresivo",
      emoji: "🔥",
      market: "Combo",
      line: "Gana + -4.5",
      direction: "COMBO",
      text: `${favorite} gana + total goles -4.5`,
      marketKey: "favoriteWinUnder45",
      dataQuality: "strong",
      noBet: false,
      rationale: "Combina resultado y total de goles; más varianza que un pick simple."
    },
    {
      id: "corners",
      type: "corners",
      label: "Córners",
      emoji: "🚩",
      market: cornerBest.market || "Total córners",
      line: cornerBest.noBet ? "NO BET" : cornerBest.line,
      direction: cornerBest.direction || "NO BET",
      text: cornerBest.noBet ? "Córners: NO BET" : cornerBest.text,
      marketKey: cornerBest.key,
      dataQuality: "proxy",
      noBet: Boolean(cornerBest.noBet),
      rationale: cornerBest.noBet
        ? cornerBest.reason
        : `${cornerBest.reason} Estimación proxy: no usa datos reales de córners.`
    },
    {
      id: "cards",
      type: "cards",
      label: "Tarjetas",
      emoji: "🟨",
      market: cardBest.market || "Total tarjetas",
      line: cardBest.noBet ? "NO BET" : cardBest.line,
      direction: cardBest.direction || "NO BET",
      text: cardBest.noBet ? "Tarjetas: NO BET" : cardBest.text,
      marketKey: cardBest.key,
      dataQuality: "proxy",
      noBet: Boolean(cardBest.noBet),
      rationale: cardBest.noBet
        ? cardBest.reason
        : `${cardBest.reason} Estimación proxy: no usa árbitro ni tarjetas reales.`
    },
    {
      id: "score",
      type: "score",
      label: "Marcador",
      emoji: "🎯",
      market: "Marcador exacto",
      line: score,
      direction: "EXACTO",
      text: `Marcador exacto ${score}`,
      marketKey: "topScore",
      dataQuality: "strong",
      noBet: false,
      rationale: "Mercado de alta varianza aunque esté basado en el modelo de goles."
    }
  ];
}
