import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from common import *
r,d=base('VT15')
r['formulaFacts']={
 'e3Point':{'position':14,'inci':'Fragrance/Parfum'},
 'surfactants':[
  {'inci':'Sodium Laureth Sulfate','position':2,'class':'strong anionic, ether/sulfonate type (defining anionic)','prominent':True},
  {'inci':'Coco-Glucoside','position':3,'class':'nonionic cleansing (buffer)','prominent':True},
  {'inci':'Cocamidopropyl Betaine','position':4,'class':'amphoteric (buffer)','prominent':True},
  {'inci':'Sorbitan Caprylate','position':10,'class':'not a cleansing route (sorbitan ester emulsifier/preservation booster; no C3 cleansing class)'}],
 'conditioningRoutes':{'payload_lipid':['Hydrogenated Vegetable Oil@7 (waxy)'],'weak_refatter':['Glyceryl Oleate@8'],'cationic_polymer':['Guar Hydroxypropyltrimonium Chloride@9'],'silicone':[],'pearlizing_fatty_route':[],'humectants':['Panthenol@11']},
 'actives':['Panthenol@11'],
 'scalpRelevant':{'e4ComfortRoutesProminent':['Panthenol@11'],'e4HumectantRefattingProminent':['Hydrogenated Vegetable Oil@7','Glyceryl Oleate@8','Panthenol@11'],'coolingAgents':[],'essentialOilsOrAllergens':['Citrus Aurantium Peel Oil@16','Citrus Limon (Lemon) Peel Oil@17','Hexyl Cinnamal@18','Limonene@19','Linalool@20 (all after the E3 point)'],'recognizedDandruffActives':[]},
 'preservatives':['Sodium Benzoate@13','Benzyl Alcohol@15'],'chelators':['Tetrasodium Glutamate Diacetate@12']}
r['wLine']={'wLine':{'position':11,'inci':'Panthenol','classes':['sub1_active']},
 'cap':{'e3Point':14},'alphabeticalRun':None,'skipped':[],'codes':[],
 'payloadLipidMaterial':['Hydrogenated Vegetable Oil@7'],'payloadLipidNonMaterial':[],
 'derivation':'Earliest candidate Panthenol@11 (class c): (i) Sodium Laureth Sulfate@2 before it; (ii) between 11 and the cap 14 only Tetrasodium Glutamate Diacetate and Sodium Benzoate -> plausible. No earlier candidate (Sorbitan Caprylate is not on the booster list). Longest ascending run is 6 entries, so no alphabetical run.'}
wt={'cationic_polymer':['Guar Hydroxypropyltrimonium Chloride@9'],'payload_lipid':['Hydrogenated Vegetable Oil@7 (material; waxy/hydrogenated, 6.4)'],'weak_refatter':['Glyceryl Oleate@8'],'silicone':[],'protein_film':[],'film_former':[],'cationic_conditioner':[],
 'reset':['Sodium Laureth Sulfate@2 (strong anionic, ether type)','Coco-Glucoside@3 (nonionic buffer)','Cocamidopropyl Betaine@4 (amphoteric buffer)'],
 'humectantContext':['Panthenol@11'],
 'excluded':['Sorbitan Caprylate@10 (emulsifier/booster, no deposition role)','Citrus Aurantium Peel Oil@16, Citrus Limon Peel Oil@17 (fragrance oils, 6.4)'],
 'unresolved':[]}
dp={}
dp['cleansingStrength']=prop('moderate','high','none',
 'moderate by C1: the defining anionic is Sodium Laureth Sulfate@2 (ether type), buffered by two prominent buffers (Coco-Glucoside@3, Cocamidopropyl Betaine@4) with no reinforcing strong anionic - the settled ether-sulfate-plus-buffer core.',
 ['C1','C3','C4','N-ALT'])
dp['conditioningLevel']=prop('moderate','moderate','high',
 'moderate: one meaningful conditioning system - cationic guar (Guar Hydroxypropyltrimonium Chloride@9) with a prominent waxy payload lipid (Hydrogenated Vegetable Oil@7) - plus light routes (Glyceryl Oleate@8, Panthenol@11). C2 is not met: the payload lipid can take the place of the silicone, but no separate pearlizing/fatty route (no glycol distearate, no fatty alcohol) is present. Counter-signal: if Glyceryl Oleate@8 were read as the fatty route, C2 would be met and support high; neighbor high.',
 ['C2','5','N-ALT'])
dp['weightPotential']=prop('moderate','moderate','high',
 'moderate: W-RICH is established (material waxy Hydrogenated Vegetable Oil@7, before the W-line Panthenol@11, converging with cationic guar@9), but reset is not limited - the C1 SLES/glucoside/betaine chassis gives moderate reset - so the rich route does not reach high; the other high route (multiple converging persistent systems not offset by reset) is not convincingly met with one guar, one lipid and a weak refatter. W-RICH is recorded as the counter-signal and high as the neighbor.',
 ['6.6','6.7','W-RICH','W-LINE','W2','N-ALT'],
 evidence=wt, depositionLoad='moderate', persistence='moderate', resetCapacity='moderate',
 counterevidence='W-RICH holds: a hydrogenated/waxy lipid is more substantive than a liquid oil and it sits early (7), directly next to the cationic guar (9).',
 whyThisBand='A plausibly persistent deposit (waxy lipid + cationic guar + glyceryl oleate) makes calling it lightweight an understatement, while an effective ordinary sulfate chassis with two buffers bounds the residue.',
 whyNotNeighborBand='high needs W-RICH plus limited (weak) reset, or multiple converging persistent systems that reset does not offset; reset here is moderate and the deposition is one guar plus one lipid, without silicone or film formers.',
 confidenceLimitingFactor='W-RICH is present and the balance between a waxy lipid deposit and moderate reset is an expert judgment; realistic unknowns (lipid level) could move it to high.')
dp['focusPrimary']=focus_prov('nonspecific',['Panthenol@11','Glyceryl Oleate@8','Hydrogenated Vegetable Oil@7'],[],['Guar Hydroxypropyltrimonium Chloride@9'],'Single humectant (Panthenol) and one lipid; no coherent humectant cluster and no damage-care cluster.','moisture','Generic light conditioning; a moisture claim would need a coherent humectant cluster, which is thin here.')
dp['focusSecondary']=secondary_prov(['moisture'])
dp['usageRole']=usage_prov('frequent','alternating impossible (not strong); treatment impossible (no active); frequent/occasional_reset remain claim-dependent.')
dp['scalpComfortTarget']=scalp_prov('CSA would pass - prominent comfort route Panthenol@11 and humectant/refatting routes Hydrogenated Vegetable Oil@7, Glyceryl Oleate@8, Panthenol@11.','Counter-signals: declared Fragrance@14, citrus peel oils and allergens after it.')
dp['dandruffSupport']=dandruff(None)
r['directProperties']=dp
r['unresolvedMaterialIngredients']=[]
r['provisionalNotes']=['focusPrimary, focusSecondary, usageRole and scalpComfortTarget are claim-dependent and provisional (formula-only).']
write('VT15',r)
