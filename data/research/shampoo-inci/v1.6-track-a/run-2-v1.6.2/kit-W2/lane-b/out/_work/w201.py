import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W201','Aqua/Water/Eau is one entry (ID-2); no split entries; marker * stripped from Polyimide-1 and Polyquaternium-10 (kept as provenance); normalized positions = packet positions.',
 'Parfum/Fragrance @26; prominent = positions 1-25 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium C14-16 Olefin Sulfonate @2 (strong anionic, ether/sulfonate type, C3)','reinforcingRoutes':[],
   'buffers':['Cocamidopropyl Betaine @4 (amphoteric)','Coco-Glucoside @11 (nonionic glucoside)'],
   'notCleansing':['Cocamide MIPA @3 (alkanolamide foam booster)','Glycol Distearate @21 (pearlizing wax)'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'cationic_polymer':['Polyquaternium-10 @13','Polyquaternium-7 @15','Guar Hydroxypropyltrimonium Chloride @18'],
   'payload_lipid':['Cocos Nucifera (Coconut) Oil @7','Argania Spinosa (Argan) Kernel Oil @8'],
   'film_former':['Polyimide-1 @12 (film-forming hair polymer)'],'weak_refatter':['Hydrogenated Palm Glycerides Citrate @14','Glyceryl Oleate @16'],
   'pearlizing':['Glycol Distearate @21 (prominent)'],'silicone':[]},
 'humectants':['Glycerin @5','Panthenol @10'],
 'actives':['Tocopheryl Acetate @9','Panthenol @10','Tocopherol @17'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @26 plus Hexyl Cinnamal @27, Tetramethyl Acetyloctahydronaphthalenes @28','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':['Panthenol @10'],'listedHumectantRefattingRoutesProminent':['Glycerin @5','Panthenol @10','Cocos Nucifera Oil @7','Argania Spinosa Kernel Oil @8','Glyceryl Oleate @16'],
   'mildBase':'no: prominent strong anionic Sodium C14-16 Olefin Sulfonate @2 excludes MB','csaHolds':True},
 'preservativesAndOther':['Sodium Benzoate @22','Sodium Salicylate @23','Trisodium Ethylenediamine Disuccinate @24 (chelator)','Isopropanolamine @25 (pH)','Sodium Hydroxide @19','Citric Acid @20','Sodium Chloride @6']}
wl={'wLine':{'position':22,'inci':'Sodium Benzoate','classes':['preservative_or_capped_active']},'cap':{'e3Point':26},'alphabeticalRun':None,
 'skipped':['w_line_skipped:Tocopheryl Acetate@9 (clause ii: Coco-Glucoside@11 cleansing surfactant and Glycol Distearate@21 pearlizing wax listed after it before the cap)',
  'w_line_skipped:Panthenol@10 (clause ii: Coco-Glucoside@11, Glycol Distearate@21 after it)',
  'w_line_skipped:Tocopherol@17 (clause ii: Glycol Distearate@21 after it)'],
 'codes':[],'payloadLipidMaterial':['Cocos Nucifera Oil @7','Argania Spinosa Kernel Oil @8'],'payloadLipidNonMaterial':[]}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C1 ether/sulfonate chassis - defining anionic Sodium C14-16 Olefin Sulfonate @2 with prominent buffers Cocamidopropyl Betaine @4 and Coco-Glucoside @11 and no reinforcing strong anionic. Counter-signals (refatting oils @7-8, glyceryl oleate) recorded; they do not move the convention and no C3b member decides the value.',['C1','C3','C4','E3']),
 'conditioningLevel':prop('high','moderate','moderate','High: C2 met - the prominent payload lipids Coconut Oil @7 and Argan Oil @8 take the place of the early silicone, with prominent cationic polymers (Polyquaternium-10 @13, Polyquaternium-7 @15, Guar HPTC @18), the prominent pearlizing route Glycol Distearate @21 and listed humectants Glycerin @5 / Panthenol @10; Polyimide-1 @12 film former adds a further route. Counter-signal: no silicone, oils sit after Sodium Chloride @6 and the cationics after Panthenol, so each route may be modest; neighbor moderate.',['C2','5','E3','W-RICH','N-ALT']),
 'weightPotential':prop('moderate','moderate','high','Moderate: plausible bounded residue from several converging routes (material oils, three cationic polymers, a film former) against an effective C1 reset; W-RICH holds but reset is not limited, so the rich route does not reach high, and the convergence route is judged not strong enough to outweigh the AOS/betaine/glucoside reset. W-RICH recorded as counter-signal, neighbor high.',
   ['6.6','W-RICH','W-LINE','W2','W3','N-ALT'],
   evidence={'cationic_polymer':['Polyquaternium-10 @13','Polyquaternium-7 @15','Guar Hydroxypropyltrimonium Chloride @18'],'payload_lipid':['Cocos Nucifera Oil @7 (material)','Argania Spinosa Kernel Oil @8 (material)'],
     'weak_refatter':['Hydrogenated Palm Glycerides Citrate @14','Glyceryl Oleate @16'],'silicone':[],'protein_film':[],'film_former':['Polyimide-1 @12'],'cationic_conditioner':[],
     'reset':['Sodium C14-16 Olefin Sulfonate @2 (anionic)','Cocamidopropyl Betaine @4 (amphoteric)','Coco-Glucoside @11 (nonionic)'],'humectantContext':['Glycerin @5','Panthenol @10'],
     'excluded':['Glycol Distearate @21 (pearlizing wax, 6.4)','Cocamide MIPA @3 (alkanolamide thickener)','Tocopheryl Acetate @9 / Tocopherol @17 (antioxidant actives, not deposition)'],'unresolved':[]},
   wLineRecord=wl,depositionLoad='moderate',persistence='moderate',resetCapacity='moderate',
   counterevidence='W-RICH holds (material Coconut/Argan oil @7-8 converging with three cationic polymers and Polyimide-1 film former) - argues for high. Against: the oils sit after Sodium Chloride @6 and all cationics/film former after Panthenol @10, so each route is plausibly small; the AOS @2 + betaine + glucoside C1 chassis is an effective ordinary reset.',
   whyThisBand='Several converging depositing families make noticeable but bounded residue plausible; calling it light would understate it.',
   whyNotNeighborBand='Not high: W-RICH needs limited reset (resetCapacity weak) and the C1 AOS chassis is moderate reset; the convergence route rests on individually late/small routes (cationics @13-18, film former @12) that an effective reset plausibly offsets. Not low: four deposition families including material oils and three cationics (W2).',
   confidenceLimitingFactor='INCI-only prominence of the oils and cationics; band close to high (W-RICH present).'),
 'focusPrimary':focus('moisture_supported',['Glycerin @5','Panthenol @10','Cocos Nucifera Oil @7','Argania Spinosa Kernel Oil @8'],['Polyimide-1 @12 (film)'],['Polyquaternium-10 @13','Polyquaternium-7 @15','Guar HPTC @18'],
   'Humectant plus emollient-oil cluster with cationic deposition; no protein, so repair is weaker.','moisture','the formula verdict is moisture_supported, so a dryness/nourishment claim would make moisture the focus.'),
 'focusSecondary':secondary(['moisture']),
 'usageRole':usage(False),
 'scalpComfortTarget':prop('not_targeted','low','targeted','Provisional, formula-only: positioning (SC1) is hidden, so the default is not_targeted. CSA holds via a prominent listed comfort route (Panthenol @10) and humectant/refatting routes (Glycerin @5, oils @7-8); MB does not apply (prominent AOS @2). A sensitive/dry-scalp claim graded moderate/high would make it targeted.',['10','CSA','MB','SC1','E4','N-ALT']),
 'dandruffSupport':prop('not_supported','high','none','Not supported: the complete INCI contains no Piroctone Olamine, Climbazole or Selenium (Di)Sulfide (Section 11).',['11','DS1'])}
r['unresolvedMaterialIngredients']=[]
r['notes']=['Polyimide-1 read as a film-forming hair polymer (film_former, 6.3); not an anionic acrylate thickener.']
write(r)
