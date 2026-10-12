"""Lane-b phase-2 builder: carries frozen blind properties forward and computes the
mechanical projection (T1, T6, T4, W-LIVE, I1, I3, rows, 13.8 confidences).
Per-product reconciliation decisions live in decisions.py (same folder)."""
import json, sys, os, copy

BASE = "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W4/lane-b"
sys.path.insert(0, os.path.join(BASE, "out", "_work"))
from decisions import D  # noqa: E402

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


def lo(*cs):
    return min(cs, key=lambda c: RANK[c])


def t1(w, c, th):
    if th == "fine":
        return {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[w]
    if th == "normal":
        return {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[w]
    if w == "high":
        return "ideal"
    return "ideal" if c == "high" else "acceptable"


def final_fit(w, c, th, concern):
    f = t1(w, c, th)
    if concern and f == "not_suited":
        return "acceptable"
    return f


def intensity(cs, d1):
    return {"low": "gentle", "moderate": "regular"}.get(cs, "clarifying" if d1 else "regular")


def build(bid):
    fp = json.load(open(os.path.join(BASE, "out", "formula-pass", bid + ".json")))
    d = D[bid]
    bp = fp["directProperties"]
    cs, cl, wp = bp["cleansingStrength"], bp["conditioningLevel"], bp["weightPotential"]
    W, Wc, Wn = wp["value"], wp["confidence"], wp["neighboringAlternative"]
    C, Cc, Cn = cl["value"], cl["confidence"], cl["neighboringAlternative"]
    S, Sc, Sn = cs["value"], cs["confidence"], cs["neighboringAlternative"]
    ff = fp["formulaFacts"]

    def carry(prop, counter, extra_rule=None):
        r = {k: prop[k] for k in ("value", "confidence", "neighboringAlternative", "rationale", "ruleIds")}
        r["counterSignal"] = counter
        r["formulaFacts"] = d.get("facts_" + extra_rule, None) if extra_rule else None
        r["blindToFinal"] = "unchanged: formula-only property; claims may not set or move it (3.2)" + (
            "; " + d["recon_" + extra_rule] if ("recon_" + (extra_rule or "")) in d else "")
        return r

    dp = {}
    r = carry(cs, d["cs_counter"], "cs"); r["formulaFacts"] = ff["surfactants"]; dp["cleansingStrength"] = r
    r = carry(cl, d["cl_counter"], "cl"); r["formulaFacts"] = ff["conditioningRoutes"]; dp["conditioningLevel"] = r
    w = copy.deepcopy(wp)
    w.pop("provisional", None)
    w["counterSignal"] = wp["counterevidence"]
    w["formulaFacts"] = ff["wLine"]
    w["identifiers"] = {"formulaFingerprintSha256": fp["inciFingerprintSha256"],
                        "sourceTier": fp["identity"]["formulaSourceTier"],
                        "captureDate": "not stated in the frozen packet"}
    w["blindToFinal"] = "unchanged: weight is formula-only; claims cannot decide the band (6.5 step 5)" + (
        "; " + d["recon_w"] if "recon_w" in d else "")
    dp["weightPotential"] = w

    f = d["focus"]
    dp["focusPrimary"] = {
        "value": f["value"], "confidence": f["conf"], "neighboringAlternative": f["nb"],
        "careDirection": f["care"], "claimRole": f["role"], "counterSignal": f["counter"],
        "decisionTrace": f["trace"], "rationale": f["rat"], "formulaFacts": f.get("facts", f["care"].get("routes", None)),
        "ruleIds": f["rules"],
        "blindToFinal": "provisional general -> " + f["value"] + (" (" + f["why_change"] + ")" if f["value"] != "general" else " (unchanged; " + f.get("why_change", "no in-scope compatible specialist claim") + ")"),
    }
    s = d["sec"]
    dp["focusSecondary"] = {
        "value": s["value"], "confidence": s["conf"], "neighboringAlternative": s["nb"],
        "decisionTrace": s["trace"], "rationale": s["rat"], "counterSignal": s.get("counter", "see decisionTrace"),
        "formulaFacts": s.get("facts", []), "ruleIds": s.get("rules", ["Section 8", "F2", "F3"]),
        "blindToFinal": "provisional [] -> " + json.dumps(s["value"]),
    }
    u = d["usage"]
    dp["usageRole"] = {
        "value": u["value"], "confidence": u["conf"], "neighboringAlternative": u["nb"],
        "triggerCode": u["code"], "triggerEvidence": u["ev"], "losingTriggers": u["losing"],
        "rationale": u["rat"], "counterSignal": u.get("counter", "none beyond losing triggers"),
        "formulaFacts": "cleansingStrength " + S + " (" + Sc + "); dandruffSupport " + bp["dandruffSupport"]["value"],
        "ruleIds": u["rules"], "decisionTrace": u["trace"],
        "blindToFinal": "provisional regular -> " + u["value"],
    }
    t = d["sct"]
    dp["scalpComfortTarget"] = {
        "value": t["value"], "confidence": t["conf"], "neighboringAlternative": t["nb"],
        "rationale": t["rat"], "counterSignal": t["counter"], "formulaFacts": ff["scalpGateFormulaFacts"],
        "csaRoute": t["csa"], "ruleIds": t["rules"],
        "blindToFinal": ("unchanged" if t["value"] == bp["scalpComfortTarget"]["value"] else "changed") + "; " + t["recon"],
    }
    ds = bp["dandruffSupport"]
    dp["dandruffSupport"] = {k: ds[k] for k in ("value", "confidence", "neighboringAlternative", "rationale", "ruleIds")}
    dp["dandruffSupport"]["counterSignal"] = "none (mechanical table, Section 11)"
    dp["dandruffSupport"]["formulaFacts"] = ff["actives"]["dandruffActives"]
    dp["dandruffSupport"]["blindToFinal"] = "unchanged (formula-only)"

    # ---------- projection ----------
    tgt = d["target"]
    prim = tgt["primary"]
    concern = prim != "ordinary"
    fits, t1fits, fconf = {}, {}, {}
    flags, notes = [], list(d.get("notes", []))
    lifted = []
    for th in ("fine", "normal", "coarse"):
        t1fits[th] = t1(W, C, th)
        fits[th] = final_fit(W, C, th, concern)
        if fits[th] != t1fits[th]:
            lifted.append(th)
        fconf[th] = lo(Wc, Cc) if th == "coarse" else Wc
        lower = False
        if Wn != "none" and TIER[final_fit(Wn, C, th, concern)] < TIER[fits[th]]:
            lower = True
        if th == "coarse" and Cn != "none" and TIER[final_fit(W, Cn, th, concern)] < TIER[fits[th]]:
            lower = True
        if lower:
            flags.append("review_thickness_boundary:" + th)
    if lifted:
        notes.append("scalp_concern_floor_applied:" + ",".join(lifted))
    if "ideal" not in fits.values():
        raise SystemExit(bid + " T3 violation")

    d1 = d.get("d1", False)
    inten = intensity(S, d1)
    targets = [prim] + ([tgt["secondary"]] if tgt.get("secondary") else [])
    if Sn != "none":
        for tg in targets:
            b, _, exp = BUCKET[tg]
            if inten == exp and intensity(Sn, d1) != exp:
                flags.append("review_intensity_boundary:" + b)
    flags += d.get("flags", [])
    rows = []
    for th in ("fine", "normal", "coarse"):
        if fits[th] == "not_suited":
            continue
        for tg in targets:
            b, rt, _ = BUCKET[tg]
            rows.append({"thickness": th, "shampoo_bucket": b, "scalp_route": rt,
                         "cleansing_intensity": inten, "weight": WLIVE[W], "tier": fits[th]})
    roles = []
    if any(r["shampoo_bucket"] == "schuppen" for r in rows):
        roles.append("shampoo_dandruff")
    if any(r["shampoo_bucket"] != "schuppen" for r in rows):
        roles.append("shampoo_everyday")
    dcl = d.get("deep", "not_flagged")
    dconf = lo(Sc, f["conf"], u["conf"], *( [d["d1grade"]] if d1 else []))
    inten_conf = lo(Sc, d["d1grade"]) if inten == "clarifying" else Sc
    proj_confs = list(fconf.values()) + [Wc, tgt["conf"], inten_conf, dconf]
    status = "needs_research" if "low" in proj_confs else (
        "proposal_blocked_by_review_flags" if flags else "proposal_ready")

    proj = {
        "status": status,
        "thicknessFitT1": t1fits,
        "thicknessFit": fits,
        "thicknessFitConfidence": fconf,
        "thicknessRationale": d.get("thick_rat", "") + " T1 with W=" + W + " (" + Wc + ", neighbor " + Wn + ") and C=" + C + " (" + Cc + ", neighbor " + Cn + "): fine " + t1fits["fine"] + ", normal " + t1fits["normal"] + ", coarse " + t1fits["coarse"] + "; target " + prim + (" -> T6 floor applies" + (" (lifted: " + ",".join(lifted) + ")" if lifted else " (nothing to lift)") if concern else " -> T6 not applicable (ordinary)") + ". T4 computed from N-ALT neighbors after T6; T2: thickness/texture claims never change fit.",
        "weight": WLIVE[W], "weightConfidence": Wc,
        "weightRationale": "W-LIVE: weightPotential " + W + " projects 1:1 to " + WLIVE[W] + "; confidence = weightPotential confidence.",
        "scalpTargets": {"primary": {"target": prim, "confidence": tgt["conf"], "rationale": tgt["rat"]},
                         "secondary": tgt.get("secondary")},
        "researchCombinationTargets": d.get("rct", []),
        "cleansingIntensity": inten, "cleansingIntensityConfidence": inten_conf,
        "cleansingIntensityRationale": "I1: cleansingStrength " + S + (", D1 true" if d1 else ", D1 false") + " -> " + inten + ". I3: neighbor " + Sn + (" (high confidence, no I3 review)" if Sn == "none" else " -> " + intensity(Sn, d1) + "; flag only where current equals the bucket's expectation and the neighbor would not") + ".",
        "explicitResetPositioning": d1,
        "deepCleanserListing": dcl, "deepCleanserListingConfidence": dconf,
        "deepCleanserRationale": d.get("deep_rat", "D2 not met: D1 false (no D1 lexicon term in name, manufacturer/pack claims or directions); not_flagged."),
        "rows": rows, "requiredProtocolRoles": roles,
        "reviewFlags": flags, "informationalNotes": notes,
        "catalogDependent": "review_live_value_differs and any deep-cleanser record id are resolved by the orchestrator after freeze; lanes never see catalog ids." + (" deepCleanserRecord: needs_record." if dcl == "flagged" else ""),
    }

    idt = fp["identity"]
    rec = {
        "blindId": bid,
        "lane": "lane-b",
        "standard": "shampoo-classification-v1.6.2",
        "identity": {
            "brand": d["brand"], "productName": d["name"], "packSize": idt["packSize"], "market": "DE",
            "formulaFingerprintSha256": fp["inciFingerprintSha256"],
            "normalization": idt["normalization"], "completeness": idt["formulaCompleteness"] + " (packet; source tier " + str(idt["formulaSourceTier"]) + ", identity confidence " + idt["identityConfidence"] + ")",
            "e3ProminenceCutoff": idt["e3ProminenceCutoff"],
        },
        "formulaPassReference": "out/formula-pass/" + bid + ".json (hash-pinned; not edited)",
        "claimEvidence": d["claims"],
        "reconciliation": d["recon"],
        "directProperties": dp,
        "focusRecord": {"careDirection": f["care"], "claimRole": f["role"], "decisionTrace": {
            "primary": f["trace"], "secondary": s["trace"], "usageRole": u["trace"]}},
        "weightRecord": "see directProperties.weightPotential (6.8 fields: evidence by family, wLineRecord/formulaFacts, subjudgments, counterevidence, whyThisBand, whyNotNeighborBand, confidence and limiting factor, neighbor)",
        "projection": proj,
        "unresolvedMaterialIngredients": fp.get("unresolvedMaterialIngredients", []),
        "selfCheck": "6.11: fingerprint " + fp["inciFingerprintSha256"][:12] + "... matches the frozen packet; claims were hidden during the formula pass (formula-pass file hash-pinned before release); no ingredient, family count or position window assigned the weight band; W-line derived per W-LINE with every skipped candidate recorded; three subjudgments present; whyNotNeighborBand specific (W2 where it applies); confidence names its limiting factor; no comparison with earlier values inside the lane. N-ALT: every high confidence has neighbor none, every moderate/low names one neighbor. Projection derived mechanically from final properties; P0 applied where readings were uncertain.",
        "uncertainties": d["unc"],
    }
    out = os.path.join(BASE, "out", bid + ".json")
    with open(out, "w") as fh:
        json.dump(rec, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    sec = tgt.get("secondary")
    return "%s | weight %s | primary %s | secondary %s | fits %s/%s/%s | intensity %s | deepCleanser %s | rct %s | flags %s" % (
        bid, WLIVE[W], prim, sec, fits["fine"], fits["normal"], fits["coarse"], inten, dcl,
        json.dumps(d.get("rct", [])), json.dumps(flags))


if __name__ == "__main__":
    for bid in sys.argv[1:]:
        print(build(bid))
