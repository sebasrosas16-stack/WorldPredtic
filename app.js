const PICK_TYPES = [
  { key: "safe", name: "Conservadores", emoji: "🟢" },
  { key: "balanced", name: "Equilibrados", emoji: "🟡" },
  { key: "aggressive", name: "Agresivos", emoji: "🔴" },
  { key: "score", name: "Marcadores", emoji: "🎯" },
  { key: "player", name: "Jugadores", emoji: "⚽" },
  { key: "corners", name: "Córners", emoji: "🚩" }
];

const UPCOMING_MATCHES = [
  ["Switzerland", "Canada"],
  ["Bosnia and Herzegovina", "Qatar"],
  ["Scotland", "Brazil"],
  ["Morocco", "Haiti"],
  ["Czech Republic", "Mexico"],
  ["South Africa", "South Korea"],
  ["Ecuador", "Germany"],
  ["Tunisia", "Netherlands"],
  ["Japan", "Sweden"],
  ["Turkey", "United States"],
  ["Paraguay", "Australia"],
  ["Norway", "France"],
  ["Senegal", "Iraq"],
  ["Uruguay", "Spain"],
  ["Cape Verde", "Saudi Arabia"],
  ["New Zealand", "Belgium"],
  ["Egypt", "Iran"],
  ["Panama", "England"],
  ["Croatia", "Ghana"],
  ["Colombia", "Portugal"],
  ["DR Congo", "Uzbekistan"],
  ["Jordan", "Argentina"],
  ["Algeria", "Austria"]
];

const DISPLAY_NAMES = {
  "Czech Republic": "Chequia",
  "United States": "Estados Unidos",
  "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "South Korea": "Corea del Sur",
  "Cape Verde": "Cabo Verde",
  "DR Congo": "RD Congo"
};

const select = document.getElementById("matchSelect");
const card = document.getElementById("matchCard");

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

function getPlayerSuggestions(home, away, favorite) {
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

function renderMatch(match) {
  const prediction = predictMatch(resultsData, match.home, match.away);
  const picks = generatePicks(prediction);
  const players = getPlayerSuggestions(match.home, match.away, prediction.favorite);

  picks.push({
    type: "player",
    label: "Jugador",
    emoji: "⚽",
    text: players[0]
  });

  const matchName = `${displayName(match.home)} vs ${displayName(match.away)}`;

  card.innerHTML = `
    <h2 class="match-title">${matchName}</h2>
    <p class="note">Datos históricos cargados desde el repo original. Marcador IA probable: <strong>${prediction.score}</strong></p>

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

    ${picks.map(pick => `
      <div class="pick ${pick.type}">
        <div class="pick-title">${pick.emoji} ${pick.label}</div>
        <strong>${pick.text}</strong>

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

function markPick(matchId, pickType, ok) {
  const match = currentMatches.find(m => m.id === matchId);
  const prediction = predictMatch(resultsData, match.home, match.away);
  const picks = generatePicks(prediction);
  const players = getPlayerSuggestions(match.home, match.away, prediction.favorite);

  picks.push({
    type: "player",
    label: "Jugador",
    emoji: "⚽",
    text: players[0]
  });

  const pick = picks.find(p => p.type === pickType);

  if (ok) {
    record.wins++;
    record.byType[pickType].wins++;
  } else {
    record.losses++;
    record.byType[pickType].losses++;
  }

  record.history.push({
    match: `${displayName(match.home)} vs ${displayName(match.away)}`,
    pick: pick.text,
    type: pickType,
    typeLabel: pick.label,
    ok,
    date: new Date().toISOString()
  });

  saveRecord();
}

function buildMatches() {
  currentMatches = UPCOMING_MATCHES.map(([home, away]) => ({
    id: `${home}-${away}`.toLowerCase().replaceAll(" ", "-"),
    home,
    away
  }));

  select.innerHTML = "";

  currentMatches.forEach(match => {
    const option = document.createElement("option");
    option.value = match.id;
    option.textContent = `${displayName(match.home)} vs ${displayName(match.away)}`;
    select.appendChild(option);
  });
}

async function init() {
  card.innerHTML = `
    <h2 class="match-title">Cargando datos...</h2>
    <p class="note">Conectando con el repositorio original y calculando modelo.</p>
  `;

  try {
    resultsData = await loadResults();
    buildMatches();
    renderRecord();
    renderMatch(currentMatches[0]);
  } catch (error) {
    card.innerHTML = `
      <h2 class="match-title">Error al cargar datos</h2>
      <p class="note">No se pudo conectar al CSV original. Revisa conexión o vuelve a intentar.</p>
    `;
    console.error(error);
  }
}

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
