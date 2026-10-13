import json

def fp(value, conf, nalt, verdict=None, claimRole="candidate", counter="", trace="", rationale="", rules=None):
    d = {"value": value, "confidence": conf, "neighboringAlternative": nalt, "claimRole": claimRole,
         "counterSignal": counter, "decisionTrace": trace, "rationale": rationale, "ruleIds": rules or []}
    if verdict:
        d["careDirectionVerdictFinal"] = verdict
    return d

def fs(value, conf, nalt, trace, rationale, rules=None):
    return {"value": value, "confidence": conf, "neighboringAlternative": nalt, "decisionTrace": trace,
            "rationale": rationale, "ruleIds": rules or ["8", "F2", "F3", "F-TRACE"]}

def ur(value, conf, nalt, code, ev, losing, rationale, rules=None):
    return {"value": value, "confidence": conf, "neighboringAlternative": nalt, "triggerCode": code,
            "triggerEvidence": ev, "losingTriggers": losing, "rationale": rationale,
            "ruleIds": rules or ["9", "U1", "U2", "CL-SRC", "F-TRACE"]}

def sc(value, conf, nalt, rationale, rules=None):
    return {"value": value, "confidence": conf, "neighboringAlternative": nalt, "rationale": rationale,
            "ruleIds": rules or ["10", "SC1", "CSA", "MB", "E4", "E2a"]}

REG_DEFAULT = "Default regular: no non-default trigger from a moderate/high-graded source."
NOSC1 = "not_targeted: no E2 sensitive or dry-scalp claim unit graded moderate/high (SC1 not met); CSA formula half recorded in the formula pass ({csa})."

S = {}

# ---------------- W201
S["W201"] = dict(
 brand="Hask", productName="Hask Curl Care Shampoo (dm/Müller: HASK Shampoo curls + coconut oil)",
 counter={"cleansingStrength": "Refatting oils @7-8, weak refatters @14/@16 and cationic polymers argue milder; nothing argues stronger.",
          "conditioningLevel": "All conditioning ingredients follow Sodium Chloride @6; no silicone."},
 props={
  "focusPrimary": fp("moisture", "moderate", "general", "moisture_supported", "candidate",
     "Strong-anionic olefin-sulfonate chassis (moderate after buffering); every positioning source is graded low.",
     "Claim direction moisture ('Feuchtigkeitsspendend', 'spendet die Formel intensive Feuchtigkeit', dm retailer, low; US manufacturer 'moisturizing', manufacturer_foreign, low). Formula verdict moisture_supported (Glycerin @5, Panthenol @10, Cocos Nucifera Oil @7, Argania Spinosa Kernel Oil @8 with cationic polymers). A low-graded claim may be candidate only because the formula independently supports moisture; confidence capped at moderate. Curl wording is hair_texture, not a focus.",
     "Moisture: formula-led moisture_supported verdict plus low-graded moisture claims (CL-SRC cap moderate).", ["7.2", "7.3", "F1", "CL-SRC", "F-TRACE"]),
  "focusSecondary": fs([], "moderate", ["repair"], "Empty default considered; 'kann helfen, die Locken vor Schäden zu schützen' (low) is protective wording on a formula with no independent repair route beyond the moisture/deposition routes already cited (F3). Frizz/definition wording is texture styling, not a focus.", "Secondary empty: no distinct moderate/high positioning with an independent route."),
  "usageRole": ur("regular", "moderate", "frequent", "none", [], ["explicit_frequent_non_strong not fired: 'Ideal für die tägliche Haarwäsche' and 'Gentle enough for daily use' are graded low (dm retailer, US manufacturer page) and cannot fire a trigger"], REG_DEFAULT + " Daily-use wording exists only in low-graded sources."),
  "scalpComfortTarget": sc("not_targeted", "high", "none", NOSC1.format(csa="listed routes met") + " Build-up removal wording is not a scalp claim."),
 },
 primary={"target": "ordinary", "confidence": "moderate", "rationale": "S-ORDINARY way 1: no qualifying E2 claim unit. Confidence moderate because the packet has retailer copy and a foreign manufacturer page (graded low) only, no German manufacturer or pack source (13.8)."},
 secondary=None,
 claims=[
  {"unit": "Feuchtigkeitsspendend / spendet die Formel intensive Feuchtigkeit", "source": "retailer_dm_de", "grade": "low", "use": "focus candidate (moisture), formula-supported"},
  {"unit": "Ideal für die tägliche Haarwäsche", "source": "retailer_dm_de (directions)", "grade": "low", "use": "cannot fire frequent (CL-SRC)"},
  {"unit": "Gentle enough for daily use / moisturizing shampoo", "source": "manufacturer_foreign (US)", "grade": "low", "use": "corroboration only (E1 foreign page)"},
  {"unit": "Ablagerungen schonend entfernt / removes build-up", "source": "retailer, manufacturer_foreign", "grade": "low", "use": "reset intent would need moderate/high grade; not D1"}],
 reconciliation=[
  "focusPrimary: general (blind, provisional) -> moisture; reason: low-graded moisture claims identify the job and the blind care verdict moisture_supported independently supports it (CL-SRC candidate, confidence capped moderate).",
  "focusSecondary: [] unchanged (confidence low -> moderate).",
  "usageRole: regular unchanged; daily wording is low-graded.",
  "scalpComfortTarget: not_targeted unchanged (moderate -> high: no SC1 claim at all).",
  "cleansingStrength, conditioningLevel, weightPotential, dandruffSupport: unchanged; claims ('schwerelose Locken', 'ohne Sulfat') never move them (3.2, 6.5)."],
 uncertainties=[
  "weightPotential moderate vs high (blind call, pinned): W-RICH formally holds but reset is not limited; alternative high would make fine not_suited and normal acceptable.",
  "focusPrimary moisture rests on low-graded claims only; alternative general if a reviewer reads CL-SRC as requiring a moderate source for any specialist focus.",
  "Product-name variants (dm/Müller/US) in the packet; identity taken as the packet's DE product."]
)

# ---------------- W202
S["W202"] = dict(
 brand="Guhl", productName="Guhl Frische und Leichtigkeit (Anti-Fett Shampoo)",
 counter={"cleansingStrength": "Glyceryl Oleate @6 refatting; nothing argues stronger.", "conditioningLevel": "A single guar polymer; no silicone or lipid."},
 props={
  "focusPrimary": fp("clarifying", "moderate", "general", "not_applicable", "candidate",
     "Light conditioning chassis; Piroctone Olamine @13 present without any dandruff claim (R17.3, not a scalp_active route here).",
     "Claim direction oily scalp: 'Anti-Fett Shampoo' and 'Für normales bis schnell fettendes Haar' (manufacturer DE, moderate; E2 oily lexicon). F6 compatibility: cleansingStrength moderate (ok), conditioningLevel moderate (not high), weightPotential low (not high) -> compatible. Compatible route: buffered SLES cleansing system @2-4 with light deposition. Decision: clarifying (F6).",
     "Clarifying via F6: moderate-graded oily-scalp positioning on a compatible formula.", ["7.2", "F6", "E2", "CL-SRC", "F-TRACE"]),
  "focusSecondary": fs([], "high", "none", "Empty default considered; 'spendet intensiv Feuchtigkeit' is retailer-only (low) and the formula verdict is nonspecific; 'ohne auszutrocknen' is protective.", "Secondary empty."),
  "usageRole": ur("regular", "high", "none", "none", [], ["alternating not fired: oily wording is reset intent (U4) but cleansingStrength is moderate", "treatment not fired: no dandruff claim (U3)", "frequent not fired: no frequency wording"], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", NOSC1.format(csa="listed routes met") + " 'ohne auszutrocknen' and 'Dermatologisch bestätigt' are protective/mildness wording (E2a)."),
 },
 primary={"target": "oily", "confidence": "moderate", "rationale": "S-OILY passes. Positioning: 'Anti-Fett Shampoo' (named problem) and 'Für normales bis schnell fettendes Haar' (E2 oily-hair term, v1.6.1), manufacturer DE, moderate. Formula clause: cleansingStrength moderate, weightPotential low (not high), conditioningLevel moderate (not high). Confidence = min(positioning moderate, cleansing high, weight moderate, conditioning moderate) = moderate."},
 secondary=None,
 notes=["active_without_dandruff_positioning (Piroctone Olamine @13; no dandruff claim; R17.3)"],
 claims=[
  {"unit": "Anti-Fett Shampoo", "source": "manufacturer_de", "grade": "moderate", "use": "E2 oily claim unit; F6 focus; U4 reset intent (no effect, cleansing moderate)"},
  {"unit": "Für normales bis schnell fettendes Haar", "source": "manufacturer_de", "grade": "moderate", "use": "E2 oily claim unit"},
  {"unit": "Verzögert das Nachfetten, ohne auszutrocknen", "source": "manufacturer_de", "grade": "moderate", "use": "oily corroboration; 'ohne auszutrocknen' protective"},
  {"unit": "Frische & Leichtigkeit (product name)", "source": "name", "grade": "high", "use": "not E2 ('Frische', 'Leichtigkeit' do not qualify)"},
  {"unit": "Haartyp: normales Haar, fettiges Haar", "source": "retailer_dm_de", "grade": "low", "use": "listing attribute, never a claim unit"}],
 reconciliation=[
  "focusPrimary: general (provisional; neighbor scalp_active) -> clarifying; reason: revealed positioning is oily-scalp, not dandruff, so the piroctone is not a focus route (R17.3) and F6 maps oily positioning to clarifying on a compatible formula.",
  "usageRole: regular unchanged (provisional neighbor treatment rejected: no dandruff claim).",
  "scalpComfortTarget: not_targeted unchanged.",
  "Formula properties unchanged; claim 'Zitronenmelisse und Vitamin C' maps to Melissa Officinalis Leaf Extract @18 and Ascorbyl Palmitate @14 (no conflict)."],
 uncertainties=[
  "weightPotential low (moderate confidence, neighbor moderate) raises T4 on fine; alternative moderate would make fine acceptable.",
  "Zinc PCA @10 is not a listed route of any kind; not used."]
)

# ---------------- W203
S["W203"] = dict(
 brand="Cantu", productName="Cantu Shampoo Locken Pflege (dm: cantu Shampoo Cream Cleanse; manufacturer: Shea Butter Cleansing Cream Shampoo)",
 counter={"cleansingStrength": "Shea and polymers post-E3; Cocamide DIPA booster; nothing argues stronger.", "conditioningLevel": "Every conditioning route is after Parfum @9."},
 props={
  "focusPrimary": fp("general", "moderate", "moisture", "nonspecific", "not_applicable",
     "Shea butter and two cationic polymers present, but post-E3.",
     "Claim direction care/cleansing for structured hair ('pflegt das Haar', 'geschmeidiges Haargefühl'; UK page 'nourish curls', 'protect against breakage'), all graded low (dm retailer, manufacturer_foreign). Formula verdict nonspecific, so no low-graded claim can act as candidate (CL-SRC). Decision: general.",
     "General: low-graded generic care claims over a nonspecific formula.", ["7.2", "7.3", "F1", "CL-SRC", "F-TRACE"]),
  "focusSecondary": fs([], "high", "none", "Empty default considered; no moderate/high positioning at all.", "Secondary empty."),
  "usageRole": ur("regular", "high", "none", "none", [], ["alternating impossible (cleansing moderate); residue-removal wording is low-graded"], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", NOSC1.format(csa="listed route Glycerin @5 met") + " 'Für eine sanfte Reinigung ... von Haar und Kopfhaut' is mildness wording."),
 },
 primary={"target": "ordinary", "confidence": "moderate", "rationale": "S-ORDINARY way 1: no qualifying E2 claim unit. Confidence moderate: retailer copy and a foreign manufacturer page only (13.8)."},
 secondary=None,
 claims=[
  {"unit": "Entfernt sanft Produktrückstände", "source": "retailer_dm_de_exact_gtin", "grade": "low", "use": "reset intent cannot fire (low; cleansing moderate)"},
  {"unit": "ohne es zu beschweren", "source": "retailer", "grade": "low", "use": "never lowers weight (6.5)"},
  {"unit": "Zweiter Schaum ... bei starken Produktablagerungen", "source": "retailer directions", "grade": "low", "use": "not D1"},
  {"unit": "Rich creamy lather removes buildup / helps protect against breakage", "source": "manufacturer_foreign (UK)", "grade": "low", "use": "corroboration only; UK formula disclaimer noted"}],
 reconciliation=[
  "focusPrimary: general unchanged (confidence low -> moderate).",
  "All other properties unchanged; no moderate/high claim exists.",
  "UK manufacturer page states its INCI may differ by region: not a formula source for the DE product (Section 2); the frozen DE formula stands."],
 uncertainties=[
  "weightPotential low vs moderate (blind, pinned): three late families (two cationic polymers, film former) plus post-line shea; alternative moderate would make fine acceptable.",
  "Formula source tier 4 (fallback retailer) per packet."]
)

# ---------------- W204
S["W204"] = dict(
 brand="Pantene", productName="Pantene Grow Abundance",
 counter={"cleansingStrength": "TEA-Dodecylbenzenesulfonate @18 is a strong anionic but non-prominent.", "conditioningLevel": "Silicones post-E3; no humectant cluster."},
 props={
  "focusPrimary": fp("general", "moderate", "repair", "nonspecific", "not_applicable",
     "Hair-loss positioning dominates and is out of scope (F5); Piroctone Olamine @6 without a dandruff claim.",
     "Claim direction: hair loss/density ('Anti-Haarverlust', 'dichteres Haar') ignored by F5. Remaining in-scope wording ('stärkt feines, schwaches Haar', 'verringert Haarbruch') is retailer-only (low) and the formula verdict is nonspecific (silicone/guar only), so no candidate (CL-SRC). Decision: general.",
     "General: dominant claim out of scope (F5); remaining claims low-graded over a nonspecific formula.", ["7.2", "F5", "CL-SRC", "F-TRACE"]),
  "focusSecondary": fs([], "high", "none", "Empty default considered; no moderate/high positioning.", "Secondary empty."),
  "usageRole": ur("regular", "high", "none", "none", [], ["treatment not fired: dandruffSupport supported but no dandruff claim (U3)", "'Verwende dieses Shampoo regelmäßig' is not frequency wording and is low-graded"], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", "not_targeted: no SC1 claim (hair-root/Kopfhaut wording is hair-loss positioning, E2 exclusion). CSA would fail anyway (no prominent listed route; MB excluded by SLES @2)."),
 },
 primary={"target": "ordinary", "confidence": "moderate", "rationale": "S-ORDINARY ways 1, 2 and 3: no qualifying E2 claim unit; the only scalp-adjacent positioning is hair loss (S-HAIRLOSS, not evaluated); recognized active Piroctone Olamine @6 without a dandruff claim (R17.3). All sources are retailer (low). Confidence = lowest of the ways = moderate."},
 secondary=None,
 notes=["hair_loss_claim_not_evaluated", "active_without_dandruff_positioning (Piroctone Olamine @6)"],
 claims=[
  {"unit": "Anti-Haarverlust Shampoo / reduziert Haarverlust um bis zu 90%", "source": "retailer_rossmann_de", "grade": "low", "use": "out of scope (F5, S-HAIRLOSS)"},
  {"unit": "stärkt feines, schwaches Haar / verringert Haarbruch", "source": "retailer_rossmann_de", "grade": "low", "use": "no candidate (formula nonspecific)"},
  {"unit": "900mg PRO-V KOMPLEX und Niacinamiden", "source": "retailer", "grade": "low", "use": "Niacinamide @30 maps; Panthenol @19 (pro-vitamin) maps; no conflict"}],
 reconciliation=[
  "focusPrimary: general unchanged (provisional neighbor scalp_active rejected: no dandruff claim; hair loss out of scope).",
  "usageRole: regular unchanged (provisional neighbor treatment rejected, U3).",
  "Formula properties unchanged; 'feines Haar' never changes weight or fit (T2)."],
 uncertainties=[
  "weightPotential moderate (neighbor high) raises T4 on fine and normal; alternative high would make fine not_suited and normal acceptable.",
  "Packet identityConfidence moderate; all claim sources retailer-only."]
)

# ---------------- W205
S["W205"] = dict(
 brand="Sebamed", productName="Sebamed Urea 5% (Anti-Juckreiz Akut Shampoo Urea 5%)",
 counter={"cleansingStrength": "Mild-anionic-led chassis (sulfosuccinate @3, sulfoacetate @4, glucoside @6) with SLES last argues low.", "conditioningLevel": "Cationic starch @15 could give noticeable slip."},
 props={
  "focusPrimary": fp("scalp_active", "moderate", "general", "not_applicable", "candidate",
     "Prominent SLES @7 and Parfum @8; lengths-care wording ('trockenes Haar') competes (F7).",
     "Claim direction sensitive/itchy and dry scalp ('Anti-Juckreiz', 'gezielte Akutpflege für juckende Kopfhaut', 'Trockenheit der Kopfhaut ... reduziert', manufacturer DE, moderate). F7: the product name ('Sebamed Urea 5%') names neither role, so scalp_active is primary because it is formula-compatible (scalpComfortTarget targeted via Urea @2, Laureth-9/Polidocanol @5). Lengths moisture ('trockenes Haar') fails as secondary (formula verdict nonspecific).",
     "scalp_active (F7 step 2): explicit itchy/dry-scalp positioning with a targeted comfort architecture.", ["7.2", "F7", "SC1", "F-TRACE"]),
  "focusSecondary": fs([], "moderate", ["moisture"], "Empty default considered; moisture claim for dry hair exists (moderate) but the formula care verdict is nonspecific and Urea @2 is already cited for the scalp route (F3).", "Secondary empty: no independent moisture route."),
  "usageRole": ur("regular", "high", "none", "none", [], ["'Akut' is not D1 wording; no frequency wording; no dandruff active"], REG_DEFAULT),
  "scalpComfortTarget": sc("targeted", "moderate", "not_targeted", "targeted: SC1 met by moderate-graded sensitive and dry-scalp units ('Anti-Juckreiz Akut Shampoo', 'Akutpflege für juckende Kopfhaut', 'Beruhigung der Kopfhaut', 'Trockenheit der Kopfhaut ... reduziert'); CSA met via listed prominent routes Urea @2 (comfort and humectant) and Laureth-9 = Polidocanol @5 (comfort, v1.6.2). MB excluded (SLES @7 prominent). Counter-signal Parfum @8; cleansing not strong; confidence moderate (moderate positioning)."),
 },
 primary={"target": "sensitive", "confidence": "moderate", "rationale": "S-SENSITIVE passes: E2 sensitive units ('Anti-Juckreiz', 'juckende Kopfhaut', 'Beruhigung der Kopfhaut'), manufacturer DE, moderate; formula: scalpComfortTarget targeted and prominent comfort routes Urea @2, Laureth-9 (Polidocanol) @5. Cleansing moderate, so no review_strong_cleansing_comfort_route. S-PRIMARY: product name names no target, so sensitive precedes dry. Confidence = min(moderate positioning, targeted moderate) = moderate."},
 secondary={"target": "dry", "confidence": "moderate", "rationale": "S-DRY passes on its own distinct unit 'Bereits nach zwei Wochen Anwendung kann die Trockenheit der Kopfhaut um bis zu 63 % reduziert werden' (manufacturer DE, moderate; 'reduziert' + dry scalp), scalpComfortTarget targeted and prominent humectant route Urea @2. Not oily, so no contradiction (S-SECONDARY). Confidence moderate."},
 claims=[
  {"unit": "Anti-Juckreiz Akut Shampoo Urea 5%", "source": "manufacturer_de", "grade": "moderate", "use": "E2 sensitive (named problem), SC1"},
  {"unit": "gezielte Akutpflege für juckende Kopfhaut und trockenes Haar", "source": "manufacturer_de", "grade": "moderate", "use": "E2 sensitive; 'trockenes Haar' is lengths, not dry scalp"},
  {"unit": "Polidocanol wirkt juckreizlindernd und unterstützt eine nachhaltige Beruhigung der Kopfhaut", "source": "manufacturer_de", "grade": "moderate", "use": "product-action sentence (E2 sensitive); claim maps to Laureth-9 @5"},
  {"unit": "Trockenheit der Kopfhaut um bis zu 63 % reduziert", "source": "manufacturer_de", "grade": "moderate", "use": "E2 dry claim unit"},
  {"unit": "Urea ist ein hautverwandter natürlicher Feuchthaltefaktor, der Spannungsgefühl ... lindert", "source": "manufacturer_de", "grade": "moderate", "use": "ingredient-reputation sentence, never qualifies (E2a)"},
  {"unit": "Die seifenfreie Formel ist besonders schonend", "source": "manufacturer_de", "grade": "moderate", "use": "mildness, not targeting"}],
 reconciliation=[
  "focusPrimary: general (provisional; neighbor scalp_active) -> scalp_active; reason: explicit itchy/dry-scalp positioning (moderate) on a CSA formula (F7 step 2).",
  "scalpComfortTarget: not_targeted (provisional, low) -> targeted (moderate); reason: SC1 met by moderate manufacturer units; CSA met in the blind pass.",
  "usageRole: regular unchanged.",
  "Formula properties unchanged; claim 'Zuckertenside' (Rossmann, low) is corroboration; 'Stärkederivat' maps to Hydroxypropyl Oxidized Starch PG-Trimonium Chloride @15."],
 uncertainties=[
  "cleansingStrength moderate (C1, confidence moderate, neighbor low): both projected buckets expect gentle and the observed intensity is regular, so rows are amber; I3 raises nothing because the current intensity does not match the buckets.",
  "Dry secondary relies on the 63 % dryness sentence; 'Haartyp: trockene/sehr trockene Kopfhaut' is a listing field and was not used."]
)

# ---------------- W206
S["W206"] = dict(
 brand="Neqi", productName="Neqi Volume Victory",
 counter={"cleansingStrength": "No strong anionic; nothing argues stronger.", "conditioningLevel": "Several light post-E3 routes."},
 props={
  "focusPrimary": fp("volume", "moderate", "general", "not_applicable", "candidate",
     "Light routes include panthenol/oat peptide 'strengthening' claims; all positioning outside the name is low-graded.",
     "Claim direction volume: 'Volume' in the exact product name (CL-SRC high); body copy ('spürbar volleres Haar', 'schwerelose ... Reinigung', CH shop manufacturer_foreign and notino retailer, low) corroborates. Formula compatible: weightPotential low, conditioningLevel low, mild C6 base; one compatible route Polyquaternium-11 @17 (film-forming fixative polymer). Decision: volume.",
     "Volume: name-word positioning on a light, compatible formula.", ["7.2", "CL-SRC", "F-TRACE"]),
  "focusSecondary": fs([], "moderate", ["moisture"], "Empty default considered; 'spendet viel Feuchtigkeit' and 'stärkt die Haarstruktur' are low-graded and the formula verdict is nonspecific.", "Secondary empty."),
  "usageRole": ur("regular", "high", "none", "none", [], [], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", NOSC1.format(csa="MB met") + " 'Kopfhaut-typ: alle Arten' is a listing attribute."),
 },
 primary={"target": "ordinary", "confidence": "moderate", "rationale": "S-ORDINARY way 1: no qualifying E2 claim unit. Confidence moderate: only a foreign-market manufacturer shop and a retailer (both low), no German manufacturer or pack source (13.8)."},
 secondary=None,
 claims=[
  {"unit": "Volume Victory (product name)", "source": "name", "grade": "high", "use": "volume focus candidate"},
  {"unit": "Die schwerelose, aufbauende Reinigung ist speziell für feines und dünnes Haar geeignet", "source": "manufacturer_foreign (CH shop, German text)", "grade": "low", "use": "T2: thickness claims never change fit; 'schwerelos' never lowers weight"},
  {"unit": "Signature Blend (Peptide, Hemisqualan, Gojibeeren, Malve, Tahiti-Gardenie)", "source": "retailer_notino_de", "grade": "low", "use": "maps to Avena Sativa Peptide @8, Lycium @10, Malva @11, Gardenia @9; 'Hemisqualan' maps to C13-15 Alkane @21 (emollient hydrocarbon) - note only"}],
 reconciliation=[
  "focusPrimary: general (provisional) -> volume; reason: 'Volume' in the exact product name (high) on a light compatible formula.",
  "Other properties unchanged."],
 uncertainties=[
  "'Hemisqualan' claim maps plausibly to C13-15 Alkane @21 (a light emollient hydrocarbon); immaterial (post-line, trace).",
  "Formula source tier 4 per packet.",
  "Focus confidence moderate; alternative general if the PQ-11 route is judged too trace to count as a volume route."]
)

# ---------------- W207
S["W207"] = dict(
 brand="Balea Med", productName="Balea Med Anti Schuppen",
 counter={"cleansingStrength": "Glyceryl Oleate refatting; nothing argues stronger.", "conditioningLevel": "A single guar polymer."},
 props={
  "focusPrimary": fp("scalp_active", "high", "none", "not_applicable", "candidate",
     "Lengths wording ('Pflege, Feuchtigkeit, Glanz') is a listing attribute; SLES chassis.",
     "Claim direction dandruff: 'Anti Schuppen' in the exact product name (high) and 'Shampoo gegen Schuppen' (moderate). Formula compatible: recognized active Piroctone Olamine @10 (dandruffSupport supported). Decision: scalp_active (7.2 problem-led dandruff row; F7 step 1 name).",
     "scalp_active: named anti-dandruff product with a recognized active.", ["7.2", "F7", "S-DANDRUFF", "F-TRACE"]),
  "focusSecondary": fs([], "high", "none", "Empty default considered; no distinct lengths-care positioning beyond a listing attribute.", "Secondary empty."),
  "usageRole": ur("treatment", "high", "none", "recognized_active_problem_led", ["Piroctone Olamine @10 (dandruffSupport supported)", "'Balea Med Anti Schuppen' (product name, high)", "'Shampoo gegen Schuppen' (manufacturer DE, moderate)"], ["frequent (explicit_frequent_non_strong): 'eine sanfte Pflege für jeden Tag' (moderate) with cleansing moderate also fires; loses to treatment under U1"], "treatment wins by U1 over frequent.", ["9", "U1", "U2", "U3", "F-TRACE"]),
  "scalpComfortTarget": sc("not_targeted", "moderate", "targeted", "not_targeted: every sensitive/dry/comfort unit is bundled with a dandruff unit of the same source (consecutive plain-list entries after 'Shampoo gegen Schuppen'; the paragraph sentences sit next to 'befreit ... von Schuppen'), and bundled wording is not SC1 positioning (SC1, E2b; P0 'when unclear, bundled'). CSA itself is met (Panthenol @5, Bisabolol @6, Niacinamide @7, Glycerin @9). Moderate: a reader treating 'Für empfindliche & trockene Kopfhaut' as a separate headline would make it targeted.", ["10", "SC1", "E2b", "CSA", "E4"]),
 },
 primary={"target": "dandruff", "confidence": "high", "rationale": "S-DANDRUFF passes: E2 dandruff claim in the exact product name ('Anti Schuppen', high) plus 'Shampoo gegen Schuppen' (moderate), and dandruffSupport supported (Piroctone Olamine @10, high). Dandruff path (R17.1): primary dandruff, no secondary (R17.2)."},
 secondary=None,
 rct=["sensitive"],
 notes=["suits_dandruff_with_irritated_scalp (bundled comfort wording 'Kann Juckreiz mildern & die Kopfhaut beruhigen', 'Die milde Formulierung beruhigt die Kopfhaut', manufacturer DE, moderate; S-SENSITIVE formula gate read as CSA + prominent comfort route: Panthenol @5, Bisabolol @6, Niacinamide @7)"],
 claims=[
  {"unit": "Balea Med Anti Schuppen (product name)", "source": "name", "grade": "high", "use": "E2 dandruff"},
  {"unit": "Shampoo gegen Schuppen", "source": "manufacturer_de (dm own brand)", "grade": "moderate", "use": "E2 dandruff"},
  {"unit": "Für empfindliche & trockene Kopfhaut", "source": "manufacturer_de", "grade": "moderate", "use": "bundled (consecutive list entry next to the dandruff unit): sensitive part feeds the research combination; dryness part is absorbed (no dry combination, E2b)"},
  {"unit": "Kann Juckreiz mildern & die Kopfhaut beruhigen", "source": "manufacturer_de", "grade": "moderate", "use": "bundled comfort wording -> research combination sensitive"},
  {"unit": "eine sanfte Pflege für jeden Tag", "source": "manufacturer_de", "grade": "moderate", "use": "U2 frequency wording (loses to treatment)"},
  {"unit": "Ohne Parfum, Parabene & Farbstoffe", "source": "manufacturer_de", "grade": "moderate", "use": "supportive signal only; consistent with no Parfum in INCI"}],
 reconciliation=[
  "focusPrimary: general (provisional; neighbor scalp_active) -> scalp_active (high); reason: dandruff name claim plus recognized active.",
  "usageRole: regular (provisional; neighbor treatment) -> treatment; reason: U3 met (active + name/manufacturer dandruff claim).",
  "scalpComfortTarget: not_targeted unchanged (low -> moderate); comfort units are bundled with the dandruff claim.",
  "Formula properties unchanged."],
 uncertainties=[
  "Bundling of 'Für empfindliche & trockene Kopfhaut': read as bundled (consecutive list entry, P0). If read as a separate unit, scalpComfortTarget would be targeted and 'dry' would also be recorded in researchCombinationTargets (S-DRY gate passes: Glycerin @9 prominent) - research-only, no projection change.",
  "weightPotential low (moderate, neighbor moderate) raises T4 on fine.",
  "Packet identityConfidence moderate."]
)

# ---------------- W208
S["W208"] = dict(
 brand="Plantur 39 (Dr. Kurt Wolff)", productName="Plantur 39 Phyto-Coffein-Shampoo für feines, brüchiges Haar",
 counter={"cleansingStrength": "Only mild anionic buffers, no amphoteric; nothing argues stronger.", "conditioningLevel": "Polyquaternium-7 @13 could give slip."},
 props={
  "focusPrimary": fp("general", "moderate", "volume", "nonspecific", "not_applicable",
     "Dominant claim is hair loss (F5); 'brüchiges Haar' breakage wording over a nonspecific formula (single trace protein).",
     "Claim direction: menopausal hair loss / root activation (F5, ignored). Remaining in-scope claims: 'Speziell für feines, brüchiges Haar' (repair-adjacent, moderate) - formula verdict nonspecific (one protein token @17), so repair is not compatible; 'leicht dosierte Pflegestoffe ... damit die Frisur ihr Volumen behält' is a light-formula statement, not a volume job. Decision: general.",
     "General: hair loss out of scope; remaining care claims not supported by a specific route.", ["7.2", "F5", "7.3", "F-TRACE"]),
  "focusSecondary": fs([], "moderate", ["volume"], "Empty default considered; volume-retention wording is subordinate and has no distinct route.", "Secondary empty."),
  "usageRole": ur("frequent", "moderate", "regular", "explicit_frequent_non_strong", ["'Täglich anwenden' (manufacturer DE directions, moderate)", "'Bei jeder Haarwäsche benutzen' (manufacturer DE, moderate)", "cleansingStrength moderate (not strong)"], [], "frequent: explicit daily-use wording (U2) from a moderate source, cleansing not strong.", ["9", "U1", "U2", "CL-SRC", "F-TRACE"]),
  "scalpComfortTarget": sc("not_targeted", "high", "none", "not_targeted: no SC1 claim; 'stärken die Widerstandskraft von Kopfhaut und Haarfollikeln' is hair-loss/follicle positioning, not a sensitive or dry claim. CSA would be met (Panthenol @4, Niacinamide @16)."),
 },
 primary={"target": "ordinary", "confidence": "moderate", "rationale": "S-ORDINARY way 2 (and way 1): the only scalp-adjacent positioning is hair loss/growth (S-HAIRLOSS, not evaluated); no qualifying E2 unit. Way 2 confidence moderate."},
 secondary=None,
 notes=["hair_loss_claim_not_evaluated"],
 claims=[
  {"unit": "Beugt menopausalem Haarausfall vor / Phyto-Coffein-Complex aktiviert die Haarwurzel", "source": "manufacturer_de", "grade": "moderate", "use": "out of scope (F5, S-HAIRLOSS)"},
  {"unit": "Speziell für feines, brüchiges Haar", "source": "manufacturer_de", "grade": "moderate", "use": "T2 (thickness never changes fit); breakage candidate fails (nonspecific formula)"},
  {"unit": "Täglich anwenden | Bei jeder Haarwäsche benutzen", "source": "manufacturer_de directions", "grade": "moderate", "use": "U2 frequent trigger"},
  {"unit": "Bewusst leicht dosierte Pflegestoffe ... ohne es zu beschweren", "source": "manufacturer_de", "grade": "moderate", "use": "never lowers weight (6.5)"},
  {"unit": "Zink und Niacin / weißer Tee-Extrakt", "source": "manufacturer_de", "grade": "moderate", "use": "maps to Zinc PCA @15, Niacinamide @16, Camellia Sinensis Leaf Extract @14; no conflict"}],
 reconciliation=[
  "usageRole: regular (provisional; neighbor frequent) -> frequent; reason: 'Täglich anwenden' (moderate) with moderate cleansing (U2).",
  "focusPrimary: general unchanged (low -> moderate).",
  "Formula properties unchanged."],
 uncertainties=[
  "weightPotential low (moderate, neighbor moderate) raises T4 on fine.",
  "Focus alternative volume if 'damit die Frisur ihr Volumen behält' is read as volume positioning; formula would be compatible.",
  "Packet identityConfidence moderate."]
)

# ---------------- W209
S["W209"] = dict(
 brand="Sante (LOGOCOS Naturkosmetik)", productName="SANTE Sensitive Care Shampoo Probiotika + 3-fach Protein Komplex",
 counter={"cleansingStrength": "Alkyl sulfate (harsher class) as defining anionic; four buffers.", "conditioningLevel": "Protein trio and cationic arginate could give some slip."},
 props={
  "focusPrimary": fp("general", "moderate", "scalp_active", "nonspecific", "candidate",
     "Explicit sensitive-scalp positioning exists but fails the formula half (CSA); protein claims over a nonspecific formula.",
     "Claim direction sensitive scalp ('Für sensibles Haar und empfindliche Kopfhaut', manufacturer DE, moderate) plus lengths care ('3-fach Protein Komplex stärkt, pflegt & schützt'). F7: name word 'Sensitive' does not name the scalp and is ignored; neither role is named, so scalp_active would be primary only if formula-compatible - it is not (scalpComfortTarget not_targeted: no listed route, MB excluded by Sodium Coco-Sulfate @2). Lengths repair candidate: verdict nonspecific (late proteins @13-15, no deposition system) -> not compatible. Decision: general.",
     "General: neither the scalp role nor the protein-care role is formula-compatible (F7 step 2 fallback).", ["7.2", "F7", "7.3", "F-TRACE"]),
  "focusSecondary": fs([], "high", "none", "Empty default considered; no compatible secondary route.", "Secondary empty."),
  "usageRole": ur("regular", "high", "none", "none", [], [], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", "not_targeted: explicitly positioned (SC1 met: 'Für sensibles Haar und empfindliche Kopfhaut', moderate) but CSA fails - no E4 comfort or humectant/refatting route anywhere in the formula and MB excluded by the prominent strong anionic Sodium Coco-Sulfate @2. Missing route named: unlisted_route_candidate:Aloe Barbadensis Leaf Juice, unlisted_route_candidate:Lactococcus Ferment Lysate, unlisted_route_candidate:Arginine (all rejected by R18). Closed lists make this mechanical (high)."),
 },
 primary={"target": "ordinary", "confidence": "moderate", "rationale": "S-ORDINARY way 4 (S-FAIL): the sensitive target fails its formula gate (scalpComfortTarget not_targeted, no prominent comfort route, no MB); the dry reading also fails (no humectant route). No other specialist target passes. Proposed ordinary with review_specialist_gate_failed; confidence moderate."},
 secondary=None,
 extraFlags=["review_specialist_gate_failed: sensitive (S-SENSITIVE formula gate: CSA missing - no prominent E4 comfort route, MB excluded by Sodium Coco-Sulfate @2; unlisted_route_candidate:Aloe Barbadensis Leaf Juice, unlisted_route_candidate:Lactococcus Ferment Lysate, unlisted_route_candidate:Arginine); dry (reading of 'Reduziert Spannungs- & Trockenheitsgefühle ... der Kopfhaut': S-DRY formula gate fails, no prominent humectant/refatting route)"],
 claims=[
  {"unit": "Für sensibles Haar und empfindliche Kopfhaut", "source": "manufacturer_de", "grade": "moderate", "use": "E2 sensitive claim unit (SC1)"},
  {"unit": "Reduziert Spannungs- & Trockenheitsgefühle und unterstützt den natürlichen pH-Wert der Kopfhaut", "source": "manufacturer_de", "grade": "moderate", "use": "read as dry/tension scalp claim (P0: more review); gate fails"},
  {"unit": "Wohltuend für die Kopfhaut / Hält den pH-Wert der Kopfhaut in Balance / Verträglichkeit dermatologisch getestet", "source": "manufacturer_de", "grade": "moderate", "use": "not in the E2 lexicon / protective wording"},
  {"unit": "Sensitive Care (product name)", "source": "name", "grade": "high", "use": "non-scalp name word; ignored for F7"},
  {"unit": "Probiotika + 3-fach Protein Komplex", "source": "name/manufacturer", "grade": "high", "use": "maps to Lactococcus Ferment Lysate @9 and Hydrolyzed Corn/Wheat/Soy Protein @13-15; no conflict"}],
 reconciliation=[
  "scalpComfortTarget: not_targeted unchanged, now positioned-but-failing (moderate -> high).",
  "focusPrimary: general unchanged (neighbor scalp_active).",
  "Projection: sensitive target fails S-FAIL -> ordinary + review_specialist_gate_failed.",
  "Formula properties unchanged."],
 uncertainties=[
  "Whether 'Reduziert Spannungs- & Trockenheitsgefühle' names the scalp: read as yes (dry/tension); it only adds detail to an already failing gate.",
  "Aloe juice @6, Lactococcus Ferment Lysate @9 and Arginine @10 are prominent but were rejected from the lists by R18; Nick may still rule on the product."]
)

# ---------------- W210
S["W210"] = dict(
 brand="ISANA", productName="ISANA MED Shampoo Anti Schuppen",
 counter={"cleansingStrength": "Reinforcing ether sulfates are late (@14-20) and the chassis is buffered (betaine @3, glucoside @5, glutamate @6) with Glyceryl Oleate @7.", "conditioningLevel": "None material."},
 props={
  "focusPrimary": fp("scalp_active", "high", "none", "not_applicable", "candidate",
     "Prominent Menthol @12 and strong cleansing; oily-hair wording.",
     "Claim direction dandruff: 'Anti Schuppen' in the exact product name (high), 'Anti Schuppenformel mit Piroctone Olamine' (pack back, moderate). Formula compatible: Piroctone Olamine @8. Decision: scalp_active.",
     "scalp_active: named anti-dandruff product with a recognized active.", ["7.2", "F7", "S-DANDRUFF", "F-TRACE"]),
  "focusSecondary": fs([], "moderate", ["clarifying"], "Empty default considered; 'reinigt schnell fettendes Haar' (pack, moderate) is distinct oily positioning, but its only route is the strong cleansing chassis, i.e. a restatement of cleansingStrength (Section 8 criterion 3, invalid pattern 'clarifying only because cleansing is strong').", "Secondary empty; clarifying is the neighbor."),
  "usageRole": ur("treatment", "high", "none", "recognized_active_problem_led", ["Piroctone Olamine @8", "'ISANA MED Shampoo Anti Schuppen' (name, high)", "'befreit das Haar ... von störenden Schuppen' (pack back/manufacturer, moderate)"], ["alternating (strong_plus_reset_intent): cleansing strong + oily reset intent 'reinigt schnell fettendes Haar' (moderate) also fires; loses to treatment (U1)"], "treatment wins by U1.", ["9", "U1", "U3", "U4", "F-TRACE"]),
  "scalpComfortTarget": sc("not_targeted", "moderate", "targeted", "not_targeted: the only dry-scalp unit ('Coffein & Menthol gegen trockene Kopfhaut') is the consecutive list entry after 'Piroctone Olamine wirkt nachhaltig gegen Schuppen' on the same manufacturer source, so it is bundled and not SC1 (E2b, P0). 'Menthol erfrischt die Kopfhaut' is not lexicon wording. CSA would be met (Panthenol @10, Glycerin @13, Glyceryl Oleate @7) with counter-signals strong cleansing and Menthol @12.", ["10", "SC1", "E2b", "CSA"]),
 },
 primary={"target": "dandruff", "confidence": "high", "rationale": "S-DANDRUFF passes: dandruff claim in the exact product name (high) and on the pack back (moderate); dandruffSupport supported (Piroctone Olamine @8). Primary dandruff (R17.1), no secondary (R17.2)."},
 secondary=None,
 rct=["oily"],
 notes=["suits_dandruff_with_oily_scalp ('reinigt schnell fettendes Haar', pack back, moderate; S-OILY clause: cleansingStrength strong, weightPotential low, conditioningLevel low)"],
 claims=[
  {"unit": "ISANA MED Shampoo Anti Schuppen (product name)", "source": "name", "grade": "high", "use": "E2 dandruff"},
  {"unit": "Anti Schuppenformel mit Piroctone Olamine ... gegen lästige Schuppen", "source": "pack_back", "grade": "moderate", "use": "E2 dandruff"},
  {"unit": "reinigt schnell fettendes Haar", "source": "pack_back", "grade": "moderate", "use": "E2 oily (v1.6.1 oily-hair term) -> research combination oily; U4 reset intent (loses)"},
  {"unit": "Coffein & Menthol gegen trockene Kopfhaut", "source": "manufacturer_de", "grade": "moderate", "use": "bundled dryness wording (next to the dandruff unit): absorbed, no dry combination"},
  {"unit": "Coffein hilft die Haarwurzel zu stärken", "source": "manufacturer_de", "grade": "moderate", "use": "root-strengthening wording; not a focus route (F5-adjacent), no target"},
  {"unit": "ohne Silikone & pH 5,5 hautneutral / dermatologisch bestätigt", "source": "pack/manufacturer", "grade": "moderate", "use": "protective/mildness wording"}],
 reconciliation=[
  "focusPrimary: general (provisional; neighbor scalp_active) -> scalp_active (high).",
  "usageRole: regular (provisional; neighbor treatment) -> treatment.",
  "scalpComfortTarget: not_targeted unchanged (dry-scalp unit bundled).",
  "Formula properties unchanged (cleansing strong by C1 reinforcing ether sulfates; claims cannot move it)."],
 uncertainties=[
  "'Coffein & Menthol gegen trockene Kopfhaut' read as bundled (consecutive manufacturer list entry next to a dandruff unit). If read as separate: scalpComfortTarget targeted (moderate) and the dry combination would conflict with oily -> both dropped as contradictory_scalp_states (P0).",
  "'Coffein hilft die Haarwurzel zu stärken' not treated as hair-loss lexicon; if it were, only the note hair_loss_claim_not_evaluated would be added.",
  "cleansingStrength strong at moderate confidence (neighbor moderate); I1 gives regular either way."]
)

# ---------------- W211
S["W211"] = dict(
 brand="Schwarzkopf GLISS", productName="Schwarzkopf GLISS Shampoo Liquid Silk",
 counter={"cleansingStrength": "None.", "conditioningLevel": "Polyquaternium-10 sits after the E3 point."},
 props={
  "focusPrimary": fp("shine", "moderate", "general", "not_applicable", "candidate",
     "Strength/protection claims ('schützt und stärkt') with no coherent repair cluster.",
     "Claim direction shine/smoothing ('Schutz & gesund aussehender Glanz', 'glättet die Haaroberfläche und verleiht Glanz', 'für stumpfes, sprödes und glanzloses Haar', manufacturer DE, moderate). Formula compatible: light film/smoothing route Hydrolyzed Silk @6 + Sericin @7 with Polyquaternium-10 @10 and acidic Citric Acid @14. Decision: shine.",
     "Shine: dominant moderate-graded gloss/smoothing positioning with a plausible silk-film smoothing route.", ["7.1", "7.2", "F-TRACE"]),
  "focusSecondary": fs([], "moderate", ["repair"], "Empty default considered; 'stärkt das Haar' would rest on the same silk-protein route already cited for shine (F3) and the care verdict is nonspecific.", "Secondary empty."),
  "usageRole": ur("regular", "high", "none", "none", [], ["'Regelmäßig ... anwenden' is not frequency wording"], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", NOSC1.format(csa="not met: listed routes only post-E3")),
 },
 primary={"target": "ordinary", "confidence": "high", "rationale": "S-ORDINARY way 1: no qualifying E2 claim unit; the packet has a German manufacturer source, so confidence high (13.8)."},
 secondary=None,
 claims=[
  {"unit": "Schutz & gesund aussehender Glanz / glättet die Haaroberfläche", "source": "manufacturer_de", "grade": "moderate", "use": "shine focus candidate"},
  {"unit": "Mit Ceramiden & Seide (Hydrolyzed Silk, Sericin)", "source": "manufacturer_de", "grade": "moderate", "use": "Seide maps to Hydrolyzed Silk @6/Sericin @7; Ceramide maps to Glycosphingolipids @5 (ceramide-type lipids); no material conflict"},
  {"unit": "Ohne es zu beschweren", "source": "retailer_rossmann_de", "grade": "low", "use": "never lowers weight"}],
 reconciliation=[
  "focusPrimary: general (provisional; neighbor shine) -> shine; reason: moderate manufacturer gloss/smoothing positioning on a compatible silk-film formula.",
  "Other properties unchanged."],
 uncertainties=[
  "weightPotential moderate with neighbor low (blind, pinned): T4 raises nothing because the neighbor only lifts tiers; alternative low would make fine ideal.",
  "'Ceramide' claim mapped to Glycosphingolipids @5; if a reviewer requires a ceramide INCI name, it is a non-material note (no gate role)."]
)

# ---------------- W212
S["W212"] = dict(
 brand="Syoss", productName="Syoss Shampoo Intense Keratin",
 counter={"cleansingStrength": "None.", "conditioningLevel": "Missing C2 humectant element (no closed-list humectant)."},
 props={
  "focusPrimary": fp("repair", "moderate", "general", "repair_supported", "candidate",
     "No humectant route; ordinary SLES chassis.",
     "Claim direction repair ('Repariert schwaches, leicht brüchiges Haar', 'Keratin-Aufbau-Komplex', manufacturer DE, moderate). Formula verdict repair_supported (Hydrolyzed Keratin @6, Amodimethicone @11, Dimethicone @7, guar @12). Decision: repair (F1).",
     "Repair: moderate damage/breakage positioning on a repair_supported formula.", ["7.2", "7.3", "F1", "F-TRACE"]),
  "focusSecondary": fs([], "high", "none", "Empty default considered; no distinct secondary positioning.", "Secondary empty."),
  "usageRole": ur("regular", "high", "none", "none", [], ["'Tiefenpflegende Formel' and 'Tiefenspülung' are not D1 wording (D1 'Not D1' list)"], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", NOSC1.format(csa="listed route PEG-7 Glyceryl Cocoate @5 met")),
 },
 primary={"target": "ordinary", "confidence": "high", "rationale": "S-ORDINARY way 1: no qualifying E2 claim unit; German manufacturer source present, confidence high."},
 secondary=None,
 d1Rationale="D1 false: 'Tiefenpflegende Formel' and 'Tiefenspülung' share a prefix but are care terms explicitly excluded from D1; no occasional-use directions. D2 not met -> not_flagged.",
 claims=[
  {"unit": "Repariert schwaches, leicht brüchiges Haar / Füllt das Haar mit Keratin auf", "source": "manufacturer_de", "grade": "moderate", "use": "repair focus candidate"},
  {"unit": "Tiefenpflegende Formel mit 5% Keratin-Aufbau-Komplex", "source": "manufacturer_de", "grade": "moderate", "use": "not D1; 'Keratin' maps to Hydrolyzed Keratin @6 (no conflict); 5 % is not a concentration fact the formula pass uses"},
  {"unit": "Anschließend eine Tiefenspülung verwenden", "source": "manufacturer_de directions", "grade": "moderate", "use": "not D1"}],
 reconciliation=[
  "focusPrimary: general (provisional; neighbor repair) -> repair; reason: moderate repair claim on the blind repair_supported verdict.",
  "Other properties unchanged."],
 uncertainties=[
  "weightPotential moderate (neighbor high, W-LINE item 6 cap) raises T4 on fine and normal.",
  "conditioningLevel moderate with neighbor high (C2 humectant element missing): T4 raises nothing for coarse because the neighbor only lifts it."]
)

# ---------------- W213
S["W213"] = dict(
 brand="OGX", productName="OGX Renewing + Argan Oil of Morocco Shampoo",
 counter={"cleansingStrength": "Disodium Tetrapropenyl Succinate @13 role unclear; nothing strong.", "conditioningLevel": "Missing humectant element; all deposition after NaCl @5."},
 props={
  "focusPrimary": fp("repair", "moderate", "general", "repair_supported", "candidate",
     "No humectant route (moisture claims unsupported); all claims retailer-graded.",
     "Claim direction repair/nourishment ('repariert trockenes & geschädigtes Haar', 'regenerierende Formel', 'kräftigt und nährt', dm/Rossmann retailer, low) and moisture ('intensive Feuchtigkeit', low). Formula verdict repair_supported (Amodimethicone @9, Argan oil @6, Hydrogenated Castor Oil @11, guar @10), not moisture_supported (no humectant). A low-graded claim may be candidate only where the formula independently supports it -> repair, confidence capped moderate. 'Renewing' in the name corroborates.",
     "Repair: formula-led repair_supported verdict with low-graded repair claims (CL-SRC cap moderate).", ["7.2", "7.3", "F1", "CL-SRC", "F-TRACE"]),
  "focusSecondary": fs([], "moderate", ["moisture"], "Empty default considered; moisture claims are low-graded and the formula has no humectant route; shine/UV wording has no independent route.", "Secondary empty."),
  "usageRole": ur("regular", "high", "none", "none", [], [], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", NOSC1.format(csa="listed routes and MB met")),
 },
 primary={"target": "ordinary", "confidence": "moderate", "rationale": "S-ORDINARY way 1: no qualifying E2 claim unit; retailer copy only, confidence moderate."},
 secondary=None,
 claims=[
  {"unit": "repariert trockenes & geschädigtes Haar", "source": "retailer_dm_de", "grade": "low", "use": "repair candidate (formula-supported)"},
  {"unit": "intensive Feuchtigkeit / Feuchtigkeitsspendend", "source": "retailers", "grade": "low", "use": "no candidate (formula not moisture_supported)"},
  {"unit": "schützt ... vor UV-Strahlen / LipiPro Shield", "source": "retailers", "grade": "low", "use": "no INCI UV filter visible; marketing claim with no property role (note only)"},
  {"unit": "ohne sulfathaltige Tenside", "source": "retailer", "grade": "low", "use": "consistent with C6 formula"}],
 reconciliation=[
  "focusPrimary: general (provisional; neighbor repair) -> repair; reason: formula repair_supported, low claims as candidate (capped moderate).",
  "Other properties unchanged."],
 uncertainties=[
  "weightPotential high (moderate, neighbor moderate): fine not_suited is not lifted (ordinary target, no T6); neighbor would only raise tiers, so no T4 flag.",
  "UV-protection claim has no matching UV-filter INCI; no property or gate depends on it (ID-3 note, non-material).",
  "Two unresolved non-material ingredients (Sodium Hydrolyzed Potato Starch Dodecenylsuccinate @7, Disodium Tetrapropenyl Succinate @13) - could only add deposition."]
)

# ---------------- W214
S["W214"] = dict(
 brand="Pantene", productName="Pantene Pro-V Volumen Pur Shampoo",
 counter={"cleansingStrength": "Sodium Xylenesulfonate hydrotrope only.", "conditioningLevel": "None."},
 props={
  "focusPrimary": fp("volume", "moderate", "general", "not_applicable", "candidate",
     "No specific volume route beyond a light, residue-free formula; body copy is retailer-only.",
     "Claim direction volume: 'Volumen' in the exact product name (CL-SRC high); retailer copy 'für voller aussehende Haare', 'speziell für feines, plattes Haar' (low) corroborates. Formula compatible: weightPotential low, conditioningLevel low (no deposition). Decision: volume.",
     "Volume: name-word positioning on a light, compatible formula.", ["7.2", "CL-SRC", "F-TRACE"]),
  "focusSecondary": fs([], "high", "none", "Empty default considered; 'Glanz', 'schützt die Haarbindungen' are retailer-only with no route.", "Secondary empty."),
  "usageRole": ur("regular", "moderate", "frequent", "none", [], ["frequent not fired: 'Für die tägliche Haarwäsche geeignet' is Müller retailer copy (low)"], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", NOSC1.format(csa="not met")),
 },
 primary={"target": "ordinary", "confidence": "moderate", "rationale": "S-ORDINARY way 1: no qualifying E2 claim unit; retailer copy only, confidence moderate."},
 secondary=None,
 claims=[
  {"unit": "Volumen Pur (product name)", "source": "name", "grade": "high", "use": "volume focus candidate"},
  {"unit": "speziell für feines, plattes Haar", "source": "retailer", "grade": "low", "use": "T2: never changes fit"},
  {"unit": "Für die tägliche Haarwäsche geeignet", "source": "retailer_mueller_de", "grade": "low", "use": "cannot fire frequent"},
  {"unit": "schützt die Haarbindungen", "source": "retailer", "grade": "low", "use": "no bond-building INCI; marketing note only"}],
 reconciliation=["focusPrimary: general (provisional; neighbor volume) -> volume; reason: 'Volumen' in the exact product name on a light formula.", "Other properties unchanged."],
 uncertainties=["'Pro-V' / 'Active Nutri-Plex' map to Panthenol @13 and Histidine @16 (plausible); non-material."]
)

# ---------------- W215
S["W215"] = dict(
 brand="Balea Professional", productName="Balea Professional Shampoo Ultimate Volume",
 counter={"cleansingStrength": "None.", "conditioningLevel": "Guar dose unknown."},
 props={
  "focusPrimary": fp("volume", "moderate", "general", "nonspecific", "candidate",
     "Light guar and protein; 'kräftigt die Haarstruktur' strength wording over a nonspecific formula.",
     "Claim direction volume: 'Volume' in the exact product name (high), 'Volumen Shampoo', 'Mit Anti-Platt-Effekt' (dm own brand, moderate). Formula compatible: weightPotential low, conditioningLevel moderate (not high). Route: light protein/guar architecture without silicone or lipid. Decision: volume.",
     "Volume: name plus manufacturer volume positioning on a light formula.", ["7.2", "CL-SRC", "F-TRACE"]),
  "focusSecondary": fs([], "moderate", ["repair"], "Empty default considered; 'kräftigt die Haarstruktur' relies on the single protein token @6 (nonspecific) and 'gesund glänzt' has no independent route.", "Secondary empty."),
  "usageRole": ur("regular", "high", "none", "none", [], [], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", NOSC1.format(csa="listed route Glycerin @9 met")),
 },
 primary={"target": "ordinary", "confidence": "high", "rationale": "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer (dm own brand) source present, confidence high."},
 secondary=None,
 claims=[
  {"unit": "Ultimate Volume (product name) / Volumen Shampoo / Anti-Platt-Effekt", "source": "name; manufacturer_de", "grade": "high/moderate", "use": "volume focus"},
  {"unit": "Für feines, plattes Haar / ohne es zu beschweren", "source": "manufacturer_de", "grade": "moderate", "use": "T2; never lowers weight"},
  {"unit": "Pflege-Formel mit Biotin & Reis-Extrakt", "source": "manufacturer_de", "grade": "moderate", "use": "maps to Biotin @7, Oryza Sativa Extract @8"}],
 reconciliation=["focusPrimary: general (provisional; neighbor repair) -> volume; reason: name and moderate volume positioning on a light formula.", "Other properties unchanged."],
 uncertainties=["Packet notes the product is delisted at dm and replaced by another product; classification is of the frozen formula and identity only. Catalog handling is for the orchestrator.", "weightPotential low (moderate, neighbor moderate) raises T4 on fine."]
)

# ---------------- W216
S["W216"] = dict(
 brand="ISANA (Rossmann-Eigenmarke)", productName="ISANA MED Ultra Sensitiv+ Anti-Schuppen Shampoo",
 counter={"cleansingStrength": "Glyceryl Oleate refatting.", "conditioningLevel": "A single guar polymer."},
 props={
  "focusPrimary": fp("scalp_active", "high", "none", "not_applicable", "candidate",
     "SLES chassis; 'Ultra Sensitiv' is a non-scalp name word.",
     "Claim direction dandruff: 'Anti-Schuppen' in the exact product name (high); 'stark in der Wirkung gegen Schuppen' (pack back and manufacturer, moderate). Formula compatible: Piroctone Olamine @5. Decision: scalp_active.",
     "scalp_active: named anti-dandruff product with a recognized active.", ["7.2", "F7", "S-DANDRUFF", "F-TRACE"]),
  "focusSecondary": fs([], "high", "none", "Empty default considered; no lengths-care positioning.", "Secondary empty."),
  "usageRole": ur("treatment", "high", "none", "recognized_active_problem_led", ["Piroctone Olamine @5", "'Anti-Schuppen' (name, high)", "'stark & nachhaltig gegen Schuppen' (manufacturer DE, moderate)"], [], "treatment: recognized active plus dandruff claim (U3).", ["9", "U1", "U3", "F-TRACE"]),
  "scalpComfortTarget": sc("not_targeted", "moderate", "targeted", "not_targeted: no SC1 unit. 'sanft zur Kopfhaut' is sparing/tolerance wording (E2a, protective); 'Ultra sensitiv ... sehr sensibler Haut' names skin, not the scalp, and the name word 'Sensitiv' alone never counts (SC1). 'Allergie getestet', 'pH hautneutral' are protective. CSA would be met (Panthenol @8, Niacinamide @9, Bisabolol @10). Moderate because a reader could treat 'sensibler Haut' on a scalp shampoo as scalp positioning.", ["10", "SC1", "E2a", "CSA"]),
 },
 primary={"target": "dandruff", "confidence": "high", "rationale": "S-DANDRUFF passes: 'Anti-Schuppen' in the exact product name (high) and pack/manufacturer dandruff claims (moderate); dandruffSupport supported (Piroctone Olamine @5). Primary dandruff (R17.1), no secondary (R17.2)."},
 secondary=None,
 rct=[],
 claims=[
  {"unit": "ISANA MED Ultra Sensitiv+ Anti-Schuppen Shampoo (name)", "source": "name", "grade": "high", "use": "E2 dandruff; 'Sensitiv' non-scalp word"},
  {"unit": "stark in der Wirkung gegen Schuppen und sanft zur Kopfhaut", "source": "pack_back; manufacturer_de", "grade": "moderate", "use": "dandruff unit; 'sanft zur Kopfhaut' sparing wording (absorbed, not comfort wording)"},
  {"unit": "Ultra sensitiv Produkte ... sehr sensibler Haut abgestimmt", "source": "pack_back; manufacturer_de", "grade": "moderate", "use": "line description naming skin, not scalp; not E2"},
  {"unit": "0% Parfüm, Farbstoffe, Silikon / Panthenol und Niacinamide", "source": "manufacturer_de", "grade": "moderate", "use": "consistent with INCI (no Parfum; Panthenol @8, Niacinamide @9)"}],
 reconciliation=[
  "focusPrimary: general (provisional; neighbor scalp_active) -> scalp_active (high).",
  "usageRole: regular (provisional; neighbor treatment) -> treatment.",
  "scalpComfortTarget: not_targeted unchanged (low -> moderate).",
  "Formula properties unchanged."],
 uncertainties=[
  "No comfort wording qualifies, so researchCombinationTargets is [] and no E2b note is recorded; alternative reading ('sensibler Haut' as sensitive-scalp wording, moderate, gate passes) would add 'sensitive' - research-only.",
  "Pack-back source is a community photo (graded moderate per packet).",
  "weightPotential low (moderate, neighbor moderate) raises T4 on fine."]
)

# ---------------- W217
S["W217"] = dict(
 brand="Balea", productName="Balea PROFESSIONAL Shampoo Aqua Hyaluron",
 counter={"cleansingStrength": "Coco-Glucoside @8 is post-E3 (not a buffer).", "conditioningLevel": "A cationic guar is present (post-E3)."},
 props={
  "focusPrimary": fp("general", "moderate", "moisture", "nonspecific", "candidate",
     "Moisture positioning is clear but the formula has no coherent humectant cluster.",
     "Claim direction moisture ('Feuchtigkeitsspendendes Shampoo', 'Für trockenes & feuchtigkeitsbedürftiges Haar', dm own brand, moderate; 'Aqua Hyaluron' name). Formula verdict nonspecific: the only listed humectant is Sodium Hyaluronate @13 and every care ingredient follows Parfum @5. F1: moisture language over a nonspecific formula stays general.",
     "General: moisture claim not supported by a moisture_supported formula (F1).", ["7.2", "7.3", "F1", "F-TRACE"]),
  "focusSecondary": fs([], "high", "none", "Empty default considered.", "Secondary empty."),
  "usageRole": ur("regular", "high", "none", "none", [], [], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", NOSC1.format(csa="not met") + " 'die Kopfhaut geschont' is sparing wording (E2a)."),
 },
 primary={"target": "ordinary", "confidence": "high", "rationale": "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer (dm own brand) source, confidence high."},
 secondary=None,
 claims=[
  {"unit": "Feuchtigkeitsspendendes Shampoo / Für trockenes & feuchtigkeitsbedürftiges Haar", "source": "manufacturer_de", "grade": "moderate", "use": "moisture candidate; formula nonspecific -> general (F1)"},
  {"unit": "Mit Hyaluron & Aloe Vera", "source": "manufacturer_de", "grade": "moderate", "use": "maps to Sodium Hyaluronate @13, Aloe Barbadensis Leaf Juice Powder @11"},
  {"unit": "ohne das Haar zu beschweren / die Kopfhaut geschont", "source": "manufacturer_de", "grade": "moderate", "use": "never lowers weight; sparing wording"}],
 reconciliation=["focusPrimary: general unchanged (low -> moderate; neighbor moisture).", "Other properties unchanged."],
 uncertainties=["Focus alternative moisture if the post-E3 Sodium Hyaluronate plus aloe were read as a humectant cluster; the formula pass recorded nonspecific."]
)

# ---------------- W218
S["W218"] = dict(
 brand="Langhaarmädchen", productName="LANGHAARMÄDCHEN Shampoo Beautiful Curls",
 counter={"cleansingStrength": "None.", "conditioningLevel": "Many light post-E3 routes."},
 props={
  "focusPrimary": fp("general", "moderate", "volume", "nonspecific", "not_applicable",
     "Curl, bounce, shine and root-volume wording, all retailer-graded.",
     "Claim direction curls/bounce ('Shampoo für Locken und Wellen', 'Sprungkraft', 'Glanz', 'natürliches Volumen direkt am Ansatz'), all dm retailer copy (low). Curl pattern is hair_texture, not a focus; volume and shine have no formula verdict that independently supports them (CL-SRC). Decision: general.",
     "General: low-graded claims over a nonspecific formula.", ["7.2", "CL-SRC", "T2", "F-TRACE"]),
  "focusSecondary": fs([], "high", "none", "Empty default considered.", "Secondary empty."),
  "usageRole": ur("regular", "high", "none", "none", [], [], REG_DEFAULT),
  "scalpComfortTarget": sc("not_targeted", "high", "none", NOSC1.format(csa="MB met")),
 },
 primary={"target": "ordinary", "confidence": "moderate", "rationale": "S-ORDINARY way 1: no qualifying E2 claim unit; retailer copy only (dm-exclusive brand, but packet grades the source retailer), confidence moderate."},
 secondary=None,
 claims=[
  {"unit": "Shampoo für Locken und Wellen / Curly Girl Methode", "source": "retailer_dm_de", "grade": "low", "use": "texture (hair_texture), never a focus or fit input (T2)"},
  {"unit": "natürliches Volumen direkt am Ansatz", "source": "retailer_dm_de", "grade": "low", "use": "no candidate (low, no independent formula verdict)"},
  {"unit": "Mit Aloe Vera und Leinsamen-Extrakt / Aminosäuren-Komplex", "source": "retailer_dm_de", "grade": "low", "use": "maps to Aloe @2, Linum @8, amino acids; no conflict"},
  {"unit": "Ohne Silikone und Sulfattenside", "source": "retailer", "grade": "low", "use": "consistent with C6 formula"}],
 reconciliation=["focusPrimary: general unchanged (low -> moderate; neighbor volume).", "Other properties unchanged."],
 uncertainties=["Packet identityConfidence moderate.", "weightPotential low (moderate, neighbor moderate; weak reset) raises T4 on fine."]
)

json.dump(S, open("/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-a/out/_work/specs.json", "w"), ensure_ascii=False, indent=1)
print(len(S))
