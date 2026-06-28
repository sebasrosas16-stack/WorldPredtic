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

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function probabilityOver(expected, line, slope = 1) {
  return clamp(sigmoid((expected - line) * slope), 0.03, 0.97);
}

function probabilityUnder(expected, line, slope = 1) {
  return clamp(sigmoid((line - expected) * slope), 0.03, 0.97);
}

function normalizeOutcome(probs) {
  const total = probs.home + probs.draw + probs.away;
  if (!Number.isFinite(total) || total <= 0) return { home: 0.34, draw: 0.30, away: 0.36 };

  return {
    home: probs.home / total,
    draw: probs.draw / total,
    away: probs.away / total
  };
}

function threeWayFromStrength(strengthDiff, expectedGoals, koRisk = 0) {
  const absDiff = Math.abs(strengthDiff);
  let draw = 0.285 - absDiff * 0.070 + clamp((2.45 - expectedGoals) * 0.035, -0.03, 0.045);
  draw += koRisk * 0.035;
  draw = clamp(draw, 0.17, 0.36);

  const nonDraw = 1 - draw;
  const homeShare = sigmoid(strengthDiff * 2.25);

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

function blendOutcomes(models, weights) {
  const output = { home: 0, draw: 0, away: 0 };

  Object.entries(models).forEach(([key, model]) => {
    const weight = weights[key] || 0;
    output.home += model.home * weight;
    output.draw += model.draw * weight;
    output.away += model.away * weight;
  });

  return normalizeOutcome(output);
}

function roundProbs(probs) {
  let home = Math.round(probs.home * 100);
  let draw = Math.round(probs.draw * 100);
  let away = Math.round(probs.away * 100);
  const diff = 100 - (home + draw + away);

  if (diff) {
    const best = [["home", home], ["draw", draw], ["away", away]].sort((a, b) => b[1] - a[1])[0][0];
    if (best === "home") home += diff;
    if (best === "draw") draw += diff;
    if (best === "away") away += diff;
  }

  return { home, draw, away };
}

function modelDisagreement(models, ensemble) {
  const values = Object.values(models);
  if (!values.length) return 0;

  return values.reduce((sum, model) => {
    return sum + Math.abs(model.home - ensemble.home) + Math.abs(model.draw - ensemble.draw) + Math.abs(model.away - ensemble.away);
  }, 0) / values.length;
}

function confidenceFromModels(models, ensemble, match) {
  const sorted = [ensemble.home, ensemble.draw, ensemble.away].sort((a, b) => b - a);
  const gap = sorted[0] - sorted[1];
  const disagreement = modelDisagreement(models, ensemble);

  let score = 58;
  score += gap * 82;
  score -= disagreement * 55;
  score -= (match.volatility || 0.5) * 8;
  score -= (match.koRisk || 0.5) * 5;
  if (match.trap) score -= 7;

  score = clamp(Math.round(score), 32, 92);

  return {
    score,
    label: score >= 76 ? "Alta" : score >= 56 ? "Media" : "Baja",
    disagreement
  };
}

function phaseAdjustLambdas(homeLambda, awayLambda, match, features) {
  let h = homeLambda;
  let a = awayLambda;

  if (match.goalProfile === "bajo-medio") {
    h *= 0.92;
    a *= 0.92;
  }

  if (match.goalProfile === "medio-alto") {
    h *= 1.06;
    a *= 1.06;
  }

  if (match.koRisk > 0.55) {
    h *= 0.96;
    a *= 0.96;
  }

  if (match.favoriteHint === match.home) {
    h *= 1.10;
    a *= 0.96;
  }

  if (match.favoriteHint === match.away) {
    a *= 1.10;
    h *= 0.96;
  }

  const recentCapHome = 1 + clamp(features.homeStats.momentum, -0.35, 0.35) * 0.14;
  const recentCapAway = 1 + clamp(features.awayStats.momentum, -0.35, 0.35) * 0.14;

  h *= recentCapHome;
  a *= recentCapAway;

  return {
    homeLambda: clamp(h, 0.22, 3.80),
    awayLambda: clamp(a, 0.22, 3.80)
  };
}

function phaseAdjustOutcome(outcome, match) {
  let home = outcome.home;
  let draw = outcome.draw;
  let away = outcome.away;

  if (match.trap) {
    const strongest = home >= away ? "home" : "away";
    if (strongest === "home") home *= 0.94;
    else away *= 0.94;
    draw += 0.035;
  }

  if (match.koRisk > 0.55) {
    home *= 0.96;
    away *= 0.96;
    draw += 0.045;
  }

  return normalizeOutcome({ home, draw, away });
}

function matrixProbability(matrix, test) {
  let total = 0;
  matrix.cells.forEach(cell => {
    const p = matrix.total ? cell.probability / matrix.total : 0;
    if (test(cell)) total += p;
  });
  return clamp(total, 0.01, 0.99);
}

function classifyHeat(score, noBet = false) {
  if (noBet) return { className: "hot-nobet", label: "⚪ NO BET" };
  if (score >= 85) return { className: "hot-strong", label: "🟢 Alto valor" };
  if (score >= 70) return { className: "hot-good", label: "🟩 Bueno" };
  if (score >= 55) return { className: "hot-mid", label: "🟡 Marginal" };
  if (score >= 40) return { className: "hot-risk", label: "🟠 Riesgoso" };
  return { className: "hot-bad", label: "🔴 Evitar" };
}

function marketRiskPenalty(type, quality, match) {
  let penalty = 0;

  if (quality === "proxy") penalty += 8;
  if (type === "exactScore") penalty += 34;
  if (type === "player") penalty += 12;
  if (type === "cards") penalty += 10;
  if (type === "corners") penalty += 8;
  if (type === "winner" && match.trap) penalty += 12;
  if (type === "winner" && match.koRisk > 0.55) penalty += 10;
  if (type === "extraTime") penalty += 12;

  penalty += (match.volatility || 0.5) * 9;
  return penalty;
}

function heatScore({ probability, type, quality = "strong", match, confidence, marketBoost = 0, noBet = false }) {
  if (noBet) return 0;

  let score = 0;
  score += probability * 52;
  score += (confidence.score / 100) * 18;
  score += marketBoost;
  score += (1 - (match.koRisk || 0.5)) * 4;
  score -= marketRiskPenalty(type, quality, match);

  return Math.round(clamp(score, 0, 100));
}

function makeMarketPick(input) {
  const fairOdds = input.probability > 0 ? 1 / input.probability : 0;
  const noBet = Boolean(input.noBet) || input.probability < (input.minimum || 0.38);
  const heat = heatScore({ ...input, noBet });
  const heatInfo = classifyHeat(heat, noBet);

  return {
    id: input.id,
    type: input.type,
    label: input.label,
    market: input.market,
    text: input.text,
    line: input.line || "",
    direction: input.direction || "",
    probability: clamp(input.probability, 0.01, 0.99),
    fairOdds,
    heatScore: heat,
    heatClass: heatInfo.className,
    heatLabel: heatInfo.label,
    dataQuality: input.quality || "strong",
    category: input.category || "valor",
    risk: heat >= 70 ? "Bajo/medio" : heat >= 55 ? "Medio" : "Alto",
    noBet,
    rationale: input.rationale || ""
  };
}

function slugifyMarket(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getRoleShotBoost(role) {
  if (role === "striker") return 0.060;
  if (role === "winger") return 0.045;
  if (role === "forward") return 0.050;
  if (role === "creator") return 0.030;
  if (role === "wingback") return 0.018;
  return 0.020;
}

function getRoleGoalBoost(role) {
  if (role === "striker") return 0.075;
  if (role === "forward") return 0.058;
  if (role === "winger") return 0.047;
  if (role === "creator") return 0.030;
  return 0.018;
}

function buildPopularPlayerInputs(prediction, match, confidence) {
  const profiles = typeof PLAYER_PROFILES !== "undefined" ? PLAYER_PROFILES : {};
  const candidates = [
    ...(profiles[match.home] || []).map(player => ({ ...player, team: match.home, side: "home" })),
    ...(profiles[match.away] || []).map(player => ({ ...player, team: match.away, side: "away" }))
  ];

  if (!candidates.length) return [];

  const favoriteTeam = prediction.favorite.team;
  const ranked = candidates
    .map(player => ({
      ...player,
      rank: player.popularity + (player.team === favoriteTeam ? 0.060 : 0) + (player.goalPick ? 0.025 : 0)
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 4);

  const inputs = [];

  ranked.forEach((player, index) => {
    const teamLambda = player.side === "home" ? prediction.homeLambda : prediction.awayLambda;
    const teamWinProb = player.side === "home" ? prediction.rawProbs.home : prediction.rawProbs.away;
    const teamScores = 1 - poisson(0, teamLambda);
    const roleShotBoost = getRoleShotBoost(player.role);
    const roleGoalBoost = getRoleGoalBoost(player.role);
    const popularity = clamp(player.popularity || 0.75, 0.65, 1.0);
    const koPenalty = (match.koRisk || 0.5) * 0.035;
    const trapPenalty = match.trap ? 0.025 : 0;

    const shotProbability = clamp(
      0.315 +
      teamLambda * 0.105 +
      teamScores * 0.100 +
      popularity * 0.110 +
      roleShotBoost +
      Math.max(0, teamWinProb - 0.34) * 0.070 -
      koPenalty -
      trapPenalty,
      0.26,
      0.78
    );

    inputs.push({
      id: `player-${slugifyMarket(player.name)}-sot`,
      type: "player",
      label: "Jugador",
      market: "Jugador tiro a puerta",
      text: `${player.name} tiro a puerta +0.5`,
      line: "+0.5",
      direction: "OVER",
      probability: shotProbability,
      confidence,
      match,
      quality: "proxy",
      category: "proxy",
      marketBoost: 24 + (popularity >= 0.92 ? 4 : 0) - index,
      minimum: 0.40,
      rationale: "Pick popular de jugador. Proxy: requiere alineación confirmada y minutos esperados."
    });

    if (player.goalPick && index <= 2) {
      const goalProbability = clamp(
        0.130 +
        teamLambda * 0.075 +
        popularity * 0.100 +
        roleGoalBoost +
        Math.max(0, teamWinProb - 0.42) * 0.075 -
        (match.koRisk || 0.5) * 0.030,
        0.12,
        0.54
      );

      inputs.push({
        id: `player-${slugifyMarket(player.name)}-goal`,
        type: "player",
        label: "Jugador",
        market: "Jugador anota gol",
        text: `${player.name} anota gol`,
        direction: "OVER",
        probability: goalProbability,
        confidence,
        match,
        quality: "proxy",
        category: "agresivo",
        marketBoost: 26 + (popularity >= 0.94 ? 7 : 0) - index,
        minimum: 0.22,
        rationale: "Mercado popular pero de alta varianza. No usar sin alineación confirmada."
      });
    }
  });

  return inputs;
}

function buildMarkets(prediction, matrix, match, confidence) {
  const home = prediction.homeTeam;
  const away = prediction.awayTeam;
  const favorite = prediction.favorite.team;
  const favSide = prediction.favorite.side;
  const favWin = prediction.favorite.prob;
  const favLambda = prediction.favorite.lambda;
  const favQualifies = clamp(favWin + prediction.rawProbs.draw * (0.54 + clamp(Math.abs(prediction.strengthDiff), 0, 1.2) * 0.11), 0.05, 0.94);

  const under45 = matrixProbability(matrix, cell => cell.h + cell.a <= 4);
  const under35 = matrixProbability(matrix, cell => cell.h + cell.a <= 3);
  const over15 = matrixProbability(matrix, cell => cell.h + cell.a >= 2);
  const over25 = matrixProbability(matrix, cell => cell.h + cell.a >= 3);
  const bttsYes = matrixProbability(matrix, cell => cell.h > 0 && cell.a > 0);
  const bttsNo = 1 - bttsYes;
  const favOver05 = 1 - poisson(0, favLambda);
  const favWinUnder45 = matrixProbability(matrix, cell => {
    const favWins = favSide === "home" ? cell.h > cell.a : cell.a > cell.h;
    return favWins && cell.h + cell.a <= 4;
  });

  const topScore = prediction.topScores[0];
  const expectedCorners = prediction.expectedCorners.total;
  const expectedCards = prediction.expectedCards;

  const cornersOver75 = probabilityOver(expectedCorners, 7.5, 0.95);
  const cornersOver85 = probabilityOver(expectedCorners, 8.5, 0.95);
  const cornersUnder105 = probabilityUnder(expectedCorners, 10.5, 0.95);
  const cardsOver35 = probabilityOver(expectedCards, 3.5, 1.03);
  const cardsOver45 = probabilityOver(expectedCards, 4.5, 1.03);
  const cardsUnder55 = probabilityUnder(expectedCards, 5.5, 1.03);
  const extraTime = clamp(prediction.rawProbs.draw + (match.koRisk || 0) * 0.08, 0.08, 0.48);
  const playerInputs = buildPopularPlayerInputs(prediction, match, confidence);

  const marketInputs = [
    {
      id: `winner-${favSide}`,
      type: "winner",
      label: "Ganador 90 min",
      market: "Ganador 90 minutos",
      text: `${favorite} gana en 90 min`,
      probability: favWin,
      confidence,
      match,
      quality: "strong",
      marketBoost: 4,
      minimum: match.trap ? 0.54 : 0.48,
      rationale: "Resultado en tiempo regular; no es lo mismo que clasifica."
    },
    {
      id: "favorite-dc",
      type: "doubleChance",
      label: "Doble oportunidad",
      market: "Doble oportunidad / +0.5",
      text: `${favorite} +0.5 handicap`,
      line: "+0.5",
      direction: "HANDICAP",
      probability: clamp(favWin + prediction.rawProbs.draw, 0.01, 0.98),
      confidence,
      match,
      quality: "strong",
      category: "seguro",
      marketBoost: 11,
      minimum: 0.55,
      rationale: "Protege empate en 90 minutos."
    },
    {
      id: "favorite-goal-05",
      type: "teamGoal",
      label: "Equipo anota",
      market: `Gol de ${favorite}`,
      text: `${favorite} goles +0.5`,
      line: "+0.5",
      direction: "OVER",
      probability: favOver05,
      confidence,
      match,
      quality: "strong",
      category: "seguro",
      marketBoost: 10,
      minimum: 0.58,
      rationale: "Basado en lambda ofensiva reciente del favorito."
    },
    {
      id: "total-over15",
      type: "goals",
      label: "Total goles",
      market: "Total goles",
      text: "Total goles +1.5",
      line: "+1.5",
      direction: "OVER",
      probability: over15,
      confidence,
      match,
      quality: "strong",
      marketBoost: 8,
      minimum: 0.58,
      rationale: "Mercado de goles de menor exposición."
    },
    {
      id: "total-under45",
      type: "goals",
      label: "Total goles",
      market: "Total goles",
      text: "Total goles -4.5",
      line: "-4.5",
      direction: "UNDER",
      probability: under45,
      confidence,
      match,
      quality: "strong",
      category: "seguro",
      marketBoost: 9,
      minimum: 0.60,
      rationale: "Evita marcadores muy altos; útil en KO."
    },
    {
      id: "total-under35",
      type: "goals",
      label: "Total goles",
      market: "Total goles",
      text: "Total goles -3.5",
      line: "-3.5",
      direction: "UNDER",
      probability: under35,
      confidence,
      match,
      quality: "strong",
      category: "valor",
      marketBoost: match.goalProfile === "bajo-medio" ? 10 : 3,
      minimum: 0.56,
      rationale: "Under intermedio; útil en partidos KO cerrados."
    },
    {
      id: "total-over25",
      type: "goals",
      label: "Total goles",
      market: "Total goles",
      text: "Total goles +2.5",
      line: "+2.5",
      direction: "OVER",
      probability: over25,
      confidence,
      match,
      quality: "strong",
      marketBoost: match.goalProfile === "medio-alto" ? 8 : 1,
      minimum: 0.51,
      rationale: "Más sensible al guion del primer gol."
    },
    {
      id: "btts-yes",
      type: "btts",
      label: "Ambos anotan",
      market: "Ambos anotan",
      text: "Ambos anotan SÍ",
      direction: "YES",
      probability: bttsYes,
      confidence,
      match,
      quality: "strong",
      marketBoost: bttsYes >= 0.58 ? 8 : 0,
      minimum: 0.55,
      rationale: "Depende de que ambos equipos superen el 0."
    },
    {
      id: "btts-no",
      type: "btts",
      label: "Ambos anotan",
      market: "Ambos anotan",
      text: "Ambos anotan NO",
      direction: "NO",
      probability: bttsNo,
      confidence,
      match,
      quality: "strong",
      marketBoost: bttsNo >= 0.58 ? 8 : 0,
      minimum: 0.55,
      rationale: "Útil si un equipo tiene riesgo de quedarse en cero."
    },
    {
      id: "corners-over75",
      type: "corners",
      label: "Córners",
      market: "Total córners",
      text: "Total córners +7.5",
      line: "+7.5",
      direction: "OVER",
      probability: cornersOver75,
      confidence,
      match,
      quality: "proxy",
      marketBoost: match.cornerProfile.includes("over") ? 8 : 2,
      minimum: 0.58,
      rationale: "Proxy: no usa datos reales de córners por partido."
    },
    {
      id: "corners-over85",
      type: "corners",
      label: "Córners",
      market: "Total córners",
      text: "Total córners +8.5",
      line: "+8.5",
      direction: "OVER",
      probability: cornersOver85,
      confidence,
      match,
      quality: "proxy",
      marketBoost: match.cornerProfile === "over" ? 9 : 1,
      minimum: 0.56,
      rationale: "Proxy: línea más agresiva de ritmo/carga ofensiva."
    },
    {
      id: "corners-under105",
      type: "corners",
      label: "Córners",
      market: "Total córners",
      text: "Total córners -10.5",
      line: "-10.5",
      direction: "UNDER",
      probability: cornersUnder105,
      confidence,
      match,
      quality: "proxy",
      marketBoost: match.cornerProfile === "under" ? 9 : 1,
      minimum: 0.58,
      rationale: "Proxy: útil si el partido pinta trabado o con línea alta."
    },
    {
      id: "cards-over35",
      type: "cards",
      label: "Tarjetas",
      market: "Total tarjetas",
      text: "Total tarjetas +3.5",
      line: "+3.5",
      direction: "OVER",
      probability: cardsOver35,
      confidence,
      match,
      quality: "proxy",
      marketBoost: match.cardProfile.includes("alto") ? 10 : 3,
      minimum: 0.58,
      rationale: "Proxy: no usa árbitro confirmado."
    },
    {
      id: "cards-over45",
      type: "cards",
      label: "Tarjetas",
      market: "Total tarjetas",
      text: "Total tarjetas +4.5",
      line: "+4.5",
      direction: "OVER",
      probability: cardsOver45,
      confidence,
      match,
      quality: "proxy",
      marketBoost: match.cardProfile === "alto" ? 10 : 0,
      minimum: 0.54,
      rationale: "Proxy más agresivo de tarjetas."
    },
    {
      id: "cards-under55",
      type: "cards",
      label: "Tarjetas",
      market: "Total tarjetas",
      text: "Total tarjetas -5.5",
      line: "-5.5",
      direction: "UNDER",
      probability: cardsUnder55,
      confidence,
      match,
      quality: "proxy",
      marketBoost: match.cardProfile === "medio" ? 7 : 0,
      minimum: 0.58,
      rationale: "Proxy: depende mucho del árbitro y guion."
    },
    {
      id: "qualifies-favorite",
      type: "qualifies",
      label: "Clasifica",
      market: "Clasifica / avanza",
      text: `${favorite} clasifica`,
      probability: favQualifies,
      confidence,
      match,
      quality: "strong",
      category: "seguro",
      marketBoost: 10,
      minimum: 0.60,
      rationale: "Incluye opciones de prórroga/penales, separado del 90 min."
    },
    {
      id: "extra-time-yes",
      type: "extraTime",
      label: "Prórroga",
      market: "Prórroga",
      text: "Prórroga SÍ",
      probability: extraTime,
      confidence,
      match,
      quality: "strong",
      marketBoost: match.koRisk > 0.58 ? 10 : 0,
      minimum: 0.33,
      rationale: "Aproximación basada en probabilidad de empate y riesgo KO."
    },
    {
      id: "fav-win-under45",
      type: "combo",
      label: "Combo",
      market: "Resultado + goles",
      text: `${favorite} gana + total goles -4.5`,
      line: "Gana + -4.5",
      probability: favWinUnder45,
      confidence,
      match,
      quality: "strong",
      category: "agresivo",
      marketBoost: 1,
      minimum: 0.34,
      rationale: "Combo de mayor varianza; solo si el momio compensa."
    },
    {
      id: "exact-score",
      type: "exactScore",
      label: "Marcador exacto",
      market: "Marcador exacto",
      text: `Marcador exacto ${topScore.score}`,
      line: topScore.score,
      probability: topScore.probability,
      confidence,
      match,
      quality: "strong",
      category: "agresivo",
      marketBoost: 0,
      minimum: 0.14,
      rationale: "Alta varianza. No sirve para medir el modelo principal."
    },
    ...playerInputs
  ];

  return marketInputs
    .map(makeMarketPick)
    .sort((a, b) => b.heatScore - a.heatScore);
}

function predictMatch(results, match) {
  const features = buildMatchFeatures(results, match);
  const global = features.global;

  const homeAttack = clamp(features.homeAttackIndex, 0.45, 2.25);
  const awayAttack = clamp(features.awayAttackIndex, 0.45, 2.25);
  const homeDefenseLeak = clamp(features.homeDefenseLeakIndex, 0.45, 2.25);
  const awayDefenseLeak = clamp(features.awayDefenseLeakIndex, 0.45, 2.25);

  const eloHomeScale = Math.exp(clamp(features.eloDiff, -440, 440) / 1040);
  const eloAwayScale = Math.exp(clamp(-features.eloDiff, -440, 440) / 1040);

  const formHomeScale = Math.exp(clamp(features.formDiff, -1.8, 1.8) / 4.35);
  const formAwayScale = Math.exp(clamp(-features.formDiff, -1.8, 1.8) / 4.35);

  let homeLambda = global.goalsFor * homeAttack * awayDefenseLeak * eloHomeScale * formHomeScale;
  let awayLambda = global.goalsFor * awayAttack * homeDefenseLeak * eloAwayScale * formAwayScale;

  const adjusted = phaseAdjustLambdas(homeLambda, awayLambda, match, features);
  homeLambda = adjusted.homeLambda;
  awayLambda = adjusted.awayLambda;

  const expectedGoals = homeLambda + awayLambda;
  const matrix = buildScoreMatrix(homeLambda, awayLambda, 8);

  const poissonModel = outcomeFromMatrix(matrix);
  const eloModel = threeWayFromStrength(features.eloDiff / 390, expectedGoals, match.koRisk);
  const recentModel = threeWayFromStrength(features.formDiff / 1.35, expectedGoals, match.koRisk);

  const logisticDiff =
    (features.momentumEdge / 0.90) * 0.35 +
    (features.formDiff / 1.70) * 0.30 +
    (features.eloDiff / 420) * 0.22 +
    features.attackEdge * 0.11 +
    features.defenseEdge * 0.14;

  const logisticModel = threeWayFromStrength(logisticDiff, expectedGoals, match.koRisk);

  const models = {
    recent: recentModel,
    poisson: poissonModel,
    elo: eloModel,
    logistic: logisticModel
  };

  const weights = {
    recent: 0.35,
    poisson: 0.25,
    elo: 0.18,
    logistic: 0.22
  };

  let ensemble = blendOutcomes(models, weights);
  ensemble = phaseAdjustOutcome(ensemble, match);

  const strengthDiff = logisticDiff;
  const confidence = confidenceFromModels(models, ensemble, match);
  const rounded = roundProbs(ensemble);

  const favoriteSide = ensemble.home >= ensemble.away ? "home" : "away";
  const favoriteTeam = favoriteSide === "home" ? match.home : match.away;
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
    .slice(0, 8);

  const favoritePressure = favoriteProb > 0.58 ? 1 : 0;
  let expectedCornersTotal = 7.2 + expectedGoals * 0.55 + favoritePressure * 0.65 + (match.volatility || 0.5) * 0.80;
  if (match.cornerProfile === "over") expectedCornersTotal += 1.0;
  if (match.cornerProfile === "medio-over") expectedCornersTotal += 0.45;
  if (match.cornerProfile === "under") expectedCornersTotal -= 0.55;
  expectedCornersTotal = clamp(expectedCornersTotal, 5.6, 13.2);

  const homeCornerShare = clamp(0.50 + (ensemble.home - ensemble.away) * 0.23 + (homeLambda - awayLambda) * 0.06, 0.32, 0.68);
  const cornersHome = expectedCornersTotal * homeCornerShare;
  const cornersAway = expectedCornersTotal - cornersHome;

  let expectedCards = 3.0 + (match.volatility || 0.5) * 1.25 + (match.koRisk || 0.5) * 0.70 + ensemble.draw * 0.95;
  if (match.cardProfile === "alto") expectedCards += 0.80;
  if (match.cardProfile === "medio-alto") expectedCards += 0.45;
  expectedCards = clamp(expectedCards, 2.2, 7.2);

  const prediction = {
    modelLabel: "MatchIQ v2.0.1 Recency KO Engine",
    homeTeam: match.home,
    awayTeam: match.away,
    homeLambda,
    awayLambda,
    expectedGoals,
    strengthDiff,
    rawProbs: ensemble,
    probs: rounded,
    models,
    confidence,
    features,
    favorite: {
      side: favoriteSide,
      team: favoriteTeam,
      prob: favoriteProb,
      lambda: favoriteLambda
    },
    topScores,
    score: topScores[0]?.score || "1-1",
    expectedCorners: {
      total: Number(expectedCornersTotal.toFixed(1)),
      home: Number(cornersHome.toFixed(1)),
      away: Number(cornersAway.toFixed(1))
    },
    expectedCards: Number(expectedCards.toFixed(1)),
    bttsYes: matrixProbability(matrix, cell => cell.h > 0 && cell.a > 0),
    bttsNo: 1 - matrixProbability(matrix, cell => cell.h > 0 && cell.a > 0),
    factors: features.factors
  };

  prediction.heatMap = buildMarkets(prediction, matrix, match, confidence);
  prediction.bestSafe = prediction.heatMap.find(pick => ["seguro", "valor"].includes(pick.category) && !pick.noBet) || prediction.heatMap.find(pick => !pick.noBet);
  prediction.bestValue = prediction.heatMap.find(pick => pick.heatScore >= 70 && !pick.noBet) || prediction.bestSafe;
  prediction.bestAggressive = prediction.heatMap.find(pick => pick.category === "agresivo" && !pick.noBet) || prediction.heatMap.find(pick => pick.type === "combo" && !pick.noBet);
  prediction.proxyUsable = prediction.heatMap.find(pick => pick.dataQuality === "proxy" && pick.heatScore >= 55 && !pick.noBet);

  return prediction;
}
