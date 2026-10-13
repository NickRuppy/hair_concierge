import json, os, sys

KIT = "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-b"
ORDER = {"low": 0, "moderate": 1, "high": 2}
TIER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
BUCKET = {
    "ordinary": ("normal", "balanced", "regular"),
    "oily": ("dehydriert-fettig", "oily", "regular"),
    "dry": ("trocken", "dry", "gentle"),
    "sensitive": ("irritationen", "irritated", "gentle"),
    "dandruff": ("schuppen", "dandruff", "regular"),
}
WEIGHT = {"low": "light", "moderate": "moderate", "high": "heavy"}


def t1(th, w, c):
    if th == "fine":
        return {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[w]
    if th == "normal":
        return {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[w]
    if w == "high":
        return "ideal"
    return "ideal" if c == "high" else "acceptable"


def final_fit(th, w, c, concern):
    f = t1(th, w, c)
    if concern and f == "not_suited":
        f = "acceptable"
    return f


def i1(cs, d1):
    if cs == "low":
        return "gentle"
    if cs == "moderate":
        return "regular"
    return "clarifying" if d1 else "regular"


def minconf(*cs):
    return min(cs, key=lambda x: ORDER[x])


def load_fp(bid):
    with open(os.path.join(KIT, "out", "formula-pass", bid + ".json")) as f:
        return json.load(f)


def build(bid, spec):
    fp = load_fp(bid)
    dp = fp["directProperties"]
    cs, cl, wp = dp["cleansingStrength"], dp["conditioningLevel"], dp["weightPotential"]
    for key, prop in (("cs", cs), ("cl", cl), ("wp", wp)):
        prop["counterSignal"] = spec["counter"][key]
        prop["sourceIds"] = ["formula-pass/" + bid + ".json (hash-pinned blind record)", "stage-A formula packet " + bid]
    wp["wLineRecord"] = fp["wLine"]
    W, C, CS = wp["value"], cl["value"], cs["value"]
    Wn, Cn, CSn = wp["neighboringAlternative"], cl["neighboringAlternative"], cs["neighboringAlternative"]
    d1 = spec["d1"]["value"]
    targets = spec["targets"]  # list of dicts: target, confidence, rationale
    tnames = [t["target"] for t in targets]
    concern = tnames != ["ordinary"]
    fits, fconf, flags, notes = {}, {}, list(spec.get("flags", [])), list(spec.get("notes", []))
    t4 = []
    lifted = []
    for th in ("fine", "normal", "coarse"):
        f = final_fit(th, W, C, concern)
        fits[th] = f
        if concern and t1(th, W, C) == "not_suited":
            lifted.append(th)
        fconf[th] = minconf(wp["confidence"], cl["confidence"]) if th == "coarse" else wp["confidence"]
        alts = []
        if Wn != "none":
            alts.append(final_fit(th, Wn, C, concern))
        if th == "coarse" and Cn != "none":
            alts.append(final_fit(th, W, Cn, concern))
        if any(TIER[a] < TIER[f] for a in alts):
            t4.append(th)
    for th in t4:
        flags.append("review_thickness_boundary:" + th)
    if lifted:
        notes.append("scalp_concern_floor_applied:" + ",".join(lifted))
    intensity = i1(CS, d1)
    for t in tnames:
        exp = BUCKET[t][2]
        if intensity == exp and CSn != "none" and i1(CSn, d1) != exp:
            flags.append("review_intensity_boundary:" + BUCKET[t][0])
    rows = []
    for th in ("fine", "normal", "coarse"):
        if fits[th] in ("ideal", "acceptable"):
            for t in tnames:
                b, r, _ = BUCKET[t]
                rows.append({"thickness": th, "shampoo_bucket": b, "scalp_route": r, "cleansing_intensity": intensity, "weight": WEIGHT[W], "tier": fits[th]})
    roles = []
    if any(r["shampoo_bucket"] == "schuppen" for r in rows):
        roles.append("shampoo_dandruff")
    if any(r["shampoo_bucket"] != "schuppen" for r in rows):
        roles.append("shampoo_everyday")
    ic = cs["confidence"] if intensity != "clarifying" else minconf(cs["confidence"], spec["d1"]["confidence"])
    dpp = spec["directProperties"]
    allconf = [cs["confidence"], cl["confidence"], wp["confidence"]] + [dpp[k]["confidence"] for k in dpp]
    status = "projected_proposal" if all(c != "low" for c in allconf) else "needs_research"
    proj = {
        "status": status,
        "thicknessFit": fits,
        "thicknessFitConfidence": fconf,
        "thicknessRationale": spec["thicknessRationale"],
        "weight": WEIGHT[W],
        "weightConfidence": wp["confidence"],
        "weightRationale": "W-LIVE: weightPotential " + W + " projects 1:1 to " + WEIGHT[W] + "; confidence = weightPotential confidence.",
        "scalpTargets": {"primary": targets[0], "secondary": targets[1] if len(targets) > 1 else None},
        "researchCombinationTargets": spec.get("rct", []),
        "cleansingIntensity": intensity,
        "cleansingIntensityConfidence": ic,
        "cleansingIntensityRationale": "I1: cleansingStrength " + CS + ("; D1 true" if d1 else "; D1 false") + " -> " + intensity + ". I3 recomputed with neighbor " + CSn + ".",
        "explicitResetPositioning": d1,
        "explicitResetPositioningEvidence": spec["d1"]["evidence"],
        "deepCleanserListing": spec["d2"]["value"],
        "deepCleanserListingConfidence": spec["d2"]["confidence"],
        "deepCleanserRationale": spec["d2"]["rationale"],
        "rows": rows,
        "requiredProtocolRoles": roles,
        "reviewFlags": flags,
        "informationalNotes": notes,
        "catalogDependent": "review_live_value_differs and any deep-cleanser record id are resolved by the orchestrator after freeze (lane cannot see catalog)",
    }
    if spec["d2"]["value"] == "flagged":
        proj["deepCleanserRecord"] = "needs_record"
    newdp = {"cleansingStrength": cs, "conditioningLevel": cl, "weightPotential": wp}
    newdp.update(dpp)
    rec = {
        "blindId": bid,
        "lane": "lane-b",
        "phase": "final (post-unblind reconciliation)",
        "standard": "shampoo-classification-v1.6.1 candidate text (unlocked)",
        "identity": {
            "brand": spec["brand"],
            "productName": spec["productName"],
            "packSize": fp["identity"]["packSize"],
            "market": "DE",
            "formulaFingerprintSha256": fp["inciFingerprintSha256"],
            "normalization": fp["identity"]["normalization"],
            "completeness": fp["identity"]["formulaCompleteness"] + " (source tier " + str(fp["identity"]["formulaSourceTier"]) + ", identity confidence " + fp["identity"]["identityConfidence"] + ")",
            "e3ProminenceCutoff": fp["identity"]["e3ProminenceCutoff"],
            "identityNotes": spec.get("identityNotes", []),
        },
        "formulaFacts": fp["formulaFacts"],
        "claimEvidence": spec["claimEvidence"],
        "reconciliation": spec["reconciliation"],
        "directProperties": newdp,
        "projection": proj,
        "selfCheck": spec["selfCheck"],
        "uncertainties": fp.get("uncertainties", []) + spec.get("uncertainties", []),
    }
    out = os.path.join(KIT, "out", bid + ".json")
    with open(out, "w") as f:
        json.dump(rec, f, ensure_ascii=False, indent=2)
    return rec
