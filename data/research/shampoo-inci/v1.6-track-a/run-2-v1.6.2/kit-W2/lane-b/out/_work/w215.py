import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W215','No synonym or split entries; normalized positions = packet positions (ID-2).','Parfum @13; prominent = positions 1-12 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Laureth Sulfate @2 (strong anionic, ether type)','reinforcingRoutes':[],'buffers':['Cocamidopropyl Hydroxysultaine @3 (amphoteric)','Coco-Glucoside @5 (nonionic glucoside)'],'notCleansing':['Laureth-2 @12 (low-ethoxylate thickener)'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'cationic_polymer':['Guar Hydroxypropyltrimonium Chloride @10'],'protein_film':['Hydrolyzed Wheat Protein @6'],'payload_lipid':[],'silicone':[],'weak_refatter':[],'pearlizing':[]},
 'humectants':['Glycerin @9'],'actives':['Hydrolyzed Wheat Protein @6','Biotin @7 (hair-loss-type ingredient; never a focus route, F5)','Oryza Sativa Extract @8'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @13, Tetramethyl Acetyloctahydronaphthalenes @14, Linalool @15, Hexyl Cinnamal @16, Linalyl Acetate @17','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':[],'listedHumectantRefattingRoutesProminent':['Glycerin @9'],'mildBase':'no: prominent Sodium Laureth Sulfate @2','csaHolds':True,'note':'No prominent comfort route and no MB, so an S-SENSITIVE gate would fail.'},
 'preservativesAndOther':['Sodium Chloride @4','Citric Acid @11','Sodium Benzoate @18']}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C1 - defining anionic Sodium Laureth Sulfate @2 with prominent buffers Cocamidopropyl Hydroxysultaine @3 and Coco-Glucoside @5, no reinforcing route.',['C1','C3','C4','E3']),
 'conditioningLevel':prop('moderate','moderate','low','Moderate: one meaningful system (prominent cationic Guar HPTC @10) plus light routes (Hydrolyzed Wheat Protein @6, Glycerin @9). C2 not met (no silicone, payload lipid or pearlizer). Counter-signal: a single guar plus protein may give little slip; neighbor low.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('low','moderate','moderate','Low: one cationic guar and one hydrolyzed protein against an effective C1 reset; no silicone, lipid or film former.',
   ev(cp=['Guar Hydroxypropyltrimonium Chloride @10'],pf=['Hydrolyzed Wheat Protein @6'],reset=['Sodium Laureth Sulfate @2','Cocamidopropyl Hydroxysultaine @3','Coco-Glucoside @5'],hum=['Glycerin @9'],
      exc=['Biotin @7, Oryza Sativa Extract @8 (actives/extracts)','Laureth-2 @12']),
   wline(7,'Biotin',['sub1_active'],{'e3Point':13}),
   'light','low','moderate',
   'Two families (cationic_polymer, protein_film, W2).',
   'Deposition is limited to one guar polymer and a water-soluble protein film.',
   'Not moderate: the families are one light conditioning polymer (guar @10, after the sub-1 % zone marked by Biotin @7) and a light hydrolyzed protein film, facing a moderate SLES/sultaine/glucoside reset (W2 reason: a moderate reset faces only light routes).',
   'Guar deposition at low dose; INCI-only.'),
 'focusPrimary':focus('nonspecific',['Glycerin @9'],['Hydrolyzed Wheat Protein @6'],['Guar HPTC @10'],'One protein token is not a repair cluster; light generic conditioning. Biotin is out of scope (F5).','volume','a light, low-deposition architecture with protein is most compatible with a strength/volume role (hair-loss/biotin positioning would be ignored, F5).'),
 'focusSecondary':secondary(['volume']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_holds('CSA holds only via the prominent listed humectant route Glycerin @9; no prominent comfort route and MB does not apply (prominent SLES @2).'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=[]
write(r)
