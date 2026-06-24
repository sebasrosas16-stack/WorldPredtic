const PICK_TYPES = [
  { key: "safe", name: "Conservadores", emoji: "🟢" },
  { key: "balanced", name: "Equilibrados", emoji: "🟡" },
  { key: "aggressive", name: "Agresivos", emoji: "🔴" },
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

const dateSelect = document.getElementById("dateSelect");
const select = document.getElementById("matchSelect");
const card = document.getElementById("matchCard");
const dailySuggestion = document.getElementById("dailySuggestion");

const winsEl = document.getElementById("wins");
const lossesEl = document.getElementById("losses");
const hitRateEl = document.getElementById("hitRate");
const resetBtn = document.getElementById("resetBtn");

const STORAGE_KEY = "matchiq_pick_record_v4";

let resultsData = [];
let currentMatches = [];

let record = JSON.parse(localStorage.getItem(STORAGE_KEY)) || createEmptyRecord();

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
    .replaceAll(".", "");
}

function createEmptyRecord() {
  const byType = {};
  PICK_TYPES.forEach(type => {
    byType[type.key] = { wins: 0, losses: 0 };
  });

  return {
    wins: 0,
    losses: 0,
    byType,
    history: []
  };
}

function normalizeRecord() {
  if (!record.byType) record.byType = {};

  PICK_TYPES.forEach(type => {
    if (!record.byType[type.key]) {
      record.byType[type.key] = { wins: 0, losses: 0 };
    }
  });

  if (!record.history) record.history = [];
}

function saveRecord() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  renderRecord();
}

function rate(wins, losses) {
  const total = wins + losses;
  return total ? Math.round((wins / total) * 100) : 0;
}

function formatPct(value) {
  return `${Math.round(value * 100)}%`;
}

function formatOdds(value) {
  return Number(value).toFixed(2);
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
  normalizeRecord();

  const total = record.wins + record.losses;

  winsEl.textContent = record.wins;
  lossesEl.textContent = record.losses;
  hitRateEl.textContent = total ? `${rate(record.wins, record.losses)}%` : "0%";

  renderTypeStats();
  renderHistory();
}

function renderTypeStats() {
  ensureRecordBlocks();

  const typeStats = document.getElementById("typeStats");

  typeStats.innerHTML = PICK_TYPES.map(type => {
    const item = record.byType[type.key];
    const total = item.wins + item.losses;

    return `
      <div class="type-row">
        <div>
          <strong>${type.emoji} ${type.name}</strong>
          <span>${item.wins} buenas / ${item.losses} malas</span>
        </div>
        <div class="mini-rate">${total ? rate(item.wins, item.losses) : 0}%</div>
      </div>
    `;
  }).join("");
}

function renderHistory() {
  ensureRecordBlocks();

  const historyList = document.getElementById("historyList");

  if (!record.history.length) {
    historyList.innerHTML = `<p class="note">Todavía no has marcado ningún pick.</p>`;
    return;
  }

  historyList.innerHTML = record.history
    .slice(-8)
    .reverse()
    .map(item => `
      <div class="history-item">
        <div>
          <strong>${item.ok ? "✅" : "❌"} ${item.pick}</strong>
          <span>${item.match} · ${item.typeLabel}</span>
        </div>
      </div>
    `)
    .join("");
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

function getPickProbability(pick, prediction) {
  const favGoalProb = 1 - poisson(0, prediction.favorite.lambda);

  if (pick.type === "safe") {
    if (pick.text.includes("anota")) return favGoalProb;
    return prediction.under45 / 100;
  }

  if (pick.type === "balanced") {
    if (pick.text.includes("Doble oportunidad")) {
      return prediction.favorite.prob + (prediction.probs.draw / 100);
    }
    return prediction.favorite.prob;
  }

  if (pick.type === "aggressive") {
    if (pick.text.includes("cero")) return winToNilProbability(prediction);
    return winAndUnder45Probability(prediction);
  }

  if (pick.type === "score") {
    return scoreProbability(prediction.score, prediction);
  }

  if (pick.type === "corners") {
    const cornerFav = prediction.favorite.side === "home"
      ? prediction.corners.home
      : prediction.corners.away;

    return cornerFav >= 5 ? 0.64 : 0.56;
  }

  if (pick.type === "player") {
    return 0.57;
  }

  return 0.5;
}

function confidenceLabel(probability) {
  if (probability >= 0.72) return "Alta";
  if (probability >= 0.52) return "Media";
  return "Baja";
}

function riskLabel(probability) {
  if (probability >= 0.72) return "Bajo";
  if (probability >= 0.52) return "Medio";
  return "Alto";
}

function decoratePicks(picks, prediction) {
  return picks.map(pick => {
    const probability = getPickProbability(pick, prediction);
    const fairOdds = 1 / probability;
    const valueOdds = 1.08 / probability;

    return {
      ...pick,
      probability,
      fairOdds,
      valueOdds,
      confidence: confidenceLabel(probability),
      risk: riskLabel(probability)
    };
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

function getFullPicks(prediction) {
  const basePicks = generatePicks(prediction);
  const players = getPlayerSuggestions(prediction.favorite);

  basePicks.push({
    type: "player",
    label: "Jugador",
    emoji: "⚽",
    text: players[0]
  });

  return decoratePicks(basePicks, prediction);
}

function makeWhy(prediction, pick) {
  const fav = displayName(prediction.favorite.team);
  const homeGF = prediction.homeStats.gf.toFixed(2);
  const awayGF = prediction.awayStats.gf.toFixed(2);
  const homeGA = prediction.homeStats.ga.toFixed(2);
  const awayGA = prediction.awayStats.ga.toFixed(2);

  if (pick.type === "safe") {
    return `${pick.text} aparece como pick sólido porque ${fav} tiene una expectativa de gol de ${prediction.favorite.lambda.toFixed(2)} y el mercado estimado supera ${formatPct(pick.probability)}. Es un pick pensado para estabilidad, no para pagar alto.`;
  }

  if (pick.type === "balanced") {
    return `${pick.text} tiene valor medio porque el modelo le da a ${fav} la mayor probabilidad de resultado. La forma reciente pondera ataque/defensa: ${displayName(prediction.home)} GF ${homeGF}, GA ${homeGA}; ${displayName(prediction.away)} GF ${awayGF}, GA ${awayGA}.`;
  }

  if (pick.type === "aggressive") {
    return `${pick.text} es interesante, pero volátil. Depende de que ${fav} gane y limite mucho al rival. Úsalo como pick pequeño o combinado con cautela.`;
  }

  if (pick.type === "score") {
    return `El marcador ${prediction.score} es el más probable dentro de la matriz Poisson, pero los marcadores exactos siempre tienen probabilidad baja. Es útil para momios altos, no para apuesta fuerte.`;
  }

  if (pick.type === "corners") {
    return `El pick de córners sale como proxy del dominio ofensivo esperado. No viene directo del CSV, porque el archivo histórico no incluye córners; se estima con goles esperados y superioridad ofensiva.`;
  }

  if (pick.type === "player") {
    return `El pick de jugador es una sugerencia proxy basada en el equipo favorito y roles ofensivos conocidos. Para hacerlo exacto necesitaremos alinear datos en vivo de titulares, tiros y props.`;
  }

  return "El modelo combina forma reciente, goles esperados y distribución de marcadores.";
}

function getMatchesByDate(date) {
  return currentMatches.filter(match => match.date === date);
}

function renderDailySuggestion() {
  const selectedDate = dateSelect.value;
  const candidates = getCandidatesForDate(selectedDate);

  const solid = candidates
    .filter(item => ["safe", "corners"].includes(item.pick.type))
    .sort((a, b) => b.pick.probability - a.pick.probability)[0];

  const value = candidates
    .filter(item => ["safe", "balanced", "aggressive"].includes(item.pick.type))
    .filter(item => item.pick.probability >= 0.42)
    .sort((a, b) => a.pick.valueOdds - b.pick.valueOdds)[0];

  const risky = candidates
    .filter(item => ["aggressive", "score"].includes(item.pick.type))
    .filter(item => item.pick.probability >= 0.07 && item.pick.probability <= 0.40)
    .sort((a, b) => b.pick.probability - a.pick.probability)[0];

  dailySuggestion.innerHTML = `
    <h2>Sugerencia del día</h2>
    <p class="note">Fecha: <strong>${DATE_LABELS[selectedDate] || selectedDate}</strong>. La app revisa todos los partidos de ese día.</p>

    <div class="daily-grid">
      ${renderDailyCard("🟢 Más sólido", solid, "Probabilidad alta")}
      ${renderDailyCard("🔥 Caza-value", value, `Buscar momio arriba de @${formatOdds(value.pick.valueOdds)}`)}
      ${renderDailyCard("🧨 Arriesgado interesante", risky, "Pago potencial alto")}
    </div>

    <h3 class="mini-title">Top picks de la fecha</h3>
    ${renderTopPicksList(selectedDate)}
  `;
}
  });

  const solid = candidates
    .filter(item => ["safe", "corners"].includes(item.pick.type))
    .sort((a, b) => b.pick.probability - a.pick.probability)[0];

  const value = candidates
    .filter(item => ["safe", "balanced", "aggressive"].includes(item.pick.type))
    .filter(item => item.pick.probability >= 0.42)
    .sort((a, b) => a.pick.valueOdds - b.pick.valueOdds)[0];

  const risky = candidates
    .filter(item => ["aggressive", "score"].includes(item.pick.type))
    .filter(item => item.pick.probability >= 0.07 && item.pick.probability <= 0.40)
    .sort((a, b) => b.pick.probability - a.pick.probability)[0];

  dailySuggestion.innerHTML = `
    <h2>Sugerencia del día</h2>
    <p class="note">Fecha: <strong>${DATE_LABELS[selectedDate] || selectedDate}</strong>. La app analiza todos los partidos de ese día y selecciona automáticamente.</p>

    <div class="daily-grid">
      ${renderDailyCard("🟢 Más sólido", solid, "Probabilidad alta")}
      ${renderDailyCard("🔥 Caza-value", value, `Buscar momio arriba de @${formatOdds(value.pick.valueOdds)}`)}
      ${renderDailyCard("🧨 Arriesgado interesante", risky, "Pago potencial alto")}
    </div>
  `;
}
function getCandidatesForDate(date) {
  const matches = getMatchesByDate(date);
  const candidates = [];

  matches.forEach(match => {
    const prediction = predictMatch(resultsData, match.home, match.away);
    const picks = getFullPicks(prediction);

    picks.forEach(pick => {
      candidates.push({
        match,
        prediction,
        pick
      });
    });
  });

  return candidates;
}

function renderTopPicksList(date) {
  const ranked = getCandidatesForDate(date)
    .filter(item => item.pick.type !== "score")
    .sort((a, b) => b.pick.probability - a.pick.probability)
    .slice(0, 8);

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

function renderHeatmap(prediction) {
  const maxGoals = 4;
  const cells = [];

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const probability = poisson(h, prediction.homeLambda) * poisson(a, prediction.awayLambda);

      cells.push({
        h,
        a,
        probability,
        score: `${h}-${a}`
      });
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
            const heat = Math.max(0.12, cell.probability / maxProb).toFixed(2);

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
function renderDailyCard(title, item, subtitle) {
  return `
    <button class="daily-card" onclick="selectMatchById('${item.match.id}')">
      <span>${title}</span>
      <strong>${item.pick.text}</strong>
      <small>${matchName(item.match)}</small>
      <em>${subtitle} · IA ${formatPct(item.pick.probability)}</em>
    </button>
  `;
}

function selectMatchById(id) {
  select.value = id;
  const match = currentMatches.find(item => item.id === id);
  renderMatch(match);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderMatch(match) {
  const prediction = predictMatch(resultsData, match.home, match.away);
  const picks = getFullPicks(prediction);
  const players = getPlayerSuggestions(prediction.favorite);
  const bestPick = [...picks].sort((a, b) => b.probability - a.probability)[0];

  card.innerHTML = `
    <h2 class="match-title">${matchName(match)}</h2>
    <p class="note">Marcador IA probable: <strong>${prediction.score}</strong>. Favorito del modelo: <strong>${displayName(prediction.favorite.team)}</strong>.</p>

    <div class="prob-grid">
      <div class="prob"><strong>${prediction.probs.home}%</strong><span>${displayName(match.home)}</span></div>
      <div class="prob"><strong>${prediction.probs.draw}%</strong><span>Empate</span></div>
      <div class="prob"><strong>${prediction.probs.away}%</strong><span>${displayName(match.away)}</span></div>
    </div>

    <div class="insight-grid">
      <div class="insight-card">
        <span>🎯 Top marcadores</span>
        <strong>${prediction.topScores.join(" · ")}</strong>
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
      <p>${makeWhy(prediction, bestPick)}</p>
    </div>

    <div class="value-box">
      <span>💰 Detector de value</span>
      <label for="valuePickSelect">Mercado</label>
      <select id="valuePickSelect">
        ${picks.map(pick => `
          <option value="${pick.type}">${pick.emoji} ${pick.text} · IA ${formatPct(pick.probability)}</option>
        `).join("")}
      </select>

      <label for="oddsInput">Momio decimal que ves en Draftea</label>
      <input id="oddsInput" type="number" min="1.01" step="0.01" placeholder="Ejemplo: 1.85" oninput="analyzeValue()" />

      <div id="valueResult" class="value-result">
        Escribe un momio para saber si hay value.
      </div>
    </div>

    ${picks.map(pick => `
      <div class="pick ${pick.type}">
        <div class="pick-title">${pick.emoji} ${pick.label}</div>
        <strong>${pick.text}</strong>
        <p class="pick-meta">IA ${formatPct(pick.probability)} · Riesgo ${pick.risk} · Momio justo @${formatOdds(pick.fairOdds)}</p>

        <div class="actions">
          <button class="win" onclick="markPick('${match.id}', '${pick.type}', true)">✅ Se cumplió</button>
          <button class="lose" onclick="markPick('${match.id}', '${pick.type}', false)">❌ Falló</button>
        </div>
      </div>
    `).join("")}

    <p class="note">
      Modelo actual: forma reciente ponderada + goles esperados + distribución Poisson. 
      Córners y jugadores siguen siendo proxy hasta conectar API en vivo.
    </p>
  `;
}
}

function analyzeValue() {
  const match = currentMatches.find(m => m.id === select.value);
  const prediction = predictMatch(resultsData, match.home, match.away);
  const picks = getFullPicks(prediction);

  const selectedType = document.getElementById("valuePickSelect").value;
  const odds = Number(document.getElementById("oddsInput").value);
  const result = document.getElementById("valueResult");

  const pick = picks.find(item => item.type === selectedType);

  if (!odds || odds <= 1) {
    result.innerHTML = "Escribe un momio decimal válido.";
    result.className = "value-result";
    return;
  }

  const implied = 1 / odds;
  const edge = pick.probability - implied;
  const ev = (pick.probability * odds) - 1;

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

function markPick(matchId, pickType, ok) {
  const match = currentMatches.find(m => m.id === matchId);
  const prediction = predictMatch(resultsData, match.home, match.away);
  const picks = getFullPicks(prediction);
  const pick = picks.find(p => p.type === pickType);

  if (ok) {
    record.wins++;
    record.byType[pickType].wins++;
  } else {
    record.losses++;
    record.byType[pickType].losses++;
  }

  record.history.push({
    match: matchName(match),
    pick: pick.text,
    type: pickType,
    typeLabel: pick.label,
    ok,
    date: new Date().toISOString()
  });

  saveRecord();
}

function buildDateOptions() {
  const dates = [...new Set(currentMatches.map(match => match.date))];

  dateSelect.innerHTML = dates.map(date => `
    <option value="${date}">${DATE_LABELS[date] || date}</option>
  `).join("");
}

function buildMatchOptions() {
  const selectedDate = dateSelect.value;
  const matches = getMatchesByDate(selectedDate);

  select.innerHTML = matches.map(match => `
    <option value="${match.id}">${matchName(match)}</option>
  `).join("");
}

async function init() {
  card.innerHTML = `
    <h2 class="match-title">Cargando datos...</h2>
    <p class="note">Conectando con el repositorio original y calculando modelo.</p>
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
    console.error(error);
  }
}

dateSelect.addEventListener("change", () => {
  buildMatchOptions();
  renderDailySuggestion();

  const match = currentMatches.find(m => m.id === select.value);
  renderMatch(match);
});

select.addEventListener("change", () => {
  const match = currentMatches.find(m => m.id === select.value);
  renderMatch(match);
});

resetBtn.addEventListener("click", () => {
  const confirmReset = confirm("¿Seguro que quieres borrar todo tu historial?");
  if (!confirmReset) return;

  record = createEmptyRecord();
  saveRecord();
});

normalizeRecord();
init();
