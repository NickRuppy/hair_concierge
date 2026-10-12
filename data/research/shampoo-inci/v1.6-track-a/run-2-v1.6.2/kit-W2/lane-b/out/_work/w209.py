import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W209','Aqua (Water), Maris Sal (Sea Salt), Parfum (Fragrance) are single entries (ID-2); markers * (Aloe) and ** (Parfum, Linalool, Benzyl Salicylate, Vanillin) stripped and kept as provenance; normalized positions = packet positions.','Parfum (Fragrance) @22; prominent = positions 1-21 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Coco-Sulfate @2 (strong anionic, alkyl sulfate type)','reinforcingRoutes':[],
   'buffers':['Lauryl Glucoside @3 (nonionic glucoside)','Coco-Glucoside @4 (nonionic glucoside)','Disodium Cocoyl Glutamate @8 (mild anionic)','Sodium Cocoyl Glutamate @11 (mild anionic)'],'notCleansing':['Maris Sal @5','Sodium Chloride @18'],'c3aOrC3b':'none (Sodium Coco-Sulfate is never C3a)'},
 'conditioningRoutes':{'protein_film':['Hydrolyzed Corn Protein @13','Hydrolyzed Wheat Protein @14','Hydrolyzed Soy Protein @15'],'cationic_conditioner':['PCA Ethyl Cocoyl Arginate @19 (cationic arginine ester, conditioning/antimicrobial)'],'cationic_polymer':[],'silicone':[],'payload_lipid':[],'weak_refatter':[],'pearlizing':[]},
 'humectants':[],'actives':['Arginine @10','Lactococcus Ferment Lysate @9','Leuconostoc/Radish Root Ferment Filtrate @16'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @22, Linalool @23, Benzyl Salicylate @24, Vanillin @25','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':[],'listedHumectantRefattingRoutesProminent':[],'mildBase':'no: prominent Sodium Coco-Sulfate @2 (alkyl sulfate) excludes MB','csaHolds':False,
   'unlistedRouteCandidates':['unlisted_route_candidate:Aloe Barbadensis Leaf Juice (@6, rejected by R18)','unlisted_route_candidate:Lactococcus Ferment Lysate (@9, rejected by R18)','unlisted_route_candidate:Arginine (@10, rejected by R18)']},
 'preservativesAndOther':['Citric Acid @7','Phytic Acid @12 (chelator)','Lactic Acid @17','Potassium Sorbate @20','Sodium Benzoate @21']}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C5 - defining anionic Sodium Coco-Sulfate @2 (alkyl sulfate type) with four prominent buffers (Lauryl Glucoside @3, Coco-Glucoside @4, Disodium Cocoyl Glutamate @8, Sodium Cocoyl Glutamate @11) and no reinforcing route; C5 needs at least two.',['C5','C3','C4','E3']),
 'conditioningLevel':prop('low','moderate','moderate','Low: cleansing-led architecture - no cationic polymer, silicone, payload lipid or pearlizer; only three hydrolyzed proteins (@13-15) and a late cationic arginine ester (@19). C2 not met. Neighbor moderate: the protein trio plus the cationic ester could be read as several light routes.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('low','moderate','moderate','Low: deposition is limited to water-soluble hydrolyzed proteins and a trace cationic arginine ester against a C5 sulfate/glucoside/glutamate reset.',
   ev(pf=['Hydrolyzed Corn Protein @13','Hydrolyzed Wheat Protein @14','Hydrolyzed Soy Protein @15'],cc=['PCA Ethyl Cocoyl Arginate @19'],
      reset=['Sodium Coco-Sulfate @2','Lauryl Glucoside @3','Coco-Glucoside @4','Disodium Cocoyl Glutamate @8','Sodium Cocoyl Glutamate @11'],hum=[],
      exc=['Aloe Barbadensis Leaf Juice @6, Lactococcus Ferment Lysate @9, Arginine @10, Leuconostoc/Radish Root Ferment Filtrate @16 (juice/ferments/amino acid, not deposition)','Phytic Acid @12 (chelator)']),
   wline(20,'Potassium Sorbate',['preservative_or_capped_active'],{'e3Point':22}),
   'light','low','moderate',
   'Two families (protein_film, cationic_conditioner, W2).',
   'Only light protein films and a trace cationic ester; no persistent system.',
   'Not moderate: the hydrolyzed proteins are light water-soluble film routes and the only cationic is an arginine ester at @19, just before the preservatives (late/trace), facing a C5 sulfate chassis with four buffers (W2 reason: a moderate reset faces only light routes).',
   'Protein film level unknown; INCI-only.'),
 'focusPrimary':focus('nonspecific',[],['Hydrolyzed Corn Protein @13','Hydrolyzed Wheat Protein @14','Hydrolyzed Soy Protein @15'],[],'Protein trio without a substantive deposition cluster; not repair_supported on its own.','repair','three hydrolyzed proteins make a damage-care claim the most plausible specialist role, though the deposition cluster is thin.'),
 'focusSecondary':secondary(['repair']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_fails('no listed comfort or humectant/refatting route is prominent and MB fails (prominent Sodium Coco-Sulfate @2); prominent unlisted candidates Aloe Barbadensis Leaf Juice @6, Lactococcus Ferment Lysate @9, Arginine @10 do not count (closed lists, R18).'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=[]
r['notes']=['PCA Ethyl Cocoyl Arginate read as cationic_conditioner (cationic arginine ester); late @19.']
write(r)
