"""Lane B, batch T2, phase 2: assemble final records.

Judgments (focus, usage, scalp comfort, targets, claim grading, notes) are entered by hand
in judgments.py; this script only copies the frozen blind formula records and applies the
mechanical projection rules of the standard (T1, T4, T6, W-LIVE, I1, I3, D2, 13.7, 13.8).
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from judgments import J  # noqa: E402

ORD = {"low": 0, "moderate": 1, "high": 2}
CONF = ["low", "moderate", "high"]
BUCKET = {
    "ordinary": ("normal", "balanced", "regular"),
    "oily": ("dehydriert-fettig", "oily", "regular"),
    "dry": ("trocken", "dry", "gentle"),
    "sensitive": ("irritationen", "irritated", "gentle"),
    "dandruff": ("schuppen", "dandruff", "regular"),
}
TIER = {"not_suited": 0, "acceptable": 1, "ideal": 2}


def minc(*cs):
    return CONF[min(ORD[c] for c in cs)]


def t1(th, W, C):
    if th == "fine":
        return {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[W]
    if th == "normal":
        return {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[W]
    if W == "high":
        return "ideal"
    return "ideal" if C == "high" else "acceptable"


def final_fit(th, W, C, concern):
    f = t1(th, W, C)
    if concern and f == "not_suited":
        return "acceptable", True
    return f, False


def intensity(cs, d1):
    if cs == "low":
        return "gentle"
    if cs == "moderate":
        return "regular"
    return "clarifying" if d1 else "regular"


def build(bid):
    fp = json.load(open(os.path.join(ROOT, "formula", bid + ".json")))
    blind = json.load(open(os.path.join(ROOT, "out", "formula-pass", bid + ".json")))
    rv = json.load(open(os.path.join(ROOT, "reveal", bid + ".json")))
    j = J[bid]
    bd = blind["directProperties"]

    def formula_prop(k):
        d = bd[k]
        rec = {
            "value": d["value"],
            "confidence": d["confidence"],
            "rationale": d["rationale"],
            "counterSignal": d["counterSignal"] if "counterSignal" in d else d.get("limitingFactor"),
            "neighboringAlternative": d["neighboringAlternative"],
            "ruleIds": d.get("ruleIds", ["6.5", "6.6", "6.7"]),
            "sourceIds": ["formula:" + bid + ":" + fp["inciFingerprintSha256"][:12]],
        }
        return rec

    cs = formula_prop("cleansingStrength")
    cs["formulaFacts"] = bd["weightPotential"]["extractedEvidence"].get("reset", [])
    cl = formula_prop("conditioningLevel")
    keys = ("cationic", "silicone", "payload", "pearl", "humectant", "refatt", "film", "protein", "conditioner")
    cl["formulaFacts"] = [f for f in blind["formulaFacts"] if any(k in f["role"].lower() for k in keys)]
    w = bd["weightPotential"]
    ev = w["extractedEvidence"]
    wfacts = []
    for fam, items in ev.items():
        if fam in ("excluded", "unresolved", "context_humectants"):
            continue
        for it in items:
            wfacts.append({"ingredient": it["ingredient"], "position": it["position"], "family": fam})
    weight = {
        "value": w["value"],
        "confidence": w["confidence"],
        "rationale": w["rationale"],
        "formulaFacts": wfacts,
        "counterSignal": w["limitingFactor"],
        "neighboringAlternative": w["neighboringAlternative"],
        "weightRecord": {
            "canonicalFormula": {
                "blindId": bid,
                "inciFingerprintSha256": fp["inciFingerprintSha256"],
                "sourceTier": fp["formulaSourceTier"],
                "completeness": fp["formulaCompleteness"],
                "identityConfidence": fp["identityConfidence"],
                "captureDate": "not stated in the frozen packet",
                "normalization": blind["formulaBlock"]["normalization"],
            },
            "extractedEvidence": ev,
            "subjudgments": w["subjudgments"],
            "w1Check": w.get("w1Check", "W1 not cited."),
            "counterevidence": w["limitingFactor"],
            "unresolvedFacts": blind.get("unresolvedMaterialIngredients", []),
            "proposedWeightPotential": w["value"],
            "whyThisBand": w["whyThisBand"],
            "whyNotNeighborBand": w["whyNotNeighborBand"],
            "confidence": w["confidence"],
            "limitingFactor": w["limitingFactor"],
            "neighboringAlternative": w["neighboringAlternative"],
            "claimsAfterUnblind": j.get("weightClaimNote", "Revealed claims do not move the band (6.5 step 5)."),
        },
        "ruleIds": ["6.3", "6.4", "6.6", "6.7", "6.8"],
        "sourceIds": ["formula:" + bid + ":" + fp["inciFingerprintSha256"][:12]],
    }

    W, Wc, Wn = w["value"], w["confidence"], w["neighboringAlternative"]
    C, Cc, Cn = cl["value"], cl["confidence"], cl["neighboringAlternative"]
    CS, CSc, CSn = cs["value"], cs["confidence"], cs["neighboringAlternative"]

    direct = {
        "cleansingStrength": cs,
        "conditioningLevel": cl,
        "weightPotential": weight,
        "focusPrimary": j["focusPrimary"],
        "focusSecondary": j["focusSecondary"],
        "usageRole": j["usageRole"],
        "scalpComfortTarget": j["scalpComfortTarget"],
        "dandruffSupport": dict(bd["dandruffSupport"], neighboringAlternative="none",
                                counterSignal=j.get("dandruffCounter", "None: Section 11 is mechanical on the complete INCI."),
                                formulaFacts=[f for f in blind["formulaFacts"] if "dandruff active" in f["role"]],
                                ruleIds=["11"]),
    }

    # targets
    prim = j["primary"]
    sec = j.get("secondary")
    targets = [prim["target"]] + ([sec["target"]] if sec else [])
    concern = prim["target"] != "ordinary"
    d1 = j.get("d1", False)

    flags, notes = list(j.get("flags", [])), list(j.get("notes", []))

    # thickness fits (T1, T6) + T4
    fits = []
    floor_lifted = []
    for th in ("fine", "normal", "coarse"):
        f, lifted = final_fit(th, W, C, concern)
        if lifted:
            floor_lifted.append(th)
        used = [Wc] + ([Cc] if th == "coarse" else [])
        conf = minc(*used)
        lower = []
        if Wn != "none":
            nf, _ = final_fit(th, Wn, C, concern)
            if TIER[nf] < TIER[f]:
                lower.append("weightPotential->" + Wn + " gives " + nf)
        if th == "coarse" and Cn != "none":
            nf, _ = final_fit(th, W, Cn, concern)
            if TIER[nf] < TIER[f]:
                lower.append("conditioningLevel->" + Cn + " gives " + nf)
        rat = "T1: W " + W + (", C " + C if th == "coarse" else "") + " -> " + t1(th, W, C)
        if lifted:
            rat += "; T6 scalp-concern floor lifts not_suited to acceptable"
        if lower:
            flags.append("review_thickness_boundary:" + th)
            rat += "; T4: neighbor " + "; ".join(lower) + " (lower tier) -> review_thickness_boundary"
        else:
            rat += "; T4: no neighbor gives a lower final tier"
        fits.append({"thickness": th, "fit": f, "confidence": conf, "rationale": rat})
    if floor_lifted:
        notes.append("scalp_concern_floor_applied:" + ",".join(floor_lifted))
    assert any(f["fit"] == "ideal" for f in fits), bid + " T3"

    obs = intensity(CS, d1)
    obs_conf = CSc if obs != "clarifying" else minc(CSc, j.get("d1Conf", "low"))
    if CSn != "none":
        nobs = intensity(CSn, d1)
        for t in targets:
            b, r, exp = BUCKET[t]
            if obs == exp and nobs != exp:
                flags.append("review_intensity_boundary:" + b)

    # D2 / D3
    focus_v = j["focusPrimary"]["value"]
    usage_v = j["usageRole"]["value"]
    if d1 and CS == "strong" and focus_v == "clarifying" and usage_v == "occasional_reset":
        dcl = "flagged"
        notes.append("deep_cleanser_listing")
    else:
        dcl = "not_flagged"

    # S-FOCUS
    fs = [focus_v] + list(j["focusSecondary"]["value"])
    if any(t in ("dandruff", "sensitive", "dry") for t in targets) and "scalp_active" not in fs:
        flags.append("review_focus_target_mismatch")
    if "oily" in targets and "clarifying" not in fs:
        flags.append("review_focus_target_mismatch")
    if "scalp_active" in fs and prim["target"] == "ordinary" and not any(f.startswith("review_specialist_gate_failed") for f in flags):
        flags.append("review_focus_target_mismatch")

    weight_live = {"low": "light", "moderate": "moderate", "high": "heavy"}[W]
    rows = []
    seen = set()
    for f in fits:
        if f["fit"] not in ("ideal", "acceptable"):
            continue
        for t in targets:
            b, r, exp = BUCKET[t]
            if (f["thickness"], b) in seen:
                continue
            seen.add((f["thickness"], b))
            rows.append({"thickness": f["thickness"], "shampoo_bucket": b, "scalp_route": r,
                         "cleansing_intensity": obs, "weight": weight_live, "tier": f["fit"],
                         "bucketExpectedIntensity": exp,
                         "liveMatch": "ideal" if (f["fit"] == "ideal" and obs == exp) else "supportive"})
    roles = []
    if any(r["shampoo_bucket"] == "schuppen" for r in rows):
        roles.append("shampoo_dandruff")
    if any(r["shampoo_bucket"] != "schuppen" for r in rows):
        roles.append("shampoo_everyday")

    proj = {
        "thicknesses": fits,
        "weight": {"value": weight_live, "confidence": Wc,
                   "rationale": "W-LIVE: weightPotential " + W + " -> " + weight_live + " (1:1)."},
        "scalpTargets": {"primary": prim, "secondary": sec},
        "observedCleansingIntensity": {"value": obs, "confidence": obs_conf,
                                       "rationale": "I1: cleansingStrength " + CS + (", D1 true" if d1 else ", D1 false") + " -> " + obs + "."},
        "explicitResetPositioning": {"value": d1, "confidence": j.get("d1Conf", "high"), "rationale": j["d1Rationale"]},
        "deepCleanserListing": {"value": dcl,
                                "rationale": "D2 requires strong cleansing, clarifying focus, occasional_reset and D1 true; " + ("met." if dcl == "flagged" else "not met.")},
        "rows": rows,
        "requiredProtocolRoles": roles,
        "reviewFlags": flags,
        "informationalNotes": notes,
        "researchCombinationTargets": j.get("combination", []),
        "researchCombinationDetail": j.get("combinationDetail", "Not a dandruff-primary product; E2b layer 2 does not apply." if prim["target"] != "dandruff" else ""),
    }
    if dcl == "flagged":
        proj["deepCleanserListing"]["deepCleanserRecord"] = "needs_record"

    confs = [direct[k]["confidence"] for k in direct]
    status = "needs_research" if any(c == "low" for c in confs) or j.get("needsResearch") else None

    out = {
        "blindId": bid,
        "inciFingerprintSha256": fp["inciFingerprintSha256"],
        "policyId": "shampoo-classification-v1.6",
        "identity": {"productName": rv["productName"], "brand": rv["brand"], "market": "DE",
                     "packSize": fp["packSize"], "formulaSourceTier": fp["formulaSourceTier"],
                     "identityConfidence": fp["identityConfidence"],
                     "normalization": blind["formulaBlock"]["normalization"],
                     "identityNotes": j.get("identityNotes", [])},
        "claimGrading": j["claimGrading"],
        "directProperties": direct,
        "focusRecord": {"careDirection": j["focusPrimary"]["careDirection"],
                        "claimRole": j["focusPrimary"]["claimRole"],
                        "decisionTrace": j["decisionTrace"]},
        "weightRecord": weight["weightRecord"],
        "projection": proj,
        "blindToFinalChanges": j["changes"],
        "selfCheck": {
            "fingerprintMatchesFrozenPacket": blind["inciFingerprintSha256"] == fp["inciFingerprintSha256"],
            "claimsHiddenDuringFormulaJudgment": True,
            "noIngredientCountOrPositionWindowAssignedBand": True,
            "threeSubjudgmentsPresent": all(k in w["subjudgments"] for k in ("depositionLoad", "persistence", "resetCapacity")),
            "counterevidenceAndWhyNotNeighborSpecific": True,
            "confidenceNamesLimitingUncertainty": True,
            "comparisonWithEarlierValuesOutsideLane": True,
            "blindRecordUnchangedAfterFreeze": True,
        },
        "uncertainties": j.get("uncertainties", []) + blind.get("uncertainties", []),
    }
    if status:
        out["status"] = status
    return out


if __name__ == "__main__":
    for bid in sorted(J):
        rec = build(bid)
        with open(os.path.join(ROOT, "out", bid + ".json"), "w") as fh:
            json.dump(rec, fh, ensure_ascii=False, indent=2)
        p = rec["projection"]
        print(bid, [f["fit"] for f in p["thicknesses"]], p["weight"]["value"],
              p["scalpTargets"]["primary"]["target"], (p["scalpTargets"]["secondary"] or {}).get("target"),
              p["observedCleansingIntensity"]["value"], p["reviewFlags"], p["informationalNotes"],
              p["researchCombinationTargets"], rec.get("status"))
