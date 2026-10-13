import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from phase2_engine import build

REV = "reveal positioning sources"


def F(value, conf, rationale, facts, counter, neighbor, verdict, claim_role, claim_dir, compatible, route, reason, care_extra=None):
    care = {"verdict": verdict}
    if care_extra:
        care.update(care_extra)
    return {
        "focusPrimary": {"value": value, "confidence": conf, "rationale": rationale,
                         "formulaFacts": [{"ingredient": i, "position": p} for i, p in facts],
                         "counterSignal": counter, "neighboringAlternative": neighbor, "sources": [REV, "formula packet"]},
        "_care": care, "_claimRole": claim_role,
        "_trace": {"claimDirection": claim_dir, "formulaCompatible": compatible, "compatibleRoute": route, "decisionReason": reason},
    }


def S2(value, conf, rationale, neighbor, claims, routes, why, exc=None):
    return {"value": value, "confidence": conf, "rationale": rationale, "formulaFacts": [], "counterSignal": [why],
            "neighboringAlternative": neighbor, "sources": [REV],
            "_trace": {"emptyDefaultConsidered": True, "selected": value, "matchingDistinctClaims": claims,
                       "independentRoutes": routes, "whyDistinctFromPrimary": why, "exceptionCode": exc}}


def U(value, conf, code, evidence, rationale, neighbor, losing=None):
    return {"value": value, "confidence": conf, "rationale": rationale, "triggerCode": code, "triggerEvidence": evidence,
            "losingTriggers": losing or [], "formulaFacts": [], "counterSignal": [r for r in (losing or [])] or ["none"],
            "neighboringAlternative": neighbor, "sources": [REV]}


def SC(value, conf, rationale, counter, neighbor, facts=None):
    return {"value": value, "confidence": conf, "rationale": rationale, "formulaFacts": facts or [], "counterSignal": counter,
            "neighboringAlternative": neighbor, "sources": [REV, "formula packet"]}


def T(target, conf, rationale):
    return {"target": target, "confidence": conf, "rationale": rationale}


def D1(value, conf, rationale):
    return {"value": value, "confidence": conf, "rationale": rationale}


def run(bid, fp, sec, usage, comfort, primary, d1, changes, grading, secondary_target=None, flags=None, notes=None, rct=None, unc=None, dcl="not_flagged"):
    spec = {
        "focusPrimary": fp["focusPrimary"], "focusSecondary": {k: v for k, v in sec.items() if not k.startswith("_")},
        "focusRecord": {"careDirection": fp["_care"], "claimRole": fp["_claimRole"],
                        "counterSignal": fp["focusPrimary"]["counterSignal"], "neighboringAlternative": fp["focusPrimary"]["neighboringAlternative"],
                        "decisionTrace": {"primary": fp["_trace"], "secondary": sec["_trace"],
                                          "usageRole": {"default": "regular", "triggerCode": usage["triggerCode"], "triggerEvidence": usage["triggerEvidence"],
                                                        "losingTriggers": usage["losingTriggers"], "rationale": usage["rationale"]}}},
        "usageRole": usage, "scalpComfortTarget": comfort,
        "targets": {"primary": primary, "secondary": secondary_target},
        "d1": d1, "changes": changes, "claimGrading": grading,
        "flags": flags or [], "notes": notes or [], "rct": rct or [], "uncertainties": unc or [], "deepCleanserListing": dcl,
    }
    r = build(bid, spec)
    p = r["projection"]
    print(bid, r["focusPrimary"]["value"], r["usageRole"]["value"], r["scalpComfortTarget"]["value"], [t["fit"] for t in p["thicknesses"]],
          p["weight"]["value"], p["scalpTargets"]["primary"]["target"], (p["scalpTargets"]["secondary"] or {}).get("target"),
          p["observedCleansingIntensity"]["value"], p["reviewFlags"], p["informationalNotes"], p["researchCombinationTargets"], r.get("status"))


NO_D1 = D1(False, "high", "D1: no D1 stem (tiefenrein / deep clean / clarifying shampoo / detox-reinigung) in name or manufacturer/pack claims, no occasional-use directions.")
CH_STD = [{"property": "cleansingStrength/conditioningLevel/weightPotential/dandruffSupport", "blind": "see formula-pass", "final": "unchanged", "evidence": "formula-only properties; no material formula conflict exposed by the reveal"}]

# ------------------------------------------------------------------ T401 Pantene Anti Schuppen
run("T401",
    F("scalp_active", "high", "Anti-dandruff is the dominant exact-product role: 'Anti Schuppen' in the product name (high, CL-SRC) and the recognised active Piroctone Olamine (14) make it a problem-led anti-dandruff product (7.2).",
      [("Piroctone Olamine", 14)], ["retailer copy (low) stresses Pflege/Glanz; nothing lengths-care in the name"], "none", "not_applicable", "candidate",
      "anti-dandruff (name, high)", True, "Piroctone Olamine (14) recognised active", "7.2 problem-led product with active + dandruff positioning"),
    S2([], "high", "Empty: Pflege/Glanz/Nährstoffe claims are retailer-only (low) and cannot carry a secondary; the shine benefit would ride on the same silicone route (F2).", "none", [], [], "no distinct moderate/high positioning"),
    U("treatment", "high", "recognized_active_problem_led", ["product name: 'Anti Schuppen' (high)", "Piroctone Olamine (14)"],
      "U3: dandruffSupport supported + qualifying E2 dandruff claim graded high. 'ideal für die tägliche Anwendung' is retailer-only (low) and cannot fire frequent.", "none"),
    SC("not_targeted", "high", "No E2 sensitive/dry unit graded moderate/high ('Pflegende Wirkung auf die Kopfhaut' is retailer copy and outside the lexicon); CSA also fails (no prominent listed route).", ["none"], "none"),
    T("dandruff", "high", "S-DANDRUFF: E2 dandruff claim 'Anti Schuppen' in the exact product name (E1 high) + dandruffSupport supported (high). Dandruff path, primary (S-PRIMARY, R17.1); no secondary (R17.2)."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "scalp_active", "evidence": "product name 'Anti Schuppen'", "reason": "claim identifies the anti-dandruff job; active present"},
     {"property": "usageRole", "blind": "regular (provisional)", "final": "treatment", "evidence": "name dandruff claim + Piroctone Olamine", "reason": "U3"},
     {"property": "scalpComfortTarget", "blind": "not_targeted (provisional, low)", "final": "not_targeted (high)", "evidence": "no SC1 unit", "reason": "confirmed"}] + CH_STD,
    {"productName": "high (E1)", "dm.de PDP": "low (retailer)", "Rossmann PDP": "low (retailer)"})

# ------------------------------------------------------------------ T402 Balea Hydra Volume
run("T402",
    F("volume", "moderate", "Volume is the dominant job: 'Volume' in the exact name (high), headline 'Volumenshampoo' and 'Fülle' (manufacturer, moderate); the formula is compatible (weightPotential low, no silicone, light single-guar deposition).",
      [("Guar Hydroxypropyltrimonium Chloride", 9), ("Kaolin", 8)], ["'Hydra' in name and 'Feuchtigkeitsspendend' compete; moisture verdict nonspecific"], "moisture", "nonspecific", "candidate",
      "volume (name + manufacturer)", True, "light low-deposition architecture (W low; Kaolin, single guar)", "7.2 dominant compatible claim",
      {"moistureRoutes": ["Sodium Hyaluronate 6"], "repairRoutes": [], "sharedRoutes": ["Guar 9"], "limitation": "one humectant is not a coherent cluster (7.3)"}),
    S2([], "moderate", "Moisture considered ('Hydra', 'Feuchtigkeitsspendend', 'Feuchtigkeit bis in die Spitzen'), but the care-direction verdict is nonspecific (single humectant Sodium Hyaluronate 6), so F1 keeps moisture out.", ["moisture"],
       ["Hydra (name)", "Feuchtigkeitsspendend (manufacturer)"], ["Sodium Hyaluronate 6 (not a cluster)"], "route not moisture_supported"),
    U("regular", "high", "none", [], "No frequency wording; cleansing not strong (no alternating); no D1; no active.", "none"),
    SC("not_targeted", "high", "Only protective wording ('pH-hautneutrale Formel', 'Hautverträglichkeit dermatologisch bestätigt'); no E2 sensitive/dry unit. CSA would pass but positioning is absent.", ["none"], "none"),
    T("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 unit ('platten Ansatz' is not an oil/sebum claim); manufacturer source present -> high."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "volume", "evidence": "name 'Hydra Volume', 'Volumenshampoo'", "reason": "dominant compatible claim"},
     {"property": "focusSecondary", "blind": "[] (provisional)", "final": "[]", "evidence": "moisture claims", "reason": "verdict nonspecific"}] + CH_STD,
    {"productName": "high", "manufacturer_de (dm own brand)": "moderate", "database user upload": "low"},
    unc=[{"reading": "secondary [] because moisture verdict nonspecific", "alternative": "['moisture'] if Sodium Hyaluronate + guar is read as moisture_supported"}])

# ------------------------------------------------------------------ T403 ISANA MED Totes Meer
run("T403",
    F("general", "moderate", "The only role claimed is sensitive/itchy scalp ('beruhigt empfindliche und juckende Kopfhaut', pack back, moderate), but scalp_active needs scalpComfortTarget targeted (7.2), which fails CSA; no lengths-care claim remains ('Schutz vor Austrocknung' is protective). -> general.",
      [], ["explicit sensitive-scalp positioning that the formula half does not support"], "scalp_active", "not_applicable", "not_applicable",
      "sensitive scalp (pack back, moderate)", False, "none: no prominent E4 comfort route", "positioned specialist role formula-incompatible -> general"),
    S2([], "high", "No other distinct positioning.", "none", [], [], "none"),
    U("regular", "high", "none", [], "No frequency wording, no D1, no active.", "none"),
    SC("not_targeted", "moderate", "SC1 holds (E2 sensitive units graded moderate: 'beruhigt empfindliche und juckende Kopfhaut', 'juckreizlindernder Wirkstoff-Komplex'), but CSA fails: no listed E4 route is prominent (Allantoin 11, Bisabolol 12, Glycerin 17 are after Parfum 7); the prominent unlisted Lauryl Lactate (4) cannot count (closed lists, R16.4).",
       ["explicit sensitive positioning", "unlisted_route_candidate:Lauryl Lactate"], "targeted", [{"ingredient": "Allantoin", "position": 11}, {"ingredient": "Bisabolol", "position": 12}, {"ingredient": "Lauryl Lactate", "position": 4}]),
    T("ordinary", "moderate", "S-ORDINARY way 4: the claimed sensitive target failed its formula gate (S-SENSITIVE: not targeted, no prominent comfort route) and nothing else passed -> ordinary proposed with review_specialist_gate_failed."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "general", "evidence": "sensitive-scalp claims", "reason": "scalp_active incompatible (CSA fails)"},
     {"property": "scalpComfortTarget", "blind": "not_targeted (provisional; CSA fail)", "final": "not_targeted", "evidence": "SC1 positioning present, CSA fails", "reason": "CSA"}] + CH_STD,
    {"pack back": "moderate", "Rossmann (labelled manufacturer_de)": "moderate"},
    flags=["review_specialist_gate_failed:sensitive (formula gate: scalpComfortTarget not targeted (CSA) and no prominent E4 comfort route; Allantoin 11/Bisabolol 12 after Parfum; unlisted_route_candidate:Lauryl Lactate)"],
    unc=[{"reading": "'Schutz vor Austrocknung für Kopfhaut & Haar' = protective wording, not an E2 dry unit", "alternative": "dry unit -> S-DRY would also fail (CSA)"}])

# ------------------------------------------------------------------ T404 NIVEA 2in1 Express
run("T404",
    F("general", "moderate", "Claims are spread across generic express care, combability, strengthening/anti-breakage and natural shine with no dominant job; the name ('2in1 Express Shampoo & Spülung') names no role (C7: 2-in-1 adds nothing). The care-direction verdict is nonspecific, so the repair language cannot become repair (F1). -> general.",
      [], ["shine claims ('Glanz-Serum', 'natürlichen Glanz') and strengthening/'schützt vor Haarbruch' (manufacturer, moderate)"], "shine", "nonspecific", "not_applicable",
      "mixed: Pflege, Kämmbarkeit, Glanz, Haarstruktur", True, "generic conditioning (guar 9, lipids 10/14)", "unsupported/generic claims -> general",
      {"repairRoutes": [], "moistureRoutes": ["Glycerin 12"], "sharedRoutes": ["Guar 9", "Dicaprylyl Ether 10", "Hydrogenated Castor Oil 14"], "limitation": "no protein/damage cluster, single humectant"}),
    S2([], "moderate", "No secondary on a general primary without a distinct, independently routed role; shine would share the lipid/guar route.", ["shine"], ["Glanz-Serum"], [], "F2/F3: same deposition route"),
    U("regular", "high", "none", [], "No frequency wording ('in kürzester Zeit' is speed, not frequency).", "none"),
    SC("not_targeted", "high", "'Reinigt sanft die Kopfhaut' and 'Hautverträglichkeit dermatologisch bestätigt' are mildness/protective (E2a).", ["none"], "none"),
    T("ordinary", "high", "S-ORDINARY way 1 with manufacturer source -> high."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "general (moderate)", "evidence": "mixed claims", "reason": "no dominant compatible job"}] + CH_STD,
    {"manufacturer_de": "moderate", "dm.de": "low"},
    unc=[{"reading": "focus general", "alternative": "shine (Glanz-Serum = light lipid film)"},
         {"reading": "'ohne zu beschweren' ignored for weight (6.5)", "alternative": "n/a"}])

# ------------------------------------------------------------------ T405 Monday Volume Kraft & Fülle
run("T405",
    F("general", "moderate", "The name 'Volume Kraft & Fülle' (high) claims volume, but the formula is not compatible with a lift/body job: weightPotential high (W-RICH coconut oil + four cationic polymers, weak C6 reset). The remaining claims (hydrate/shine on the English manufacturer page, low per E1; German retailer copy, low) cannot carry a focus without an independent formula verdict (nonspecific). -> general.",
      [("Cocos Nucifera (Coconut) Oil", 11), ("Polyquaternium-10", 13)], ["volume positioning in the exact name"], "volume", "nonspecific", "not_applicable",
      "volume (name, high)", False, "none: weightPotential high contradicts lift", "positioned focus formula-incompatible -> general"),
    S2([], "high", "No distinct qualifying positioning.", "none", [], [], "none"),
    U("regular", "high", "none", [], "No moderate/high frequency wording; cleansing low.", "none"),
    SC("not_targeted", "high", "No E2 sensitive/dry unit.", ["none"], "none"),
    T("ordinary", "moderate", "S-ORDINARY way 4 (with way 1 for every other target): an oily unit exists only as 'thin, fine or oily hair' on the English-language manufacturer page (E1: graded low), so S-OILY's positioning gate fails; its formula clause also fails (weightPotential high). No other specialist target -> ordinary with review_specialist_gate_failed."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "general", "evidence": "name 'Volume'", "reason": "formula incompatible (W high)"}] + CH_STD,
    {"productName": "high", "manufacturer page (English text, labelled manufacturer_de)": "low (E1 foreign-language rule; no German source repeats hydrate/oily claims)", "hagel/amazon/sunside/dm.at": "low"},
    flags=["review_specialist_gate_failed:oily (positioning gate: only an English-language manufacturer unit 'oily hair', graded low; formula clause: weightPotential high)"],
    notes=["hair_loss_claim_not_evaluated (retailer 'gesundes Haarwachstum', low)"],
    unc=[{"reading": "English manufacturer page graded low (E1 foreign-language page)", "alternative": "moderate (labelled manufacturer_de) -> oily positioning would pass but S-OILY still fails on weight"},
         {"reading": "'oily hair' treated as an (low-graded) oily claim unit -> S-FAIL review", "alternative": "outside lexicon -> S-ORDINARY way 1, no flag"},
         {"reading": "The name resembles the register entry X1 (13.12). X1 NOT applied: lanes may not infer an exception, and X1 requires the E2 oily positioning gate to pass, which it does not here.", "alternative": "orchestrator decides"},
         {"reading": "focus general (volume incompatible with W high)", "alternative": "volume with W high as counter-signal"}])

# ------------------------------------------------------------------ T406 Salthouse Anti Schuppen
run("T406",
    F("scalp_active", "high", "'Anti Schuppen' in the exact name (high) plus Piroctone Olamine (5): problem-led anti-dandruff (7.2).",
      [("Piroctone Olamine", 5)], ["comfort wording (irritiert, Juckreiz, Spannungsgefühle) is bundled with dandruff"], "none", "not_applicable", "candidate",
      "anti-dandruff (name)", True, "Piroctone Olamine (5)", "7.2 problem-led"),
    S2([], "high", "No lengths-care positioning.", "none", [], [], "none"),
    U("treatment", "high", "recognized_active_problem_led", ["name 'Anti Schuppen' (high)", "'Anti-Schuppen Wirkstoff Pirocton Olamin' (manufacturer)", "Piroctone Olamine (5)"],
      "U3; U1 precedence over frequent ('Für die tägliche Haarwäsche geeignet', manufacturer moderate, cleansing not strong), which is recorded as losing.", "none", ["frequent: explicit_frequent_non_strong ('Für die tägliche Haarwäsche geeignet')"]),
    SC("not_targeted", "high", "Sensitive/dry wording sits inside or next to dandruff units ('irritierter, trockener und dadurch schuppenanfälliger Kopfhaut', 'Hautproblem: Juckreiz, ..., Schuppen, ..., Spannungsgefühle'), so it is bundled (E2a/E2b) and not SC1; 'Hauttyp: empfindliche ... Haut' names skin, not scalp, and is adjacent. CSA also fails (no prominent listed route).", ["comfort wording present but bundled"], "none"),
    T("dandruff", "high", "S-DANDRUFF: 'Anti Schuppen' in the name (high) + supported (high). Primary dandruff, no secondary (R17.2)."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "scalp_active", "evidence": "name", "reason": "7.2"},
     {"property": "usageRole", "blind": "regular (provisional)", "final": "treatment", "evidence": "dandruff claim + active", "reason": "U3/U1"}] + CH_STD,
    {"productName": "high", "manufacturer_de": "moderate", "Rossmann": "low"},
    notes=["dandruff_bundled_comfort_wording ('wirkt wohltuend bei irritierter ... schuppenanfälliger Kopfhaut'; 'Juckreiz', 'Spannungsgefühle'; manufacturer, moderate; S-SENSITIVE formula gate failed: CSA fails and no prominent E4 comfort route)"],
    unc=[{"reading": "Neurodermitis/Psoriasis 'Basispflege' wording treated as medical, out of scope", "alternative": "none"}])

# ------------------------------------------------------------------ T407 Sebamed Anti-Schuppen
run("T407",
    F("scalp_active", "high", "'Anti-Schuppen' in the exact name (high) plus Piroctone Olamine (6): problem-led anti-dandruff.",
      [("Piroctone Olamine", 6)], ["sensitive-scalp wording in the same sentence"], "none", "not_applicable", "candidate",
      "anti-dandruff (name)", True, "Piroctone Olamine (6)", "7.2 problem-led"),
    S2([], "high", "No lengths-care positioning.", "none", [], [], "none"),
    U("treatment", "high", "recognized_active_problem_led", ["name 'Anti-Schuppen'", "'Mit dem Wirkstoff Piroctone Olamine hilft es, Schuppen ... zu bekämpfen' (manufacturer)"],
      "U3; frequent also fires ('zur täglichen Reinigung', 'Täglich oder 2-3x pro Woche', manufacturer moderate; cleansing moderate) and loses by U1.", "none", ["frequent: explicit_frequent_non_strong"]),
    SC("not_targeted", "moderate", "The only moderate sensitive wording ('... Anti-Schuppen Shampoo ist eine seifenfreie Pflege ..., die speziell auf die Bedürfnisse empfindlicher Kopfhaut abgestimmt ist') sits in a unit naming the anti-dandruff product, so it is read as bundled (P0) and is not SC1; 'Für empfindliche Kopfhaut' is retailer-only (low). CSA itself passes (Sodium Lactate 10).",
       ["if the sentence were read as a separate unit, SC1 + CSA would give targeted"], "targeted"),
    T("dandruff", "high", "S-DANDRUFF: name 'Anti-Schuppen' (high) + supported (high). Primary dandruff, no secondary."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "scalp_active", "evidence": "name", "reason": "7.2"},
     {"property": "usageRole", "blind": "regular (provisional)", "final": "treatment", "evidence": "dandruff claim + active", "reason": "U3"},
     {"property": "scalpComfortTarget", "blind": "not_targeted (provisional, CSA pass)", "final": "not_targeted (moderate)", "evidence": "sensitive wording bundled", "reason": "E2b/SC1"}] + CH_STD,
    {"productName": "high", "manufacturer_de": "moderate", "dm.de": "low", "mueller.de": "low"},
    notes=["dandruff_bundled_comfort_wording ('speziell auf die Bedürfnisse empfindlicher Kopfhaut abgestimmt', manufacturer moderate; S-SENSITIVE formula gate failed: no prominent E4 comfort route although CSA passes via Sodium Lactate 10)",
           "suits_dandruff_with_oily_scalp ('Haartyp: ... fettiges Haar', manufacturer moderate; S-OILY clause passes: cleansing moderate, W low, C low)"],
    rct=["oily"],
    unc=[{"reading": "'Haartyp: fettiges Haar' counted as E2 oily wording (sebum claim, cf. 'schnell fettendes Haar')", "alternative": "outside lexicon -> researchCombinationTargets [] (research-only, no projection effect)"},
         {"reading": "sensitive sentence bundled", "alternative": "separate -> scalpComfortTarget targeted; projection unchanged (dandruff-primary)"}])

# ------------------------------------------------------------------ T408 Balea Tiefenreinigung
run("T408",
    F("clarifying", "high", "Explicit deep-cleansing product ('Tiefenreinigung' in name, 'Tiefenreinigendes Shampoo', removes styling residue and excess oil from hair and scalp) with compatible architecture (F6: cleansing moderate, conditioning moderate, weight low).",
      [("Sodium Laureth Sulfate", 2), ("Menthol", 9)], ["formula is an ordinary C1 chassis, not a strong reset"], "none", "not_applicable", "candidate",
      "deep cleansing / oily scalp (name + manufacturer)", True, "lean C1 chassis with low deposition (guar 7, keratin 6 only)", "7.2 explicit deep-cleaning with compatible architecture"),
    S2([], "high", "'Leichtigkeit und Glanz' has no independent route (only pH acids, F4); not distinct.", "none", ["Glanz"], [], "F4: acids cannot create secondary shine"),
    U("occasional_reset", "high", "explicit_deep_cleansing", ["product name 'Tiefenreinigung' (high)", "'Tiefenreinigendes Shampoo' (manufacturer)"],
      "D1 true -> occasional_reset (U1 first). U5: manufacturer says 'für die tägliche Anwendung geeignet'; conflict recorded; formula is moderate, so it goes into deep_cleansing_name_ordinary_formula (no review flag).", "none",
      ["frequent: explicit_frequent_non_strong ('für die tägliche Anwendung geeignet')"]),
    SC("not_targeted", "high", "No E2 sensitive/dry unit.", ["none"], "none"),
    T("oily", "moderate", "S-OILY: E2 oily unit 'entfernt wirksam ... überschüssiges Fett von Haar und Kopfhaut' (manufacturer, moderate); formula clause passes (cleansing moderate, W low, C moderate). Confidence = min(positioning moderate, W moderate, C moderate)."),
    D1(True, "high", "D1 true: 'Tiefenreinigung' in the exact product name (stem tiefenrein, high); 'Deep-Cleanse-System' (manufacturer) also matches 'deep clean'."),
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "clarifying", "evidence": "Tiefenreinigung", "reason": "F6 compatible"},
     {"property": "usageRole", "blind": "regular (provisional)", "final": "occasional_reset", "evidence": "D1", "reason": "U1/U5"}] + CH_STD,
    {"productName": "high", "manufacturer_de (dm own brand)": "moderate"},
    notes=["deep_cleansing_name_ordinary_formula (D1 'Tiefenreinigung' in name; cleansingStrength moderate; daily-use direction 'für die tägliche Anwendung geeignet')"],
    unc=[{"reading": "'überschüssiges Fett von Haar und Kopfhaut' qualifies as E2 oily (Fett stem, names scalp, acts on it)", "alternative": "not lexicon -> ordinary target (way 1)"}])

# ------------------------------------------------------------------ T409 Elvital Glycolic Gloss 200 ml
run("T409",
    F("general", "moderate", "All usable shine claims ('Glanz', 'spiegelglatt', 'für stumpfes und glanzloses Haar') are retailer copy (low); the manufacturer page belongs to a different SKU (300 ml, sulfate-based) and is not evidence. A low claim can be a candidate only with independent formula support; the only shine route is acids (Glycolic Acid last at 35, Citric 31; F4), which is not independent support. -> general.",
      [("Glycolic Acid", 35)], ["consistent shine positioning across retailers"], "shine", "not_applicable", "not_applicable",
      "shine (retailer, low)", True, "acidic pH only (F4)", "low-graded claim without independent formula verdict -> general"),
    S2([], "high", "No qualifying positioning.", "none", [], [], "none"),
    U("regular", "high", "none", [], "No moderate/high trigger.", "none"),
    SC("not_targeted", "high", "No E2 unit.", ["none"], "none"),
    T("ordinary", "moderate", "S-ORDINARY way 1; the only manufacturer source is for a different SKU, so the packet effectively has retailer copy only -> moderate."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "general", "evidence": "retailer shine claims", "reason": "CL-SRC low"}] + CH_STD,
    {"dm.de": "low", "rossmann.de": "low", "manufacturer_de (different SKU)": "not evidence for this product"},
    unc=[{"reading": "focus general", "alternative": "shine (moderate cap) if Glycolic Acid is accepted as an independent smoothing route"},
         {"reading": "manufacturer page for the sulfate-based 300 ml SKU is a different formula, not a conflict with this frozen sulfate-free INCI (ID-3: no effect)", "alternative": "none"}])

# ------------------------------------------------------------------ T410 schauma Repair & Pflege
run("T410",
    F("repair", "moderate", "'Repair' in the exact name (high) and damage positioning ('repariert intensiv geschädigtes ... Haar', manufacturer). The formula verdict is dual_supported; the repair positioning breaks the tie (F1).",
      [("Amodimethicone", 13), ("Dimethicone", 14), ("Guar Hydroxypropyltrimonium Chloride", 5), ("Prunus Armeniaca (Apricot) Kernel Oil", 7)],
      ["'trockenes Haar' and moisture routes (Panthenol 6, Sorbitol 9) make moisture plausible"], "moisture", "dual_supported", "tie_breaker",
      "repair (name, high) with dry-hair co-claim", True, "amodimethicone/dimethicone/guar/oil deposition cluster", "dual_supported tie broken by name",
      {"repairRoutes": ["Amodimethicone 13", "Dimethicone 14", "Guar 5", "Apricot Kernel Oil 7"], "moistureRoutes": ["Panthenol 6", "Sorbitol 9"], "sharedRoutes": ["Guar 5", "Apricot Kernel Oil 7"], "limitation": "rinse-off"}),
    S2([], "moderate", "Moisture considered: 'trockenes Haar' appears only bundled into the repair claims ('Für strapaziertes & trockenes Haar', 'repariert ... geschädigtes und trockenes Haar'); 'spendet Feuchtigkeit' is retailer-only. No distinct exact-product moisture positioning (Section 8.1).", ["moisture"],
       ["trockenes Haar (inside repair claims)"], ["Panthenol 6", "Sorbitol 9"], "positioning not distinct from the repair claim"),
    U("regular", "high", "none", [], "No trigger.", "none"),
    SC("not_targeted", "high", "No scalp claims.", ["none"], "none"),
    T("ordinary", "high", "S-ORDINARY way 1 with manufacturer source."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional; verdict dual_supported)", "final": "repair", "evidence": "name 'Repair & Pflege'", "reason": "tie_breaker"}] + CH_STD,
    {"productName": "high", "manufacturer_de": "moderate", "dm.de": "low", "rossmann.de": "low"},
    unc=[{"reading": "secondary []", "alternative": "['moisture']"}])

# ------------------------------------------------------------------ T411 H&S DermaXPro Beruhigende Pflege
run("T411",
    F("scalp_active", "high", "Anti-dandruff and itchy-scalp role: 'Anti-Schuppen Wirkung mit Pirocton Olamin' and 'gegen Kopfhautjucken' (manufacturer, moderate) with Piroctone Olamine (6). Dandruff path.",
      [("Piroctone Olamine", 6)], ["name word 'Beruhigende' names no scalp role (F7)"], "none", "not_applicable", "candidate",
      "anti-dandruff + itchy scalp (manufacturer)", True, "Piroctone Olamine (6)", "7.2 problem-led"),
    S2([], "high", "'geschmeidiges Haar' is not distinct positioning.", "none", [], [], "none"),
    U("treatment", "high", "recognized_active_problem_led", ["'Anti-Schuppen Wirkung mit Pirocton Olamin - klinisch getestet' (manufacturer, moderate)", "Piroctone Olamine (6)"], "U3.", "none"),
    SC("not_targeted", "high", "SC1 holds via a separate moderate sensitive unit ('Shampoo gegen Kopfhautjucken'), but CSA fails: no listed E4 route is prominent (prominent = 2-11; Aloe juice and glycols are not listed). The record names the missing route.",
       ["separate itchy-scalp positioning"], "none"),
    T("dandruff", "moderate", "S-DANDRUFF: E2 dandruff unit 'Anti-Schuppen Wirkung mit Pirocton Olamin' (manufacturer, moderate; name has no 'Schuppen') + supported. Primary dandruff (R17.1), no secondary (R17.2)."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "scalp_active", "evidence": "manufacturer dandruff/itch claims", "reason": "7.2"},
     {"property": "usageRole", "blind": "regular (provisional)", "final": "treatment", "evidence": "dandruff claim + active", "reason": "U3"}] + CH_STD,
    {"productName": "high (no scalp role)", "manufacturer_de": "moderate", "dm.de/rossmann.de/b2b": "low"},
    notes=["dandruff_bundled_comfort_wording ('gegen Kopfhautjucken', 'Sofortige Linderung juckender Kopfhaut', 'Beruhigend bei trockener, juckender Kopfhaut (Juckreiz verbunden mit Schuppen)'; manufacturer moderate; S-SENSITIVE formula gate failed: CSA fails, no prominent E4 comfort route)",
           "dandruff_dry_scalp_wording ('für trockene, juckende Kopfhaut', separate unit only in retailer/b2b copy graded low; S-DRY formula gate would also fail: CSA)"],
    unc=[{"reading": "ID-3: claims name Ceramide-Komplex, Kaktus-Extrakt, Vitamin E, none in the frozen INCI; not material (none is a recognised active, silicone, or E4/C2 route)", "alternative": "material if a ceramide were judged a gate route (lists closed) -> note only"},
         {"reading": "dry-scalp separate unit only low-graded", "alternative": "'Wussten Sie, dass trockene, juckende Kopfhaut ...' (manufacturer) read as separate -> still no 'dry' (S-DRY fails CSA)"}])

# ------------------------------------------------------------------ T412 Salthouse Anti-Fett
run("T412",
    F("clarifying", "high", "Oily-scalp positioning: 'Anti-Fett' in the exact name (high), 'bei schnell fettender Kopfhaut', 'reguliert die Talgabsonderung' (manufacturer); F6 compatible (cleansing moderate, C moderate, W low).",
      [("Sodium Laureth Sulfate", 2), ("Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", 6)], ["no strong reset; panthenol/moisture wording"], "none", "not_applicable", "candidate",
      "oily scalp (name)", True, "lean C1 chassis, low deposition", "7.2 oily positioning with compatible architecture (F6)"),
    S2([], "high", "No distinct lengths-care positioning.", "none", [], [], "none"),
    U("frequent", "high", "explicit_frequent_non_strong", ["'Für die tägliche Haarwäsche geeignet.' (manufacturer directions, moderate)"],
      "U2 daily wording + cleansingStrength moderate. Reset intent ('klärend') cannot fire alternating on a moderate formula; 'klärend' is not D1.", "none"),
    SC("not_targeted", "high", "No moderate E2 sensitive/dry unit ('Sehr gute Hautverträglichkeit bei Problemhaut' protective; 'schützt die Kopfhaut vor Reizeffekten' retailer low); CSA also fails.", ["none"], "none"),
    T("oily", "moderate", "S-OILY: 'Anti-Fett' in the exact name (high) + formula clause (cleansing moderate high-confidence; W low; C moderate). Confidence = min(high, W moderate, C moderate) -> moderate."),
    D1(False, "high", "D1 false: 'klärend' is not a D1 stem (U4 only)."),
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "clarifying", "evidence": "Anti-Fett", "reason": "F6"},
     {"property": "usageRole", "blind": "regular (provisional)", "final": "frequent", "evidence": "daily directions", "reason": "U2"}] + CH_STD,
    {"productName": "high", "manufacturer_de": "moderate", "dm.at/rossmann": "low"},
    unc=[{"reading": "Neurodermitis/Psoriasis wording ignored as medical", "alternative": "none"}])

# ------------------------------------------------------------------ T413 H&S Classic Clean
run("T413",
    F("scalp_active", "high", "'Anti-Schuppen' in the exact name (high) + Piroctone Olamine (10).",
      [("Piroctone Olamine", 10)], ["oil and itch wording bundled with dandruff"], "none", "not_applicable", "candidate",
      "anti-dandruff (name)", True, "Piroctone Olamine (10)", "7.2 problem-led"),
    S2([], "high", "No lengths-care positioning.", "none", [], [], "none"),
    U("treatment", "high", "recognized_active_problem_led", ["name 'Anti-Schuppen'", "Piroctone Olamine (10)"],
      "U3; frequent fires ('ideal für die tägliche Anwendung', manufacturer moderate, cleansing moderate) and loses (U1).", "none", ["frequent: explicit_frequent_non_strong"]),
    SC("not_targeted", "high", "Itch wording is inside dandruff units ('Juckreiz im Zusammenhang mit Schuppen'); no separate SC1 unit; CSA fails.", ["none"], "none"),
    T("dandruff", "high", "S-DANDRUFF: name 'Anti-Schuppen' (high) + supported. Primary dandruff, no secondary (R17.2)."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "scalp_active", "evidence": "name", "reason": "7.2"},
     {"property": "usageRole", "blind": "regular (provisional)", "final": "treatment", "evidence": "dandruff claim + active", "reason": "U3"}] + CH_STD,
    {"productName": "high", "manufacturer_de": "moderate", "German retailer": "low"},
    notes=["suits_dandruff_with_oily_scalp ('3X SCHUTZ ... Schuppen, Öl und Juckreiz', '... fettige Kopfhaut', manufacturer moderate; S-OILY clause passes: cleansing moderate, W moderate, C moderate)",
           "dandruff_bundled_comfort_wording ('Juckreiz im Zusammenhang mit Schuppen', manufacturer moderate; S-SENSITIVE formula gate failed: CSA fails, no prominent E4 comfort route)"],
    rct=["oily"])

# ------------------------------------------------------------------ T414 Syoss Intense Fullness
run("T414",
    F("volume", "moderate", "'Intense Fullness' in the exact name (high) and the 'Niacinamide-Volumen-Komplex' (manufacturer): fullness/body is the dominant job. Formula compatible with counter-signal: weightPotential moderate (silicones incl. amodimethicone).",
      [("Niacinamide", 7), ("Hydrolyzed Keratin", 6)], ["weightPotential moderate (Dimethicone 8, Amodimethicone 12, guar 13)", "'Kräftigend'/'stärkt von innen' strengthening wording"], "general", "repair_supported", "candidate",
      "volume/fullness (name)", True, "no rich lipid architecture; light protein", "7.2 dominant claim, formula compatible with trade-off",
      {"repairRoutes": ["Hydrolyzed Keratin 6", "Dimethicone 8", "Amodimethicone 12", "Guar 13"], "moistureRoutes": [], "sharedRoutes": ["Guar 13"], "limitation": "chosen focus is volume; repair verdict recorded as trade-off"}),
    S2([], "moderate", "'Kräftigend'/'stärkt das Haar von innen' is strengthening for fullness, not damage repair positioning; no distinct second role.", ["repair"], ["Kräftigendes Shampoo"], ["Hydrolyzed Keratin 6"], "strengthening is part of the fullness claim"),
    U("regular", "high", "none", [], "No trigger.", "none"),
    SC("not_targeted", "high", "No scalp claims.", ["none"], "none"),
    T("ordinary", "high", "S-ORDINARY way 1 with manufacturer source."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional; verdict repair_supported)", "final": "volume", "evidence": "name 'Intense Fullness'", "reason": "dominant claim"}] + CH_STD,
    {"productName": "high", "manufacturer_de": "moderate", "rossmann.de": "low"},
    unc=[{"reading": "volume compatible at W moderate", "alternative": "general (if W moderate is judged incompatible with a fullness job)"}])

# ------------------------------------------------------------------ T415 Guhl Kraft & Fülle
run("T415",
    F("volume", "moderate", "The dominant claims are hair loss / hair growth / thinning ('zu Haarausfall neigendes Haar', 'Haarwachstum', 'Durchblutung der Kopfhaut'), ignored for focus (F5). The remaining in-scope job is fullness/strength from the name 'Kraft & Fülle' (high) with a compatible light formula (W low).",
      [("Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", 6)], ["'Fülle' is tied to thinning-hair positioning (density claim, F5)"], "general", "not_applicable", "candidate",
      "hair loss (ignored, F5) -> fullness (name)", True, "light low-deposition formula", "F5 then next in-scope compatible job"),
    S2([], "high", "No other in-scope distinct positioning.", "none", [], [], "none"),
    U("regular", "high", "none", [], "No trigger; caffeine/hair-loss positioning never fires treatment (U3/F5); '2 Minuten einmassieren' is not frequency.", "none"),
    SC("not_targeted", "high", "Scalp wording is hair-growth/circulation (S-HAIRLOSS), not E2 sensitive/dry.", ["none"], "none"),
    T("ordinary", "moderate", "S-ORDINARY ways 1 (no qualifying E2 unit; manufacturer source -> high) and 2 (only scalp-adjacent positioning is hair loss/growth -> moderate); lowest = moderate."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "volume", "evidence": "name 'Kraft & Fülle'", "reason": "F5 + next in-scope job"}] + CH_STD,
    {"productName": "high", "manufacturer_de": "moderate", "dm.de": "low"},
    notes=["hair_loss_claim_not_evaluated ('Für dünner-werdendes, zu Haarausfall neigendes Haar', 'unterstütze das natürliche Haarwachstum')"],
    unc=[{"reading": "'Kraft & Fülle' read as cosmetic volume", "alternative": "density claim (F5) -> general"}])

# ------------------------------------------------------------------ T416 Dejan Garz The Foundation
run("T416",
    F("moisture", "moderate", "'Deep Hydration' and 'mit Panthenol und Glycerin Feuchtigkeit spendet' (manufacturer, moderate) over a moisture_supported formula (Glycerin 4, Panthenol 6, Sodium Hyaluronate 9 + guar/Quaternium-80/refatters).",
      [("Glycerin", 4), ("Panthenol", 6), ("Sodium Hyaluronate", 9)], ["'Effektive Reinigung', 'Lightweight', 'Regulates Oil Production', 'Anti Frizz' compete; name names no role"], "general", "moisture_supported", "candidate",
      "moisture (manufacturer)", True, "humectant cluster Glycerin 4 / Panthenol 6 / Sodium Hyaluronate 9", "F1 moisture claim + moisture_supported",
      {"moistureRoutes": ["Glycerin 4", "Panthenol 6", "Sodium Hyaluronate 9"], "sharedRoutes": ["HP Guar 10", "Quaternium-80 12", "Glyceryl Oleate 8"], "limitation": "rinse-off"}),
    S2([], "moderate", "Clarifying considered for 'Regulates Oil Production on the Scalp', but the English wording is outside the E2 oily lexicon (7.2 requires the E2 oily lexicon); 'Anti Frizz' has no independent route.", ["clarifying"],
       ["Regulates Oil Production on the Scalp"], [], "not lexicon positioning"),
    U("regular", "high", "none", [], "'Verwende das Shampoo bei jeder Haarwäsche' is not U2 frequency wording; no other trigger.", "frequent"),
    SC("not_targeted", "high", "'ohne deine Kopfhaut auszutrocknen' and retailer 'schützt/schont die Kopfhaut' are protective (E2a).", ["none"], "none"),
    T("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 unit ('Regulates Oil Production on the Scalp' is English and outside the oily lexicon; noted). Manufacturer source -> high."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional; verdict moisture_supported)", "final": "moisture", "evidence": "Deep Hydration, Feuchtigkeit", "reason": "F1"}] + CH_STD,
    {"manufacturer_de": "moderate", "dm.de/rossmann.de": "low"},
    unc=[{"reading": "English 'Regulates Oil Production on the Scalp' not an E2 oily unit", "alternative": "qualifies -> S-OILY passes (cleansing moderate, W moderate, C moderate) -> oily target, clarifying secondary/primary question; flagged here as the main uncertainty"},
         {"reading": "'Lightweight Formula' does not lower weight (6.5)", "alternative": "n/a"}])

# ------------------------------------------------------------------ T417 Garnier Fructis Locken Methode Feuchtigkeit
run("T417",
    F("moisture", "moderate", "'Feuchtigkeitsauffüllendes' in the exact name (high), 'Feuchtigkeitskomplex mit Hyaluron und Shea-Fettsäuren' (manufacturer) over a moisture_supported formula (Glycerin 4, Sodium Hyaluronate 14, Shea Butter 10, cationic polymers).",
      [("Glycerin", 4), ("Butyrospermum Parkii Butter", 10), ("Sodium Hyaluronate", 14)], ["shea and polymers are small (after Parfum)", "'Locken' is pattern, not a focus"], "general", "moisture_supported", "candidate",
      "moisture (name)", True, "humectant cluster + shea emollient", "F1",
      {"moistureRoutes": ["Glycerin 4", "Sodium Hyaluronate 14", "Shea Butter 10"], "sharedRoutes": ["HP Guar 19", "Polyquaternium-7 21"], "limitation": "lipid/polymers small"}),
    S2([], "high", "No distinct second role.", "none", [], [], "none"),
    U("regular", "high", "none", [], "No trigger.", "none"),
    SC("not_targeted", "high", "No scalp claims.", ["none"], "none"),
    T("ordinary", "high", "S-ORDINARY way 1 with manufacturer source."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional; verdict moisture_supported)", "final": "moisture", "evidence": "name", "reason": "F1"}] + CH_STD,
    {"productName": "high", "manufacturer_de": "moderate", "dm.de/rossmann.de": "low"})

# ------------------------------------------------------------------ T418 H&S DermaXPro Sensitive Pflege
run("T418",
    F("scalp_active", "moderate", "Anti-dandruff positioning exists only in dm retailer copy (low), but the formula independently supports it (Piroctone Olamine 6), so the low claim may act as candidate, capped at moderate (CL-SRC).",
      [("Piroctone Olamine", 6)], ["all positioning retailer-only; name word 'Sensitive' does not name the scalp (F7)"], "general", "not_applicable", "candidate",
      "anti-dandruff + dry scalp (retailer, low)", True, "Piroctone Olamine (6)", "CL-SRC low candidate with independent formula support"),
    S2([], "high", "No qualifying positioning.", "none", [], [], "none"),
    U("regular", "high", "none", [], "treatment needs a dandruff claim graded moderate/high (U3); only low retailer copy exists. No other trigger.", "treatment"),
    SC("not_targeted", "high", "'Für trockene und schuppige Kopfhaut' is a dandruff unit and retailer-only (low); 'Sensitive' in the name does not name the scalp; CSA fails.", ["none"], "none"),
    T("ordinary", "moderate", "S-ORDINARY way 4: the dandruff claim exists only in retailer copy (low), so S-DANDRUFF's positioning gate fails although dandruffSupport is supported; no other specialist target -> ordinary with review_specialist_gate_failed. Bundled dryness wording never projects (E2b layer 1)."),
    NO_D1,
    [{"property": "focusPrimary", "blind": "general (provisional)", "final": "scalp_active (moderate)", "evidence": "dm retailer Anti-Schuppen claims", "reason": "CL-SRC"},
     {"property": "usageRole", "blind": "regular (provisional; treatment possible)", "final": "regular", "evidence": "claim only low", "reason": "U3 needs moderate/high"}] + CH_STD,
    {"productName": "high (no scalp role; 'Sensitive' is a non-scalp name word)", "dm.de": "low"},
    flags=["review_specialist_gate_failed:dandruff (positioning gate: only retailer copy graded low; formula gate passes, Piroctone Olamine 6)"],
    unc=[{"reading": "focus scalp_active (CL-SRC low candidate)", "alternative": "general"},
         {"reading": "ID-3: 'Ceramide-Komplex' not in INCI; 'Manuka-Honig' = Mel Extract (27); not material", "alternative": "none"}])
