const PICK_TYPES = [
  { key: "safe", name: "Conservadores", emoji: "🛡️" },
  { key: "balanced", name: "Equilibrados", emoji: "⚖️" },
  { key: "aggressive", name: "Agresivos", emoji: "🔥" },
  { key: "score", name: "Marcadores", emoji: "🎯" },
  { key: "player", name: "Jugadores", emoji: "⚽" },
  { key: "corners", name: "Córners", emoji: "🚩" }
];

const BOOKS = ["Draftea", "Caliente", "Codere", "Bet365", "Betcris", "Otra"];

const UPCOMING_MATCHES = [
  { date: "2026-06-24", home: "Switzerland", away: "Canada" },
  { date: "2026-06-24", home: "Bosnia and Herzegovina", away: "Qatar" },
  { date: "2026-06-24", home: "Scotland", away: "Brazil" },
  { date: "2026-06-24", home: "Morocco", away: "Haiti" },
  { date: "2026-06-24", home: "Czech Republic", away: "Mexico" },
  { date: "2026-06-24", home: "South Africa", away: "South Korea" },

  { date: "2026-06-25", home: "Ecuador", away: "Germany" },
  { date: "2026-06-25", home: "Tunisia", away: "Netherlands" },
  { date: "2026-06-25", home: "Japan", away: "Sweden" },
  { date: "2026-06-25", home: "Turkey", away: "United States" },
  { date: "2026-06-25", home: "Paraguay", away: "Australia" },

  { date: "2026-06-26", home: "Norway", away: "France" },
  { date: "2026-06-26", home: "Senegal", away: "Iraq" },
  { date: "2026-06-26", home: "Uruguay", away: "Spain" },
  { date: "2026-06-26", home: "Cape Verde", away: "Saudi Arabia" },
  { date: "2026-06-26", home: "New Zealand", away: "Belgium" },
  { date: "2026-06-26", home: "Egypt", away: "Iran" },

  { date: "2026-06-27", home: "Panama", away: "England" },
  { date: "2026-06-27", home: "Croatia", away: "Ghana" },
  { date: "2026-06-27", home: "Colombia", away: "Portugal" },
  { date: "2026-06-27", home: "DR Congo", away: "Uzbekistan" },
  { date: "2026-06-27", home: "Jordan", away: "Argentina" },
  { date: "2026-06-27", home: "Algeria", away: "Austria" }
];

const DISPLAY_NAMES = {
  "Czech Republic": "Chequia",
  "United States": "Estados Unidos",
  "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "South Korea": "Corea del Sur",
  "Cape Verde": "Cabo Verde",
  "DR Congo": "RD Congo",
  "Saudi Arabia": "Arabia Saudí",
  "New Zealand": "Nueva Zelanda"
};

const DATE_LABELS = {
  "2026-06-24": "24 junio",
  "2026-06-25": "25 junio",
  "2026-06-26": "26 junio · Test ML",
  "2026-06-27": "27 junio"
};

const CONTEXT_FACTORS = {
  "2026-06-25-ecuador-germany": {
    volatilityBoost: 18,
    importance: "Partido de alta presión",
    notes: [
      "Ecuador podía llegar con urgencia competitiva.",
      "El contexto sube ritmo, tarjetas, córners y volatilidad.",
      "Cuidado con picks de goleada o marcador exacto."
    ],
    model: {
      homeUrgency: 0.05,
      openLateRisk: 0.08
    }
  },

  "2026-06-25-japan-sweden": {
    volatilityBoost: 10,
    importance: "Cruce parejo",
    notes: ["Partido con perfiles competitivos similares."],
    model: {
      drawBoost: 0.025
    }
  },

  "2026-06-25-paraguay-australia": {
    volatilityBoost: 12,
    importance: "Partido físico",
    notes: ["Puede ser cerrado y de mucho contacto."],
    model: {
      underBias: 0.035
    }
  },

  "2026-06-25-turkey-united-states": {
    volatilityBoost: 10,
    importance: "Partido de ritmo alto",
    notes: ["Riesgo de transiciones y partido abierto."],
    model: {
      openLateRisk: 0.08
    }
  },

  "2026-06-26-norway-france": {
    volatilityBoost: 16,
    importance: "Cierre de grupo con posible gestión de energía",
    notes: [
      "Partido de alto nivel: evitar lectura simple de favorito.",
      "El empate puede tener valor estratégico según tabla.",
      "Cuidado con jugadores si hay rotación o minutos limitados."
    ],
    model: {
      drawBoost: 0.055,
      favoriteRotationRisk: 0.045,
      underBias: 0.025
    }
  },

  "2026-06-26-senegal-iraq": {
    volatilityBoost: 12,
    importance: "Partido de necesidad, pero con baja claridad ofensiva",
    notes: [
      "Senegal puede cargar más el partido.",
      "Irak puede jugar más reactivo.",
      "Mejor priorizar mercados de gol simple o doble oportunidad."
    ],
    model: {
      motivationHome: 0.055,
      defensiveAway: 0.025,
      underBias: 0.02
    }
  },

  "2026-06-26-uruguay-spain": {
    volatilityBoost: 20,
    importance: "Uruguay con urgencia competitiva ante una España fuerte",
    notes: [
      "Partido emocional y de presión.",
      "Sube riesgo de córners, tarjetas y escenarios tardíos.",
      "Evitar marcador exacto o España gana fácil."
    ],
    model: {
      homeUrgency: 0.065,
      awayUrgency: 0.02,
      openLateRisk: 0.10,
      drawBoost: 0.018
    }
  },

  "2026-06-26-cape-verde-saudi-arabia": {
    volatilityBoost: 14,
    importance: "Partido de grupo con lectura sensible al primer gol",
    notes: [
      "Cabo Verde puede competir mejor de lo que indica el nombre.",
      "Arabia Saudí puede sufrir si el partido se vuelve físico.",
      "Mercados conservadores son mejores que resultado seco."
    ],
    model: {
      drawBoost: 0.03,
      openLateRisk: 0.045
    }
  },

  "2026-06-26-new-zealand-belgium": {
    volatilityBoost: 18,
    importance: "Bélgica obligada a reaccionar",
    notes: [
      "Bélgica tiene más calidad, pero llega con presión.",
      "Nueva Zelanda puede dejar espacios si necesita resultado.",
      "Mejor evitar parley largo si agregas este partido."
    ],
    model: {
      motivationAway: 0.075,
      openLateRisk: 0.085,
      favoriteRotationRisk: 0.02
    }
  },

  "2026-06-26-egypt-iran": {
    volatilityBoost: 15,
    importance: "Partido de clasificación con posible valor del empate",
    notes: [
      "Egipto puede priorizar control si el empate le sirve.",
      "Irán puede empujar más si necesita ganar.",
      "Cuidado con resultado directo; mejor mercados de baja exposición."
    ],
    model: {
      drawBoost: 0.05,
      underBias: 0.035,
      awayUrgency: 0.035
    }
  }
};

const DEFAULT_SETTINGS = {
  profile: "safe",
  maxParlay: 3,
  hideHighVolatility: true,
  showAggressive: true,
  initialBankroll: 1000,
  favoriteBook: "Draftea"
};

const SETTINGS_KEY = "matchiq_settings_v711";
const CART_KEY = "matchiq_cart_v711";
const TICKETS_KEY = "matchiq_tickets_v711";
const DRAFT_KEY = "matchiq_ticket_draft_v711";

let resultsData = [];
let currentMatches = [];
let selectedDate = "";
let selectedMatchId = "";
let activeTab = "home";
let predictionCache = new Map();

let settings = loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS);
let cart = loadJSON(CART_KEY, []);
let tickets = loadJSON(TICKETS_KEY, []);
let ticketDraft = loadJSON(DRAFT_KEY, {
  book: settings.favoriteBook || "Draftea",
  odds: "",
  stake: ""
});

const screens = {
  home: document.getElementById("homeScreen"),
  recommended: document.getElementById("recommendedScreen"),
  ticket: document.getElementById("ticketScreen"),
  history: document.getElementById("historyScreen"),
  profile: document.getElementById("profileScreen")
};

function loadJSON(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return saved ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function displayName(team) {
  return DISPLAY_NAMES[team] || team;
}

function displayPickText(text) {
  let output = text;

  Object.entries(DISPLAY_NAMES).forEach(([original, translated]) => {
    output = output.replaceAll(original, translated);
  });

  return output;
}

function matchName(match) {
  return `${displayName(match.home)} vs ${displayName(match.away)}`;
}

function createMatchId(match) {
  return `${match.date}-${match.home}-${match.away}`
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll(".", "")
    .replaceAll("'", "");
}

function normalizeKey(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  });
}

function formatPct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatOdds(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "—";
  return number.toFixed(2);
}

function formatFair(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "—";
  return `+${number.toFixed(2)}`;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getProfileRules() {
  if (settings.profile === "balanced") {
    return {
      label: "⚖️ Equilibrado",
      minProbability: 0.58,
      parlayTypes: ["safe", "balanced", "corners", "aggressive"],
      topTypes: ["safe", "balanced", "corners", "aggressive", "player"]
    };
  }

  if (settings.profile === "aggressive") {
    return {
      label: "🔥 Agresivo",
      minProbability: 0.42,
      parlayTypes: ["safe", "balanced", "corners", "aggressive", "player"],
      topTypes: ["safe", "balanced", "corners", "aggressive", "player", "score"]
    };
  }

  return {
    label: "🛡️ Seguro",
    minProbability: 0.70,
    parlayTypes: ["safe", "balanced", "corners"],
    topTypes: ["safe", "balanced", "corners"]
  };
}

function getContextForMatch(match) {
  return CONTEXT_FACTORS[match.id] || {
    volatilityBoost: 0,
    importance: "Contexto estándar",
    notes: ["Sin alerta contextual manual registrada."],
    model: {}
  };
}

function getVolatility(prediction, match) {
  const context = getContextForMatch(match);
  let score = 40;

  const favProb = prediction.favorite.prob;
  const totalGoals = prediction.homeLambda + prediction.awayLambda;
  const drawProb = prediction.rawProbs?.draw ?? prediction.probs.draw / 100;
  const bothScoreProb = prediction.bothScore / 100;

  if (favProb < 0.45) score += 28;
  else if (favProb < 0.56) score += 16;
  else if (favProb > 0.68) score -= 10;

  if (drawProb > 0.28) score += 8;
  if (totalGoals > 3.1) score += 12;
  if (bothScoreProb > 0.58) score += 10;
  if (prediction.under45 < 68) score += 8;

  score += context.volatilityBoost;
  score = clampNumber(score, 0, 100);

  if (score >= 70) return { score, label: "Alta", emoji: "🔴", context };
  if (score >= 45) return { score, label: "Media", emoji: "🟡", context };
  return { score, label: "Baja", emoji: "🟢", context };
}

function scoreProbability(score, prediction) {
  const [h, a] = score.split("-").map(Number);
  return poisson(h, prediction.homeLambda) * poisson(a, prediction.awayLambda);
}

function winToNilProbability(prediction) {
  let total = 0;

  for (let h = 0; h <= 7; h++) {
    for (let a = 0; a <= 7; a++) {
      const p = poisson(h, prediction.homeLambda) * poisson(a, prediction.awayLambda);
      if (prediction.favorite.side === "home" && h > a && a === 0) total += p;
      if (prediction.favorite.side === "away" && a > h && h === 0) total += p;
    }
  }

  return total;
}

function winAndUnder45Probability(prediction) {
  let total = 0;

  for (let h = 0; h <= 7; h++) {
    for (let a = 0; a <= 7; a++) {
      const p = poisson(h, prediction.homeLambda) * poisson(a, prediction.awayLambda);
      const favWins = prediction.favorite.side === "home" ? h > a : a > h;
      if (favWins && h + a <= 4) total += p;
    }
  }

  return total;
}

function getPickProbability(pick, prediction, match) {
  const volatility = getVolatility(prediction, match);

  let probability = 0.5;

  if (pick.marketKey && prediction.markets && typeof prediction.markets[pick.marketKey] === "number") {
    probability = prediction.markets[pick.marketKey];
  } else {
    const favGoalProb = 1 - poisson(0, prediction.favorite.lambda);

    if (pick.type === "safe") {
      probability = pick.text.includes("anota") ? favGoalProb : prediction.under45 / 100;
    }

    if (pick.type === "balanced") {
      probability = pick.text.includes("Doble oportunidad")
        ? prediction.favorite.prob + prediction.rawProbs.draw
        : prediction.favorite.prob;
    }

    if (pick.type === "aggressive") {
      probability = pick.text.includes("cero")
        ? winToNilProbability(prediction)
        : winAndUnder45Probability(prediction);
    }

    if (pick.type === "score") {
      probability = scoreProbability(prediction.score, prediction);
    }

    if (pick.type === "corners") {
      const cornerFav = prediction.favorite.side === "home"
        ? prediction.corners.home
        : prediction.corners.away;

      probability = cornerFav >= 5 ? 0.64 : 0.56;
    }

    if (pick.type === "player") {
      probability = 0.55 + (prediction.favorite.prob - 0.50) * 0.25;
    }
  }

  if (volatility.label === "Alta" && ["balanced", "aggressive", "score", "player"].includes(pick.type)) {
    probability *= 0.88;
  }

  if (pick.type === "player" && volatility.label !== "Baja") {
    probability *= 0.93;
  }

  return clampNumber(probability, 0.01, 0.99);
}

function confidenceLabel(probability) {
  if (probability >= 0.76) return "Alta";
  if (probability >= 0.58) return "Media";
  return "Baja";
}

function riskLabel(probability) {
  if (probability >= 0.76) return "Bajo";
  if (probability >= 0.58) return "Medio";
  return "Alto";
}

function safetyScore(item) {
  const typePenalty = {
    safe: 0,
    corners: 7,
    balanced: 10,
    aggressive: 22,
    player: 28,
    score: 44
  };

  return item.pick.probability * 100 - item.volatility.score * 0.35 - (typePenalty[item.pick.type] || 20);
}

function getPlayerSuggestions(favorite) {
  const players = {
    "Brazil": ["Vinícius Jr. 1+ tiro a puerta", "Rodrygo 1+ tiro", "Neymar participa en gol"],
    "Mexico": ["Santiago Giménez 1+ tiro a puerta", "Lozano 1+ tiro", "Alexis Vega 1+ tiro"],
    "France": ["Mbappé 1+ tiro a puerta", "Griezmann 1+ pase clave", "Dembélé 1+ tiro"],
    "Argentina": ["Messi participa en gol", "Lautaro 1+ tiro a puerta", "Julián Álvarez 1+ tiro"],
    "Portugal": ["Cristiano Ronaldo 1+ tiro a puerta", "Bruno Fernandes 1+ tiro", "Bernardo Silva 1+ pase clave"],
    "Spain": ["Morata 1+ tiro a puerta", "Yamal 1+ tiro", "Pedri 1+ pase clave"],
    "Germany": ["Musiala 1+ tiro", "Havertz 1+ tiro a puerta", "Wirtz 1+ pase clave"],
    "Netherlands": ["Gakpo 1+ tiro", "Depay 1+ tiro a puerta", "Xavi Simons 1+ tiro"],
    "Belgium": ["Lukaku 1+ tiro a puerta", "De Bruyne 1+ pase clave", "Doku 1+ tiro"],
    "Norway": ["Haaland 1+ tiro a puerta", "Ødegaard 1+ pase clave", "Haaland 2+ tiros"],
    "Uruguay": ["Darwin Núñez 1+ tiro a puerta", "Valverde 1+ tiro", "Pellistri 1+ tiro"],
    "Egypt": ["Salah 1+ tiro a puerta", "Trézéguet 1+ tiro", "Marmoush 1+ tiro"]
  };

  return players[favorite.team] || [
    `${displayName(favorite.team)} delantero 1+ tiro`,
    `${displayName(favorite.team)} mediapunta 1+ tiro`,
    `${displayName(favorite.team)} participa en gol`
  ];
}

function getFullPicks(prediction, match) {
  const basePicks = generatePicks(prediction);
  const players = getPlayerSuggestions(prediction.favorite);

  basePicks.push({
    type: "player",
    label: "Jugador",
    emoji: "⚽",
    text: players[0],
    marketKey: "playerShot"
  });

  const volatility = getVolatility(prediction, match);

  return basePicks.map(pick => {
    const probability = getPickProbability(pick, prediction, match);
    const fairOdds = 1 / probability;
    const valueOdds = 1.08 / probability;

    const item = {
      ...pick,
      text: displayPickText(pick.text),
      probability,
      fairOdds,
      valueOdds,
      confidence: confidenceLabel(probability),
      risk: riskLabel(probability),
      volatility
    };

    return {
      ...item,
      safetyScore: safetyScore({ pick: item, volatility })
    };
  });
}

function getMatchesByDate(date) {
  return currentMatches.filter(match => match.date === date);
}

function getPredictionForMatch(match) {
  if (!predictionCache.has(match.id)) {
    predictionCache.set(match.id, predictMatch(resultsData, match.home, match.away, getContextForMatch(match)));
  }

  return predictionCache.get(match.id);
}

function getCandidatesForDate(date) {
  const candidates = [];

  getMatchesByDate(date).forEach(match => {
    const prediction = getPredictionForMatch(match);
    const volatility = getVolatility(prediction, match);
    const picks = getFullPicks(prediction, match);

    picks.forEach(pick => {
      candidates.push({ match, prediction, volatility, pick });
    });
  });

  return candidates;
}

function getFilteredCandidates(date) {
  const rules = getProfileRules();

  return getCandidatesForDate(date)
    .filter(item => rules.topTypes.includes(item.pick.type))
    .filter(item => settings.showAggressive || !["aggressive", "player", "score"].includes(item.pick.type))
    .filter(item => item.pick.probability >= rules.minProbability)
    .filter(item => {
      if (!settings.hideHighVolatility) return true;
      return item.volatility.label !== "Alta";
    })
    .sort((a, b) => b.pick.safetyScore - a.pick.safetyScore);
}

function buildParlay(date) {
  const rules = getProfileRules();
  const usedMatches = new Set();

  const legs = getCandidatesForDate(date)
    .filter(item => rules.parlayTypes.includes(item.pick.type))
    .filter(item => settings.showAggressive || !["aggressive", "player", "score"].includes(item.pick.type))
    .filter(item => item.pick.probability >= rules.minProbability)
    .filter(item => {
      if (!settings.hideHighVolatility) return true;
      return item.volatility.label !== "Alta";
    })
    .sort((a, b) => b.pick.safetyScore - a.pick.safetyScore)
    .filter(item => {
      if (usedMatches.has(item.match.id)) return false;
      usedMatches.add(item.match.id);
      return true;
    })
    .slice(0, Number(settings.maxParlay));

  const combinedProbability = legs.reduce((acc, item) => acc * item.pick.probability, 1);
  const fairOdds = legs.length ? 1 / combinedProbability : 0;

  let risk = "Alto";
  if (combinedProbability >= 0.55) risk = "Bajo";
  else if (combinedProbability >= 0.35) risk = "Medio";

  return { legs, combinedProbability, fairOdds, risk };
}

function cartProbability() {
  return cart.reduce((acc, item) => acc * Number(item.probability || 0), 1);
}

function cartFairOdds() {
  const p = cartProbability();
  return p ? 1 / p : 0;
}

function cartPotentialReturn() {
  const odds = Number(ticketDraft.odds || 0);
  const stake = Number(ticketDraft.stake || 0);
  return odds * stake;
}

function cartProfit() {
  const stake = Number(ticketDraft.stake || 0);
  return cartPotentialReturn() - stake;
}

function saveSettings() {
  saveJSON(SETTINGS_KEY, settings);
}

function saveCart() {
  saveJSON(CART_KEY, cart);
  updateCartBadge();
}

function saveTickets() {
  saveJSON(TICKETS_KEY, tickets);
}

function saveDraft() {
  saveJSON(DRAFT_KEY, ticketDraft);
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (!badge) return;

  badge.textContent = cart.length;
  badge.style.display = cart.length > 0 ? "grid" : "none";
}

function showToast(message) {
  let toast = document.getElementById("appToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1450);
}

function makeCartItem(match, pick) {
  return {
    id: `${match.id}__${pick.type}__${normalizeKey(pick.text)}`,
    matchId: match.id,
    match: matchName(match),
    date: match.date,
    type: pick.type,
    typeLabel: pick.label,
    emoji: pick.emoji,
    text: pick.text,
    probability: pick.probability,
    fairOdds: pick.fairOdds,
    risk: pick.risk,
    volatility: pick.volatility.label
  };
}

function isPickInCart(match, pick) {
  const item = makeCartItem(match, pick);
  return cart.some(cartItem => cartItem.id === item.id);
}

function addToTicket(matchId, pickType) {
  const match = currentMatches.find(item => item.id === matchId);
  if (!match) return;

  const prediction = getPredictionForMatch(match);
  const picks = getFullPicks(prediction, match);
  const pick = picks.find(item => item.type === pickType);
  if (!pick) return;

  const item = makeCartItem(match, pick);
  const exists = cart.some(cartItem => cartItem.id === item.id);

  if (!exists) {
    cart.push(item);
    saveCart();
    showToast("✅ Agregado al ticket");
  } else {
    showToast("Ya está en el ticket");
  }

  renderAll();
}

function addParlayToTicket(date) {
  const parlay = buildParlay(date);
  let added = 0;

  parlay.legs.forEach(leg => {
    const item = makeCartItem(leg.match, leg.pick);
    const exists = cart.some(cartItem => cartItem.id === item.id);

    if (!exists) {
      cart.push(item);
      added++;
    }
  });

  saveCart();

  if (added > 0) {
    showToast(`✅ ${added} picks agregados`);
  } else {
    showToast("El parley ya está en ticket");
  }

  renderAll();
}

function removeFromTicket(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  showToast("Pick eliminado");
  renderAll();
}

function clearTicket() {
  const ok = confirm("Vas a quitar todos los picks del ticket actual. ¿Continuar?");
  if (!ok) return;

  cart = [];
  saveCart();
  showToast("Ticket vaciado");
  renderAll();
}

function updateDraft(key, value) {
  ticketDraft[key] = value;
  saveDraft();

  if (key === "odds" || key === "stake") {
    updateTicketLivePreview();
    return;
  }

  renderTicket();
}

function getTicketEvaluation() {
  if (!cart.length) {
    return {
      title: "Agrega picks para evaluar",
      text: "Tu entrada todavía está vacía.",
      className: "mid",
      risk: "Sin datos",
      suggestedStake: [0, 0]
    };
  }

  const probability = cartProbability();
  const odds = Number(ticketDraft.odds || 0);
  const implied = odds > 1 ? 1 / odds : 0;
  const edge = odds > 1 ? probability - implied : 0;

  const highVolatility = cart.filter(item => item.volatility === "Alta").length;
  const riskyTypes = cart.filter(item => ["aggressive", "score", "player"].includes(item.type)).length;

  let score = probability * 100;

  if (edge > 0) score += 10;
  if (edge < -0.05) score -= 12;
  if (cart.length >= 4) score -= 8;
  if (cart.length >= 5) score -= 14;
  if (highVolatility) score -= highVolatility * 10;
  if (riskyTypes) score -= riskyTypes * 6;

  score = clampNumber(score, 0, 100);

  let title = "🟡 Ticket aceptable";
  let text = "Tiene sentido, pero no lo sobreexpongas.";
  let className = "mid";
  let risk = "Medio";
  let stakePct = [0.015, 0.035];

  if (score >= 68) {
    title = "🟢 Ticket interesante";
    text = "Buena estructura para probar, especialmente si el momio real acompaña.";
    className = "good";
    risk = "Bajo/medio";
    stakePct = [0.025, 0.05];
  }

  if (score < 46) {
    title = "🔴 Ticket peligroso";
    text = "Demasiada volatilidad o probabilidad combinada baja. Considera quitar picks.";
    className = "bad";
    risk = "Alto";
    stakePct = [0.005, 0.015];
  }

  const bankroll = Number(settings.initialBankroll || 0);
  const suggestedStake = [
    Math.round(bankroll * stakePct[0]),
    Math.round(bankroll * stakePct[1])
  ];

  return {
    title,
    text,
    className,
    risk,
    score,
    suggestedStake
  };
}

function updateTicketLivePreview() {
  const probability = cartProbability();
  const fairOdds = cartFairOdds();
  const odds = Number(ticketDraft.odds || 0);
  const stake = Number(ticketDraft.stake || 0);

  const potentialReturn = odds * stake;
  const profit = potentialReturn - stake;
  const implied = odds > 1 ? 1 / odds : 0;
  const edge = odds > 1 ? probability - implied : 0;
  const evaluation = getTicketEvaluation();

  const summary = document.getElementById("ticketLiveSummary");
  const valueBox = document.getElementById("ticketLiveValue");
  const gradeBox = document.getElementById("ticketLiveGrade");

  if (!summary || !valueBox) return;

  summary.innerHTML = `
    <div><strong>${formatPct(probability)}</strong><span>Prob. IA</span></div>
    <div><strong>${formatFair(fairOdds)}</strong><span>Momio justo IA</span></div>
    <div><strong>${formatMoney(potentialReturn)}</strong><span>Retorno potencial</span></div>
    <div><strong>${formatMoney(profit)}</strong><span>Utilidad neta</span></div>
  `;

  valueBox.className = `value-result ${edge > 0 ? "good" : odds > 1 ? "bad" : ""}`;
  valueBox.innerHTML = `
    <strong>${odds > 1 && edge > 0 ? "🟢 Value positivo" : odds > 1 ? "🔴 Sin value" : "Escribe el momio"}</strong>
    <span>${odds > 1 ? `Casa: ${formatPct(implied)} · IA: ${formatPct(probability)} · Edge: ${formatPct(edge)}` : "Ingresa el momio para calcular value."}</span>
  `;

  if (gradeBox) {
    gradeBox.className = `ticket-grade ${evaluation.className}`;
    gradeBox.innerHTML = `
      <strong>${evaluation.title}</strong>
      <span>${evaluation.text} · Riesgo: ${evaluation.risk} · Stake sugerido: ${formatMoney(evaluation.suggestedStake[0])} - ${formatMoney(evaluation.suggestedStake[1])}</span>
    `;
  }
}

function saveCurrentTicket() {
  if (!cart.length) {
    alert("Agrega al menos un pick al ticket antes de guardarlo.");
    return;
  }

  const odds = Number(ticketDraft.odds);
  const stake = Number(ticketDraft.stake);

  if (!odds || odds <= 1) {
    alert("Ingresa un momio total válido.");
    return;
  }

  if (!stake || stake <= 0) {
    alert("Ingresa un importe válido.");
    return;
  }

  const probability = cartProbability();
  const implied = odds > 1 ? 1 / odds : 0;
  const edge = probability - implied;

  if (edge < 0) {
    const ok = confirm("Este ticket tiene value negativo según la IA. Puedes guardarlo, pero no parece una entrada fuerte. ¿Guardar de todos modos?");
    if (!ok) return;
  }

  const evaluation = getTicketEvaluation();

  const ticket = {
    id: `ticket_${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "pending",
    book: ticketDraft.book || settings.favoriteBook || "Draftea",
    odds,
    stake,
    selections: [...cart],
    combinedProbability: cartProbability(),
    fairOdds: cartFairOdds(),
    evaluation
  };

  tickets.unshift(ticket);
  cart = [];
  ticketDraft = {
    book: settings.favoriteBook || "Draftea",
    odds: "",
    stake: ""
  };

  saveTickets();
  saveCart();
  saveDraft();

  showToast("Ticket guardado");
  renderAll();
  switchTab("history");
}

function ticketProfit(ticket) {
  if (ticket.status === "win") return ticket.stake * ticket.odds - ticket.stake;
  if (ticket.status === "loss") return -ticket.stake;
  return 0;
}

function isSettled(ticket) {
  return ["win", "loss"].includes(ticket.status);
}

function settleTicket(id, status) {
  tickets = tickets.map(ticket => {
    if (ticket.id !== id) return ticket;

    return {
      ...ticket,
      status,
      settledAt: new Date().toISOString()
    };
  });

  saveTickets();
  showToast("Estado actualizado");
  renderAll();
}

function deleteTicket(id) {
  const ok = confirm("¿Eliminar este ticket del historial?");
  if (!ok) return;

  tickets = tickets.filter(ticket => ticket.id !== id);
  saveTickets();
  showToast("Ticket eliminado");
  renderAll();
}

function getBankrollStats() {
  const settled = tickets.filter(isSettled);
  const pending = tickets.filter(ticket => ticket.status === "pending");

  const totalStaked = settled.reduce((sum, ticket) => sum + ticket.stake, 0);
  const pendingStake = pending.reduce((sum, ticket) => sum + ticket.stake, 0);
  const netProfit = settled.reduce((sum, ticket) => sum + ticketProfit(ticket), 0);
  const bankroll = Number(settings.initialBankroll || 0) + netProfit;
  const roi = totalStaked ? netProfit / totalStaked : 0;

  const wins = tickets.filter(ticket => ticket.status === "win").length;
  const losses = tickets.filter(ticket => ticket.status === "loss").length;

  return {
    totalStaked,
    pendingStake,
    netProfit,
    bankroll,
    roi,
    wins,
    losses,
    pending: pending.length,
    total: tickets.length
  };
}

function updateHero(tab) {
  const hero = document.getElementById("appHero");
  const title = document.getElementById("heroTitle");
  const eyebrow = document.getElementById("heroEyebrow");
  const subtitle = document.getElementById("heroSubtitle");

  if (!hero || !title || !eyebrow || !subtitle) return;

  const titles = {
    home: {
      eyebrow: "IA Football Lab",
      title: "Hola, Sebas",
      subtitle: "Tu panel de predicciones, tickets y bankroll."
    },
    recommended: {
      eyebrow: "Recomendaciones",
      title: "Picks",
      subtitle: "Predicciones ordenadas por seguridad, contexto y volatilidad."
    },
    ticket: {
      eyebrow: "Ticket Builder",
      title: "Ticket",
      subtitle: "Arma tus entradas y mide value antes de guardar."
    },
    history: {
      eyebrow: "Bankroll",
      title: "Historial",
      subtitle: "Revisa tickets, utilidad, ROI y resultados."
    },
    profile: {
      eyebrow: "Ajustes",
      title: "Perfil",
      subtitle: "Configura tu bankroll, riesgo y casa favorita."
    }
  };

  const data = titles[tab] || titles.home;

  eyebrow.textContent = data.eyebrow;
  title.textContent = data.title;
  subtitle.textContent = data.subtitle;

  hero.classList.toggle("hero-compact", tab !== "home");
}

function switchTab(tab) {
  activeTab = tab;
  updateHero(tab);

  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle("active", key === tab);
  });

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle("active", button.getAttribute("onclick")?.includes(`'${tab}'`));
  });

  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  updateCartBadge();
  renderHome();
  renderRecommended();
  renderTicket();
  renderHistory();
  renderProfile();
}

function renderHome() {
  const stats = getBankrollStats();
  const candidates = getFilteredCandidates(selectedDate);
  const solid = candidates[0];
  const parlay = buildParlay(selectedDate);

  screens.home.innerHTML = `
    <section class="glass panel">
      <h2>Inicio</h2>
      <p class="note">Resumen de tu bankroll y recomendaciones principales.</p>

      <div class="home-stats">
        <div><strong>${formatMoney(stats.bankroll)}</strong><span>Bankroll actual</span></div>
        <div><strong>${formatPct(stats.roi)}</strong><span>ROI</span></div>
        <div><strong>${stats.wins}/${stats.losses}</strong><span>Tickets G/P</span></div>
        <div><strong>${stats.pending}</strong><span>Pendientes</span></div>
      </div>
    </section>

    <section class="glass panel">
      <h2>Pick más sólido</h2>
      ${
        solid ? `
          <button class="daily-card" onclick="selectMatchFromHome('${solid.match.id}')">
            <span>🧠 Ensemble ML v1.7.1</span>
            <strong>${solid.pick.text}</strong>
            <small>${matchName(solid.match)}</small>
            <em>IA ${formatPct(solid.pick.probability)} · Riesgo ${solid.pick.risk} · ${formatFair(solid.pick.fairOdds)}</em>
          </button>
        ` : `<p class="note">No hay pick que pase los filtros actuales.</p>`
      }
    </section>

    <section class="glass panel">
      <h2>Parley recomendado</h2>
      ${
        parlay.legs.length ? `
          <p class="note">Combinación sugerida según tu modo actual: <strong>${getProfileRules().label}</strong>.</p>
          ${parlay.legs.map((leg, index) => `
            <div class="mini-ticket-row">
              <div>
                <strong>${index + 1}. ${leg.pick.text}</strong>
                <span>${matchName(leg.match)} · IA ${formatPct(leg.pick.probability)}</span>
              </div>
            </div>
          `).join("")}
          <div class="ticket-summary">
            <div><strong>${formatPct(parlay.combinedProbability)}</strong><span>Prob.</span></div>
            <div><strong>${formatFair(parlay.fairOdds)}</strong><span>Momio justo</span></div>
            <div><strong>${parlay.risk}</strong><span>Riesgo</span></div>
            <div><strong>${parlay.legs.length}</strong><span>Picks</span></div>
          </div>
          <button class="primary-btn" onclick="addParlayToTicket('${selectedDate}')">Agregar parley al ticket</button>
          <p class="tiny-note">Ningún parley es seguro; úsalo como filtro de riesgo, no como garantía.</p>
        ` : `<p class="note">No hay suficientes picks para armar parley con tus filtros.</p>`
      }
    </section>
  `;
}

function renderRecommended() {
  const matches = getMatchesByDate(selectedDate);
  const match = currentMatches.find(item => item.id === selectedMatchId) || matches[0];

  if (!match) {
    screens.recommended.innerHTML = `
      <section class="glass panel">
        <h2>Recomendados</h2>
        <p class="note">No hay partidos cargados.</p>
      </section>
    `;
    return;
  }

  selectedMatchId = match.id;

  const prediction = getPredictionForMatch(match);
  const volatility = getVolatility(prediction, match);
  const picks = getFullPicks(prediction, match);
  const visiblePicks = picks.filter(pick => settings.showAggressive || !["aggressive", "player", "score"].includes(pick.type));
  const players = getPlayerSuggestions(prediction.favorite);

  screens.recommended.innerHTML = `
    <section class="glass panel">
      <h2>Recomendados</h2>

      <div class="select-grid">
        <div>
          <label>Fecha</label>
          <select onchange="changeDate(this.value)">
            ${[...new Set(currentMatches.map(item => item.date))].map(date => `
              <option value="${date}" ${date === selectedDate ? "selected" : ""}>${DATE_LABELS[date] || date}</option>
            `).join("")}
          </select>
        </div>

        <div>
          <label>Partido</label>
          <select onchange="changeMatch(this.value)">
            ${matches.map(item => `
              <option value="${item.id}" ${item.id === selectedMatchId ? "selected" : ""}>${matchName(item)}</option>
            `).join("")}
          </select>
        </div>
      </div>

      <label class="switch-row">
        <input type="checkbox" ${settings.hideHighVolatility ? "checked" : ""} onchange="updateSetting('hideHighVolatility', this.checked)" />
        Ocultar alta volatilidad
      </label>
    </section>

    <section class="glass panel">
      <h2>Sugerencia de la fecha</h2>
      <p class="note">Modo actual: <strong>${getProfileRules().label}</strong>.</p>

      <div class="top-picks-list">
        ${getFilteredCandidates(selectedDate).slice(0, 6).map((item, index) => `
          <button class="top-pick-row" onclick="selectMatchFromRecommended('${item.match.id}')">
            <div class="rank">${index + 1}</div>
            <div>
              <strong>${item.pick.emoji} ${item.pick.text}</strong>
              <span>${matchName(item.match)} · IA ${formatPct(item.pick.probability)} · Riesgo ${item.pick.risk}</span>
            </div>
            <em>${formatFair(item.pick.fairOdds)}</em>
          </button>
        `).join("") || `<p class="note">No hay picks que pasen tus filtros.</p>`}
      </div>

      <button class="primary-btn" onclick="addParlayToTicket('${selectedDate}')">Agregar parley recomendado</button>
    </section>

    <section class="glass card">
      <h2 class="match-title">${matchName(match)}</h2>
      <p class="note">Predicción con <strong>${prediction.modelLabel}</strong>. Favorito estadístico: <strong>${displayName(prediction.favorite.team)}</strong>.</p>

      <div class="prob-grid">
        <div class="prob"><strong>${prediction.probs.home}%</strong><span>${displayName(match.home)}</span></div>
        <div class="prob"><strong>${prediction.probs.draw}%</strong><span>Empate</span></div>
        <div class="prob"><strong>${prediction.probs.away}%</strong><span>${displayName(match.away)}</span></div>
      </div>

      ${renderModelPanel(prediction)}

      <div class="volatility-box">
        <strong>${volatility.emoji} Volatilidad ${volatility.label}</strong>
        <span>${volatility.context.importance}</span>
        ${volatility.context.notes.map(note => `<small>${note}</small>`).join("")}
      </div>

      <div class="insight-grid">
        <div class="insight-card">
          <span>🎯 Marcador IA</span>
          <strong>${prediction.score}</strong>
        </div>

        <div class="insight-card">
          <span>🚩 Córners esperados</span>
          <strong>${displayName(match.home)} ${prediction.corners.home} / ${displayName(match.away)} ${prediction.corners.away}</strong>
        </div>

        <div class="insight-card">
          <span>📉 Menos de 4.5 goles</span>
          <strong>${prediction.under45}%</strong>
        </div>

        <div class="insight-card">
          <span>⚽ Ambos anotan</span>
          <strong>${prediction.bothScore}%</strong>
        </div>

        <div class="insight-card full">
          <span>⚽ Jugadores sugeridos</span>
          <strong>${players.join(" · ")}</strong>
        </div>
      </div>

      ${renderHeatmap(prediction)}

      ${visiblePicks.map(pick => {
        const inTicket = isPickInCart(match, pick);

        return `
          <div class="pick ${pick.type}">
            <div class="pick-title">${pick.emoji} ${pick.label}</div>
            <strong>${pick.text}</strong>
            <p class="pick-meta">IA ${formatPct(pick.probability)} · Riesgo ${pick.risk} · Momio justo ${formatFair(pick.fairOdds)}</p>

            <button class="primary-btn ${inTicket ? "in-ticket" : ""}" ${inTicket ? "disabled" : ""} onclick="addToTicket('${match.id}', '${pick.type}')">
              ${inTicket ? "✅ En ticket" : "Agregar al ticket"}
            </button>
          </div>
        `;
      }).join("")}

      <p class="tiny-note">La IA ayuda a filtrar riesgo, pero ningún pick es seguro.</p>
    </section>
  `;
}

function renderModelPanel(prediction) {
  const favoriteSide = prediction.favorite.side;

  const labels = {
    poisson: "Poisson",
    elo: "Elo",
    form: "Forma",
    logistic: "Logística",
    monteCarlo: "Monte Carlo"
  };

  return `
    <div class="model-box">
      <strong>🧠 Modelo ensemble</strong>
      <span>Confianza ${prediction.confidence.label} · ${prediction.confidence.score}/100</span>
      <small>Combina goles esperados, Elo, forma reciente, simulación Monte Carlo y contexto del partido.</small>

      <div class="model-bars">
        ${Object.entries(prediction.models).map(([key, model]) => {
          const value = model[favoriteSide] || 0;

          return `
            <div class="model-bar">
              <span>${labels[key] || key}</span>
              <div class="model-track">
                <div class="model-fill" style="--w:${Math.round(value * 100)}%"></div>
              </div>
              <strong>${formatPct(value)}</strong>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderHeatmap(prediction) {
  const maxGoals = 4;
  const cells = [];

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const probability = poisson(h, prediction.homeLambda) * poisson(a, prediction.awayLambda);
      cells.push({ h, a, probability, score: `${h}-${a}` });
    }
  }

  const maxProb = Math.max(...cells.map(cell => cell.probability));

  return `
    <div class="heatmap-box">
      <span>🔥 Heatmap de marcador</span>
      <p class="note">Más brillante = marcador más probable.</p>

      <div class="heatmap-labels">
        <div></div>
        <small>0</small><small>1</small><small>2</small><small>3</small><small>4</small>
      </div>

      <div class="heatmap-grid">
        ${[0, 1, 2, 3, 4].map(h => `
          <div class="row-label">${h}</div>
          ${[0, 1, 2, 3, 4].map(a => {
            const cell = cells.find(item => item.h === h && item.a === a);
            const heat = maxProb ? Math.max(0.12, cell.probability / maxProb).toFixed(2) : 0.12;

            return `
              <div class="heat-cell" style="--heat:${heat}">
                <strong>${cell.score}</strong>
                <small>${Math.round(cell.probability * 100)}%</small>
              </div>
            `;
          }).join("")}
        `).join("")}
      </div>
    </div>
  `;
}

function renderTicket() {
  const probability = cartProbability();
  const fairOdds = cartFairOdds();
  const odds = Number(ticketDraft.odds || 0);
  const implied = odds > 1 ? 1 / odds : 0;
  const edge = odds > 1 ? probability - implied : 0;
  const evaluation = getTicketEvaluation();

  const valueStatus = odds > 1 && edge > 0 ? "🟢 Value positivo" : odds > 1 ? "🔴 Sin value" : "Escribe el momio";

  screens.ticket.innerHTML = `
    <section class="glass panel">
      <h2>Ticket actual</h2>
      <p class="note">Agrega picks desde Recomendados y luego escribe el momio real de la casa.</p>

      ${
        cart.length ? cart.map(item => `
          <div class="cart-item">
            <div>
              <strong>${item.emoji} ${item.text}</strong>
              <span>${item.match} · IA ${formatPct(item.probability)} · Riesgo ${item.risk}</span>
            </div>
            <button onclick="removeFromTicket('${item.id}')">✕</button>
          </div>
        `).join("") : `<p class="note">Tu ticket está vacío. Ve a Picks y agrega selecciones para construir tu entrada.</p>`
      }

      ${cart.length ? `<button class="ghost" onclick="clearTicket()">Vaciar ticket</button>` : ""}
    </section>

    <section class="glass panel">
      <h2>Datos del ticket</h2>

      <label>Casa de apuesta</label>
      <select onchange="updateDraft('book', this.value)">
        ${BOOKS.map(book => `
          <option value="${book}" ${ticketDraft.book === book ? "selected" : ""}>${book}</option>
        `).join("")}
      </select>

      <label>Momio total de la casa</label>
      <input type="number" step="0.01" min="1.01" placeholder="Ejemplo: 2.35" value="${ticketDraft.odds}" oninput="updateDraft('odds', this.value)" />

      <label>Importe apostado</label>
      <input type="number" step="1" min="1" placeholder="Ejemplo: 500" value="${ticketDraft.stake}" oninput="updateDraft('stake', this.value)" />

      <div id="ticketLiveSummary" class="ticket-summary">
        <div><strong>${formatPct(probability)}</strong><span>Prob. IA</span></div>
        <div><strong>${formatFair(fairOdds)}</strong><span>Momio justo IA</span></div>
        <div><strong>${formatMoney(cartPotentialReturn())}</strong><span>Retorno potencial</span></div>
        <div><strong>${formatMoney(cartProfit())}</strong><span>Utilidad neta</span></div>
      </div>

      <div id="ticketLiveValue" class="value-result ${edge > 0 ? "good" : odds > 1 ? "bad" : ""}">
        <strong>${valueStatus}</strong>
        <span>${odds > 1 ? `Casa: ${formatPct(implied)} · IA: ${formatPct(probability)} · Edge: ${formatPct(edge)}` : "Ingresa el momio para calcular value."}</span>
      </div>

      <div id="ticketLiveGrade" class="ticket-grade ${evaluation.className}">
        <strong>${evaluation.title}</strong>
        <span>${evaluation.text} · Riesgo: ${evaluation.risk} · Stake sugerido: ${formatMoney(evaluation.suggestedStake[0])} - ${formatMoney(evaluation.suggestedStake[1])}</span>
      </div>

      <button class="primary-btn ${cart.length ? "" : "disabled"}" ${cart.length ? "" : "disabled"} onclick="saveCurrentTicket()">
        ${cart.length ? "Guardar ticket" : "Agrega picks para guardar"}
      </button>

      <p class="tiny-note">La IA ayuda a filtrar riesgo, pero ningún pick ni parley es seguro.</p>
    </section>
  `;
}

function renderHistory() {
  const stats = getBankrollStats();

  screens.history.innerHTML = `
    <section class="glass panel">
      <h2>Historial</h2>

      <div class="home-stats">
        <div><strong>${formatMoney(stats.totalStaked)}</strong><span>Apostado</span></div>
        <div><strong>${formatMoney(stats.netProfit)}</strong><span>Utilidad</span></div>
        <div><strong>${formatPct(stats.roi)}</strong><span>ROI</span></div>
        <div><strong>${formatMoney(stats.pendingStake)}</strong><span>Pendiente</span></div>
      </div>
    </section>

    <section class="glass panel">
      <h2>Tickets</h2>

      ${
        tickets.length ? tickets.map(ticket => `
          <div class="ticket-card ticket-${ticket.status}">
            <div class="ticket-head">
              <strong>${ticket.book} · +${formatOdds(ticket.odds)}</strong>
              <span>${statusLabel(ticket.status)}</span>
            </div>

            <p class="note">${new Date(ticket.createdAt).toLocaleDateString("es-MX")} · ${formatMoney(ticket.stake)} apostados · ${ticket.selections.length} picks</p>

            ${ticket.selections.map(sel => `
              <div class="ticket-selection">
                <div>
                  <strong>${sel.text}</strong>
                  <span>${sel.match} · IA ${formatPct(sel.probability)}</span>
                </div>
              </div>
            `).join("")}

            <div class="ticket-summary">
              <div><strong>${formatPct(ticket.combinedProbability)}</strong><span>Prob. IA</span></div>
              <div><strong>${formatFair(ticket.fairOdds)}</strong><span>Justo IA</span></div>
              <div><strong>${formatMoney(ticketProfit(ticket))}</strong><span>Utilidad</span></div>
              <div><strong>${statusLabel(ticket.status)}</strong><span>Estado</span></div>
            </div>

            <div class="ticket-actions">
              <button class="win" onclick="settleTicket('${ticket.id}', 'win')">✅ Ganado</button>
              <button class="lose" onclick="settleTicket('${ticket.id}', 'loss')">❌ Perdido</button>
              <button class="ghost-small" onclick="settleTicket('${ticket.id}', 'void')">🚫 Anulado</button>
              <button class="ghost-small" onclick="settleTicket('${ticket.id}', 'pending')">⏳ Pendiente</button>
              <button class="ghost-small" onclick="deleteTicket('${ticket.id}')">🗑️</button>
            </div>
          </div>
        `).join("") : `<p class="note">Aún no has guardado tickets.</p>`
      }
    </section>
  `;
}

function statusLabel(status) {
  if (status === "win") return "✅ Ganado";
  if (status === "loss") return "❌ Perdido";
  if (status === "void") return "🚫 Anulado";
  return "⏳ Pendiente";
}

function renderProfile() {
  screens.profile.innerHTML = `
    <section class="glass panel">
      <h2>Perfil</h2>
      <p class="note">Ajusta tu bankroll, riesgo y casa favorita para que las recomendaciones se adapten a ti.</p>

      <label>Bankroll inicial</label>
      <input type="number" min="0" step="1" value="${settings.initialBankroll}" oninput="updateSetting('initialBankroll', Number(this.value))" />

      <label>Casa favorita</label>
      <select onchange="updateSetting('favoriteBook', this.value)">
        ${BOOKS.map(book => `
          <option value="${book}" ${settings.favoriteBook === book ? "selected" : ""}>${book}</option>
        `).join("")}
      </select>

      <label>Perfil de riesgo</label>
      <select onchange="updateSetting('profile', this.value)">
        <option value="safe" ${settings.profile === "safe" ? "selected" : ""}>🛡️ Seguro</option>
        <option value="balanced" ${settings.profile === "balanced" ? "selected" : ""}>⚖️ Equilibrado</option>
        <option value="aggressive" ${settings.profile === "aggressive" ? "selected" : ""}>🔥 Agresivo</option>
      </select>

      <label>Máximo picks en parley</label>
      <select onchange="updateSetting('maxParlay', Number(this.value))">
        <option value="2" ${Number(settings.maxParlay) === 2 ? "selected" : ""}>2 picks</option>
        <option value="3" ${Number(settings.maxParlay) === 3 ? "selected" : ""}>3 picks</option>
        <option value="4" ${Number(settings.maxParlay) === 4 ? "selected" : ""}>4 picks</option>
        <option value="5" ${Number(settings.maxParlay) === 5 ? "selected" : ""}>5 picks</option>
      </select>

      <label class="switch-row">
        <input type="checkbox" ${settings.hideHighVolatility ? "checked" : ""} onchange="updateSetting('hideHighVolatility', this.checked)" />
        Ocultar partidos de alta volatilidad
      </label>

      <label class="switch-row">
        <input type="checkbox" ${settings.showAggressive ? "checked" : ""} onchange="updateSetting('showAggressive', this.checked)" />
        Mostrar agresivos interesantes
      </label>
    </section>

    <section class="glass panel">
      <h2>Zona de cuidado</h2>
      <button class="ghost" onclick="clearAllTickets()">Borrar tickets e historial</button>
    </section>
  `;
}

function updateSetting(key, value) {
  settings[key] = value;

  if (key === "favoriteBook") {
    ticketDraft.book = value;
    saveDraft();
  }

  saveSettings();

  if (key === "initialBankroll") {
    return;
  }

  renderAll();
}

function clearAllTickets() {
  const ok = confirm("Esto borrará todos tus tickets e historial. ¿Seguro?");
  if (!ok) return;

  tickets = [];
  cart = [];
  saveTickets();
  saveCart();
  showToast("Historial borrado");
  renderAll();
}

function changeDate(date) {
  selectedDate = date;
  const first = getMatchesByDate(selectedDate)[0];
  selectedMatchId = first ? first.id : "";
  renderAll();
}

function changeMatch(id) {
  selectedMatchId = id;
  renderAll();
}

function selectMatchFromRecommended(id) {
  selectedMatchId = id;
  renderAll();
}

function selectMatchFromHome(id) {
  selectedMatchId = id;
  const match = currentMatches.find(item => item.id === id);
  if (match) selectedDate = match.date;
  switchTab("recommended");
}

async function init() {
  Object.values(screens).forEach(screen => {
    screen.innerHTML = `
      <section class="glass panel">
        <h2>Cargando...</h2>
        <p class="note">Conectando con datos y preparando modelo ensemble.</p>
      </section>
    `;
  });

  try {
    resultsData = await loadResults();

    currentMatches = UPCOMING_MATCHES.map(match => ({
      ...match,
      id: createMatchId(match)
    }));

    predictionCache = new Map();

    const dates = [...new Set(currentMatches.map(match => match.date))];
    const today = new Date().toISOString().slice(0, 10);

    selectedDate = dates.includes(today) ? today : "2026-06-26";
    selectedMatchId = getMatchesByDate(selectedDate)[0]?.id || "";

    updateHero("home");
    updateCartBadge();
    renderAll();
  } catch (error) {
    screens.home.innerHTML = `
      <section class="glass panel">
        <h2>Error al cargar datos</h2>
        <p class="note">No se pudo cargar el CSV original. Revisa conexión o scripts.</p>
      </section>
    `;
    console.error(error);
  }
}

init();
