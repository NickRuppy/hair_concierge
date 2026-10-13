import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W214','No synonym or split entries; normalized positions = packet positions (ID-2).','Parfum @6; prominent = positions 1-5 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Laureth Sulfate @2 (strong anionic, ether type)','reinforcingRoutes':[],'buffers':['Cocamidopropyl Betaine @3 (amphoteric)'],'notCleansing':['Sodium Xylenesulfonate @4 (hydrotrope)'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'cationic_polymer':[],'silicone':[],'payload_lipid':[],'weak_refatter':[],'protein_film':[],'film_former':[],'pearlizing':[]},
 'humectants':['Panthenol @13'],'actives':['Panthenol @13','Histidine @16'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @6, Hexyl Cinnamal @15','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':[],'listedHumectantRefattingRoutesProminent':[],'mildBase':'no: prominent Sodium Laureth Sulfate @2','csaHolds':False},
 'preservativesAndOther':['Sodium Chloride @5','Citric Acid @7','Sodium Benzoate @8','Sodium Citrate @9','Sodium Salicylate @10','Hydroxypropyl Methylcellulose @11 (nonionic cellulose thickener)','Sodium Hydroxide @12','Tetrasodium EDTA @14','Glyoxal @17 (HPMC processing aid)']}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C1 - defining anionic Sodium Laureth Sulfate @2 with prominent buffer Cocamidopropyl Betaine @3 and no reinforcing route; Sodium Xylenesulfonate @4 is a hydrotrope, not a route.',['C1','C3','C4','E3']),
 'conditioningLevel':prop('low','high','none','Low: cleansing-led architecture with no conditioning system at all - no cationic, silicone, lipid, refatter or pearlizer; only a late Panthenol @13. C2 not met.',['5','C2','E3']),
 'weightPotential':weight('low','high','none','Low: no deposition family is present; Hydroxypropyl Methylcellulose is a nonionic thickener.',
   ev(reset=['Sodium Laureth Sulfate @2','Cocamidopropyl Betaine @3'],hum=['Panthenol @13'],exc=['Hydroxypropyl Methylcellulose @11 (nonionic cellulose thickener, no cationic charge; excluded like the 6.4 thickeners)','Sodium Xylenesulfonate @4 (hydrotrope)']),
   wline(6,'Parfum',['fragrance'],{'e3Point':6}),
   'light','low','moderate',
   'none',
   'There is no depositing system; a plain SLES/betaine base.',
   'Not moderate: no deposition family exists at all (W2 not engaged).',
   'none material'),
 'focusPrimary':focus('not_applicable',[],[],[],'No conditioning routes at all; no care direction.','clarifying','a plain SLES/betaine base without conditioning is most compatible with a reset/oily-scalp role if so positioned (F6 needs moderate/strong cleansing, which holds).'),
 'focusSecondary':secondary(['clarifying']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_fails('no listed comfort or humectant/refatting route is prominent (Panthenol @13 after Parfum @6) and MB fails (prominent SLES @2).'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=[]
r['notes']=['Hydroxypropyl Methylcellulose classified as excluded (nonionic thickener), not film_former; Glyoxal is its processing aid.']
write(r)
