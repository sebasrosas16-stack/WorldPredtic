const APP_VERSION = "1.9.1";

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
  "2026-06-26": "26 junio",
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
    model: { homeUrgency: 0.05, openLateRisk: 0.08 }
  },
  "2026-06-25-japan-sweden": {
    volatilityBoost: 10,
    importance: "Cruce parejo",
    notes: ["Partido con perfiles competitivos similares."],
    model: { drawBoost: 0.025 }
  },
  "2026-06-25-paraguay-australia": {
    volatilityBoost: 12,
    importance: "Partido físico",
    notes: ["Puede ser cerrado y de mucho contacto."],
    model: { underBias: 0.035 }
  },
  "2026-06-25-turkey-united-states": {
    volatilityBoost: 10,
    importance: "Partido de ritmo alto",
    notes: ["Riesgo de transiciones y partido abierto."],
    model: { openLateRisk: 0.08 }
  },
  "2026-06-26-norway-france": {
    volatilityBoost: 16,
    importance: "Cierre de grupo con posible gestión de energía",
    notes: [
      "Partido de alto nivel: evitar lectura simple de favorito.",
      "El empate puede tener valor estratégico según tabla.",
      "Cuidado con jugadores si hay rotación o minutos limitados."
    ],
    model: { drawBoost: 0.055, favoriteRotationRisk: 0.045, underBias: 0.025 }
  },
  "2026-06-26-senegal-iraq": {
    volatilityBoost: 12,
    importance: "Partido de necesidad, pero con baja claridad ofensiva",
    notes: [
      "Senegal puede cargar más el partido.",
      "Irak puede jugar más reactivo.",
      "Mejor priorizar mercados de gol simple o doble oportunidad."
    ],
    model: { motivationHome: 0.055, defensiveAway: 0.025, underBias: 0.02 }
  },
  "2026-06-26-uruguay-spain": {
    volatilityBoost: 20,
    importance: "Uruguay con urgencia competitiva ante una España fuerte",
    notes: [
      "Partido emocional y de presión.",
      "Sube riesgo de córners, tarjetas y escenarios tardíos.",
      "Evitar marcador exacto o España gana fácil."
    ],
    model: { homeUrgency: 0.065, awayUrgency: 0.02, openLateRisk: 0.10, drawBoost: 0.018 }
  },
  "2026-06-26-cape-verde-saudi-arabia": {
    volatilityBoost: 14,
    importance: "Partido de grupo con lectura sensible al primer gol",
    notes: [
      "Cabo Verde puede competir mejor de lo que indica el nombre.",
      "Arabia Saudí puede sufrir si el partido se vuelve físico.",
      "Mercados conservadores son mejores que resultado seco."
    ],
    model: { drawBoost: 0.03, openLateRisk: 0.045 }
  },
  "2026-06-26-new-zealand-belgium": {
    volatilityBoost: 18,
    importance: "Bélgica obligada a reaccionar",
    notes: [
      "Bélgica tiene más calidad, pero llega con presión.",
      "Nueva Zelanda puede dejar espacios si necesita resultado.",
      "Mejor evitar parley largo si agregas este partido."
    ],
    model: { motivationAway: 0.075, openLateRisk: 0.085, favoriteRotationRisk: 0.02 }
  },
  "2026-06-26-egypt-iran": {
    volatilityBoost: 15,
    importance: "Partido de clasificación con posible valor del empate",
    notes: [
      "Egipto puede priorizar control si el empate le sirve.",
      "Irán puede empujar más si necesita ganar.",
      "Cuidado con resultado directo; mejor mercados de baja exposición."
    ],
    model: { drawBoost: 0.05, underBias: 0.035, awayUrgency: 0.035 }
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

const STORAGE_KEYS = {
  settings: "matchiq_settings_master",
  cart: "matchiq_cart_master",
  tickets: "matchiq_tickets_master",
  draft: "matchiq_ticket_draft_master",
  migration: "matchiq_migration_v191_done"
};

const LEGACY_KEYS = {
  settings: ["matchiq_settings_v7", "matchiq_settings_v711"],
  cart: ["matchiq_cart_v7", "matchiq_cart_v711"],
  tickets: ["matchiq_tickets_v7", "matchiq_tickets_v711"],
  draft: ["matchiq_ticket_draft_v7", "matchiq_ticket_draft_v711"]
};

let resultsData = [];
let currentMatches = [];
let selectedDate = "";
let selectedMatchId = "";
let activeTab = "home";
let historyFilter = "all";
let predictionCache = new Map();

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

function uniqueById(items) {
  const map = new Map();

  items.forEach(item => {
    if (!item) return;
    const key = item.id || `${item.createdAt || ""}-${item.book || ""}-${item.odds || ""}-${item.stake || ""}-${JSON.stringify(item.selections || [])}`;
    if (!map.has(key)) map.set(key, item);
  });

  return [...map.values()];
}

function migrateStorage() {
  if (localStorage.getItem(STORAGE_KEYS.migration)) return;

  const oldSettings = LEGACY_KEYS.settings
    .map(key => loadJSON(key, null))
    .filter(Boolean);

  const masterSettings = loadJSON(STORAGE_KEYS.settings, null);

  if (!masterSettings && oldSettings.length) {
    saveJSON(STORAGE_KEYS.settings, {
      ...DEFAULT_SETTINGS,
      ...oldSettings[0]
    });
  }

  const allTickets = [
    ...loadJSON(STORAGE_KEYS.tickets, []),
    ...LEGACY_KEYS.tickets.flatMap(key => loadJSON(key, []))
  ];

  if (allTickets.length) {
    saveJSON(STORAGE_KEYS.tickets, uniqueById(allTickets));
  }

  const allCart = [
    ...loadJSON(STORAGE_KEYS.cart, []),
    ...LEGACY_KEYS.cart.flatMap(key => loadJSON(key, []))
  ];

  if (allCart.length) {
    saveJSON(STORAGE_KEYS.cart, uniqueById(allCart));
  }

  const masterDraft = loadJSON(STORAGE_KEYS.draft, null);
  const oldDraft = LEGACY_KEYS.draft
    .map(key => loadJSON(key, null))
    .filter(Boolean)[0];

  if (!masterDraft && oldDraft) {
    saveJSON(STORAGE_KEYS.draft, oldDraft);
  }

  localStorage.setItem(STORAGE_KEYS.migration, "true");
}

migrateStorage();

let settings = {
  ...DEFAULT_SETTINGS,
  ...loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
};

let cart = loadJSON(STORAGE_KEYS.cart, []);
let tickets = loadJSON(STORAGE_KEYS.tickets, []);
let ticketDraft = loadJSON(STORAGE_KEYS.draft, {
  book: settings.favoriteBook || "Draftea",
  odds: "",
  stake: "",
  manualMatch: "",
  manualPick: "",
  manualMarket: "Goles",
  manualLine: "+0.5",
  manualQuality: "proxy",
  manualProbability: ""
});

const screens = {
  home: document.getElementById("homeScreen"),
  recommended: document.getElementById("recommendedScreen"),
  ticket: document.getElementById("ticketScreen"),
  history: document.getElementById("historyScreen"),
  profile: document.getElementById("profileScreen")
};

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayName(team) {
  return DISPLAY_NAMES[team] || team;
}

function displayPickText(text) {
  let output = text || "";

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
  return String(text || "")
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

function qualityLabel(value) {
  if (value === "proxy") return "⚠️ Proxy";
  return "🧠 Modelo fuerte";
}

function qualityClass(value) {
  return value === "proxy" ? "proxy" : "strong";
}

function marketBucket(selection) {
  const type = selection.type || "";
  const market = String(selection.market || selection.typeLabel || "").toLowerCase();

  if (type === "safe" || market.includes("goles")) return "Goles";
  if (type === "balanced" || market.includes("handicap")) return "Handicap";
  if (type === "corners") return "Córners";
  if (type === "cards") return "Tarjetas";
  if (type === "player") return "Jugadores";
  if (type === "score") return "Marcador";
  if (type === "aggressive" || market.includes("combo")) return "Combo";
  if (type === "manual") return selection.market || "Manual";

  return selection.typeLabel || type || "Otro";
}

function getProfileRules() {
  if (settings.profile === "balanced") {
    return {
      label: "⚖️ Equilibrado",
      minProbability: 0.55,
      parlayTypes: ["safe", "balanced", "corners", "cards", "aggressive"],
      topTypes: ["safe", "balanced", "corners", "cards", "aggressive", "player"]
    };
  }

  if (settings.profile === "aggressive") {
    return {
      label: "🔥 Agresivo",
      minProbability: 0.34,
      parlayTypes: ["safe", "balanced", "corners", "cards", "aggressive", "player"],
      topTypes: ["safe", "balanced", "corners", "cards", "aggressive", "player", "score"]
    };
  }

  return {
    label: "🛡️ Seguro",
    minProbability: 0.66,
    parlayTypes: ["safe", "balanced", "corners"],
    topTypes: ["safe", "balanced", "corners", "cards"]
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
  if (prediction.brokenRisk > 0.55) score += 10;

  score += context.volatilityBoost;
  score = clampNumber(score, 0, 100);

  if (score >= 70) return { score, label: "Alta", emoji: "🔴", context };
  if (score >= 45) return { score, label: "Media", emoji: "🟡", context };
  return { score, label: "Baja", emoji: "🟢", context };
}

function getPickProbability(pick, prediction, match) {
  if (pick.noBet) return 0;

  const volatility = getVolatility(prediction, match);
  let probability = 0.5;

  if (pick.marketKey && prediction.markets && typeof prediction.markets[pick.marketKey] === "number") {
    probability = prediction.markets[pick.marketKey];
  } else {
    if (pick.type === "player") probability = 0.54 + (prediction.favorite.prob - 0.50) * 0.25;
    if (pick.type === "score") probability = prediction.markets.topScore || 0.08;
  }

  if (volatility.label === "Alta" && ["balanced", "aggressive", "score", "player", "cards"].includes(pick.type)) {
    probability *= 0.88;
  }

  if (pick.dataQuality === "proxy") probability *= 0.96;
  if (pick.type === "player" && volatility.label !== "Baja") probability *= 0.92;

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

function getPickClarity(pick, volatility) {
  if (pick.noBet) {
    return {
      className: "nobet",
      label: "⛔ NO BET",
      score: 0,
      note: "No hay ventaja clara para entrar a este mercado."
    };
  }

  let score = pick.probability * 100;

  if (pick.dataQuality === "proxy") score -= 9;
  if (volatility.label === "Alta") score -= 10;
  if (pick.type === "score") score -= 30;
  if (pick.type === "player") score -= 12;
  if (pick.type === "aggressive") score -= 8;

  if (score >= 66) {
    return {
      className: "good",
      label: "🟢 Claro",
      score,
      note: "Tiene señal suficiente para considerarlo."
    };
  }

  if (score < 44) {
    return {
      className: "bad",
      label: "🔴 Evitar",
      score,
      note: "No tiene señal suficiente o depende de demasiada varianza."
    };
  }

  return {
    className: "mid",
    label: "🟡 Dudoso",
    score,
    note: "Puede servir como complemento, no como pick principal."
  };
}

function rankScore(item) {
  if (item.pick.noBet) return -999;

  const p = item.pick.probability;
  const odds = item.pick.fairOdds;
  const volatility = item.volatility.score;
  const proxyPenalty = item.pick.dataQuality === "proxy" ? 8 : 0;
  const clarityBonus = item.pick.clarityClass === "good" ? 10 : item.pick.clarityClass === "mid" ? 2 : -18;

  const typeSafePenalty = {
    safe: 0,
    balanced: 8,
    corners: 12,
    cards: 16,
    aggressive: 24,
    player: 32,
    score: 48
  };

  const typeAggressiveBoost = {
    safe: -5,
    balanced: 2,
    corners: 9,
    cards: 10,
    aggressive: 18,
    player: 13,
    score: 8
  };

  if (settings.profile === "aggressive") {
    return p * 58 + odds * 15 + (typeAggressiveBoost[item.pick.type] || 0) + clarityBonus - volatility * 0.14 - proxyPenalty * 0.45;
  }

  if (settings.profile === "balanced") {
    return p * 76 + odds * 7 + clarityBonus - volatility * 0.25 - proxyPenalty - ((typeSafePenalty[item.pick.type] || 10) * 0.45);
  }

  return p * 100 + clarityBonus - volatility * 0.38 - proxyPenalty - (typeSafePenalty[item.pick.type] || 10);
}

function getPlayerSuggestions(favorite) {
  const players = {
    "Brazil": ["Vinícius Jr. tiros a puerta +0.5", "Rodrygo tiros +0.5", "Neymar participa en gol"],
    "Mexico": ["Santiago Giménez tiros a puerta +0.5", "Lozano tiros +0.5", "Alexis Vega tiros +0.5"],
    "France": ["Mbappé tiros a puerta +0.5", "Griezmann pases clave +0.5", "Dembélé tiros +0.5"],
    "Argentina": ["Messi tiros a puerta +0.5", "Lautaro tiros a puerta +0.5", "Julián Álvarez tiros +0.5"],
    "Portugal": ["Cristiano Ronaldo tiros a puerta +0.5", "Bruno Fernandes tiros +0.5", "Bernardo Silva pases clave +0.5"],
    "Spain": ["Morata tiros a puerta +0.5", "Yamal tiros +0.5", "Pedri pases clave +0.5"],
    "Germany": ["Musiala tiros +0.5", "Havertz tiros a puerta +0.5", "Wirtz pases clave +0.5"],
    "Netherlands": ["Gakpo tiros +0.5", "Depay tiros a puerta +0.5", "Xavi Simons tiros +0.5"],
    "Belgium": ["Lukaku tiros a puerta +0.5", "De Bruyne pases clave +0.5", "Doku tiros +0.5"],
    "Norway": ["Haaland tiros a puerta +0.5", "Ødegaard pases clave +0.5", "Haaland tiros +1.5"],
    "Uruguay": ["Darwin Núñez tiros a puerta +0.5", "Valverde tiros +0.5", "Pellistri tiros +0.5"],
    "Egypt": ["Salah tiros a puerta +0.5", "Trézéguet tiros +0.5", "Marmoush tiros +0.5"]
  };

  return players[favorite.team] || [
    `${displayName(favorite.team)} delantero tiros +0.5`,
    `${displayName(favorite.team)} mediapunta tiros +0.5`,
    `${displayName(favorite.team)} participa en gol`
  ];
}

function getFullPicks(prediction, match) {
  const basePicks = generatePicks(prediction);
  const players = getPlayerSuggestions(prediction.favorite);

  basePicks.push({
    id: "player",
    type: "player",
    label: "Jugador",
    emoji: "⚽",
    market: "Jugador",
    line: "+0.5",
    direction: "OVER",
    text: players[0],
    marketKey: "playerShot",
    dataQuality: "proxy",
    noBet: false,
    rationale: "Estimación proxy: no usa alineación confirmada ni datos reales de tiros por jugador."
  });

  const volatility = getVolatility(prediction, match);

  return basePicks
    .map(pick => {
      const probability = getPickProbability(pick, prediction, match);
      const fairOdds = pick.noBet ? 0 : 1 / probability;

      const translatedPick = {
        ...pick,
        text: displayPickText(pick.text),
        market: displayPickText(pick.market),
        probability,
        fairOdds,
        confidence: confidenceLabel(probability),
        risk: riskLabel(probability),
        volatility
      };

      const clarity = getPickClarity(translatedPick, volatility);

      return {
        ...translatedPick,
        clarity: clarity.label,
        clarityClass: clarity.className,
        clarityNote: clarity.note,
        rankScore: 0
      };
    })
    .map(pick => {
      const item = { match, prediction, volatility, pick };
      return {
        ...pick,
        rankScore: rankScore(item)
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
      candidates.push({
        match,
        prediction,
        volatility,
        pick,
        score: rankScore({ match, prediction, volatility, pick })
      });
    });
  });

  return candidates;
}

function getFilteredCandidates(date) {
  const rules = getProfileRules();

  return getCandidatesForDate(date)
    .filter(item => rules.topTypes.includes(item.pick.type))
    .filter(item => !item.pick.noBet)
    .filter(item => item.pick.clarityClass !== "bad")
    .filter(item => settings.showAggressive || !["aggressive", "player", "score"].includes(item.pick.type))
    .filter(item => item.pick.probability >= rules.minProbability)
    .filter(item => !settings.hideHighVolatility || item.volatility.label !== "Alta")
    .sort((a, b) => b.score - a.score);
}

function buildParlay(date) {
  const rules = getProfileRules();
  const usedMatches = new Set();

  const legs = getCandidatesForDate(date)
    .filter(item => rules.parlayTypes.includes(item.pick.type))
    .filter(item => !item.pick.noBet)
    .filter(item => item.pick.clarityClass !== "bad")
    .filter(item => settings.showAggressive || !["aggressive", "player", "score"].includes(item.pick.type))
    .filter(item => item.pick.probability >= rules.minProbability)
    .filter(item => !settings.hideHighVolatility || item.volatility.label !== "Alta")
    .sort((a, b) => b.score - a.score)
    .filter(item => {
      if (usedMatches.has(item.match.id)) return false;
      usedMatches.add(item.match.id);
      return true;
    })
    .slice(0, Number(settings.maxParlay));

  const combinedProbability = legs.length ? legs.reduce((acc, item) => acc * item.pick.probability, 1) : 0;
  const fairOdds = combinedProbability ? 1 / combinedProbability : 0;

  let risk = "Alto";
  if (combinedProbability >= 0.55) risk = "Bajo";
  else if (combinedProbability >= 0.35) risk = "Medio";

  return { legs, combinedProbability, fairOdds, risk };
}

function cartProbability() {
  if (!cart.length) return 0;
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
  saveJSON(STORAGE_KEYS.settings, settings);
}

function saveCart() {
  saveJSON(STORAGE_KEYS.cart, cart);
  updateCartBadge();
}

function saveTickets() {
  saveJSON(STORAGE_KEYS.tickets, tickets);
}

function saveDraft() {
  saveJSON(STORAGE_KEYS.draft, ticketDraft);
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
    id: `${match.id}__${pick.id || pick.type}__${normalizeKey(pick.text)}`,
    matchId: match.id,
    match: matchName(match),
    date: match.date,
    type: pick.type,
    typeLabel: pick.label,
    emoji: pick.emoji,
    text: pick.text,
    market: pick.market || pick.typeLabel || pick.label,
    line: pick.line || "",
    direction: pick.direction || "",
    dataQuality: pick.dataQuality || "strong",
    clarityClass: pick.clarityClass || "mid",
    clarity: pick.clarity || "🟡 Dudoso",
    rationale: pick.rationale || "",
    probability: pick.probability,
    fairOdds: pick.fairOdds,
    risk: pick.risk,
    volatility: pick.volatility?.label || "Media"
  };
}

function isPickInCart(match, pick) {
  const item = makeCartItem(match, pick);
  return cart.some(cartItem => cartItem.id === item.id);
}

function addToTicket(matchId, pickId) {
  const match = currentMatches.find(item => item.id === matchId);
  if (!match) return;

  const prediction = getPredictionForMatch(match);
  const picks = getFullPicks(prediction, match);
  const pick = picks.find(item => item.id === pickId || item.type === pickId);

  if (!pick || pick.noBet) {
    showToast("No hay ventaja clara");
    return;
  }

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

  if (added > 0) showToast(`✅ ${added} picks agregados`);
  else showToast("El parley ya está en ticket");

  renderAll();
}

function addManualPick() {
  const probabilityInput = Number(ticketDraft.manualProbability || 0);
  const probability = probabilityInput > 1 ? probabilityInput / 100 : probabilityInput;

  if (!ticketDraft.manualPick || !ticketDraft.manualPick.trim()) {
    alert("Escribe el pick manual.");
    return;
  }

  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    alert("Escribe una probabilidad válida. Ejemplo: 65 o 0.65.");
    return;
  }

  const pick = {
    id: `manual_${Date.now()}`,
    matchId: "manual",
    match: ticketDraft.manualMatch || "Entrada manual",
    date: new Date().toISOString().slice(0, 10),
    type: "manual",
    typeLabel: "Manual",
    emoji: "✍️",
    text: ticketDraft.manualPick.trim(),
    market: ticketDraft.manualMarket || "Manual",
    line: ticketDraft.manualLine || "",
    direction: "",
    dataQuality: ticketDraft.manualQuality || "proxy",
    clarityClass: probability >= 0.66 ? "good" : probability >= 0.50 ? "mid" : "bad",
    clarity: probability >= 0.66 ? "🟢 Claro" : probability >= 0.50 ? "🟡 Dudoso" : "🔴 Evitar",
    rationale: "Entrada agregada manualmente por el usuario.",
    probability,
    fairOdds: 1 / probability,
    risk: riskLabel(probability),
    volatility: "Manual"
  };

  cart.push(pick);

  ticketDraft.manualMatch = "";
  ticketDraft.manualPick = "";
  ticketDraft.manualLine = "";
  ticketDraft.manualProbability = "";

  saveCart();
  saveDraft();
  showToast("Entrada manual agregada");
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

function updateDraftSilent(key, value, refreshPreview = false) {
  ticketDraft[key] = value;
  saveDraft();

  if (refreshPreview) updateTicketLivePreview();
}

function updateDraftSelect(key, value) {
  ticketDraft[key] = value;
  saveDraft();
}

function updateSettingSilent(key, value) {
  settings[key] = value;
  saveSettings();

  if (key === "initialBankroll") updateTicketLivePreview();
}

function updateSetting(key, value) {
  settings[key] = value;

  if (key === "favoriteBook") {
    ticketDraft.book = value;
    saveDraft();
  }

  saveSettings();
  renderAll();
}

function getTicketEvaluation() {
  if (!cart.length) {
    return {
      title: "Agrega picks para evaluar",
      text: "Tu entrada todavía está vacía.",
      className: "mid",
      risk: "Sin datos",
      warnings: [],
      suggestedStake: [0, 0]
    };
  }

  const probability = cartProbability();
  const odds = Number(ticketDraft.odds || 0);
  const implied = odds > 1 ? 1 / odds : 0;
  const edge = odds > 1 ? probability - implied : 0;

  const highVolatility = cart.filter(item => item.volatility === "Alta").length;
  const proxyCount = cart.filter(item => item.dataQuality === "proxy").length;
  const riskyTypes = cart.filter(item => ["aggressive", "score", "player", "cards", "manual"].includes(item.type)).length;
  const badClarity = cart.filter(item => item.clarityClass === "bad").length;

  let score = probability * 100;

  if (edge > 0) score += 10;
  if (edge < -0.05) score -= 12;
  if (cart.length >= 4) score -= 8;
  if (cart.length >= 5) score -= 14;
  if (highVolatility) score -= highVolatility * 10;
  if (riskyTypes) score -= riskyTypes * 6;
  if (proxyCount >= 2) score -= 10;
  if (badClarity) score -= 15;

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
    text = "Demasiada volatilidad, probabilidad baja o muchos mercados proxy.";
    className = "bad";
    risk = "Alto";
    stakePct = [0.005, 0.015];
  }

  const warnings = [];

  if (edge < 0 && odds > 1) warnings.push("Tiene value negativo frente al momio de la casa.");
  if (cart.length >= 4) warnings.push("Tiene muchas selecciones; considera bajarlo a 2 o 3 picks.");
  if (highVolatility) warnings.push(`Incluye ${highVolatility} pick(s) de alta volatilidad.`);
  if (proxyCount) warnings.push(`Incluye ${proxyCount} mercado(s) proxy/manual.`);
  if (riskyTypes >= 2) warnings.push("Combina varios mercados de alta varianza.");
  if (badClarity) warnings.push("Incluye picks marcados como Evitar.");

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
    warnings,
    suggestedStake
  };
}

function renderWarnings(warnings) {
  if (!warnings || !warnings.length) return "";

  return `
    <div class="warning-list">
      <strong>Alertas del ticket</strong>
      <ul>
        ${warnings.map(warning => `<li>${escapeHTML(warning)}</li>`).join("")}
      </ul>
    </div>
  `;
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
  const warningsBox = document.getElementById("ticketLiveWarnings");

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

  if (warningsBox) warningsBox.innerHTML = renderWarnings(evaluation.warnings);
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
    evaluation,
    appVersion: APP_VERSION
  };

  tickets.unshift(ticket);

  cart = [];
  ticketDraft = {
    ...ticketDraft,
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
  if (ticket.status === "win") return Number(ticket.stake || 0) * Number(ticket.odds || 0) - Number(ticket.stake || 0);
  if (ticket.status === "loss") return -Number(ticket.stake || 0);
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

  const totalStaked = settled.reduce((sum, ticket) => sum + Number(ticket.stake || 0), 0);
  const pendingStake = pending.reduce((sum, ticket) => sum + Number(ticket.stake || 0), 0);
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

function groupBookStats() {
  const groups = {};

  tickets.filter(isSettled).forEach(ticket => {
    const book = ticket.book || "Sin casa";
    if (!groups[book]) groups[book] = { name: book, staked: 0, profit: 0, count: 0 };

    groups[book].staked += Number(ticket.stake || 0);
    groups[book].profit += ticketProfit(ticket);
    groups[book].count++;
  });

  return Object.values(groups)
    .map(row => ({ ...row, roi: row.staked ? row.profit / row.staked : 0 }))
    .sort((a, b) => b.profit - a.profit);
}

function groupMarketStats() {
  const groups = {};

  tickets.filter(isSettled).forEach(ticket => {
    const selections = ticket.selections || [];
    const stakeShare = selections.length ? Number(ticket.stake || 0) / selections.length : 0;
    const profitShare = selections.length ? ticketProfit(ticket) / selections.length : 0;

    selections.forEach(selection => {
      const name = marketBucket(selection);
      if (!groups[name]) groups[name] = { name, staked: 0, profit: 0, count: 0 };

      groups[name].staked += stakeShare;
      groups[name].profit += profitShare;
      groups[name].count++;
    });
  });

  return Object.values(groups)
    .map(row => ({ ...row, roi: row.staked ? row.profit / row.staked : 0 }))
    .sort((a, b) => b.profit - a.profit);
}

function renderStatRows(rows, emptyText) {
  if (!rows.length) return `<p class="note">${escapeHTML(emptyText)}</p>`;

  return `
    <div class="stat-list">
      ${rows.slice(0, 6).map(row => `
        <div class="stat-row">
          <div>
            <strong>${escapeHTML(row.name)}</strong>
            <span>${row.count || row.sample || 0} registros · ${row.staked !== undefined ? `${formatMoney(row.staked)} apostado` : `Confiabilidad ${row.reliability}`}</span>
          </div>
          <div>
            <strong>${row.roi !== undefined ? formatPct(row.roi) : formatPct(row.accuracy)}</strong>
            <span>${row.profit !== undefined ? formatMoney(row.profit) : "Backtest"}</span>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderBacktestRows() {
  const rows = getBacktestSummary(resultsData);

  return renderStatRows(
    rows,
    "Todavía no hay suficientes datos para backtesting."
  );
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
      subtitle: `MatchIQ v${APP_VERSION} · ML Foundation + Backtesting.`
    },
    recommended: {
      eyebrow: "Recomendaciones",
      title: "Picks",
      subtitle: "Predicciones ordenadas por perfil, valor y claridad."
    },
    ticket: {
      eyebrow: "Ticket Builder",
      title: "Ticket",
      subtitle: "Arma tus entradas, agrega picks manuales y mide value."
    },
    history: {
      eyebrow: "Bankroll",
      title: "Historial",
      subtitle: "Revisa tickets, utilidad, ROI y resultados."
    },
    profile: {
      eyebrow: "Ajustes",
      title: "Perfil",
      subtitle: "Configura bankroll, riesgo y casa favorita."
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

  const titleByProfile = settings.profile === "aggressive"
    ? "Mejor oportunidad agresiva"
    : settings.profile === "balanced"
      ? "Mejor oportunidad balanceada"
      : "Pick más sólido";

  screens.home.innerHTML = `
    <section class="glass panel">
      <h2>Inicio</h2>
      <p class="note">v${APP_VERSION}: variables recientes, recency weighting, backtesting básico y teclado estable.</p>

      <div class="home-stats">
        <div><strong>${formatMoney(stats.bankroll)}</strong><span>Bankroll actual</span></div>
        <div><strong>${formatPct(stats.roi)}</strong><span>ROI</span></div>
        <div><strong>${stats.wins}/${stats.losses}</strong><span>Tickets G/P</span></div>
        <div><strong>${stats.pending}</strong><span>Pendientes</span></div>
      </div>
    </section>

    <section class="glass panel">
      <h2>${titleByProfile}</h2>
      ${
        solid ? `
          <button class="daily-card" onclick="selectMatchFromHome('${solid.match.id}')">
            <span>${getProfileRules().label} · v${APP_VERSION}</span>
            <strong>${escapeHTML(solid.pick.text)}</strong>
            <small>${escapeHTML(matchName(solid.match))}</small>
            <em>IA ${formatPct(solid.pick.probability)} · ${solid.pick.clarity} · ${formatFair(solid.pick.fairOdds)}</em>
          </button>
        ` : `<p class="note">No hay pick que pase los filtros actuales.</p>`
      }
    </section>

    <section class="glass panel">
      <h2>Backtesting básico</h2>
      <p class="note">Lectura histórica rápida para saber qué mercados suelen ser más estables.</p>
      ${renderBacktestRows()}
    </section>

    <section class="glass panel">
      <h2>Parley recomendado</h2>
      ${
        parlay.legs.length ? `
          <p class="note">Combinación sugerida según tu modo actual: <strong>${getProfileRules().label}</strong>.</p>
          ${parlay.legs.map((leg, index) => `
            <div class="mini-ticket-row">
              <div>
                <strong>${index + 1}. ${escapeHTML(leg.pick.text)}</strong>
                <span>${escapeHTML(matchName(leg.match))} · IA ${formatPct(leg.pick.probability)} · ${leg.pick.clarity}</span>
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

  const primaryPicks = visiblePicks
    .filter(pick => !pick.noBet && pick.clarityClass !== "bad")
    .sort((a, b) => b.rankScore - a.rankScore);

  const secondaryPicks = visiblePicks
    .filter(pick => pick.noBet || pick.clarityClass === "bad")
    .sort((a, b) => b.rankScore - a.rankScore);

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
              <strong>${item.pick.emoji} ${escapeHTML(item.pick.text)}</strong>
              <span>${escapeHTML(matchName(item.match))} · IA ${formatPct(item.pick.probability)} · ${item.pick.clarity}</span>
            </div>
            <em>${formatFair(item.pick.fairOdds)}</em>
          </button>
        `).join("") || `<p class="note">No hay picks que pasen tus filtros.</p>`}
      </div>

      <button class="primary-btn" onclick="addParlayToTicket('${selectedDate}')">Agregar parley recomendado</button>
    </section>

    <section class="glass card">
      <h2 class="match-title">${escapeHTML(matchName(match))}</h2>
      <p class="note">Predicción con <strong>${prediction.modelLabel}</strong>. Favorito estadístico: <strong>${escapeHTML(displayName(prediction.favorite.team))}</strong>.</p>

      <div class="prob-grid">
        <div class="prob"><strong>${prediction.probs.home}%</strong><span>${escapeHTML(displayName(match.home))}</span></div>
        <div class="prob"><strong>${prediction.probs.draw}%</strong><span>Empate</span></div>
        <div class="prob"><strong>${prediction.probs.away}%</strong><span>${escapeHTML(displayName(match.away))}</span></div>
      </div>

      ${renderModelPanel(prediction)}

      <div class="volatility-box">
        <strong>${volatility.emoji} Volatilidad ${volatility.label}</strong>
        <span>${escapeHTML(volatility.context.importance)}</span>
        ${volatility.context.notes.map(note => `<small>${escapeHTML(note)}</small>`).join("")}
        <small>Riesgo de partido roto: ${Math.round(prediction.brokenRisk * 100)}%</small>
      </div>

      <div class="model-box">
        <strong>🧩 Factores que empujan la predicción</strong>
        <span>Variables recientes y contexto</span>
        <div class="factor-list">
          ${prediction.factors.map(factor => `<div class="factor-row">${escapeHTML(displayPickText(factor))}</div>`).join("")}
        </div>
      </div>

      <div class="insight-grid">
        <div class="insight-card">
          <span>🎯 Marcador IA</span>
          <strong>${prediction.score}</strong>
        </div>

        <div class="insight-card">
          <span>🚩 Córners esperados</span>
          <strong>Total ${prediction.expectedCorners.total} · ${escapeHTML(displayName(match.home))} ${prediction.corners.home} / ${escapeHTML(displayName(match.away))} ${prediction.corners.away}</strong>
        </div>

        <div class="insight-card">
          <span>🟨 Tarjetas estimadas</span>
          <strong>Total ${prediction.expectedCards}</strong>
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
          <strong>${players.map(escapeHTML).join(" · ")}</strong>
        </div>
      </div>

      ${renderHeatmap(prediction)}

      <div class="section-label">Mejores oportunidades</div>
      ${primaryPicks.map(pick => renderPickCard(match, pick)).join("") || `<p class="note">No hay oportunidades claras para este perfil.</p>`}

      <div class="section-label">Mercados secundarios / sin ventaja clara</div>
      ${secondaryPicks.map(pick => renderPickCard(match, pick)).join("") || `<p class="note">Sin mercados descartados relevantes.</p>`}

      <p class="tiny-note">La IA ayuda a filtrar riesgo, pero ningún pick es seguro. Córners, tarjetas y jugadores son mercados proxy hasta conectar API real.</p>
    </section>
  `;
}

function renderPickCard(match, pick) {
  const inTicket = isPickInCart(match, pick);

  return `
    <div class="pick ${pick.type} ${pick.noBet ? "nobet" : ""}">
      <div class="pick-title">${pick.emoji} ${escapeHTML(pick.label)}</div>
      <strong class="pick-main">${escapeHTML(pick.text)}</strong>

      <div class="market-line">
        <div>
          <span>Mercado</span>
          <strong>${escapeHTML(pick.market)}</strong>
        </div>
        <div>
          <span>Línea</span>
          <strong>${escapeHTML(pick.line || "—")}</strong>
        </div>
      </div>

      <span class="quality-pill ${qualityClass(pick.dataQuality)}">${qualityLabel(pick.dataQuality)}</span>
      <span class="quality-pill ${pick.clarityClass}">${pick.clarity}</span>

      <p class="pick-meta">
        ${pick.noBet ? "Sin recomendación de entrada" : `IA ${formatPct(pick.probability)} · Riesgo ${pick.risk} · Momio justo ${formatFair(pick.fairOdds)}`}
        <br>${escapeHTML(pick.rationale || pick.clarityNote || "")}
      </p>

      <button class="primary-btn ${inTicket ? "in-ticket" : ""} ${pick.noBet ? "disabled" : ""}" ${inTicket || pick.noBet ? "disabled" : ""} onclick="addToTicket('${match.id}', '${pick.id}')">
        ${pick.noBet ? "No entrar" : inTicket ? "✅ En ticket" : "Agregar al ticket"}
      </button>
    </div>
  `;
}

function renderModelPanel(prediction) {
  const favoriteSide = prediction.favorite.side;

  const labels = {
    poisson: "Poisson",
    elo: "Elo",
    recent: "Reciente",
    logistic: "Logística"
  };

  return `
    <div class="model-box">
      <strong>🧠 Modelo ensemble</strong>
      <span>Confianza ${prediction.confidence.label} · ${prediction.confidence.score}/100</span>
      <small>Combina goles esperados, Elo, forma reciente, modelo logístico, variables recientes y contexto del partido.</small>

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
      <p class="note">Agrega picks desde Recomendados o crea una entrada manual.</p>

      ${
        cart.length ? cart.map(item => `
          <div class="cart-item">
            <div>
              <strong>${item.emoji || "🎟️"} ${escapeHTML(item.text)}</strong>
              <span>
                ${escapeHTML(item.match)} · IA ${formatPct(item.probability)} · Riesgo ${item.risk || "—"}
                <br>${escapeHTML(item.market || "Mercado")} ${escapeHTML(item.line || "")} · ${qualityLabel(item.dataQuality)} · ${item.clarity || "🟡 Dudoso"}
              </span>
            </div>
            <button onclick="removeFromTicket('${item.id}')">✕</button>
          </div>
        `).join("") : `<p class="note">Tu ticket está vacío.</p>`
      }

      ${cart.length ? `<button class="ghost" onclick="clearTicket()">Vaciar ticket</button>` : ""}
    </section>

    <section class="glass panel">
      <h2>Entrada manual</h2>
      <p class="note">Usa esto para copiar un pick externo y evaluarlo dentro de MatchIQ. Keyboard Safe: no se cierra el teclado al escribir.</p>

      <label>Partido o descripción</label>
      <input value="${escapeHTML(ticketDraft.manualMatch || "")}" placeholder="Ejemplo: México vs Brasil" oninput="updateDraftSilent('manualMatch', this.value)" />

      <label>Pick</label>
      <input value="${escapeHTML(ticketDraft.manualPick || "")}" placeholder="Ejemplo: México córners +3.5" oninput="updateDraftSilent('manualPick', this.value)" />

      <label>Mercado</label>
      <select onchange="updateDraftSelect('manualMarket', this.value)">
        ${["Goles", "Handicap", "Córners", "Tarjetas", "Jugador", "Marcador", "Combo", "Otro"].map(item => `
          <option value="${item}" ${ticketDraft.manualMarket === item ? "selected" : ""}>${item}</option>
        `).join("")}
      </select>

      <label>Línea</label>
      <input value="${escapeHTML(ticketDraft.manualLine || "")}" placeholder="Ejemplo: +0.5, -4.5, +8.5" oninput="updateDraftSilent('manualLine', this.value)" />

      <label>Calidad del dato</label>
      <select onchange="updateDraftSelect('manualQuality', this.value)">
        <option value="proxy" ${ticketDraft.manualQuality === "proxy" ? "selected" : ""}>Proxy</option>
        <option value="strong" ${ticketDraft.manualQuality === "strong" ? "selected" : ""}>Modelo fuerte</option>
      </select>

      <label>Probabilidad estimada</label>
      <input type="number" step="0.01" value="${escapeHTML(ticketDraft.manualProbability || "")}" placeholder="Ejemplo: 65 o 0.65" oninput="updateDraftSilent('manualProbability', this.value)" />

      <button class="primary-btn" onclick="addManualPick()">Agregar entrada manual</button>
    </section>

    <section class="glass panel">
      <h2>Datos del ticket</h2>

      <label>Casa de apuesta</label>
      <select onchange="updateDraftSelect('book', this.value)">
        ${BOOKS.map(book => `
          <option value="${book}" ${ticketDraft.book === book ? "selected" : ""}>${book}</option>
        `).join("")}
      </select>

      <label>Momio total de la casa</label>
      <input type="number" step="0.01" min="1.01" placeholder="Ejemplo: 2.35" value="${escapeHTML(ticketDraft.odds || "")}" oninput="updateDraftSilent('odds', this.value, true)" />

      <label>Importe apostado</label>
      <input type="number" step="1" min="1" placeholder="Ejemplo: 500" value="${escapeHTML(ticketDraft.stake || "")}" oninput="updateDraftSilent('stake', this.value, true)" />

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

      <div id="ticketLiveWarnings">
        ${renderWarnings(evaluation.warnings)}
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
  const filteredTickets = historyFilter === "all"
    ? tickets
    : tickets.filter(ticket => (ticket.status || "pending") === historyFilter);

  screens.history.innerHTML = `
    <section class="glass panel">
      <h2>Historial</h2>

      <div class="home-stats">
        <div><strong>${formatMoney(stats.totalStaked)}</strong><span>Apostado cerrado</span></div>
        <div><strong>${formatMoney(stats.netProfit)}</strong><span>Utilidad</span></div>
        <div><strong>${formatPct(stats.roi)}</strong><span>ROI</span></div>
        <div><strong>${formatMoney(stats.pendingStake)}</strong><span>Pendiente</span></div>
      </div>

      <button class="ghost" onclick="exportHistoryCSV()">Exportar CSV</button>
    </section>

    <section class="glass panel">
      <h2>Filtros</h2>
      <div class="filter-row">
        ${[
          ["all", "Todos"],
          ["pending", "Pendientes"],
          ["win", "Ganados"],
          ["loss", "Perdidos"],
          ["void", "Anulados"]
        ].map(([key, label]) => `
          <button class="${historyFilter === key ? "active" : ""}" onclick="setHistoryFilter('${key}')">${label}</button>
        `).join("")}
      </div>
    </section>

    <section class="glass panel">
      <h2>ROI por casa</h2>
      ${renderStatRows(groupBookStats(), "Aún no hay tickets cerrados para calcular ROI por casa.")}
    </section>

    <section class="glass panel">
      <h2>ROI por mercado</h2>
      ${renderStatRows(groupMarketStats(), "Aún no hay tickets cerrados para calcular ROI por mercado.")}
    </section>

    <section class="glass panel">
      <h2>Tickets</h2>

      ${
        filteredTickets.length ? filteredTickets.map(ticket => `
          <div class="ticket-card ticket-${ticket.status || "pending"}">
            <div class="ticket-head">
              <strong>${escapeHTML(ticket.book || "Casa")} · ${formatOdds(ticket.odds)}</strong>
              <span>${statusLabel(ticket.status)}</span>
            </div>

            <p class="note">${ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("es-MX") : "Sin fecha"} · ${formatMoney(ticket.stake)} apostados · ${(ticket.selections || []).length} picks</p>

            ${(ticket.selections || []).map(sel => `
              <div class="ticket-selection">
                <div>
                  <strong>${escapeHTML(sel.text)}</strong>
                  <span>
                    ${escapeHTML(sel.match)} · IA ${formatPct(sel.probability)}
                    <br>${escapeHTML(sel.market || sel.typeLabel || "Mercado")} ${escapeHTML(sel.line || "")} · ${qualityLabel(sel.dataQuality)} · ${sel.clarity || "🟡 Dudoso"}
                  </span>
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
        `).join("") : `<p class="note">No hay tickets para este filtro.</p>`
      }
    </section>
  `;
}

function renderProfile() {
  screens.profile.innerHTML = `
    <section class="glass panel">
      <h2>Perfil</h2>
      <p class="note">Ajusta tu bankroll, riesgo y casa favorita. El bankroll usa escritura segura para no cerrar el teclado.</p>

      <label>Bankroll inicial</label>
      <input type="number" min="0" step="1" value="${settings.initialBankroll}" oninput="updateSettingSilent('initialBankroll', Number(this.value))" />

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
      <h2>Backtesting del modelo</h2>
      <p class="note">Sirve para ver qué mercados son más estables históricamente. No es garantía, pero ayuda a calibrar riesgo.</p>
      ${renderBacktestRows()}
    </section>

    <section class="glass panel">
      <h2>Zona de cuidado</h2>
      <button class="ghost" onclick="clearAllTickets()">Borrar tickets e historial</button>
    </section>
  `;
}

function statusLabel(status) {
  if (status === "win") return "✅ Ganado";
  if (status === "loss") return "❌ Perdido";
  if (status === "void") return "🚫 Anulado";
  return "⏳ Pendiente";
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

function setHistoryFilter(filter) {
  historyFilter = filter;
  renderHistory();
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

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportHistoryCSV() {
  if (!tickets.length) {
    alert("No hay tickets para exportar.");
    return;
  }

  const headers = [
    "fecha",
    "casa",
    "estado",
    "momio",
    "stake",
    "utilidad",
    "probabilidad_ia",
    "momio_justo_ia",
    "partido",
    "pick",
    "mercado",
    "linea",
    "tipo",
    "calidad",
    "claridad"
  ];

  const rows = [];

  tickets.forEach(ticket => {
    const selections = ticket.selections || [];

    if (!selections.length) {
      rows.push([
        ticket.createdAt || "",
        ticket.book || "",
        ticket.status || "pending",
        ticket.odds || "",
        ticket.stake || "",
        ticketProfit(ticket),
        ticket.combinedProbability || "",
        ticket.fairOdds || "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      ]);
      return;
    }

    selections.forEach(selection => {
      rows.push([
        ticket.createdAt || "",
        ticket.book || "",
        ticket.status || "pending",
        ticket.odds || "",
        ticket.stake || "",
        ticketProfit(ticket),
        ticket.combinedProbability || "",
        ticket.fairOdds || "",
        selection.match || "",
        selection.text || "",
        selection.market || "",
        selection.line || "",
        selection.type || "",
        selection.dataQuality || "",
        selection.clarity || ""
      ]);
    });
  });

  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map(row => row.map(csvEscape).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `matchiq_historial_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
  showToast("CSV exportado");
}

async function init() {
  Object.values(screens).forEach(screen => {
    screen.innerHTML = `
      <section class="glass panel">
        <h2>Cargando...</h2>
        <p class="note">Preparando MatchIQ v${APP_VERSION}.</p>
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
    console.error(error);

    Object.values(screens).forEach(screen => {
      screen.innerHTML = `
        <section class="glass panel">
          <h2>Error al cargar</h2>
          <p class="note">No se pudo iniciar MatchIQ v${APP_VERSION}. Revisa que los 6 archivos estén completos y guardados.</p>
        </section>
      `;
    });
  }
}

init();
