"""Lane-b post-unblind decisions (Section 3.2) for kit-W1, W101-W119."""


def focus(value, conf, nb, role, counter, trace, rationale, rules, care=None):
    d = {"value": value, "confidence": conf, "neighboringAlternative": nb, "claimRole": role,
         "counterSignal": counter, "decisionTrace": trace, "rationale": rationale, "ruleIds": rules}
    if care is not None:
        d["careDirection"] = care
    return d


def na_care(blind_verdict, note=""):
    return {"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedConditioningRoutes": [],
            "limitation": f"chosen focus is not a repair/moisture decision; blind formula verdict was {blind_verdict}. {note}".strip()}


def sec(value, conf, nb, trace, rationale, rules=("8", "F2", "F3")):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "decisionTrace": trace,
            "rationale": rationale, "ruleIds": list(rules)}


def usage(value, conf, nb, code, evidence, losing, rationale, rules=("9", "U1")):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "triggerCode": code,
            "triggerEvidence": evidence, "losingTriggers": losing, "rationale": rationale, "ruleIds": list(rules),
            "decisionTrace": f"Default regular considered; trigger {code}; " + (("losing: " + "; ".join(losing)) if losing else "no losing trigger") + "."}


def comfort(value, conf, nb, rationale, rules=("10", "CSA", "SC1", "E2a")):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "rationale": rationale, "ruleIds": list(rules)}


def tgt(target, conf, rationale):
    return {"target": target, "confidence": conf, "rationale": rationale}


NO_D1 = {"value": False, "confidence": "high", "rationale": "No D1 stem (tiefenrein, deep clean, clarifying shampoo, detox-reinigung) in the name or a manufacturer/pack claim, and no occasional-use directions."}

CF_STD = {
    "cleansingStrength": "see rationale (counter-signals recorded there; convention value unchanged by claims, 3.2)",
    "conditioningLevel": "see rationale",
    "weightPotential": "see counterevidence / whyNotNeighborBand",
    "dandruffSupport": "none (mechanical presence test, Section 11)",
}

PRODUCTS = {}

# ---------------------------------------------------------------- W101
PRODUCTS["W101"] = dict(
    brand="Guhl",
    productName="Guhl Hyaluron+ Pflege Feuchtigkeits-Shampoo",
    counter=dict(CF_STD, dandruffSupport="Active present without any dandruff claim (R17.3): formula fact only."),
    claimUnits=[
        "name (high): 'Hyaluron+ Pflege Feuchtigkeits-Shampoo' - moisture term in the name",
        "manufacturer_de (moderate): 'Für feuchtigkeitsbedürftiges Haar'; 'Dein Haar fühlt sich trocken und stumpf an? Es braucht intensive Feuchtigkeit'; 'rehydriert dein Haar sofort'; 'gesund glänzende Längen' - lengths moisture, no scalp state named",
        "retailers (low): 'Ohne zu beschweren'; 'sanft zur Kopfhaut' (protective, E2a); 'dermatologisch bestätigt' (protective)",
        "no dandruff, sensitive, dry-scalp or oily claim unit in any source; no frequency wording in a moderate/high source",
    ],
    focusPrimary=focus("moisture", "moderate", "general", "candidate",
        "Moisture cluster is mid-to-late (Glycerin@12, Panthenol@13, Sodium Hyaluronate@18) in a rinse-off; Piroctone Olamine@15 is present but unpositioned.",
        "Claim direction: moisture (name 'Feuchtigkeits-Shampoo', high; manufacturer 'feuchtigkeitsbedürftiges Haar', moderate). Formula verdict moisture_supported (humectants + guar@9 + waxy lipid@6 + Glyceryl Oleate@8) -> compatible. Decision: moisture (F1).",
        "Moisture: dominant exact-product claim with a moisture_supported formula (7.2, F1). Confidence moderate because the humectant cluster is modest and rinse-off.",
        ["7.2", "7.3", "F1", "CL-SRC"]),
    focusSecondary=sec([], "moderate", ["shine"],
        "Empty default considered; 'gesund glänzende Längen' is an outcome of the same moisture/deposition route (F2) - no independent shine route.",
        "Empty: shine is only an outcome of the primary route (F2, F3)."),
    usageRole=usage("regular", "high", "none", "none", [], [],
        "Regular: no frequency wording in a moderate/high source ('bei regelmäßiger Anwendung' is not U2); cleansing moderate excludes alternating; no dandruff claim, so treatment cannot fire (U3)."),
    scalpComfortTarget=comfort("not_targeted", "high", "none",
        "Not targeted: no E2 sensitive or dry-scalp claim unit (SC1); 'sanft zur Kopfhaut' is retailer-only protective wording. CSA would be met (Panthenol@13 etc.) but positioning is absent."),
    primaryTarget=tgt("ordinary", "moderate",
        "S-ORDINARY ways 1 (no qualifying E2 claim unit; manufacturer source present -> high) and 3 (recognized active Piroctone Olamine@15 without a dandruff claim -> moderate); lowest = moderate (13.8)."),
    secondaryTarget=None,
    d1=NO_D1,
    manualNotes=["active_without_dandruff_positioning (Piroctone Olamine@15; R17.3)"],
    reconciliation=[
        "focusPrimary general (provisional, low) -> moisture (moderate): name 'Feuchtigkeits-Shampoo' (high) + manufacturer moisture claims (moderate) over the blind moisture_supported verdict.",
        "focusSecondary [] provisional -> [] (moderate): glänzende Längen is an F2 outcome.",
        "usageRole regular provisional (low) -> regular (high): no trigger in any moderate/high source.",
        "scalpComfortTarget not_targeted provisional (low) -> not_targeted (high): no SC1 positioning.",
        "No formula property changed (3.2).",
    ],
    uncertainties=[
        "conditioningLevel high rests on W-RICH (E3) because C2 lacks a separate pearlizing/fatty route; alternative: moderate (one guar + light routes).",
        "weightPotential moderate vs high: W-RICH met but reset not limited; convergence route judged insufficient (single guar, no silicone). Alternative: high.",
    ],
)

# ---------------------------------------------------------------- W102
PRODUCTS["W102"] = dict(
    brand="Syoss",
    productName="Syoss Intense Volume Shampoo (syoss.de: Intense Volume Leichtes Shampoo)",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Intense Volume' - volume",
        "manufacturer_de (moderate): 'Tiefenpflegende Formel mit 3% Kollagen-Lift-Komplex, stärkt das Haar von innen'; 'Reinigt feines, plattes Haar'; 'Milde Formel für die tägliche Haarwäsche ohne zu beschweren'; 'Bis zu 48 Stunden langanhaltendes Volumen'",
        "retailers (low): 'Ideal für feines und plattes Haar'; 'Für die tägliche Reinigung geeignet'",
        "'Tiefenpflegende' is a care term sharing a prefix - not D1 (13.6)",
    ],
    focusPrimary=focus("volume", "moderate", "repair", "candidate",
        "Two prominent hydrolyzed proteins (Keratin@5, Collagen@6) form a repair-leaning cluster; the 'stärkt von innen' claim points to repair.",
        "Claim direction: volume (name 'Intense Volume', high; manufacturer 48h volume, moderate). Formula compatible: weightPotential low, light protein/refatter routes, no silicone. Route: light low-deposition architecture with protein film for body. Decision: volume.",
        "Volume: dominant name claim with a compatible light formula (7.2).",
        ["7.2", "CL-SRC", "T2"],
        care=na_care("repair_supported", "Repair is the trade-off route (collagen-lift complex).")),
    focusSecondary=sec([], "moderate", ["repair"],
        "Empty default considered. 'stärkt das Haar von innen' belongs to the same 3% collagen-lift complex the volume claim relies on (Keratin@5, Collagen@6); no independent repair route (F3).",
        "Empty: the strengthening claim rides on the primary's protein route (F2, F3)."),
    usageRole=usage("frequent", "high", "none", "explicit_frequent_non_strong",
        ["manufacturer_de (moderate): 'Milde Formel für die tägliche Haarwäsche'", "cleansingStrength moderate (not strong)"], [],
        "Frequent: explicit U2 frequency wording ('tägliche Haarwäsche') from a moderate source and a non-strong formula.", ("9", "U1", "U2")),
    scalpComfortTarget=comfort("not_targeted", "high", "none",
        "Not targeted: no E2 sensitive/dry-scalp claim unit; 'Milde Formel' is mildness, not positioning. CSA not met either."),
    primaryTarget=tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; packet has a manufacturer source -> high (13.8)."),
    secondaryTarget=None,
    d1=dict(NO_D1, rationale="Not D1: 'Tiefenpflegende Formel' is a care term (Tiefenpflege) explicitly excluded from D1; no occasional-use directions."),
    reconciliation=[
        "focusPrimary general (low) -> volume (moderate): name 'Intense Volume' (high) + manufacturer volume claims; formula compatible.",
        "careDirection: blind repair_supported recorded; final verdict not_applicable for the volume focus.",
        "usageRole regular (low) -> frequent (high): 'tägliche Haarwäsche' (manufacturer, moderate), cleansing moderate.",
        "scalpComfortTarget not_targeted (moderate) -> not_targeted (high).",
        "No formula property changed.",
    ],
    uncertainties=[
        "weightPotential low vs moderate: two prominent hydrolyzed proteins; read as low-persistence film (alternative moderate, recorded as neighbor -> T4 fine flag).",
        "Secondary repair rejected because the strengthening claim shares the collagen-lift route; alternative ['repair'].",
    ],
)

# ---------------------------------------------------------------- W103
PRODUCTS["W103"] = dict(
    brand="Hair Biology (Procter & Gamble)",
    productName="hair biology Shampoo Revitalize & Soothe (Meno Balance)",
    counter=dict(CF_STD, dandruffSupport="Active present without any dandruff claim (R17.3)."),
    claimUnits=[
        "name (high): 'Revitalize & Soothe' - English name words that do not name the scalp (F7 note); no E2 term",
        "retailer dm.de (low): 'Bei dünner werdendem, trockenem Haar & trockener Kopfhaut' (dry-scalp unit + hair-density wording)",
        "retailer dm.de (low): 'Beruhigt die aus dem Gleichgewicht geratene Kopfhaut' (sensitive unit, E2 'beruhigt die Kopfhaut')",
        "retailer dm.de (low): 'Spendet trockenem Haar Feuchtigkeit'; 'für den täglichen Gebrauch geeignet'; 'für dichtes, volleres Haar'",
        "retailer shop-apotheke.at (low, Austrian): same claims",
        "no manufacturer or pack source in the packet",
    ],
    focusPrimary=focus("general", "moderate", "moisture", "not_applicable",
        "Low-graded moisture and scalp-comfort claims exist but cannot act: moisture needs a moisture_supported verdict (formula nonspecific), scalp_active needs targeted (fails SC1 and CSA).",
        "Claim direction: moisture / scalp comfort, all retailer-graded low (CL-SRC). Formula verdict nonspecific (silicone/guar conditioning; panthenol trace). A low claim may be a candidate only when the verdict independently supports it - it does not. Hair-density wording ignored (F5). Decision: general.",
        "General: only low-graded claims over a nonspecific formula (CL-SRC, F1, F5).",
        ["7.2", "F1", "F5", "CL-SRC"]),
    focusSecondary=sec([], "high", "none", "Empty default considered; no moderate/high distinct positioning.", "Empty."),
    usageRole=usage("regular", "high", "none", "none", [], ["explicit_frequent_non_strong: 'für den täglichen Gebrauch' is retailer-low and the formula is strong"],
        "Regular: only low claims; strong formula has no moderate/high reset intent; no dandruff claim."),
    scalpComfortTarget=comfort("not_targeted", "high", "none",
        "Not targeted: the sensitive and dry-scalp units are retailer-only (low), so SC1 is not met; CSA is also not met (no prominent E4 route, no MB; strong cleansing)."),
    primaryTarget=tgt("ordinary", "moderate",
        "S-ORDINARY way 3 (Piroctone Olamine@12 without a dandruff claim) and way 4 (claimed sensitive and dry targets failed their positioning gates - only low-graded units - and would fail S-SENSITIVE/S-DRY formula gates too); hair-density wording not evaluated (S-HAIRLOSS). Confidence moderate."),
    secondaryTarget=None,
    d1=NO_D1,
    manualFlags=["review_specialist_gate_failed: sensitive (positioning gate: only retailer-low units; formula gate: scalpComfortTarget not_targeted, no prominent E4 comfort route, no MB) and dry (positioning gate: only retailer-low units; formula gate: not_targeted, no prominent E4 humectant route); no unlisted_route_candidate"],
    manualNotes=["active_without_dandruff_positioning (Piroctone Olamine@12; R17.3)",
                 "hair_loss_claim_not_evaluated ('dünner werdendem Haar', 'für dichtes, volleres Haar'; F5, S-HAIRLOSS)"],
    reconciliation=[
        "focusPrimary general (low) -> general (moderate): claims are all retailer-low; formula nonspecific.",
        "usageRole regular (low) -> regular (high).",
        "scalpComfortTarget not_targeted (moderate) -> not_targeted (high): sensitive/dry units are low-graded.",
        "Projection: S-FAIL for sensitive and dry -> ordinary with review_specialist_gate_failed.",
        "No formula property changed.",
    ],
    uncertainties=[
        "Formula source tier 4 and identityConfidence moderate (packet); no manufacturer DE source in the reveal.",
        "Whether 'dünner werdendes Haar' is a hair-density claim (taken as F5 out of scope; alternative: ignore without note).",
        "S-FAIL raised although the only qualifying units are low-graded (S-FAIL explicitly covers a positioning-gate failure from low units); alternative: S-ORDINARY way 1 without a flag.",
    ],
)

# ---------------------------------------------------------------- W104
PRODUCTS["W104"] = dict(
    brand="Garnier Wahre Schätze",
    productName="Garnier Wahre Schätze Shampoo Honig Schätze (Reparierendes Shampoo Honig Schätze)",
    counter=CF_STD,
    claimUnits=[
        "name (high, alternate name in packet): 'Reparierendes Shampoo Honig Schätze' - repair term",
        "manufacturer_de (moderate): 'Speziell für die Bedürfnisse von strapaziertem und brüchigem Haar entwickelt, repariert und kräftigt'; 'wirken Haarschäden wie Spliss, Haarbruch und Haarriss entgegen'; 'spürbar geschmeidig und leichter kämmbar'",
        "retailers (low): repair/aufbauend wording; 'Bienenwachs hat schützende Eigenschaften'",
        "no scalp claim unit; no frequency wording",
    ],
    focusPrimary=focus("general", "moderate", "repair", "not_applicable",
        "Exact-product positioning is clearly repair (name + manufacturer), but the formula does not support repair.",
        "Claim direction: repair (moderate/high). Formula verdict moisture_supported (glycerin@8, honey@5-6, guar@17, weak refatters) and not repair_supported: no protein, no silicone, no lipid; deposition light (weight low). F1: damage positioning maps to repair only with repair_supported or dual_supported; no moisture claim exists to use the moisture verdict. 'Bienenwachs' is claimed but not in the INCI (note, ID-3 non-material). Decision: general.",
        "General: repair claim over a formula whose verdict is moisture_supported, not repair_supported (F1, 3.2: claims cannot override the formula).",
        ["7.2", "7.3", "F1", "3.2"]),
    focusSecondary=sec([], "high", "none", "Empty default considered; no distinct second positioning.", "Empty."),
    usageRole=usage("regular", "high", "none", "none", [], [], "Regular: no frequency, reset or dandruff trigger."),
    scalpComfortTarget=comfort("not_targeted", "high", "none", "Not targeted: no E2 sensitive/dry-scalp claim unit."),
    primaryTarget=tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present -> high."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> general (moderate): repair positioning rejected by F1 (formula verdict moisture_supported).",
        "usageRole/scalpComfortTarget confirmed at high confidence.",
        "Claim conflict (ID-3): 'Bienenwachs' claimed by retailers, no Cera Alba in the frozen INCI - a lipid that could touch weight, but claimed only in retailer copy and the manufacturer DE page does not name it; recorded as a note, treated non-material (a beeswax at trace level would not move a low band against the SLS chassis). Flagged in uncertainties.",
        "No formula property changed.",
    ],
    uncertainties=[
        "Repair verdict: the light refatter/guar cluster could be argued dual_supported; alternative focus repair (moderate).",
        "Bienenwachs claim vs INCI without Cera Alba: possible formula-version difference; treated as non-material note. Alternative: material conflict -> weight low confidence.",
        "identityConfidence moderate per packet.",
    ],
)

# ---------------------------------------------------------------- W105
PRODUCTS["W105"] = dict(
    brand="Balea",
    productName="Balea (med) Ultra Sensitive Shampoo",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Ultra Sensitive' - name word that does not name the scalp; counts only with a scalp-naming manufacturer unit (SC1)",
        "manufacturer_de (moderate): 'Mildes Shampoo für empfindliche Kopfhaut' - qualifying E2 sensitive unit ('für ... empfindliche Kopfhaut')",
        "manufacturer_de (moderate): 'besonders sanfte Reinigung für Haar und empfindliche Kopfhaut'",
        "manufacturer_de (moderate): 'milde Pflegeformel mit 5 % Glycerin, Panthenol und Niacinamid spendet Feuchtigkeit und pflegt das Haar geschmeidig glänzend' - lengths moisture",
        "manufacturer_de (moderate): 'ohne die Kopfhaut zu reizen' (protective, E2a); 'ideal für die tägliche Haarwäsche bei sensibler Haut' (U2 frequency wording)",
    ],
    focusPrimary=focus("scalp_active", "moderate", "moisture", "candidate",
        "Moderate cleansing (sodium coco-sulfate chassis); lengths moisture claim competes.",
        "Claim direction: sensitive scalp (manufacturer, moderate) and lengths moisture. F7: name 'Ultra Sensitive' names no scalp role, so neither role is in the name -> scalp_active primary, formula-compatible (scalpComfortTarget targeted). Route: comfort routes Panthenol@7, Niacinamide@8; fragrance-free.",
        "scalp_active: explicit sensitive-scalp positioning with targeted comfort (7.2, F7).",
        ["7.2", "F7", "SC1"],
        care={"verdict": "moisture_supported", "moistureRoutes": ["Glycerin@3", "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride@12", "Glyceryl Oleate@11"], "repairRoutes": [], "sharedConditioningRoutes": ["Hydrogenated Palm Glycerides Citrate@13", "Lecithin@14"], "limitation": "verdict applies to the secondary moisture role; primary is scalp_active"}),
    focusSecondary=sec(["moisture"], "moderate", [],
        "Empty default considered. Distinct lengths positioning: '5 % Glycerin ... spendet Feuchtigkeit und pflegt das Haar geschmeidig' (manufacturer, moderate). Independent route: Glycerin@3 + guar@12 + Glyceryl Oleate@11 (the primary cites Panthenol@7, Niacinamide@8 and the fragrance-free mild formula). Distinct from scalp comfort.",
        "Moisture secondary: separate lengths-moisture positioning with an independent humectant + cationic route (Section 8, F3)."),
    usageRole=usage("frequent", "high", "none", "explicit_frequent_non_strong",
        ["manufacturer_de (moderate): 'ideal für die tägliche Haarwäsche bei sensibler Haut'", "cleansingStrength moderate"], [],
        "Frequent: explicit 'tägliche Haarwäsche' from a moderate source, non-strong formula.", ("9", "U1", "U2")),
    scalpComfortTarget=comfort("targeted", "moderate", "not_targeted",
        "Targeted: SC1 met by 'Mildes Shampoo für empfindliche Kopfhaut' (manufacturer, moderate); CSA met by prominent E4 comfort routes Panthenol@7 and Niacinamide@8 and humectant routes Glycerin@3, Glyceryl Oleate@11; fragrance-free supportive. MB not met (Sodium Coco-Sulfate@4). Confidence moderate (positioning moderate)."),
    primaryTarget=tgt("sensitive", "moderate",
        "S-SENSITIVE: E2 sensitive unit 'für empfindliche Kopfhaut' (moderate); formula gate scalpComfortTarget targeted + prominent comfort route Panthenol@7/Niacinamide@8. cleansingStrength moderate -> no strong-cleansing flag. Confidence = min(positioning moderate, targeted moderate)."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> scalp_active (moderate): manufacturer sensitive-scalp positioning + CSA.",
        "focusSecondary [] -> ['moisture'] (moderate): separate lengths-moisture claim with independent glycerin/guar route.",
        "usageRole regular (low) -> frequent (high).",
        "scalpComfortTarget not_targeted (provisional) -> targeted (moderate): SC1 + CSA.",
        "No formula property changed.",
    ],
    uncertainties=[
        "cleansingStrength moderate (C5) with neighbor low: current regular vs bucket irritationen expectation gentle -> amber; I3 raises no flag because the current intensity already differs.",
        "Secondary moisture could be read as an outcome of the same mild care formula; alternative [].",
        "'Mildes Shampoo für empfindliche Kopfhaut' read as for-the-state positioning, not sparing wording; alternative: protective -> not_targeted, ordinary.",
    ],
)

# ---------------------------------------------------------------- W106
PRODUCTS["W106"] = dict(
    brand="Neqi",
    productName="Neqi Moisture Mystery Shampoo",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Moisture Mystery' - English moisture word in the name",
        "manufacturer storefront (packet grade moderate; German-language, prices in CHF - possibly the Swiss storefront): 'Intensive Feuchtigkeitspflege mit Algenextrakten'; 'perfekt für alle Haartypen geeignet – egal ob normales, trockenes, feines, fettiges oder dünnes Haar'; 'Sanfte Reinigung von Haaren und Kopfhaut, ohne zu strapazieren'; peptide/Hemisqualan/goji/malve/monoi claims",
        "retailers (low): 'sanfte, feuchtigkeitsspendende Reinigung', 'für alle Haartypen', 'sulfatfrei'",
        "pack_back (moderate): not transcribed",
    ],
    focusPrimary=focus("general", "moderate", "moisture", "not_applicable",
        "Moisture is the name claim, but the formula has no cationic and only a trace humectant.",
        "Claim direction: moisture (name, high). Formula verdict nonspecific (PEG-18 refatter@5, oat peptide@8, trace Glycerin@21, late alkane@19; no cationic, no silicone): not moisture_supported. F1: moisture language over a nonspecific formula stays general.",
        "General: moisture positioning over a nonspecific formula (F1).",
        ["7.2", "7.3", "F1"]),
    focusSecondary=sec([], "high", "none", "Empty default considered; no qualifying distinct route.", "Empty."),
    usageRole=usage("regular", "high", "none", "none", [], [], "Regular: no frequency wording, no reset or dandruff trigger."),
    scalpComfortTarget=comfort("not_targeted", "high", "none",
        "Not targeted: no E2 sensitive/dry-scalp unit ('ohne zu strapazieren' is protective). CSA would be met via MB only."),
    primaryTarget=tgt("ordinary", "moderate",
        "S-ORDINARY way 1. The all-hair-types list ('normales, trockenes, feines, fettiges oder dünnes Haar') is a suitability/hair-type listing, not an oily claim unit (E2 oily-hair note, P0). Confidence moderate: the manufacturer storefront may be the Swiss market page (E1 foreign-market) and the pack_back source is not transcribed."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> general (moderate): moisture name claim rejected by F1 (nonspecific formula).",
        "usageRole and scalpComfortTarget confirmed (high).",
        "Claim mapping (ID-3): 'Di- und Tri-Peptide aus Hafer' -> Avena Sativa (Oat) Peptide@8; Goji -> Lycium Barbarum@10; Malve -> Malva Sylvestris@11; Monoi -> Gardenia Taitensis@9; 'Hemisqualan' -> no exact INCI (C13-15 Alkane@19 is the hydrocarbon emollient present); a late emollient that cannot change any property -> note only.",
        "No formula property changed.",
    ],
    uncertainties=[
        "'fettiges ... Haar' inside an all-hair-types suitability sentence read as a hair-type listing, not an oily claim unit; alternative: oily claim -> S-OILY fails (cleansing low) -> S-FAIL, ordinary + review_specialist_gate_failed.",
        "Manufacturer page market (CHF) - graded as the packet states (moderate) for focus; immaterial since focus is general.",
        "identityConfidence moderate per packet.",
    ],
)

# ---------------------------------------------------------------- W107
PRODUCTS["W107"] = dict(
    brand="Sante",
    productName="SANTE Glossy Shine Shampoo Birke + 3-fach Protein Komplex",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Glossy Shine' - shine; '3-fach Protein Komplex'",
        "manufacturer_de (moderate): 'Pflegeformel für glanzloses Haar ... glättet die Oberflächenstruktur des Haares für mehr Glanz & Geschmeidigkeit'; 'Perfekte Lösung für glanzloses und stumpfes Haar'; 'Stärkt, pflegt und glättet die Haarstruktur'; 'Der 3-fach Protein Komplex stärkt, pflegt & schützt'; 'Die Verträglichkeit ist dermatologisch getestet' (protective)",
        "retailers (low): same claims",
        "no scalp claim unit; no frequency or reset wording",
    ],
    focusPrimary=focus("shine", "moderate", "repair", "candidate",
        "Strong ALS chassis and three hydrolyzed proteins lean repair; shine route is light.",
        "Claim direction: shine (name 'Glossy Shine', high; manufacturer 'glättet die Oberflächenstruktur ... mehr Glanz', moderate). Formula compatible: a light smoothing/film route - prominent guar@8 plus hydrolyzed protein film (@5, @7, @9) with acidic pH support (Citric Acid@10, F4 compatibility only). Decision: shine.",
        "Shine: dominant name claim with a plausible smoothing/film route (7.1, 7.2).",
        ["7.1", "7.2", "F4"],
        care=na_care("repair_supported")),
    focusSecondary=sec([], "moderate", ["repair"],
        "Empty default considered. 'Stärkt, pflegt und glättet' is attributed to the same 3-fach Protein Komplex that carries the shine/smoothing route; no ingredient left for an independent repair route (F3); no damage positioning.",
        "Empty: strengthening rides on the primary's protein route (F2, F3)."),
    usageRole=usage("regular", "high", "none", "none", [], [],
        "Regular: strong formula but no reset intent (U4) in any source; no frequency or dandruff trigger."),
    scalpComfortTarget=comfort("not_targeted", "high", "none", "Not targeted: no E2 scalp claim unit."),
    primaryTarget=tgt("ordinary", "high", "S-ORDINARY way 1; manufacturer source present."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> shine (moderate): name + manufacturer shine claims; formula compatible.",
        "careDirection: blind repair_supported recorded; final verdict not_applicable for shine.",
        "usageRole regular (low) -> regular (high): no reset intent despite strong cleansing.",
        "Claim mapping: 'Bio-Birkenblattextrakt' -> Betula Alba Leaf Extract@14; '3-fach Protein' -> corn@5, wheat@7, soy@9.",
        "No formula property changed.",
    ],
    uncertainties=[
        "Primary could be repair (three proteins, 'stärkt'); shine chosen because it is the name claim.",
        "weightPotential low with guar@8 + three proteins vs strong ALS reset; alternative moderate (neighbor, T4 fine flag).",
        "identityConfidence moderate per packet.",
    ],
)

# ---------------------------------------------------------------- W108
PRODUCTS["W108"] = dict(
    brand="ISANA",
    productName="ISANA MED Shampoo pH 5,5 hautneutral",
    counter=CF_STD,
    claimUnits=[
        "pack_front (high): 'ISANA MED · pH 5,5 HAUTNEUTRAL · SHAMPOO · 3% Urea · ohne Silikone · normales Haar · Klinisch getestet · dermatologisch bestätigt' - no scalp state",
        "manufacturer_de (Rossmann own brand, moderate): 'Das ISANA MED SHAMPOO ist eine Spezialentwicklung für sensible Kopfhaut' - qualifying E2 sensitive unit",
        "manufacturer_de (moderate): 'schützt Kopfhaut & Haar vor Austrocknung' (protective, not dry positioning); 'für jeden Tag' (U2 wording); 'Hautverträglichkeit dermatologisch bestätigt', 'pH-hautneutral' (protective)",
    ],
    focusPrimary=focus("scalp_active", "moderate", "general", "candidate",
        "Strong reinforced ether-sulfate chassis is a counter-signal for a sensitive-scalp role.",
        "Claim direction: sensitive scalp ('Spezialentwicklung für sensible Kopfhaut', moderate). Formula compatible: scalpComfortTarget targeted via prominent Urea@3 and Panthenol@8. No competing lengths claim. Decision: scalp_active.",
        "scalp_active: explicit sensitive-scalp positioning with targeted comfort (7.2).",
        ["7.2", "SC1"],
        care=na_care("nonspecific")),
    focusSecondary=sec([], "high", "none", "Empty default considered; no distinct lengths positioning.", "Empty."),
    usageRole=usage("regular", "high", "none", "none", [],
        ["explicit_frequent_non_strong: 'für jeden Tag' (moderate) fails because cleansingStrength is strong (U2)", "strong_plus_reset_intent: no reset intent"],
        "Regular: frequency wording cannot fire frequent on a strong formula; no reset intent; no dandruff claim.", ("9", "U1", "U2", "U4")),
    scalpComfortTarget=comfort("targeted", "moderate", "not_targeted",
        "Targeted: SC1 met ('für sensible Kopfhaut', manufacturer, moderate); CSA met by prominent E4 comfort/humectant routes Urea@3 and Panthenol@8. Counter-signal cleansingStrength strong does not veto (listed route present) and caps confidence at moderate (CSA)."),
    primaryTarget=tgt("sensitive", "moderate",
        "S-SENSITIVE: E2 sensitive unit (moderate); formula gate targeted + prominent comfort route Urea@3/Panthenol@8. cleansingStrength strong -> review_strong_cleansing_comfort_route. Confidence = min(positioning moderate, targeted moderate, cleansingStrength moderate)."),
    secondaryTarget=None,
    d1=NO_D1,
    manualFlags=["review_strong_cleansing_comfort_route (S-SENSITIVE with cleansingStrength strong)"],
    reconciliation=[
        "focusPrimary general (low) -> scalp_active (moderate).",
        "usageRole regular (low) -> regular (high): 'für jeden Tag' recorded as losing trigger (strong formula).",
        "scalpComfortTarget not_targeted (provisional) -> targeted (moderate): SC1 + CSA.",
        "No formula property changed.",
    ],
    uncertainties=[
        "cleansingStrength strong (moderate confidence, neighbor moderate) - reinforcing ether sulfates all after three buffers; intensity regular either way, so no I3 effect.",
        "'schützt Kopfhaut & Haar vor Austrocknung' read as protective wording (E2a), not a dry-scalp claim; alternative: dry claim -> S-DRY would pass (Urea@3) as secondary.",
    ],
)

# ---------------------------------------------------------------- W109
PRODUCTS["W109"] = dict(
    brand="Herbal Essences",
    productName="Herbal Essences Tiefenreinigung & Glanz Shampoo Limettenduft",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Tiefenreinigung & Glanz' - D1 stem 'tiefenrein' and a shine word",
        "retailers (low): 'Tiefenreinigendes Shampoo'; 'reinigt das Haar gründlich und entfernt Ablagerungen'; 'Verleiht dem Haar Glanz'; 'KLÄREN & GLÄNZEN'",
        "no manufacturer or pack source in the packet; no occasional-use directions ('Großzügig auftragen, aufschäumen und danach ausspülen')",
    ],
    focusPrimary=focus("clarifying", "moderate", "shine", "candidate",
        "The name also carries 'Glanz'; shine is the competing job.",
        "Claim direction: deep cleansing (name 'Tiefenreinigung', high). F6 compatible: cleansingStrength strong, conditioningLevel low, weightPotential low. Route: unbuffered SLES chassis (C1 strong). Decision: clarifying.",
        "Clarifying: explicit deep-cleansing name with a compatible strong, light formula (7.2, F6).",
        ["7.2", "F6", "CL-SRC"],
        care=na_care("not_applicable")),
    focusSecondary=sec([], "moderate", ["shine"],
        "Empty default considered. 'Glanz' is distinct name positioning, but the only possible shine route is the acid (Citric Acid@7, Sodium Citrate@9), which cannot create a secondary shine (F4); no smoothing/film ingredient exists.",
        "Empty: no independent shine route (F4).", ("8", "F3", "F4")),
    usageRole=usage("occasional_reset", "high", "none", "explicit_deep_cleansing",
        ["product name (high): 'Tiefenreinigung' -> D1 true"],
        ["strong_plus_reset_intent (alternating): fires via D1 term in the name (U4) but loses to occasional_reset (U1)"],
        "occasional_reset: D1 true from the product name (U1 precedence).", ("9", "U1", "U4", "D1")),
    scalpComfortTarget=comfort("not_targeted", "high", "none", "Not targeted: no scalp claim unit; CSA not met."),
    primaryTarget=tgt("ordinary", "moderate", "S-ORDINARY way 1; packet holds retailer copy only (plus the name) -> moderate (13.8)."),
    secondaryTarget=None,
    d1={"value": True, "confidence": "high", "rationale": "D1 true: product name contains 'Tiefenreinigung' (stem tiefenrein; name graded high). No daily-use directions."},
    reconciliation=[
        "focusPrimary general (low) -> clarifying (moderate): D1 name + F6-compatible formula.",
        "usageRole regular (low) -> occasional_reset (high): D1 true.",
        "explicitResetPositioning true; D2 met -> deepCleanserListing flagged, deepCleanserRecord needs_record.",
        "No formula property changed (cleansing strong from C1, not from the claim).",
    ],
    uncertainties=[
        "cleansingStrength strong at moderate confidence (betaine just after an early Parfum); neighbor moderate would make D2 fail and I1 regular - recorded via confidences, no I3 flag because current clarifying already differs from the normal bucket's expected regular.",
        "Primary clarifying vs shine (both name words); alternative shine.",
    ],
)

# ---------------------------------------------------------------- W110
PRODUCTS["W110"] = dict(
    brand="ISANA",
    productName="ISANA Shampoo & Spülung 2in1 Volumen (Malve & Acai)",
    counter=CF_STD,
    claimUnits=[
        "name (high): '2in1 Volumen' - volume (2-in-1 never raises conditioning, C7)",
        "manufacturer_de (Rossmann own brand, moderate): 'Mit seiner speziellen Formel verleiht es auch kraftlosem und feinem Haar Volumen'; 'Soft-Care-Komplex und Weizenprotein'; 'kraftloses & feines Haar'; 'dermatologisch bestätigt und pH-hautneutral' (protective)",
    ],
    focusPrimary=focus("volume", "moderate", "general", "candidate",
        "2-in-1 conditioning claim; guar + refatters give moderate conditioning.",
        "Claim direction: volume (name + manufacturer). Formula compatible: weightPotential low, no silicone, light guar/protein routes. Decision: volume.",
        "Volume: dominant name claim with a compatible light formula (7.2, C7).",
        ["7.2", "C7", "T2"],
        care=na_care("moisture_supported")),
    focusSecondary=sec([], "high", "none", "Empty default considered; 2-in-1 care is a conditioning restatement, not a focus (Section 8 item 3).", "Empty."),
    usageRole=usage("regular", "high", "none", "none", [], [], "Regular: no trigger."),
    scalpComfortTarget=comfort("not_targeted", "high", "none", "Not targeted: no scalp claim unit."),
    primaryTarget=tgt("ordinary", "high", "S-ORDINARY way 1; manufacturer source present."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> volume (moderate).",
        "usageRole/scalpComfortTarget confirmed (high).",
        "Claim mapping: Weizenprotein -> Hydrolyzed Wheat Protein@7; Malve -> Malva Sylvestris@5; Acai -> Euterpe Oleracea@6.",
        "No formula property changed (C7: 2-in-1 claim does not raise conditioning).",
    ],
    uncertainties=["weightPotential low vs moderate (prominent guar + protein); neighbor moderate -> T4 fine flag."],
)

# ---------------------------------------------------------------- W111
PRODUCTS["W111"] = dict(
    brand="Schwarzkopf GLISS",
    productName="Schwarzkopf GLISS Sealing Miracle Versiegelndes Shampoo",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Sealing Miracle Versiegelndes Shampoo' - sealing/split-end care",
        "pack_back (moderate): 'Wirkt wie ein Reißverschluss für das Haar • Schützt das Haar • Für splissgeschädigtes Haar'; directions 'Regelmäßig anwenden' (not U2)",
        "manufacturer_de (moderate): 'Für geschädigtes und splissanfälliges Haar'; 'Bis zu 94 % weniger Spliss*'; 'Reinigt, ohne das Haar zu beschweren'; 'Für alle Haartypen'",
    ],
    focusPrimary=focus("general", "moderate", "repair", "not_applicable",
        "Clear damage/split-end positioning that the formula does not support.",
        "Claim direction: repair (pack back + manufacturer, moderate; name). Formula verdict nonspecific: a single protein token (Pea Peptide@5), one guar@6, weak refatters, non-material late lipid - no coherent repair cluster (one protein token is not enough). F1: repair needs repair_supported or dual_supported. Decision: general.",
        "General: repair positioning over a nonspecific formula (F1).",
        ["7.2", "7.3", "F1"]),
    focusSecondary=sec([], "high", "none", "Empty default considered.", "Empty."),
    usageRole=usage("regular", "high", "none", "none", [], [], "Regular: 'Regelmäßig anwenden' is not U2 frequency wording."),
    scalpComfortTarget=comfort("not_targeted", "high", "none", "Not targeted: no scalp claim unit."),
    primaryTarget=tgt("ordinary", "high", "S-ORDINARY way 1; manufacturer and pack sources present."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> general (moderate): repair claim rejected by F1.",
        "usageRole/scalpComfortTarget confirmed (high).",
        "'Zip & Seal-Technologie' names no INCI; no conflict.",
        "No formula property changed.",
    ],
    uncertainties=[
        "Repair verdict: pea peptide + prominent guar + refatters could be argued repair_supported; alternative focus repair (moderate).",
        "weightPotential low vs moderate (prominent guar@6); neighbor moderate -> T4 fine flag.",
    ],
)

# ---------------------------------------------------------------- W112
PRODUCTS["W112"] = dict(
    brand="OGX",
    productName="OGX Biotin & Collagen Shampoo (retailers: Thick & Full Biotin & Collagen Shampoo)",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Biotin & Collagen' - ingredient names, no focus word",
        "retailers dm/Rossmann/Müller (low): volume and fullness for fine/thin hair ('bis zu 72 Stunden lang mehr Volumen', 'fülliger, dicker'); 'Mit Vitamin B Biotin, Collagen und Weizenprotein'; 'für die tägliche Haarwäsche' (Müller); 'LipiPro Shield'",
        "manufacturer_us (manufacturer_foreign, low): '72+ hours of volume & body'; 'Hair type: Fine'",
        "no German manufacturer or pack source",
    ],
    focusPrimary=focus("general", "moderate", "volume", "not_applicable",
        "Volume is the consistent (low-graded) positioning.",
        "Claim direction: volume, all graded low (retailers, foreign manufacturer page). A low claim may be a candidate only when the formula independently supports that focus; the formula (amodimethicone + cationic starch, weightPotential moderate with neighbor high) gives no independent volume support. Biotin is never a focus route (F5). Decision: general.",
        "General: only low-graded positioning without independent formula support (CL-SRC).",
        ["7.2", "CL-SRC", "F5"]),
    focusSecondary=sec([], "high", "none", "Empty default considered.", "Empty."),
    usageRole=usage("regular", "high", "none", "none", [], ["explicit_frequent_non_strong: 'tägliche Haarwäsche' is retailer-low only"], "Regular: frequency wording only in low-graded copy."),
    scalpComfortTarget=comfort("not_targeted", "high", "none", "Not targeted: no scalp claim unit."),
    primaryTarget=tgt("ordinary", "moderate", "S-ORDINARY way 1; the packet holds retailer copy and a foreign manufacturer page only (no DE manufacturer or pack source) -> moderate."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> general (moderate).",
        "usageRole/scalpComfortTarget confirmed (high).",
        "Claim conflict (ID-3): retailers claim 'Weizenprotein'/'hydrolysiertes Weizenprotein'; the frozen INCI has no Hydrolyzed Wheat Protein (only Hydrolyzed Collagen@7). A hydrolyzed protein would add a light, low-persistence film and could not move weightPotential (already moderate) or any gate -> non-material note. 'Kollagen' -> Hydrolyzed Collagen@7; 'Biotin' -> Biotin@6.",
        "No formula property changed.",
    ],
    uncertainties=[
        "Weizenprotein claim missing from the INCI: possible older formula in retailer copy; treated non-material.",
        "weightPotential moderate vs high (amodimethicone + cationic starch under a weak reset); neighbor high -> T4 fine and normal flags.",
        "conditioningLevel moderate vs high (C2 lacks only a pearlizing/fatty route).",
    ],
)

# ---------------------------------------------------------------- W113
PRODUCTS["W113"] = dict(
    brand="OGX",
    productName="OGX Strength & Length + Keratin Oil Shampoo",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Strength & Length + Keratin Oil' - no E2 or focus lexicon word beyond ingredient names",
        "retailers (low): 'Anti-Haarbruch Shampoo für strapaziertes Haar'; 'verhindert nachweislich Haarbruch und reduziert Spliss um bis zu 80%'; 'Enthält Arganöl'; 'Erhöht Elastizität'",
        "no manufacturer or pack source",
    ],
    focusPrimary=focus("repair", "moderate", "general", "candidate",
        "Positioning is retailer-only (low), which caps focus confidence at moderate; heavy, rich formula.",
        "Claim direction: repair (retailer, low). Formula verdict repair_supported (Hydrolyzed Keratin@6, Argan Oil@7, Amodimethicone@10, guar@11, Hydrogenated Castor Oil@12) independently supports repair, so the low claim may act as candidate (CL-SRC), confidence capped moderate. Decision: repair.",
        "Repair: repair_supported formula with low-graded damage positioning (F1, CL-SRC cap).",
        ["7.2", "7.3", "F1", "CL-SRC"]),
    focusSecondary=sec([], "high", "none", "Empty default considered; 'Glanz' is an outcome of the same deposition route (F2).", "Empty."),
    usageRole=usage("regular", "high", "none", "none", [], [], "Regular: no trigger."),
    scalpComfortTarget=comfort("not_targeted", "high", "none", "Not targeted: no scalp claim unit."),
    primaryTarget=tgt("ordinary", "moderate", "S-ORDINARY way 1; retailer copy only -> moderate."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> repair (moderate): repair_supported verdict + low-graded claim (CL-SRC).",
        "usageRole/scalpComfortTarget confirmed (high).",
        "Claim mapping: Arganöl -> Argania Spinosa Kernel Oil@7; Keratin -> Hydrolyzed Keratin@6.",
        "No formula property changed.",
    ],
    uncertainties=[
        "weightPotential high (W-RICH + limited reset) vs moderate; T1 then makes fine not_suited. Alternative moderate would make fine acceptable.",
        "conditioningLevel high via W-RICH although C2 lacks a humectant route; alternative moderate.",
        "identityConfidence moderate per packet.",
    ],
)

# ---------------------------------------------------------------- W114
PRODUCTS["W114"] = dict(
    brand="Sebamed",
    productName="Sebamed Anti Schuppen Plus (Anti-Schuppen Shampoo PLUS)",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Anti Schuppen Plus' - E2 dandruff unit",
        "manufacturer_de (moderate): 'Nach 4 Wochen bis zu 95% weniger Schuppen, für fettendes Haar' - dandruff unit containing oily wording (E2 'fettendes Haar')",
        "manufacturer_de (moderate): 'speziell zur nachhaltigen Bekämpfung von Schuppen bei schnell fettendem Haar und Juckreiz entwickelt' - dandruff unit with oily and itch wording (absorbed for projection, E2a)",
        "manufacturer_de (moderate): 'reinigt die Kopfhaut schonend' (protective); 'Haartyp: schuppiges Haar, fettiges Haar, fettendes Haar' (listing attribute)",
        "manufacturer directions (moderate): 'Täglich oder 2-3x pro Woche anwenden' (U2 wording)",
        "retailer dm (low): 'Anti-Schuppen Shampoo für schnell fettendes Haar'; 'Für die tägliche Anwendung geeignet'",
    ],
    focusPrimary=focus("scalp_active", "high", "none", "candidate",
        "Oily-scalp wording is also present (would be clarifying, F6), but it sits inside the dandruff units.",
        "Claim direction: anti-dandruff (name, high; manufacturer, moderate). Formula compatible: recognized active Piroctone Olamine@7. Route: Piroctone Olamine@7. Decision: scalp_active.",
        "scalp_active: problem-led anti-dandruff product with a recognized active (7.2).",
        ["7.2", "11"],
        care=na_care("not_applicable")),
    focusSecondary=sec([], "moderate", ["clarifying"],
        "Empty default considered. Oily wording occurs only inside dandruff claim units (absorbed, E2a), so there is no distinct clarifying positioning; strong-cleansing alone is not a route (it is moderate here anyway).",
        "Empty: no distinct secondary positioning (Section 8)."),
    usageRole=usage("treatment", "high", "none", "recognized_active_problem_led",
        ["dandruffSupport supported (Piroctone Olamine@7)", "name 'Anti Schuppen Plus' (high) and manufacturer dandruff units (moderate)"],
        ["explicit_frequent_non_strong: 'Täglich oder 2-3x pro Woche anwenden' (manufacturer, moderate) with cleansing moderate - fires but loses to treatment (U1)"],
        "Treatment: recognized active plus a qualifying dandruff claim (U3), precedence over frequent (U1).", ("9", "U1", "U2", "U3")),
    scalpComfortTarget=comfort("not_targeted", "high", "none",
        "Not targeted: 'Juckreiz' occurs only inside a dandruff unit (dandruff symptom, SC1/E2a); no separate sensitive/dry unit. CSA also not met (no prominent E4 route, no MB; Menthol@8 counter-signal)."),
    primaryTarget=tgt("dandruff", "high",
        "S-DANDRUFF: E2 dandruff claim (name, high) + dandruffSupport supported (high) -> dandruff primary, no secondary target (R17.1, R17.2). Confidence = min(positioning high, dandruffSupport high)."),
    secondaryTarget=None,
    rct=["oily"],
    d1=NO_D1,
    manualNotes=[
        "suits_dandruff_with_oily_scalp: oily-scalp wording 'für fettendes Haar' / 'bei schnell fettendem Haar' (manufacturer, moderate) + S-OILY formula clause passed (cleansingStrength moderate, weightPotential low, conditioningLevel low); research-only (E2b layer 2, R17.2); confidence moderate",
        "dandruff_bundled_comfort_wording: 'Bekämpfung von Schuppen bei schnell fettendem Haar und Juckreiz' (manufacturer, moderate) - S-SENSITIVE formula gate failed: CSA not met (no prominent E4 comfort or humectant route, no MB: Sodium Laureth Sulfate@2 prominent); no unlisted_route_candidate",
    ],
    reconciliation=[
        "focusPrimary general (low) -> scalp_active (high).",
        "usageRole regular (low) -> treatment (high); frequent recorded as losing trigger.",
        "scalpComfortTarget not_targeted (moderate) -> not_targeted (high).",
        "researchCombinationTargets: ['oily'] (E2b layer 2); sensitive not recorded (gate failed).",
        "No formula property changed.",
    ],
    uncertainties=[
        "Oily wording counted for the research combination from units inside the dandruff claim (R17.2 explicitly allows); alternative: none.",
        "conditioningLevel low vs moderate (single prominent cationic starch).",
    ],
)

# ---------------------------------------------------------------- W115
PRODUCTS["W115"] = dict(
    brand="Balea",
    productName="Balea (med) 2 in 1 Urea 5% Duschgel & Shampoo",
    counter=dict(CF_STD, dandruffSupport="Active present without any dandruff claim (R17.3)."),
    claimUnits=[
        "name (high): '2 in 1 Urea 5%' - no scalp word",
        "manufacturer_de (dm own brand, moderate): 'Duschgel & Shampoo für empfindliche Haut' - skin, does not name the scalp",
        "manufacturer_de (moderate): 'Seine seifenfreie Rezeptur ist speziell für trockene sowie empfindliche Haut und Kopfhaut entwickelt worden' - one unit naming dry and sensitive scalp (E2 dry + sensitive)",
        "manufacturer_de (moderate): 'Das Duschgel & Shampoo schützt zudem vor Juckreiz, der durch Trockenheit entstehen kann' - itch wording (Haut und Kopfhaut context)",
        "manufacturer_de (moderate): 'Schützt vor dem Austrocknen', 'kann dem Austrocknen von Haut und Haar entgegenwirken', 'ph-hautneutral' (protective)",
        "no dandruff claim; no frequency wording",
    ],
    focusPrimary=focus("scalp_active", "moderate", "general", "candidate",
        "Positioning is primarily a body-wash/skin product; the scalp unit is shared with skin.",
        "Claim direction: dry and sensitive scalp (manufacturer, moderate). Formula compatible: scalpComfortTarget targeted (Urea@3, Panthenol@8, Allantoin@9; Glycerin@5). No lengths-care claim beyond protective wording. Decision: scalp_active.",
        "scalp_active: explicit dry/sensitive-scalp positioning with targeted comfort (7.2).",
        ["7.2", "SC1"],
        care=na_care("moisture_supported")),
    focusSecondary=sec([], "moderate", ["moisture"],
        "Empty default considered. 'kann dem Austrocknen von Haut und Haar entgegenwirken' is protective wording, not distinct lengths-moisture positioning.",
        "Empty."),
    usageRole=usage("regular", "high", "none", "none", [], [], "Regular: no frequency wording; piroctone without a dandruff claim cannot fire treatment (U3)."),
    scalpComfortTarget=comfort("targeted", "moderate", "not_targeted",
        "Targeted: SC1 met ('speziell für trockene sowie empfindliche Haut und Kopfhaut', manufacturer, moderate); CSA met by prominent E4 comfort routes Urea@3, Panthenol@8, Allantoin@9 and humectant routes Urea@3, Glycerin@5, Sodium Lactate@7, Panthenol@8. No cooling agent; cleansing moderate."),
    primaryTarget=tgt("sensitive", "moderate",
        "S-SENSITIVE: E2 sensitive scalp in the manufacturer unit (moderate); formula gate targeted + prominent comfort route (Urea@3, Panthenol@8, Allantoin@9). S-PRIMARY: no target in the product name -> order sensitive, dry -> sensitive primary. Confidence moderate."),
    secondaryTarget=tgt("dry", "moderate",
        "S-DRY: E2 dry scalp ('trockene ... Kopfhaut') in the same manufacturer unit (a unit naming two non-dandruff states counts for both, E2a); formula gate targeted + prominent humectant route Urea@3/Glycerin@5. Not dandruff-primary, not oily+dry. Confidence moderate."),
    d1=NO_D1,
    manualNotes=["active_without_dandruff_positioning (Piroctone Olamine@22; R17.3)"],
    reconciliation=[
        "focusPrimary general (low) -> scalp_active (moderate).",
        "usageRole regular (low) -> regular (high).",
        "scalpComfortTarget not_targeted (provisional) -> targeted (moderate): SC1 + CSA.",
        "Projection: sensitive primary + dry secondary (both pass; S-PRIMARY order).",
        "No formula property changed.",
    ],
    uncertainties=[
        "Product is a 2-in-1 body wash and shampoo; identity accepted as given in the packet (identityConfidence moderate).",
        "'für trockene sowie empfindliche Haut und Kopfhaut' read as naming dry and sensitive scalp; alternative: adjectives modify only 'Haut' -> no qualifying unit -> ordinary.",
        "Secondary dry vs none; both gates pass on the same unit.",
    ],
)

# ---------------------------------------------------------------- W116
PRODUCTS["W116"] = dict(
    brand="Herbal Essences (Procter & Gamble)",
    productName="Herbal Essences Shampoo Fiji (Rossmann: Fiji Schwerelose Feuchtigkeit)",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Fiji' - no focus word (the 'Schwerelose Feuchtigkeit' name variant is retailer-only)",
        "manufacturer_de brand portal (moderate): 'Shampoo für schwerelose Feuchtigkeit. Shampoo frei von sulfatierenden Tensiden. Vegan.'",
        "retailers (low): 'Feuchtigkeitsshampoo', 'reinigt das Haar sanft und spendet Feuchtigkeit', 'ohne es zu beschweren'",
    ],
    focusPrimary=focus("general", "moderate", "moisture", "not_applicable",
        "Moisture is the consistent positioning.",
        "Claim direction: moisture (manufacturer, moderate). Formula verdict nonspecific: PQ-10@11 post-E3 and trace Glycerin@24 only - no humectant cluster. F1: moisture language over a nonspecific formula stays general.",
        "General: moisture positioning over a nonspecific formula (F1).",
        ["7.2", "7.3", "F1"]),
    focusSecondary=sec([], "high", "none", "Empty default considered.", "Empty."),
    usageRole=usage("regular", "high", "none", "none", [], [], "Regular: no trigger."),
    scalpComfortTarget=comfort("not_targeted", "high", "none", "Not targeted: no scalp claim unit (CSA would be met via MB only)."),
    primaryTarget=tgt("ordinary", "high", "S-ORDINARY way 1; manufacturer source present."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> general (moderate): moisture claim rejected by F1.",
        "usageRole/scalpComfortTarget confirmed (high).",
        "'Kokosnussextrakt' -> Cocos Nucifera Fruit Juice@25 (no conflict).",
        "No formula property changed.",
    ],
    uncertainties=["weightPotential low with PQ-10 under a weak reset; alternative moderate (neighbor -> T4 fine flag)."],
)

# ---------------------------------------------------------------- W117
PRODUCTS["W117"] = dict(
    brand="Pantene Pro-V (Procter & Gamble)",
    productName="PANTENE PRO-V Shampoo miracles Hydra Glow",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Hydra Glow' - hydration (moisture) and glow (shine) words",
        "retailers dm/Müller (low): 'Intensive Feuchtigkeit'; 'bringt selbst trockenstes Haar zum Glänzen'; 'Biotin, Pro-Vitamin B5 und Baobab-Essenz'; 'Für die tägliche Haarwäsche geeignet'; 'ohne zu beschweren'",
        "no manufacturer or pack source",
    ],
    focusPrimary=focus("moisture", "moderate", "general", "candidate",
        "Humectants are all post-E3; conditioning base is generic fatty alcohol + cationics.",
        "Claim direction: moisture (name word 'Hydra', high; retailer, low). Formula verdict moisture_supported (Glycerin@12, Panthenol@20, Panthenyl Ethyl Ether@21, Sodium Hyaluronate@23 with fatty alcohols and PQ-6/guar). Decision: moisture.",
        "Moisture: name claim with a moisture_supported formula (F1).",
        ["7.2", "7.3", "F1", "CL-SRC"]),
    focusSecondary=sec([], "moderate", ["shine"],
        "Empty default considered. 'Glow' (name) is distinct shine wording, but its only route would be the same fatty-alcohol/cationic smoothing deposit the moisture focus cites (F2, F3).",
        "Empty: shine is an outcome of the primary route (F2)."),
    usageRole=usage("regular", "high", "none", "none", [], ["explicit_frequent_non_strong: 'tägliche Haarwäsche' retailer-low only"], "Regular: frequency wording only in low copy."),
    scalpComfortTarget=comfort("not_targeted", "high", "none", "Not targeted: no scalp claim unit; CSA not met."),
    primaryTarget=tgt("ordinary", "moderate", "S-ORDINARY way 1; retailer copy only (plus the name) -> moderate."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> moisture (moderate).",
        "usageRole/scalpComfortTarget confirmed (high).",
        "Claim mapping: Biotin@25, Pro-Vitamin B5 -> Panthenol@20, Hyaluronsäure -> Sodium Hyaluronate@23; 'Baobab-Essenz' has no INCI match (Adansonia) - botanical with no property or gate role -> note only (ID-3).",
        "No formula property changed.",
    ],
    uncertainties=[
        "Moisture verdict relies on post-E3 humectants; alternative nonspecific -> general.",
        "weightPotential moderate vs high (W-RICH met, reset not limited); neighbor high -> T4 flags on all three thicknesses.",
    ],
)

# ---------------------------------------------------------------- W118
PRODUCTS["W118"] = dict(
    brand="Sebamed",
    productName="Sebamed Every-Day Shampoo",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Every-Day' - U2 frequency wording",
        "manufacturer_de (moderate): 'Schonende, seifenfreie Reinigung für empfindliche Kopfhaut' - qualifying E2 sensitive unit ('für empfindliche Kopfhaut')",
        "manufacturer_de (moderate): 'seifenfreies Shampoo für die tägliche Haarwäsche'; directions 'Für die tägliche Anwendung geeignet'",
        "manufacturer_de (moderate): 'schützt Kopfhaut und Haar vor dem Austrocknen' (protective); 'stärken die Barrierefunktion der empfindlichen Haut' (skin, brand-level)",
        "retailer (low): 'schonend zur Kopfhaut' (sparing wording, E2a)",
    ],
    focusPrimary=focus("scalp_active", "moderate", "general", "candidate",
        "Mildness/everyday positioning dominates the copy; the sensitive-scalp unit shares the heading with gentle cleansing.",
        "Claim direction: sensitive scalp (manufacturer, moderate). Formula compatible: scalpComfortTarget targeted via MB (mild_base: Decyl Glucoside@2, Disodium Laureth Sulfosuccinate@3, Sodium Lauryl Sulfoacetate@4). Decision: scalp_active.",
        "scalp_active: explicit sensitive-scalp positioning with targeted support (7.2).",
        ["7.2", "SC1", "MB"],
        care=na_care("not_applicable")),
    focusSecondary=sec([], "high", "none", "Empty default considered.", "Empty."),
    usageRole=usage("frequent", "high", "none", "explicit_frequent_non_strong",
        ["name 'Every-Day' (high)", "manufacturer: 'für die tägliche Haarwäsche' and directions 'Für die tägliche Anwendung geeignet' (moderate)", "cleansingStrength low"], [],
        "Frequent: explicit frequency wording, non-strong formula.", ("9", "U1", "U2")),
    scalpComfortTarget=comfort("targeted", "moderate", "not_targeted",
        "Targeted: SC1 met ('für empfindliche Kopfhaut', manufacturer, moderate); CSA met via MB only (no prominent E4 comfort or humectant route; mild_base:Decyl Glucoside@2, Disodium Laureth Sulfosuccinate@3, Sodium Lauryl Sulfoacetate@4). Fragrance present (Parfum@7) as a counter-signal of limited weight.",
        ("10", "CSA", "MB", "SC1", "E2a")),
    primaryTarget=tgt("sensitive", "moderate",
        "S-SENSITIVE: E2 sensitive unit (moderate); formula gate targeted + MB (v1.6.2; no prominent E4 comfort route). cleansingStrength low -> no flag. Confidence moderate."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> scalp_active (moderate).",
        "usageRole regular (low) -> frequent (high).",
        "scalpComfortTarget not_targeted (provisional) -> targeted (moderate): SC1 + MB.",
        "No formula property changed.",
    ],
    uncertainties=[
        "'Schonende, seifenfreie Reinigung für empfindliche Kopfhaut' read as for-the-state positioning (E2a 'für ...'), not sparing wording; alternative: protective -> not_targeted, ordinary.",
    ],
)

# ---------------------------------------------------------------- W119
PRODUCTS["W119"] = dict(
    brand="L'Oréal Paris Elvital",
    productName="L'Oréal Paris Elvital Hydra Hyaluronic 72H Feuchtigkeit-Auffüllendes Shampoo",
    counter=CF_STD,
    claimUnits=[
        "name (high): 'Hydra Hyaluronic 72H Feuchtigkeit-Auffüllendes Shampoo' - moisture",
        "manufacturer_de (moderate): 'für feuchtigkeitsbedürftiges Haar'; 'versorgt sowohl die Kopfhaut, als auch die Längen für 72 Stunden mit der nötigen Feuchtigkeit' (names the scalp but no E2 dry-scalp state - not a qualifying dry unit); 'ganz ohne zu Beschweren'; 'Haartyp: Bedürftiges & Trockenes Haar'",
        "retailer dm (low): 'Für trockenes und strapaziertes Haar geeignet'",
    ],
    focusPrimary=focus("general", "moderate", "moisture", "not_applicable",
        "Strong moisture positioning (name + manufacturer) that the formula does not separately support.",
        "Claim direction: moisture (name, high). Formula verdict nonspecific: one trace humectant (Sodium Hyaluronate@13) with generic silicone/guar conditioning - no coherent humectant cluster. F1: moisture language over a nonspecific formula stays general.",
        "General: moisture positioning over a nonspecific formula (F1).",
        ["7.2", "7.3", "F1"]),
    focusSecondary=sec([], "high", "none", "Empty default considered; 'glänzendes ... Haar' is an outcome of the silicone route (F2, holdout-v3 precedent).", "Empty."),
    usageRole=usage("regular", "high", "none", "none", [], [], "Regular: no frequency wording ('täglich strapaziert' describes the hair, not use)."),
    scalpComfortTarget=comfort("not_targeted", "high", "none", "Not targeted: no E2 sensitive or dry-scalp state is named ('versorgt ... die Kopfhaut mit Feuchtigkeit' names no condition)."),
    primaryTarget=tgt("ordinary", "high", "S-ORDINARY way 1; manufacturer source present."),
    secondaryTarget=None,
    d1=NO_D1,
    reconciliation=[
        "focusPrimary general (low) -> general (moderate): moisture name claim rejected by F1 (nonspecific formula).",
        "usageRole/scalpComfortTarget confirmed (high).",
        "Claim mapping: Hyaluronsäure -> Sodium Hyaluronate@13.",
        "No formula property changed; weightPotential moderate follows W1 (the holdout-v3 precedent formula type).",
    ],
    uncertainties=[
        "Moisture verdict: a single hyaluronate is not a humectant cluster; alternative moisture_supported -> focus moisture.",
        "'versorgt ... die Kopfhaut mit Feuchtigkeit' read as not naming a dry-scalp state; alternative dry claim -> S-DRY would pass (SH@13 prominent) only with targeted, which needs CSA (met) and SC1.",
    ],
)
