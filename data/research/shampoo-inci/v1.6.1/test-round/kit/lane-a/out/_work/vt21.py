import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from common import *
r,d=base('VT21')
r['formulaFacts']={
 'e3Point':{'position':21,'inci':'PARFUM / FRAGRANCE','note':'Parfum is the last entry; allergens Linalool@18, Limonene@19 and Benzyl Alcohol@20 precede it.'},
 'surfactants':[
  {'inci':'AMMONIUM LAURYL SULFATE','position':2,'class':'strong anionic, alkyl sulfate type (defining anionic)','prominent':True},
  {'inci':'COCAMIDOPROPYL BETAINE','position':4,'class':'amphoteric (buffer)','prominent':True},
  {'inci':'POLYGLYCERYL-10 MYRISTATE / POLYGLYCERYL-10 STEARATE','position':[12,13],'class':'not a cleansing route and not a buffer (polyglyceryl esters, C3)'}],
 'conditioningRoutes':{'payload_lipid':['NIGELLA SATIVA SEED OIL@5'],'cationic_polymer':['GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE@8'],'weak_refatter':['POLYGLYCERYL-10 MYRISTATE@12','POLYGLYCERYL-10 STEARATE@13'],'silicone':[],'cationic_conditioner':[],'pearlizing_fatty_route':[],'humectants':['POLYGLYCERIN-10@11 (not on the closed C2 humectant list)']},
 'actives':['CHARCOAL POWDER@9'],
 'scalpRelevant':{'e4ComfortRoutesProminent':[],'e4HumectantRefattingProminent':['NIGELLA SATIVA SEED OIL@5'],'coolingAgents':[],'essentialOilsOrAllergens':['LINALOOL@18','LIMONENE@19','BENZYL ALCOHOL@20 (before Parfum)'],'recognizedDandruffActives':[]},
 'preservatives':['SODIUM BENZOATE@14','SODIUM DEHYDROACETATE@15','BENZOIC ACID@16','BENZYL ALCOHOL@20']}
r['wLine']={'wLine':{'position':10,'inci':'CITRIC ACID','classes':['alphabetical_tail']},
 'cap':{'e3Point':21},'alphabeticalRun':{'first':9,'last':15},'skipped':[],'codes':[],
 'payloadLipidMaterial':['NIGELLA SATIVA SEED OIL@5'],'payloadLipidNonMaterial':[],
 'derivation':'Alphabetical run 9 (CHARCOAL POWDER) to 15 (SODIUM DEHYDROACETATE): exactly 7 ascending entries (CHARCOAL POWDER, CITRIC ACID, POLYGLYCERIN-10, POLYGLYCERYL-10 MYRISTATE, POLYGLYCERYL-10 STEARATE, SODIUM BENZOATE, SODIUM DEHYDROACETATE); BENZOIC ACID@16 breaks it and GUAR...@8 precedes it out of order. It does not contain the earliest cleansing surfactant (AMMONIUM LAURYL SULFATE@2), so it is a tail; its second entry CITRIC ACID@10 is the candidate (class d). No class a/b/c candidate precedes position 10. (i) ALS@2 before it; (ii) the run\'s own entries are ignored, and after the run (16-20: Benzoic Acid, Caramel, Linalool, Limonene, Benzyl Alcohol) there is no cleansing surfactant, alkanolamide or pearlizing wax before the cap 21 -> plausible. W-line 10.'}
wt={'cationic_polymer':['GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE@8'],'payload_lipid':['NIGELLA SATIVA SEED OIL@5 (material, liquid oil)'],'weak_refatter':['POLYGLYCERYL-10 MYRISTATE@12','POLYGLYCERYL-10 STEARATE@13'],'silicone':[],'protein_film':[],'film_former':[],'cationic_conditioner':[],
 'reset':['AMMONIUM LAURYL SULFATE@2 (strong anionic, alkyl sulfate)','COCAMIDOPROPYL BETAINE@4 (amphoteric buffer)'],
 'humectantContext':['POLYGLYCERIN-10@11'],
 'excluded':['TRIETHYL CITRATE@6 (low-molecular, water-miscible citrate ester used as solvent/fixative; not a nonvolatile hair-substantive emollient)','CHARCOAL POWDER@9 (adsorbent particle, no deposition role)','CARAMEL@17 (colourant)'],
 'unresolved':[]}
dp={}
dp['cleansingStrength']=prop('strong','high','none',
 'strong by C5: the defining anionic is AMMONIUM LAURYL SULFATE@2 (alkyl sulfate type) with only one prominent buffer (COCAMIDOPROPYL BETAINE@4); C5 needs at least two buffers for moderate. The polyglyceryl esters @12-13 are neither routes nor buffers (C3). Counter-signals recorded (oil @5, guar @8) do not touch the buffer count.',
 ['C3','C4','C5','N-ALT'])
dp['conditioningLevel']=prop('moderate','moderate','low',
 'moderate: one meaningful system - cationic guar (GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE@8) with a prominent plant oil (NIGELLA SATIVA SEED OIL@5) - plus light polyglyceryl ester refatting (@12-13). C2 is not met: no silicone (the oil may take its place) but no pearlizing/fatty route and no humectant from the closed list (Polyglycerin-10 is not on it). Counter-signal: strong alkyl-sulfate chassis with charcoal is cleansing-led, so low is the realistic neighbor.',
 ['C2','5','N-ALT'])
dp['weightPotential']=prop('moderate','moderate','high',
 'moderate: W-RICH is established (material NIGELLA SATIVA SEED OIL@5, before the W-line CITRIC ACID@10, converging with cationic guar@8), but reset is strong (C5 alkyl sulfate with one buffer), so the rich route does not reach high; the convergence route (one oil + one guar) is offset by the strong reset. W-RICH recorded as counter-signal, high as neighbor (6.7 limited-reset rule).',
 ['6.6','6.7','W-RICH','W-LINE','N-ALT'],
 evidence=wt, depositionLoad='moderate', persistence='moderate', resetCapacity='strong',
 counterevidence='W-RICH holds: an early oil (5) next to a cationic guar (8) can leave a bounded oily/conditioning deposit; polyglyceryl esters add light refatting.',
 whyThisBand='A cationic guar plus an early oil plausibly leaves residue, so lightweight would understate it; a strong ammonium lauryl sulfate chassis bounds it.',
 whyNotNeighborBand='high needs W-RICH with weak reset or converging persistent systems that reset does not offset; reset is strong and there is no silicone, cationic conditioner, protein or film former.',
 confidenceLimitingFactor='W-RICH is formally present (6.7 limited-reset rule caps confidence/neighbor); oil level unknown.')
dp['focusPrimary']=focus_prov('nonspecific',['NIGELLA SATIVA SEED OIL@5'],[],['GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE@8'],'No humectant cluster, no damage-care cluster; charcoal and a strong chassis point to a cleansing role.','clarifying','Formula compatible with clarifying (F6: strong cleansing, conditioning and weight not high) should a reset/oily claim appear.')
dp['focusSecondary']=secondary_prov(['clarifying'])
dp['usageRole']=usage_prov('alternating','cleansingStrength is strong, so alternating fires if reset intent (U4) appears; occasional_reset if D1 wording appears; treatment impossible (no active).')
dp['scalpComfortTarget']=scalp_prov('CSA would pass only through the humectant/refatting list (NIGELLA SATIVA SEED OIL@5 prominent); no E4 comfort route.','Counter-signals: cleansingStrength strong; allergens before Parfum.')
dp['dandruffSupport']=dandruff(None)
r['directProperties']=dp
r['unresolvedMaterialIngredients']=[]
r['provisionalNotes']=['Packet identity confidence is moderate; the packet states the same formula is published for a 250 ml pack (GTIN alias) - recorded, not combined (Section 2).','focusPrimary, focusSecondary, usageRole and scalpComfortTarget are claim-dependent and provisional (formula-only).']
write('VT21',r)
