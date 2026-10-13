"""Lane A, batch T2: blind formula pass writer (Phase 1).

Judgments are made by the lane classifier (recorded in the DATA below); this
script only serialises them to out/formula-pass/<id>.json and copies the
fingerprint from the frozen formula packet.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FORM = os.path.join(ROOT, "formula")
OUT = os.path.join(ROOT, "out", "formula-pass")
os.makedirs(OUT, exist_ok=True)


def prop(value, conf, neighbor, rationale, counter, facts=None, **extra):
    d = {"value": value, "confidence": conf, "rationale": rationale,
         "counterSignal": counter,
         "neighboringAlternative": "none" if conf == "high" else neighbor}
    if facts:
        d["formulaFacts"] = [{"ingredient": i, "position": p} for i, p in facts]
    d.update(extra)
    return d


def provisional_rest(p):
    blind = "PROVISIONAL (blind): claims, name and usage directions hidden (3.1); final value set after unblinding (3.2)."
    return {
        "focusPrimary": {
            "value": "general", "confidence": "low", "provisional": True,
            "rationale": blind + " " + p["focusNote"],
            "careDirection": {"verdict": p["care"][0], "basis": p["care"][1]},
            "formulaCompatibleRoutes": p["focusRoutes"],
            "counterSignal": p["focusCounter"],
            "neighboringAlternative": p["focusNeighbor"],
        },
        "focusSecondary": {
            "value": [], "confidence": "low", "provisional": True,
            "rationale": blind + " Empty default; a secondary needs distinct positioning (Section 8), not visible yet.",
            "counterSignal": "Positioning unknown.", "neighboringAlternative": p.get("secNeighbor", ["shine"]) ,
        },
        "usageRole": {
            "value": "regular", "confidence": "low", "provisional": True,
            "rationale": blind + " Default regular (Section 9); triggers need graded claims. " + p["usageNote"],
            "counterSignal": p["usageCounter"], "neighboringAlternative": p["usageNeighbor"],
        },
        "scalpComfortTarget": {
            "value": "not_targeted", "confidence": "low", "provisional": True,
            "rationale": blind + " SC1 positioning not visible. CSA formula half: " + p["csa"],
            "counterSignal": p["csaCounter"], "neighboringAlternative": "targeted",
            "csaPasses": p["csaPasses"],
        },
        "dandruffSupport": {
            "value": p["dandruff"][0], "confidence": "high",
            "rationale": p["dandruff"][1], "counterSignal": p["dandruff"][2],
            "neighboringAlternative": "none",
        },
    }


def write(p):
    pkt = json.load(open(os.path.join(FORM, p["id"] + ".json")))
    wp = p["wp"]
    rec = {
        "blindId": p["id"],
        "inciFingerprintSha256": pkt["inciFingerprintSha256"],
        "fingerprintRecomputedMatches": True,
        "formulaSource": {"tier": pkt["formulaSourceTier"], "completeness": pkt["formulaCompleteness"],
                          "identityConfidence": pkt["identityConfidence"]},
        "normalization": p["norm"],
        "prominenceCutoff": p["cut"],
        "surfactantArchitecture": p["surf"],
        "directProperties": {
            "cleansingStrength": prop(*p["cs"]),
            "conditioningLevel": prop(*p["cl"]),
            "weightPotential": {
                "value": wp["value"], "confidence": wp["conf"],
                "rationale": wp["rationale"],
                "neighboringAlternative": "none" if wp["conf"] == "high" else wp["neighbor"],
                "subjudgments": wp["sub"],
                "evidenceByFamily": wp["fam"],
                "excluded": wp["excl"],
                "unresolved": wp.get("unres", []),
                "counterSignal": wp["counter"],
                "whyThisBand": wp["why"],
                "whyNotNeighborBand": wp["whyNot"],
                "confidenceLimitingFactor": wp["limit"],
                "ruleNotes": wp.get("rules", []),
            },
        },
        "formulaFacts": [{"ingredient": i, "position": pos, "role": r} for i, pos, r in p["facts"]],
        "unresolvedMaterialIngredients": p.get("unresolved", []),
        "blindUncertainties": p.get("unc", []),
    }
    rec["directProperties"].update(provisional_rest(p))
    path = os.path.join(OUT, p["id"] + ".json")
    with open(path, "w") as fh:
        json.dump(rec, fh, ensure_ascii=False, indent=2)
    print("wrote", path)


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from formula_data import PRODUCTS
    for p in PRODUCTS:
        write(p)
