from final_lib import build, summary
from helpers import *
recs=[]
# ---------------- T315
recs.append(build("T315",{
 "identity":{"productName":"Schwarzkopf GLISS Shampoo Total Repair","brand":"Schwarzkopf GLISS (Henkel)","market":"DE","packSize":"250 ml","identityConfidence":"high"},
 "claims":[{"unit":"Total Repair (name)","source":"name","grade":"high","reading":"repair candidate"},
  {"unit":"Tiefenreparatur der Haare, reduziert Haarbruch und stärkt die Haarfaser","source":"manufacturer_de","grade":"moderate","reading":"repair; 'Tiefenreparatur' is not a D1 stem"},
  {"unit":"Flüssiges Keratin & Blütennektar ... macht es geschmeidig und glänzend","source":"manufacturer_de","grade":"moderate","reading":"'flüssiges Keratin' maps to Hydrolyzed Keratin (6); shine outcome"},
  {"unit":"Geeignet für: Trockenes, geschädigtes Haar","source":"manufacturer_de","grade":"moderate","reading":"lengths (not dry scalp)"}],
 "focusPrimary":F("repair","high","Repair named in the product name (high) and formula repair_supported (Hydrolyzed Keratin 6 within a Dimethicone 5 / Amodimethicone 12 / guar 13 deposition cluster) -> repair (F1).","none","Single protein; smoothing cluster also generic.",
   {"verdict":"repair_supported","repairRoutes":["Hydrolyzed Keratin 6","Amodimethicone 12","Dimethicone 5"],"sharedConditioningRoutes":["Guar Hydroxypropyltrimonium Chloride 13"],"moistureRoutes":["Glycerin 17 (late)"],"limitation":"Rinse-off; one protein."},"candidate",
   {"primary":{"claimDirection":"repair","formulaCompatible":True,"compatibleRoute":"Hydrolyzed Keratin 6 + silicone deposition","decisionReason":"name-led compatible repair"}},["reveal:name","reveal:manufacturer_de","formula"]),
 "focusSecondary":S([],"moderate","Shine ('geschmeidig und glänzend') is delivered by the same silicone smoothing/deposition route cited for repair (F2/F3); 'Blütennektar' is not a shine route; dry-hair wording has no moisture_supported route.",["shine"],"Shine is explicitly claimed.",{"emptyDefaultConsidered":True,"selected":[],"matchingClaims":["Glanz"],"independentRoutes":[],"whyNot":"F2 same route"},["reveal:manufacturer_de"]),
 "usageRole":U("regular","high","'Regelmäßig ... anwenden' is not U2 frequency wording; no other trigger.","none","-","none",[],[],["reveal:manufacturer_de"]),
 "scalpComfortTarget":SC("not_targeted","high","No sensitive/dry-scalp claim; CSA also fails (no prominent E4 route before Parfum 8).","none","-",["reveal:manufacturer_de","formula"]),
 "targets":{"primary":{"target":"ordinary","confidence":"high","rationale":"S-ORDINARY way 1: no qualifying E2 claim; manufacturer source -> high."},"secondary":None},
 "d1":D1F("'Tiefenreparatur' is a care term (13.6 Not D1)"),
 "changes":[{"property":"focusPrimary","blind":"repair (low)","final":"repair (high)","evidence":"name 'Total Repair'","reason":"compatible claim"},{"property":"scalpComfortTarget","blind":"not_targeted (moderate)","final":"not_targeted (high)","evidence":"no E2 unit","reason":"-"},{"property":"usageRole","blind":"regular (low)","final":"regular (high)","evidence":"-","reason":"-"},{"property":"focusSecondary","blind":"[] (low)","final":"[] (moderate)","evidence":"shine claim","reason":"F2"}],
 "uncertainties":[{"reading":"weightPotential moderate; W1 not citable because Hydrolyzed Keratin (6) is a prominent protein film (condition c fails).","alternative":"high (N-ALT neighbor)"}]}))
# ---------------- T316
recs.append(build("T316",{
 "identity":{"productName":"Syoss Intense Curls Locken Shampoo","brand":"Syoss","market":"DE","packSize":"440 ml","identityConfidence":"high"},
 "claims":[{"unit":"Locken Shampoo Intense Curls (name)","source":"name","grade":"high","reading":"curl pattern (hair_texture), no focus value; T2 never affects fit"},
  {"unit":"Tiefenpflegende Formel mit 3% Panthenol-Feuchtigkeits-Komplex, stärkt das Haar von innen.","source":"manufacturer_de","grade":"moderate","reading":"moisture + strengthening; 'Tiefenpflegend' not D1"},
  {"unit":"Spendet langanhaltende Feuchtigkeit / Nährt und sorgt für definierte Locken","source":"manufacturer_de","grade":"moderate","reading":"moisture candidate"},
  {"unit":"Reinigt sanft die Kopfhaut und welliges, lockiges Haar","source":"manufacturer_de","grade":"moderate","reading":"mildness"}],
 "focusPrimary":F("repair","moderate","Dominant claim is moisture, but the frozen care-direction verdict is repair_supported (Hydrolyzed Keratin 6 inside a dimethicone/amodimethicone/guar cluster; Panthenol 7 is a single humectant, not a coherent cluster), so moisture is not compatible (F1). The manufacturer strengthening claim ('stärkt das Haar von innen') is a compatible repair-direction candidate -> repair (dominant compatible job, 7.2).","moisture","Positioning is moisture-led; the repair claim is a minor strengthening line.",
   {"verdict":"repair_supported","repairRoutes":["Hydrolyzed Keratin 6","Amodimethicone 12"],"sharedConditioningRoutes":["Dimethicone 8","Guar Hydroxypropyltrimonium Chloride 13"],"moistureRoutes":["Panthenol 7"],"limitation":"Single humectant; single protein."},"candidate",
   {"primary":{"claimDirection":"moisture (dominant), strengthening (minor)","formulaCompatible":"repair yes, moisture no","compatibleRoute":"Hydrolyzed Keratin 6 + silicone deposition","decisionReason":"dominant claim incompatible; compatible claim used"}},["reveal:manufacturer_de","formula"]),
 "focusSecondary":S([],"moderate","Moisture fails the verdict (not moisture_supported/dual); curl definition is not a focus value.",["moisture"],"Moisture is the headline claim.",{"emptyDefaultConsidered":True,"selected":[],"matchingClaims":["Feuchtigkeit"],"independentRoutes":["Panthenol 7"],"whyNot":"verdict incompatible"},["reveal:manufacturer_de"]),
 "usageRole":U("regular","high","No trigger.","none","-","none",[],[],["reveal:manufacturer_de"]),
 "scalpComfortTarget":SC("not_targeted","high","No sensitive/dry-scalp claim ('Reinigt sanft die Kopfhaut' is mildness).","none","CSA formula half would pass (Panthenol 7).",["reveal:manufacturer_de"]),
 "targets":{"primary":{"target":"ordinary","confidence":"high","rationale":"S-ORDINARY way 1: no qualifying E2 claim; manufacturer source -> high."},"secondary":None},
 "d1":D1F("'Tiefenpflegende' is a care term (13.6 Not D1)"),
 "changes":[{"property":"focusPrimary","blind":"repair (low)","final":"repair (moderate)","evidence":"'stärkt das Haar von innen'","reason":"only compatible claim; moisture claim incompatible with repair_supported verdict"},{"property":"scalpComfortTarget","blind":"not_targeted (low)","final":"not_targeted (high)","evidence":"-","reason":"-"},{"property":"usageRole","blind":"regular (low)","final":"regular (high)","evidence":"-","reason":"-"},{"property":"focusSecondary","blind":"[] (low)","final":"[] (moderate)","evidence":"-","reason":"-"}],
 "uncertainties":[{"reading":"Frozen verdict repair_supported kept; 'stärkt das Haar von innen' treated as a repair-direction claim.","alternative":"dual_supported verdict (Panthenol 7 + PEG-7 Glyceryl Cocoate 5 + deposition) -> moisture primary via claim tie-breaker; or general if 'stärkt' is not a repair claim."},
                  {"reading":"'3% Panthenol' claim does not prove concentration (3.2).","alternative":"-"}]}))
# ---------------- T317
recs.append(build("T317",{
 "identity":{"productName":"LANGHAARMÄDCHEN Shampoo Lovely Long","brand":"Langhaarmädchen (dm own brand)","market":"DE","packSize":"300 ml","identityConfidence":"moderate"},
 "claims":[{"unit":"Kann Haarbruch reduzieren und das Haar reparieren / Stärkt das Haar bis in die Spitzen","source":"dm retailer (own brand, graded low in packet)","grade":"low","reading":"repair candidate (low)"},
  {"unit":"Haarwachstum zu stimulieren ... dichteres Haar / Wirkung: gegen Haarausfall","source":"dm retailer","grade":"low","reading":"hair growth/loss: out of scope (F5, S-HAIRLOSS)"},
  {"unit":"verleiht einen natürlichen Glanz","source":"dm retailer","grade":"low","reading":"shine (low)"},
  {"unit":"Das Shampoo pflegt zudem die Kopfhaut","source":"dm retailer","grade":"low","reading":"not an E2 state"}],
 "focusPrimary":F("repair","moderate","Only low-graded retailer claims. CL-SRC: a low claim may act as candidate when the formula independently supports the focus; the verdict dual_supported includes repair (Hydrolyzed Wheat Protein 6, quaternary conditioner 9, guar 8) and no moisture claim exists, so the repair claim is a candidate (not a tie-breaker between two claimed jobs); confidence capped at moderate. Hair-growth claims ignored (F5).","general","Low-grade source; dual verdict without a moderate-grade claim.",
   {"verdict":"dual_supported","repairRoutes":["Hydrolyzed Wheat Protein 6","Bis-(Isostearoyl/Oleoyl Isopropyl) Dimonium Methosulfate 9"],"moistureRoutes":["Glycerin 5","Argania Spinosa Kernel Oil 7"],"sharedConditioningRoutes":["Guar Hydroxypropyltrimonium Chloride 8"],"limitation":"Humectant side glycerin only."},"candidate",
   {"primary":{"claimDirection":"repair (breakage/strengthening); hair growth ignored","formulaCompatible":True,"compatibleRoute":"Hydrolyzed Wheat Protein 6 + quaternary conditioner 9","decisionReason":"low claim as candidate with formula support, capped moderate"}},["reveal:dm_retailer","formula"]),
 "focusSecondary":S([],"moderate","Shine claim is low-graded and has no independent route; no moisture claim.",["shine"],"-",{"emptyDefaultConsidered":True,"selected":[],"matchingClaims":["Glanz (low)"],"independentRoutes":[]},["reveal:dm_retailer"]),
 "usageRole":U("regular","high","No trigger; low-graded claims cannot fire triggers anyway.","none","-","none",[],[],["reveal:dm_retailer"]),
 "scalpComfortTarget":SC("not_targeted","high","No E2 sensitive/dry claim; all sources low.","none","-",["reveal:dm_retailer"]),
 "targets":{"primary":{"target":"ordinary","confidence":"moderate","rationale":"S-ORDINARY way 2: only scalp-adjacent positioning is hair loss/growth (S-HAIRLOSS, not evaluated); also no qualifying E2 unit with retailer-only copy (way 1 -> moderate)."},"secondary":None},
 "d1":D1F(),
 "notes":[{"code":"hair_loss_claim_not_evaluated","detail":"'Haarwachstum zu stimulieren', 'dichteres Haar', 'Wirkung: gegen Haarausfall' (dm, low)"}],
 "changes":[{"property":"focusPrimary","blind":"repair (low)","final":"repair (moderate)","evidence":"'Kann Haarbruch reduzieren und das Haar reparieren' (low)","reason":"CL-SRC candidate with formula support"},{"property":"scalpComfortTarget","blind":"not_targeted (low)","final":"not_targeted (high)","evidence":"-","reason":"-"},{"property":"usageRole","blind":"regular (low)","final":"regular (high)","evidence":"-","reason":"-"},{"property":"focusSecondary","blind":"[] (low)","final":"[] (moderate)","evidence":"-","reason":"-"}],
 "uncertainties":[{"reading":"Low-graded repair claim on a dual_supported verdict used as candidate.","alternative":"general (if picking repair over moisture counts as a tie-break, which a low claim cannot do)"},{"reading":"weightPotential moderate (close to W3 with four converging families).","alternative":"high"}]}))
# ---------------- T318
recs.append(build("T318",{
 "identity":{"productName":"Being Big Hair Shampoo (Volumen Shampoo)","brand":"Being","market":"DE","packSize":"354 ml","identityConfidence":"moderate"},
 "claims":[{"unit":"Big Hair / Volumen Shampoo (name)","source":"name","grade":"high","reading":"volume candidate"},
  {"unit":"Das Haar fühlt sich leicht und voluminös an. | für glattes oder feines Haar","source":"Rossmann retailer","grade":"low","reading":"volume; thickness claim never changes fit (T2)"},
  {"unit":"Wirkung: Klärend ... Volumen","source":"Hagel retailer","grade":"low","reading":"reset intent (low, cannot fire)"},
  {"unit":"Invigorating daily shampoo / thorough, clarifying wash","source":"US brand page (English)","grade":"low","reading":"foreign page (E1) low; cannot fire U2"}],
 "focusPrimary":F("volume","moderate","Volume named in the product name (high). Formula is compatible but not supportive: W-RICH (macadamia 8, avocado 9 + Polyquaternium-10 17, guar 18) gives conditioning high and weight moderate; recorded as trade-off (7.2 'positioned focus, route as trade-off').","general","Prominent oils and two cationic polymers counter a lift/body role.",{"verdict":"not_applicable","limitation":"Volume decision."},"candidate",
   {"primary":{"claimDirection":"volume","formulaCompatible":"yes with trade-off (weight moderate, not high)","compatibleRoute":"moderate C1 chassis; no silicone","decisionReason":"name-led positioning kept; counter-signal recorded"}},["reveal:name","formula"]),
 "focusSecondary":S([],"moderate","Clarifying/daily claims are low-graded; no secondary.",["clarifying"],"'Klärend' (low).",{"emptyDefaultConsidered":True,"selected":[],"matchingClaims":[],"independentRoutes":[]},["reveal:retailers"]),
 "usageRole":U("regular","high","Daily and clarifying wording is low-graded (retailer/foreign) and cannot fire triggers; cleansing moderate.","none","-","none",[],[],["reveal:retailers"]),
 "scalpComfortTarget":SC("not_targeted","high","No E2 sensitive/dry claim.","none","-",["reveal:retailers"]),
 "targets":{"primary":{"target":"ordinary","confidence":"moderate","rationale":"S-ORDINARY way 1: no qualifying E2 claim; packet has retailer/foreign copy only (no German manufacturer or pack source) -> moderate (13.8)."},"secondary":None},
 "d1":D1F("retailer/foreign wording cannot make D1 true"),
 "changes":[{"property":"focusPrimary","blind":"moisture (low)","final":"volume (moderate)","evidence":"name 'Big Hair (Volumen Shampoo)'","reason":"positioned focus with compatible-but-trade-off formula; moisture not positioned"},{"property":"focusSecondary","blind":"[] (low)","final":"[] (moderate)","evidence":"-","reason":"-"},{"property":"scalpComfortTarget","blind":"not_targeted (low)","final":"not_targeted (high)","evidence":"-","reason":"-"},{"property":"usageRole","blind":"regular (low)","final":"regular (high)","evidence":"-","reason":"-"}],
 "uncertainties":[{"reading":"Volume kept as focus despite conditioning high / weight moderate.","alternative":"general (formula judged incompatible with volume)"},{"reading":"'(Volumen Shampoo)' may be a retailer descriptor; 'Big Hair' in the brand product name carries the volume role either way.","alternative":"-"},{"reading":"conditioningLevel high via W-RICH although C2 not met (no pearlizer) and cationics are after Parfum.","alternative":"moderate"}]}))
for r in recs: print(summary(r))
