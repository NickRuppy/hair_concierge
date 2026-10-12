import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W211','Aqua (Water, Eau) and Parfum (Fragrance) are single entries (ID-2); no split entries; normalized positions = packet positions.','Parfum (Fragrance) @8; prominent = positions 1-7 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Laureth Sulfate @2 (strong anionic, ether type)','reinforcingRoutes':[],'buffers':['Cocamidopropyl Betaine @4 (amphoteric)'],
   'nonProminentSurfactants':['Coco-Glucoside @13 (after E3: recorded, not a buffer)'],'notCleansing':['PEG-120 Methyl Glucose Dioleate @12','PEG-40 Hydrogenated Castor Oil @16','Glycol Distearate @17','Laureth-4 @20'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'protein_film':['Hydrolyzed Silk @6','Sericin @7'],'weak_refatter':['Glycosphingolipids @5 (lipid-like additive)','PEG-7 Glyceryl Cocoate @9','Glyceryl Oleate @15'],'cationic_polymer':['Polyquaternium-10 @10'],
   'payload_lipid':['Hydrogenated Castor Oil @18 (waxy)','Prunus Armeniaca (Apricot) Kernel Oil @21'],'pearlizing':['Glycol Distearate @17 (after E3)'],'silicone':[]},
 'humectants':[],'actives':['Glycosphingolipids @5','Hydrolyzed Silk @6','Sericin @7'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @8 (no allergens declared; Benzyl Alcohol @24 is preservative)','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':[],'listedHumectantRefattingRoutesProminent':[],'mildBase':'no: prominent Sodium Laureth Sulfate @2','csaHolds':False,
   'unlistedRouteCandidates':['unlisted_route_candidate:Glycosphingolipids (prominent @5; rejected by R18)'],'note':'PEG-7 Glyceryl Cocoate @9 is a listed refatting route but after Parfum @8, so not prominent.'},
 'preservativesAndOther':['Sodium Chloride @3','Sodium Benzoate @11','Citric Acid @14','Butylene Glycol @19','Propylene Glycol @22','Sodium Hydroxide @23','Benzyl Alcohol @24','Phenoxyethanol @25','Potassium Sorbate @26','Methylparaben @27']}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C1 - defining anionic Sodium Laureth Sulfate @2 with prominent buffer Cocamidopropyl Betaine @4 and no reinforcing route; Coco-Glucoside @13 is after Parfum and not counted.',['C1','C3','C4','E3']),
 'conditioningLevel':prop('moderate','moderate','low','Moderate: several light routes - protein films (Hydrolyzed Silk @6, Sericin @7), refatters (Glycosphingolipids @5, PEG-7 Glyceryl Cocoate @9, Glyceryl Oleate @15), one cationic Polyquaternium-10 @10, pearlizer @17 and late lipids (Hydrogenated Castor Oil @18, Apricot Oil @21). C2 not met (no early silicone or prominent payload lipid, no listed humectant). Counter-signal: only proteins and a lipid-like refatter are prominent; neighbor low.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('moderate','moderate','low','Moderate: interacting light routes - a cationic Polyquaternium-10, protein films, several refatters and two post-line lipids (one waxy) - plausibly leave bounded residue against a moderate C1 reset.',
   ev(cp=['Polyquaternium-10 @10'],pl=['Hydrogenated Castor Oil @18 (non-material)','Prunus Armeniaca Kernel Oil @21 (non-material)'],wr=['Glycosphingolipids @5','PEG-7 Glyceryl Cocoate @9','Glyceryl Oleate @15'],pf=['Hydrolyzed Silk @6','Sericin @7'],
      reset=['Sodium Laureth Sulfate @2','Cocamidopropyl Betaine @4','Coco-Glucoside @13 (late)'],hum=[],
      exc=['PEG-120 Methyl Glucose Dioleate @12 (PEG thickener, 6.4)','PEG-40 Hydrogenated Castor Oil @16 (solubilizer, 6.4)','Glycol Distearate @17 (pearlizing wax, 6.4)','Laureth-4 @20','Butylene Glycol @19, Propylene Glycol @22 (solvents)']),
   wline(8,'Parfum (Fragrance)',['fragrance'],{'e3Point':8},nonmat=['Hydrogenated Castor Oil @18','Prunus Armeniaca Kernel Oil @21']),
   'moderate','moderate','moderate',
   'Every non-protein route is after Parfum @8; the lipids are non-material under W-LINE and PQ-10 is a single light polymer; the SLES/betaine reset is effective.',
   'Four deposition families converge (cationic_polymer, protein_film, weak_refatter, payload_lipid incl. waxy Hydrogenated Castor Oil); calling the product lightweight would understate the combined residue risk (W2).',
   'Not low: W2 - four families including a cationic polymer and a waxy lipid; no single family is decisive but their combination is not clearly below noticeable. Not high: no material payload lipid (both lipids after the W-line @8), so no W-RICH and no lipid leg for convergence; PQ-10 plus light protein films do not form a persistent coating system against the C1 reset.',
   'Low/moderate boundary; amounts of the post-Parfum routes unknown.'),
 'focusPrimary':focus('nonspecific',[],['Hydrolyzed Silk @6','Sericin @7'],['Polyquaternium-10 @10','PEG-7 Glyceryl Cocoate @9','Glycosphingolipids @5'],'Protein films without a substantive deposition cluster; leans repair but not repair_supported.','repair','silk proteins and sericin make a damage-care/repair positioning the most plausible specialist role.'),
 'focusSecondary':secondary(['shine']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_fails('no listed comfort or humectant/refatting route is prominent (PEG-7 Glyceryl Cocoate @9 is after Parfum @8) and MB fails (prominent SLES @2); prominent unlisted candidate Glycosphingolipids @5 does not count (closed lists, R18).'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=[]
r['notes']=['Glycosphingolipids read as weak_refatter (lipid-like additive, 6.3); not payload_lipid.']
write(r)
