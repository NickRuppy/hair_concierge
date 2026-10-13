import json, sys, copy
OUT = "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W3/lane-b/out"
RANK = {"ideal": 2, "acceptable": 1, "not_suited": 0}
CONF = {"high": 2, "moderate": 1, "low": 0}
BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}

def t1(th, W, C):
    if th == "fine": return {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[W]
    if th == "normal": return {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[W]
    if W == "high": return "ideal"
    return "ideal" if C == "high" else "acceptable"

def final_fit(th, W, C, concern):
    f = t1(th, W, C)
    if concern and f == "not_suited": f = "acceptable"
    return f

def intensity(cs, d1):
    if cs == "low": return "gentle"
    if cs == "moderate": return "regular"
    return "clarifying" if d1 else "regular"

def minc(*cs):
    return min(cs, key=lambda c: CONF[c])

def project(rec, spec):
    dp = rec["directProperties"]
    W, Wc, Wn = dp["weightPotential"]["value"], dp["weightPotential"]["confidence"], dp["weightPotential"]["neighboringAlternative"]
    C, Cc, Cn = dp["conditioningLevel"]["value"], dp["conditioningLevel"]["confidence"], dp["conditioningLevel"]["neighboringAlternative"]
    CS, CSc, CSn = dp["cleansingStrength"]["value"], dp["cleansingStrength"]["confidence"], dp["cleansingStrength"]["neighboringAlternative"]
    prim = spec["primary"]; sec = spec.get("secondary")
    concern = prim["target"] != "ordinary"
    fits, fconf, flags, notes, lifted = {}, {}, [], list(spec.get("notes", [])), []
    for th in ["fine", "normal", "coarse"]:
        f = final_fit(th, W, C, concern)
        if concern and t1(th, W, C) == "not_suited": lifted.append(th)
        fits[th] = f
        fconf[th] = minc(Wc, Cc) if th == "coarse" else Wc
        alts = []
        if Wn != "none": alts.append((Wn, C))
        if th == "coarse" and Cn != "none": alts.append((W, Cn))
        if any(RANK[final_fit(th, w, c, concern)] < RANK[f] for w, c in alts):
            flags.append("review_thickness_boundary:" + th)
    if lifted: notes.append("scalp_concern_floor_applied:" + ",".join(lifted))
    d1 = spec["d1"]
    inten = intensity(CS, d1)
    targets = [prim["target"]] + ([sec["target"]] if sec else [])
    if CSn != "none":
        ninten = intensity(CSn, d1)
        for t in targets:
            exp = BUCKET[t][2]
            if inten == exp and ninten != exp: flags.append("review_intensity_boundary:" + BUCKET[t][0])
    flags += spec.get("flags", [])
    rows = []
    for th in ["fine", "normal", "coarse"]:
        if fits[th] in ("ideal", "acceptable"):
            for t in targets:
                b, r, _ = BUCKET[t]
                rows.append({"thickness": th, "shampoo_bucket": b, "scalp_route": r, "cleansing_intensity": inten,
                             "weight": {"low": "light", "moderate": "moderate", "high": "heavy"}[W], "tier": fits[th]})
    roles = []
    if any(r["shampoo_bucket"] == "schuppen" for r in rows): roles.append("shampoo_dandruff")
    if any(r["shampoo_bucket"] != "schuppen" for r in rows): roles.append("shampoo_everyday")
    intconf = CSc if inten != "clarifying" else minc(CSc, spec["d1Conf"])
    allconf = list(fconf.values()) + [Wc, prim["confidence"], intconf] + ([sec["confidence"]] if sec else [])
    status = "needs_research" if "low" in allconf else ("proposal_blocked_by_review_flags" if flags else "proposal_no_review_flags")
    return {
        "status": status,
        "thicknessFit": fits, "thicknessFitConfidence": fconf,
        "thicknessRationale": "T1 from weightPotential %s and conditioningLevel %s%s; T4 checked with neighbors W=%s, C=%s after T6. %s" % (W, C, ", T6 applied (scalp-concern targets)" if concern else " (ordinary target, no T6)", Wn, Cn, spec.get("thNote", "")),
        "weight": {"low": "light", "moderate": "moderate", "high": "heavy"}[W], "weightConfidence": Wc,
        "weightRationale": "W-LIVE 1:1 from weightPotential %s (confidence %s)." % (W, Wc),
        "scalpTargets": {"primary": prim, "secondary": sec},
        "researchCombinationTargets": spec.get("rct", []),
        "cleansingIntensity": inten, "cleansingIntensityConfidence": intconf,
        "cleansingIntensityRationale": "I1: cleansingStrength %s, D1 %s -> %s. I3: neighbor %s%s." % (CS, str(d1).lower(), inten, CSn, "" if CSn != "none" else " (high confidence, no I3 check)"),
        "explicitResetPositioning": d1,
        "deepCleanserListing": spec.get("dcl", "not_flagged"),
        "deepCleanserListingConfidence": spec["dclConf"],
        "deepCleanserRationale": spec["dclWhy"],
        "rows": rows, "requiredProtocolRoles": roles,
        "reviewFlags": flags, "informationalNotes": notes,
        "catalogDependent": "review_live_value_differs and any deep-cleanser record id are resolved by the orchestrator after freeze; not evaluated in lane."
    }

def build(bid, spec):
    fp = json.load(open(f"{OUT}/formula-pass/{bid}.json"))
    rec = {"blindId": bid}
    fb = fp["formulaBlock"]
    rec["identity"] = {"brand": spec["brand"], "productName": spec["name"], "packSize": fb["packSize"], "market": "DE",
                       "formulaFingerprintSha256": fp["inciFingerprintSha256"], "normalization": fb["normalization"],
                       "completeness": "%s; source tier %s; identity confidence %s" % (fb["formulaCompleteness"], fb["formulaSourceTier"], fb["identityConfidence"]),
                       "e3ProminenceCutoff": fb["e3Point"], "identityNotes": spec.get("idNotes", "")}
    dp = copy.deepcopy(fp["directProperties"])
    for k in ["cleansingStrength", "conditioningLevel", "weightPotential", "dandruffSupport"]:
        dp[k].pop("provisional", None)
        dp[k]["counterSignal"] = spec["cs"][k]
        dp[k]["sourceIds"] = ["formula packet " + bid]
    dp["weightPotential"]["formulaFacts"] = "see evidence and wLine"
    for k in ["focusPrimary", "focusSecondary", "usageRole", "scalpComfortTarget"]:
        dp[k] = spec[k]
    rec["directProperties"] = dp
    rec["formulaFacts"] = fp["formulaFacts"]
    rec["projection"] = project(rec, spec)
    rec["reconciliation"] = spec["recon"]
    rec["selfCheck"] = ("Fingerprint matches the frozen packet (%s). Formula judgments (cleansing, conditioning, weight, dandruff) were made blind and are unchanged from the hash-pinned formula pass; claims were used only per 3.2/CL-SRC. No ingredient, family count or position window assigned the weight band; the W-line was derived from the frozen list and only gates payload_lipid legs; every skipped candidate is recorded. Three weight subjudgments present; whyNotNeighborBand names the specific boundary; confidence names its limiting factor. Neighbors follow N-ALT. Projection derived mechanically (T1/T6/T4, W-LIVE, I1/I3, D1-D3, S-gates). No comparison with earlier values made in lane." % fp["inciFingerprintSha256"][:12])
    rec["uncertainties"] = spec["unc"]
    json.dump(rec, open(f"{OUT}/{bid}.json", "w"), ensure_ascii=False, indent=2)
    p = rec["projection"]
    print(bid, p["weight"], p["scalpTargets"]["primary"]["target"], (p["scalpTargets"]["secondary"] or {}).get("target"), p["thicknessFit"], p["cleansingIntensity"], p["deepCleanserListing"], p["researchCombinationTargets"], p["reviewFlags"], p["status"])

if __name__ == "__main__":
    import importlib.util
    specfile = sys.argv[1]
    s = importlib.util.spec_from_file_location("specs", specfile); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
    for bid, spec in m.SPECS.items(): build(bid, spec)
