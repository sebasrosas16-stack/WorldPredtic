const APP_VERSION = "2.0";

const DISPLAY_NAMES = {
  "South Africa": "Sudáfrica",
  "Canada": "Canadá",
  "Ivory Coast": "Costa de Marfil",
  "United States": "Estados Unidos",
  "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "DR Congo": "RD Congo",
  "Cape Verde": "Cabo Verde",
  "Switzerland": "Suiza",
  "Algeria": "Argelia",
  "Netherlands": "Países Bajos",
  "Germany": "Alemania",
  "Japan": "Japón",
  "Morocco": "Marruecos",
  "Paraguay": "Paraguay",
  "Norway": "Noruega",
  "France": "Francia",
  "Sweden": "Suecia",
  "Mexico": "México",
  "Ecuador": "Ecuador",
  "England": "Inglaterra",
  "Belgium": "Bélgica",
  "Senegal": "Senegal",
  "Spain": "España",
  "Austria": "Austria",
  "Portugal": "Portugal",
  "Croatia": "Croacia",
  "Australia": "Australia",
  "Egypt": "Egipto",
  "Argentina": "Argentina",
  "Colombia": "Colombia",
  "Ghana": "Ghana",
  "Brazil": "Brasil"
};

const TEAM_ALIASES = {
  "usa": "United States",
  "estados unidos": "United States",
  "eeuu": "United States",
  "rd congo": "DR Congo",
  "dr congo": "DR Congo",
  "congo": "DR Congo",
  "cabo verde": "Cape Verde",
  "sudafrica": "South Africa",
  "sudáfrica": "South Africa",
  "canada": "Canada",
  "canadá": "Canada",
  "alemania": "Germany",
  "japon": "Japan",
  "japón": "Japan",
  "paises bajos": "Netherlands",
  "países bajos": "Netherlands",
  "holanda": "Netherlands",
  "mexico": "Mexico",
  "méxico": "Mexico",
  "brasil": "Brazil",
  "francia": "France",
  "suecia": "Sweden",
  "espana": "Spain",
  "españa": "Spain",
  "suiza": "Switzerland",
  "argelia": "Algeria",
  "austria": "Austria",
  "portugal": "Portugal",
  "croacia": "Croatia",
  "argentina": "Argentina",
  "colombia": "Colombia",
  "ghana": "Ghana",
  "egipto": "Egypt",
  "australia": "Australia",
  "belgica": "Belgium",
  "bélgica": "Belgium",
  "senegal": "Senegal",
  "noruega": "Norway",
  "paraguay": "Paraguay",
  "marruecos": "Morocco",
  "costa de marfil": "Ivory Coast",
  "inglaterra": "England",
  "bosnia": "Bosnia and Herzegovina",
  "bosnia y herzegovina": "Bosnia and Herzegovina"
};

const PHASE_MATCHES = [
  {
    id: "r32-01",
    date: "2026-06-28",
    time: "15:00 ET",
    home: "South Africa",
    away: "Canada",
    venue: "SoFi Stadium, Inglewood",
    phase: "Dieciseisavos",
    favoriteHint: "Canada",
    trap: false,
    koRisk: 0.44,
    volatility: 0.50,
    goalProfile: "medio",
    cornerProfile: "medio-over",
    cardProfile: "medio",
    contextNotes: [
      "Canadá parte con mejor techo competitivo, pero Sudáfrica puede sostener tramos cerrados.",
      "Eliminación directa: baja algo el ganador en 90 si el partido se atasca."
    ]
  },
  {
    id: "r32-02",
    date: "2026-06-29",
    time: "13:00 ET",
    home: "Brazil",
    away: "Japan",
    venue: "NRG Stadium, Houston",
    phase: "Dieciseisavos",
    favoriteHint: "Brazil",
    trap: false,
    koRisk: 0.38,
    volatility: 0.55,
    goalProfile: "medio-alto",
    cornerProfile: "over",
    cardProfile: "medio",
    contextNotes: [
      "Brasil puede cargar por bandas y generar córners.",
      "Japón tiene vías para anotar si el partido se abre."
    ]
  },
  {
    id: "r32-03",
    date: "2026-06-29",
    time: "16:30 ET",
    home: "Germany",
    away: "Paraguay",
    venue: "Gillette Stadium, Foxborough",
    phase: "Dieciseisavos",
    favoriteHint: "Germany",
    trap: false,
    koRisk: 0.34,
    volatility: 0.42,
    goalProfile: "medio",
    cornerProfile: "medio",
    cardProfile: "medio-alto",
    contextNotes: [
      "Alemania tiene mejor probabilidad de control territorial.",
      "Paraguay puede aumentar contacto y tarjetas si queda abajo."
    ]
  },
  {
    id: "r32-04",
    date: "2026-06-29",
    time: "21:00 ET",
    home: "Netherlands",
    away: "Morocco",
    venue: "Estadio BBVA, Monterrey",
    phase: "Dieciseisavos",
    favoriteHint: "Netherlands",
    trap: true,
    koRisk: 0.58,
    volatility: 0.66,
    goalProfile: "medio",
    cornerProfile: "medio-over",
    cardProfile: "alto",
    contextNotes: [
      "Partido trampa: Marruecos puede competir bien sin necesitar posesión dominante.",
      "Alta tensión de eliminación directa: cuidado con ganador seco."
    ]
  },
  {
    id: "r32-05",
    date: "2026-06-30",
    time: "13:00 ET",
    home: "Ivory Coast",
    away: "Norway",
    venue: "AT&T Stadium, Arlington",
    phase: "Dieciseisavos",
    favoriteHint: "Norway",
    trap: true,
    koRisk: 0.56,
    volatility: 0.62,
    goalProfile: "medio",
    cornerProfile: "medio-over",
    cardProfile: "medio-alto",
    contextNotes: [
      "Noruega tiene amenaza clara si conecta ataque, pero Costa de Marfil puede hacer el duelo físico.",
      "Mejor lectura: protección al favorito o mercados de goles simples."
    ]
  },
  {
    id: "r32-06",
    date: "2026-06-30",
    time: "17:00 ET",
    home: "France",
    away: "Sweden",
    venue: "MetLife Stadium, East Rutherford",
    phase: "Dieciseisavos",
    favoriteHint: "France",
    trap: false,
    koRisk: 0.36,
    volatility: 0.44,
    goalProfile: "medio",
    cornerProfile: "medio",
    cardProfile: "medio",
    contextNotes: [
      "Francia debe tener ventaja de calidad, pero Suecia puede bajar el ritmo.",
      "Mercados conservadores tienen mejor perfil que marcador exacto."
    ]
  },
  {
    id: "r32-07",
    date: "2026-06-30",
    time: "21:00 ET",
    home: "Mexico",
    away: "Ecuador",
    venue: "Estadio Azteca, Ciudad de México",
    phase: "Dieciseisavos",
    favoriteHint: "Mexico",
    trap: true,
    koRisk: 0.62,
    volatility: 0.60,
    goalProfile: "bajo-medio",
    cornerProfile: "under",
    cardProfile: "alto",
    contextNotes: [
      "Partido cerrado: México puede tener entorno a favor, Ecuador puede castigar errores.",
      "Perfil fuerte para under/NO BET en ganador si el momio no acompaña."
    ]
  },
  {
    id: "r32-08",
    date: "2026-07-01",
    time: "12:00 ET",
    home: "England",
    away: "DR Congo",
    venue: "Mercedes-Benz Stadium, Atlanta",
    phase: "Dieciseisavos",
    favoriteHint: "England",
    trap: false,
    koRisk: 0.30,
    volatility: 0.40,
    goalProfile: "medio",
    cornerProfile: "medio-over",
    cardProfile: "medio",
    contextNotes: [
      "Inglaterra tiene ventaja de control y profundidad.",
      "El mercado de clasifica es más estable que marcador exacto."
    ]
  },
  {
    id: "r32-09",
    date: "2026-07-01",
    time: "16:00 ET",
    home: "Belgium",
    away: "Senegal",
    venue: "Lumen Field, Seattle",
    phase: "Dieciseisavos",
    favoriteHint: "Belgium",
    trap: true,
    koRisk: 0.60,
    volatility: 0.68,
    goalProfile: "medio",
    cornerProfile: "medio",
    cardProfile: "medio-alto",
    contextNotes: [
      "Partido trampa: Senegal puede reducir ritmo y Bélgica puede sufrir si no anota temprano.",
      "Ganador seco requiere momio con mucho valor."
    ]
  },
  {
    id: "r32-10",
    date: "2026-07-01",
    time: "20:00 ET",
    home: "United States",
    away: "Bosnia and Herzegovina",
    venue: "Levi's Stadium, Santa Clara",
    phase: "Dieciseisavos",
    favoriteHint: "United States",
    trap: false,
    koRisk: 0.38,
    volatility: 0.47,
    goalProfile: "medio",
    cornerProfile: "medio-over",
    cardProfile: "medio",
    contextNotes: [
      "Estados Unidos tiene localía y mejor perfil físico.",
      "Bosnia puede competir en pelota parada; cuidado con ambos anotan si el partido se rompe."
    ]
  },
  {
    id: "r32-11",
    date: "2026-07-02",
    time: "15:00 ET",
    home: "Spain",
    away: "Austria",
    venue: "SoFi Stadium, Inglewood",
    phase: "Dieciseisavos",
    favoriteHint: "Spain",
    trap: false,
    koRisk: 0.42,
    volatility: 0.48,
    goalProfile: "medio",
    cornerProfile: "over",
    cardProfile: "medio",
    contextNotes: [
      "España puede dominar posesión y territorios.",
      "Austria puede sostener presión alta, lo que sube riesgo de transiciones y tarjetas."
    ]
  },
  {
    id: "r32-12",
    date: "2026-07-02",
    time: "19:00 ET",
    home: "Portugal",
    away: "Croatia",
    venue: "BMO Field, Toronto",
    phase: "Dieciseisavos",
    favoriteHint: "Portugal",
    trap: true,
    koRisk: 0.64,
    volatility: 0.63,
    goalProfile: "bajo-medio",
    cornerProfile: "under",
    cardProfile: "medio-alto",
    contextNotes: [
      "Partido trampa por experiencia de Croacia y riesgo de empate en 90.",
      "Mejor separar Portugal 90 min de Portugal clasifica."
    ]
  },
  {
    id: "r32-13",
    date: "2026-07-02",
    time: "23:00 ET",
    home: "Switzerland",
    away: "Algeria",
    venue: "BC Place, Vancouver",
    phase: "Dieciseisavos",
    favoriteHint: "Switzerland",
    trap: true,
    koRisk: 0.57,
    volatility: 0.56,
    goalProfile: "bajo-medio",
    cornerProfile: "under",
    cardProfile: "medio-alto",
    contextNotes: [
      "Suiza suele competir bien en duelos cerrados.",
      "Argelia llega con emoción competitiva; cuidado con ganador directo."
    ]
  },
  {
    id: "r32-14",
    date: "2026-07-03",
    time: "14:00 ET",
    home: "Australia",
    away: "Egypt",
    venue: "AT&T Stadium, Arlington",
    phase: "Dieciseisavos",
    favoriteHint: "Egypt",
    trap: true,
    koRisk: 0.60,
    volatility: 0.55,
    goalProfile: "bajo-medio",
    cornerProfile: "under",
    cardProfile: "medio",
    contextNotes: [
      "Partido con perfil cerrado; Egipto puede tener más talento diferencial, Australia puede resistir.",
      "Under y doble oportunidad tienen mejor lectura que ganador seco."
    ]
  },
  {
    id: "r32-15",
    date: "2026-07-03",
    time: "18:00 ET",
    home: "Argentina",
    away: "Cape Verde",
    venue: "Hard Rock Stadium, Miami Gardens",
    phase: "Dieciseisavos",
    favoriteHint: "Argentina",
    trap: false,
    koRisk: 0.24,
    volatility: 0.36,
    goalProfile: "medio-alto",
    cornerProfile: "medio-over",
    cardProfile: "medio",
    contextNotes: [
      "Argentina tiene ventaja fuerte de calidad y experiencia.",
      "Cabo Verde puede bajar ritmo; cuidado con líneas de gol demasiado altas."
    ]
  },
  {
    id: "r32-16",
    date: "2026-07-03",
    time: "21:30 ET",
    home: "Colombia",
    away: "Ghana",
    venue: "Arrowhead Stadium, Kansas City",
    phase: "Dieciseisavos",
    favoriteHint: "Colombia",
    trap: false,
    koRisk: 0.48,
    volatility: 0.54,
    goalProfile: "medio",
    cornerProfile: "medio-over",
    cardProfile: "medio-alto",
    contextNotes: [
      "Colombia tiene mejor control creativo, Ghana puede lastimar en transiciones.",
      "Mercado conservador mejor que marcador exacto."
    ]
  }
];

const DATE_LABELS = {
  "2026-06-28": "28 junio",
  "2026-06-29": "29 junio",
  "2026-06-30": "30 junio",
  "2026-07-01": "1 julio",
  "2026-07-02": "2 julio",
  "2026-07-03": "3 julio"
};

const DEFAULT_SETTINGS = {
  profile: "balanced",
  maxParlay: 3,
  hideNoBet: false,
  showProxy: true,
  favoriteBook: "Draftea"
};

const BOOKS = ["Draftea", "Caliente", "Codere", "Bet365", "Betcris", "Otra"];
