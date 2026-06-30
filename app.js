const STORAGE_KEYS = {
  settings: "matchiq_v23_settings",
  tickets: "matchiq_v2_tickets_master",
  cart: "matchiq_v23_cart",
  reviews: "matchiq_v23_pick_reviews",
  activeTab: "matchiq_v23_active_tab"
};

const APP_BUILD_VERSION = "2.3.2";

const screens = {
  home: document.getElementById("homeScreen"),
  ml: document.getElementById("mlScreen"),
  ai: document.getElementById("aiScreen"),
  ticket: document.getElementById("ticketScreen"),
  profile: document.getElementById("profileScreen")
};

const state = {
  activeTab: localStorage.getItem(STORAGE_KEYS.activeTab) || "home",
  results: [],
  mlPredictions: [],
  matches: [],
  selectedDate: "2026-06-30",
  selectedMlMatchId: null,
  selectedAiMatchId: null,
  cart: readJson(STORAGE_KEYS.cart, []),
  tickets: readJson(STORAGE_KEYS.tickets, []),
  reviews: readJson(STORAGE_KEYS.reviews, {}),
  settings: readJson(STORAGE_KEYS.settings, {
    sessionName: "Dieciseisavos 2026",
    bankroll: 300,
    defaultOdds: 1.80,
    defaultStake: 50
  })
};


const TEAM_FLAGS = {
  "South Africa": "🇿🇦",
  "Canada": "🇨🇦",
  "Ivory Coast": "🇨🇮",
  "United States": "🇺🇸",
  "Bosnia and Herzegovina": "🇧🇦",
  "DR Congo": "🇨🇩",
  "Cape Verde": "🇨🇻",
  "Switzerland": "🇨🇭",
  "Algeria": "🇩🇿",
  "Netherlands": "🇳🇱",
  "Germany": "🇩🇪",
  "Japan": "🇯🇵",
  "Morocco": "🇲🇦",
  "Paraguay": "🇵🇾",
  "Norway": "🇳🇴",
  "France": "🇫🇷",
  "Sweden": "🇸🇪",
  "Mexico": "🇲🇽",
  "Ecuador": "🇪🇨",
  "England": "🏴",
  "Belgium": "🇧🇪",
  "Senegal": "🇸🇳",
  "Spain": "🇪🇸",
  "Austria": "🇦🇹",
  "Portugal": "🇵🇹",
  "Croatia": "🇭🇷",
  "Australia": "🇦🇺",
  "Egypt": "🇪🇬",
  "Argentina": "🇦🇷",
  "Colombia": "🇨🇴",
  "Ghana": "🇬🇭",
  "Brazil": "🇧🇷"
};

const TEAM_CANONICAL = {
  "USA": "United States",
  "Congo DR": "DR Congo",
  "Cote d'Ivoire": "Ivory Coast",
  "Côte d'Ivoire": "Ivory Coast",
  "Cape Verde": "Cape Verde",
  "Bosnia": "Bosnia and Herzegovina"
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeTeam(name) {
  return TEAM_CANONICAL[name] || name;
}

function teamLabel(name) {
  return DISPLAY_NAMES?.[normalizeTeam(name)] || name;
}

function teamFlag(name) {
  return TEAM_FLAGS[normalizeTeam(name)] || "⚽";
}

function teamDisplay(name) {
  return `${teamFlag(name)} ${teamLabel(name)}`;
}

function matchTitle(match) {
  return `${teamLabel(match.home)} vs ${teamLabel(match.away)}`;
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

function pct(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function dateLabel(date) {
  return DATE_LABELS?.[date] || date;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function getDates() {
  return [...new Set([
    ...state.matches.map(match => match.date),
    ...state.mlPredictions.map(match => match.date)
  ])].sort();
}

function getDefaultDate() {
  const dates = getDates();
  if (dates.includes("2026-06-30")) return "2026-06-30";
  return dates[0] || "2026-06-30";
}

function findPhaseMatch(mlMatch) {
  if (!mlMatch) return null;
  const home = normalizeTeam(mlMatch.home);
  const away = normalizeTeam(mlMatch.away);
  return state.matches.find(match =>
    normalizeTeam(match.home) === home &&
    normalizeTeam(match.away) === away
  );
}

function mlById(matchId) {
  return state.mlPredictions.find(match => String(match.match_id) === String(matchId));
}

function aiById(matchId) {
  return state.matches.find(match => String(match.id) === String(matchId));
}

function marketsFromMl(match) {
  const markets = match?.goals?.markets || {};
  return [
    { label: "Over 1.5 goles", value: markets.over_1_5, type: "goals" },
    { label: "Over 2.5 goles", value: markets.over_2_5, type: "goals" },
    { label: "Under 3.5 goles", value: markets.under_3_5, type: "goals" },
    { label: "Ambos anotan SÍ", value: markets.btts_yes, type: "goals" },
    { label: "Ambos anotan NO", value: markets.btts_no, type: "goals" }
  ].filter(item => Number.isFinite(Number(item.value)));
}

function topMlPicks(date = state.selectedDate) {
  return state.mlPredictions
    .filter(match => match.date === date)
    .flatMap(match => (match.top_picks || []).map(pick => ({
      ...pick,
      source: "ML",
      matchId: match.match_id,
      date: match.date,
      home: match.home,
      away: match.away,
      matchTitle: matchTitle(match)
    })))
    .sort((a, b) => (b.probability || 0) - (a.probability || 0));
}

function makeReviewKey(pick) {
  return [
    pick.source || "pick",
    pick.matchId || pick.id || `${pick.home}-${pick.away}`,
    pick.market || pick.pick || pick.label || pick.title
  ].join("|").toLowerCase();
}

function getReviewStatus(key) {
  return state.reviews[key]?.status || "pending";
}

function setPickReview(key, status) {
  state.reviews[key] = {
    status,
    updatedAt: new Date().toISOString()
  };
  writeJson(STORAGE_KEYS.reviews, state.reviews);
  renderAll();
  toast(status === "win" ? "Marcado como acertado" : status === "loss" ? "Marcado como fallado" : "Estado actualizado");
}

function encoded(value) {
  return encodeURIComponent(String(value));
}

function encodedPick(pick) {
  return encodeURIComponent(JSON.stringify(pick));
}

function addPickToCartEncoded(payload) {
  try {
    addPickToCart(JSON.parse(decodeURIComponent(payload)));
  } catch (error) {
    console.error(error);
    toast("No se pudo agregar el pick");
  }
}

function setPickReviewEncoded(key, status) {
  setPickReview(decodeURIComponent(key), status);
}

function reviewControls(pick) {
  const key = makeReviewKey(pick);
  const safeKey = encoded(key);
  const current = getReviewStatus(key);
  const buttons = [
    ["pending", "Pend."],
    ["win", "Acierta"],
    ["loss", "Falla"],
    ["void", "Nulo"]
  ];
  return `
    <div class="review-row" aria-label="Evaluar pick">
      ${buttons.map(([status, label]) => `
        <button class="review-btn ${current === status ? "active" : ""}" type="button"
          onclick="setPickReviewEncoded('${safeKey}','${status}')">${label}</button>
      `).join("")}
    </div>
  `;
}

function addPickToCart(pick) {
  const normalized = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    key: makeReviewKey(pick),
    source: pick.source || "IA",
    matchId: pick.matchId || pick.id,
    matchTitle: pick.matchTitle || `${teamLabel(pick.home)} vs ${teamLabel(pick.away)}`,
    market: pick.market || pick.pick || pick.label,
    probability: Math.round((pick.probability || pick.prob || 0) * (pick.probability <= 1 ? 100 : 1)),
    fairOdds: pick.fair_odds || pick.fairOdds || pick.justOdds || "",
    strength: pick.strength || pick.quality || "lean",
    risk: pick.risk || "medio",
    legStatus: "pending"
  };

  const duplicate = state.cart.some(item => item.key === normalized.key);
  if (!duplicate) state.cart.push(normalized);
  writeJson(STORAGE_KEYS.cart, state.cart);
  renderAll();
  toast(duplicate ? "Ese pick ya está en el ticket" : "Pick agregado al ticket");
}

function removeCartPick(id) {
  state.cart = state.cart.filter(item => item.id !== id);
  writeJson(STORAGE_KEYS.cart, state.cart);
  renderAll();
}

function clearCart() {
  state.cart = [];
  writeJson(STORAGE_KEYS.cart, state.cart);
  renderAll();
}

function saveTicket() {
  if (!state.cart.length) {
    toast("Agrega al menos un pick");
    return;
  }

  const odds = Number(document.getElementById("ticketOdds")?.value || state.settings.defaultOdds);
  const stake = Number(document.getElementById("ticketStake")?.value || state.settings.defaultStake);
  const ticket = {
    id: `ticket-${Date.now()}`,
    createdAt: new Date().toISOString(),
    odds,
    stake,
    status: "pending",
    legs: state.cart.map(item => ({ ...item }))
  };

  state.tickets.unshift(ticket);
  state.cart = [];
  writeJson(STORAGE_KEYS.tickets, state.tickets);
  writeJson(STORAGE_KEYS.cart, state.cart);
  renderAll();
  toast("Ticket guardado");
}

function deriveTicketStatus(ticket) {
  const statuses = ticket.legs.map(leg => leg.legStatus || "pending");
  if (statuses.includes("loss")) return "lost";
  const active = statuses.filter(status => status !== "void");
  if (!active.length) return "void";
  if (active.every(status => status === "win")) return "won";
  return "pending";
}

function ticketProfit(ticket) {
  const status = deriveTicketStatus(ticket);
  if (status === "won") return ticket.stake * ticket.odds - ticket.stake;
  if (status === "lost") return -ticket.stake;
  return 0;
}

function setPickStatus(ticketId, pickId, status) {
  const ticket = state.tickets.find(item => item.id === ticketId);
  if (!ticket) return;
  const leg = ticket.legs.find(item => item.id === pickId);
  if (!leg) return;
  leg.legStatus = status;
  ticket.status = deriveTicketStatus(ticket);
  ticket.settledAt = ticket.status === "pending" ? null : new Date().toISOString();
  writeJson(STORAGE_KEYS.tickets, state.tickets);
  renderAll();
}

function saveProfileSettings() {
  state.settings.sessionName = document.getElementById("sessionName")?.value || state.settings.sessionName;
  state.settings.bankroll = Number(document.getElementById("bankrollInput")?.value || state.settings.bankroll);
  state.settings.defaultStake = Number(document.getElementById("defaultStake")?.value || state.settings.defaultStake);
  state.settings.defaultOdds = Number(document.getElementById("defaultOdds")?.value || state.settings.defaultOdds);
  writeJson(STORAGE_KEYS.settings, state.settings);
  renderAll();
  toast("Perfil guardado");
}

function sessionStats() {
  const bankroll = Number(state.settings.bankroll || 0);
  const closedProfit = state.tickets.reduce((sum, ticket) => sum + ticketProfit(ticket), 0);
  const pendingRisk = state.tickets
    .filter(ticket => deriveTicketStatus(ticket) === "pending")
    .reduce((sum, ticket) => sum + Number(ticket.stake || 0), 0);
  const current = bankroll + closedProfit;
  const available = current - pendingRisk;
  const closedStake = state.tickets
    .filter(ticket => deriveTicketStatus(ticket) !== "pending")
    .reduce((sum, ticket) => sum + Number(ticket.stake || 0), 0);
  const roi = closedStake ? (closedProfit / closedStake) * 100 : 0;
  return { bankroll, current, available, pendingRisk, closedProfit, roi };
}

function reviewStats() {
  const values = Object.values(state.reviews);
  const wins = values.filter(item => item.status === "win").length;
  const losses = values.filter(item => item.status === "loss").length;
  const voids = values.filter(item => item.status === "void").length;
  const total = wins + losses;
  return {
    wins,
    losses,
    voids,
    pending: values.filter(item => item.status === "pending").length,
    total,
    hitRate: total ? (wins / total) * 100 : 0
  };
}

function switchTab(tab) {
  state.activeTab = tab;
  localStorage.setItem(STORAGE_KEYS.activeTab, tab);
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
  screens[tab]?.classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (badge) badge.textContent = state.cart.length;
}

function toast(message) {
  const node = document.getElementById("appToast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => node.classList.remove("show"), 1900);
}

function renderDateChips(context) {
  return `
    <div class="chip-row">
      ${getDates().map(date => `
        <button class="date-chip ${state.selectedDate === date ? "active" : ""}" type="button"
          onclick="selectDate('${date}', '${context}')">${dateLabel(date)}</button>
      `).join("")}
    </div>
  `;
}

function selectDate(date, context = state.activeTab) {
  state.selectedDate = date;
  const mlMatch = state.mlPredictions.find(match => match.date === date);
  const aiMatch = state.matches.find(match => match.date === date);
  if (mlMatch) state.selectedMlMatchId = mlMatch.match_id;
  if (aiMatch) state.selectedAiMatchId = aiMatch.id;
  state.activeTab = context;
  renderAll();
}

function selectMlMatch(matchId) {
  state.selectedMlMatchId = matchId;
  renderMl();
}

function selectAiMatch(matchId) {
  state.selectedAiMatchId = matchId;
  renderAi();
}

function renderHome() {
  const picks = topMlPicks(state.selectedDate).slice(0, 5);
  const todayMatches = state.mlPredictions.filter(match => match.date === state.selectedDate);
  const stats = sessionStats();

  screens.home.innerHTML = `
    <section class="hero-card">
      <p class="eyebrow">Hoy en MatchIQ</p>
      <h2>${dateLabel(state.selectedDate)}</h2>
      <p>Recomendados y partidos del día. Sin ruido, solo lo que toca revisar.</p>
    </section>

    ${renderDateChips("home")}

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Recomendados</p>
          <h2>Top picks del día</h2>
        </div>
        <span class="mini-pill">${picks.length} picks</span>
      </div>
      <div class="stack">
        ${picks.length ? picks.map(renderPickCard).join("") : renderEmpty("No hay picks ML para esta fecha.")}
      </div>
    </section>

    <section class="panel compact-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Agenda</p>
          <h2>Partidos del día</h2>
        </div>
        <span class="mini-pill">${formatMoney(stats.available)} disp.</span>
      </div>
      <div class="match-list">
        ${todayMatches.map(match => `
          <button class="match-row" type="button" onclick="openMlMatch('${match.match_id}')">
            <span>${matchTitle(match)}</span>
            <small>${match.goals?.score_zone || "Zona pendiente"} · ${match.corners?.expected_range || "Corners por estimar"}</small>
          </button>
        `).join("") || renderEmpty("No hay partidos para esta fecha.")}
      </div>
    </section>
  `;
}

function openMlMatch(matchId) {
  state.selectedMlMatchId = matchId;
  switchTab("ml");
}

function renderMl() {
  const matches = state.mlPredictions.filter(match => match.date === state.selectedDate);
  if (!state.selectedMlMatchId || !mlById(state.selectedMlMatchId)) {
    state.selectedMlMatchId = matches[0]?.match_id || state.mlPredictions[0]?.match_id;
  }
  const selected = mlById(state.selectedMlMatchId);

  screens.ml.innerHTML = `
    <section class="page-title">
      <p class="eyebrow">Motor Python</p>
      <h2>Predicciones ML</h2>
      <p>Goles, ambos anotan y corners con datos procesados. Aquí vive lo robusto.</p>
    </section>

    ${renderDateChips("ml")}
    ${renderMatchSelector(matches, selected?.match_id, "selectMlMatch")}

    ${selected ? renderMlDetail(selected) : renderEmpty("No hay predicciones ML cargadas.")}
  `;
}

function renderMatchSelector(matches, selectedId, handler) {
  return `
    <div class="selector-strip">
      ${matches.map(match => `
        <button class="selector-chip ${String(selectedId) === String(match.match_id || match.id) ? "active" : ""}" type="button"
          onclick="${handler}('${match.match_id || match.id}')">${matchTitle(match)}</button>
      `).join("")}
    </div>
  `;
}

function translateMarketText(text, match) {
  const value = String(text || "Pick");
  return value
    .replace("Total goals over", "Total goles +")
    .replace("Total goals under", "Total goles -")
    .replace("Total corners over", "Total córners +")
    .replace("Total corners under", "Total córners -")
    .replace("BTTS yes", "Ambos anotan SÍ")
    .replace("BTTS no", "Ambos anotan NO")
    .replace(match?.home || "__home__", teamDisplay(match?.home))
    .replace(match?.away || "__away__", teamDisplay(match?.away));
}

function pickDisplayTitle(pick) {
  const raw = pick.text || pick.market || pick.pick || pick.label || "Pick";
  const match = { home: pick.home, away: pick.away };
  return translateMarketText(raw, match);
}

function strongestMlPick(match) {
  const picks = match?.top_picks || [];
  if (!picks.length) return "Sin pick fuerte todavía";
  const top = [...picks].sort((a, b) => Number(b.probability || 0) - Number(a.probability || 0))[0];
  return `${translateMarketText(top.market, match)} (${Math.round(top.probability || 0)}%)`;
}

function renderMlExplanation(match) {
  const goals = match.goals || {};
  const corners = match.corners || {};
  const totalGoals = Number(goals.expected_total_goals || 0).toFixed(2);
  const homeGoals = Number(goals.expected_home_goals || 0).toFixed(2);
  const awayGoals = Number(goals.expected_away_goals || 0).toFixed(2);
  const cornersTotal = Number(corners.expected_total_corners || 0).toFixed(2);
  const btts = Math.round(goals.markets?.btts_yes || 0);
  const over15 = Math.round(goals.markets?.over_1_5 || 0);
  return `
    <section class="panel explanation-card">
      <div class="section-head">
        <div>
          <p class="eyebrow">Explicación ML</p>
          <h2>Por qué el modelo lo ve así</h2>
        </div>
        <span class="mini-pill">Dato ${escapeHtml(goals.quality || corners.quality || "medio")}</span>
      </div>
      <div class="explain-grid">
        <article><span>${teamDisplay(match.home)}</span><strong>${homeGoals} xG</strong></article>
        <article><span>${teamDisplay(match.away)}</span><strong>${awayGoals} xG</strong></article>
        <article><span>Total goles</span><strong>${totalGoals}</strong></article>
        <article><span>Total córners</span><strong>${cornersTotal}</strong></article>
      </div>
      <p class="explain-copy">
        El pick principal sale de combinar goles esperados, probabilidad de mercado, riesgo KO y calidad de muestra.
        Para este partido, el motor ve <b>${strongestMlPick(match)}</b>. Over 1.5 marca ${over15}% y BTTS Sí ${btts}%.
      </p>
      <p class="explain-note">Riesgo: ${escapeHtml(goals.risk || corners.risk || "medio")} · Rango córners: ${escapeHtml(corners.expected_range || "sin rango")}</p>
    </section>
  `;
}

function renderAiExplanation(match, prediction) {
  const favorite = prediction.favorite?.team || match.home;
  const favoriteProb = Math.round((prediction.favorite?.prob || 0) * 100);
  const dcProb = clampPercent((prediction.favorite?.prob || 0) * 100 + (prediction.rawProbs?.draw || 0) * 100);
  const qualifiesPick = prediction.heatMap?.find(pick => pick.type === "qualifies");
  const qualifiesProb = qualifiesPick ? Math.round((qualifiesPick.probability || 0) * 100) : "-";
  const btts = Math.round((prediction.bttsYes || 0) * 100);
  return `
    <section class="panel explanation-card">
      <div class="section-head">
        <div>
          <p class="eyebrow">Lectura IA</p>
          <h2>Qué está interpretando</h2>
        </div>
        <span class="mini-pill">${teamDisplay(favorite)}</span>
      </div>
      <div class="explain-grid">
        <article><span>Favorito 90 min</span><strong>${teamDisplay(favorite)} ${favoriteProb}%</strong></article>
        <article><span>Doble oportunidad</span><strong>${teamDisplay(favorite)} / Empate ${dcProb}%</strong></article>
        <article><span>Clasifica</span><strong>${teamDisplay(favorite)} ${qualifiesProb}%</strong></article>
        <article><span>BTTS Sí</span><strong>${btts}%</strong></article>
      </div>
      <p class="explain-copy">
        La IA separa ganador en 90 minutos de clasificar. También separa doble oportunidad, goles por equipo y mercados de ritmo.
        Las barras ya muestran el equipo cuando el mercado depende de un lado específico.
      </p>
    </section>
  `;
}

function renderMlDetail(match) {
  const markets = marketsFromMl(match);
  const picks = (match.top_picks || []).map(pick => ({
    ...pick,
    source: "ML",
    matchId: match.match_id,
    home: match.home,
    away: match.away,
    matchTitle: matchTitle(match)
  }));

  return `
    <section class="match-hero">
      <div>
        <p class="eyebrow">${match.date}</p>
        <h2>${matchTitle(match)}</h2>
        <p>${match.goals?.quality || "team_data"} · riesgo ${match.goals?.risk || "medio"}</p>
      </div>
      <div class="score-zone">${match.goals?.score_zone || "1-1 / 2-1"}</div>
    </section>

    <section class="grid-two">
      <article class="metric-card">
        <span>Goles esperados</span>
        <strong>${Number(match.goals?.expected_total_goals || 0).toFixed(2)}</strong>
        <small>${teamLabel(match.home)} ${match.goals?.expected_home_goals ?? "-"} · ${teamLabel(match.away)} ${match.goals?.expected_away_goals ?? "-"}</small>
      </article>
      <article class="metric-card">
        <span>Corners esperados</span>
        <strong>${Number(match.corners?.expected_total_corners || 0).toFixed(2)}</strong>
        <small>${match.corners?.expected_range || "Rango pendiente"} · ${match.corners?.quality || "medium"}</small>
      </article>
    </section>

    ${renderMlExplanation(match)}

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Probabilidades</p>
          <h2>Mercados principales</h2>
        </div>
      </div>
      <div class="bar-list">
        ${markets.map(market => renderProbabilityBar(market.label, market.value)).join("")}
        ${match.corners?.main_pick ? renderProbabilityBar(match.corners.main_pick, match.corners.probability) : ""}
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Entradas</p>
          <h2>Picks ML evaluables</h2>
        </div>
        <span class="mini-pill">Marca acierto/falla aunque no apuestes</span>
      </div>
      <div class="stack">${picks.map(renderPickCard).join("")}</div>
    </section>
  `;
}

function renderAi() {
  const matches = state.matches.filter(match => match.date === state.selectedDate);
  if (!state.selectedAiMatchId || !aiById(state.selectedAiMatchId)) {
    state.selectedAiMatchId = matches[0]?.id || state.matches[0]?.id;
  }
  const selected = aiById(state.selectedAiMatchId);
  const prediction = selected ? predictMatch(state.results, selected) : null;

  screens.ai.innerHTML = `
    <section class="page-title">
      <p class="eyebrow">Modelo IA</p>
      <h2>Mapa de calor clásico</h2>
      <p>Lectura de guion, mercados del modelo y mapa de marcador. Separado del ML robusto.</p>
    </section>

    ${renderDateChips("ai")}
    ${renderMatchSelector(matches, selected?.id, "selectAiMatch")}

    ${prediction ? renderAiDetail(selected, prediction) : renderEmpty("No hay partido seleccionado.")}
  `;
}

function renderAiDetail(match, prediction) {
  const heatPicks = (prediction.heatMap || []).slice(0, 8).map(pick => ({
    ...pick,
    source: "IA",
    matchId: match.id,
    home: match.home,
    away: match.away,
    matchTitle: matchTitle(match),
    market: pick.pick || pick.label
  }));

  return `
    <section class="match-hero">
      <div>
        <p class="eyebrow">${prediction.modelLabel}</p>
        <h2>${matchTitle(match)}</h2>
        <p>Goles esperados ${prediction.expectedGoals.toFixed(2)} · corners ${prediction.expectedCorners.total}</p>
      </div>
      <div class="score-zone">${prediction.score}</div>
    </section>

    <section class="three-probs">
      ${renderOutcomeCard(teamDisplay(match.home), prediction.probs.home)}
      ${renderOutcomeCard("Empate", prediction.probs.draw)}
      ${renderOutcomeCard(teamDisplay(match.away), prediction.probs.away)}
    </section>

    ${renderAiExplanation(match, prediction)}

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Ambos anotan</p>
          <h2>BTTS</h2>
        </div>
      </div>
      ${renderSplitBar(`${teamDisplay(match.home)} y ${teamDisplay(match.away)} anotan SÍ`, prediction.bttsYes * 100, "No", prediction.bttsNo * 100)}
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Heat</p>
          <h2>Mercados IA</h2>
        </div>
      </div>
      <div class="stack">${heatPicks.map(renderPickCard).join("")}</div>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Marcador</p>
          <h2>Mapa de calor</h2>
        </div>
      </div>
      ${renderScoreHeatmap(prediction.topScores)}
    </section>
  `;
}

function renderOutcomeCard(label, value) {
  return `
    <article class="outcome-card">
      <span>${escapeHtml(label)}</span>
      <strong>${pct(value)}</strong>
    </article>
  `;
}

function renderSplitBar(leftLabel, leftValue, rightLabel, rightValue) {
  const left = clampPercent(leftValue);
  const right = clampPercent(rightValue);
  return `
    <div class="split-bar">
      <div style="width:${left}%"></div>
    </div>
    <div class="split-labels">
      <strong>${leftLabel} ${left}%</strong>
      <strong>${rightLabel} ${right}%</strong>
    </div>
  `;
}

function renderProbabilityBar(label, value) {
  const width = clampPercent(value);
  return `
    <div class="prob-row">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>${width}%</span>
      </div>
      <div class="prob-track"><i style="width:${width}%"></i></div>
    </div>
  `;
}

function renderPickCard(pick) {
  const probability = Math.round((pick.probability || pick.prob || pick.heatScore || 0) * ((pick.probability || pick.prob || 0) <= 1 ? 100 : 1));
  const market = pickDisplayTitle(pick);
  const strength = pick.strength || pick.quality || pick.dataQuality || "lean";
  const risk = pick.risk || pick.riskLabel || "medio";
  const source = pick.source || "IA";

  return `
    <article class="pick-card ${strength === "strong" ? "strong" : "lean"}">
      <div class="pick-main">
        <div>
          <span class="source-pill">${source}</span>
          <h3>${escapeHtml(market)}</h3>
          <p>${escapeHtml(pick.matchTitle || matchTitle(pick))}</p>
        </div>
        <strong>${probability ? `${probability}%` : "Heat"}</strong>
      </div>
      <div class="pick-meta">
        <span>${escapeHtml(strength)}</span>
        <span>Riesgo ${escapeHtml(risk)}</span>
        ${pick.fair_odds || pick.fairOdds || pick.justOdds ? `<span>Justo ${pick.fair_odds || pick.fairOdds || pick.justOdds}</span>` : ""}
      </div>
      ${reviewControls(pick)}
      <div class="card-actions">
        <button class="secondary-btn" type="button" onclick="addPickToCartEncoded('${encodedPick(pick)}')">Agregar al ticket</button>
      </div>
    </article>
  `;
}

function renderScoreHeatmap(scores) {
  const list = (scores || []).slice(0, 8);
  return `
    <div class="score-grid">
      ${list.map(score => `
        <div class="score-cell">
          <strong>${score.score}</strong>
          <span>${Math.round((score.probability || 0) * 100)}%</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTicket() {
  screens.ticket.innerHTML = `
    <section class="page-title">
      <p class="eyebrow">Ticket</p>
      <h2>Constructor de parley</h2>
      <p>Agrega picks desde ML o IA y evalúa cada pick por separado.</p>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">En preparación</p>
          <h2>Ticket actual</h2>
        </div>
        <button class="ghost-btn" type="button" onclick="clearCart()">Limpiar</button>
      </div>
      <div class="stack">
        ${state.cart.length ? state.cart.map(item => `
          <article class="ticket-leg">
            <div>
              <strong>${escapeHtml(item.market)}</strong>
              <span>${escapeHtml(item.matchTitle)} · ${item.source}</span>
            </div>
            <button class="icon-close" type="button" onclick="removeCartPick('${item.id}')">×</button>
          </article>
        `).join("") : renderEmpty("Todavía no agregas picks.")}
      </div>
      <div class="ticket-form">
        <label>Momio total <input id="ticketOdds" type="number" step="0.01" value="${state.settings.defaultOdds}"></label>
        <label>Stake <input id="ticketStake" type="number" step="1" value="${state.settings.defaultStake}"></label>
      </div>
      <button class="primary-btn" type="button" onclick="saveTicket()">Guardar ticket</button>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Historial</p>
          <h2>Tickets guardados</h2>
        </div>
      </div>
      <div class="stack">
        ${state.tickets.length ? state.tickets.map(renderSavedTicket).join("") : renderEmpty("Sin tickets guardados.")}
      </div>
    </section>
  `;
}

function renderSavedTicket(ticket) {
  const status = deriveTicketStatus(ticket);
  const profit = ticketProfit(ticket);
  return `
    <article class="saved-ticket">
      <div class="ticket-head">
        <div>
          <strong>${ticket.legs.length} picks · ${status.toUpperCase()}</strong>
          <span>Stake ${formatMoney(ticket.stake)} · Momio ${ticket.odds}</span>
        </div>
        <b class="${profit >= 0 ? "profit" : "loss"}">${formatMoney(profit)}</b>
      </div>
      <div class="stack tight">
        ${ticket.legs.map(leg => `
          <div class="leg-status-row">
            <div>
              <strong>${escapeHtml(leg.market)}</strong>
              <span>${escapeHtml(leg.matchTitle)}</span>
            </div>
            <div class="mini-actions">
              ${["pending", "win", "loss", "void"].map(statusValue => `
                <button class="${leg.legStatus === statusValue ? "active" : ""}" type="button"
                  onclick="setPickStatus('${ticket.id}','${leg.id}','${statusValue}')">${statusLabel(statusValue)}</button>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function statusLabel(status) {
  return ({ pending: "Pend.", win: "Sí", loss: "No", void: "Nulo" })[status] || status;
}

function getReviewExportRows() {
  const rows = [];
  for (const [key, value] of Object.entries(state.reviews || {})) {
    const [source, matchId, market] = key.split("|");
    rows.push({
      source: source || "",
      match_id: matchId || "",
      market: market || "",
      status: value.status || "pending",
      updated_at: value.updatedAt || ""
    });
  }
  state.tickets.forEach(ticket => {
    ticket.legs.forEach(item => {
      rows.push({
        source: item.source || "ticket",
        match_id: item.matchId || "",
        market: item.market || "",
        status: item.legStatus || "pending",
        updated_at: ticket.settledAt || ticket.createdAt || "",
        match_title: item.matchTitle || "",
        ticket_id: ticket.id,
        probability: item.probability || "",
        odds: ticket.odds || "",
        stake: ticket.stake || ""
      });
    });
  });
  return rows;
}

function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  const columns = ["source", "match_id", "match_title", "market", "status", "probability", "ticket_id", "odds", "stake", "updated_at"];
  const escapeCell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns.join(","), ...rows.map(row => columns.map(col => escapeCell(row[col])).join(","))].join("\n");
}

function exportFeedback(format = "csv") {
  const rows = getReviewExportRows();
  if (!rows.length) {
    toast("Todavía no hay feedback para exportar");
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    downloadText(`matchiq-feedback-${stamp}.json`, JSON.stringify(rows, null, 2), "application/json");
  } else {
    downloadText(`matchiq-feedback-${stamp}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  }
  toast("Feedback exportado");
}

function renderProfile() {
  const stats = sessionStats();
  const reviews = reviewStats();
  screens.profile.innerHTML = `
    <section class="page-title">
      <p class="eyebrow">Perfil</p>
      <h2>Sesión y aprendizaje</h2>
      <p>Control de bankroll, resultados y evaluación de picks.</p>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Sesión activa</p>
          <h2>${escapeHtml(state.settings.sessionName)}</h2>
        </div>
      </div>
      <div class="stats-grid">
        ${renderStat("Bankroll", formatMoney(stats.current))}
        ${renderStat("Disponible", formatMoney(stats.available))}
        ${renderStat("Riesgo pendiente", formatMoney(stats.pendingRisk))}
        ${renderStat("ROI cerrado", `${stats.roi.toFixed(1)}%`)}
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Feedback</p>
          <h2>Picks evaluados</h2>
        </div>
      </div>
      <div class="stats-grid">
        ${renderStat("Aciertos", reviews.wins)}
        ${renderStat("Fallos", reviews.losses)}
        ${renderStat("Nulos", reviews.voids)}
        ${renderStat("Precisión", `${reviews.hitRate.toFixed(1)}%`)}
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Retroalimentación</p>
          <h2>Exportar para Python</h2>
        </div>
      </div>
      <p class="explain-copy">Exporta los picks marcados en la app. Después se pueden meter al módulo de backtest para comparar aciertos, fallos y mercados.</p>
      <div class="export-actions">
        <button class="secondary-btn" type="button" onclick="exportFeedback('csv')">Exportar CSV</button>
        <button class="ghost-btn" type="button" onclick="exportFeedback('json')">Exportar JSON</button>
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Ajustes</p>
          <h2>Datos de sesión</h2>
        </div>
      </div>
      <div class="profile-form">
        <label>Nombre <input id="sessionName" value="${escapeHtml(state.settings.sessionName)}"></label>
        <label>Bankroll <input id="bankrollInput" type="number" value="${state.settings.bankroll}"></label>
        <label>Stake default <input id="defaultStake" type="number" value="${state.settings.defaultStake}"></label>
        <label>Momio default <input id="defaultOdds" type="number" step="0.01" value="${state.settings.defaultOdds}"></label>
      </div>
      <button class="primary-btn" type="button" onclick="saveProfileSettings()">Guardar ajustes</button>
    </section>
  `;
}

function renderStat(label, value) {
  return `
    <article class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderEmpty(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function renderAll() {
  updateCartBadge();
  if (state.activeTab === "home") renderHome();
  if (state.activeTab === "ml") renderMl();
  if (state.activeTab === "ai") renderAi();
  if (state.activeTab === "ticket") renderTicket();
  if (state.activeTab === "profile") renderProfile();
}

async function loadMlPredictions() {
  try {
    const response = await fetch(`matchiq-predictions-final.json?v=${APP_BUILD_VERSION}`, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar ML JSON");
    return await response.json();
  } catch (error) {
    console.warn(error);
    return [];
  }
}

async function init() {
  state.matches = Array.isArray(PHASE_MATCHES) ? PHASE_MATCHES : [];
  state.mlPredictions = await loadMlPredictions();
  state.results = typeof loadResults === "function" ? await loadResults().catch(() => []) : [];
  state.selectedDate = getDefaultDate();
  state.selectedMlMatchId = state.mlPredictions.find(match => match.date === state.selectedDate)?.match_id || state.mlPredictions[0]?.match_id;
  state.selectedAiMatchId = state.matches.find(match => match.date === state.selectedDate)?.id || state.matches[0]?.id;
  switchTab(state.activeTab);
}

window.switchTab = switchTab;
window.selectDate = selectDate;
window.selectMlMatch = selectMlMatch;
window.selectAiMatch = selectAiMatch;
window.openMlMatch = openMlMatch;
window.addPickToCart = addPickToCart;
window.addPickToCartEncoded = addPickToCartEncoded;
window.removeCartPick = removeCartPick;
window.clearCart = clearCart;
window.saveTicket = saveTicket;
window.setPickStatus = setPickStatus;
window.setPickReview = setPickReview;
window.setPickReviewEncoded = setPickReviewEncoded;
window.saveProfileSettings = saveProfileSettings;
window.exportFeedback = exportFeedback;

init();
