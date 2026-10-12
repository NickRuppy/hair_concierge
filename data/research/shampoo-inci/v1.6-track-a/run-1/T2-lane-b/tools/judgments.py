"""Lane B, batch T2: hand-entered post-unblind judgments (Section 3.2 reconciliation)."""


def P(value, conf, nb, rationale, counter, facts, rules, sources):
    return {"value": value, "confidence": conf, "neighboringAlternative": nb, "rationale": rationale,
            "counterSignal": counter, "formulaFacts": facts, "ruleIds": rules, "sourceIds": sources}


def F(value, conf, nb, rationale, counter, facts, rules, sources, verdict, routes, claimRole):
    d = P(value, conf, nb, rationale, counter, facts, rules, sources)
    d["careDirection"] = {"verdict": verdict, **routes}
    d["claimRole"] = claimRole
    return d


def ordinary(ways, conf, rationale):
    return {"target": "ordinary", "shampoo_bucket": "normal", "scalp_route": "balanced", "confidence": conf,
            "sOrdinaryWays": ways, "rationale": rationale, "ruleIds": ["S-ORDINARY", "13.8"]}


def T(t, conf, pos, rationale, rules):
    b = {"oily": ("dehydriert-fettig", "oily"), "dry": ("trocken", "dry"), "sensitive": ("irritationen", "irritated"),
         "dandruff": ("schuppen", "dandruff")}[t]
    return {"target": t, "shampoo_bucket": b[0], "scalp_route": b[1], "confidence": conf,
            "positioningConfidence": pos, "rationale": rationale, "ruleIds": rules}


def usage(value, conf, nb, code, evidence, losing, rationale, facts=None):
    d = P(value, conf, nb, rationale, losing and ("losing triggers: " + ", ".join(losing)) or "No competing trigger fired.",
          facts or [], ["9", "U1", "U2", "U3", "U4", "CL-SRC"], ["reveal"])
    d["triggerCode"] = code
    return d, {"default": "regular", "triggerCode": code, "triggerEvidence": evidence, "losingTriggers": losing,
               "rationale": rationale}


def sec(selected, claims, routes, why, exc=None):
    return {"emptyDefaultConsidered": True, "selected": selected, "matchingDistinctClaims": claims,
            "independentRoutes": routes, "whyDistinct": why, "exceptionCode": exc}


NO_D1 = "D1 false: no tiefenrein/deep clean/clarifying shampoo/detox-reinigung stem in name or a manufacturer/pack claim, and no occasional-use directions."
J = {}

# ---------------------------------------------------------------- T201 Hask Curl Care
u, ut = usage("regular", "high", "none", "none",
              ["'Ideal für die tägliche Haarwäsche' (dm, retailer, low) and 'Gentle enough for daily use' (US manufacturer, low) cannot fire frequent (CL-SRC: only moderate/high claims fire triggers)."],
              ["frequent (blocked: claim graded low)"],
              "Regular: the only frequency wording is retailer or foreign-manufacturer copy graded low; cleansing is moderate, so alternating is impossible.")
J["T201"] = {
    "claimGrading": [
        {"claim": "Feuchtigkeitsspendend / spendet intensive Feuchtigkeit", "source": "retailer_dm_de, retailer_mueller_de", "grade": "low", "use": "moisture focus candidate"},
        {"claim": "moisturizing shampoo ... removes build-up", "source": "manufacturer_us (foreign)", "grade": "low", "use": "corroboration only (E1 foreign page)"},
        {"claim": "Ideal für die tägliche Haarwäsche", "source": "retailer_dm_de directions", "grade": "low", "use": "cannot fire frequent"},
        {"claim": "Ablagerungen schonend entfernt", "source": "retailer", "grade": "low", "use": "not reset intent (low; cleansing moderate anyway)"},
    ],
    "focusPrimary": F("moisture", "moderate", "general",
                      "Moisture: the formula verdict is moisture_supported (prominent Glycerin 5 and Panthenol 10 with oils 7/8 and three cationic polymers as conditioning support) and the only positioning, 'Feuchtigkeitsspendend', is a low-graded retailer claim, which may act as candidate because the formula independently supports moisture; CL-SRC caps confidence at moderate.",
                      "All claims are retailer or foreign-manufacturer copy (low); damage-protection wording ('vor Schäden schützen') points to repair; curl claims are hair_texture, not a focus.",
                      [{"ingredient": "Glycerin", "position": 5}, {"ingredient": "Panthenol", "position": 10}, {"ingredient": "Cocos Nucifera (Coconut) Oil", "position": 7}, {"ingredient": "Argania Spinosa (Argan) Kernel Oil", "position": 8}, {"ingredient": "Polyquaternium-10", "position": 13}],
                      ["7.2", "7.3", "F1", "CL-SRC"], ["reveal:retailer_dm_de", "reveal:retailer_mueller_de"],
                      "moisture_supported",
                      {"moistureRoutes": ["Glycerin 5", "Panthenol 10"], "repairRoutes": [], "sharedRoutes": ["Coconut Oil 7", "Argan Oil 8", "Polyquaternium-10 13", "Polyquaternium-7 15", "Guar 18", "Polyimide-1 12"],
                       "limitation": "Oils and polymers are shared conditioning routes; no protein or damage-care cluster distinguishes repair."},
                      "candidate"),
    "focusSecondary": P([], "moderate", ["repair"], "Empty: the repair-type 'schützt vor Schäden' wording is low-graded and the formula has no repair route independent of the moisture/shared routes (F3, CL-SRC).",
                        "Damage-protection claim exists (low).", [], ["8", "F2", "F3", "CL-SRC"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no E2 sensitive or dry-scalp claim unit in any source; 'reinigt sanft' is mildness.", "CSA formula half would be met (Panthenol 10).", [{"ingredient": "Panthenol", "position": 10}], ["10", "SC1", "CSA"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "moisture (low-graded retailer)", "formulaCompatible": True, "compatibleRoute": "Glycerin 5 + Panthenol 10 humectant cluster with oil/polymer conditioning support", "decisionReason": "Low claim acts as candidate because the formula verdict independently supports moisture; confidence capped at moderate."},
                      "secondary": sec([], [], [], "No distinct moderate-graded secondary positioning with an independent route."), "usage": ut},
    "primary": ordinary([1], "moderate", "Ordinary (S-ORDINARY way 1): no qualifying E2 claim unit; the packet has retailer copy and a foreign manufacturer page only (graded low, treated as retailer-only), so confidence moderate."),
    "d1Rationale": NO_D1,
    "changes": [{"property": "focusPrimary", "blind": "general (provisional, low)", "final": "moisture (moderate)", "evidence": "dm/Müller 'Feuchtigkeitsspendend', 'spendet intensive Feuchtigkeit'", "reason": "Claim identifies the candidate; formula verdict re-read as moisture_supported (blind provisional said dual_supported); a low claim cannot be a tie_breaker, so the moisture call rests on the humectant cluster."},
                {"property": "focusPrimary.careDirection", "blind": "dual_supported (provisional)", "final": "moisture_supported", "evidence": "formula only", "reason": "On review no damage-care cluster distinguishes repair; oils/polymers are shared routes."},
                {"property": "usageRole/scalpComfortTarget/focusSecondary", "blind": "provisional low-confidence defaults", "final": "confirmed with confidence", "evidence": "reveal", "reason": "No qualifying moderate/high trigger or scalp claim."}],
    "uncertainties": ["Care-direction verdict moisture_supported vs dual_supported; with dual_supported a low claim cannot break the tie and focus would be general.",
                      "Ordinary target confidence: foreign manufacturer (US) page counted as non-manufacturer source per E1, giving moderate rather than high."],
}

# ---------------------------------------------------------------- T202 Guhl Frische & Leichtigkeit
u, ut = usage("regular", "high", "none", "none",
              ["Reset intent present ('Anti-Fett Shampoo', 'schnell fettendes Haar', manufacturer, moderate) but cleansingStrength is moderate, so strong_plus_reset_intent cannot fire."],
              ["alternating (blocked: cleansing not strong)"], "Regular: no frequency wording; alternating requires strong cleansing.")
J["T202"] = {
    "claimGrading": [
        {"claim": "Anti-Fett Shampoo", "source": "manufacturer_de", "grade": "moderate", "use": "E2 oily claim unit; clarifying focus candidate"},
        {"claim": "Für normales bis schnell fettendes Haar", "source": "manufacturer_de", "grade": "moderate", "use": "E2 oily claim unit"},
        {"claim": "Verzögert das Nachfetten, ohne auszutrocknen", "source": "manufacturer_de", "grade": "moderate", "use": "oily corroboration; 'ohne auszutrocknen' protective"},
        {"claim": "spendet intensiv Feuchtigkeit", "source": "retailer_dm_de", "grade": "low", "use": "not used (no independent moisture route)"},
        {"claim": "Frische & Leichtigkeit (name)", "source": "product name", "grade": "high", "use": "not an oily lexicon term (E2 excludes 'Frische', 'Leichtigkeit')"},
    ],
    "focusPrimary": F("clarifying", "moderate", "general",
                      "Clarifying (F6): the dominant exact-product positioning is oily scalp/roots ('Anti-Fett Shampoo', 'schnell fettendes Haar', manufacturer, moderate) and the formula is compatible: cleansingStrength moderate, conditioningLevel moderate (not high), weightPotential low (not high).",
                      "Recognized dandruff active Piroctone Olamine (13) without a dandruff claim (regular shampoo, R17.3); Zinc PCA (10) is a supporting sebum-care clue only; conditioning moderate is close to the F6 limit only if it were high.",
                      [{"ingredient": "Sodium Laureth Sulfate", "position": 2}, {"ingredient": "Zinc PCA", "position": 10}, {"ingredient": "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "position": 8}],
                      ["7.1", "7.2", "F6"], ["reveal:manufacturer_de"], "not_applicable",
                      {"moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Not a repair/moisture decision."}, "candidate"),
    "focusSecondary": P([], "high", "none", "Empty: no distinct moderate-graded secondary positioning; the moisture wording is retailer-only (low).", "Retailer 'spendet intensiv Feuchtigkeit'.", [], ["8", "CL-SRC"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no E2 sensitive or dry claim unit; 'ohne auszutrocknen' and 'Dermatologisch bestätigt' are protective wording (E2a).", "CSA formula half met (Panthenol 11).", [{"ingredient": "Panthenol", "position": 11}], ["10", "SC1", "E2a"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "oily scalp / Anti-Fett (moderate)", "formulaCompatible": True, "compatibleRoute": "moderate C1 SLES chassis, low weight, conditioning not high (F6)", "decisionReason": "Oily-scalp positioning maps to clarifying when F6 compatibility holds."},
                      "secondary": sec([], [], [], "No distinct moderate-graded secondary positioning."), "usage": ut},
    "primary": T("oily", "moderate", "moderate", "Oily (S-OILY): E2 oily claim units 'Anti-Fett Shampoo' and 'schnell fettendes Haar' from the manufacturer DE page (moderate); formula clause passes (cleansing moderate, weight low, conditioning moderate). Confidence = min(positioning moderate, cleansing high, weight moderate, conditioning moderate).", ["S-OILY", "E1", "E2", "13.8"]),
    "notes": ["active_without_dandruff_positioning"],
    "d1Rationale": NO_D1,
    "changes": [{"property": "focusPrimary", "blind": "scalp_active (provisional, low)", "final": "clarifying (moderate)", "evidence": "manufacturer 'Anti-Fett Shampoo', 'für normales bis schnell fettendes Haar'", "reason": "No dandruff claim, so the active does not put the product on the dandruff path (R17.3); oily positioning is clarifying (F6)."},
                {"property": "usageRole", "blind": "regular (provisional)", "final": "regular (high)", "evidence": "no frequency wording; cleansing moderate", "reason": "Treatment needs a dandruff claim (U3); alternating needs strong cleansing."}],
    "uncertainties": [],
}

# ---------------------------------------------------------------- T203 Cantu
u, ut = usage("regular", "high", "none", "none", ["Build-up wording ('entfernt sanft Produktrückstände') is retailer/foreign (low) and cleansing is moderate."], [], "Regular: no qualifying trigger.")
J["T203"] = {
    "claimGrading": [
        {"claim": "Entfernt sanft Produktrückstände / removes buildup", "source": "retailer_dm_de_exact_gtin; manufacturer_uk (foreign)", "grade": "low", "use": "clarifying candidate only with independent formula support (not present)"},
        {"claim": "Mit Sheabutter; pflegt; geschmeidiges Haargefühl; nourish curls", "source": "retailer / foreign manufacturer", "grade": "low", "use": "moisture candidate only with independent formula support (nonspecific)"},
        {"claim": "Speziell für strukturiertes Haar", "source": "retailer", "grade": "low", "use": "hair_texture, never focus or fit (T2)"},
        {"claim": "ohne es zu beschweren", "source": "retailer", "grade": "low", "use": "never lowers weight (6.5)"},
    ],
    "focusPrimary": F("general", "moderate", "clarifying",
                      "General: every claim is low-graded (dm retailer copy, foreign UK manufacturer page), and the formula is nonspecific: shea butter, Polyester-37 and two polymers are post-fragrance and distinguish neither moisture nor repair, and no formula feature independently supports a clarifying role. Low claims cannot turn nonspecific evidence into a specialist focus (CL-SRC, 3.2).",
                      "Build-up removal is the most repeated claim (clarifying would be the neighbor); shea/nourish wording points to moisture.",
                      [{"ingredient": "Butyrospermum Parkii (Shea) Butter", "position": 10}, {"ingredient": "Polyester-37", "position": 11}, {"ingredient": "Guar Hydroxypropyltrimonium Chloride", "position": 15}],
                      ["7.2", "7.3", "CL-SRC"], ["reveal:retailer_dm_de_exact_gtin", "reveal:manufacturer_uk"], "nonspecific",
                      {"moistureRoutes": ["Glycerin 5"], "repairRoutes": [], "sharedRoutes": ["Shea Butter 10", "Polyester-37 11", "Guar 15", "Polyquaternium-39 19"], "limitation": "All lipid/polymer routes post-fragrance."},
                      "not_applicable"),
    "focusSecondary": P([], "high", "none", "Empty: no moderate-graded positioning.", "None.", [], ["8"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no E2 sensitive/dry scalp claim ('sanfte Reinigung ... von Haar und Kopfhaut' is mildness).", "None.", [], ["10", "SC1"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "build-up removal / care (low)", "formulaCompatible": None, "compatibleRoute": None, "decisionReason": "Low claims with nonspecific formula -> general."},
                      "secondary": sec([], [], [], "No positioning."), "usage": ut},
    "primary": ordinary([1], "moderate", "Ordinary (way 1): no E2 claim unit; retailer copy and a foreign manufacturer page only -> moderate."),
    "d1Rationale": NO_D1 + " 'Entfernt Produktrückstände' is build-up wording (U4) but retailer/foreign only.",
    "identityNotes": ["Foreign UK page carries a 'formulations are updated occasionally' disclaimer: generic, not a conflict (ID-3). Product titles differ across sources; formula identity is from the frozen packet."],
    "changes": [{"property": "focusPrimary", "blind": "general (provisional, low)", "final": "general (moderate)", "evidence": "reveal: low-graded claims only", "reason": "Unchanged value; confidence set after claims."}],
    "uncertainties": ["Clarifying vs general: buildup claims are low-graded and a moderate-strength C1 chassis is compatible but not independent support."],
}

# ---------------------------------------------------------------- T204 Pantene Grow Abundance
u, ut = usage("regular", "high", "none", "none", ["'Verwende dieses Shampoo regelmäßig' is retailer (low) and not U2 frequency wording; hair-loss positioning never fires treatment (F5)."], [], "Regular.")
J["T204"] = {
    "claimGrading": [
        {"claim": "Anti-Haarverlust Shampoo; reduziert Haarverlust; stärkt Haarwurzeln", "source": "retailer_rossmann_de / retailer_mueller_de", "grade": "low", "use": "out of scope (F5, S-HAIRLOSS)"},
        {"claim": "stärkt feines, schwaches Haar; verringert Haarbruch", "source": "retailer", "grade": "low", "use": "repair candidate only with independent formula support (not present)"},
    ],
    "focusPrimary": F("general", "moderate", "repair",
                      "General: the dominant claim is hair loss (ignored, F5); the remaining in-scope wording (strengthening, less breakage) is retailer-only (low) and the formula verdict is nonspecific (silicone/guar generic conditioning, no protein or damage-care cluster).",
                      "Breakage/strength wording points to repair; Piroctone Olamine (6) is present without any dandruff claim.",
                      [{"ingredient": "Dimethiconol", "position": 10}, {"ingredient": "Guar Hydroxypropyltrimonium Chloride", "position": 11}, {"ingredient": "Piroctone Olamine", "position": 6}],
                      ["7.2", "F5", "CL-SRC"], ["reveal:retailer_rossmann_de"], "nonspecific",
                      {"moistureRoutes": [], "repairRoutes": [], "sharedRoutes": ["Dimethiconol 10", "Guar 11", "Dimethicone 14"], "limitation": "Generic silicone conditioning."}, "not_applicable"),
    "focusSecondary": P([], "high", "none", "Empty.", "None.", [], ["8"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no sensitive/dry scalp claim; CSA formula half also not met (no prominent E4 route).", "Menthol post-fragrance.", [], ["10", "SC1", "CSA"], ["reveal"]),
    "dandruffCounter": "Active present without any dandruff claim (R17.3).",
    "decisionTrace": {"primary": {"claimDirection": "hair loss (ignored, F5); strengthening (low)", "formulaCompatible": None, "compatibleRoute": None, "decisionReason": "No in-scope moderate claim, nonspecific formula -> general."},
                      "secondary": sec([], [], [], "None."), "usage": ut},
    "primary": ordinary([1, 2, 3], "moderate", "Ordinary: way 1 (no E2 claim unit, retailer-only packet -> moderate), way 2 (only scalp-adjacent positioning is hair loss, S-HAIRLOSS -> moderate), way 3 (Piroctone Olamine without a dandruff claim -> moderate). Lowest = moderate."),
    "notes": ["hair_loss_claim_not_evaluated", "active_without_dandruff_positioning"],
    "d1Rationale": NO_D1,
    "changes": [{"property": "focusPrimary", "blind": "scalp_active (provisional, low)", "final": "general (moderate)", "evidence": "no dandruff claim in any source; hair-loss positioning", "reason": "R17.3: the active without a claim is a regular shampoo; F5 ignores hair loss."}],
    "uncertainties": [],
}

# ---------------------------------------------------------------- T205 Sebamed Urea 5%
u, ut = usage("regular", "high", "none", "none", ["No U2 frequency wording ('Akutpflege' is not frequency); no dandruff claim."], [], "Regular.")
J["T205"] = {
    "claimGrading": [
        {"claim": "Anti-Juckreiz Akut Shampoo (headline)", "source": "manufacturer_de", "grade": "moderate", "use": "E2 sensitive claim unit (Juckreiz)"},
        {"claim": "gezielte Akutpflege für juckende Kopfhaut und trockenes Haar", "source": "manufacturer_de", "grade": "moderate", "use": "E2 sensitive unit (juckende Kopfhaut); 'trockenes Haar' is lengths, not dry scalp"},
        {"claim": "Trockenheit der Kopfhaut um bis zu 63 % reduziert", "source": "manufacturer_de", "grade": "moderate", "use": "E2 dry-scalp unit (reduziert)"},
        {"claim": "Haartyp: trockene/sehr trockene Kopfhaut, trockenes/strapaziertes Haar", "source": "manufacturer_de", "grade": "moderate", "use": "E2 dry-scalp unit; lengths wording noted"},
        {"claim": "Polidocanol wirkt juckreizlindernd ... Beruhigung der Kopfhaut", "source": "manufacturer_de", "grade": "moderate", "use": "claim name 'Polidocanol' maps to INCI Laureth-9 (5); corroborates sensitive"},
        {"claim": "Shampoo mit Urea für sehr trockene Kopfhaut; empfindliche Kopfhaut", "source": "retailer_dm_de / rossmann", "grade": "low", "use": "corroboration only"},
    ],
    "focusPrimary": F("scalp_active", "moderate", "moisture",
                      "Scalp_active: explicit itchy and dry-scalp positioning (manufacturer, moderate) with scalpComfortTarget targeted; F7 step 2 (the name 'Urea 5%' names neither role) makes the problem-led scalp role primary over the 'trockenes Haar' lengths claim.",
                      "Lengths-care wording ('trockenes/strapaziertes Haar') competes; Parfum (8) present; cleansing moderate rather than low.",
                      [{"ingredient": "Urea", "position": 2}, {"ingredient": "Laureth-9 (polidocanol)", "position": 5}],
                      ["7.2", "F7", "SC1", "CSA"], ["reveal:manufacturer_de"], "not_applicable",
                      {"moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Scalp role chosen; Urea is cited for the scalp route, so it cannot also carry a moisture route (F3)."}, "candidate"),
    "focusSecondary": P([], "moderate", ["moisture"], "Empty: the dry-lengths claim ('trockenes Haar') is distinct positioning, but its only humectant route, Urea (2), is already cited by the scalp_active route (F3); the remaining routes (late cationic starch, trace sunflower oil) are no humectant cluster.",
                        "Moderate-graded dry-hair wording exists.", [{"ingredient": "Urea", "position": 2}], ["8", "F3"], ["reveal:manufacturer_de"]),
    "usageRole": u,
    "scalpComfortTarget": P("targeted", "moderate", "not_targeted",
                            "Targeted: SC1 positioning (sensitive 'juckende Kopfhaut' and dry 'trockene Kopfhaut' units, manufacturer, moderate) plus CSA (prominent Urea 2, on both E4 lists; Laureth-9/polidocanol 5 comfort route).",
                            "Parfum (8) declared; cleansing moderate (SLES 7). No cooling agent.", [{"ingredient": "Urea", "position": 2}, {"ingredient": "Laureth-9", "position": 5}], ["10", "SC1", "CSA", "E4"], ["reveal:manufacturer_de"]),
    "decisionTrace": {"primary": {"claimDirection": "itchy/dry scalp (moderate)", "formulaCompatible": True, "compatibleRoute": "Urea 2 + polidocanol (Laureth-9) 5, targeted", "decisionReason": "F7 step 2: name names neither role -> scalp_active."},
                      "secondary": sec([], ["trockenes/strapaziertes Haar (moisture)"], [], "Only route (Urea) already cited by primary (F3)."), "usage": ut},
    "primary": T("sensitive", "moderate", "moderate", "Sensitive (S-SENSITIVE): E2 units 'Anti-Juckreiz', 'für juckende Kopfhaut' (manufacturer, moderate); formula gate: targeted and prominent comfort route Urea (2) (and Laureth-9 = polidocanol, 5). S-PRIMARY: the frozen name 'Sebamed Urea 5%' names no target, so sensitive precedes dry. Confidence min(positioning moderate, scalpComfortTarget moderate).", ["S-SENSITIVE", "S-PRIMARY", "E2", "E4", "13.8"]),
    "secondary": T("dry", "moderate", "moderate", "Dry (S-DRY, secondary): its own E2 units 'trockene/sehr trockene Kopfhaut', 'Trockenheit der Kopfhaut ... reduziert' (manufacturer, moderate); formula gate: targeted and prominent humectant route Urea (2). Sensitive + dry is a permitted pair (S-SECONDARY).", ["S-DRY", "S-SECONDARY", "E2", "E4", "13.8"]),
    "d1Rationale": NO_D1,
    "changes": [{"property": "scalpComfortTarget", "blind": "not_targeted (provisional, low)", "final": "targeted (moderate)", "evidence": "manufacturer 'Anti-Juckreiz', 'juckende Kopfhaut', 'trockene Kopfhaut'", "reason": "SC1 positioning revealed; CSA half was already met."},
                {"property": "focusPrimary", "blind": "scalp_active (provisional, low)", "final": "scalp_active (moderate)", "evidence": "same", "reason": "Confirmed."},
                {"property": "Laureth-9 synonym", "blind": "read as polidocanol (uncertainty)", "final": "corroborated", "evidence": "manufacturer names 'Polidocanol'; claim name maps to INCI Laureth-9 (ID-3 mapping)", "reason": "Claim-to-INCI mapping."}],
    "uncertainties": ["The dm headline 'TROCKENE HAUT' range name does not name the scalp and was not treated as a name-level dry target (S-PRIMARY falls back to sensitive, dry order).",
                      "Whether the manufacturer headline 'Anti-Juckreiz Akut Shampoo Urea 5%' is the exact product name (would grade sensitive high); the frozen productName 'Sebamed Urea 5%' was used, so positioning stays moderate."],
}

# ---------------------------------------------------------------- T206 Neqi Volume Victory
u, ut = usage("regular", "high", "none", "none", ["No moderate/high frequency wording."], [], "Regular.")
J["T206"] = {
    "claimGrading": [
        {"claim": "VOLUME VICTORY (name); spürbar volleres Haar; für feines und dünnes Haar", "source": "product name / manufacturer_ch_shop (foreign market) / retailer_notino_de", "grade": "high (name word) / low (copy)", "use": "volume focus candidate; 'feines Haar' never a fit input (T2)"},
        {"claim": "spendet viel Feuchtigkeit; stärkt die Haarstruktur", "source": "manufacturer_ch (foreign) / notino", "grade": "low", "use": "not used (no independent route)"},
        {"claim": "Frei von Sulfaten; sanft gereinigt", "source": "foreign / retailer", "grade": "low", "use": "mildness, not a focus"},
    ],
    "focusPrimary": F("volume", "moderate", "general",
                      "Volume: the product name names volume ('Volume Victory', high) and the formula is compatible: weightPotential low, conditioning bounded, mild C6 cleansing, with Polyquaternium-11 (17), a body/film-forming polymer, as a light volume route.",
                      "PQ-11 is late and the weak reset (C6) does not lift build-up; supporting copy is foreign-market or retailer (low).",
                      [{"ingredient": "Polyquaternium-11", "position": 17}, {"ingredient": "PEG-18 Glyceryl Oleate/Cocoate", "position": 5}],
                      ["7.1", "7.2", "E1"], ["reveal:product_name", "reveal:manufacturer_ch_shop"], "not_applicable",
                      {"moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Volume focus; not a repair/moisture decision."}, "candidate"),
    "focusSecondary": P([], "high", "none", "Empty: moisture/strengthening wording is low-graded; Panthenol is post-fragrance.", "None material.", [], ["8", "CL-SRC"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no scalp claim ('Kopfhaut-typ: alle Arten' is not positioning).", "None.", [], ["10", "SC1"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "volume (name, high)", "formulaCompatible": True, "compatibleRoute": "low weight + Polyquaternium-11 body polymer", "decisionReason": "Dominant name-level claim with compatible formula."},
                      "secondary": sec([], [], [], "None."), "usage": ut},
    "primary": ordinary([1], "moderate", "Ordinary (way 1): no E2 claim; sources are a foreign-market (CH) manufacturer shop and a retailer (both low) -> moderate."),
    "d1Rationale": NO_D1,
    "changes": [{"property": "focusPrimary", "blind": "general (provisional, low)", "final": "volume (moderate)", "evidence": "product name 'Volume Victory'", "reason": "Name-level volume claim with compatible light formula."}],
    "uncertainties": ["The CH manufacturer shop (German-language) is graded low as a foreign-market page (E1); the name word carries the focus."],
}

# ---------------------------------------------------------------- T207 Balea Med Anti Schuppen
u, ut = usage("treatment", "high", "none", "recognized_active_problem_led",
              ["dandruffSupport supported (Piroctone Olamine 10)", "name 'Anti Schuppen' (high); 'Shampoo gegen Schuppen' (moderate)"],
              ["frequent ('eine sanfte Pflege für jeden Tag', moderate, cleansing not strong) loses to treatment (U1)"],
              "Treatment: recognized active plus a qualifying dandruff claim (U3); U1 precedence over frequent.")
J["T207"] = {
    "claimGrading": [
        {"claim": "Balea Med Anti Schuppen (name)", "source": "product name", "grade": "high", "use": "E2 dandruff claim"},
        {"claim": "Shampoo gegen Schuppen", "source": "dm own brand (manufacturer_de)", "grade": "moderate", "use": "E2 dandruff unit"},
        {"claim": "Für empfindliche & trockene Kopfhaut", "source": "manufacturer_de", "grade": "moderate", "use": "bundled (same bullet list as the dandruff unit, E2b) -> research-only"},
        {"claim": "Kann Juckreiz mildern & die Kopfhaut beruhigen", "source": "manufacturer_de", "grade": "moderate", "use": "bundled comfort wording -> research-only sensitive"},
        {"claim": "eine sanfte Pflege für jeden Tag", "source": "manufacturer_de", "grade": "moderate", "use": "U2 frequency wording (loses to treatment)"},
    ],
    "focusPrimary": F("scalp_active", "high", "none",
                      "Scalp_active: name-level anti-dandruff positioning plus the recognized active Piroctone Olamine (10).",
                      "Bundled sensitive/dry-scalp wording and lengths 'geschmeidig-glänzend' wording; neither changes the role.",
                      [{"ingredient": "Piroctone Olamine", "position": 10}, {"ingredient": "Panthenol", "position": 5}, {"ingredient": "Bisabolol", "position": 6}],
                      ["7.2", "S-DANDRUFF"], ["reveal:product_name", "reveal:dm_own_brand"], "not_applicable",
                      {"moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Scalp role."}, "candidate"),
    "focusSecondary": P([], "moderate", ["moisture"], "Empty: 'Wirkung: Pflege, Feuchtigkeit, Glanz' tags are generic outcomes without distinct positioning or an independent route.", "Moisture tag exists.", [], ["8", "F2"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "moderate", "targeted",
                            "Not targeted: every sensitive/dry-scalp unit is bundled with the dandruff claim (same bullet list / paragraph, E2b), so none is SC1 positioning; CSA formula half is met (Panthenol 5, Bisabolol 6, Niacinamide 7).",
                            "If the 'Für empfindliche & trockene Kopfhaut' bullet were read as separate it would be SC1 positioning and the product targeted.", [{"ingredient": "Panthenol", "position": 5}, {"ingredient": "Bisabolol", "position": 6}, {"ingredient": "Niacinamide", "position": 7}], ["10", "SC1", "E2b"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "anti-dandruff (name, high)", "formulaCompatible": True, "compatibleRoute": "Piroctone Olamine 10", "decisionReason": "Problem-led product with recognized active and anti-dandruff positioning."},
                      "secondary": sec([], [], [], "No distinct positioning."), "usage": ut},
    "primary": T("dandruff", "high", "high", "Dandruff (S-DANDRUFF): name 'Anti Schuppen' (high) plus dandruffSupport supported; always primary (R17.1); no secondary target (R17.2). Confidence min(high, high).", ["S-DANDRUFF", "S-PRIMARY", "R17.1", "R17.2"]),
    "combination": ["sensitive"],
    "combinationDetail": "sensitive: bundled comfort wording 'Kann Juckreiz mildern & die Kopfhaut beruhigen' / 'Für empfindliche ... Kopfhaut' (manufacturer, moderate) and S-SENSITIVE formula gate read as CSA + prominent comfort route (Panthenol 5, Bisabolol 6, Niacinamide 7) -> passed; confidence moderate. dry: the dry-scalp wording sits in the same bullet list/paragraph as the dandruff claim (bundled dryness wording, absorbed by layer 1): no value, no note. oily: no wording.",
    "notes": ["suits_dandruff_with_irritated_scalp"],
    "d1Rationale": NO_D1,
    "changes": [{"property": "focusPrimary", "blind": "scalp_active (provisional, low)", "final": "scalp_active (high)", "evidence": "name 'Anti Schuppen'", "reason": "Confirmed."},
                {"property": "usageRole", "blind": "regular (provisional)", "final": "treatment (high)", "evidence": "dandruff claim + Piroctone", "reason": "U3 trigger."}],
    "uncertainties": ["Bundled vs separate for 'Für empfindliche & trockene Kopfhaut': read as bundled (same bullet list as 'Shampoo gegen Schuppen'; when unclear, bundled). As a separate unit it would make scalpComfortTarget targeted and feed a 'dry' combination value via S-DRY (Glycerin 9 prominent)."],
}

# ---------------------------------------------------------------- T208 Plantur 39
u, ut = usage("frequent", "moderate", "regular", "explicit_frequent_non_strong",
              ["'Täglich anwenden', 'Bei jeder Haarwäsche benutzen' (manufacturer_de, moderate)", "cleansingStrength moderate (not strong)"],
              [], "Frequent: explicit U2 frequency wording from the manufacturer and a non-strong formula.")
J["T208"] = {
    "claimGrading": [
        {"claim": "Beugt menopausalem Haarausfall vor; Coffein aktiviert die Haarwurzel", "source": "manufacturer_de / retailers", "grade": "moderate / low", "use": "out of scope (F5, S-HAIRLOSS)"},
        {"claim": "für feines, brüchiges Haar (name)", "source": "product name", "grade": "high", "use": "repair candidate (breakage); 'feines Haar' never a fit input (T2)"},
        {"claim": "Bewusst leicht dosierte Pflegestoffe ... ohne zu beschweren – damit die Frisur ihr Volumen behält", "source": "manufacturer_de", "grade": "moderate", "use": "volume-type wording; never lowers weight"},
        {"claim": "Täglich anwenden; bei jeder Haarwäsche", "source": "manufacturer_de directions", "grade": "moderate", "use": "U2 frequency wording"},
    ],
    "focusPrimary": F("general", "moderate", "repair",
                      "General: the dominant claim is hair loss (ignored, F5); the in-scope name claim 'brüchiges Haar' is a repair candidate, but the formula verdict is nonspecific (one light Polyquaternium-7, one hydrolyzed wheat protein and panthenol are not a coherent repair cluster; one protein token is not enough). The volume wording is a side statement about light dosing, not a dominant job.",
                      "Name-level breakage wording (repair) and 'Volumen behält' wording (volume).",
                      [{"ingredient": "Polyquaternium-7", "position": 13}, {"ingredient": "Hydrolyzed Wheat Protein", "position": 17}, {"ingredient": "Caffeine", "position": 9}],
                      ["7.2", "7.3", "F1", "F5"], ["reveal:manufacturer_de", "reveal:product_name"], "nonspecific",
                      {"moistureRoutes": ["Panthenol 4"], "repairRoutes": ["Hydrolyzed Wheat Protein 17"], "sharedRoutes": ["Polyquaternium-7 13"], "limitation": "Single protein token and one light polymer."}, "not_applicable"),
    "focusSecondary": P([], "moderate", ["volume"], "Empty: no distinct secondary job with an independent route.", "Volume wording.", [], ["8"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no E2 sensitive/dry claim ('Widerstandskraft von Kopfhaut' is not a lexicon state).", "CSA half met (Panthenol 4).", [], ["10", "SC1"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "hair loss (ignored); breakage (name, high)", "formulaCompatible": False, "compatibleRoute": None, "decisionReason": "Repair verdict nonspecific -> general (F1, 3.2)."},
                      "secondary": sec([], [], [], "None."), "usage": ut},
    "primary": ordinary([1, 2], "moderate", "Ordinary: way 1 (no E2 claim unit; manufacturer source -> high) and way 2 (only scalp-adjacent positioning is hair loss -> moderate). Lowest = moderate."),
    "notes": ["hair_loss_claim_not_evaluated"],
    "d1Rationale": NO_D1,
    "weightClaimNote": "'ohne zu beschweren' / 'leicht dosierte Pflegestoffe' never lowers the band (6.5); it is consistent with the blind low call.",
    "changes": [{"property": "usageRole", "blind": "regular (provisional)", "final": "frequent (moderate)", "evidence": "manufacturer directions 'Täglich anwenden'", "reason": "U2 + non-strong cleansing."},
                {"property": "focusPrimary", "blind": "general (provisional, low)", "final": "general (moderate)", "evidence": "hair-loss + breakage claims", "reason": "F5; repair not formula-supported."}],
    "uncertainties": ["The daily-use direction serves the hair-loss regimen; U2 reads wording only, so frequent fires."],
}

# ---------------------------------------------------------------- T209 SANTE Sensitive Care
u, ut = usage("regular", "high", "none", "none", ["No frequency wording."], [], "Regular.")
J["T209"] = {
    "claimGrading": [
        {"claim": "Für sensibles Haar und empfindliche Kopfhaut", "source": "manufacturer_de (LOGOCOS shop)", "grade": "moderate", "use": "E2 sensitive claim unit"},
        {"claim": "Reduziert Spannungs- & Trockenheitsgefühle und unterstützt den natürlichen pH-Wert der Kopfhaut", "source": "manufacturer_de", "grade": "moderate", "use": "read as E2 dry-scalp unit (Spannungsgefühl der Kopfhaut)"},
        {"claim": "Wohltuend für die Kopfhaut; intakte Hautbarriere; pH in Balance; dermatologisch getestet", "source": "manufacturer_de", "grade": "moderate", "use": "not lexicon / protective (E2a)"},
        {"claim": "3-fach Protein Komplex stärkt, pflegt & schützt; füllt & baut das Haar auf", "source": "manufacturer_de", "grade": "moderate", "use": "repair candidate (lengths)"},
        {"claim": "Sensitive (name word)", "source": "product name", "grade": "high", "use": "does not name the scalp; no role for F7 step 1"},
    ],
    "focusPrimary": F("general", "moderate", "repair",
                      "General: the scalp role fails formula compatibility (scalpComfortTarget not_targeted: no prominent E4 route), and the lengths repair claim rests on three hydrolyzed proteins (13-15) without any deposition system, which is not a coherent repair cluster (nonspecific). F7 step 2 therefore falls through to general.",
                      "Moderate-graded protein/repair claim and sensitive-scalp claim; three proteins are more than one token.",
                      [{"ingredient": "Hydrolyzed Corn Protein", "position": 13}, {"ingredient": "Hydrolyzed Wheat Protein", "position": 14}, {"ingredient": "Hydrolyzed Soy Protein", "position": 15}],
                      ["7.2", "7.3", "F7"], ["reveal:manufacturer_de"], "nonspecific",
                      {"moistureRoutes": [], "repairRoutes": ["Hydrolyzed Corn/Wheat/Soy Protein 13-15"], "sharedRoutes": ["PCA Ethyl Cocoyl Arginate 19"], "limitation": "No polymer, silicone or lipid deposition system; proteins are hydrolyzed."}, "not_applicable"),
    "focusSecondary": P([], "high", "none", "Empty.", "None.", [], ["8"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none",
                            "Not targeted: SC1 positioning exists ('für empfindliche Kopfhaut', moderate) but CSA fails: no E4 comfort or humectant route is prominent (Aloe Barbadensis Leaf Juice 6, Lactococcus Ferment Lysate 9, Arginine 10 are not on the closed lists).",
                            "Mild-leaning surfactant mix and fragrance-light formula are supportive signals but insufficient alone (CSA).",
                            [{"ingredient": "Aloe Barbadensis Leaf Juice", "position": 6}, {"ingredient": "Lactococcus Ferment Lysate", "position": 9}], ["10", "CSA", "E4", "R16.4"], ["reveal:manufacturer_de"]),
    "decisionTrace": {"primary": {"claimDirection": "sensitive scalp (moderate) + protein care (moderate)", "formulaCompatible": False, "compatibleRoute": None, "decisionReason": "scalp_active needs targeted (fails CSA); repair verdict nonspecific -> general."},
                      "secondary": sec([], [], [], "None."), "usage": ut},
    "primary": ordinary([4], "moderate", "Ordinary (way 4, S-FAIL): claimed sensitive (and dry) targets fail their formula gate (scalpComfortTarget not targeted) and no other specialist target passes; proposal only, blocked by review_specialist_gate_failed."),
    "flags": ["review_specialist_gate_failed:sensitive(formula gate: scalpComfortTarget not_targeted, CSA no prominent E4 route),dry(formula gate: same);unlisted_route_candidate:Aloe Barbadensis Leaf Juice;unlisted_route_candidate:Lactococcus Ferment Lysate;unlisted_route_candidate:Arginine"],
    "d1Rationale": NO_D1,
    "changes": [{"property": "scalpComfortTarget", "blind": "not_targeted (provisional, low; CSA not met)", "final": "not_targeted (high)", "evidence": "SC1 positioning revealed; CSA still fails", "reason": "Positioning present, formula half missing -> S-FAIL path."},
                {"property": "focusPrimary", "blind": "general (provisional, low)", "final": "general (moderate)", "evidence": "sensitive + protein claims", "reason": "Neither role is formula-compatible."}],
    "uncertainties": ["'Reduziert Spannungs- & Trockenheitsgefühle ... der Kopfhaut' read as a dry-scalp unit; either way the dry gate fails on the same CSA clause, so the projection is unchanged."],
}

# ---------------------------------------------------------------- T210 ISANA MED Anti Schuppen
u, ut = usage("treatment", "high", "none", "recognized_active_problem_led",
              ["dandruffSupport supported (Piroctone Olamine 8)", "name 'Anti Schuppen' (high)"],
              ["alternating (strong cleansing + oily reset intent 'reinigt schnell fettendes Haar', pack, moderate) loses to treatment (U1)"],
              "Treatment by U1 precedence.")
J["T210"] = {
    "claimGrading": [
        {"claim": "ISANA MED Shampoo Anti Schuppen (name)", "source": "product name", "grade": "high", "use": "E2 dandruff claim"},
        {"claim": "Anti Schuppenformel mit Piroctone Olamine ... gegen lästige Schuppen", "source": "pack_back / manufacturer_de", "grade": "moderate", "use": "E2 dandruff unit"},
        {"claim": "reinigt schnell fettendes Haar", "source": "pack_back", "grade": "moderate", "use": "oily-scalp wording on a dandruff-primary product -> E2b layer 2 oily; U4 reset intent"},
        {"claim": "Coffein & Menthol gegen trockene Kopfhaut", "source": "manufacturer_de (plain list)", "grade": "moderate", "use": "dryness wording directly after the dandruff entry -> bundled (E2b) -> absorbed"},
        {"claim": "Coffein hilft die Haarwurzel zu stärken", "source": "manufacturer_de", "grade": "moderate", "use": "hair-root/hair-loss-adjacent; not evaluated (S-HAIRLOSS note)"},
        {"claim": "Menthol erfrischt die Kopfhaut; pH hautneutral; dermatologisch bestätigt", "source": "pack / manufacturer", "grade": "moderate", "use": "not lexicon / protective"},
    ],
    "focusPrimary": F("scalp_active", "high", "none",
                      "Scalp_active: name-level anti-dandruff positioning with Piroctone Olamine (8) (and Sodium Salicylate 9).",
                      "Oily-scalp and dry-scalp wording; strong cleansing chassis; prominent Menthol (12).",
                      [{"ingredient": "Piroctone Olamine", "position": 8}, {"ingredient": "Sodium Salicylate", "position": 9}],
                      ["7.2", "S-DANDRUFF"], ["reveal:product_name", "reveal:pack_back"], "not_applicable",
                      {"moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Scalp role."}, "candidate"),
    "focusSecondary": P([], "moderate", ["clarifying"], "Empty: the oily-scalp claim ('reinigt schnell fettendes Haar') is distinct positioning, but its only formula route is the cleansing chassis itself, which is a restatement of cleansingStrength (Section 8 item 3; invalid pattern 'clarifying only because cleansing is strong').",
                        "Moderate-graded oily wording and a strong reinforced ether-sulfate chassis.", [{"ingredient": "Sodium Laureth Sulfate", "position": 2}], ["8", "F6"], ["reveal:pack_back"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "moderate", "targeted",
                            "Not targeted: the only dry-scalp unit ('Coffein & Menthol gegen trockene Kopfhaut') stands directly after a dandruff entry in a plain list and is bundled (E2b), so there is no SC1 positioning; CSA formula half would be met (Panthenol 10, Glyceryl Oleate 7, Glycerin 13).",
                            "Read as a separate unit it would be SC1 dry positioning; counter-signals strong cleansing and prominent Menthol (12) would cap targeted at moderate.", [{"ingredient": "Panthenol", "position": 10}, {"ingredient": "Menthol", "position": 12}], ["10", "SC1", "E2b", "CSA"], ["reveal:manufacturer_de"]),
    "decisionTrace": {"primary": {"claimDirection": "anti-dandruff (name, high)", "formulaCompatible": True, "compatibleRoute": "Piroctone Olamine 8", "decisionReason": "Problem-led with recognized active."},
                      "secondary": sec([], ["reinigt schnell fettendes Haar"], [], "Only route would restate cleansing strength."), "usage": ut},
    "primary": T("dandruff", "high", "high", "Dandruff (S-DANDRUFF): name 'Anti Schuppen' (high) plus Piroctone Olamine; primary (R17.1), no secondary (R17.2).", ["S-DANDRUFF", "S-PRIMARY", "R17.1", "R17.2"]),
    "combination": ["oily"],
    "combinationDetail": "oily: 'reinigt schnell fettendes Haar' (pack back, moderate) and S-OILY formula clause (cleansing strong, weight low, conditioning low) passed -> 'oily', note suits_dandruff_with_oily_scalp; confidence min(dandruff high, wording moderate) = moderate. dry: 'gegen trockene Kopfhaut' is bundled dryness wording (next entry after the dandruff entry in a plain list) -> absorbed, no value, no note; therefore no dry/oily contradiction. sensitive: no comfort wording ('Menthol erfrischt' is not comfort lexicon).",
    "notes": ["suits_dandruff_with_oily_scalp", "hair_loss_claim_not_evaluated"],
    "d1Rationale": NO_D1,
    "changes": [{"property": "focusPrimary", "blind": "scalp_active (provisional, low)", "final": "scalp_active (high)", "evidence": "name", "reason": "Confirmed."},
                {"property": "usageRole", "blind": "regular (provisional)", "final": "treatment (high)", "evidence": "dandruff claim + active", "reason": "U3; alternating also fires but loses (U1)."}],
    "uncertainties": ["Bundling of 'Coffein & Menthol gegen trockene Kopfhaut' (manufacturer plain list, adjacent to 'Piroctone Olamine wirkt nachhaltig gegen Schuppen'): read as bundled. If separate, 'dry' would also qualify (S-DRY gate passes via Panthenol 10/Glycerin 13 with CSA) and then dry + oily would both fall back to notes with contradictory_scalp_states, leaving researchCombinationTargets [].",
                      "'Coffein hilft die Haarwurzel zu stärken' treated as hair-loss-adjacent positioning (note hair_loss_claim_not_evaluated)."],
}

# ---------------------------------------------------------------- T211 GLISS Liquid Silk
u, ut = usage("regular", "high", "none", "none", ["'Regelmäßig anwenden' is not U2 frequency wording."], [], "Regular.")
J["T211"] = {
    "claimGrading": [
        {"claim": "Schutz & gesund aussehender Glanz; glättet die Haaroberfläche, verleiht Glanz", "source": "manufacturer_de", "grade": "moderate", "use": "shine focus candidate"},
        {"claim": "Liquid Silk (name)", "source": "product name", "grade": "high", "use": "smoothness/silk = shine-type name word (corroborating)"},
        {"claim": "schützt und stärkt das Haar; für stumpfes, sprödes Haar", "source": "manufacturer_de", "grade": "moderate", "use": "repair-type secondary wording"},
        {"claim": "reinigt ohne zu beschweren", "source": "retailer_rossmann", "grade": "low", "use": "never lowers weight"},
    ],
    "focusPrimary": F("shine", "moderate", "repair",
                      "Shine: the manufacturer headline and key claims are gloss and smoothing ('Glanz', 'glättet die Haaroberfläche', 'Liquid Silk'), and the formula has a plausible light film/smoothing route: Hydrolyzed Silk (6), Sericin (7) and Polyquaternium-10 (10).",
                      "'Schützt und stärkt' / 'sprödes Haar' wording points to repair; the film route is light and post-fragrance for the polymer.",
                      [{"ingredient": "Hydrolyzed Silk", "position": 6}, {"ingredient": "Sericin", "position": 7}, {"ingredient": "Polyquaternium-10", "position": 10}],
                      ["7.1", "7.2"], ["reveal:manufacturer_de"], "not_applicable",
                      {"moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Shine focus; a repair verdict would be nonspecific (light protein/polymer only)."}, "candidate"),
    "focusSecondary": P([], "moderate", ["repair"], "Empty: the strengthening/brittle-hair wording has no repair route independent of the silk/sericin/PQ-10 route already cited for shine (F3); Glycosphingolipids (5) alone is not a coherent repair cluster.",
                        "Moderate-graded 'schützt und stärkt' wording.", [{"ingredient": "Glycosphingolipids", "position": 5}], ["8", "F2", "F3"], ["reveal:manufacturer_de"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no scalp claim.", "None.", [], ["10"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "shine/smoothing (moderate; name word high)", "formulaCompatible": True, "compatibleRoute": "Hydrolyzed Silk 6 + Sericin 7 + Polyquaternium-10 10 light film", "decisionReason": "Dominant compatible job."},
                      "secondary": sec([], ["schützt und stärkt das Haar"], [], "No independent route (F3)."), "usage": ut},
    "primary": ordinary([1], "high", "Ordinary (way 1): no E2 claim; manufacturer DE source present -> high."),
    "d1Rationale": NO_D1,
    "changes": [{"property": "focusPrimary", "blind": "general (provisional, low)", "final": "shine (moderate)", "evidence": "manufacturer 'Glanz', 'glättet die Haaroberfläche'", "reason": "Claim identifies shine; formula has a light film route."}],
    "uncertainties": ["Shine vs repair as primary: gloss is the headline; repair-type wording is secondary and not independently routed."],
}

# ---------------------------------------------------------------- T212 Syoss Intense Keratin
u, ut = usage("regular", "high", "none", "none", ["No frequency wording; 'Tiefenpflegende Formel' / 'Tiefenspülung' are not D1 (care terms)."], [], "Regular.")
J["T212"] = {
    "claimGrading": [
        {"claim": "Repariert schwaches, leicht brüchiges Haar; Keratin-Aufbau-Komplex; füllt das Haar mit Keratin auf", "source": "manufacturer_de", "grade": "moderate", "use": "repair focus candidate; 'Keratin' maps to Hydrolyzed Keratin (6)"},
        {"claim": "Intense Keratin (name)", "source": "product name", "grade": "high", "use": "corroborating"},
        {"claim": "Tiefenpflegende Formel; anschließend eine Tiefenspülung verwenden", "source": "manufacturer_de", "grade": "moderate", "use": "not D1 (Tiefenpflege/Tiefenspülung excluded)"},
    ],
    "focusPrimary": F("repair", "moderate", "general",
                      "Repair: manufacturer damage/breakage positioning ('Repariert ... brüchiges Haar', keratin) over a repair_supported formula: Hydrolyzed Keratin (6) with a substantive silicone/amodimethicone/guar deposition cluster (7, 11, 12).",
                      "Strength claims ('5x stärker') are marketing; repair verdict rests partly on shared silicone conditioning routes.",
                      [{"ingredient": "Hydrolyzed Keratin", "position": 6}, {"ingredient": "Dimethicone", "position": 7}, {"ingredient": "Amodimethicone", "position": 11}, {"ingredient": "Guar Hydroxypropyltrimonium Chloride", "position": 12}],
                      ["7.2", "7.3", "F1"], ["reveal:manufacturer_de"], "repair_supported",
                      {"moistureRoutes": [], "repairRoutes": ["Hydrolyzed Keratin 6", "Amodimethicone 11"], "sharedRoutes": ["Dimethicone 7", "Guar 12", "PEG-7 Glyceryl Cocoate 5"], "limitation": "No humectant cluster; deposition routes are shared conditioning."}, "candidate"),
    "focusSecondary": P([], "high", "none", "Empty: no distinct secondary positioning.", "None.", [], ["8"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no scalp claim.", "None.", [], ["10"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "repair (moderate; name high)", "formulaCompatible": True, "compatibleRoute": "Hydrolyzed Keratin 6 + silicone/amodimethicone/guar deposition", "decisionReason": "Claim plus repair_supported verdict."},
                      "secondary": sec([], [], [], "None."), "usage": ut},
    "primary": ordinary([1], "high", "Ordinary (way 1): no E2 claim; manufacturer DE source -> high."),
    "d1Rationale": "D1 false: 'Tiefenpflegende' and 'Tiefenspülung' share the prefix but are excluded care terms (D1 details).",
    "changes": [{"property": "focusPrimary", "blind": "repair (provisional, low)", "final": "repair (moderate)", "evidence": "manufacturer repair/keratin claims", "reason": "Confirmed."}],
    "uncertainties": [],
}

# ---------------------------------------------------------------- T213 OGX Argan
u, ut = usage("regular", "high", "none", "none", ["No moderate/high claim."], [], "Regular.")
J["T213"] = {
    "claimGrading": [
        {"claim": "repariert trockenes & geschädigtes Haar; regenerierend; kräftigt und nährt", "source": "retailer_dm_de / retailer_rossmann_de", "grade": "low", "use": "repair candidate (formula independently repair_supported)"},
        {"claim": "intensive Feuchtigkeit; feuchtigkeitsspendend", "source": "retailer", "grade": "low", "use": "moisture wording; no humectant cluster"},
        {"claim": "UV-Schutz / schützt vor Hitze", "source": "retailer", "grade": "low", "use": "names no INCI ingredient; not a conflict (no gate role)"},
        {"claim": "ohne sulfathaltige Tenside", "source": "retailer", "grade": "low", "use": "consistent with C6"},
    ],
    "focusPrimary": F("repair", "moderate", "general",
                      "Repair: damage/regeneration wording (retailer, low) acts as candidate because the formula verdict independently supports repair (prominent argan oil 6 and hydrogenated castor oil 11 with amodimethicone 9 and guar 10); CL-SRC caps confidence at moderate.",
                      "Only retailer copy; moisture wording competes but the formula has no deliberate humectant (C2 R11).",
                      [{"ingredient": "Argania Spinosa Kernel Oil", "position": 6}, {"ingredient": "Amodimethicone", "position": 9}, {"ingredient": "Guar Hydroxypropyltrimonium Chloride", "position": 10}, {"ingredient": "Hydrogenated Castor Oil", "position": 11}],
                      ["7.2", "7.3", "F1", "CL-SRC"], ["reveal:retailer_dm_de", "reveal:retailer_rossmann_de"], "repair_supported",
                      {"moistureRoutes": [], "repairRoutes": ["Argan Oil 6", "Amodimethicone 9", "Hydrogenated Castor Oil 11"], "sharedRoutes": ["Guar 10"], "limitation": "No humectant cluster; no protein."}, "candidate"),
    "focusSecondary": P([], "high", "none", "Empty: moisture wording has no independent humectant route; claims are low.", "None.", [], ["8", "CL-SRC"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no scalp claim.", "None.", [], ["10"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "repair (low)", "formulaCompatible": True, "compatibleRoute": "argan/HCO payload lipids + amodimethicone + guar", "decisionReason": "Low claim admissible as candidate with independent repair_supported verdict; confidence capped."},
                      "secondary": sec([], [], [], "None."), "usage": ut},
    "primary": ordinary([1], "moderate", "Ordinary (way 1): no E2 claim; retailer copy only -> moderate."),
    "d1Rationale": NO_D1,
    "changes": [{"property": "focusPrimary", "blind": "repair (provisional, low)", "final": "repair (moderate)", "evidence": "retailer repair claims (low)", "reason": "Formula verdict independently supports repair."}],
    "uncertainties": ["UV-protection claim with no UV filter in the frozen INCI: the claim names no ingredient, so it is a marketing statement with no gate role (ID-3 note only)."],
}

# ---------------------------------------------------------------- T214 Pantene Volumen Pur
u, ut = usage("regular", "high", "none", "none", ["'Für die tägliche Haarwäsche geeignet' (Müller, low) cannot fire frequent."], ["frequent (blocked: claim graded low)"], "Regular.")
J["T214"] = {
    "claimGrading": [
        {"claim": "Volumen Pur (name); für voller aussehendes Haar; schwerelose Fülle; für feines, plattes Haar", "source": "product name / retailers", "grade": "high (name) / low", "use": "volume focus candidate; fine-hair claim never a fit input (T2)"},
        {"claim": "schützt die Haarbindungen; stärkt", "source": "retailer", "grade": "low", "use": "repair-type, no formula route"},
        {"claim": "Für die tägliche Haarwäsche geeignet", "source": "retailer_mueller_de", "grade": "low", "use": "cannot fire frequent"},
    ],
    "focusPrimary": F("volume", "moderate", "general",
                      "Volume: the product name names volume ('Volumen Pur', high) and the formula is fully compatible: no deposition family at all (weight low, conditioning low) on an ordinary C1 chassis.",
                      "No positive volume route beyond the absence of deposition; supporting copy is retailer-only.",
                      [{"ingredient": "Sodium Laureth Sulfate", "position": 2}, {"ingredient": "Cocamidopropyl Betaine", "position": 3}],
                      ["7.1", "7.2"], ["reveal:product_name"], "not_applicable",
                      {"moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Volume focus."}, "candidate"),
    "focusSecondary": P([], "high", "none", "Empty.", "Bond/strength wording (low).", [], ["8"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no scalp claim.", "None.", [], ["10"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "volume (name, high)", "formulaCompatible": True, "compatibleRoute": "zero-deposition, low-weight base", "decisionReason": "Dominant compatible job."},
                      "secondary": sec([], [], [], "None."), "usage": ut},
    "primary": ordinary([1], "moderate", "Ordinary (way 1): no E2 claim; retailer copy only -> moderate."),
    "d1Rationale": NO_D1,
    "identityNotes": ["Packet notes the identical formula on the 300 ml GTIN; provenance only."],
    "changes": [{"property": "focusPrimary", "blind": "general (provisional, low)", "final": "volume (moderate)", "evidence": "product name 'Volumen Pur'", "reason": "Name-level volume claim; compatible formula."}],
    "uncertainties": ["Volume compatibility here rests on absence of deposition rather than a positive body route."],
}

# ---------------------------------------------------------------- T215 Balea Professional Ultimate Volume
u, ut = usage("regular", "high", "none", "none", ["No frequency wording."], [], "Regular.")
J["T215"] = {
    "claimGrading": [
        {"claim": "Ultimate Volume (name); Volumen Shampoo; Anti-Platt-Effekt", "source": "product name / dm own brand (manufacturer_de)", "grade": "high / moderate", "use": "volume focus candidate"},
        {"claim": "Für feines, plattes Haar", "source": "manufacturer_de", "grade": "moderate", "use": "never a fit input (T2)"},
        {"claim": "Pflege-Formel mit Biotin & Reis-Extrakt; kräftigt die Haarstruktur", "source": "manufacturer_de", "grade": "moderate", "use": "no independent repair route"},
        {"claim": "ohne es zu beschweren", "source": "manufacturer_de", "grade": "moderate", "use": "never lowers weight"},
    ],
    "focusPrimary": F("volume", "moderate", "general",
                      "Volume: name-level volume positioning with a compatible formula (weight low; one guar 10 and a hydrolyzed wheat protein 6, light).",
                      "Bounded conditioning (guar) and a strengthening claim; Biotin/rice extract are marketing actives.",
                      [{"ingredient": "Hydrolyzed Wheat Protein", "position": 6}, {"ingredient": "Guar Hydroxypropyltrimonium Chloride", "position": 10}],
                      ["7.1", "7.2"], ["reveal:product_name", "reveal:dm_own_brand"], "not_applicable",
                      {"moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Volume focus."}, "candidate"),
    "focusSecondary": P([], "high", "none", "Empty: 'kräftigt die Haarstruktur' has no independent repair route (single hydrolyzed protein).", "None material.", [], ["8"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no scalp claim.", "None.", [], ["10"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "volume (name, high)", "formulaCompatible": True, "compatibleRoute": "low-weight formula, light guar/protein", "decisionReason": "Dominant compatible job."},
                      "secondary": sec([], [], [], "None."), "usage": ut},
    "primary": ordinary([1], "high", "Ordinary (way 1): no E2 claim; dm own-brand manufacturer source -> high."),
    "d1Rationale": NO_D1,
    "identityNotes": ["Product is delisted at dm (replaced by Hydra Volume); identity and formula are from the frozen packet; no formula conflict."],
    "changes": [{"property": "focusPrimary", "blind": "general (provisional, low)", "final": "volume (moderate)", "evidence": "name 'Ultimate Volume'", "reason": "Claim identifies volume; formula compatible."}],
    "uncertainties": [],
}

# ---------------------------------------------------------------- T216 ISANA MED Ultra Sensitiv+ Anti-Schuppen
u, ut = usage("treatment", "high", "none", "recognized_active_problem_led",
              ["dandruffSupport supported (Piroctone Olamine 5)", "name 'Anti-Schuppen' (high); 'stark & nachhaltig gegen Schuppen' (moderate)"], [], "Treatment (U3).")
J["T216"] = {
    "claimGrading": [
        {"claim": "ISANA MED Ultra Sensitiv+ Anti-Schuppen Shampoo (name)", "source": "product name", "grade": "high", "use": "E2 dandruff claim; 'Sensitiv+' names no scalp"},
        {"claim": "stark in der Wirkung gegen Schuppen und sanft zur Kopfhaut", "source": "pack_back / rossmann own brand", "grade": "moderate", "use": "dandruff unit; 'sanft zur Kopfhaut' is sparing wording (E2a)"},
        {"claim": "Ultra sensitiv Produkte ... sehr sensibler Haut abgestimmt", "source": "pack_back", "grade": "moderate", "use": "names skin, not the scalp: not an E2 sensitive unit"},
        {"claim": "Allergie getestet; pH hautneutral; dermatologisch bestätigt; 0% Parfüm", "source": "pack / own brand", "grade": "moderate", "use": "protective/mildness"},
    ],
    "focusPrimary": F("scalp_active", "high", "none",
                      "Scalp_active: name-level anti-dandruff positioning with Piroctone Olamine (5).",
                      "Sensitive-skin wording and comfort routes (Panthenol 8, Niacinamide 9, Bisabolol 10) are present but not scalp-claimed.",
                      [{"ingredient": "Piroctone Olamine", "position": 5}],
                      ["7.2", "S-DANDRUFF"], ["reveal:product_name"], "not_applicable",
                      {"moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Scalp role."}, "candidate"),
    "focusSecondary": P([], "high", "none", "Empty.", "None.", [], ["8"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "moderate", "targeted",
                            "Not targeted: no E2 sensitive or dry-scalp claim unit ('sehr sensibler Haut' names skin, 'sanft zur Kopfhaut' is sparing wording, 'Sensitiv+' is a non-scalp name word); CSA formula half is met (Panthenol 8, Niacinamide 9, Bisabolol 10, fragrance-free).",
                            "A reader taking 'sehr sensibler Haut' as scalp positioning would call it targeted.", [{"ingredient": "Panthenol", "position": 8}, {"ingredient": "Niacinamide", "position": 9}, {"ingredient": "Bisabolol", "position": 10}], ["10", "SC1", "E2", "E2a"], ["reveal:pack_back"]),
    "decisionTrace": {"primary": {"claimDirection": "anti-dandruff (name, high)", "formulaCompatible": True, "compatibleRoute": "Piroctone Olamine 5", "decisionReason": "Problem-led with recognized active."},
                      "secondary": sec([], [], [], "None."), "usage": ut},
    "primary": T("dandruff", "high", "high", "Dandruff (S-DANDRUFF): name 'Anti-Schuppen' (high) plus Piroctone Olamine; primary, no secondary (R17.1, R17.2).", ["S-DANDRUFF", "S-PRIMARY", "R17.1", "R17.2"]),
    "combination": [],
    "combinationDetail": "sensitive: no comfort wording (no Juckreiz/beruhigt/gereizt/Rötungen/Spannungsgefühl) and no separate sensitive-scalp unit; 'sanft zur Kopfhaut' is protective, 'sehr sensibler Haut' names skin -> no value, no note. dry/oily: no wording.",
    "d1Rationale": NO_D1,
    "changes": [{"property": "focusPrimary", "blind": "scalp_active (provisional, low)", "final": "scalp_active (high)", "evidence": "name", "reason": "Confirmed."},
                {"property": "usageRole", "blind": "regular (provisional)", "final": "treatment (high)", "evidence": "dandruff claim + active", "reason": "U3."}],
    "uncertainties": ["'Ultra sensitiv ... sehr sensibler Haut' not treated as scalp positioning (E2 requires naming the scalp). If it were, it would be a separate sensitive unit and record researchCombinationTargets ['sensitive'] (S-SENSITIVE gate passes via CSA + Panthenol/Niacinamide/Bisabolol)."],
}

# ---------------------------------------------------------------- T217 Balea Professional Aqua Hyaluron
u, ut = usage("regular", "high", "none", "none", ["No frequency wording."], [], "Regular.")
J["T217"] = {
    "claimGrading": [
        {"claim": "Feuchtigkeitsspendendes Shampoo; Mit Hyaluron & Aloe Vera; für trockenes & feuchtigkeitsbedürftiges Haar", "source": "dm own brand (manufacturer_de)", "grade": "moderate", "use": "moisture focus candidate; 'Hyaluron' maps to Sodium Hyaluronate (13)"},
        {"claim": "Aqua Hyaluron (name)", "source": "product name", "grade": "high", "use": "moisture-type name word"},
        {"claim": "milde, pH-hautneutrale Rezeptur ... Kopfhaut geschont", "source": "manufacturer_de", "grade": "moderate", "use": "sparing/protective wording (E2a)"},
    ],
    "focusPrimary": F("general", "moderate", "moisture",
                      "General: the positioning is clearly moisture (name 'Aqua Hyaluron', manufacturer 'Feuchtigkeitsspendendes Shampoo'), but the formula verdict is nonspecific: the only listed humectant, Sodium Hyaluronate (13), and Aloe juice powder (11) are late, post-fragrance single tokens, not a coherent humectant cluster; F1 keeps moisture language over a nonspecific formula at general, and claims cannot turn nonspecific evidence into a specialist focus (3.2).",
                      "Name-level and manufacturer moisture claim; guar plus weak refatters give some conditioning support.",
                      [{"ingredient": "Sodium Hyaluronate", "position": 13}, {"ingredient": "Aloe Barbadensis Leaf Juice Powder", "position": 11}, {"ingredient": "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride", "position": 10}],
                      ["7.3", "F1", "3.2"], ["reveal:product_name", "reveal:dm_own_brand"], "nonspecific",
                      {"moistureRoutes": ["Sodium Hyaluronate 13"], "repairRoutes": [], "sharedRoutes": ["Guar 10", "Glyceryl Oleate 9", "Lecithin 16"], "limitation": "One late humectant token; aloe powder is not a humectant route (R11)."}, "candidate"),
    "focusSecondary": P([], "high", "none", "Empty.", "None.", [], ["8"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no scalp claim ('Kopfhaut geschont' is sparing wording).", "None.", [], ["10", "E2a"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "moisture (name high, manufacturer moderate)", "formulaCompatible": False, "compatibleRoute": None, "decisionReason": "Verdict nonspecific -> general (F1)."},
                      "secondary": sec([], [], [], "None."), "usage": ut},
    "primary": ordinary([1], "high", "Ordinary (way 1): no E2 claim; dm own-brand manufacturer source -> high."),
    "d1Rationale": NO_D1,
    "changes": [{"property": "focusPrimary", "blind": "general (provisional, low)", "final": "general (moderate)", "evidence": "moisture claims", "reason": "Formula nonspecific; claim cannot make a specialist focus."}],
    "uncertainties": ["Moisture vs general: a strong moisture claim over a thin humectant formula; read as nonspecific (moisture is the neighbor)."],
}

# ---------------------------------------------------------------- T218 Langhaarmädchen Beautiful Curls
u, ut = usage("regular", "high", "none", "none", ["No moderate/high claim."], [], "Regular.")
J["T218"] = {
    "claimGrading": [
        {"claim": "Shampoo für Locken und Wellen; Curly Girl; Sprungkraft; definierte Locken", "source": "retailer (dm PDP, dm-exclusive brand, sourceKind retailer)", "grade": "low", "use": "hair_texture, not a focus (T2)"},
        {"claim": "gesunden Glanz und natürliches Volumen direkt am Ansatz", "source": "retailer", "grade": "low", "use": "shine/volume side statements"},
        {"claim": "Aminosäuren-Komplex; reinigt schonend", "source": "retailer", "grade": "low", "use": "not a focus"},
    ],
    "focusPrimary": F("general", "moderate", "moisture",
                      "General: the dominant job is curl care (hair_texture, not a focus value); the only focus-type wording (shine, root volume) is low-graded side copy without independent formula support, and there is no moisture claim to pair with the moisture_supported formula verdict.",
                      "Formula humectant cluster (Glycerin 10, Sodium PCA 20, PCA 12, amino acids) would support moisture if positioned.",
                      [{"ingredient": "Glycerin", "position": 10}, {"ingredient": "Sodium PCA", "position": 20}],
                      ["7.2", "CL-SRC"], ["reveal:retailer_dm_de"], "moisture_supported",
                      {"moistureRoutes": ["Glycerin 10", "Sodium PCA 20", "PCA 12", "amino acids"], "repairRoutes": [], "sharedRoutes": ["Guar 17", "Glyceryl Oleate 11", "Glycol Distearate 16"], "limitation": "No moisture claim."}, "not_applicable"),
    "focusSecondary": P([], "high", "none", "Empty.", "None.", [], ["8"], ["reveal"]),
    "usageRole": u,
    "scalpComfortTarget": P("not_targeted", "high", "none", "Not targeted: no scalp claim.", "None.", [], ["10"], ["reveal"]),
    "decisionTrace": {"primary": {"claimDirection": "curls (not a focus); shine/volume side claims (low)", "formulaCompatible": None, "compatibleRoute": None, "decisionReason": "No focus-type positioning with independent support -> general."},
                      "secondary": sec([], [], [], "None."), "usage": ut},
    "primary": ordinary([1], "moderate", "Ordinary (way 1): no E2 claim; retailer copy only -> moderate."),
    "d1Rationale": NO_D1,
    "changes": [{"property": "focusPrimary", "blind": "moisture (provisional, low)", "final": "general (moderate)", "evidence": "reveal shows no moisture positioning; curl positioning only", "reason": "A formula route without matching positioning does not create a focus."}],
    "uncertainties": [],
}
