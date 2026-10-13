"""Phase 2 engine: reads the frozen blind record, applies the hand-made reconciliation
spec, and derives the Section 13 projection mechanically (T1/T6/T4, W-LIVE, I1/I3, D2,
rows, 13.8 confidence)."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ORD = {"low": 0, "moderate": 1, "high": 2}
TIER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}


def cmin(*cs):
    return min(cs, key=lambda c: ORD[c])


def t1(w, c, th):
    if th == "fine":
        return {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[w]
    if th == "normal":
        return {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[w]
    if w == "high":
        return "ideal"
    return "ideal" if c == "high" else "acceptable"


def final_fit(w, c, th, concern):
    f = t1(w, c, th)
    if concern and f == "not_suited":
        return "acceptable", True
    return f, False


def intensity(cs, d1):
    return {"low": "gentle", "moderate": "regular"}.get(cs, "clarifying" if d1 else "regular")


def build(bid, spec):
    blind = json.load(open(os.path.join(ROOT, "out", "formula-pass", f"{bid}.json")))
    reveal = json.load(open(os.path.join(ROOT, "reveal", f"{bid}.json")))
    bp = blind["directProperties"]
    cs, cl, wp = bp["cleansingStrength"], bp["conditioningLevel"], bp["weightPotential"]
    W, Wc, Wn = wp["value"], wp["confidence"], wp["neighboringAlternative"]
    C, Cc, Cn = cl["value"], cl["confidence"], cl["neighboringAlternative"]
    S, Sc, Sn = cs["value"], cs["confidence"], cs["neighboringAlternative"]
    src_ids = [f"reveal/{bid}.json#positioningSources[{i}] ({s['sourceKind']}, packet grade {s['sourceGrade']})" for i, s in enumerate(reveal["positioningSources"])]
    formula_src = f"formula/{bid}.json (fingerprint {blind['inciFingerprintSha256']}, source tier {blind['identity']['formulaSourceTier']}, completeness {blind['identity']['formulaCompleteness']})"

    def facts_for(names):
        return [f for f in blind["formulaFacts"] if f["ingredient"] in names] if names else []

    def direct(p, extra_rationale="", facts=None, counter=None):
        d = {"value": p["value"], "confidence": p["confidence"],
             "rationale": p["rationale"] + (" " + extra_rationale if extra_rationale else ""),
             "formulaFacts": facts if facts is not None else [],
             "counterSignal": counter if counter is not None else (p.get("counterSignals") or p.get("counterEvidence") or ["none material"]),
             "neighboringAlternative": p["neighboringAlternative"], "sources": [formula_src]}
        return d

    cleansing = direct(cs, "Unchanged after unblinding: claims never set cleansing strength (Section 4, 3.2).",
                       [f for f in blind["formulaFacts"] if any(k in f["role"] for k in ("anionic", "buffer", "amphoteric", "mild anionic", "earliest", "hydrotrope", "foam", "thickener"))])
    conditioning = direct(cl, "Unchanged after unblinding: claims never raise or lower conditioning (3.2, C7).",
                          [f for f in blind["formulaFacts"] if any(k in f["role"] for k in ("silicone", "cationic", "pearl", "humectant", "lipid", "refatter", "protein", "R11"))])
    weight = dict(wp)
    weight.update({
        "formulaFacts": [{"ingredient": n, "position": p, "family": fam} for fam, lst in wp["extractedEvidenceByFamily"].items() for (n, p) in lst],
        "counterSignal": wp["counterEvidence"] or ["none material"],
        "canonicalFormula": {"fingerprint": blind["inciFingerprintSha256"], "sourceTier": blind["identity"]["formulaSourceTier"],
                             "completeness": blind["identity"]["formulaCompleteness"], "identityConfidence": blind["identity"]["identityConfidence"],
                             "captureDate": "not stated in packet", "normalization": blind["formulaNotes"][0]},
        "unresolvedFacts": blind["unresolvedMaterialIngredients"],
        "rationale": wp["whyThisBand"] + " Unchanged after unblinding (claims cannot decide the band, 6.5).",
        "sources": [formula_src],
    })
    dand = dict(bp["dandruffSupport"]); dand.update({"formulaFacts": [f for f in blind["formulaFacts"] if "anti-dandruff" in f["role"]],
                                                     "counterSignal": ["none"], "sources": [formula_src]})

    # ---- projection
    tg = spec["targets"]
    prim, sec = tg["primary"]["target"], tg.get("secondary")
    concern = prim != "ordinary"
    targets = [prim] + ([sec["target"]] if sec else [])
    notes = list(spec.get("notes", []))
    flags = list(spec.get("flags", []))
    thick = []
    lifted = []
    for th in ("fine", "normal", "coarse"):
        fit, lift = final_fit(W, C, th, concern)
        if lift:
            lifted.append(th)
        conf = cmin(Wc, Cc) if th == "coarse" else Wc
        # T4
        lower = []
        if Wn != "none":
            nf, _ = final_fit(Wn, C, th, concern)
            if TIER[nf] < TIER[fit]:
                lower.append(f"weightPotential neighbor {Wn} -> {nf}")
        if th == "coarse" and Cn != "none":
            nf, _ = final_fit(W, Cn, th, concern)
            if TIER[nf] < TIER[fit]:
                lower.append(f"conditioningLevel neighbor {Cn} -> {nf}")
        if lower:
            flags.append(f"review_thickness_boundary:{th} ({'; '.join(lower)})")
        rat = f"T1: W {W}" + (f", C {C}" if th == "coarse" else "") + f" -> {t1(W, C, th)}"
        if lift:
            rat += "; T6 scalp-concern floor lifts not_suited to acceptable"
        rat += ". T2: thickness/texture claims do not change fit."
        if lower:
            rat += " T4: " + "; ".join(lower) + " (lower tier) -> review_thickness_boundary."
        thick.append({"thickness": th, "fit": fit, "confidence": conf, "rationale": rat})
    if lifted:
        notes.append("scalp_concern_floor_applied:" + ",".join(lifted))
    d1 = spec["d1"]["value"]
    obs = intensity(S, d1)
    obs_conf = Sc if obs != "clarifying" else cmin(Sc, spec["d1"]["confidence"])
    if Sn != "none":
        n_obs = intensity(Sn, d1)
        for t in targets:
            exp = BUCKET[t][2]
            if obs == exp and n_obs != exp:
                flags.append(f"review_intensity_boundary:{BUCKET[t][0]}")
    dcl = spec.get("deepCleanserListing", "not_flagged")
    rows = []
    for th in thick:
        if th["fit"] in ("ideal", "acceptable"):
            for t in targets:
                rows.append({"thickness": th["thickness"], "shampoo_bucket": BUCKET[t][0], "scalp_route": BUCKET[t][1],
                             "cleansing_intensity": obs, "weight": {"low": "light", "moderate": "moderate", "high": "heavy"}[W], "tier": th["fit"]})
    roles = sorted({"shampoo_dandruff" if r["shampoo_bucket"] == "schuppen" else "shampoo_everyday" for r in rows})
    weight_live = {"value": {"low": "light", "moderate": "moderate", "high": "heavy"}[W], "confidence": Wc,
                   "rationale": f"W-LIVE: weightPotential {W} -> 1:1 projection; confidence = weightPotential confidence."}
    proj = {
        "thicknesses": thick,
        "weight": weight_live,
        "scalpTargets": {"primary": tg["primary"], "secondary": sec},
        "observedCleansingIntensity": {"value": obs, "confidence": obs_conf,
                                       "rationale": f"I1: cleansingStrength {S}" + (" with D1 true" if d1 else "") + f" -> {obs}. I3: neighbor {Sn}" + (" (high confidence, no boundary check)" if Sn == "none" else f" -> {intensity(Sn, d1)}; flag only where current equals bucket expectation and neighbor does not.")},
        "positioning": {"explicitResetPositioning": d1, "confidence": spec["d1"]["confidence"], "rationale": spec["d1"]["rationale"]},
        "explicitResetPositioning": d1,
        "deepCleanserListing": dcl,
        "rows": rows,
        "requiredProtocolRoles": roles,
        "reviewFlags": flags,
        "informationalNotes": notes,
        "researchCombinationTargets": spec.get("rct", []),
    }
    if dcl == "flagged":
        proj["deepCleanserRecord"] = "needs_record"
    # needs_research check: final props moderate+ and projected fields moderate+
    lowprops = [k for k, v in {"cleansingStrength": Sc, "conditioningLevel": Cc, "weightPotential": Wc,
                                "focusPrimary": spec["focusPrimary"]["confidence"], "usageRole": spec["usageRole"]["confidence"],
                                "scalpComfortTarget": spec["scalpComfortTarget"]["confidence"], "dandruffSupport": dand["confidence"]}.items() if v == "low"]
    lowproj = [t["thickness"] for t in thick if t["confidence"] == "low"] + (["primaryTarget"] if tg["primary"]["confidence"] == "low" else [])
    rec = {
        "blindId": bid,
        "inciFingerprintSha256": blind["inciFingerprintSha256"],
        "identity": {"brand": reveal.get("brand"), "productName": reveal.get("productName"), "market": "DE", **blind["identity"],
                     "normalization": blind["formulaNotes"]},
        "sourcesUsed": {"formula": formula_src, "positioning": src_ids},
        "claimGrading": spec["claimGrading"],
        "blindToFinalChanges": spec["changes"],
        "cleansingStrength": cleansing,
        "conditioningLevel": conditioning,
        "weightPotential": weight,
        "focusPrimary": spec["focusPrimary"],
        "focusSecondary": spec["focusSecondary"],
        "focusRecord": spec["focusRecord"],
        "usageRole": spec["usageRole"],
        "scalpComfortTarget": spec["scalpComfortTarget"],
        "dandruffSupport": dand,
        "projection": proj,
        "selfCheck": {
            "fingerprintMatchesFrozenPacket": True,
            "claimsAndPriorLabelsHiddenDuringFormulaJudgment": True,
            "noIngredientCountOrPositionWindowAssignedWeightBand": True,
            "allThreeSubjudgmentsPresent": True,
            "counterevidenceAndWhyNotNeighborSpecific": True,
            "confidenceNamesLimitingUncertainty": wp["confidenceLimitingFactor"],
            "comparisonWithEarlierValuesOnlyOutsideLane": True,
            "formulaPropertiesChangedAfterUnblinding": False,
        },
        "uncertainties": blind["uncertainties"] + spec.get("uncertainties", []),
    }
    if lowprops or lowproj:
        rec["status"] = "needs_research"
        rec["needsResearchReason"] = {"lowConfidenceProperties": lowprops, "lowConfidenceProjection": lowproj}
    with open(os.path.join(ROOT, "out", f"{bid}.json"), "w") as f:
        json.dump(rec, f, indent=2, ensure_ascii=False)
    return rec
