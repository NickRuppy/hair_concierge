"""Lane-a phase-2 builder: merges reconciliation decisions onto own formula-pass records
and derives the Section 13 projection mechanically. Reads only own formula-pass files by exact path."""
import json, sys, copy

BASE = "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-a/out"
ORDER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
CONF = {"low": 0, "moderate": 1, "high": 2}
BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}
WMAP = {"low": "light", "moderate": "moderate", "high": "heavy"}


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


def intensity(cs, d1):
    if cs == "low":
        return "gentle"
    if cs == "moderate":
        return "regular"
    return "clarifying" if d1 else "regular"


def minconf(*cs):
    return min(cs, key=lambda c: CONF[c])


def build(bid, spec):
    fp = json.load(open(f"{BASE}/formula-pass/{bid}.json"))
    dp = copy.deepcopy(fp["directProperties"])
    # strip blind-only markers
    for k in dp:
        dp[k].pop("provisional", None)
    # formula properties: add counter-signal; values unchanged unless spec overrides
    for k in ("cleansingStrength", "conditioningLevel"):
        dp[k]["counterSignal"] = spec["counter"][k]
    dp["weightPotential"]["counterSignal"] = dp["weightPotential"]["counterevidence"]
    for k, v in spec["props"].items():
        dp[k] = {**dp[k], **v}
    fpr = dp["focusPrimary"]
    if "careDirectionVerdictFinal" in fpr:
        fpr["careDirection"]["verdict"] = fpr.pop("careDirectionVerdictFinal")
        fpr["careDirection"]["limitation"] = fpr["careDirection"]["limitation"].replace("Blind: no claim seen; ", "Formula-pass note: ")
    dp["dandruffSupport"]["counterSignal"] = spec["counter"].get("dandruffSupport", "none (mechanical recognition, Section 11)")

    W = dp["weightPotential"]["value"]; Wc = dp["weightPotential"]["confidence"]; Wn = dp["weightPotential"]["neighboringAlternative"]
    C = dp["conditioningLevel"]["value"]; Cc = dp["conditioningLevel"]["confidence"]; Cn = dp["conditioningLevel"]["neighboringAlternative"]
    CS = dp["cleansingStrength"]["value"]; CSc = dp["cleansingStrength"]["confidence"]; CSn = dp["cleansingStrength"]["neighboringAlternative"]

    prim = spec["primary"]; sec = spec.get("secondary")
    targets = [prim["target"]] + ([sec["target"]] if sec else [])
    concern = prim["target"] != "ordinary"
    flags = list(spec.get("extraFlags", []))
    notes = list(spec.get("notes", []))

    fits, fitconf, t4 = {}, {}, []
    for th in ("fine", "normal", "coarse"):
        raw = t1(th, W, C)
        fin = t6(raw, concern)
        if concern and raw == "not_suited":
            notes.append(f"scalp_concern_floor_applied:{th}")
        fits[th] = fin
        fitconf[th] = minconf(Wc, Cc) if th == "coarse" else Wc
        alts = []
        if Wn != "none":
            alts.append(("weightPotential", t6(t1(th, Wn, C), concern)))
        if th == "coarse" and Cn != "none":
            alts.append(("conditioningLevel", t6(t1(th, W, Cn), concern)))
        for prop, alt in alts:
            if ORDER[alt] < ORDER[fin]:
                t4.append(f"review_thickness_boundary:{th} ({prop} neighbor -> {alt})")
    flags += t4

    d1 = spec.get("d1", False)
    inten = intensity(CS, d1)
    i3 = []
    if CSn != "none":
        nint = intensity(CSn, d1)
        for t in targets:
            exp = BUCKET[t][2]
            if inten == exp and nint != exp:
                i3.append(f"review_intensity_boundary:{BUCKET[t][0]} (cleansingStrength neighbor {CSn} -> {nint})")
    flags += i3

    fpv = dp["focusPrimary"]["value"]; fsv = dp["focusSecondary"]["value"]
    focusset = set([fpv] + list(fsv))
    if any(t in ("dandruff", "sensitive", "dry") for t in targets) and "scalp_active" not in focusset:
        flags.append("review_focus_target_mismatch (specialist target without scalp_active focus)")
    if "oily" in targets and "clarifying" not in focusset:
        flags.append("review_focus_target_mismatch (oily target without clarifying focus)")
    if "scalp_active" in focusset and prim["target"] == "ordinary" and not any(f.startswith("review_specialist_gate_failed") for f in flags):
        flags.append("review_focus_target_mismatch (scalp_active focus with unexplained ordinary target)")
    if CS == "strong" and any(t in ("sensitive", "dry") for t in targets):
        flags.append("review_strong_cleansing_comfort_route")

    UR = dp["usageRole"]["value"]; FP = fpv
    dcl = "flagged" if (CS == "strong" and FP == "clarifying" and UR == "occasional_reset" and d1) else "not_flagged"
    if d1 and CS == "strong" and dcl == "not_flagged":
        flags.append("review_reset_positioning_mismatch")

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
            rows.append({"thickness": th, "shampoo_bucket": b, "scalp_route": r, "cleansing_intensity": inten,
                         "weight": WMAP[W], "tier": fits[th]})
    roles = []
    if any(r["shampoo_bucket"] == "schuppen" for r in rows):
        roles.append("shampoo_dandruff")
    if any(r["shampoo_bucket"] != "schuppen" for r in rows):
        roles.append("shampoo_everyday")

    proj_confs = list(fitconf.values()) + [Wc, prim["confidence"], CSc] + ([sec["confidence"]] if sec else [])
    status = "needs_research" if "low" in proj_confs else ("proposal_blocked_pending_review" if flags else "proposal_ready_no_review_flags")

    thr = (f"T1 from weightPotential {W} ({Wc}, N-ALT {Wn}) and conditioningLevel {C} ({Cc}, N-ALT {Cn}): "
           f"fine {t1('fine', W, C)}, normal {t1('normal', W, C)}, coarse {t1('coarse', W, C)}; "
           + ("T6 scalp-concern floor applies (targets " + ", ".join(targets) + ")" if concern else "ordinary target, no T6")
           + f"; final fine {fits['fine']}, normal {fits['normal']}, coarse {fits['coarse']}. "
           + ("T4: " + "; ".join(t4) if t4 else "T4: no neighbor lowers a final tier.")
           + " T2: thickness/texture claims in the reveal were not used.")

    proj = {
        "status": status,
        "thicknessFit": fits,
        "thicknessFitConfidence": fitconf,
        "thicknessRationale": thr,
        "weight": WMAP[W],
        "weightConfidence": Wc,
        "weightRationale": f"W-LIVE: weightPotential {W} -> weight {WMAP[W]}, 1:1, confidence = weightPotential confidence ({Wc}). Claims never move it (6.5 step 5).",
        "scalpTargets": {"primary": prim, "secondary": sec},
        "researchCombinationTargets": spec.get("rct", []),
        "cleansingIntensity": inten,
        "cleansingIntensityConfidence": CSc,
        "cleansingIntensityRationale": f"I1: cleansingStrength {CS}" + (" with D1 true" if d1 else " with D1 false") + f" -> {inten}. "
            + ("I3: " + "; ".join(i3) if i3 else ("I3: no flag (" + ("cleansingStrength high confidence, neighbor none" if CSn == "none" else "neighbor intensity does not turn a matching bucket into a mismatch, or the bucket is already amber") + ")."))
            + " Bucket expectations: " + ", ".join(f"{BUCKET[t][0]} expects {BUCKET[t][2]}" for t in targets) + ".",
        "explicitResetPositioning": d1,
        "deepCleanserListing": dcl,
        "deepCleanserListingConfidence": minconf(CSc, dp["focusPrimary"]["confidence"], dp["usageRole"]["confidence"]),
        "deepCleanserRationale": spec.get("d1Rationale", "D1 false: no Tiefenreinigung/Deep Clean/Clarifying Shampoo/Detox-Reinigung wording and no occasional-use directions from a manufacturer or pack source; D2 not met -> not_flagged.") ,
        "rows": rows,
        "requiredProtocolRoles": roles,
        "reviewFlags": flags,
        "informationalNotes": notes,
        "catalogDependent": "review_live_value_differs is resolved by the orchestrator against live rows after freeze (lane cannot see the catalog)." + (" deepCleanserRecord: needs_record." if dcl == "flagged" else ""),
    }

    rec = {
        "blindId": bid,
        "identity": {
            "brand": spec["brand"], "productName": spec["productName"], "packSize": fp["identity"]["packSize"],
            "market": "DE", "formulaFingerprintSha256": fp["inciFingerprintSha256"],
            "normalization": fp["identity"]["normalization"], "completeness": fp["identity"]["formulaCompleteness"],
            "formulaSourceTier": fp["identity"]["formulaSourceTier"], "identityConfidence": fp["identity"]["identityConfidence"],
            "e3ProminenceCutoff": fp["identity"]["e3ProminenceCutoff"],
        },
        "normalizedInci": fp["normalizedInci"],
        "directProperties": dp,
        "formulaFacts": fp["formulaFacts"],
        "claimEvidence": spec["claims"],
        "reconciliation": spec["reconciliation"],
        "projection": proj,
        "selfCheck": ("6.11/standard self-check: fingerprint matches the frozen packet and the pinned formula-pass record (not edited); claims were hidden during the "
                      "formula pass; no ingredient, family count or position window assigned the weight band (W-line only gates payload_lipid legs) and the W-line "
                      "was derived from the frozen list with skipped candidates recorded; depositionLoad/persistence/resetCapacity present; whyNotNeighborBand is "
                      "specific; N-ALT follows confidence for every property; claims graded per CL-SRC/E1 and none set cleansing, conditioning, weight, thickness fit "
                      "or a formula gate; projection derived mechanically (T1/T6/T4, W-LIVE, I1/I3, D1-D3, 13.7 rows); no comparison with earlier values was made "
                      "inside the lane."),
        "uncertainties": spec["uncertainties"],
    }
    return rec


if __name__ == "__main__":
    specs = json.load(open(sys.argv[1]))
    for bid, spec in specs.items():
        rec = build(bid, spec)
        with open(f"{BASE}/{bid}.json", "w") as f:
            json.dump(rec, f, ensure_ascii=False, indent=1)
        p = rec["projection"]
        print(bid, p["weight"], p["scalpTargets"]["primary"]["target"], (p["scalpTargets"]["secondary"] or {}).get("target"),
              p["thicknessFit"]["fine"], p["thicknessFit"]["normal"], p["thicknessFit"]["coarse"], p["cleansingIntensity"],
              p["deepCleanserListing"], p["researchCombinationTargets"], p["reviewFlags"], p["informationalNotes"], p["status"])
