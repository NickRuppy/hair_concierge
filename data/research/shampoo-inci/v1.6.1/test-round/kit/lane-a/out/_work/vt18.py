import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from common import *
r,d=base('VT18')
r['formulaFacts']={
 'e3Point':{'position':17,'inci':'Fragrance (Parfum)'},
 'surfactants':[
  {'inci':'Sodium Coco-Sulfate','position':2,'class':'strong anionic, alkyl sulfate type (defining anionic)','prominent':True},
  {'inci':'Babassuamidopropyl Betaine','position':4,'class':'amphoteric (buffer)','prominent':True},
  {'inci':'Cocamidopropylamine Oxide','position':16,'class':'amphoteric, buffer only (C3b)','prominent':True}],
 'conditioningRoutes':{'payload_lipid':['Helianthus Annuus (Sunflower) Seed Oil@6'],'cationic_conditioner':['Stearamidopropyl Dimethylamine@10'],'cationic_polymer':['Polyquaternium-4@12'],'silicone':[],'pearlizing_fatty_route':[],'humectants':['Glycerin@3']},
 'actives':['Menthol@8','Camphor@9','Mentha Piperita (Peppermint) Oil@7','Rosmarinus Officinalis (Rosemary) Leaf Extract@5','Vinegar/Acetum/Vinaigre@13'],
 'scalpRelevant':{'e4ComfortRoutesProminent':[],'e4HumectantRefattingProminent':['Glycerin@3','Helianthus Annuus (Sunflower) Seed Oil@6'],'coolingAgents':['Mentha Piperita (Peppermint) Oil@7','Menthol@8','Camphor@9 (all prominent)'],'essentialOilsOrAllergens':['Mentha Piperita (Peppermint) Oil@7 (prominent)','Linalool@18','Limonene@19','Pinene@20','Carvone@21','Beta-Caryophyllene@22','Terpineol@23','Linalyl Acetate@24'],'recognizedDandruffActives':[]},
 'preservatives':['Benzoic Acid@25','Phenoxyethanol@26','Sodium Benzoate@27'],'chelators':['Sodium Gluconate@11']}
r['wLine']={'wLine':{'position':17,'inci':'Fragrance (Parfum)','classes':['fragrance']},
 'cap':{'e3Point':17},'alphabeticalRun':None,'skipped':[],'codes':[],
 'payloadLipidMaterial':['Helianthus Annuus (Sunflower) Seed Oil@6'],'payloadLipidNonMaterial':[],
 'derivation':'No class a/b/c candidate precedes the E3 marker (Menthol, Camphor and essential oils are not on the closed lists; Linalool/Limonene follow the cap); no alphabetical run. The marker Fragrance (Parfum)@17 is itself a class a candidate: (i) Sodium Coco-Sulfate@2 before it; (ii) nothing between it and the cap -> W-line = cap = 17, no fallback code.'}
wt={'cationic_polymer':['Polyquaternium-4@12'],'payload_lipid':['Helianthus Annuus (Sunflower) Seed Oil@6 (material, liquid oil)'],'weak_refatter':[],'silicone':[],'protein_film':[],'film_former':[],'cationic_conditioner':['Stearamidopropyl Dimethylamine@10'],
 'reset':['Sodium Coco-Sulfate@2 (strong anionic, alkyl sulfate)','Babassuamidopropyl Betaine@4 (amphoteric buffer)','Cocamidopropylamine Oxide@16 (C3b buffer only)'],
 'humectantContext':['Glycerin@3'],
 'excluded':['Mentha Piperita (Peppermint) Oil@7 (essential oil, 6.4)','Menthol@8, Camphor@9 (cooling/fragrance materials)','Rosmarinus Officinalis Leaf Extract@5 (botanical extract)','Vinegar@13, Citric Acid@15 (acids)','terpene allergens @18-24 (fragrance)'],
 'unresolved':[]}
dp={}
dp['cleansingStrength']=prop('moderate','moderate','strong',
 'moderate by C5: the defining anionic is Sodium Coco-Sulfate@2 (alkyl sulfate type) with two prominent buffers (Babassuamidopropyl Betaine@4, Cocamidopropylamine Oxide@16) and no reinforcing strong anionic. C3b: Cocamidopropylamine Oxide is the buffer that brings C5 down to moderate (with one buffer C5 yields strong), so confidence is at most moderate and the neighbor is strong.',
 ['C3','C3b','C4','C5','N-ALT'])
dp['conditioningLevel']=prop('moderate','moderate','low',
 'moderate: one meaningful system - the cationic conditioner Stearamidopropyl Dimethylamine@10 with Polyquaternium-4@12 - plus the prominent liquid oil Sunflower Seed Oil@6 and Glycerin@3. C2 is not met: no silicone (the oil may take its place) but no pearlizing/fatty route. Counter-signal: Polyquaternium-4 is a low-substantivity polymer and the chassis is cleansing-led (sulfate, essential oils, vinegar); low and high are not equally realistic - low is the realistic neighbor (and the lower value per N-ALT tie rule).',
 ['C2','5','N-ALT'])
dp['weightPotential']=prop('moderate','moderate','high',
 'moderate: W-RICH is established (material Sunflower Seed Oil@6, before the W-line Fragrance@17, converging with cationic deposition Stearamidopropyl Dimethylamine@10 / Polyquaternium-4@12), but the C5 sodium coco-sulfate chassis gives moderate reset, so the rich route does not reach high; the convergence route is not convincingly met because the routes are light (liquid oil, low-charge PQ-4). W-RICH recorded as counter-signal, high as neighbor.',
 ['6.6','6.7','W-RICH','W-LINE','W2','N-ALT'],
 evidence=wt, depositionLoad='moderate', persistence='moderate', resetCapacity='moderate',
 counterevidence='Three deposition families (payload_lipid, cationic_conditioner, cationic_polymer) and W-RICH are present; the amidoamine conditioner is a genuinely substantive cationic.',
 whyThisBand='An amidoamine conditioner plus a prominent oil plausibly leaves bounded residue (not lightweight), but an alkyl-sulfate chassis with buffers resets it and no silicone or waxy lipid is present.',
 whyNotNeighborBand='high needs W-RICH with weak reset or converging persistent systems that reset does not offset; reset is moderate (alkyl sulfate) and the converging routes are light (liquid oil, PQ-4).',
 confidenceLimitingFactor='W-RICH is formally present; the oil and amidoamine levels are unknown and could move the band to high.')
dp['focusPrimary']=focus_prov('nonspecific',['Glycerin@3','Helianthus Annuus (Sunflower) Seed Oil@6'],[],['Stearamidopropyl Dimethylamine@10','Polyquaternium-4@12'],'Light generic conditioning; the formula is cleansing- and cooling-led (peppermint, menthol, camphor, vinegar).','clarifying','Formula compatible with clarifying (F6: cleansing moderate, conditioning not high, weight not high) should an oily/reset claim appear.')
dp['focusSecondary']=secondary_prov(['clarifying'])
dp['usageRole']=usage_prov('frequent','alternating impossible while cleansingStrength is moderate; treatment impossible (no active).')
dp['scalpComfortTarget']=scalp_prov('CSA would pass only through the humectant/refatting list (Glycerin@3, Sunflower Seed Oil@6 prominent); no E4 comfort route.','Counter-signals: prominent cooling agents and essential oil (Peppermint Oil@7, Menthol@8, Camphor@9); declared Fragrance@17 with terpenes.')
dp['dandruffSupport']=dandruff(None)
r['directProperties']=dp
r['unresolvedMaterialIngredients']=[]
r['provisionalNotes']=['Packet identity confidence is moderate (formula complete, tier 2).','focusPrimary, focusSecondary, usageRole and scalpComfortTarget are claim-dependent and provisional (formula-only).']
write('VT18',r)
