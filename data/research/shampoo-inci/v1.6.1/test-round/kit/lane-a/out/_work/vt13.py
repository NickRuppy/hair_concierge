import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from common import *
r,d=base('VT13')
r['formulaFacts']={
 'e3Point':{'position':45,'inci':'Fragrance (Parfum)','note':'Fragrance is declared after the preservatives and Citric Acid; prominence (E3) therefore covers positions 1-44.'},
 'surfactants':[
  {'inci':'Sodium Cocoyl Isethionate','position':2,'class':'mild anionic (isethionate)','prominent':True},
  {'inci':'Disodium Laureth Sulfosuccinate','position':3,'class':'mild anionic (sulfosuccinate)','prominent':True},
  {'inci':'Cocamide MIPA','position':4,'class':'not a cleansing route (alkanolamide foam booster/thickener)','prominent':True},
  {'inci':'Cocamidopropyl Hydroxysultaine','position':5,'class':'amphoteric (buffer)','prominent':True},
  {'inci':'Sodium Lauryl Sulfoacetate','position':6,'class':'mild anionic (sulfoacetate)','prominent':True},
  {'inci':'Sodium Methyl Cocoyl Taurate','position':33,'class':'mild anionic (taurate)','prominent':True},
  {'inci':'Trideceth-6 / Trideceth-12 / Polysorbate 20','position':[34,35,36],'class':'not a cleansing route (emulsifiers/solubilizers)'}],
 'conditioningRoutes':{'silicone':['Amodimethicone@30','Silicone Quaternium-18@31'],'cationic_polymer':['Polyquaternium-10@37'],'cationic_conditioner':['Cetrimonium Chloride@29','Quaternium-95@32'],'payload_lipid':['Butyrospermum Parkii (Shea) Butter@19','Oenothera Biennis (Evening Primrose) Oil@20','Rosa Canina Fruit Oil@24','Jojoba Esters@25'],'weak_refatter':['Ascorbyl Palmitate@14'],'protein_film':['Hydrolyzed Milk Protein@26'],'pearlizing_fatty_route':['Glycol Distearate@7'],'humectants':['Glycerin@8','Panthenol@11','Butylene Glycol@27 (solvent, not a C2 humectant)','Propanediol@28 (solvent)']},
 'actives':['Retinyl Palmitate@9','Ascorbic Acid@10','Panthenol@11','Tocopherol@12','Biotin@13','Ascorbyl Palmitate@14','Tocopheryl Acetate@15','Pyridoxine HCl@16'],
 'scalpRelevant':{'e4ComfortRoutesProminent':['Panthenol@11'],'e4HumectantRefattingProminent':['Glycerin@8','Panthenol@11','Butyrospermum Parkii (Shea) Butter@19','Oenothera Biennis (Evening Primrose) Oil@20','Rosa Canina Fruit Oil@24'],'coolingAgents':[],'essentialOilsOrAllergens':['Citrus Aurantium Bergamia (Bergamot) Fruit Extract@17 (extract)','Benzyl Benzoate@46','Limonene@47','Benzyl Alcohol@48 (all after the E3 point)'],'recognizedDandruffActives':[]},
 'preservatives':['Phenoxyethanol@40','Chlorphenesin@41','Potassium Sorbate@42','Sodium Benzoate@43','Benzyl Alcohol@48']}
r['wLine']={'wLine':{'position':40,'inci':'Phenoxyethanol','classes':['preservative_or_capped_active']},
 'cap':{'e3Point':45},'alphabeticalRun':None,
 'skipped':['w_line_skipped:Panthenol@11 (clause ii: Sodium Methyl Cocoyl Taurate@33, a cleansing surfactant, is listed after it and before the cap)',
            'w_line_skipped:Tocopherol@12 (clause ii: Sodium Methyl Cocoyl Taurate@33)',
            'w_line_skipped:Biotin@13 (clause ii: Sodium Methyl Cocoyl Taurate@33)',
            'w_line_skipped:Tocopheryl Acetate@15 (clause ii: Sodium Methyl Cocoyl Taurate@33)'],
 'codes':[],
 'payloadLipidMaterial':['Butyrospermum Parkii (Shea) Butter@19','Oenothera Biennis (Evening Primrose) Oil@20','Rosa Canina Fruit Oil@24','Jojoba Esters@25'],
 'payloadLipidNonMaterial':[],
 'derivation':'Candidates tested in list order. Panthenol@11, Tocopherol@12, Biotin@13 and Tocopheryl Acetate@15 (class c) each have a cleansing surfactant before them (i) but Sodium Methyl Cocoyl Taurate@33 after them before the cap, so (ii) fails. Phenoxyethanol@40 (class b): Sodium Cocoyl Isethionate@2 before it; between 40 and the cap 45 only Chlorphenesin, Potassium Sorbate, Sodium Benzoate, Citric Acid (no cleansing surfactant, alkanolamide or pearlizing wax) -> plausible. No alphabetical run of >=7 entries.'}
wt={'cationic_polymer':['Polyquaternium-10@37'],'payload_lipid':['Butyrospermum Parkii (Shea) Butter@19 (material)','Oenothera Biennis (Evening Primrose) Oil@20 (material)','Rosa Canina Fruit Oil@24 (material)','Jojoba Esters@25 (material, waxy esters)'],'weak_refatter':['Ascorbyl Palmitate@14'],'silicone':['Amodimethicone@30','Silicone Quaternium-18@31'],'protein_film':['Hydrolyzed Milk Protein@26'],'film_former':[],'cationic_conditioner':['Cetrimonium Chloride@29','Quaternium-95@32 (quaternary conditioning agent recognized by its Quaternium-n name)'],
 'reset':['Sodium Cocoyl Isethionate@2 (mild anionic)','Disodium Laureth Sulfosuccinate@3 (mild anionic)','Cocamidopropyl Hydroxysultaine@5 (amphoteric)','Sodium Lauryl Sulfoacetate@6 (mild anionic)','Sodium Methyl Cocoyl Taurate@33 (mild anionic)'],
 'humectantContext':['Glycerin@8','Panthenol@11','Butylene Glycol@27','Propanediol@28'],
 'excluded':['Glycol Distearate@7 (pearlizing wax, 6.4)','Retinyl Palmitate@9 (vitamin A active ester at active level; not read as a payload emollient - if it were, it would be material and change nothing)','Tocopherol@12 / Tocopheryl Acetate@15 / BHT@39 / Pentaerythrityl Tetra-di-t-butyl Hydroxyhydrocinnamate@38 (antioxidants)','Trideceth-6@34 / Trideceth-12@35 / Polysorbate 20@36 (emulsifiers/solubilizers)','botanical extracts @17,18,21,22,23 (no weight role)'],
 'unresolved':[]}
dp={}
dp['cleansingStrength']=prop('low','moderate','moderate',
 'low by C6: there is no prominent strong anionic (C4); the earliest prominent cleansing surfactant is the mild anionic Sodium Cocoyl Isethionate@2, and a prominent amphoteric co-surfactant is present (Cocamidopropyl Hydroxysultaine@5). Counter-signal: the chassis is anionic-dominated - four prominent mild anionics (Sodium Cocoyl Isethionate@2, Disodium Laureth Sulfosuccinate@3, Sodium Lauryl Sulfoacetate@6, Sodium Methyl Cocoyl Taurate@33) against one amphoteric, plus the booster Cocamide MIPA@4; this lowers confidence to moderate (neighbor moderate) but never moves the convention value.',
 ['C3','C4','C6','N-ALT'])
dp['conditioningLevel']=prop('high','moderate','moderate',
 'high: C2 is met - early (prominent, E3 point 45) silicone Amodimethicone@30 (plus Silicone Quaternium-18@31), cationic polymer Polyquaternium-10@37, pearlizing route Glycol Distearate@7 and deliberate humectants Glycerin@8 / Panthenol@11; further routes Cetrimonium Chloride@29, Quaternium-95@32, prominent payload lipids Shea Butter@19, Evening Primrose Oil@20, Rosa Canina Fruit Oil@24, Jojoba Esters@25 and Hydrolyzed Milk Protein@26. Counter-signal: every conditioning route except Glycol Distearate and Glycerin is listed after typical sub-1 % vitamins (Panthenol@11, Biotin@13), and the E3 point sits unusually late (after the preservatives), so the actual amounts may be small; confidence moderate, neighbor moderate.',
 ['C2','E3','W-RICH','N-ALT'])
dp['weightPotential']=prop('high','moderate','moderate',
 'high: a rich architecture (W-RICH) with limited reset - material payload lipids (Shea Butter@19, Evening Primrose Oil@20, Rosa Canina Fruit Oil@24, Jojoba Esters@25, all before the W-line Phenoxyethanol@40) converge with persistent silicone/cationic deposition (Amodimethicone@30, Silicone Quaternium-18@31, Cetrimonium Chloride@29, Quaternium-95@32, Polyquaternium-10@37) in a mild C6 chassis (resetCapacity weak). The convergence route also holds independently (silicone + cationic_conditioner + cationic_polymer + payload_lipid + protein_film). Confidence moderate (neighbor moderate) because all deposition routes sit after typical sub-1 % actives.',
 ['6.6','6.7','W-RICH','W-LINE','W2','W3','P0','N-ALT'],
 evidence=wt, depositionLoad='moderate', persistence='high', resetCapacity='weak',
 counterevidence='All deposition families are listed after Panthenol@11 and Biotin@13, i.e. in a zone that INCI order suggests is low-concentration; the late cleansing surfactant Sodium Methyl Cocoyl Taurate@33 and the silicone-emulsion emulsifiers (Trideceth-6/-12) suggest the list tail is not strictly descending, so amounts cannot be bounded either way.',
 whyThisBand='Five deposition families converge, including amino-functional silicone, a silicone quat, two cationic conditioners and a cationic polymer that deposit at low dose, plus material butters/oils (W-LINE gate passed); W-RICH holds and the mild isethionate/sulfosuccinate/sulfoacetate + sultaine chassis gives only weak reset, which satisfies the high anchor rich route.',
 whyNotNeighborBand='moderate would require evidence that reset offsets the converging systems or that richness is absent; the chassis is mild (C6 low) and the lipid leg is material under W-LINE, so the late listing is the only argument for moderate and INCI order cannot prove trace amounts (P0: the lighter band is the recommending direction).',
 confidenceLimitingFactor='Actual concentrations of the late-listed deposition routes are unknown (they follow sub-1 % vitamins); a closer-to-trace reading would argue moderate.')
dp['focusPrimary']=focus_prov('dual_supported',['Glycerin@8','Panthenol@11','Butyrospermum Parkii (Shea) Butter@19','Oenothera Biennis (Evening Primrose) Oil@20','Rosa Canina Fruit Oil@24'],['Amodimethicone@30','Silicone Quaternium-18@31','Hydrolyzed Milk Protein@26','Cetrimonium Chloride@29','Polyquaternium-10@37'],['Glycol Distearate@7','Quaternium-95@32','Jojoba Esters@25'],'All routes except Glycerin/Panthenol sit after sub-1 % vitamins; a vitamin cluster (@9-16) is a marketing-led route, not a focus route by itself.','moisture','Humectant cluster plus lipids supports moisture; amino-silicone/quat/protein deposition supports repair.')
dp['focusSecondary']=secondary_prov(['repair'])
dp['usageRole']=usage_prov('frequent','alternating is impossible (cleansingStrength not strong) and treatment is impossible (no recognized active); frequent remains possible if explicit frequency wording appears, occasional_reset if D1 wording appears.')
dp['scalpComfortTarget']=scalp_prov('CSA would pass - prominent E4 comfort route Panthenol@11 and humectant/refatting routes Glycerin@8, Shea Butter@19, Evening Primrose Oil@20, Rosa Canina Fruit Oil@24.','Counter-signals: declared Fragrance@45 with allergens after it; no cooling agent; cleansing low.')
dp['dandruffSupport']=dandruff(None)
r['directProperties']=dp
r['unresolvedMaterialIngredients']=[]
r['provisionalNotes']=['focusPrimary, focusSecondary, usageRole and scalpComfortTarget are claim-dependent and provisional (formula-only); cleansingStrength, conditioningLevel, weightPotential and dandruffSupport are formula-only properties and are not moved by claims (3.2).']
write('VT13',r)
