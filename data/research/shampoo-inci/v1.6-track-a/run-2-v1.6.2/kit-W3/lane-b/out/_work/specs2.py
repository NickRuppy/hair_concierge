import sys; sys.path.insert(0, "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W3/lane-b/out/_work")
from common import *
SPECS = {}
CS_C5 = dict(CS_C1); CS_C5["cleansingStrength"] = "Refatting/conditioning co-ingredients argue milder; C5 convention unchanged."

SPECS["W307"] = dict(
 brand="Lavera", name="Lavera Pflegeshampoo basis sensitive Hydrate & Care (Basis Sensitiv)",
 cs=CS_C5,
 focusPrimary=focus("moisture", "moderate", "general", "moisture_supported",
   ["Glycerin @4", "Sodium Hyaluronate @10", "Betaine @17", "Aloe Barbadensis Leaf Juice @2", "Helianthus Annuus Seed Oil @11"], [],
   ["Guar Hydroxypropyltrimonium Chloride @21", "Cetearyl Alcohol @15", "PCA Glyceryl Oleate @16"],
   "Rinse-off context; humectants partly after extracts.", "candidate",
   "Mildness/'sanft zur Kopfhaut' positioning is not a focus; 'trockenes Haar' is lengths, not scalp.",
   "Claim direction moisture: name 'Hydrate & Care' (high) and 'Spendet intensive Feuchtigkeit' (manufacturer, moderate). Formula verdict moisture_supported (humectant cluster + lipid/cationic support) -> compatible. 'Basis Sensitiv' is a non-scalp name word (F7 not triggered, no scalp claim unit). Decision moisture.",
   "Moisture: name-level hydration positioning over a moisture_supported formula.", ["7.2", "7.3", "F1", "F7"]),
 focusSecondary=sec([], "high", "none", "Empty default considered; no second distinct positioning.", "Empty."),
 usageRole=usage("frequent", "moderate", "regular", "explicit_frequent_non_strong", ["Manufacturer (moderate): 'Für die extra Portion Feuchtigkeit - Tag für Tag.'"], [], "'Tag für Tag' read as explicit everyday-use wording (U2 sense of 'für jeden Tag'); cleansing moderate -> frequent."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "No SC1 positioning: 'Sanft zur Kopfhaut', 'Schont empfindliche Kopfhaut' are sparing/tolerance wording (E2a); 'Bio-Aloe Vera ist bekannt dafür, die Kopfhaut zu beruhigen' is an ingredient-reputation sentence; 'Basis Sensitiv' is a non-scalp name word."),
 primary=tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit after E2a; manufacturer source present."),
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> moisture (candidate claim on a moisture_supported verdict).", "usageRole provisional regular -> frequent ('Tag für Tag').", "scalpComfortTarget not_targeted confirmed.", "Direct formula properties unchanged."],
 unc=["'Tag für Tag' is not literally in the U2 list; alternative regular.", "conditioningLevel high via C2 (sunflower oil, cetearyl alcohol, guar @21, humectants); neighbor moderate -> T4 flags on all thicknesses."]
)

SPECS["W308"] = dict(
 brand="ISANA (Rossmann)", name="ISANA Shampoo Sensitiv Baumwoll- & Kornblume",
 cs=CS_C1,
 focusPrimary=focus("general", "moderate", "scalp_active", "nonspecific", ["Panthenol @12", "Glycerin @18"], ["Hydrolyzed Wheat Protein @10"], ["Glyceryl Oleate @7", "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @15"],
   "All care routes after Parfum @6.", "not_applicable",
   "Sensitive-scalp claim exists but the formula has no credible supportive architecture.",
   "Claim direction sensitive scalp ('für empfindliche Kopfhaut & normales Haar', manufacturer, moderate). scalp_active requires scalpComfortTarget targeted -> not_targeted (CSA fails) -> incompatible. Remaining claims are mildness ('reinigt und pflegt besonders sanft'), not a focus. Decision general.",
   "General: sensitive-scalp claim without CSA; mildness is not a focus.", ["7.2", "SC1", "CSA"]),
 focusSecondary=sec([], "high", "none", "Empty default considered.", "Empty."),
 usageRole=usage("regular", "high", "none", "none", [], [], "No frequency wording."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "Explicitly positioned (SC1: 'für empfindliche Kopfhaut & normales Haar', manufacturer, moderate; 'auch bei empfindlicher Kopfhaut bestens geeignet' is tolerance wording) but CSA fails: no prominent E4 comfort or humectant/refatting route (E3 cut at Parfum @6; Panthenol @12, Glyceryl Oleate @7, Glycerin @18 after it), MB excluded by Sodium Laureth Sulfate @2. Missing route named; S-SENSITIVE fails -> S-FAIL."),
 primary=tgt("ordinary", "moderate", "S-ORDINARY way 4: sensitive claim fails S-SENSITIVE formula gate (scalpComfortTarget not_targeted; no prominent comfort route, no MB); nothing else passes."),
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 flags=["review_specialist_gate_failed:sensitive(formula gate: CSA not met - no prominent E4 comfort/humectant route before Parfum @6, MB excluded by Sodium Laureth Sulfate @2; no prominent unlisted route candidate)"],
 recon=["focusPrimary provisional general -> general.", "scalpComfortTarget not_targeted confirmed; now with SC1 positioning, so S-FAIL applies.", "Direct formula properties unchanged."],
 unc=["'beruhigenden Inhaltsstoffen' on the pack is generic, not a scalp-state claim.", "S-FAIL vs way 1 depends on reading 'für empfindliche Kopfhaut & normales Haar' as a qualifying 'für ...' unit (taken)."]
)

SPECS["W309"] = dict(
 brand="ISANA (Rossmann)", name="ISANA MED Shampoo Jeden Tag (Ultra Sensitiv), 200 ml",
 cs=CS_C1,
 focusPrimary=focus("scalp_active", "moderate", "general", "not_applicable", [], [], [], "Scalp-led.", "candidate",
   "Positioning wording is needs-based ('berücksichtigt die Bedürfnisse ... empfindlicher Kopfhaut') rather than an active verb; SLES chassis.",
   "Claim direction sensitive scalp ('berücksichtigt die besonderen Bedürfnisse sehr sensibler und empfindlicher Kopfhaut', manufacturer, moderate; 'hautberuhigende Formel'). Formula compatible: targeted (Panthenol @8, Allantoin @9). Decision scalp_active.",
   "scalp_active: sensitive-scalp positioning + targeted formula.", ["7.2", "SC1", "CSA"]),
 focusSecondary=sec([], "high", "none", "Empty default considered; 'schützt Kopfhaut und Haar vor Austrocknung' is protective wording.", "Empty."),
 usageRole=usage("frequent", "high", "none", "explicit_frequent_non_strong", ["Product name 'Shampoo Jeden Tag' (high)."], [], "U2 'für jeden Tag' sense in the name; cleansing moderate -> frequent."),
 scalpComfortTarget=scalp("targeted", "moderate", "not_targeted", "Targeted: SC1 via 'berücksichtigt die besonderen Bedürfnisse sehr sensibler und empfindlicher Kopfhaut' (product is for sensitive scalp; manufacturer, moderate); CSA via prominent comfort routes Panthenol @8, Allantoin @9 and humectant Glycerin @3; fragrance-free (supportive). Confidence moderate: the unit is needs-based wording, close to tolerance wording."),
 primary=tgt("sensitive", "moderate", "S-SENSITIVE: positioning moderate; formula targeted + prominent comfort routes Panthenol @8, Allantoin @9. Cleansing moderate -> no strong flag."),
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> scalp_active.", "usageRole provisional regular -> frequent (name 'Jeden Tag').", "scalpComfortTarget provisional not_targeted -> targeted.", "Direct formula properties unchanged."],
 unc=["SC1 reading of 'berücksichtigt die besonderen Bedürfnisse sehr sensibler und empfindlicher Kopfhaut' as a 'für ...' unit; alternative: tolerance wording -> not_targeted -> ordinary way 1 (no target).", "'hautberuhigende Formel' names skin, not scalp explicitly; not relied on."]
)

SPECS["W310"] = dict(
 brand="Schauma (Schwarzkopf)", name="Schauma Anti-Schuppen Classic Shampoo",
 cs=CS_C1,
 focusPrimary=focus("scalp_active", "high", "none", "not_applicable", [], [], [], "Active-led.", "candidate",
   "Rich-ish C2 conditioning base; Pro-Vitamin B5 lengths claims are secondary marketing.",
   "Claim direction anti-dandruff (name 'Anti-Schuppen', high). Formula compatible: Piroctone Olamine @5. Decision scalp_active.",
   "scalp_active: anti-dandruff positioning + recognized active.", ["7.2", "11"]),
 focusSecondary=sec([], "high", "none", "Empty default considered; 'Mit Pro-Vitamin B5 zur tiefen Pflege des Haares' is generic care; repair claims only in Müller retailer copy (low).", "Empty."),
 usageRole=usage("treatment", "high", "none", "recognized_active_problem_led", ["Name 'Anti-Schuppen' (high) + Piroctone Olamine @5."], [], "U3 treatment. dm 'Für die tägliche Haarwäsche geeignet' is retailer-only (low) and cannot fire frequent."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "No SC1: the comfort wording 'Eine beruhigte, erfrischte Kopfhaut und bis zu 100% schuppenfreies Haar' is in a unit that names dandruff (E2a/E2b bundled); dm 'Beruhigende Pflegeformel' is low. CSA itself is met (Panthenol @7)."),
 primary=tgt("dandruff", "high", "S-DANDRUFF: name 'Anti-Schuppen' (high) + dandruffSupport supported (Piroctone Olamine @5). No secondary (R17.2)."),
 rct=["sensitive"],
 notes=["suits_dandruff_with_irritated_scalp: bundled comfort wording 'Eine beruhigte, erfrischte Kopfhaut und bis zu 100% schuppenfreies Haar' (manufacturer, moderate); S-SENSITIVE formula gate passes (CSA via Panthenol @7 + prominent comfort route Panthenol @7); confidence moderate"],
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> scalp_active.", "usageRole provisional regular -> treatment.", "scalpComfortTarget not_targeted confirmed (bundled wording is not SC1).", "Direct formula properties unchanged."],
 unc=["'Für schuppiges Haar' and the bundled 'beruhigte Kopfhaut' are dandruff/bundled units; sensitive is research-only.", "conditioningLevel high (C2 with HCO @9) and weight moderate with neighbor high -> T4 flags normal and coarse."]
)

SPECS["W311"] = dict(
 brand="Guhl", name="Guhl Anti Schuppen",
 cs=CS_C1,
 focusPrimary=focus("scalp_active", "high", "none", "not_applicable", [], [], [], "Active-led.", "candidate",
   "SLES chassis for an itch-relief claim.",
   "Claim direction anti-dandruff (name 'Anti Schuppen', high; 'Bei Schuppen und juckender Kopfhaut', moderate). Formula compatible: Piroctone Olamine @6. Decision scalp_active.",
   "scalp_active: anti-dandruff positioning + recognized active.", ["7.2", "11"]),
 focusSecondary=sec([], "high", "none", "Empty default considered.", "Empty."),
 usageRole=usage("treatment", "high", "none", "recognized_active_problem_led", ["Name 'Anti Schuppen' (high) + Piroctone Olamine @6."], [], "U3 treatment."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "No SC1: itch/tension wording ('Bei Schuppen und juckender Kopfhaut', 'von Schuppen und einer juckenden, spannenden Kopfhaut', 'Deine juckende Kopfhaut wird beruhigt und das Spannungsgefühl reduziert') is in or directly next to dandruff units (E2a, E2b bundled). CSA itself is met (Panthenol @12)."),
 primary=tgt("dandruff", "high", "S-DANDRUFF: name 'Anti Schuppen' (high) + Piroctone Olamine @6. No secondary (R17.2)."),
 rct=["sensitive"],
 notes=["suits_dandruff_with_irritated_scalp: bundled comfort wording 'Deine juckende Kopfhaut wird beruhigt und das Spannungsgefühl reduziert' / 'juckenden, spannenden Kopfhaut' (manufacturer, moderate); S-SENSITIVE formula gate passes (CSA + prominent comfort route Panthenol @12); confidence moderate"],
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> scalp_active.", "usageRole provisional regular -> treatment.", "scalpComfortTarget not_targeted confirmed.", "Direct formula properties unchanged."],
 unc=["Tension wording 'Spannungsgefühl' bundled with dandruff feeds the sensitive combination (E2b), not dry.", "Zinc PCA claim ('bekämpft die Ursache von Schuppen') is not an oily claim."]
)

SPECS["W312"] = dict(
 brand="Guhl", name="Guhl Kopfhaut Sensitive",
 cs=CS_C1,
 focusPrimary=focus("scalp_active", "high", "none", "not_applicable", [], [], [], "Scalp-led.", "candidate",
   "SLES chassis (MB excluded); Piroctone Olamine present without a dandruff claim.",
   "Claim direction sensitive scalp (name 'Kopfhaut Sensitive', high; 'Für trockene und empfindliche Kopfhaut', 'beruhigen die empfindliche Kopfhaut sofort und mildern Juckreiz', moderate). Formula compatible: targeted (Panthenol @7, Betaine @5, Glycerin @6). Decision scalp_active.",
   "scalp_active: name-level sensitive-scalp positioning + targeted formula.", ["7.2", "SC1", "CSA"]),
 focusSecondary=sec([], "high", "none", "Empty default considered; no lengths-care claim.", "Empty."),
 usageRole=usage("regular", "high", "none", "none", [], ["treatment: not fired (Piroctone Olamine present but no dandruff claim, U3/R17.3)"], "FAQ 'für die regelmäßige Anwendung' is not U2 frequency wording."),
 scalpComfortTarget=scalp("targeted", "high", "none", "Targeted: SC1 (name 'Kopfhaut Sensitive', high; manufacturer units) and CSA via prominent comfort route Panthenol @7 and humectant routes Betaine @5, Glycerin @6. No prominent cooling agent or essential oil (Mentha Aquatica Leaf Extract @18 is an extract)."),
 primary=tgt("sensitive", "high", "S-SENSITIVE: name 'Kopfhaut Sensitive' (high); formula targeted + prominent comfort route Panthenol @7. S-PRIMARY: name names sensitive."),
 secondary=tgt("dry", "moderate", "S-DRY: own unit 'Für trockene und empfindliche Kopfhaut' (manufacturer, moderate); formula targeted + prominent humectant routes Betaine @5, Glycerin @6, Panthenol @7."),
 notes=["active_without_dandruff_positioning: Piroctone Olamine @15 present, no dandruff claim (R17.3)"],
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> scalp_active.", "usageRole regular confirmed (treatment needs a dandruff claim).", "scalpComfortTarget provisional not_targeted -> targeted.", "Direct formula properties unchanged; dandruffSupport stays supported (formula-only)."],
 unc=["Piroctone Olamine without a dandruff claim -> regular shampoo path (R17.3); no dandruff target.", "'beugt Irritationen vor' and 'mildern Juckreiz' both qualify sensitive; dry from one unit only (moderate)."]
)
