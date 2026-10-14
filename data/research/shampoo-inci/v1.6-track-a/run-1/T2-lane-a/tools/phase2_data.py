# Lane A, batch T2 - final (post-unblind) judgments. Formula properties (cleansing,
# conditioning, weight, dandruffSupport) are carried unchanged from the frozen blind pass.

def FP(value, conf, neighbor, rationale, counter, facts, claimRole):
    return {"value": value, "confidence": conf, "neighboringAlternative": neighbor, "rationale": rationale,
            "counterSignal": counter, "formulaFacts": [{"ingredient": i, "position": p} for i, p in facts], "claimRole": claimRole}

def FS(value, conf, neighbor, rationale, counter="Secondary candidates fail Section 8 (distinct graded positioning plus independent route).", facts=()):
    return {"value": value, "confidence": conf, "neighboringAlternative": neighbor, "rationale": rationale,
            "counterSignal": counter, "formulaFacts": [{"ingredient": i, "position": p} for i, p in facts]}

def UR(value, conf, neighbor, rationale, counter, trigger="none", evidence=(), losing=()):
    return {"value": value, "confidence": conf, "neighboringAlternative": neighbor, "rationale": rationale,
            "counterSignal": counter, "triggerCode": trigger, "triggerEvidence": list(evidence), "losingTriggers": list(losing), "formulaFacts": []}

def SC(value, conf, neighbor, rationale, counter, facts=()):
    return {"value": value, "confidence": conf, "neighboringAlternative": neighbor, "rationale": rationale,
            "counterSignal": counter, "formulaFacts": [{"ingredient": i, "position": p} for i, p in facts]}

def CARE(verdict, moist, rep, shared, lim):
    return {"verdict": verdict, "moistureRoutes": moist, "repairRoutes": rep, "sharedConditioningRoutes": shared, "limitation": lim}

def TRACE(pClaim, pCompat, pRoute, pReason, sSel, sClaims, sRoutes, sDistinct, uTrig, uEvid, uRat, sExc=None):
    return {"primaryFocus": {"claimDirection": pClaim, "formulaCompatible": pCompat, "compatibleRoute": pRoute, "decisionReason": pReason},
            "secondaryFocus": {"emptyDefaultConsidered": True, "selectedValues": sSel, "matchingDistinctClaims": sClaims,
                               "independentRoutes": sRoutes, "whyDistinctFromPrimary": sDistinct, "exceptionCode": sExc},
            "usageRole": {"default": "regular", "nonDefaultTriggerCode": uTrig, "triggerEvidence": uEvid, "rationale": uRat}}

def ORD(conf, ways, rat):
    return {"primary": {"target": "ordinary", "confidence": conf, "sOrdinaryWays": ways, "rationale": rat}}

def CH(blindFocus, finalFocus, usage, sct, sec="[] -> unchanged", extra=()):
    out = [
        {"property": "focusPrimary", "blind": "general (provisional, low)", "final": finalFocus[0], "evidence": finalFocus[1], "reason": "Post-unblind reconciliation (3.2): claims identify/confirm the candidate job; formula compatibility checked against the frozen verdict."},
        {"property": "focusSecondary", "blind": "[] (provisional, low)", "final": sec, "evidence": "Revealed positioning", "reason": "Section 8 / F2-F3 checked."},
        {"property": "usageRole", "blind": "regular (provisional, low)", "final": usage[0], "evidence": usage[1], "reason": "Section 9 triggers checked mechanically with CL-SRC grades."},
        {"property": "scalpComfortTarget", "blind": "not_targeted (provisional, low; CSA recorded)", "final": sct[0], "evidence": sct[1], "reason": "SC1 positioning plus CSA formula half (Section 10)."},
        {"property": "cleansingStrength / conditioningLevel / weightPotential / dandruffSupport", "blind": "frozen formula values", "final": "unchanged", "evidence": "Claims may not assign or move formula properties (3.2, 6.5 step 5, C7).", "reason": "No formula error found on reconciliation."},
    ]
    return out + list(extra)

ND_NOTE = []
LOWSRC = "All positioning sources are retailer or foreign-manufacturer copy graded low (CL-SRC/E1)"

FINAL = {}

# ------------------------------------------------------------------ T201 Hask Curl Care
FINAL["T201"] = dict(
 focusPrimary=FP("general", "moderate", "moisture",
   "General: the frozen formula verdict is dual_supported (moisture and repair both supported). Every moisture/repair claim is retailer or foreign-manufacturer copy graded low, and a low claim can never act as tie_breaker (CL-SRC), so the tie stays unresolved and the honest fallback applies (7.2, 7.3).",
   "Formula is a rich care architecture and the dominant (low-graded) claim is moisture ('Feuchtigkeitsspendend').",
   [("Glycerin", 5), ("Panthenol", 10), ("Cocos Nucifera Oil", 7), ("Argania Spinosa Kernel Oil", 8), ("Polyquaternium-10", 13)], "not_applicable"),
 focusSecondary=FS([], "moderate", ["moisture"], "Empty: no claim graded moderate or high; low claims cannot open a secondary role."),
 usageRole=UR("regular", "high", "none", "Regular: 'Ideal für die tägliche Haarwäsche' (dm) and 'Gentle enough for daily use' (US manufacturer) are graded low and cannot fire `frequent` (U2, CL-SRC).", "Daily-use wording exists only in low-graded sources."),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no E2 sensitive or dry scalp claim unit; 'reinigt sanft' and 'ohne die natürlichen Öle anzugreifen' are mildness/protective wording (E2a).", "CSA formula half would pass (Panthenol 10, Glycerin 5).", [("Panthenol", 10), ("Glycerin", 5)]),
 focusRecord={"careDirection": CARE("dual_supported", ["Glycerin 5", "Panthenol 10"], ["Argania Spinosa Kernel Oil 8", "Polyimide-1 12"], ["Polyquaternium-10 13", "Polyquaternium-7 15", "Guar Hydroxypropyltrimonium Chloride 18", "Cocos Nucifera Oil 7"], "Oil and polymer levels bounded by position; no protein or bond route; tie unresolved."),
              "claimRole": "not_applicable", "counterSignal": "Low-graded moisture claim dominates the retailer copy.", "neighboringAlternative": "moisture"},
 decisionTrace=TRACE("moisture (low-graded retailer/foreign copy)", True, "Glycerin 5 + Panthenol 10 + oils 7/8 + cationic polymers", "dual_supported tie cannot be broken by a low-graded claim (CL-SRC) -> general",
   [], [], [], "n/a", "none", ["'Ideal für die tägliche Haarwäsche' (retailer_dm_de, low) - cannot fire"], "No trigger from a moderate/high source."),
 targets=ORD("moderate", [1], "S-ORDINARY way 1: no qualifying E2 claim unit. Confidence moderate: only retailer copy and a foreign manufacturer page (graded like retailer copy, E1)."),
 changes=CH(None, ("general", "Low-graded moisture claims; dual_supported verdict"), ("regular", "Daily-use wording only in low sources"), ("not_targeted", "No scalp claim")),
 unc=["focusPrimary general vs moisture: a lane reading the frozen verdict as moisture_supported (polymers/oils as shared routes) would accept the low claim as candidate and pick moisture at moderate. Kept the frozen dual_supported verdict; claims cannot rewrite it.",
      "Product name: frozen packet name 'Hask Curl Care Shampoo'; dm/Müller name 'curls + coconut oil'. Neither names a focus (curl is hair_texture, T2)."],
)

# ------------------------------------------------------------------ T202 Guhl Frische & Leichtigkeit
FINAL["T202"] = dict(
 focusPrimary=FP("clarifying", "moderate", "general",
   "Clarifying: the exact German manufacturer page (moderate) positions it as 'Anti-Fett Shampoo ... für normales bis schnell fettendes Haar' and 'Verzögert das Nachfetten' (E2 oily lexicon). F6 compatibility holds: cleansingStrength moderate, conditioningLevel moderate (not high), weightPotential low (not high).",
   "Product name ('Frische und Leichtigkeit') does not itself name oily scalp; formula is an ordinary C1 chassis, not a reset architecture; a dandruff active (Piroctone Olamine 13) is present without dandruff positioning.",
   [("Sodium Laureth Sulfate", 2), ("Cocamidopropyl Betaine", 3), ("Zinc PCA", 10)], "candidate"),
 focusSecondary=FS([], "high", "none", "Empty: moisture ('spendet intensiv Feuchtigkeit') appears only in retailer copy (low); formula moisture verdict nonspecific."),
 usageRole=UR("regular", "high", "none", "Regular: oily-scalp reset intent (U4) exists at moderate grade, but cleansingStrength is moderate, so `alternating` cannot fire; no frequency wording.", "Reset intent present (Anti-Fett).", losing=["strong_plus_reset_intent: not fired (cleansingStrength moderate)"]),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no E2 sensitive or dry scalp claim; 'ohne auszutrocknen' is protective wording (E2a).", "CSA formula half would pass (Panthenol 11).", [("Panthenol", 11)]),
 focusRecord={"careDirection": CARE("not_applicable", [], [], [], "Focus is clarifying, not a repair/moisture decision."), "claimRole": "candidate",
              "counterSignal": "Ordinary C1 chassis; oily claim not in product name.", "neighboringAlternative": "general"},
 decisionTrace=TRACE("clarifying via oily-scalp positioning (manufacturer_de, moderate)", True, "C1 moderate SLES chassis, weightPotential low, conditioning moderate (F6)", "Oily-scalp positioning plus compatible architecture -> clarifying (7.2, F6)",
   [], [], [], "n/a", "none", ["'Anti-Fett Shampoo' (manufacturer_de, moderate) is reset intent but cleansingStrength is moderate"], "alternating needs a strong formula (Section 9)."),
 targets={"primary": {"target": "oily", "confidence": "moderate", "rationale": "S-OILY: positioning 'Anti-Fett Shampoo', 'für normales bis schnell fettendes Haar', 'Verzögert das Nachfetten' (manufacturer_de, moderate, E1/E2). Formula clause: cleansingStrength moderate, weightPotential low, conditioningLevel moderate -> passes. Confidence = lowest of positioning (moderate), cleansingStrength (high), weightPotential (moderate), conditioningLevel (moderate) = moderate. S-DANDRUFF: active without dandruff claim -> no dandruff target (R17.3)."}},
 notes=[{"code": "active_without_dandruff_positioning", "detail": "Piroctone Olamine (13) present; no dandruff claim in any source."}],
 changes=CH(None, ("clarifying", "manufacturer_de: 'Anti-Fett Shampoo', 'schnell fettendes Haar'"), ("regular", "no qualifying trigger"), ("not_targeted", "no sensitive/dry claim")),
 unc=["Piroctone Olamine without dandruff claim treated as a regular shampoo (R17.3); it restricts no target."],
)

# ------------------------------------------------------------------ T203 Cantu
FINAL["T203"] = dict(
 focusPrimary=FP("general", "high", "none",
   "General: claims ('removes buildup', 'protect against breakage', 'nourish curls') are retailer or foreign-manufacturer copy graded low, and the frozen formula verdict is nonspecific, so no specialist focus has a claim-plus-formula case (7.2).",
   "Shea butter and polymers exist but are all after Parfum.", [("Glycerin", 5), ("Butyrospermum Parkii Butter", 10), ("Polyester-37", 11)], "not_applicable"),
 focusSecondary=FS([], "high", "none", "Empty: no moderate/high claim."),
 usageRole=UR("regular", "high", "none", "Regular: buildup-removal wording ('Entfernt sanft Produktrückstände', 'removes heavy build-up') is low-graded and the formula is moderate; no trigger.", "Low-graded reset wording."),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no E2 sensitive/dry scalp claim; 'sanfte Reinigung und Pflege von Haar und Kopfhaut' is mildness wording.", "CSA formula half passes (Glycerin 5).", [("Glycerin", 5)]),
 focusRecord={"careDirection": CARE("nonspecific", ["Glycerin 5"], ["Butyrospermum Parkii Butter 10"], ["Guar Hydroxypropyltrimonium Chloride 15", "Polyquaternium-39 19"], "All care routes post-fragrance."), "claimRole": "not_applicable",
              "counterSignal": "Low-graded care claims.", "neighboringAlternative": "none"},
 decisionTrace=TRACE("care/curls (low-graded)", True, "nonspecific", "No moderate/high claim and nonspecific formula -> general", [], [], [], "n/a", "none", [], "No trigger."),
 targets=ORD("moderate", [1], "S-ORDINARY way 1: no qualifying E2 claim unit. Confidence moderate: retailer copy and a foreign manufacturer page only (E1)."),
 changes=CH(None, ("general", "low-graded claims only"), ("regular", "no trigger"), ("not_targeted", "no scalp claim")),
 unc=["Formula source tier 4 (another reputable retailer); UK manufacturer page warns lists may vary by region. Packet states complete; no material conflict visible to the lane (ID-3)."],
)

# ------------------------------------------------------------------ T204 Pantene Grow Abundance
FINAL["T204"] = dict(
 focusPrimary=FP("general", "high", "none",
   "General: every claim is hair-loss/hair-growth/density positioning (F5, ignored for focus) in retailer copy graded low; 'stärkt feines, schwaches Haar' / 'verringert Haarbruch' are low-graded and the frozen care verdict is nonspecific, so no specialist focus qualifies.",
   "Dandruff active present but no dandruff claim (R17.3).", [("Piroctone Olamine", 6), ("Dimethiconol", 10), ("Guar Hydroxypropyltrimonium Chloride", 11)], "not_applicable"),
 focusSecondary=FS([], "high", "none", "Empty."),
 usageRole=UR("regular", "high", "none", "Regular: no dandruff claim (treatment needs U3); 'Verwende dieses Shampoo regelmäßig' is not frequency wording and is low-graded.", "Active present but no dandruff positioning (U3 note)."),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no sensitive/dry scalp claim; hair-root claims are out of scope.", "CSA formula half fails anyway (no prominent E4 route)."),
 focusRecord={"careDirection": CARE("nonspecific", [], [], ["Dimethiconol 10", "Guar 11", "Dimethicone 14"], "Low-graded breakage claim; nonspecific formula."), "claimRole": "not_applicable",
              "counterSignal": "Hair-loss positioning dominates (F5).", "neighboringAlternative": "none"},
 decisionTrace=TRACE("hair loss (F5, ignored); breakage (low)", True, "nonspecific", "F5 removes hair-loss claim; remaining claim low-graded over nonspecific formula -> general", [], [], [], "n/a", "none", [], "No trigger; active without dandruff claim cannot fire treatment (U3)."),
 targets=ORD("moderate", [1, 2, 3], "S-ORDINARY ways 1 (no qualifying E2 claim), 2 (only scalp-adjacent positioning is hair loss), 3 (Piroctone Olamine without dandruff claim). Lowest confidence of the ways = moderate (retailer-only sources)."),
 notes=[{"code": "active_without_dandruff_positioning", "detail": "Piroctone Olamine (6); no dandruff claim."}, {"code": "hair_loss_claim_not_evaluated", "detail": "'Anti-Haarverlust-Shampoo', 'reduziert Haarverlust um bis zu 90%'"}],
 changes=CH(None, ("general", "hair-loss claims (F5)"), ("regular", "no trigger"), ("not_targeted", "no scalp claim")),
 unc=["Identity confidence moderate in the packet; formula identity accepted as given (tier 3)."],
)

# ------------------------------------------------------------------ T205 Sebamed Urea 5%
FINAL["T205"] = dict(
 focusPrimary=FP("scalp_active", "moderate", "general",
   "Scalp_active: the exact German manufacturer page (moderate) positions it for 'juckende Kopfhaut' (Anti-Juckreiz), 'Beruhigung der Kopfhaut' and reduced 'Trockenheit der Kopfhaut' (E2 sensitive and dry). scalpComfortTarget is targeted (Urea 2, Laureth-9 = Polidocanol 5 prominent). F7: product name 'Sebamed Urea 5%' names neither role, so the scalp role is primary.",
   "Lengths claim 'trockenes/strapaziertes Haar' competes; SLES is present.", [("Urea", 2), ("Laureth-9", 5)], "candidate"),
 focusSecondary=FS([], "moderate", ["moisture"], "Empty: 'trockenes Haar' is distinct positioning, but the only formula support (Urea 2) is already cited by the primary scalp route (F3); the lengths care verdict is nonspecific.",
   "Distinct dry-hair positioning (manufacturer, moderate)."),
 usageRole=UR("regular", "high", "none", "Regular: 'Akutpflege' is not D1, not frequency wording; treatment needs a dandruff active (none).", "Acute-care positioning is not a Section 9 trigger."),
 scalpComfortTarget=SC("targeted", "moderate", "not_targeted",
   "Targeted: SC1 met by manufacturer_de (moderate) units 'gezielte Akutpflege für juckende Kopfhaut', 'unterstützt eine nachhaltige Beruhigung der Kopfhaut', 'Trockenheit der Kopfhaut ... reduziert'; CSA met by prominent Urea (2, comfort and humectant list) and Laureth-9/Polidocanol (5, comfort list). Mild-leaning chassis (C1 moderate) supports it.",
   "Declared Parfum; SLES present at 7.", [("Urea", 2), ("Laureth-9", 5)]),
 focusRecord={"careDirection": CARE("nonspecific", ["Urea 2"], [], ["Hydroxypropyl Oxidized Starch PG-Trimonium Chloride 15"], "Lengths care minimal; scalp focus decided by F7."), "claimRole": "candidate",
              "counterSignal": "Competing dry-hair lengths claim.", "neighboringAlternative": "general"},
 decisionTrace=TRACE("scalp_active (sensitive + dry scalp, manufacturer_de moderate)", True, "Urea 2 + Laureth-9/Polidocanol 5 (CSA, E4)", "F7 step 2: neither role in product name -> scalp_active, formula-compatible (targeted)",
   [], ["'trockenes/strapaziertes Haar' (moderate)"], ["none independent (Urea 2 cited by primary, F3)"], "Same ingredient would carry two routes (F3)", "none", [], "No trigger."),
 targets={"primary": {"target": "sensitive", "confidence": "moderate", "rationale": "S-SENSITIVE: positioning 'Anti-Juckreiz', 'für juckende Kopfhaut', 'Beruhigung der Kopfhaut' (manufacturer_de, moderate); formula: scalpComfortTarget targeted + prominent comfort routes Urea (2), Laureth-9/Polidocanol (5). cleansingStrength moderate -> no review flag. S-PRIMARY: product name names no target -> order sensitive, dry -> sensitive primary. Confidence = min(positioning moderate, scalpComfortTarget moderate) = moderate."},
          "secondary": {"target": "dry", "confidence": "moderate", "rationale": "S-DRY: own claim units 'Haartyp: trockene/sehr trockene Kopfhaut' and 'die Trockenheit der Kopfhaut um bis zu 63 % reduziert' (manufacturer_de, moderate); formula: targeted + prominent humectant Urea (2). Distinct unit, no dandruff claim on the product. Confidence moderate."}},
 changes=CH(None, ("scalp_active", "manufacturer_de sensitive/dry scalp claims"), ("regular", "no trigger"), ("targeted", "SC1 + CSA (Urea 2, Polidocanol 5)")),
 claimInci=[{"claim": "Polidocanol", "inci": "Laureth-9 (position 5)", "result": "match; confirms the blind reading for the E4 comfort list"}, {"claim": "Urea 5%", "inci": "Urea (position 2)", "result": "match"}, {"claim": "Stärkederivat (Rossmann)", "inci": "Hydroxypropyl Oxidized Starch PG-Trimonium Chloride (15)", "result": "match"}],
 unc=["Rossmann copy says 'milde Tensidkombination (Zuckertenside)'; claims do not move cleansingStrength (C1 moderate, neighbor low). A low neighbor would make intensity gentle and match both buckets; I3 raises nothing because the current intensity already differs (amber)."],
)

# ------------------------------------------------------------------ T206 Neqi Volume Victory
FINAL["T206"] = dict(
 focusPrimary=FP("volume", "high", "none",
   "Volume: 'Volume' is in the exact product name (graded high, CL-SRC). Formula is compatible: weightPotential low, conditioningLevel low, mild C6 chassis, light film routes (Polyquaternium-11 17).",
   "Lengths-care wording ('stärkt die Haarstruktur', Pro-Vitamin B5) only in low-graded sources.", [("Polyquaternium-11", 17), ("Avena Sativa Peptide", 8)], "candidate"),
 focusSecondary=FS([], "high", "none", "Empty: strengthening/moisture claims are low-graded (Swiss shop page, Notino)."),
 usageRole=UR("regular", "high", "none", "Regular: no frequency wording from a moderate/high source.", "None."),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no E2 scalp claim ('alle Arten von Kopfhaut' is not positioning).", "CSA formula half fails anyway (no prominent listed route)."),
 focusRecord={"careDirection": CARE("not_applicable", [], [], [], "Volume focus."), "claimRole": "candidate", "counterSignal": "No dedicated volumizing polymer beyond light PQ-11.", "neighboringAlternative": "none"},
 decisionTrace=TRACE("volume (product name, high)", True, "Low weight, low conditioning, Polyquaternium-11 17", "Name-claimed job plus compatible light formula -> volume", [], [], [], "n/a", "none", [], "No trigger."),
 targets=ORD("moderate", [1], "S-ORDINARY way 1. Confidence moderate: the manufacturer shop is a foreign (CH) page graded low, so the packet effectively has retailer-grade copy only (E1)."),
 changes=CH(None, ("volume", "product name 'Volume Victory'"), ("regular", "no trigger"), ("not_targeted", "no scalp claim")),
 claimInci=[{"claim": "Pro-Vitamin B5", "inci": "Panthenol (7)", "result": "match"}, {"claim": "Hemisqualan", "inci": "C13-15 Alkane (21)", "result": "match (hemisqualane = C13-15 alkane); trace, unchanged weight reading"}, {"claim": "Peptide, Goji, Malve, Tahiti-Gardenie", "inci": "Avena Sativa Peptide 8, Lycium Barbarum 10, Malva Sylvestris 11, Gardenia Taitensis 9", "result": "match"}],
)

# ------------------------------------------------------------------ T207 Balea Med Anti Schuppen
FINAL["T207"] = dict(
 focusPrimary=FP("scalp_active", "high", "none",
   "Scalp_active: 'Anti Schuppen' in the exact product name (high) and 'Shampoo gegen Schuppen' (moderate), with a recognized active (Piroctone Olamine 10).",
   "SLES chassis; lengths wording 'geschmeidig-glänzendes Haar'.", [("Piroctone Olamine", 10), ("Panthenol", 5), ("Bisabolol", 6), ("Niacinamide", 7)], "candidate"),
 focusSecondary=FS([], "high", "none", "Empty: 'Pflege, Feuchtigkeit, Glanz' are attribute tags without a distinct independent route (nonspecific lengths verdict)."),
 usageRole=UR("treatment", "high", "none", "Treatment: dandruffSupport supported and a qualifying dandruff claim in the product name (high) (U3). `frequent` also fires ('sanfte Pflege für jeden Tag', moderate, cleansing moderate) but loses to treatment (U1).",
   "Everyday-use wording.", "recognized_active_problem_led", ["'Anti Schuppen' (product name, high)", "Piroctone Olamine (10)"], ["explicit_frequent_non_strong ('für jeden Tag', moderate)"]),
 scalpComfortTarget=SC("not_targeted", "moderate", "targeted",
   "Not targeted: all sensitive/dry/itch wording ('Für empfindliche & trockene Kopfhaut', 'Kann Juckreiz mildern & die Kopfhaut beruhigen', the paragraph sentences) is bundled with the dandruff claim (consecutive list entries / same paragraph, E2b), and bundled wording is never SC1 positioning. CSA formula half would pass.",
   "Strong comfort architecture (Panthenol 5, Bisabolol 6, Niacinamide 7, fragrance-free).", [("Panthenol", 5), ("Bisabolol", 6), ("Niacinamide", 7)]),
 focusRecord={"careDirection": CARE("not_applicable", [], [], [], "Scalp focus."), "claimRole": "candidate", "counterSignal": "SLES chassis.", "neighboringAlternative": "none"},
 decisionTrace=TRACE("scalp_active / dandruff (name, high)", True, "Piroctone Olamine 10", "Problem-led product with recognized active and dandruff positioning -> scalp_active (7.2)",
   [], [], [], "n/a", "recognized_active_problem_led", ["'Balea Med Anti Schuppen' (name, high)", "Piroctone Olamine 10"], "U1: treatment beats frequent."),
 targets={"primary": {"target": "dandruff", "confidence": "high", "rationale": "S-DANDRUFF: 'Anti Schuppen' in the product name (high) + dandruffSupport supported (Piroctone Olamine 10, high). Dandruff path (R17.1): primary dandruff, no secondary target (R17.2)."}},
 notes=[{"code": "suits_dandruff_with_irritated_scalp", "detail": "Bundled comfort wording 'Kann Juckreiz mildern & die Kopfhaut beruhigen', 'Für empfindliche ... Kopfhaut' (manufacturer_de, moderate); S-SENSITIVE formula gate as CSA + prominent comfort route passes (Panthenol 5, Bisabolol 6, Niacinamide 7)."}],
 rct=["sensitive"], rctConf={"sensitive": "moderate"},
 changes=CH(None, ("scalp_active", "name 'Anti Schuppen'"), ("treatment", "U3"), ("not_targeted", "only bundled wording")),
 unc=["'Für empfindliche & trockene Kopfhaut' read as bundled (consecutive plain-list entry next to 'Shampoo gegen Schuppen'; ambiguity resolves to bundled, E2b). If read as separate, `dry` would also enter researchCombinationTargets (S-DRY gate: CSA + Glycerin 9) and scalpComfortTarget would become targeted; no projected row changes either way (R17.2).",
      "dm own-brand page treated as manufacturer_de (moderate) per the packet grade."],
)

# ------------------------------------------------------------------ T208 Plantur 39 Phyto-Coffein feines Haar
FINAL["T208"] = dict(
 focusPrimary=FP("general", "moderate", "repair",
   "General: hair-loss positioning dominates and is ignored (F5). The remaining in-scope claim is 'für feines, brüchiges Haar' (name, high); breakage maps to repair, but the frozen care verdict is nonspecific (Panthenol 4, one Polyquaternium-7 13, one late protein 17), so repair is not formula-supported (7.3, F1).",
   "High-graded breakage claim in the product name.", [("Caffeine", 9), ("Polyquaternium-7", 13), ("Hydrolyzed Wheat Protein", 17)], "candidate"),
 focusSecondary=FS([], "high", "none", "Empty."),
 usageRole=UR("frequent", "moderate", "regular", "Frequent: 'Täglich anwenden' / 'Bei jeder Haarwäsche benutzen' (manufacturer_de, moderate, U2) and cleansingStrength moderate (not strong).",
   "Daily use is tied to the hair-loss regimen; trigger is mechanical regardless.", "explicit_frequent_non_strong", ["'Täglich anwenden' (manufacturer_de, moderate)"]),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no E2 sensitive/dry claim ('Widerstandskraft von Kopfhaut und Haarfollikeln' is not in the lexicon).", "CSA formula half would pass (Panthenol 4, Niacinamide 16)."),
 focusRecord={"careDirection": CARE("nonspecific", ["Panthenol 4"], ["Hydrolyzed Wheat Protein 17"], ["Polyquaternium-7 13"], "One protein token; light by design."), "claimRole": "candidate",
              "counterSignal": "Breakage claim in name (high).", "neighboringAlternative": "repair"},
 decisionTrace=TRACE("hair loss (F5, ignored); repair via 'brüchiges Haar' (name, high)", False, "none (nonspecific verdict)", "F5 + F1: repair claim over nonspecific formula -> general",
   [], [], [], "n/a", "explicit_frequent_non_strong", ["'Täglich anwenden' (manufacturer_de, moderate)"], "U2 frequency wording with a non-strong formula."),
 targets=ORD("moderate", [1, 2], "S-ORDINARY ways 1 (no qualifying E2 claim; manufacturer source -> high) and 2 (only scalp-adjacent positioning is hair loss -> moderate); lowest = moderate."),
 notes=[{"code": "hair_loss_claim_not_evaluated", "detail": "'Beugt menopausalem Haarausfall vor', Phyto-Coffein-Complex"}],
 changes=CH(None, ("general", "F5 + nonspecific verdict"), ("frequent", "'Täglich anwenden' (moderate)"), ("not_targeted", "no scalp claim")),
 unc=["focusPrimary general vs repair: depends on reading PQ-7 + one protein as nonspecific (frozen verdict)."],
)

# ------------------------------------------------------------------ T209 SANTE Sensitive Care
FINAL["T209"] = dict(
 focusPrimary=FP("general", "moderate", "scalp_active",
   "General: F7 applies (sensitive-scalp claim 'Für sensibles Haar und empfindliche Kopfhaut', manufacturer_de, moderate, plus lengths repair wording). The name word 'Sensitive' does not name the scalp, so neither role is in the name; scalp_active fails formula compatibility because scalpComfortTarget is not_targeted (CSA fails), and repair fails because the frozen care verdict is nonspecific (three hydrolyzed proteins, no deposition system). -> general.",
   "Sensitive-scalp positioning would make scalp_active primary if a listed comfort/humectant route were prominent.", [("Hydrolyzed Corn Protein", 13), ("Hydrolyzed Wheat Protein", 14), ("Hydrolyzed Soy Protein", 15), ("Aloe Barbadensis Leaf Juice", 6)], "candidate"),
 focusSecondary=FS([], "moderate", ["repair"], "Empty: no compatible secondary role (repair verdict nonspecific)."),
 usageRole=UR("regular", "high", "none", "Regular: no frequency wording; no reset intent.", "None."),
 scalpComfortTarget=SC("not_targeted", "high", "none",
   "Not targeted: SC1 positioning is met ('für ... empfindliche Kopfhaut', manufacturer_de moderate), but CSA fails - no E4 comfort or humectant/refatting route is prominent (no Glycerin, Panthenol etc.). Missing route recorded; unlisted_route_candidate: Aloe Barbadensis Leaf Juice (6), Arginine (10), Lactococcus Ferment Lysate (9, the 'Probiotika').",
   "Explicit sensitive-scalp positioning; mild C5 chassis with four buffers.", [("Aloe Barbadensis Leaf Juice", 6), ("Arginine", 10), ("Lactococcus Ferment Lysate", 9)]),
 focusRecord={"careDirection": CARE("nonspecific", ["Aloe Barbadensis Leaf Juice 6 (not a listed humectant)"], ["Hydrolyzed Corn/Wheat/Soy Protein 13-15"], [], "No deposition system; proteins alone."), "claimRole": "candidate",
              "counterSignal": "Sensitive-scalp positioning.", "neighboringAlternative": "scalp_active"},
 decisionTrace=TRACE("scalp_active (sensitive scalp, moderate) vs repair (moderate)", False, "none: CSA fails; repair verdict nonspecific", "F7 step 2 fallbacks both incompatible -> general",
   [], [], [], "n/a", "none", [], "No trigger."),
 targets={"primary": {"target": "ordinary", "confidence": "moderate", "sOrdinaryWays": [4], "rationale": "S-ORDINARY way 4 (S-FAIL): sensitive claim ('für sensibles Haar und empfindliche Kopfhaut', moderate) fails the S-SENSITIVE formula gate (scalpComfortTarget not_targeted; no prominent E4 comfort route); dry-feeling claim ('Reduziert Spannungs- & Trockenheitsgefühle ... der Kopfhaut', moderate) fails S-DRY (not targeted; no prominent humectant route). Nothing else passes -> ordinary proposed, blocked by review_specialist_gate_failed. Confidence moderate (ways 2-4)."}},
 flags=[{"code": "review_specialist_gate_failed", "detail": "sensitive: formula gate (CSA fails; no prominent E4 comfort route); dry: formula gate (not targeted; no prominent E4 humectant route); unlisted_route_candidate:Aloe Barbadensis Leaf Juice; unlisted_route_candidate:Arginine; unlisted_route_candidate:Lactococcus Ferment Lysate"}],
 changes=CH(None, ("general", "F7 fallbacks incompatible"), ("regular", "no trigger"), ("not_targeted", "SC1 met, CSA fails")),
 unc=["'Reduziert Spannungs- & Trockenheitsgefühle und unterstützt den natürlichen pH-Wert der Kopfhaut' read as a dry-scalp claim unit (the sentence names the scalp); alternative: not a scalp claim. Either way the flag is raised by the sensitive failure.",
      "Name word 'Sensitive' ignored for F7 step 1 (does not name the scalp)."],
)

# ------------------------------------------------------------------ T210 ISANA MED Anti Schuppen
FINAL["T210"] = dict(
 focusPrimary=FP("scalp_active", "high", "none",
   "Scalp_active: 'Anti Schuppen' in the exact product name (high) plus pack/manufacturer dandruff claims (moderate) and a recognized active (Piroctone Olamine 8).",
   "Strong chassis; prominent Menthol (12); oily-hair claim.", [("Piroctone Olamine", 8), ("Panthenol", 10), ("Menthol", 12)], "candidate"),
 focusSecondary=FS(["clarifying"], "moderate", [],
   "Clarifying: distinct oily positioning 'reinigt schnell fettendes Haar' (pack back, moderate; E2 oily) with an independent compatible route - the reinforced ether-sulfate chassis (SLES 2 plus reinforcing ether sulfates 14-20), not cited by the scalp_active route (Piroctone Olamine 8). F6 compatibility holds (cleansing strong, conditioning low, weight low). Not 'clarifying only because cleansing is strong': the oily claim is its own unit.",
   "On the dandruff path oily scalp is a research-only sub-feature for targets (R17.2); a lane may read the secondary focus as empty.", [("Sodium Laureth Sulfate", 2), ("Sodium Laureth-8 Sulfate", 14), ("Magnesium Laureth Sulfate", 16)]),
 usageRole=UR("treatment", "high", "none", "Treatment: recognized active + dandruff claim in the product name (high) (U3). `alternating` also fires (cleansing strong + oily reset intent 'reinigt schnell fettendes Haar', moderate, U4) but loses (U1).",
   "Strong reset chassis with oily positioning.", "recognized_active_problem_led", ["'ISANA MED Shampoo Anti Schuppen' (name, high)", "Piroctone Olamine (8)"], ["strong_plus_reset_intent ('reinigt schnell fettendes Haar', pack, moderate)"]),
 scalpComfortTarget=SC("not_targeted", "moderate", "targeted",
   "Not targeted: the only dry-scalp unit, 'Coffein & Menthol gegen trockene Kopfhaut', is the list entry directly after 'Piroctone Olamine wirkt nachhaltig gegen Schuppen' (bundled, E2b) and is not SC1 positioning. CSA would pass (Panthenol 10, Glycerin 13).",
   "Prominent Menthol (12) and strong cleansing are counter-signals in any case.", [("Panthenol", 10), ("Menthol", 12)]),
 focusRecord={"careDirection": CARE("not_applicable", [], [], [], "Scalp focus."), "claimRole": "candidate", "counterSignal": "Strong chassis, Menthol.", "neighboringAlternative": "none"},
 decisionTrace=TRACE("scalp_active / dandruff (name, high)", True, "Piroctone Olamine 8", "Problem-led product with recognized active -> scalp_active",
   ["clarifying"], ["'reinigt schnell fettendes Haar' (pack_back, moderate)"], ["Reinforced ether-sulfate chassis (2, 14-20)"], "Primary route is the active; secondary rests on the surfactant chassis (F3)",
   "recognized_active_problem_led", ["'Anti Schuppen' (name, high)", "Piroctone Olamine 8"], "U1: treatment beats alternating."),
 targets={"primary": {"target": "dandruff", "confidence": "high", "rationale": "S-DANDRUFF: name 'Anti Schuppen' (high) + Piroctone Olamine (8). Dandruff path: no secondary target (R17.2); oily wording feeds only researchCombinationTargets."}},
 notes=[{"code": "suits_dandruff_with_oily_scalp", "detail": "'reinigt schnell fettendes Haar' (pack_back, moderate); S-OILY clause passes (cleansing strong, weight low, conditioning low)."},
        {"code": "hair_loss_claim_not_evaluated", "detail": "'Coffein hilft die Haarwurzel zu stärken' (hair-root/caffeine positioning, not evaluated)"}],
 rct=["oily"], rctConf={"oily": "moderate"},
 changes=CH(None, ("scalp_active", "name 'Anti Schuppen'"), ("treatment", "U3"), ("not_targeted", "dry wording bundled"), sec="[] -> ['clarifying'] ('reinigt schnell fettendes Haar', moderate; independent chassis route)"),
 unc=["'Coffein & Menthol gegen trockene Kopfhaut' read as bundled (consecutive list entry after a dandruff entry). If separate: S-DRY gate (CSA + prominent Glycerin 13/Glyceryl Oleate 7) would pass, `dry` and `oily` would contradict, and neither would be recorded (contradictory_scalp_states). Projection unaffected.",
      "focusSecondary ['clarifying'] vs []: alternative is reading oily wording on a dandruff product as absorbed for focus as well.",
      "Caffeine hair-root claim recorded under hair_loss_claim_not_evaluated (conservative; no target effect)."],
)

# ------------------------------------------------------------------ T211 GLISS Liquid Silk
FINAL["T211"] = dict(
 focusPrimary=FP("shine", "moderate", "repair",
   "Shine: the dominant manufacturer_de (moderate) claim is gloss and smoothing ('Schutz & gesund aussehender Glanz', 'glättet die Haaroberfläche und verleiht Glanz', 'für stumpfes, sprödes und glanzloses Haar'). Formula has a plausible smoothing/light-film route: Hydrolyzed Silk (6), Sericin (7), Glycosphingolipids (5, the claimed 'Ceramide'), Polyquaternium-10 (10).",
   "Repair wording ('schützt und stärkt das Haar', 'sprödes Haar') and a repair_supported frozen verdict.", [("Glycosphingolipids", 5), ("Hydrolyzed Silk", 6), ("Sericin", 7), ("Polyquaternium-10", 10)], "candidate"),
 focusSecondary=FS([], "moderate", ["repair"], "Empty: repair wording exists, but its formula route (silk, sericin, glycosphingolipids, PQ-10) is the same route cited for shine (F2/F3); the only other repair ingredients (Hydrogenated Castor Oil 18, apricot oil 21) are trace.",
   "Repair_supported verdict and moderate repair wording."),
 usageRole=UR("regular", "high", "none", "Regular: 'Regelmäßig ... anwenden' is not frequency wording (U2).", "None."),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no scalp claim.", "CSA would fail anyway."),
 focusRecord={"careDirection": CARE("repair_supported", [], ["Hydrolyzed Silk 6", "Sericin 7", "Glycosphingolipids 5"], ["Polyquaternium-10 10"], "Claims lead with gloss; repair route shared with shine."), "claimRole": "candidate",
              "counterSignal": "Repair wording and repair-supported formula.", "neighboringAlternative": "repair"},
 decisionTrace=TRACE("shine (manufacturer_de headline, moderate)", True, "Silk/sericin/ceramide smoothing + PQ-10 light film", "Dominant gloss claim with compatible smoothing route -> shine (7.1, 7.2)",
   [], ["'schützt und stärkt das Haar' (moderate)"], ["none independent (F3)"], "Same route as primary (F2)", "none", [], "No trigger."),
 targets=ORD("high", [1], "S-ORDINARY way 1: no qualifying E2 claim; manufacturer_de source present -> high."),
 changes=CH(None, ("shine", "manufacturer_de gloss/smoothing claims"), ("regular", "no trigger"), ("not_targeted", "no scalp claim")),
 claimInci=[{"claim": "Ceramide", "inci": "Glycosphingolipids (5)", "result": "match (ceramide-type lipid)"}, {"claim": "Seide", "inci": "Hydrolyzed Silk (6), Sericin (7)", "result": "match, named by the manufacturer"}],
 unc=["focusPrimary shine vs repair: claims lead with Glanz but also say 'sprödes Haar ... stärkt'; chose shine as the headline job, repair as neighbor."],
)

# ------------------------------------------------------------------ T212 Syoss Intense Keratin
FINAL["T212"] = dict(
 focusPrimary=FP("repair", "moderate", "general",
   "Repair: manufacturer_de (moderate) claims 'Repariert schwaches, leicht brüchiges Haar', 'Füllt das Haar mit Keratin auf', with a repair_supported frozen verdict (Hydrolyzed Keratin 6, Dimethicone 7, Amodimethicone 11, guar 12).",
   "Moderate weight; no humectant; '5% Keratin-Aufbau-Komplex' unprovable from INCI.", [("Hydrolyzed Keratin", 6), ("Dimethicone", 7), ("Amodimethicone", 11), ("Guar Hydroxypropyltrimonium Chloride", 12)], "candidate"),
 focusSecondary=FS([], "high", "none", "Empty: no distinct second role."),
 usageRole=UR("regular", "high", "none", "Regular: no trigger. 'Tiefenpflegende Formel' is a care term, explicitly not D1.", "None."),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no scalp claim.", "None."),
 focusRecord={"careDirection": CARE("repair_supported", [], ["Hydrolyzed Keratin 6", "Amodimethicone 11", "Dimethicone 7"], ["Guar Hydroxypropyltrimonium Chloride 12"], "Protein concentration unknown."), "claimRole": "candidate",
              "counterSignal": "No humectant; claimed 5% complex unverifiable.", "neighboringAlternative": "general"},
 decisionTrace=TRACE("repair (manufacturer_de, moderate)", True, "Hydrolyzed Keratin 6 + Amodimethicone 11", "Dominant repair claim plus repair_supported verdict -> repair", [], [], [], "n/a", "none", [], "No trigger."),
 targets=ORD("high", [1], "S-ORDINARY way 1; manufacturer_de source -> high."),
 d1rat="D1 false: 'Tiefenpflegende Formel' and 'Tiefenspülung' share the prefix but are care terms, explicitly Not D1 (13.6).",
 changes=CH(None, ("repair", "manufacturer_de repair claims"), ("regular", "no trigger"), ("not_targeted", "no scalp claim")),
 claimInci=[{"claim": "Keratin / 5% Keratin-Aufbau-Komplex", "inci": "Hydrolyzed Keratin (6)", "result": "match; the 5% figure is a concentration claim the INCI cannot prove (3.2)"}],
)

# ------------------------------------------------------------------ T213 OGX Argan
FINAL["T213"] = dict(
 focusPrimary=FP("repair", "moderate", "moisture",
   "Repair: retailer claims (low) 'repariert trockenes & geschädigtes Haar', 'kräftigt und nährt', 'schützt ... vor Schädigungen'. A low claim may act as candidate because the frozen verdict independently supports repair (repair_supported: argan oil 6, Amodimethicone 9, guar 10, Hydrogenated Castor Oil 11); confidence capped at moderate (CL-SRC).",
   "Moisture wording ('intensive Feuchtigkeit') competes; no deliberate humectant.", [("Argania Spinosa Kernel Oil", 6), ("Amodimethicone", 9), ("Guar Hydroxypropyltrimonium Chloride", 10), ("Hydrogenated Castor Oil", 11)], "candidate"),
 focusSecondary=FS([], "high", "none", "Empty: moisture claims are low-graded and the formula is not moisture_supported (no humectant)."),
 usageRole=UR("regular", "high", "none", "Regular: no trigger.", "None."),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no scalp claim.", "None."),
 focusRecord={"careDirection": CARE("repair_supported", [], ["Argania Spinosa Kernel Oil 6", "Amodimethicone 9", "Hydrogenated Castor Oil 11"], ["Guar Hydroxypropyltrimonium Chloride 10"], "No humectant; claims only low-graded."), "claimRole": "candidate",
              "counterSignal": "Low-graded claims; moisture wording.", "neighboringAlternative": "moisture"},
 decisionTrace=TRACE("repair (retailer, low)", True, "Argan oil 6 + Amodimethicone 9", "Low claim admitted as candidate because formula is repair_supported; confidence capped at moderate", [], [], [], "n/a", "none", [], "No trigger."),
 targets=ORD("moderate", [1], "S-ORDINARY way 1; retailer copy only -> moderate."),
 changes=CH(None, ("repair", "low-graded repair claims over repair_supported formula"), ("regular", "no trigger"), ("not_targeted", "no scalp claim")),
 unc=["Name word 'Renewing' not read as a focus claim (not a lexicon role word); repair rests on the low-graded retailer claim plus formula."],
)

# ------------------------------------------------------------------ T214 Pantene Volumen Pur
FINAL["T214"] = dict(
 focusPrimary=FP("volume", "high", "none",
   "Volume: 'Volumen' is in the exact product name (high). Formula is compatible: no deposition family, weightPotential low, conditioningLevel low.",
   "No dedicated volumizing polymer; volume is compatibility, not an active route.", [("Sodium Laureth Sulfate", 2), ("Hydroxypropyl Methylcellulose", 11)], "candidate"),
 focusSecondary=FS([], "high", "none", "Empty: bond/strength claims are low-graded."),
 usageRole=UR("regular", "high", "none", "Regular: 'Für die tägliche Haarwäsche geeignet' is Müller retailer copy (low) and cannot fire frequent.", "Low-graded daily wording."),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no scalp claim.", "None."),
 focusRecord={"careDirection": CARE("not_applicable", [], [], [], "Volume focus."), "claimRole": "candidate", "counterSignal": "No active volume route.", "neighboringAlternative": "none"},
 decisionTrace=TRACE("volume (product name, high)", True, "Deposition-free light formula", "Name-claimed job plus compatible formula -> volume", [], [], [], "n/a", "none", ["'Für die tägliche Haarwäsche geeignet' (retailer, low) - cannot fire"], "No trigger."),
 targets=ORD("moderate", [1], "S-ORDINARY way 1; retailer copy only -> moderate."),
 changes=CH(None, ("volume", "product name"), ("regular", "low-graded daily wording"), ("not_targeted", "no scalp claim")),
)

# ------------------------------------------------------------------ T215 Balea Professional Ultimate Volume
FINAL["T215"] = dict(
 focusPrimary=FP("volume", "high", "none",
   "Volume: 'Ultimate Volume' in the exact product name (high) and 'Volumen Shampoo; Für feines, plattes Haar; Mit Anti-Platt-Effekt' (dm own-brand, moderate). Formula compatible: weightPotential low.",
   "Guar plus protein are conditioning, not lift routes.", [("Hydrolyzed Wheat Protein", 6), ("Biotin", 7), ("Guar Hydroxypropyltrimonium Chloride", 10)], "candidate"),
 focusSecondary=FS([], "high", "none", "Empty."),
 usageRole=UR("regular", "high", "none", "Regular: no trigger.", "None."),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no scalp claim.", "None."),
 focusRecord={"careDirection": CARE("not_applicable", [], [], [], "Volume focus."), "claimRole": "candidate", "counterSignal": "Moderate conditioning.", "neighboringAlternative": "none"},
 decisionTrace=TRACE("volume (name, high)", True, "Light formula, weightPotential low", "Name-claimed job plus compatible formula -> volume", [], [], [], "n/a", "none", [], "No trigger."),
 targets=ORD("high", [1], "S-ORDINARY way 1; manufacturer-grade (dm own brand) source -> high."),
 changes=CH(None, ("volume", "product name"), ("regular", "no trigger"), ("not_targeted", "no scalp claim")),
 claimInci=[{"claim": "Biotin & Reis-Extrakt", "inci": "Biotin (7), Oryza Sativa Extract (8)", "result": "match"}],
 unc=["Packet notes the product is DELISTED at dm (replaced by Hydra Volume). Classification of the frozen formula is unaffected; catalog relevance is the orchestrator's call."],
)

# ------------------------------------------------------------------ T216 ISANA MED Ultra Sensitiv+ Anti-Schuppen
FINAL["T216"] = dict(
 focusPrimary=FP("scalp_active", "high", "none",
   "Scalp_active: 'Anti-Schuppen' in the exact product name (high), 'stark & nachhaltig gegen Schuppen' (moderate), recognized active Piroctone Olamine (5).",
   "None material.", [("Piroctone Olamine", 5), ("Panthenol", 8), ("Niacinamide", 9), ("Bisabolol", 10)], "candidate"),
 focusSecondary=FS([], "high", "none", "Empty."),
 usageRole=UR("treatment", "high", "none", "Treatment: recognized active + dandruff claim in the product name (high) (U3).", "None.", "recognized_active_problem_led", ["'Anti-Schuppen' (name, high)", "Piroctone Olamine (5)"]),
 scalpComfortTarget=SC("not_targeted", "high", "none",
   "Not targeted: no SC1 unit. 'Sensitiv+' in the name does not name the scalp; 'sehr sensibler Haut' does not name the scalp; 'sanft zur Kopfhaut' is sparing wording (E2a); allergy-tested wording is protective. CSA would pass (Panthenol 8, Niacinamide 9, Bisabolol 10).",
   "Fragrance-free, strong comfort architecture.", [("Panthenol", 8), ("Niacinamide", 9), ("Bisabolol", 10)]),
 focusRecord={"careDirection": CARE("not_applicable", [], [], [], "Scalp focus."), "claimRole": "candidate", "counterSignal": "SLES chassis.", "neighboringAlternative": "none"},
 decisionTrace=TRACE("scalp_active / dandruff (name, high)", True, "Piroctone Olamine 5", "Problem-led product with active -> scalp_active", [], [], [], "n/a", "recognized_active_problem_led", ["'Anti-Schuppen' (name, high)", "Piroctone Olamine 5"], "U3."),
 targets={"primary": {"target": "dandruff", "confidence": "high", "rationale": "S-DANDRUFF: 'Anti-Schuppen' in the product name (high) + Piroctone Olamine (5). Dandruff path, no secondary (R17.2). No comfort wording qualifies for E2b ('sanft zur Kopfhaut' is sparing wording, 'sensibler Haut' does not name the scalp), so researchCombinationTargets is empty and no E2b note is recorded."}},
 rct=[],
 changes=CH(None, ("scalp_active", "name 'Anti-Schuppen'"), ("treatment", "U3"), ("not_targeted", "no SC1 unit")),
 unc=["'sehr sensibler Haut' / 'Ultra sensitiv' read as not naming the scalp (E2). If read as sensitive-scalp wording, `sensitive` would enter researchCombinationTargets (gate passes); no row changes."],
)

# ------------------------------------------------------------------ T217 Balea Professional Aqua Hyaluron
FINAL["T217"] = dict(
 focusPrimary=FP("general", "moderate", "moisture",
   "General: moisture positioning ('Feuchtigkeitsspendendes Shampoo', 'Für trockenes & feuchtigkeitsbedürftiges Haar', dm own-brand, moderate) sits over a nonspecific formula verdict: the only humectant (Sodium Hyaluronate 13) and the guar (10) are post-fragrance, with no humectant cluster. F1: moisture language over a nonspecific formula stays general.",
   "Moderate-graded moisture claim plus a hyaluronate and a cationic guar.", [("Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", 10), ("Aloe Barbadensis Leaf Juice Powder", 11), ("Sodium Hyaluronate", 13)], "candidate"),
 focusSecondary=FS([], "high", "none", "Empty."),
 usageRole=UR("regular", "high", "none", "Regular: no trigger.", "None."),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: 'die Kopfhaut geschont' is sparing wording (E2a).", "None."),
 focusRecord={"careDirection": CARE("nonspecific", ["Sodium Hyaluronate 13", "Aloe Barbadensis Leaf Juice Powder 11"], [], ["Hydroxypropyl Guar Hydroxypropyltrimonium Chloride 10", "Glyceryl Oleate 9"], "Single late humectant; no cluster."), "claimRole": "candidate",
              "counterSignal": "Moisture claim (moderate).", "neighboringAlternative": "moisture"},
 decisionTrace=TRACE("moisture (manufacturer_de, moderate)", False, "nonspecific verdict", "F1: moisture claim over nonspecific formula -> general", [], [], [], "n/a", "none", [], "No trigger."),
 targets=ORD("high", [1], "S-ORDINARY way 1; manufacturer-grade (dm own brand) source -> high."),
 changes=CH(None, ("general", "moisture claim over nonspecific verdict (F1)"), ("regular", "no trigger"), ("not_targeted", "sparing wording")),
 claimInci=[{"claim": "Hyaluron", "inci": "Sodium Hyaluronate (13)", "result": "match"}, {"claim": "Aloe Vera", "inci": "Aloe Barbadensis Leaf Juice Powder (11)", "result": "match"}],
 unc=["focusPrimary general vs moisture: hinges on the frozen nonspecific verdict (late single humectant). A lane reading hyaluronate + guar + refatters as a moisture cluster would choose moisture at moderate."],
)

# ------------------------------------------------------------------ T218 Langhaarmädchen Beautiful Curls
FINAL["T218"] = dict(
 focusPrimary=FP("general", "moderate", "moisture",
   "General: all claims are dm retailer copy graded low and none is a moisture/repair claim ('Sprungkraft', 'definierte Locken', 'Glanz', 'Volumen am Ansatz'). Curl definition is hair_texture, not a focus. The formula is moisture_supported, but no moisture claim exists to act as candidate, and a low volume/shine mention without a matching formula verdict cannot select a focus.",
   "Formula is moisture_supported (Glycerin 10, PCA 12, Sodium PCA 20, amino acids, Glyceryl Oleate 11, guar 17).", [("Glycerin", 10), ("Sodium PCA", 20), ("Glyceryl Oleate", 11)], "not_applicable"),
 focusSecondary=FS([], "high", "none", "Empty."),
 usageRole=UR("regular", "high", "none", "Regular: no trigger.", "None."),
 scalpComfortTarget=SC("not_targeted", "high", "none", "Not targeted: no scalp claim.", "CSA would fail (no prominent listed route)."),
 focusRecord={"careDirection": CARE("moisture_supported", ["Glycerin 10", "PCA 12", "Sodium PCA 20", "free amino acids"], [], ["Glyceryl Oleate 11", "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride 17"], "No moisture claim to pair with."), "claimRole": "not_applicable",
              "counterSignal": "Moisture-supported formula.", "neighboringAlternative": "moisture"},
 decisionTrace=TRACE("curls/bounce (low; hair_texture)", True, "moisture_supported but unclaimed", "No in-scope claim -> general", [], [], [], "n/a", "none", [], "No trigger."),
 targets=ORD("moderate", [1], "S-ORDINARY way 1; retailer copy only -> moderate."),
 changes=CH(None, ("general", "no in-scope claim"), ("regular", "no trigger"), ("not_targeted", "no scalp claim")),
 unc=["Brand is a dm-exclusive brand, but the packet grades the dm page as retailer (low); followed the packet grade."],
)
