import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W213','Aqua/Water/Eau and Parfum/Fragrance are single entries (ID-2); no split entries; normalized positions = packet positions.','Parfum/Fragrance @21; prominent = positions 1-20 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':None,'c6EarliestProminentCleansing':'Sodium Methyl Cocoyl Taurate @2 (mild anionic, taurate)','prominentCoSurfactants':['Decyl Glucoside @3 (nonionic glucoside)','Cocamidopropyl Betaine @4 (amphoteric)','Coco-Glucoside @8 (nonionic glucoside)'],
   'reinforcingRoutes':[],'buffers':['Decyl Glucoside @3','Cocamidopropyl Betaine @4','Coco-Glucoside @8'],
   'notCleansing':['Glycol Distearate @14','PEG-150 Distearate @15'],
   'unclassified':['Coconut Acid @12 (free fatty acid, neutralized by Sodium Hydroxide @18 to a soap; in no named C3 class)','Disodium Tetrapropenyl Succinate @13 (alkenyl succinate salt; role not certain - emulsifier/co-surfactant)'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'payload_lipid':['Argania Spinosa Kernel Oil @6','Hydrogenated Castor Oil @11 (waxy)'],'silicone':['Amodimethicone @9'],'cationic_polymer':['Guar Hydroxypropyltrimonium Chloride @10'],'pearlizing':['Glycol Distearate @14 (prominent)'],'weak_refatter':['Coconut Acid @12 (fatty acid, read as light refatter)'],'film_former':[]},
 'humectants':[],'actives':[],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum/Fragrance @21 (last entry; no allergens declared)','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':[],'listedHumectantRefattingRoutesProminent':['Argania Spinosa Kernel Oil @6','Hydrogenated Castor Oil @11'],
   'mildBase':'mild_base:Sodium Methyl Cocoyl Taurate @2, Decyl Glucoside @3, Cocamidopropyl Betaine @4, Coco-Glucoside @8 (cleansingStrength low, no prominent strong anionic)','csaHolds':True},
 'preservativesAndOther':['Sodium Chloride @5','Hexylene Glycol @16 (solvent)','Citric Acid @17','Sodium Hydroxide @18','Sodium Benzoate @19','Benzoic Acid @20']}
r['directProperties']={
 'cleansingStrength':prop('low','high','none','Low: C6 - no strong anionic at all; the earliest prominent cleansing surfactant is the mild anionic Sodium Methyl Cocoyl Taurate @2 with prominent glucoside/amphoteric co-surfactants (Decyl Glucoside @3, Cocamidopropyl Betaine @4, Coco-Glucoside @8). The unclassified Coconut Acid @12 / Disodium Tetrapropenyl Succinate @13 are not strong anionics and cannot change C6.',['C6','C3','C4','E3']),
 'conditioningLevel':prop('high','moderate','moderate','High: rich architecture (W-RICH read with E3 for Section 5) - the prominent payload lipids Argan Oil @6 and Hydrogenated Castor Oil @11 converge with a prominent amino-silicone Amodimethicone @9 and cationic Guar HPTC @10, plus the prominent pearlizing route Glycol Distearate @14. C2 is not met (no listed humectant: no Glycerin/Panthenol etc.; Hexylene Glycol is a solvent), which is the counter-signal; neighbor moderate.',['5','W-RICH','C2','E3','N-ALT']),
 'weightPotential':weight('high','moderate','moderate','High: W-RICH with limited reset - material payload lipids (Argan Oil @6, waxy Hydrogenated Castor Oil @11) converge with Amodimethicone @9 and Guar HPTC @10, and the mild C6 taurate/glucoside/betaine chassis gives only weak reset.',
   ev(cp=['Guar Hydroxypropyltrimonium Chloride @10'],pl=['Argania Spinosa Kernel Oil @6 (material)','Hydrogenated Castor Oil @11 (material, waxy)'],wr=['Coconut Acid @12'],si=['Amodimethicone @9'],
      reset=['Sodium Methyl Cocoyl Taurate @2','Decyl Glucoside @3','Cocamidopropyl Betaine @4','Coco-Glucoside @8'],hum=[],
      exc=['Glycol Distearate @14 (pearlizing wax, 6.4)','PEG-150 Distearate @15 (PEG thickener, 6.4)','Hexylene Glycol @16 (solvent)'],
      unr=['Sodium Hydrolyzed Potato Starch Dodecenylsuccinate @7 (anionic modified starch, likely emulsion stabilizer/film; no cationic charge - not counted as deposition; cannot lower the band)','Disodium Tetrapropenyl Succinate @13 (role uncertain; not a deposition family)']),
   wline(19,'Sodium Benzoate',['preservative_or_capped_active'],{'e3Point':21},mat=['Argania Spinosa Kernel Oil @6','Hydrogenated Castor Oil @11']),
   'high','high','weak',
   'Argan oil sits after Sodium Chloride @5, so its amount is plausibly modest; amodimethicone and guar are single members of their families; the potato-starch succinate @7 is unresolved (not cationic).',
   'W-RICH (material lipids + amino-silicone + cationic guar) meets limited reset (resetCapacity weak, mild C6 chassis), which is the high anchor rich route; persistent amodimethicone and waxy hydrogenated castor oil support persistence.',
   'Not moderate: the moderate reading would need an effective reset (C1/C5 chassis) to offset the rich architecture, but the sulfate-free taurate/glucoside/betaine base is weak reset; the lipids are material (before the W-line @19) and not at the boundary position.',
   'Lipid amounts after salt are unknown; the unresolved anionic starch succinate @7 is not deposition and cannot lighten the band.',
   rules=('6.6','W-RICH','W-LINE','W2','W3','N-ALT')),
 'focusPrimary':focus('repair_supported',[],['Amodimethicone @9','Argania Spinosa Kernel Oil @6','Hydrogenated Castor Oil @11'],['Guar HPTC @10','Glycol Distearate @14'],'Substantive lipid/amino-silicone deposition cluster; no listed humectant, so moisture is not supported (nourishment of dry lengths would need the humectant cluster).','repair','the formula verdict is repair_supported (argan/amodimethicone/guar), so a damage/repair claim would make repair the focus.'),
 'focusSecondary':secondary(['shine']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_holds('CSA holds via MB (mild_base: Sodium Methyl Cocoyl Taurate @2, Decyl Glucoside @3, Cocamidopropyl Betaine @4, Coco-Glucoside @8) and via prominent listed refatting routes (Argan Oil @6, Hydrogenated Castor Oil @11); no prominent listed comfort route.'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=['Sodium Hydrolyzed Potato Starch Dodecenylsuccinate @7 - weight role not certain (anionic starch emulsifier/stabilizer; no cationic charge); it can only add deposition, never lighten the high band, so it does not lower confidence below moderate.','Disodium Tetrapropenyl Succinate @13 - class not certain (possible anionic co-surfactant); it is not a strong anionic, so neither C6 nor MB changes.']
write(r)
