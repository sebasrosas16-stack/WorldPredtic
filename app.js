const STORAGE_KEYS = {
  settings: "matchiq_v2_settings_master",
  cart: "matchiq_v2_cart_master",
  tickets: "matchiq_v2_tickets_master",
  sessions: "matchiq_v2_sessions_master",
  activeSession: "matchiq_v2_active_session_id",
  draft: "matchiq_v2_draft_master"
};

let resultsData = [];
let matches = [];
let selectedDate = "";
let selectedMatchId = "";
let activeTab = "home";
let historyFilter = "all";
let predictionCache = new Map();

function defaultSession() {
  return {
    id: "session_r32_2026",
    name: "Dieciseisavos 2026",
    phase: "Round of 32",
    initialBankroll: 1000,
    createdAt: new Date().toISOString(),
    active: true
  };
}

function loadJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let settings = { ...DEFAULT_SETTINGS, ...loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS) };
let sessions = loadJSON(STORAGE_KEYS.sessions, [defaultSession()]);
let activeSessionId = localStorage.getItem(STORAGE_KEYS.activeSession) || sessions[0]?.id || defaultSession().id;
let cart = loadJSON(STORAGE_KEYS.cart, []);
let tickets = loadJSON(STORAGE_KEYS.tickets, []);
let draft = loadJSON(STORAGE_KEYS.draft, {
  book: settings.favoriteBook || "Draftea",
  odds: "",
  stake: "",
  manualText: "",
  manualProbability: ""
});

if (!sessions.length) sessions = [defaultSession()];
if (!sessions.some(session => session.id === activeSessionId)) activeSessionId = sessions[0].id;
saveJSON(STORAGE_KEYS.sessions, sessions);
localStorage.setItem(STORAGE_KEYS.activeSession, activeSessionId);

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

function displayText(text) {
  let output = String(text || "");
  Object.entries(DISPLAY_NAMES).forEach(([original, translated]) => {
    output = output.replaceAll(original, translated);
  });
  return output;
}

function matchName(match) {
  if (!match) return "Partido";
  return `${displayName(match.home)} vs ${displayName(match.away)}`;
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

function formatPctSigned(value) {
  const number = Math.round(Number(value || 0) * 100);
  return `${number > 0 ? "+" : ""}${number}%`;
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

function activeSession() {
  return sessions.find(session => session.id === activeSessionId) || sessions[0];
}

function sessionTickets() {
  return tickets.filter(ticket => ticket.sessionId === activeSessionId);
}

function saveSettings() {
  saveJSON(STORAGE_KEYS.settings, settings);
}

function saveSessions() {
  saveJSON(STORAGE_KEYS.sessions, sessions);
  localStorage.setItem(STORAGE_KEYS.activeSession, activeSessionId);
}

function saveCart() {
  saveJSON(STORAGE_KEYS.cart, cart);
  updateCartBadge();
}

function saveTickets() {
  saveJSON(STORAGE_KEYS.tickets, tickets);
}

function saveDraft() {
  saveJSON(STORAGE_KEYS.draft, draft);
}

function getPrediction(match) {
  if (!match) return null;
  if (!predictionCache.has(match.id)) {
    predictionCache.set(match.id, predictMatch(resultsData, match));
  }
  return predictionCache.get(match.id);
}

function selectedMatch() {
  return matches.find(match => match.id === selectedMatchId) || matches.find(match => match.date === selectedDate) || matches[0];
}

function matchesByDate(date) {
  return matches.filter(match => match.date === date);
}

function ticketProfit(ticket) {
  const stake = Number(ticket.stake || 0);
  const odds = Number(ticket.odds || 0);

  if (ticket.status === "win") return stake * odds - stake;
  if (ticket.status === "loss") return -stake;
  if (ticket.status === "cashout") return Number(ticket.cashoutReturn || 0) - stake;
  return 0;
}

function isSettled(ticket) {
  return ["win", "loss", "void", "cashout"].includes(ticket.status);
}

function getSessionStats(sessionId = activeSessionId) {
  const session = sessions.find(item => item.id === sessionId) || activeSession();
  const list = tickets.filter(ticket => ticket.sessionId === sessionId);
  const settled = list.filter(ticket => ["win", "loss", "cashout"].includes(ticket.status));
  const pending = list.filter(ticket => ticket.status === "pending");

  const totalStaked = settled.reduce((sum, ticket) => sum + Number(ticket.stake || 0), 0);
  const pendingStake = pending.reduce((sum, ticket) => sum + Number(ticket.stake || 0), 0);
  const netProfit = settled.reduce((sum, ticket) => sum + ticketProfit(ticket), 0);
  const bankrollActual = Number(session.initialBankroll || 0) + netProfit;
  const available = bankrollActual - pendingStake;
  const roi = totalStaked ? netProfit / totalStaked : 0;

  return {
    session,
    list,
    total: list.length,
    settled: settled.length,
    pending: pending.length,
    wins: list.filter(ticket => ticket.status === "win").length,
    losses: list.filter(ticket => ticket.status === "loss").length,
    voids: list.filter(ticket => ticket.status === "void").length,
    totalStaked,
    pendingStake,
    netProfit,
    bankrollActual,
    available,
    roi
  };
}

function statusLabel(status) {
  if (status === "win") return "✅ Ganado";
  if (status === "loss") return "❌ Perdido";
  if (status === "void") return "🚫 Anulado";
  if (status === "cashout") return "💵 Cashout";
  return "⏳ Pendiente";
}

function qualityLabel(value) {
  if (value === "proxy") return "⚠️ Proxy";
  return "🧠 Fuerte";
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
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1450);
}

function makeCartItem(match, pick, source = "heatmap") {
  return {
    id: `${match?.id || "manual"}__${pick.id || pick.type || "pick"}__${Date.now()}`,
    source,
    sessionId: activeSessionId,
    matchId: match?.id || "manual",
    match: match ? matchName(match) : pick.match || "Entrada manual",
    date: match?.date || new Date().toISOString().slice(0, 10),
    type: pick.type || "manual",
    label: pick.label || "Manual",
    market: pick.market || "Manual",
    text: displayText(pick.text || pick.normalizedPick || "Pick manual"),
    line: pick.line || "",
    direction: pick.direction || "",
    probability: Number(pick.probability || 0.5),
    fairOdds: Number(pick.fairOdds || (pick.probability ? 1 / pick.probability : 2)),
    heatScore: Number(pick.heatScore || 0),
    heatLabel: pick.heatLabel || "Manual",
    heatClass: pick.heatClass || "hot-mid",
    dataQuality: pick.dataQuality || pick.quality || "proxy",
    category: pick.category || "manual",
    risk: pick.risk || "Manual",
    rationale: pick.rationale || "Entrada agregada manualmente."
  };
}

function isInCart(match, pick) {
  return cart.some(item => item.matchId === match.id && item.text === displayText(pick.text));
}

function addHeatPick(matchId, pickId) {
  const match = matches.find(item => item.id === matchId);
  if (!match) return;

  const prediction = getPrediction(match);
  const pick = prediction.heatMap.find(item => item.id === pickId);

  if (!pick || pick.noBet || pick.heatScore < 40) {
    showToast("No entrar / NO BET");
    return;
  }

  if (isInCart(match, pick)) {
    showToast("Ya está en el ticket");
    return;
  }

  cart.push(makeCartItem(match, pick));
  saveCart();
  showToast("✅ Agregado al ticket");
  renderAll();
}

function addTopParlay() {
  const used = new Set();
  let added = 0;

  getAllHeatCandidates()
    .filter(item => !item.pick.noBet && item.pick.heatScore >= 70)
    .filter(item => settings.showProxy || item.pick.dataQuality !== "proxy")
    .sort((a, b) => b.pick.heatScore - a.pick.heatScore)
    .filter(item => {
      if (used.has(item.match.id)) return false;
      used.add(item.match.id);
      return true;
    })
    .slice(0, Number(settings.maxParlay || 3))
    .forEach(item => {
      if (!isInCart(item.match, item.pick)) {
        cart.push(makeCartItem(item.match, item.pick, "top-parlay"));
        added++;
      }
    });

  saveCart();
  showToast(added ? `✅ ${added} picks agregados` : "No había picks nuevos");
  renderAll();
}

function removeFromTicket(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  showToast("Pick eliminado");
  renderAll();
}

function clearTicket() {
  if (!cart.length) return;
  const ok = confirm("¿Vaciar el ticket actual?");
  if (!ok) return;
  cart = [];
  saveCart();
  showToast("Ticket vaciado");
  renderAll();
}

function cartProbability() {
  if (!cart.length) return 0;
  return cart.reduce((acc, item) => acc * Number(item.probability || 0), 1);
}

function cartFairOdds() {
  const probability = cartProbability();
  return probability ? 1 / probability : 0;
}

function cartPotentialReturn() {
  return Number(draft.odds || 0) * Number(draft.stake || 0);
}

function cartProfit() {
  return cartPotentialReturn() - Number(draft.stake || 0);
}

function getTicketEvaluation() {
  if (!cart.length) {
    return { title: "Agrega picks para evaluar", text: "Ticket vacío.", className: "mid", warnings: [], suggestedStake: [0, 0] };
  }

  const probability = cartProbability();
  const odds = Number(draft.odds || 0);
  const implied = odds > 1 ? 1 / odds : 0;
  const edge = odds > 1 ? probability - implied : 0;
  const avgHeat = cart.reduce((sum, item) => sum + Number(item.heatScore || 0), 0) / cart.length;
  const proxyCount = cart.filter(item => item.dataQuality === "proxy").length;
  const riskyCount = cart.filter(item => ["exactScore", "player", "cards", "combo", "manual"].includes(item.type)).length;

  let score = avgHeat * 0.52 + probability * 42;
  if (edge > 0.03) score += 10;
  if (edge < -0.03 && odds > 1) score -= 12;
  if (cart.length >= 4) score -= 10;
  if (proxyCount >= 2) score -= 8;
  score -= riskyCount * 4;
  score = Math.max(0, Math.min(100, score));

  const warnings = [];
  if (edge < 0 && odds > 1) warnings.push("Value negativo frente al momio ingresado.");
  if (cart.length >= 4) warnings.push("Muchos picks en un solo ticket; baja estabilidad.");
  if (proxyCount) warnings.push(`${proxyCount} mercado(s) proxy: córners/tarjetas/jugador/manual.`);
  if (riskyCount >= 2) warnings.push("Combinación con varios mercados de alta varianza.");

  const bankroll = activeSession()?.initialBankroll || 1000;

  if (score >= 70) {
    return {
      title: "🟢 Ticket fuerte",
      text: "Buena estructura para prueba, siempre que el momio acompañe.",
      className: "good",
      warnings,
      suggestedStake: [Math.round(bankroll * 0.02), Math.round(bankroll * 0.045)]
    };
  }

  if (score < 48) {
    return {
      title: "🔴 Ticket peligroso",
      text: "Demasiada varianza, poco heat o value insuficiente.",
      className: "bad",
      warnings,
      suggestedStake: [Math.round(bankroll * 0.005), Math.round(bankroll * 0.015)]
    };
  }

  return {
    title: "🟡 Ticket medido",
    text: "Jugable con stake controlado.",
    className: "mid",
    warnings,
    suggestedStake: [Math.round(bankroll * 0.01), Math.round(bankroll * 0.03)]
  };
}

function renderWarnings(warnings) {
  if (!warnings || !warnings.length) return "";

  return `
    <div class="warning-list">
      <strong>Alertas del ticket</strong>
      <ul>${warnings.map(warning => `<li>${escapeHTML(warning)}</li>`).join("")}</ul>
    </div>
  `;
}

function updateDraftSilent(key, value, refresh = false) {
  draft[key] = value;
  saveDraft();
  if (refresh) updateTicketLivePreview();
}

function updateManualText(value) {
  draft.manualText = value;
  saveDraft();
  updateManualParserPreview();
}

function applyManualOption(option) {
  const input = document.getElementById("manualPickInput");
  const base = draft.manualText || "";
  const addition = {
    "Handicap": " handicap",
    "Goles": " goles",
    "Córners": " córners",
    "Tarjetas": " tarjetas",
    "Ganador": " gana",
    "Jugador": " tiro a puerta"
  }[option] || ` ${option}`;

  draft.manualText = `${base}${addition}`.replace(/\s+/g, " ").trim();
  saveDraft();
  if (input) input.value = draft.manualText;
  updateManualParserPreview();
}

function parseCurrentManual() {
  const match = selectedMatch();
  const prediction = match ? getPrediction(match) : null;
  return parseManualPick(draft.manualText || "", matches, match, prediction);
}

function updateManualParserPreview() {
  const box = document.getElementById("manualParserPreview");
  if (!box) return;
  box.innerHTML = renderManualParserPreview();
}

function renderManualParserPreview() {
  const parsed = parseCurrentManual();

  if (!parsed.raw) {
    return `
      <div class="parser-detected">
        <strong>🧠 Detector de pick manual</strong>
        <span>Escribe un pick y MatchIQ intentará identificar mercado, línea, dirección y calidad.</span>
      </div>
    `;
  }

  if (parsed.needsClarification) {
    return `
      <div class="parser-detected">
        <strong>⚠️ Pick ambiguo</strong>
        <span>
          Texto: ${escapeHTML(parsed.raw)}<br>
          Línea detectada: ${escapeHTML(parsed.line || "—")}<br>
          MatchIQ necesita saber de qué mercado se trata.
        </span>
        <div class="option-grid">
          ${(parsed.options || []).map(option => `<button onclick="applyManualOption('${escapeHTML(option)}')">${escapeHTML(option)}</button>`).join("")}
        </div>
      </div>
    `;
  }

  const equivalent = parsed.equivalent;
  const probability = Number(draft.manualProbability || 0);
  const manualProb = probability > 1 ? probability / 100 : probability;
  const finalProb = equivalent?.probability || manualProb || 0;

  return `
    <div class="parser-detected">
      <strong>✅ Detectado: ${escapeHTML(displayText(parsed.normalizedPick))}</strong>
      <span>
        Partido: ${escapeHTML(parsed.match ? matchName(parsed.match) : "No detectado")}<br>
        Mercado: ${escapeHTML(parsed.market)} · Dirección: ${escapeHTML(parsed.direction || "—")} · Línea: ${escapeHTML(parsed.line || "—")}<br>
        Calidad: ${qualityLabel(parsed.quality)} · Confianza detector: ${parsed.confidence}<br>
        ${equivalent ? `Equivalente mapa: Heat ${equivalent.heatScore}/100 · Prob. IA ${formatPct(equivalent.probability)} · Justo ${formatFair(equivalent.fairOdds)}` : finalProb ? `Probabilidad manual: ${formatPct(finalProb)}` : "Sin equivalente exacto: escribe probabilidad manual."}
      </span>
    </div>
  `;
}

function addManualPick() {
  const parsed = parseCurrentManual();

  if (!parsed.raw) {
    alert("Escribe un pick manual.");
    return;
  }

  if (parsed.needsClarification || !parsed.valid) {
    alert("El pick está ambiguo. Elige el mercado antes de agregarlo.");
    return;
  }

  const probabilityInput = Number(draft.manualProbability || 0);
  const manualProbability = probabilityInput > 1 ? probabilityInput / 100 : probabilityInput;
  const equivalent = parsed.equivalent;
  const probability = equivalent?.probability || manualProbability;

  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    alert("No hay probabilidad del modelo para este pick. Escribe una probabilidad manual válida, ejemplo 65 o 0.65.");
    return;
  }

  const heat = equivalent?.heatScore || Math.round(probability * 55 - (parsed.quality === "proxy" ? 8 : 0));
  const heatInfo = classifyHeat(heat, false);

  const item = makeCartItem(parsed.match, {
    id: `manual_${Date.now()}`,
    type: parsed.marketType || "manual",
    label: "Manual detectado",
    market: parsed.market,
    text: displayText(parsed.normalizedPick),
    line: parsed.line,
    direction: parsed.direction,
    probability,
    fairOdds: 1 / probability,
    heatScore: heat,
    heatLabel: heatInfo.label,
    heatClass: heatInfo.className,
    dataQuality: parsed.quality,
    category: "manual",
    risk: heat >= 70 ? "Medio" : "Alto",
    rationale: equivalent ? "Entrada manual conectada al mapa de calor." : "Entrada manual detectada sin equivalente exacto."
  }, "manual");

  cart.push(item);
  draft.manualText = "";
  draft.manualProbability = "";
  saveCart();
  saveDraft();
  showToast("Entrada manual agregada");
  renderAll();
}

function updateTicketLivePreview() {
  const summary = document.getElementById("ticketLiveSummary");
  const valueBox = document.getElementById("ticketLiveValue");
  const gradeBox = document.getElementById("ticketLiveGrade");
  const warningsBox = document.getElementById("ticketLiveWarnings");

  if (!summary || !valueBox) return;

  const probability = cartProbability();
  const fairOdds = cartFairOdds();
  const odds = Number(draft.odds || 0);
  const stake = Number(draft.stake || 0);
  const implied = odds > 1 ? 1 / odds : 0;
  const edge = odds > 1 ? probability - implied : 0;
  const evaluation = getTicketEvaluation();

  summary.innerHTML = `
    <div><strong>${formatPct(probability)}</strong><span>Prob. IA</span></div>
    <div><strong>${formatFair(fairOdds)}</strong><span>Momio justo</span></div>
    <div><strong>${formatMoney(odds * stake)}</strong><span>Retorno</span></div>
    <div><strong>${formatMoney(odds * stake - stake)}</strong><span>Utilidad neta</span></div>
  `;

  valueBox.className = `value-result ${edge > 0 ? "good" : odds > 1 ? "bad" : "mid"}`;
  valueBox.innerHTML = `
    <strong>${odds > 1 && edge > 0 ? "🟢 Value positivo" : odds > 1 ? "🔴 Sin value" : "Escribe momio total"}</strong>
    <span>${odds > 1 ? `Casa: ${formatPct(implied)} · IA: ${formatPct(probability)} · Edge: ${formatPctSigned(edge)}` : "El edge real se calcula cuando ingresas momio."}</span>
  `;

  if (gradeBox) {
    gradeBox.className = `ticket-grade ${evaluation.className}`;
    gradeBox.innerHTML = `
      <strong>${evaluation.title}</strong>
      <span>${evaluation.text} · Stake sugerido: ${formatMoney(evaluation.suggestedStake[0])} - ${formatMoney(evaluation.suggestedStake[1])}</span>
    `;
  }

  if (warningsBox) warningsBox.innerHTML = renderWarnings(evaluation.warnings);
}

function saveCurrentTicket() {
  if (!cart.length) {
    alert("Agrega al menos un pick al ticket.");
    return;
  }

  const odds = Number(draft.odds || 0);
  const stake = Number(draft.stake || 0);

  if (!odds || odds <= 1) {
    alert("Ingresa un momio total válido.");
    return;
  }

  if (!stake || stake <= 0) {
    alert("Ingresa un importe válido.");
    return;
  }

  const probability = cartProbability();
  const implied = 1 / odds;
  const edge = probability - implied;

  if (edge < 0) {
    const ok = confirm("Este ticket tiene value negativo según MatchIQ. ¿Guardarlo de todos modos?");
    if (!ok) return;
  }

  const ticket = {
    id: `ticket_${Date.now()}`,
    sessionId: activeSessionId,
    createdAt: new Date().toISOString(),
    status: "pending",
    book: draft.book || settings.favoriteBook || "Draftea",
    odds,
    stake,
    selections: cart.map(item => ({ ...item })),
    combinedProbability: probability,
    fairOdds: cartFairOdds(),
    edge,
    heatAverage: cart.reduce((sum, item) => sum + Number(item.heatScore || 0), 0) / cart.length,
    appVersion: APP_VERSION
  };

  tickets.unshift(ticket);
  cart = [];
  draft.odds = "";
  draft.stake = "";

  saveTickets();
  saveCart();
  saveDraft();
  showToast("Ticket guardado en sesión");
  switchTab("history");
}

function settleTicket(id, status) {
  tickets = tickets.map(ticket => ticket.id === id ? { ...ticket, status, settledAt: new Date().toISOString() } : ticket);
  saveTickets();
  showToast("Saldo recalculado");
  renderAll();
}

function deleteTicket(id) {
  const ok = confirm("¿Eliminar este ticket?");
  if (!ok) return;

  tickets = tickets.filter(ticket => ticket.id !== id);
  saveTickets();
  showToast("Ticket eliminado");
  renderAll();
}

function groupStatsByMarket() {
  const groups = {};

  sessionTickets().filter(isSettled).forEach(ticket => {
    const selections = ticket.selections || [];
    const stakeShare = selections.length ? Number(ticket.stake || 0) / selections.length : 0;
    const profitShare = selections.length ? ticketProfit(ticket) / selections.length : 0;

    selections.forEach(selection => {
      const name = selection.market || selection.label || selection.type || "Otro";
      if (!groups[name]) groups[name] = { name, count: 0, staked: 0, profit: 0, wins: 0, losses: 0 };
      groups[name].count++;
      groups[name].staked += stakeShare;
      groups[name].profit += profitShare;
      if (ticket.status === "win") groups[name].wins++;
      if (ticket.status === "loss") groups[name].losses++;
    });
  });

  return Object.values(groups)
    .map(group => ({ ...group, roi: group.staked ? group.profit / group.staked : 0, hitRate: group.wins + group.losses ? group.wins / (group.wins + group.losses) : 0 }))
    .sort((a, b) => b.profit - a.profit);
}

function groupStatsByHeat() {
  const groups = {
    "🟢 Alto/Bueno": { name: "🟢 Alto/Bueno", count: 0, staked: 0, profit: 0, wins: 0, losses: 0 },
    "🟡 Marginal": { name: "🟡 Marginal", count: 0, staked: 0, profit: 0, wins: 0, losses: 0 },
    "🔴 Bajo/Proxy": { name: "🔴 Bajo/Proxy", count: 0, staked: 0, profit: 0, wins: 0, losses: 0 }
  };

  sessionTickets().filter(isSettled).forEach(ticket => {
    const heat = Number(ticket.heatAverage || 0);
    const key = heat >= 70 ? "🟢 Alto/Bueno" : heat >= 55 ? "🟡 Marginal" : "🔴 Bajo/Proxy";
    groups[key].count++;
    groups[key].staked += Number(ticket.stake || 0);
    groups[key].profit += ticketProfit(ticket);
    if (ticket.status === "win") groups[key].wins++;
    if (ticket.status === "loss") groups[key].losses++;
  });

  return Object.values(groups)
    .filter(group => group.count)
    .map(group => ({ ...group, roi: group.staked ? group.profit / group.staked : 0, hitRate: group.wins + group.losses ? group.wins / (group.wins + group.losses) : 0 }));
}

function renderStatRows(rows, emptyText = "Sin datos todavía.") {
  if (!rows.length) return `<p class="note">${escapeHTML(emptyText)}</p>`;

  return `
    <div class="stat-list">
      ${rows.map(row => `
        <div class="stat-row">
          <div>
            <strong>${escapeHTML(row.name)}</strong>
            <span>${row.count} registros · Hit ${formatPct(row.hitRate || 0)}</span>
          </div>
          <div>
            <strong>${formatPct(row.roi || 0)}</strong>
            <span>${formatMoney(row.profit || 0)}</span>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function getAllHeatCandidates() {
  const candidates = [];

  matches.forEach(match => {
    const prediction = getPrediction(match);
    prediction.heatMap.forEach(pick => {
      candidates.push({ match, prediction, pick });
    });
  });

  return candidates;
}

function renderHome() {
  const stats = getSessionStats();
  const topPicks = getAllHeatCandidates()
    .filter(item => !item.pick.noBet)
    .filter(item => settings.showProxy || item.pick.dataQuality !== "proxy")
    .sort((a, b) => b.pick.heatScore - a.pick.heatScore)
    .slice(0, 8);

  const traps = matches.filter(match => match.trap);

  screens.home.innerHTML = `
    <section class="glass panel">
      <h2>Sesión activa</h2>
      <p class="note"><strong>${escapeHTML(stats.session.name)}</strong> · v${APP_VERSION} · recency weighting fuerte.</p>

      <div class="home-stats">
        <div><strong>${formatMoney(stats.bankrollActual)}</strong><span>Bankroll actual</span></div>
        <div><strong>${formatMoney(stats.available)}</strong><span>Disponible</span></div>
        <div><strong>${formatMoney(stats.pendingStake)}</strong><span>Riesgo pendiente</span></div>
        <div><strong>${formatPct(stats.roi)}</strong><span>ROI cerrado</span></div>
      </div>
    </section>

    <section class="glass panel">
      <h2>🔥 Top Heat Picks</h2>
      <p class="note">Ordenados por probabilidad, confianza, contexto KO y penalización de riesgo.</p>
      <div class="summary-picks">
        ${topPicks.map((item, index) => `
          <button class="summary-row" onclick="openMatch('${item.match.id}')">
            <div>
              <strong>${index + 1}. ${escapeHTML(displayText(item.pick.text))}</strong>
              <span>${escapeHTML(matchName(item.match))} · Heat ${item.pick.heatScore} · Prob. ${formatPct(item.pick.probability)} · ${qualityLabel(item.pick.dataQuality)}</span>
            </div>
            <span>${item.pick.heatLabel}</span>
          </button>
        `).join("")}
      </div>
      <button class="primary-btn" onclick="addTopParlay()">Agregar top parley controlado</button>
    </section>

    <section class="glass panel">
      <h2>⚠️ Partidos trampa</h2>
      <p class="note">Aquí no se debe forzar ganador seco si el momio no da valor.</p>
      ${traps.map(match => `
        <button class="summary-row" onclick="openMatch('${match.id}')">
          <div>
            <strong>${escapeHTML(matchName(match))}</strong>
            <span>KO risk ${Math.round(match.koRisk * 100)}% · Volatilidad ${Math.round(match.volatility * 100)}%</span>
          </div>
          <span>Ver mapa</span>
        </button>
      `).join("")}
    </section>
  `;
}

function renderRecommended() {
  const match = selectedMatch();
  if (!match) {
    screens.recommended.innerHTML = `<section class="glass panel"><h2>Mapa</h2><p class="note">No hay partidos cargados.</p></section>`;
    return;
  }

  const prediction = getPrediction(match);
  const dates = [...new Set(matches.map(item => item.date))];
  const dateMatches = matchesByDate(selectedDate);

  screens.recommended.innerHTML = `
    <section class="glass panel">
      <h2>Dieciseisavos</h2>
      <div class="select-grid">
        <div>
          <label>Fecha</label>
          <select onchange="changeDate(this.value)">
            ${dates.map(date => `<option value="${date}" ${date === selectedDate ? "selected" : ""}>${DATE_LABELS[date] || date}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Partido</label>
          <select onchange="changeMatch(this.value)">
            ${dateMatches.map(item => `<option value="${item.id}" ${item.id === match.id ? "selected" : ""}>${matchName(item)}</option>`).join("")}
          </select>
        </div>
      </div>
    </section>

    <section class="glass card">
      <h2 class="match-title">${escapeHTML(matchName(match))}</h2>
      <p class="note">${escapeHTML(match.phase)} · ${escapeHTML(match.time)} · ${escapeHTML(match.venue)}</p>
      <div class="badge-line">
        <span class="badge ${match.trap ? "danger" : "hot"}">${match.trap ? "⚠️ Partido trampa" : "🟢 Lectura estable"}</span>
        <span class="badge warn">KO risk ${Math.round(match.koRisk * 100)}%</span>
        <span class="badge">Volatilidad ${Math.round(match.volatility * 100)}%</span>
      </div>

      <div class="prob-grid">
        <div class="prob"><strong>${prediction.probs.home}%</strong><span>${escapeHTML(displayName(match.home))}</span></div>
        <div class="prob"><strong>${prediction.probs.draw}%</strong><span>Empate 90</span></div>
        <div class="prob"><strong>${prediction.probs.away}%</strong><span>${escapeHTML(displayName(match.away))}</span></div>
      </div>

      ${renderScenario(match, prediction)}
      ${renderBTTSBar(prediction)}
      ${renderHeatMap(match, prediction)}
      ${renderScoreHeatmap(prediction)}
      ${renderModelFactors(prediction)}
    </section>
  `;
}

function renderScenario(match, prediction) {
  const safe = prediction.bestSafe;
  const value = prediction.bestValue;
  const aggressive = prediction.bestAggressive;
  const proxy = prediction.proxyUsable;

  return `
    <div class="scenario-box">
      <strong>Lectura IA</strong>
      <p class="note">Favorito estadístico: <strong>${escapeHTML(displayName(prediction.favorite.team))}</strong>. Confianza ${prediction.confidence.label} · ${prediction.confidence.score}/100.</p>
      <div class="summary-picks">
        ${safe ? `<div class="summary-row"><div><strong>Más seguro</strong><span>${escapeHTML(displayText(safe.text))} · ${formatPct(safe.probability)}</span></div><span>${safe.heatScore}</span></div>` : ""}
        ${value ? `<div class="summary-row"><div><strong>Mayor heat</strong><span>${escapeHTML(displayText(value.text))} · ${value.heatLabel}</span></div><span>${value.heatScore}</span></div>` : ""}
        ${aggressive ? `<div class="summary-row"><div><strong>Agresivo</strong><span>${escapeHTML(displayText(aggressive.text))} · alta varianza</span></div><span>${aggressive.heatScore}</span></div>` : ""}
        ${proxy ? `<div class="summary-row"><div><strong>Proxy usable</strong><span>${escapeHTML(displayText(proxy.text))} · ${qualityLabel(proxy.dataQuality)}</span></div><span>${proxy.heatScore}</span></div>` : ""}
      </div>
      <p class="tiny-note">${match.contextNotes.map(escapeHTML).join(" ")}</p>
    </div>
  `;
}

function renderBTTSBar(prediction) {
  const yes = Math.round(prediction.bttsYes * 100);
  const no = 100 - yes;
  let reading = "Mercado dividido / NO BET";
  if (yes >= 62) reading = "SÍ fuerte: perfil de intercambio ofensivo";
  else if (yes >= 55) reading = "SÍ ligero: depende del momio";
  else if (yes <= 38) reading = "NO fuerte: riesgo de portería a cero";
  else if (yes <= 44) reading = "NO ligero: mejor para under o gana a cero";

  return `
    <div class="btts-card">
      <div class="btts-head">
        <strong>⚽ Ambos anotan</strong>
        <span>${escapeHTML(reading)}</span>
      </div>
      <div class="split-bar" style="--yes:${yes}fr; --no:${no}fr">
        <div class="split-yes"></div>
        <div class="split-no"></div>
      </div>
      <div class="split-labels">
        <span>SÍ ${yes}%</span>
        <span>NO ${no}%</span>
      </div>
    </div>
  `;
}

function renderHeatMap(match, prediction) {
  const picks = prediction.heatMap
    .filter(pick => settings.showProxy || pick.dataQuality !== "proxy")
    .filter(pick => !settings.hideNoBet || !pick.noBet)
    .slice(0, 16);

  return `
    <div class="heatmap-section">
      <strong>🔥 Mapa de Calor IA</strong>
      <p class="note">Heat IA sin momio real. El value real se calcula en el ticket cuando escribes la cuota.</p>
      <div class="heat-grid">
        ${picks.map(pick => renderHeatCard(match, pick)).join("")}
      </div>
    </div>
  `;
}

function renderHeatCard(match, pick) {
  const inTicket = isInCart(match, pick);
  const disabled = pick.noBet || pick.heatScore < 40 || inTicket;

  return `
    <div class="heat-card ${pick.heatClass}">
      <div class="heat-top">
        <strong>${escapeHTML(displayText(pick.text))}</strong>
        <em>Heat ${pick.heatScore}</em>
      </div>
      <div class="heat-meta">
        ${escapeHTML(pick.market)} ${escapeHTML(pick.line || "")} · Prob. IA ${formatPct(pick.probability)} · Justo ${formatFair(pick.fairOdds)}<br>
        ${pick.heatLabel} · ${qualityLabel(pick.dataQuality)} · Riesgo ${pick.risk}
      </div>
      <div class="heat-actions">
        <button class="primary-btn ${inTicket ? "in-ticket" : ""} ${disabled ? "disabled" : ""}" ${disabled ? "disabled" : ""} onclick="addHeatPick('${match.id}', '${pick.id}')">
          ${pick.noBet || pick.heatScore < 40 ? "No entrar" : inTicket ? "✅ En ticket" : "Agregar al ticket"}
        </button>
      </div>
    </div>
  `;
}

function renderScoreHeatmap(prediction) {
  const cells = [];
  for (let h = 0; h <= 4; h++) {
    for (let a = 0; a <= 4; a++) {
      const probability = poisson(h, prediction.homeLambda) * poisson(a, prediction.awayLambda);
      cells.push({ h, a, score: `${h}-${a}`, probability });
    }
  }

  const max = Math.max(...cells.map(cell => cell.probability));

  return `
    <div class="score-heatmap">
      <strong>🎯 Mapa de calor de marcador</strong>
      <p class="note">No es recomendación directa de marcador exacto; sirve para entender el guion probable.</p>
      <div class="score-grid">
        <div></div><div class="score-label">0</div><div class="score-label">1</div><div class="score-label">2</div><div class="score-label">3</div><div class="score-label">4</div>
        ${[0,1,2,3,4].map(h => `
          <div class="score-label">${h}</div>
          ${[0,1,2,3,4].map(a => {
            const cell = cells.find(item => item.h === h && item.a === a);
            const heat = max ? Math.max(0.12, cell.probability / max).toFixed(2) : "0.12";
            return `<div class="score-cell" style="--heat:${heat}"><strong>${cell.score}</strong><small>${Math.round(cell.probability * 100)}%</small></div>`;
          }).join("")}
        `).join("")}
      </div>
    </div>
  `;
}

function renderModelFactors(prediction) {
  return `
    <div class="model-box">
      <strong>🧠 Variables recientes</strong>
      <p class="note">Últimos 3/5/10 partidos tienen más peso que el histórico.</p>
      <div class="grid-2">
        <div class="stat-box"><strong>${Math.round((prediction.features.homeStats.momentum + 1) * 50)}</strong><span>Momentum ${displayName(prediction.homeTeam)}</span></div>
        <div class="stat-box"><strong>${Math.round((prediction.features.awayStats.momentum + 1) * 50)}</strong><span>Momentum ${displayName(prediction.awayTeam)}</span></div>
        <div class="stat-box"><strong>${prediction.expectedCorners.total}</strong><span>Córners esperados</span></div>
        <div class="stat-box"><strong>${prediction.expectedCards}</strong><span>Tarjetas estimadas</span></div>
      </div>
      <div class="summary-picks">
        ${prediction.factors.map(factor => `<div class="summary-row"><div><strong>${escapeHTML(displayText(factor))}</strong></div></div>`).join("")}
      </div>
    </div>
  `;
}

function renderTicket() {
  const probability = cartProbability();
  const fairOdds = cartFairOdds();
  const odds = Number(draft.odds || 0);
  const implied = odds > 1 ? 1 / odds : 0;
  const edge = odds > 1 ? probability - implied : 0;
  const evaluation = getTicketEvaluation();

  screens.ticket.innerHTML = `
    <section class="glass panel">
      <h2>Ticket actual</h2>
      <p class="note">Sesión: <strong>${escapeHTML(activeSession().name)}</strong>. El saldo se recalcula desde tickets, no con sumas manuales.</p>
      ${cart.length ? cart.map(item => `
        <div class="cart-item">
          <div>
            <strong>${escapeHTML(item.text)}</strong>
            <span>${escapeHTML(item.match)} · Prob. ${formatPct(item.probability)} · Heat ${item.heatScore}<br>${escapeHTML(item.market)} ${escapeHTML(item.line || "")} · ${qualityLabel(item.dataQuality)}</span>
          </div>
          <button onclick="removeFromTicket('${item.id}')">✕</button>
        </div>
      `).join("") : `<p class="note">Tu ticket está vacío.</p>`}
      ${cart.length ? `<button class="ghost" onclick="clearTicket()">Vaciar ticket</button>` : ""}
    </section>

    <section class="glass panel">
      <h2>🧠 Detector de pick manual</h2>
      <p class="note">Escribe un pick y MatchIQ identifica mercado, línea, dirección y calidad. No se cierra el teclado al escribir.</p>

      <label>Pick manual</label>
      <input id="manualPickInput" value="${escapeHTML(draft.manualText || "")}" placeholder="Ejemplo: México under 3.5 goles" oninput="updateManualText(this.value)" />

      <label>Probabilidad manual opcional</label>
      <input type="number" inputmode="decimal" step="0.01" value="${escapeHTML(draft.manualProbability || "")}" placeholder="Ejemplo: 65 o 0.65" oninput="updateDraftSilent('manualProbability', this.value)" />

      <div id="manualParserPreview">${renderManualParserPreview()}</div>

      <button class="primary-btn" onclick="addManualPick()">Agregar manual detectado</button>
    </section>

    <section class="glass panel">
      <h2>Datos del ticket</h2>
      <label>Casa</label>
      <select onchange="updateDraftSilent('book', this.value)">
        ${BOOKS.map(book => `<option value="${book}" ${draft.book === book ? "selected" : ""}>${book}</option>`).join("")}
      </select>

      <label>Momio total de la casa</label>
      <input type="number" inputmode="decimal" step="0.01" min="1.01" value="${escapeHTML(draft.odds || "")}" placeholder="Ejemplo: 2.35" oninput="updateDraftSilent('odds', this.value, true)" />

      <label>Importe apostado</label>
      <input type="number" inputmode="decimal" step="1" min="1" value="${escapeHTML(draft.stake || "")}" placeholder="Ejemplo: 200" oninput="updateDraftSilent('stake', this.value, true)" />

      <div id="ticketLiveSummary" class="ticket-summary">
        <div><strong>${formatPct(probability)}</strong><span>Prob. IA</span></div>
        <div><strong>${formatFair(fairOdds)}</strong><span>Momio justo</span></div>
        <div><strong>${formatMoney(cartPotentialReturn())}</strong><span>Retorno</span></div>
        <div><strong>${formatMoney(cartProfit())}</strong><span>Utilidad neta</span></div>
      </div>

      <div id="ticketLiveValue" class="value-result ${edge > 0 ? "good" : odds > 1 ? "bad" : "mid"}">
        <strong>${odds > 1 && edge > 0 ? "🟢 Value positivo" : odds > 1 ? "🔴 Sin value" : "Escribe momio total"}</strong>
        <span>${odds > 1 ? `Casa: ${formatPct(implied)} · IA: ${formatPct(probability)} · Edge: ${formatPctSigned(edge)}` : "El edge real se calcula con el momio."}</span>
      </div>

      <div id="ticketLiveGrade" class="ticket-grade ${evaluation.className}">
        <strong>${evaluation.title}</strong>
        <span>${evaluation.text} · Stake sugerido: ${formatMoney(evaluation.suggestedStake[0])} - ${formatMoney(evaluation.suggestedStake[1])}</span>
      </div>

      <div id="ticketLiveWarnings">${renderWarnings(evaluation.warnings)}</div>

      <button class="primary-btn ${cart.length ? "" : "disabled"}" ${cart.length ? "" : "disabled"} onclick="saveCurrentTicket()">Guardar ticket en sesión</button>
    </section>
  `;
}

function renderHistory() {
  const stats = getSessionStats();
  const list = historyFilter === "all" ? sessionTickets() : sessionTickets().filter(ticket => ticket.status === historyFilter);

  screens.history.innerHTML = `
    <section class="glass panel">
      <h2>📘 Sesión de prueba</h2>
      <p class="note"><strong>${escapeHTML(stats.session.name)}</strong> · todo se recalcula desde los tickets.</p>
      <div class="home-stats">
        <div><strong>${formatMoney(stats.bankrollActual)}</strong><span>Bankroll actual</span></div>
        <div><strong>${formatMoney(stats.available)}</strong><span>Disponible</span></div>
        <div><strong>${formatMoney(stats.pendingStake)}</strong><span>Riesgo pendiente</span></div>
        <div><strong>${formatMoney(stats.netProfit)}</strong><span>Utilidad cerrada</span></div>
        <div><strong>${formatPct(stats.roi)}</strong><span>ROI</span></div>
        <div><strong>${stats.wins}/${stats.losses}</strong><span>Ganados/Perdidos</span></div>
      </div>
      <button class="ghost" onclick="exportSessionCSV()">Exportar sesión CSV</button>
    </section>

    <section class="glass panel">
      <h2>Rendimiento por mercado</h2>
      ${renderStatRows(groupStatsByMarket(), "Marca tickets como ganados/perdidos para ver ROI por mercado.")}
    </section>

    <section class="glass panel">
      <h2>Rendimiento por Heat</h2>
      ${renderStatRows(groupStatsByHeat(), "Todavía no hay tickets cerrados para medir Heat.")}
    </section>

    <section class="glass panel">
      <h2>Tickets</h2>
      <div class="filter-row">
        ${[["all", "Todos"], ["pending", "Pendientes"], ["win", "Ganados"], ["loss", "Perdidos"], ["void", "Anulados"]].map(([key, label]) => `<button class="${historyFilter === key ? "active" : ""}" onclick="setHistoryFilter('${key}')">${label}</button>`).join("")}
      </div>
      ${list.length ? list.map(renderTicketCard).join("") : `<p class="note">No hay tickets para este filtro.</p>`}
    </section>
  `;
}

function renderTicketCard(ticket) {
  return `
    <div class="ticket-card ticket-${ticket.status || "pending"}">
      <div class="ticket-head">
        <strong>${escapeHTML(ticket.book || "Casa")} · ${formatOdds(ticket.odds)}</strong>
        <span>${statusLabel(ticket.status)}</span>
      </div>
      <p class="note">${new Date(ticket.createdAt).toLocaleDateString("es-MX")} · Stake ${formatMoney(ticket.stake)} · Utilidad ${formatMoney(ticketProfit(ticket))} · Heat prom. ${Math.round(ticket.heatAverage || 0)}</p>
      ${(ticket.selections || []).map(selection => `
        <div class="ticket-selection">
          <div>
            <strong>${escapeHTML(selection.text)}</strong>
            <span>${escapeHTML(selection.match)} · Prob. ${formatPct(selection.probability)} · Heat ${selection.heatScore}<br>${escapeHTML(selection.market)} ${escapeHTML(selection.line || "")} · ${qualityLabel(selection.dataQuality)}</span>
          </div>
        </div>
      `).join("")}
      <div class="ticket-actions">
        <button class="win" onclick="settleTicket('${ticket.id}', 'win')">✅ Ganado</button>
        <button class="lose" onclick="settleTicket('${ticket.id}', 'loss')">❌ Perdido</button>
        <button class="ghost-small" onclick="settleTicket('${ticket.id}', 'void')">🚫 Anulado</button>
        <button class="ghost-small" onclick="settleTicket('${ticket.id}', 'pending')">⏳ Pendiente</button>
        <button class="ghost-small" onclick="deleteTicket('${ticket.id}')">🗑️ Eliminar</button>
      </div>
    </div>
  `;
}

function renderProfile() {
  const session = activeSession();

  screens.profile.innerHTML = `
    <section class="glass panel">
      <h2>Ajustes v2.0</h2>
      <p class="note">Configuración de sesión y filtros del mapa.</p>

      <label>Sesión activa</label>
      <select onchange="changeSession(this.value)">
        ${sessions.map(item => `<option value="${item.id}" ${item.id === activeSessionId ? "selected" : ""}>${escapeHTML(item.name)}</option>`).join("")}
      </select>

      <label>Nombre de sesión</label>
      <input value="${escapeHTML(session.name)}" oninput="updateSessionSilent('name', this.value)" onblur="renderAll()" />

      <label>Bankroll inicial de la sesión</label>
      <input type="number" inputmode="decimal" step="1" value="${escapeHTML(session.initialBankroll)}" oninput="updateSessionSilent('initialBankroll', Number(this.value))" onblur="renderAll()" />

      <label>Casa favorita</label>
      <select onchange="updateSetting('favoriteBook', this.value)">
        ${BOOKS.map(book => `<option value="${book}" ${settings.favoriteBook === book ? "selected" : ""}>${book}</option>`).join("")}
      </select>

      <label>Perfil</label>
      <select onchange="updateSetting('profile', this.value)">
        <option value="safe" ${settings.profile === "safe" ? "selected" : ""}>🛡️ Seguro</option>
        <option value="balanced" ${settings.profile === "balanced" ? "selected" : ""}>⚖️ Balanceado</option>
        <option value="aggressive" ${settings.profile === "aggressive" ? "selected" : ""}>🔥 Agresivo</option>
      </select>

      <label>Máximo picks en top parley</label>
      <select onchange="updateSetting('maxParlay', Number(this.value))">
        ${[2,3,4,5].map(num => `<option value="${num}" ${Number(settings.maxParlay) === num ? "selected" : ""}>${num} picks</option>`).join("")}
      </select>

      <label class="switch-row">
        <input type="checkbox" ${settings.showProxy ? "checked" : ""} onchange="updateSetting('showProxy', this.checked)" />
        Mostrar mercados proxy
      </label>

      <label class="switch-row">
        <input type="checkbox" ${settings.hideNoBet ? "checked" : ""} onchange="updateSetting('hideNoBet', this.checked)" />
        Ocultar NO BET / evitar
      </label>

      <button class="primary-btn" onclick="createNewSession()">Crear nueva sesión</button>
    </section>

    <section class="glass panel">
      <h2>Zona de cuidado</h2>
      <button class="ghost" onclick="clearActiveSessionTickets()">Borrar tickets de esta sesión</button>
    </section>
  `;
}

function updateSetting(key, value) {
  settings[key] = value;
  if (key === "favoriteBook") draft.book = value;
  saveSettings();
  saveDraft();
  renderAll();
}

function updateSessionSilent(key, value) {
  sessions = sessions.map(session => session.id === activeSessionId ? { ...session, [key]: value } : session);
  saveSessions();
}

function changeSession(id) {
  activeSessionId = id;
  cart = cart.map(item => ({ ...item, sessionId: activeSessionId }));
  saveCart();
  saveSessions();
  renderAll();
}

function createNewSession() {
  const name = prompt("Nombre de la nueva sesión:", `Sesión ${sessions.length + 1}`);
  if (!name) return;

  const bankroll = Number(prompt("Bankroll inicial:", "1000") || 1000);
  const session = {
    id: `session_${Date.now()}`,
    name,
    phase: "Custom",
    initialBankroll: Number.isFinite(bankroll) ? bankroll : 1000,
    createdAt: new Date().toISOString(),
    active: true
  };

  sessions.push(session);
  activeSessionId = session.id;
  saveSessions();
  showToast("Sesión creada");
  renderAll();
}

function clearActiveSessionTickets() {
  const ok = confirm("Esto borrará todos los tickets de la sesión activa. ¿Continuar?");
  if (!ok) return;

  tickets = tickets.filter(ticket => ticket.sessionId !== activeSessionId);
  cart = [];
  saveTickets();
  saveCart();
  showToast("Sesión limpiada");
  renderAll();
}

function changeDate(date) {
  selectedDate = date;
  selectedMatchId = matchesByDate(date)[0]?.id || "";
  renderAll();
}

function changeMatch(id) {
  selectedMatchId = id;
  renderAll();
}

function openMatch(id) {
  const match = matches.find(item => item.id === id);
  if (match) {
    selectedMatchId = match.id;
    selectedDate = match.date;
  }
  switchTab("recommended");
}

function setHistoryFilter(filter) {
  historyFilter = filter;
  renderHistory();
}

function updateHero(tab) {
  const hero = document.getElementById("appHero");
  const title = document.getElementById("heroTitle");
  const eyebrow = document.getElementById("heroEyebrow");
  const subtitle = document.getElementById("heroSubtitle");
  if (!hero || !title || !eyebrow || !subtitle) return;

  const data = {
    home: ["Dieciseisavos Test Lab", "MatchIQ v2.0", "Prueba final con mapa de calor y bankroll por sesión."],
    recommended: ["Mapa de Calor IA", "Mercados", "Probabilidad, heat, ambos anotan y escenarios probables."],
    ticket: ["Ticket Builder", "Ticket", "Detector manual, edge real y value frente al momio."],
    history: ["Sesión de prueba", "Resultados", "Bankroll, ROI por mercado y tickets cerrados."],
    profile: ["Ajustes", "Sesión", "Configura bankroll, filtros y perfil de riesgo."]
  }[tab] || ["MatchIQ", "Inicio", ""];

  eyebrow.textContent = data[0];
  title.textContent = data[1];
  subtitle.textContent = data[2];
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

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportSessionCSV() {
  const list = sessionTickets();
  if (!list.length) {
    alert("No hay tickets en esta sesión.");
    return;
  }

  const headers = [
    "session", "fecha", "estado", "casa", "momio", "stake", "utilidad", "prob_ia", "momio_justo", "edge", "heat_promedio", "partido", "pick", "mercado", "linea", "calidad", "heat"
  ];

  const rows = [];
  list.forEach(ticket => {
    (ticket.selections || []).forEach(selection => {
      rows.push([
        activeSession().name,
        ticket.createdAt,
        ticket.status,
        ticket.book,
        ticket.odds,
        ticket.stake,
        ticketProfit(ticket),
        ticket.combinedProbability,
        ticket.fairOdds,
        ticket.edge,
        ticket.heatAverage,
        selection.match,
        selection.text,
        selection.market,
        selection.line,
        selection.dataQuality,
        selection.heatScore
      ]);
    });
  });

  const csv = [headers.map(csvEscape).join(","), ...rows.map(row => row.map(csvEscape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `matchiq_v2_${activeSession().name.replace(/\s+/g, "_")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("CSV exportado");
}

async function init() {
  Object.values(screens).forEach(screen => {
    screen.innerHTML = `<section class="glass panel"><h2>Cargando...</h2><p class="note">Preparando MatchIQ v${APP_VERSION}.</p></section>`;
  });

  try {
    resultsData = await loadResults();
    matches = PHASE_MATCHES.map(match => ({ ...match }));
    predictionCache = new Map();

    const dates = [...new Set(matches.map(match => match.date))];
    const today = new Date().toISOString().slice(0, 10);
    selectedDate = dates.includes(today) ? today : dates[0];
    selectedMatchId = matchesByDate(selectedDate)[0]?.id || matches[0]?.id || "";

    updateHero("home");
    renderAll();
  } catch (error) {
    console.error(error);
    Object.values(screens).forEach(screen => {
      screen.innerHTML = `<section class="glass panel"><h2>Error</h2><p class="note">No se pudo iniciar MatchIQ v${APP_VERSION}. Revisa que los 8 archivos estén completos.</p></section>`;
    });
  }
}

init();
