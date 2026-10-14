import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W216','No synonym or split entries; normalized positions = packet positions (ID-2).','No Parfum/Fragrance declared; E3 preservative fallback = Sodium Salicylate @14 (first listed of the seven; Sodium Benzoate @17 is later); prominent = positions 1-13.')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Laureth Sulfate @2 (strong anionic, ether type)','reinforcingRoutes':[],'buffers':['Cocamidopropyl Betaine @3 (amphoteric)','Coco-Glucoside @7 (nonionic glucoside)'],'notCleansing':[],'c3aOrC3b':'none'},
 'conditioningRoutes':{'cationic_polymer':['Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @11'],'weak_refatter':['Glyceryl Oleate @6','Hydrogenated Vegetable Glycerides Citrate @13'],'payload_lipid':[],'silicone':[],'pearlizing':[]},
 'humectants':['Panthenol @8'],'actives':['Piroctone Olamine @5 (recognized anti-dandruff active)','Panthenol @8','Niacinamide @9','Bisabolol @10','Tocopherol @12'],'recognizedDandruffActives':['Piroctone Olamine @5'],
 'exposure':{'fragrance':'none declared (no Parfum, no allergens)','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':['Panthenol @8','Niacinamide @9','Bisabolol @10'],'listedHumectantRefattingRoutesProminent':['Glyceryl Oleate @6','Panthenol @8'],'mildBase':'no: prominent Sodium Laureth Sulfate @2','csaHolds':True},
 'preservativesAndOther':['Sodium Chloride @4','Sodium Salicylate @14','Sodium Citrate @15','Citric Acid @16','Sodium Benzoate @17']}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C1 - defining anionic Sodium Laureth Sulfate @2 with prominent buffers Cocamidopropyl Betaine @3 and Coco-Glucoside @7, no reinforcing route.',['C1','C3','C4','E3']),
 'conditioningLevel':prop('moderate','moderate','low','Moderate: one meaningful system (prominent cationic HPG-HPTC @11) plus light routes (Glyceryl Oleate @6, Hydrogenated Vegetable Glycerides Citrate @13, Panthenol @8). C2 not met (no silicone, payload lipid or pearlizer). Counter-signal: a single guar with weak refatters may give little slip; neighbor low.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('low','moderate','moderate','Low: a single cationic guar plus weak refatter esters against an effective C1 reset; no silicone, payload lipid, protein or film former.',
   ev(cp=['Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @11'],wr=['Glyceryl Oleate @6','Hydrogenated Vegetable Glycerides Citrate @13'],reset=['Sodium Laureth Sulfate @2','Cocamidopropyl Betaine @3','Coco-Glucoside @7'],hum=['Panthenol @8'],
      exc=['Piroctone Olamine @5, Niacinamide @9, Bisabolol @10, Tocopherol @12 (actives)']),
   wline(8,'Panthenol',['sub1_active'],{'e3Point':14},skipped=['w_line_skipped:Piroctone Olamine@5 (clause ii: Coco-Glucoside@7 cleansing surfactant listed after it before the cap)']),
   'light','low','moderate',
   'Two families (cationic_polymer + weak_refatter, W2).',
   'One light cationic polymer plus weak refatters; nothing converges toward a persistent deposit.',
   'Not moderate: the only families are one guar polymer (@11, after the sub-1 % zone marked by Panthenol @8) and weak_refatter esters, facing a moderate SLES/betaine/glucoside reset (W2 reason: weak refatters plus one light polymer).',
   'Guar deposition could be noticeable on fine hair; INCI-only.'),
 'focusPrimary':focus('nonspecific',['Panthenol @8'],[],['HPG-HPTC @11','Glyceryl Oleate @6'],'Light generic conditioning; no coherent repair or moisture cluster.','scalp_active','Piroctone Olamine @5 plus prominent Panthenol/Niacinamide/Bisabolol make an anti-dandruff or scalp-comfort positioning the most plausible specialist role.'),
 'focusSecondary':secondary(['scalp_active']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_holds('CSA holds via prominent listed comfort routes Panthenol @8, Niacinamide @9, Bisabolol @10 and refatting route Glyceryl Oleate @6; fragrance-free (supportive signal only); MB does not apply (prominent SLES @2).'),
 'dandruffSupport':DAND(5)}
r['unresolvedMaterialIngredients']=[]
write(r)
