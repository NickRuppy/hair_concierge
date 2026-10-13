import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W210','No synonym or split entries; normalized positions = packet positions (ID-2).','Parfum @21; prominent = positions 1-20 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Laureth Sulfate @2 (strong anionic, ether type)',
   'reinforcingRoutes':['Sodium Laureth-8 Sulfate @14 (strong ether type, C3b high-EO counter-signal)','Magnesium Laureth Sulfate @16 (strong ether type)','Magnesium Laureth-8 Sulfate @17 (strong ether type, C3b)','Sodium Oleth Sulfate @19 (alkyl ether sulfate, strong ether type by chemistry)','Magnesium Oleth Sulfate @20 (alkyl ether sulfate, strong ether type by chemistry)'],
   'buffers':['Cocamidopropyl Betaine @3 (amphoteric)','Coco-Glucoside @5 (nonionic glucoside)','Sodium Cocoyl Glutamate @6 (mild anionic)'],
   'notCleansing':['Glycol Distearate @15 (pearlizing wax)','Laureth-4 @18 (low-ethoxylate thickener)'],
   'c3aOrC3b':'C3b laureth-8 sulfates @14, @17 kept as strong ether-type anionics; they do not decide the value (Magnesium Laureth Sulfate @16 and the oleth sulfates @19-20 reinforce without them), so the C3b confidence limit does not apply.'},
 'conditioningRoutes':{'weak_refatter':['Glyceryl Oleate @7','Hydrogenated Vegetable Glycerides Citrate @22'],'pearlizing':['Glycol Distearate @15 (prominent)'],'cationic_polymer':[],'silicone':[],'payload_lipid':[]},
 'humectants':['Panthenol @10','Glycerin @13'],'actives':['Piroctone Olamine @8 (recognized anti-dandruff active)','Sodium Salicylate @9','Panthenol @10','Caffeine @11 (hair-loss-type ingredient, F5)','Menthol @12 (cooling)','Tocopherol @23'],
 'recognizedDandruffActives':['Piroctone Olamine @8'],
 'exposure':{'fragrance':'Parfum @21 (no allergens declared)','coolingAgents':['Menthol @12 (prominent)'],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':['Panthenol @10'],'listedHumectantRefattingRoutesProminent':['Glyceryl Oleate @7','Panthenol @10','Glycerin @13'],'mildBase':'no: prominent strong anionics Sodium Laureth Sulfate @2 and further ether sulfates @14-20','csaHolds':True,'counterSignals':['cleansingStrength strong','Menthol @12 prominent cooling agent']},
 'preservativesAndOther':['Sodium Chloride @4','Citric Acid @24','Sodium Citrate @25','Propylene Glycol @26','Formic Acid @27','Sodium Benzoate @28','Potassium Sorbate @29']}
r['directProperties']={
 'cleansingStrength':prop('strong','moderate','moderate','Strong: C1 - defining anionic Sodium Laureth Sulfate @2 plus prominent reinforcing strong anionics (Sodium Laureth-8 Sulfate @14, Magnesium Laureth Sulfate @16, Magnesium Laureth-8 Sulfate @17, Sodium Oleth Sulfate @19, Magnesium Oleth Sulfate @20), all before Parfum @21; a reinforcing route gives strong regardless of the buffers (Cocamidopropyl Betaine @3, Coco-Glucoside @5, Sodium Cocoyl Glutamate @6). Counter-signal: the reinforcing ether sulfates are listed late (after Glycerin, Menthol), i.e. a small magnesium/oleth sulfate co-blend in a well-buffered SLES base; confidence moderate, neighbor moderate (value stays at the convention).',['C1','C3','C3b','C4','E3','N-ALT']),
 'conditioningLevel':prop('low','high','none','Low: cleansing-led architecture with no cationic polymer, silicone or payload lipid; only the weak refatter Glyceryl Oleate @7, the pearlizer Glycol Distearate @15 and humectants (Panthenol @10, Glycerin @13). C2 not met (no early silicone/lipid and no cationic polymer).',['5','C2','E3']),
 'weightPotential':weight('low','high','none','Low: no persistent deposition family - only weak refatter esters (Glyceryl Oleate @7, Hydrogenated Vegetable Glycerides Citrate @22) - against a broad multi-ether-sulfate reset.',
   ev(wr=['Glyceryl Oleate @7','Hydrogenated Vegetable Glycerides Citrate @22'],
      reset=['Sodium Laureth Sulfate @2','Cocamidopropyl Betaine @3','Coco-Glucoside @5','Sodium Cocoyl Glutamate @6','Sodium Laureth-8 Sulfate @14','Magnesium Laureth Sulfate @16','Magnesium Laureth-8 Sulfate @17','Sodium Oleth Sulfate @19','Magnesium Oleth Sulfate @20'],
      hum=['Panthenol @10','Glycerin @13'],exc=['Glycol Distearate @15 (pearlizing wax, 6.4)','Piroctone Olamine @8, Sodium Salicylate @9, Caffeine @11, Menthol @12, Tocopherol @23 (actives)','Laureth-4 @18']),
   wline(21,'Parfum',['fragrance'],{'e3Point':21},skipped=[
     'w_line_skipped:Piroctone Olamine@8 (clause ii: Sodium Laureth-8 Sulfate@14 and further cleansing surfactants @16-20, Glycol Distearate@15 after it before the cap)',
     'w_line_skipped:Sodium Salicylate@9 (clause ii: same entries @14-20)','w_line_skipped:Panthenol@10 (clause ii: same entries @14-20)','w_line_skipped:Caffeine@11 (clause ii: same entries @14-20)']),
   'light','low','strong',
   'None material: weak refatters only; the pearlizer is excluded from weight.',
   'Only weak_refatter deposition exists and the reset is broad and strong.',
   'Not moderate: there is no meaningful depositing system at all - the only family is weak_refatter (W2 does not apply: one family), facing a strong multi-anionic reset.',
   'none material'),
 'focusPrimary':focus('nonspecific',['Panthenol @10','Glycerin @13'],[],['Glyceryl Oleate @7'],'Low-conditioning formula; no repair or moisture cluster. Caffeine is out of scope (F5).','scalp_active','Piroctone Olamine @8 with Menthol makes an anti-dandruff positioning the most plausible specialist role.'),
 'focusSecondary':secondary(['scalp_active']),
 'usageRole':usage(True),
 'scalpComfortTarget':SCT_csa_holds('CSA holds via prominent listed comfort route Panthenol @10 and humectant/refatting routes Glyceryl Oleate @7, Glycerin @13; counter-signals cleansingStrength strong and prominent Menthol @12 would cap targeted at moderate; MB does not apply.'),
 'dandruffSupport':DAND(8)}
r['unresolvedMaterialIngredients']=[]
r['notes']=['Sodium Oleth Sulfate / Magnesium Oleth Sulfate assigned by chemistry (alkyl ether sulfates) to the strong ether/sulfonate class (C3 unlisted-surfactant rule).']
write(r)
