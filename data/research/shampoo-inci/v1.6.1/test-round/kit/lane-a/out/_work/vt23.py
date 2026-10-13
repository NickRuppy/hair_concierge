import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from common import *
r,d=base('VT23')
r['formulaFacts']={
 'e3Point':{'position':21,'inci':'PARFUM / FRAGRANCE'},
 'surfactants':[
  {'inci':'COCAMIDOPROPYL BETAINE','position':2,'class':'amphoteric (earliest cleansing surfactant)','prominent':True},
  {'inci':'SODIUM LAURYL GLUCOSE CARBOXYLATE','position':4,'class':'mild anionic (assigned by chemistry: glucoside carboxylate, closest to ether carboxylates)','prominent':True},
  {'inci':'LAURYL GLUCOSIDE','position':6,'class':'nonionic cleansing (glucoside)','prominent':True},
  {'inci':'SODIUM LAUROYL METHYL ISETHIONATE','position':7,'class':'mild anionic (isethionate)','prominent':True},
  {'inci':'COCO-GLUCOSIDE','position':12,'class':'nonionic cleansing (glucoside)','prominent':True},
  {'inci':'POLYSORBATE 20','position':13,'class':'not a cleansing route (solubilizer)'}],
 'conditioningRoutes':{'weak_refatter':['GLYCERYL OLEATE@10'],'silicone':[],'cationic_polymer':[],'cationic_conditioner':[],'payload_lipid':[],'pearlizing_fatty_route':[],'humectants':['GLYCERIN@5','PROPYLENE GLYCOL@3 (solvent)']},
 'actives':['SELENIUM SULFIDE@9','TARAXACUM OFFICINALE ROOT EXTRACT@11'],
 'scalpRelevant':{'e4ComfortRoutesProminent':[],'e4HumectantRefattingProminent':['GLYCERIN@5','GLYCERYL OLEATE@10'],'coolingAgents':[],'essentialOilsOrAllergens':['LINALOOL@20 (before Parfum)'],'recognizedDandruffActives':['SELENIUM SULFIDE@9']},
 'preservatives':['SODIUM BENZOATE@14','POTASSIUM SORBATE@18','2-BROMO-2-NITROPROPANE-1,3-DIOL@19 (preservative not on the closed W-LINE b list or the E3 list)','SELENIUM SULFIDE@9 (capped active)'],
 'labelFact':'Selenium sulfide: EU Annex III anti-dandruff-only active, max 1 % (DS1); informational only, no copy.'}
r['wLine']={'wLine':{'position':14,'inci':'SODIUM BENZOATE','classes':['preservative_or_capped_active']},
 'cap':{'e3Point':21},'alphabeticalRun':None,
 'skipped':['w_line_skipped:SELENIUM SULFIDE@9 (clause ii: COCO-GLUCOSIDE@12, a cleansing surfactant, is listed after it and before the cap)'],
 'codes':[],'payloadLipidMaterial':[],'payloadLipidNonMaterial':[],
 'derivation':'SELENIUM SULFIDE@9 (class b): (i) holds (COCAMIDOPROPYL BETAINE@2), (ii) fails on COCO-GLUCOSIDE@12. SODIUM BENZOATE@14 (class b): (i) holds; (ii) between 14 and the cap 21 only Citric Acid, Sodium Chloride, Trisodium Ethylenediamine Disuccinate, Potassium Sorbate, 2-Bromo-2-Nitropropane-1,3-Diol, Linalool -> plausible. W-line 14. No alphabetical run. The formula has no payload_lipid, so the W-line gates nothing.'}
wt={'cationic_polymer':[],'payload_lipid':[],'weak_refatter':['GLYCERYL OLEATE@10'],'silicone':[],'protein_film':[],'film_former':[],'cationic_conditioner':[],
 'reset':['COCAMIDOPROPYL BETAINE@2 (amphoteric)','SODIUM LAURYL GLUCOSE CARBOXYLATE@4 (mild anionic)','LAURYL GLUCOSIDE@6 (nonionic)','SODIUM LAUROYL METHYL ISETHIONATE@7 (mild anionic)','COCO-GLUCOSIDE@12 (nonionic)'],
 'humectantContext':['GLYCERIN@5','PROPYLENE GLYCOL@3'],
 'excluded':['ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER@8 (anionic acrylate rheology polymer suspending the selenium sulfide, 6.4)','POLYSORBATE 20@13 (solubilizer)','TARAXACUM OFFICINALE ROOT EXTRACT@11 (extract)','SELENIUM SULFIDE@9 (active)'],
 'unresolved':[]}
dp={}
dp['cleansingStrength']=prop('low','high','none',
 'low by C6: no prominent strong anionic; the earliest prominent cleansing surfactant is the amphoteric COCAMIDOPROPYL BETAINE@2, supported by glucosides (LAURYL GLUCOSIDE@6, COCO-GLUCOSIDE@12). Counter-signal recorded: two mild anionics (SODIUM LAURYL GLUCOSE CARBOXYLATE@4, SODIUM LAUROYL METHYL ISETHIONATE@7); in an amphoteric-led chassis they do not realistically move the value.',
 ['C3','C4','C6','N-ALT'])
dp['conditioningLevel']=prop('low','high','none',
 'low: cleansing-led architecture with little substantive slip - no silicone, cationic polymer, cationic conditioner, payload lipid or pearlizer; only the weak refatter GLYCERYL OLEATE@10 and GLYCERIN@5. C2 not met.',
 ['5','C2','N-ALT'])
dp['weightPotential']=prop('low','high','none',
 'low: deposition is absent apart from one weak refatter (GLYCERYL OLEATE@10); no silicone, cationic, lipid, protein or film-former family; the mild amphoteric/glucoside chassis (reset weak) faces almost nothing to remove. The acrylate crosspolymer@8 is a suspending agent (excluded, 6.4).',
 ['6.6','6.4','W2','N-ALT'],
 evidence=wt, depositionLoad='light', persistence='low', resetCapacity='weak',
 counterevidence='Glycerin@5 and Glyceryl Oleate@10 give light refatting; reset is weak.',
 whyThisBand='Only a single weak refatter is present; nothing in the formula is designed to deposit or persist.',
 whyNotNeighborBand='moderate needs at least one plausibly persistent depositing system; none exists (W2 does not apply: only one deposition family, weak_refatter, plus humectants).',
 confidenceLimitingFactor='None material: complete formula, all ingredients recognized, no deposition system.')
dp['focusPrimary']=focus_prov('nonspecific',['GLYCERIN@5','GLYCERYL OLEATE@10'],[],[],'No conditioning system; the formula is a mild cleansing base with an anti-dandruff active.','scalp_active','Formula-led route that could matter: recognized dandruff active SELENIUM SULFIDE@9 (DS1) in a mild chassis.')
dp['focusSecondary']=secondary_prov(['scalp_active'])
dp['usageRole']=usage_prov('treatment','treatment becomes possible because dandruffSupport is supported (needs a qualifying E2 dandruff claim, U3); frequent possible with frequency wording; alternating impossible (not strong).')
dp['scalpComfortTarget']=scalp_prov('CSA would pass only through the humectant/refatting list (GLYCERIN@5, GLYCERYL OLEATE@10 prominent); there is no E4 comfort route, so an S-SENSITIVE gate would fail; an S-DRY gate could pass.','Supportive: mild C6 chassis (not sufficient alone). Counter-signals: declared Parfum@21, Linalool@20.')
dp['dandruffSupport']=dandruff('SELENIUM SULFIDE@9')
r['directProperties']=dp
r['unresolvedMaterialIngredients']=[]
r['provisionalNotes']=['focusPrimary, focusSecondary, usageRole and scalpComfortTarget are claim-dependent and provisional (formula-only).','dandruffSupport supported via DS1 (selenium sulfide); a dandruff target depends on a qualifying E2 dandruff claim (S-DANDRUFF, R17.3).','focusSecondary neighbor ["scalp_active"] reflects that scalp_active may become primary or secondary after the reveal; it is a provisional neighbor only.']
write('VT23',r)
