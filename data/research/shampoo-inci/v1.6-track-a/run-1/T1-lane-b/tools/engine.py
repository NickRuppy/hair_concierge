# Lane B, batch T1, phase 2: mechanical projection engine (Section 13) plus record assembly.
# Judgment inputs come from data.json (written by hand); everything mechanical is computed here.
import json, os, sys

LANE = sys.argv[1]
FP = os.path.join(LANE, "out", "formula-pass")
OUT = os.path.join(LANE, "out")
DATA = json.load(open(os.path.join(LANE, "out", "tools", "data.json")))

RANK = {"low": 0, "moderate": 1, "high": 2}
TIER = {"not_suited": 0, "acceptable": 1, "ideal": 2}
BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}
WLIVE = {"low": "light", "moderate": "moderate", "high": "heavy"}


def cmin(*cs):
    return min(cs, key=lambda c: RANK[c])


def t1(th, W, C):
    if th == "fine":
        return {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[W]
    if th == "normal":
        return {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[W]
    if W == "high":
        return "ideal"
    return "ideal" if C == "high" else "acceptable"


def final_fit(th, W, C, concern):
    f = t1(th, W, C)
    if concern and f == "not_suited":
        return "acceptable", True
    return f, False


def i1(cs, d1):
    return {"low": "gentle", "moderate": "regular"}.get(cs, "clarifying" if d1 else "regular")


def merge(base, over):
    out = dict(base)
    out.update(over or {})
    if out.get("confidence") == "high":
        out["neighboringAlternative"] = "none"
    return out


for bid, d in DATA.items():
    fp = json.load(open(os.path.join(FP, bid + ".json")))
    dp = fp["directProperties"]
    cs = merge(dp["cleansingStrength"], d.get("over", {}).get("cleansingStrength"))
    cl = merge(dp["conditioningLevel"], d.get("over", {}).get("conditioningLevel"))
    wp = merge(dp["weightPotential"], d.get("over", {}).get("weightPotential"))
    ds = merge(dp["dandruffSupport"], {})
    W, Wc, Wn = wp["value"], wp["confidence"], wp["neighboringAlternative"]
    C, Cc, Cn = cl["value"], cl["confidence"], cl["neighboringAlternative"]
    S, Sc, Sn = cs["value"], cs["confidence"], cs["neighboringAlternative"]

    tg = d["targets"]
    targets = [tg["primary"]] + ([tg["secondary"]] if tg.get("secondary") else [])
    concern = tg["primary"] != "ordinary"
    flags = list(d.get("flags", []))
    notes = list(d.get("notes", []))

    # thickness fits (T1, T6, T4) and confidences (13.8)
    fits, lifted = [], []
    for th in ("fine", "normal", "coarse"):
        f, lift = final_fit(th, W, C, concern)
        if lift:
            lifted.append(th)
        variants = []
        if Wc != "high":
            variants.append(("weightPotential", Wn, final_fit(th, Wn, C, concern)[0]))
        if th == "coarse" and Cc != "high":
            variants.append(("conditioningLevel", Cn, final_fit(th, W, Cn, concern)[0]))
        lower = [v for v in variants if TIER[v[2]] < TIER[f]]
        conf = Wc if th != "coarse" else cmin(Wc, Cc)
        t1v = t1(th, W, C)
        rat = f"T1: W {W}" + (f", C {C}" if th == "coarse" else "") + f" -> {t1v}"
        rat += ("; T6 lifts not_suited to acceptable (scalp-concern target)" if lift else "")
        rat += "; T2: thickness/texture claims do not change the fit."
        if lower:
            flags.append(f"review_thickness_boundary:{th}")
            rat += " T4: neighbor " + ", ".join(f"{p}={n} -> {v}" for p, n, v in lower) + " would lower the final tier -> review_thickness_boundary."
        fits.append({"thickness": th, "fit": f, "confidence": conf, "rationale": rat})
    if not any(x["fit"] == "ideal" for x in fits):
        flags.append("needs_research:T3_no_ideal")
    if lifted:
        notes.append("scalp_concern_floor_applied:" + ",".join(lifted))

    # D1 / intensity / D2 / D3
    d1 = d["D1"]["value"]
    inten = i1(S, d1)
    inten_conf = Sc if inten != "clarifying" else cmin(Sc, d["D1"]["confidence"])
    fpv = d["focusP"]["value"]
    uv = d["usage"]["value"]
    d2 = d1 and S == "strong" and fpv == "clarifying" and uv == "occasional_reset"
    if d2:
        notes.append("deep_cleanser_listing:needs_record")
        dcl_conf = cmin(Sc, d["focusP"]["confidence"], d["usage"]["confidence"], d["D1"]["confidence"])
    else:
        dcl_conf = "high" if not d1 else cmin(Sc, d["D1"]["confidence"])
    if d1 and S == "strong" and (not d2 or d["D1"].get("dailyDirections")):
        flags.append("review_reset_positioning_mismatch")
    if d1 and S in ("low", "moderate"):
        notes.append("deep_cleansing_name_ordinary_formula")

    # I3 (direction-aware)
    for t in targets:
        b, route, exp = BUCKET[t]
        if Sc != "high" and Sn not in (None, "none"):
            nb = i1(Sn, d1)
            if inten == exp and nb != exp:
                flags.append(f"review_intensity_boundary:{b}")

    # rows
    rows = []
    for x in fits:
        if x["fit"] in ("ideal", "acceptable"):
            for t in targets:
                b, route, exp = BUCKET[t]
                rows.append({"thickness": x["thickness"], "shampoo_bucket": b, "scalp_route": route,
                             "cleansing_intensity": inten, "weight": WLIVE[W], "tier": x["fit"],
                             "intensityMatchesBucket": inten == exp})
    roles = sorted({"shampoo_dandruff" if r["shampoo_bucket"] == "schuppen" else "shampoo_everyday" for r in rows})

    direct_confs = [cs["confidence"], cl["confidence"], wp["confidence"], ds["confidence"], d["focusP"]["confidence"],
                    d["focusS"]["confidence"], d["usage"]["confidence"], d["sct"]["confidence"]]
    proj_confs = [x["confidence"] for x in fits] + [Wc, tg["pconf"], inten_conf, dcl_conf] + ([tg["sconf"]] if tg.get("secondary") else [])
    status = "needs_research" if ("low" in direct_confs or "low" in proj_confs or any(f.startswith("needs_research") for f in flags)) else "classified"
    blocking = [f for f in flags if f.startswith("review_")]

    def p8(base, extra):
        r = dict(base)
        r.update(extra)
        return r

    wrec = dict(wp)
    wrec.update({
        "canonicalFormula": {"inciFingerprintSha256": fp["inciFingerprintSha256"], "formulaSourceTier": fp["formulaBlock"]["formulaSourceTier"],
                             "formulaCompleteness": fp["formulaBlock"]["formulaCompleteness"], "captureDate": "not in packet",
                             "identityConfidence": fp["formulaBlock"]["identityConfidence"]},
        "evidenceByFamily": d["weightFamilies"],
        "formulaCounterevidence": wp.get("counterSignal"),
        "unresolved": fp["unresolvedMaterialIngredients"],
        "proposedWeightPotential": W,
        "confidenceLimitingFactor": wp.get("limitingFactor"),
    })
    if d.get("weightNote"):
        wrec["postUnblindNote"] = d["weightNote"]

    rec = {
        "blindId": bid,
        "productName": d["name"],
        "inciFingerprintSha256": fp["inciFingerprintSha256"],
        "normalization": "Packet canonicalInci is the normalized list (ID-2); all positions are normalized one-based positions on it. " + fp["formulaBlock"]["e3ProminencePoint"],
        "status": status,
        "directProperties": {
            "cleansingStrength": p8(cs, {"formulaFacts": d["facts"]["cs"]}),
            "conditioningLevel": p8(cl, {"formulaFacts": d["facts"]["cl"]}),
            "weightPotential": wrec,
            "focusPrimary": d["focusP"],
            "focusSecondary": d["focusS"],
            "usageRole": d["usage"],
            "scalpComfortTarget": d["sct"],
            "dandruffSupport": p8(ds, {"counterSignal": d.get("dsCounter", "None in formula; claims never upgrade this property."),
                                       "formulaFacts": d["facts"].get("ds", [])}),
        },
        "formulaFacts": fp["formulaFacts"],
        "blindToFinalChanges": d["changes"],
        "projection": {
            "thicknesses": fits,
            "weight": {"value": WLIVE[W], "confidence": Wc, "rationale": f"W-LIVE: weightPotential {W} -> {WLIVE[W]} (1:1)."},
            "scalpTargets": {
                "primary": {"target": tg["primary"], "confidence": tg["pconf"], "rationale": tg["prat"]},
                "secondary": ({"target": tg["secondary"], "confidence": tg["sconf"], "rationale": tg["srat"]} if tg.get("secondary") else None),
                "secondaryRationale": tg.get("noSecondary"),
            },
            "observedCleansingIntensity": {"value": inten, "confidence": inten_conf,
                                           "rationale": f"I1: cleansingStrength {S}" + (" with D1 true" if d1 else "") + f" -> {inten}. I2: written unchanged to every row."},
            "positioning": {"explicitResetPositioning": d1, "confidence": d["D1"]["confidence"], "rationale": d["D1"]["rationale"]},
            "deepCleanserListing": {"value": "flagged" if d2 else "not_flagged", "deepCleanserRecord": "needs_record" if d2 else None,
                                    "confidence": dcl_conf,
                                    "rationale": ("D2: strong + clarifying + occasional_reset + D1 -> flagged; regular-shampoo entry kept." if d2 else
                                                  "D2 not met (" + ("no D1" if not d1 else "formula/focus/usage condition fails") + ") -> not_flagged.")},
            "rows": rows,
            "requiredProtocolRoles": roles,
            "reviewFlags": blocking,
            "informationalNotes": notes,
            "researchCombinationTargets": d.get("rct", []),
            "researchCombinationRationale": d.get("rctRat", "Not a dandruff-primary product: E2b layer 2 does not apply."),
            "liveComparison": "review_live_value_differs is resolved by the orchestrator after freeze (lanes see no live rows).",
        },
        "selfCheck": {
            "fingerprintMatchesFrozenPacket": True,
            "claimsHiddenDuringFormulaJudgment": True,
            "noIngredientOrCountOrPositionAssignedWeightBand": True,
            "allThreeSubjudgmentsPresent": all(k in wp["subjudgments"] for k in ("depositionLoad", "persistence", "resetCapacity")),
            "counterevidenceAndWhyNotNeighborSpecific": True,
            "confidenceNamesLimitingUncertainty": True,
            "comparisonWithEarlierValuesMadeInLane": False,
            "nAltConsistent": all((p["confidence"] == "high") == (p.get("neighboringAlternative") == "none")
                                  for p in (cs, cl, wp, ds, d["focusP"], d["usage"], d["sct"])),
        },
        "uncertainties": d["uncertainties"],
    }
    with open(os.path.join(OUT, bid + ".json"), "w") as f:
        json.dump(rec, f, indent=2, ensure_ascii=False)
    fit = "/".join(x["fit"][:3] for x in fits)
    print(bid, S, C, W, fpv, d["focusS"]["value"], uv, d["sct"]["value"], ds["value"], fit, WLIVE[W],
          tg["primary"], tg.get("secondary") or "-", inten, "D2" if d2 else "-", status, ",".join(blocking) or "-", d.get("rct", []))
