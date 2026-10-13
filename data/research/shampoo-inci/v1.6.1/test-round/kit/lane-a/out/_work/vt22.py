import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from common import *
r,d=base('VT22')
r['formulaFacts']={
 'e3Point':{'position':11,'inci':'Parfum'},
 'surfactants':[
  {'inci':'Sodium Laureth Sulfate','position':2,'class':'strong anionic, ether/sulfonate type (defining anionic)','prominent':True},
  {'inci':'Sodium Lauryl Sulfate','position':3,'class':'strong anionic, alkyl sulfate type (reinforcing route)','prominent':True},
  {'inci':'Sodium Xylenesulfonate','position':5,'class':'not a cleansing route (hydrotrope)','prominent':True},
  {'inci':'Cocamidopropyl Betaine','position':6,'class':'amphoteric (buffer)','prominent':True},
  {'inci':'TEA-Dodecylbenzenesulfonate','position':16,'class':'strong anionic, ether/sulfonate type - after the E3 point, recorded only (C4)','prominent':False},
  {'inci':'Trideceth-10','position':20,'class':'not a cleansing route (emulsifier)'}],
 'conditioningRoutes':{'silicone':['Dimethiconol@10','Dimethicone@13'],'cationic_polymer':['Guar Hydroxypropyltrimonium Chloride@15'],'pearlizing_fatty_route':['Glycol Distearate@7'],'humectants':['Panthenol@24','Panthenyl Ethyl Ether@25','Propylene Glycol@27 / Triethylene Glycol@31 (solvents)'],'payload_lipid':[],'cationic_conditioner':[]},
 'actives':['Piroctone Olamine@12','Panthenol@24','Niacinamide@30','Camellia Sinensis Leaf Extract@29'],
 'scalpRelevant':{'e4ComfortRoutesProminent':[],'e4HumectantRefattingProminent':[],'coolingAgents':[],'essentialOilsOrAllergens':['Hexyl Cinnamal@17','Linalool@21','Hydroxycitronellal@22','Geraniol@23','Citronellol@26','Benzyl Alcohol@32 (all after Parfum)'],'recognizedDandruffActives':['Piroctone Olamine@12']},
 'preservatives':['Sodium Benzoate@14','Benzyl Alcohol@32','Methylchloroisothiazolinone@33','Methylisothiazolinone@35','Piroctone Olamine@12 (capped active)']}
r['wLine']={'wLine':{'position':11,'inci':'Parfum','classes':['fragrance']},
 'cap':{'e3Point':11},'alphabeticalRun':None,'skipped':[],'codes':[],
 'payloadLipidMaterial':[],'payloadLipidNonMaterial':[],
 'derivation':'No class a/b/c candidate precedes the E3 marker Parfum@11 (Piroctone Olamine@12 and Sodium Benzoate@14 come after it); no alphabetical run (longest 3). The marker is a class a candidate: (i) SLES@2 before it; (ii) nothing between it and the cap -> W-line = cap = 11, no fallback code. The formula has no payload_lipid, so the W-line gates nothing.'}
wt={'cationic_polymer':['Guar Hydroxypropyltrimonium Chloride@15'],'payload_lipid':[],'weak_refatter':[],'silicone':['Dimethiconol@10','Dimethicone@13'],'protein_film':[],'film_former':[],'cationic_conditioner':[],
 'reset':['Sodium Laureth Sulfate@2 (strong, ether type)','Sodium Lauryl Sulfate@3 (strong, alkyl sulfate - reinforcing)','Cocamidopropyl Betaine@6 (buffer)','TEA-Dodecylbenzenesulfonate@16 (strong, non-prominent)'],
 'humectantContext':['Panthenol@24','Panthenyl Ethyl Ether@25','Propylene Glycol@27','Triethylene Glycol@31'],
 'excluded':['Glycol Distearate@7 (pearlizing wax, 6.4)','Sodium Xylenesulfonate@5 (hydrotrope)','Trideceth-10@20 (emulsifier)','Piroctone Olamine@12, Niacinamide@30 (actives)','Magnesium Nitrate@28, Magnesium Chloride@34 (isothiazolinone stabilizer salts)'],
 'unresolved':[]}
dp={}
dp['cleansingStrength']=prop('strong','high','none',
 'strong by C1: the defining anionic Sodium Laureth Sulfate@2 (ether type) is reinforced by a second prominent strong anionic, Sodium Lauryl Sulfate@3 (reinforcing route -> strong); Cocamidopropyl Betaine@6 buffers but cannot change the convention. TEA-Dodecylbenzenesulfonate@16 is after the E3 point and recorded only.',
 ['C1','C3','C4','N-ALT'])
dp['conditioningLevel']=prop('high','moderate','moderate',
 'high: C2 is met in a strong chassis (C2 says cleansing strength does not lower conditioning) - early (prominent) silicone Dimethiconol@10 (with Dimethicone@13), cationic polymer Guar Hydroxypropyltrimonium Chloride@15, pearlizing route Glycol Distearate@7 and the deliberate humectant Panthenol@24 (own entry). This is the holdout-v3 C2 pattern. Counter-signal: the guar, second silicone and Panthenol sit after Parfum@11 and Panthenol is near the end of the list; one silicone/guar coacervate system with a pearlizer is the core, so moderate is the realistic neighbor.',
 ['C2','E3','N-ALT'])
dp['weightPotential']=prop('moderate','moderate','high',
 'moderate: one meaningfully persistent system - silicone (Dimethiconol@10, Dimethicone@13) deposited with cationic guar (@15) - in a strong SLES+SLS chassis (resetCapacity strong). W1 does not apply (no late amodimethicone: the set is incomplete, so W1 is not cited as support). No payload lipid, so no W-RICH; the convergence route (silicone + cationic polymer) is offset by strong reset.',
 ['6.6','6.7','W1','W2','N-ALT'],
 evidence=wt, depositionLoad='moderate', persistence='moderate', resetCapacity='strong',
 counterevidence='Silicone + guar is a deliberate coacervate deposition system and two silicone types are present, which argues toward high.',
 whyThisBand='A silicone/guar deposition system plausibly leaves bounded residue (lightweight would understate it), while a reinforced strong sulfate chassis removes build-up and there is no lipid, quat, protein or film former converging.',
 whyNotNeighborBand='high needs W-RICH with weak reset or converging persistent systems not offset by reset; there is no lipid (no W-RICH), the deposition is a single silicone/guar system, and the reset is strong.',
 confidenceLimitingFactor='Silicone/guar deposition efficiency from INCI alone is uncertain; two silicones plus guar could be read as converging persistent systems (neighbor high).')
dp['focusPrimary']=focus_prov('nonspecific',['Panthenol@24','Panthenyl Ethyl Ether@25'],[],['Dimethiconol@10','Dimethicone@13','Guar Hydroxypropyltrimonium Chloride@15','Glycol Distearate@7'],'Generic silicone/guar conditioning; no protein or humectant cluster. Recognized anti-dandruff active Piroctone Olamine@12 makes scalp_active possible if a dandruff claim appears.','scalp_active','Formula-led route that could matter: recognized dandruff active Piroctone Olamine@12.')
dp['focusSecondary']=secondary_prov(['shine'])
dp['usageRole']=usage_prov('treatment','treatment becomes possible because dandruffSupport is supported (needs a qualifying E2 dandruff claim, U3); alternating possible with reset intent (strong formula); occasional_reset with D1.')
dp['scalpComfortTarget']=scalp_prov('CSA would fail - no prominent E4 comfort route and no prominent humectant/refatting route (Panthenol@24 and Niacinamide@30 are after Parfum@11).','Counter-signals: cleansingStrength strong; declared Parfum with allergens; MCI/MIT preservatives.')
dp['dandruffSupport']=dandruff('Piroctone Olamine@12')
r['directProperties']=dp
r['unresolvedMaterialIngredients']=[]
r['provisionalNotes']=['Formula source tier 4 and packet identity confidence moderate; packet states the formula is complete. Recorded as a limitation, no material conflict visible (ID-3).','focusPrimary, focusSecondary, usageRole and scalpComfortTarget are claim-dependent and provisional (formula-only).']
write('VT22',r)
