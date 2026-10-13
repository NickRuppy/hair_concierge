"""Lane A, T1, phase 2 reconciliation decisions (post-unblind, Section 3.2). Data only; build_final.py assembles."""

B = {"ordinary": ("normal", "balanced"), "oily": ("dehydriert-fettig", "oily"), "dry": ("trocken", "dry"),
     "sensitive": ("irritationen", "irritated"), "dandruff": ("schuppen", "dandruff")}

def FOC(value, conf, nbr, verdict, routes, limitation, claimRole, claimDir, compatible, route, reason, rationale, counter, facts, blind):
    return {"value": value, "confidence": conf, "neighboringAlternative": nbr, "rationale": rationale,
            "formulaFacts": facts, "counterSignal": counter,
            "careDirection": {"verdict": verdict, "routes": routes, "limitation": limitation},
            "claimRole": claimRole,
            "decisionTrace": {"claimDirection": claimDir, "formulaCompatible": compatible, "compatibleRoute": route, "decisionReason": reason},
            "blindToFinal": blind, "sources": ["formula packet", "reveal packet"]}

def SEC(value, conf, nbr, claims, routes, why, rationale, counter, exc=None):
    return {"value": value, "confidence": conf, "neighboringAlternative": nbr, "rationale": rationale, "counterSignal": counter,
            "formulaFacts": [],
            "decisionTrace": {"emptyDefaultConsidered": True, "selectedValues": value, "matchingDistinctClaims": claims,
                              "independentRoutes": routes, "whyDistinctFromPrimary": why, "exceptionCode": exc},
            "blindToFinal": "provisional [] -> final " + str(value), "sources": ["reveal packet"]}

def USE(value, conf, nbr, code, evidence, losing, rationale):
    return {"value": value, "confidence": conf, "neighboringAlternative": nbr, "rationale": rationale,
            "formulaFacts": [], "counterSignal": "; ".join(losing) if losing else "No other trigger evaluated as firing.",
            "decisionTrace": {"default": "regular", "triggerCode": code, "triggerEvidence": evidence, "losingTriggers": losing},
            "blindToFinal": "provisional regular -> final " + value, "sources": ["reveal packet"]}

def SCT(value, conf, nbr, rationale, counter, facts, blind):
    return {"value": value, "confidence": conf, "neighboringAlternative": nbr, "rationale": rationale,
            "counterSignal": counter, "formulaFacts": facts, "blindToFinal": blind, "sources": ["formula packet", "reveal packet"]}

def T(target, conf, rationale):
    b, r = B[target]
    return {"target": target, "shampoo_bucket": b, "scalp_route": r, "confidence": conf, "rationale": rationale}

def REC(f, s, u):
    return {"focusPrimary": f["value"], "focusSecondary": s["value"], "careDirection": f["careDirection"], "claimRole": f["claimRole"],
            "counterSignal": f["counterSignal"], "neighboringAlternative": f["neighboringAlternative"],
            "decisionTrace": {"primary": f["decisionTrace"], "secondary": s["decisionTrace"], "usageRole": u["decisionTrace"],
                              "narrative": f["rationale"]}}

NOD1 = {"value": False, "evidence": "No D1 stem (tiefenrein/deep clean/clarifying shampoo/detox-reinigung) in name, manufacturer/pack claims or directions.", "grade": "high"}
NOT_SC = lambda why, blind="provisional not_targeted -> final not_targeted": SCT("not_targeted", "high", "none", why, "None that could make it targeted.", [], blind)
ORD1_HIGH = lambda extra="": T("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 scalp claim unit (after E2a); packet has a manufacturer/pack source -> high." + extra)
ORD1_MOD = lambda extra="": T("ordinary", "moderate", "S-ORDINARY way 1: no qualifying E2 scalp claim unit; retailer copy only (no exact German manufacturer/pack source) -> moderate." + extra)

SPEC = {}

# ---------------- T101 ----------------
f = FOC("moisture", "moderate", "general", "moisture_supported",
        {"moisture": ["Glycerin (12)", "Panthenol (13)", "Hydrolyzed Hyaluronic Acid (17)", "Sodium Hyaluronate (18)", "Erythritol (11)"],
         "shared": ["Hydrogenated Vegetable Oil (6)", "Glyceryl Oleate (8)", "Guar Hydroxypropyltrimonium Chloride (9)"], "repair": []},
        "Humectants sit after salt and the lipid; rinse-off context limits hydration evidence to feel/manageability.",
        "candidate", "moisture (product name 'Feuchtigkeits-Shampoo', high; manufacturer 'Für feuchtigkeitsbedürftiges Haar', moderate)",
        True, "humectant cluster (Glycerin 12, Panthenol 13, Sodium Hyaluronate 18) + lipid/guar deposition (6, 9)",
        "Name-level moisture claim over a moisture_supported formula (F1) -> moisture.",
        "moisture: the exact name claims hydration and the formula carries a coherent humectant cluster with lipid+guar conditioning support (moisture_supported, F1).",
        "Humectants are mid/late in the list; a recognized dandruff active (Piroctone Olamine 15) exists but has no dandruff positioning (R17.3) and is not a focus route.",
        [{"ingredient": "Glycerin", "position": 12}, {"ingredient": "Panthenol", "position": 13}, {"ingredient": "Sodium Hyaluronate", "position": 18},
         {"ingredient": "Guar Hydroxypropyltrimonium Chloride", "position": 9}, {"ingredient": "Hydrogenated Vegetable Oil", "position": 6}],
        "provisional pending_claims (candidates scalp_active/moisture) -> moisture: no dandruff claim exists, so scalp_active fell away (R17.3).")
s = SEC([], "moderate", ["shine"], ["'gesund glänzende Längen' (manufacturer, moderate)"], [],
        "Shine is an outcome of the same humectant/lipid/guar route (F2); no independent shine route.",
        "Empty: the shine wording is an outcome of the primary moisture route (F2/F3).", "Shine is worded explicitly; a lane reading it as distinct would pick ['shine'].")
u = USE("regular", "high", "none", "none", [], [],
        "No non-default trigger: no frequency wording (U2) at moderate/high grade, no reset intent, no dandruff claim (treatment needs U3), no D1.")
SPEC["T101"] = {"name": "Guhl Hyaluron+ Pflege Feuchtigkeits-Shampoo", "brand": "Guhl", "packSize": "250 ml",
  "sourceGrades": {"productName": "high", "manufacturer_de": "moderate", "dm_de/dm_at/rossmann retailer": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No E2 sensitive/dry scalp claim unit at moderate/high grade (Rossmann 'sanft zur Kopfhaut' is retailer-only and protective wording, E2a). CSA formula half is met (Panthenol 13 etc.) but positioning half (SC1) is absent."),
  "focusRecord": REC(f, s, u), "d1": NOD1,
  "targets": {"primary": T("ordinary", "moderate", "S-ORDINARY ways 1 and 3: no qualifying E2 claim unit (way 1, manufacturer source -> high) and recognized active without a dandruff claim (way 3 -> moderate); lowest -> moderate (13.8)."), "secondary": None},
  "extraNotes": [{"code": "active_without_dandruff_positioning", "detail": "Piroctone Olamine (15) without any dandruff claim; regular shampoo (R17.3)."}],
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "moisture", "evidence": "name 'Feuchtigkeits-Shampoo' (high)", "reason": "candidate claim + moisture_supported verdict"},
                   {"property": "scalpComfortTarget", "from": "provisional not_targeted", "to": "not_targeted", "evidence": "no SC1 unit", "reason": "positioning half absent"},
                   {"property": "usageRole", "from": "provisional regular", "to": "regular", "evidence": "no trigger", "reason": "default"}],
  "uncertainties": [
    {"reading": "conditioningLevel high via W-RICH (Hydrogenated Vegetable Oil 6 counted as prominent payload_lipid)", "alternative": "moderate if the lipid is read as a minor refatter; C2 is not fully met"},
    {"reading": "weightPotential moderate (W-RICH but moderate reset)", "alternative": "high"},
    {"reading": "focus moisture at moderate", "alternative": "general if the humectant cluster is judged too late to be coherent"}]}

# ---------------- T102 ----------------
f = FOC("volume", "moderate", "general", "not_applicable", {"volume": ["low weightPotential, no silicone, light protein film (Hydrolyzed Keratin 5, Hydrolyzed Collagen 6)"]},
        "Volume compatibility rests on a light formula; protein 'lift' is a claim, not a measured effect.",
        "candidate", "volume (name 'Intense Volume', high; manufacturer 'LEICHTES SHAMPOO', 'Bis zu 48 Stunden ... Volumen', moderate)",
        True, "light formula: weightPotential low, conditioning moderate, protein film routes (5, 6)",
        "Dominant name claim with a compatible light formula -> volume.",
        "volume: the exact name and manufacturer copy position volume for fine/flat hair, and the formula is compatible (weight low, no silicone or rich lipid).",
        "'Tiefenpflegende Formel ... stärkt das Haar von innen' is a care/strength claim; strength positioning was not taken as a distinct repair role (F3).",
        [{"ingredient": "Hydrolyzed Keratin", "position": 5}, {"ingredient": "Hydrolyzed Collagen", "position": 6}],
        "provisional pending_claims (repair candidate) -> volume: name-level volume claim dominates; repair route is the same protein complex the volume claim cites.")
s = SEC([], "moderate", ["repair"], ["'stärkt das Haar von innen' (manufacturer, moderate)"], [],
        "The only route for strength/repair is the collagen/keratin complex, which is the volume claim's own 'Kollagen-Lift-Komplex' (F3); no damage/breakage positioning.",
        "Empty: no distinct repair positioning and no independent route (F3).", "Protein complex named for strength could be read as repair.")
u = USE("frequent", "moderate", "regular", "explicit_frequent_non_strong",
        ["manufacturer_de (moderate): 'Milde Formel für die tägliche Haarwäsche'"], [],
        "U2 frequency wording 'tägliche Haarwäsche' from a moderate source and cleansingStrength moderate (not strong) -> frequent.")
SPEC["T102"] = {"name": "Syoss Intense Volume Shampoo (Leichtes Shampoo Intense Volume)", "brand": "Syoss", "packSize": "440 ml",
  "sourceGrades": {"productName": "high", "manufacturer_de": "moderate", "dm/mueller/rossmann": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No scalp claim of any kind; CSA also not met."),
  "focusRecord": REC(f, s, u),
  "d1": {"value": False, "evidence": "'Tiefenpflegende Formel' is a care term sharing the prefix (explicitly not D1, 13.6).", "grade": "high"},
  "targets": {"primary": ORD1_HIGH(), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional (repair candidate)", "to": "volume", "evidence": "name 'Intense Volume'", "reason": "dominant compatible claim"},
                   {"property": "usageRole", "from": "provisional regular", "to": "frequent", "evidence": "manufacturer 'Milde Formel für die tägliche Haarwäsche'", "reason": "U2 + non-strong"}],
  "uncertainties": [
    {"reading": "conditioningLevel moderate (proteins prominent, guar trace)", "alternative": "low"},
    {"reading": "secondary [] (strength claim shares the protein route)", "alternative": "['repair']"},
    {"reading": "'tägliche Haarwäsche' counts as U2 'täglich' stem", "alternative": "regular if only the listed phrases count"}]}

# ---------------- T103 ----------------
f = FOC("general", "moderate", "moisture", "nonspecific",
        {"moisture": ["Panthenol (24)", "Panthenyl Ethyl Ether (25)", "Niacinamide (30)"], "shared": ["Dimethiconol (10)", "Dimethicone (13)", "Guar HPTC (15)"]},
        "Humectants are late/trace; conditioning is a generic silicone/guar system.",
        "candidate", "moisture / dry-scalp / scalp soothing - all retailer-graded low (dm, Austrian retailer)",
        False, "none qualifying", "Only low-graded claims; a low claim can be a candidate only if the formula verdict independently supports it (CL-SRC). Moisture verdict is nonspecific; scalp_active needs targeted (fails). -> general.",
        "general: every claim is retailer-only (low); the formula's humectants are late, so no moisture_supported verdict, and scalp_active fails without SC1 positioning.",
        "Retailer copy positions dry hair, dry scalp and soothing; the formula has a strong reinforced sulfate chassis, which also argues against a comfort role.",
        [{"ingredient": "Panthenol", "position": 24}, {"ingredient": "Dimethiconol", "position": 10}],
        "provisional pending_claims (scalp_active via dandruff active) -> general: no dandruff claim (R17.3) and only low-graded claims.")
s = SEC([], "high", "none", [], [], "No qualifying secondary.", "Empty.", "None.")
u = USE("regular", "high", "none", "none", ["dm (low): 'für den täglichen Gebrauch geeignet' cannot fire (CL-SRC) and cleansing is strong"], ["frequent (blocked: low grade and strong cleansing)"],
        "Default: no moderate/high trigger; strong cleansing alone does not fire alternating.")
SPEC["T103"] = {"name": "hair biology Shampoo Revitalize & Soothe (Meno Balance)", "brand": "Hair Biology (Procter & Gamble)", "packSize": "250 ml",
  "sourceGrades": {"productName": "high (no scalp-naming word; 'Soothe' does not name the scalp)", "dm_de": "low", "shop_apotheke_at": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": SCT("not_targeted", "high", "none",
        "SC1 fails: the only sensitive/dry scalp units ('trockener Kopfhaut', 'Beruhigt die ... Kopfhaut') are retailer-graded low. CSA also fails: no prominent E4 route (Panthenol 24, Niacinamide 30 after Parfum 11).",
        "Strong cleansing is an additional counter-signal.", [{"ingredient": "Panthenol", "position": 24}, {"ingredient": "Niacinamide", "position": 30}],
        "provisional not_targeted -> not_targeted"),
  "focusRecord": REC(f, s, u), "d1": NOD1,
  "targets": {"primary": T("ordinary", "moderate", "S-ORDINARY ways 3 and 4: recognized active without a dandruff claim (way 3) and claimed dry/sensitive targets that failed (way 4, S-FAIL) -> moderate."), "secondary": None},
  "extraFlags": [{"code": "review_specialist_gate_failed", "detail": "dry: positioning gate failed (only low-graded units: dm 'Bei ... trockener Kopfhaut') and formula gate failed (not targeted; no prominent E4 humectant route); sensitive: positioning gate failed (dm 'Beruhigt die aus dem Gleichgewicht geratene Kopfhaut', low) and formula gate failed (not targeted; no prominent E4 comfort route)"}],
  "extraNotes": [{"code": "active_without_dandruff_positioning", "detail": "Piroctone Olamine (12) without a dandruff claim (R17.3)."},
                 {"code": "hair_loss_claim_not_evaluated", "detail": "'Bei dünner werdendem ... Haar', 'für dichtes, volleres Haar' (hair density, E2 exclusion)."}],
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional (scalp_active candidate)", "to": "general", "evidence": "no dandruff claim; all claims low", "reason": "R17.3, CL-SRC"}],
  "uncertainties": [
    {"reading": "S-FAIL raised for low-graded dry/sensitive units", "alternative": "S-ORDINARY way 3 only, no flag, if low-graded units are treated as no claim"},
    {"reading": "conditioningLevel high via C2 (late guar/panthenol accepted as elements)", "alternative": "moderate"},
    {"reading": "weightPotential moderate", "alternative": "high"},
    {"reading": "'dünner werdendes Haar' read as hair-density (S-HAIRLOSS note)", "alternative": "no note"}]}

# ---------------- T104 ----------------
f = FOC("general", "moderate", "repair", "nonspecific",
        {"moisture": ["Mel/Honey (5)", "Glycerin (8)"], "shared": ["HP Guar HPTC (17)", "Glyceryl Oleate (9)", "Lecithin (12)"], "repair": []},
        "No protein, silicone or substantive lipid; deposition is light; humectant cluster without moisture positioning.",
        "candidate", "repair ('Reparierendes Shampoo', 'strapaziertes und brüchiges Haar', 'Spliss, Haarbruch' - manufacturer, moderate)",
        False, "no repair cluster",
        "Repair claim over a formula without a substantive/damage-care cluster (verdict not repair_supported) -> incompatible; no moisture positioning to use the humectant route -> general (F1).",
        "general: the product is positioned for repair, but the formula has no coherent damage-care/deposition cluster (only weak refatters and one late guar), so repair is not supported.",
        "Strong, consistent repair positioning across manufacturer and retailers; honey/glycerin give a moisture-type route that is not positioned.",
        [{"ingredient": "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "position": 17}, {"ingredient": "Mel/Honey", "position": 5}],
        "provisional pending_claims (moisture candidate) -> general: claim is repair, verdict does not support repair.")
s = SEC([], "high", "none", [], [], "No second positioned role.", "Empty.", "None.")
u = USE("regular", "high", "none", "none", [], [], "Default; no trigger.")
SPEC["T104"] = {"name": "Garnier Wahre Schätze Reparierendes Shampoo Honig Schätze", "brand": "Garnier Wahre Schätze", "packSize": "400 ml",
  "sourceGrades": {"productName": "high", "manufacturer_de": "moderate", "retailers": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No scalp claim (all claims concern lengths)."),
  "focusRecord": REC(f, s, u), "d1": NOD1,
  "targets": {"primary": ORD1_HIGH(), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional (moisture candidate)", "to": "general", "evidence": "repair positioning", "reason": "repair not supported by formula; moisture not positioned"},
                   {"property": "focusPrimary.careDirection", "from": "moisture_supported (provisional)", "to": "nonspecific", "evidence": "re-read for the claimed repair job", "reason": "no damage-care cluster; humectants alone do not distinguish a claimed job"}],
  "uncertainties": [
    {"reading": "focus general (repair unsupported)", "alternative": "repair if honey/refatters are read as a damage-care cluster"},
    {"reading": "cleansing moderate via C5 with Parfum-last prominence", "alternative": "strong"},
    {"reading": "conditioning moderate", "alternative": "low"}]}

# ---------------- T105 ----------------
f = FOC("scalp_active", "moderate", "moisture", "not_applicable",
        {"scalp_comfort": ["Panthenol (7)", "Niacinamide (8)", "Glycerin (3)"]},
        "Comfort routes are recognition-level; tolerability is not proven.",
        "candidate", "sensitive scalp ('Mildes Shampoo für empfindliche Kopfhaut', manufacturer, moderate)",
        True, "CSA: prominent Panthenol (7), Niacinamide (8), Glycerin (3); fragrance-free; mild C5 chassis",
        "Explicit sensitive-scalp positioning (SC1) with scalpComfortTarget targeted -> scalp_active (7.2). F7: 'Ultra Sensitive' in the name does not name the scalp; moisture claim is not in the name -> scalp_active primary.",
        "scalp_active: SC1 sensitive-scalp positioning plus a credible supportive architecture (prominent Panthenol, Niacinamide, Glycerin; no fragrance).",
        "Cleansing is moderate by C5 (Sodium Coco-Sulfate); the product also claims hair moisture/softness.",
        [{"ingredient": "Panthenol", "position": 7}, {"ingredient": "Niacinamide", "position": 8}, {"ingredient": "Glycerin", "position": 3}],
        "provisional pending_claims -> scalp_active")
s = SEC([], "moderate", ["moisture"], ["'spendet Feuchtigkeit und pflegt das Haar geschmeidig glänzend' (manufacturer, moderate)"], [],
        "The moisture claim is attributed to the same 'Glycerin, Panthenol und Niacinamid' formula that carries the scalp route (F3); guar/refatters are the only extra support.",
        "Empty: moisture wording rests on the primary's ingredients (F3).", "Guar (12) and refatters could be argued as an independent moisture route.")
u = USE("frequent", "moderate", "regular", "explicit_frequent_non_strong",
        ["manufacturer_de (moderate): 'ideal für die tägliche Haarwäsche bei sensibler Haut'"], [],
        "U2 wording at moderate grade and cleansingStrength moderate -> frequent.")
SPEC["T105"] = {"name": "Balea med Shampoo Ultra Sensitive", "brand": "Balea", "packSize": "250 ml",
  "sourceGrades": {"productName": "high (non-scalp word 'Sensitive', counts only with the manufacturer scalp unit)", "manufacturer_de (dm own brand)": "moderate"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": SCT("targeted", "high", "none",
        "SC1: E2 sensitive unit 'für empfindliche Kopfhaut' (manufacturer, moderate). CSA: prominent comfort routes Panthenol (7), Niacinamide (8) and humectants Glycerin (3), Glyceryl Oleate (11); fragrance-free, mild chassis.",
        "None material (no fragrance, no cooling agent, cleansing not strong).",
        [{"ingredient": "Panthenol", "position": 7}, {"ingredient": "Niacinamide", "position": 8}, {"ingredient": "Glycerin", "position": 3}],
        "provisional not_targeted -> targeted (SC1 revealed)"),
  "focusRecord": REC(f, s, u), "d1": NOD1,
  "targets": {"primary": T("sensitive", "moderate", "S-SENSITIVE: E2 sensitive claim (manufacturer, moderate) + scalpComfortTarget targeted + prominent comfort route (Panthenol 7, Niacinamide 8); cleansing not strong -> no review. Confidence = min(E1 moderate, scalpComfortTarget high) = moderate."), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "scalp_active", "evidence": "'Mildes Shampoo für empfindliche Kopfhaut'", "reason": "SC1 + CSA"},
                   {"property": "scalpComfortTarget", "from": "provisional not_targeted", "to": "targeted", "evidence": "SC1 manufacturer unit", "reason": "positioning half revealed; CSA already met"},
                   {"property": "usageRole", "from": "provisional regular", "to": "frequent", "evidence": "'ideal für die tägliche Haarwäsche'", "reason": "U2"}],
  "uncertainties": [
    {"reading": "cleansing moderate via C5 (Sodium Coco-Sulfate as defining anionic)", "alternative": "low (glucoside-led) - would make the irritationen rows green"},
    {"reading": "secondary []", "alternative": "['moisture']"},
    {"reading": "scalpComfortTarget confidence high", "alternative": "moderate (positioning is moderate-graded)"}]}

# ---------------- T106 ----------------
f = FOC("general", "moderate", "moisture", "nonspecific",
        {"moisture": ["Glycerin (23, trace)"], "shared": ["PEG-18 Glyceryl Oleate/Cocoate (5)", "Avena Sativa Peptide (8)", "Guar HPTC (18)"]},
        "No coherent humectant cluster (only trace glycerin); algae extract is not a C2/E4 humectant.",
        "candidate", "moisture (name 'Moisture Mystery', high; German retailers 'Feuchtigkeits-Shampoo', low)",
        False, "none (verdict nonspecific)",
        "F1: moisture language over a nonspecific formula stays general.",
        "general: the name claims moisture, but the formula has no coherent humectant cluster (glycerin is trace at 23) and only light conditioning, so the moisture verdict is nonspecific.",
        "Name-level moisture claim; manufacturer copy cites peptides, hemisqualane (C13-15 Alkane 21) and botanical extracts.",
        [{"ingredient": "Glycerin", "position": 23}, {"ingredient": "PEG-18 Glyceryl Oleate/Cocoate", "position": 5}],
        "provisional pending_claims -> general")
s = SEC([], "high", "none", ["manufacturer (possibly CH storefront): 'beugen Haarbruch vor', 'Glanz'"], [], "No independent positioned route; formula nonspecific.", "Empty.", "None.")
u = USE("regular", "high", "none", "none", [], [], "Default; no trigger.")
SPEC["T106"] = {"name": "Neqi Moisture Mystery Shampoo", "brand": "Neqi", "packSize": "330 ml",
  "sourceGrades": {"productName": "high", "manufacturer_de (German-language, CHF prices; possibly Swiss storefront)": "moderate as given (would be low under E1 if a foreign-market page)", "retailers": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No E2 scalp unit ('Reinigung von Haaren und Kopfhaut, ohne zu strapazieren' is protective; 'fettiges ... Haar' appears only in an all-hair-types suitability list, not as the product's problem)."),
  "focusRecord": REC(f, s, u), "d1": NOD1,
  "targets": {"primary": ORD1_HIGH(" Manufacturer source present (graded moderate in packet)."), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "general", "evidence": "name 'Moisture Mystery'", "reason": "F1: nonspecific verdict"}],
  "uncertainties": [
    {"reading": "focus general (nonspecific)", "alternative": "moisture"},
    {"reading": "conditioning moderate", "alternative": "low"},
    {"reading": "manufacturer page graded moderate (German language)", "alternative": "low if treated as foreign-market (CH) - would make ordinary confidence moderate"},
    {"reading": "'fettiges Haar' in a hair-type list is not an E2 oily unit", "alternative": "oily unit -> S-FAIL review"}]}

# ---------------- T107 ----------------
f = FOC("shine", "moderate", "repair", "not_applicable",
        {"shine": ["Hydrolyzed Corn Protein (5)", "Hydrolyzed Wheat Protein (7)", "Hydrolyzed Soy Protein (9)", "Guar HPTC (8)", "acidic pH (Citric Acid 10, Levulinic Acid 17)"]},
        "Protein film/smoothing is a plausible gloss route, not a measured one.",
        "candidate", "shine (name 'Glossy Shine Shampoo', high; manufacturer 'für glanzloses und stumpfes Haar', 'glättet die Oberflächenstruktur', moderate)",
        True, "light protein film + guar smoothing, acidic system",
        "Name-level shine claim with a plausible smoothing/film route and low weight -> shine (7.1, 7.2).",
        "shine: the exact name positions gloss and the formula has a light protein-film/guar smoothing route with low weight.",
        "Strong alkyl sulfate chassis; '3-fach Protein Komplex stärkt' could be read as repair.",
        [{"ingredient": "Hydrolyzed Corn Protein", "position": 5}, {"ingredient": "Hydrolyzed Wheat Protein", "position": 7}, {"ingredient": "Hydrolyzed Soy Protein", "position": 9}, {"ingredient": "Guar Hydroxypropyltrimonium Chloride", "position": 8}],
        "provisional pending_claims (repair candidate) -> shine: dominant name claim")
s = SEC([], "moderate", ["repair"], ["'stärkt, pflegt & schützt' (manufacturer, moderate)"], [],
        "The protein complex is the shine route; no ingredient outside it supports repair (F3); no damage/breakage claim.",
        "Empty (F3).", "Strength wording with three proteins.")
u = USE("regular", "high", "none", "none", [], ["alternating not fired: strong cleansing but no reset intent (U4)"], "Default.")
SPEC["T107"] = {"name": "SANTE Glossy Shine Shampoo Birke + 3-fach Protein Komplex", "brand": "Sante", "packSize": "250 ml",
  "sourceGrades": {"productName": "high", "manufacturer_de": "moderate", "retailers": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No scalp claim ('Verträglichkeit dermatologisch getestet' is protective, E2a)."),
  "focusRecord": REC(f, s, u), "d1": NOD1,
  "targets": {"primary": ORD1_HIGH(), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional (repair candidate)", "to": "shine", "evidence": "name 'Glossy Shine'", "reason": "dominant compatible claim"}],
  "uncertainties": [{"reading": "conditioning moderate", "alternative": "low"}, {"reading": "secondary []", "alternative": "['repair']"}]}

# ---------------- T108 ----------------
f = FOC("scalp_active", "moderate", "general", "not_applicable",
        {"scalp_comfort": ["Urea (3)", "Panthenol (8)"]},
        "Comfort routes face a strong (reinforced) ether-sulfate chassis.",
        "candidate", "sensitive scalp ('Spezialentwicklung für sensible Kopfhaut', manufacturer, moderate)",
        True, "CSA: prominent Urea (3), Panthenol (8)",
        "SC1 sensitive positioning + targeted -> scalp_active (7.2).",
        "scalp_active: explicitly developed for sensitive scalp and the formula carries prominent Urea and Panthenol comfort routes.",
        "cleansingStrength strong (C1, reinforcing ether sulfates) caps targeted at moderate.",
        [{"ingredient": "Urea", "position": 3}, {"ingredient": "Panthenol", "position": 8}],
        "provisional pending_claims -> scalp_active")
s = SEC([], "high", "none", [], [], "No distinct lengths-care positioning ('Feuchtigkeits-Komplex' is scalp/hair protective, formula nonspecific for lengths).", "Empty.", "None.")
u = USE("regular", "moderate", "frequent", "none",
        ["manufacturer (moderate) 'für jeden Tag' is U2 wording but cleansingStrength is strong"], ["frequent (blocked: cleansing strong)"],
        "Default: frequent requires non-strong cleansing; cleansing neighbor moderate would fire frequent, hence moderate confidence.")
SPEC["T108"] = {"name": "ISANA MED Shampoo pH 5,5 hautneutral", "brand": "ISANA", "packSize": "400 ml",
  "sourceGrades": {"productName": "high", "manufacturer_de (Rossmann own brand)": "moderate", "pack_front": "high"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": SCT("targeted", "moderate", "not_targeted",
        "SC1: 'Spezialentwicklung für sensible Kopfhaut' (manufacturer, moderate). CSA: prominent Urea (3), Panthenol (8).",
        "cleansingStrength strong -> targeted at most moderate (CSA); Parfum present.",
        [{"ingredient": "Urea", "position": 3}, {"ingredient": "Panthenol", "position": 8}], "provisional not_targeted -> targeted"),
  "focusRecord": REC(f, s, u), "d1": NOD1,
  "targets": {"primary": T("sensitive", "moderate", "S-SENSITIVE: E2 sensitive unit (moderate) + targeted + prominent comfort route (Urea 3, Panthenol 8); cleansing strong -> emitted with review_strong_cleansing_comfort_route. 'schützt Kopfhaut & Haar vor Austrocknung' is protective, not an E2 dry claim."), "secondary": None},
  "extraFlags": [{"code": "review_strong_cleansing_comfort_route", "detail": "sensitive target with cleansingStrength strong"}],
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "scalp_active", "evidence": "'für sensible Kopfhaut'", "reason": "SC1 + CSA"},
                   {"property": "scalpComfortTarget", "from": "provisional not_targeted", "to": "targeted", "evidence": "SC1 unit", "reason": "positioning revealed"}],
  "uncertainties": [
    {"reading": "cleansing strong (late Mg/oleth/laureth-8 sulfates are reinforcing routes)", "alternative": "moderate - would make usage frequent and remove the review flag"},
    {"reading": "'schützt ... vor Austrocknung' is protective, not dry-scalp positioning", "alternative": "dry target via S-DRY (Urea/Panthenol prominent) as secondary"}]}

# ---------------- T109 ----------------
f = FOC("clarifying", "moderate", "shine", "not_applicable",
        {"clarifying": ["Sodium Laureth Sulfate (2) without prominent buffer", "no deposition system"]},
        "Strength rests on the C4 prominence convention (betaine just after Parfum).",
        "candidate", "deep cleansing ('Tiefenreinigung & Glanz' in name, high; 'entfernt Ablagerungen', retailer)",
        True, "F6: cleansing strong, conditioning low, weight low",
        "Explicit deep-cleaning product with compatible architecture -> clarifying (7.2, F6).",
        "clarifying: the exact name is 'Tiefenreinigung & Glanz' and the formula is compatible (strong unbuffered SLES, no conditioning, low weight).",
        "'Glanz' also in the name; the only shine route is acidic pH (F4).",
        [{"ingredient": "Sodium Laureth Sulfate", "position": 2}, {"ingredient": "Parfum", "position": 4}],
        "provisional pending_claims -> clarifying")
s = SEC([], "moderate", ["shine"], ["'Glanz' (name, high)"], ["Citric Acid (7)/Sodium Citrate (9) only - pH adjusters (F4)"],
        "Shine has no independent route other than pH adjusters, which cannot create a secondary shine (F4).", "Empty (F4).", "Name-level shine positioning.")
u = USE("occasional_reset", "high", "none", "explicit_deep_cleansing",
        ["product name (high): 'Tiefenreinigung & Glanz'"], ["alternating (strong + reset intent 'Tiefenreinigung'/'entfernt Ablagerungen') loses to occasional_reset (U1)"],
        "D1 true from the product name -> occasional_reset (U1 precedence).")
SPEC["T109"] = {"name": "Herbal Essences Tiefenreinigung & Glanz Shampoo Limettenduft", "brand": "Herbal Essences", "packSize": "350 ml",
  "sourceGrades": {"productName": "high", "retailers (exact GTIN)": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No scalp claim."),
  "focusRecord": REC(f, s, u),
  "d1": {"value": True, "evidence": "Product name contains 'Tiefenreinigung' (stem tiefenrein); no daily-use directions ('Großzügig auftragen ... ausspülen').", "grade": "high"},
  "deepCleanser": {"listing": "flagged", "confidence": "moderate", "rationale": "D2: cleansingStrength strong + focusPrimary clarifying + usageRole occasional_reset + D1 true -> flagged; deepCleanserRecord needs_record. Confidence = min(cleansing moderate, focus moderate, usage high, D1 high)."},
  "targets": {"primary": ORD1_MOD(), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "clarifying", "evidence": "name 'Tiefenreinigung'", "reason": "D1 + F6 compatible"},
                   {"property": "usageRole", "from": "provisional regular", "to": "occasional_reset", "evidence": "name 'Tiefenreinigung'", "reason": "D1 true (U1)"},
                   {"property": "positioning.explicitResetPositioning", "from": "unknown", "to": True, "evidence": "name", "reason": "D1"}],
  "uncertainties": [
    {"reading": "cleansing strong because the betaine (5) sits after Parfum (4)", "alternative": "moderate -> intensity regular, D2 not met, note deep_cleansing_name_ordinary_formula instead of a deep-cleanser flag"},
    {"reading": "ordinary target confidence moderate (retailer copy only)", "alternative": "high"}]}

# ---------------- T110 ----------------
f = FOC("volume", "moderate", "general", "not_applicable", {"volume": ["low weightPotential; light guar/protein/refatter routes"]},
        "Volume compatibility = light formula; 2-in-1 claim does not raise conditioning (C7).",
        "candidate", "volume (name '2in1 Volumen', high; 'verleiht ... feinem Haar Volumen', moderate)",
        True, "light formula: weight low, conditioning moderate",
        "Name-level volume claim with a compatible light formula -> volume.",
        "volume: the exact name positions volume and the formula is light (weight low, no silicone or rich lipid).",
        "2-in-1 conditioner positioning (C7, does not raise conditioning).",
        [{"ingredient": "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "position": 13}, {"ingredient": "Hydrolyzed Wheat Protein", "position": 7}],
        "provisional pending_claims -> volume")
s = SEC([], "high", "none", [], [], "No second positioned role.", "Empty.", "None.")
u = USE("regular", "high", "none", "none", [], [], "Default.")
SPEC["T110"] = {"name": "ISANA Shampoo & Spülung 2in1 Volumen Malve & Acai", "brand": "ISANA", "packSize": "300 ml",
  "sourceGrades": {"productName": "high", "manufacturer_de (Rossmann own brand)": "moderate"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No scalp claim ('pH-hautneutral', 'dermatologisch bestätigt' are protective)."),
  "focusRecord": REC(f, s, u), "d1": NOD1, "targets": {"primary": ORD1_HIGH(), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "volume", "evidence": "name", "reason": "dominant compatible claim"}],
  "uncertainties": [{"reading": "conditioning moderate (C7: 2-in-1 claim ignored)", "alternative": "low"}]}

# ---------------- T111 ----------------
f = FOC("general", "moderate", "repair", "nonspecific",
        {"repair": ["Pisum Sativum (Pea) Peptide (5)"], "shared": ["Hydroxypropyl Guar HPTC (6)"]},
        "One peptide plus one guar is not a coherent damage-care cluster ('one protein token is not enough').",
        "candidate", "repair ('Für splissgeschädigtes Haar' pack back, moderate; 'Für geschädigtes und splissanfälliges Haar', manufacturer, moderate)",
        False, "none (verdict nonspecific)",
        "Repair claim over a formula whose verdict is nonspecific -> general (F1).",
        "general: positioned for split ends/damage, but the formula's care is a single peptide plus guar, which does not form a repair_supported cluster.",
        "Explicit damage positioning on pack and manufacturer page.",
        [{"ingredient": "Pisum Sativum (Pea) Peptide", "position": 5}, {"ingredient": "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "position": 6}],
        "provisional pending_claims -> general")
s = SEC([], "high", "none", [], [], "No qualifying secondary.", "Empty.", "None.")
u = USE("regular", "high", "none", "none", ["'Regelmäßig anwenden' is not U2 frequency wording"], [], "Default.")
SPEC["T111"] = {"name": "Schwarzkopf GLISS Sealing Miracle Versiegelndes Shampoo", "brand": "Schwarzkopf GLISS", "packSize": "200 ml",
  "sourceGrades": {"productName": "high", "pack_back": "moderate", "manufacturer_de": "moderate", "rossmann": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No scalp claim."),
  "focusRecord": REC(f, s, u), "d1": NOD1, "targets": {"primary": ORD1_HIGH(), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "general", "evidence": "repair claims", "reason": "verdict nonspecific"}],
  "uncertainties": [{"reading": "focus general (peptide+guar not a repair cluster)", "alternative": "repair"}, {"reading": "weight low", "alternative": "moderate"}]}

# ---------------- T112 ----------------
f = FOC("general", "moderate", "volume", "repair_supported",
        {"repair": ["Hydrolyzed Collagen (7)", "Amodimethicone (10)", "Starch HPTC (9)"]},
        "The formula supports repair, but nothing positions repair at moderate/high grade.",
        "not_applicable", "volume/fullness (retailers, low; US manufacturer, low)",
        False, "volume not supported: weight moderate and conditioning high argue against lift",
        "All claims are low-graded; a low claim can be a candidate only where the formula independently supports it (CL-SRC). Volume is not formula-supported; the repair route has no positioning -> general.",
        "general: volume/fullness is claimed only in retailer and foreign copy (low), and the formula (amodimethicone + cationic + collagen, weight moderate) does not independently support volume.",
        "Repair-type formula route without matching positioning (trade-off).",
        [{"ingredient": "Amodimethicone", "position": 10}, {"ingredient": "Hydrolyzed Collagen", "position": 7}],
        "provisional pending_claims (repair candidate) -> general")
s = SEC([], "high", "none", [], [], "No moderate/high positioning.", "Empty.", "None.")
u = USE("regular", "high", "none", "none", ["Müller (low) 'tägliche Haarwäsche' cannot fire (CL-SRC)"], [], "Default.")
SPEC["T112"] = {"name": "OGX Biotin & Collagen Shampoo", "brand": "OGX", "packSize": "385 ml",
  "sourceGrades": {"productName": "high (no focus word)", "retailers": "low", "manufacturer_us": "low (foreign market, E1)"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No scalp claim."),
  "focusRecord": REC(f, s, u), "d1": NOD1,
  "targets": {"primary": ORD1_MOD(" The US manufacturer page is foreign-market (graded low), so treated as not an exact German manufacturer source."), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional (repair candidate)", "to": "general", "evidence": "only low-graded volume claims", "reason": "CL-SRC"}],
  "uncertainties": [
    {"reading": "frozen name 'OGX Biotin & Collagen Shampoo' (retailer 'Thick & Full' not part of it)", "alternative": "'Thick & Full' as name words -> high-graded volume claim, still formula-incompatible-leaning"},
    {"reading": "conditioning high (C2 fatty element via Coconut Acid)", "alternative": "moderate"},
    {"reading": "weight moderate", "alternative": "high"},
    {"reading": "ordinary confidence moderate (foreign manufacturer not counted)", "alternative": "high"}]}

# ---------------- T113 ----------------
f = FOC("repair", "moderate", "general", "repair_supported",
        {"repair": ["Hydrolyzed Keratin (6)", "Argania Spinosa Kernel Oil (7)", "Amodimethicone (10)", "Guar HPTC (11)", "Hydrogenated Castor Oil (12)"]},
        "Claims are retailer-graded; the formula cluster carries the decision.",
        "candidate", "repair (name 'Strength & Length + Keratin Oil'; retailers 'Anti-Haarbruch', 'strapaziertes Haar', 'Spliss', low)",
        True, "keratin + argan oil + amodimethicone + guar substantive cluster",
        "Low-graded repair claims may act as candidate because the verdict is independently repair_supported (CL-SRC); focus capped at moderate.",
        "repair: anti-breakage/damage positioning (low-graded) over an independently repair_supported formula (keratin, argan oil, amodimethicone, guar).",
        "Claims only in retailer copy; heavy formula.",
        [{"ingredient": "Hydrolyzed Keratin", "position": 6}, {"ingredient": "Argania Spinosa Kernel Oil", "position": 7}, {"ingredient": "Amodimethicone", "position": 10}],
        "provisional pending_claims -> repair")
s = SEC([], "moderate", ["shine"], ["'strahlender Glanz' (retailer, low)"], [], "Low-graded; same route (F2).", "Empty.", "Shine wording.")
u = USE("regular", "high", "none", "none", [], [], "Default.")
SPEC["T113"] = {"name": "OGX Strength & Length + Keratin Oil Shampoo", "brand": "OGX", "packSize": "385 ml",
  "sourceGrades": {"productName": "high ('Strength & Length' not a focus value word by itself)", "retailers": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No scalp claim."),
  "focusRecord": REC(f, s, u), "d1": NOD1, "targets": {"primary": ORD1_MOD(), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "repair", "evidence": "anti-breakage claims", "reason": "low claim + repair_supported"}],
  "uncertainties": [{"reading": "weight high (W-RICH + weak reset)", "alternative": "moderate"},
                    {"reading": "focus repair from low-graded claims", "alternative": "general if 'Strength' is not read as a repair claim and low claims are discounted"}]}

# ---------------- T114 ----------------
f = FOC("scalp_active", "high", "none", "not_applicable", {"scalp_active": ["Piroctone Olamine (7)"]},
        "Cosmetic anti-dandruff support only; efficacy figures are claims.",
        "candidate", "dandruff (name 'Anti Schuppen Plus', high)",
        True, "recognized anti-dandruff active Piroctone Olamine (7)",
        "Problem-led product with recognized active and anti-dandruff positioning -> scalp_active (7.2).",
        "scalp_active: the exact name is an anti-dandruff claim and the formula contains Piroctone Olamine.",
        "Oily-hair positioning (clarifying-type) is part of the dandruff unit; menthol is a comfort counter-signal.",
        [{"ingredient": "Piroctone Olamine", "position": 7}], "provisional pending_claims -> scalp_active")
s = SEC([], "moderate", ["clarifying"], ["'für fettendes Haar' / 'bei schnell fettendem Haar' (manufacturer, moderate) - inside/next to the dandruff unit"], [],
        "The oily wording sits inside the dandruff claim units; no separate clarifying positioning and the route would be the ordinary cleansing system ('clarifying only because cleansing...' pattern).",
        "Empty.", "Oily-hair positioning could be read as a distinct clarifying role.")
u = USE("treatment", "high", "none", "recognized_active_problem_led",
        ["dandruffSupport supported (Piroctone Olamine 7)", "name 'Anti Schuppen Plus' (high)"],
        ["frequent (manufacturer 'Täglich oder 2-3x pro Woche anwenden', cleansing moderate) loses to treatment (U1)"],
        "U3: recognized active + qualifying E2 dandruff claim -> treatment.")
SPEC["T114"] = {"name": "Sebamed Anti-Schuppen Shampoo PLUS", "brand": "Sebamed", "packSize": "200 ml",
  "sourceGrades": {"productName": "high", "manufacturer_de": "moderate", "dm": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": SCT("not_targeted", "high", "none",
        "No SC1 unit: 'Juckreiz' occurs only inside the dandruff unit (E2a); 'reinigt die Kopfhaut schonend' is sparing wording. CSA also not met (no prominent E4 route; Menthol 8 prominent).",
        "None.", [{"ingredient": "Menthol", "position": 8}], "provisional not_targeted -> not_targeted"),
  "focusRecord": REC(f, s, u), "d1": NOD1,
  "dandruffCounter": "None; mechanical (Section 11).",
  "targets": {"primary": T("dandruff", "high", "S-DANDRUFF: E2 dandruff claim in the product name (high) + dandruffSupport supported (high) -> dandruff primary (S-PRIMARY, R17.1); no secondary (R17.2)."), "secondary": None},
  "combo": ["oily"], "comboConf": {"oily": "moderate"},
  "extraNotes": [{"code": "suits_dandruff_with_oily_scalp", "detail": "manufacturer (moderate): 'bei schnell fettendem Haar', 'für fettendes Haar'; S-OILY clause passes (cleansing moderate, weight low, conditioning moderate)."},
                 {"code": "dandruff_bundled_comfort_wording", "detail": "'... Bekämpfung von Schuppen bei schnell fettendem Haar und Juckreiz' (manufacturer, moderate); S-SENSITIVE formula gate failed: CSA not met (no prominent E4 comfort or humectant route), no prominent comfort route."}],
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "scalp_active", "evidence": "name 'Anti Schuppen'", "reason": "7.2"},
                   {"property": "usageRole", "from": "provisional regular", "to": "treatment", "evidence": "name + active", "reason": "U3"}],
  "uncertainties": [{"reading": "conditioning moderate (single prominent cationic starch)", "alternative": "low"},
                    {"reading": "'schnell fettendem Haar' read as E2 oily wording (hair-worded lexicon term)", "alternative": "not oily -> combination []"}]}

# ---------------- T115 ----------------
f = FOC("scalp_active", "moderate", "general", "not_applicable",
        {"scalp_comfort": ["Urea (3)", "Glycerin (5)", "Sodium Lactate (7)", "Panthenol (8)", "Allantoin (9)"]},
        "Positioning is shared skin + scalp (2-in-1 shower gel & shampoo).",
        "candidate", "dry + sensitive scalp ('speziell für trockene sowie empfindliche Haut und Kopfhaut', manufacturer, moderate)",
        True, "CSA: prominent Urea, Panthenol, Allantoin, Glycerin",
        "SC1 sensitive/dry scalp positioning + targeted -> scalp_active (7.2).",
        "scalp_active: positioned for dry and sensitive skin and scalp with a prominent Urea/Panthenol/Allantoin/Glycerin comfort-humectant architecture.",
        "Body-wash 2-in-1 positioning; Parfum (12).",
        [{"ingredient": "Urea", "position": 3}, {"ingredient": "Panthenol", "position": 8}, {"ingredient": "Allantoin", "position": 9}],
        "provisional pending_claims -> scalp_active")
s = SEC([], "moderate", ["moisture"], ["'kann dem Austrocknen von Haut und Haar entgegenwirken' (moderate)"], [],
        "Protective/anti-drying wording on the same humectant route (F3); no distinct lengths positioning.", "Empty.", "Hair anti-drying wording.")
u = USE("regular", "high", "none", "none", [], [], "Default; no frequency wording; recognized active without dandruff claim does not fire treatment (U3).")
SPEC["T115"] = {"name": "Balea med Duschgel & Shampoo 2in1 Urea 5%", "brand": "Balea", "packSize": "300 ml",
  "sourceGrades": {"productName": "high", "manufacturer_de (dm own brand)": "moderate"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": SCT("targeted", "moderate", "not_targeted",
        "SC1: 'speziell für trockene sowie empfindliche Haut und Kopfhaut entwickelt' (moderate) names dry and sensitive scalp. CSA: prominent Urea (3), Panthenol (8), Allantoin (9), Glycerin (5), Sodium Lactate (7).",
        "Positioning is shared with body skin; Parfum present.",
        [{"ingredient": "Urea", "position": 3}, {"ingredient": "Panthenol", "position": 8}, {"ingredient": "Allantoin", "position": 9}, {"ingredient": "Glycerin", "position": 5}],
        "provisional not_targeted -> targeted"),
  "focusRecord": REC(f, s, u), "d1": NOD1,
  "targets": {"primary": T("sensitive", "moderate", "S-SENSITIVE: E2 sensitive unit (moderate) + targeted + prominent comfort routes (Urea, Panthenol, Allantoin). Both sensitive and dry pass; no name precedence -> sensitive first (S-PRIMARY)."),
              "secondary": T("dry", "moderate", "S-DRY: same unit names 'trockene ... Kopfhaut' (moderate) + targeted + prominent humectant routes (Glycerin 5, Urea 3, Sodium Lactate 7, Panthenol 8). Not dandruff-primary (no dandruff claim; R17.3).")},
  "extraNotes": [{"code": "active_without_dandruff_positioning", "detail": "Piroctone Olamine (22) without a dandruff claim (R17.3); sensitive/dry paths stay open."}],
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "scalp_active", "evidence": "manufacturer unit", "reason": "SC1 + CSA"},
                   {"property": "scalpComfortTarget", "from": "provisional not_targeted", "to": "targeted", "evidence": "SC1 unit", "reason": "positioning revealed"}],
  "uncertainties": [{"reading": "a combined 'Haut und Kopfhaut' unit counts as scalp positioning for both states", "alternative": "only skin positioning -> ordinary"},
                    {"reading": "product is a shower-gel/shampoo 2-in-1 kept in the regular-shampoo cohort", "alternative": "out of cohort (identity question for orchestrator)"}]}

# ---------------- T116 ----------------
f = FOC("general", "moderate", "moisture", "nonspecific",
        {"moisture": ["Glycerin (24, trace)", "Cocos Nucifera Fruit Juice (25, trace)"], "shared": ["Polyquaternium-10 (11)"]},
        "No coherent humectant cluster; one late polymer.",
        "candidate", "moisture ('Shampoo für schwerelose Feuchtigkeit', manufacturer, moderate)",
        False, "none (verdict nonspecific)", "F1: moisture language over a nonspecific formula stays general.",
        "general: moisture is positioned, but the formula has only trace glycerin and a late PQ-10, so the verdict is nonspecific.",
        "Manufacturer-graded moisture claim.",
        [{"ingredient": "Glycerin", "position": 24}, {"ingredient": "Polyquaternium-10", "position": 11}], "provisional pending_claims -> general")
s = SEC([], "high", "none", [], [], "None.", "Empty.", "None.")
u = USE("regular", "high", "none", "none", [], [], "Default.")
SPEC["T116"] = {"name": "Herbal Essences Fiji Shampoo (Schwerelose Feuchtigkeit)", "brand": "Herbal Essences (Procter & Gamble)", "packSize": "350 ml",
  "sourceGrades": {"productName": "high", "manufacturer_brand_portal_de": "moderate", "retailers": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No scalp claim."),
  "focusRecord": REC(f, s, u), "d1": NOD1, "targets": {"primary": ORD1_HIGH(), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "general", "evidence": "'schwerelose Feuchtigkeit'", "reason": "F1 nonspecific"}],
  "uncertainties": [{"reading": "focus general", "alternative": "moisture"}, {"reading": "conditioning low", "alternative": "moderate"}]}

# ---------------- T117 ----------------
f = FOC("moisture", "moderate", "general", "moisture_supported",
        {"moisture": ["Glycerin (12)", "Panthenol (20)", "Sodium Hyaluronate (23)"], "shared": ["Stearyl Alcohol (6)", "Cetyl Alcohol (9)", "Polyquaternium-6 (14)", "Guar HPTC (15)"]},
        "Humectants after Parfum; claims retailer-only.",
        "candidate", "moisture (name 'Hydra Glow', high; retailers 'Intensive Feuchtigkeit', 'trockenes Haar', low)",
        True, "humectant cluster + fatty-alcohol/cationic conditioning",
        "Name word 'Hydra' plus retailer moisture claims over a moisture_supported formula -> moisture.",
        "moisture: the name ('Hydra') and copy position hydration for dry hair, and the formula has a humectant cluster (Glycerin, Panthenol, Sodium Hyaluronate) with fatty-alcohol and cationic support.",
        "Only the name word is above low grade; 'Glow' (shine) rides the same route.",
        [{"ingredient": "Glycerin", "position": 12}, {"ingredient": "Panthenol", "position": 20}, {"ingredient": "Sodium Hyaluronate", "position": 23}, {"ingredient": "Stearyl Alcohol", "position": 6}],
        "provisional pending_claims -> moisture")
s = SEC([], "moderate", ["shine"], ["'Glow' (name), 'Glanz' (retailers)"], [], "Shine delivered by the same conditioning route (F2).", "Empty (F2).", "Name-level 'Glow'.")
u = USE("regular", "high", "none", "none", ["Müller (low) 'tägliche Haarwäsche' cannot fire"], [], "Default.")
SPEC["T117"] = {"name": "PANTENE PRO-V Shampoo Miracles Hydra Glow", "brand": "Pantene Pro-V (Procter & Gamble)", "packSize": "250 ml",
  "sourceGrades": {"productName": "high", "retailers": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No scalp claim."),
  "focusRecord": REC(f, s, u), "d1": NOD1, "targets": {"primary": ORD1_MOD(), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "moisture", "evidence": "'Hydra' + copy", "reason": "candidate + moisture_supported"}],
  "uncertainties": [{"reading": "'Hydra' counts as a name-level moisture word", "alternative": "only low-graded claims (still moisture via CL-SRC independent support, capped moderate)"},
                    {"reading": "weight moderate", "alternative": "high"}]}

# ---------------- T118 ----------------
f = FOC("general", "moderate", "scalp_active", "not_applicable", {},
        "Mildness is not a focus.", "not_applicable", "mild everyday cleansing; 'für empfindliche Kopfhaut' (manufacturer, moderate)",
        False, "scalp_active fails: scalpComfortTarget not_targeted (CSA not met)",
        "Sensitive positioning without CSA -> not targeted -> scalp_active not compatible; only mild/every-day positioning remains -> general (7.2).",
        "general: positioned as a mild every-day shampoo for sensitive scalp, but without a listed prominent comfort/humectant route it is not targeted, so scalp_active is not compatible.",
        "Explicit sensitive-scalp positioning sent to review via S-FAIL.", [{"ingredient": "Decyl Glucoside", "position": 2}], "provisional pending_claims -> general")
s = SEC([], "high", "none", [], [], "None.", "Empty.", "None.")
u = USE("frequent", "high", "none", "explicit_frequent_non_strong",
        ["product name (high): 'Every-Day'", "manufacturer (moderate): 'für die tägliche Haarwäsche', 'Für die tägliche Anwendung geeignet'"], [],
        "U2 wording (name and manufacturer) and cleansingStrength low -> frequent.")
SPEC["T118"] = {"name": "Sebamed Every-Day Shampoo", "brand": "Sebamed", "packSize": "200 ml",
  "sourceGrades": {"productName": "high", "manufacturer_de": "moderate", "dm": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": SCT("not_targeted", "high", "none",
        "SC1 holds ('Schonende, seifenfreie Reinigung für empfindliche Kopfhaut', manufacturer, moderate), but CSA fails: no E4 comfort or humectant route among prominent positions 1-6 (Sodium Lactate 14 is after Parfum). Without a listed prominent route an explicitly positioned product is not_targeted (CSA).",
        "A mild glucoside chassis and pH 5.5 are supportive but not sufficient (CSA).", [{"ingredient": "Sodium Lactate", "position": 14}], "provisional not_targeted -> not_targeted"),
  "focusRecord": REC(f, s, u), "d1": NOD1,
  "targets": {"primary": T("ordinary", "moderate", "S-ORDINARY way 4: claimed sensitive target failed its formula gate (S-FAIL) and nothing else passed -> moderate."), "secondary": None},
  "extraFlags": [{"code": "review_specialist_gate_failed", "detail": "sensitive: formula gate failed - scalpComfortTarget not_targeted (CSA: no prominent E4 comfort or humectant route in positions 1-6); no unlisted_route_candidate among prominent ingredients"}],
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "general", "evidence": "mild/sensitive positioning", "reason": "not targeted"},
                   {"property": "usageRole", "from": "provisional regular", "to": "frequent", "evidence": "name 'Every-Day'", "reason": "U2"}],
  "uncertainties": [{"reading": "'Schonende ... Reinigung für empfindliche Kopfhaut' read as SC1 positioning (-> S-FAIL review)", "alternative": "protective/sparing wording (E2a) -> ordinary way 1, high, no flag"}]}

# ---------------- T119 ----------------
f = FOC("general", "moderate", "moisture", "nonspecific",
        {"moisture": ["Sodium Hyaluronate (13)"], "shared": ["Dimethicone (6)", "Guar HPTC (8)", "Glycol Distearate (3)", "Amodimethicone (23)"]},
        "A single humectant entry is not a coherent humectant cluster; conditioning is generic silicone/guar.",
        "candidate", "moisture (name 'Hydra Hyaluronic 72H Feuchtigkeit-Auffüllendes Shampoo', high)",
        False, "none (verdict nonspecific)",
        "F1: moisture language over a nonspecific formula stays general.",
        "general: the name positions moisture strongly, but the formula's moisture route is one humectant (Sodium Hyaluronate) on top of generic silicone/guar conditioning, which distinguishes neither moisture nor repair (nonspecific).",
        "Name-level moisture claim; C2 conditioning is high, which supports moisturized feel generically.",
        [{"ingredient": "Sodium Hyaluronate", "position": 13}, {"ingredient": "Dimethicone", "position": 6}], "provisional pending_claims -> general")
s = SEC([], "moderate", ["shine"], ["'gesund glänzendes ... Haar' (manufacturer)"], [], "Shine from the same silicone/smoothing route (F2).", "Empty (F2).", "Shine wording.")
u = USE("regular", "high", "none", "none", [], [], "Default.")
SPEC["T119"] = {"name": "L'Oréal Paris Elvital Hydra Hyaluronic 72H Feuchtigkeit-Auffüllendes Shampoo", "brand": "L'Oréal Paris Elvital", "packSize": "1000 ml",
  "sourceGrades": {"productName": "high", "manufacturer_de": "moderate", "dm": "low"},
  "focusPrimary": f, "focusSecondary": s, "usageRole": u,
  "scalpComfortTarget": NOT_SC("No E2 scalp claim ('versorgt ... die Kopfhaut ... mit Feuchtigkeit' is not an E2 dry-scalp unit)."),
  "focusRecord": REC(f, s, u), "d1": NOD1, "targets": {"primary": ORD1_HIGH(), "secondary": None},
  "blindToFinal": [{"property": "focusPrimary", "from": "provisional", "to": "general", "evidence": "name moisture claim", "reason": "verdict nonspecific (F1)"}],
  "uncertainties": [{"reading": "focus general (one humectant is not a cluster)", "alternative": "moisture (moisture_supported via C2 conditioning + hyaluronate)"},
                    {"reading": "weight moderate under W1", "alternative": "high"}]}
