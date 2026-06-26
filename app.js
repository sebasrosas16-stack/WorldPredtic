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
  showAggressive: true
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

const dateSelect = document.getElementById("dateSelect");
const select = document.getElementById("matchSelect");
const card = document.getElementById("matchCard");
const dailySuggestion = document.getElementById("dailySuggestion");

const winsEl = document.getElementById("wins");
const lossesEl = document.getElementById("losses");
const hitRateEl = document.getElementById("hitRate");
const resetBtn = document.getElementById("resetBtn");

const RECORD_KEY = "matchiq_record_v6";
const SETTINGS_KEY = "matchiq_settings_v6";

let resultsData = [];
let currentMatches = [];

let settings = loadSettings();
let record = loadRecord();

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
  return { ...DEFAULT_SETTINGS, ...(saved || {}) };
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadRecord() {
  const saved = JSON.parse(localStorage.getItem(RECORD_KEY));
  return saved || { pickStates: {} };
}

function saveRecord() {
  localStorage.setItem(RECORD_KEY, JSON.stringify(record));
  renderRecord();
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
      topTypes: ["safe", "balanced", "corners", "aggressive", "player"],
      allowHighVolatility: false
    };
  }

  if (settings.profile === "aggressive") {
    return {
      label: "🔥 Agresivo",
      minProbability: 0.42,
      parlayTypes: ["safe", "balanced", "corners", "aggressive", "player"],
      topTypes: ["safe", "balanced", "corners", "aggressive", "player", "score"],
      allowHighVolatility: true
    };
  }

  return {
    label: "🛡️ Seguro",
    minProbability: 0.70,
    parlayTypes: ["safe", "balanced", "corners"],
    topTypes: ["safe", "balanced", "corners"],
    allowHighVolatility: false
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

  return {
    score,
    label,
    emoji,
    context
  };
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
    probability = 0.57;
  }

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

    return {
      ...pick,
      probability,
      fairOdds,
      valueOdds,
      confidence: confidenceLabel(probability),
      risk: riskLabel(probability),
      safetyScore: 0,
      volatility
    };
  }).map(pick => ({
    ...pick,
    safetyScore: safetyScore({ pick, volatility })
  }));
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

function makeWhy(prediction, pick, match) {
  const fav = displayName(prediction.favorite.team);
  const volatility = getVolatility(prediction, match);
  const context = volatility.context;

  if (pick.type === "safe") {
    return `${pick.text} aparece como pick sólido porque ${fav} tiene expectativa de gol de ${prediction.favorite.lambda.toFixed(2)} y una probabilidad IA de ${formatPct(pick.probability)}. Volatilidad del partido: ${volatility.label}.`;
  }

  if (pick.type === "balanced") {
    return `${pick.text} depende más del resultado. El modelo favorece a ${fav}, pero ajusta la confianza por contexto: ${context.importance}.`;
  }

  if (pick.type === "aggressive") {
    return `${pick.text} tiene lógica, pero es volátil. Se recomienda solo como jugada pequeña o si el momio supera @${formatOdds(pick.valueOdds)}.`;
  }

  if (pick.type === "score") {
    return `El marcador ${prediction.score} es el más probable de la matriz, pero el marcador exacto siempre tiene varianza alta. No debe ir en parley de baja volatilidad.`;
  }

  if (pick.type === "corners") {
    return `El pick de córners es proxy de dominio ofensivo. Funciona mejor cuando el favorito proyecta más volumen, pero no sustituye datos reales de tiros/córners en vivo.`;
  }

  if (pick.type === "player") {
    return `El pick de jugador depende mucho de alineación confirmada y estado físico. Antes de la API debe tratarse como sugerencia, no como pick premium.`;
  }

  return "El modelo combina forma reciente, goles esperados, contexto y volatilidad.";
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
      candidates.push({
        match,
        prediction,
        volatility,
        pick
      });
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

  const combinedProbability = legs.reduce((acc, item) => acc * item.pick.probability, 1);
  const fairOdds = legs.length ? 1 / combinedProbability : 0;

  let risk = "Alto";
  if (combinedProbability >= 0.55) risk = "Bajo";
  else if (combinedProbability >= 0.35) risk = "Medio";

  return {
    legs,
    combinedProbability,
    fairOdds,
    risk
  };
}

function getAvoidedPicks(date) {
  return getCandidatesForDate(date)
    .filter(item => {
      if (item.pick.type === "score") return true;
      if (item.pick.type === "player" && settings.profile !== "aggressive") return true;
      if (item.volatility.label === "Alta" && ["balanced", "aggressive"].includes(item.pick.type)) return true;
      if (item.pick.probability < 0.42) return true;
      return false;
    })
    .slice(0, 5);
}

function pickKey(matchId, pickType) {
  return `${matchId}__${pickType}`;
}

function getPickState(matchId, pickType) {
  const key = pickKey(matchId, pickType);
  return record.pickStates[key]?.status || null;
}

function computeRecordStats() {
  const stats = {
    wins: 0,
    losses: 0,
    byType: {}
  };

  PICK_TYPES.forEach(type => {
    stats.byType[type.key] = { wins: 0, losses: 0 };
  });

  Object.values(record.pickStates || {}).forEach(item => {
    if (item.status === "win") {
      stats.wins++;
      stats.byType[item.type].wins++;
    }

    if (item.status === "loss") {
      stats.losses++;
      stats.byType[item.type].losses++;
    }
  });

  return stats;
}

function ensureRecordBlocks() {
  if (!document.getElementById("typeStats")) {
    resetBtn.insertAdjacentHTML("beforebegin", `<div id="typeStats" class="type-stats"></div>`);
  }

  if (!document.getElementById("historyList")) {
    resetBtn.insertAdjacentHTML(
      "beforebegin",
      `
      <h3 class="mini-title">Últimos resultados</h3>
      <div id="historyList" class="history-list"></div>
      `
    );
  }
}

function renderRecord() {
  ensureRecordBlocks();

  const stats = computeRecordStats();
  const total = stats.wins + stats.losses;

  winsEl.textContent = stats.wins;
  lossesEl.textContent = stats.losses;
  hitRateEl.textContent = total ? `${Math.round((stats.wins / total) * 100)}%` : "0%";

  renderTypeStats(stats);
  renderHistory();
}

function renderTypeStats(stats) {
  const typeStats = document.getElementById("typeStats");

  typeStats.innerHTML = PICK_TYPES.map(type => {
    const item = stats.byType[type.key];
    const total = item.wins + item.losses;
    const rate = total ? Math.round((item.wins / total) * 100) : 0;

    return `
      <div class="type-row">
        <div>
          <strong>${type.emoji} ${type.name}</strong>
          <span>${item.wins} buenas / ${item.losses} malas</span>
        </div>
        <div class="mini-rate">${rate}%</div>
      </div>
    `;
  }).join("");
}

function renderHistory() {
  const historyList = document.getElementById("historyList");

  const items = Object.values(record.pickStates || {})
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 8);

  if (!items.length) {
    historyList.innerHTML = `<p class="note">Todavía no has marcado ningún pick.</p>`;
    return;
  }

  historyList.innerHTML = items.map(item => `
    <div class="history-item">
      <strong>${item.status === "win" ? "✅" : "❌"} ${item.pick}</strong>
      <span>${item.match} · ${item.typeLabel}</span>
    </div>
  `).join("");
}

function togglePick(matchId, pickType, status) {
  const match = currentMatches.find(item => item.id === matchId);
  if (!match) return;

  const prediction = predictMatch(resultsData, match.home, match.away);
  const picks = getFullPicks(prediction, match);
  const pick = picks.find(item => item.type === pickType);
  if (!pick) return;

  const key = pickKey(matchId, pickType);
  const current = record.pickStates[key];

  if (current && current.status === status) {
    delete record.pickStates[key];
  } else {
    record.pickStates[key] = {
      matchId,
      type: pickType,
      typeLabel: pick.label,
      pick: pick.text,
      match: matchName(match),
      status,
      updatedAt: new Date().toISOString()
    };
  }

  saveRecord();
  renderMatch(match);
}

function renderSettingsPanel() {
  const rules = getProfileRules();

  return `
    <div class="settings-box">
      <div class="settings-head">
        <strong>Configuración del modelo</strong>
        <span>Modo actual: ${rules.label}</span>
      </div>

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
        Mostrar pick agresivo interesante
      </label>
    </div>
  `;
}

function updateSetting(key, value) {
  settings[key] = value;
  saveSettings();

  renderDailySuggestion();

  const match = currentMatches.find(item => item.id === select.value);
  if (match) renderMatch(match);
}

function renderDailyCard(title, item, subtitle) {
  if (!item) {
    return `
      <div class="daily-card">
        <span>${title}</span>
        <strong>Sin pick suficiente</strong>
        <small>El filtro actual es muy estricto</small>
        <em>—</em>
      </div>
    `;
  }

  return `
    <button class="daily-card" onclick="selectMatchById('${item.match.id}')">
      <span>${title}</span>
      <strong>${item.pick.text}</strong>
      <small>${matchName(item.match)}</small>
      <em>${subtitle} · IA ${formatPct(item.pick.probability)}</em>
    </button>
  `;
}

function renderParlay(date) {
  const parlay = buildParlay(date);

  if (!parlay.legs.length) {
    return `
      <div class="parlay-box">
        <h3>🧩 Parley recomendado</h3>
        <p class="note">No hay suficientes picks que pasen los filtros actuales.</p>
      </div>
    `;
  }

  return `
    <div class="parlay-box">
      <h3>🧩 Parley recomendado</h3>
      <p class="note">Perfil: <strong>${getProfileRules().label}</strong>. Ningún parley es seguro; esta es la combinación con menor volatilidad según tu configuración.</p>

      ${parlay.legs.map((item, index) => `
        <button class="parlay-leg" onclick="selectMatchById('${item.match.id}')">
          <span>${index + 1}</span>
          <div>
            <strong>${item.pick.text}</strong>
            <small>${matchName(item.match)} · IA ${formatPct(item.pick.probability)} · ${item.volatility.emoji} Volatilidad ${item.volatility.label}</small>
          </div>
        </button>
      `).join("")}

      <div class="parlay-summary">
        <div><strong>${formatPct(parlay.combinedProbability)}</strong><span>Prob. combinada</span></div>
        <div><strong>@${formatOdds(parlay.fairOdds)}</strong><span>Momio justo</span></div>
        <div><strong>${parlay.risk}</strong><span>Riesgo</span></div>
      </div>
    </div>
  `;
}

function renderAvoidedPicks(date) {
  const avoided = getAvoidedPicks(date);

  if (!avoided.length) {
    return "";
  }

  return `
    <div class="avoid-box">
      <h3>⚠️ Picks evitados</h3>
      <p class="note">No todo lo que aparece en el modelo debe jugarse.</p>

      ${avoided.map(item => `
        <div class="avoid-row">
          <strong>❌ ${item.pick.text}</strong>
          <span>${matchName(item.match)} · IA ${formatPct(item.pick.probability)} · Volatilidad ${item.volatility.label}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTopPicksList(date) {
  const ranked = getFilteredCandidates(date).slice(0, 8);

  if (!ranked.length) {
    return `<p class="note">No hay picks que superen los filtros actuales.</p>`;
  }

  return `
    <div class="top-picks-list">
      ${ranked.map((item, index) => `
        <button class="top-pick-row" onclick="selectMatchById('${item.match.id}')">
          <div class="rank">${index + 1}</div>
          <div>
            <strong>${item.pick.emoji} ${item.pick.text}</strong>
            <span>${matchName(item.match)} · IA ${formatPct(item.pick.probability)} · Riesgo ${item.pick.risk}</span>
          </div>
          <em>@${formatOdds(item.pick.fairOdds)}</em>
        </button>
      `).join("")}
    </div>
  `;
}

function renderDailySuggestion() {
  const selectedDate = dateSelect.value;
  const candidates = getCandidatesForDate(selectedDate);

  const solid = candidates
    .filter(item => ["safe", "corners"].includes(item.pick.type))
    .filter(item => item.volatility.label !== "Alta")
    .sort((a, b) => b.pick.safetyScore - a.pick.safetyScore)[0];

  const value = candidates
    .filter(item => ["safe", "balanced", "corners"].includes(item.pick.type))
    .filter(item => item.pick.probability >= 0.58)
    .filter(item => item.volatility.label !== "Alta")
    .sort((a, b) => a.pick.valueOdds - b.pick.valueOdds)[0];

  const risky = candidates
    .filter(item => ["aggressive", "score"].includes(item.pick.type))
    .filter(item => item.pick.probability >= 0.07 && item.pick.probability <= 0.45)
    .sort((a, b) => b.pick.probability - a.pick.probability)[0];

  dailySuggestion.innerHTML = `
    <h2>Sugerencia del día</h2>
    <p class="note">Fecha: <strong>${DATE_LABELS[selectedDate] || selectedDate}</strong>. La app revisa todos los partidos y filtra por seguridad.</p>

    ${renderSettingsPanel()}

    <div class="daily-grid">
      ${renderDailyCard("🛡️ Pick más sólido", solid, "Prioridad segura")}
      ${renderDailyCard("💰 Caza-value", value, value ? `Buscar momio arriba de @${formatOdds(value.pick.valueOdds)}` : "—")}
      ${settings.showAggressive ? renderDailyCard("🔥 Agresivo interesante", risky, "Separado del pick seguro") : ""}
    </div>

    ${renderParlay(selectedDate)}

    <h3 class="mini-title">Top picks según configuración</h3>
    ${renderTopPicksList(selectedDate)}

    ${renderAvoidedPicks(selectedDate)}
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
      <p class="note">Más brillante = marcador más probable según el modelo.</p>

      <div class="heatmap-labels">
        <div></div>
        <small>0</small>
        <small>1</small>
        <small>2</small>
        <small>3</small>
        <small>4</small>
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

      <div class="heatmap-teams">
        <small>${displayName(prediction.home)} = filas</small>
        <small>${displayName(prediction.away)} = columnas</small>
      </div>
    </div>
  `;
}

function renderPickCard(match, pick) {
  const state = getPickState(match.id, pick.type);
  const registeredClass = state ? "registered" : "";
  const stateClass = state === "win" ? "is-win" : state === "loss" ? "is-loss" : "";

  return `
    <div class="pick ${pick.type} ${registeredClass} ${stateClass}">
      <div class="pick-title">${pick.emoji} ${pick.label}</div>
      <strong>${pick.text}</strong>
      <p class="pick-meta">IA ${formatPct(pick.probability)} · Riesgo ${pick.risk} · Momio justo @${formatOdds(pick.fairOdds)}</p>

      ${state ? `
        <div class="result-status">
          ${state === "win" ? "✅ Registrado como cumplido" : "❌ Registrado como fallido"}
          <small>Toca el mismo botón para quitarlo o el otro para cambiarlo.</small>
        </div>
      ` : ""}

      <div class="actions">
        <button class="win ${state === "win" ? "active" : ""}" onclick="togglePick('${match.id}', '${pick.type}', 'win')">✅ Se cumplió</button>
        <button class="lose ${state === "loss" ? "active" : ""}" onclick="togglePick('${match.id}', '${pick.type}', 'loss')">❌ Falló</button>
      </div>
    </div>
  `;
}

function renderMatch(match) {
  const prediction = predictMatch(resultsData, match.home, match.away);
  const picks = getFullPicks(prediction, match);
  const players = getPlayerSuggestions(prediction.favorite);
  const volatility = getVolatility(prediction, match);
  const bestPick = [...picks].sort((a, b) => b.safetyScore - a.safetyScore)[0];

  card.innerHTML = `
    <h2 class="match-title">${matchName(match)}</h2>
    <p class="note">Predicción actual según datos disponibles. Favorito del modelo: <strong>${displayName(prediction.favorite.team)}</strong>.</p>

    <div class="prob-grid">
      <div class="prob"><strong>${prediction.probs.home}%</strong><span>${displayName(match.home)}</span></div>
      <div class="prob"><strong>${prediction.probs.draw}%</strong><span>Empate</span></div>
      <div class="prob"><strong>${prediction.probs.away}%</strong><span>${displayName(match.away)}</span></div>
    </div>

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

    <div class="why-box">
      <span>🧠 ¿Por qué?</span>
      <strong>${bestPick.text}</strong>
      <p>${makeWhy(prediction, bestPick, match)}</p>
    </div>

    <div class="value-box">
      <span>💰 Detector de value</span>

      <label for="valuePickSelect">Mercado</label>
      <select id="valuePickSelect" onchange="analyzeValue()">
        ${picks.map(pick => `
          <option value="${pick.type}">${pick.emoji} ${pick.text} · IA ${formatPct(pick.probability)}</option>
        `).join("")}
      </select>

      <label for="oddsInput">Momio decimal que ves</label>
      <input id="oddsInput" type="number" min="1.01" step="0.01" placeholder="Ejemplo: 1.85" oninput="analyzeValue()" />

      <div id="valueResult" class="value-result">
        Escribe un momio para saber si hay value.
      </div>
    </div>

    ${picks.map(pick => renderPickCard(match, pick)).join("")}

    <p class="note">
      Modelo actual: histórico + forma reciente + goles esperados + contexto manual + volatilidad. 
      Jugadores y córners siguen siendo proxy hasta conectar API en vivo.
    </p>
  `;
}

function analyzeValue() {
  const match = currentMatches.find(item => item.id === select.value);
  if (!match) return;

  const prediction = predictMatch(resultsData, match.home, match.away);
  const picks = getFullPicks(prediction, match);

  const valuePickSelect = document.getElementById("valuePickSelect");
  const oddsInput = document.getElementById("oddsInput");
  const result = document.getElementById("valueResult");

  if (!valuePickSelect || !oddsInput || !result) return;

  const selectedType = valuePickSelect.value;
  const odds = Number(oddsInput.value);
  const pick = picks.find(item => item.type === selectedType);

  if (!pick) return;

  if (!odds || odds <= 1) {
    result.innerHTML = "Escribe un momio decimal válido.";
    result.className = "value-result";
    return;
  }

  const implied = 1 / odds;
  const edge = pick.probability - implied;
  const ev = pick.probability * odds - 1;

  let label = "🔴 Sin value";
  let className = "value-result bad";

  if (edge >= 0.08 && ev > 0) {
    label = "🟢 Value fuerte";
    className = "value-result good";
  } else if (edge >= 0.03 && ev > 0) {
    label = "🟡 Value leve";
    className = "value-result mid";
  }

  result.className = className;
  result.innerHTML = `
    <strong>${label}</strong>
    <span>IA: ${formatPct(pick.probability)} · Casa: ${formatPct(implied)} · Edge: ${formatPct(edge)} · EV: ${formatPct(ev)}</span>
  `;
}

function buildDateOptions() {
  const dates = [...new Set(currentMatches.map(match => match.date))];

  dateSelect.innerHTML = dates.map(date => `
    <option value="${date}">${DATE_LABELS[date] || date}</option>
  `).join("");

  const today = new Date().toISOString().slice(0, 10);
  if (dates.includes(today)) {
    dateSelect.value = today;
  }
}

function buildMatchOptions() {
  const selectedDate = dateSelect.value;
  const matches = getMatchesByDate(selectedDate);

  select.innerHTML = matches.map(match => `
    <option value="${match.id}">${matchName(match)}</option>
  `).join("");
}

function selectMatchById(id) {
  const match = currentMatches.find(item => item.id === id);
  if (!match) return;

  dateSelect.value = match.date;
  buildMatchOptions();
  select.value = id;
  renderDailySuggestion();
  renderMatch(match);

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function init() {
  card.innerHTML = `
    <h2 class="match-title">Cargando datos...</h2>
    <p class="note">Conectando con el repositorio original y calculando modelo.</p>
  `;

  dailySuggestion.innerHTML = `
    <h2>Sugerencia del día</h2>
    <p class="note">Cargando configuración y modelo...</p>
  `;

  try {
    resultsData = await loadResults();

    currentMatches = UPCOMING_MATCHES.map(match => ({
      ...match,
      id: createMatchId(match)
    }));

    buildDateOptions();
    buildMatchOptions();
    renderRecord();
    renderDailySuggestion();

    const firstMatch = currentMatches.find(match => match.id === select.value);
    renderMatch(firstMatch);
  } catch (error) {
    card.innerHTML = `
      <h2 class="match-title">Error al cargar datos</h2>
      <p class="note">No se pudo conectar al CSV original. Revisa conexión o vuelve a intentar.</p>
    `;

    dailySuggestion.innerHTML = `
      <h2>Sugerencia del día</h2>
      <p class="note">No se pudo cargar el modelo.</p>
    `;

    console.error(error);
  }
}

dateSelect.addEventListener("change", () => {
  buildMatchOptions();
  renderDailySuggestion();

  const match = currentMatches.find(item => item.id === select.value);
  if (match) renderMatch(match);
});

select.addEventListener("change", () => {
  const match = currentMatches.find(item => item.id === select.value);
  if (match) renderMatch(match);
});

resetBtn.addEventListener("click", () => {
  const confirmReset = confirm("¿Seguro que quieres borrar todo tu historial?");
  if (!confirmReset) return;

  record = { pickStates: {} };
  saveRecord();

  const match = currentMatches.find(item => item.id === select.value);
  if (match) renderMatch(match);
});

init();
