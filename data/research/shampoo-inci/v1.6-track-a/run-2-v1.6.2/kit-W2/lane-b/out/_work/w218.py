import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W218','No synonym or split entries; normalized positions = packet positions (ID-2).','Parfum @9; prominent = positions 1-8 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':None,'c6EarliestProminentCleansing':'Cocamidopropyl Betaine @3 (amphoteric)','prominentCoSurfactants':['Sodium Cocoyl Isethionate @4 (mild anionic)'],
   'reinforcingRoutes':[],'buffers':['Cocamidopropyl Betaine @3','Sodium Cocoyl Isethionate @4'],
   'nonProminentSurfactants':['Sodium Isethionate @18 (isethionate salt, recorded)','Coco-Glucoside @19 (after E3)'],
   'notCleansing':['Glycol Distearate @16','Coconut Acid @15 (free fatty acid, in no named C3 class)'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'cationic_polymer':['Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @17'],'weak_refatter':['Glyceryl Oleate @11','Coconut Acid @15','Glyceryl Stearate @21 (monoglyceride emulsifier, read as weak refatter)'],'pearlizing':['Glycol Distearate @16 (after E3)'],'payload_lipid':[],'silicone':[]},
 'humectants':['Glycerin @10','PCA @12','Sodium PCA @20','amino acids (Arginine @6, Serine @7, Glycine @13, Histidine @14, Aspartic Acid @22 ... Phenylalanine @28)'],
 'actives':['Aloe Barbadensis Leaf Juice @2','Arginine @6','Serine @7','Linum Usitatissimum Seed Extract @8'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @9 (no allergens declared)','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':[],'listedHumectantRefattingRoutesProminent':[],
   'mildBase':'mild_base:Cocamidopropyl Betaine @3, Sodium Cocoyl Isethionate @4 (cleansingStrength low, no prominent strong anionic)','csaHolds':True,
   'unlistedRouteCandidates':['unlisted_route_candidate:Aloe Barbadensis Leaf Juice (prominent @2; rejected by R18)','unlisted_route_candidate:Arginine (prominent @6; rejected by R18)'],
   'note':'CSA holds via MB only; Glycerin @10 and Sodium PCA @20 are listed humectant routes but after Parfum @9, so an S-DRY gate would fail.'},
 'preservativesAndOther':['Sodium Chloride @5','Phenoxyethanol @29','Ethylhexylglycerin @30','Benzoic Acid @31','Citric Acid @32','Sodium Lactate @33']}
r['directProperties']={
 'cleansingStrength':prop('low','high','none','Low: C6 - no strong anionic; the earliest prominent cleansing surfactant is the amphoteric Cocamidopropyl Betaine @3 (with the mild anionic Sodium Cocoyl Isethionate @4).',['C6','C3','C4','E3']),
 'conditioningLevel':prop('low','moderate','moderate','Low: nothing substantive is prominent - the prominent entries are aloe juice, surfactants, salt and amino acids; the guar HPG-HPTC @17, Glyceryl Oleate @11, Glycol Distearate @16 and Glycerin @10 are all after Parfum @9. C2 not met. Neighbor moderate: the late guar, refatters, pearlizer and humectants could add up to several light routes.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('low','moderate','moderate','Low: one late cationic guar plus weak refatters; no silicone, payload lipid, protein or film former. The mild chassis gives weak reset, but there is little to offset.',
   ev(cp=['Hydroxypropyl Guar Hydroxypropyltrimonium Chloride @17'],wr=['Glyceryl Oleate @11','Coconut Acid @15','Glyceryl Stearate @21'],reset=['Cocamidopropyl Betaine @3','Sodium Cocoyl Isethionate @4','Sodium Isethionate @18','Coco-Glucoside @19'],
      hum=['Glycerin @10','PCA @12','Sodium PCA @20','free amino acids @6-7, @13-14, @22-28'],
      exc=['Glycol Distearate @16 (pearlizing wax, 6.4)','Aloe Barbadensis Leaf Juice @2, Linum Usitatissimum Seed Extract @8 (juice/extract)']),
   wline(9,'Parfum',['fragrance'],{'e3Point':9}),
   'light','low','weak',
   'Two families (cationic_polymer + weak_refatter, W2) and weak reset from the mild C6 chassis.',
   'Deposition is one late guar and light refatters; weak reset does not create residue where little is deposited.',
   'Not moderate: the only families are one guar polymer listed late (@17, after Parfum and Glycol Distearate) and weak_refatter monoglycerides/fatty acid (W2 reason: weak refatters plus one late light polymer), so even a weak reset faces only light routes.',
   'Weak reset could let light routes accumulate; INCI-only.'),
 'focusPrimary':focus('nonspecific',['Glycerin @10','PCA @12','Sodium PCA @20','amino acids'],[],['HPG-HPTC @17','Glyceryl Oleate @11'],'Humectant/amino-acid routes are late and conditioning support is light; not a coherent moisture cluster.','moisture','aloe, amino acids, PCA and glycerin make a hydration claim the most plausible specialist role.'),
 'focusSecondary':secondary(['moisture']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_holds('CSA holds via MB (mild_base: Cocamidopropyl Betaine @3, Sodium Cocoyl Isethionate @4); no listed comfort or humectant route is prominent (Glycerin @10 after Parfum @9), so S-DRY would fail (unlisted_route_candidate:Aloe Barbadensis Leaf Juice, Arginine) while S-SENSITIVE can pass via MB.'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=[]
r['notes']=['Glyceryl Stearate @21 read as weak_refatter (monoglyceride, by analogy with Glyceryl Oleate); if read as payload_lipid it is after the W-line @9 and non-material either way.','Coconut Acid @15 read as a light refatter/fatty acid, not a C3 cleansing class; it is after E3 either way.']
write(r)
