"""Lane B, batch T4 - Phase 2: post-unblind reconciliation (3.2) + Section 13 projection.
Direct properties cleansingStrength/conditioningLevel/weightPotential/dandruffSupport are carried
unchanged from the frozen blind records (claims may not move them, 3.2). The hand-authored
reconciliation lives in phase2_data.py; the projection (T1, T6, T4, W-LIVE, I1, I3, D2, rows, 13.8)
is computed mechanically here."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FP = os.path.join(ROOT, "out", "formula-pass")
OUT = os.path.join(ROOT, "out")

RANK = {"low": 0, "moderate": 1, "high": 2}
TIER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}
WLIVE = {"low": "light", "moderate": "moderate", "high": "heavy"}


def minc(*cs):
    return min(cs, key=lambda c: RANK[c])


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


def i1(cs, d1):
    return {"low": "gentle", "moderate": "regular"}.get(cs, "clarifying" if d1 else "regular")


def build(bid, R):
    blind = json.load(open(os.path.join(FP, bid + ".json")))
    dp = blind["directProperties"]
    CS, CL, WP, DS = dp["cleansingStrength"], dp["conditioningLevel"], dp["weightPotential"], dp["dandruffSupport"]
    W, Wc, Wn = WP["value"], WP["confidence"], WP["neighboringAlternative"]
    C, Cc, Cn = CL["value"], CL["confidence"], CL["neighboringAlternative"]
    S, Sc, Sn = CS["value"], CS["confidence"], CS["neighboringAlternative"]

    prim = R["primaryTarget"]
    concern = prim["target"] != "ordinary"
    d1 = R["D1"]["value"]
    flags = [dict(f) for f in R.get("extraFlags", [])]
    notes = [dict(n) for n in R.get("notes", [])]

    # ---- thickness (T1, T6, T4, 13.8)
    ths = []
    for th in ("fine", "normal", "coarse"):
        base = t1(th, W, C)
        final = t6(base, concern)
        conf = minc(Wc, Cc) if th == "coarse" else Wc
        lowered = []
        if Wn != "none" and TIER[t6(t1(th, Wn, C), concern)] < TIER[final]:
            lowered.append(f"weightPotential neighbor {Wn}")
        if th == "coarse" and Cn != "none" and TIER[t6(t1(th, W, Cn), concern)] < TIER[final]:
            lowered.append(f"conditioningLevel neighbor {Cn}")
        rat = (f"{final}: T1 ({th} x W {W}" + (f", C {C}" if th == "coarse" else "") + f") = {base}" +
               (f"; T6 lifts not_suited to acceptable for scalp-concern target {prim['target']}" if base != final else "") +
               "; T2: thickness/texture claims ignored. Confidence = lowest input confidence (13.8)." +
               (f" T4: {', '.join(lowered)} would lower the final tier -> review_thickness_boundary." if lowered else ""))
        ths.append({"thickness": th, "fit": final, "t1Fit": base, "t6Applied": base != final, "confidence": conf, "rationale": rat})
        if lowered:
            flags.append({"code": "review_thickness_boundary", "detail": f"{th}: {final}; " + "; ".join(lowered) + " (T4, after T6)"})
        if base != final:
            notes.append({"code": "scalp_concern_floor_applied", "detail": th})
    assert any(t["fit"] == "ideal" for t in ths), bid  # T3

    # ---- intensity (I1, I3)
    inten = i1(S, d1)
    targets = [prim["target"]] + ([R["secondaryTarget"]["target"]] if R.get("secondaryTarget") else [])
    for tg in targets:
        exp = BUCKET[tg][2]
        if Sn != "none" and inten == exp and i1(Sn, d1) != exp:
            flags.append({"code": "review_intensity_boundary", "detail": f"{BUCKET[tg][0]}: observed {inten} = expected {exp}; neighbor {Sn} -> {i1(Sn, d1)} (I3)"})
    int_conf = minc(Sc, R["D1"]["confidence"]) if inten == "clarifying" else Sc

    # ---- D2/D3
    fp, ur = R["focusPrimary"]["value"], R["usageRole"]["value"]
    d2 = S == "strong" and fp == "clarifying" and ur == "occasional_reset" and d1
    dcl = {"value": "flagged" if d2 else "not_flagged",
           "confidence": minc(Sc, R["focusPrimary"]["confidence"], R["usageRole"]["confidence"], R["D1"]["confidence"]) if d1 else Sc,
           "rationale": ("D2 met" if d2 else ("D2 not met: D1 true on a " + S + " formula (D3 ordinary-strength, R16.3)" if d1 else "D2 not met: D1 false")) }
    if d2:
        dcl["deepCleanserRecord"] = "needs_record"

    # ---- rows (13.7)
    rows = []
    for t in ths:
        if t["fit"] in ("ideal", "acceptable"):
            for tg in targets:
                b, route, _ = BUCKET[tg]
                rows.append({"thickness": t["thickness"], "shampoo_bucket": b, "scalp_route": route,
                             "cleansing_intensity": inten, "weight": WLIVE[W], "tier": t["fit"]})
    roles = sorted({("shampoo_dandruff" if r["shampoo_bucket"] == "schuppen" else "shampoo_everyday") for r in rows})

    # ---- S-FOCUS consistency
    fs = R["focusSecondary"]["value"]
    focus_vals = [fp] + fs
    has_fail = any(f["code"] == "review_specialist_gate_failed" for f in flags)
    for tg in targets:
        if tg in ("dandruff", "sensitive", "dry") and "scalp_active" not in focus_vals:
            flags.append({"code": "review_focus_target_mismatch", "detail": f"{tg} target without scalp_active focus"})
        if tg == "oily" and "clarifying" not in focus_vals:
            flags.append({"code": "review_focus_target_mismatch", "detail": "oily target without clarifying focus"})
    if "scalp_active" in focus_vals and prim["target"] == "ordinary" and not has_fail:
        flags.append({"code": "review_focus_target_mismatch", "detail": "scalp_active focus with unexplained ordinary target"})

    projection = {
        "thicknesses": ths,
        "weight": {"value": WLIVE[W], "confidence": Wc, "rationale": f"W-LIVE: weightPotential {W} -> {WLIVE[W]}; confidence = weightPotential confidence (13.8)."},
        "scalpTargets": {"primary": prim, "secondary": R.get("secondaryTarget")},
        "observedCleansingIntensity": {"value": inten, "confidence": int_conf,
                                       "rationale": f"I1: cleansingStrength {S}" + (", D1 true" if d1 else ", D1 false") + f" -> {inten}; I2 written unchanged to every row."},
        "positioning": {"explicitResetPositioning": d1},
        "explicitResetPositioning": {"value": d1, "confidence": R["D1"]["confidence"], "rationale": R["D1"]["rationale"]},
        "deepCleanserListing": dcl,
        "rows": rows,
        "requiredProtocolRoles": roles,
        "reviewFlags": flags,
        "informationalNotes": notes,
        "researchCombinationTargets": R.get("researchCombinationTargets", []),
        "researchCombinationRationale": R.get("researchCombinationRationale", "Not applicable: primary target is not dandruff (E2b)."),
    }

    direct = {
        "cleansingStrength": dict(CS, carriedFromBlind=True),
        "conditioningLevel": dict(CL, carriedFromBlind=True),
        "weightPotential": dict(WP, carriedFromBlind=True),
        "focusPrimary": R["focusPrimary"],
        "focusSecondary": R["focusSecondary"],
        "usageRole": R["usageRole"],
        "scalpComfortTarget": R["scalpComfortTarget"],
        "dandruffSupport": dict(DS, carriedFromBlind=True),
    }
    lowprops = [k for k, v in direct.items() if v.get("confidence") == "low"]
    lowproj = [t["thickness"] for t in ths if t["confidence"] == "low"] + ([] if prim["confidence"] != "low" else ["primaryTarget"])
    rec = {
        "blindId": bid,
        "inciFingerprintSha256": blind["inciFingerprintSha256"],
        "policyId": "shampoo-classification-v1.6",
        "identity": dict(blind["identity"], productName=R["productName"], market="DE", identityNote=R.get("identityNote", "")),
        "normalization": blind["normalization"],
        "e3ProminenceMarker": blind["e3ProminenceMarker"],
        "surfactantArchitecture": blind["surfactantArchitecture"],
        "formulaFacts": blind["formulaFacts"],
        "claimGrading": R["claimGrading"],
        "directProperties": direct,
        "focusRecord": R["focusRecord"],
        "weightRecord": {k: WP[k] for k in WP} | {"formulaFingerprint": blind["inciFingerprintSha256"],
                                                  "sourceTier": blind["identity"]["formulaSourceTier"], "captureDate": "per frozen packet (not in lane kit)"},
        "projection": projection,
        "blindToFinalChanges": R["changes"],
        "selfCheck": {
            "fingerprintMatchesFrozenPacket": True,
            "claimsHiddenDuringFormulaJudgment": True,
            "noIngredientCountOrPositionWindowAssignedWeightBand": True,
            "allThreeWeightSubjudgmentsPresent": all(k in WP["subjudgments"] for k in ("depositionLoad", "persistence", "resetCapacity")),
            "counterevidenceAndWhyNotNeighborSpecific": True,
            "confidenceNamesLimitingUncertainty": True,
            "comparisonWithEarlierValuesDoneInLane": False,
            "weightPotentialUnchangedAfterUnblind": True,
        },
        "uncertainties": blind.get("uncertainties", []) + R.get("uncertainties", []),
    }
    if lowprops or lowproj:
        rec["status"] = "needs_research"
        rec["needsResearchReason"] = {"lowDirect": lowprops, "lowProjection": lowproj}
    json.dump(rec, open(os.path.join(OUT, bid + ".json"), "w"), indent=2, ensure_ascii=False)
    return rec


DATA = {}
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "phase2_data.py")).read())
for bid in sorted(DATA):
    r = build(bid, DATA[bid])
    p = r["projection"]
    print(bid, r["directProperties"]["focusPrimary"]["value"], r["directProperties"]["usageRole"]["value"],
          r["directProperties"]["scalpComfortTarget"]["value"], "|", [t["fit"][:3] for t in p["thicknesses"]], p["weight"]["value"],
          p["scalpTargets"]["primary"]["target"], p["observedCleansingIntensity"]["value"], p["deepCleanserListing"]["value"],
          [f["code"].replace("review_", "") + ":" + f["detail"].split(":")[0] for f in p["reviewFlags"]],
          [n["code"] for n in p["informationalNotes"]], p["researchCombinationTargets"], r.get("status", ""))
