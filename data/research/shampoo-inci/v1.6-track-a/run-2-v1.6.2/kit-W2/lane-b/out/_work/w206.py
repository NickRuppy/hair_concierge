import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W206','Aqua [Water] and Parfum [Fragrance] are single entries (ID-2); no split entries; normalized positions = packet positions.','Parfum [Fragrance] @6; prominent = positions 1-5 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':None,'c6EarliestProminentCleansing':'Disodium Laureth Sulfosuccinate @2 (mild anionic)','prominentCoSurfactants':['Cocamidopropyl Hydroxysultaine @3 (amphoteric)','Cocamidopropyl Betaine @4 (amphoteric)'],
   'reinforcingRoutes':[],'buffers':['Cocamidopropyl Hydroxysultaine @3','Cocamidopropyl Betaine @4'],
   'notCleansing':['PEG-18 Glyceryl Oleate/Cocoate @5 (PEG glyceryl ester refatter)','Glycol Distearate @14','Cocamide MEA @18 (alkanolamide)','Laureth-10 @19 (ethoxylate, not a C3 cleansing class)'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'weak_refatter':['PEG-18 Glyceryl Oleate/Cocoate @5'],'protein_film':['Avena Sativa (Oat) Peptide @8'],'cationic_polymer':['Polyquaternium-11 @17'],'payload_lipid':['C13-15 Alkane @21 (emollient hydrocarbon)'],'pearlizing':['Glycol Distearate @14 (after E3)'],'silicone':[]},
 'humectants':['Panthenol @7','Glycerin @22'],'actives':['Panthenol @7','Avena Sativa (Oat) Peptide @8'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @6, Tetramethyl Acetyloctahydronaphthalenes @16, Linalyl Acetate @23, Hexyl Cinnamal @28, Linalool @29, Limonene @30','coolingAgents':[],'essentialOils':['Juniperus Virginiana Oil @12','Citrus Aurantium Peel Oil @13 (both after Parfum, not prominent)']},
 'csa':{'listedComfortRoutesProminent':[],'listedHumectantRefattingRoutesProminent':[],'mildBase':'mild_base:Disodium Laureth Sulfosuccinate @2, Cocamidopropyl Hydroxysultaine @3, Cocamidopropyl Betaine @4 (cleansingStrength low, no prominent strong anionic)','csaHolds':True,
   'unlistedRouteCandidates':['unlisted_route_candidate:PEG-18 Glyceryl Oleate/Cocoate (prominent @5; rejected by R18, not on the E4 humectant/refatting list)'],
   'note':'CSA holds via MB only; Panthenol @7 (listed comfort/humectant) is after Parfum, so not prominent. MB never passes S-DRY.'},
 'preservativesAndOther':['Gardenia Taitensis Flower Extract @9','Lycium Barbarum Fruit Extract @10','Malva Sylvestris Extract @11','Citric Acid @15','Propylene Glycol @20','Methylchloroisothiazolinone @24','Methylisothiazolinone @25','1,2-Hexanediol @26','Caprylyl Glycol @27']}
r['directProperties']={
 'cleansingStrength':prop('low','high','none','Low: C6 - no prominent strong anionic; the earliest prominent cleansing surfactant is the mild anionic Disodium Laureth Sulfosuccinate @2 with prominent amphoteric co-surfactants Cocamidopropyl Hydroxysultaine @3 and Cocamidopropyl Betaine @4.',['C6','C3','C4','E3']),
 'conditioningLevel':prop('low','moderate','moderate','Low: little substantive slip - the only prominent route is the refatter PEG-18 Glyceryl Oleate/Cocoate @5; Oat Peptide @8, Glycol Distearate @14 and a single film-forming cationic Polyquaternium-11 @17 are all after Parfum. C2 not met. Neighbor moderate: these several light routes could add up to noticeable care.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('low','moderate','moderate','Low: deposition is light - one prominent PEG glyceryl ester refatter, with a late oat peptide, a late Polyquaternium-11 and a trace alkane; the mild chassis gives weak reset but there is little to offset.',
   ev(cp=['Polyquaternium-11 @17'],pl=['C13-15 Alkane @21 (non-material: after W-line @6)'],wr=['PEG-18 Glyceryl Oleate/Cocoate @5'],pf=['Avena Sativa (Oat) Peptide @8'],
      reset=['Disodium Laureth Sulfosuccinate @2','Cocamidopropyl Hydroxysultaine @3','Cocamidopropyl Betaine @4'],hum=['Panthenol @7','Glycerin @22'],
      exc=['Glycol Distearate @14 (pearlizing wax, 6.4)','Juniperus Virginiana Oil @12, Citrus Aurantium Peel Oil @13 (fragrance oils, 6.4)','Cocamide MEA @18 (alkanolamide)','Laureth-10 @19']),
   wline(6,'Parfum [Fragrance]',['fragrance'],{'e3Point':6},nonmat=['C13-15 Alkane @21']),
   'light','low','weak',
   'Four families present (weak_refatter, protein_film, cationic_polymer, payload_lipid) and the mild C6 chassis gives weak reset (W2).',
   'The only prominent deposition is a light PEG glyceryl ester refatter; the other routes are post-Parfum traces.',
   'Not moderate: each non-refatter family is late/trace - Oat Peptide @8, Polyquaternium-11 @17 (after Glycol Distearate and Cocamide MEA) and C13-15 Alkane @21 (after the W-line) - and the only prominent route is a weak_refatter, so even weak reset faces only light routes (W2 reason: late/trace families).',
   'Weak reset means even light routes could accumulate; INCI-only.'),
 'focusPrimary':focus('nonspecific',['Panthenol @7'],['Avena Sativa (Oat) Peptide @8'],['PEG-18 Glyceryl Oleate/Cocoate @5','Polyquaternium-11 @17'],'Light routes; no coherent repair or moisture cluster.','scalp_active','a mild base with oat peptide and panthenol is most compatible with a sensitive-scalp positioning.'),
 'focusSecondary':secondary(['scalp_active']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_holds('CSA holds via MB (mild_base: Disodium Laureth Sulfosuccinate @2, Cocamidopropyl Hydroxysultaine @3, Cocamidopropyl Betaine @4); no listed comfort or humectant route is prominent (Panthenol @7 after Parfum @6), so an S-DRY gate would fail (unlisted_route_candidate:PEG-18 Glyceryl Oleate/Cocoate) while S-SENSITIVE can pass via MB.'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=[]
r['notes']=['C13-15 Alkane read as an emollient hydrocarbon in payload_lipid (conservative); it is post-line either way.','PEG-18 Glyceryl Oleate/Cocoate read as weak_refatter by analogy with PEG-7 Glyceryl Cocoate (6.3); it is not on the E4 list (R18 rejection).']
write(r)
