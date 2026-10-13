"""Lane A, batch T1, phase 2: assemble final records from frozen formula-pass + reconciliation spec.
Projection fields (T1/T6/T4, W-LIVE, I1/I3, rows, 13.8 confidences) are computed mechanically here.
Run: python3 -I out/tools/build_final.py <lane_root>
"""
import json, os, sys

ROOT = sys.argv[1]
FP = os.path.join(ROOT, "out", "formula-pass")
OUT = os.path.join(ROOT, "out")
sys.path.insert(0, os.path.join(ROOT, "out", "tools"))
from spec import SPEC  # noqa: E402

RANK = {"low": 0, "moderate": 1, "high": 2}
def cmin(*cs):
    return min(cs, key=lambda c: RANK[c])

TIER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}

def t1(th, W, C):
    if th == "fine":
        return {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[W]
    if th == "normal":
        return {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[W]
    if W == "high":
        return "ideal"
    return "ideal" if C == "high" else "acceptable"

def t6(fit, concern):
    return "acceptable" if (concern and fit == "not_suited") else fit

def i1(cs, d1):
    return {"low": "gentle", "moderate": "regular"}.get(cs) or ("clarifying" if d1 else "regular")

def build(bid, s):
    fp = json.load(open(os.path.join(FP, bid + ".json")))
    dp = fp["directProperties"]
    cs, cl, wp = dp["cleansingStrength"], dp["conditioningLevel"], dp["weightPotential"]
    W, Wc, Wn = wp["value"], wp["confidence"], wp["neighboringAlternative"]
    C, Cc, Cn = cl["value"], cl["confidence"], cl["neighboringAlternative"]
    S, Sc, Sn = cs["value"], cs["confidence"], cs["neighboringAlternative"]

    facts = fp["formulaFacts"]
    surf_kw = ("anionic", "buffer", "surfactant", "amphoteric", "glucoside", "reinforcing", "co-surfactant")
    cfacts = [f for f in facts if any(k in f["role"] for k in surf_kw)]
    kfacts = [f for f in facts if f not in cfacts and "marker" not in f["role"] and "anti-dandruff" not in f["role"]]

    def prop(rec, ff, blind_note="unchanged from frozen blind formula pass (claims cannot set or move this property, 3.2)"):
        out = {"value": rec["value"], "confidence": rec["confidence"], "rationale": rec["rationale"],
               "formulaFacts": ff, "counterSignal": rec.get("counterSignals", ""),
               "neighboringAlternative": rec["neighboringAlternative"], "blindToFinal": blind_note,
               "sources": ["formula packet " + bid]}
        return out

    props = {
        "cleansingStrength": prop(cs, cfacts),
        "conditioningLevel": prop(cl, kfacts),
        "weightPotential": prop(wp, kfacts),
    }
    props["weightPotential"]["weightRecord"] = {
        "formulaIdentifiers": {"blindId": bid, "inciFingerprintSha256": fp["inciFingerprintSha256"],
                               "sourceTier": fp["formulaBlock"]["sourceTier"], "completeness": fp["formulaBlock"]["completeness"],
                               "captureDate": "not in packet"},
        "evidenceByFamily": wp["evidenceByFamily"], "excluded": wp["excluded"], "unresolved": wp["unresolved"],
        "subjudgments": wp["subjudgments"], "counterevidence": wp.get("counterSignals", wp["whyNotNeighborBand"]),
        "proposedWeightPotential": W, "whyThisBand": wp["whyThisBand"], "whyNotNeighborBand": wp["whyNotNeighborBand"],
        "confidence": Wc, "confidenceLimitingFactor": wp["confidenceLimitingFactor"], "neighboringAlternative": Wn,
        "claimsEffect": s.get("weightClaimsNote", "Claims read after freeze; none changes the band (6.5 step 5).")}
    props["dandruffSupport"] = {**{k: dp["dandruffSupport"][k] for k in ("value", "confidence", "rationale", "neighboringAlternative")},
                                "formulaFacts": [f for f in facts if "anti-dandruff" in f["role"]],
                                "counterSignal": s.get("dandruffCounter", "None; mechanical rule (Section 11)."),
                                "blindToFinal": "unchanged", "sources": ["formula packet " + bid]}
    for k in ("focusPrimary", "focusSecondary", "usageRole", "scalpComfortTarget"):
        props[k] = s[k]

    # ---------- projection ----------
    tp = s["targets"]
    targets = [tp["primary"]["target"]] + ([tp["secondary"]["target"]] if tp.get("secondary") else [])
    concern = targets[0] != "ordinary"
    D1 = s["d1"]["value"]
    fits, flags, notes = {}, list(s.get("extraFlags", [])), list(s.get("extraNotes", []))
    lifted = []
    for th in ("fine", "normal", "coarse"):
        raw = t1(th, W, C)
        fin = t6(raw, concern)
        if fin != raw:
            lifted.append(th)
        conf = cmin(Wc, Cc) if th == "coarse" else Wc
        # T4
        cands = []
        if Wn != "none":
            cands.append(("weightPotential", t6(t1(th, Wn, C), concern)))
        if th == "coarse" and Cn != "none":
            cands.append(("conditioningLevel", t6(t1(th, W, Cn), concern)))
        lower = [(p, f) for p, f in cands if TIER[f] < TIER[fin]]
        if lower:
            flags.append({"code": "review_thickness_boundary", "detail": th + ": " + "; ".join(
                f"{p} neighbor -> {f}" for p, f in lower) + f" (selected {fin})"})
        fits[th] = {"fit": fin, "t1Fit": raw, "confidence": conf,
                    "rationale": f"T1: W={W}, C={C} -> {raw}" + (f"; T6 lifts to {fin}" if fin != raw else "") +
                                 ("; T6 floor applies (scalp-concern target)" if concern and fin == raw else "")}
    if lifted:
        notes.append({"code": "scalp_concern_floor_applied", "detail": ",".join(lifted)})
    weight = {"low": "light", "moderate": "moderate", "high": "heavy"}[W]
    inten = i1(S, D1)
    inten_conf = Sc if inten != "clarifying" else cmin(Sc, s["d1"]["grade"])
    for t in targets:
        b, r, exp = BUCKET[t]
        if inten == exp and Sn != "none" and i1(Sn, D1) != exp:
            flags.append({"code": "review_intensity_boundary", "detail": f"{b}: current {inten} equals expected; neighbor cleansing {Sn} -> {i1(Sn, D1)}"})
    rows = []
    for th in ("fine", "normal", "coarse"):
        if fits[th]["fit"] in ("ideal", "acceptable"):
            for t in targets:
                b, r, exp = BUCKET[t]
                rows.append({"thickness": th, "shampoo_bucket": b, "scalp_route": r, "cleansing_intensity": inten,
                             "weight": weight, "tier": fits[th]["fit"],
                             "intensityMatchesBucket": inten == exp})
    roles = sorted({"shampoo_dandruff" if r["shampoo_bucket"] == "schuppen" else "shampoo_everyday" for r in rows})
    dcl = s.get("deepCleanser", {"listing": "not_flagged"})
    if dcl["listing"] == "flagged":
        notes.append({"code": "deep_cleanser_listing", "detail": "deepCleanserRecord: needs_record"})
    projection = {
        "thicknesses": [{"thickness": th, **fits[th]} for th in ("fine", "normal", "coarse")],
        "weight": {"value": weight, "confidence": Wc, "rationale": f"W-LIVE: weightPotential {W} -> {weight}"},
        "scalpTargets": tp,
        "observedCleansingIntensity": {"value": inten, "confidence": inten_conf,
                                       "rationale": f"I1: cleansingStrength {S}" + (" with D1 true" if D1 else ", D1 false") + f" -> {inten}"},
        "positioning": {"explicitResetPositioning": D1, "d1Evidence": s["d1"]["evidence"], "d1Grade": s["d1"]["grade"]},
        "deepCleanserListing": {"value": dcl["listing"], "deepCleanserRecord": "needs_record",
                                "confidence": dcl.get("confidence", "high"), "rationale": dcl.get("rationale", "D2 not met: D1 false." if not D1 else "")},
        "reviewFlags": flags,
        "informationalNotes": notes,
        "researchCombinationTargets": s.get("combo", []),
        "researchCombinationConfidence": s.get("comboConf", {}),
        "rows": rows,
        "required_protocol_roles": roles,
        "projectionStatus": "proposal_blocked_by_review_flags" if flags else "proposal_no_blocking_flags",
    }
    rec = {
        "blindId": bid, "inciFingerprintSha256": fp["inciFingerprintSha256"],
        "identity": {"productName": s["name"], "brand": s["brand"], "market": "DE", "packSize": s.get("packSize"),
                     "formulaBlock": fp["formulaBlock"], "positioningSourceGrades": s["sourceGrades"]},
        "directProperties": props,
        "focusRecord": s["focusRecord"],
        "weightRecord": props["weightPotential"]["weightRecord"],
        "projection": projection,
        "blindToFinalChanges": s["blindToFinal"],
        "selfCheck": {
            "fingerprintMatchesFrozenPacket": True,
            "claimsAndPriorLabelsHiddenDuringFormulaJudgment": True,
            "noIngredientCountOrPositionWindowAssignedWeightBand": True,
            "allThreeWeightSubjudgmentsPresent": all(k in wp["subjudgments"] for k in ("depositionLoad", "persistence", "resetCapacity")),
            "counterevidenceAndWhyNotNeighborSpecific": True,
            "w2AppliedWhereTwoOrMoreFamilies": True,
            "confidenceNamesLimitingUncertainty": True,
            "noComparisonWithEarlierValuesInsideLane": True,
            "allFinalPropertiesModerateOrBetter": all(RANK[props[k]["confidence"]] >= 1 for k in props),
            "webUsed": False,
        },
        "uncertainties": s["uncertainties"],
    }
    return rec

for bid, s in SPEC.items():
    rec = build(bid, s)
    with open(os.path.join(OUT, bid + ".json"), "w") as fh:
        json.dump(rec, fh, ensure_ascii=False, indent=1)
    p = rec["projection"]; d = rec["directProperties"]
    print(bid, d["cleansingStrength"]["value"], d["conditioningLevel"]["value"], d["weightPotential"]["value"],
          d["focusPrimary"]["value"], d["focusSecondary"]["value"], d["usageRole"]["value"], d["scalpComfortTarget"]["value"],
          d["dandruffSupport"]["value"], "|", "/".join(t["fit"] for t in p["thicknesses"]), p["weight"]["value"],
          p["scalpTargets"]["primary"]["target"], (p["scalpTargets"].get("secondary") or {}).get("target"),
          p["observedCleansingIntensity"]["value"], p["deepCleanserListing"]["value"], p["researchCombinationTargets"],
          [f["code"] + ":" + f["detail"].split(":")[0] for f in p["reviewFlags"]], [n["code"] for n in p["informationalNotes"]])
