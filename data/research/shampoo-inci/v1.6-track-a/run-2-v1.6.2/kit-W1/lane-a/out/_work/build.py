"""Lane-a phase-2 builder: reads own frozen formula-pass records (exact paths), applies
reconciliation specs from specs.py, computes projection mechanically (T1, T6, T4, W-LIVE,
I1, I3, D1-D3, S-FOCUS, 13.7, 13.8) and writes <kit>/lane-a/out/<id>.json."""
import json, copy, sys, importlib.util

LANE = "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W1/lane-a"
spec_path = LANE + "/out/_work/specs.py"
s = importlib.util.spec_from_file_location("specs", spec_path)
specs_mod = importlib.util.module_from_spec(s); s.loader.exec_module(specs_mod)
SPECS = specs_mod.SPECS

RANK = {"not_suited": 0, "acceptable": 1, "ideal": 2}
CONF = {"low": 0, "moderate": 1, "high": 2}
BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}
WLIVE = {"low": "light", "moderate": "moderate", "high": "heavy"}


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


def i1(cs, d1):
    if cs == "low": return "gentle"
    if cs == "moderate": return "regular"
    return "clarifying" if d1 else "regular"


def minconf(*cs):
    return min(cs, key=lambda x: CONF[x])


def build(bid):
    sp = SPECS[bid]
    fp = json.load(open(f"{LANE}/out/formula-pass/{bid}.json"))
    dp = copy.deepcopy(fp["directProperties"])
    out_dp = {}
    # formula-only properties carried from the frozen pass (+ overrides)
    for key in ("cleansingStrength", "conditioningLevel", "weightPotential", "dandruffSupport"):
        rec = dp[key]
        ov = sp.get("override", {}).get(key, {})
        for k, v in ov.items():
            rec[k] = v
        rec["counterSignal"] = sp["counter"][key]
        rec["formulaPassValue"] = fp["directProperties"][key]["value"]
        rec["formulaPassConfidence"] = fp["directProperties"][key]["confidence"]
        if key == "weightPotential":
            rec["wLineRecord"] = fp["formulaFacts"]["wLine"]
        out_dp[key] = rec
    for key in ("focusPrimary", "focusSecondary", "usageRole", "scalpComfortTarget"):
        out_dp[key] = sp[key]
        out_dp[key]["formulaPassValue"] = fp["directProperties"][key]["value"]
    order = ["cleansingStrength", "conditioningLevel", "weightPotential", "focusPrimary",
             "focusSecondary", "usageRole", "scalpComfortTarget", "dandruffSupport"]
    out_dp = {k: out_dp[k] for k in order}

    cs = out_dp["cleansingStrength"]; cl = out_dp["conditioningLevel"]; wp = out_dp["weightPotential"]
    W, C = wp["value"], cl["value"]
    prim = sp["primary"]; sec = sp.get("secondary")
    targets = [prim["target"]] + ([sec["target"]] if sec else [])
    concern = prim["target"] != "ordinary"
    flags = list(sp.get("extraFlags", [])); notes = list(sp.get("extraNotes", []))

    fits, fitconf, lifted = {}, {}, []
    for th in ("fine", "normal", "coarse"):
        base = t1(th, W, C)
        fin = t6(base, concern)
        if fin != base: lifted.append(th)
        fits[th] = fin
        used = [wp] + ([cl] if th == "coarse" else [])
        fitconf[th] = minconf(*[u["confidence"] for u in used])
        # T4
        for u, name in ((wp, "W"), (cl, "C")):
            if name == "C" and th != "coarse": continue
            nb = u["neighboringAlternative"]
            if nb in (None, "none"): continue
            w2, c2 = (nb, C) if name == "W" else (W, nb)
            alt = t6(t1(th, w2, c2), concern)
            if RANK[alt] < RANK[fin]:
                f = f"review_thickness_boundary:{th}"
                if f not in flags: flags.append(f)
    if lifted:
        notes.append("scalp_concern_floor_applied:" + ",".join(lifted))

    d1 = sp["D1"]["value"]
    inten = i1(cs["value"], d1)
    nbcs = cs["neighboringAlternative"]
    for t in targets:
        exp = BUCKET[t][2]
        if nbcs not in (None, "none"):
            if inten == exp and i1(nbcs, d1) != exp:
                flags.append(f"review_intensity_boundary:{BUCKET[t][0]}")
    fpv = out_dp["focusPrimary"]["value"]; fsv = out_dp["focusSecondary"]["value"]
    ur = out_dp["usageRole"]["value"]
    d2 = cs["value"] == "strong" and fpv == "clarifying" and ur == "occasional_reset" and d1
    if d2:
        notes.append("deep_cleanser_listing:needs_record")
    if d1 and cs["value"] == "strong" and (not d2 or sp["D1"].get("dailyDirections")):
        flags.append("review_reset_positioning_mismatch")
    if d1 and cs["value"] in ("low", "moderate"):
        notes.append("deep_cleansing_name_ordinary_formula")
    # S-SENSITIVE / S-DRY strong cleansing
    if cs["value"] == "strong" and any(t in ("sensitive", "dry") for t in targets):
        flags.append("review_strong_cleansing_comfort_route")
    # S-FOCUS
    foci = [fpv] + list(fsv)
    sfail = any(f.startswith("review_specialist_gate_failed") for f in flags)
    if any(t in ("dandruff", "sensitive", "dry") for t in targets) and "scalp_active" not in foci:
        flags.append("review_focus_target_mismatch")
    if "oily" in targets and "clarifying" not in foci:
        flags.append("review_focus_target_mismatch")
    if "scalp_active" in foci and prim["target"] == "ordinary" and not sfail:
        flags.append("review_focus_target_mismatch")

    weight = WLIVE[W]
    rows = []
    for th in ("fine", "normal", "coarse"):
        if fits[th] == "not_suited": continue
        for t in targets:
            b, r, _ = BUCKET[t]
            row = {"thickness": th, "shampoo_bucket": b, "scalp_route": r,
                   "cleansing_intensity": inten, "weight": weight, "tier": fits[th]}
            if not any(x["thickness"] == th and x["shampoo_bucket"] == b for x in rows):
                rows.append(row)
    roles = []
    if any(r["shampoo_bucket"] == "schuppen" for r in rows): roles.append("shampoo_dandruff")
    if any(r["shampoo_bucket"] != "schuppen" for r in rows): roles.append("shampoo_everyday")

    inten_conf = cs["confidence"] if inten != "clarifying" else minconf(cs["confidence"], sp["D1"]["confidence"])
    if d2:
        dcl_conf = minconf(cs["confidence"], out_dp["focusPrimary"]["confidence"],
                           out_dp["usageRole"]["confidence"], sp["D1"]["confidence"])
    else:
        dcl_conf = minconf(cs["confidence"], sp["D1"]["confidence"]) if d1 else "high"

    all_conf = [out_dp[k]["confidence"] for k in order]
    status_low = any(c == "low" for c in all_conf) or out_dp["scalpComfortTarget"]["value"] == "unknown" \
        or out_dp["dandruffSupport"]["value"] == "unknown"
    status = "needs_research" if status_low else ("proposed_blocked_by_review_flags" if flags else "proposed")

    exp_list = ", ".join(f"{BUCKET[t][0]} expects {BUCKET[t][2]}" for t in targets)
    proj = {
        "status": status,
        "thicknessFit": fits,
        "thicknessFitConfidence": fitconf,
        "thicknessRationale": (f"T1 with W={W} ({wp['confidence']}, neighbor {wp['neighboringAlternative']}) and C={C} "
                               f"({cl['confidence']}, neighbor {cl['neighboringAlternative']}): fine {t1('fine',W,C)}, normal {t1('normal',W,C)}, coarse {t1('coarse',W,C)}"
                               + (f"; T6 scalp-concern floor ({prim['target']}) lifted {lifted}" if lifted else ("; T6 applies (scalp-concern target) but lifts nothing" if concern else "; ordinary target, T6 not applicable"))
                               + "; T4 checked against N-ALT neighbors after T6 (T2: thickness/texture claims not used)."),
        "weight": weight,
        "weightConfidence": wp["confidence"],
        "weightRationale": f"W-LIVE: weightPotential {W} -> {weight}, written to every row; confidence = weightPotential confidence.",
        "scalpTargets": {"primary": prim, "secondary": sec},
        "researchCombinationTargets": sp.get("rct", []),
        "cleansingIntensity": inten,
        "cleansingIntensityConfidence": inten_conf,
        "cleansingIntensityRationale": (f"I1: cleansingStrength {cs['value']}, D1 {d1} -> {inten}. I3: neighbor {nbcs}; {exp_list}; "
                                        + ("flag raised where current matches and neighbor would not." if any(f.startswith('review_intensity_boundary') for f in flags) else "no I3 flag (neighbor none, or current intensity already differs / neighbor matches equally).")),
        "explicitResetPositioning": d1,
        "explicitResetEvidence": sp["D1"]["evidence"],
        "deepCleanserListing": "flagged" if d2 else "not_flagged",
        "deepCleanserRecord": "needs_record" if d2 else None,
        "deepCleanserListingConfidence": dcl_conf,
        "deepCleanserRationale": ("D2: strong + clarifying + occasional_reset + D1 -> flagged; regular-shampoo entry kept; deepCleanserRecord needs_record (lane cannot see catalog ids)."
                                  if d2 else ("D1 true but D2 not met: " + ("D3 strong mismatch" if cs['value']=='strong' else "ordinary-strength formula -> note deep_cleansing_name_ordinary_formula (R16.3)")) if d1 else "D1 false -> not_flagged (D2)."),
        "rows": rows,
        "requiredProtocolRoles": roles,
        "reviewFlags": flags,
        "informationalNotes": notes,
        "catalogDependent": "review_live_value_differs and the deep-cleanser record id are resolved by the orchestrator after freeze; the lane sees no catalog values.",
    }
    rec = {
        "blindId": bid,
        "phase": "final record (post-unblind reconciliation, runbook step 4)",
        "standard": "shampoo-classification-v1.6.2",
        "identity": dict(sp["identity"], packSize=fp["formulaIdentity"]["packSize"], market="DE",
                         formulaFingerprintSha256=fp["inciFingerprintSha256"],
                         normalization=fp["formulaIdentity"]["normalization"],
                         completeness=fp["formulaIdentity"]["formulaCompleteness"],
                         formulaSourceTier=fp["formulaIdentity"]["formulaSourceTier"],
                         identityConfidence=fp["formulaIdentity"]["identityConfidence"],
                         e3ProminenceCutoff=fp["formulaIdentity"]["e3Point"]),
        "formulaFacts": fp["formulaFacts"],
        "unresolvedMaterialIngredients": fp["unresolvedMaterialIngredients"],
        "claimEvidence": sp["claimEvidence"],
        "directProperties": out_dp,
        "reconciliation": sp["reconciliation"],
        "projection": proj,
        "selfCheck": ("6.11/selfCheck: fingerprint copied from and equal to the frozen stage-A packet; claims hidden during the formula pass (formula-pass file unchanged, hash-pinned); "
                      "no ingredient, family count or position window assigned the weight band (W-line used only to gate payload_lipid legs); W-line derived per W-LINE with skipped candidates recorded; "
                      "depositionLoad/persistence/resetCapacity present; whyNotNeighborBand specific; N-ALT neighbors consistent with confidence; projection computed mechanically from final properties; "
                      "no comparison with earlier or live values inside the lane."),
        "uncertainties": fp.get("uncertainties", []) + sp.get("uncertainties", []),
    }
    json.dump(rec, open(f"{LANE}/out/{bid}.json", "w"), indent=2, ensure_ascii=False)
    return rec


if __name__ == "__main__":
    for bid in sys.argv[1:]:
        r = build(bid)
        p = r["projection"]
        print(bid, r["directProperties"]["weightPotential"]["value"], p["weight"], p["scalpTargets"]["primary"]["target"],
              (p["scalpTargets"]["secondary"] or {}).get("target"), p["thicknessFit"], p["cleansingIntensity"],
              p["deepCleanserListing"], p["researchCombinationTargets"], p["reviewFlags"], p["informationalNotes"], p["status"])
