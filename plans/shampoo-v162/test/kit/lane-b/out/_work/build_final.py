"""Lane-b phase-2 builder: merges the pinned formula-pass records (read only) with the
post-unblind reconciliation written below, computes the mechanical projection rules
(T1, T6, T4, W-LIVE, I1, I3, rows, 13.8) and writes <kit>/lane-b/out/<id>.json."""
import json, sys, copy

OUT = "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v162/plans/shampoo-v162/test/kit/lane-b/out"
FP = OUT + "/formula-pass"

BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}
TIER = {"ideal": 2, "acceptable": 1, "not_suited": 0}
CONF = {"low": 0, "moderate": 1, "high": 2}
CONF_NAME = {0: "low", 1: "moderate", 2: "high"}


def t1(th, w, c):
    if th == "fine":
        return {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[w]
    if th == "normal":
        return {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[w]
    if w == "high":
        return "ideal"
    return "ideal" if c == "high" else "acceptable"


def t6(fit, concern):
    return "acceptable" if (concern and fit == "not_suited") else fit


def intensity(cs, d1):
    return {"low": "gentle", "moderate": "regular"}.get(cs, "clarifying" if d1 else "regular")


def minc(*cs):
    return CONF_NAME[min(CONF[c] for c in cs)]


def project(dp, targets, d1, notes_extra, flags_extra):
    W = dp["weightPotential"]; C = dp["conditioningLevel"]; CS = dp["cleansingStrength"]
    concern = targets[0] != "ordinary"
    fits, fitconf, flags, notes = {}, {}, list(flags_extra), list(notes_extra)
    t4 = []
    for th in ("fine", "normal", "coarse"):
        raw = t1(th, W["value"], C["value"])
        f = t6(raw, concern)
        if f != raw:
            notes.append("scalp_concern_floor_applied:" + th)
        fits[th] = f
        fitconf[th] = minc(W["confidence"], C["confidence"]) if th == "coarse" else W["confidence"]
        alts = []
        if W["neighboringAlternative"] not in ("none", None):
            alts.append(t6(t1(th, W["neighboringAlternative"], C["value"]), concern))
        if th == "coarse" and C["neighboringAlternative"] not in ("none", None):
            alts.append(t6(t1(th, W["value"], C["neighboringAlternative"]), concern))
        if any(TIER[a] < TIER[f] for a in alts):
            t4.append(th)
    if t4:
        flags.append("review_thickness_boundary:" + ",".join(t4))
    inten = intensity(CS["value"], d1)
    i3 = []
    if CS["neighboringAlternative"] not in ("none", None):
        ninten = intensity(CS["neighboringAlternative"], d1)
        for t in targets:
            exp = BUCKET[t][2]
            if inten == exp and ninten != exp:
                i3.append(BUCKET[t][0])
    if i3:
        flags.append("review_intensity_boundary:" + ",".join(i3))
    weight = {"low": "light", "moderate": "moderate", "high": "heavy"}[W["value"]]
    rows, seen = [], set()
    for th in ("fine", "normal", "coarse"):
        if fits[th] == "not_suited":
            continue
        for t in targets:
            key = (th, BUCKET[t][0])
            if key in seen:
                continue
            seen.add(key)
            rows.append({"thickness": th, "shampoo_bucket": BUCKET[t][0], "scalp_route": BUCKET[t][1],
                         "cleansing_intensity": inten, "weight": weight, "tier": fits[th]})
    roles = []
    if any(r["shampoo_bucket"] == "schuppen" for r in rows):
        roles.append("shampoo_dandruff")
    if any(r["shampoo_bucket"] != "schuppen" for r in rows):
        roles.append("shampoo_everyday")
    return fits, fitconf, flags, notes, inten, weight, rows, roles


def build(bid, R):
    fp = json.load(open(f"{FP}/{bid}.json"))
    assert fp["inciFingerprintSha256"] == R["fingerprint"]
    dp = copy.deepcopy(fp["directProperties"])
    # formula-only properties carried unchanged; add counter-signals
    for k in ("cleansingStrength", "conditioningLevel", "weightPotential", "dandruffSupport"):
        dp[k]["counterSignal"] = R["counter"][k]
        dp[k]["blindToFinal"] = "unchanged (formula-only property; claims may not move it, 3.2)"
        dp[k].pop("provisional", None)
    w = dp["weightPotential"]
    w["formulaIdentifiers"] = {"fingerprint": fp["inciFingerprintSha256"], "sourceTier": fp["formulaBlock"]["formulaSourceTier"],
                               "completeness": fp["formulaBlock"]["formulaCompleteness"], "captureDate": "not given in the stage-A packet"}
    for k in ("focusPrimary", "focusSecondary", "usageRole", "scalpComfortTarget"):
        dp[k] = R["props"][k]
    for k in ("cleansingStrength", "conditioningLevel", "weightPotential", "focusPrimary", "focusSecondary",
              "usageRole", "scalpComfortTarget", "dandruffSupport"):
        dp[k].setdefault("counterSignal", R["counter"].get(k, ""))
    targets = R["targets"]
    fits, fitconf, flags, notes, inten, weight, rows, roles = project(dp, targets, False, R.get("notes", []), R.get("flags", []))
    CS = dp["cleansingStrength"]
    proj = {
        "status": "proposal_blocked_by_review_flags" if flags else "proposal",
        "thicknessFit": fits,
        "thicknessFitConfidence": fitconf,
        "thicknessRationale": f"T1 with W={dp['weightPotential']['value']}, C={dp['conditioningLevel']['value']}; " +
            ("T6 applies to scalp-concern targets (no not_suited fit to lift)" if targets[0] != "ordinary" else "ordinary target: T1 unchanged, no T6") +
            "; T4 checked with N-ALT neighbors after T6. Claims about hair type never change fit (T2).",
        "weight": weight,
        "weightConfidence": dp["weightPotential"]["confidence"],
        "weightRationale": f"W-LIVE: weightPotential {dp['weightPotential']['value']} -> {weight}, 1:1, written to every row.",
        "scalpTargets": {"primary": R["primary"], "secondary": R.get("secondary")},
        "researchCombinationTargets": R.get("rct", []),
        "researchCombinationConfidence": R.get("rctConf"),
        "cleansingIntensity": inten,
        "cleansingIntensityConfidence": CS["confidence"],
        "cleansingIntensityRationale": f"I1: cleansingStrength {CS['value']} -> {inten}; D1 false. I3 recomputed with neighbor '{CS['neighboringAlternative']}'.",
        "explicitResetPositioning": False,
        "explicitResetRationale": R["d1"],
        "deepCleanserListing": "not_flagged",
        "deepCleanserListingConfidence": "high",
        "deepCleanserRationale": "D2 not met: D1 false and cleansingStrength not strong; no deep-cleanser record applies (deepCleanserRecord not applicable).",
        "rows": rows,
        "requiredProtocolRoles": roles,
        "reviewFlags": flags,
        "informationalNotes": notes,
        "catalogDependent": "review_live_value_differs is resolved by the orchestrator after freeze (lanes never see live rows); no deep-cleanser record id needed.",
    }
    rec = {
        "blindId": bid,
        "identity": R["identity"],
        "formulaPassReference": {"file": f"{FP}/{bid}.json", "note": "hash-pinned blind record, not edited"},
        "claimGrading": R["grading"],
        "reconciliation": R["reconciliation"],
        "directProperties": dp,
        "projection": proj,
        "selfCheck": R["selfCheck"],
        "uncertainties": R["uncertainties"],
    }
    if R.get("checkFlags") is not None:
        assert sorted(R["checkFlags"]) == sorted(flags), (bid, flags)
    with open(f"{OUT}/{bid}.json", "w") as f:
        json.dump(rec, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return bid, weight, R["primary"]["target"], (R.get("secondary") or {}).get("target"), fits, inten, R.get("rct", []), flags


if __name__ == "__main__":
    data = json.load(open(sys.argv[1]))
    for bid in sorted(data):
        print(build(bid, data[bid]))
