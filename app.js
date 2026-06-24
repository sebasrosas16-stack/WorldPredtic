const PICK_TYPES = [
  { key: "safe", name: "Conservadores", emoji: "🟢" },
  { key: "balanced", name: "Equilibrados", emoji: "🟡" },
  { key: "aggressive", name: "Agresivos", emoji: "🔴" },
  { key: "score", name: "Marcadores", emoji: "🎯" },
  { key: "player", name: "Jugadores", emoji: "⚽" },
  { key: "corners", name: "Córners", emoji: "🚩" }
];

const matches = [
  {
    id: "mar-hai",
    name: "Marruecos vs Haití",
    teams: ["Marruecos", "Haití"],
    probs: [78, 15, 7],
    score: "2-0",
    topScores: ["2-0", "1-0", "3-0"],
    corners: {
      home: 6.1,
      away: 2.8,
      pick: "Marruecos más de 4.5 córners"
    },
    players: [
      "Hakimi 1+ tiro",
      "En-Nesyri 1+ tiro a puerta",
      "Ziyech participa en gol"
    ],
    note: "Modelo: ventaja ofensiva clara de Marruecos, baja producción ofensiva de Haití y mayor control territorial esperado.",
    picks: [
      { type: "safe", label: "Conservador", emoji: "🟢", text: "Marruecos anota 1+ gol" },
      { type: "balanced", label: "Equilibrado", emoji: "🟡", text: "Marruecos gana" },
      { type: "aggressive", label: "Agresivo", emoji: "🔴", text: "Marruecos gana y Haití no anota" },
      { type: "score", label: "Marcador", emoji: "🎯", text: "Marcador exacto 2-0" },
      { type: "player", label: "Jugador", emoji: "⚽", text: "En-Nesyri 1+ tiro a puerta" },
      { type: "corners", label: "Córners", emoji: "🚩", text: "Marruecos más de 4.5 córners" }
    ]
  },
  {
    id: "sco-bra",
    name: "Escocia vs Brasil",
    teams: ["Escocia", "Brasil"],
    probs: [11, 18, 71],
    score: "0-2",
    topScores: ["0-2", "0-1", "1-2"],
    corners: {
      home: 3.1,
      away: 6.4,
      pick: "Brasil más de 3.5 córners"
    },
    players: [
      "Vinícius Jr. 1+ tiro a puerta",
      "Rodrygo 1+ tiro",
      "Neymar participa en gol"
    ],
    note: "Modelo: Brasil domina posesión y volumen ofensivo; Escocia tiende a partidos cerrados.",
    picks: [
      { type: "safe", label: "Conservador", emoji: "🟢", text: "Brasil anota 1+ gol" },
      { type: "balanced", label: "Equilibrado", emoji: "🟡", text: "Brasil gana" },
      { type: "aggressive", label: "Agresivo", emoji: "🔴", text: "Brasil gana a cero" },
      { type: "score", label: "Marcador", emoji: "🎯", text: "Marcador exacto 0-2" },
      { type: "player", label: "Jugador", emoji: "⚽", text: "Vinícius Jr. 1+ tiro a puerta" },
      { type: "corners", label: "Córners", emoji: "🚩", text: "Brasil más de 3.5 córners" }
    ]
  },
  {
    id: "cze-mex",
    name: "Chequia vs México",
    teams: ["Chequia", "México"],
    probs: [21, 25, 54],
    score: "1-2",
    topScores: ["1-2", "1-1", "0-1"],
    corners: {
      home: 4.2,
      away: 5.3,
      pick: "Más de 8.5 córners totales"
    },
    players: [
      "Santiago Giménez 1+ tiro a puerta",
      "Lozano 1+ tiro",
      "Alexis Vega 1+ tiro"
    ],
    note: "Modelo: México tiene mejor momento y factor local, pero Chequia conserva riesgo por juego aéreo.",
    picks: [
      { type: "safe", label: "Conservador", emoji: "🟢", text: "México o empate" },
      { type: "balanced", label: "Equilibrado", emoji: "🟡", text: "México gana" },
      { type: "aggressive", label: "Agresivo", emoji: "🔴", text: "México gana y ambos anotan" },
      { type: "score", label: "Marcador", emoji: "🎯", text: "Marcador exacto 1-2" },
      { type: "player", label: "Jugador", emoji: "⚽", text: "Santiago Giménez 1+ tiro a puerta" },
      { type: "corners", label: "Córners", emoji: "🚩", text: "Más de 8.5 córners totales" }
    ]
  }
];

const select = document.getElementById("matchSelect");
const card = document.getElementById("matchCard");

const winsEl = document.getElementById("wins");
const lossesEl = document.getElementById("losses");
const hitRateEl = document.getElementById("hitRate");
const resetBtn = document.getElementById("resetBtn");

const STORAGE_KEY = "matchiq_pick_record_v3";

let record = JSON.parse(localStorage.getItem(STORAGE_KEY)) || createEmptyRecord();

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

function renderRecord() {
  normalizeRecord();

  const total = record.wins + record.losses;

  winsEl.textContent = record.wins;
  lossesEl.textContent = record.losses;
  hitRateEl.textContent = total ? `${rate(record.wins, record.losses)}%` : "0%";

  renderTypeStats();
  renderHistory();
}

function ensureRecordBlocks() {
  if (!document.getElementById("typeStats")) {
    resetBtn.insertAdjacentHTML(
      "beforebegin",
      `<div id="typeStats" class="type-stats"></div>`
    );
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

function renderMatch(match) {
  card.innerHTML = `
    <h2 class="match-title">${match.name}</h2>
    <p class="note">Marcador IA probable: <strong>${match.score}</strong></p>

    <div class="prob-grid">
      <div class="prob"><strong>${match.probs[0]}%</strong><span>${match.teams[0]}</span></div>
      <div class="prob"><strong>${match.probs[1]}%</strong><span>Empate</span></div>
      <div class="prob"><strong>${match.probs[2]}%</strong><span>${match.teams[1]}</span></div>
    </div>

    <div class="insight-grid">
      <div class="insight-card">
        <span>🎯 Top marcadores</span>
        <strong>${match.topScores.join(" · ")}</strong>
      </div>

      <div class="insight-card">
        <span>🚩 Córners esperados</span>
        <strong>${match.teams[0]} ${match.corners.home} / ${match.teams[1]} ${match.corners.away}</strong>
      </div>

      <div class="insight-card full">
        <span>⚽ Jugadores sugeridos</span>
        <strong>${match.players.join(" · ")}</strong>
      </div>
    </div>

    ${match.picks.map(pick => `
      <div class="pick ${pick.type}">
        <div class="pick-title">${pick.emoji} ${pick.label}</div>
        <strong>${pick.text}</strong>

        <div class="actions">
          <button class="win" onclick="markPick('${match.id}', '${pick.type}', true)">✅ Se cumplió</button>
          <button class="lose" onclick="markPick('${match.id}', '${pick.type}', false)">❌ Falló</button>
        </div>
      </div>
    `).join("")}

    <p class="note">${match.note}</p>
  `;
}

function markPick(matchId, pickType, ok) {
  const match = matches.find(m => m.id === matchId);
  const pick = match.picks.find(p => p.type === pickType);

  if (ok) {
    record.wins++;
    record.byType[pickType].wins++;
  } else {
    record.losses++;
    record.byType[pickType].losses++;
  }

  record.history.push({
    match: match.name,
    pick: pick.text,
    type: pickType,
    typeLabel: pick.label,
    ok,
    date: new Date().toISOString()
  });

  saveRecord();
}

matches.forEach(match => {
  const option = document.createElement("option");
  option.value = match.id;
  option.textContent = match.name;
  select.appendChild(option);
});

select.addEventListener("change", () => {
  const match = matches.find(m => m.id === select.value);
  renderMatch(match);
});

resetBtn.addEventListener("click", () => {
  const confirmReset = confirm("¿Seguro que quieres borrar todo tu historial?");
  if (!confirmReset) return;

  record = createEmptyRecord();
  saveRecord();
});

normalizeRecord();
renderRecord();
renderMatch(matches[0]);
