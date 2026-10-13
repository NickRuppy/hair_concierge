"""Lane-b phase-2 reconciliation data (post-unblind). Run: python3 -I final_data.py"""
import json, sys
sys.path.insert(0, "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v162/plans/shampoo-v162/test/kit/lane-b/out/_work")
from build_final import build

D1_NONE = "D1 false: no 'Tiefenrein', 'Deep Clean', 'Clarifying Shampoo' or 'Detox-Reinigung' stem in the name or manufacturer/pack claims, and no occasional-use direction."
SELF = ("Fingerprint matches the frozen packet (asserted by the builder); formula-pass judged with claims hidden and is hash-pinned, not edited; "
        "no ingredient, family count or position window assigned a band (the W-line gated only payload_lipid legs); W-line derived exactly per W-LINE with skipped candidates recorded; "
        "depositionLoad, persistence and resetCapacity present with rationales; counterevidence and whyNotNeighborBand specific (W2 where it applies); "
        "confidence names its limiting uncertainty; neighbors follow N-ALT; projection fields derived mechanically (T1/T6/T4, W-LIVE, I1/I3, 13.7, 13.8); no catalog or live value used.")


def ident(brand, name, pack, fpr, norm, e3, comp="complete (tier 2, stage-A packet)"):
    return {"brand": brand, "productName": name, "packSize": pack, "market": "DE", "formulaFingerprintSha256": fpr,
            "normalization": norm, "completeness": comp, "e3ProminenceCutoff": e3}


def trace_usage(code, ev, rationale):
    return f"Default regular considered; trigger code {code}; evidence: {ev}; {rationale}"


DATA = {}

# ---------------------------------------------------------------- VS01
DATA["VS01"] = {
    "fingerprint": "ad4168be859a6e0b1b7a76ae82e1e72040e87afa86dcf97031a6745545d783f4",
    "identity": ident("Balea", "Balea Ultra Sensitive", "250 ml", "ad4168be859a6e0b1b7a76ae82e1e72040e87afa86dcf97031a6745545d783f4",
                      "No split entries; normalized positions = packet positions 1-18.", "No Parfum; E3 fallback Sodium Benzoate@15; prominent 1-14."),
    "grading": ["manufacturer_de (dm own brand), grade moderate (CL-SRC/E1): every claim and the directions graded moderate; product name 'Balea Ultra Sensitive' graded high but names no scalp (F7 non-scalp name word)."],
    "reconciliation": [
        "focusPrimary general -> scalp_active: revealed SC1 unit 'Mildes Shampoo für empfindliche Kopfhaut' (moderate) plus CSA met -> targeted; F7 step 2 (name 'Ultra Sensitive' names no role) puts scalp_active first.",
        "focusSecondary [] -> [moisture]: distinct lengths claim 'spendet Feuchtigkeit und pflegt das Haar geschmeidig glänzend' / 'mit 5 % Glycerin' (moderate) with an independent moisture route Glycerin@3 (+ guar@12, refatters) not cited by the primary comfort route (Panthenol@7, Niacinamide@8), F3.",
        "usageRole regular -> frequent: 'ideal für die tägliche Haarwäsche' (moderate, U2) and cleansingStrength moderate (not strong).",
        "scalpComfortTarget not_targeted -> targeted: SC1 positioning revealed; CSA via listed prominent routes was already met blind.",
        "Claim-to-INCI check: Glycerin@3, Panthenol@7, Niacinamid=Niacinamide@8 all present; 'ohne Silikone, Parfüm, Parabene' consistent with the INCI. No conflict.",
        "Formula-only properties (cleansing, conditioning, weight, dandruff) unchanged."],
    "props": {
        "focusPrimary": {"value": "scalp_active", "confidence": "moderate", "neighboringAlternative": "moisture",
            "careDirection": {"verdict": "not_applicable", "moistureRoutes": ["Glycerin@3", "Panthenol@7"], "repairRoutes": [],
                "sharedConditioningRoutes": ["Hydroxypropyl Guar Hydroxypropyltrimonium Chloride@12", "Glyceryl Oleate@11", "Hydrogenated Palm Glycerides Citrate@13", "Lecithin@14"],
                "limitation": "Primary is a scalp role; the lengths verdict moisture_supported (blind) applies to the secondary."},
            "claimRole": "candidate",
            "counterSignal": "A moisture/lengths claim competes (F7); headline is mildness-led; a prominent alkyl sulfate (Sodium Coco-Sulfate@4) sits in the chassis.",
            "decisionTrace": "Claim direction: sensitive scalp ('Mildes Shampoo für empfindliche Kopfhaut', moderate) plus moisture for hair. Formula compatible: scalpComfortTarget targeted (CSA via Panthenol@7, Niacinamide@8). Route: comfort routes Panthenol@7, Niacinamide@8. Decision: F7 step 1 inconclusive (name word 'Ultra Sensitive' names no scalp/role), step 2 -> scalp_active primary.",
            "rationale": "scalp_active: explicit sensitive-scalp positioning with targeted (7.2 row SC1), chosen over moisture by F7 step 2.",
            "ruleIds": ["7.2", "F7", "SC1", "CSA", "CL-SRC"], "blindToFinal": "general -> scalp_active (claims revealed)"},
        "focusSecondary": {"value": ["moisture"], "confidence": "moderate", "neighboringAlternative": [],
            "decisionTrace": "Empty default considered. Selected moisture: distinct claim 'spendet Feuchtigkeit und pflegt das Haar geschmeidig glänzend' / '5 % Glycerin' (moderate); independent route Glycerin@3 with guar@12 and weak refatters (moisture_supported), not cited by the primary route (Panthenol@7, Niacinamide@8); distinct from a scalp role. Shine ('glänzend') rejected: same route, no independent smoothing route (F2, F3). One value, no exception code.",
            "rationale": "Secondary moisture passes Section 8 (distinct positioning, independent route, not a synonym).",
            "counterSignal": "The moisture wording sits inside the mild-care paragraph and may be read as an outcome of the same mild formula; [] is the neighbor.",
            "ruleIds": ["Section 8", "F2", "F3", "F1"], "blindToFinal": "[] -> [moisture]"},
        "usageRole": {"value": "frequent", "confidence": "high", "neighboringAlternative": "none", "triggerCode": "explicit_frequent_non_strong",
            "triggerEvidence": ["manufacturer_de (moderate): 'Das Shampoo ist zudem ideal für die tägliche Haarwäsche bei sensibler Haut.'"],
            "losingTriggers": [],
            "rationale": trace_usage("explicit_frequent_non_strong", "'tägliche Haarwäsche' (U2)", "cleansingStrength moderate, not strong; no D1, no dandruff active, no strong cleansing."),
            "counterSignal": "None material; the neighbor cleansing value (low) is also non-strong.",
            "ruleIds": ["Section 9", "U1", "U2", "CL-SRC"], "blindToFinal": "regular -> frequent"},
        "scalpComfortTarget": {"value": "targeted", "confidence": "high", "neighboringAlternative": "none",
            "csaRoute": "Listed prominent routes: comfort Panthenol@7, Niacinamide@8; humectant/refatting Glycerin@3, Glyceryl Oleate@11. MB not used (excluded by Sodium Coco-Sulfate@4).",
            "rationale": "targeted: SC1 unit 'Mildes Shampoo für empfindliche Kopfhaut' and 'sanfte Reinigung für Haar und empfindliche Kopfhaut' (manufacturer, moderate) plus CSA via listed prominent comfort routes. No prominent cooling agent or essential oil; fragrance-free (supportive). 'ohne die Kopfhaut zu reizen' is protective wording only (E2a).",
            "counterSignal": "A prominent alkyl sulfate (Sodium Coco-Sulfate@4) in the chassis; cleansingStrength is moderate, not strong, so no CSA counter-signal fires.",
            "ruleIds": ["Section 10", "CSA", "SC1", "E2a", "E4"], "blindToFinal": "not_targeted -> targeted"},
    },
    "counter": {
        "cleansingStrength": "Coco-Glucoside@2 listed before the sulfate argues for low (recorded neighbor).",
        "conditioningLevel": "Guar listed after the sub-1% actives; only weak refatters otherwise (neighbor low).",
        "weightPotential": "Two deposition families (guar plus weak refatters) - W2 boundary (neighbor moderate).",
        "dandruffSupport": "None.",
    },
    "targets": ["sensitive"],
    "primary": {"target": "sensitive", "confidence": "moderate",
        "rationale": "S-SENSITIVE passes: E2 sensitive unit 'für empfindliche Kopfhaut' (manufacturer, moderate); formula targeted and prominent comfort routes Panthenol@7, Niacinamide@8. cleansingStrength moderate -> no review_strong_cleansing_comfort_route. No dry, oily or dandruff claim. Confidence = min(E1 moderate, scalpComfortTarget high) = moderate (13.8)."},
    "secondary": None,
    "d1": D1_NONE,
    "notes": [],
    "selfCheck": SELF,
    "uncertainties": [
        "Secondary moisture vs []: the moisture claim could be read as part of the mild-care benefit; chose [moisture] because Glycerin@3 is an independent early route and the claim is explicit. Alternative [].",
        "Manufacturer copy calls it 'Balea med Shampoo Ultra Sensitive' while the frozen name is 'Balea Ultra Sensitive'; treated as the same product (formula and pack size match the packet). No property effect.",
        "Intensity regular vs bucket irritationen expected gentle -> amber rows (truthful, I2); the cleansing neighbor (low) would match gentle, but I3 raises no flag when the current value already differs."],
}

# ---------------------------------------------------------------- VS02
DATA["VS02"] = {
    "fingerprint": "b4166c95f70e93e461f681c730d02fac48aab6f16769696b7512f6c5fdd19eae",
    "identity": ident("Balea Med", "Balea Med Anti Schuppen", "250 ml", "b4166c95f70e93e461f681c730d02fac48aab6f16769696b7512f6c5fdd19eae",
                      "No split entries; upper-case names read case-insensitively; normalized positions = packet positions 1-17.", "No Parfum; E3 fallback Sodium Benzoate@17; prominent 1-16.",
                      "complete (tier 2); stage-A identityConfidence moderate"),
    "grading": ["Product name 'Balea Med Anti Schuppen': high (dandruff named).", "dm page for the dm own brand, packet sourceKind manufacturer_de, grade moderate: all other claims and the directions moderate."],
    "reconciliation": [
        "focusPrimary general -> scalp_active: dandruff claim in the name (high) plus dandruffSupport supported (7.2 problem-led row).",
        "usageRole regular -> treatment: dandruffSupport supported and a qualifying E2 dandruff claim graded high (U3); frequent ('für jeden Tag') loses (U1).",
        "scalpComfortTarget stays not_targeted (confidence low -> moderate): all sensitive/dry/comfort wording sits in or next to dandruff units of the same source (consecutive list entries / same paragraph) and is bundled (E2b, P0), so it is not SC1 positioning.",
        "Claim-to-INCI check: no ingredient named in claims; 'ohne Parfum/Silikone' consistent with the INCI.",
        "Formula-only properties unchanged."],
    "props": {
        "focusPrimary": {"value": "scalp_active", "confidence": "high", "neighboringAlternative": "none",
            "careDirection": {"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedConditioningRoutes": ["Guar Hydroxypropyltrimonium Chloride@8"],
                "limitation": "Scalp role; lengths verdict (blind moisture_supported) not used."},
            "claimRole": "candidate",
            "counterSignal": "Generic care/shine wording ('geschmeidig-glänzendes Haar', listing attribute 'Wirkung: Pflege, Feuchtigkeit, Glanz') points to lengths care but has no distinct claim unit strong enough to compete.",
            "decisionTrace": "Claim direction: dandruff ('Anti Schuppen' in the name, high; 'Shampoo gegen Schuppen', moderate). Formula compatible: Piroctone Olamine@10 (dandruffSupport supported). Route: Piroctone Olamine@10. Decision: problem-led anti-dandruff product -> scalp_active (7.2; F7 step 1, the name names the scalp role).",
            "rationale": "scalp_active: anti-dandruff positioning with a recognized active.",
            "ruleIds": ["7.2", "F7", "S-DANDRUFF"], "blindToFinal": "general -> scalp_active"},
        "focusSecondary": {"value": [], "confidence": "moderate", "neighboringAlternative": ["moisture"],
            "decisionTrace": "Empty default considered and kept. Moisture/shine: only generic outcome wording and a listing attribute ('Wirkung: ...'), no distinct exact-product lengths claim unit; shine has no independent route (F2/F3).",
            "rationale": "No secondary passes Section 8.", "counterSignal": "'Feuchtigkeit' appears as a listing attribute; Panthenol@5/Glycerin@9 would be a route if a real claim existed.",
            "ruleIds": ["Section 8", "F2", "F3"], "blindToFinal": "unchanged []"},
        "usageRole": {"value": "treatment", "confidence": "high", "neighboringAlternative": "none", "triggerCode": "recognized_active_problem_led",
            "triggerEvidence": ["Name 'Balea Med Anti Schuppen' (high)", "'Shampoo gegen Schuppen' (moderate)", "Piroctone Olamine@10"],
            "losingTriggers": ["explicit_frequent_non_strong ('eine sanfte Pflege für jeden Tag', moderate) loses to treatment (U1)"],
            "rationale": trace_usage("recognized_active_problem_led", "dandruff claim + Piroctone Olamine@10", "U1 precedence treatment over frequent."),
            "counterSignal": "Everyday-use wording ('für jeden Tag').", "ruleIds": ["Section 9", "U1", "U3"], "blindToFinal": "regular -> treatment"},
        "scalpComfortTarget": {"value": "not_targeted", "confidence": "moderate", "neighboringAlternative": "targeted",
            "csaRoute": "CSA met (listed prominent routes Panthenol@5, Bisabolol@6, Niacinamide@7; Glycerin@9, Glyceryl Oleate@13); MB excluded by Sodium Laureth Sulfate@2. Positioning half missing.",
            "rationale": "not_targeted: every sensitive/dry/comfort unit ('Für empfindliche & trockene Kopfhaut', 'Kann Juckreiz mildern & die Kopfhaut beruhigen', the 'speziell für ... empfindlicher und trockener Kopfhaut' and 'beruhigt die Kopfhaut' sentences) stands next to a dandruff unit of the same source (consecutive list entries; same paragraph as 'befreit ... von Schuppen'), so it is bundled (E2b; unclear -> bundled, P0) and is not SC1 positioning.",
            "counterSignal": "'Für empfindliche & trockene Kopfhaut' is its own bullet; read as a separate unit it would be SC1 positioning and give targeted (neighbor).",
            "ruleIds": ["Section 10", "SC1", "E2a", "E2b", "CSA"], "blindToFinal": "not_targeted (low) -> not_targeted (moderate)"},
    },
    "counter": {"cleansingStrength": "None material (settled C1 core).", "conditioningLevel": "Guar is the only substantive route (neighbor low).",
                "weightPotential": "Prominent guar@8 plus weak refatters - W2 boundary (neighbor moderate).", "dandruffSupport": "None."},
    "targets": ["dandruff"],
    "primary": {"target": "dandruff", "confidence": "high",
        "rationale": "S-DANDRUFF passes: E2 dandruff claim in the product name (high) and dandruffSupport supported (Piroctone Olamine@10). Dandruff path (R17.1): primary dandruff, no secondary target (R17.2). Confidence = min(E1 high, dandruffSupport high) = high."},
    "secondary": None,
    "rct": ["sensitive"], "rctConf": "moderate",
    "d1": D1_NONE,
    "notes": ["suits_dandruff_with_irritated_scalp: bundled comfort wording 'Kann Juckreiz mildern & die Kopfhaut beruhigen', 'Für empfindliche & trockene Kopfhaut' (moderate) and a passed S-SENSITIVE formula gate (CSA met; prominent comfort routes Panthenol@5, Bisabolol@6, Niacinamide@7)"],
    "selfCheck": SELF,
    "uncertainties": [
        "Bundled vs separate for 'Für empfindliche & trockene Kopfhaut': read as bundled (consecutive with 'Shampoo gegen Schuppen' in the plain list; P0). If separate: scalpComfortTarget targeted, and the dry part would feed a dry combination value (S-DRY gate: CSA + prominent Glycerin@9/Panthenol@5 passes) -> sensitive and dry both recorded; still nothing projected (R17.2).",
        "Dryness wording is bundled and absorbed (E2b layer 1), so no 'dry' combination value and no dry note.",
        "Stage-A identityConfidence moderate; the reveal shows a dm page for the own brand (packet grades it manufacturer moderate). No conflict with the formula; no property moved."],
}

# ---------------------------------------------------------------- VS03
DATA["VS03"] = {
    "fingerprint": "5f982bf87555a931d4def50368197813a82e944030a1c2e9d63dff77fa1d141e",
    "identity": ident("Salthouse", "Salthouse Anti Juckreiz (Totes Meer Therapie Anti-Juckreiz Shampoo)", "250 ml", "5f982bf87555a931d4def50368197813a82e944030a1c2e9d63dff77fa1d141e",
                      "No split entries; 'Maris Sal (Dead Sea Salt)' one entry; normalized positions = packet positions 1-16.", "No Parfum; E3 fallback Sodium Benzoate@8; prominent 1-7."),
    "grading": ["manufacturer_de: moderate (claims and directions).", "Rossmann and dm retailer copy: low (corroboration only).",
                "Product name 'Anti Juckreiz': names itch but not the scalp; not relied on as a high-graded scalp claim (E1/E2); the qualifying units are the manufacturer's (moderate)."],
    "reconciliation": [
        "focusPrimary general -> scalp_active: manufacturer sensitive/itch units ('beruhigend bei juckender und empfindlicher Kopfhaut') plus targeted.",
        "usageRole regular -> frequent: 'Für die tägliche Haarwäsche geeignet' (manufacturer, moderate; U2); cleansing not strong.",
        "scalpComfortTarget not_targeted -> targeted: SC1 positioning revealed; CSA via Laureth-9@3 (Polidocanol, v1.6.2 L3) and Urea@6 already met blind.",
        "Claim-to-INCI: 'Polidocanol' -> Laureth-9@3 (E4 L3); 'Totes Meer Mineralien' -> Maris Sal@10; 'Urea und Panthenol' -> Urea@6, Panthenol@14; 'Menthol-Komplex'/'Minzöl' -> Menthol@12, Mentha Arvensis Leaf Oil@16. No conflict.",
        "Formula-only properties unchanged."],
    "props": {
        "focusPrimary": {"value": "scalp_active", "confidence": "high", "neighboringAlternative": "none",
            "careDirection": {"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedConditioningRoutes": ["Hydroxypropyl Guar Hydroxypropyltrimonium Chloride@7"],
                "limitation": "Scalp role; hydration claims are about the scalp, not the lengths."},
            "claimRole": "candidate",
            "counterSignal": "Menthol cooling (not prominent) and medically adjacent wording (Neurodermitis, Psoriasis) are outside scope; no lengths claim competes.",
            "decisionTrace": "Claim direction: itchy/sensitive/dry scalp (manufacturer, moderate). Formula compatible: targeted (CSA via Laureth-9@3, Urea@6). Route: Laureth-9@3, Urea@6. Decision: 7.2 sensitive/itchy/dry-feeling scalp with targeted -> scalp_active.",
            "rationale": "scalp_active: explicit itch/sensitive-scalp product with comfort routes.", "ruleIds": ["7.2", "SC1", "CSA"], "blindToFinal": "general -> scalp_active"},
        "focusSecondary": {"value": [], "confidence": "high", "neighboringAlternative": "none",
            "decisionTrace": "Empty default considered and kept: no lengths-care claim from a moderate/high source (retailer 'Wirkung: Pflege, Feuchtigkeit' is low and a listing attribute).",
            "rationale": "No secondary candidate.", "counterSignal": "None.", "ruleIds": ["Section 8", "CL-SRC"], "blindToFinal": "unchanged []"},
        "usageRole": {"value": "frequent", "confidence": "high", "neighboringAlternative": "none", "triggerCode": "explicit_frequent_non_strong",
            "triggerEvidence": ["manufacturer_de (moderate): 'Für die tägliche Haarwäsche geeignet.'"], "losingTriggers": [],
            "rationale": trace_usage("explicit_frequent_non_strong", "'tägliche Haarwäsche' (U2)", "cleansingStrength moderate (high confidence)."),
            "counterSignal": "None.", "ruleIds": ["Section 9", "U2"], "blindToFinal": "regular -> frequent"},
        "scalpComfortTarget": {"value": "targeted", "confidence": "high", "neighboringAlternative": "none",
            "csaRoute": "Listed prominent routes: comfort Laureth-9@3 (= Polidocanol, v1.6.2 L3), Urea@6; humectant Urea@6. MB not used (excluded by Sodium Laureth Sulfate@2).",
            "rationale": "targeted: SC1 units 'Anti-Juckreiz Shampoo – beruhigend bei juckender und empfindlicher Kopfhaut' and 'speziell für die Bedürfnisse von juckender, trockener und empfindlicher Kopfhaut entwickelt' (manufacturer, moderate) plus CSA via prominent listed comfort routes. Cooling agents Menthol@12 and Mentha Arvensis Leaf Oil@16 are not prominent, so they do not cap confidence (CSA). 'pH-hautneutral', 'Hautverträglichkeit' are protective only.",
            "counterSignal": "Menthol/mint cooling present (not prominent).", "ruleIds": ["Section 10", "CSA", "SC1", "E4"], "blindToFinal": "not_targeted -> targeted"},
    },
    "counter": {"cleansingStrength": "Single prominent buffer (CAPB@5) listed after NaCl@4; Laureth-9 in no C3 class (does not change the value).",
                "conditioningLevel": "Guar is the only substantive route (neighbor low).", "weightPotential": "None material; single light family.", "dandruffSupport": "None."},
    "targets": ["sensitive", "dry"],
    "primary": {"target": "sensitive", "confidence": "moderate",
        "rationale": "S-SENSITIVE passes: E2 sensitive units (manufacturer, moderate) and formula targeted + prominent comfort routes Laureth-9@3, Urea@6. S-PRIMARY: the name word 'Anti Juckreiz' is read as naming no scalp, so the order sensitive, dry decides -> sensitive (same result if the name counted). cleansing moderate -> no strong-cleansing flag. Confidence = min(E1 moderate, targeted high) = moderate."},
    "secondary": {"target": "dry", "confidence": "moderate",
        "rationale": "S-DRY passes: E2 dry unit 'für die Bedürfnisse von juckender, trockener und empfindlicher Kopfhaut' (manufacturer, moderate; a unit naming two non-dandruff states counts for both, E2a) and formula targeted + prominent humectant route Urea@6. S-SECONDARY: one secondary, not oily+dry, no dandruff path. Confidence moderate."},
    "d1": D1_NONE,
    "notes": [],
    "selfCheck": SELF,
    "uncertainties": [
        "'Schuppenflechte' (psoriasis) in 'Hautproblem: ... Schuppenflechte' and 'Basispflege für ... Psoriasis (Schuppenflechte)': read as a diagnosed skin disease (out of scope), not as an E2 dandruff claim ('Schuppen' as the product's problem). Alternative: a dandruff unit; S-DANDRUFF would still fail (dandruffSupport not_supported) and those units are not adjacent to the sensitive/dry units, so the projection would not change.",
        "Name word 'Anti Juckreiz': 'Juckreiz' is a sensitive lexicon term but the name does not name the scalp; graded via the manufacturer units (moderate) instead of high. Alternative: high positioning confidence; no row change.",
        "Medically adjacent wording (Neurodermitis, Psoriasis, 'Lokalanästhetikum') is outside scope and not used; no user copy implied (Section 16).",
        "Intensity regular vs expected gentle for irritationen and trocken -> amber rows (I2); no I3 flag (cleansing high confidence)."],
}

# ---------------------------------------------------------------- VS04
DATA["VS04"] = {
    "fingerprint": "2c79251eb5b8c7ff1b1f626154c752255ac0d7d43384f1ee90d444652876c9bf",
    "identity": ident("Guhl", "Guhl Anti Schuppen", "250 ml", "2c79251eb5b8c7ff1b1f626154c752255ac0d7d43384f1ee90d444652876c9bf",
                      "No split entries; normalized positions = packet positions 1-21.", "Parfum@19; prominent 1-18."),
    "grading": ["Product name 'Guhl Anti Schuppen': high (dandruff).", "manufacturer_de: moderate. No directions captured."],
    "reconciliation": [
        "focusPrimary general -> scalp_active: dandruff claim (name, high) plus Piroctone Olamine@6.",
        "usageRole regular -> treatment (U3).",
        "scalpComfortTarget stays not_targeted (low -> high): all itch/tension wording is inside or in the same paragraph as dandruff units (E2a/E2b) and is not SC1.",
        "Claim-to-INCI: 'blaue Malve' -> Malva Sylvestris Flower Extract@16; 'Zink PCA' -> Zinc PCA@11 (present; not a recognized active, Section 11); 'Duft' -> Parfum@19. No conflict; the claim crediting Zinc PCA does not change dandruffSupport (supported via Piroctone Olamine@6).",
        "Formula-only properties unchanged."],
    "props": {
        "focusPrimary": {"value": "scalp_active", "confidence": "high", "neighboringAlternative": "none",
            "careDirection": {"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedConditioningRoutes": ["Hydroxypropyl Guar Hydroxypropyltrimonium Chloride@9"], "limitation": "Scalp role."},
            "claimRole": "candidate", "counterSignal": "Foam/fragrance wording only; no lengths-care claim.",
            "decisionTrace": "Claim direction: dandruff ('Anti Schuppen' name, high). Formula compatible: Piroctone Olamine@6. Route: Piroctone Olamine@6. Decision: 7.2 problem-led anti-dandruff -> scalp_active.",
            "rationale": "scalp_active: anti-dandruff product with a recognized active.", "ruleIds": ["7.2", "S-DANDRUFF"], "blindToFinal": "general -> scalp_active"},
        "focusSecondary": {"value": [], "confidence": "high", "neighboringAlternative": "none",
            "decisionTrace": "Empty default considered and kept: no lengths-care claim.", "rationale": "No secondary candidate.", "counterSignal": "None.",
            "ruleIds": ["Section 8"], "blindToFinal": "unchanged []"},
        "usageRole": {"value": "treatment", "confidence": "high", "neighboringAlternative": "none", "triggerCode": "recognized_active_problem_led",
            "triggerEvidence": ["Name 'Guhl Anti Schuppen' (high)", "'Bei Schuppen und juckender Kopfhaut' (moderate)", "Piroctone Olamine@6"], "losingTriggers": [],
            "rationale": trace_usage("recognized_active_problem_led", "dandruff claim + Piroctone Olamine@6", "'bei regelmäßiger Anwendung' is not U2 frequency wording."),
            "counterSignal": "None.", "ruleIds": ["Section 9", "U3"], "blindToFinal": "regular -> treatment"},
        "scalpComfortTarget": {"value": "not_targeted", "confidence": "high", "neighboringAlternative": "none",
            "csaRoute": "CSA met (listed prominent Panthenol@12, Glyceryl Oleate@7, Glycerin@14); MB excluded by Sodium Laureth Sulfate@2. Positioning half missing.",
            "rationale": "not_targeted: the only comfort wording ('Bei Schuppen und juckender Kopfhaut'; 'von Schuppen und einer juckenden, spannenden Kopfhaut'; 'Deine juckende Kopfhaut wird beruhigt und das Spannungsgefühl reduziert') is inside a dandruff unit or in the same paragraph (E2a, E2b), so it is a dandruff symptom, not SC1. 'sanft zur Kopfhaut' is sparing wording (E2a). No separate sensitive/dry unit.",
            "counterSignal": "None.", "ruleIds": ["Section 10", "SC1", "E2a", "E2b"], "blindToFinal": "not_targeted (low) -> not_targeted (high)"},
    },
    "counter": {"cleansingStrength": "None material (settled C1 core).", "conditioningLevel": "Guar is the only substantive route (neighbor low).",
                "weightPotential": "Guar plus a weak refatter - W2 boundary (neighbor moderate).", "dandruffSupport": "None."},
    "targets": ["dandruff"],
    "primary": {"target": "dandruff", "confidence": "high",
        "rationale": "S-DANDRUFF passes: dandruff in the name (high), dandruffSupport supported (Piroctone Olamine@6). Primary dandruff, no secondary (R17.1, R17.2). Confidence high."},
    "secondary": None,
    "rct": ["sensitive"], "rctConf": "moderate",
    "d1": D1_NONE,
    "notes": ["suits_dandruff_with_irritated_scalp: bundled comfort wording 'Deine juckende Kopfhaut wird beruhigt und das Spannungsgefühl reduziert' / 'juckenden, spannenden Kopfhaut' (moderate) and a passed S-SENSITIVE formula gate (CSA met; prominent comfort route Panthenol@12)"],
    "selfCheck": SELF,
    "uncertainties": ["Tension wording ('spannenden Kopfhaut', 'Spannungsgefühl') read as comfort wording feeding the sensitive combination (13.3 E2b note), not as dryness; no dry value."],
}

# ---------------------------------------------------------------- VS05
DATA["VS05"] = {
    "fingerprint": "303653d5f86a174377761e891fefde597d7e15dc484437056bd83783230aa48f",
    "identity": ident("Sebamed", "Sebamed Every-Day Shampoo", "200 ml", "303653d5f86a174377761e891fefde597d7e15dc484437056bd83783230aa48f",
                      "No split entries; normalized positions = packet positions 1-14.", "Parfum@7; prominent 1-6."),
    "grading": ["Product name 'Every-Day': high (frequency wording, no scalp).", "manufacturer_de: moderate (claims and directions).", "dm retailer copy: low (corroboration only)."],
    "reconciliation": [
        "focusPrimary general -> scalp_active: SC1 unit 'Schonende, seifenfreie Reinigung für empfindliche Kopfhaut' (moderate) plus targeted via MB.",
        "usageRole regular -> frequent: name 'Every-Day' (high) and 'für die tägliche Haarwäsche' / 'Für die tägliche Anwendung geeignet' (moderate); cleansing low.",
        "scalpComfortTarget not_targeted -> targeted: SC1 positioning revealed; CSA met only via MB (v1.6.2, ruling R18): mild_base:Decyl Glucoside@2, Disodium Laureth Sulfosuccinate@3, Sodium Lauryl Sulfoacetate@4.",
        "Claim-to-INCI: 'Zuckertensid' -> Decyl Glucoside@2; 'pH-Wert 5,5' -> Citric/Lactic Acid, Sodium Lactate (no INCI effect). No conflict.",
        "Formula-only properties unchanged."],
    "props": {
        "focusPrimary": {"value": "scalp_active", "confidence": "moderate", "neighboringAlternative": "general",
            "careDirection": {"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedConditioningRoutes": ["Hydroxypropyl Oxidized Starch PG-Trimonium Chloride@11"], "limitation": "Scalp role; formula lengths care nonspecific."},
            "claimRole": "candidate",
            "counterSignal": "Positioning is mildness-led ('schonende ... Reinigung'); targeted rests on MB alone, without a listed comfort route.",
            "decisionTrace": "Claim direction: sensitive scalp ('für empfindliche Kopfhaut', moderate). Formula compatible: targeted via MB. Route: mild_base Decyl Glucoside@2 / sulfosuccinate@3 / sulfoacetate@4. Decision: 7.2 explicit sensitive-scalp positioning with targeted -> scalp_active; no competing lengths claim from a moderate/high source (retailer 'Fülle und Glanz' is low).",
            "rationale": "scalp_active: explicitly positioned for sensitive scalp with a credible supportive architecture (MB).", "ruleIds": ["7.2", "SC1", "CSA", "MB"], "blindToFinal": "general -> scalp_active"},
        "focusSecondary": {"value": [], "confidence": "high", "neighboringAlternative": "none",
            "decisionTrace": "Empty default considered and kept: the only lengths wording ('mehr Fülle und Glanz', 'geschmeidiges Haargefühl') is retailer-only (low) and has no independent route.",
            "rationale": "No secondary passes Section 8 / CL-SRC.", "counterSignal": "None.", "ruleIds": ["Section 8", "CL-SRC"], "blindToFinal": "unchanged []"},
        "usageRole": {"value": "frequent", "confidence": "high", "neighboringAlternative": "none", "triggerCode": "explicit_frequent_non_strong",
            "triggerEvidence": ["Name 'Sebamed Every-Day Shampoo' (high)", "manufacturer_de (moderate): 'seifenfreies Shampoo für die tägliche Haarwäsche'; 'Für die tägliche Anwendung geeignet.'"], "losingTriggers": [],
            "rationale": trace_usage("explicit_frequent_non_strong", "'Every-Day', 'tägliche Haarwäsche' (U2)", "cleansingStrength low."),
            "counterSignal": "None.", "ruleIds": ["Section 9", "U2"], "blindToFinal": "regular -> frequent"},
        "scalpComfortTarget": {"value": "targeted", "confidence": "moderate", "neighboringAlternative": "not_targeted",
            "csaRoute": "MB (v1.6.2): mild_base:Decyl Glucoside@2, Disodium Laureth Sulfosuccinate@3, Sodium Lauryl Sulfoacetate@4 (cleansingStrength low, no prominent strong anionic). No listed prominent E4 route.",
            "rationale": "targeted: SC1 unit 'Schonende, seifenfreie Reinigung für empfindliche Kopfhaut' (manufacturer, moderate) states the product is for sensitive scalp ('für ...', E2a) and CSA is met via MB. Brand-level barrier text ('Die sebamed ... Produkte ...') is range-level (E1) and not used; 'schützt Kopfhaut und Haar vor dem Austrocknen' is protective (no dry positioning). No counter-signal (not strong, no cooling, no essential oil).",
            "counterSignal": "The unit is mildness-framed ('schonende'); read as sparing wording it would not be SC1 (neighbor not_targeted). MB alone has no independent soothing evidence (evidence boundary).",
            "ruleIds": ["Section 10", "CSA", "MB", "SC1", "E2a", "E1"], "blindToFinal": "not_targeted -> targeted"},
    },
    "counter": {"cleansingStrength": "Two mild anionics (sulfosuccinate, sulfoacetate) alongside the glucoside; still C6 low.", "conditioningLevel": "Cationic starch could add some slip (neighbor moderate).",
                "weightPotential": "None material; single late light route.", "dandruffSupport": "None."},
    "targets": ["sensitive"],
    "primary": {"target": "sensitive", "confidence": "moderate",
        "rationale": "S-SENSITIVE passes via MB (v1.6.2): E2 sensitive unit (manufacturer, moderate); formula targeted and (no prominent comfort route, but MB). cleansing low -> no strong-cleansing flag. No dry claim (protective wording only), so S-DRY never arises (MB would not pass it). Confidence = min(E1 moderate, scalpComfortTarget moderate) = moderate."},
    "secondary": None,
    "d1": D1_NONE,
    "notes": [],
    "selfCheck": SELF,
    "uncertainties": [
        "Whether 'Schonende, seifenfreie Reinigung für empfindliche Kopfhaut' is positioning ('für ...') or sparing wording ('schonend zur Kopfhaut'): read as positioning, so targeted at moderate confidence. Alternative: not SC1 -> not_targeted, focus general, ordinary target (way 1), no review flag.",
        "This is the MB route test case: without MB (v1.6.1 reading) CSA would fail and S-FAIL would send it to review."],
}

# ---------------------------------------------------------------- VS06
FAIL06 = "review_specialist_gate_failed:sensitive (S-SENSITIVE formula gate: scalpComfortTarget not_targeted because CSA failed - no prominent E4 route (Panthenol@12, Niacinamide@13, Glycerin@18, Glyceryl Oleate@7 all after Parfum@6) and MB excluded by Sodium Laureth Sulfate@2; no prominent unlisted candidate)"
DATA["VS06"] = {
    "fingerprint": "67f890bcc445fdb931de50ce96290cf6c902dfc338f8ebebd46019bf413d661f",
    "identity": ident("ISANA", "ISANA Shampoo Sensitiv Baumwoll- & Kornblume (Rossmann: 'ISANA Shampoo Sensitiv')", "300 ml", "67f890bcc445fdb931de50ce96290cf6c902dfc338f8ebebd46019bf413d661f",
                      "No split entries; normalized positions = packet positions 1-26.", "Parfum@6; prominent 1-5.", "complete (tier 1)"),
    "grading": ["pack_back: moderate.", "manufacturer_de (Rossmann private label): moderate.", "Rossmann DK prior capture: low (directions only, Danish).", "Name word 'Sensitiv' names no scalp (F7/SC1)."],
    "reconciliation": [
        "Sensitive-scalp claim revealed: 'für empfindliche Kopfhaut & normales Haar' (manufacturer, moderate) is an E2 sensitive unit; 'auch bei empfindlicher Kopfhaut bestens geeignet' is tolerance wording only (E2a).",
        "scalpComfortTarget stays not_targeted (formula half CSA fails), so S-SENSITIVE fails -> S-FAIL: ordinary primary with review_specialist_gate_failed.",
        "focusPrimary stays general (low -> moderate): scalp_active incompatible (not targeted); no lengths-care claim beyond 'reinigt und pflegt besonders sanft' (mildness).",
        "Claim-to-INCI: 'Baumwollblumen-Extrakt' -> Gossypium Herbaceum Flower Extract@26; 'Kornblumen-Extrakt' -> Centaurea Cyanus Flower Extract@24; 'Panthenol' -> Panthenol@12; 'beruhigende Inhaltsstoffe' unnamed. No conflict.",
        "Formula-only properties unchanged."],
    "props": {
        "focusPrimary": {"value": "general", "confidence": "moderate", "neighboringAlternative": "scalp_active",
            "careDirection": {"verdict": "nonspecific", "moistureRoutes": ["Panthenol@12", "Glycerin@18"], "repairRoutes": ["Hydrolyzed Wheat Protein@10"], "sharedConditioningRoutes": ["Glyceryl Oleate@7", "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride@15"], "limitation": "No lengths claim; formula nonspecific."},
            "claimRole": "not_applicable",
            "counterSignal": "Sensitive-scalp positioning exists, but the formula fails CSA, so scalp_active is not formula-compatible (7.2).",
            "decisionTrace": "Claim direction: sensitive scalp (moderate). Formula compatible: no (scalpComfortTarget not_targeted). Next dominant compatible job: none (mildness is not a focus). Decision: general.",
            "rationale": "general: the only specialist claim fails its formula condition; mildness is not a focus.", "ruleIds": ["7.2", "SC1", "CSA"], "blindToFinal": "general (low) -> general (moderate)"},
        "focusSecondary": {"value": [], "confidence": "high", "neighboringAlternative": "none",
            "decisionTrace": "Empty default considered and kept: no distinct secondary claim with an independent route.", "rationale": "No secondary candidate.", "counterSignal": "None.",
            "ruleIds": ["Section 8"], "blindToFinal": "unchanged []"},
        "usageRole": {"value": "regular", "confidence": "high", "neighboringAlternative": "none", "triggerCode": "none", "triggerEvidence": [], "losingTriggers": [],
            "rationale": trace_usage("none", "no U2 frequency wording, no D1, no dandruff active, not strong", "default regular."),
            "counterSignal": "None.", "ruleIds": ["Section 9"], "blindToFinal": "regular (low) -> regular (high)"},
        "scalpComfortTarget": {"value": "not_targeted", "confidence": "high", "neighboringAlternative": "none",
            "csaRoute": "CSA not met: no prominent listed E4 route; MB excluded by Sodium Laureth Sulfate@2.",
            "rationale": "not_targeted: SC1 positioning exists ('für empfindliche Kopfhaut & normales Haar', moderate) but the formula has no credible supportive architecture (no prominent E4 route; no MB). Missing route: any prominent comfort or humectant/refatting route.",
            "counterSignal": "Panthenol and Niacinamide are present but after Parfum@6.", "ruleIds": ["Section 10", "CSA", "MB", "SC1"], "blindToFinal": "unchanged"},
    },
    "counter": {"cleansingStrength": "Only one prominent buffer (CAPB@3).", "conditioningLevel": "All routes after Parfum; care plausibly thin (neighbor low).",
                "weightPotential": "Three light families - W2 boundary (neighbor moderate).", "dandruffSupport": "None."},
    "targets": ["ordinary"],
    "primary": {"target": "ordinary", "confidence": "moderate",
        "rationale": "S-ORDINARY way 4: the claimed sensitive target failed its formula gate (S-FAIL) and nothing else passed; proposal ordinary with review_specialist_gate_failed. Confidence moderate (13.8)."},
    "secondary": None,
    "d1": D1_NONE,
    "flags": [FAIL06],
    "notes": [],
    "selfCheck": SELF,
    "uncertainties": [
        "'für empfindliche Kopfhaut & normales Haar' read as a claim bullet, not a listing attribute. Alternative: no qualifying unit -> ordinary via way 1 (confidence high) and no S-FAIL flag; the review route is the cautious reading (P0)."],
}

# ---------------------------------------------------------------- VS07
FAIL07 = "review_specialist_gate_failed:sensitive,dry (S-SENSITIVE and S-DRY formula gates: scalpComfortTarget not_targeted because CSA failed - no listed E4 route, MB excluded by Sodium Coco-Sulfate@2; unlisted_route_candidate:Aloe Barbadensis Leaf Juice, unlisted_route_candidate:Lactococcus Ferment Lysate, unlisted_route_candidate:Arginine)"
DATA["VS07"] = {
    "fingerprint": "e7bbbca05138a36c9232d3bcfa024431c19776c252a065267ee03808404354e1",
    "identity": ident("Sante (LOGOCOS Naturkosmetik)", "SANTE Sensitive Care Shampoo Probiotika + 3-fach Protein Komplex, 250 ml", "250 ml", "e7bbbca05138a36c9232d3bcfa024431c19776c252a065267ee03808404354e1",
                      "'Aqua (Water)' one entry; markers '*'/'**' stripped and kept as provenance; normalized positions = packet positions 1-25.", "Parfum (Fragrance)@22; prominent 1-21."),
    "grading": ["manufacturer_de (LOGOCOS shop): moderate.", "dm and Rossmann retailer copy: low.", "Name word 'Sensitive' names no scalp."],
    "reconciliation": [
        "Sensitive-scalp claim revealed ('Für sensibles Haar und empfindliche Kopfhaut', moderate) and a dry-scalp unit ('Reduziert Spannungs- & Trockenheitsgefühle und unterstützt den natürlichen pH-Wert der Kopfhaut', moderate).",
        "scalpComfortTarget stays not_targeted (CSA fails), so both S-SENSITIVE and S-DRY fail -> S-FAIL: ordinary primary with review_specialist_gate_failed naming the unlisted candidates.",
        "focusPrimary stays general (low -> moderate): repair-type claims ('3-fach Protein Komplex stärkt ...', 'füllt & baut das Haar auf') meet a nonspecific formula verdict (blind), which claims may not upgrade (3.2); scalp_active incompatible.",
        "Claim-to-INCI: 'Probiotika' -> Lactococcus Ferment Lysate@9 (and Leuconostoc/Radish Root Ferment Filtrate@16); '3-fach Protein Komplex' -> Hydrolyzed Corn@13, Wheat@14, Soy@15 Protein. No conflict. 'ohne zu beschweren' never lowers weight (6.5).",
        "Formula-only properties unchanged."],
    "props": {
        "focusPrimary": {"value": "general", "confidence": "moderate", "neighboringAlternative": "repair",
            "careDirection": {"verdict": "nonspecific", "moistureRoutes": ["Aloe Barbadensis Leaf Juice@6", "Arginine@10"], "repairRoutes": ["Hydrolyzed Corn Protein@13", "Hydrolyzed Wheat Protein@14", "Hydrolyzed Soy Protein@15"], "sharedConditioningRoutes": ["PCA Ethyl Cocoyl Arginate@19"],
                "limitation": "Blind verdict nonspecific: the protein cluster is late and light with no deposition system; claims cannot turn it into repair_supported (3.2)."},
            "claimRole": "not_applicable",
            "counterSignal": "Explicit protein/strengthening claims (moderate) point to repair; sensitive-scalp claim fails CSA.",
            "decisionTrace": "Claim direction: sensitive scalp + protein strengthening (moderate). Formula compatible: scalp_active no (not targeted); repair no (verdict nonspecific). Decision: general (7.2 'unsupported claims', F1).",
            "rationale": "general: neither the scalp role nor the repair claim has a compatible formula case.", "ruleIds": ["7.2", "7.3", "F1", "3.2"], "blindToFinal": "general (low) -> general (moderate)"},
        "focusSecondary": {"value": [], "confidence": "moderate", "neighboringAlternative": ["repair"],
            "decisionTrace": "Empty default considered and kept: repair as secondary needs a meaningful claim and route; the route is nonspecific (Section 8 invalid pattern 'repair for any protein trace').",
            "rationale": "No secondary passes Section 8.", "counterSignal": "Three hydrolyzed proteins plus a protein claim.", "ruleIds": ["Section 8", "F3"], "blindToFinal": "unchanged []"},
        "usageRole": {"value": "regular", "confidence": "high", "neighboringAlternative": "none", "triggerCode": "none", "triggerEvidence": [], "losingTriggers": [],
            "rationale": trace_usage("none", "no frequency wording; conditioner advice is not a trigger", "default regular."),
            "counterSignal": "None.", "ruleIds": ["Section 9"], "blindToFinal": "regular (low) -> regular (high)"},
        "scalpComfortTarget": {"value": "not_targeted", "confidence": "high", "neighboringAlternative": "none",
            "csaRoute": "CSA not met: no listed E4 route anywhere; MB excluded by Sodium Coco-Sulfate@2. Prominent unlisted candidates (rejected by R18): Aloe Barbadensis Leaf Juice@6, Lactococcus Ferment Lysate@9, Arginine@10.",
            "rationale": "not_targeted: SC1 positioning exists (sensitive and dry-feeling scalp units, moderate) but CSA fails; missing route named. 'Wohltuend für die Kopfhaut' is not lexicon wording; 'Verträglichkeit dermatologisch getestet' is protective.",
            "counterSignal": "None beyond the missing route.", "ruleIds": ["Section 10", "CSA", "MB", "E4", "SC1"], "blindToFinal": "unchanged"},
    },
    "counter": {"cleansingStrength": "Four buffers and glucosides right after the sulfate (argue toward low, convention keeps moderate).", "conditioningLevel": "All routes light (neighbor low).",
                "weightPotential": "Protein cluster plus a cationic conditioner - W2 boundary (neighbor moderate).", "dandruffSupport": "None."},
    "targets": ["ordinary"],
    "primary": {"target": "ordinary", "confidence": "moderate",
        "rationale": "S-ORDINARY way 4: sensitive and dry targets claimed (moderate) but both formula gates fail (not targeted, CSA); nothing else passes. Confidence moderate."},
    "secondary": None,
    "d1": D1_NONE,
    "flags": [FAIL07],
    "notes": [],
    "selfCheck": SELF,
    "uncertainties": [
        "Dry unit: 'Reduziert Spannungs- & Trockenheitsgefühle ... der Kopfhaut' read as dry-scalp positioning (E2 'Spannungsgefühl der Kopfhaut'). Alternative: only sensitive claimed; the flag would name sensitive only. Projection unchanged.",
        "PCA Ethyl Cocoyl Arginate family (cationic_conditioner) kept from the blind pass."],
}

# ---------------------------------------------------------------- VS08
FAIL08 = "review_specialist_gate_failed:sensitive (S-SENSITIVE formula gate: scalpComfortTarget not_targeted because CSA failed - Allantoin@11, Bisabolol@12, Glycerin@17 not prominent (after Parfum@7), MB excluded by Sodium Laureth Sulfate@2; unlisted_route_candidate:Lauryl Lactate)"
DATA["VS08"] = {
    "fingerprint": "0a9ce49c3c9a71eeb4cd8e8ebc4dc4b2431235b5e08cbd0e096985e48ddbbda3",
    "identity": ident("ISANA", "ISANA MED Shampoo Totes Meer, 200 ml", "200 ml", "0a9ce49c3c9a71eeb4cd8e8ebc4dc4b2431235b5e08cbd0e096985e48ddbbda3",
                      "No split entries; normalized positions = packet positions 1-19.", "Parfum@7; prominent 1-6.", "complete (tier 1)"),
    "grading": ["pack_back: moderate.", "Rossmann page (packet sourceKind manufacturer_de): moderate.", "Product name 'ISANA MED Shampoo Totes Meer' names no scalp state."],
    "reconciliation": [
        "Sensitive-scalp claims revealed: 'die empfindliche und juckende Kopfhaut beruhigt', 'juckreizlindernder Wirkstoff-Komplex', 'Kopfhaut beruhigend' (moderate). 'Schutz vor Austrocknung für Kopfhaut & Haar' is protective (no dry positioning).",
        "scalpComfortTarget stays not_targeted (CSA fails), so S-SENSITIVE fails -> S-FAIL: ordinary with review_specialist_gate_failed (unlisted_route_candidate:Lauryl Lactate).",
        "focusPrimary stays general (low -> moderate): scalp_active incompatible; no lengths-care or oily claim.",
        "Claim-to-INCI: 'Totes Meer Salz' -> Maris Sal@10; 'juckreizlindernder Wirkstoff-Komplex' unnamed (plausibly Allantoin@11/Bisabolol@12/Menthol@8, none prominent). No conflict.",
        "Formula-only properties unchanged (conditioning high and weight moderate rest on the Lauryl Lactate payload_lipid reading, unchanged by claims)."],
    "props": {
        "focusPrimary": {"value": "general", "confidence": "moderate", "neighboringAlternative": "scalp_active",
            "careDirection": {"verdict": "nonspecific", "moistureRoutes": ["Glycerin@17"], "repairRoutes": [], "sharedConditioningRoutes": ["Lauryl Lactate@4", "Guar Hydroxypropyltrimonium Chloride@5", "Glycol Distearate@6"], "limitation": "No lengths claim."},
            "claimRole": "not_applicable", "counterSignal": "Sensitive/itch positioning (moderate) whose formula condition fails.",
            "decisionTrace": "Claim direction: sensitive/itchy scalp (moderate). Formula compatible: no (not targeted). No other in-scope claim. Decision: general.",
            "rationale": "general: the only specialist claim is not formula-compatible.", "ruleIds": ["7.2", "SC1", "CSA"], "blindToFinal": "general (low) -> general (moderate)"},
        "focusSecondary": {"value": [], "confidence": "high", "neighboringAlternative": "none",
            "decisionTrace": "Empty default considered and kept: no secondary claim.", "rationale": "No secondary candidate.", "counterSignal": "None.", "ruleIds": ["Section 8"], "blindToFinal": "unchanged []"},
        "usageRole": {"value": "regular", "confidence": "high", "neighboringAlternative": "none", "triggerCode": "none", "triggerEvidence": [], "losingTriggers": [],
            "rationale": trace_usage("none", "no directions captured, no frequency wording", "default regular."), "counterSignal": "None.", "ruleIds": ["Section 9"], "blindToFinal": "regular (low) -> regular (high)"},
        "scalpComfortTarget": {"value": "not_targeted", "confidence": "high", "neighboringAlternative": "none",
            "csaRoute": "CSA not met: listed routes Allantoin@11, Bisabolol@12 (comfort), Glycerin@17 (humectant) are not prominent; MB excluded by Sodium Laureth Sulfate@2. Prominent unlisted candidate: Lauryl Lactate@4 (rejected by R18).",
            "rationale": "not_targeted: SC1 positioning exists (moderate) but CSA fails; missing route: a prominent listed comfort or humectant route.", "counterSignal": "Menthol@8 cooling (not prominent).",
            "ruleIds": ["Section 10", "CSA", "MB", "E4", "SC1"], "blindToFinal": "unchanged"},
    },
    "counter": {"cleansingStrength": "Single buffer CAPB@3.", "conditioningLevel": "Lauryl Lactate is a light short-chain ester; Glycerin late (neighbor moderate).",
                "weightPotential": "W-RICH formally holds (material Lauryl Lactate@4 + guar@5) - neighbor high.", "dandruffSupport": "None."},
    "targets": ["ordinary"],
    "primary": {"target": "ordinary", "confidence": "moderate",
        "rationale": "S-ORDINARY way 4: claimed sensitive target failed its formula gate (S-FAIL); nothing else passed. Confidence moderate."},
    "secondary": None,
    "d1": D1_NONE,
    "flags": [FAIL08],
    "notes": [],
    "selfCheck": SELF,
    "uncertainties": [
        "Lauryl Lactate@4 family (payload_lipid vs weak_refatter) carried from the blind pass; it sets conditioning high (C2) and weight moderate with neighbor high, and through them the fine/normal/coarse T4 flags. Under the weak_refatter reading: conditioning moderate, weight low/moderate, coarse acceptable.",
        "'juckreizlindernder Wirkstoff-Komplex' names no ingredient; no claim-to-INCI conflict recorded."],
}

# ---------------------------------------------------------------- VS09
DATA["VS09"] = {
    "fingerprint": "4871d6edeb1c4a74bb8123dc09d22d76a8888bf42f570a16fd8b5f91ac931e73",
    "identity": ident("Balea PROFESSIONAL (dm-Eigenmarke)", "Balea PROFESSIONAL Shampoo Kopfhaut Sensitive", "250 ml", "4871d6edeb1c4a74bb8123dc09d22d76a8888bf42f570a16fd8b5f91ac931e73",
                      "No split entries; normalized positions = packet positions 1-19.", "Parfum@18; prominent 1-17."),
    "grading": ["Product name 'Kopfhaut Sensitive': high (names the scalp; lexicon 'Kopfhaut Sensitive').", "dm own-brand page (packet sourceKind manufacturer_de): moderate.", "Open Beauty Facts: low, empty."],
    "reconciliation": [
        "focusPrimary general -> scalp_active: name 'Kopfhaut Sensitive' (high) plus targeted.",
        "scalpComfortTarget not_targeted -> targeted: SC1 revealed; CSA via listed prominent routes (blind).",
        "Dry-scalp unit revealed: 'speziell für die Bedürfnisse von sensibler und trockener Kopfhaut entwickelt' (moderate) -> S-DRY secondary.",
        "usageRole unchanged regular: no frequency wording.",
        "Claim-to-INCI: 'Panthenol' -> Panthenol@11; 'Weißer-Tee-Extrakt' -> Camellia Sinensis Leaf Extract@13. No conflict.",
        "Formula-only properties unchanged."],
    "props": {
        "focusPrimary": {"value": "scalp_active", "confidence": "high", "neighboringAlternative": "none",
            "careDirection": {"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedConditioningRoutes": ["Guar Hydroxypropyltrimonium Chloride@14"], "limitation": "Scalp role; lengths verdict moisture_supported (blind) not claimed."},
            "claimRole": "candidate", "counterSignal": "Shine wording ('seidigen Glanz') for the hair.",
            "decisionTrace": "Claim direction: sensitive scalp ('Kopfhaut Sensitive' in the name, high). Formula compatible: targeted (Allantoin@8, Bisabolol@9, Panthenol@11). Route: Allantoin@8, Bisabolol@9. Decision: F7 step 1 (name names the scalp role) -> scalp_active.",
            "rationale": "scalp_active: sensitive-scalp product named as such, with comfort routes.", "ruleIds": ["7.2", "F7", "SC1", "CSA"], "blindToFinal": "general -> scalp_active"},
        "focusSecondary": {"value": [], "confidence": "moderate", "neighboringAlternative": ["shine"],
            "decisionTrace": "Empty default considered and kept: shine claim 'erhält einen seidigen Glanz' (moderate) has no independent shine route (no silicone or smoothing film; pearlizer and guar are generic conditioning, F2/F3); 'Haartyp: glanzloses Haar' is a listing attribute.",
            "rationale": "No secondary passes Section 8.", "counterSignal": "Shine wording plus a hair-type attribute.", "ruleIds": ["Section 8", "F2", "F3"], "blindToFinal": "unchanged []"},
        "usageRole": {"value": "regular", "confidence": "high", "neighboringAlternative": "none", "triggerCode": "none", "triggerEvidence": [], "losingTriggers": [],
            "rationale": trace_usage("none", "no frequency wording", "default regular."), "counterSignal": "None.", "ruleIds": ["Section 9"], "blindToFinal": "regular (low) -> regular (high)"},
        "scalpComfortTarget": {"value": "targeted", "confidence": "high", "neighboringAlternative": "none",
            "csaRoute": "Listed prominent routes: comfort Allantoin@8, Bisabolol@9, Panthenol@11; humectant Glycerin@5, Panthenol@11. MB not used (excluded by Sodium Laureth Sulfate@3).",
            "rationale": "targeted: name 'Kopfhaut Sensitive' (high), 'Beruhigendes Shampoo für empfindliche Kopfhaut', 'Kann Juckreiz und Spannungsgefühle mildern' (moderate) plus CSA via listed prominent routes. No cooling agent or essential oil; not strong.",
            "counterSignal": "None material.", "ruleIds": ["Section 10", "CSA", "SC1", "E4"], "blindToFinal": "not_targeted -> targeted"},
    },
    "counter": {"cleansingStrength": "None material (three buffers).", "conditioningLevel": "Guar is the only substantive route (neighbor low).",
                "weightPotential": "Guar plus a protein - W2 boundary (neighbor moderate).", "dandruffSupport": "None."},
    "targets": ["sensitive", "dry"],
    "primary": {"target": "sensitive", "confidence": "high",
        "rationale": "S-SENSITIVE passes: name 'Kopfhaut Sensitive' (high), formula targeted + prominent comfort routes Allantoin@8, Bisabolol@9, Panthenol@11. S-PRIMARY: named in the product name. Not strong -> no flag. Confidence = min(E1 high, targeted high) = high."},
    "secondary": {"target": "dry", "confidence": "moderate",
        "rationale": "S-DRY passes: E2 dry unit 'für die Bedürfnisse von sensibler und trockener Kopfhaut entwickelt' (moderate) and formula targeted + prominent humectant routes Glycerin@5, Panthenol@11. One secondary, not oily+dry. Confidence moderate."},
    "d1": D1_NONE,
    "notes": [],
    "selfCheck": SELF,
    "uncertainties": ["Intensity regular vs expected gentle for irritationen and trocken -> amber rows (I2); no I3 flag."],
}

if __name__ == "__main__":
    for bid in sorted(DATA):
        print(build(bid, DATA[bid]))
