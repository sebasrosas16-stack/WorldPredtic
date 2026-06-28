function parserNormalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.+\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findNumberLine(text) {
  const normalized = parserNormalize(text);
  const match = normalized.match(/([+\-])\s*(\d+(?:\.\d+)?)/) || normalized.match(/\b(\d+(?:\.\d+)?)\b/);

  if (!match) return { line: "", lineValue: null, sign: "" };

  if (match.length >= 3) {
    return { line: `${match[1]}${match[2]}`, lineValue: Number(match[2]), sign: match[1] };
  }

  return { line: match[1], lineValue: Number(match[1]), sign: "" };
}

function resolveTeamFromText(text, matches) {
  const normalized = parserNormalize(text);
  const teams = [];

  matches.forEach(match => {
    [match.home, match.away].forEach(team => {
      const names = [team, DISPLAY_NAMES[team], ...Object.entries(TEAM_ALIASES).filter(([, mapped]) => mapped === team).map(([alias]) => alias)]
        .filter(Boolean)
        .map(parserNormalize);

      if (names.some(name => name && normalized.includes(name))) {
        if (!teams.includes(team)) teams.push(team);
      }
    });
  });

  return teams;
}

function resolveMatchForManual(text, matches, selectedMatch = null) {
  const teams = resolveTeamFromText(text, matches);

  if (teams.length >= 2) {
    const found = matches.find(match => teams.includes(match.home) && teams.includes(match.away));
    if (found) return { match: found, teams, confidence: "Alta" };
  }

  if (teams.length === 1) {
    const found = matches.find(match => match.home === teams[0] || match.away === teams[0]);
    if (found) return { match: found, teams, confidence: "Media" };
  }

  return { match: selectedMatch, teams, confidence: selectedMatch ? "Baja" : "Nula" };
}

function detectManualMarket(text) {
  const t = parserNormalize(text);
  const line = findNumberLine(text);

  const hasOver = /\b(over|mas de|mayor|arriba|\+)\b/.test(t) || line.sign === "+";
  const hasUnder = /\b(under|menos de|menor|abajo|\-)\b/.test(t) || line.sign === "-";
  const hasCorners = /\b(corner|corners|corneres|tiro de esquina|tiros de esquina|corner kicks)\b/.test(t);
  const hasCards = /\b(tarjeta|tarjetas|amarilla|amarillas|cards)\b/.test(t);
  const hasGoals = /\b(gol|goles|goals)\b/.test(t);
  const hasBTTS = /\b(ambos anotan|btts|ambos marcan|los dos anotan)\b/.test(t);
  const hasShotOnTarget = /\b(tiro a puerta|tiros a puerta|remate a puerta|sot|shot on target)\b/.test(t);
  const hasShot = /\b(tiro|tiros|remate|remates|shots)\b/.test(t) && !hasShotOnTarget;
  const hasScore = /\b(marcador exacto|correct score|exacto)\b/.test(t) || /\b\d\s*[-:]\s*\d\b/.test(t);
  const hasClassifies = /\b(clasifica|avanza|pasa|qualifies|advance)\b/.test(t);
  const hasExtraTime = /\b(prorroga|tiempo extra|extra time|penales|penaltis)\b/.test(t);
  const hasHalf = /\b(descanso|primer tiempo|1t|half time|ht)\b/.test(t);
  const hasWin = /\b(gana|ganador|winner|win|ml|moneyline)\b/.test(t);
  const hasDraw = /\b(empate|draw|x)\b/.test(t);
  const hasHandicap = /\b(handicap|hcap|spread)\b/.test(t) || (line.sign && !hasCorners && !hasCards && !hasGoals && !hasBTTS);

  if (hasBTTS) {
    const isNo = /\b(no|not|false)\b/.test(t);
    const isYes = /\b(si|sí|yes)\b/.test(t) || !isNo;

    return {
      market: "Ambos anotan",
      marketType: "btts",
      direction: isNo ? "NO" : isYes ? "YES" : "",
      line: "",
      quality: "strong",
      needsClarification: false
    };
  }

  if (hasCorners) {
    return {
      market: hasGoals ? "Córners + goles" : "Córners",
      marketType: "corners",
      direction: hasUnder ? "UNDER" : "OVER",
      line: line.line || "+0.5",
      quality: "proxy",
      needsClarification: false
    };
  }

  if (hasCards) {
    return {
      market: "Tarjetas",
      marketType: "cards",
      direction: hasUnder ? "UNDER" : "OVER",
      line: line.line || "+0.5",
      quality: "proxy",
      needsClarification: false
    };
  }

  if (hasShotOnTarget || hasShot) {
    return {
      market: hasShotOnTarget ? "Jugador tiro a puerta" : "Jugador tiros",
      marketType: "player",
      direction: "OVER",
      line: line.line || "+0.5",
      quality: "proxy",
      needsClarification: false
    };
  }

  if (hasScore) {
    const scoreMatch = t.match(/\b(\d)\s*[-:]\s*(\d)\b/);
    return {
      market: "Marcador exacto",
      marketType: "exactScore",
      direction: "EXACT",
      line: scoreMatch ? `${scoreMatch[1]}-${scoreMatch[2]}` : line.line,
      quality: "strong",
      needsClarification: false
    };
  }

  if (hasClassifies) {
    return {
      market: "Clasifica / avanza",
      marketType: "qualifies",
      direction: "QUALIFIES",
      line: "",
      quality: "strong",
      needsClarification: false
    };
  }

  if (hasExtraTime) {
    return {
      market: "Prórroga / penales",
      marketType: "extraTime",
      direction: /\b(no|sin)\b/.test(t) ? "NO" : "YES",
      line: "",
      quality: "strong",
      needsClarification: false
    };
  }

  if (hasHalf) {
    return {
      market: "Descanso",
      marketType: "halftime",
      direction: hasDraw ? "DRAW" : hasWin ? "WIN" : "",
      line: "",
      quality: "strong",
      needsClarification: true,
      options: ["Empate al descanso", "Equipo gana al descanso", "Under 1.5 primer tiempo"]
    };
  }

  if (hasGoals || hasOver || hasUnder) {
    if (line.sign && !hasGoals && !hasOver && !hasUnder) {
      return {
        market: "Ambiguo",
        marketType: "ambiguous",
        direction: "",
        line: line.line,
        quality: "proxy",
        needsClarification: true,
        options: ["Handicap", "Goles", "Córners", "Tarjetas"]
      };
    }

    return {
      market: "Total goles",
      marketType: "goals",
      direction: hasUnder ? "UNDER" : "OVER",
      line: line.line || (hasUnder ? "-3.5" : "+1.5"),
      quality: "strong",
      needsClarification: false
    };
  }

  if (hasHandicap) {
    return {
      market: "Handicap / doble oportunidad",
      marketType: "handicap",
      direction: "HANDICAP",
      line: line.line || "+0.5",
      quality: "strong",
      needsClarification: false
    };
  }

  if (hasDraw) {
    return {
      market: "Empate",
      marketType: "draw",
      direction: "DRAW",
      line: "",
      quality: "strong",
      needsClarification: false
    };
  }

  if (hasWin) {
    return {
      market: "Ganador 90 minutos",
      marketType: "winner",
      direction: "WIN",
      line: "",
      quality: "strong",
      needsClarification: false
    };
  }

  if (line.line) {
    return {
      market: "Ambiguo",
      marketType: "ambiguous",
      direction: "",
      line: line.line,
      quality: "proxy",
      needsClarification: true,
      options: ["Handicap", "Goles", "Córners", "Tarjetas"]
    };
  }

  return {
    market: "No identificado",
    marketType: "unknown",
    direction: "",
    line: "",
    quality: "proxy",
    needsClarification: true,
    options: ["Ganador", "Goles", "Córners", "Tarjetas", "Jugador"]
  };
}

function detectPlayerName(text, teams) {
  const t = parserNormalize(text);
  if (!/\b(tiro|tiros|remate|remates|gol jugador|anota|shot)\b/.test(t)) return "";

  let clean = t
    .replace(/\b(tiro a puerta|tiros a puerta|remate a puerta|tiros|tiro|remates|remate|gol|anota|shot on target|shots|sot|over|under|mas de|menos de|\+\d+(?:\.\d+)?|\-\d+(?:\.\d+)?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  teams.forEach(team => {
    const names = [team, DISPLAY_NAMES[team]].filter(Boolean).map(parserNormalize);
    names.forEach(name => {
      clean = clean.replace(name, "").replace(/\s+/g, " ").trim();
    });
  });

  return clean.split(" ").filter(Boolean).slice(0, 3).join(" ");
}

function findEquivalentHeatPick(parsed, prediction) {
  if (!prediction || !parsed || !prediction.heatMap) return null;

  const typeMap = {
    winner: "winner",
    handicap: "doubleChance",
    goals: "goals",
    btts: "btts",
    corners: "corners",
    cards: "cards",
    exactScore: "exactScore",
    qualifies: "qualifies",
    extraTime: "extraTime",
    player: "player"
  };

  const targetType = typeMap[parsed.marketType];
  if (!targetType) return null;

  const direction = String(parsed.direction || "").toUpperCase();
  const line = String(parsed.line || "").replace("+", "").replace("-", "");

  return prediction.heatMap.find(pick => {
    if (pick.type !== targetType) return false;
    const pickDirection = String(pick.direction || "").toUpperCase();
    const pickLine = String(pick.line || "").replace("+", "").replace("-", "");

    if (direction && pickDirection && direction !== pickDirection) return false;
    if (line && pickLine && line !== pickLine) return false;
    return true;
  }) || prediction.heatMap.find(pick => pick.type === targetType) || null;
}

function parseManualPick(text, matches, selectedMatch = null, prediction = null) {
  const raw = String(text || "").trim();

  if (!raw) {
    return {
      raw,
      valid: false,
      confidence: "Nula",
      market: "",
      marketType: "unknown",
      normalizedPick: "",
      needsClarification: false,
      options: []
    };
  }

  const matchInfo = resolveMatchForManual(raw, matches, selectedMatch);
  const market = detectManualMarket(raw);
  const selectedTeams = matchInfo.teams;
  const player = detectPlayerName(raw, selectedTeams);

  let subject = "";
  if (player) subject = player;
  else if (selectedTeams.length) subject = selectedTeams[0];
  else if (matchInfo.match && ["winner", "handicap", "qualifies"].includes(market.marketType)) subject = matchInfo.match.favoriteHint || matchInfo.match.home;

  let normalizedPick = raw;

  if (market.marketType === "btts") normalizedPick = `Ambos anotan ${market.direction === "NO" ? "NO" : "SÍ"}`;
  else if (market.marketType === "goals") normalizedPick = `Total goles ${market.direction === "UNDER" ? "-" : "+"}${String(market.line || "").replace(/[+\-]/g, "")}`;
  else if (market.marketType === "corners") normalizedPick = `${subject ? `${subject} ` : "Total "}córners ${market.direction === "UNDER" ? "-" : "+"}${String(market.line || "").replace(/[+\-]/g, "")}`;
  else if (market.marketType === "cards") normalizedPick = `${subject ? `${subject} ` : "Total "}tarjetas ${market.direction === "UNDER" ? "-" : "+"}${String(market.line || "").replace(/[+\-]/g, "")}`;
  else if (market.marketType === "handicap") normalizedPick = `${subject || "Equipo"} handicap ${market.line || "+0.5"}`;
  else if (market.marketType === "winner") normalizedPick = `${subject || "Equipo"} gana en 90 min`;
  else if (market.marketType === "qualifies") normalizedPick = `${subject || "Equipo"} clasifica`;
  else if (market.marketType === "player") normalizedPick = `${player || "Jugador"} ${market.market} ${market.line || "+0.5"}`;
  else if (market.marketType === "exactScore") normalizedPick = `Marcador exacto ${market.line || ""}`.trim();

  const equivalent = findEquivalentHeatPick(market, prediction);
  const confidenceScore = market.needsClarification ? 45 : matchInfo.match ? 82 : 58;

  return {
    raw,
    valid: !market.needsClarification && market.marketType !== "unknown",
    match: matchInfo.match,
    teams: selectedTeams,
    subject,
    player,
    market: market.market,
    marketType: market.marketType,
    direction: market.direction,
    line: market.line,
    quality: market.quality,
    normalizedPick,
    needsClarification: market.needsClarification,
    options: market.options || [],
    confidence: confidenceScore >= 75 ? "Alta" : confidenceScore >= 55 ? "Media" : "Baja",
    equivalent
  };
}
