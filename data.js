const RESULTS_CSV_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv";

function parseBoolean(value) {
  return String(value).toLowerCase() === "true";
}

function parseScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function loadResults() {
  try {
    if (!window.Papa) {
      console.warn("PapaParse no está cargado. La app usará datos base.");
      return [];
    }

    const response = await fetch(RESULTS_CSV_URL, { cache: "no-store" });

    if (!response.ok) {
      console.warn("No se pudo cargar el CSV. La app usará datos base.");
      return [];
    }

    const csvText = await response.text();

    return await new Promise(resolve => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: result => {
          const rows = (result.data || [])
            .map(row => ({
              date: row.date,
              home: row.home_team,
              away: row.away_team,
              homeScore: parseScore(row.home_score),
              awayScore: parseScore(row.away_score),
              tournament: row.tournament || "",
              city: row.city || "",
              country: row.country || "",
              neutral: parseBoolean(row.neutral)
            }))
            .filter(row =>
              row.date &&
              row.home &&
              row.away &&
              typeof row.homeScore === "number" &&
              typeof row.awayScore === "number"
            );

          resolve(rows);
        },
        error: error => {
          console.warn("Error leyendo CSV:", error);
          resolve([]);
        }
      });
    });
  } catch (error) {
    console.warn("Error cargando resultados:", error);
    return [];
  }
}
