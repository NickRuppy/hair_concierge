import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W203','AQUA (WATER) is one entry (ID-2); no split entries; normalized positions = packet positions.','PARFUM (FRAGRANCE) @9; prominent = positions 1-8 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium C14-16 Olefin Sulfonate @2 (strong anionic, ether/sulfonate type)','reinforcingRoutes':[],'buffers':['Cocamidopropyl Betaine @3 (amphoteric)'],
   'notCleansing':['Cocamide DIPA @4 (alkanolamide)','PEG-150 Distearate @8 (PEG thickener)','Steareth-4 @18 (nonionic emulsifier, not a C3 cleansing class)','Polysorbate 20 @22 (solubilizer)'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'cationic_polymer':['Guar Hydroxypropyltrimonium Chloride @15','Polyquaternium-39 @19'],'payload_lipid':['Butyrospermum Parkii (Shea) Butter @10'],'film_former':['Polyester-37 @11'],'pearlizing':['Glycol Distearate @13 (after E3, not prominent)'],'silicone':[],'weak_refatter':[]},
 'humectants':['Glycerin @5','Panthenol @14'],'actives':['Panthenol @14','Tocopherol @24'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @9, Benzyl Benzoate @25, Coumarin @26','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':[],'listedHumectantRefattingRoutesProminent':['Glycerin @5'],'mildBase':'no: prominent Sodium C14-16 Olefin Sulfonate @2','csaHolds':True},
 'preservativesAndOther':['Acrylates Copolymer @6 (anionic acrylate thickener, excluded 6.4)','Phenoxyethanol @7','Sodium Hydroxide @12','Ethylhexylglycerin @16','Disodium EDTA @17','Sodium Benzoate @20','Citric Acid @21','Sodium Chloride @23']}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C1 - defining anionic Sodium C14-16 Olefin Sulfonate @2 buffered by prominent Cocamidopropyl Betaine @3, no reinforcing strong anionic; Cocamide DIPA @4 is not a buffer.',['C1','C3','C4','E3']),
 'conditioningLevel':prop('moderate','moderate','low','Moderate: several light routes rather than one prominent system - two cationic polymers (Guar HPTC @15, Polyquaternium-39 @19), Shea Butter @10, film former Polyester-37 @11, Glycol Distearate @13, humectants Glycerin @5 / Panthenol @14. C2 not met: nothing but Glycerin is prominent (all routes after Parfum @9). Counter-signal: every conditioning route is post-E3 and plausibly small, so low is the neighbor.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('moderate','moderate','low','Moderate: four interacting deposition families (two cationic polymers, a film former, shea butter) make bounded residue plausible even though all are listed late; the C1 reset is effective, so nothing points to high.',
   ev(cp=['Guar Hydroxypropyltrimonium Chloride @15','Polyquaternium-39 @19'],pl=['Butyrospermum Parkii Butter @10 (non-material: after W-line @7)'],ff=['Polyester-37 @11'],
      reset=['Sodium C14-16 Olefin Sulfonate @2','Cocamidopropyl Betaine @3'],hum=['Glycerin @5','Panthenol @14'],
      exc=['Acrylates Copolymer @6 (anionic acrylate thickener, 6.4)','PEG-150 Distearate @8 (PEG thickener, 6.4)','Glycol Distearate @13 (pearlizing wax, 6.4)','Cocamide DIPA @4 (alkanolamide)','Steareth-4 @18, Polysorbate 20 @22 (emulsifier/solubilizer)']),
   wline(7,'Phenoxyethanol',['preservative_or_capped_active'],{'e3Point':9},nonmat=['Butyrospermum Parkii Butter @10']),
   'moderate','moderate','moderate',
   'All deposition routes are post-Parfum (@10-19) and plausibly small; shea butter is non-material under W-LINE; strong-ish AOS reset.',
   'Two cationic polymers, a film-forming polyester and shea butter converge (W2); calling it lightweight would understate the combined residue risk.',
   'Not low: four distinct deposition families including two cationic polymers and a film former (W2) - a lateness argument alone does not establish that the combined residue stays below noticeable. Not high: no material payload lipid (shea after the W-line @7), no W-RICH, effective C1 reset.',
   'Late positions of every deposition route; low/moderate boundary.'),
 'focusPrimary':focus('nonspecific',['Glycerin @5','Panthenol @14','Shea Butter @10'],['Polyester-37 @11'],['Guar HPTC @15','Polyquaternium-39 @19'],'Light, late routes; no coherent repair or moisture cluster.','volume','a film-forming polyester with light, late conditioning is most compatible with a body/volume role.'),
 'focusSecondary':secondary(['volume']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_holds('CSA holds only via the prominent listed humectant route Glycerin @5 (no prominent listed comfort route: Panthenol @14 is after Parfum); MB does not apply (prominent AOS @2). An S-SENSITIVE gate would therefore fail (no prominent comfort route, no MB).'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=[]
write(r)
