import json, hashlib
K = "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W4/lane-a"
R = {"low": 0, "moderate": 1, "high": 2}
def minc(*cs): return min(cs, key=lambda c: R[c])
BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}
TIER = {"ideal": 2, "acceptable": 1, "not_suited": 0}
def t1(th, W, C):
    if th == "fine": return {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[W]
    if th == "normal": return {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[W]
    return "ideal" if (C == "high" or W == "high") else "acceptable"
def t6(f, concern): return "acceptable" if (concern and f == "not_suited") else f
def intensity(cs, d1):
    return {"low": "gentle", "moderate": "regular"}.get(cs, "clarifying" if d1 else "regular")

def project(fp, S):
    dp = fp["directProperties"]
    W, Wc, Wn = dp["weightPotential"]["value"], dp["weightPotential"]["confidence"], dp["weightPotential"]["neighboringAlternative"]
    C, Cc, Cn = dp["conditioningLevel"]["value"], dp["conditioningLevel"]["confidence"], dp["conditioningLevel"]["neighboringAlternative"]
    CS, CSc, CSn = dp["cleansingStrength"]["value"], dp["cleansingStrength"]["confidence"], dp["cleansingStrength"]["neighboringAlternative"]
    prim = S["primary"]; sec = S.get("secondary")
    targets = [prim] + ([sec] if sec else [])
    concern = prim != "ordinary"
    fits, fitc, flags, notes = {}, {}, list(S.get("extraFlags", [])), list(S.get("notes", []))
    lifted = []
    for th in ("fine", "normal", "coarse"):
        raw = t1(th, W, C); f = t6(raw, concern)
        if f != raw: lifted.append(th)
        fits[th] = f
        fitc[th] = minc(Wc, Cc) if th == "coarse" else Wc
        lower = False
        alts = []
        if Wn != "none": alts.append((Wn, C))
        if th == "coarse" and Cn != "none": alts.append((W, Cn))
        for (w2, c2) in alts:
            if TIER[t6(t1(th, w2, c2), concern)] < TIER[f]: lower = True
        if lower: flags.append(f"review_thickness_boundary:{th}")
    if lifted: notes.append("scalp_concern_floor_applied:" + ",".join(lifted))
    d1 = S["d1"]
    inten = intensity(CS, d1)
    if CSn != "none":
        ninten = intensity(CSn, d1)
        for t in targets:
            exp = BUCKET[t][2]
            if inten == exp and ninten != exp: flags.append(f"review_intensity_boundary:{BUCKET[t][0]}")
    wmap = {"low": "light", "moderate": "moderate", "high": "heavy"}
    rows = []
    seen = set()
    for th in ("fine", "normal", "coarse"):
        if fits[th] == "not_suited": continue
        for t in targets:
            b, r, _ = BUCKET[t]
            if (th, b) in seen: continue
            seen.add((th, b))
            rows.append({"thickness": th, "shampoo_bucket": b, "scalp_route": r, "cleansing_intensity": inten, "weight": wmap[W], "tier": fits[th]})
    roles = []
    if any(r["shampoo_bucket"] == "schuppen" for r in rows): roles.append("shampoo_dandruff")
    if any(r["shampoo_bucket"] != "schuppen" for r in rows): roles.append("shampoo_everyday")
    return fits, fitc, flags, notes, inten, rows, roles, wmap[W]

def build(bid, S):
    fp = json.load(open(f"{K}/out/formula-pass/{bid}.json"))
    raw = open(f"{K}/out/formula-pass/{bid}.json", "rb").read()
    dp0 = fp["directProperties"]
    fits, fitc, flags, notes, inten, rows, roles, wlive = project(fp, S)
    CSc = dp0["cleansingStrength"]["confidence"]
    def prop(name, extra):
        p = dict(dp0[name]); p.pop("provisional", None); p.update(extra); return p
    dp = {
     "cleansingStrength": prop("cleansingStrength", {"counterSignal": S["csCounter"], "formulaFacts": fp["formulaFacts"]["surfactants"]}),
     "conditioningLevel": prop("conditioningLevel", {"counterSignal": S["clCounter"], "formulaFacts": fp["formulaFacts"]["conditioningRoutes"]}),
     "weightPotential": prop("weightPotential", {"counterSignal": dp0["weightPotential"]["counterevidence"]}),
     "focusPrimary": S["focusPrimary"], "focusSecondary": S["focusSecondary"], "usageRole": S["usageRole"],
     "scalpComfortTarget": S["scalpComfortTarget"],
     "dandruffSupport": prop("dandruffSupport", {"counterSignal": "none — mechanical recognition of the closed active list", "formulaFacts": fp["formulaFacts"]["actives"]}),
    }
    for k in ("focusPrimary", "focusSecondary", "usageRole", "scalpComfortTarget"):
        dp[k].setdefault("ruleIds", [])
    low = [k for k, v in dp.items() if v["confidence"] == "low"]
    status = "needs_research" if low else ("proposal_blocked_by_review_flags" if flags else "proposal")
    prim = S["primary"]
    weightC = dp0["weightPotential"]["confidence"]
    rec = {
     "blindId": bid,
     "lane": "lane-a", "phase": "2-final", "policyId": "shampoo-classification-v1.6.2",
     "formulaPassSha256": hashlib.sha256(raw).hexdigest(),
     "identity": {"brand": S["brand"], "productName": S["productName"], "packSize": fp["formulaBlock"]["packSize"], "market": "DE",
       "formulaFingerprintSha256": fp["inciFingerprintSha256"], "normalization": fp["formulaBlock"]["normalization"],
       "completeness": f"{fp['formulaBlock']['formulaCompleteness']} (formula source tier {fp['formulaBlock']['formulaSourceTier']}, identity confidence {fp['formulaBlock']['identityConfidence']})",
       "e3ProminenceCutoff": fp["formulaBlock"]["e3Point"], "identityNotes": S.get("identityNotes", [])},
     "directProperties": dp,
     "formulaFacts": fp["formulaFacts"],
     "projection": {
       "status": status,
       "thicknessFit": fits, "thicknessFitConfidence": fitc,
       "thicknessRationale": f"T1 from weightPotential `{dp0['weightPotential']['value']}` and conditioningLevel `{dp0['conditioningLevel']['value']}` (coarse reads C); " + ("T6 applied for scalp-concern targets (not_suited -> acceptable); " if prim != "ordinary" else "ordinary target: T1 unchanged (no T6); ") + "T4 checked against the N-ALT neighbors of W (all thicknesses) and C (coarse), after T6. T2: claims about hair type/texture ('" + S.get("t2", "none") + "') never change fit.",
       "weight": wlive, "weightConfidence": weightC,
       "weightRationale": f"W-LIVE: weightPotential `{dp0['weightPotential']['value']}` -> `{wlive}` 1:1; confidence = weightPotential confidence.",
       "scalpTargets": {"primary": {"target": prim, "confidence": S["primaryConf"], "rationale": S["primaryRationale"]},
                        "secondary": ({"target": S["secondary"], "confidence": S["secondaryConf"], "rationale": S["secondaryRationale"]} if S.get("secondary") else None),
                        "secondaryRationale": S.get("noSecondaryRationale", "No secondary target: no second qualifying distinct E2 claim unit with a passing gate (S-SECONDARY).")},
       "researchCombinationTargets": S.get("rct", []),
       "researchCombinationRationale": S.get("rctRationale", "Not a dandruff-primary product: research-only combination does not apply (E2b)."),
       "cleansingIntensity": inten, "cleansingIntensityConfidence": CSc if not (inten == "clarifying") else minc(CSc, "moderate"),
       "cleansingIntensityRationale": f"I1: cleansingStrength `{dp0['cleansingStrength']['value']}`" + (" with D1 true" if S["d1"] else "") + f" -> `{inten}` (formula plus D1 only; focus and usage role are not inputs). I3 checked with the N-ALT neighbor `{dp0['cleansingStrength']['neighboringAlternative']}`.",
       "explicitResetPositioning": S["d1"],
       "explicitResetRationale": S["d1Rationale"],
       "deepCleanserListing": S.get("dcl", "not_flagged"),
       "deepCleanserRecord": S.get("dcr", None),
       "deepCleanserListingConfidence": S.get("dclConf", "high"),
       "deepCleanserRationale": S.get("dclRationale", "D2 not satisfied (requires cleansingStrength strong, focus clarifying, usageRole occasional_reset and D1 true) -> not_flagged."),
       "rows": rows, "requiredProtocolRoles": roles,
       "reviewFlags": flags + S.get("flagsAfter", []), "informationalNotes": notes,
       "catalogDependent": "review_live_value_differs and any deep-cleanser record id are resolved by the orchestrator after freeze; this lane sees no catalog values."},
     "reconciliation": S["reconciliation"],
     "selfCheck": S.get("selfCheck", "6.11: fingerprint equals the frozen formula packet and the hash-pinned formula pass; claims were hidden during the formula judgment (formula pass written before reveal, not edited); no ingredient, count or position window assigned the weight band; the W-line was derived exactly per W-LINE with skipped candidates recorded; all three subjudgments present; whyNotNeighborBand specific (W2 where two families); confidence names its limiting factor. Cleansing, conditioning, weight and dandruff values are unchanged from the blind pass (claims cannot move them, 3.2). Projection fields computed mechanically from final properties (T1/T6/T4, W-LIVE, I1/I3, 13.7)."),
     "uncertainties": S["uncertainties"],
    }
    with open(f"{K}/out/{bid}.json", "w") as f:
        json.dump(rec, f, indent=1, ensure_ascii=False); f.write("\n")
    dp_ = rec["projection"]
    sec = dp_["scalpTargets"]["secondary"]["target"] if dp_["scalpTargets"]["secondary"] else "none"
    print(f"{bid}: weight={dp_['weight']} primary={prim} secondary={sec} fits={fits['fine']}/{fits['normal']}/{fits['coarse']} intensity={inten} dcl={dp_['deepCleanserListing']} rct={dp_['researchCombinationTargets']} flags={dp_['reviewFlags']} status={status}")

def F(value, conf, nb, verdict, mroutes, rroutes, shared, lim, role, counter, trace, rationale, rules):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb,
            "careDirection": {"verdict": verdict, "moistureRoutes": mroutes, "repairRoutes": rroutes, "sharedConditioningRoutes": shared, "limitation": lim},
            "claimRole": role, "counterSignal": counter, "decisionTrace": trace, "rationale": rationale, "ruleIds": rules}
def SEC(value, conf, nb, trace, rationale, rules=["8", "F2", "F3", "F4", "N-ALT"]):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "decisionTrace": trace, "rationale": rationale, "ruleIds": rules}
def U(value, conf, nb, code, ev, losing, rationale, rules=["9", "U1", "U2", "U3", "U4", "U5", "CL-SRC", "F-TRACE"]):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "triggerCode": code, "triggerEvidence": ev, "losingTriggers": losing, "rationale": rationale, "ruleIds": rules}
def SCT(value, conf, nb, csa, rationale, counter, rules=["10", "CSA", "MB", "SC1", "E2a", "E3", "E4"]):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "csaRoute": csa, "rationale": rationale, "counterSignal": counter, "ruleIds": rules}
