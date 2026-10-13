"""Lane B, batch T4 - Phase 1 blind formula pass writer.
Judgments are authored by hand below (standard v1.6, sections 3.1, 4-6, 10, 11, 13.3 E3/E4);
this script only assembles and writes the JSON records."""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FORM = os.path.join(ROOT, "formula")
OUT = os.path.join(ROOT, "out", "formula-pass")
os.makedirs(OUT, exist_ok=True)

COMFORT = {"panthenol", "allantoin", "bisabolol", "urea", "polidocanol", "dipotassium glycyrrhizate",
           "avena sativa kernel extract", "avena sativa kernel flour", "niacinamide"}
HUMREF = {"glycerin", "urea", "sorbitol", "panthenol", "sodium pca", "sodium lactate", "betaine",
          "sodium hyaluronate", "glyceryl oleate", "peg-7 glyceryl cocoate", "glyceryl cocoate"}
PAYLOAD_PLANT = {"cocos nucifera (coconut) oil", "prunus armeniaca (apricot) kernel oil",
                 "butyrospermum parkii butter / shea butter", "hydrogenated castor oil"}
COOLING = {"menthol", "menthyl lactate", "menthoxypropanediol", "mentha arvensis leaf oil"}
PRES = ["sodium benzoate", "potassium sorbate", "phenoxyethanol", "benzyl alcohol",
        "methylisothiazolinone", "methylchloroisothiazolinone", "sodium salicylate"]


def normalize(inci):
    out = []
    i = 0
    while i < len(inci):
        x = inci[i]
        # ID-2: merge split synonym entries such as 'Aqua (Water' + 'Eau)'
        if x.count("(") > x.count(")") and i + 1 < len(inci):
            x = x + ", " + inci[i + 1]
            i += 1
        out.append(x)
        i += 1
    return out


def prominence_cut(norm):
    low = [n.lower() for n in norm]
    for i, n in enumerate(low):
        if n.startswith("parfum") or n.startswith("fragrance"):
            return i + 1, f"Parfum/Fragrance at {i+1}"
    for i, n in enumerate(low):
        if any(n.startswith(p) for p in PRES):
            return i + 1, f"no Parfum declared; first listed preservative {norm[i]} at {i+1}"
    return 1, "no marker; nothing prominent"


def scalp_formula_half(norm, cut):
    low = [n.lower() for n in norm]
    comfort, hum, cool = [], [], []
    for i, n in enumerate(low):
        pos = i + 1
        prom = pos < cut
        if n in COMFORT:
            comfort.append({"ingredient": norm[i], "position": pos, "prominent": prom})
        if n in HUMREF or n in PAYLOAD_PLANT:
            hum.append({"ingredient": norm[i], "position": pos, "prominent": prom})
        if n in COOLING:
            cool.append({"ingredient": norm[i], "position": pos, "prominent": prom})
    pc = [c for c in comfort if c["prominent"]]
    ph = [h for h in hum if h["prominent"]]
    return {
        "e4ComfortRoutes": comfort,
        "e4HumectantRefattingRoutes": hum,
        "coolingAgents": cool,
        "promComfortRoute": bool(pc),
        "promHumectantRoute": bool(ph),
        "csaFormulaHalf": bool(pc or ph),
    }


def P(value, conf, rationale, counter, neighbor, rule=None, **kw):
    d = {"value": value, "confidence": conf, "rationale": rationale, "counterSignal": counter,
         "neighboringAlternative": neighbor}
    if rule:
        d["rulesApplied"] = rule
    d.update(kw)
    return d


def write(bid, cs, cl, wp, facts, surf, unresolved=None, focus_note="", extra_unc=None):
    pkt = json.load(open(os.path.join(FORM, bid + ".json")))
    norm = normalize(pkt["canonicalInci"])
    cut, marker = prominence_cut(norm)
    # verify every cited position matches the normalized list
    for f in facts:
        assert norm[f["position"] - 1].lower() == f["ingredient"].lower(), (bid, f, norm[f["position"] - 1])
    sh = scalp_formula_half(norm, cut)
    low = [n.lower() for n in norm]
    dandr = [ (norm[i], i + 1) for i, n in enumerate(low) if n in ("piroctone olamine", "climbazole")]
    rec = {
        "blindId": bid,
        "inciFingerprintSha256": pkt["inciFingerprintSha256"],
        "phase": "blind_formula_pass",
        "identity": {"packSize": pkt["packSize"], "formulaSourceTier": pkt["formulaSourceTier"],
                     "formulaCompleteness": pkt["formulaCompleteness"],
                     "identityConfidence": pkt["identityConfidence"]},
        "normalization": ("ID-2 applied; normalized one-based positions; " +
                          ("split entries merged: " + "; ".join(n for n in norm if "," in n and "(" in n)
                           if len(norm) != len(pkt["canonicalInci"]) else "no split entries; raw positions = normalized positions")),
        "normalizedInciCount": len(norm),
        "e3ProminenceMarker": marker,
        "prominentThroughPosition": cut - 1,
        "surfactantArchitecture": surf,
        "directProperties": {
            "cleansingStrength": cs,
            "conditioningLevel": cl,
            "weightPotential": wp,
            "focusPrimary": {"value": "general", "confidence": "low", "provisional": True,
                             "rationale": "Provisional only: focus needs exact-product claims (7.2); blind default is the honest fallback `general`. " + focus_note,
                             "neighboringAlternative": "scalp_active" if dandr else "moisture"},
            "focusSecondary": {"value": [], "confidence": "low", "provisional": True,
                               "rationale": "Provisional: secondary requires distinct exact-product positioning (Section 8); none visible blind."},
            "usageRole": {"value": "regular", "confidence": "low", "provisional": True,
                          "rationale": "Provisional default `regular` (Section 9); triggers need graded claims. " +
                          ("`treatment` possible after unblind if a qualifying dandruff claim exists (U3)." if dandr else "") +
                          (" `alternating` impossible: cleansingStrength is not strong." if cs["value"] != "strong" else "")},
            "scalpComfortTarget": {"value": "not_targeted", "confidence": "low", "provisional": True,
                                   "rationale": "Provisional: positioning half (SC1) hidden until unblind. CSA formula half is " +
                                   ("met" if sh["csaFormulaHalf"] else "NOT met (no prominent E4 comfort or humectant/refatting route)") + ".",
                                   "csaFormulaHalf": sh["csaFormulaHalf"]},
            "dandruffSupport": {"value": "supported" if dandr else "not_supported", "confidence": "high",
                                "rationale": ("Complete INCI contains " + ", ".join(f"{a} ({p})" for a, p in dandr) + " (Section 11)."
                                              if dandr else "Complete INCI contains neither Piroctone Olamine nor Climbazole (Section 11)."),
                                "neighboringAlternative": "none"},
        },
        "scalpGateFormulaFacts": sh,
        "formulaFacts": facts,
        "unresolvedMaterialIngredients": unresolved or [],
        "uncertainties": extra_unc or [],
    }
    with open(os.path.join(OUT, bid + ".json"), "w") as fh:
        json.dump(rec, fh, indent=2, ensure_ascii=False)
    print("wrote", bid)


def F(ing, pos, role):
    return {"ingredient": ing, "position": pos, "role": role}


def W(value, conf, neighbor, dep, per, res, families, excluded, why, whynot, limiting, counter, rule=None):
    return {"value": value, "confidence": conf,
            "rationale": why,
            "subjudgments": {"depositionLoad": dep, "persistence": per, "resetCapacity": res},
            "evidenceByFamily": families, "excludedEvidence": excluded, "unresolved": [],
            "counterSignal": counter, "whyThisBand": why, "whyNotNeighborBand": whynot,
            "confidenceLimitingFactor": limiting, "neighboringAlternative": neighbor,
            "rulesApplied": rule or ["6.5", "6.6"]}


exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "phase1_data.py")).read())
