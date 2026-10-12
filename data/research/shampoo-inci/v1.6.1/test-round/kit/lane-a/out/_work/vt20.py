import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from common import *
r,d=base('VT20')
r['formulaFacts']={
 'e3Point':{'position':21,'inci':'Parfum'},
 'surfactants':[
  {'inci':'Sodium Laureth Sulfate','position':2,'class':'strong anionic, ether/sulfonate type (defining anionic)','prominent':True},
  {'inci':'Laureth-2','position':3,'class':'not a cleansing route (low-ethoxylate thickener)','prominent':True},
  {'inci':'Disodium Laureth Sulfosuccinate','position':5,'class':'mild anionic (buffer)','prominent':True},
  {'inci':'Sodium Lauroyl Glutamate','position':7,'class':'mild anionic (buffer)','prominent':True},
  {'inci':'PEG-120 Methyl Glucose Dioleate','position':10,'class':'not a cleansing route (PEG thickener)'}],
 'conditioningRoutes':{'cationic_polymer':['Polyquaternium-7@13'],'protein_film':['Hydrolyzed Wheat Protein@17'],'silicone':[],'payload_lipid':[],'cationic_conditioner':[],'pearlizing_fatty_route':[],'humectants':['Panthenol@4','Propylene Glycol@8 (solvent)']},
 'actives':['Panthenol@4','Caffeine@9','Zinc PCA@15','Niacinamide@16','Camellia Sinensis Leaf Extract@14'],
 'scalpRelevant':{'e4ComfortRoutesProminent':['Panthenol@4','Niacinamide@16'],'e4HumectantRefattingProminent':['Panthenol@4'],'coolingAgents':[],'essentialOilsOrAllergens':['Hexyl Cinnamal@22','Limonene@23','Linalool@25','Citrus Aurantium Peel Oil@26','Linalyl Acetate@27 (all after the E3 point)'],'recognizedDandruffActives':[]},
 'preservatives':['Potassium Sorbate@18','Sodium Benzoate@19','Phenoxyethanol@20']}
r['wLine']={'wLine':{'position':9,'inci':'Caffeine','classes':['sub1_active']},
 'cap':{'e3Point':21},'alphabeticalRun':None,
 'skipped':['w_line_skipped:Panthenol@4 (clause ii: Disodium Laureth Sulfosuccinate@5 and Sodium Lauroyl Glutamate@7, cleansing surfactants, are listed after it and before the cap)'],
 'codes':[],'payloadLipidMaterial':[],'payloadLipidNonMaterial':[],
 'derivation':'Panthenol@4 (class c): (i) holds (SLES@2), (ii) fails. Caffeine@9 (class c): (i) SLES@2 before it; (ii) after it only PEG-120 Methyl Glucose Dioleate (a PEG thickener, not a structurant for (ii)), acids, Polyquaternium-7, extracts, Zinc PCA, Niacinamide, protein and preservatives -> plausible. W-line 9. No alphabetical run.'}
wt={'cationic_polymer':['Polyquaternium-7@13'],'payload_lipid':[],'weak_refatter':[],'silicone':[],'protein_film':['Hydrolyzed Wheat Protein@17'],'film_former':[],'cationic_conditioner':[],
 'reset':['Sodium Laureth Sulfate@2 (strong anionic, ether type)','Disodium Laureth Sulfosuccinate@5 (mild anionic buffer)','Sodium Lauroyl Glutamate@7 (mild anionic buffer)'],
 'humectantContext':['Panthenol@4','Propylene Glycol@8','Zinc PCA@15'],
 'excluded':['Laureth-2@3, PEG-120 Methyl Glucose Dioleate@10 (thickeners, 6.4)','Caffeine@9, Niacinamide@16, Zinc PCA@15 (actives; no deposition role)','Camellia Sinensis Leaf Extract@14 (extract)','Citrus Aurantium Peel Oil@26 (fragrance oil)'],
 'unresolved':[]}
dp={}
dp['cleansingStrength']=prop('moderate','high','none',
 'moderate by C1: defining anionic Sodium Laureth Sulfate@2 (ether type), buffered by two prominent mild anionics (Disodium Laureth Sulfosuccinate@5, Sodium Lauroyl Glutamate@7), no reinforcing strong anionic. Laureth-2@3 is a thickener, not a route.',
 ['C1','C3','C4','N-ALT'])
dp['conditioningLevel']=prop('low','moderate','moderate',
 'low: cleansing-led architecture with little substantive slip - the only conditioning routes are one light cationic polymer (Polyquaternium-7@13, after the sub-1 % Caffeine@9), a late protein (Hydrolyzed Wheat Protein@17) and Panthenol@4; no silicone, lipid, pearlizer or cationic conditioner. Counter-signal: Panthenol is listed early and PQ-7 does add some slip, so moderate is the realistic neighbor.',
 ['5','C2','N-ALT'])
dp['weightPotential']=prop('low','moderate','moderate',
 'low: deposition is light and low-persistence - one light cationic polymer (Polyquaternium-7@13) and a late protein (Hydrolyzed Wheat Protein@17), both after the sub-1 % W-line candidate Caffeine@9, against an effective C1 SLES chassis (reset moderate). No silicone, no payload lipid, no cationic conditioner.',
 ['6.6','6.7','W2','N-ALT'],
 evidence=wt, depositionLoad='light', persistence='low', resetCapacity='moderate',
 counterevidence='Two deposition families are present (cationic_polymer and protein_film), so W2 applies; Polyquaternium-7 is substantive to hair.',
 whyThisBand='The only deposition clues are a single light polymer and a protein, both listed in the sub-1 % zone after Caffeine@9, and an SLES chassis with two buffers removes such light deposits.',
 whyNotNeighborBand='moderate would need a plausibly persistent system; W2: the two families present are each late (after the sub-1 % Caffeine@9 and Zinc PCA@15) and light (PQ-7 low-dose, hydrolyzed protein), with no silicone, lipid or quat to make them converge into a noticeable residue.',
 confidenceLimitingFactor='Two families are present and PQ-7 dose is unknown; a higher PQ-7 level could make moderate the better call.')
dp['focusPrimary']=focus_prov('nonspecific',['Panthenol@4'],['Hydrolyzed Wheat Protein@17'],['Polyquaternium-7@13'],'One humectant and one late protein; Caffeine is a hair-loss-type ingredient and never a focus route (F5).','clarifying','Formula compatible with clarifying (F6) and with volume (light formula); claims decide. Caffeine@9 and Zinc PCA@15 hint at scalp/hair-loss positioning (F5 excludes hair-loss).')
dp['focusSecondary']=secondary_prov(['volume'])
dp['usageRole']=usage_prov('frequent','alternating impossible (not strong); treatment impossible (no active).')
dp['scalpComfortTarget']=scalp_prov('CSA would pass - prominent comfort routes Panthenol@4 and Niacinamide@16; humectant Panthenol@4.','Counter-signals: declared Parfum@21 with allergens and citrus peel oil after it; no cooling agent.')
dp['dandruffSupport']=dandruff(None)
r['directProperties']=dp
r['unresolvedMaterialIngredients']=[]
r['provisionalNotes']=['Packet identity confidence is moderate (formula complete, tier 2).','focusPrimary, focusSecondary, usageRole and scalpComfortTarget are claim-dependent and provisional (formula-only).']
write('VT20',r)
