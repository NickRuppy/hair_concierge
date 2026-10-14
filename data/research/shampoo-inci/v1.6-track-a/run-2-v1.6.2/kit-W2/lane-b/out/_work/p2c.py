import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common2 import *
NT_none=lambda why: P('not_targeted','high','none','Not targeted: '+why,['10','SC1','CSA','E2','E2a','CL-SRC'],'none')
REG_HIGH=lambda why: us('regular','high','none','none',[],[],'Regular (default): '+why)
# ---------------- W213
build('W213','OGX','OGX Renewing + Argan Oil of Morocco Shampoo',
 'none (no strong anionic).','No listed C2 humectant.',
 fo('repair','moderate','general','repair_supported',[],['Amodimethicone @9','Argania Spinosa Kernel Oil @6','Hydrogenated Castor Oil @11'],['Guar HPTC @10','Glycol Distearate @14'],'Rinse-off; no humectant cluster.','candidate',
   'All claims are retailer copy (low), which caps focus at moderate; moisture claims compete but the verdict is not moisture_supported.',
   'Claim directions: repair ("repariert trockenes & geschädigtes Haar", "regenerierend", "kräftigt und nährt", dm/Rossmann retailer, low) and moisture ("Feuchtigkeit", low). Formula verdict repair_supported independently, so the low repair claim may act as candidate (CL-SRC); moisture has no supporting verdict. Decision: repair, capped at moderate.',
   'Repair: the repair_supported verdict (argan, hydrogenated castor oil, amodimethicone, guar) independently supports the low-graded repair claim (CL-SRC, F1); confidence capped at moderate.',['7.2','7.3','F1','CL-SRC','N-ALT']),
 sec([],'moderate',['moisture'],'Empty default considered. Moisture is retailer-only (low) and has no moisture_supported verdict; shine shares the same lipid/silicone route (F2).','Empty.'),
 REG_HIGH('no trigger wording in any source; all sources low anyway.'),
 NT_none('no scalp claim; CSA would hold (MB and prominent lipids).'),
 tgt('ordinary','moderate','S-ORDINARY way 1: no qualifying E2 claim; retailer copy only -> moderate (13.8).'),None,[],False,
 reconc=['focusPrimary general (provisional, neighbor repair) -> repair (moderate).','usageRole regular (low) -> regular (high); scalpComfortTarget not_targeted (low) -> not_targeted (high).','No formula-derived property changed.'],
 unc=['Weight high (W-RICH + weak reset) for a sulfate-free argan shampoo: the alternative moderate would need the mild C6 chassis read as effective reset; neighbor moderate recorded.','Fine is not_suited (no row) for the ordinary target; T4 raises no flag because the neighbor only lifts tiers.','Two unresolved minor ingredients (potato starch dodecenylsuccinate @7, disodium tetrapropenyl succinate @13) cannot lighten the band.','Rows amber in the normal bucket: intensity gentle vs expected regular (I2).'])
# ---------------- W214
build('W214','Pantene','Pantene Pro-V Volumen Pur Shampoo',
 'none.','none.',
 fo('volume','moderate','general','not_applicable',[],[],[],'No conditioning routes; volume is claim-led over a compatible light formula.','candidate',
   'No formula route specific to lift; compatibility only (low weight, low conditioning).',
   'Claim direction volume (product name "Volumen Pur", high; retailer copy low). Formula compatible: weightPotential low, conditioningLevel low. Decision: volume.',
   'Volume: the product name names volume (high) and the light formula is compatible (7.1, 7.2).',['7.1','7.2','CL-SRC','N-ALT']),
 sec([],'high','none','Empty default considered; strengthening/shine claims are retailer-only (low).','Empty.'),
 REG_HIGH('"Für die tägliche Haarwäsche geeignet" is Müller retailer copy (low) and cannot fire frequent (CL-SRC).'),
 NT_none('no scalp claim; CSA fails anyway.'),
 tgt('ordinary','moderate','S-ORDINARY way 1: no qualifying E2 claim; retailer copy only -> moderate (13.8).'),None,[],False,
 reconc=['focusPrimary general (provisional, neighbor clarifying) -> volume (moderate): name claim.','usageRole regular (low) -> regular (high).','No formula-derived property changed.'],
 unc=['Usage: daily-use wording is low-graded only; if a moderate source carried it, usage would be frequent.'])
# ---------------- W215
build('W215','Balea Professional','Balea Professional Shampoo Ultimate Volume, 250 ml',
 'none.','Single guar plus protein.',
 fo('volume','moderate','general','nonspecific',['Glycerin @9'],['Hydrolyzed Wheat Protein @6'],['Guar HPTC @10'],'Light routes; compatible with volume.','candidate',
   'Biotin strengthening wording is not a focus route; no specific lift route beyond the light architecture.',
   'Claim direction volume (name "Ultimate Volume", high; "Volumen Shampoo", "Anti-Platt-Effekt", dm own brand, moderate). Formula compatible (weight low, conditioning moderate). Decision: volume.',
   'Volume: name and manufacturer positioning (high/moderate) with a compatible light formula (7.1, 7.2).',['7.1','7.2','CL-SRC','N-ALT']),
 sec([],'moderate',['repair'],'Empty default considered. "Kräftigt die Haarstruktur" shares the protein route and has no repair_supported verdict.','Empty.'),
 REG_HIGH('no frequency/reset wording; reverse-washing directions are not a trigger.'),
 NT_none('no scalp claim; CSA holds via Glycerin @9 only.'),
 tgt('ordinary','high','S-ORDINARY way 1: no qualifying E2 claim; dm own-brand manufacturer source -> high (13.8).'),None,[],False,
 reconc=['focusPrimary general (provisional, neighbor volume) -> volume (moderate).','usageRole regular (low) -> regular (high).','No formula-derived property changed.'],
 unc=['Packet notes the product is delisted at dm and replaced in the catalog by another product; identity left as frozen - catalog consequence is for the orchestrator.'])
# ---------------- W216
build('W216','ISANA (Rossmann-Eigenmarke)','ISANA MED Ultra Sensitiv+ Anti-Schuppen Shampoo, 200 ml',
 'none.','Single guar with weak refatters.',
 fo('scalp_active','high','none','nonspecific',['Panthenol @8'],[],['HPG-HPTC @11'],'Scalp role only.','candidate',
   '"Sensitiv" in the name does not name the scalp; tolerance claims are protective wording.',
   'Claim direction anti-dandruff (name "Anti-Schuppen", high; "stark in der Wirkung gegen Schuppen", pack back/manufacturer moderate). Formula: Piroctone Olamine @5. Decision: scalp_active.',
   'Scalp_active: problem-led anti-dandruff product with a recognized active (7.2).',['7.1','7.2','S-DANDRUFF']),
 sec([],'high','none','Empty default considered; no lengths-care positioning.','Empty.'),
 us('treatment','high','none','recognized_active_problem_led',['Piroctone Olamine @5','"Anti-Schuppen" in the product name (high); "stark & nachhaltig gegen Schuppen" (manufacturer, moderate)'],[],
   'Treatment: recognized active plus a qualifying dandruff claim (U3).'),
 P('not_targeted','high','none','Not targeted: no SC1 unit - "sanft zur Kopfhaut" is sparing wording, "sehr sensibler Haut" does not name the scalp, "Allergie getestet"/"dermatologisch bestätigt" are protective (E2a), and "Sensitiv+" in the name is a non-scalp name word (F7). CSA would hold (Panthenol @8, Niacinamide @9, Bisabolol @10).',['10','SC1','E2a','F7'],'Fragrance-free, comfort routes prominent (supportive only).'),
 tgt('dandruff','high','S-DANDRUFF passes: dandruff claim in the product name (high) and on the pack back (moderate); dandruffSupport supported (Piroctone Olamine @5). Primary (R17.1); no secondary (R17.2).'),None,[],False,
 reconc=['focusPrimary general (provisional, neighbor scalp_active) -> scalp_active (high).','usageRole regular (low) -> treatment (high).','scalpComfortTarget not_targeted (low) -> not_targeted (high): no comfort wording beyond sparing/tolerance wording, so no research combination.','No formula-derived property changed.'],
 unc=['"Ultra sensitiv Produkte ... sehr sensibler Haut abgestimmt" read as skin tolerance (does not name the scalp), so no sensitive combination value; alternative reading would add researchCombinationTargets ["sensitive"] (S-SENSITIVE gate passes) without changing any projected field.','Pack-back photo partly cut off at the right edge (packet note).'])
# ---------------- W217
build('W217','Balea','Balea PROFESSIONAL Shampoo Aqua Hyaluron',
 'Coco-Glucoside @8 is after E3.','All conditioning post-E3.',
 fo('general','moderate','moisture','nonspecific',['Sodium Hyaluronate @13'],[],['HPG-HPTC @10','Glyceryl Oleate @9'],'One late humectant; not a moisture cluster.','not_applicable',
   'A clear moisture claim exists (manufacturer, moderate) but the formula verdict is nonspecific, so the claim cannot set the focus (F1).',
   'Claim direction moisture ("Feuchtigkeitsspendendes Shampoo", "Für trockenes & feuchtigkeitsbedürftiges Haar", dm own brand, moderate). Formula verdict nonspecific (Sodium Hyaluronate @13 and aloe powder @11 after Parfum, light guar/refatters). F1: generic moisture language over a nonspecific formula stays general.',
   'General: moisture claim over a nonspecific formula (F1, 3.2: claims cannot turn nonspecific evidence into a specialist focus).',['7.2','7.3','F1','3.2','N-ALT']),
 sec([],'high','none','Empty default considered; no secondary positioning.','Empty.'),
 REG_HIGH('no trigger wording.'),
 NT_none('no sensitive/dry-scalp claim ("die Kopfhaut geschont" is sparing wording, E2a); CSA fails anyway.'),
 tgt('ordinary','high','S-ORDINARY way 1: no qualifying E2 claim; manufacturer (dm own brand) source present -> high (13.8).'),None,[],False,
 reconc=['focusPrimary general (low) -> general (moderate, neighbor moisture): moisture claim rejected by F1.','usageRole regular (low) -> regular (high).','No formula-derived property changed.'],
 unc=['Moisture verdict nonspecific vs moisture_supported: only one listed humectant (Sodium Hyaluronate @13), late; if read as moisture_supported the focus would be moisture (moderate).'])
# ---------------- W218
build('W218','Langhaarmädchen','LANGHAARMÄDCHEN Shampoo Beautiful Curls',
 'none.','All conditioning post-E3.',
 fo('general','moderate','volume','nonspecific',['Glycerin @10','PCA @12','Sodium PCA @20'],[],['HPG-HPTC @17'],'Late light routes.','not_applicable',
   'Curl, bounce and root-volume wording exists but only in retailer copy (low) over a nonspecific formula.',
   'Claim directions: curls/bounce/shine/root volume (dm retailer, low). Low claims need independent formula support (CL-SRC); verdict nonspecific; curl pattern is texture, not a focus. Decision: general.',
   'General: only low-graded claims over a nonspecific formula (CL-SRC, 7.2).',['7.2','CL-SRC','N-ALT']),
 sec([],'high','none','Empty default considered; no claim above low.','Empty.'),
 REG_HIGH('no trigger wording; all sources low.'),
 NT_none('no scalp claim ("reinigt schonend" is mildness); CSA would hold via MB.'),
 tgt('ordinary','moderate','S-ORDINARY way 1: no qualifying E2 claim; retailer copy only -> moderate (13.8).'),None,[],False,
 reconc=['focusPrimary general (provisional, neighbor moisture) -> general (moderate, neighbor volume).','usageRole regular (low) -> regular (high); scalpComfortTarget not_targeted (low) -> not_targeted (high).','No formula-derived property changed.'],
 unc=['Rows amber in the normal bucket: intensity gentle vs expected regular (I2).','dm-exclusive brand copy is labelled retailer (low) in the packet and graded as given.'])
