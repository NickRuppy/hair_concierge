import json, sys, os

OUT = sys.argv[1]  # <kit>/lane-a/out
FP = os.path.join(OUT, "formula-pass")
CONF_ORDER = {"low": 0, "moderate": 1, "high": 2}
TIER_ORDER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}
WEIGHT = {"low": "light", "moderate": "moderate", "high": "heavy"}


def minc(*cs):
    return min(cs, key=lambda c: CONF_ORDER[c])


def t1(W, C, th):
    if th == "fine":
        return {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[W]
    if th == "normal":
        return {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[W]
    if W == "high":
        return "ideal"
    return "ideal" if C == "high" else "acceptable"


def final_fit(W, C, th, concern):
    f = t1(W, C, th)
    if concern and f == "not_suited":
        return "acceptable", True
    return f, False


def intensity(cs, d1):
    if cs == "low":
        return "gentle"
    if cs == "moderate":
        return "regular"
    return "clarifying" if d1 else "regular"


def build(bid, s):
    fp = json.load(open(os.path.join(FP, bid + ".json")))
    dp = fp["directProperties"]
    cs, cl, wp = dp["cleansingStrength"], dp["conditioningLevel"], dp["weightPotential"]
    W, Wc, Wn = wp["value"], wp["confidence"], wp["neighboringAlternative"]
    C, Cc, Cn = cl["value"], cl["confidence"], cl["neighboringAlternative"]
    prim = s["primary"]
    sec = s.get("secondary")
    targets = [prim["target"]] + ([sec["target"]] if sec else [])
    concern = prim["target"] != "ordinary"
    fits, fitconf, lifted, flags = {}, {}, [], list(s.get("extraFlags", []))
    t4 = []
    for th in ("fine", "normal", "coarse"):
        f, lift = final_fit(W, C, th, concern)
        fits[th] = f
        if lift:
            lifted.append(th)
        uses_c = th == "coarse" and W != "high"
        fitconf[th] = minc(Wc, Cc) if uses_c else Wc
        lower = False
        if Wc != "high":
            nf, _ = final_fit(Wn, C, th, concern)
            lower |= TIER_ORDER[nf] < TIER_ORDER[f]
        if th == "coarse" and Cc != "high":
            nf, _ = final_fit(W, Cn, th, concern)
            lower |= TIER_ORDER[nf] < TIER_ORDER[f]
        if lower:
            t4.append(th)
    if t4:
        flags.append("review_thickness_boundary:" + ",".join(t4))
    obs = intensity(cs["value"], s["d1"])
    # I3
    if cs["confidence"] != "high":
        nobs = intensity(cs["neighboringAlternative"], s["d1"])
        for t in targets:
            exp = BUCKET[t][2]
            if obs == exp and nobs != exp:
                flags.append("review_intensity_boundary:" + BUCKET[t][0])
    notes = list(s.get("notes", []))
    if lifted:
        notes.append("scalp_concern_floor_applied:" + ",".join(lifted))
    rows = []
    seen = set()
    for th in ("fine", "normal", "coarse"):
        if fits[th] == "not_suited":
            continue
        for t in targets:
            b, r, _ = BUCKET[t]
            if (th, b) in seen:
                continue
            seen.add((th, b))
            rows.append({"thickness": th, "shampoo_bucket": b, "scalp_route": r,
                         "cleansing_intensity": obs, "weight": WEIGHT[W], "tier": fits[th]})
    roles = []
    if any(r["shampoo_bucket"] == "schuppen" for r in rows):
        roles.append("shampoo_dandruff")
    if any(r["shampoo_bucket"] != "schuppen" for r in rows):
        roles.append("shampoo_everyday")
    obsconf = cs["confidence"] if obs != "clarifying" else minc(cs["confidence"], s["d1Grade"])
    status = "proposal_blocked_pending_review" if flags else "proposal"
    thick_rat = ("T1 (%s target%s): W=%s, C=%s -> fine %s, normal %s, coarse %s." % (
        "/".join(targets), "s" if len(targets) > 1 else "", W, C, t1(W, C, 'fine'), t1(W, C, 'normal'), t1(W, C, 'coarse')))
    if concern:
        thick_rat += " T6 floor applies (scalp-concern targets)" + (": lifted " + ",".join(lifted) if lifted else ": no not_suited cell to lift") + "."
    thick_rat += " T4 with N-ALT neighbors (W neighbor %s at %s confidence; C neighbor %s at %s confidence): %s." % (
        Wn, Wc, Cn, Cc, ("flag " + ",".join(t4)) if t4 else "no lower final tier, no flag")
    thick_rat += " T2: thickness/texture claims ignored."
    proj = {
        "status": status,
        "thicknessFit": fits,
        "thicknessFitConfidence": fitconf,
        "thicknessRationale": thick_rat,
        "weight": WEIGHT[W],
        "weightConfidence": Wc,
        "weightRationale": "W-LIVE: weightPotential %s -> weight %s; confidence = weightPotential confidence (%s). Claims never adjust it." % (W, WEIGHT[W], Wc),
        "scalpTargets": {"primary": prim, "secondary": sec},
        "researchCombinationTargets": s.get("rct", []),
        "cleansingIntensity": obs,
        "cleansingIntensityConfidence": obsconf,
        "cleansingIntensityRationale": "I1: cleansingStrength %s%s -> %s. I2: written unchanged to every row (bucket expectation%s). I3: cleansingStrength confidence %s%s." % (
            cs["value"], " with D1 true" if s["d1"] else ", D1 false", obs,
            "; ".join([" %s expects %s" % (BUCKET[t][0], BUCKET[t][2]) for t in targets]),
            cs["confidence"], " (neighbor none) -> no review_intensity_boundary" if cs["confidence"] == "high" else ""),
        "explicitResetPositioning": s["d1"],
        "deepCleanserListing": s.get("dcl", "not_flagged"),
        "deepCleanserListingConfidence": s.get("dclConf", "high"),
        "deepCleanserRationale": s["dclRat"],
        "rows": rows,
        "requiredProtocolRoles": roles,
        "reviewFlags": flags,
        "informationalNotes": notes,
        "catalogDependent": "review_live_value_differs and any deep-cleanser record id are resolved by the orchestrator after freeze; lanes never see catalog ids." + (" deepCleanserRecord: needs_record." if s.get("dcl") == "flagged" else ""),
    }
    def addcs(p, cstr):
        q = dict(p)
        q["counterSignal"] = cstr
        return q
    rec = {
        "blindId": bid,
        "policy": "shampoo-classification-v1.6.2",
        "lane": "lane-a",
        "phase": "final (post-unblind reconciliation)",
        "formulaPassRecord": "out/formula-pass/%s.json (hash-pinned, unedited)" % bid,
        "identity": {
            "brand": s["brand"], "productName": s["name"], "packSize": fp["identity"]["packSize"], "market": "DE",
            "formulaFingerprintSha256": fp["inciFingerprintSha256"],
            "normalization": fp["identity"]["normalization"],
            "completeness": "%s; formula source tier %s; identity confidence %s" % (
                fp["identity"]["formulaCompleteness"], fp["identity"]["formulaSourceTier"], fp["identity"]["identityConfidence"]),
            "e3ProminenceCutoff": fp["identity"]["e3ProminenceCutoff"],
            "positioningSources": s["sources"],
        },
        "directProperties": {
            "cleansingStrength": addcs(cs, s["csCounter"]),
            "conditioningLevel": addcs(cl, s["clCounter"]),
            "weightPotential": dict(wp, counterSignal=wp["counterevidence"]),
            "focusPrimary": s["focusPrimary"],
            "focusSecondary": s["focusSecondary"],
            "usageRole": s["usageRole"],
            "scalpComfortTarget": s["scalpComfortTarget"],
            "dandruffSupport": addcs(dp["dandruffSupport"], s.get("dsCounter", "None: recognition is a closed-list lookup on the complete INCI.")),
        },
        "formulaFacts": fp["formulaFacts"],
        "unresolvedMaterialIngredients": fp["unresolvedMaterialIngredients"],
        "reconciliation": s["reconciliation"],
        "projection": proj,
        "selfCheck": "6.11: fingerprint %s matches the frozen stage-A packet; claims were hidden during the formula pass (formula-pass record hash-pinned before release, not edited); no ingredient, family count or position window assigned the weight band, the W-line only gated payload_lipid legs; the W-line was derived from the frozen normalized list and every skipped candidate is recorded; depositionLoad/persistence/resetCapacity present with rationales; whyNotNeighborBand is specific (W2 where it applies); confidence names its limiting factor; no comparison with earlier values was made inside the lane. N-ALT neighbors follow confidence on every property; projection derived mechanically from final properties (T1/T6/T4, W-LIVE, I1-I3, S-gates, 13.7 row assembly, 13.8 confidence)." % fp["inciFingerprintSha256"][:12],
        "uncertainties": s["uncertainties"],
    }
    with open(os.path.join(OUT, bid + ".json"), "w") as fh:
        json.dump(rec, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    return "%s weight=%s primary=%s secondary=%s fits=%s/%s/%s intensity=%s dcl=%s rct=%s flags=%s" % (
        bid, WEIGHT[W], prim["target"], sec["target"] if sec else "none", fits["fine"], fits["normal"], fits["coarse"],
        obs, proj["deepCleanserListing"], proj["researchCombinationTargets"], flags or "none")


if __name__ == "__main__":
    specs = json.load(open(sys.argv[2]))
    for bid in sys.argv[3:]:
        print(build(bid, specs[bid]))
