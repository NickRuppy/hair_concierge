"""Lane A, batch T4: blind formula pass writer. Judgments are hand-made below; the
script only copies fingerprints from the frozen packets and serializes records."""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "out", "formula-pass")
os.makedirs(OUT, exist_ok=True)


def packet(bid):
    with open(os.path.join(ROOT, "formula", f"{bid}.json")) as f:
        return json.load(f)


def prop(value, conf, rationale, neighbor, **extra):
    d = {"value": value, "confidence": conf, "rationale": rationale,
         "neighboringAlternative": neighbor}
    d.update(extra)
    return d


def weight(value, conf, neighbor, dep, per, reset, families, excluded, why, whynot, counter, limiting):
    return {
        "value": value, "confidence": conf,
        "rationale": why,
        "neighboringAlternative": neighbor,
        "subjudgments": {
            "depositionLoad": {"value": dep[0], "rationale": dep[1]},
            "persistence": {"value": per[0], "rationale": per[1]},
            "resetCapacity": {"value": reset[0], "rationale": reset[1]},
        },
        "extractedEvidenceByFamily": families,
        "excludedIngredients": excluded,
        "whyThisBand": why,
        "whyNotNeighborBand": whynot,
        "counterEvidence": counter,
        "confidenceLimitingFactor": limiting,
    }


def provisional_focus(cands, care, note):
    return {
        "focusPrimary": {"value": "general", "confidence": "low", "provisional": True,
                         "rationale": "Blind pass: claims hidden, so no positioned job can be confirmed; " + note,
                         "formulaCompatibleCandidates": cands,
                         "careDirection": care,
                         "neighboringAlternative": cands[0] if cands else "none"},
        "focusSecondary": {"value": [], "confidence": "low", "provisional": True,
                           "rationale": "Empty default; a secondary needs distinct exact-product positioning (Section 8), not visible blind.",
                           "neighboringAlternative": [cands[0]] if cands else []},
    }


def usage(note, possible):
    return {"value": "regular", "confidence": "low", "provisional": True,
            "rationale": "Default regular (Section 9); every non-default trigger needs a claim graded moderate/high, hidden in the blind pass. " + note,
            "possibleClaimTriggeredValues": possible, "neighboringAlternative": possible[0] if possible else "frequent"}


def comfort(csa_pass, routes, counter):
    return {"value": "not_targeted", "confidence": "low", "provisional": True,
            "rationale": ("Blind: no positioning visible (SC1). Formula half CSA "
                          + ("PASSES" if csa_pass else "FAILS")
                          + " (prominent E4 routes: " + (", ".join(routes) if routes else "none") + "). "
                          + ("If an E2 sensitive/dry unit graded moderate/high appears after unblinding, targeted is reachable." if csa_pass
                             else "Even explicit sensitive/dry positioning would give not_targeted (CSA, missing prominent listed route).")),
            "csaFormulaHalf": "pass" if csa_pass else "fail",
            "prominentE4Routes": routes, "counterSignals": counter,
            "neighboringAlternative": "targeted" if csa_pass else "unknown"}


def dandruff(value, active):
    return {"value": value, "confidence": "high",
            "rationale": (f"Complete INCI contains {active} (Section 11) -> supported (formula only; dandruff target still needs an E2 dandruff claim, S-DANDRUFF/R17.3)."
                          if value == "supported" else
                          "Complete INCI contains neither Piroctone Olamine nor Climbazole (Section 11) -> not_supported." + (" " + active if active else "")),
            "neighboringAlternative": "none"}


def write(bid, cleansing, conditioning, wt, focus, usage_rec, comfort_rec, dand, facts, unresolved, notes, uncertainties):
    p = packet(bid)
    rec = {
        "blindId": bid,
        "inciFingerprintSha256": p["inciFingerprintSha256"],
        "phase": "blind_formula_pass",
        "identity": {"packSize": p["packSize"], "formulaSourceTier": p["formulaSourceTier"],
                     "formulaCompleteness": p["formulaCompleteness"], "identityConfidence": p["identityConfidence"]},
        "formulaNotes": notes,
        "directProperties": {
            "cleansingStrength": cleansing,
            "conditioningLevel": conditioning,
            "weightPotential": wt,
            **focus,
            "usageRole": usage_rec,
            "scalpComfortTarget": comfort_rec,
            "dandruffSupport": dand,
        },
        "formulaFacts": [{"ingredient": i, "position": n, "role": r} for (i, n, r) in facts],
        "unresolvedMaterialIngredients": unresolved,
        "uncertainties": uncertainties,
    }
    with open(os.path.join(OUT, f"{bid}.json"), "w") as f:
        json.dump(rec, f, indent=2, ensure_ascii=False)
    print("wrote", bid)


if __name__ == "__main__":
    import products  # noqa: F401  (products.py calls write())
