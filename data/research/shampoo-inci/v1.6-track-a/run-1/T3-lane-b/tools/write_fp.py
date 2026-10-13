import json, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FORM = os.path.join(os.path.dirname(ROOT), "formula")
def P(v, c, r, neighbor=None, **extra):
    d = {"value": v, "confidence": c, "rationale": r}
    if neighbor is not None: d["neighboringAlternative"] = neighbor
    d.update(extra); return d
def write(bid, direct, facts, unresolved, notes=None):
    pk = json.load(open(os.path.join(FORM, bid + ".json")))
    rec = {"blindId": bid, "inciFingerprintSha256": pk["inciFingerprintSha256"],
           "phase": "blind_formula_pass", "normalizationNote": (notes or "No split synonym entries; packet positions are normalized positions."),
           "directProperties": direct, "formulaFacts": [{"ingredient": i, "position": p, "role": r} for i, p, r in facts],
           "unresolvedMaterialIngredients": unresolved}
    os.makedirs(os.path.join(ROOT, "formula-pass"), exist_ok=True)
    with open(os.path.join(ROOT, "formula-pass", bid + ".json"), "w") as f:
        json.dump(rec, f, ensure_ascii=False, indent=2)
    print("wrote", bid)
