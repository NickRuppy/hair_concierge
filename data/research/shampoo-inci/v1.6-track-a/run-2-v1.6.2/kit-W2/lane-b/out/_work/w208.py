import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W208','No synonym or split entries; normalized positions = packet positions (ID-2).','Parfum @21; prominent = positions 1-20 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Laureth Sulfate @2 (strong anionic, ether type)','reinforcingRoutes':[],'buffers':['Disodium Laureth Sulfosuccinate @5 (mild anionic)','Sodium Lauroyl Glutamate @7 (mild anionic)'],
   'notCleansing':['Laureth-2 @3 (low-ethoxylate thickener)','PEG-120 Methyl Glucose Dioleate @10 (PEG thickener)'],'c3aOrC3b':'none','note':'No amphoteric or glucoside; both buffers are mild anionics.'},
 'conditioningRoutes':{'cationic_polymer':['Polyquaternium-7 @13'],'protein_film':['Hydrolyzed Wheat Protein @17'],'payload_lipid':[],'silicone':[],'weak_refatter':[],'pearlizing':[]},
 'humectants':['Panthenol @4'],'actives':['Panthenol @4','Caffeine @9 (hair-loss-type ingredient; never a focus route, F5)','Zinc PCA @15 (not a recognized dandruff active)','Niacinamide @16'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @21, Hexyl Cinnamal @22, Limonene @23, Tetramethyl Acetyloctahydronaphthalenes @24, Linalool @25, Linalyl Acetate @27','coolingAgents':[],'essentialOils':['Citrus Aurantium Peel Oil @26 (after Parfum)']},
 'csa':{'listedComfortRoutesProminent':['Panthenol @4','Niacinamide @16'],'listedHumectantRefattingRoutesProminent':['Panthenol @4'],'mildBase':'no: prominent Sodium Laureth Sulfate @2','csaHolds':True},
 'preservativesAndOther':['Sodium Chloride @6','Propylene Glycol @8','Citric Acid @11','Sodium Citrate @12','Camellia Sinensis Leaf Extract @14','Potassium Sorbate @18','Sodium Benzoate @19','Phenoxyethanol @20']}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C1 - defining anionic Sodium Laureth Sulfate @2 with prominent mild-anionic buffers Disodium Laureth Sulfosuccinate @5 and Sodium Lauroyl Glutamate @7, no reinforcing route; Laureth-2 @3 is not a buffer.',['C1','C3','C4','E3']),
 'conditioningLevel':prop('low','moderate','moderate','Low: cleansing-led - the only conditioning polymer is the light Polyquaternium-7 @13 (after salt, acids and the PEG thickener), plus a late Hydrolyzed Wheat Protein @17 and humectant Panthenol @4. C2 not met. Neighbor moderate: PQ-7 plus protein and panthenol could be read as several light routes.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('low','moderate','moderate','Low: one light cationic polymer and a late protein against an effective C1 reset; no silicone, lipid or film former.',
   ev(cp=['Polyquaternium-7 @13'],pf=['Hydrolyzed Wheat Protein @17'],reset=['Sodium Laureth Sulfate @2','Disodium Laureth Sulfosuccinate @5','Sodium Lauroyl Glutamate @7'],hum=['Panthenol @4'],
      exc=['PEG-120 Methyl Glucose Dioleate @10 (PEG thickener, 6.4)','Laureth-2 @3','Caffeine @9, Zinc PCA @15, Niacinamide @16, Camellia Sinensis Leaf Extract @14 (actives/extracts)','Propylene Glycol @8 (solvent)']),
   wline(9,'Caffeine',['sub1_active'],{'e3Point':21},skipped=['w_line_skipped:Panthenol@4 (clause ii: Disodium Laureth Sulfosuccinate@5 and Sodium Lauroyl Glutamate@7 cleansing surfactants listed after it before the cap)']),
   'light','low','moderate',
   'Two families (cationic_polymer + protein_film, W2).',
   'Deposition is limited to one light polymer and a late hydrolyzed protein.',
   'Not moderate: both families are light/late - Polyquaternium-7 @13 is a single light polymer after salt and acids, the wheat protein @17 is after the W-line-region actives and just before the preservatives - and they face an SLES-led reset (W2 reason: a moderate reset faces only light, late routes).',
   'PQ-7 deposition at low dose; INCI-only.'),
 'focusPrimary':focus('nonspecific',['Panthenol @4'],['Hydrolyzed Wheat Protein @17'],['Polyquaternium-7 @13'],'Light routes; one protein token is not a repair cluster. Caffeine is out of scope (F5).','volume','a light, low-deposition architecture is most compatible with a body/volume role (caffeine/hair-loss positioning would be ignored, F5).'),
 'focusSecondary':secondary(['volume']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_holds('CSA holds via prominent listed comfort routes Panthenol @4 and Niacinamide @16; MB does not apply (prominent SLES @2).'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=[]
write(r)
