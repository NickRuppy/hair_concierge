import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W205','No synonym or split entries; normalized positions = packet positions (ID-2).','Parfum @8; prominent = positions 1-7 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Laureth Sulfate @7 (strong anionic, ether type; earliest prominent strong anionic although listed after the mild routes)','reinforcingRoutes':[],
   'buffers':['Disodium Laureth Sulfosuccinate @3 (mild anionic)','Sodium Lauryl Sulfoacetate @4 (mild anionic)','Lauryl Glucoside @6 (nonionic glucoside)'],
   'notCleansing':['Laureth-9 @5 (= Polidocanol, E4 comfort route; alcohol ethoxylate, read as in no C3 cleansing class)','PEG-120 Methyl Glucose Dioleate @9 (PEG thickener)','Laureth-2 @12 (low-ethoxylate thickener)','PEG/PPG-120/10 Trimethylolpropane Trioleate @13 (PEG thickener)'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'cationic_polymer':['Hydroxypropyl Oxidized Starch PG-Trimonium Chloride @15'],'payload_lipid':['Helianthus Annuus Seed Oil @21'],'silicone':[],'weak_refatter':[],'pearlizing':[]},
 'humectants':['Urea @2'],'actives':['Urea @2','Laureth-9 (Polidocanol) @5','Tocopherol @20'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @8, Tetramethyl Acetyloctahydronaphthalenes @17','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':['Urea @2','Laureth-9 (Polidocanol) @5'],'listedHumectantRefattingRoutesProminent':['Urea @2'],'mildBase':'no: prominent Sodium Laureth Sulfate @7 excludes MB','csaHolds':True},
 'preservativesAndOther':['Phenoxyethanol @10','Citric Acid @11','Sodium Benzoate @14','Sodium Citrate @16','Sodium Chloride @18','Lactic Acid @19']}
r['directProperties']={
 'cleansingStrength':prop('moderate','moderate','low','Moderate: C1 - the earliest prominent strong anionic is Sodium Laureth Sulfate @7, buffered by prominent mild anionics (Disodium Laureth Sulfosuccinate @3, Sodium Lauryl Sulfoacetate @4) and Lauryl Glucoside @6, with no reinforcing route. Counter-signal: SLES is the last prominent surfactant, behind three mild routes, so the net system may be milder than the convention reads; confidence moderate, neighbor low (value stays at the convention).',['C1','C3','C4','E3','N-ALT']),
 'conditioningLevel':prop('low','moderate','moderate','Low: cleansing-led architecture - the only deposition is a late cationic starch (@15, after the preservatives) and a trace Sunflower Oil @21; Urea @2 is a humectant, not slip. C2 not met (no silicone, payload lipid, pearlizer early). Neighbor moderate: Urea at a high position plus the cationic starch could give noticeable softness.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('low','moderate','moderate','Low: one late cationic starch polymer and a trace post-line sunflower oil against an effective C1 reset.',
   ev(cp=['Hydroxypropyl Oxidized Starch PG-Trimonium Chloride @15'],pl=['Helianthus Annuus Seed Oil @21 (non-material: after W-line @8)'],
      reset=['Disodium Laureth Sulfosuccinate @3','Sodium Lauryl Sulfoacetate @4','Lauryl Glucoside @6','Sodium Laureth Sulfate @7'],hum=['Urea @2'],
      exc=['PEG-120 Methyl Glucose Dioleate @9, PEG/PPG-120/10 Trimethylolpropane Trioleate @13 (PEG thickeners, 6.4)','Laureth-9 @5, Laureth-2 @12 (ethoxylates, not deposition)','Tocopherol @20 (antioxidant)']),
   wline(8,'Parfum',['fragrance'],{'e3Point':8},nonmat=['Helianthus Annuus Seed Oil @21']),
   'light','low','moderate',
   'Two families (cationic_polymer, payload_lipid) are present (W2).',
   'Deposition is limited to a single late cationic starch and a trace oil.',
   'Not moderate: both families are late/trace - the cationic starch sits after Sodium Benzoate @14 and the oil is the last entry @21, after the W-line - and they face a broad sulfosuccinate/sulfoacetate/glucoside/SLES reset (W2 reason: each family late/trace).',
   'Cationic starch deposition at low dose is possible; INCI-only.'),
 'focusPrimary':focus('nonspecific',['Urea @2'],[],['Hydroxypropyl Oxidized Starch PG-Trimonium Chloride @15'],'Strong humectant (Urea) but little conditioning/emollient support for a moisture verdict.','scalp_active','prominent Urea and Laureth-9 (Polidocanol) are listed comfort routes, so a dry/itchy-scalp positioning is the most plausible specialist role.'),
 'focusSecondary':secondary(['scalp_active']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_holds('CSA holds via prominent listed comfort routes Urea @2 and Laureth-9 (Polidocanol) @5 and humectant route Urea @2; MB does not apply (prominent SLES @7).'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=[]
r['notes']=['Laureth-9 class: read as in no C3 cleansing class (alcohol ethoxylate; C3 nonionic cleansing lists only alkyl glucosides). If it were read as a nonionic cleansing buffer, C1 would still give moderate (buffers already present) and no W-line or MB reading changes.']
write(r)
