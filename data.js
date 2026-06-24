const RESULTS_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv";

async function loadResults() {
  return new Promise((resolve, reject) => {
    Papa.parse(RESULTS_URL, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: function(results) {
        const clean = results.data
          .filter(row =>
            row.date &&
            row.home_team &&
            row.away_team &&
            typeof row.home_score === "number" &&
            typeof row.away_score === "number"
          )
          .map(row => ({
            date: row.date,
            home: row.home_team,
            away: row.away_team,
            homeScore: row.home_score,
            awayScore: row.away_score,
            tournament: row.tournament,
            neutral: row.neutral === true || row.neutral === "TRUE"
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        resolve(clean);
      },
      error: function(error) {
        reject(error);
      }
    });
  });
}

function getTeamMatches(results, team) {
  return results
    .filter(match => match.home === team || match.away === team)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getRecentTeamStats(results, team, limit = 20) {
  const matches = getTeamMatches(results, team).slice(0, limit);

  let weightedGF = 0;
  let weightedGA = 0;
  let weightedW = 0;
  let weightedD = 0;
  let weightedL = 0;
  let totalWeight = 0;

  matches.forEach((match, index) => {
    const weight = Math.exp(-index / 8);

    const isHome = match.home === team;
    const gf = isHome ? match.homeScore : match.awayScore;
    const ga = isHome ? match.awayScore : match.homeScore;

    weightedGF += gf * weight;
    weightedGA += ga * weight;

    if (gf > ga) weightedW += weight;
    else if (gf === ga) weightedD += weight;
    else weightedL += weight;

    totalWeight += weight;
  });

  if (!matches.length) {
    return {
      team,
      played: 0,
      gf: 1,
      ga: 1,
      winRate: 0.33,
      drawRate: 0.33,
      lossRate: 0.33
    };
  }

  return {
    team,
    played: matches.length,
    gf: weightedGF / totalWeight,
    ga: weightedGA / totalWeight,
    winRate: weightedW / totalWeight,
    drawRate: weightedD / totalWeight,
    lossRate: weightedL / totalWeight
  };
}
