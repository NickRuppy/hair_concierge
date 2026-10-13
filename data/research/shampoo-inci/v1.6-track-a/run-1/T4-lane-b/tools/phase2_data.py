# Hand-authored post-unblind reconciliation (lane B, T4). Executed by phase2.py.

def prop(value, conf, rationale, counter, neighbor, facts=None, src=None, **kw):
    d = {"value": value, "confidence": conf, "rationale": rationale, "counterSignal": counter,
         "neighboringAlternative": neighbor, "formulaFacts": facts or [], "sourceIds": src or []}
    d.update(kw)
    return d

def usage(value, code, evidence, rationale, losing=None, conf="high"):
    neighbor = "none" if conf == "high" else "regular"
    return prop(value, conf, rationale, "Usage triggers are conjunctive and mechanical (Section 9); see trace." if value == "regular" else
                "Trigger fires mechanically from graded claim plus final cleansingStrength.", neighbor,
                triggerCode=code, triggerEvidence=evidence, losingTriggers=losing or [],
                decisionTrace={"default": "regular", "triggerCode": code, "triggerEvidence": evidence, "rationale": rationale})

def scalp(value, conf, rationale, counter, neighbor, csa, sc1):
    return prop(value, conf, rationale, counter, neighbor, csaFormulaHalf=csa, sc1Positioning=sc1)

def target(t, conf, rationale, way=None):
    d = {"target": t, "confidence": conf, "rationale": rationale}
    if way:
        d["sOrdinaryWays"] = way
    return d

NO_D1 = {"value": False, "confidence": "high", "rationale": "D1 false: no tiefenrein/deep clean/clarifying shampoo/detox-reinigung stem in name or graded claims, no occasional-use directions."}

def focus_record(verdict, routes, claim_role, counter, trace, limitation=""):
    return {"careDirection": {"verdict": verdict, "routes": routes, "limitation": limitation},
            "claimRole": claim_role, "counterSignal": counter, "decisionTrace": trace}

def sec_empty(neighbor, rationale, considered):
    return prop([], "moderate", rationale, "See decision trace.", neighbor,
                decisionTrace={"emptyDefaultConsidered": True, "selected": [], "candidatesConsidered": considered})

NOT_DANDRUFF_RC = "Not applicable: primary target is not dandruff (E2b layer 2 requires a passed S-DANDRUFF)."

# =====================================================================
DATA["T401"] = dict(
    productName="PANTENE PRO-V Shampoo Anti Schuppen Active Nutri-Plex",
    claimGrading=[{"claim": "Anti Schuppen (product name)", "grade": "high", "use": "E2 dandruff unit"},
                  {"claim": "dm/Rossmann copy (Pflege, Glanz, tägliche Anwendung, Pflegende Wirkung auf die Kopfhaut)", "grade": "low", "use": "cannot fire triggers, SC1 or targets (CL-SRC)"}],
    focusPrimary=prop("scalp_active", "high", "scalp_active: the exact product name carries the anti-dandruff claim (high) and the formula contains Piroctone Olamine (14) - problem-led product with recognized active (7.2).",
                      "Formula also carries a C2 high conditioning system (Dimethiconol 6, guar 13); retailer Pflege/Glanz copy is low-graded.", "none",
                      [{"ingredient": "Piroctone Olamine", "position": 14}], ["product name"]),
    focusSecondary=sec_empty(["shine"], "Empty: shine/Pflege only in low-graded retailer copy and delivered by the same silicone route (F2, CL-SRC).", ["shine (retailer, low; F2)"]),
    usageRole=usage("treatment", "recognized_active_problem_led", ["name: 'Anti Schuppen' (high)", "Piroctone Olamine (14)"],
                    "dandruffSupport supported + E2 dandruff unit graded high (U3). Daily-use wording is retailer-only (low) and cannot fire frequent."),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: no E2 sensitive/dry unit graded moderate or high (SC1 fails), and CSA fails (no prominent E4 route).", "Retailer 'Pflegende Wirkung auf die Kopfhaut' (low, not E2).", "none", False, False),
    focusRecord=focus_record("not_applicable", {}, "candidate", "C2 conditioning system; low-graded care copy.",
                             {"primary": {"claimDirection": "anti-dandruff (name)", "formulaCompatible": True, "compatibleRoute": "Piroctone Olamine (14)", "reason": "7.2 problem-led dandruff row"},
                              "secondary": {"emptyDefaultConsidered": True, "selected": []}}),
    primaryTarget=target("dandruff", "high", "S-DANDRUFF passes: name dandruff claim (E1 high) + dandruffSupport supported (high). Dandruff path: no secondary target (R17.2)."),
    D1=NO_D1,
    researchCombinationTargets=[], researchCombinationRationale="No comfort, dry or oily scalp wording graded moderate or high (all copy is retailer, low).",
    changes=[{"field": "focusPrimary", "blind": "general (provisional)", "final": "scalp_active", "evidence": "name 'Anti Schuppen' (high)", "reason": "7.2 dandruff row"},
             {"field": "usageRole", "blind": "regular (provisional)", "final": "treatment", "evidence": "name dandruff claim + Piroctone", "reason": "U3"},
             {"field": "scalpComfortTarget", "blind": "not_targeted (provisional, low)", "final": "not_targeted (high)", "evidence": "no SC1 unit at moderate+", "reason": "SC1, CSA"}],
    uncertainties=[{"reading": "Only the product name is graded above low; all descriptive copy is retailer", "alternative": "none affecting values"}])

# =====================================================================
DATA["T402"] = dict(
    productName="Balea Professional Shampoo Hydra Volume, 250 ml",
    claimGrading=[{"claim": "Hydra Volume (name)", "grade": "high", "use": "focus"},
                  {"claim": "Volumenshampoo; Feuchtigkeitsspendend; Für feines Haar mit platten Ansatz & trockenen Spitzen; pH-hautneutral", "grade": "moderate", "use": "focus; no E2 scalp unit"}],
    focusPrimary=prop("volume", "moderate", "volume: 'Volume' in the name (high) and 'Volumenshampoo' headline (moderate); formula compatible - weightPotential low, no silicone, absorbent Kaolin (8).",
                      "'Hydra' and 'Feuchtigkeitsspendend' compete; Sodium Hyaluronate (6) is a humectant route.", "moisture",
                      [{"ingredient": "Kaolin", "position": 8}, {"ingredient": "Guar Hydroxypropyltrimonium Chloride", "position": 9}], ["product name", "manufacturer_de"]),
    focusSecondary=sec_empty(["moisture"], "Empty: moisture is positioned but the formula verdict is nonspecific - a single humectant (Sodium Hyaluronate 6) with one guar is not a coherent humectant cluster (7.3, F1).", ["moisture (verdict nonspecific)"]),
    usageRole=usage("regular", "none", [], "No U2 frequency wording, no reset intent, no D1, no dandruff."),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: only mildness wording (pH-hautneutral, Hautverträglichkeit) - no SC1 unit.", "CSA formula half met (Niacinamide 7, Sodium Hyaluronate 6 prominent) but no positioning.", "none", True, False),
    focusRecord=focus_record("nonspecific", {"moisture": ["Sodium Hyaluronate (6)"], "shared": ["Guar Hydroxypropyltrimonium Chloride (9)"]}, "candidate",
                             "Hydra/moisture positioning competes with volume.",
                             {"primary": {"claimDirection": "volume (name + headline)", "formulaCompatible": True, "compatibleRoute": "low weight, no silicone, Kaolin (8)", "reason": "dominant name/headline job"},
                              "secondary": {"emptyDefaultConsidered": True, "selected": [], "why": "moisture verdict nonspecific"}},
                             "single humectant"),
    primaryTarget=target("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 unit ('platter Ansatz', 'gründliche Reinigung für den Haaransatz' are not oily lexicon); manufacturer source present -> high.", [1]),
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general (provisional)", "final": "volume", "evidence": "name 'Hydra Volume', 'Volumenshampoo'", "reason": "7.2"},
             {"field": "usageRole", "blind": "regular (provisional, low)", "final": "regular (high)", "evidence": "no trigger", "reason": "Section 9"},
             {"field": "scalpComfortTarget", "blind": "not_targeted (provisional)", "final": "not_targeted (high)", "evidence": "mildness wording only", "reason": "SC1/E2a"}],
    uncertainties=[{"reading": "moisture secondary rejected (verdict nonspecific)", "alternative": "focusSecondary ['moisture'] if Sodium Hyaluronate + guar is read as moisture_supported"}])

# =====================================================================
DATA["T403"] = dict(
    productName="ISANA MED Shampoo Totes Meer, 200 ml",
    claimGrading=[{"claim": "beruhigt empfindliche und juckende Kopfhaut; juckreizlindernder Wirkstoff-Komplex; Kopfhaut beruhigend", "grade": "moderate", "use": "E2 sensitive units (pack back / manufacturer_de)"},
                  {"claim": "Schutz vor Austrocknung für Kopfhaut & Haar", "grade": "moderate", "use": "protective wording, not E2 dry (E2a)"},
                  {"claim": "Totes Meer Salz ... reich an Spurenelementen", "grade": "moderate", "use": "ingredient reputation (E2a)"}],
    focusPrimary=prop("general", "moderate", "general: the only positioned job is sensitive/itchy scalp, but scalp_active needs scalpComfortTarget targeted (7.2), which fails CSA; no in-scope lengths-care claim remains.",
                      "Strong, explicit sensitive-scalp positioning; Allantoin (11) and Bisabolol (12) comfort routes sit just after Parfum.", "scalp_active",
                      [{"ingredient": "Allantoin", "position": 11}, {"ingredient": "Bisabolol", "position": 12}], ["pack_back", "manufacturer_de"]),
    focusSecondary=sec_empty(["scalp_active"], "Empty: no distinct secondary positioning.", []),
    usageRole=usage("regular", "none", [], "No frequency wording, no D1, no dandruff, cleansing not strong."),
    scalpComfortTarget=scalp("not_targeted", "moderate", "not_targeted: SC1 holds (E2 sensitive units graded moderate), but CSA fails - no E4 comfort or humectant/refatting route is prominent (Parfum at 7; Allantoin 11, Bisabolol 12, Glycerin 17 follow it). Missing route named; S-SENSITIVE therefore fails (S-FAIL).",
                             "Listed comfort routes present just after the E3 point; Menthol (8) counter-signal.", "targeted", False, True),
    focusRecord=focus_record("not_applicable", {}, "not_applicable", "Explicit sensitive-scalp claim without formula compatibility.",
                             {"primary": {"claimDirection": "sensitive/itchy scalp", "formulaCompatible": False, "compatibleRoute": None, "reason": "scalp_active requires targeted (7.2); CSA fails -> general"}}),
    primaryTarget=target("ordinary", "moderate", "S-ORDINARY way 4: claimed sensitive target failed S-SENSITIVE formula gate (scalpComfortTarget not targeted; no prominent E4 comfort route) and nothing else passed.", [4]),
    extraFlags=[{"code": "review_specialist_gate_failed", "detail": "sensitive: formula gate (CSA/prominent E4 comfort route) failed; Allantoin (11) and Bisabolol (12) listed but after Parfum (7); unlisted_route_candidate:Lauryl Lactate"}],
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general (provisional, low)", "final": "general (moderate)", "evidence": "sensitive claim, CSA fails", "reason": "7.2"},
             {"field": "scalpComfortTarget", "blind": "not_targeted (provisional)", "final": "not_targeted (moderate)", "evidence": "SC1 met, CSA failed", "reason": "Section 10 CSA"}],
    uncertainties=[{"reading": "'Schutz vor Austrocknung für Kopfhaut & Haar' read as protective wording", "alternative": "E2 dry unit -> S-DRY also fails (CSA) -> same outcome"}])

# =====================================================================
DATA["T404"] = dict(
    productName="NIVEA 2in1 Express Shampoo & Spülung, 400 ml",
    claimGrading=[{"claim": "Glanz-Serum; Stärkt die Haarstruktur; schützt vor Haarbruch; Verbessert die Kämmbarkeit; Reinigt sanft die Kopfhaut; ohne zu beschweren", "grade": "moderate", "use": "focus candidates; no E2 unit"},
                  {"claim": "2in1 Shampoo & Spülung (name)", "grade": "high", "use": "C7: never raises conditioning"}],
    focusPrimary=prop("general", "moderate", "general: claims mix repair (Haarstruktur, Haarbruch), shine (Glanz-Serum) and generic 2in1 care with no dominant name/headline job; repair verdict is nonspecific (deposition care without a damage-specific route).",
                      "Glanz-Serum hero claim with a light emollient ether (Dicaprylyl Ether 10) could support shine.", "shine",
                      [{"ingredient": "Dicaprylyl Ether", "position": 10}, {"ingredient": "Guar Hydroxypropyltrimonium Chloride", "position": 9}], ["manufacturer_de"]),
    focusSecondary=sec_empty(["shine"], "Empty: no primary specialist focus; shine would share the emollient route.", ["shine"]),
    usageRole=usage("regular", "none", [], "No trigger."),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: 'reinigt sanft die Kopfhaut', 'Hautverträglichkeit' are mildness (E2a).", "CSA formula half met.", "none", True, False),
    focusRecord=focus_record("nonspecific", {"shared": ["Guar (9)", "Dicaprylyl Ether (10)", "Glyceryl Oleate (11)", "Hydrogenated Castor Oil (14)"]}, "not_applicable",
                             "Competing repair/shine/2in1 claims.",
                             {"primary": {"claimDirection": None, "formulaCompatible": True, "compatibleRoute": "generic conditioning", "reason": "generic/competing claims -> general (7.2)"}},
                             "no protein/bond/damage-specific route"),
    primaryTarget=target("ordinary", "high", "S-ORDINARY way 1: no E2 unit; manufacturer source present.", [1]),
    D1=NO_D1,
    changes=[{"field": "usageRole/scalpComfortTarget", "blind": "provisional", "final": "regular / not_targeted (high)", "evidence": "no triggers or SC1", "reason": "Sections 9, 10"},
             {"field": "focusPrimary", "blind": "general (low)", "final": "general (moderate)", "evidence": "competing generic claims", "reason": "7.2"}],
    uncertainties=[{"reading": "focusPrimary general", "alternative": "shine (Glanz-Serum) or repair (Haarbruch) if one claim is read as dominant"}])

# =====================================================================
DATA["T405"] = dict(
    productName="Monday Haircare Volume Kraft & Fülle Shampoo",
    claimGrading=[{"claim": "Volume Kraft & Fülle (name)", "grade": "high", "use": "focus candidate"},
                  {"claim": "manufacturer_de text in English: 'add body to thin, fine or oily hair'; 'stimulate scalp'", "grade": "low", "use": "E1 foreign-language text, no German source repeats the oily claim -> low"},
                  {"claim": "retailer copy (Volumen, feines Haar, Haarwachstum)", "grade": "low", "use": "none"}],
    focusPrimary=prop("general", "moderate", "general: the name's volume job is contradicted by the formula - weightPotential high (W-RICH with weak reset) makes loss of root lift likely, so volume is not formula-compatible (3.2: claims cannot override an incompatible formula); no other graded job remains.",
                      "Name-level volume claim (high); 0% SLS mild chassis is consistent with a volumizing intent.", "volume",
                      [{"ingredient": "Cocos Nucifera (Coconut) Oil", "position": 11}, {"ingredient": "Polyquaternium-10", "position": 13}], ["product name"]),
    focusSecondary=sec_empty(["volume"], "Empty.", []),
    usageRole=usage("regular", "none", [], "No graded trigger; cleansing low."),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: no SC1 unit.", "-", "none", True, False),
    focusRecord=focus_record("not_applicable", {}, "candidate", "Volume claim vs heavy formula.",
                             {"primary": {"claimDirection": "volume (name)", "formulaCompatible": False, "compatibleRoute": None, "reason": "weightPotential high incompatible with lift job -> general"}}),
    primaryTarget=target("ordinary", "moderate", "S-ORDINARY way 4 (+ way 2 for the low-graded growth wording): the oily-hair unit is graded low (English text, E1) so S-OILY positioning fails; its formula clause also fails (cleansingStrength low, weightPotential high, conditioningLevel high). No other target.", [4, 2]),
    extraFlags=[{"code": "review_specialist_gate_failed", "detail": "oily: positioning gate failed (only unit 'thin, fine or oily hair' is English-language, graded low, E1); formula clause also fails (cleansingStrength low, weightPotential high, conditioningLevel high). X1 conditions not met either (needs cleansingStrength >= moderate and conditioningLevel not high)."}],
    notes=[{"code": "hair_loss_claim_not_evaluated", "detail": "retailer 'gesundes Haarwachstum' (low) and ginger 'stimulate scalp'"}],
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general (low)", "final": "general (moderate)", "evidence": "volume name vs W high", "reason": "3.2/7.2"},
             {"field": "usageRole/scalpComfortTarget", "blind": "provisional", "final": "regular / not_targeted", "evidence": "no graded triggers", "reason": "Sections 9-10"}],
    uncertainties=[{"reading": "volume rejected as formula-incompatible with weightPotential high", "alternative": "focusPrimary volume with the heavy formula recorded as trade-off (7.2 row 3)"},
                   {"reading": "English 'oily hair' treated as an E2 oily unit graded low", "alternative": "not an E2 unit at all -> S-ORDINARY way 1, no review flag"},
                   {"reading": "the packet name matches the X1 register wording '... Volume Kraft & Fülle'; lane does not infer exceptions", "alternative": "even if it is the X1 product, X1 cannot apply because cleansingStrength is low and conditioningLevel high (X1 scope)"}])

# =====================================================================
DATA["T406"] = dict(
    productName="Salthouse Anti Schuppen",
    claimGrading=[{"claim": "Anti Schuppen (name)", "grade": "high", "use": "E2 dandruff"},
                  {"claim": "wirkt wohltuend bei irritierter, trockener und dadurch schuppenanfälliger Kopfhaut; Hautproblem: Juckreiz, ... Schuppen, ... Spannungsgefühle", "grade": "moderate", "use": "dandruff units with comfort/dryness wording (bundled, E2a/E2b)"},
                  {"claim": "Für die tägliche Haarwäsche geeignet", "grade": "moderate", "use": "U2 frequency (loses to treatment)"},
                  {"claim": "Neurodermitis/Psoriasis Basispflege; Hauttyp empfindliche Haut", "grade": "moderate", "use": "medical/skin wording, not E2 scalp claims"}],
    focusPrimary=prop("scalp_active", "high", "scalp_active: anti-dandruff name claim (high) + Piroctone Olamine (5).", "Medical (Neurodermitis/Psoriasis) wording is out of scope.", "none",
                      [{"ingredient": "Piroctone Olamine", "position": 5}], ["product name", "manufacturer_de"]),
    focusSecondary=sec_empty(["moisture"], "Empty: 'feuchtigkeitsspendende Aloe Vera' is ingredient reputation; no distinct role.", []),
    usageRole=usage("treatment", "recognized_active_problem_led", ["name 'Anti Schuppen'", "Piroctone Olamine (5)"], "U3; U1 precedence over frequent.",
                    losing=[{"code": "explicit_frequent_non_strong", "evidence": "Für die tägliche Haarwäsche geeignet (manufacturer)"}]),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: comfort/dryness words sit inside dandruff units (E2a, not SC1); 'empfindliche Haut' does not name the scalp; CSA fails (no prominent E4 route before Sodium Benzoate 8).", "Tea tree and citrus oils; none prominent.", "none", False, False),
    focusRecord=focus_record("not_applicable", {}, "candidate", "Medical-adjacent wording ignored.",
                             {"primary": {"claimDirection": "anti-dandruff", "formulaCompatible": True, "compatibleRoute": "Piroctone Olamine (5)", "reason": "7.2 dandruff row"}}),
    primaryTarget=target("dandruff", "high", "S-DANDRUFF: name claim (high) + supported; no secondary (R17.2)."),
    notes=[{"code": "dandruff_bundled_comfort_wording", "detail": "'wirkt wohltuend bei irritierter ... schuppenanfälliger Kopfhaut', 'Juckreiz ... Spannungsgefühle' (manufacturer, moderate); S-SENSITIVE formula gate failed: CSA not met, no prominent E4 comfort route"}],
    researchCombinationTargets=[], researchCombinationRationale="sensitive: bundled comfort wording graded moderate but S-SENSITIVE gate fails (CSA) -> not recorded; dry: dryness only inside the dandruff unit (absorbed, R16.1); oily: none.",
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general", "final": "scalp_active", "evidence": "name", "reason": "7.2"},
             {"field": "usageRole", "blind": "regular", "final": "treatment", "evidence": "name + Piroctone", "reason": "U3/U1"},
             {"field": "scalpComfortTarget", "blind": "not_targeted (low)", "final": "not_targeted (high)", "evidence": "bundled wording only", "reason": "SC1/E2a"}],
    uncertainties=[{"reading": "Neurodermitis/Psoriasis basis-care wording treated as medical, ignored", "alternative": "none in scope"}])

# =====================================================================
DATA["T407"] = dict(
    productName="Sebamed Anti-Schuppen Shampoo",
    claimGrading=[{"claim": "Anti-Schuppen (name)", "grade": "high", "use": "E2 dandruff"},
                  {"claim": "'Das sebamed Anti-Schuppen Shampoo ist eine seifenfreie Pflege zur täglichen Reinigung, die speziell auf die Bedürfnisse empfindlicher Kopfhaut abgestimmt ist.'", "grade": "moderate", "use": "names dandruff -> dandruff unit; comfort wording absorbed/bundled (E2a/E2b)"},
                  {"claim": "Täglich oder 2-3x pro Woche anwenden", "grade": "moderate", "use": "U2 (loses to treatment)"},
                  {"claim": "Haartyp: schuppiges Haar, fettiges Haar", "grade": "moderate", "use": "'fettiges Haar' names hair, not scalp, not the lexicon stem 'schnell fettend' -> not oily-scalp wording"},
                  {"claim": "dm/Müller 'Für empfindliche Kopfhaut'", "grade": "low", "use": "none"}],
    focusPrimary=prop("scalp_active", "high", "scalp_active: anti-dandruff name (high) + Piroctone Olamine (6).", "Mild positioning; cleansing moderate.", "none",
                      [{"ingredient": "Piroctone Olamine", "position": 6}], ["product name", "manufacturer_de"]),
    focusSecondary=sec_empty(["clarifying"], "Empty: no distinct secondary positioning.", []),
    usageRole=usage("treatment", "recognized_active_problem_led", ["name 'Anti-Schuppen'", "Piroctone Olamine (6)"], "U3; U1 precedence.",
                    losing=[{"code": "explicit_frequent_non_strong", "evidence": "Täglich oder 2-3x pro Woche anwenden"}]),
    scalpComfortTarget=scalp("not_targeted", "moderate", "not_targeted: the only moderate 'empfindliche Kopfhaut' wording sits in a unit that names the anti-dandruff product (bundled, E2a/E2b) - not SC1; separate sensitive units are retailer-only (low). CSA formula half is met (Sodium Lactate 10).",
                             "Sensitive-scalp intent is explicit on the manufacturer page.", "targeted", True, False),
    focusRecord=focus_record("not_applicable", {}, "candidate", "-",
                             {"primary": {"claimDirection": "anti-dandruff", "formulaCompatible": True, "compatibleRoute": "Piroctone Olamine (6)", "reason": "7.2"}}),
    primaryTarget=target("dandruff", "high", "S-DANDRUFF: name claim (high) + supported; no secondary (R17.2)."),
    notes=[{"code": "dandruff_bundled_comfort_wording", "detail": "'speziell auf die Bedürfnisse empfindlicher Kopfhaut abgestimmt' (manufacturer, moderate); S-SENSITIVE gate failed: CSA met (Sodium Lactate 10) but no prominent E4 comfort route"}],
    researchCombinationTargets=[], researchCombinationRationale="sensitive: gate fails (no prominent comfort route); dry: none; oily: 'fettiges Haar' not oily-scalp wording.",
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general", "final": "scalp_active", "evidence": "name", "reason": "7.2"},
             {"field": "usageRole", "blind": "regular", "final": "treatment", "evidence": "name + Piroctone", "reason": "U3"},
             {"field": "scalpComfortTarget", "blind": "not_targeted (low)", "final": "not_targeted (moderate)", "evidence": "bundled sensitive wording", "reason": "SC1/E2b"}],
    uncertainties=[{"reading": "'Haartyp: fettiges Haar' not oily-scalp wording", "alternative": "researchCombinationTargets ['oily'] (S-OILY clause passes: CS moderate, W low, C low)"},
                   {"reading": "'empfindlicher Kopfhaut' sentence bundled with dandruff", "alternative": "separate unit -> still research-only on a dandruff-primary product; scalpComfortTarget would become targeted (CSA met)"}])

# =====================================================================
DATA["T408"] = dict(
    productName="Balea PROFESSIONAL Shampoo Tiefenreinigung, 250 ml",
    claimGrading=[{"claim": "Tiefenreinigung (name)", "grade": "high", "use": "D1"},
                  {"claim": "Tiefenreinigendes Shampoo; Befreit das Haar von Styling-Rückständen; Deep-Cleanse-System", "grade": "moderate", "use": "D1 corroboration, U4 reset intent"},
                  {"claim": "'reinigt intensiv und entfernt wirksam Styling-Rückstände sowie überschüssiges Fett von Haar und Kopfhaut'", "grade": "moderate", "use": "E2 oily unit (acts on excess scalp fat; stem 'Fett', cf. 'Anti-Fett', 'überschüssiger Talg')"},
                  {"claim": "für die tägliche Anwendung geeignet", "grade": "moderate", "use": "U5 daily-use directions on a D1 product"},
                  {"claim": "Leichtigkeit und Glanz", "grade": "moderate", "use": "shine outcome of the reset route (F2)"}],
    focusPrimary=prop("clarifying", "moderate", "clarifying: explicit deep-cleansing name (D1) plus oily-scalp wording, F6-compatible (cleansingStrength moderate, conditioningLevel moderate, weightPotential low).",
                      "Formula is an ordinary C1 chassis, not a strong reset; daily-use directions.", "general",
                      [{"ingredient": "Sodium Laureth Sulfate", "position": 2}, {"ingredient": "Menthol", "position": 9}], ["product name", "manufacturer_de"]),
    focusSecondary=sec_empty(["shine"], "Empty: Glanz is an outcome of the same reset route (F2); citric acid cannot carry a secondary shine (F4).", ["shine"]),
    usageRole=usage("occasional_reset", "explicit_deep_cleansing", ["name 'Tiefenreinigung' (high)"],
                    "D1 true -> occasional_reset (U1 first); daily-use directions recorded as conflict (U5); with a moderate formula the conflict goes into deep_cleansing_name_ordinary_formula.",
                    losing=[{"code": "explicit_frequent_non_strong", "evidence": "für die tägliche Anwendung geeignet"}]),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: no SC1 unit.", "Menthol (9) prominent.", "none", True, False),
    focusRecord=focus_record("not_applicable", {}, "candidate", "Ordinary-strength formula under a deep-cleansing name.",
                             {"primary": {"claimDirection": "deep cleansing / oily scalp", "formulaCompatible": True, "compatibleRoute": "C1 SLES/betaine chassis, no heavy deposition (F6)", "reason": "7.2 deep-cleaning row"}}),
    primaryTarget=target("oily", "moderate", "S-OILY: E2 oily unit graded moderate; formula clause passes (cleansingStrength moderate, weightPotential low, conditioningLevel moderate). Confidence = lowest of positioning (moderate) and conditioningLevel (moderate)."),
    notes=[{"code": "deep_cleansing_name_ordinary_formula", "detail": "D1 'Tiefenreinigung' (name) / 'Tiefenreinigendes Shampoo'; cleansingStrength moderate; daily-use wording 'für die tägliche Anwendung geeignet' (U5); no deep-cleanser entry (R16.3)"}],
    D1={"value": True, "confidence": "high", "rationale": "D1 true: stem 'tiefenrein' in the exact product name (high) and manufacturer claim; daily-use directions do not make it false."},
    changes=[{"field": "focusPrimary", "blind": "general", "final": "clarifying", "evidence": "name Tiefenreinigung + 'überschüssiges Fett von ... Kopfhaut'", "reason": "7.2/F6"},
             {"field": "usageRole", "blind": "regular", "final": "occasional_reset", "evidence": "D1 name", "reason": "Section 9, U1, U5"},
             {"field": "scalpComfortTarget", "blind": "not_targeted (low)", "final": "not_targeted (high)", "evidence": "no SC1", "reason": "SC1"}],
    uncertainties=[{"reading": "'überschüssiges Fett von Haar und Kopfhaut' counted as an E2 oily unit", "alternative": "outside the lexicon -> primary ordinary (way 1), focus stays clarifying (D1), and review_focus_target_mismatch would not arise"}])

# =====================================================================
DATA["T409"] = dict(
    productName="Ultimate Shampoo (catalog) = L'Oréal Paris Elvital Glycolic Gloss Shampoo, 200 ml",
    identityNote="Manufacturer page is for a different SKU (300 ml, sulfate-based) and is not evidence for this product; formula is sulfate-free (AOS), consistent with retailer 'ohne Sulfat'. Formula source tier 4.",
    claimGrading=[{"claim": "Glycolic Gloss (name)", "grade": "high", "use": "shine focus"},
                  {"claim": "dm/Rossmann (Glanz, Geschmeidigkeit, stumpfes Haar, trockenes Haar)", "grade": "low", "use": "corroboration only"},
                  {"claim": "manufacturer page (different SKU)", "grade": "excluded", "use": "none"}],
    focusPrimary=prop("shine", "moderate", "shine: 'Gloss' in the exact name (high); formula compatible - acidic route (Glycolic Acid 35, Salicylic Acid 19, Citric Acid 31), pearlizer, light conditioning and low weight (7.1 shine).",
                      "All descriptive claims are retailer (low); glycolic acid is late; identity moderate.", "general",
                      [{"ingredient": "Glycolic Acid", "position": 35}, {"ingredient": "Glycol Distearate", "position": 6}], ["product name"]),
    focusSecondary=sec_empty(["moisture"], "Empty: moisture/geschmeidig only retailer (low).", []),
    usageRole=usage("regular", "none", [], "No graded trigger."),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: no SC1 unit.", "-", "none", True, False),
    focusRecord=focus_record("not_applicable", {}, "candidate", "Retailer-only descriptive claims.",
                             {"primary": {"claimDirection": "shine (name)", "formulaCompatible": True, "compatibleRoute": "acidic alignment (Glycolic/Salicylic/Citric Acid) + pearlizer", "reason": "7.1/7.2"}}),
    primaryTarget=target("ordinary", "moderate", "S-ORDINARY way 1: no E2 unit; only retailer copy applies to this SKU -> moderate (13.8).", [1]),
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general", "final": "shine", "evidence": "name 'Gloss'", "reason": "7.2"},
             {"field": "usageRole/scalpComfortTarget", "blind": "provisional", "final": "regular / not_targeted", "evidence": "no triggers", "reason": "-"}],
    uncertainties=[{"reading": "Identity moderate / tier-4 formula", "alternative": "if formula proven not to match the SKU, all properties low (ID-3)"}])

# =====================================================================
DATA["T410"] = dict(
    productName="schauma Shampoo Repair & Pflege",
    claimGrading=[{"claim": "Repair & Pflege (name)", "grade": "high", "use": "repair focus, tie-breaker"},
                  {"claim": "Für strapaziertes & trockenes Haar; repariert intensiv geschädigtes und trockenes Haar; Pro-Vitamin B5", "grade": "moderate", "use": "repair/moisture candidates"}],
    focusPrimary=prop("repair", "moderate", "repair: formula is dual_supported - a substantive deposition cluster (Amodimethicone 13, Dimethicone 14, Guar 5, Apricot Kernel Oil 7) and a humectant cluster (Panthenol 6, Sorbitol 9); the name 'Repair' breaks the tie (claim role tie_breaker, high).",
                      "Dry-hair positioning and the humectant cluster support moisture equally.", "moisture",
                      [{"ingredient": "Amodimethicone", "position": 13}, {"ingredient": "Guar Hydroxypropyltrimonium Chloride", "position": 5}, {"ingredient": "Prunus Armeniaca (Apricot) Kernel Oil", "position": 7}], ["product name", "manufacturer_de"]),
    focusSecondary=sec_empty(["moisture"], "Empty: 'trockenes Haar' is bundled with the damage claim for one audience, not distinct secondary positioning; moisture already resolved as the losing side of the tie (Section 8 condition 1).", ["moisture"]),
    usageRole=usage("regular", "none", [], "No trigger."),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: no SC1 unit.", "-", "none", True, False),
    focusRecord=focus_record("dual_supported", {"repair": ["Amodimethicone (13)", "Dimethicone (14)", "Apricot Kernel Oil (7)"], "moisture": ["Panthenol (6)", "Sorbitol (9)"], "shared": ["Guar (5)"]},
                             "tie_breaker", "Moisture equally supported.",
                             {"primary": {"claimDirection": "repair (name)", "formulaCompatible": True, "compatibleRoute": "amodimethicone/silicone/guar/oil deposition", "reason": "F1 dual_supported, name tie-breaker"},
                              "secondary": {"emptyDefaultConsidered": True, "selected": []}}, "rinse-off; no protein or bond route"),
    primaryTarget=target("ordinary", "high", "S-ORDINARY way 1: no E2 unit; manufacturer source.", [1]),
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general", "final": "repair", "evidence": "name 'Repair & Pflege'", "reason": "F1 tie-breaker"},
             {"field": "usageRole/scalpComfortTarget", "blind": "provisional", "final": "regular / not_targeted", "evidence": "-", "reason": "-"}],
    uncertainties=[{"reading": "secondary moisture rejected", "alternative": "focusSecondary ['moisture'] via independent Panthenol/Sorbitol route"}])

# =====================================================================
DATA["T411"] = dict(
    productName="Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege",
    claimGrading=[{"claim": "Beruhigende Pflege (name)", "grade": "high", "use": "non-scalp name word (F7 note) - names no role"},
                  {"claim": "Anti-Schuppen Wirkung mit Pirocton Olamin; Verhindert Trockenheit & Juckreiz verbunden mit Schuppen; Beruhigend bei trockener, juckender Kopfhaut (Juckreiz verbunden mit Schuppen)", "grade": "moderate", "use": "E2 dandruff units (absorb itch/dryness)"},
                  {"claim": "'gegen Kopfhautjucken, reinigt und stärkt die Kopfhautbarriere'; 'Sofortige Linderung juckender Kopfhaut'", "grade": "moderate", "use": "separate E2 sensitive units (not adjacent to a dandruff unit) - SC1 positioning; research-only on dandruff path (R15)"},
                  {"claim": "retailer 'speziell für trockene, juckende Kopfhaut'", "grade": "low", "use": "none"}],
    focusPrimary=prop("scalp_active", "high", "scalp_active: anti-dandruff claims (moderate) + Piroctone Olamine (6); sensitive-scalp wording also points to scalp_active.", "C2-type conditioning without humectant; name word 'Beruhigende' names no scalp.", "none",
                      [{"ingredient": "Piroctone Olamine", "position": 6}], ["manufacturer_de"]),
    focusSecondary=sec_empty(["moisture"], "Empty: 'feuchtigkeitsspendend' concerns the scalp and is bundled; no lengths route.", []),
    usageRole=usage("treatment", "recognized_active_problem_led", ["'Anti-Schuppen Wirkung mit Pirocton Olamin' (manufacturer)", "Piroctone Olamine (6)"], "U3."),
    scalpComfortTarget=scalp("not_targeted", "moderate", "not_targeted: SC1 holds (separate sensitive units 'gegen Kopfhautjucken', moderate), but CSA fails - no prominent E4 comfort or humectant route (Parfum 12; Aloe juice is not listed). Missing route named.",
                             "Explicit anti-itch positioning; Menthol (16) after Parfum.", "targeted", False, True),
    focusRecord=focus_record("not_applicable", {}, "candidate", "-",
                             {"primary": {"claimDirection": "anti-dandruff + itchy scalp", "formulaCompatible": True, "compatibleRoute": "Piroctone Olamine (6)", "reason": "7.2 dandruff row; F7 step 2 (name names no role)"}}),
    primaryTarget=target("dandruff", "moderate", "S-DANDRUFF: manufacturer dandruff claim (moderate) + supported; primary per S-PRIMARY; no secondary (R17.2)."),
    notes=[{"code": "dandruff_bundled_comfort_wording", "detail": "'gegen Kopfhautjucken', 'Sofortige Linderung juckender Kopfhaut', 'Beruhigend bei ... juckender Kopfhaut' (manufacturer, moderate); S-SENSITIVE gate failed: CSA not met, no prominent E4 comfort route; unlisted_route_candidate:Aloe Barbadensis Leaf Juice (not prominent)"}],
    researchCombinationTargets=[], researchCombinationRationale="sensitive: wording moderate but gate fails (CSA); dry: dryness only inside dandruff units (absorbed); 'Wussten Sie ... trockene, juckende Kopfhaut' is a rhetorical question next to a dandruff unit (bundled); oily: none.",
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general", "final": "scalp_active", "evidence": "manufacturer dandruff claim", "reason": "7.2"},
             {"field": "usageRole", "blind": "regular", "final": "treatment", "evidence": "dandruff claim moderate + Piroctone", "reason": "U3"},
             {"field": "scalpComfortTarget", "blind": "not_targeted (low)", "final": "not_targeted (moderate)", "evidence": "SC1 met, CSA failed", "reason": "CSA"}],
    uncertainties=[{"reading": "the comfort-route note is recorded under dandruff_bundled_comfort_wording for both bundled and separate sensitive units (13.9 names R15 separate units under that code)", "alternative": "none"}])

# =====================================================================
DATA["T412"] = dict(
    productName="Salthouse Totes Meer Therapie Anti-Fett Shampoo",
    claimGrading=[{"claim": "Anti-Fett (name)", "grade": "high", "use": "E2 oily"},
                  {"claim": "ausgleichend und klärend bei schnell fettender Kopfhaut; reguliert die Talgabsonderung", "grade": "moderate", "use": "E2 oily; U4 reset intent"},
                  {"claim": "Für die tägliche Haarwäsche geeignet", "grade": "moderate", "use": "U2 frequent"},
                  {"claim": "Neurodermitis/Psoriasis Basispflege", "grade": "moderate", "use": "medical, not evaluated"}],
    focusPrimary=prop("clarifying", "high", "clarifying: oily-scalp positioning in the name (high) with F6-compatible formula (cleansingStrength moderate, conditioningLevel moderate, weightPotential low).", "Ordinary C1 chassis, not a strong reset.", "none",
                      [{"ingredient": "Sodium Laureth Sulfate", "position": 2}], ["product name", "manufacturer_de"]),
    focusSecondary=sec_empty(["moisture"], "Empty: 'Panthenol sorgt für einen ausgeglichenen Feuchtigkeitshaushalt' is an ingredient sentence; no distinct role.", []),
    usageRole=usage("frequent", "explicit_frequent_non_strong", ["'Für die tägliche Haarwäsche geeignet' (manufacturer)"], "U2 wording + cleansingStrength moderate; alternating impossible (not strong).",
                    losing=[{"code": "strong_plus_reset_intent", "evidence": "'klärend' reset intent, but cleansingStrength not strong"}]),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: no SC1 unit ('schützt die Kopfhaut vor Reizeffekten' is retailer and protective).", "Menthol, mint oil.", "none", False, False),
    focusRecord=focus_record("not_applicable", {}, "candidate", "-",
                             {"primary": {"claimDirection": "oily scalp (name)", "formulaCompatible": True, "compatibleRoute": "C1 chassis, low deposition (F6)", "reason": "7.2 oily row"}}),
    primaryTarget=target("oily", "moderate", "S-OILY: name claim (high) + formula clause passes (CS moderate, W low, C moderate). Confidence = lowest input (conditioningLevel moderate)."),
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general", "final": "clarifying", "evidence": "name 'Anti-Fett'", "reason": "F6"},
             {"field": "usageRole", "blind": "regular", "final": "frequent", "evidence": "tägliche Haarwäsche", "reason": "U2"},
             {"field": "scalpComfortTarget", "blind": "not_targeted (low)", "final": "not_targeted (high)", "evidence": "-", "reason": "SC1"}],
    uncertainties=[])

# =====================================================================
DATA["T413"] = dict(
    productName="head & shoulders Anti-Schuppen Shampoo Classic Clean",
    claimGrading=[{"claim": "Anti-Schuppen (name)", "grade": "high", "use": "E2 dandruff"},
                  {"claim": "'Bekämpft gezielt drei Kopfhautprobleme – Schuppen, Öl und Juckreiz im Zusammenhang mit Schuppen'; '(Schuppen, Juckreiz durch Schuppen und fettige Kopfhaut)'", "grade": "moderate", "use": "dandruff units with bundled itch + oily-scalp wording (E2b, R17.2)"},
                  {"claim": "ideal für die tägliche Anwendung", "grade": "moderate", "use": "U2 (loses to treatment)"}],
    focusPrimary=prop("scalp_active", "high", "scalp_active: anti-dandruff name (high) + Piroctone Olamine (10).", "'Classic Clean'/oil wording could suggest clarifying.", "none",
                      [{"ingredient": "Piroctone Olamine", "position": 10}], ["product name", "manufacturer_de"]),
    focusSecondary=sec_empty(["clarifying"], "Empty: oily-scalp wording sits inside the dandruff claim unit (not distinct positioning, Section 8; research-only per R17.2).", ["clarifying"]),
    usageRole=usage("treatment", "recognized_active_problem_led", ["name 'Anti-Schuppen'", "Piroctone Olamine (10)"], "U3; U1.",
                    losing=[{"code": "explicit_frequent_non_strong", "evidence": "ideal für die tägliche Anwendung"}]),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: itch wording only inside dandruff units; CSA fails.", "-", "none", False, False),
    focusRecord=focus_record("not_applicable", {}, "candidate", "-",
                             {"primary": {"claimDirection": "anti-dandruff", "formulaCompatible": True, "compatibleRoute": "Piroctone Olamine (10)", "reason": "7.2"}}),
    primaryTarget=target("dandruff", "high", "S-DANDRUFF: name claim (high) + supported; no secondary (R17.2)."),
    notes=[{"code": "suits_dandruff_with_oily_scalp", "detail": "'Schuppen, Öl ...', 'fettige Kopfhaut' (manufacturer, moderate); S-OILY clause passes (CS moderate, W moderate, C moderate); confidence moderate"},
           {"code": "dandruff_bundled_comfort_wording", "detail": "'Juckreiz im Zusammenhang mit Schuppen' (moderate); S-SENSITIVE gate failed: CSA not met, no prominent E4 comfort route"}],
    researchCombinationTargets=["oily"], researchCombinationRationale="oily (R17.2): oily-scalp wording inside the dandruff unit, graded moderate, S-OILY formula clause passes -> 'oily' (confidence moderate = min(dandruff high, wording moderate)). sensitive: gate fails. dry: none.",
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general", "final": "scalp_active", "evidence": "name", "reason": "7.2"},
             {"field": "usageRole", "blind": "regular", "final": "treatment", "evidence": "name + Piroctone", "reason": "U3"},
             {"field": "scalpComfortTarget", "blind": "not_targeted (low)", "final": "not_targeted (high)", "evidence": "-", "reason": "E2a"}],
    uncertainties=[])

# =====================================================================
DATA["T414"] = dict(
    productName="Syoss Intense Fullness Kräftigendes Shampoo, 440 ml",
    claimGrading=[{"claim": "Intense Fullness; Kräftigendes Shampoo (name)", "grade": "high", "use": "volume focus"},
                  {"claim": "Tiefenpflegende Formel mit 3% Niacinamide-Volumen-Komplex, stärkt das Haar von innen", "grade": "moderate", "use": "'Tiefenpflege' is not D1"},
                  {"claim": "retailer 'für feines, kraftloses Haar'", "grade": "low", "use": "T2 corroboration only"}],
    focusPrimary=prop("volume", "moderate", "volume: 'Intense Fullness' in the name (high), Niacinamide-Volumen-Komplex claim; formula compatible enough - weightPotential moderate (not high), conditioning moderate.",
                      "Two silicones (Dimethicone 8, Amodimethicone 12) and guar are a weight trade-off against lift.", "general",
                      [{"ingredient": "Niacinamide", "position": 7}], ["product name", "manufacturer_de"]),
    focusSecondary=sec_empty(["repair"], "Empty: 'stärkt das Haar von innen' is generic strengthening, no damage positioning.", ["repair"]),
    usageRole=usage("regular", "none", [], "No trigger."),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: no SC1 unit.", "-", "none", True, False),
    focusRecord=focus_record("not_applicable", {}, "candidate", "Silicone deposition vs volume job (trade-off recorded, 7.2 row 3).",
                             {"primary": {"claimDirection": "volume/fullness (name)", "formulaCompatible": True, "compatibleRoute": "moderate (not heavy) weight", "reason": "7.2"}}),
    primaryTarget=target("ordinary", "high", "S-ORDINARY way 1; manufacturer source.", [1]),
    D1={"value": False, "confidence": "high", "rationale": "D1 false: 'Tiefenpflegende' is a care term explicitly excluded from D1."},
    changes=[{"field": "focusPrimary", "blind": "general", "final": "volume", "evidence": "name", "reason": "7.2"}],
    uncertainties=[{"reading": "volume treated as compatible with weightPotential moderate", "alternative": "general"}])

# =====================================================================
DATA["T415"] = dict(
    productName="Guhl Kraft & Fülle Shampoo (kräftigendes Shampoo)",
    claimGrading=[{"claim": "Kraft & Fülle (name)", "grade": "high", "use": "volume/fullness"},
                  {"claim": "Für dünner-werdendes, zu Haarausfall neigendes Haar; Haarwachstum; Durchblutung der Kopfhaut", "grade": "moderate", "use": "hair-loss/growth: out of scope (F5, S-HAIRLOSS)"},
                  {"claim": "ohne zu beschweren; reinigt sanft und gründlich", "grade": "moderate", "use": "never lowers weight; mildness"}],
    focusPrimary=prop("volume", "moderate", "volume: after ignoring hair-loss/growth claims (F5), the remaining in-scope job is 'Fülle' in the name; formula compatible (weightPotential low, no silicone).",
                      "'Kraft & Fülle' sits in a thinning-hair context and may be a density claim (out of scope).", "general",
                      [{"ingredient": "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "position": 6}], ["product name"]),
    focusSecondary=sec_empty(["scalp_active"], "Empty.", []),
    usageRole=usage("regular", "none", [], "No trigger; 2-minute massage is not frequency wording."),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: no SC1 unit (scalp claims are circulation/hair-growth).", "CSA formula half met (Panthenol 9, Glycerin 13).", "none", True, False),
    focusRecord=focus_record("not_applicable", {}, "candidate", "Hair-loss context.",
                             {"primary": {"claimDirection": "fullness (name) after F5", "formulaCompatible": True, "compatibleRoute": "low weight", "reason": "F5 then 7.2"}}),
    primaryTarget=target("ordinary", "moderate", "S-ORDINARY way 2: only scalp-adjacent positioning is hair loss/growth (not evaluated).", [2]),
    notes=[{"code": "hair_loss_claim_not_evaluated", "detail": "'zu Haarausfall neigendes Haar', 'Haarwachstum', 'Durchblutung der Kopfhaut' (manufacturer)"}],
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general", "final": "volume", "evidence": "name 'Kraft & Fülle'", "reason": "F5, 7.2"}],
    uncertainties=[{"reading": "'Fülle' read as cosmetic volume", "alternative": "density claim (out of scope) -> focusPrimary general"}])

# =====================================================================
DATA["T416"] = dict(
    productName="Dejan Garz The Foundation Shampoo",
    claimGrading=[{"claim": "Leichtgewicht, das mit Panthenol und Glycerin Feuchtigkeit spendet, ohne deine Kopfhaut auszutrocknen", "grade": "moderate", "use": "moisture candidate; scalp part protective (E2a)"},
                  {"claim": "English badges on the DE page: Deep Hydration, Lightweight Formula, Regulates Oil Production on the Scalp, Anti Frizz", "grade": "low", "use": "English wording without a German repeat (E1) - oily unit low"},
                  {"claim": "Verwende das Shampoo bei jeder Haarwäsche", "grade": "moderate", "use": "not U2 wording"}],
    focusPrimary=prop("moisture", "moderate", "moisture: German manufacturer claim 'spendet Feuchtigkeit' with a moisture_supported formula - humectant cluster Glycerin (4), Panthenol (6), Sodium Hyaluronate (9) plus guar, Quaternium-80 and refatters.",
                      "Headline is 'Effektive Reinigung' / foundation shampoo; claims are broad.", "general",
                      [{"ingredient": "Glycerin", "position": 4}, {"ingredient": "Panthenol", "position": 6}, {"ingredient": "Sodium Hyaluronate", "position": 9}], ["manufacturer_de"]),
    focusSecondary=sec_empty(["clarifying"], "Empty: oily-scalp badge graded low; Anti Frizz is low and shares the conditioning route.", ["clarifying", "shine"]),
    usageRole=usage("regular", "none", [], "'bei jeder Haarwäsche' is not U2 frequency wording."),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: 'ohne deine Kopfhaut auszutrocknen' is protective (E2a); retailer refatting/scalp wording low.", "CSA formula half met.", "none", True, False),
    focusRecord=focus_record("moisture_supported", {"moisture": ["Glycerin (4)", "Panthenol (6)", "Sodium Hyaluronate (9)"], "shared": ["Guar (10)", "Quaternium-80 (12)", "Glyceryl Oleate (8)"]},
                             "candidate", "Broad multi-claim positioning.",
                             {"primary": {"claimDirection": "moisture", "formulaCompatible": True, "compatibleRoute": "humectant cluster", "reason": "F1"}}),
    primaryTarget=target("ordinary", "moderate", "S-ORDINARY way 4: the oily unit ('Regulates Oil Production on the Scalp') is English-language and graded low (E1), so S-OILY positioning fails although its formula clause passes; nothing else passes.", [4]),
    extraFlags=[{"code": "review_specialist_gate_failed", "detail": "oily: positioning gate failed - only unit is the English badge 'Regulates Oil Production on the Scalp' (graded low, no German repeat, E1); formula clause would pass"}],
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general", "final": "moisture", "evidence": "'spendet Feuchtigkeit' + humectant cluster", "reason": "F1"}],
    uncertainties=[{"reading": "English badge on the German manufacturer page graded low under E1", "alternative": "graded moderate -> oily target passes S-OILY, focus clarifying would then be needed (S-FOCUS)"}])

# =====================================================================
DATA["T417"] = dict(
    productName="Garnier Fructis Locken Methode Feuchtigkeitsauffüllendes Shampoo",
    claimGrading=[{"claim": "Feuchtigkeitsauffüllendes (name)", "grade": "high", "use": "moisture"},
                  {"claim": "5% Feuchtigkeitskomplex mit Hyaluron und Shea-Fettsäuren; Locken", "grade": "moderate", "use": "moisture corroboration; curls = hair_texture (T2)"}],
    focusPrimary=prop("moisture", "high", "moisture: name claim (high) + moisture_supported formula - Glycerin (4), Sodium Hyaluronate (14) humectants with Shea Butter (10), guar (19), Polyquaternium-7 (21).",
                      "Conditioning moderate; shea and polymers late.", "none",
                      [{"ingredient": "Glycerin", "position": 4}, {"ingredient": "Sodium Hyaluronate", "position": 14}, {"ingredient": "Butyrospermum Parkii Butter / Shea Butter", "position": 10}], ["product name", "manufacturer_de"]),
    focusSecondary=sec_empty(["shine"], "Empty: curl definition is not a focus value.", []),
    usageRole=usage("regular", "none", [], "No trigger."),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: no SC1 unit.", "-", "none", True, False),
    focusRecord=focus_record("moisture_supported", {"moisture": ["Glycerin (4)", "Sodium Hyaluronate (14)"], "shared": ["Shea Butter (10)", "Guar (19)", "Polyquaternium-7 (21)"]},
                             "candidate", "Late emollient/polymer support.",
                             {"primary": {"claimDirection": "moisture (name)", "formulaCompatible": True, "compatibleRoute": "humectant cluster + shea/polymer support", "reason": "F1"}}),
    primaryTarget=target("ordinary", "high", "S-ORDINARY way 1; manufacturer source.", [1]),
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general", "final": "moisture", "evidence": "name", "reason": "F1"}],
    uncertainties=[])

# =====================================================================
DATA["T418"] = dict(
    productName="Head & Shoulders DERMAXPRO Haarshampoo Sensitive Pflege",
    claimGrading=[{"claim": "Sensitive Pflege (name)", "grade": "high", "use": "non-scalp name word - not positioning (F7 note, SC1)"},
                  {"claim": "dm: Anti-Schuppen Shampoo; Für trockene und schuppige Kopfhaut", "grade": "low", "use": "E2 dandruff unit graded low -> positioning gate fails (E1)"}],
    focusPrimary=prop("scalp_active", "moderate", "scalp_active: the only dandruff claim is retailer (low), which may act as candidate because the formula independently supports it (Piroctone Olamine 6); CL-SRC caps confidence at moderate.",
                      "No graded claim above low; name word 'Sensitive' names no scalp.", "general",
                      [{"ingredient": "Piroctone Olamine", "position": 6}], ["dm.de (low)"]),
    focusSecondary=sec_empty(["moisture"], "Empty.", []),
    usageRole=usage("regular", "none", [], "treatment needs a dandruff claim graded moderate or high (U3); retailer-only."),
    scalpComfortTarget=scalp("not_targeted", "high", "not_targeted: no SC1 unit graded moderate+; CSA fails.", "-", "none", False, False),
    focusRecord=focus_record("not_applicable", {}, "candidate", "Low-graded claim only.",
                             {"primary": {"claimDirection": "anti-dandruff (retailer, low)", "formulaCompatible": True, "compatibleRoute": "Piroctone Olamine (6)", "reason": "CL-SRC low candidate, capped moderate"}}),
    primaryTarget=target("ordinary", "moderate", "S-ORDINARY way 4: dandruff claim exists only in retailer copy (low), so S-DANDRUFF positioning fails (S-FAIL); recognized active present (way 3 also describes it).", [4, 3]),
    extraFlags=[{"code": "review_specialist_gate_failed", "detail": "dandruff: positioning gate failed - only E2 dandruff units are dm retailer copy (low, E1); formula gate passes (Piroctone Olamine 6)"}],
    D1=NO_D1,
    changes=[{"field": "focusPrimary", "blind": "general", "final": "scalp_active (moderate)", "evidence": "retailer dandruff claim + active", "reason": "CL-SRC"}],
    uncertainties=[{"reading": "focusPrimary scalp_active from a low claim", "alternative": "general"},
                   {"reading": "S-FAIL with a low-graded dandruff claim rather than note active_without_dandruff_positioning", "alternative": "way 3 only, note instead of review flag"}])
