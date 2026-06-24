const matches = [
  {
    id: "mar-hai",
    name: "Marruecos vs Haití",
    probs: [78, 15, 7],
    score: "2-0",
    safe: "Marruecos anota 1+ gol",
    balanced: "Marruecos gana",
    aggressive: "Marruecos gana y Haití no anota",
    note: "Modelo: ventaja ofensiva clara de Marruecos, baja producción ofensiva de Haití y mayor control territorial esperado."
  },
  {
    id: "sco-bra",
    name: "Escocia vs Brasil",
    probs: [11, 18, 71],
    score: "0-2",
    safe: "Brasil anota 1+ gol",
    balanced: "Brasil gana",
    aggressive: "Brasil gana a cero",
    note: "Modelo: Brasil domina posesión y volumen ofensivo; Escocia tiende a partidos cerrados."
  },
  {
    id: "cze-mex",
    name: "Chequia vs México",
    probs: [21, 25, 54],
    score: "1-2",
    safe: "México o empate",
    balanced: "México gana",
    aggressive: "México gana y ambos anotan",
    note: "Modelo: México tiene mejor momento y factor local, pero Chequia conserva riesgo por juego aéreo."
  }
];

const select = document.getElementById("matchSelect");
const card = document.getElementById("matchCard");

const winsEl = document.getElementById("wins");
const lossesEl = document.getElementById("losses");
const hitRateEl = document.getElementById("hitRate");
const resetBtn = document.getElementById("resetBtn");

let record = JSON.parse(localStorage.getItem("matchiq_record")) || {
  wins: 0,
  losses: 0
};

function saveRecord() {
  localStorage.setItem("matchiq_record", JSON.stringify(record));
  renderRecord();
}

function renderRecord() {
  const total = record.wins + record.losses;
  winsEl.textContent = record.wins;
  lossesEl.textContent = record.losses;
  hitRateEl.textContent = total ? `${Math.round((record.wins / total) * 100)}%` : "0%";
}

function renderMatch(match) {
  card.innerHTML = `
    <h2 class="match-title">${match.name}</h2>
    <p class="note">Marcador IA probable: <strong>${match.score}</strong></p>

    <div class="prob-grid">
      <div class="prob"><strong>${match.probs[0]}%</strong><span>Local</span></div>
      <div class="prob"><strong>${match.probs[1]}%</strong><span>Empate</span></div>
      <div class="prob"><strong>${match.probs[2]}%</strong><span>Visita</span></div>
    </div>

    <div class="pick safe">
      <div class="pick-title">🟢 Conservador</div>
      <strong>${match.safe}</strong>
    </div>

    <div class="pick balanced">
      <div class="pick-title">🟡 Equilibrado</div>
      <strong>${match.balanced}</strong>
    </div>

    <div class="pick aggressive">
      <div class="pick-title">🔴 Agresivo</div>
      <strong>${match.aggressive}</strong>
    </div>

    <p class="note">${match.note}</p>

    <div class="actions">
      <button class="win" onclick="markResult(true)">✅ Se cumplió</button>
      <button class="lose" onclick="markResult(false)">❌ Falló</button>
    </div>
  `;
}

function markResult(ok) {
  if (ok) record.wins++;
  else record.losses++;
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
  record = { wins: 0, losses: 0 };
  saveRecord();
});

renderRecord();
renderMatch(matches[0]);
