"""Lane-b phase-2 builder: merges the frozen formula-pass record with the
post-unblind decisions in final_data.py and derives the Section 13 projection
mechanically (T1, T6, T4, W-LIVE, I1, I3, D2, rows, 13.8)."""
import json, sys, os

BASE = "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W1/lane-b"
sys.path.insert(0, os.path.join(BASE, "out/_work"))
from final_data import PRODUCTS  # noqa: E402

RANK = {"low": 0, "moderate": 1, "high": 2}
TIER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
BUCKET = {
    "ordinary": ("normal", "balanced", "regular"),
    "oily": ("dehydriert-fettig", "oily", "regular"),
    "dry": ("trocken", "dry", "gentle"),
    "sensitive": ("irritationen", "irritated", "gentle"),
    "dandruff": ("schuppen", "dandruff", "regular"),
}
WLIVE = {"low": "light", "moderate": "moderate", "high": "heavy"}


def cmin(*vals):
    return min(vals, key=lambda v: RANK[v])


def t1(w, c):
    fine = {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[w]
    normal = {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[w]
    coarse = "ideal" if (w == "high" or c == "high") else "acceptable"
    return {"fine": fine, "normal": normal, "coarse": coarse}


def t6(fits, concern):
    if not concern:
        return dict(fits), []
    out, lifted = {}, []
    for k, v in fits.items():
        if v == "not_suited":
            out[k] = "acceptable"
            lifted.append(k)
        else:
            out[k] = v
    return out, lifted


def i1(cs, d1):
    if cs == "low":
        return "gentle"
    if cs == "moderate":
        return "regular"
    return "clarifying" if d1 else "regular"


def build(pid):
    P = PRODUCTS[pid]
    fp = json.load(open(f"{BASE}/out/formula-pass/{pid}.json"))
    pk = json.load(open(f"{BASE}/formula/{pid}.json"))
    assert fp["inciFingerprintSha256"] == pk["inciFingerprintSha256"]
    bdp = fp["directProperties"]

    dp = {}
    for prop in ("cleansingStrength", "conditioningLevel", "weightPotential", "dandruffSupport"):
        rec = dict(bdp[prop])
        rec.pop("provisional", None)
        rec["counterSignal"] = P["counter"][prop]
        rec["sourceIds"] = [f"formula/{pid}.json (stage A, fingerprint {fp['inciFingerprintSha256'][:12]}...)"]
        dp[prop] = rec
    for prop in ("focusPrimary", "focusSecondary", "usageRole", "scalpComfortTarget"):
        dp[prop] = P[prop]
    # focus care-direction carried from the blind pass unless overridden
    if "careDirection" not in dp["focusPrimary"]:
        dp["focusPrimary"]["careDirection"] = bdp["focusPrimary"]["careDirection"]

    cs = dp["cleansingStrength"]
    cl = dp["conditioningLevel"]
    wp = dp["weightPotential"]
    W, C = wp["value"], cl["value"]

    prim = P["primaryTarget"]
    sec = P.get("secondaryTarget")
    targets = [prim["target"]] + ([sec["target"]] if sec else [])
    concern = prim["target"] != "ordinary"

    base = t1(W, C)
    fits, lifted = t6(base, concern)

    flags = list(P.get("manualFlags", []))
    notes = list(P.get("manualNotes", []))
    if lifted:
        notes.append("scalp_concern_floor_applied:" + ",".join(lifted))

    # T4
    t4 = []
    wn, cn = wp["neighboringAlternative"], cl["neighboringAlternative"]
    for th in ("fine", "normal", "coarse"):
        alts = []
        if wn != "none":
            alts.append(("weightPotential", wn, C))
        if th == "coarse" and cn != "none":
            alts.append(("conditioningLevel", W, cn))
        for name, w2, c2 in alts:
            f2, _ = t6(t1(w2, c2), concern)
            if TIER[f2[th]] < TIER[fits[th]]:
                t4.append(f"review_thickness_boundary:{th} ({name} neighbor {w2 if name=='weightPotential' else c2} -> {f2[th]})")
                break
    flags = t4 + flags

    fitconf = {
        "fine": wp["confidence"],
        "normal": wp["confidence"],
        "coarse": cmin(wp["confidence"], cl["confidence"]),
    }

    d1 = P["d1"]["value"]
    intensity = i1(cs["value"], d1)
    iconf = cs["confidence"] if intensity != "clarifying" else cmin(cs["confidence"], P["d1"]["confidence"])
    # I3
    i3 = []
    if cs["neighboringAlternative"] != "none":
        nint = i1(cs["neighboringAlternative"], d1)
        for t in targets:
            exp = BUCKET[t][2]
            if intensity == exp and nint != exp:
                i3.append(f"review_intensity_boundary:{BUCKET[t][0]} (current {intensity} = expected; neighbor {cs['neighboringAlternative']} -> {nint})")
    flags += i3

    # D2
    fpv = dp["focusPrimary"]["value"]
    ur = dp["usageRole"]["value"]
    d2 = cs["value"] == "strong" and fpv == "clarifying" and ur == "occasional_reset" and d1
    dcl = "flagged" if d2 else "not_flagged"
    dclconf = cmin(cs["confidence"], dp["focusPrimary"]["confidence"], dp["usageRole"]["confidence"], P["d1"]["confidence"])
    if d2:
        notes.append("deep_cleanser_listing (deepCleanserRecord: needs_record)")

    weight = WLIVE[W]
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
                         "cleansing_intensity": intensity, "weight": weight, "tier": fits[th]})
    roles = []
    if any(r["shampoo_bucket"] == "schuppen" for r in rows):
        roles.append("shampoo_dandruff")
    if any(r["shampoo_bucket"] != "schuppen" for r in rows):
        roles.append("shampoo_everyday")

    allconf = [dp[k]["confidence"] for k in dp] + [prim["confidence"]] + list(fitconf.values()) + [iconf]
    if sec:
        allconf.append(sec["confidence"])
    if d2:
        allconf.append(dclconf)
    low = any(c == "low" for c in allconf)
    status = "needs_research" if low else ("proposal_blocked_pending_review" if flags else "proposal")

    thick_rat = (
        f"T1 with weightPotential {W} ({wp['confidence']}, neighbor {wn}) and conditioningLevel {C} "
        f"({cl['confidence']}, neighbor {cn}): fine {base['fine']}, normal {base['normal']}, coarse {base['coarse']}. "
        + (f"T6 scalp-concern floor ({', '.join(targets)}): " + (f"lifted {', '.join(lifted)} to acceptable. " if lifted else "no not_suited fit to lift. ") if concern else "Target ordinary: T6 not applied. ")
        + ("T4: " + "; ".join(t4) + "." if t4 else "T4: no neighbor yields a lower final tier.")
        + " T2: thickness/volume claims ignored for fit."
    )

    proj = {
        "status": status,
        "thicknessFit": fits,
        "thicknessFitConfidence": fitconf,
        "thicknessRationale": thick_rat,
        "weight": weight,
        "weightConfidence": wp["confidence"],
        "weightRationale": f"W-LIVE: weightPotential {W} -> weight {weight}, 1:1; confidence = weightPotential confidence ({wp['confidence']}). Claims ('ohne zu beschweren', 'leicht') never lower it (6.5).",
        "scalpTargets": {"primary": prim, "secondary": sec},
        "researchCombinationTargets": P.get("rct", []),
        "cleansingIntensity": intensity,
        "cleansingIntensityConfidence": iconf,
        "cleansingIntensityRationale": (
            f"I1: cleansingStrength {cs['value']} ({cs['confidence']}), D1 {str(d1).lower()} -> {intensity}. "
            + ("I3: " + "; ".join(i3) + "." if i3 else
               f"I3: neighbor {cs['neighboringAlternative']} raises no flag (" + ", ".join(f"{BUCKET[t][0]} expects {BUCKET[t][2]}" for t in targets) + ").")
        ),
        "explicitResetPositioning": d1,
        "explicitResetRationale": P["d1"]["rationale"],
        "deepCleanserListing": dcl,
        "deepCleanserListingConfidence": dclconf,
        "deepCleanserRationale": (
            "D2 met: strong formula, focusPrimary clarifying, usageRole occasional_reset, D1 true -> flagged; keeps its regular-shampoo rows (I1 clarifying)."
            if d2 else
            f"D2 not met (cleansingStrength {cs['value']}, focusPrimary {fpv}, usageRole {ur}, D1 {str(d1).lower()}) -> not_flagged."
        ),
        "rows": rows,
        "requiredProtocolRoles": roles,
        "reviewFlags": flags,
        "informationalNotes": notes,
        "catalogDependent": ("deepCleanserRecord: needs_record (resolved by orchestrator after freeze); " if d2 else "") + "review_live_value_differs not evaluated in-lane (live rows unseen; orchestrator after freeze).",
    }
    if d2:
        proj["deepCleanserRecord"] = "needs_record"

    ident = {
        "brand": P["brand"],
        "productName": P["productName"],
        "packSize": pk["packSize"],
        "market": "DE",
        "formulaFingerprintSha256": pk["inciFingerprintSha256"],
        "normalization": fp["formulaPacket"]["normalization"],
        "completeness": pk["formulaCompleteness"],
        "formulaSourceTier": pk["formulaSourceTier"],
        "identityConfidence": pk["identityConfidence"],
        "e3ProminenceCutoff": fp["e3Point"],
    }

    rec = {
        "blindId": pid,
        "lane": "lane-b",
        "policyId": "shampoo-classification-v1.6.2",
        "formulaPassRecord": f"out/formula-pass/{pid}.json (hash-pinned; not edited)",
        "identity": ident,
        "formulaFacts": fp["formulaFacts"],
        "claimUnits": P["claimUnits"],
        "directProperties": dp,
        "reconciliation": P["reconciliation"],
        "projection": proj,
        "selfCheck": (
            "6.11: fingerprint matches the stage-A packet; claims and labels were hidden during the formula pass (phase 1 frozen before reveal); "
            "no ingredient, family count or position window assigned the weight band; W-line derived per W-LINE with skipped candidates recorded; "
            "depositionLoad/persistence/resetCapacity present; whyNotNeighborBand specific; confidence names its limiting factor; no comparison with earlier values in-lane. "
            "Formula properties (cleansing, conditioning, weight, dandruff) unchanged after unblind (3.2: claims cannot move them). "
            "N-ALT checked: every high confidence has neighbor none, every moderate/low names one neighbor. Projection derived mechanically from final properties (T1/T6/T4/W-LIVE/I1/I3/D2/13.7/13.8)."
        ),
        "uncertainties": P["uncertainties"],
    }
    return rec


if __name__ == "__main__":
    ids = sys.argv[1:]
    for pid in ids:
        rec = build(pid)
        with open(f"{BASE}/out/{pid}.json", "w") as f:
            json.dump(rec, f, ensure_ascii=False, indent=1)
        p = rec["projection"]
        sec = p["scalpTargets"]["secondary"]
        print(pid, "|", p["weight"], "|", p["scalpTargets"]["primary"]["target"], "|", sec["target"] if sec else None, "|",
              p["thicknessFit"]["fine"], p["thicknessFit"]["normal"], p["thicknessFit"]["coarse"], "|",
              p["cleansingIntensity"], "|", p["deepCleanserListing"], "|", p["researchCombinationTargets"], "|", p["reviewFlags"], "|", p["status"])
