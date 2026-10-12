import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from common import *
r,d=base('VT14')
r['formulaFacts']={
 'e3Point':{'position':31,'inci':'Parfum/Fragrance'},
 'surfactants':[
  {'inci':'Sodium Lauroyl Methyl Isethionate','position':2,'class':'mild anionic (isethionate)','prominent':True},
  {'inci':'Cocamidopropyl Betaine','position':3,'class':'amphoteric (buffer)','prominent':True},
  {'inci':'Disodium Laureth Sulfosuccinate','position':4,'class':'mild anionic (sulfosuccinate)','prominent':True},
  {'inci':'Sodium Lauryl Sulfoacetate','position':5,'class':'mild anionic (sulfoacetate)','prominent':True},
  {'inci':'Trideceth-5','position':18,'class':'not a cleansing route (low-ethoxylate emulsifier)'},
  {'inci':'PEG-150 Pentaerythrityl Tetrastearate','position':20,'class':'not a cleansing route (PEG thickener)'},
  {'inci':'PPG-2 Hydroxyethyl Cocamide','position':22,'class':'not a cleansing route (alkanolamide-type thickener, W-LINE item 2 type 2)'}],
 'conditioningRoutes':{'payload_lipid':['Argania Spinosa Kernel Oil@7','Helianthus Annuus (Sunflower) Seed Oil@9'],'protein_film':['Hydrolyzed Wheat Protein@8','Hydrolyzed Vegetable Protein PG-Propyl Silanetriol@12'],'cationic_polymer':['Guar Hydroxypropyltrimonium Chloride@13'],'cationic_conditioner':['Lauryl Methyl Gluceth-10 Hydroxypropyldimonium Chloride@15','Quaternium-95@21'],'silicone':['Amodimethicone/Morpholinomethyl Silsesquioxane Copolymer@16 (amino-functional silicone copolymer)'],'pearlizing_fatty_route':['Glycol Distearate@11'],'humectants':['Glycerin@6','Sodium PCA@14','Propanediol@23 (solvent)']},
 'actives':[],
 'scalpRelevant':{'e4ComfortRoutesProminent':[],'e4HumectantRefattingProminent':['Glycerin@6','Argania Spinosa Kernel Oil@7','Helianthus Annuus (Sunflower) Seed Oil@9','Sodium PCA@14'],'coolingAgents':[],'essentialOilsOrAllergens':['Alpha-Isomethyl Ionone@25 (before Parfum)'],'recognizedDandruffActives':[]},
 'preservatives':['Dehydroacetic Acid@19','Benzoic Acid@26','Potassium Sorbate@28','Phenoxyethanol@30']}
r['wLine']={'wLine':{'position':25,'inci':'Alpha-Isomethyl Ionone','classes':['fragrance']},
 'cap':{'e3Point':31},'alphabeticalRun':None,
 'skipped':['w_line_skipped:Dehydroacetic Acid@19 (clause ii: PPG-2 Hydroxyethyl Cocamide@22, an alkanolamide-type thickener, is listed after it and before the cap)'],
 'codes':[],
 'payloadLipidMaterial':['Argania Spinosa Kernel Oil@7','Helianthus Annuus (Sunflower) Seed Oil@9'],'payloadLipidNonMaterial':[],
 'derivation':'First candidate Dehydroacetic Acid@19 (class b): (i) holds, (ii) fails on PPG-2 Hydroxyethyl Cocamide@22. Next candidate Alpha-Isomethyl Ionone@25 (class a, closed allergen list): (i) Sodium Lauroyl Methyl Isethionate@2 before it; (ii) between 25 and the cap 31 only Benzoic Acid, Lactic Acid, Potassium Sorbate, Disodium EDTA, Phenoxyethanol -> plausible. No alphabetical run of >=7 entries.'}
wt={'cationic_polymer':['Guar Hydroxypropyltrimonium Chloride@13'],'payload_lipid':['Argania Spinosa Kernel Oil@7 (material)','Helianthus Annuus (Sunflower) Seed Oil@9 (material)'],'weak_refatter':[],'silicone':['Amodimethicone/Morpholinomethyl Silsesquioxane Copolymer@16'],'protein_film':['Hydrolyzed Wheat Protein@8','Hydrolyzed Vegetable Protein PG-Propyl Silanetriol@12'],'film_former':[],'cationic_conditioner':['Lauryl Methyl Gluceth-10 Hydroxypropyldimonium Chloride@15','Quaternium-95@21'],
 'reset':['Sodium Lauroyl Methyl Isethionate@2 (mild anionic)','Cocamidopropyl Betaine@3 (amphoteric)','Disodium Laureth Sulfosuccinate@4 (mild anionic)','Sodium Lauryl Sulfoacetate@5 (mild anionic)'],
 'humectantContext':['Glycerin@6','Sodium PCA@14','Propanediol@23'],
 'excluded':['Glycol Distearate@11 (pearlizing wax, 6.4)','PEG-150 Pentaerythrityl Tetrastearate@20 (PEG thickener, 6.4)','Trideceth-5@18 (emulsifier)','Phyllostachys Nigra Leaf Extract@10 (botanical extract)','Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate@24 (antioxidant)'],
 'unresolved':[]}
dp={}
dp['cleansingStrength']=prop('low','high','none',
 'low by C6: no prominent strong anionic; the earliest prominent cleansing surfactant is the mild anionic Sodium Lauroyl Methyl Isethionate@2 with the prominent amphoteric co-surfactant Cocamidopropyl Betaine@3 directly behind it. Counter-signal recorded: two further mild anionics (Disodium Laureth Sulfosuccinate@4, Sodium Lauryl Sulfoacetate@5) and the foam-boosting PPG-2 Hydroxyethyl Cocamide@22; with the betaine in second place they do not realistically move the convention value.',
 ['C3','C4','C6','N-ALT'])
dp['conditioningLevel']=prop('high','high','none',
 'high: C2 is met with prominent elements - silicone Amodimethicone/Morpholinomethyl Silsesquioxane Copolymer@16 (and prominent payload lipids Argania Spinosa Kernel Oil@7, Sunflower Seed Oil@9), cationic polymer Guar Hydroxypropyltrimonium Chloride@13, pearlizing route Glycol Distearate@11, humectants Glycerin@6 and Sodium PCA@14. A rich architecture (W-RICH, E3 reading) also holds: prominent payload lipids converge with silicone and cationic deposition (plus cationic conditioners @15, @21 and proteins @8, @12). Counter-signal: the silicone copolymer sits after Sodium PCA, so it may be a low-dose route; with oils, guar and two quats also present this does not plausibly move the value.',
 ['C2','W-RICH','E3','N-ALT'])
dp['weightPotential']=prop('high','moderate','moderate',
 'high: W-RICH with limited reset - material payload lipids Argania Spinosa Kernel Oil@7 and Sunflower Seed Oil@9 (before the W-line Alpha-Isomethyl Ionone@25) converge with persistent amino-silicone (@16) and cationic deposition (Guar@13, quats @15, @21) in a mild C6 chassis (resetCapacity weak); the convergence route also holds (payload_lipid + silicone + cationic_polymer + cationic_conditioner + protein_film). Confidence moderate, neighbor moderate: liquid oils and a single guar at mid-list leave realistic room for a bounded result.',
 ['6.6','6.7','W-RICH','W-LINE','W3','P0','N-ALT'],
 evidence=wt, depositionLoad='moderate', persistence='moderate', resetCapacity='weak',
 counterevidence='The lipids are liquid oils (less persistent than butters/waxes); each cationic route is listed once and after Glycerin; the silicone is an amino-silicone copolymer after Sodium PCA (likely low dose).',
 whyThisBand='Five deposition families converge, the lipid leg is material under W-LINE, and the isethionate/betaine/sulfosuccinate chassis offers only weak reset, so the high anchor rich route (W-RICH + limited reset) is met.',
 whyNotNeighborBand='moderate would need either an effective reset that offsets the deposition or evidence that the converging systems are light; the chassis is mild (C6 low) and five families converge, so moderate would understate the residue risk (P0).',
 confidenceLimitingFactor='Actual oil and silicone levels are unknown; liquid oils at positions 7/9 could be small additions.')
dp['focusPrimary']=focus_prov('dual_supported',['Glycerin@6','Sodium PCA@14','Argania Spinosa Kernel Oil@7','Helianthus Annuus (Sunflower) Seed Oil@9'],['Hydrolyzed Wheat Protein@8','Hydrolyzed Vegetable Protein PG-Propyl Silanetriol@12','Amodimethicone/Morpholinomethyl Silsesquioxane Copolymer@16','Lauryl Methyl Gluceth-10 Hydroxypropyldimonium Chloride@15'],['Guar Hydroxypropyltrimonium Chloride@13','Glycol Distearate@11','Quaternium-95@21'],'Rinse-off context; protein and humectant clusters both present, so claims must break the tie.','repair','Humectant cluster plus oils supports moisture; two proteins plus amino-silicone and quats support repair.')
dp['focusSecondary']=secondary_prov(['moisture'])
dp['usageRole']=usage_prov('frequent','alternating impossible (not strong); treatment impossible (no active); frequent or occasional_reset remain claim-dependent.')
dp['scalpComfortTarget']=scalp_prov('CSA would pass through the humectant/refatting list (Glycerin@6, Argan Oil@7, Sunflower Seed Oil@9, Sodium PCA@14 all prominent), but no E4 comfort route (Panthenol, Allantoin, Bisabolol, ...) is present, so an S-SENSITIVE gate would fail while an S-DRY gate could pass.','Counter-signals: declared Parfum@31 with Alpha-Isomethyl Ionone@25; no cooling agent.')
dp['dandruffSupport']=dandruff(None)
r['directProperties']=dp
r['unresolvedMaterialIngredients']=[]
r['provisionalNotes']=['focusPrimary, focusSecondary, usageRole and scalpComfortTarget are claim-dependent and provisional (formula-only).']
write('VT14',r)
