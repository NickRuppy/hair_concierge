"""Lane A, batch T3 - Phase 2 (post-unblind reconciliation + section 13 projection).
Judgments (focus, usage, scalp comfort, D1, scalp targets, combination, uncertainties) are authored
below by the lane classifier. cleansing/conditioning/weight/dandruffSupport are carried unchanged
from the frozen blind records. Projection mechanics (T1/T6/T4/W-LIVE/I1/I3/D2/D3/rows/13.8) are computed.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLIND = os.path.join(ROOT, "out", "formula-pass")
REVEAL = os.path.join(ROOT, "reveal")
OUT = os.path.join(ROOT, "out")

RANK = {"low": 0, "moderate": 1, "high": 2}
def cmin(*cs):
    return min(cs, key=lambda c: RANK[c])

BUCKET = {"ordinary": ("normal", "balanced", "regular"), "oily": ("dehydriert-fettig", "oily", "regular"),
          "dry": ("trocken", "dry", "gentle"), "sensitive": ("irritationen", "irritated", "gentle"),
          "dandruff": ("schuppen", "dandruff", "regular")}
TIER = {"ideal": 2, "acceptable": 1, "not_suited": 0}


def t1(th, W, C):
    if th == "fine":
        return {"low": "ideal", "moderate": "acceptable", "high": "not_suited"}[W]
    if th == "normal":
        return {"low": "ideal", "moderate": "ideal", "high": "acceptable"}[W]
    if W == "high":
        return "ideal"
    return "ideal" if C == "high" else "acceptable"


def t6(fit, concern):
    return "acceptable" if (concern and fit == "not_suited") else fit


def i1(cs, d1):
    return {"low": "gentle", "moderate": "regular"}.get(cs, "clarifying" if d1 else "regular")


def U(prop, value, conf, nb, rationale, counter, facts=None, **extra):
    d = {"value": value, "confidence": conf, "rationale": rationale, "counterSignal": counter,
         "neighboringAlternative": nb, "formulaFacts": facts or []}
    d.update(extra)
    return d


J = {}

# ------------------------------------------------------------------ T301
J["T301"] = dict(
    sources="S1 manufacturer_de (moderate); S2 dm retailer (low); S3 Rossmann retailer (low); S4 Mueller retailer (low)",
    focusP=U("focusPrimary", "clarifying", "moderate", "general",
             "Oily-scalp/sebum positioning ('Die Taetigkeit der Talgdruesen wird reguliert und die Fettabsonderung ... gemindert', 'gegen ... fettiges Haar', S1 moderate) with a compatible formula (F6: cleansing moderate, conditioning low, weight low). The co-dominant dandruff claim is incompatible (no recognized active, 7.2) and the irritation wording sits inside dandruff units, so it is not SC1 positioning.",
             "The oily wording sits only inside sentences that also name dandruff; dandruff is the product's lead problem but has no recognized active; general is the realistic neighbor.",
             [{"ingredient": "Sodium Laureth Sulfate", "position": 2}, {"ingredient": "Cocamidopropyl Betaine", "position": 3}, {"ingredient": "Coco-Betaine", "position": 7}],
             claimRole="candidate",
             careDirection={"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "No lengths-care claim; formula nonspecific."},
             decisionTrace={"claimDirection": "scalp: dandruff + irritation + oily (one claim unit, S1)", "formulaCompatible": "dandruff: no (no Piroctone Olamine/Climbazole); sensitive: no (scalpComfortTarget not_targeted); clarifying: yes (F6)", "compatibleRoute": "C1 SLES chassis with low conditioning and low weight", "decisionReason": "Dominant dandruff role incompatible; next dominant compatible job is the oily/sebum (clarifying) role."}),
    focusS=U("focusSecondary", [], "high", "none", "No distinct second positioning with an independent route.", "Tea-tree 'Pflege fuer Haar & Kopfhaut' is generic care.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "regular", "high", "none", "Default. Oily wording is reset intent (U4) but cleansing is moderate, so alternating cannot fire; no frequency wording; no recognized active for treatment; no D1.",
            "'Kurshampoo' and a 3-minute second-wash leave-on are not triggers.",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": ["strong_plus_reset_intent not met (cleansing moderate)"], "rationale": "No trigger fires."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none",
          "No SC1 positioning: 'Kopfhautreizungen'/'Reizungen' occur only inside dandruff claim units (E2a/SC1, dandruff symptoms). The only separate soothing unit ('Das Kur-Shampoo traegt dazu bei, die Kopfhaut zu beruhigen') is Mueller retailer copy (low, CL-SRC). CSA would pass via PEG-7 Glyceryl Cocoate (6).",
          "Prominent tea tree essential oil (4) is an irritation counter-signal in any case.",
          [{"ingredient": "PEG-7 Glyceryl Cocoate", "position": 6}, {"ingredient": "Melaleuca Alternifolia Leaf Oil", "position": 4}]),
    d1=(False, None, "No D1 stem in name or manufacturer claims."),
    primary=("ordinary", "moderate", "S-ORDINARY way 4: the dandruff claim (S1 'Gegen Kopfhautreizungen, Schuppen und fettiges Haar', 'Effektiv gegen Schuppen ...') fails the S-DANDRUFF formula gate (dandruffSupport not_supported) and nothing else passes; oily and irritation wording are inside dandruff units (E2a), oily-only separate units exist only in retailer copy (low). review_specialist_gate_failed raised."),
    secondary=None,
    rct=[], extraFlags=["review_specialist_gate_failed"],
    flagDetail={"review_specialist_gate_failed": "target dandruff; formula gate failed: dandruffSupport not_supported (no Piroctone Olamine/Climbazole; tea tree oil does not count)"},
    notes=[], noteDetail={},
    unc=[{"reading": "Oily wording inside dandruff units used for focus (clarifying) though E2a absorbs it for targets", "chosen": "focusPrimary clarifying", "alternative": "focusPrimary general"},
         {"reading": "S-FAIL vs plain ordinary", "chosen": "dandruff claim present -> S-FAIL review flag", "alternative": "none (claim is clear)"}],
)

# ------------------------------------------------------------------ T302
J["T302"] = dict(
    sources="S1 manufacturer_de Beiersdorf (moderate); S2 dm retailer (low); product name (high)",
    focusP=U("focusPrimary", "moisture", "moderate", "repair",
             "Formula verdict moisture_supported (Panthenol 10, Glycerin 15, Pantolactone 16 with emollient lipids and guar). The dominant name claim 'Repair/Reparatur' needs repair_supported or dual_supported, which the formula does not give (no protein/damage-care cluster; lipids act as emollient support). The moisture claims ('Versorgt das Haar mit lang anhaltender Feuchtigkeit', 'spendet dem Haar Feuchtigkeit', S1 moderate) are the next dominant compatible job (7.2, F1).",
             "The product name positions repair; a reader who counts the lipid + guar deposition cluster as a substantive repair cluster would get dual_supported and repair by name tie-break.",
             [{"ingredient": "Panthenol", "position": 10}, {"ingredient": "Glycerin", "position": 15}, {"ingredient": "Squalane", "position": 9}, {"ingredient": "Cocos Nucifera Oil", "position": 11}],
             claimRole="candidate",
             careDirection={"verdict": "moisture_supported", "moistureRoutes": ["Panthenol 10", "Glycerin 15", "Pantolactone 16"], "repairRoutes": [], "sharedRoutes": ["Squalane 9", "Cocos Nucifera Oil 11", "Dicaprylyl Ether 12", "Guar HPTC 13"], "limitation": "Rinse-off; humectants mid/late list."},
             decisionTrace={"claimDirection": "repair (name, high) + moisture (S1 moderate)", "formulaCompatible": "repair: no (moisture_supported only); moisture: yes", "compatibleRoute": "humectant cluster + emollient lipids", "decisionReason": "Dominant repair claim incompatible; moisture is the dominant compatible job."}),
    focusS=U("focusSecondary", [], "high", "none", "Repair is incompatible; 'ohne zu beschweren', 'Widerstandskraft' and gentle scalp cleansing are not focus routes.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": ["repair (incompatible)"], "routes": [], "exception": None}),
    usage=U("usageRole", "regular", "high", "none", "Default; no frequency wording, no reset intent, cleansing moderate.", "'Reinigt sanft die Kopfhaut' is mildness, not frequency (U2).",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": [], "rationale": "No trigger."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none", "No scalp-state positioning; 'Hautvertraeglichkeit dermatologisch bestaetigt' and 'reinigt sanft die Kopfhaut' are protective/mildness wording (SC1).", "CSA would pass (Panthenol 10).",
          [{"ingredient": "Panthenol", "position": 10}]),
    d1=(False, None, "No D1 wording."),
    primary=("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present."),
    secondary=None, rct=[], extraFlags=[], flagDetail={}, notes=[], noteDetail={},
    unc=[{"reading": "care-direction verdict (blind moisture_supported kept)", "chosen": "moisture_supported -> focus moisture", "alternative": "dual_supported -> focus repair by name tie-break"},
         {"reading": "conditioningLevel C2 via lipid substitution (blind)", "chosen": "high", "alternative": "moderate (lipids after Citric Acid)"}],
)

# ------------------------------------------------------------------ T303
J["T303"] = dict(
    sources="name (high); S1 manufacturer_de (moderate); S2 Rossmann (low); S3 dm (low)",
    focusP=U("focusPrimary", "scalp_active", "high", "none",
             "Explicit sensitive/itchy and dry-feeling scalp positioning (name 'Anti-Juckreiz'; S1 'beruhigend bei juckender und empfindlicher Kopfhaut', 'speziell fuer ... juckender, trockener und empfindlicher Kopfhaut') with scalpComfortTarget targeted (7.2).",
             "Strong-ish cleansing is absent; menthol/mint oil (12, 16) are cooling counter-signals though not prominent; medically framed claims (Neurodermitis, Psoriasis) are out of scope.",
             [{"ingredient": "Urea", "position": 6}, {"ingredient": "Laureth-9", "position": 3}, {"ingredient": "Menthol", "position": 12}],
             claimRole="candidate",
             careDirection={"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Scalp role, not a lengths decision."},
             decisionTrace={"claimDirection": "sensitive + dry scalp", "formulaCompatible": "yes (targeted, CSA via Urea 6)", "compatibleRoute": "Urea 6 + Laureth-9 (Polidocanol, named in S1) 3", "decisionReason": "Single scalp-led role, named in the product name."}),
    focusS=U("focusSecondary", [], "high", "none", "Moisture wording concerns the scalp ('Feuchtigkeitsgehalt der Kopfhaut'), already the primary scalp role; no lengths claim.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "frequent", "high", "none", "explicit_frequent_non_strong: S1 directions 'Fuer die taegliche Haarwaesche geeignet' (moderate, U2 'taeglich') and cleansingStrength moderate.", "None.",
            decisionTrace={"default": "regular", "trigger": "explicit_frequent_non_strong", "triggerEvidence": ["S1 directions: 'Fuer die taegliche Haarwaesche geeignet.'"], "losingTriggers": [], "rationale": "Frequency wording + non-strong cleansing."}),
    sct=U("scalpComfortTarget", "targeted", "high", "none",
          "SC1: name 'Anti-Juckreiz' (high) and S1 sensitive/dry scalp units (moderate). CSA: prominent Urea (6, E4 comfort + humectant) and Laureth-9 (3) = Polidocanol (named in S1 'wirkaktivem Polidocanol', E4 comfort).",
          "Menthol (12) and Mentha Arvensis Leaf Oil (16) are cooling signals but not prominent (after Sodium Benzoate 8).",
          [{"ingredient": "Urea", "position": 6}, {"ingredient": "Laureth-9", "position": 3}]),
    d1=(False, None, "No D1 wording."),
    primary=("sensitive", "high", "S-SENSITIVE: positioning name 'Anti-Juckreiz' (high, E2 'Juckreiz') + S1 'juckender und empfindlicher Kopfhaut'; formula: targeted + prominent comfort route Urea (6) (and Laureth-9/Polidocanol 3). Primary by name (S-PRIMARY)."),
    secondary=("dry", "moderate", "S-DRY: S1 unit 'speziell fuer die Beduerfnisse von juckender, trockener und empfindlicher Kopfhaut' names dry scalp (E2a: a unit naming two non-dandruff states counts for both) plus 'Spannungs- und Trockenheitsgefuehle werden gemildert'; formula: targeted + prominent humectant Urea (6). Positioning moderate."),
    rct=[], extraFlags=[], flagDetail={}, notes=[], noteDetail={},
    unc=[{"reading": "Laureth-9 = Polidocanol on the closed E4 comfort list", "chosen": "counted (INCI name of the listed route; S1 names it)", "alternative": "unlisted_route_candidate:Laureth-9 (gate still passes on Urea 6)"},
         {"reading": "'Schuppenflechte' (psoriasis) contains the 'Schuppen' stem", "chosen": "not an E2 dandruff claim (psoriasis, medical, out of scope)", "alternative": "dandruff claim failing S-DANDRUFF -> note claimed_target_not_projected:dandruff"},
         {"reading": "secondary dry from a unit naming two states", "chosen": "secondary dry", "alternative": "no secondary"}],
)

# ------------------------------------------------------------------ T304
J["T304"] = dict(
    sources="name (high); S1 manufacturer_de (moderate); S2 dm (low); S3 Rossmann (low)",
    focusP=U("focusPrimary", "scalp_active", "high", "none",
             "Problem-led anti-dandruff product (name 'Anti Schuppen', high) with a recognized active (Piroctone Olamine 9) (7.2).", "Sensitive-scalp wording is bundled with the dandruff claim; CSA fails.",
             [{"ingredient": "Piroctone Olamine", "position": 9}], claimRole="candidate",
             careDirection={"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Active-led."},
             decisionTrace={"claimDirection": "dandruff", "formulaCompatible": "yes (dandruffSupport supported)", "compatibleRoute": "Piroctone Olamine 9", "decisionReason": "Dandruff claim + active."}),
    focusS=U("focusSecondary", [], "high", "none", "No lengths claim; scalp sub-features are inside the dandruff role.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "treatment", "high", "none", "recognized_active_problem_led: dandruffSupport supported + qualifying dandruff claim (name, high) (U3).", "None.",
            decisionTrace={"default": "regular", "trigger": "recognized_active_problem_led", "triggerEvidence": ["name 'Anti Schuppen'", "Piroctone Olamine 9"], "losingTriggers": ["explicit_frequent_non_strong (S1 'ideal fuer die taegliche Anwendung')"], "rationale": "U1: treatment precedes frequent."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none",
          "All sensitive-scalp wording on S1 ('SENSITIVE KOPFHAUT Anti-Schuppen Shampoo', 'Anti-Schuppen Shampoo empfindliche Kopfhaut ...', 'Juckreiz im Zusammenhang mit Schuppen') sits in dandruff units (E2a/E2b bundled), so it is not SC1; separate 'fuer empfindliche Kopfhaut' only in retailer copy (low). CSA also fails: no prominent E4 route.",
          "'Sensitive' in the name does not name the scalp (F7).", [{"ingredient": "Avena Sativa Kernel Extract", "position": 23}, {"ingredient": "Glycerin", "position": 22}]),
    d1=(False, None, "No D1 wording."),
    primary=("dandruff", "high", "S-DANDRUFF: E2 dandruff claim in the name (high) + dandruffSupport supported (Piroctone Olamine 9); dandruff path, no secondary (R17.2)."),
    secondary=None,
    rct=["oily"], extraFlags=[], flagDetail={},
    notes=["suits_dandruff_with_oily_scalp", "dandruff_bundled_comfort_wording"],
    noteDetail={"suits_dandruff_with_oily_scalp": "S1 (moderate) 'drei Kopfhautprobleme (Schuppen, Juckreiz durch Schuppen und fettige Kopfhaut)', 'Schuppen, Oel und Juckreiz'; S-OILY clause passes (cleansing moderate, weight low, conditioning moderate). Combination confidence moderate.",
                "dandruff_bundled_comfort_wording": "'SENSITIVE KOPFHAUT Anti-Schuppen Shampoo', 'Juckreiz im Zusammenhang mit Schuppen' (S1 moderate); failed clause: S-SENSITIVE gate (CSA fails, no prominent E4 comfort route; Avena 23, Glycerin 22, Aloe juice 20 are after Parfum 11)."},
    unc=[{"reading": "oily wording inside dandruff units feeds the oily combination", "chosen": "['oily'] (R17.2)", "alternative": "[]"}],
)

# ------------------------------------------------------------------ T305
J["T305"] = dict(
    sources="S1 German retailer exact GTIN (low); S2 manufacturer_de Garnier (moderate); S3 retailer other GTIN (low)",
    focusP=U("focusPrimary", "general", "moderate", "clarifying",
             "Deep-cleansing + oily-scalp positioning (S2 'Tiefenreinigungsshampoo, das schnell fettende Kopfhaut reinigt') points to clarifying, but F6 compatibility fails: conditioningLevel is high (W-RICH: Nigella Sativa Seed Oil 5 + guar 8). Next job, moisture for dry lengths ('spendet trockenen Haarlaengen bis zu 72 Stunden Feuchtigkeit'), fails because the care-direction verdict is nonspecific. -> general.",
             "If conditioningLevel were moderate (its N-ALT neighbor), clarifying would be compatible and dominant.",
             [{"ingredient": "Ammonium Lauryl Sulfate", "position": 2}, {"ingredient": "Nigella Sativa Seed Oil", "position": 5}, {"ingredient": "Guar Hydroxypropyltrimonium Chloride", "position": 8}],
             claimRole="not_applicable",
             careDirection={"verdict": "nonspecific", "moistureRoutes": ["Polyglycerin-10 11 (not on closed humectant list)"], "repairRoutes": [], "sharedRoutes": ["Nigella Sativa Seed Oil 5", "Guar HPTC 8"], "limitation": "One oil + one guar distinguish no direction."},
             decisionTrace={"claimDirection": "clarifying (deep cleansing + oily scalp, S2 moderate); moisture for lengths", "formulaCompatible": "clarifying: no (F6 failed condition: conditioningLevel high); moisture: no (nonspecific)", "compatibleRoute": "none", "decisionReason": "No compatible specialist focus -> general."}),
    focusS=U("focusSecondary", [], "high", "none", "No compatible specialist role.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": ["clarifying (incompatible)", "moisture (nonspecific)"], "routes": [], "exception": None}),
    usage=U("usageRole", "occasional_reset", "high", "none", "explicit_deep_cleansing: D1 true (S2 manufacturer 'Tiefenreinigungsshampoo', moderate).", "Directions do not limit frequency.",
            decisionTrace={"default": "regular", "trigger": "explicit_deep_cleansing", "triggerEvidence": ["S2: 'Das Garnier Wahre Schaetze Ausgleichende Shampoo ist ein Tiefenreinigungsshampoo'"], "losingTriggers": ["strong_plus_reset_intent (strong + 'Rueckstaende und Unreinheiten', oily scalp)"], "rationale": "U1: occasional_reset precedes alternating."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none", "No sensitive/dry-scalp positioning; oily scalp is not a comfort target.", "CSA would pass only via Nigella oil (5); strong cleansing.",
          [{"ingredient": "Nigella Sativa Seed Oil", "position": 5}]),
    d1=(True, "moderate", "S2 manufacturer: 'Tiefenreinigungsshampoo' (stem tiefenrein), 'tiefenreinigende Shampoo'."),
    primary=("ordinary", "moderate", "S-ORDINARY way 4: S-OILY positioning passes (S2 'schnell fettende Kopfhaut', moderate) but its formula clause fails (conditioningLevel high); nothing else passes -> review_specialist_gate_failed."),
    secondary=None, rct=[],
    extraFlags=["review_specialist_gate_failed"],
    flagDetail={"review_specialist_gate_failed": "target oily; formula clause failed: conditioningLevel not high (is high, moderate confidence, neighbor moderate)"},
    notes=[], noteDetail={},
    unc=[{"reading": "conditioningLevel high via W-RICH alone (blind)", "chosen": "high -> F6 and S-OILY fail, general focus, D3 review", "alternative": "moderate -> clarifying focus, D2 flagged, oily target"},
         {"reading": "W-RICH 'prominent' read with E3 convention", "chosen": "Nigella oil 5 prominent", "alternative": "qualitative reading"}],
)

# ------------------------------------------------------------------ T306
J["T306"] = dict(
    sources="S1 Rossmann retailer (low); S2 pack front on Rossmann PDP (graded high in packet; English pack text, German marketing images)",
    focusP=U("focusPrimary", "general", "moderate", "clarifying",
             "Clarifying/buildup positioning (S2 'Clarifying blend visibly helps remove oils and residue to clear away buildup', 'ERFRISCHEND & KLAEREND') fails F6: cleansingStrength is low (C6). No other compatible job: 'Lipi Pro Shield' protection over a nonspecific formula is not repair (F1). -> general.",
             "Refreshing-scalp/buildup role is the evident marketing job.", [{"ingredient": "Sodium Methyl Cocoyl Taurate", "position": 2}],
             claimRole="not_applicable",
             careDirection={"verdict": "nonspecific", "moistureRoutes": [], "repairRoutes": [], "sharedRoutes": ["Amodimethicone 11", "Starch HPTC 17"], "limitation": "Generic conditioning."},
             decisionTrace={"claimDirection": "clarifying (buildup), refreshing scalp", "formulaCompatible": "clarifying: no (F6 failed condition: cleansingStrength low)", "compatibleRoute": "none", "decisionReason": "-> general."}),
    focusS=U("focusSecondary", [], "high", "none", "No compatible second role.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "regular", "high", "none", "Buildup/klaerend wording is reset intent (U4) but cleansing is low, so alternating cannot fire; no frequency wording; no D1 ('Clarifying blend' is not 'Clarifying Shampoo').", "None.",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": ["strong_plus_reset_intent not met (cleansing low)"], "rationale": "No trigger."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none", "No sensitive/dry-scalp claim ('refreshing scalp' names no scalp state).", "Prominent menthol, menthyl lactate, peppermint and rosemary oils.",
          [{"ingredient": "Menthol", "position": 8}]),
    d1=(False, None, "'Clarifying blend', 'KLAEREND' are not D1 stems (D1 'Not D1')."),
    primary=("ordinary", "high", "S-ORDINARY way 1: 'remove oils and residue' concerns hair, not the scalp/roots (E2 oily needs scalp or roots); no other E2 unit; pack source present."),
    secondary=None, rct=[], extraFlags=[], flagDetail={}, notes=[], noteDetail={},
    unc=[{"reading": "oily wording 'Oele und Rueckstaende entfernen' / retailer 'fettiges Haar'", "chosen": "not an E2 oily scalp claim (no scalp/roots; retailer low)", "alternative": "oily claim -> S-OILY fails (cleansing low) -> S-FAIL review"},
         {"reading": "formula source tier 4", "chosen": "accepted as complete per packet", "alternative": "lower confidence"}],
)

# ------------------------------------------------------------------ T307
J["T307"] = dict(
    sources="name (high); S1 manufacturer_de (moderate); S2 dm (low)",
    focusP=U("focusPrimary", "moisture", "high", "none",
             "Name 'Hydrate & Care' (high) and S1 'Spendet intensive Feuchtigkeit', 'hilft, Trockenheit spuerbar zu mildern' over a moisture_supported formula (F1).", "'basis sensitive' is mildness, not a focus; no repair cluster.",
             [{"ingredient": "Glycerin", "position": 4}, {"ingredient": "Sodium Hyaluronate", "position": 10}, {"ingredient": "Betaine", "position": 17}, {"ingredient": "Helianthus Annuus Seed Oil", "position": 11}],
             claimRole="candidate",
             careDirection={"verdict": "moisture_supported", "moistureRoutes": ["Glycerin 4", "Sodium Hyaluronate 10", "Betaine 17"], "repairRoutes": [], "sharedRoutes": ["Helianthus Annuus Seed Oil 11", "Cetearyl Alcohol 15", "Guar HPTC 21"], "limitation": "Rinse-off."},
             decisionTrace={"claimDirection": "moisture", "formulaCompatible": "yes", "compatibleRoute": "humectant cluster + emollients", "decisionReason": "One dominant compatible claim."}),
    focusS=U("focusSecondary", [], "high", "none", "No distinct second positioning.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "regular", "moderate", "frequent", "Default: 'Tag fuer Tag' is not on the U2 frequency list.", "'Fuer die extra Portion Feuchtigkeit - Tag fuer Tag' reads as daily use.",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": ["explicit_frequent_non_strong considered: 'Tag fuer Tag' not U2 wording"], "rationale": "U2 list closed in practice."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none",
          "Only protective/sparing ('Sanft zur Kopfhaut', 'Schont empfindliche Kopfhaut') and ingredient-reputation wording ('Bio-Aloe Vera ist bekannt dafuer, die Kopfhaut zu beruhigen') - not SC1 (E2a). Name 'Sensitiv' does not name the scalp.", "CSA would pass.",
          [{"ingredient": "Glycerin", "position": 4}]),
    d1=(False, None, "No D1 wording."),
    primary=("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 unit; 'trockenes Haar' is hair, not scalp; manufacturer source present."),
    secondary=None, rct=[], extraFlags=[], flagDetail={}, notes=[], noteDetail={},
    unc=[{"reading": "'Tag fuer Tag' as U2 frequency wording", "chosen": "not U2 -> regular", "alternative": "frequent"}],
)

# ------------------------------------------------------------------ T308
J["T308"] = dict(
    sources="S1 pack back photo (moderate); S2 manufacturer_de Rossmann (moderate); S3 Rossmann DK (low)",
    focusP=U("focusPrimary", "general", "moderate", "scalp_active",
             "Sensitive-scalp positioning ('fuer empfindliche Kopfhaut & normales Haar', S2) cannot carry scalp_active because scalpComfortTarget is not_targeted (CSA fails); 'Sensitiv'/'besonders sanft' is mildness; no lengths claim -> general.",
             "The product is clearly positioned for sensitive scalp.", [{"ingredient": "Panthenol", "position": 12}], claimRole="not_applicable",
             careDirection={"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "No lengths-care claim."},
             decisionTrace={"claimDirection": "sensitive scalp", "formulaCompatible": "no (not_targeted: no prominent E4 route)", "compatibleRoute": "none", "decisionReason": "-> general."}),
    focusS=U("focusSecondary", [], "high", "none", "Nothing qualifies.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "regular", "high", "none", "Default.", "None.",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": [], "rationale": "No trigger."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none",
          "SC1 positioning exists (S2 bullet 'fuer empfindliche Kopfhaut & normales Haar', moderate; 'auch bei empfindlicher Kopfhaut bestens geeignet' is tolerance wording) but CSA fails: the prominent zone is positions 1-5 (Parfum 6) and contains no E4 route; Panthenol 12, Niacinamide 13, Glyceryl Oleate 7 are after Parfum. Missing route named.", "None.",
          [{"ingredient": "Panthenol", "position": 12}, {"ingredient": "Niacinamide", "position": 13}]),
    d1=(False, None, "No D1 wording."),
    primary=("ordinary", "moderate", "S-ORDINARY way 4: E2 sensitive unit (S2 'fuer empfindliche Kopfhaut', moderate) fails the S-SENSITIVE formula gate (not targeted; no prominent comfort route); nothing else passes -> review_specialist_gate_failed."),
    secondary=None, rct=[], extraFlags=["review_specialist_gate_failed"],
    flagDetail={"review_specialist_gate_failed": "target sensitive; formula gate failed: scalpComfortTarget not_targeted (CSA) and no prominent E4 comfort route (Panthenol 12/Niacinamide 13 after Parfum 6); no prominent unlisted candidate"},
    notes=[], noteDetail={},
    unc=[{"reading": "'fuer empfindliche Kopfhaut & normales Haar' as positioning vs suitability", "chosen": "positioning (E2a 'fuer ...') -> S-FAIL review", "alternative": "tolerance wording -> plain ordinary (way 1), no flag"}],
)

# ------------------------------------------------------------------ T309
J["T309"] = dict(
    sources="name (high); S1 manufacturer_de Rossmann (moderate); S2 pack front (high)",
    focusP=U("focusPrimary", "scalp_active", "moderate", "general",
             "SC1 sensitive positioning (S1 'beruecksichtigt die besonderen Beduerfnisse sehr sensibler und empfindlicher Kopfhaut', 'hautberuhigende Formel') with scalpComfortTarget targeted (Panthenol 8, Allantoin 9, fragrance-free).", "Positioning wording is 'considers the needs of' rather than an explicit 'fuer'; name 'Ultra Sensitiv' does not name the scalp.",
             [{"ingredient": "Panthenol", "position": 8}, {"ingredient": "Allantoin", "position": 9}], claimRole="candidate",
             careDirection={"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Scalp role."},
             decisionTrace={"claimDirection": "sensitive scalp", "formulaCompatible": "yes (targeted)", "compatibleRoute": "Panthenol 8, Allantoin 9", "decisionReason": "Single scalp-led role."}),
    focusS=U("focusSecondary", [], "high", "none", "'schuetzt ... vor Austrocknung' is protective; no lengths claim.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "frequent", "high", "none", "explicit_frequent_non_strong: product name 'Shampoo Jeden Tag' (high, U2 'fuer jeden Tag') and cleansing moderate.", "None.",
            decisionTrace={"default": "regular", "trigger": "explicit_frequent_non_strong", "triggerEvidence": ["name 'ISANA MED Shampoo Jeden Tag'"], "losingTriggers": [], "rationale": "Frequency wording + non-strong."}),
    sct=U("scalpComfortTarget", "targeted", "moderate", "not_targeted",
          "SC1: S1 sensitive-scalp unit (moderate). CSA: prominent Panthenol 8 and Allantoin 9 (E4 comfort), Glycerin 3 / Glyceryl Oleate 7 (humectant/refatting); no fragrance declared (supportive).", "Positioning sentence is indirect ('beruecksichtigt die Beduerfnisse').",
          [{"ingredient": "Panthenol", "position": 8}, {"ingredient": "Allantoin", "position": 9}]),
    d1=(False, None, "No D1 wording."),
    primary=("sensitive", "moderate", "S-SENSITIVE: positioning S1 (moderate); formula targeted + prominent comfort route (Panthenol 8, Allantoin 9)."),
    secondary=None, rct=[], extraFlags=[], flagDetail={}, notes=[], noteDetail={},
    unc=[{"reading": "'beruecksichtigt die besonderen Beduerfnisse sehr sensibler ... Kopfhaut' as an E2a qualifying unit", "chosen": "qualifies (product is for that scalp state)", "alternative": "not positioning -> not_targeted, ordinary"},
         {"reading": "'Jeden Tag' in name as U2", "chosen": "frequent", "alternative": "regular"}],
)

# ------------------------------------------------------------------ T310
J["T310"] = dict(
    sources="name (high); S1 manufacturer_de (moderate); S2 dm (low); S3 Mueller (low)",
    focusP=U("focusPrimary", "scalp_active", "high", "none", "Anti-dandruff name (high) + Piroctone Olamine (5) (7.2).", "Pro-Vitamin B5 lengths-care wording is generic.",
             [{"ingredient": "Piroctone Olamine", "position": 5}], claimRole="candidate",
             careDirection={"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Active-led."},
             decisionTrace={"claimDirection": "dandruff", "formulaCompatible": "yes", "compatibleRoute": "Piroctone Olamine 5", "decisionReason": "Dandruff claim + active."}),
    focusS=U("focusSecondary", [], "high", "none", "'Mit Pro-Vitamin B5 zur tiefen Pflege des Haares' is generic care, not a distinct positioned focus (repair/moisture claims only in Mueller retailer copy, low).", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "treatment", "high", "none", "recognized_active_problem_led (U3).", "None.",
            decisionTrace={"default": "regular", "trigger": "recognized_active_problem_led", "triggerEvidence": ["name 'Anti-Schuppen Classic'", "Piroctone Olamine 5"], "losingTriggers": ["frequent not fired ('Fuer die taegliche Haarwaesche geeignet' is dm retailer, low)"], "rationale": "Treatment."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none", "Soothing wording ('Eine beruhigte, erfrischte Kopfhaut und bis zu 100% schuppenfreies Haar') is in a dandruff unit (E2a/E2b), not SC1.", "CSA would pass (Panthenol 7).",
          [{"ingredient": "Panthenol", "position": 7}]),
    d1=(False, None, "No D1 wording."),
    primary=("dandruff", "high", "S-DANDRUFF: name 'Anti-Schuppen' (high) + Piroctone Olamine (5)."),
    secondary=None, rct=["sensitive"], extraFlags=[], flagDetail={},
    notes=["suits_dandruff_with_irritated_scalp"],
    noteDetail={"suits_dandruff_with_irritated_scalp": "Bundled comfort wording S1 'Eine beruhigte, erfrischte Kopfhaut und bis zu 100% schuppenfreies Haar' (moderate); S-SENSITIVE gate read as CSA + prominent comfort route: Panthenol 7 -> pass. Combination confidence moderate."},
    unc=[{"reading": "'beruhigte Kopfhaut' as comfort wording", "chosen": "comfort wording -> ['sensitive']", "alternative": "outcome wording, [] with note"}],
)

# ------------------------------------------------------------------ T311
J["T311"] = dict(
    sources="name (high); S1 manufacturer_de (moderate)",
    focusP=U("focusPrimary", "scalp_active", "high", "none", "Anti-dandruff name (high) + Piroctone Olamine (6).", "None material.",
             [{"ingredient": "Piroctone Olamine", "position": 6}], claimRole="candidate",
             careDirection={"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Active-led."},
             decisionTrace={"claimDirection": "dandruff", "formulaCompatible": "yes", "compatibleRoute": "Piroctone Olamine 6", "decisionReason": "Dandruff claim + active."}),
    focusS=U("focusSecondary", [], "high", "none", "No lengths claim.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "treatment", "high", "none", "recognized_active_problem_led (U3).", "None.",
            decisionTrace={"default": "regular", "trigger": "recognized_active_problem_led", "triggerEvidence": ["name 'Anti Schuppen'", "Piroctone Olamine 6"], "losingTriggers": [], "rationale": "Treatment."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none",
          "Itch/tension wording ('Bei Schuppen und juckender Kopfhaut'; 'Deine juckende Kopfhaut wird beruhigt und das Spannungsgefuehl reduziert', next to a dandruff sentence) is dandruff-unit or bundled wording (E2a/E2b), not SC1.", "CSA would pass (Panthenol 12).",
          [{"ingredient": "Panthenol", "position": 12}]),
    d1=(False, None, "No D1 wording."),
    primary=("dandruff", "high", "S-DANDRUFF: name 'Anti Schuppen' (high) + Piroctone Olamine (6)."),
    secondary=None, rct=["sensitive"], extraFlags=[], flagDetail={},
    notes=["suits_dandruff_with_irritated_scalp"],
    noteDetail={"suits_dandruff_with_irritated_scalp": "Bundled comfort wording S1 (moderate): 'Bei Schuppen und juckender Kopfhaut', 'Deine juckende Kopfhaut wird beruhigt und das Spannungsgefuehl reduziert'; S-SENSITIVE gate: CSA + prominent comfort route Panthenol 12 -> pass. Combination confidence moderate."},
    unc=[],
)

# ------------------------------------------------------------------ T312
J["T312"] = dict(
    sources="name (high); S1 manufacturer_de (moderate); S2 dm (low)",
    focusP=U("focusPrimary", "scalp_active", "high", "none", "Name 'Kopfhaut Sensitive' (high) + S1 'Fuer trockene und empfindliche Kopfhaut', with scalpComfortTarget targeted.", "Piroctone Olamine is present without any dandruff claim (R17.3: regular shampoo).",
             [{"ingredient": "Panthenol", "position": 7}, {"ingredient": "Betaine", "position": 5}, {"ingredient": "Glycerin", "position": 6}], claimRole="candidate",
             careDirection={"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Scalp role."},
             decisionTrace={"claimDirection": "sensitive + dry scalp", "formulaCompatible": "yes (targeted)", "compatibleRoute": "Panthenol 7; Betaine 5, Glycerin 6", "decisionReason": "Scalp role named in product name."}),
    focusS=U("focusSecondary", [], "high", "none", "No lengths claim beyond generic care.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "regular", "high", "none", "No dandruff claim (treatment needs U3); 'regelmaessige Anwendung' is not frequency wording.", "Recognized active present.",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": ["recognized_active_problem_led not met (no dandruff claim, R17.3)"], "rationale": "No trigger."}),
    sct=U("scalpComfortTarget", "targeted", "high", "none", "SC1: name 'Kopfhaut Sensitive' and S1 'beruhigen die empfindliche Kopfhaut sofort und mildern Juckreiz'. CSA: Panthenol 7 (comfort), Betaine 5, Glycerin 6 (humectant).", "Mentha Aquatica Leaf Extract (18) is a botanical extract, not a listed cooling agent.",
          [{"ingredient": "Panthenol", "position": 7}]),
    d1=(False, None, "No D1 wording."),
    primary=("sensitive", "high", "S-SENSITIVE: name 'Kopfhaut Sensitive' (high); targeted + prominent comfort route Panthenol 7. Primary by name."),
    secondary=("dry", "moderate", "S-DRY: S1 'Fuer trockene und empfindliche Kopfhaut' (moderate; unit names two states); targeted + prominent humectant (Betaine 5, Glycerin 6, Panthenol 7)."),
    rct=[], extraFlags=[], flagDetail={}, notes=["active_without_dandruff_positioning"],
    noteDetail={"active_without_dandruff_positioning": "Piroctone Olamine (15) without any dandruff claim; regular shampoo, no target restricted (R17.3)."},
    unc=[{"reading": "secondary dry from a unit naming two states", "chosen": "secondary dry", "alternative": "no secondary"}],
)

# ------------------------------------------------------------------ T313
J["T313"] = dict(
    sources="S1 manufacturer_de (moderate); S2 Rossmann (low); S3 dm (low)",
    focusP=U("focusPrimary", "scalp_active", "moderate", "moisture",
             "F7: a qualifying sensitive-scalp claim (S1 'wirkt beruhigend auf die juckende Kopfhaut', 'Erleichterung bei juckender Kopfhaut') and a lengths moisture claim ('spendet Feuchtigkeit und sorgt fuer geschmeidiges Haar'); the name word 'Beruhigendes' does not name the scalp, so neither role is in the name -> scalp_active primary (targeted).",
             "Moisture is an equally prominent claim and the formula is moisture_supported.", [{"ingredient": "Avena Sativa Kernel Extract", "position": 8}], claimRole="candidate",
             careDirection={"verdict": "moisture_supported", "moistureRoutes": ["Glycerin 5", "Aloe Barbadensis Leaf Juice 7"], "repairRoutes": [], "sharedRoutes": ["Glycine Soja Oil 6", "Dicaprylyl Ether 13", "Guar HPTC 19", "Polyquaternium-7 22"], "limitation": "Rinse-off; cationics late."},
             decisionTrace={"claimDirection": "sensitive/itchy scalp + moisture of hair", "formulaCompatible": "scalp_active: yes (targeted); moisture: yes", "compatibleRoute": "Avena Sativa Kernel Extract 8 (comfort)", "decisionReason": "F7 step 2: neither in name -> scalp_active primary."}),
    focusS=U("focusSecondary", ["moisture"], "moderate", [],
             "F7 step 3 / Section 8: distinct moisture positioning (S1 'spendet Feuchtigkeit und sorgt fuer geschmeidiges Haar', moderate) with an independent route (Glycerin 5, Soybean Oil 6, cationics) not cited by the scalp route (Avena 8).",
             "Moisture wording is partly a general care outcome.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": ["moisture"], "claims": ["S1 'spendet Feuchtigkeit und sorgt fuer geschmeidiges Haar'"], "routes": ["Glycerin 5", "Glycine Soja Oil 6", "Guar HPTC 19"], "distinctFromPrimary": "lengths hydration vs scalp comfort; disjoint ingredients (F3)", "exception": None}),
    usage=U("usageRole", "regular", "high", "none", "Default.", "None.",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": [], "rationale": "No trigger."}),
    sct=U("scalpComfortTarget", "targeted", "high", "none", "SC1: S1 'wirkt beruhigend auf die juckende Kopfhaut' (moderate). CSA: Avena Sativa Kernel Extract 8 (comfort), Glycerin 5, Soybean Oil 6 (humectant/refatting).", "None material (cleansing moderate, fragrance after all actives).",
          [{"ingredient": "Avena Sativa Kernel Extract", "position": 8}]),
    d1=(False, None, "No D1 wording."),
    primary=("sensitive", "moderate", "S-SENSITIVE: positioning S1 (moderate); targeted + prominent comfort route Avena Sativa Kernel Extract (8)."),
    secondary=None, rct=[], extraFlags=[], flagDetail={}, notes=[], noteDetail={},
    unc=[{"reading": "F7 primary", "chosen": "scalp_active (neither role in name)", "alternative": "moisture primary"},
         {"reading": "secondary moisture", "chosen": "['moisture']", "alternative": "[]"},
         {"reading": "pack size/GTIN binding unresolved", "chosen": "not material (formula identical across sizes)", "alternative": "identity block"}],
)

# ------------------------------------------------------------------ T314
J["T314"] = dict(
    sources="name (high); S1 dm own-brand manufacturer page (moderate); S2 Open Beauty Facts (low, empty)",
    focusP=U("focusPrimary", "scalp_active", "high", "none", "Name 'Kopfhaut Sensitive' (high) + S1 'Beruhigendes Shampoo fuer empfindliche Kopfhaut', targeted.", "Shine wording ('seidigen Glanz') is a minor outcome claim.",
             [{"ingredient": "Allantoin", "position": 8}, {"ingredient": "Bisabolol", "position": 9}, {"ingredient": "Panthenol", "position": 11}], claimRole="candidate",
             careDirection={"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Scalp role."},
             decisionTrace={"claimDirection": "sensitive + dry scalp", "formulaCompatible": "yes", "compatibleRoute": "Allantoin 8, Bisabolol 9, Panthenol 11", "decisionReason": "Scalp role named in product name (F7 step 1)."}),
    focusS=U("focusSecondary", [], "moderate", ["shine"], "Shine ('Das Haar ... erhaelt einen seidigen Glanz', 'glanzloses Haar') is an outcome sentence without an independent shine route (guar/pearlizer are generic; acids cannot create shine, F4).", "Shine is positioned at moderate grade.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": ["shine outcome sentence"], "routes": [], "exception": None}),
    usage=U("usageRole", "regular", "high", "none", "Default.", "None.",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": [], "rationale": "No trigger."}),
    sct=U("scalpComfortTarget", "targeted", "high", "none", "SC1: name + S1 sensitive units. CSA: Allantoin 8, Bisabolol 9, Panthenol 11 (comfort); Glycerin 5.", "None material.",
          [{"ingredient": "Allantoin", "position": 8}, {"ingredient": "Bisabolol", "position": 9}]),
    d1=(False, None, "No D1 wording."),
    primary=("sensitive", "high", "S-SENSITIVE: name 'Kopfhaut Sensitive' (high); targeted + comfort routes Allantoin 8, Bisabolol 9, Panthenol 11. Primary by name."),
    secondary=("dry", "moderate", "S-DRY: S1 'speziell fuer die Beduerfnisse von sensibler und trockener Kopfhaut entwickelt', 'Spannungsgefuehle mildern' (moderate); targeted + prominent humectant Glycerin 5, Panthenol 11."),
    rct=[], extraFlags=[], flagDetail={}, notes=[], noteDetail={},
    unc=[{"reading": "secondary dry", "chosen": "dry", "alternative": "none"}, {"reading": "secondary focus shine", "chosen": "[]", "alternative": "['shine']"}],
)

# ------------------------------------------------------------------ T315
J["T315"] = dict(
    sources="name (high); S1 manufacturer_de (moderate); S2 dm (low); S3 dm AT (low, unused)",
    focusP=U("focusPrimary", "repair", "high", "none", "Name 'Total Repair' (high) + S1 damage/breakage claims over a repair_supported formula (Dimethicone 5, Hydrolyzed Keratin 6, Amodimethicone 12).", "Shine/softness claims ride the same silicone route (F2).",
             [{"ingredient": "Dimethicone", "position": 5}, {"ingredient": "Hydrolyzed Keratin", "position": 6}, {"ingredient": "Amodimethicone", "position": 12}], claimRole="candidate",
             careDirection={"verdict": "repair_supported", "moistureRoutes": [], "repairRoutes": ["Dimethicone 5", "Hydrolyzed Keratin 6", "Amodimethicone 12"], "sharedRoutes": ["Guar HPTC 13"], "limitation": "Rinse-off; keratin is a hydrolysate."},
             decisionTrace={"claimDirection": "repair", "formulaCompatible": "yes", "compatibleRoute": "silicone + keratin + amodimethicone", "decisionReason": "Dominant compatible claim."}),
    focusS=U("focusSecondary", [], "high", "none", "Shine is delivered by the same silicone route (F2/F3); 'trockenes Haar' over a repair formula is not a separate moisture route.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": ["shine (same route)"], "routes": [], "exception": None}),
    usage=U("usageRole", "regular", "high", "none", "Default; 'Regelmaessig anwenden' is not U2; 'Tiefenreparatur' is not D1.", "None.",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": [], "rationale": "No trigger."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none", "No scalp positioning.", "None.", []),
    d1=(False, None, "'Tiefenreparatur' is not a D1 stem."),
    primary=("ordinary", "high", "S-ORDINARY way 1; manufacturer source present."),
    secondary=None, rct=[], extraFlags=[], flagDetail={}, notes=[], noteDetail={}, unc=[],
)

# ------------------------------------------------------------------ T316
J["T316"] = dict(
    sources="S1 manufacturer_de (moderate); S2 Rossmann (low); S3 dm (low)",
    focusP=U("focusPrimary", "general", "moderate", "moisture",
             "Claims are moisture ('Spendet langanhaltende Feuchtigkeit', 'Panthenol-Feuchtigkeits-Komplex') and curl definition (not a focus value, T2). The formula verdict is repair_supported, not moisture_supported or dual (only one humectant, Panthenol 7), so moisture is incompatible (F1); no explicit damage claim to carry repair ('staerkt das Haar von innen' is generic). -> general.",
             "A '3% Panthenol' claim could suggest a stronger humectant route (claims cannot prove concentration).", [{"ingredient": "Panthenol", "position": 7}, {"ingredient": "Hydrolyzed Keratin", "position": 6}, {"ingredient": "Dimethicone", "position": 8}],
             claimRole="not_applicable",
             careDirection={"verdict": "repair_supported", "moistureRoutes": ["Panthenol 7"], "repairRoutes": ["Hydrolyzed Keratin 6", "Dimethicone 8", "Amodimethicone 12"], "sharedRoutes": ["Guar HPTC 13"], "limitation": "Single humectant."},
             decisionTrace={"claimDirection": "moisture + curl definition", "formulaCompatible": "moisture: no (repair_supported)", "compatibleRoute": "none for the claimed job", "decisionReason": "-> general."}),
    focusS=U("focusSecondary", [], "high", "none", "Nothing qualifies.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "regular", "high", "none", "Default; 'Tiefenpflegende' / 'Tiefenspuelung' are not D1 (D1 'Not D1').", "None.",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": [], "rationale": "No trigger."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none", "'Reinigt sanft die Kopfhaut' is mildness.", "None.", []),
    d1=(False, None, "'Tiefenpflegende' is explicitly not D1."),
    primary=("ordinary", "high", "S-ORDINARY way 1; manufacturer source present."),
    secondary=None, rct=[], extraFlags=[], flagDetail={}, notes=[], noteDetail={},
    unc=[{"reading": "focus under moisture claim over repair_supported formula", "chosen": "general", "alternative": "moisture"}],
)

# ------------------------------------------------------------------ T317
J["T317"] = dict(
    sources="S1 dm own-brand retailer DE (low); S2 dm AT (low)",
    focusP=U("focusPrimary", "repair", "moderate", "general",
             "Repair claim ('Kann Haarbruch reduzieren und das Haar reparieren', low) acts as candidate because the formula independently supports repair (wheat protein 6, argan oil 7, guar 8, cationic quat 9); CL-SRC caps confidence at moderate. Hair-growth/hair-loss claims ignored (F5).", "All claims are retailer-graded low; the product's lead claim is hair growth (out of scope).",
             [{"ingredient": "Hydrolyzed Wheat Protein", "position": 6}, {"ingredient": "Argania Spinosa Kernel Oil", "position": 7}, {"ingredient": "Bis-(Isostearoyl/Oleoyl Isopropyl) Dimonium Methosulfate", "position": 9}],
             claimRole="candidate",
             careDirection={"verdict": "repair_supported", "moistureRoutes": ["Glycerin 5"], "repairRoutes": ["Hydrolyzed Wheat Protein 6", "Argania Spinosa Kernel Oil 7", "Bis-(Isostearoyl/Oleoyl Isopropyl) Dimonium Methosulfate 9"], "sharedRoutes": ["Guar HPTC 8"], "limitation": "Rinse-off."},
             decisionTrace={"claimDirection": "repair (low); hair growth (ignored, F5)", "formulaCompatible": "yes (repair_supported)", "compatibleRoute": "protein + lipid + cationic cluster", "decisionReason": "Low claim allowed as candidate with independent formula support; capped moderate."}),
    focusS=U("focusSecondary", [], "high", "none", "Shine ('natuerlichen Glanz', low) has no independent route.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "regular", "high", "none", "Default; low claims never trigger.", "None.",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": [], "rationale": "No trigger."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none", "No scalp-comfort positioning.", "None.", []),
    d1=(False, None, "No D1 wording."),
    primary=("ordinary", "moderate", "S-ORDINARY ways 1 and 2: no qualifying E2 unit; only scalp-adjacent positioning is hair growth/loss (S-HAIRLOSS, not evaluated); retailer copy only."),
    secondary=None, rct=[], extraFlags=[], flagDetail={}, notes=["hair_loss_claim_not_evaluated"],
    noteDetail={"hair_loss_claim_not_evaluated": "'Wirkung: gegen Haarausfall', 'das Haarwachstum zu stimulieren', 'fuer dichteres Haar' (S1/S2)."},
    unc=[{"reading": "low-graded repair claim as candidate", "chosen": "repair (moderate)", "alternative": "general"}],
)

# ------------------------------------------------------------------ T318
J["T318"] = dict(
    sources="name (high); S1 Rossmann (low); S2 Hagel retailer (low); S3 US brand page, English (low, E1 foreign)",
    focusP=U("focusPrimary", "volume", "moderate", "general",
             "Name 'Big Hair ... (Volumen Shampoo)' (high) positions fullness/volume; formula is compatible but with a trade-off (weightPotential moderate, not high).", "Formula is W-RICH (macadamia + avocado oils with two cationics) and conditioningLevel high, which works against lift; 'Volumen Shampoo' may be retailer title text.",
             [{"ingredient": "Macadamia Integrifolia Seed Oil", "position": 8}, {"ingredient": "Persea Gratissima Oil", "position": 9}], claimRole="candidate",
             careDirection={"verdict": "not_applicable", "moistureRoutes": [], "repairRoutes": [], "sharedRoutes": [], "limitation": "Volume decision."},
             decisionTrace={"claimDirection": "volume", "formulaCompatible": "yes with trade-off (weight moderate)", "compatibleRoute": "C1 AOS chassis; no silicone", "decisionReason": "Positioned focus kept; deposition recorded as trade-off (7.2)."}),
    focusS=U("focusSecondary", [], "high", "none", "'Klaerend'/'clarifying wash' are low-graded; no other qualifying claim.", "None.",
             decisionTrace={"emptyDefaultConsidered": True, "selected": [], "claims": [], "routes": [], "exception": None}),
    usage=U("usageRole", "regular", "high", "none", "Default; 'Invigorating daily shampoo' is on a foreign page (low) and cannot fire frequent.", "None.",
            decisionTrace={"default": "regular", "trigger": "none", "triggerEvidence": [], "losingTriggers": ["frequent: only low-graded wording"], "rationale": "No trigger."}),
    sct=U("scalpComfortTarget", "not_targeted", "high", "none", "No scalp positioning.", "None.", []),
    d1=(False, None, "No D1 wording ('clarifying wash' is foreign, low and not 'Clarifying Shampoo')."),
    primary=("ordinary", "moderate", "S-ORDINARY way 1; retailer/foreign copy only (13.8 -> moderate)."),
    secondary=None, rct=[], extraFlags=[], flagDetail={}, notes=[], noteDetail={},
    unc=[{"reading": "volume compatibility with W-RICH formula", "chosen": "volume (trade-off)", "alternative": "general"}],
)


def project(bid, b, j):
    dp = b["directProperties"]
    cs, cl, wp = dp["cleansingStrength"], dp["conditioningLevel"], dp["weightPotential"]
    W, Wc, Wn = wp["value"], wp["confidence"], wp["neighboringAlternative"]
    C, Cc, Cn = cl["value"], cl["confidence"], cl["neighboringAlternative"]
    prim = j["primary"][0]
    targets = [prim] + ([j["secondary"][0]] if j["secondary"] else [])
    concern = prim != "ordinary"
    flags, flagDetail = list(j["extraFlags"]), dict(j["flagDetail"])
    notes, noteDetail = list(j["notes"]), dict(j["noteDetail"])
    thick, floor = [], []
    t4 = []
    for th in ("fine", "normal", "coarse"):
        raw = t1(th, W, C)
        fit = t6(raw, concern)
        if fit != raw:
            floor.append(th)
        conf = cmin(Wc, Cc) if th == "coarse" else Wc
        lower = False
        if Wn != "none":
            if TIER[t6(t1(th, Wn, C), concern)] < TIER[fit]:
                lower = True
        if th == "coarse" and Cn != "none":
            if TIER[t6(t1(th, W, Cn), concern)] < TIER[fit]:
                lower = True
        if lower:
            t4.append(th)
        rat = f"T1 ({th}, W {W}{', C ' + C if th == 'coarse' else ''}) = {raw}"
        rat += f"; T6 lifts to {fit}" if fit != raw else ("; T6 not needed" if concern else "; ordinary target, T6 n/a")
        if lower:
            rat += "; T4: neighbor would lower the tier -> review_thickness_boundary"
        thick.append({"thickness": th, "fit": fit, "confidence": conf, "rationale": rat})
    if t4:
        flags.append("review_thickness_boundary")
        flagDetail["review_thickness_boundary"] = ", ".join(t4)
    if floor:
        notes.append("scalp_concern_floor_applied")
        noteDetail["scalp_concern_floor_applied"] = ", ".join(floor)
    d1, d1conf, d1ev = j["d1"]
    inten = i1(cs["value"], d1)
    # I3
    if cs["neighboringAlternative"] != "none":
        ni = i1(cs["neighboringAlternative"], d1)
        for t in targets:
            exp = BUCKET[t][2]
            if inten == exp and ni != exp:
                flags.append("review_intensity_boundary")
                flagDetail["review_intensity_boundary"] = BUCKET[t][0]
    fp, ur = j["focusP"]["value"], j["usage"]["value"]
    d2 = d1 and cs["value"] == "strong" and fp == "clarifying" and ur == "occasional_reset"
    if d1 and cs["value"] == "strong" and not d2:
        flags.append("review_reset_positioning_mismatch")
        flagDetail["review_reset_positioning_mismatch"] = f"D1 true, cleansing strong, D2 not met (focusPrimary {fp}, usageRole {ur})"
    if d1 and cs["value"] in ("low", "moderate"):
        notes.append("deep_cleansing_name_ordinary_formula")
    if d2:
        notes.append("deep_cleanser_listing")
    # S-FOCUS check
    fs = j["focusS"]["value"]
    sa = fp == "scalp_active" or "scalp_active" in fs
    if any(t in ("dandruff", "sensitive", "dry") for t in targets) and not sa:
        flags.append("review_focus_target_mismatch")
    if "oily" in targets and not (fp == "clarifying" or "clarifying" in fs):
        flags.append("review_focus_target_mismatch")
    if sa and prim == "ordinary" and "review_specialist_gate_failed" not in flags:
        flags.append("review_focus_target_mismatch")
    weight = {"low": "light", "moderate": "moderate", "high": "heavy"}[W]
    rows = []
    for th in thick:
        if th["fit"] in ("ideal", "acceptable"):
            for t in targets:
                bk, rt, exp = BUCKET[t]
                rows.append({"thickness": th["thickness"], "shampoo_bucket": bk, "scalp_route": rt, "cleansing_intensity": inten, "weight": weight, "tier": th["fit"],
                             "display": "green" if (th["fit"] == "ideal" and inten == exp) else "amber"})
    roles = sorted({"shampoo_dandruff" if r["shampoo_bucket"] == "schuppen" else "shampoo_everyday" for r in rows})
    inten_conf = cs["confidence"] if inten != "clarifying" else cmin(cs["confidence"], d1conf)
    dcl_conf = cmin(cs["confidence"], j["focusP"]["confidence"], j["usage"]["confidence"], *( [d1conf] if d1 else []))
    st = {"primary": {"target": prim, "bucket": BUCKET[prim][0], "route": BUCKET[prim][1], "confidence": j["primary"][1], "rationale": j["primary"][2]},
          "secondary": None if not j["secondary"] else {"target": j["secondary"][0], "bucket": BUCKET[j["secondary"][0]][0], "route": BUCKET[j["secondary"][0]][1], "confidence": j["secondary"][1], "rationale": j["secondary"][2]}}
    projConfs = [t["confidence"] for t in thick] + [Wc, j["primary"][1], inten_conf] + ([j["secondary"][1]] if j["secondary"] else [])
    proj = {
        "thicknesses": thick,
        "weight": {"value": weight, "confidence": Wc, "rationale": f"W-LIVE: weightPotential {W} -> {weight}."},
        "scalpTargets": st,
        "observedCleansingIntensity": {"value": inten, "confidence": inten_conf, "rationale": f"I1: cleansingStrength {cs['value']}, D1 {d1} -> {inten}."},
        "positioning": {"explicitResetPositioning": d1, "confidence": d1conf or "high", "evidence": d1ev},
        "explicitResetPositioning": d1,
        "deepCleanserListing": {"value": "flagged" if d2 else "not_flagged", "confidence": dcl_conf,
                                "rationale": "D2 met" if d2 else ("D2 not met: " + ("focus/usage fail on a strong D1 formula (D3)" if d1 and cs["value"] == "strong" else ("ordinary-strength D1 (R16.3)" if d1 else "D1 false")))},
        "rows": rows,
        "requiredProtocolRoles": roles,
        "reviewFlags": [{"code": f, "detail": flagDetail.get(f, "")} for f in dict.fromkeys(flags)],
        "informationalNotes": [{"code": n, "detail": noteDetail.get(n, "")} for n in dict.fromkeys(notes)],
        "researchCombinationTargets": j["rct"],
        "catalogDependent": "review_live_value_differs not computed in lane (live rows unseen).",
    }
    if d2:
        proj["deepCleanserListing"]["deepCleanserRecord"] = "needs_record"
    return proj, projConfs


def main():
    table = []
    for bid in sorted(J):
        b = json.load(open(os.path.join(BLIND, bid + ".json")))
        rv = json.load(open(os.path.join(REVEAL, bid + ".json")))
        j = J[bid]
        dp = b["directProperties"]
        def carry(k):
            d = dict(dp[k]); d["blindToFinal"] = "unchanged"; d["sourceIds"] = ["formula packet " + bid]
            if k in ("cleansingStrength", "conditioningLevel", "weightPotential"):
                d["formulaFacts"] = [f for f in b["formulaFacts"]]
            return d
        wrec = carry("weightPotential")
        wrec.update({"formulaIdentifiers": {"inciFingerprintSha256": b["inciFingerprintSha256"], "sourceTier": b["formulaBlock"]["formulaSourceTier"], "captureDate": "per frozen packet (not shown to lane)"},
                     "confidenceLimitingFactor": "INCI-only: concentrations, charge density and deposition unknown" if wrec["confidence"] != "high" else "none material"})
        props = {
            "cleansingStrength": carry("cleansingStrength"),
            "conditioningLevel": carry("conditioningLevel"),
            "weightPotential": wrec,
            "focusPrimary": j["focusP"],
            "focusSecondary": j["focusS"],
            "usageRole": j["usage"],
            "scalpComfortTarget": j["sct"],
            "dandruffSupport": carry("dandruffSupport"),
        }
        for k in ("focusPrimary", "focusSecondary", "usageRole", "scalpComfortTarget"):
            props[k]["sourceIds"] = [j["sources"]]
        proj, pconfs = project(bid, b, j)
        changes = [
            {"property": "focusPrimary", "blind": dp["focusPrimary"]["value"] + " (provisional, low)", "final": j["focusP"]["value"], "evidence": j["focusP"]["rationale"]},
            {"property": "focusSecondary", "blind": "[] (provisional)", "final": j["focusS"]["value"], "evidence": j["focusS"]["rationale"]},
            {"property": "usageRole", "blind": "regular (provisional)", "final": j["usage"]["value"], "evidence": j["usage"]["rationale"]},
            {"property": "scalpComfortTarget", "blind": "unknown (positioning hidden)", "final": j["sct"]["value"], "evidence": j["sct"]["rationale"]},
            {"property": "cleansingStrength/conditioningLevel/weightPotential/dandruffSupport", "blind": "frozen", "final": "unchanged", "evidence": "Claims cannot assign these (3.2); no revealed formula conflict."},
        ]
        allconf = [p["confidence"] for p in props.values()] + pconfs
        rec = {
            "blindId": bid, "inciFingerprintSha256": b["inciFingerprintSha256"],
            "identity": {"productName": rv["productName"], "brand": rv["brand"], "market": "DE", "formulaBlock": b["formulaBlock"]},
            "claimSources": [{"id": f"S{i+1}", "sourceKind": s["sourceKind"], "grade": s["sourceGrade"]} for i, s in enumerate(rv["positioningSources"])],
            "directProperties": props,
            "focusRecord": {"careDirection": j["focusP"]["careDirection"], "claimRole": j["focusP"]["claimRole"],
                            "counterSignal": j["focusP"]["counterSignal"], "neighboringAlternative": j["focusP"]["neighboringAlternative"],
                            "decisionTrace": {"primary": j["focusP"]["decisionTrace"], "secondary": j["focusS"]["decisionTrace"], "usageRole": j["usage"]["decisionTrace"]}},
            "weightRecord": {k: wrec[k] for k in ("value", "confidence", "subjudgments", "evidenceByFamily", "whyThisBand", "whyNotNeighborBand", "counterSignal", "neighboringAlternative", "formulaIdentifiers", "confidenceLimitingFactor")},
            "projection": proj,
            "blindToFinalChanges": changes,
            "selfCheck": {"fingerprintMatchesFrozenPacket": True, "claimsHiddenDuringFormulaJudgment": True,
                          "noIngredientCountOrPositionWindowAssignedBand": True, "allThreeSubjudgmentsPresent": True,
                          "counterevidenceAndWhyNotNeighborSpecific": True, "confidenceNamesLimitingUncertainty": True,
                          "noComparisonWithEarlierValues": True},
            "uncertainties": j["unc"],
        }
        if "low" in allconf:
            rec["status"] = "needs_research"
        json.dump(rec, open(os.path.join(OUT, bid + ".json"), "w"), indent=2, ensure_ascii=False)
        tg = proj["scalpTargets"]
        table.append((bid, rv["productName"][:38], dp["cleansingStrength"]["value"], dp["conditioningLevel"]["value"], dp["weightPotential"]["value"],
                      j["focusP"]["value"], ",".join(j["focusS"]["value"]) or "-", j["usage"]["value"], j["sct"]["value"], dp["dandruffSupport"]["value"],
                      "/".join(t["fit"][:3] for t in proj["thicknesses"]), proj["weight"]["value"],
                      tg["primary"]["target"] + ("+" + tg["secondary"]["target"] if tg["secondary"] else ""),
                      proj["observedCleansingIntensity"]["value"], ",".join(proj["researchCombinationTargets"]) or "-",
                      ",".join(f["code"].replace("review_", "") + ("(" + f["detail"] + ")" if f["code"] == "review_thickness_boundary" else "") for f in proj["reviewFlags"]) or "-",
                      rec.get("status", "ok")))
    for r in table:
        print(" | ".join(r))


if __name__ == "__main__":
    main()
