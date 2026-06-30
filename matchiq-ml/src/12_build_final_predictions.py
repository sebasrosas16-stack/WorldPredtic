from pathlib import Path
import json

BASE = Path(__file__).resolve().parents[1]
OUTPUTS = BASE / "outputs"

GOALS_INPUT = OUTPUTS / "goals_ranked_picks.json"
CORNERS_INPUT = OUTPUTS / "corner_ranked_picks.json"

FINAL_OUTPUT = OUTPUTS / "matchiq_predictions_final.json"

def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def key(item):
    return str(item["match_id"])

def main():
    goals = load_json(GOALS_INPUT)
    corners = load_json(CORNERS_INPUT)

    goals_by_id = {key(item): item for item in goals}
    corners_by_id = {key(item): item for item in corners}

    all_match_ids = sorted(
        set(goals_by_id.keys()) | set(corners_by_id.keys()),
        key=lambda x: int(x)
    )

    final = []

    for match_id in all_match_ids:
        goal = goals_by_id.get(match_id)
        corner = corners_by_id.get(match_id)

        base = goal or corner

        item = {
            "match_id": int(match_id),
            "date": base["date"],
            "home": base["home"],
            "away": base["away"],
            "goals": goal,
            "corners": corner,
            "top_picks": [],
            "no_bet_notes": [],
        }

        if goal and goal["strength"] != "no_bet":
            item["top_picks"].append({
                "type": "goals",
                "market": goal["main_pick"],
                "probability": goal["probability"],
                "fair_odds": goal["fair_odds"],
                "strength": goal["strength"],
                "risk": goal["risk"],
                "reason": goal["reason"],
            })

        if corner and corner["strength"] != "no_bet":
            item["top_picks"].append({
                "type": "corners",
                "market": corner["main_pick"],
                "probability": corner["probability"],
                "fair_odds": corner["fair_odds"],
                "strength": corner["strength"],
                "risk": corner["risk"],
                "reason": corner["reason"],
            })

        item["top_picks"] = sorted(
            item["top_picks"],
            key=lambda pick: (
                pick["strength"] == "strong",
                pick["probability"] or 0
            ),
            reverse=True
        )

        if not item["top_picks"]:
            item["no_bet_notes"].append("No hay pick con ventaja suficiente.")

        final.append(item)

    FINAL_OUTPUT.write_text(
        json.dumps(final, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"Archivo final creado: {FINAL_OUTPUT}")
    print("")

    for item in final:
        print(f"{item['home']} vs {item['away']}")

        if item["top_picks"]:
            for pick in item["top_picks"][:3]:
                print(
                    f"  {pick['type'].upper()}: {pick['market']} | "
                    f"{pick['probability']}% | "
                    f"{pick['strength']} | "
                    f"riesgo {pick['risk']}"
                )
        else:
            print("  NO BET")

        print("")

if __name__ == "__main__":
    main()