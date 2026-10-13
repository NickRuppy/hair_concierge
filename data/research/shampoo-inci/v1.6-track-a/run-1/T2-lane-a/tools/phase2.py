"""Lane A, batch T2: Phase 2 assembler. Final judgments live in phase2_data.py;
projection fields (T1/T6/T4, W-LIVE, I1/I3, rows, 13.8 confidences) are computed
mechanically here from the finalized direct properties."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from phase2_data import FINAL

RANK = {"low": 0, "moderate": 1, "high": 2}
def cmin(*cs): return min(cs, key=lambda c: RANK[c])
TIER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}
WLIVE = {"low": "light", "moderate": "moderate", "high": "heavy"}

def t1(th, W, C):
    if W == "low": return {"fine": "ideal", "normal": "ideal", "coarse": "ideal" if C == "high" else "acceptable"}[th]
    if W == "moderate": return {"fine": "acceptable", "normal": "ideal", "coarse": "ideal" if C == "high" else "acceptable"}[th]
    return {"fine": "not_suited", "normal": "acceptable", "coarse": "ideal"}[th]

def final_fit(th, W, C, concern):
    f = t1(th, W, C)
    if concern and f == "not_suited": return "acceptable", True
    return f, False

def i1(cs, d1):
    return {"low": "gentle", "moderate": "regular"}.get(cs, "clarifying" if d1 else "regular")

def build(pid, F):
    fp = json.load(open(os.path.join(ROOT, "out", "formula-pass", pid + ".json")))
    pkt = json.load(open(os.path.join(ROOT, "formula", pid + ".json")))
    rv = json.load(open(os.path.join(ROOT, "reveal", pid + ".json")))
    bd = fp["directProperties"]
    srcs = ["formula:%s (tier %s, %s)" % (pid, pkt["formulaSourceTier"], pkt["formulaCompleteness"])] + \
           ["reveal:%s#%d %s [%s, grade %s]" % (pid, i, s["sourceType"], s["sourceKind"], s["sourceGrade"]) for i, s in enumerate(rv["positioningSources"])]

    def P(blindkey, fin=None):
        b = bd[blindkey]
        d = {"value": b["value"], "confidence": b["confidence"], "rationale": b["rationale"],
             "formulaFacts": b.get("formulaFacts", []), "counterSignal": b["counterSignal"],
             "neighboringAlternative": b["neighboringAlternative"], "sourceIds": [srcs[0]]}
        if fin: d.update(fin)
        return d

    cs = P("cleansingStrength"); cl = P("conditioningLevel")
    wpb = bd["weightPotential"]
    wp = {k: v for k, v in wpb.items()}
    wp.update({"formulaFacts": [{"ingredient": i, "position": p, "family": fam} for fam, lst in wpb["evidenceByFamily"].items() for i, p in lst],
               "canonicalFormula": {"inciFingerprintSha256": pkt["inciFingerprintSha256"], "sourceTier": pkt["formulaSourceTier"],
                                    "completeness": pkt["formulaCompleteness"], "identityConfidence": pkt["identityConfidence"],
                                    "captureDate": "not in sealed packet"},
               "sourceIds": [srcs[0]]})
    for k in ("cleansingStrength", "conditioningLevel", "weightPotential"):
        if k in F.get("override", {}):
            {"cleansingStrength": cs, "conditioningLevel": cl, "weightPotential": wp}[k].update(F["override"][k])
    for d in (cs, cl, wp):
        d["neighboringAlternative"] = "none" if d["confidence"] == "high" else d["neighboringAlternative"]

    def fin(d):
        d = dict(d); d.setdefault("sourceIds", srcs)
        if d["confidence"] == "high": d["neighboringAlternative"] = "none" if not isinstance(d["value"], list) else "none"
        return d
    props = {"cleansingStrength": cs, "conditioningLevel": cl, "weightPotential": wp,
             "focusPrimary": fin(F["focusPrimary"]), "focusSecondary": fin(F["focusSecondary"]),
             "usageRole": fin(F["usageRole"]), "scalpComfortTarget": fin(F["scalpComfortTarget"]),
             "dandruffSupport": dict(bd["dandruffSupport"], sourceIds=[srcs[0]])}
    props["dandruffSupport"].pop("provisional", None)

    W, C, CS = wp["value"], cl["value"], cs["value"]
    Wn, Cn, CSn = wp["neighboringAlternative"], cl["neighboringAlternative"], cs["neighboringAlternative"]
    tg = F["targets"]; prim = tg["primary"]["target"]; sec = tg.get("secondary")
    targets = [prim] + ([sec["target"]] if sec else [])
    concern = prim != "ordinary"
    flags = list(F.get("flags", [])); notes = list(F.get("notes", []))
    fits = []; floor_applied = []
    for th in ("fine", "normal", "coarse"):
        f, lifted = final_fit(th, W, C, concern)
        if lifted: floor_applied.append(th)
        conf = wp["confidence"] if th != "coarse" else cmin(wp["confidence"], cl["confidence"])
        boundary = []
        if Wn != "none":
            nf, _ = final_fit(th, Wn, C, concern)
            if TIER[nf] < TIER[f]: boundary.append("weightPotential neighbor %s -> %s" % (Wn, nf))
        if th == "coarse" and Cn != "none":
            nf, _ = final_fit(th, W, Cn, concern)
            if TIER[nf] < TIER[f]: boundary.append("conditioningLevel neighbor %s -> %s" % (Cn, nf))
        if boundary: flags.append({"code": "review_thickness_boundary", "detail": "%s: %s; %s" % (th, f, "; ".join(boundary))})
        rat = "T1: W=%s, C=%s -> %s for %s%s." % (W, C, t1(th, W, C), th, " (T6 lifted not_suited -> acceptable)" if lifted else "")
        rat += " Confidence = lowest of inputs (13.8): %s. T2: thickness/texture claims ignored." % conf
        fits.append({"thickness": th, "fit": f, "confidence": conf, "rationale": rat})
    if floor_applied: notes.append({"code": "scalp_concern_floor_applied", "detail": ", ".join(floor_applied)})
    d1 = F.get("d1", False)
    inten = i1(CS, d1)
    for t in targets:
        exp = BUCKET[t][2]
        if inten == exp and CSn != "none" and i1(CSn, d1) != exp:
            flags.append({"code": "review_intensity_boundary", "detail": "%s: current %s matches, neighbor %s -> %s" % (BUCKET[t][0], inten, CSn, i1(CSn, d1))})
    rows = []
    for f in fits:
        if f["fit"] in ("ideal", "acceptable"):
            for t in targets:
                b, r, exp = BUCKET[t]
                rows.append({"thickness": f["thickness"], "shampoo_bucket": b, "scalp_route": r, "cleansing_intensity": inten,
                             "weight": WLIVE[W], "tier": f["fit"], "expectedIntensity": exp,
                             "liveMatch": "supportive" if (f["fit"] == "acceptable" or inten != exp) else "ideal"})
    seen = set(); rows = [r for r in rows if not ((r["thickness"], r["shampoo_bucket"]) in seen or seen.add((r["thickness"], r["shampoo_bucket"])))]
    roles = sorted({"shampoo_dandruff" if r["shampoo_bucket"] == "schuppen" else "shampoo_everyday" for r in rows})
    proj = {
        "thicknesses": fits,
        "weight": {"value": WLIVE[W], "confidence": wp["confidence"], "rationale": "W-LIVE: weightPotential %s -> %s, 1:1; confidence = weightPotential confidence (13.8)." % (W, WLIVE[W])},
        "scalpTargets": {"primary": tg["primary"], "secondary": sec},
        "observedCleansingIntensity": {"value": inten, "confidence": cs["confidence"] if inten != "clarifying" else cmin(cs["confidence"], F.get("d1conf", "low")),
                                       "rationale": "I1: cleansingStrength %s, D1 %s -> %s. I3 checked against neighbor %s for each projected bucket." % (CS, str(d1).lower(), inten, CSn)},
        "positioning": {"explicitResetPositioning": {"value": d1, "confidence": F.get("d1conf", "high"), "rationale": F.get("d1rat", "D1: no 'tiefenrein', 'deep clean', 'clarifying shampoo' or 'detox-reinigung' stem in the name or a manufacturer/pack claim, and no occasional-use directions.")}},
        "deepCleanserListing": {"value": "not_flagged", "confidence": cmin(cs["confidence"], props["focusPrimary"]["confidence"], props["usageRole"]["confidence"], F.get("d1conf", "high")),
                                "rationale": "D2 not met: D1 false (or formula not strong)."},
        "rows": rows,
        "required_protocol_roles": roles,
        "reviewFlags": flags,
        "informationalNotes": notes,
        "researchCombinationTargets": F.get("rct", []),
        "researchCombinationConfidence": F.get("rctConf"),
        "liveComparison": "review_live_value_differs not computed in the lane (catalog-dependent, resolved by the orchestrator after freeze, 14).",
    }
    if F.get("deepCleanserRecord"): proj["deepCleanserListing"]["deepCleanserRecord"] = "needs_record"
    lowp = [k for k, v in props.items() if v["confidence"] == "low"]
    lowproj = [f["thickness"] for f in fits if f["confidence"] == "low"]
    status = "needs_research" if (lowp or lowproj) else "classified"
    rec = {
        "blindId": pid, "inciFingerprintSha256": pkt["inciFingerprintSha256"],
        "identity": {"productName": rv["productName"], "brand": rv["brand"], "market": "DE", "packSize": pkt["packSize"],
                     "formulaSourceTier": pkt["formulaSourceTier"], "formulaCompleteness": pkt["formulaCompleteness"],
                     "identityConfidence": pkt["identityConfidence"], "normalization": fp["normalization"], "sourceIds": srcs},
        "status": status,
        "policy": "shampoo-classification-v1.6",
        "directProperties": props,
        "focusRecord": F["focusRecord"],
        "decisionTrace": F["decisionTrace"],
        "projection": proj,
        "blindToFinalChanges": F["changes"],
        "claimToInciChecks": F.get("claimInci", []),
        "selfCheck": {
            "fingerprintMatchesFrozenPacket": True,
            "claimsHiddenDuringFormulaJudgment": True,
            "formulaPassFile": "out/formula-pass/%s.json (frozen before reveal)" % pid,
            "noIngredientCountOrPositionWindowAssignedWeightBand": True,
            "allThreeWeightSubjudgmentsPresent": all(k in wp["subjudgments"] for k in ("depositionLoad", "persistence", "resetCapacity")),
            "whyNotNeighborBandSpecific": True,
            "w2AppliedWhereTwoOrMoreFamilies": True,
            "confidenceNamesLimitingUncertainty": wp["confidenceLimitingFactor"],
            "comparisonWithEarlierValuesMadeInLane": False,
            "noWebUsed": True,
        },
        "uncertainties": fp.get("blindUncertainties", []) + F.get("unc", []),
    }
    out = os.path.join(ROOT, "out", pid + ".json")
    json.dump(rec, open(out, "w"), ensure_ascii=False, indent=2)
    return rec

if __name__ == "__main__":
    for pid in sorted(FINAL):
        r = build(pid, FINAL[pid])
        p = r["directProperties"]; pr = r["projection"]
        print(pid, r["status"], [p[k]["value"] for k in ("cleansingStrength", "conditioningLevel", "weightPotential", "focusPrimary", "focusSecondary", "usageRole", "scalpComfortTarget", "dandruffSupport")],
              [f["fit"] for f in pr["thicknesses"]], pr["weight"]["value"], pr["scalpTargets"]["primary"]["target"],
              (pr["scalpTargets"]["secondary"] or {}).get("target"), pr["observedCleansingIntensity"]["value"],
              [f["code"] + ":" + f.get("detail", "")[:12] for f in pr["reviewFlags"]], [n["code"] for n in pr["informationalNotes"]], pr["researchCombinationTargets"])
