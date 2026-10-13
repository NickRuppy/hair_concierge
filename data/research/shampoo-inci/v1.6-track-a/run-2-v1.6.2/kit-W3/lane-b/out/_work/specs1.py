import sys; sys.path.insert(0, "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W3/lane-b/out/_work")
from common import *
NODC = lambda why: why
SPECS = {}

SPECS["W301"] = dict(
 brand="Swiss-O-Par", name="Swiss-O-Par Teebaumöl Shampoo (Kurshampoo)",
 idNotes="GTIN 4104260076501 seen on Rossmann/Müller PDPs; manufacturer page has no GTIN/pack size.",
 cs=CS_C1,
 focusPrimary=focus("general", "moderate", "clarifying", "nonspecific", ["Glycerin @18"], [], ["PEG-7 Glyceryl Cocoate @6"],
   "No humectant or deposition cluster.", "not_applicable",
   "Anti-dandruff, anti-irritation and oil-regulating claims exist, but none has a compatible formula case (no recognized dandruff active; irritation and oily wording sit inside dandruff claim units).",
   "Claim direction: anti-dandruff ('Gegen Kopfhautreizungen, Schuppen und fettiges Haar', manufacturer, moderate). scalp_active for dandruff positioning needs a recognized active (7.2) -> dandruffSupport not_supported -> incompatible. Sensitive (Reizungen) and oily (fettiges Haar/Fettabsonderung) words occur only inside units that name Schuppen, so E2a absorbs them: no sensitive or oily claim exists for scalp_active (SC1) or clarifying (F6). No lengths-care claim. Decision: general (unsupported claim).",
   "General: the dominant anti-dandruff claim is formula-unsupported (tea tree oil is not a recognized active) and its bundled irritation/oil wording creates no other claim.", ["7.2", "F6", "E2a", "SC1", "11"]),
 focusSecondary=sec([], "high", "none", "Empty default considered; no distinct secondary positioning with an independent compatible route.", "Empty."),
 usageRole=usage("regular", "high", "none", "none", [], [], "No trigger: 'Kurshampoo' / '3 Minuten einwirken' is not a U2-U4 trigger; treatment needs dandruffSupport supported (fails); alternating needs strong cleansing (moderate)."),
 scalpComfortTarget=scalp("not_targeted", "moderate", "targeted", "Not targeted: no SC1 positioning. 'Gegen Kopfhautreizungen' and 'Effektiv gegen ... Reizungen' sit in claim units that name Schuppen (E2a: dandruff symptoms, not sensitive positioning); retailer 'beruhigt' is low and an ingredient-reputation sentence. Formula half (CSA) would be met via PEG-7 Glyceryl Cocoate @6 (MB excluded by SLES @2; prominent tea tree oil @4 is a counter-signal)."),
 primary=tgt("ordinary", "moderate", "S-ORDINARY way 4: the dandruff claim (manufacturer, moderate) fails the S-DANDRUFF formula gate (dandruffSupport not_supported); irritation and oily wording is inside the dandruff units (E2a) and creates no sensitive or oily claim; nothing else passes."),
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false: no deep-cleansing stem in name/claims/directions ('Kurshampoo' is not D1). not_flagged.",
 flags=["review_specialist_gate_failed:dandruff(formula gate: dandruffSupport not_supported; tea tree oil is not a recognized active)"],
 recon=["focusPrimary provisional general -> general (claims reviewed; anti-dandruff claim unsupported).", "focusSecondary [] confirmed; confidence moderate -> high.", "usageRole provisional regular -> regular, confidence moderate -> high (no trigger can fire).", "scalpComfortTarget provisional not_targeted confirmed (SC1 not met; wording absorbed by E2a).", "Direct formula properties unchanged."],
 unc=["E2a reading: all oily wording ('fettiges Haar', 'Fettabsonderung', 'Fett') is inside units naming Schuppen, so absorbed; alternative: treat 'Die Tätigkeit der Talgdrüsen wird reguliert' as its own oily unit -> S-OILY would pass (moderate cleansing, W low, C low) and oily would be projected (recommending direction, not taken).", "Kopfhautreizungen read as sensitive wording absorbed by the dandruff unit; even if read separately, scalpComfortTarget would be targeted via CSA (PEG-7 Glyceryl Cocoate) - not taken (P0, E2a explicit).", "focusPrimary neighbor clarifying (oil-regulation claims) vs scalp_active."]
)

SPECS["W302"] = dict(
 brand="NIVEA (Beiersdorf)", name="NIVEA Power Repair Reparatur Shampoo",
 idNotes="Manufacturer structured data GTIN 4006000192543.",
 cs=CS_C1,
 focusPrimary=focus("repair", "moderate", "moisture", "dual_supported",
   ["Panthenol @10", "Glycerin @15", "Pantolactone @16", "Squalane @9", "Cocos Nucifera Oil @11"],
   ["Squalane @9", "Cocos Nucifera Oil @11", "Dicaprylyl Ether @12", "Guar Hydroxypropyltrimonium Chloride @13", "Hydrogenated Castor Oil @18"],
   ["Glyceryl Oleate @14", "Glycol Distearate @17"],
   "Blind verdict was provisionally moisture_supported; re-read as dual_supported because the lipid + cationic deposition cluster (squalane, coconut oil, dicaprylyl ether, waxy HCO, guar) is itself a coherent substantive cluster. No protein/bond route.",
   "tie_breaker",
   "Humectant cluster (panthenol/glycerin/pantolactone) equally supports moisture; the 'Feuchtigkeit' claim competes.",
   "Claim direction repair: product name 'Power Repair Reparatur' (high) plus manufacturer 'Unterstützt die gesunde Reparatur', 'Anti-Haarbruch', 'Strukturaufbau' (moderate). Formula dual_supported -> compatible; the name breaks the tie (F1). Route: substantive lipid + guar deposition cluster. Decision repair.",
   "Repair: name-level repair positioning breaks a dual_supported tie.", ["7.3", "F1", "7.2", "CL-SRC"]),
 focusSecondary=sec(["moisture"], "moderate", [], "Empty default considered. Distinct claim: 'Versorgt das Haar mit lang anhaltender Feuchtigkeit' (manufacturer, moderate). Independent route: humectant cluster Panthenol @10, Glycerin @15, Pantolactone @16, not cited by the primary repair route (F3). Distinct from repair (hydration vs damage care).", "Moisture as one secondary: separate positioning plus an independent humectant route."),
 usageRole=usage("regular", "high", "none", "none", [], [], "No frequency wording ('sanft' is not U2); no dandruff active; cleansing moderate."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "No E2 sensitive/dry scalp claim: 'Reinigt sanft die Kopfhaut' and 'Hautverträglichkeit dermatologisch bestätigt' are mildness/protective wording (E2a). Ordinary formula."),
 primary=tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present."),
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> repair (name tie-breaks a dual_supported verdict).", "careDirection verdict provisional moisture_supported -> dual_supported: on re-check of the formula alone the lipid/guar deposition cluster meets repair_supported as well; recorded as a reading change, not claim-driven (claims cannot change a verdict).", "focusSecondary [] -> [moisture] (distinct moisture claim + independent humectant route).", "usageRole and scalpComfortTarget confirmed; confidence raised to high.", "'Pflegt ... ohne zu beschweren' does not lower weight (6.5 step 5)."],
 unc=["Verdict moisture_supported (blind) vs dual_supported (final): with moisture_supported, repair would be incompatible and focus would be moisture or general.", "Secondary moisture vs []: F2 could read moisture as an outcome of the same care system; chose separate because the humectant route is distinct.", "conditioningLevel high via C2 with Parfum last (all elements trivially prominent); neighbor moderate.", "weightPotential moderate with W-RICH and neighbor high -> all three thickness fits flagged (T4)."]
)

SPECS["W303"] = dict(
 brand="Salthouse", name="Salthouse Totes Meer Therapie Anti-Juckreiz Shampoo",
 cs=CS_C1,
 focusPrimary=focus("scalp_active", "high", "none", "not_applicable", [], [], [], "Scalp-led formula, not a lengths decision.", "candidate",
   "Cooling agents (Menthol @12, Mentha Arvensis Leaf Oil @16) are irritation counter-signals, though not prominent.",
   "Claim direction: sensitive/itchy scalp (name 'Anti-Juckreiz', high; manufacturer 'beruhigend bei juckender und empfindlicher Kopfhaut', moderate). Formula compatible: scalpComfortTarget targeted (Polidocanol/Laureth-9 @3, Urea @6). No lengths-care claim competes. Decision scalp_active.",
   "scalp_active: explicit itchy/sensitive-scalp positioning with a targeted formula.", ["7.2", "SC1", "CSA"]),
 focusSecondary=sec([], "high", "none", "Empty default considered; 'Feuchtigkeitsgehalt der Kopfhaut' is scalp care inside scalp_active, not a lengths moisture role.", "Empty."),
 usageRole=usage("frequent", "high", "none", "explicit_frequent_non_strong", ["Manufacturer directions (moderate): 'Für die tägliche Haarwäsche geeignet.'"], [], "U2 'täglich' wording at moderate grade and cleansingStrength moderate (not strong) -> frequent."),
 scalpComfortTarget=scalp("targeted", "high", "none", "Targeted: SC1 positioning (name 'Anti-Juckreiz'; manufacturer 'beruhigend bei juckender und empfindlicher Kopfhaut', 'speziell für ... juckender, trockener und empfindlicher Kopfhaut') and CSA via prominent E4 comfort routes Laureth-9 @3 (= Polidocanol) and Urea @6. Cooling agents Menthol @12 and Mentha Arvensis Leaf Oil @16 are after the E3 point, so not prominent counter-signals. MB excluded (SLES @2) but not needed."),
 primary=tgt("sensitive", "high", "S-SENSITIVE: positioning name 'Anti-Juckreiz' (high) + manufacturer units (moderate); formula targeted + prominent comfort routes Laureth-9 @3, Urea @6. S-PRIMARY: product name names the sensitive role. Cleansing moderate -> no strong-cleansing flag."),
 secondary=tgt("dry", "moderate", "S-DRY: own claim unit 'speziell für die Bedürfnisse von juckender, trockener und empfindlicher Kopfhaut' (manufacturer, moderate; names two non-dandruff states, E2a) + 'Spannungs- und Trockenheitsgefühle werden gemildert'; formula targeted + prominent humectant route Urea @6. Not oily+dry."),
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> scalp_active.", "usageRole provisional regular -> frequent (daily-use directions).", "scalpComfortTarget provisional not_targeted -> targeted (SC1 now visible; CSA already met blind).", "Direct formula properties unchanged."],
 unc=["'Schuppenflechte' (psoriasis) and Neurodermitis are medical terms, read as out of scope and not as a dandruff claim (Schuppen stem); dandruffSupport is not_supported anyway, but a dandruff reading would absorb the itch unit in 'Hautproblem: Juckreiz, ..., Schuppenflechte, Spannungsgefühle'.", "Name 'Anti-Juckreiz' graded high as a sensitive lexicon term; if graded only via the manufacturer units the target confidence would be moderate.", "Cooling agents not prominent (E3 cut at Sodium Benzoate @8) -> no confidence cap on targeted."]
)

SPECS["W304"] = dict(
 brand="Head & Shoulders", name="Head & Shoulders Anti Schuppen Sensitive",
 cs=CS_C1,
 focusPrimary=focus("scalp_active", "high", "none", "not_applicable", [], [], [], "Active-led.", "candidate",
   "No CSA: the sensitive wording is not formula-backed for scalp comfort.",
   "Claim direction anti-dandruff (name 'Anti Schuppen', high). Formula compatible: Piroctone Olamine @9 (dandruffSupport supported). Decision scalp_active (problem-led product with recognized active).",
   "scalp_active: anti-dandruff positioning + recognized active.", ["7.2", "11"]),
 focusSecondary=sec([], "high", "none", "Empty default considered; oily and itch wording is inside dandruff units (E2a), so no distinct clarifying or sensitive positioning.", "Empty."),
 usageRole=usage("treatment", "high", "none", "recognized_active_problem_led", ["Name 'Anti Schuppen' (high) + Piroctone Olamine @9 (dandruffSupport supported)."], ["frequent (explicit_frequent_non_strong: manufacturer 'ideal für die tägliche Anwendung', cleansing moderate) - loses to treatment under U1"], "U3 treatment fires; U1 precedence over frequent."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "Not targeted: sensitive wording ('SENSITIVE KOPFHAUT Anti-Schuppen Shampoo', 'Anti-Schuppen Shampoo empfindliche Kopfhaut', 'Juckreiz im Zusammenhang mit Schuppen') sits in dandruff units (E2a/SC1); name word 'Sensitive' does not name the scalp. Also CSA fails (no prominent E4 route; MB excluded by SLES @2)."),
 primary=tgt("dandruff", "high", "S-DANDRUFF: name 'Anti Schuppen' (high) + dandruffSupport supported (Piroctone Olamine @9, high). Dandruff path, no secondary target (R17.2)."),
 secondary=None,
 rct=["oily"],
 notes=["suits_dandruff_with_oily_scalp: 'Bekämpft gezielt drei Kopfhautprobleme - Schuppen, Öl und Juckreiz' / '(Schuppen, Juckreiz durch Schuppen und fettige Kopfhaut)' (manufacturer, moderate); S-OILY clause passes (cleansing moderate, W low, C low); confidence moderate", "dandruff_bundled_comfort_wording: 'Juckreiz durch Schuppen', 'empfindliche Kopfhaut' (manufacturer, moderate); S-SENSITIVE formula gate fails: CSA not met (no prominent E4 comfort or humectant route, MB excluded by Sodium Laureth Sulfate @2)"],
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> scalp_active.", "usageRole provisional regular -> treatment (dandruff claim + active).", "scalpComfortTarget not_targeted confirmed (formula half failed blind; positioning absorbed by E2a).", "Direct formula properties unchanged."],
 unc=["'fettige Kopfhaut' inside a dandruff unit feeds only the research-only oily combination (E2b layer 2), not a projected target.", "Sensitive combination not recorded because CSA fails; Aloe juice @20 and Avena @23 are after Parfum (not prominent), so no unlisted_route_candidate is named."]
)

SPECS["W305"] = dict(
 brand="Wahre Schätze (Garnier)", name="Garnier Wahre Schätze Ausgleichendes Shampoo Anziehende Aktivkohle & Schwarzkümmelöl",
 idNotes="300 ml; one retailer source refers to a different GTIN (250 ml) and is not used.",
 cs={"cleansingStrength": "Guar @8 and Nigella oil @5 argue for some buffering; C5 convention unchanged.", "conditioningLevel": "See rationale.", "weightPotential": "See counterevidence.", "dandruffSupport": "None."},
 focusPrimary=focus("general", "moderate", "clarifying", "nonspecific", ["Nigella Sativa Seed Oil @5"], [], ["Guar Hydroxypropyltrimonium Chloride @8"],
   "No humectant cluster (Polyglycerin-10 not listed) -> nonspecific for lengths moisture.", "not_applicable",
   "Deep-cleansing and oily-scalp positioning is dominant, but F6 fails on conditioningLevel high.",
   "Claim direction clarifying: 'Tiefenreinigungsshampoo gegen schnell fettende Kopfhaut' (manufacturer, moderate). F6 compatibility: cleansing strong OK, weight moderate OK, conditioningLevel high FAILS -> clarifying incompatible. Next claim: moisture for dry lengths ('spendet trockenen Haarlängen bis zu 72 Stunden Feuchtigkeit') over a nonspecific verdict -> F1 general. Decision general; failed condition named: F6 conditioningLevel not high.",
   "General: clarifying positioning fails F6 (conditioningLevel high); lengths-moisture claim is over a nonspecific formula.", ["7.2", "F6", "F1"]),
 focusSecondary=sec([], "high", "none", "Empty default considered; no compatible distinct role.", "Empty."),
 usageRole=usage("occasional_reset", "moderate", "alternating", "explicit_deep_cleansing", ["Manufacturer (moderate): 'ist ein Tiefenreinigungsshampoo' / 'Tiefenreinigungsshampoo gegen schnell fettende Kopfhaut' -> D1 true."], ["alternating (strong_plus_reset_intent: cleansing strong + 'Rückstände', 'schnell fettende Kopfhaut') - loses to occasional_reset under U1"], "D1 true -> occasional_reset (U1 first)."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "No E2 sensitive/dry scalp claim. Ordinary formula intent."),
 primary=tgt("ordinary", "moderate", "S-ORDINARY way 4: oily claim 'schnell fettende Kopfhaut' (manufacturer, moderate) fails the S-OILY formula gate on conditioningLevel high (cleansing strong and weight moderate pass); nothing else passes."),
 secondary=None,
 d1=True, d1Conf="moderate", dclConf="moderate",
 dclWhy="D1 true (manufacturer 'Tiefenreinigungsshampoo', moderate) with cleansingStrength strong, but D2 fails because focusPrimary is general (not clarifying) -> not_flagged; D3 raises review_reset_positioning_mismatch.",
 flags=["review_specialist_gate_failed:oily(formula gate S-OILY: conditioningLevel high)", "review_reset_positioning_mismatch(D1 true + strong, D2 not met: focusPrimary general)"],
 recon=["focusPrimary provisional general -> general (clarifying fails F6 on conditioningLevel high).", "usageRole provisional regular -> occasional_reset (D1).", "explicitResetPositioning true from manufacturer 'Tiefenreinigungsshampoo'.", "Direct formula properties unchanged; conditioningLevel high is a formula reading and is not moved by claims."],
 unc=["Key reading: conditioningLevel high via W-RICH (E3) for Section 5 (Nigella oil @5 + guar @8) without C2. The alternative reading (moderate) would make F6 and S-OILY pass -> focus clarifying, oily primary, D2 flagged deep-cleanser listing. The current reading routes to review (conservative).", "Retailer dm 'Wirkt trockenen Haaren entgegen' and Haartyp 'fettiges Haar' are low/attributes and not used."]
)

SPECS["W306"] = dict(
 brand="OGX", name="OGX Rosemary Mint Shampoo",
 idNotes="Formula source tier 4; positioning only from Rossmann PDP and pack-front images.",
 cs={"cleansingStrength": "Coconut Acid @13 soap and Disodium Tetrapropenyl Succinate @14 add some anionic cleansing; C6 convention unchanged.", "conditioningLevel": "See rationale.", "weightPotential": "See counterevidence.", "dandruffSupport": "None."},
 focusPrimary=focus("general", "moderate", "clarifying", "nonspecific", ["Urea @25", "Sodium Lactate @21"], [], ["Amodimethicone @11", "Starch Hydroxypropyltrimonium Chloride @17", "Glyceryl Oleate @15"],
   "Generic conditioning; no repair or moisture cluster.", "not_applicable",
   "Clarifying positioning is strong on the pack but the chassis is low (F6).",
   "Claim direction clarifying (pack front, high: 'Clarifying blend visibly helps remove oils and residue to clear away buildup', 'ERFRISCHEND & KLÄREND'). F6: cleansingStrength low FAILS -> incompatible. Next: 'LIPI PRO SHIELD ... Lipid- und Proteinschutz' / 'geschädigte Haarfaser' (pack images) over a nonspecific verdict -> F1 general. 'refreshing scalp' is not a lexicon term. Decision general; failed condition F6 cleansingStrength low.",
   "General: clarifying claim incompatible (low cleansing, F6); damage-protection claim over a nonspecific formula.", ["7.2", "F6", "F1"]),
 focusSecondary=sec([], "high", "none", "Empty default considered.", "Empty."),
 usageRole=usage("regular", "high", "none", "none", [], [], "Reset intent present ('klärend', 'Rückstände', 'Ablagerungen', pack high) but alternating needs cleansingStrength strong (low); no D1 stem ('Clarifying blend' is not 'Clarifying Shampoo'); no frequency wording."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "No E2 sensitive/dry scalp claim ('refreshing scalp' is not a lexicon term). CSA/MB would be met (Urea @25, mild base) but positioning is absent."),
 primary=tgt("ordinary", "moderate", "S-ORDINARY way 4: the only oily claim unit ('befreit Ihr fettiges Haar von Ablagerungen') is Rossmann retailer copy graded low (positioning gate fails, E1); the S-OILY formula clause also fails (cleansingStrength low). Pack 'remove oils and residue' is not an English oily lexicon term."),
 secondary=None,
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false: 'Clarifying blend' / 'KLÄREND' are not D1 stems ('clarifying shampoo' needed); not_flagged.",
 flags=["review_specialist_gate_failed:oily(positioning gate: only retailer-graded low claim 'fettiges Haar'; formula gate S-OILY: cleansingStrength low)"],
 recon=["focusPrimary provisional general -> general.", "usageRole regular confirmed, confidence high.", "scalpComfortTarget not_targeted confirmed (no SC1).", "Direct formula properties unchanged."],
 unc=["D1: 'Clarifying blend' read as not matching the 'clarifying shampoo' stem; if read as D1, usage would be occasional_reset and the D3 note deep_cleansing_name_ordinary_formula would apply (low cleansing).", "S-FAIL raised for an oily claim graded only low; alternative reading treats a low-only claim as no claim (way 1, no flag) - flag kept as the more conservative outcome.", "weightPotential moderate, neighbor low (both systems in the alphabetical sub-1 % zone)."]
)
