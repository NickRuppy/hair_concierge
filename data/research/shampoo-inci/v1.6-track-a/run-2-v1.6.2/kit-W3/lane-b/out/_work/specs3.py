import sys; sys.path.insert(0, "/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W3/lane-b/out/_work")
from common import *
SPECS = {}

SPECS["W313"] = dict(
 brand="Wahre Schätze (Garnier)", name="Garnier Wahre Schätze Beruhigendes Shampoo Sanfte Hafermilch",
 cs=CS_C1,
 focusPrimary=focus("scalp_active", "moderate", "moisture", "moisture_supported",
   ["Glycerin @5", "Glycine Soja Oil @6", "Aloe Barbadensis Leaf Juice @7", "Dicaprylyl Ether @13"], [],
   ["Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @19", "Polyquaternium-7 @22"],
   "Verdict applies to the competing lengths-moisture claim.", "candidate",
   "A lengths-moisture claim ('spendet Feuchtigkeit und sorgt für geschmeidiges Haar') competes; moderate is the neighbor.",
   "Claims: sensitive scalp ('wirkt beruhigend auf die juckende Kopfhaut', 'Erleichterung bei juckender Kopfhaut', manufacturer, moderate) and lengths moisture ('spendet Feuchtigkeit', moderate). F7: product-name word 'Beruhigendes' does not name the scalp and is ignored; neither role is in the name -> scalp_active primary because it is formula-compatible (scalpComfortTarget targeted via Avena Sativa Kernel Extract @8). Moisture becomes secondary (F7 step 3).",
   "scalp_active (F7 step 2) with moisture as secondary.", ["F7", "7.2", "SC1", "CSA"]),
 focusSecondary=sec(["moisture"], "moderate", [], "Empty default considered. Distinct claim 'spendet Feuchtigkeit und sorgt für geschmeidiges Haar' (manufacturer, moderate); independent route Glycerin @5, Glycine Soja Oil @6, Dicaprylyl Ether @13, cationics @19/@22 (verdict moisture_supported), not cited by the primary route (Avena Sativa Kernel Extract @8).", "Moisture secondary per F7 step 3 and Section 8."),
 usageRole=usage("regular", "high", "none", "none", [], [], "No frequency wording."),
 scalpComfortTarget=scalp("targeted", "high", "none", "Targeted: SC1 ('Das Shampoo wirkt beruhigend auf die juckende Kopfhaut', manufacturer, moderate) and CSA via prominent comfort route Avena Sativa Kernel Extract @8 plus humectant/refatting routes Glycerin @5, Glycine Soja Oil @6. No cooling agent or essential oil."),
 primary=tgt("sensitive", "moderate", "S-SENSITIVE: positioning moderate (manufacturer); formula targeted + prominent comfort route Avena Sativa Kernel Extract @8. Cleansing moderate -> no strong flag. No dry-scalp claim."),
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> scalp_active (F7).", "focusSecondary [] -> [moisture].", "scalpComfortTarget provisional not_targeted -> targeted.", "Direct formula properties unchanged."],
 unc=["F7: 'Beruhigendes' in the name ignored as a non-scalp name word; if read as naming the sensitive role the outcome is the same.", "Secondary moisture vs []: chosen because the route is independent of the oat comfort route.", "'eignet sich ideal für ... sensible Kopfhaut' could be tolerance wording; not needed (itch units qualify)."]
)

SPECS["W314"] = dict(
 brand="Balea PROFESSIONAL (dm)", name="Balea PROFESSIONAL Shampoo Kopfhaut Sensitive",
 idNotes="dm own-brand page treated as manufacturer_de (moderate) per packet.",
 cs=CS_C1,
 focusPrimary=focus("scalp_active", "high", "none", "not_applicable", [], [], [], "Scalp-led.", "candidate",
   "SLES chassis; a shine claim ('seidigen Glanz') competes weakly.",
   "Claim direction sensitive scalp (name 'Kopfhaut Sensitive', high; 'Beruhigendes Shampoo für empfindliche Kopfhaut', 'Kann Juckreiz und Spannungsgefühle mildern', moderate). Formula compatible: targeted (Allantoin @8, Bisabolol @9, Panthenol @11). Decision scalp_active.",
   "scalp_active: name-level sensitive-scalp positioning + targeted formula.", ["7.2", "SC1", "CSA"]),
 focusSecondary=sec([], "moderate", ["shine"], "Empty default considered. 'erhält einen seidigen Glanz' is positioned, but no independent shine route (guar @14 / Glycol Distearate @16 are generic conditioning; F2, F3).", "Empty."),
 usageRole=usage("regular", "high", "none", "none", [], [], "No frequency wording."),
 scalpComfortTarget=scalp("targeted", "high", "none", "Targeted: SC1 (name, high; manufacturer units) and CSA via prominent comfort routes Allantoin @8, Bisabolol @9, Panthenol @11 and humectant Glycerin @5. No prominent cooling agent or essential oil."),
 primary=tgt("sensitive", "high", "S-SENSITIVE: name 'Kopfhaut Sensitive' (high); formula targeted + prominent comfort routes. S-PRIMARY: name."),
 secondary=tgt("dry", "moderate", "S-DRY: unit 'speziell für die Bedürfnisse von sensibler und trockener Kopfhaut entwickelt' (moderate) plus tension wording; formula targeted + prominent humectant routes Glycerin @5, Panthenol @11."),
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> scalp_active.", "scalpComfortTarget provisional not_targeted -> targeted.", "Direct formula properties unchanged."],
 unc=["Shine secondary rejected for lack of an independent route.", "Zinc PCA @10 present without an oily claim (no oily target)."]
)

SPECS["W315"] = dict(
 brand="Schwarzkopf GLISS (Henkel)", name="Schwarzkopf GLISS Shampoo Total Repair, 250 ml",
 cs=CS_C1,
 focusPrimary=focus("repair", "high", "none", "repair_supported", ["Glycerin @17"],
   ["Hydrolyzed Keratin @6", "Dimethicone @5", "Amodimethicone @12", "Guar Hydroxypropyltrimonium Chloride @13"],
   ["PEG-7 Glyceryl Cocoate @10", "Glycol Distearate @14"],
   "Rinse-off; keratin is a weakly retained film.", "candidate",
   "'Für trockenes ... Haar' moisture wording competes; no humectant cluster (Glycerin @17 late).",
   "Claim direction repair (name 'Total Repair', high; 'Tiefenreparatur', 'reduziert Haarbruch', moderate). Formula repair_supported. Decision repair.",
   "Repair: name-level repair positioning on a repair_supported formula.", ["7.2", "7.3", "F1"]),
 focusSecondary=sec([], "high", "none", "Empty default considered. 'geschmeidig und glänzend' is delivered by the same silicone/deposition route as repair (F2/F3) -> no shine secondary.", "Empty."),
 usageRole=usage("regular", "high", "none", "none", [], [], "'Regelmäßig ... anwenden' is not U2 frequency wording."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "No scalp claim; CSA fails anyway."),
 primary=tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present."),
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false ('Tiefenreparatur' is not a D1 stem); not_flagged.",
 recon=["focusPrimary provisional general -> repair.", "usageRole regular confirmed.", "Direct formula properties unchanged."],
 unc=["W1 not cited (prominent keratin may be a reinforcing protein film); band moderate either way.", "conditioningLevel high (C2) and weight moderate with neighbor high -> T4 flags on all thicknesses."]
)

SPECS["W316"] = dict(
 brand="Syoss", name="Syoss Intense Curls Locken Shampoo",
 cs=CS_C1,
 focusPrimary=focus("general", "moderate", "moisture", "repair_supported", ["Panthenol @7"],
   ["Hydrolyzed Keratin @6", "Dimethicone @8", "Amodimethicone @12", "Guar Hydroxypropyltrimonium Chloride @13"],
   ["PEG-7 Glyceryl Cocoate @5", "Glycol Distearate @16"],
   "Single humectant (Panthenol @7) is not a humectant cluster; '3 % Panthenol' cannot be proven by a claim (3.2).", "not_applicable",
   "Strong deposition/protein route without matching repair positioning; 'stärkt das Haar von innen' is a weak strength claim.",
   "Claim direction moisture ('Spendet langanhaltende Feuchtigkeit', '3% Panthenol-Feuchtigkeits-Komplex', manufacturer, moderate); curl definition is texture (T2), not a focus. Formula verdict repair_supported, not moisture_supported or dual -> moisture incompatible (F1). 'stärkt das Haar von innen' is not damage/breakage positioning. Decision general; formula route recorded as trade-off.",
   "General: moisture claim over a repair_supported (not moisture) formula.", ["7.2", "7.3", "F1", "T2"]),
 focusSecondary=sec([], "high", "none", "Empty default considered.", "Empty."),
 usageRole=usage("regular", "high", "none", "none", [], [], "No frequency wording; 'Tiefenpflege'/'Tiefenspülung' are not D1."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "No scalp-state claim ('Reinigt sanft die Kopfhaut' is mildness)."),
 primary=tgt("ordinary", "high", "S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present."),
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false ('Tiefenpflegende' shares a prefix but is not D1); not_flagged.",
 recon=["focusPrimary provisional general -> general (moisture claim incompatible with repair_supported verdict).", "Direct formula properties unchanged."],
 unc=["Verdict could be read dual_supported (Panthenol + PEG-7 Glyceryl Cocoate + silicones) -> focus moisture; kept repair_supported (single humectant).", "Curl/texture positioning never changes fit (T2)."]
)

SPECS["W317"] = dict(
 brand="Langhaarmädchen (dm)", name="LANGHAARMÄDCHEN Shampoo Lovely Long, 300 ml",
 idNotes="Only retailer (dm own-brand page, graded low) sources; identity confidence moderate.",
 cs=CS_C1,
 focusPrimary=focus("general", "moderate", "repair", "dual_supported", ["Glycerin @5", "Argania Spinosa Kernel Oil @7"],
   ["Hydrolyzed Wheat Protein @6", "Guar Hydroxypropyltrimonium Chloride @8", "Bis-(Isostearoyl/Oleoyl Isopropyl) Dimonium Methosulfate @9"],
   ["Glycol Distearate @15", "Hydrogenated Castor Oil @16"],
   "Dual verdict needs a tie-breaker.", "not_applicable",
   "Repair-type claims ('Kann Haarbruch reduzieren und das Haar reparieren') exist but are retailer-graded low.",
   "Claims: hair growth/density/'gegen Haarausfall' (out of scope, F5) and breakage/repair (dm own-brand retailer copy, low). Formula verdict dual_supported; choosing repair from a dual verdict is a tie-break, which a low-graded claim can never do (CL-SRC). Decision general.",
   "General: only low-graded repair claims over a dual_supported verdict; hair-growth claims ignored (F5).", ["F5", "CL-SRC", "7.3", "F1"]),
 focusSecondary=sec([], "high", "none", "Empty default considered.", "Empty."),
 usageRole=usage("regular", "high", "none", "none", [], [], "All sources low; no trigger can fire."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "No sensitive/dry scalp claim ('pflegt zudem die Kopfhaut' is generic)."),
 primary=tgt("ordinary", "moderate", "S-ORDINARY way 2 (only scalp-adjacent positioning is hair growth/'gegen Haarausfall', S-HAIRLOSS) and way 1 with retailer-only sources -> moderate."),
 notes=["hair_loss_claim_not_evaluated: 'Haarwachstum zu stimulieren', 'dichteres Haar', 'Wirkung: gegen Haarausfall' (dm, low)"],
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> general.", "Direct formula properties unchanged."],
 unc=["If the low repair claim were allowed as a candidate on dual_supported, focus would be repair (confidence capped moderate).", "Weight moderate with four converging families and W-RICH under moderate reset; neighbor high."]
)

SPECS["W318"] = dict(
 brand="Being (ZURU)", name="Being Big Hair Shampoo (Volumen Shampoo), 354 ml",
 idNotes="Retailer-only German sources plus a US manufacturer page (manufacturer_foreign, low); identity confidence moderate.",
 cs={"cleansingStrength": "Mild isethionate and sulfosuccinate co-surfactants argue milder; C1 convention unchanged.", "conditioningLevel": "See rationale.", "weightPotential": "See counterevidence.", "dandruffSupport": "None."},
 focusPrimary=focus("general", "moderate", "volume", "moisture_supported", ["Glycerin @6", "Macadamia Integrifolia Seed Oil @8", "Persea Gratissima Oil @9"], [], ["Polyquaternium-10 @17", "Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @18"],
   "Not relevant to the volume claim.", "not_applicable",
   "Volume positioning exists but only in low-graded sources, and the formula (conditioning high, W-RICH) gives no independent volume route.",
   "Claim direction volume ('Volumen Shampoo', 'leicht und voluminös', Rossmann/Hagel retailer low; US page low). A low-graded claim may be a candidate only when the formula independently supports that focus; no volume route (rich lipid + cationic architecture). Decision general.",
   "General: volume claims are low-graded and formula-unsupported.", ["CL-SRC", "7.2", "T2"]),
 focusSecondary=sec([], "high", "none", "Empty default considered.", "Empty."),
 usageRole=usage("regular", "high", "none", "none", [], [], "'Invigorating daily shampoo' (foreign page, low) and 'Klärend' (Hagel, low) cannot fire triggers."),
 scalpComfortTarget=scalp("not_targeted", "high", "none", "No scalp claim."),
 primary=tgt("ordinary", "moderate", "S-ORDINARY way 1 with retailer-only (and foreign low) sources -> moderate."),
 d1=False, d1Conf="high", dclConf="high", dclWhy="D1 false; not_flagged.",
 recon=["focusPrimary provisional general -> general.", "Direct formula properties unchanged. 'für glattes oder feines Haar' and 'doesn't weigh hair down' never change weight or fit (T2, 6.5)."],
 unc=["conditioningLevel high via W-RICH (E3) for Section 5 without C2; alternative moderate (neighbor).", "ordinary confidence moderate (no German manufacturer/pack source)."]
)
