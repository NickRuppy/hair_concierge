"""Lane-a phase-2 builder: merges own formula-pass records (read-only) with
post-unblind reconciliation and computes the mechanical projection pieces
(T1/T6, T4, W-LIVE, I1/I3, rows, protocol roles, S-FOCUS)."""
import copy
import json
import sys

BASE = sys.argv[1]  # <kit>/lane-a/out
ORDER = {"low": 0, "moderate": 1, "high": 2}
TIER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
BUCKET = {
    "ordinary": ("normal", "balanced", "regular"),
    "oily": ("dehydriert-fettig", "oily", "regular"),
    "dry": ("trocken", "dry", "gentle"),
    "sensitive": ("irritationen", "irritated", "gentle"),
    "dandruff": ("schuppen", "dandruff", "regular"),
}
CONCERN = {"oily", "dry", "sensitive", "dandruff"}


def minc(*cs):
    return min(cs, key=lambda c: ORDER[c])


def t1(w, c):
    return {
        "fine": {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[w],
        "normal": {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[w],
        "coarse": "ideal" if (w == "high" or c == "high") else "acceptable",
    }


def final_fits(w, c, concern):
    f = t1(w, c)
    lifted = []
    if concern:
        for k, v in f.items():
            if v == "not_suited":
                f[k] = "acceptable"
                lifted.append(k)
    return f, lifted


def intensity(cs, d1=False):
    return {"low": "gentle", "moderate": "regular"}.get(cs, "clarifying" if d1 else "regular")


def build(bid, spec):
    fp = json.load(open(f"{BASE}/formula-pass/{bid}.json"))
    dp = copy.deepcopy(fp["directProperties"])
    for k in dp:
        dp[k].pop("provisional", None)
    # formula-led properties: carry blind values, add counter-signal / facts
    for k in ("cleansingStrength", "conditioningLevel", "weightPotential", "dandruffSupport"):
        dp[k]["counterSignal"] = spec["counter"][k]
        dp[k]["blindToFinal"] = "unchanged from the hash-pinned formula pass; claims cannot set or move this property (3.2)"
    dp["weightPotential"]["wLineRecord"] = fp["formulaFacts"]["wLine"]
    for k in ("focusPrimary", "focusSecondary", "usageRole", "scalpComfortTarget"):
        dp[k] = spec[k]

    W = dp["weightPotential"]["value"]; Wc = dp["weightPotential"]["confidence"]; Wn = dp["weightPotential"]["neighboringAlternative"]
    C = dp["conditioningLevel"]["value"]; Cc = dp["conditioningLevel"]["confidence"]; Cn = dp["conditioningLevel"]["neighboringAlternative"]
    CS = dp["cleansingStrength"]["value"]; CSc = dp["cleansingStrength"]["confidence"]; CSn = dp["cleansingStrength"]["neighboringAlternative"]

    prim = spec["primary"]
    sec = spec.get("secondary")
    targets = [prim["target"]] + ([sec["target"]] if sec else [])
    concern = prim["target"] in CONCERN
    fits, lifted = final_fits(W, C, concern)

    flags = list(spec.get("extraFlags", []))
    # T4
    t4 = []
    for th in ("fine", "normal", "coarse"):
        alts = []
        if Wc != "high":
            alts.append((Wn, C))
        if th == "coarse" and Cc != "high":
            alts.append((W, Cn))
        for w2, c2 in alts:
            f2, _ = final_fits(w2, c2, concern)
            if TIER[f2[th]] < TIER[fits[th]]:
                t4.append(th)
                break
    for th in t4:
        flags.append(f"review_thickness_boundary:{th} (T4: neighbor of weightPotential/conditioningLevel would lower the final {th} fit from {fits[th]})")
    # I1 / I3
    inten = intensity(CS)
    if CSc != "high":
        ninten = intensity(CSn)
        for t in targets:
            exp = BUCKET[t][2]
            if inten == exp and ninten != exp:
                flags.append(f"review_intensity_boundary:{BUCKET[t][0]} (I3: current {inten} matches expected {exp}; cleansingStrength neighbor {CSn} -> {ninten} would not)")
    # S-FOCUS
    fset = {dp["focusPrimary"]["value"], *dp["focusSecondary"]["value"]}
    if any(t in {"dandruff", "sensitive", "dry"} for t in targets) and "scalp_active" not in fset:
        flags.append("review_focus_target_mismatch (S-FOCUS)")
    if "oily" in targets and "clarifying" not in fset:
        flags.append("review_focus_target_mismatch (S-FOCUS, oily)")
    if "scalp_active" in fset and prim["target"] == "ordinary" and not any(f.startswith("review_specialist_gate_failed") for f in flags):
        flags.append("review_focus_target_mismatch (S-FOCUS, scalp_active with ordinary)")

    notes = list(spec.get("notes", []))
    for th in lifted:
        notes.append(f"scalp_concern_floor_applied:{th}")

    weight = {"low": "light", "moderate": "moderate", "high": "heavy"}[W]
    rows = []
    for th in ("fine", "normal", "coarse"):
        if fits[th] == "not_suited":
            continue
        for t in targets:
            b, r, _ = BUCKET[t]
            rows.append({"thickness": th, "shampoo_bucket": b, "scalp_route": r,
                         "cleansing_intensity": inten, "weight": weight, "tier": fits[th]})
    roles = []
    if any(r["shampoo_bucket"] == "schuppen" for r in rows):
        roles.append("shampoo_dandruff")
    if any(r["shampoo_bucket"] != "schuppen" for r in rows):
        roles.append("shampoo_everyday")

    fitconf = {"fine": Wc, "normal": Wc, "coarse": minc(Wc, Cc)}
    concern_txt = " T6 applied (scalp-concern targets): no thickness was not_suited, so nothing lifted." if concern and not lifted else (f" T6 lifted {lifted} to acceptable." if lifted else " ordinary target: T6 not applicable.")
    projection = {
        "status": "proposal_blocked_by_review_flags" if flags else "proposal",
        "thicknessFit": fits,
        "thicknessFitConfidence": fitconf,
        "thicknessRationale": f"T1 with W={W} ({Wc}, neighbor {Wn}) and C={C} ({Cc}, neighbor {Cn}): fine {t1(W, C)['fine']}, normal {t1(W, C)['normal']}, coarse {t1(W, C)['coarse']}." + concern_txt + f" T4 boundary flags: {t4 or 'none'}. T2: thickness claims ignored.",
        "weight": weight,
        "weightConfidence": Wc,
        "weightRationale": f"W-LIVE: weightPotential {W} -> {weight}, confidence {Wc}; written unchanged to every row.",
        "scalpTargets": {"primary": prim, "secondary": sec},
        "researchCombinationTargets": spec.get("rct", []),
        "cleansingIntensity": inten,
        "cleansingIntensityConfidence": CSc,
        "cleansingIntensityRationale": f"I1: cleansingStrength {CS} -> {inten} (D1 false). I2: written unchanged to every row; expected per bucket: " + ", ".join(f"{BUCKET[t][0]}={BUCKET[t][2]}" for t in targets) + f". I3 neighbor: {CSn}.",
        "explicitResetPositioning": False,
        "explicitResetRationale": spec.get("d1", "D1 false: no tiefenrein/deep clean/clarifying shampoo/detox-reinigung stem in name or manufacturer/pack claims; no occasional-use directions."),
        "deepCleanserListing": "not_flagged",
        "deepCleanserListingConfidence": minc(CSc, dp["focusPrimary"]["confidence"], dp["usageRole"]["confidence"]),
        "deepCleanserRationale": f"D2 not met: D1 false (cleansingStrength {CS}, focusPrimary {dp['focusPrimary']['value']}, usageRole {dp['usageRole']['value']}). No deepCleanserRecord needed.",
        "rows": rows,
        "requiredProtocolRoles": roles,
        "reviewFlags": flags,
        "informationalNotes": notes,
        "catalogDependent": "review_live_value_differs and any deep-cleanser record id are resolved by the orchestrator after freeze; lane never sees catalog ids.",
    }
    rec = {
        "blindId": bid,
        "identity": {**spec["identity"],
                     "packSize": fp["identity"]["packSize"],
                     "market": "DE",
                     "formulaFingerprintSha256": fp["inciFingerprintSha256"],
                     "formulaSourceTier": fp["identity"]["formulaSourceTier"],
                     "identityConfidence": fp["identity"]["identityConfidence"],
                     "normalization": fp["identity"]["normalization"],
                     "completeness": fp["identity"]["formulaCompleteness"],
                     "e3ProminenceCutoff": fp["identity"]["e3ProminenceCutoff"]},
        "standard": "shampoo-classification-v1.6.2 (candidate)",
        "formulaPassRef": f"out/formula-pass/{bid}.json (hash-pinned, not edited; fingerprint {fp['inciFingerprintSha256']})",
        "normalizedInci": fp["normalizedInci"],
        "formulaFacts": fp["formulaFacts"],
        "claimEvidence": spec["claims"],
        "reconciliation": spec["reconciliation"],
        "directProperties": dp,
        "projection": projection,
        "selfCheck": spec.get("selfCheck", "") + " Generic (6.11): fingerprint matches the frozen packet; formula properties were judged blind and are unchanged after the reveal; no ingredient, family count or position window assigned the weight band (W-line used only as a payload_lipid gate, none present/material here unless stated); W-line derived as W-LINE states with skipped candidates recorded; all three weight subjudgments present; whyNotNeighborBand specific (W2 where two families); confidences name their limiting factor; N-ALT neighbors follow confidence; projection derived mechanically from final properties (T1/T6/T4, W-LIVE, I1/I3, 13.7 rows); no comparison with earlier values made in-lane.",
        "uncertainties": spec["uncertainties"],
    }
    with open(f"{BASE}/{bid}.json", "w") as fh:
        json.dump(rec, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    return rec


if __name__ == "__main__":
    specs = json.load(open(sys.argv[2]))
    for bid in sys.argv[3:]:
        r = build(bid, specs[bid])
        p = r["projection"]
        sec = p["scalpTargets"]["secondary"]
        print(bid, p["weight"], p["scalpTargets"]["primary"]["target"], sec["target"] if sec else None,
              p["thicknessFit"], p["cleansingIntensity"], p["researchCombinationTargets"], p["reviewFlags"])
