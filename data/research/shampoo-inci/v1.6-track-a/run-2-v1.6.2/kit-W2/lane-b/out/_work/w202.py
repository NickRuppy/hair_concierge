import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W202','No synonym or split entries; normalized positions = packet positions (ID-2).','Parfum @21; prominent = positions 1-20 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Laureth Sulfate @2 (strong anionic, ether type)','reinforcingRoutes':[],'buffers':['Cocamidopropyl Betaine @3 (amphoteric)','Coco-Glucoside @4 (nonionic glucoside)'],'notCleansing':['Sorbitan Caprylate @7 (sorbitan ester, preservative booster/solubilizer; in no C3 cleansing class)'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'cationic_polymer':['Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @8'],'weak_refatter':['Glyceryl Oleate @6','Ascorbyl Palmitate @14'],'payload_lipid':[],'silicone':[],'pearlizing':[]},
 'humectants':['Panthenol @11','Glycerin @15'],'actives':['Piroctone Olamine @13 (recognized anti-dandruff active)','Zinc PCA @10 (not a recognized dandruff active)','Panthenol @11'],
 'recognizedDandruffActives':['Piroctone Olamine @13'],
 'exposure':{'fragrance':'Parfum @21, Citrus Aurantium Peel Oil @22, Geranyl Acetate @23, Limonene @24, Tetramethyl Acetyloctahydronaphthalenes @25','coolingAgents':[],'essentialOils':['Citrus Aurantium Peel Oil @22 (after Parfum, not prominent)']},
 'csa':{'listedComfortRoutesProminent':['Panthenol @11'],'listedHumectantRefattingRoutesProminent':['Glyceryl Oleate @6','Panthenol @11','Glycerin @15'],'mildBase':'no: prominent Sodium Laureth Sulfate @2','csaHolds':True},
 'preservativesAndOther':['Lactic Acid @5','Sodium Chloride @9','Tetrasodium Glutamate Diacetate @12 (chelator)','Citrus Limon Fruit Extract @16','Citric Acid @17','Melissa Officinalis Leaf Extract @18','Sodium Benzoate @19','Potassium Sorbate @20','CI 47005 @26','CI 61570 @27']}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C1 - defining anionic Sodium Laureth Sulfate @2 with prominent buffers Cocamidopropyl Betaine @3 and Coco-Glucoside @4, no reinforcing strong anionic.',['C1','C3','C4','E3']),
 'conditioningLevel':prop('moderate','moderate','low','Moderate: one meaningful conditioning system (prominent cationic guar HPG-HPTC @8) plus light routes (Glyceryl Oleate @6, Ascorbyl Palmitate @14, humectants Panthenol @11 / Glycerin @15). C2 not met: no early silicone or prominent payload lipid and no pearlizing route. Counter-signal: a single guar with weak refatters may give little slip; neighbor low.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('low','moderate','moderate','Low: a single cationic guar plus weak refatters facing an effective C1 reset; no silicone, no payload lipid, no film former.',
   ev(cp=['Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @8'],wr=['Glyceryl Oleate @6','Ascorbyl Palmitate @14'],reset=['Sodium Laureth Sulfate @2','Cocamidopropyl Betaine @3','Coco-Glucoside @4'],hum=['Panthenol @11','Glycerin @15'],
      exc=['Sorbitan Caprylate @7 (preservative booster/solubilizer, not deposition)','Zinc PCA @10 (active salt, not deposition)']),
   wline(11,'Panthenol',['sub1_active'],{'e3Point':21}),
   'light','low','moderate',
   'Two deposition families present (cationic_polymer + weak_refatter, W2); the guar sits fairly early (@8, before Sodium Chloride @9).',
   'The only substantive deposition is one cationic guar polymer; the second family is weak_refatter only, against an SLES/betaine/glucoside reset.',
   'Not moderate: the only families are one guar (a single light conditioning polymer) plus weak_refatter esters and humectants (W2 example), with no silicone, payload lipid, protein or film former to converge, facing moderate reset.',
   'Guar at @8 could deliver noticeable conditioning residue on fine hair; INCI-only.'),
 'focusPrimary':focus('nonspecific',['Panthenol @11','Glycerin @15'],[],['HPG-HPTC @8','Glyceryl Oleate @6'],'Light generic conditioning; no coherent repair or moisture cluster.','scalp_active','a recognized dandruff active (Piroctone Olamine @13) makes an anti-dandruff positioning the most plausible specialist role.'),
 'focusSecondary':secondary(['scalp_active']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_holds('CSA holds via prominent listed comfort route Panthenol @11 and humectant/refatting routes (Glyceryl Oleate @6, Glycerin @15); MB does not apply (prominent SLES @2).'),
 'dandruffSupport':DAND(13)}
r['unresolvedMaterialIngredients']=[]
write(r)
