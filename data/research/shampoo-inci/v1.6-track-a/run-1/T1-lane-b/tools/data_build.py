# Lane B, batch T1, phase 2: hand-authored post-unblind judgments -> out/tools/data.json
import json, os, sys

LANE = sys.argv[1]
INCI = {}


def inci(bid):
    if bid not in INCI:
        INCI[bid] = json.load(open(os.path.join(LANE, "formula", bid + ".json")))["canonicalInci"]
    return INCI[bid]


def F(bid, name, role):
    L = inci(bid)
    for i, x in enumerate(L, 1):
        if x.lower().replace("*", "") == name.lower():
            return {"ingredient": x, "position": i, "role": role}
    raise KeyError((bid, name))


def fam(bid, **kw):
    return {k: [F(bid, n, r) for n, r in v] for k, v in kw.items()}


def focusP(value, conf, nb, rat, verdict, claimRole, counter, claimDir, compatible, route, reason, facts, mroutes=(), rroutes=(), shared=(), limitation=""):
    return {"value": value, "confidence": conf, "neighboringAlternative": "none" if conf == "high" else nb, "rationale": rat,
            "careDirection": {"verdict": verdict, "moistureRoutes": list(mroutes), "repairRoutes": list(rroutes),
                              "sharedConditioningRoutes": list(shared), "limitation": limitation},
            "claimRole": claimRole, "formulaFacts": facts, "counterSignal": counter,
            "decisionTrace": {"claimDirection": claimDir, "formulaCompatible": compatible, "compatibleRoute": route, "decisionReason": reason}}


def focusS(value, conf, nb, rat, counter, claims=(), routes=(), why="", exc=None):
    return {"value": value, "confidence": conf, "neighboringAlternative": "none" if conf == "high" else nb, "rationale": rat,
            "counterSignal": counter,
            "decisionTrace": {"emptyDefaultConsidered": True, "selected": value, "matchingDistinctClaims": list(claims),
                              "independentRoutes": list(routes), "whyDistinctFromPrimary": why, "exceptionCode": exc}}


def usage(value, conf, nb, rat, counter, code="none", evidence=(), losing=()):
    return {"value": value, "confidence": conf, "neighboringAlternative": "none" if conf == "high" else nb, "rationale": rat,
            "counterSignal": counter,
            "decisionTrace": {"default": "regular", "triggerCode": code, "triggerEvidence": list(evidence),
                              "losingTriggers": list(losing), "rationale": rat}}


def sct(value, conf, nb, rat, counter, facts=()):
    return {"value": value, "confidence": conf, "neighboringAlternative": "none" if conf == "high" else nb,
            "rationale": rat, "counterSignal": counter, "formulaFacts": list(facts)}


def d1(value, conf, rat, daily=False):
    return {"value": value, "confidence": conf, "rationale": rat, "dailyDirections": daily}


NOCHANGE = [{"property": "cleansingStrength/conditioningLevel/weightPotential/dandruffSupport", "blind": "as frozen", "final": "unchanged",
             "evidence": "Claims may not assign or move formula-only properties (3.2, 6.5 step 5).", "reason": "no formula-relevant conflict revealed"}]
PROVFINAL = "focusPrimary/focusSecondary/usageRole/scalpComfortTarget were provisional placeholders in the blind pass; finalized from graded claims below."


def changes(*extra):
    out = [{"property": "provisional properties", "blind": "general/[]/regular/not_targeted (low, provisional)", "final": "see records", "evidence": PROVFINAL, "reason": "post-unblind reconciliation (3.2)"}]
    out += list(extra)
    return out or NOCHANGE


D = {}

# ============================================================ T101 Guhl Hyaluron+ Feuchtigkeits-Shampoo
b = "T101"
D[b] = dict(
    name="Guhl Hyaluron+ Pflege Feuchtigkeits-Shampoo",
    facts=dict(cs=[F(b, "Sodium Laureth Sulfate", "defining anionic (C1)"), F(b, "Coco-Glucoside", "buffer"), F(b, "Cocamidopropyl Betaine", "buffer")],
               cl=[F(b, "Hydrogenated Vegetable Oil", "payload_lipid (W-RICH)"), F(b, "Guar Hydroxypropyltrimonium Chloride", "cationic_polymer"),
                   F(b, "Glyceryl Oleate", "weak_refatter"), F(b, "Glycerin", "humectant"), F(b, "Panthenol", "humectant"), F(b, "Sodium Hyaluronate", "humectant")],
               ds=[F(b, "Piroctone Olamine", "recognized anti-dandruff active")]),
    weightFamilies=fam(b, payload_lipid=[("Hydrogenated Vegetable Oil", "waxy/hydrogenated, prominent")], cationic_polymer=[("Guar Hydroxypropyltrimonium Chloride", "prominent")],
                       weak_refatter=[("Glyceryl Oleate", "light refatter")], reset=[("Sodium Laureth Sulfate", "anionic"), ("Coco-Glucoside", "nonionic"), ("Cocamidopropyl Betaine", "amphoteric")],
                       humectant_context=[("Glycerin", ""), ("Panthenol", ""), ("Hydrolyzed Hyaluronic Acid", ""), ("Sodium Hyaluronate", "")]),
    weightNote="Claims 'ohne zu beschweren' (retailer, low) recorded; they never lower the band (6.5 step 5).",
    focusP=focusP("moisture", "moderate", "general", "Moisture: the exact product name says 'Feuchtigkeits-Shampoo' (high) and the manufacturer page positions it for 'feuchtigkeitsbedürftiges', dry hair (moderate); the formula verdict is moisture_supported (humectant cluster plus emollient/cationic deposition).",
                  "moisture_supported", "candidate", "The deposition route (hydrogenated oil + guar) is generic conditioning; humectants are mid-list (12-18).",
                  "moisture", True, "Glycerin 12 + Panthenol 13 + Sodium Hyaluronate 18 with Hydrogenated Vegetable Oil 6 and Guar 9", "Dominant name claim plus moisture_supported verdict (F1).",
                  [F(b, "Glycerin", "humectant"), F(b, "Panthenol", "humectant"), F(b, "Sodium Hyaluronate", "humectant"), F(b, "Hydrogenated Vegetable Oil", "emollient support")],
                  mroutes=["Glycerin 12", "Panthenol 13", "Hydrolyzed Hyaluronic Acid 17", "Sodium Hyaluronate 18"], shared=["Hydrogenated Vegetable Oil 6", "Guar 9", "Glyceryl Oleate 8"],
                  limitation="No protein/damage cluster; humectant amounts unknown."),
    focusS=focusS([], "moderate", ["shine"], "Empty: the shine wording ('gesund glänzende Längen') is an outcome of the same moisture/deposition route (F2); no independent shine route.",
                  "Shine is mentioned by the manufacturer.", why="Shine would reuse the primary route (F3)."),
    usage=usage("regular", "high", None, "Default regular: no non-default trigger. No D1, no dandruff claim, no frequency wording from a moderate/high source.", "None."),
    sct=sct("not_targeted", "high", None, "No E2 sensitive or dry-scalp claim unit; 'sanft zur Kopfhaut' (retailer, low) is mildness wording (E2a). Complete ordinary formula.",
            "The formula half (CSA) would pass (Panthenol 13 prominent), but there is no positioning.", [F(b, "Panthenol", "E4 comfort route (unused)")]),
    D1=d1(False, "high", "No D1 wording in name, claims or directions."),
    targets=dict(primary="ordinary", pconf="moderate", prat="S-ORDINARY ways 1 (no qualifying E2 claim; manufacturer source -> high) and 3 (Piroctone Olamine without any dandruff claim -> moderate); lowest = moderate. S-DANDRUFF: no dandruff claim, so no dandruff target (R17.3).",
                 noSecondary="No second qualifying claim unit."),
    notes=["active_without_dandruff_positioning"],
    changes=changes(),
    uncertainties=[
        {"reading": "conditioningLevel high via W-RICH (prominent hydrogenated vegetable oil + guar) although C2 is not met", "alternative": "moderate (one meaningful system plus light routes) if the hydrogenated oil is read as trace"},
        {"reading": "weightPotential moderate (W-RICH with moderate reset is not limited reset)", "alternative": "high if the lipid/guar system is read as multiple converging persistent systems"},
        {"reading": "focusSecondary [] (shine is an outcome of the moisture route, F2)", "alternative": "['shine']"}],
)

# ============================================================ T102 Syoss Intense Volume
b = "T102"
D[b] = dict(
    name="Syoss Intense Volume Shampoo (syoss.de: Intense Volume Leichtes Shampoo)",
    facts=dict(cs=[F(b, "Sodium Laureth Sulfate", "defining anionic (C1)"), F(b, "Cocamidopropyl Betaine", "buffer")],
               cl=[F(b, "Hydrolyzed Keratin", "protein_film"), F(b, "Hydrolyzed Collagen", "protein_film"), F(b, "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "cationic_polymer, after Parfum")]),
    weightFamilies=fam(b, protein_film=[("Hydrolyzed Keratin", "prominent"), ("Hydrolyzed Collagen", "prominent")], cationic_polymer=[("Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "after Parfum")],
                       weak_refatter=[("Glyceryl Oleate", "after Parfum"), ("PEG-7 Glyceryl Cocoate", "after Parfum")], payload_lipid=[("Hydrogenated Castor Oil", "after Parfum")],
                       excluded=[("Glycol Distearate", "pearlizer (6.4)"), ("PEG-120 Methyl Glucose Dioleate", "PEG thickener (6.4)"), ("Laureth-4", "thickener")],
                       reset=[("Sodium Laureth Sulfate", "anionic"), ("Cocamidopropyl Betaine", "amphoteric")]),
    weightNote="'Leichtes Shampoo' / 'ohne zu beschweren' (moderate) corroborate but never lower the band.",
    focusP=focusP("volume", "moderate", "repair", "Volume: 'Intense Volume' is the exact product name (high) and the manufacturer positions it for fine, flat hair with up to 48 h volume (moderate); the low-weight, low-conditioning formula is compatible.",
                  "not_applicable", "candidate", "The 'Kollagen-Lift-Komplex ... stärkt das Haar von innen' claim and two prominent proteins point to a repair-like route.",
                  "volume", True, "Light architecture: weightPotential low, conditioningLevel low; Hydrolyzed Collagen 6 / Keratin 5 as body-giving film", "One dominant name claim with compatible formula (7.2).",
                  [F(b, "Hydrolyzed Collagen", "film/body"), F(b, "Hydrolyzed Keratin", "film/body")]),
    focusS=focusS([], "moderate", ["repair"], "Empty: 'stärkt das Haar von innen' is generic strengthening, not damage/breakage positioning, and the only route (the two proteins) is the one the volume route cites (F3).",
                  "Collagen strengthening claim (moderate).", claims=["stärkt das Haar von innen (manufacturer)"], why="Would reuse the protein route."),
    usage=usage("frequent", "moderate", "regular", "frequent: explicit frequency wording 'Milde Formel für die tägliche Haarwäsche' from the manufacturer (moderate, U2) and cleansingStrength moderate (not strong).",
                "The frequency wording is a suitability statement; retailer copies repeat it (low).", "explicit_frequent_non_strong", ["manufacturer_de: 'Milde Formel für die tägliche Haarwäsche ohne zu beschweren'"]),
    sct=sct("not_targeted", "high", None, "No E2 scalp claim; 'mild' is mildness wording. Complete ordinary formula.", "None."),
    D1=d1(False, "high", "'Tiefenpflegende Formel' is a care term, not D1 (13.6 Not D1)."),
    targets=dict(primary="ordinary", pconf="high", prat="S-ORDINARY way 1: no qualifying E2 claim unit; packet has a manufacturer source -> high.", noSecondary="No qualifying claim unit."),
    notes=[],
    changes=changes(),
    uncertainties=[
        {"reading": "conditioningLevel low (only late guar; hydrolyzed proteins give little slip)", "alternative": "moderate (several light routes)"},
        {"reading": "'tägliche Haarwäsche' counts as U2 frequency wording", "alternative": "regular if only the exact U2 phrases count"},
        {"reading": "focusSecondary []", "alternative": "['repair'] on the collagen strengthening claim"}],
)

# ============================================================ T103 hair biology Revitalize & Soothe
b = "T103"
D[b] = dict(
    name="hair biology Shampoo Revitalize & Soothe (Meno Balance)",
    facts=dict(cs=[F(b, "Sodium Laureth Sulfate", "defining anionic"), F(b, "Sodium Lauryl Sulfate", "reinforcing route"), F(b, "Cocamidopropyl Betaine", "buffer")],
               cl=[F(b, "Dimethiconol", "early silicone"), F(b, "Glycol Distearate", "pearlizing route"), F(b, "Guar Hydroxypropyltrimonium Chloride", "cationic_polymer"), F(b, "Panthenol", "humectant (C2)")],
               ds=[F(b, "Piroctone Olamine", "recognized anti-dandruff active")]),
    weightFamilies=fam(b, silicone=[("Dimethiconol", "prominent"), ("Dimethicone", "after Parfum")], cationic_polymer=[("Guar Hydroxypropyltrimonium Chloride", "after Parfum")],
                       excluded=[("Glycol Distearate", "pearlizer (6.4)")],
                       reset=[("Sodium Laureth Sulfate", "anionic"), ("Sodium Lauryl Sulfate", "anionic"), ("Cocamidopropyl Betaine", "amphoteric"), ("TEA-Dodecylbenzenesulfonate", "anionic, late")]),
    weightNote="'ohne das Haar zu beschweren' (retailer, low) never lowers the band.",
    focusP=focusP("general", "moderate", "moisture", "General: every source is retailer copy graded low (dm.de and an Austrian pharmacy); the moisture claim ('Spendet trockenem Haar Feuchtigkeit') may act as candidate only with an independently supporting verdict, and the verdict is nonspecific. Thinning/density claims are ignored (F5).",
                  "nonspecific", "not_applicable", "Low-graded moisture and scalp-soothing claims; a C2 conditioning system exists.",
                  "moisture (low-graded)", False, "none specific", "Low-graded claim over a nonspecific verdict -> general (CL-SRC, F1, F5).",
                  [F(b, "Dimethiconol", "generic conditioning"), F(b, "Guar Hydroxypropyltrimonium Chloride", "generic conditioning")],
                  shared=["Dimethiconol 10", "Dimethicone 13", "Guar 15"], limitation="No humectant cluster (Panthenol 24 trace)."),
    focusS=focusS([], "high", None, "Empty: no moderate/high-graded distinct positioning.", "None."),
    usage=usage("regular", "high", None, "Default regular. 'für den täglichen Gebrauch geeignet' is retailer copy (low) and cleansing is strong anyway, so frequent cannot fire.", "Daily-use wording (low)."),
    sct=sct("not_targeted", "high", None, "Not targeted: the dry-scalp and 'beruhigt die ... Kopfhaut' claim units are retailer-only (low, SC1 fails) and the formula has no prominent E4 comfort or humectant route (CSA fails); both halves fail.",
            "Sensitive/dry scalp wording exists (low).", [F(b, "Panthenol", "comfort route, after Parfum"), F(b, "Niacinamide", "comfort route, after Parfum")]),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="ordinary", pconf="moderate", prat="S-ORDINARY ways 2/3/4: sensitive ('Beruhigt die aus dem Gleichgewicht geratene Kopfhaut') and dry ('trockener Kopfhaut') claim units exist but only in retailer copy graded low, so both gates fail (S-FAIL, no other specialist target passes); Piroctone Olamine without dandruff claim (R17.3); thinning/density positioning ignored (S-HAIRLOSS). Confidence moderate.",
                 noSecondary="No passing specialist target."),
    flags=["review_specialist_gate_failed:sensitive(positioning low; formula: CSA fails, no prominent E4 comfort route),dry(positioning low; formula: CSA fails, no prominent E4 humectant route)"],
    notes=["active_without_dandruff_positioning", "hair_loss_claim_not_evaluated"],
    changes=changes(),
    uncertainties=[
        {"reading": "S-FAIL for low-graded sensitive/dry units (review flag)", "alternative": "treat as no qualifying unit (way 1, no flag) — rejected because S-FAIL explicitly covers units whose only grade is low"},
        {"reading": "'dünner werdendes Haar ... dichtes, volleres Haar' = hair-density positioning (F5)", "alternative": "cosmetic volume claim"},
        {"reading": "conditioningLevel high via C2 with a trace Panthenol humectant element", "alternative": "moderate"}],
)

# ============================================================ T104 Garnier Wahre Schätze Honig
b = "T104"
D[b] = dict(
    name="Garnier Wahre Schätze Shampoo Honig Schätze (Reparierendes Shampoo Honig Schätze)",
    over={"conditioningLevel": {"confidence": "low", "neighboringAlternative": "high",
                                "rationale": "Moderate from the frozen formula (one meaningful system: HP Guar 17 plus light routes), but confidence low: retailer copy repeatedly claims 'Bienenwachs' (beeswax), which has no INCI match; a beeswax payload lipid, if present, converges with the guar (W-RICH) and could move conditioning to high (ID-3 material conflict).",
                                "counterSignal": "Unresolved beeswax claim (ID-3); guar is the only cationic."},
          "weightPotential": {"confidence": "low", "neighboringAlternative": "moderate",
                              "rationale": "Low from the frozen formula (single light guar, weak refatters, C5 moderate reset), but confidence low: the unmatched beeswax claim names a waxy payload lipid that could add a persistent family and move the band to moderate (ID-3).",
                              "limitingFactor": "Material conflict: 'Bienenwachs' claimed in three retailer copies, absent from the frozen INCI."}},
    facts=dict(cs=[F(b, "Sodium Lauryl Sulfate", "defining anionic (C5)"), F(b, "Cocamidopropyl Betaine", "buffer"), F(b, "Coco-Betaine", "buffer"), F(b, "Coco-Glucoside", "buffer")],
               cl=[F(b, "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "cationic_polymer"), F(b, "Glycerin", "humectant"), F(b, "Glyceryl Oleate", "weak_refatter"), F(b, "Mel/Honey", "humectant-type context")]),
    weightFamilies=fam(b, cationic_polymer=[("Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "position 17 of 30")],
                       weak_refatter=[("Glyceryl Oleate", ""), ("Lecithin", ""), ("Hydrogenated Palm Glycerides Citrate", ""), ("Ascorbyl Palmitate", "")],
                       excluded=[("Carbomer", "anionic acrylate thickener (6.4)"), ("Glycol Distearate", "pearlizer (6.4)")],
                       reset=[("Sodium Lauryl Sulfate", "anionic"), ("Cocamidopropyl Betaine", "amphoteric"), ("Coco-Betaine", "amphoteric"), ("Coco-Glucoside", "nonionic")],
                       humectant_context=[("Mel/Honey", ""), ("Glycerin", "")]),
    weightNote="ID-3: 'Bienenwachs' (dm, Rossmann, dm; graded low) has no INCI entry; a waxy payload lipid would be weight-relevant, so the conflict is material and confidence drops to low (needs_research).",
    focusP=focusP("general", "moderate", "repair", "General: the product name ('Reparierendes Shampoo', high) and manufacturer copy position damage repair (Spliss, Haarbruch), but the formula verdict is moisture_supported, not repair_supported or dual (no protein, silicone, lipid or damage-care cluster), so repair is incompatible (F1); no moisture positioning exists to use the actual verdict.",
                  "moisture_supported", "not_applicable", "Strong repair positioning in name and manufacturer copy.",
                  "repair", False, "none (repair route absent)", "Claim incompatible with formula -> general (7.2, F1).",
                  [F(b, "Mel/Honey", "humectant-type"), F(b, "Glycerin", "humectant"), F(b, "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "light conditioning")],
                  mroutes=["Mel/Honey 5", "Glycerin 8"], shared=["Guar 17", "Glyceryl Oleate 9", "Lecithin 12"], limitation="No damage-care cluster; beeswax claim unresolved."),
    focusS=focusS([], "high", None, "Empty: no second distinct positioned role with an independent route.", "None."),
    usage=usage("regular", "high", None, "Default regular: no trigger.", "None."),
    sct=sct("not_targeted", "high", None, "No scalp claim unit at all. Complete ordinary formula.", "None."),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="ordinary", pconf="high", prat="S-ORDINARY way 1: no qualifying E2 claim; manufacturer source present -> high.", noSecondary="No qualifying claim unit."),
    notes=[],
    changes=changes({"property": "conditioningLevel", "blind": "moderate / moderate / neighbor low", "final": "moderate / low / neighbor high",
                     "evidence": "Retailer copy (dm.de x2, rossmann.de): 'Bienenwachs hat schützende Eigenschaften', 'nachhaltig bezogener Akazienhonig & Bienenwachs'; no Cera Alba in the frozen INCI.",
                     "reason": "ID-3 material conflict: a waxy payload lipid could create W-RICH with the guar."},
                    {"property": "weightPotential", "blind": "low / moderate", "final": "low / low",
                     "evidence": "Same beeswax claims.", "reason": "ID-3: a prominent waxy lipid could move the band to moderate."}),
    uncertainties=[
        {"reading": "Beeswax claim is a material conflict (ID-3) -> low confidence, needs_research", "alternative": "note only (retailer marketing, canonical tier-2 manufacturer INCI wins) -> conditioning moderate/moderate, weight low/moderate, classified"},
        {"reading": "focusPrimary general (repair claim incompatible with a moisture_supported verdict)", "alternative": "repair if the guar/refatter/honey set is read as dual_supported"}],
)

# ============================================================ T105 Balea Ultra Sensitive
b = "T105"
D[b] = dict(
    name="Balea (med) Shampoo Ultra Sensitive",
    facts=dict(cs=[F(b, "Sodium Coco-Sulfate", "defining anionic (C5)"), F(b, "Coco-Glucoside", "buffer"), F(b, "Sodium Cocoamphoacetate", "buffer")],
               cl=[F(b, "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "cationic_polymer"), F(b, "Glyceryl Oleate", "weak_refatter"), F(b, "Glycerin", "humectant"), F(b, "Panthenol", "humectant")]),
    weightFamilies=fam(b, cationic_polymer=[("Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "")],
                       weak_refatter=[("Glyceryl Oleate", ""), ("Hydrogenated Palm Glycerides Citrate", ""), ("Lecithin", ""), ("Ascorbyl Palmitate", "")],
                       reset=[("Coco-Glucoside", "nonionic"), ("Sodium Coco-Sulfate", "anionic"), ("Sodium Cocoamphoacetate", "amphoteric")],
                       humectant_context=[("Glycerin", ""), ("Panthenol", "")]),
    focusP=focusP("scalp_active", "moderate", "general", "scalp_active: 'Mildes Shampoo für empfindliche Kopfhaut' is an E2 sensitive claim unit (manufacturer, moderate) and scalpComfortTarget is targeted; under F7 neither role is in the product name ('Ultra Sensitive' does not name the scalp), so the problem-led scalp role is primary.",
                  "not_applicable", "candidate", "Mildness/'ohne die Kopfhaut zu reizen' wording is protective, and the moisture claim competes as a lengths role.",
                  "sensitive scalp", True, "Panthenol 7 + Niacinamide 8 comfort routes in a mild-led C5 chassis, fragrance-free", "F7 step 2: scalp_active primary when neither role is named.",
                  [F(b, "Panthenol", "comfort route"), F(b, "Niacinamide", "comfort route")]),
    focusS=focusS(["moisture"], "moderate", [], "moisture: distinct manufacturer claim 'Pflegeformel mit 5 % Glycerin ... spendet Feuchtigkeit und pflegt das Haar geschmeidig' with an independent route (Glycerin 3 + Guar 12 + Glyceryl Oleate 11) not cited by the scalp route (Panthenol, Niacinamide).",
                  "The same sentence also credits Panthenol and Niacinamide; the moisture verdict is weak.", ["spendet Feuchtigkeit (manufacturer)"], ["Glycerin 3", "Guar 12", "Glyceryl Oleate 11"], "Lengths hydration vs. scalp comfort; different ingredients (F3)."),
    usage=usage("frequent", "moderate", "regular", "frequent: 'ideal für die tägliche Haarwäsche bei sensibler Haut' (manufacturer, moderate, U2) and cleansingStrength moderate.",
                "Suitability wording.", "explicit_frequent_non_strong", ["manufacturer_de: 'ideal für die tägliche Haarwäsche'"]),
    sct=sct("targeted", "moderate", "not_targeted", "Targeted: SC1 holds ('Mildes Shampoo für empfindliche Kopfhaut', manufacturer, moderate) and CSA holds (prominent Panthenol 7, Niacinamide 8, Glycerin 3); fragrance-free, mild-led chassis as supportive signals.",
            "Positioning only at moderate grade; C5 sulfate present.", [F(b, "Panthenol", "comfort"), F(b, "Niacinamide", "comfort"), F(b, "Glycerin", "humectant")]),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="sensitive", pconf="moderate", prat="S-SENSITIVE: E2 sensitive unit (moderate) + targeted + prominent comfort routes (Panthenol 7, Niacinamide 8). Confidence = min(positioning moderate, scalpComfortTarget moderate).",
                 noSecondary="No dry-scalp, oily or dandruff unit ('ohne die Kopfhaut zu reizen' is protective wording)."),
    notes=[],
    changes=changes(),
    uncertainties=[
        {"reading": "cleansingStrength moderate (C5: two buffers) with neighbor low", "alternative": "neighbor value low as the real-world mildness; no value change by convention"},
        {"reading": "focusSecondary ['moisture']", "alternative": "[] if the moisture sentence is read as part of the sensitive-care positioning"}],
)

# ============================================================ T106 Neqi Moisture Mystery
b = "T106"
D[b] = dict(
    name="Neqi Moisture Mystery Shampoo",
    facts=dict(cs=[F(b, "Disodium laureth sulfosuccinate", "mild anionic"), F(b, "Cocamidopropyl betaine", "amphoteric"), F(b, "Cocamidopropyl hydroxysultaine", "amphoteric")],
               cl=[F(b, "PEG-18 glyceryl oleate/cocoate", "weak_refatter"), F(b, "Guar hydroxypropyltrimonium chloride", "cationic_polymer, late")]),
    weightFamilies=fam(b, weak_refatter=[("PEG-18 glyceryl oleate/cocoate", "prominent")], cationic_polymer=[("Guar hydroxypropyltrimonium chloride", "after Parfum")],
                       protein_film=[("Avena sativa (Oat) peptide", "after Parfum")], unresolved_light_emollient=[("C13-15 alkane", "hemisqualane, late")],
                       excluded=[("Algin", "thickener"), ("Juniperus virginiana oil", "essential oil (6.4)"), ("Citrus aurantium peel oil", "essential oil"), ("Glycol distearate", "pearlizer")],
                       reset=[("Disodium laureth sulfosuccinate", "mild anionic"), ("Cocamidopropyl betaine", "amphoteric"), ("Cocamidopropyl hydroxysultaine", "amphoteric")]),
    weightNote="Claim 'Hemisqualan' maps to C13-15 Alkane (21); 'Monoi' to Gardenia Taitensis (9); 'Goji' to Lycium (10); 'Peptide aus Hafer' to Avena Sativa Peptide (8). No conflict.",
    focusP=focusP("general", "moderate", "moisture", "General: 'Moisture' is in the product name (high), but the formula verdict is nonspecific (no humectant cluster: Glycerin 23 is late; only a prominent PEG refatter), so moisture is not supported (F1).",
                  "nonspecific", "not_applicable", "Strong moisture positioning in the name.",
                  "moisture", False, "none", "Moisture claim over a nonspecific verdict -> general (F1).",
                  [F(b, "PEG-18 glyceryl oleate/cocoate", "refatter"), F(b, "Glycerin", "humectant, late")], limitation="No coherent humectant cluster."),
    focusS=focusS([], "high", None, "Empty: no supported second role (repair/shine wording sits on a manufacturer page that may be the Swiss storefront and has no independent route).", "None."),
    usage=usage("regular", "high", None, "Default regular: no trigger.", "None."),
    sct=sct("not_targeted", "high", None, "No E2 scalp claim ('sanfte Reinigung von Haaren und Kopfhaut, ohne zu strapazieren' is protective); 'fettiges Haar' appears only in a suitable-for-all-hair-types list, not as a for/against unit.", "None."),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="ordinary", pconf="high", prat="S-ORDINARY way 1: no qualifying E2 unit; packet contains a manufacturer source -> high.", noSecondary="'fettiges ... Haar' is a hair-type suitability list, not an oily-scalp claim unit."),
    notes=[],
    changes=changes(),
    uncertainties=[
        {"reading": "German-language NEQI page priced in CHF treated per E1 as possibly foreign-market (claims effectively low) — irrelevant to the outcome because the name carries moisture", "alternative": "moderate manufacturer page"},
        {"reading": "conditioningLevel low", "alternative": "moderate (several light routes)"}],
)

# ============================================================ T107 Sante Glossy Shine
b = "T107"
D[b] = dict(
    name="SANTE Glossy Shine Shampoo Birke + 3-fach Protein Komplex",
    facts=dict(cs=[F(b, "Ammonium Lauryl Sulfate", "defining anionic (C5)"), F(b, "Cocamidopropyl Betaine", "only buffer")],
               cl=[F(b, "Guar Hydroxypropyltrimonium Chloride", "cationic_polymer"), F(b, "Hydrolyzed Corn Protein", "protein"), F(b, "Hydrolyzed Wheat Protein", "protein"), F(b, "Hydrolyzed Soy Protein", "protein"), F(b, "Glycerin", "humectant")]),
    weightFamilies=fam(b, cationic_polymer=[("Guar Hydroxypropyltrimonium Chloride", "prominent")],
                       protein_film=[("Hydrolyzed Corn Protein", ""), ("Hydrolyzed Wheat Protein", ""), ("Hydrolyzed Soy Protein", "")],
                       reset=[("Ammonium Lauryl Sulfate", "anionic"), ("Cocamidopropyl Betaine", "amphoteric")], humectant_context=[("Glycerin", "")]),
    weightNote="Claim '3-fach Protein Komplex' maps to corn/wheat/soy proteins; 'Bio-Birkenblattextrakt' to Betula Alba Leaf Extract. No conflict.",
    focusP=focusP("shine", "moderate", "repair", "Shine: 'Glossy Shine' is the product name (high) and the manufacturer positions it for 'glanzloses und stumpfes Haar'; the formula is compatible through a light smoothing route (Guar 8) and acidic alignment (Citric Acid 10), with low weight.",
                  "not_applicable", "candidate", "The protein complex claim ('stärkt ... baut das Haar auf') is a competing repair role.",
                  "shine", True, "Guar 8 smoothing + Citric Acid 10 acidic alignment, low weight", "Dominant name claim with compatible formula (7.1 shine).",
                  [F(b, "Guar Hydroxypropyltrimonium Chloride", "smoothing"), F(b, "Citric Acid", "acidic alignment (supports primary shine only, F4)")]),
    focusS=focusS(["repair"], "moderate", [], "repair: distinct manufacturer positioning ('Der 3-fach Protein Komplex stärkt, pflegt & schützt das Haar', 'füllt & baut das Haar auf') with an independent route (three hydrolyzed proteins 5, 7, 9) not cited by the shine route; repair_supported protein cluster.",
                  "Strengthening wording is softer than damage/breakage positioning.", ["3-fach Protein Komplex stärkt ... baut das Haar auf (manufacturer)"], ["Hydrolyzed Corn Protein 5", "Hydrolyzed Wheat Protein 7", "Hydrolyzed Soy Protein 9"], "Proteins vs. guar/acid smoothing (F3)."),
    usage=usage("regular", "high", None, "Default regular: strong cleansing but no reset intent (U4) and no other trigger.", "None."),
    sct=sct("not_targeted", "high", None, "No scalp claim ('Verträglichkeit dermatologisch getestet' is protective).", "None."),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="ordinary", pconf="high", prat="S-ORDINARY way 1; manufacturer source present -> high.", noSecondary="No qualifying claim unit."),
    notes=[],
    changes=changes(),
    uncertainties=[
        {"reading": "focusSecondary ['repair']", "alternative": "[] if 'stärkt/baut auf' is not read as damage positioning"},
        {"reading": "weightPotential low (strong reset faces light routes)", "alternative": "moderate (guar 8 + three proteins)"}],
)

# ============================================================ T108 ISANA MED pH 5,5
b = "T108"
D[b] = dict(
    name="ISANA MED Shampoo pH 5,5 hautneutral",
    facts=dict(cs=[F(b, "Sodium Laureth Sulfate", "defining anionic"), F(b, "Sodium Laureth-8 Sulfate", "reinforcing"), F(b, "Magnesium Laureth Sulfate", "reinforcing"), F(b, "Sodium Oleth Sulfate", "reinforcing")],
               cl=[F(b, "Urea", "humectant"), F(b, "Panthenol", "humectant"), F(b, "Glycol Distearate", "pearlizer")]),
    weightFamilies=fam(b, excluded=[("Glycol Distearate", "pearlizer"), ("Laureth-4", "thickener")], humectant_context=[("Urea", ""), ("Panthenol", ""), ("Glycerin", "")],
                       reset=[("Sodium Laureth Sulfate", "anionic"), ("Sodium Laureth-8 Sulfate", "anionic"), ("Magnesium Laureth Sulfate", "anionic"), ("Cocamidopropyl Betaine", "amphoteric")]),
    focusP=focusP("scalp_active", "moderate", "general", "scalp_active: 'Das ISANA MED SHAMPOO ist eine Spezialentwicklung für sensible Kopfhaut' (manufacturer/own-brand, moderate) is an E2 sensitive claim unit; scalpComfortTarget targeted via Urea 3 / Panthenol 8. No competing lengths role.",
                  "not_applicable", "candidate", "Strong (convention) ether-sulfate cleansing is a comfort counter-signal.",
                  "sensitive scalp", True, "Urea 3 + Panthenol 8 comfort routes", "Explicit sensitive-scalp positioning with targeted (7.2).",
                  [F(b, "Urea", "comfort route"), F(b, "Panthenol", "comfort route")]),
    focusS=focusS([], "moderate", ["moisture"], "Empty: 'Feuchtigkeits-Komplex' / 'schützt Kopfhaut & Haar vor Austrocknung' is protective wording, and the moisture verdict is nonspecific (no deposition support); the humectants are already the primary route (F3).",
                  "Moisture complex wording.", why="Would reuse Urea/Panthenol."),
    usage=usage("regular", "moderate", "frequent", "regular: 'für jeden Tag' (manufacturer, moderate) is U2 wording, but cleansingStrength is strong, so frequent does not fire; no reset intent.",
                "Explicit daily wording; frequent would fire if cleansing were moderate (the cleansing neighbor).", "none", [], ["explicit_frequent_non_strong blocked: cleansingStrength strong"]),
    sct=sct("targeted", "moderate", "not_targeted", "Targeted: SC1 holds (sensible Kopfhaut unit, moderate) and CSA holds (prominent Urea 3, Panthenol 8). Strong cleansing is a counter-signal -> confidence moderate.",
            "cleansingStrength strong (CSA counter-signal).", [F(b, "Urea", "comfort/humectant"), F(b, "Panthenol", "comfort/humectant")]),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="sensitive", pconf="moderate", prat="S-SENSITIVE: E2 sensitive unit (moderate) + targeted + prominent comfort route (Urea 3, Panthenol 8); cleansingStrength strong -> review_strong_cleansing_comfort_route. 'schützt ... vor Austrocknung' is protective, so no dry target.",
                 noSecondary="No dry-scalp unit (protective wording only)."),
    flags=["review_strong_cleansing_comfort_route"],
    notes=[],
    changes=changes(),
    uncertainties=[
        {"reading": "cleansingStrength strong by C1 reinforcement (Mg laureth/oleth sulfates)", "alternative": "moderate (mild blend); would make usage frequent and remove the strong-cleansing review flag"}],
)

# ============================================================ T109 Herbal Essences Tiefenreinigung & Glanz
b = "T109"
D[b] = dict(
    name="Herbal Essences Tiefenreinigung & Glanz Shampoo Limettenduft",
    facts=dict(cs=[F(b, "Sodium Laureth Sulfate", "defining anionic, no prominent buffer"), F(b, "Cocamidopropyl Betaine", "after Parfum")], cl=[]),
    weightFamilies=fam(b, excluded=[("Hydroxypropyl Methylcellulose", "nonionic thickener"), ("Citrus Aurantium Peel Oil", "essential oil")],
                       reset=[("Sodium Laureth Sulfate", "anionic"), ("Cocamidopropyl Betaine", "amphoteric, after Parfum")]),
    focusP=focusP("clarifying", "moderate", "shine", "Clarifying: 'Tiefenreinigung' is in the exact product name (high, D1) and the formula is compatible (cleansingStrength strong, conditioning low, weight low; F6).",
                  "not_applicable", "candidate", "'Glanz' is also in the name.",
                  "deep cleansing", True, "Unbuffered (by convention) SLES chassis with no deposition", "Explicit deep-cleansing name with compatible architecture (7.2).",
                  [F(b, "Sodium Laureth Sulfate", "reset chassis")]),
    focusS=focusS([], "moderate", ["shine"], "Empty: 'Glanz' is in the name but there is no independent shine route (no smoothing/film; acids cannot create a secondary shine, F4).",
                  "Shine in the name.", claims=["Glanz (name)"], why="No route besides pH adjusters (F4)."),
    usage=usage("occasional_reset", "high", None, "occasional_reset: D1 true from the product name (high). Directions do not limit or extend frequency.",
                "No occasional-use directions; strong + reset intent would also fire alternating.", "explicit_deep_cleansing", ["product name: 'Tiefenreinigung & Glanz'"], ["alternating (strong_plus_reset_intent) loses under U1"]),
    sct=sct("not_targeted", "high", None, "No scalp claim. Complete ordinary formula.", "None."),
    D1=d1(True, "high", "D1 true: 'Tiefenreinigung' (stem tiefenrein) in the exact product name (high)."),
    targets=dict(primary="ordinary", pconf="moderate", prat="S-ORDINARY way 1: no qualifying E2 claim (no oily/scalp wording); packet has retailer copy only -> moderate.", noSecondary="No qualifying claim unit."),
    notes=[],
    changes=changes(),
    uncertainties=[
        {"reading": "cleansingStrength strong (betaine after the early Parfum does not buffer, C4)", "alternative": "moderate -> D2 would fail; D3 ordinary-strength note instead of a deep-cleanser flag; intensity regular"},
        {"reading": "ordinary confidence moderate (retailer copy only; the name is not a source)", "alternative": "high"}],
)

# ============================================================ T110 ISANA 2in1 Volumen
b = "T110"
D[b] = dict(
    name="ISANA Shampoo & Spülung 2in1 Volumen (Malve & Acai)",
    facts=dict(cs=[F(b, "Sodium Laureth Sulfate", "defining anionic (C1)"), F(b, "Cocamidopropyl Betaine", "buffer"), F(b, "Coco-Glucoside", "buffer")],
               cl=[F(b, "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "cationic_polymer"), F(b, "Hydrolyzed Wheat Protein", "protein"), F(b, "Glyceryl Oleate", "weak_refatter")]),
    weightFamilies=fam(b, cationic_polymer=[("Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "")], protein_film=[("Hydrolyzed Wheat Protein", "")],
                       weak_refatter=[("Glyceryl Oleate", ""), ("Hydrogenated Palm Glycerides Citrate", "")], excluded=[("PEG-3 Distearate", "PEG ester pearlizer")],
                       reset=[("Sodium Laureth Sulfate", "anionic"), ("Cocamidopropyl Betaine", "amphoteric"), ("Coco-Glucoside", "nonionic")]),
    weightNote="'2in1' / 'Spülung' never raises conditioning or weight (C7).",
    focusP=focusP("volume", "moderate", "general", "Volume: 'Volumen' is in the exact product name (high) and the own-brand page claims volume for 'kraftloses & feines Haar'; low weight is compatible.",
                  "not_applicable", "candidate", "2-in-1 conditioning (guar) is a trade-off for volume.",
                  "volume", True, "weightPotential low; light guar/protein architecture", "Name claim with compatible formula.",
                  [F(b, "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "light conditioning")]),
    focusS=focusS([], "high", None, "Empty: 2-in-1 care is a restatement of conditioning (C7), not a role.", "None."),
    usage=usage("regular", "high", None, "Default regular: no trigger.", "None."),
    sct=sct("not_targeted", "high", None, "No scalp claim ('pH-hautneutral', 'dermatologisch bestätigt' are protective).", "CSA formula half would pass."),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="ordinary", pconf="high", prat="S-ORDINARY way 1; manufacturer (own-brand) source present -> high.", noSecondary="No qualifying claim unit."),
    notes=[], changes=changes(),
    uncertainties=[{"reading": "weightPotential low", "alternative": "moderate (three light families)"}],
)

# ============================================================ T111 GLISS Sealing Miracle
b = "T111"
D[b] = dict(
    name="Schwarzkopf GLISS Sealing Miracle Versiegelndes Shampoo",
    facts=dict(cs=[F(b, "Sodium Laureth Sulfate", "defining anionic (C1)"), F(b, "Cocamidopropyl Betaine", "buffer")],
               cl=[F(b, "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "cationic_polymer"), F(b, "Pisum Sativum (Pea) Peptide", "protein")]),
    weightFamilies=fam(b, cationic_polymer=[("Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "prominent")], protein_film=[("Pisum Sativum (Pea) Peptide", "prominent")],
                       weak_refatter=[("Glyceryl Oleate", "after Parfum"), ("PEG-7 Glyceryl Cocoate", "after Parfum")], payload_lipid=[("Hydrogenated Castor Oil", "after Parfum")],
                       excluded=[("Glycol Distearate", "pearlizer"), ("PEG-120 Methyl Glucose Dioleate", "PEG thickener")],
                       reset=[("Sodium Laureth Sulfate", "anionic"), ("Cocamidopropyl Betaine", "amphoteric")]),
    weightNote="'Reinigt, ohne das Haar zu beschweren' (moderate) never lowers the band.",
    focusP=focusP("general", "moderate", "repair", "General: pack and manufacturer position repair ('Für splissgeschädigtes Haar', 'Für geschädigtes und splissanfälliges Haar', moderate), but the formula verdict is nonspecific: one peptide token plus a single guar is not a coherent repair cluster (7.3), and claims cannot turn a nonspecific verdict into a specialist focus (3.2).",
                  "nonspecific", "not_applicable", "Clear, consistent repair positioning.",
                  "repair", False, "none (single peptide token)", "Repair claim over a nonspecific verdict -> general (F1).",
                  [F(b, "Pisum Sativum (Pea) Peptide", "single protein token"), F(b, "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "generic conditioning")],
                  rroutes=["Pea Peptide 5"], shared=["Guar 6"], limitation="One protein token; other routes after Parfum."),
    focusS=focusS([], "high", None, "Empty.", "None."),
    usage=usage("regular", "high", None, "Default regular: 'Regelmäßig anwenden' is not U2 frequency wording.", "None."),
    sct=sct("not_targeted", "high", None, "No scalp claim.", "None."),
    D1=d1(False, "high", "'Versiegelnd' is not D1 wording."),
    targets=dict(primary="ordinary", pconf="high", prat="S-ORDINARY way 1; manufacturer/pack sources present -> high.", noSecondary="No qualifying claim unit."),
    notes=[], changes=changes(),
    uncertainties=[{"reading": "careDirection nonspecific -> focus general", "alternative": "repair_supported (prominent guar + peptide read as a deposition cluster) -> focus repair"}],
)

# ============================================================ T112 OGX Biotin & Collagen
b = "T112"
D[b] = dict(
    name="OGX Biotin & Collagen Shampoo (Thick & Full)",
    facts=dict(cs=[F(b, "Sodium Methyl Cocoyl Taurate", "mild anionic"), F(b, "Decyl Glucoside", "glucoside"), F(b, "Cocamidopropyl Betaine", "amphoteric")],
               cl=[F(b, "Amodimethicone", "amino-silicone"), F(b, "Starch Hydroxypropyltrimonium Chloride", "cationic_polymer"), F(b, "Hydrolyzed Collagen", "protein"), F(b, "Urea", "humectant")]),
    weightFamilies=fam(b, silicone=[("Amodimethicone", "prominent")], cationic_polymer=[("Starch Hydroxypropyltrimonium Chloride", "")], protein_film=[("Hydrolyzed Collagen", "")],
                       possible_film_former=[("Sodium Hydrolyzed Potato Starch Dodecenylsuccinate", "recognition gap")],
                       weak_refatter=[("Glyceryl Oleate", ""), ("Hydrogenated Palm Glycerides Citrate", ""), ("Lecithin", "")], excluded=[("PEG-150 Distearate", "PEG thickener")],
                       reset=[("Sodium Methyl Cocoyl Taurate", "mild anionic"), ("Decyl Glucoside", "nonionic"), ("Cocamidopropyl Betaine", "amphoteric"), ("Coco-Glucoside", "nonionic")]),
    weightNote="Retailer claims 'Weizenprotein'/'hydrolysiertem Weizenprotein' have no INCI match; a light hydrolyzed protein would not move the band (moderate), so the conflict is a note (ID-3). 'Ohne Silikone' (Rossmann, low) conflicts with Amodimethicone 10: the frozen INCI wins; recorded.",
    focusP=focusP("general", "moderate", "volume", "General: all positioning is retailer copy or a US manufacturer page (low). Volume/fullness ('Thick & Full', 'mehr Volumen') is the dominant claim but a low claim may act only with an independently supporting formula verdict, and a moderate-weight amino-silicone/cationic formula does not independently support volume. The repair_supported verdict has no matching German positioning.",
                  "repair_supported", "not_applicable", "Volume is the clearly dominant (low-graded) claim; formula has a repair-type route.",
                  "volume (low-graded)", False, "none independently supporting volume", "Low-graded claim without independent formula support -> general (CL-SRC, 7.2).",
                  [F(b, "Amodimethicone", "deposition"), F(b, "Hydrolyzed Collagen", "protein")], rroutes=["Amodimethicone 10", "Hydrolyzed Collagen 7", "Starch HPTC 9"], limitation="Positioning low-graded only."),
    focusS=focusS([], "high", None, "Empty: no moderate/high positioning.", "None."),
    usage=usage("regular", "high", None, "Default regular: 'für die tägliche Haarwäsche' is Müller copy (low) and cannot fire frequent.", "Daily wording (low)."),
    sct=sct("not_targeted", "high", None, "No scalp claim.", "CSA formula half would pass (Urea 15)."),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="ordinary", pconf="moderate", prat="S-ORDINARY way 1: no qualifying E2 claim; the only manufacturer source is a foreign (US) page graded like retailer copy (E1), so retailer-only -> moderate.", noSecondary="No qualifying claim unit."),
    notes=[], changes=changes(),
    uncertainties=[
        {"reading": "ordinary confidence moderate (US manufacturer page treated as retailer-equivalent)", "alternative": "high (a manufacturer source exists)"},
        {"reading": "focusPrimary general", "alternative": "volume (low claim) or repair (formula route)"},
        {"reading": "conditioningLevel moderate / weightPotential moderate", "alternative": "high / high (amodimethicone + cationic under weak reset)"},
        {"reading": "Weizenprotein and 'ohne Silikone' retailer conflicts are notes, not material", "alternative": "material conflict -> low confidence"}],
)

# ============================================================ T113 OGX Keratin Oil
b = "T113"
D[b] = dict(
    name="OGX Strength & Length + Keratin Oil Shampoo",
    facts=dict(cs=[F(b, "Sodium Methyl Cocoyl Taurate", "mild anionic"), F(b, "Decyl Glucoside", "glucoside"), F(b, "Cocamidopropyl Betaine", "amphoteric")],
               cl=[F(b, "Argania Spinosa Kernel Oil", "payload_lipid"), F(b, "Amodimethicone", "silicone"), F(b, "Guar Hydroxypropyltrimonium Chloride", "cationic_polymer"), F(b, "Hydrogenated Castor Oil", "payload_lipid"), F(b, "Glycol Distearate", "pearlizer")]),
    weightFamilies=fam(b, payload_lipid=[("Argania Spinosa Kernel Oil", "prominent"), ("Hydrogenated Castor Oil", "waxy")], silicone=[("Amodimethicone", "prominent")],
                       cationic_polymer=[("Guar Hydroxypropyltrimonium Chloride", "")], protein_film=[("Hydrolyzed Keratin", "")],
                       possible_film_former=[("Sodium Hydrolyzed Potato Starch Dodecenylsuccinate", "recognition gap")],
                       excluded=[("Glycol Distearate", "pearlizer"), ("PEG-150 Distearate", "PEG thickener")],
                       reset=[("Sodium Methyl Cocoyl Taurate", "mild anionic"), ("Decyl Glucoside", "nonionic"), ("Cocamidopropyl Betaine", "amphoteric")]),
    weightNote="Claims 'Arganöl' and 'Keratin' map to Argania Spinosa Kernel Oil 7 and Hydrolyzed Keratin 6.",
    focusP=focusP("repair", "moderate", "general", "Repair: retailer copy (low) positions anti-breakage/split-end care for 'strapaziertes Haar'; the formula verdict is independently repair_supported (keratin + amodimethicone + argan oil + guar), so the low claim may act as candidate with confidence capped at moderate (CL-SRC).",
                  "repair_supported", "candidate", "Positioning is low-graded only; heavy weight.",
                  "repair", True, "Hydrolyzed Keratin 6 + Amodimethicone 10 + Argan Oil 7 + Guar 11", "Low claim plus independently supporting repair_supported verdict.",
                  [F(b, "Hydrolyzed Keratin", "protein"), F(b, "Amodimethicone", "damage-selective deposition"), F(b, "Argania Spinosa Kernel Oil", "lipid")],
                  rroutes=["Hydrolyzed Keratin 6", "Amodimethicone 10", "Argania Spinosa Kernel Oil 7"], shared=["Guar 11", "Hydrogenated Castor Oil 12"], limitation="Claims low-graded."),
    focusS=focusS([], "high", None, "Empty: shine/elasticity claims are outcomes of the same repair/deposition route (F2) and low-graded.", "None."),
    usage=usage("regular", "high", None, "Default regular: no trigger.", "None."),
    sct=sct("not_targeted", "high", None, "No scalp claim.", "None."),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="ordinary", pconf="moderate", prat="S-ORDINARY way 1: no qualifying E2 claim; retailer copy only -> moderate.", noSecondary="No qualifying claim unit."),
    notes=[], changes=changes(),
    uncertainties=[
        {"reading": "weightPotential high (W-RICH + weak reset)", "alternative": "moderate (rinse-off context, unknown argan/amodimethicone levels)"},
        {"reading": "conditioningLevel high via W-RICH although C2 lacks a closed-list humectant", "alternative": "moderate"}],
)

# ============================================================ T114 Sebamed Anti-Schuppen PLUS
b = "T114"
D[b] = dict(
    name="Sebamed Anti-Schuppen Shampoo PLUS",
    facts=dict(cs=[F(b, "Sodium Laureth Sulfate", "defining anionic (C1)"), F(b, "Lauryl Glucoside", "buffer"), F(b, "Sodium Lauroyl Sarcosinate", "buffer")],
               cl=[F(b, "Hydroxypropyl Oxidized Starch PG-Trimonium Chloride", "cationic_polymer")], ds=[F(b, "Piroctone Olamine", "recognized anti-dandruff active")]),
    weightFamilies=fam(b, cationic_polymer=[("Hydroxypropyl Oxidized Starch PG-Trimonium Chloride", "single family")],
                       reset=[("Sodium Laureth Sulfate", "anionic"), ("Lauryl Glucoside", "nonionic"), ("Sodium Lauroyl Sarcosinate", "mild anionic")]),
    focusP=focusP("scalp_active", "high", None, "scalp_active: anti-dandruff positioning in the exact product name ('Anti-Schuppen', high) with a recognized active (Piroctone Olamine 7).",
                  "not_applicable", "candidate", "Prominent Menthol (8) and oily-hair positioning compete as secondary roles.",
                  "dandruff", True, "Piroctone Olamine 7", "Problem-led product with recognized active and anti-dandruff positioning (7.2).",
                  [F(b, "Piroctone Olamine", "anti-dandruff active")]),
    focusS=focusS(["clarifying"], "moderate", [], "clarifying: distinct oily positioning ('für fettendes Haar', 'bei schnell fettendem Haar', manufacturer, moderate) with a compatible architecture (moderate cleansing, conditioning not high, weight low; F6) resting on the surfactant chassis, which the anti-dandruff route (Piroctone) does not cite.",
                  "The oily wording sits inside/next to dandruff units; a route resting on the cleansing chassis is close to the invalid 'clarifying only because cleansing is strong' pattern.",
                  ["für fettendes Haar (manufacturer headline)", "Bekämpfung von Schuppen bei schnell fettendem Haar (manufacturer)"], ["SLES 2 + Lauryl Glucoside 3 + Sarcosinate 4 low-deposition chassis"], "Oil control vs. anti-dandruff active (F3)."),
    usage=usage("treatment", "high", None, "treatment: dandruffSupport supported and a qualifying E2 dandruff claim in the product name (high) (U3).",
                "Directions 'Täglich oder 2-3x pro Woche' also fire frequent, which loses under U1.", "recognized_active_problem_led", ["name: 'Anti-Schuppen'", "Piroctone Olamine 7"], ["frequent (explicit_frequent_non_strong: 'Täglich oder 2-3x pro Woche anwenden') loses under U1"]),
    sct=sct("not_targeted", "high", None, "Not targeted: 'Juckreiz' occurs only inside a dandruff claim unit (E2a, a dandruff symptom, not SC1) and CSA fails (no prominent E4 comfort or humectant route; prominent Menthol 8).",
            "Itch wording inside the dandruff unit.", [F(b, "Menthol", "cooling counter-signal")]),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="dandruff", pconf="high", prat="S-DANDRUFF: E2 dandruff claim in the product name (high) + dandruffSupport supported (Piroctone 7) -> dandruff primary (S-PRIMARY, R17.1). Confidence = min(positioning high, dandruffSupport high).",
                 noSecondary="Dandruff-primary: no secondary target (R17.2); itch and oily wording go to the research-only combination (E2b)."),
    rct=["oily"],
    rctRat="E2b layer 2: sensitive — bundled comfort wording 'Juckreiz' (manufacturer, moderate) but the S-SENSITIVE formula gate fails (CSA: no prominent E4 comfort/humectant route; Menthol 8) -> not recorded, note dandruff_bundled_comfort_wording. dry — no dry-scalp unit. oily — 'bei schnell fettendem Haar' / 'für fettendes Haar' (manufacturer, moderate) + S-OILY clause passes (cleansing moderate, weight low, conditioning moderate) -> 'oily', note suits_dandruff_with_oily_scalp; confidence min(dandruff high, wording moderate) = moderate.",
    notes=["suits_dandruff_with_oily_scalp", "dandruff_bundled_comfort_wording:'Bekämpfung von Schuppen bei schnell fettendem Haar und Juckreiz' — S-SENSITIVE formula gate failed (CSA: no prominent E4 comfort or humectant route; prominent Menthol 8)"],
    changes=changes(),
    uncertainties=[
        {"reading": "focusSecondary ['clarifying'] on oily positioning", "alternative": "[] (oily wording absorbed by dandruff units; route = chassis only)"},
        {"reading": "conditioningLevel moderate (prominent cationic starch)", "alternative": "low"}],
)

# ============================================================ T115 Balea 2in1 Urea 5%
b = "T115"
D[b] = dict(
    name="Balea med Duschgel & Shampoo 5% Urea 2in1",
    facts=dict(cs=[F(b, "Sodium Laureth Sulfate", "defining anionic (C1)"), F(b, "Cocamidopropyl Betaine", "buffer")],
               cl=[F(b, "Urea", "humectant"), F(b, "Glycerin", "humectant"), F(b, "Panthenol", "humectant"), F(b, "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "cationic, after Parfum")],
               ds=[F(b, "Piroctone Olamine", "recognized anti-dandruff active (late, preservative-level)")]),
    weightFamilies=fam(b, cationic_polymer=[("Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "after Parfum")],
                       weak_refatter=[("Glyceryl Oleate", "after Parfum"), ("Hydrogenated Palm Glycerides Citrate", "after Parfum"), ("Lecithin", "after Parfum"), ("Ascorbyl Palmitate", "")],
                       excluded=[("Glycol Distearate", "pearlizer"), ("Laureth-4", "thickener")],
                       reset=[("Sodium Laureth Sulfate", "anionic"), ("Cocamidopropyl Betaine", "amphoteric")],
                       humectant_context=[("Urea", ""), ("Glycerin", ""), ("Sodium Lactate", ""), ("Panthenol", "")]),
    focusP=focusP("scalp_active", "moderate", "moisture", "scalp_active: 'speziell für trockene sowie empfindliche Haut und Kopfhaut entwickelt' and 'schützt zudem vor Juckreiz' (dm own-brand page, moderate) are E2 dry and sensitive scalp units; scalpComfortTarget targeted. F7: neither role in the product name -> scalp role primary.",
                  "moisture_supported", "candidate", "Body-wash/2-in-1 positioning; moisture wording for skin and hair competes.",
                  "sensitive + dry scalp", True, "Urea 3 + Panthenol 8 + Allantoin 9 comfort routes; Glycerin 5 humectant", "F7 step 2.",
                  [F(b, "Urea", "comfort/humectant"), F(b, "Panthenol", "comfort"), F(b, "Allantoin", "comfort")], mroutes=["Urea 3", "Glycerin 5", "Sodium Lactate 7", "Panthenol 8"], limitation="Humectants are the scalp route."),
    focusS=focusS([], "moderate", ["moisture"], "Empty: the lengths-moisture wording ('dem Austrocknen von Haut und Haar entgegenwirken') would rest on the same Urea/Glycerin/Panthenol route the scalp role cites (F3); the only other routes are late guar/refatters.",
                  "Moisture wording.", why="Shared humectant route."),
    usage=usage("regular", "high", None, "Default regular: no frequency wording, no dandruff claim, no reset intent.", "None."),
    sct=sct("targeted", "moderate", "not_targeted", "Targeted: SC1 (dry and sensitive scalp unit, moderate) and CSA (prominent Urea 3, Panthenol 8, Allantoin 9, Glycerin 5) both hold; Parfum is declared (counter-signal).",
            "Declared Parfum; moderate-grade positioning.", [F(b, "Urea", "comfort/humectant"), F(b, "Allantoin", "comfort"), F(b, "Glycerin", "humectant")]),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="sensitive", pconf="moderate", prat="S-SENSITIVE passes (E2 sensitive unit 'empfindliche ... Kopfhaut', moderate; targeted; comfort routes Urea/Panthenol/Allantoin). S-DRY also passes (same unit names 'trockene ... Kopfhaut'; humectant routes). No name preference -> S-PRIMARY order puts sensitive first. Piroctone Olamine without dandruff claim does not restrict these paths (R17.3).",
                 secondary="dry", sconf="moderate", srat="S-DRY: dry-scalp unit (moderate) + targeted + prominent humectant route (Urea 3, Glycerin 5, Panthenol 8); a unit naming two non-dandruff states counts for both (E2a)."),
    notes=["active_without_dandruff_positioning"],
    changes=changes(),
    uncertainties=[
        {"reading": "A combined 'Duschgel & Shampoo' is classified as a regular shampoo", "alternative": "identity/scope question for the orchestrator"},
        {"reading": "one unit names both dry and sensitive scalp -> two targets", "alternative": "sensitive only"},
        {"reading": "conditioningLevel low", "alternative": "moderate (humectant cluster + late guar/refatters)"}],
)

# ============================================================ T116 Herbal Essences Fiji
b = "T116"
D[b] = dict(
    name="Herbal Essences Shampoo Fiji (Schwerelose Feuchtigkeit)",
    facts=dict(cs=[F(b, "Sodium Cocoyl Isethionate", "mild anionic"), F(b, "Lauramidopropyl Betaine", "amphoteric"), F(b, "Cocamidopropyl Betaine", "amphoteric")],
               cl=[F(b, "Polyquaternium-10", "cationic, after Parfum")]),
    weightFamilies=fam(b, cationic_polymer=[("Polyquaternium-10", "after Parfum")], excluded=[("Citrus Aurantium Peel Oil", "essential oil")],
                       reset=[("Sodium Cocoyl Isethionate", "mild anionic"), ("Lauramidopropyl Betaine", "amphoteric"), ("Cocamidopropyl Betaine", "amphoteric"), ("Sodium Lauroyl Sarcosinate", "mild anionic")]),
    weightNote="'schwerelose Feuchtigkeit' / 'ohne zu beschweren' never lowers the band. 'Kokosnussextrakt' maps to Cocos Nucifera Fruit Juice (25).",
    focusP=focusP("general", "moderate", "moisture", "General: moisture positioning ('Shampoo für schwerelose Feuchtigkeit', manufacturer, moderate; 'Feuchtigkeitsshampoo', retailer) over a nonspecific formula (no humectant cluster: Glycerin 24 late; only PQ-10 after Parfum) -> F1 general.",
                  "nonspecific", "not_applicable", "Consistent moisture positioning.",
                  "moisture", False, "none", "Moisture claim over a nonspecific verdict -> general.", [F(b, "Polyquaternium-10", "light conditioning"), F(b, "Glycerin", "late humectant")]),
    focusS=focusS([], "high", None, "Empty.", "None."),
    usage=usage("regular", "high", None, "Default regular.", "None."),
    sct=sct("not_targeted", "high", None, "No scalp claim.", "None."),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="ordinary", pconf="high", prat="S-ORDINARY way 1; manufacturer source present -> high.", noSecondary="No qualifying claim unit."),
    notes=[], changes=changes(),
    uncertainties=[{"reading": "focusPrimary general (nonspecific verdict)", "alternative": "moisture"}],
)

# ============================================================ T117 Pantene Miracles Hydra Glow
b = "T117"
D[b] = dict(
    name="PANTENE PRO-V Shampoo miracles Hydra Glow",
    facts=dict(cs=[F(b, "Sodium Laureth Sulfate", "defining anionic (C1)"), F(b, "Cocamidopropyl Betaine", "buffer")],
               cl=[F(b, "Stearyl Alcohol", "payload_lipid"), F(b, "Cetyl Alcohol", "fatty route"), F(b, "Polyquaternium-6", "cationic_polymer"), F(b, "Guar Hydroxypropyltrimonium Chloride", "cationic_polymer"), F(b, "Glycerin", "humectant")]),
    weightFamilies=fam(b, payload_lipid=[("Stearyl Alcohol", "prominent"), ("Cetyl Alcohol", ""), ("Trihydroxystearin", "waxy rheology lipid")],
                       cationic_polymer=[("Polyquaternium-6", ""), ("Guar Hydroxypropyltrimonium Chloride", "")],
                       reset=[("Sodium Laureth Sulfate", "anionic"), ("Cocamidopropyl Betaine", "amphoteric")],
                       humectant_context=[("Glycerin", ""), ("Panthenol", ""), ("Sodium Hyaluronate", "")]),
    weightNote="'ganz ohne zu beschweren' (retailer, low) never lowers the band. 'Baobab-Essenz' has no INCI match (botanical marketing name, no property role -> note, ID-3).",
    focusP=focusP("moisture", "moderate", "general", "Moisture: 'Hydra' in the exact product name (high) plus retailer moisture copy; formula verdict moisture_supported (Glycerin, Panthenol, Sodium Hyaluronate with fatty-alcohol/cationic support).",
                  "moisture_supported", "candidate", "Humectants are after Parfum; 'Glow' (shine) also in the name.",
                  "moisture", True, "Glycerin 12 + Panthenol 20 + Sodium Hyaluronate 23 with Stearyl Alcohol 6 / PQ-6 14 / Guar 15", "Name claim with moisture_supported verdict (F1).",
                  [F(b, "Glycerin", "humectant"), F(b, "Sodium Hyaluronate", "humectant"), F(b, "Stearyl Alcohol", "emollient support")],
                  mroutes=["Glycerin 12", "Panthenol 20", "Sodium Hyaluronate 23"], shared=["Stearyl Alcohol 6", "Cetyl Alcohol 9", "Polyquaternium-6 14", "Guar 15"], limitation="Humectants late."),
    focusS=focusS([], "moderate", ["shine"], "Empty: 'Glow' shine is delivered by the same fatty-alcohol/cationic smoothing route as the moisture role (F2).",
                  "Shine in the name.", claims=["Glow (name)"], why="Same smoothing route (F2/F3)."),
    usage=usage("regular", "high", None, "Default regular: daily-use wording only in Müller copy (low).", "Daily wording (low)."),
    sct=sct("not_targeted", "high", None, "No scalp claim.", "None."),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="ordinary", pconf="moderate", prat="S-ORDINARY way 1: no qualifying E2 claim; retailer copy only -> moderate.", noSecondary="No qualifying claim unit."),
    notes=[], changes=changes(),
    uncertainties=[
        {"reading": "weightPotential moderate (W-RICH, moderate reset)", "alternative": "high"},
        {"reading": "conditioningLevel high via C2 (fatty alcohol in place of silicone)", "alternative": "moderate if the fatty alcohols are read as opacifiers"}],
)

# ============================================================ T118 Sebamed Every-Day
b = "T118"
D[b] = dict(
    name="Sebamed Every-Day Shampoo",
    facts=dict(cs=[F(b, "Decyl Glucoside", "earliest surfactant, glucoside"), F(b, "Disodium Laureth Sulfosuccinate", "mild anionic"), F(b, "Sodium Lauryl Sulfoacetate", "mild anionic")],
               cl=[F(b, "Hydroxypropyl Oxidized Starch PG-Trimonium Chloride", "cationic, after Parfum")]),
    weightFamilies=fam(b, cationic_polymer=[("Hydroxypropyl Oxidized Starch PG-Trimonium Chloride", "after Parfum")], excluded=[("PEG-55 Propylene Glycol Oleate", "PEG thickener")],
                       reset=[("Decyl Glucoside", "nonionic"), ("Disodium Laureth Sulfosuccinate", "mild anionic"), ("Sodium Lauryl Sulfoacetate", "mild anionic")]),
    focusP=focusP("general", "moderate", "scalp_active", "General: the sensitive-scalp unit exists, but scalpComfortTarget is not_targeted (CSA fails), so scalp_active is incompatible; 'Every-Day'/mild positioning is not a focus (7.2).",
                  "not_applicable", "not_applicable", "Explicit 'für empfindliche Kopfhaut' headline.",
                  "sensitive scalp", False, "none (no listed prominent comfort/humectant route)", "Incompatible scalp claim; mildness not a focus -> general.", [F(b, "Decyl Glucoside", "mild chassis")]),
    focusS=focusS([], "high", None, "Empty.", "None."),
    usage=usage("frequent", "high", None, "frequent: 'Every-Day' in the exact product name (high), 'für die tägliche Haarwäsche' and 'Für die tägliche Anwendung geeignet' (manufacturer, moderate); cleansingStrength low (not strong).",
                "None.", "explicit_frequent_non_strong", ["name: 'Every-Day'", "manufacturer: 'seifenfreies Shampoo für die tägliche Haarwäsche'", "directions: 'Für die tägliche Anwendung geeignet'"]),
    sct=sct("not_targeted", "high", None, "Not targeted: SC1 holds ('Schonende, seifenfreie Reinigung für empfindliche Kopfhaut', manufacturer, moderate) but CSA fails — no prominent E4 comfort or humectant/refatting route (Sodium Lactate 14 is after Parfum); a mild chassis and pH 5.5 are not sufficient (CSA).",
            "Mild glucoside chassis, pH 5.5 (supportive signals only).", [F(b, "Sodium Lactate", "humectant list, after Parfum")]),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="ordinary", pconf="moderate", prat="S-ORDINARY way 4 (S-FAIL): the sensitive unit's formula gate fails (scalpComfortTarget not_targeted, no prominent comfort route) and no other specialist target passes -> ordinary proposed with review_specialist_gate_failed. Confidence moderate.",
                 noSecondary="'schützt Kopfhaut und Haar vor dem Austrocknen' is protective (no dry unit)."),
    flags=["review_specialist_gate_failed:sensitive(formula gate: scalpComfortTarget not_targeted — no prominent E4 comfort or humectant route)"],
    notes=[], changes=changes(),
    uncertainties=[
        {"reading": "'Schonende ... Reinigung für empfindliche Kopfhaut' qualifies as a 'für …' sensitive unit (SC1) -> S-FAIL review", "alternative": "sparing/tolerance wording under a gentle-cleansing heading (E2a) -> no unit, S-ORDINARY way 1 (high), no flag"}],
)

# ============================================================ T119 Elvital Hydra Hyaluronic
b = "T119"
D[b] = dict(
    name="L'Oréal Paris Elvital Hydra Hyaluronic 72H Feuchtigkeit-Auffüllendes Shampoo",
    facts=dict(cs=[F(b, "SODIUM LAURETH SULFATE", "defining anionic (C1)"), F(b, "COCAMIDOPROPYL BETAINE", "buffer"), F(b, "COCO-BETAINE", "buffer")],
               cl=[F(b, "DIMETHICONE", "early silicone"), F(b, "GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE", "cationic"), F(b, "GLYCOL DISTEARATE", "pearlizing route"), F(b, "SODIUM HYALURONATE", "humectant (C2)")]),
    weightFamilies=fam(b, silicone=[("DIMETHICONE", "prominent"), ("AMODIMETHICONE", "late")], cationic_polymer=[("GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE", "")],
                       excluded=[("GLYCOL DISTEARATE", "pearlizer"), ("PEG-100 STEARATE", "PEG emulsifier"), ("STEARETH-6", "emulsifier"), ("CARBOMER", "anionic acrylate thickener (6.4)")],
                       reset=[("SODIUM LAURETH SULFATE", "anionic"), ("COCAMIDOPROPYL BETAINE", "amphoteric"), ("COCO-BETAINE", "amphoteric")]),
    weightNote="'ganz ohne zu Beschweren' (moderate) never lowers the band; W1 decides.",
    focusP=focusP("general", "moderate", "moisture", "General: the name ('Hydra', 'Feuchtigkeit-Auffüllendes', high) positions moisture, but the formula verdict is nonspecific — a single (probably trace) Sodium Hyaluronate is not a coherent humectant cluster; the silicone/guar system is generic conditioning (F1).",
                  "nonspecific", "not_applicable", "Strong, consistent moisture positioning.",
                  "moisture", False, "none (single humectant token)", "Moisture claim over a nonspecific verdict -> general.",
                  [F(b, "SODIUM HYALURONATE", "single humectant"), F(b, "DIMETHICONE", "generic conditioning")], mroutes=["Sodium Hyaluronate 13"], shared=["Dimethicone 6", "Guar 8", "Amodimethicone 23"], limitation="One humectant token."),
    focusS=focusS([], "high", None, "Empty: shine/Schwung are outcomes of the silicone route (F2).", "None."),
    usage=usage("regular", "high", None, "Default regular.", "None."),
    sct=sct("not_targeted", "high", None, "No E2 scalp claim ('versorgt Kopfhaut und Längen mit Feuchtigkeit' does not name a dry/sensitive scalp state).", "Scalp-moisture wording."),
    D1=d1(False, "high", "No D1 wording."),
    targets=dict(primary="ordinary", pconf="high", prat="S-ORDINARY way 1; manufacturer source present -> high.", noSecondary="No qualifying claim unit."),
    notes=[], changes=changes(),
    uncertainties=[{"reading": "focusPrimary general (single hyaluronate is nonspecific)", "alternative": "moisture (dual/moisture_supported if the silicone/guar system is accepted as conditioning support for one humectant)"}],
)

json.dump(D, open(os.path.join(LANE, "out", "tools", "data.json"), "w"), indent=1, ensure_ascii=False)
print("ok", len(D))
