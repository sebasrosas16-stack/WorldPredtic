function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function poisson(k, lambda) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n) {
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function predictMatch(results, home, away) {
  const homeStats = getRecentTeamStats(results, home, 20);
  const awayStats = getRecentTeamStats(results, away, 20);

  const homeAttack = homeStats.gf;
  const homeDefense = homeStats.ga;
  const awayAttack = awayStats.gf;
  const awayDefense = awayStats.ga;

  const homeLambda = clamp((homeAttack * 0.58) + (awayDefense * 0.42), 0.25, 3.5);
  const awayLambda = clamp((awayAttack * 0.58) + (homeDefense * 0.42), 0.25, 3.5);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let under45 = 0;
  let bothScore = 0;

  const scoreMatrix = [];
  const maxGoals = 7;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const probability = poisson(h, homeLambda) * poisson(a, awayLambda);

      scoreMatrix.push({
        score: `${h}-${a}`,
        homeGoals: h,
        awayGoals: a,
        probability
      });

      if (h > a) homeWin += probability;
      else if (h === a) draw += probability;
      else awayWin += probability;

      if (h + a <= 4) under45 += probability;
      if (h > 0 && a > 0) bothScore += probability;
    }
  }

  scoreMatrix.sort((a, b) => b.probability - a.probability);

  const mainScore = scoreMatrix[0].score;
  const topScores = scoreMatrix.slice(0, 3).map(item => item.score);

  const favorite =
    homeWin > awayWin
      ? { team: home, side: "home", prob: homeWin, lambda: homeLambda, opponentLambda: awayLambda }
      : { team: away, side: "away", prob: awayWin, lambda: awayLambda, opponentLambda: homeLambda };

  const cornersHome = clamp(3.2 + homeLambda * 1.15 - awayLambda * 0.25, 2.5, 8.5);
  const cornersAway = clamp(3.2 + awayLambda * 1.15 - homeLambda * 0.25, 2.5, 8.5);

  return {
    home,
    away,
    homeStats,
    awayStats,
    homeLambda,
    awayLambda,
    probs: {
      home: Math.round(homeWin * 100),
      draw: Math.round(draw * 100),
      away: Math.round(awayWin * 100)
    },
    score: mainScore,
    topScores,
    under45: Math.round(under45 * 100),
    bothScore: Math.round(bothScore * 100),
    corners: {
      home: Number(cornersHome.toFixed(1)),
      away: Number(cornersAway.toFixed(1))
    },
    favorite
  };
}

function generatePicks(prediction) {
  const fav = prediction.favorite.team;
  const favGoalProb = Math.round((1 - poisson(0, prediction.favorite.lambda)) * 100);
  const opponentGoalProb = Math.round((1 - poisson(0, prediction.favorite.opponentLambda)) * 100);

  let safePick = `${fav} anota 1+ gol`;
  if (favGoalProb < 70) safePick = `Menos de 4.5 goles`;

  let balancedPick = `${fav} gana`;
  if (prediction.favorite.prob < 0.48) balancedPick = `Doble oportunidad: ${fav} o empate`;

  let aggressivePick = `${fav} gana a cero`;
  if (opponentGoalProb > 45) aggressivePick = `${fav} gana y menos de 4.5 goles`;

  const cornerFav =
    prediction.favorite.side === "home"
      ? prediction.corners.home
      : prediction.corners.away;

  const cornerPick =
    cornerFav >= 5
      ? `${fav} más de 3.5 córners`
      : `Más de 7.5 córners totales`;

  return [
    { type: "safe", label: "Conservador", emoji: "🟢", text: safePick },
    { type: "balanced", label: "Equilibrado", emoji: "🟡", text: balancedPick },
    { type: "aggressive", label: "Agresivo", emoji: "🔴", text: aggressivePick },
    { type: "score", label: "Marcador", emoji: "🎯", text: `Marcador exacto ${prediction.score}` },
    { type: "corners", label: "Córners", emoji: "🚩", text: cornerPick }
  ];
}
