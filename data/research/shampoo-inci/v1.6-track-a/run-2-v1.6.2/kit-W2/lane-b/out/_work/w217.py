import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W217','No synonym or split entries; normalized positions = packet positions (ID-2).','PARFUM @5; prominent = positions 1-4 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Laureth Sulfate @2 (strong anionic, ether type)','reinforcingRoutes':[],'buffers':['Cocamidopropyl Betaine @3 (amphoteric)'],'nonProminentSurfactants':['Coco-Glucoside @8 (after E3: recorded, not a buffer)'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'cationic_polymer':['Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @10'],'weak_refatter':['Glyceryl Oleate @9','Hydrogenated Palm Glycerides Citrate @15','Lecithin @16','Ascorbyl Palmitate @17'],'payload_lipid':[],'silicone':[],'pearlizing':[]},
 'humectants':['Sodium Hyaluronate @13'],'actives':['Aloe Barbadensis Leaf Juice Powder @11','Sodium Hyaluronate @13','Tocopherol @14'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @5 (no allergens declared)','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':[],'listedHumectantRefattingRoutesProminent':[],'mildBase':'no: prominent Sodium Laureth Sulfate @2','csaHolds':False,'note':'Glyceryl Oleate @9 and Sodium Hyaluronate @13 are listed routes but after Parfum @5.'},
 'preservativesAndOther':['Sodium Chloride @4','Sodium Benzoate @6','Citric Acid @7','Potassium Sorbate @12']}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C1 - defining anionic Sodium Laureth Sulfate @2 with prominent buffer Cocamidopropyl Betaine @3 and no reinforcing route; Coco-Glucoside @8 is after Parfum and not counted.',['C1','C3','C4','E3']),
 'conditioningLevel':prop('low','moderate','moderate','Low: cleansing-led - every conditioning route is after Parfum @5 and the preservative @6: one cationic HPG-HPTC @10 and weak refatters (Glyceryl Oleate @9, Hydrogenated Palm Glycerides Citrate @15, Lecithin @16), Sodium Hyaluronate @13. C2 not met. Neighbor moderate: the guar plus refatters could be read as one light system.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('low','moderate','moderate','Low: one late cationic guar plus weak refatter esters against an effective C1 reset; no silicone, payload lipid, protein or film former.',
   ev(cp=['Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @10'],wr=['Glyceryl Oleate @9','Hydrogenated Palm Glycerides Citrate @15','Lecithin @16','Ascorbyl Palmitate @17'],reset=['Sodium Laureth Sulfate @2','Cocamidopropyl Betaine @3','Coco-Glucoside @8 (late)'],hum=['Sodium Hyaluronate @13'],
      exc=['Aloe Barbadensis Leaf Juice Powder @11 (plant juice)','Tocopherol @14 (antioxidant)']),
   wline(5,'PARFUM',['fragrance'],{'e3Point':5}),
   'light','low','moderate',
   'Two families (cationic_polymer + weak_refatter, W2).',
   'One late light cationic polymer plus weak refatters.',
   'Not moderate: the only families are one guar polymer listed after Parfum and Sodium Benzoate (late) and weak_refatter esters/lecithin, facing a moderate SLES/betaine reset (W2 reason: weak refatters plus one late light polymer).',
   'Guar deposition at low dose; INCI-only.'),
 'focusPrimary':focus('nonspecific',['Sodium Hyaluronate @13'],[],['HPG-HPTC @10','Glyceryl Oleate @9'],'Late hyaluronate and light conditioning do not form a coherent moisture cluster.','moisture','Sodium Hyaluronate and aloe make a hydration claim the most plausible specialist role, though the formula verdict is nonspecific.'),
 'focusSecondary':secondary(['moisture']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_fails('no listed comfort or humectant/refatting route is prominent (all after Parfum @5) and MB fails (prominent SLES @2).'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=[]
write(r)
