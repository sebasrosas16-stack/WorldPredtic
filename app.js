const PICK_TYPES = [
  { key: "safe", name: "Conservadores", emoji: "🛡️" },
  { key: "balanced", name: "Equilibrados", emoji: "⚖️" },
  { key: "aggressive", name: "Agresivos", emoji: "🔥" },
  { key: "score", name: "Marcadores", emoji: "🎯" },
  { key: "player", name: "Jugadores", emoji: "⚽" },
  { key: "corners", name: "Córners", emoji: "🚩" }
];

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
  "DR Congo": "RD Congo"
};

const DATE_LABELS = {
  "2026-06-24": "24 junio",
  "2026-06-25": "25 junio",
  "2026-06-26": "26 junio",
  "2026-06-27": "27 junio"
};

const DEFAULT_SETTINGS = {
  profile: "safe",
  maxParlay: 3,
  hideHighVolatility: true,
  showAggressive: true,
  defaultHouse: "Draftea",
  bankroll: 1000
};

const CONTEXT_FACTORS = {
  "2026-06-25-ecuador-germany": {
    volatilityBoost: 18,
    importance: "Partido de alta presión",
    notes: [
      "Ecuador puede estar obligado a competir con máxima intensidad.",
      "El contexto puede subir ritmo, tarjetas, córners y volatilidad.",
      "Si Alemania depende de jugadores creativos condicionados físicamente, se reduce confianza en goleadas."
    ]
  },
  "2026-06-25-japan-sweden": {
    volatilityBoost: 10,
    importance: "Cruce parejo",
    notes: [
      "Partido con perfiles competitivos similares.",
      "Resultado directo más volátil que mercados de goles/córners."
    ]
  },
  "2026-06-25-paraguay-australia": {
    volatilityBoost: 12,
    importance: "Partido físico",
    notes: [
      "Puede ser un partido cerrado y de contacto.",
      "Cuidado con picks de ganador directo si el modelo no marca diferencia clara."
    ]
  },
  "2026-06-25-turkey-united-states": {
    volatilityBoost: 10,
    importance: "Partido de ritmo alto",
    notes: [
      "Riesgo de transiciones y partido abierto.",
      "Mejor evaluar goles/córners antes que marcador exacto."
    ]
  }
};

const STORAGE_KEYS = {
  settings: "matchiq_settings_v7",
  cart: "matchiq_cart_v7",
  tickets: "matchiq_tickets_v7",
  pickStates: "matchiq_pick_states_v7"
};

let resultsData = [];
let currentMatches = [];
let activeTab = "home";

let settings = loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
let cart = loadJSON(STORAGE_KEYS.cart, []);
let tickets = loadJSON(STORAGE_KEYS.tickets, []);
let pickStates = loadJSON(STORAGE_KEYS.pickStates, {});

const screens = {
  home: document.getElementById("screen-home"),
  recommended: document.getElementById("screen-recommended"),
  ticket: document.getElementById("screen-ticket"),
  history: document.getElementById("screen-history"),
  profile: document.getElementById("screen-profile")
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

function money(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(Number(value || 0));
}

function formatPct(value) {
  return `${Math.round(value * 100)}%`;
}

function formatOdds(value) {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toFixed(2);
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
    notes: ["Sin alerta contextual manual registrada."]
  };
}

function getVolatility(prediction, match) {
  const context = getContextForMatch(match);

  let score = 40;
  const favProb = prediction.favorite.prob;
  const goalTotal = prediction.homeLambda + prediction.awayLambda;
  const drawProb = prediction.probs.draw / 100;
  const bothScoreProb = prediction.bothScore / 100;

  if (favProb < 0.45) score += 28;
  else if (favProb < 0.56) score += 16;
  else if (favProb > 0.68) score -= 10;

  if (drawProb > 0.28) score += 8;
  if (goalTotal > 3.1) score += 12;
  if (bothScoreProb > 0.58) score += 10;
  if (prediction.under45 < 68) score += 8;

  score += context.volatilityBoost;
  score = clampNumber(score, 0, 100);

  let label = "Baja";
  let emoji = "🟢";

  if (score >= 70) {
    label = "Alta";
    emoji = "🔴";
  } else if (score >= 45) {
    label = "Media";
    emoji = "🟡";
  }

  return { score, label, emoji, context };
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
  const favGoalProb = 1 - poisson(0, prediction.favorite.lambda);
  const volatility = getVolatility(prediction, match);

  let probability = 0.5;

  if (pick.type === "safe") {
    probability = pick.text.includes("anota")
      ? favGoalProb
      : prediction.under45 / 100;
  }

  if (pick.type === "balanced") {
    if (pick.text.includes("Doble oportunidad")) {
      probability = prediction.favorite.prob + prediction.probs.draw / 100;
    } else {
      probability = prediction.favorite.prob;
    }
  }

  if (pick.type === "aggressive") {
    probability = pick.text.includes("cero")
      ? winToNilProbability(prediction)
      : winAndUnder45Probability(prediction);
  }

  if (pick.type === "score") probability = scoreProbability(prediction.score, prediction);

  if (pick.type === "corners") {
    const cornerFav = prediction.favorite.side === "home"
      ? prediction.corners.home
      : prediction.corners.away;

    probability = cornerFav >= 5 ? 0.64 : 0.56;
  }

  if (pick.type === "player") probability = 0.57;

  if (volatility.label === "Alta" && ["balanced", "aggressive", "score", "player"].includes(pick.type)) {
    probability *= 0.88;
  }

  if (volatility.label === "Media" && ["aggressive", "score"].includes(pick.type)) {
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
    player: 26,
    score: 42
  };

  return (
    item.pick.probability * 100
    - item.volatility.score * 0.32
    - (typePenalty[item.pick.type] || 20)
  );
}

function decoratePicks(picks, prediction, match) {
  const volatility = getVolatility(prediction, match);

  return picks.map(pick => {
    const probability = getPickProbability(pick, prediction, match);
    const fairOdds = 1 / probability;
    const valueOdds = 1.08 / probability;

    const decorated = {
      ...pick,
      probability,
      fairOdds,
      valueOdds,
      confidence: confidenceLabel(probability),
      risk: riskLabel(probability),
      volatility,
      safetyScore: 0
    };

    decorated.safetyScore = safetyScore({ pick: decorated, volatility });
    return decorated;
  });
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
    "Belgium": ["Lukaku 1+ tiro a puerta", "De Bruyne 1+ pase clave", "Doku 1+ tiro"]
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
    text: players[0]
  });

  return decoratePicks(basePicks, prediction, match);
}

function getMatchesByDate(date) {
  return currentMatches.filter(match => match.date === date);
}

function getCandidatesForDate(date) {
  const candidates = [];

  getMatchesByDate(date).forEach(match => {
    const prediction = predictMatch(resultsData, match.home, match.away);
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
    .filter(item => item.pick.probability >= rules.minProbability)
    .filter(item => {
      if (!settings.hideHighVolatility) return true;
      return item.volatility.label !== "Alta";
    })
    .sort((a, b) => b.pick.safetyScore - a.pick.safetyScore);
}

function currentDateValue() {
  const selector = document.getElementById("dateSelect");
  return selector?.value || currentMatches[0]?.date || "2026-06-26";
}

function makeCartItem(item) {
  return {
    id: `${item.match.id}__${item.pick.type}`,
    matchId: item.match.id,
    match: matchName(item.match),
    date: item.match.date,
    pickType: item.pick.type,
    typeLabel: item.pick.label,
    pick: item.pick.text,
    probability: item.pick.probability,
    fairOdds: item.pick.fairOdds,
    volatility: item.volatility.label,
    createdAt: new Date().toISOString()
  };
}

function addToCart(matchId, pickType) {
  const match = currentMatches.find(item => item.id === matchId);
  if (!match) return;

  const prediction = predictMatch(resultsData, match.home, match.away);
  const volatility = getVolatility(prediction, match);
  const picks = getFullPicks(prediction, match);
  const pick = picks.find(item => item.type === pickType);

  if (!pick) return;

  const candidate = { match, prediction, volatility, pick };
  const cartItem = makeCartItem(candidate);

  if (cart.some(item => item.id === cartItem.id)) {
    showToast("Ese pick ya está en el ticket");
    return;
  }

  cart.push(cartItem);
  saveJSON(STORAGE_KEYS.cart, cart);
  showToast("Agregado al ticket");
  renderAll();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveJSON(STORAGE_KEYS.cart, cart);
  renderAll();
}

function clearCart() {
  cart = [];
  saveJSON(STORAGE_KEYS.cart, cart);
  renderAll();
}

function combinedProbability(items = cart) {
  if (!items.length) return 0;
  return items.reduce((acc, item) => acc * item.probability, 1);
}

function buildParlay(date) {
  const rules = getProfileRules();
  const usedMatches = new Set();

  const legs = getCandidatesForDate(date)
    .filter(item => rules.parlayTypes.includes(item.pick.type))
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

  return legs;
}

function addRecommendedParlay() {
  const legs = buildParlay(currentDateValue());

  legs.forEach(item => {
    const cartItem = makeCartItem(item);
    if (!cart.some(existing => existing.id === cartItem.id)) {
      cart.push(cartItem);
    }
  });

  saveJSON(STORAGE_KEYS.cart, cart);
  showToast("Parley agregado al ticket");
  renderAll();
  switchTab("ticket");
}

function saveTicket() {
  if (!cart.length) {
    showToast("Agrega picks al ticket primero");
    return;
  }

  const house = document.getElementById("ticketHouse")?.value || settings.defaultHouse;
  const odds = Number(document.getElementById("ticketOdds")?.value);
  const stake = Number(document.getElementById("ticketStake")?.value);

  if (!odds || odds <= 1) {
    showToast("Escribe un momio válido");
    return;
  }

  if (!stake || stake <= 0) {
    showToast("Escribe un importe válido");
    return;
  }

  const prob = combinedProbability(cart);
  const fairOdds = prob ? 1 / prob : 0;
  const payout = stake * odds;
  const profit = payout - stake;
  const implied = 1 / odds;
  const edge = prob - implied;

  const ticket = {
    id: `T-${Date.now()}`,
    house,
    odds,
    stake,
    payout,
    profitIfWin: profit,
    probability: prob,
    fairOdds,
    edge,
    status: "pending",
    picks: [...cart],
    createdAt: new Date().toISOString()
  };

  tickets.unshift(ticket);
  saveJSON(STORAGE_KEYS.tickets, tickets);
  clearCart();
  showToast("Ticket guardado");
  switchTab("history");
}

function updateTicketStatus(ticketId, status) {
  tickets = tickets.map(ticket => {
    if (ticket.id !== ticketId) return ticket;
    return {
      ...ticket,
      status,
      settledAt: new Date().toISOString()
    };
  });

  saveJSON(STORAGE_KEYS.tickets, tickets);
  renderAll();
}

function ticketProfit(ticket) {
  if (ticket.status === "won") return ticket.profitIfWin;
  if (ticket.status === "lost") return -ticket.stake;
  return 0;
}

function bankrollStats() {
  const settled = tickets.filter(t => ["won", "lost"].includes(t.status));
  const totalStaked = settled.reduce((sum, t) => sum + Number(t.stake || 0), 0);
  const net = settled.reduce((sum, t) => sum + ticketProfit(t), 0);
  const roi = totalStaked ? net / totalStaked : 0;

  const won = tickets.filter(t => t.status === "won").length;
  const lost = tickets.filter(t => t.status === "lost").length;
  const pending = tickets.filter(t => t.status === "pending").length;

  return {
    bankroll: Number(settings.bankroll || 0) + net,
    totalStaked,
    net,
    roi,
    won,
    lost,
    pending,
    total: tickets.length
  };
}

function pickStateKey(matchId, pickType) {
  return `${matchId}__${pickType}`;
}

function getPickState(matchId, pickType) {
  return pickStates[pickStateKey(matchId, pickType)]?.status || null;
}

function togglePick(matchId, pickType, status) {
  const match = currentMatches.find(item => item.id === matchId);
  if (!match) return;

  const prediction = predictMatch(resultsData, match.home, match.away);
  const picks = getFullPicks(prediction, match);
  const pick = picks.find(item => item.type === pickType);
  if (!pick) return;

  const key = pickStateKey(matchId, pickType);
  const current = pickStates[key];

  if (current && current.status === status) {
    delete pickStates[key];
  } else {
    pickStates[key] = {
      matchId,
      type: pickType,
      typeLabel: pick.label,
      pick: pick.text,
      match: matchName(match),
      status,
      updatedAt: new Date().toISOString()
    };
  }

  saveJSON(STORAGE_KEYS.pickStates, pickStates);
  renderAll();
}

function renderHome() {
  const stats = bankrollStats();
  const date = currentDateValue();
  const candidates = getFilteredCandidates(date);

  const solid = candidates[0];
  const parlay = buildParlay(date);
  const parlayProb = combinedProbability(parlay.map(item => makeCartItem(item)));
  const parlayFairOdds = parlayProb ? 1 / parlayProb : 0;

  screens.home.innerHTML = `
    <section class="glass panel">
      <h2>Inicio</h2>
      <p class="note">Resumen rápido del modelo y tu bankroll.</p>

      <div class="stats">
        <div><strong>${money(stats.bankroll)}</strong><span>Bankroll</span></div>
        <div><strong>${formatPct(stats.roi)}</strong><span>ROI</span></div>
        <div><strong>${stats.pending}</strong><span>Pendientes</span></div>
      </div>
    </section>

    <section class="glass panel">
      <h2>Pick más sólido</h2>
      ${
        solid
          ? `
            <div class="daily-card static-card">
              <span>${DATE_LABELS[date] || date}</span>
              <strong>${solid.pick.text}</strong>
              <small>${matchName(solid.match)} · IA ${formatPct(solid.pick.probability)} · Volatilidad ${solid.volatility.label}</small>
              <button class="primary-action" onclick="addToCart('${solid.match.id}', '${solid.pick.type}')">Agregar al ticket</button>
            </div>
          `
          : `<p class="note">No hay picks que superen tus filtros actuales.</p>`
      }
    </section>

    <section class="glass panel">
      <h2>Parley sugerido</h2>
      <p class="note">Construido según tu perfil: <strong>${getProfileRules().label}</strong>.</p>

      ${
        parlay.length
          ? `
            <div class="parlay-mini">
              ${parlay.map((item, index) => `
                <div class="parlay-mini-row">
                  <span>${index + 1}</span>
                  <strong>${item.pick.text}</strong>
                  <small>${matchName(item.match)} · IA ${formatPct(item.pick.probability)}</small>
                </div>
              `).join("")}
            </div>

            <div class="parlay-summary">
              <div><strong>${formatPct(parlayProb)}</strong><span>Prob. IA</span></div>
              <div><strong>@${formatOdds(parlayFairOdds)}</strong><span>Momio justo</span></div>
              <div><strong>${parlay.length}</strong><span>Picks</span></div>
            </div>

            <button class="primary-action" onclick="addRecommendedParlay()">Agregar parley al ticket</button>
          `
          : `<p class="note">No hay suficientes picks para armar parley.</p>`
      }
    </section>
  `;
}

function renderRecommended() {
  const dates = [...new Set(currentMatches.map(match => match.date))];
  const selectedDate = currentDateValue();

  screens.recommended.innerHTML = `
    <section class="glass panel">
      <h2>Recomendados</h2>
      <p class="note">Picks ordenados por seguridad, contexto y volatilidad.</p>

      <label for="dateSelect">Fecha</label>
      <select id="dateSelect" onchange="renderAll()">
        ${dates.map(date => `
          <option value="${date}" ${date === selectedDate ? "selected" : ""}>${DATE_LABELS[date] || date}</option>
        `).join("")}
      </select>
    </section>

    ${renderSettingsBox()}

    <section class="glass panel">
      <h2>Top picks</h2>
      ${renderTopPicks(selectedDate)}
    </section>

    <section class="glass panel">
      <h2>Partidos</h2>
      ${renderMatchList(selectedDate)}
    </section>
  `;
}

function renderSettingsBox() {
  return `
    <section class="glass panel">
      <h2>Configuración rápida</h2>

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
        Ocultar alta volatilidad
      </label>
    </section>
  `;
}

function renderTopPicks(date) {
  const ranked = getFilteredCandidates(date).slice(0, 12);

  if (!ranked.length) {
    return `<p class="note">No hay picks que superen la configuración actual.</p>`;
  }

  return `
    <div class="top-picks-list">
      ${ranked.map((item, index) => `
        <div class="top-pick-row">
          <div class="rank">${index + 1}</div>
          <div>
            <strong>${item.pick.emoji} ${item.pick.text}</strong>
            <span>${matchName(item.match)} · IA ${formatPct(item.pick.probability)} · ${item.volatility.emoji} ${item.volatility.label}</span>
          </div>
          <button class="mini-add" onclick="addToCart('${item.match.id}', '${item.pick.type}')">+</button>
        </div>
      `).join("")}
    </div>
  `;
}

function renderMatchList(date) {
  const matches = getMatchesByDate(date);

  return `
    <div class="match-list">
      ${matches.map(match => {
        const prediction = predictMatch(resultsData, match.home, match.away);
        const volatility = getVolatility(prediction, match);
        const picks = getFullPicks(prediction, match)
          .sort((a, b) => b.safetyScore - a.safetyScore)
          .slice(0, 3);

        return `
          <div class="match-detail-card">
            <h3>${matchName(match)}</h3>
            <p class="note">Marcador IA: <strong>${prediction.score}</strong> · ${volatility.emoji} Volatilidad ${volatility.label}</p>

            <div class="prob-grid">
              <div class="prob"><strong>${prediction.probs.home}%</strong><span>${displayName(match.home)}</span></div>
              <div class="prob"><strong>${prediction.probs.draw}%</strong><span>Empate</span></div>
              <div class="prob"><strong>${prediction.probs.away}%</strong><span>${displayName(match.away)}</span></div>
            </div>

            ${picks.map(pick => renderPickActions(match, pick)).join("")}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderPickActions(match, pick) {
  const state = getPickState(match.id, pick.type);
  const inCart = cart.some(item => item.id === `${match.id}__${pick.type}`);

  return `
    <div class="pick ${pick.type} ${state ? "registered" : ""}">
      <div class="pick-title">${pick.emoji} ${pick.label}</div>
      <strong>${pick.text}</strong>
      <p class="pick-meta">IA ${formatPct(pick.probability)} · Riesgo ${pick.risk} · Momio justo @${formatOdds(pick.fairOdds)}</p>

      <div class="actions three-actions">
        <button class="ghost-small ${inCart ? "active" : ""}" onclick="addToCart('${match.id}', '${pick.type}')">${inCart ? "En ticket" : "Agregar"}</button>
        <button class="win ${state === "win" ? "active" : ""}" onclick="togglePick('${match.id}', '${pick.type}', 'win')">✅</button>
        <button class="lose ${state === "loss" ? "active" : ""}" onclick="togglePick('${match.id}', '${pick.type}', 'loss')">❌</button>
      </div>
    </div>
  `;
}

function renderTicket() {
  const prob = combinedProbability(cart);
  const fairOdds = prob ? 1 / prob : 0;

  screens.ticket.innerHTML = `
    <section class="glass panel">
      <h2>Ticket actual</h2>
      <p class="note">Agrega picks, escribe el momio real de la casa y calcula si hay value.</p>

      ${
        cart.length
          ? `
            <div class="cart-list">
              ${cart.map(item => `
                <div class="cart-item">
                  <div>
                    <strong>${item.pick}</strong>
                    <span>${item.match} · IA ${formatPct(item.probability)} · ${item.volatility}</span>
                  </div>
                  <button onclick="removeFromCart('${item.id}')">✕</button>
                </div>
              `).join("")}
            </div>

            <div class="ticket-form">
              <label>Casa de apuesta</label>
              <select id="ticketHouse">
                ${["Draftea", "Caliente", "Codere", "Bet365", "Playdoit", "Otra"].map(house => `
                  <option value="${house}" ${house === settings.defaultHouse ? "selected" : ""}>${house}</option>
                `).join("")}
              </select>

              <label>Momio total de la casa</label>
              <input id="ticketOdds" type="number" min="1.01" step="0.01" placeholder="Ejemplo: 2.15" oninput="renderTicketPreview()" />

              <label>Importe apostado</label>
              <input id="ticketStake" type="number" min="1" step="1" placeholder="Ejemplo: 500" oninput="renderTicketPreview()" />

              <div id="ticketPreview" class="ticket-preview">
                ${renderTicketPreviewHTML(prob, fairOdds, 0, 0)}
              </div>

              <button class="primary-action" onclick="saveTicket()">Guardar ticket</button>
              <button class="ghost" onclick="clearCart()">Vaciar ticket</button>
            </div>
          `
          : `<p class="note">Tu ticket está vacío. Ve a Picks y toca “Agregar”.</p>`
      }
    </section>
  `;
}

function renderTicketPreview() {
  const preview = document.getElementById("ticketPreview");
  if (!preview) return;

  const odds = Number(document.getElementById("ticketOdds")?.value);
  const stake = Number(document.getElementById("ticketStake")?.value);
  const prob = combinedProbability(cart);
  const fairOdds = prob ? 1 / prob : 0;

  preview.innerHTML = renderTicketPreviewHTML(prob, fairOdds, odds, stake);
}

function renderTicketPreviewHTML(prob, fairOdds, odds, stake) {
  const validOdds = Number(odds || 0);
  const validStake = Number(stake || 0);

  const payout = validOdds && validStake ? validStake * validOdds : 0;
  const profit = payout ? payout - validStake : 0;
  const implied = validOdds > 1 ? 1 / validOdds : 0;
  const edge = implied ? prob - implied : 0;

  let label = "Escribe momio e importe";
  let cls = "";

  if (validOdds > 1) {
    if (edge >= 0.08) {
      label = "🟢 Value fuerte";
      cls = "good";
    } else if (edge >= 0.03) {
      label = "🟡 Value leve";
      cls = "mid";
    } else {
      label = "🔴 Sin value";
      cls = "bad";
    }
  }

  return `
    <div class="value-result ${cls}">
      <strong>${label}</strong>
      <span>Prob. IA combinada: ${formatPct(prob)} · Momio justo IA: @${formatOdds(fairOdds)}</span>
    </div>

    <div class="parlay-summary">
      <div><strong>${money(payout)}</strong><span>Retorno</span></div>
      <div><strong>${money(profit)}</strong><span>Utilidad</span></div>
      <div><strong>${implied ? formatPct(edge) : "—"}</strong><span>Edge</span></div>
    </div>
  `;
}

function renderHistory() {
  const stats = bankrollStats();

  screens.history.innerHTML = `
    <section class="glass panel">
      <h2>Historial</h2>
      <p class="note">Registro de tickets guardados.</p>

      <div class="stats">
        <div><strong>${stats.won}</strong><span>Ganados</span></div>
        <div><strong>${stats.lost}</strong><span>Perdidos</span></div>
        <div><strong>${money(stats.net)}</strong><span>Utilidad</span></div>
      </div>
    </section>

    <section class="glass panel">
      <h2>Tickets</h2>
      ${
        tickets.length
          ? tickets.map(ticket => renderTicketHistoryCard(ticket)).join("")
          : `<p class="note">Aún no has guardado tickets.</p>`
      }
    </section>
  `;
}

function renderTicketHistoryCard(ticket) {
  const statusLabels = {
    pending: "⏳ Pendiente",
    won: "✅ Ganado",
    lost: "❌ Perdido",
    void: "🚫 Anulado"
  };

  return `
    <div class="ticket-history-card">
      <div class="ticket-history-head">
        <strong>${ticket.id}</strong>
        <span>${statusLabels[ticket.status]}</span>
      </div>

      <p class="note">${ticket.house} · Momio @${formatOdds(ticket.odds)} · Importe ${money(ticket.stake)}</p>

      <div class="cart-list compact">
        ${ticket.picks.map(item => `
          <div class="cart-item">
            <div>
              <strong>${item.pick}</strong>
              <span>${item.match}</span>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="parlay-summary">
        <div><strong>${formatPct(ticket.probability)}</strong><span>Prob. IA</span></div>
        <div><strong>${money(ticketProfit(ticket))}</strong><span>Resultado</span></div>
        <div><strong>${formatPct(ticket.edge)}</strong><span>Edge</span></div>
      </div>

      <div class="actions three-actions">
        <button class="win ${ticket.status === "won" ? "active" : ""}" onclick="updateTicketStatus('${ticket.id}', 'won')">Ganado</button>
        <button class="lose ${ticket.status === "lost" ? "active" : ""}" onclick="updateTicketStatus('${ticket.id}', 'lost')">Perdido</button>
        <button class="ghost-small ${ticket.status === "void" ? "active" : ""}" onclick="updateTicketStatus('${ticket.id}', 'void')">Anulado</button>
      </div>
    </div>
  `;
}

function renderProfile() {
  const stats = bankrollStats();

  screens.profile.innerHTML = `
    <section class="glass panel">
      <h2>Perfil</h2>
      <p class="note">Ajusta bankroll, casa favorita y perfil de riesgo.</p>

      <div class="stats">
        <div><strong>${money(stats.bankroll)}</strong><span>Bankroll actual</span></div>
        <div><strong>${formatPct(stats.roi)}</strong><span>ROI</span></div>
        <div><strong>${tickets.length}</strong><span>Tickets</span></div>
      </div>
    </section>

    <section class="glass panel">
      <h2>Ajustes</h2>

      <label>Bankroll inicial</label>
      <input type="number" value="${settings.bankroll}" oninput="updateSetting('bankroll', Number(this.value))" />

      <label>Casa favorita</label>
      <select onchange="updateSetting('defaultHouse', this.value)">
        ${["Draftea", "Caliente", "Codere", "Bet365", "Playdoit", "Otra"].map(house => `
          <option value="${house}" ${house === settings.defaultHouse ? "selected" : ""}>${house}</option>
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

      <button class="ghost" onclick="resetAllData()">Borrar datos locales</button>
    </section>
  `;
}

function updateSetting(key, value) {
  settings[key] = value;
  saveJSON(STORAGE_KEYS.settings, settings);
  renderAll();
}

function resetAllData() {
  const ok = confirm("¿Seguro que quieres borrar tickets, carrito y ajustes?");
  if (!ok) return;

  settings = { ...DEFAULT_SETTINGS };
  cart = [];
  tickets = [];
  pickStates = {};

  saveJSON(STORAGE_KEYS.settings, settings);
  saveJSON(STORAGE_KEYS.cart, cart);
  saveJSON(STORAGE_KEYS.tickets, tickets);
  saveJSON(STORAGE_KEYS.pickStates, pickStates);

  renderAll();
}

function switchTab(tab) {
  activeTab = tab;

  Object.entries(screens).forEach(([key, screen]) => {
    screen.classList.toggle("active-screen", key === tab);
  });

  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  const btns = Array.from(document.querySelectorAll(".nav-btn"));
  const index = ["home", "recommended", "ticket", "history", "profile"].indexOf(tab);
  if (btns[index]) btns[index].classList.add("active");

  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  renderHome();
  renderRecommended();
  renderTicket();
  renderHistory();
  renderProfile();
}

function showToast(message) {
  let toast = document.getElementById("toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 1700);
}

async function init() {
  Object.values(screens).forEach(screen => {
    screen.innerHTML = `
      <section class="glass panel">
        <h2>Cargando...</h2>
        <p class="note">Conectando con datos y modelo.</p>
      </section>
    `;
  });

  try {
    resultsData = await loadResults();

    currentMatches = UPCOMING_MATCHES.map(match => ({
      ...match,
      id: createMatchId(match)
    }));

    renderAll();
  } catch (error) {
    screens.home.innerHTML = `
      <section class="glass panel">
        <h2>Error al cargar datos</h2>
        <p class="note">No se pudo conectar al CSV original. Revisa conexión o intenta más tarde.</p>
      </section>
    `;
    console.error(error);
  }
}

init();
