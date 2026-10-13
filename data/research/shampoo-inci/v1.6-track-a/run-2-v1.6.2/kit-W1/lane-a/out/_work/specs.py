"""Lane-a phase-2 reconciliation specs (one entry per blind id). Data only."""

NOD1 = {"value": False, "confidence": "high", "evidence": "No D1 stem (tiefenrein, deep clean, clarifying shampoo, detox-reinigung) in the name, manufacturer/pack claims or directions; no occasional-use directions."}


def fp_(value, conf, nb, verdict, mroutes, rroutes, shared, limitation, role, counter, trace, rat, rules):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb,
            "careDirection": {"verdict": verdict, "moistureRoutes": mroutes, "repairRoutes": rroutes,
                              "sharedConditioningRoutes": shared, "limitation": limitation},
            "claimRole": role, "counterSignal": counter, "decisionTrace": trace, "rationale": rat, "ruleIds": rules}


def fs_(value, conf, nb, trace, rat, rules=None):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "decisionTrace": trace,
            "rationale": rat, "ruleIds": rules or ["8", "F2", "F3"]}


def ur_(value, conf, nb, code, ev, losing, rat, rules=None):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "triggerCode": code,
            "triggerEvidence": ev, "losingTriggers": losing, "rationale": rat, "ruleIds": rules or ["9", "U1", "U2", "CL-SRC"]}


def sc_(value, conf, nb, rat, rules=None):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "rationale": rat,
            "ruleIds": rules or ["10", "SC1", "CSA", "MB", "E2", "E2a", "E4"]}


def tgt(target, conf, rat):
    return {"target": target, "confidence": conf, "rationale": rat}


REG_DEFAULT = ur_("regular", "high", "none", "none", [], [],
                  "Regular: default; no moderate/high frequency wording (U2), reset intent (U4), D1 or dandruff claim (U3) in the revealed sources.")
NOT_T = lambda why: sc_("not_targeted", "high", "none", "Not targeted: " + why)

SPECS = {}

# ---------------- W101 Guhl Hyaluron+ ----------------
SPECS["W101"] = {
    "identity": {"brand": "Guhl", "productName": "Guhl Hyaluron+ Pflege Feuchtigkeits-Shampoo"},
    "counter": {
        "cleansingStrength": "Refatting (Glyceryl Oleate @8, Hydrogenated Vegetable Oil @6) and humectants argue milder; convention value unchanged.",
        "conditioningLevel": "C2 not met (no pearlizing/fatty route); lipid listed just after salt (small share likely).",
        "weightPotential": "W-RICH for weight present (material Hydrogenated Vegetable Oil @6 + guar @9) argues high; reset is moderate (not limited).",
        "dandruffSupport": "Active present without any dandruff positioning (R17.3)."},
    "claimEvidence": [
        "Product name 'Hyaluron+ Pflege Feuchtigkeits-Shampoo' (high): moisture direction.",
        "manufacturer_de (moderate): 'Für feuchtigkeitsbedürftiges Haar', 'versorgt dein trockenes Haar mit einem Feuchtigkeits-Boost', 'Mit natürlichem Hyaluron ohne Silikone', 'geschmeidig zu glänzen'.",
        "Retailer copy (low): 'Ohne zu beschweren' (never lowers weight, 6.5), 'sanft zur Kopfhaut' (protective, E2a), 'dermatologisch bestätigt'.",
        "No E2 scalp claim unit; no dandruff claim; no frequency or reset wording; directions ordinary.",
        "ID-3: 'Hyaluron' maps to Sodium Hyaluronate @18 / Hydrolyzed Hyaluronic Acid @17 - no conflict."],
    "focusPrimary": fp_("moisture", "moderate", "general", "moisture_supported",
                        ["Glycerin @12", "Panthenol @13", "Hydrolyzed Hyaluronic Acid @17", "Sodium Hyaluronate @18"], [],
                        ["Guar Hydroxypropyltrimonium Chloride @9", "Hydrogenated Vegetable Oil @6", "Glyceryl Oleate @8"],
                        "Humectants are mid/late; rinse-off context", "candidate",
                        "Humectant route sits after the guar/lipid; a recognized dandruff active (Piroctone Olamine @15) is present without positioning.",
                        "Primary: claim direction moisture (name 'Feuchtigkeits-Shampoo', high; manufacturer 'für feuchtigkeitsbedürftiges Haar', moderate); formula compatible (verdict moisture_supported, recorded blind); route Glycerin @12 + Panthenol @13 + Sodium Hyaluronate @18 with guar @9 / Hydrogenated Vegetable Oil @6 support; decision: one dominant compatible claim (7.2, F1).",
                        "Moisture: dominant exact-product claim with a moisture_supported formula (7.2, F1). Neighbor general because the humectant cluster is modest.",
                        ["7.2", "7.3", "F1", "CL-SRC"]),
    "focusSecondary": fs_([], "moderate", ["shine"],
                          "Empty default considered; 'glänzen' claim is an outcome of the same conditioning/humectant route (F2) and has no independent route (F3).",
                          "Empty: shine is not separately routed."),
    "usageRole": REG_DEFAULT,
    "scalpComfortTarget": NOT_T("no E2 sensitive or dry scalp claim unit (SC1); 'sanft zur Kopfhaut' is retailer-only protective wording. Formula half CSA would be met (Panthenol @13, Glycerin @12, Glyceryl Oleate @8, Hydrogenated Vegetable Oil @6)."),
    "primary": tgt("ordinary", "moderate", "S-ORDINARY ways 1 and 3: no qualifying E2 claim unit (manufacturer source present -> high) and a recognized dandruff active without a dandruff claim (-> moderate); lowest = moderate (13.8)."),
    "secondary": None,
    "D1": NOD1,
    "extraNotes": ["active_without_dandruff_positioning"],
    "reconciliation": [
        "focusPrimary general (provisional) -> moisture: revealed name/manufacturer moisture claim over the blind moisture_supported verdict (claimRole candidate).",
        "focusSecondary [] confirmed; confidence low -> moderate.",
        "usageRole regular confirmed; low -> high (no trigger in revealed sources).",
        "scalpComfortTarget not_targeted confirmed; low -> high (no SC1 unit).",
        "Formula properties unchanged (cleansing, conditioning, weight, dandruff)."],
}

# ---------------- W102 Syoss Intense Volume ----------------
SPECS["W102"] = {
    "identity": {"brand": "Syoss", "productName": "Syoss Intense Volume Shampoo (Intense Volume Leichtes Shampoo)"},
    "counter": {
        "cleansingStrength": "Coco-Glucoside @9 is post-fragrance (not a buffer); proteins/refatters argue milder; value fixed by C1.",
        "conditioningLevel": "Only slip agent (guar @19) is post-fragrance; low is the realistic neighbor.",
        "weightPotential": "Several light families (two prominent hydrolyzed proteins, trace guar, weak refatters, non-material HCO) interact (W2).",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "Product name 'Intense Volume' (high); manufacturer_de 'LEICHTES SHAMPOO INTENSE VOLUME', 'Bis zu 48 Stunden langanhaltendes Volumen', 'Mit 3% Kollagen-Lift-Komplex Reinigt feines, plattes Haar' (moderate).",
        "manufacturer_de 'Milde Formel für die tägliche Haarwäsche ohne zu beschweren' (moderate): U2 frequency wording.",
        "manufacturer_de 'Tiefenpflegende Formel ... stärkt das Haar von innen' (moderate): not D1 ('Tiefenpflege' is a care term, D1 Not-D1 list).",
        "'für feines, plattes Haar' is a thickness claim (T2, never changes fit); 'ohne zu beschweren' never lowers weight (6.5).",
        "ID-3: 'Kollagen' -> Hydrolyzed Collagen @6 present; no conflict. No scalp claim."],
    "focusPrimary": fp_("volume", "moderate", "repair", "not_applicable", [], ["Hydrolyzed Keratin @5", "Hydrolyzed Collagen @6"],
                        ["Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @19"],
                        "Volume is not a repair/moisture decision; blind verdict repair_supported kept as context", "candidate",
                        "Prominent hydrolyzed proteins (claimed 'Kollagen-Lift-Komplex', 'stärkt das Haar von innen') could be read as repair.",
                        "Primary: claim direction volume (name, high); formula compatible (weightPotential low, no silicone, no material lipid); route: light architecture plus the claimed collagen 'lift' complex (Hydrolyzed Collagen @6, Hydrolyzed Keratin @5); decision: dominant name claim with compatible formula (7.2).",
                        "Volume: name-level dominant claim on a light, silicone-free formula (7.1, 7.2).", ["7.1", "7.2", "CL-SRC"]),
    "focusSecondary": fs_([], "moderate", ["repair"],
                          "Empty default considered; repair wording ('stärkt das Haar von innen') rests on the same collagen/keratin complex already cited for the volume route (F3) - no independent route.",
                          "Empty: repair would reuse the primary's ingredients (F3)."),
    "usageRole": ur_("frequent", "moderate", "regular", "explicit_frequent_non_strong",
                     ["manufacturer_de (moderate): 'Milde Formel für die tägliche Haarwäsche'"], [],
                     "Frequent: explicit 'tägliche Haarwäsche' wording from a moderate source and cleansingStrength moderate (not strong) (U2). Retailer repeats are corroboration only."),
    "scalpComfortTarget": NOT_T("no E2 sensitive/dry scalp claim unit; CSA would also fail (no prominent listed route, MB excluded by SLES @2)."),
    "primary": tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present (13.8)."),
    "secondary": None, "D1": NOD1,
    "reconciliation": [
        "focusPrimary general (provisional) -> volume: name and manufacturer volume claims, formula compatible.",
        "usageRole regular (provisional) -> frequent: manufacturer 'tägliche Haarwäsche' (moderate), cleansing moderate.",
        "scalpComfortTarget not_targeted confirmed; low -> high.",
        "Formula properties unchanged."],
}

# ---------------- W103 hair biology Revitalize & Soothe ----------------
SPECS["W103"] = {
    "identity": {"brand": "Hair Biology (Procter & Gamble)", "productName": "hair biology Shampoo Revitalize & Soothe (Meno Balance)"},
    "counter": {
        "cleansingStrength": "Betaine buffer @6 and conditioning load argue milder; a reinforcing SLS makes C1 strong regardless.",
        "conditioningLevel": "Guar @15 post-fragrance; Panthenol @24 trace.",
        "weightPotential": "Two silicones + guar argue heavier; strong reinforced-sulfate reset argues lighter.",
        "dandruffSupport": "Active present without dandruff positioning (R17.3)."},
    "claimEvidence": [
        "All claims are retailer copy (dm.de, Austrian shop-apotheke) graded low; no manufacturer or pack source in the packet.",
        "Scalp units (low): 'Bei dünner werdendem, trockenem Haar & trockener Kopfhaut' (dry scalp + hair-thinning), 'Beruhigt die aus dem Gleichgewicht geratene Kopfhaut' (sensitive lexicon 'beruhigt die Kopfhaut').",
        "Hair-loss/density wording 'dünner werdendes Haar', 'für dichtes, volleres Haar' - out of scope (F5, S-HAIRLOSS).",
        "'für den täglichen Gebrauch geeignet' (low) - cannot fire a trigger; 'Spendet trockenem Haar Feuchtigkeit' (low).",
        "Product name words 'Revitalize & Soothe' do not name the scalp (F7 name words; English 'Soothe' is outside the closed E2 English list).",
        "ID-3: 'Pro-V' (Panthenol @24), 'Vitamin B3' (Niacinamide @30), 'weißer Tee' (Camellia Sinensis Leaf Extract @29) all present."],
    "focusPrimary": fp_("general", "moderate", "moisture", "nonspecific", ["Panthenol @24 (trace)"], [],
                        ["Dimethiconol @10", "Dimethicone @13", "Guar Hydroxypropyltrimonium Chloride @15", "Glycol Distearate @7"],
                        "Generic silicone/guar conditioning", "not_applicable",
                        "Retailer moisture and scalp-comfort wording exists but is graded low.",
                        "Primary: claim direction moisture/scalp comfort only from low-graded retailer copy; a low claim may act as candidate only when the formula verdict independently supports it (CL-SRC) - verdict nonspecific, and scalp_active needs a moderate/high SC1 unit; hair-thinning claims ignored (F5); decision general.",
                        "General: no in-scope claim of sufficient grade over a nonspecific formula (CL-SRC, F1, F5).", ["7.2", "F1", "F5", "CL-SRC"]),
    "focusSecondary": fs_([], "moderate", ["moisture"], "Empty default; no graded secondary positioning.", "Empty."),
    "usageRole": ur_("regular", "high", "none", "none", [],
                     ["frequent: only retailer 'täglichen Gebrauch' (low) and blocked by strong cleansing (U2)"],
                     "Regular: no moderate/high trigger; strong cleansing without reset intent (U4) stays regular."),
    "scalpComfortTarget": sc_("not_targeted", "moderate", "targeted",
                              "Not targeted: the sensitive/dry scalp units are retailer-only (low) and never trigger targeted (CL-SRC, SC1); formula half CSA also fails (no prominent listed E4 route - Panthenol @24, Niacinamide @30 post-fragrance; MB excluded by SLES/SLS). Moderate confidence because formula source tier 4 and identity moderate."),
    "primary": tgt("ordinary", "moderate", "S-ORDINARY ways 3 and 4: recognized active without a dandruff claim, and the claimed sensitive and dry targets failed (positioning gate: low-graded units only; formula gate would also fail) with nothing else passing -> moderate (13.8)."),
    "secondary": None, "D1": NOD1,
    "extraFlags": ["review_specialist_gate_failed: sensitive and dry - positioning gate failed (only retailer-graded units 'Beruhigt die aus dem Gleichgewicht geratene Kopfhaut', 'trockener Kopfhaut', E1 low); formula gate would also fail (CSA not met: no prominent E4 route, MB excluded; unlisted_route_candidate: none)"],
    "extraNotes": ["active_without_dandruff_positioning", "hair_loss_claim_not_evaluated"],
    "uncertainties": ["Only retailer sources (one Austrian); with a moderate-graded source the sensitive/dry targets would still fail the CSA formula gate."],
    "reconciliation": [
        "focusPrimary general confirmed; low -> moderate (claims low-graded, verdict nonspecific).",
        "usageRole regular confirmed; low -> high.",
        "scalpComfortTarget not_targeted confirmed; low -> moderate.",
        "Formula properties unchanged; source tier 4 noted, no ID-3 conflict."],
}

# ---------------- W104 Garnier Wahre Schätze Honig ----------------
SPECS["W104"] = {
    "identity": {"brand": "Garnier Wahre Schätze", "productName": "Garnier Wahre Schätze Reparierendes Shampoo Honig Schätze"},
    "counter": {
        "cleansingStrength": "Two of three buffers prominent only because fragrance is listed last; SLS harsher class.",
        "conditioningLevel": "Guar late; ID-3 conflict: claimed beeswax (Cera Alba) absent from INCI - if present and prominent it would add W-RICH (high).",
        "weightPotential": "ID-3 conflict: claimed beeswax (a waxy payload_lipid) absent; if present before the W-line it would converge with the guar and could reach moderate.",
        "dandruffSupport": "None."},
    "override": {
        "conditioningLevel": {"confidence": "low", "neighboringAlternative": "high",
                              "rationale": "Moderate (formula value unchanged): one late cationic guar @17 plus light routes; C2 not met. Confidence low after reconciliation: four retailer sources claim beeswax ('Bienenwachs'), which maps to Cera Alba and is absent from the frozen INCI (ID-3). A beeswax entry listed before the fragrance (which is last) would be a prominent payload lipid converging with the guar = W-RICH for conditioning (high). Material conflict -> low, needs_research."},
        "weightPotential": {"confidence": "low", "neighboringAlternative": "moderate",
                            "confidenceLimitingFactor": "ID-3 material conflict: claimed beeswax (Cera Alba, payload_lipid) not in the frozen INCI; a material beeswax entry would add a converging lipid family.",
                            "rationale": "Low (formula value unchanged): single late guar plus weak refatters against a buffered SLS reset (6.6, W2). Confidence low after reconciliation: retailer copy names beeswax, absent from the INCI (ID-3); if present before the W-line (Tocopherol @20) it would be a material payload_lipid converging with the guar (W-RICH, convergence) and could move the band to moderate. Returns needs_research (6.6 unknowns)."}},
    "claimEvidence": [
        "manufacturer_de (moderate): 'Speziell für die Bedürfnisse von strapaziertem und brüchigem Haar entwickelt, repariert und kräftigt ...', 'wirken Haarschäden wie Spliss, Haarbruch ... entgegen', 'leichter kämmbar' - repair direction.",
        "Product name 'Reparierendes Shampoo Honig Schätze' (high): repair direction.",
        "Retailer copy (low, four sources): 'Bienenwachs hat schützende Eigenschaften', 'Mit Akazienhonig und Bienenwachs'.",
        "ID-3: 'Akazien-/Manuka-/Lavendelhonig' -> Mel/Honey @5, Mel Extract @6 (no conflict). 'Bienenwachs' -> Cera Alba: NOT in the frozen INCI -> conflict; material because a waxy payload lipid could change conditioningLevel and weightPotential.",
        "No scalp claim; no frequency/reset wording."],
    "focusPrimary": fp_("general", "moderate", "repair", "moisture_supported",
                        ["Mel/Honey @5", "Mel Extract/Honey Extract @6", "Glycerin @8"], [],
                        ["Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @17", "Glyceryl Oleate @9", "Lecithin @12"],
                        "No protein, silicone or lipid damage-care cluster", "candidate",
                        "Honey/glycerin cluster supports moisture, but the product is positioned for repair, not moisture.",
                        "Primary: claim direction repair (name 'Reparierendes', manufacturer damage wording); formula verdict (recorded blind) moisture_supported, not repair_supported or dual_supported -> repair incompatible (F1); no moisture positioning to use the verdict; decision general.",
                        "General: repair claim over a moisture_supported (not repair) formula (F1, 3.2: claims may not override the formula).", ["7.2", "7.3", "F1", "3.2"]),
    "focusSecondary": fs_([], "moderate", ["moisture"], "Empty default; no distinct secondary positioning.", "Empty."),
    "usageRole": REG_DEFAULT,
    "scalpComfortTarget": NOT_T("no E2 scalp claim unit; CSA half would be met via Glycerin @8, Glyceryl Oleate @9 but positioning is absent."),
    "primary": tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present. (Projection blocked: needs_research from low-confidence conditioning/weight.)"),
    "secondary": None, "D1": NOD1,
    "uncertainties": ["ID-3 beeswax: retailer copy is graded low and may describe an older formula; treated as material per P0 because its presence could change conditioning (W-RICH) and weight. Values kept at the frozen-formula reading; projection shown for reference only (needs_research)."],
    "reconciliation": [
        "conditioningLevel moderate kept; confidence moderate -> low, neighbor low -> high (ID-3 beeswax conflict).",
        "weightPotential low kept; confidence moderate -> low (ID-3 beeswax conflict); neighbor moderate.",
        "focusPrimary general confirmed (repair claim incompatible with moisture_supported verdict); low -> moderate.",
        "usageRole regular confirmed; scalpComfortTarget not_targeted confirmed (low -> high).",
        "Projection status needs_research (low-confidence direct properties, 13.1/12)."],
}

# ---------------- W105 Balea Ultra Sensitive ----------------
SPECS["W105"] = {
    "identity": {"brand": "Balea (dm)", "productName": "Balea med Shampoo Ultra Sensitive"},
    "counter": {
        "cleansingStrength": "Coco-Glucoside leads the list (buffered, mild-leaning); a prominent alkyl sulfate keeps C5 moderate.",
        "conditioningLevel": "Guar after the sub-1 % actives; low realistic neighbor.",
        "weightPotential": "Guar prominent under E3; reset only moderate in a glucoside-led chassis.",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "manufacturer_de (moderate): 'Mildes Shampoo für empfindliche Kopfhaut' - qualifying E2 sensitive claim unit ('für ... empfindliche Kopfhaut').",
        "manufacturer_de: 'besonders sanfte Reinigung für Haar und empfindliche Kopfhaut' (corroborating), 'ohne die Kopfhaut zu reizen' (protective, E2a), 'Ohne Silikone, Parfüm & Parabene'.",
        "manufacturer_de: 'Mit 5 % Glycerin, Panthenol und Niacinamid spendet Feuchtigkeit und pflegt das Haar geschmeidig glänzend' (lengths moisture, generic).",
        "manufacturer_de: 'ideal für die tägliche Haarwäsche bei sensibler Haut' - U2 frequency wording (moderate).",
        "Name word 'Ultra Sensitive' does not name the scalp (F7 non-scalp name word); positioning comes from the manufacturer unit.",
        "ID-3: Glycerin @3, Panthenol @7, Niacinamide @8 present; fragrance-free consistent with INCI."],
    "focusPrimary": fp_("scalp_active", "moderate", "moisture", "moisture_supported", ["Glycerin @3", "Panthenol @7"], [],
                        ["Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @12", "Glyceryl Oleate @11"],
                        "Moisture verdict recorded blind; focus decided by F7", "candidate",
                        "A generic lengths-moisture claim with a moisture_supported formula competes.",
                        "Primary: claim direction sensitive scalp (manufacturer E2 unit, moderate) with scalpComfortTarget targeted (SC1 + CSA) -> scalp_active compatible; F7: neither role in the product name ('Ultra Sensitive' names no role) -> scalp_active primary (F7 step 2); route Panthenol @7 / Niacinamide @8 comfort routes on a fragrance-free moderate chassis.",
                        "scalp_active: explicit sensitive-scalp positioning with targeted (7.2, F7).", ["7.2", "F7", "SC1", "CL-SRC"]),
    "focusSecondary": fs_([], "moderate", ["moisture"],
                          "Empty default considered; the moisture sentence is generic and its only route (Glycerin @3, Panthenol @7) is already cited for the scalp_active comfort route (F3).",
                          "Empty: no independent moisture route (F3)."),
    "usageRole": ur_("frequent", "moderate", "regular", "explicit_frequent_non_strong",
                     ["manufacturer_de (moderate): 'ideal für die tägliche Haarwäsche bei sensibler Haut'"], [],
                     "Frequent: explicit daily wording (moderate) and cleansingStrength moderate (U2)."),
    "scalpComfortTarget": sc_("targeted", "moderate", "not_targeted",
                              "Targeted: SC1 - manufacturer E2 sensitive unit 'Mildes Shampoo für empfindliche Kopfhaut' (moderate); CSA - listed prominent routes Panthenol @7, Niacinamide @8 (comfort) and Glycerin @3, Glyceryl Oleate @11 (humectant/refatting); MB not met (prominent Sodium Coco-Sulfate @4). Supportive: fragrance-free, moderate cleansing. Confidence capped by the moderate positioning grade."),
    "primary": tgt("sensitive", "moderate", "S-SENSITIVE: E2 sensitive claim (moderate) + targeted + prominent comfort routes Panthenol @7, Niacinamide @8; cleansing moderate (no strong flag). Confidence = lowest of positioning (moderate) and scalpComfortTarget (moderate)."),
    "secondary": None, "D1": NOD1,
    "reconciliation": [
        "focusPrimary general -> scalp_active (sensitive-scalp manufacturer unit + targeted).",
        "usageRole regular -> frequent ('tägliche Haarwäsche', moderate).",
        "scalpComfortTarget not_targeted (provisional) -> targeted: SC1 positioning revealed; CSA was met blind.",
        "Formula properties unchanged."],
}

# ---------------- W106 Neqi Moisture Mystery ----------------
SPECS["W106"] = {
    "identity": {"brand": "Neqi", "productName": "Neqi Moisture Mystery Shampoo"},
    "counter": {
        "cleansingStrength": "None material (C6 clear).",
        "conditioningLevel": "Several light routes (refatter, oat peptide, pearlizer, alkane) could read as moderate.",
        "weightPotential": "Weak reset; non-material alkane post-line.",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "Product name 'Moisture Mystery' (high, English name word): moisture direction.",
        "manufacturer_de (German-language storefront showing CHF prices, so possibly the Swiss market): 'Intensive Feuchtigkeitspflege mit Algenextrakten', 'Di- und Tri-Peptide aus ... Hafer beugen Haarbruch vor', 'Sanfte Reinigung von Haaren und Kopfhaut, ohne zu strapazieren' (protective, E2a). Graded low as a possibly foreign-market manufacturer page (E1), except where German retailers carry the same claim.",
        "'perfekt für alle Haartypen geeignet - egal ob normales, trockenes, feines, fettiges oder dünnes Haar' - a suitability/hair-type list, not a claim that the product acts on oily roots (E2a tolerance wording; listing attribute, P0) -> no oily claim unit.",
        "pack_back source present but not transcribed.",
        "ID-3: 'Algenextrakt' has no algae-extract INCI entry (Algin @7 is an alginate thickener) - botanical marketing ingredient with no property role, note only. 'Hemisqualan' -> C13-15 Alkane @19 plausibly; 'Goji' Lycium @10, 'Malve' @11, 'Monoi' Gardenia @9, oat peptides @8 present."],
    "focusPrimary": fp_("general", "moderate", "moisture", "nonspecific", ["Glycerin @21 (late)"], ["Avena Sativa (Oat) Peptide @8"],
                        ["PEG-18 Glyceryl Oleate/Cocoate @5"], "No conditioning system; humectant late", "candidate",
                        "Name says 'Moisture'; formula carries no coherent humectant + conditioning cluster.",
                        "Primary: claim direction moisture (name, high); formula verdict nonspecific (recorded blind) -> generic moisture language over a nonspecific formula stays general (F1); repair wording (oat peptides) rests on one protein token; decision general.",
                        "General: moisture claim not supported by a moisture_supported verdict (F1, 3.2).", ["7.2", "7.3", "F1"]),
    "focusSecondary": fs_([], "moderate", ["repair"], "Empty default; no distinct supported positioning.", "Empty."),
    "usageRole": REG_DEFAULT,
    "scalpComfortTarget": NOT_T("no E2 sensitive or dry scalp claim unit ('Sanfte Reinigung ... Kopfhaut, ohne zu strapazieren' is protective); MB would satisfy CSA but positioning is absent."),
    "primary": tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit (the 'fettiges Haar' mention is a suitability list); manufacturer and pack sources present (13.8)."),
    "secondary": None, "D1": NOD1,
    "uncertainties": ["'fettiges ... Haar' inside 'für alle Haartypen geeignet' read as suitability/listing, not an oily claim unit; reading it as a claim would open S-OILY, which would fail anyway (cleansing low)."],
    "reconciliation": [
        "focusPrimary general confirmed; low -> moderate (moisture claim, nonspecific formula).",
        "usageRole regular, scalpComfortTarget not_targeted confirmed; low -> high.",
        "Formula properties unchanged."],
}

# ---------------- W107 Sante Glossy Shine ----------------
SPECS["W107"] = {
    "identity": {"brand": "Sante (Logocos)", "productName": "SANTE Glossy Shine Shampoo Birke + 3-fach Protein Komplex"},
    "counter": {
        "cleansingStrength": "Proteins and glycerin are counter-signals only; ALS with one buffer is strong under C5.",
        "conditioningLevel": "None material.",
        "weightPotential": "Guar fairly early (@8) with three proteins; strong reset.",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "Product name 'Glossy Shine Shampoo Birke + 3-fach Protein Komplex' (high): shine direction; protein complex named.",
        "manufacturer_de (moderate): 'glättet die Oberflächenstruktur des Haares für mehr Glanz & Geschmeidigkeit', 'Perfekte Lösung für glanzloses und stumpfes Haar', 'Stärkt, pflegt und glättet die Haarstruktur', 'Der 3-fach Protein Komplex stärkt, pflegt & schützt das Haar', 'Der hydratisierende Pflege-Komplex füllt & baut das Haar auf'.",
        "'Die Verträglichkeit ist dermatologisch getestet' - protective. No scalp claim; no frequency or reset wording.",
        "ID-3: 'Bio-Birkenblattextrakt' -> Betula Alba Leaf Extract @14; three proteins @5, @7, @9 present."],
    "focusPrimary": fp_("shine", "moderate", "repair", "repair_supported", ["Glycerin @6"],
                        ["Hydrolyzed Corn Protein @5", "Hydrolyzed Wheat Protein @7", "Hydrolyzed Soy Protein @9"],
                        ["Guar Hydroxypropyltrimonium Chloride @8"],
                        "Verdict applies to the repair (secondary) role", "candidate",
                        "Strong ALS chassis; the protein cluster also supports repair.",
                        "Primary: claim direction shine (name 'Glossy Shine', high; manufacturer 'glättet ... für mehr Glanz'); formula compatible: light smoothing film from Guar Hydroxypropyltrimonium Chloride @8 with acidic support (Citric Acid @10, F4 compatibility only), low weight; decision: dominant name claim (7.2).",
                        "Shine: dominant name claim with a plausible light-film/smoothing route (7.1, 7.2).", ["7.1", "7.2", "F4"]),
    "focusSecondary": fs_(["repair"], "moderate", [],
                          "Empty default considered; selected repair: distinct positioning ('3-fach Protein Komplex' in the name, high; 'stärkt, pflegt & schützt', 'füllt & baut das Haar auf', moderate); independent route Hydrolyzed Corn @5 / Wheat @7 / Soy @9 Protein (not cited by the shine route, F3); verdict repair_supported; distinct from shine (damage care vs gloss).",
                          "Repair secondary: own positioning and an independent protein route (8, F3)."),
    "usageRole": ur_("regular", "high", "none", "none", [], [],
                     "Regular: strong cleansing alone is insufficient for alternating (no reset intent, U4); no frequency wording."),
    "scalpComfortTarget": NOT_T("no E2 scalp claim unit; CSA half met via Glycerin @6 only."),
    "primary": tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present."),
    "secondary": None, "D1": NOD1,
    "reconciliation": [
        "focusPrimary general -> shine (name claim, compatible light film).",
        "focusSecondary [] -> [repair] (named protein complex, independent protein route).",
        "usageRole regular confirmed (low -> high); scalpComfortTarget not_targeted confirmed (low -> high).",
        "Formula properties unchanged."],
}

# ---------------- W108 ISANA MED pH 5,5 ----------------
SPECS["W108"] = {
    "identity": {"brand": "ISANA (Rossmann)", "productName": "ISANA MED Shampoo pH 5,5 hautneutral"},
    "counter": {
        "cleansingStrength": "Reinforcing ether-sulfate routes are a late minor blend facing three buffers.",
        "conditioningLevel": "Pearlizer plus humectants could be read as light routes (moderate).",
        "weightPotential": "None.",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "manufacturer_de (Rossmann own brand, moderate): 'Das ISANA MED SHAMPOO ist eine Spezialentwicklung für sensible Kopfhaut' - qualifying E2 sensitive unit.",
        "manufacturer_de: 'für jeden Tag' - U2 frequency wording (moderate).",
        "manufacturer_de: 'schützt Kopfhaut & Haar vor Austrocknung' - protective wording (E2a), and 'Austrocknung' is outside the E2 dry lexicon -> no dry unit.",
        "pack_front (high): 'pH 5,5 HAUTNEUTRAL', '3% Urea', 'normales Haar', 'Klinisch getestet', 'dermatologisch bestätigt' - protective/mildness only.",
        "ID-3: '3% Urea' -> Urea @3; 'Feuchtigkeits-Komplex' unspecified."],
    "focusPrimary": fp_("scalp_active", "moderate", "general", "nonspecific", ["Urea @3", "Panthenol @8", "Glycerin @20"], [], [],
                        "Humectants without deposition support", "candidate",
                        "Strong reinforced ether-sulfate chassis; 'Feuchtigkeits-Komplex' lengths wording.",
                        "Primary: claim direction sensitive scalp (manufacturer E2 unit, moderate) with scalpComfortTarget targeted -> scalp_active compatible; no lengths role in the name; lengths moisture wording over a nonspecific verdict cannot compete (F1, F7 step 2); route Urea @3 / Panthenol @8 comfort routes.",
                        "scalp_active: explicit sensitive-scalp positioning with targeted (7.2, F7).", ["7.2", "F7", "SC1"]),
    "focusSecondary": fs_([], "moderate", ["moisture"], "Empty default; moisture wording has a nonspecific verdict and shares Urea/Panthenol with the primary route (F3).", "Empty."),
    "usageRole": ur_("regular", "moderate", "frequent", "none", [],
                     ["frequent: manufacturer 'für jeden Tag' (moderate) is frequency wording, but cleansingStrength is strong (U2 conjunct fails)"],
                     "Regular: the frequent trigger needs non-strong cleansing; with the cleansing neighbor (moderate) it would fire, hence moderate confidence. No reset intent (U4).", ["9", "U1", "U2"]),
    "scalpComfortTarget": sc_("targeted", "moderate", "not_targeted",
                              "Targeted: SC1 - 'Spezialentwicklung für sensible Kopfhaut' (manufacturer, moderate); CSA - listed prominent routes Urea @3 and Panthenol @8 (comfort and humectant). MB not met (prominent ether sulfates). Counter-signal cleansingStrength strong -> confidence at most moderate, neighbor not_targeted (CSA counter-signals)."),
    "primary": tgt("sensitive", "moderate", "S-SENSITIVE: E2 sensitive unit (moderate) + targeted + prominent comfort routes Urea @3, Panthenol @8; cleansingStrength strong -> review_strong_cleansing_comfort_route. Confidence = lowest of positioning (moderate), scalpComfortTarget (moderate)."),
    "secondary": None, "D1": NOD1,
    "reconciliation": [
        "focusPrimary general -> scalp_active (sensitive-scalp unit + targeted).",
        "scalpComfortTarget not_targeted (provisional) -> targeted (SC1 revealed; CSA met blind).",
        "usageRole regular confirmed; frequent trigger recorded as losing (strong cleansing); low -> moderate.",
        "Formula properties unchanged."],
}

# ---------------- W109 Herbal Essences Tiefenreinigung & Glanz ----------------
SPECS["W109"] = {
    "identity": {"brand": "Herbal Essences (Procter & Gamble)", "productName": "Herbal Essences Tiefenreinigung & Glanz Shampoo Limettenduft"},
    "counter": {
        "cleansingStrength": "Cocamidopropyl Betaine @5 sits right after the early fragrance; if counted, C1 would be moderate.",
        "conditioningLevel": "None.",
        "weightPotential": "None.",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "Product name 'Tiefenreinigung & Glanz' (high): D1 stem 'tiefenrein' -> explicitResetPositioning true; shine ('Glanz') also named.",
        "Retailer copy only (low): 'Tiefenreinigendes Shampoo', 'entfernt Ablagerungen', 'KLÄREN & GLÄNZEN', 'SOFORTIG TIEFENREINIGUNG MIT NUR EINER ANWENDUNG'.",
        "Directions 'Großzügig auftragen, aufschäumen und danach ausspülen' - no daily-use or occasional-use wording (no U5 conflict).",
        "No scalp claim unit; no manufacturer or pack source in the packet.",
        "ID-3: 'Limettenduft' -> fragrance; no conflict."],
    "focusPrimary": fp_("clarifying", "moderate", "shine", "not_applicable", [], [], [], "Not a repair/moisture decision", "candidate",
                        "'Glanz' in the name competes; cleansing strength rests on a C4 prominence boundary.",
                        "Primary: claim direction deep cleansing (name 'Tiefenreinigung', high) - the first and dominant name claim; formula compatible under F6 (cleansingStrength strong, conditioningLevel low, weightPotential low); route unbuffered SLES @2 chassis with no deposition; decision: explicit deep-cleaning product with compatible architecture (7.2).",
                        "Clarifying: explicit deep-cleansing name with F6-compatible architecture.", ["7.2", "F6", "D1"]),
    "focusSecondary": fs_([], "moderate", ["shine"],
                          "Empty default considered; 'Glanz' is positioned in the name but its only formula support is the clean, residue-free result of the clarifying chassis (F2) or acids (F4: cannot create a secondary shine) - no independent route.",
                          "Empty: shine has no independent route (F2, F3, F4).", ["8", "F2", "F3", "F4"]),
    "usageRole": ur_("occasional_reset", "high", "none", "explicit_deep_cleansing",
                     ["Product name 'Tiefenreinigung & Glanz' (high) - D1 true"],
                     ["alternating: strong cleansing + reset intent ('Tiefenreinigung' in the name, U4) - loses to occasional_reset (U1)"],
                     "Occasional reset: D1 true from the product name (U1 precedence over alternating).", ["9", "U1", "U4", "D1"]),
    "scalpComfortTarget": NOT_T("no E2 scalp claim unit; CSA not met (no listed route, MB excluded)."),
    "primary": tgt("ordinary", "moderate", "S-ORDINARY way 1: no qualifying E2 claim unit; retailer copy only (no manufacturer/pack source) -> moderate (13.8)."),
    "secondary": None,
    "D1": {"value": True, "confidence": "high", "evidence": "Product name 'Tiefenreinigung & Glanz' (stem 'tiefenrein', name grade high); retailer copy corroborates ('Tiefenreinigendes Shampoo'). No daily-use directions."},
    "reconciliation": [
        "focusPrimary general -> clarifying (D1 name + F6-compatible formula).",
        "usageRole regular -> occasional_reset (D1 true).",
        "scalpComfortTarget not_targeted confirmed; low -> high.",
        "D2 met -> deepCleanserListing flagged (needs_record). Formula properties unchanged."],
}

# ---------------- W110 ISANA 2in1 Volumen ----------------
SPECS["W110"] = {
    "identity": {"brand": "ISANA (Rossmann)", "productName": "ISANA Shampoo & Spülung 2in1 Volumen (Malve & Acai)"},
    "counter": {
        "cleansingStrength": "Refatters/guar are counter-signals only.",
        "conditioningLevel": "2-in-1 claim never raises conditioning (C7); guar after the sub-1 % actives.",
        "weightPotential": "Three light families interact (W2).",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "Product name 'Shampoo & Spülung 2in1 Volumen' (high): volume direction; 2-in-1 claim (C7: never raises conditioning).",
        "manufacturer_de (Rossmann own brand, moderate): 'verleiht auch kraftlosem und feinem Haar Volumen', 'mit Soft-Care-Komplex und Weizenprotein', 'kraftloses & feines Haar' (thickness claim, T2).",
        "'dermatologisch bestätigt und pH-hautneutral' - protective. No scalp, frequency or reset wording.",
        "ID-3: 'Weizenprotein' -> Hydrolyzed Wheat Protein @7; 'Malve & Acai' -> @5, @6. No conflict."],
    "focusPrimary": fp_("volume", "moderate", "general", "moisture_supported", ["Panthenol @9", "Pantolactone @10", "Glycerin @19"],
                        ["Hydrolyzed Wheat Protein @7"], ["Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @13"],
                        "Verdict recorded blind; volume is not a repair/moisture decision", "candidate",
                        "2-in-1 conditioning (guar, refatters) is a trade-off against lift.",
                        "Primary: claim direction volume (name, high; manufacturer, moderate); formula compatible (weightPotential low, no silicone or payload lipid); route: light architecture with Hydrolyzed Wheat Protein @7; decision: dominant name claim (7.2).",
                        "Volume: name claim on a light, silicone-free formula.", ["7.1", "7.2", "C7"]),
    "focusSecondary": fs_([], "moderate", ["moisture"], "Empty default; no distinct secondary positioning (2-in-1 care is not a focus, C7).", "Empty."),
    "usageRole": REG_DEFAULT,
    "scalpComfortTarget": NOT_T("no E2 scalp claim unit; CSA half met (Niacinamide @8, Panthenol @9) but no positioning."),
    "primary": tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present."),
    "secondary": None, "D1": NOD1,
    "reconciliation": [
        "focusPrimary general -> volume.",
        "usageRole regular, scalpComfortTarget not_targeted confirmed (low -> high).",
        "Formula properties unchanged (2-in-1 claim does not raise conditioning, C7)."],
}

# ---------------- W111 GLISS Sealing Miracle ----------------
SPECS["W111"] = {
    "identity": {"brand": "Schwarzkopf GLISS", "productName": "Schwarzkopf GLISS Sealing Miracle Versiegelndes Shampoo"},
    "counter": {
        "cleansingStrength": "None material.",
        "conditioningLevel": "None material.",
        "weightPotential": "Guar prominent; several light families interact (W2).",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "pack_back (moderate): 'Wirkt wie ein Reißverschluss für das Haar', 'Schützt das Haar', 'Für splissgeschädigtes Haar'; directions 'Regelmäßig anwenden' (not U2 frequency wording).",
        "manufacturer_de (moderate): 'Versiegelndes Shampoo ... mit Zip & Seal-Technologie', 'Für geschädigtes und splissanfälliges Haar', 'Bis zu 94 % weniger Spliss*' (*with the spray), 'Reinigt, ohne das Haar zu beschweren' (never lowers weight), 'Für alle Haartypen'.",
        "No scalp claim unit.",
        "ID-3: 'Zip & Seal-Technologie' not mappable to an INCI name (marketing technology; plausibly Pea Peptide @5 + guar @6) - note only."],
    "focusPrimary": fp_("general", "moderate", "repair", "nonspecific", [], ["Pisum Sativum (Pea) Peptide @5"],
                        ["Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @6", "Glyceryl Oleate @10", "PEG-7 Glyceryl Cocoate @12"],
                        "One protein token plus guar is not a coherent repair cluster", "candidate",
                        "Repair positioning is explicit (pack and manufacturer).",
                        "Primary: claim direction repair (split ends/damage, moderate); formula verdict nonspecific (recorded blind: one pea peptide + guar + weak refatters) -> claims may not turn a nonspecific formula into a confident specialist focus (3.2, F1); decision general.",
                        "General: repair claim over a nonspecific formula (F1, 3.2).", ["7.2", "7.3", "F1", "3.2"]),
    "focusSecondary": fs_([], "moderate", ["repair"], "Empty default.", "Empty."),
    "usageRole": REG_DEFAULT,
    "scalpComfortTarget": NOT_T("no E2 scalp claim unit; CSA would fail too."),
    "primary": tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer and pack sources present."),
    "secondary": None, "D1": NOD1,
    "uncertainties": ["Focus general vs repair: the blind verdict (nonspecific) decides; a reader who counts pea peptide + guar as a coherent repair cluster would choose repair."],
    "reconciliation": [
        "focusPrimary general confirmed; low -> moderate (repair claim, nonspecific verdict).",
        "usageRole regular, scalpComfortTarget not_targeted confirmed (low -> high).",
        "Formula properties unchanged."],
}

# ---------------- W112 OGX Biotin & Collagen ----------------
SPECS["W112"] = {
    "identity": {"brand": "OGX", "productName": "OGX Biotin & Collagen Shampoo (Thick & Full)"},
    "counter": {
        "cleansingStrength": "None material (C6 clear).",
        "conditioningLevel": "Silicone + cationic could be read as multiple complementary systems (high).",
        "weightPotential": "Two persistent families with weak reset argue high.",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "All German claims are retailer copy (low); the US manufacturer page is manufacturer_foreign (low, E1).",
        "Retailer (low): 'Hinterlässt Volumen und ein seidiges Gefühl', 'bis zu 72 Stunden ... mehr Volumen', 'für feines & dünnes Haar', 'für die tägliche Haarwäsche ... geeignet' (low, cannot fire U2), 'Nährt das Haar'.",
        "Product name 'OGX Biotin & Collagen Shampoo' names ingredients only (no focus word); 'Thick & Full' appears in retailer titles only.",
        "No scalp claim unit; 'dünnes Haar' is a cosmetic fullness claim, not a hair-loss claim.",
        "ID-3: 'Biotin' @6, 'Collagen' @7 present; 'Weizenprotein'/'hydrolysiertes Weizenprotein' (retailer) has no INCI match -> conflict, not material (a protein_film family is already present via Hydrolyzed Collagen @7, so adding a hydrolyzed protein cannot change a property or gate); 'LipiPro Shield' unmapped technology - note only."],
    "focusPrimary": fp_("general", "moderate", "volume", "dual_supported",
                        ["Urea @15", "Sodium Lactate @13", "Glyceryl Oleate @12"],
                        ["Hydrolyzed Collagen @7", "Amodimethicone @10", "Starch Hydroxypropyltrimonium Chloride @9"],
                        ["Starch Hydroxypropyltrimonium Chloride @9", "Lecithin @19"],
                        "Verdict recorded blind", "not_applicable",
                        "Retailer volume/nourishing claims exist but are graded low.",
                        "Primary: claim direction volume/nourishment only from low-graded sources; a low claim may act as candidate only when the formula verdict independently supports that focus - volume is not supported (weightPotential moderate, neighbor high, amodimethicone) and a low claim can never be a tie_breaker for the dual verdict (CL-SRC); decision general.",
                        "General: no in-scope claim of sufficient grade (CL-SRC).", ["7.2", "CL-SRC"]),
    "focusSecondary": fs_([], "moderate", ["volume"], "Empty default.", "Empty."),
    "usageRole": REG_DEFAULT,
    "scalpComfortTarget": NOT_T("no E2 scalp claim unit; formula half (listed routes and MB) would be met but positioning is absent."),
    "primary": tgt("ordinary", "moderate", "S-ORDINARY way 1: no qualifying E2 claim unit; German sources are retailer copy only (the foreign manufacturer page is graded like retailer copy) -> moderate (13.8)."),
    "secondary": None, "D1": NOD1,
    "uncertainties": ["Ordinary confidence moderate: the US manufacturer page is treated as not counting as a manufacturer source for 13.8 (it is graded low like retailer copy, E1)."],
    "reconciliation": [
        "focusPrimary general confirmed; low -> moderate (claims low-graded).",
        "usageRole regular, scalpComfortTarget not_targeted confirmed (low -> high).",
        "Formula properties unchanged; wheat-protein conflict recorded as a non-material note (ID-3)."],
}

# ---------------- W113 OGX Keratin Oil ----------------
SPECS["W113"] = {
    "identity": {"brand": "OGX", "productName": "OGX Strength & Length + Keratin Oil Shampoo"},
    "counter": {
        "cleansingStrength": "None material (C6 clear).",
        "conditioningLevel": "No C2 humectant element (C2 not met).",
        "weightPotential": "All depositors mid-list; shares unknown.",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "Product name 'Strength & Length + Keratin Oil' (high): strengthening name words (English), corroborating repair.",
        "Retailer copy only (low): 'Anti-Haarbruch Shampoo für strapaziertes Haar', 'stärkt das Haar effektiv', 'verhindert nachweislich Haarbruch und reduziert Spliss um bis zu 80%', 'Enthält Arganöl'; parts of the copy describe the conditioner.",
        "No scalp claim unit; no frequency/reset wording; directions ordinary.",
        "ID-3: 'Keratin' -> Hydrolyzed Keratin @6; 'Arganöl' -> Argania Spinosa Kernel Oil @7; 'LipiPro Shield' unmapped technology - note only."],
    "focusPrimary": fp_("repair", "moderate", "general", "repair_supported", [],
                        ["Hydrolyzed Keratin @6", "Argania Spinosa Kernel Oil @7", "Amodimethicone @10", "Guar Hydroxypropyltrimonium Chloride @11", "Hydrogenated Castor Oil @12"],
                        ["Guar Hydroxypropyltrimonium Chloride @11", "Glycol Distearate @15"],
                        "No humectant cluster", "candidate",
                        "Repair claims are retailer-graded (low); heavy-leaning deposition.",
                        "Primary: claim direction repair (retailer copy, low; name 'Strength & Length' corroborates); a low claim may act as candidate because the formula verdict is independently repair_supported (keratin + argan oil + amodimethicone + guar), which caps focus confidence at moderate (CL-SRC); decision repair.",
                        "Repair: repair_supported formula with low-graded repair claims (CL-SRC cap moderate, F1).", ["7.2", "7.3", "F1", "CL-SRC"]),
    "focusSecondary": fs_([], "moderate", ["shine"], "Empty default; 'Glanz' wording (low) is an outcome of the same oil/silicone route (F2).", "Empty."),
    "usageRole": REG_DEFAULT,
    "scalpComfortTarget": NOT_T("no E2 scalp claim unit."),
    "primary": tgt("ordinary", "moderate", "S-ORDINARY way 1: no qualifying E2 claim unit; retailer copy only -> moderate (13.8)."),
    "secondary": None, "D1": NOD1,
    "reconciliation": [
        "focusPrimary general -> repair (low claim admitted as candidate by the repair_supported verdict; confidence capped moderate).",
        "usageRole regular, scalpComfortTarget not_targeted confirmed (low -> high).",
        "Formula properties unchanged."],
}

# ---------------- W114 Sebamed Anti-Schuppen Plus ----------------
SPECS["W114"] = {
    "identity": {"brand": "Sebamed", "productName": "Sebamed Anti-Schuppen Shampoo PLUS"},
    "counter": {
        "cleansingStrength": "None material.",
        "conditioningLevel": "Single cationic starch only; low realistic neighbor.",
        "weightPotential": "The cationic starch is prominent.",
        "dandruffSupport": "None - positioned and supported."},
    "claimEvidence": [
        "Product name 'Anti-Schuppen Shampoo PLUS' (high): E2 dandruff claim.",
        "manufacturer_de (moderate): 'Nach 4 Wochen bis zu 95% weniger Schuppen, für fettendes Haar' (dandruff unit containing oily wording 'fettendes Haar'); 'speziell zur nachhaltigen Bekämpfung von Schuppen bei schnell fettendem Haar und Juckreiz entwickelt' (dandruff unit with oily wording and bundled comfort wording 'Juckreiz'); 'reinigt die Kopfhaut schonend' (protective); 'Haartyp: schuppiges Haar, fettiges Haar' (listing attribute, not a unit).",
        "Directions (manufacturer, moderate): 'Täglich oder 2-3x pro Woche anwenden' - U2 frequency wording.",
        "Retailer (low): 'Anti-Schuppen Shampoo für schnell fettendes Haar', 'Mit Piroctone Olamine'.",
        "ID-3: 'Piroctone Olamine' @7 present; 'seifenfrei' consistent (no soap)."],
    "focusPrimary": fp_("scalp_active", "high", "none", "not_applicable", [], [], ["Hydroxypropyl Oxidized Starch PG-Trimonium Chloride @6"],
                        "Not a repair/moisture decision", "candidate",
                        "Oily-hair positioning would point to clarifying (F6) as a competing role.",
                        "Primary: claim direction anti-dandruff (name, high) with a recognized active (Piroctone Olamine @7) -> problem-led scalp_active (7.2); oily wording sits inside the dandruff units; decision scalp_active.",
                        "scalp_active: anti-dandruff name plus recognized active (7.2).", ["7.2", "F7", "S-DANDRUFF"]),
    "focusSecondary": fs_([], "moderate", ["clarifying"],
                          "Empty default considered; the oily wording sits inside dandruff claim units and its only formula support would be the moderate SLES chassis itself - a restatement of cleansing, not an independent route (Section 8 invalid pattern).",
                          "Empty: no independent clarifying route."),
    "usageRole": ur_("treatment", "high", "none", "recognized_active_problem_led",
                     ["Product name 'Anti-Schuppen Shampoo PLUS' (high)", "Piroctone Olamine @7 (dandruffSupport supported)"],
                     ["frequent: 'Täglich oder 2-3x pro Woche anwenden' (manufacturer directions, moderate) with non-strong cleansing - loses to treatment (U1)"],
                     "Treatment: recognized active plus a qualifying dandruff claim (U3); U1 precedence over frequent.", ["9", "U1", "U2", "U3"]),
    "scalpComfortTarget": sc_("not_targeted", "high", "none",
                              "Not targeted: the only comfort wording ('Juckreiz') sits inside a dandruff claim unit - a dandruff symptom, not SC1 positioning (SC1, E2a); there is no separate sensitive/dry unit. Formula half also fails (CSA: no prominent listed E4 route; MB excluded by SLES @2; prominent Menthol @8)."),
    "primary": tgt("dandruff", "high", "S-DANDRUFF: E2 dandruff claim in the product name (high) + dandruffSupport supported (Piroctone Olamine @7, high) -> dandruff path, primary (S-PRIMARY, R17.1); no secondary target (R17.2)."),
    "secondary": None, "D1": NOD1,
    "rct": ["oily"],
    "extraNotes": [
        "suits_dandruff_with_oily_scalp: oily wording 'für fettendes Haar' / 'bei schnell fettendem Haar' (manufacturer, moderate) + S-OILY clause passed (cleansingStrength moderate, weightPotential low, conditioningLevel moderate); value confidence moderate",
        "dandruff_bundled_comfort_wording: 'Bekämpfung von Schuppen bei schnell fettendem Haar und Juckreiz' (manufacturer, moderate) - S-SENSITIVE formula gate failed: CSA not met (no prominent E4 comfort or humectant route; MB excluded by prominent Sodium Laureth Sulfate @2); counter-signal prominent Menthol @8"],
    "reconciliation": [
        "focusPrimary general -> scalp_active (anti-dandruff name + active).",
        "usageRole regular -> treatment (U3); frequent recorded as losing trigger.",
        "scalpComfortTarget not_targeted confirmed (bundled wording only); low -> high.",
        "researchCombinationTargets ['oily'] (E2b layer 2, R17.2). Formula properties unchanged."],
}

# ---------------- W115 Balea med 2in1 Urea 5% ----------------
SPECS["W115"] = {
    "identity": {"brand": "Balea (dm)", "productName": "Balea med Duschgel & Shampoo 2in1 Urea 5%"},
    "counter": {
        "cleansingStrength": "Humectant-rich formula; single betaine buffer still satisfies C1 moderate.",
        "conditioningLevel": "Only slip agent (guar @17) is post-fragrance.",
        "weightPotential": "None material.",
        "dandruffSupport": "Active present (preservative zone) without dandruff positioning (R17.3)."},
    "claimEvidence": [
        "Source graded moderate (dm own-brand page, sourceKind manufacturer_de): 'Duschgel & Shampoo für empfindliche Haut'; 'Seine seifenfreie Rezeptur ist speziell für trockene sowie empfindliche Haut und Kopfhaut entwickelt worden' - one E2 unit naming dry and sensitive scalp states (counts for both, E2a); 'Das Duschgel & Shampoo schützt zudem vor Juckreiz, der durch Trockenheit entstehen kann' - sensitive (itch) unit acting on the scalp/skin state.",
        "'Schützt vor dem Austrocknen', 'kann dem Austrocknen von Haut und Haar entgegenwirken' - protective; 'ph-hautneutral'.",
        "No dandruff claim; no frequency or reset wording; directions 'Dusche + Shampoo'.",
        "ID-3: '5% Urea' -> Urea @3, 'Allantoin' @9, 'Provitamin B5' -> Panthenol @8. No conflict.",
        "Product is a shower gel + shampoo 2-in-1 (body and hair)."],
    "focusPrimary": fp_("scalp_active", "moderate", "moisture", "moisture_supported",
                        ["Urea @3", "Glycerin @5", "Sodium Lactate @7", "Panthenol @8"], [],
                        ["Glyceryl Oleate @13", "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @17", "Lecithin @19"],
                        "Verdict recorded blind; focus decided by F7", "candidate",
                        "Generic dryness/moisture wording for skin and hair competes.",
                        "Primary: claim direction sensitive/dry scalp (moderate) with scalpComfortTarget targeted -> scalp_active compatible; name ('2 in 1 Urea 5%') names no role -> F7 step 2 scalp_active; route Urea @3, Panthenol @8, Allantoin @9 comfort routes.",
                        "scalp_active: explicit sensitive/dry scalp positioning with targeted (7.2, F7).", ["7.2", "F7", "SC1"]),
    "focusSecondary": fs_([], "moderate", ["moisture"], "Empty default; hair-moisture wording reuses the Urea/Glycerin/Panthenol route already cited (F3).", "Empty (F3)."),
    "usageRole": REG_DEFAULT,
    "scalpComfortTarget": sc_("targeted", "moderate", "not_targeted",
                              "Targeted: SC1 - 'speziell für trockene sowie empfindliche Haut und Kopfhaut entwickelt' and 'schützt zudem vor Juckreiz' (moderate); CSA - listed prominent routes Urea @3, Panthenol @8, Allantoin @9 (comfort) and Glycerin @5, Sodium Lactate @7 (humectant). MB not met (SLES). Confidence capped by the moderate positioning grade."),
    "primary": tgt("sensitive", "moderate", "S-SENSITIVE passes (E2 sensitive units, moderate; targeted; prominent comfort routes Urea @3, Panthenol @8, Allantoin @9); S-DRY also passes. S-PRIMARY: no target in the product name -> order sensitive, dry -> sensitive primary. Confidence moderate."),
    "secondary": {"target": "dry", "confidence": "moderate",
                  "rationale": "S-DRY: E2 dry-scalp unit 'für trockene ... Kopfhaut' (moderate) + targeted + prominent humectant routes Glycerin @5, Urea @3, Sodium Lactate @7, Panthenol @8; S-SECONDARY: dry is not contradictory with sensitive; the active without a dandruff claim restricts nothing (R17.3)."},
    "D1": NOD1,
    "extraNotes": ["active_without_dandruff_positioning"],
    "uncertainties": ["Scope: a shower-gel-and-shampoo 2-in-1 for body and hair; classified as a regular shampoo because it is sold and directed for hair washing. Orchestrator may rule it out of the shampoo cohort.",
                      "The sensitive and dry claims come from one unit naming skin and scalp together; read as scalp positioning because it names 'Kopfhaut' explicitly."],
    "reconciliation": [
        "focusPrimary general -> scalp_active.",
        "scalpComfortTarget not_targeted (provisional) -> targeted (SC1 revealed; CSA met blind).",
        "usageRole regular confirmed (low -> high); dandruff active recorded as active_without_dandruff_positioning.",
        "Formula properties unchanged."],
}

# ---------------- W116 Herbal Essences Fiji ----------------
SPECS["W116"] = {
    "identity": {"brand": "Herbal Essences (Procter & Gamble)", "productName": "Herbal Essences Shampoo Fiji (Schwerelose Feuchtigkeit)"},
    "counter": {
        "cleansingStrength": "None material (C6 clear).",
        "conditioningLevel": "PQ-10 present (trace) - moderate neighbor.",
        "weightPotential": "Weak reset could let PQ-10 build up.",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "manufacturer_de brand portal (moderate): 'Shampoo für schwerelose Feuchtigkeit', 'frei von sulfatierenden Tensiden', 'Vegan'.",
        "Retailer (low): 'Feuchtigkeitsshampoo', 'reinigt das Haar sanft und spendet Feuchtigkeit', 'ohne es zu beschweren'.",
        "No scalp claim unit; no frequency or reset wording.",
        "ID-3: 'Kokosnussextrakt' -> Cocos Nucifera Fruit Juice @25 (botanical, no role) - note only."],
    "focusPrimary": fp_("general", "moderate", "moisture", "nonspecific", ["Glycerin @24 (late)"], [], ["Polyquaternium-10 @11"],
                        "No care cluster", "candidate",
                        "Moisture is the product's only positioning.",
                        "Primary: claim direction moisture (manufacturer, moderate); formula verdict nonspecific (trace PQ-10, late glycerin) -> generic moisture language over a nonspecific formula stays general (F1); decision general.",
                        "General: moisture claim without a moisture_supported formula (F1).", ["7.2", "7.3", "F1"]),
    "focusSecondary": fs_([], "moderate", ["moisture"], "Empty default.", "Empty."),
    "usageRole": REG_DEFAULT,
    "scalpComfortTarget": NOT_T("no E2 scalp claim unit; MB would satisfy CSA but positioning is absent."),
    "primary": tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present."),
    "secondary": None, "D1": NOD1,
    "reconciliation": [
        "focusPrimary general confirmed; low -> moderate.",
        "usageRole regular, scalpComfortTarget not_targeted confirmed (low -> high).",
        "Formula properties unchanged."],
}

# ---------------- W117 Pantene Hydra Glow ----------------
SPECS["W117"] = {
    "identity": {"brand": "Pantene Pro-V (Procter & Gamble)", "productName": "PANTENE PRO-V Shampoo Miracles Hydra Glow"},
    "counter": {
        "cleansingStrength": "Fatty alcohols and cationics are counter-signals only.",
        "conditioningLevel": "Both cationics and all humectants are post-fragrance.",
        "weightPotential": "W-RICH present for weight; post-line Cetyl Alcohol @9 and Trihydroxystearin @17 add lipid load (W-LINE 6).",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "Retailer copy only (low): 'Intensive Feuchtigkeit', 'Nährende Rezeptur', 'bringt selbst trockenstes Haar zum Glänzen', 'ganz ohne zu beschweren', 'Für die tägliche Haarwäsche geeignet' (low; cannot fire U2).",
        "Product name 'Miracles Hydra Glow' - 'Hydra'/'Glow' are not German or E2 terms; read as a weak moisture/shine name direction, but the moisture verdict is not supported.",
        "No scalp claim unit; no manufacturer or pack source.",
        "ID-3: 'Biotin' @25, 'Pro-Vitamin B5' -> Panthenol @20, 'Hyaluronsäure' -> Sodium Hyaluronate @23 present; 'Baobab-Essenz' (Adansonia Digitata) absent - botanical with no property role, note only."],
    "focusPrimary": fp_("general", "moderate", "moisture", "nonspecific", ["Glycerin @12", "Panthenol @20", "Sodium Hyaluronate @23"], [],
                        ["Stearyl Alcohol @6", "Cetyl Alcohol @9", "Polyquaternium-6 @14", "Guar Hydroxypropyltrimonium Chloride @15"],
                        "Humectants all post-fragrance", "not_applicable",
                        "Retailer moisture claims and 'Hydra' name word point to moisture.",
                        "Primary: moisture direction only from low-graded retailer copy plus a non-lexicon name word; the formula verdict (nonspecific, recorded blind) does not independently support moisture, so the low claim cannot act as candidate (CL-SRC); decision general.",
                        "General: no adequately graded claim over a nonspecific verdict (CL-SRC, F1).", ["7.2", "F1", "CL-SRC"]),
    "focusSecondary": fs_([], "moderate", ["shine"], "Empty default.", "Empty."),
    "usageRole": REG_DEFAULT,
    "scalpComfortTarget": NOT_T("no E2 scalp claim unit; CSA would fail too."),
    "primary": tgt("ordinary", "moderate", "S-ORDINARY way 1: no qualifying E2 claim unit; retailer copy only -> moderate (13.8)."),
    "secondary": None, "D1": NOD1,
    "uncertainties": ["'Hydra Glow' as a name direction: the English name word is treated as a moisture candidate graded by the name, but the verdict is nonspecific, so the result is general either way (F1)."],
    "reconciliation": [
        "focusPrimary general confirmed; low -> moderate.",
        "usageRole regular, scalpComfortTarget not_targeted confirmed (low -> high).",
        "Formula properties unchanged."],
}

# ---------------- W118 Sebamed Every-Day ----------------
SPECS["W118"] = {
    "identity": {"brand": "Sebamed", "productName": "Sebamed Every-Day Shampoo"},
    "counter": {
        "cleansingStrength": "None material (C6 clear).",
        "conditioningLevel": "Trace cationic starch.",
        "weightPotential": "Weak reset.",
        "dandruffSupport": "None."},
    "claimEvidence": [
        "Product name 'Every-Day Shampoo' (high): U2 frequency wording ('Every-Day').",
        "manufacturer_de (moderate): 'Schonende, seifenfreie Reinigung für empfindliche Kopfhaut' - read as a qualifying E2 sensitive unit (states the product is for sensitive scalp: 'für ... empfindliche Kopfhaut'); it is a headline of its own, not under a mildness heading.",
        "manufacturer_de: 'seifenfreies Shampoo für die tägliche Haarwäsche', directions 'Für die tägliche Anwendung geeignet' (moderate, U2).",
        "manufacturer_de: 'schützt Kopfhaut und Haar vor dem Austrocknen' (protective), 'stärken die Barrierefunktion der empfindlichen Haut' (brand-level skin claim), pH 5,5 statements (mildness).",
        "Retailer (low): 'Seifenfrei & schonend zur Kopfhaut' (sparing wording, E2a).",
        "ID-3: 'Zuckertensid-Formel' -> Decyl Glucoside @2; no conflict."],
    "focusPrimary": fp_("scalp_active", "moderate", "general", "not_applicable", [], [], ["Hydroxypropyl Oxidized Starch PG-Trimonium Chloride @11"],
                        "Not a repair/moisture decision", "candidate",
                        "The sensitive-scalp unit sits among mildness wording; a sparing reading would leave only mildness (no focus).",
                        "Primary: claim direction sensitive scalp (manufacturer E2 unit, moderate) with scalpComfortTarget targeted (SC1 + CSA via MB) -> scalp_active; no lengths-care role claimed; decision scalp_active (7.2).",
                        "scalp_active: explicit sensitive-scalp positioning with targeted (7.2).", ["7.2", "SC1", "MB"]),
    "focusSecondary": fs_([], "moderate", ["volume"], "Empty default; retailer 'mehr Fülle und Glanz' is low-graded.", "Empty."),
    "usageRole": ur_("frequent", "high", "none", "explicit_frequent_non_strong",
                     ["Product name 'Every-Day Shampoo' (high)", "manufacturer_de 'für die tägliche Haarwäsche' / directions 'Für die tägliche Anwendung geeignet' (moderate)"], [],
                     "Frequent: explicit frequency wording in the name and manufacturer text, cleansingStrength low (U2)."),
    "scalpComfortTarget": sc_("targeted", "moderate", "not_targeted",
                              "Targeted: SC1 - 'Schonende, seifenfreie Reinigung für empfindliche Kopfhaut' (manufacturer, moderate); CSA via MB (v1.6.2): mild_base:Decyl Glucoside @2, Disodium Laureth Sulfosuccinate @3, Sodium Lauryl Sulfoacetate @4 (cleansing low, no prominent strong anionic); no listed E4 route is prominent (Sodium Lactate @14 late). Confidence moderate (positioning grade; the unit borders on sparing wording)."),
    "primary": tgt("sensitive", "moderate", "S-SENSITIVE: E2 sensitive unit (moderate) + targeted + MB (route clause, v1.6.2); cleansing low. Confidence = lowest of positioning (moderate) and scalpComfortTarget (moderate)."),
    "secondary": None, "D1": NOD1,
    "uncertainties": ["'Schonende ... Reinigung für empfindliche Kopfhaut' could be read as sparing/mildness wording (E2a); then SC1 fails, scalpComfortTarget not_targeted, focus general and the target ordinary. Chosen reading: 'für empfindliche Kopfhaut' states the product's intended scalp state."],
    "reconciliation": [
        "focusPrimary general -> scalp_active.",
        "usageRole regular -> frequent ('Every-Day' name, daily directions).",
        "scalpComfortTarget not_targeted (provisional) -> targeted via MB.",
        "Formula properties unchanged."],
}

# ---------------- W119 Elvital Hydra Hyaluronic ----------------
SPECS["W119"] = {
    "identity": {"brand": "L'Oréal Paris Elvital", "productName": "L'Oréal Paris Elvital Hydra Hyaluronic 72H Feuchtigkeit-Auffüllendes Shampoo"},
    "counter": {
        "cleansingStrength": "None material.",
        "conditioningLevel": "Only humectant element is a trace Sodium Hyaluronate.",
        "weightPotential": "Early Dimethicone @6 plus a second silicone keep high a realistic neighbor.",
        "dandruffSupport": "None (Salicylic Acid alone does not count)."},
    "claimEvidence": [
        "Product name 'Hydra Hyaluronic 72H Feuchtigkeit-Auffüllendes Shampoo' (high): moisture direction.",
        "manufacturer_de (moderate): 'für feuchtigkeitsbedürftiges Haar', 'versorgt sowohl die Kopfhaut, als auch die Längen für 72 Stunden mit der nötigen Feuchtigkeit' (not an E2 scalp-state claim), 'ganz ohne zu Beschweren' (never lowers weight).",
        "Directions: 'sanft in die Kopfhaut einmassieren' - ordinary; no frequency/reset wording.",
        "ID-3: 'Hyaluronsäure' -> Sodium Hyaluronate @13. No conflict. Pack size 1000 ml in the formula packet noted (identity high per packet)."],
    "focusPrimary": fp_("general", "moderate", "moisture", "nonspecific", ["Sodium Hyaluronate @13"], [],
                        ["Dimethicone @6", "Guar Hydroxypropyltrimonium Chloride @8", "Amodimethicone @23"],
                        "Single trace humectant is not a humectant cluster; conditioning is generic silicone/guar", "candidate",
                        "Strong moisture positioning in the name; rich conditioning supports manageability.",
                        "Primary: claim direction moisture (name, high); formula verdict nonspecific - the only humectant is Sodium Hyaluronate @13 (one token, after the preservative), conditioning is generic silicone/guar shared by any direction -> F1 keeps general; decision general.",
                        "General: moisture claim over a nonspecific verdict (F1).", ["7.2", "7.3", "F1"]),
    "focusSecondary": fs_([], "moderate", ["moisture"], "Empty default; shine/volume wording is an outcome of the same silicone route (F2).", "Empty."),
    "usageRole": REG_DEFAULT,
    "scalpComfortTarget": NOT_T("'versorgt ... die Kopfhaut ... mit Feuchtigkeit' does not name a dry, sensitive or itchy scalp state (E2); no SC1 unit."),
    "primary": tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present."),
    "secondary": None, "D1": NOD1,
    "uncertainties": ["Care-direction verdict: blind label 'not_applicable' (no candidate job known) is restated as 'nonspecific' now that a moisture candidate exists; the formula reading is unchanged (one trace humectant). A reader who treats NaHy + rich conditioning as moisture_supported would choose moisture."],
    "reconciliation": [
        "careDirection verdict label not_applicable -> nonspecific (same formula reading, now that a moisture candidate exists).",
        "focusPrimary general confirmed; low -> moderate.",
        "usageRole regular, scalpComfortTarget not_targeted confirmed (low -> high).",
        "Formula properties unchanged; W1 applies to weight."],
}
