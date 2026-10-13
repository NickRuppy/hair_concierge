import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from common import *
r,d=base('VT17')
r['formulaFacts']={
 'e3Point':{'position':12,'inci':'PARFUM / FRAGRANCE'},
 'surfactants':[
  {'inci':'SODIUM LAURETH SULFATE','position':2,'class':'strong anionic, ether/sulfonate type (defining anionic)','prominent':True},
  {'inci':'COCO-BETAINE','position':4,'class':'amphoteric (buffer)','prominent':True},
  {'inci':'PPG-5-CETETH-20','position':13,'class':'not a cleansing route (solubilizer)'}],
 'conditioningRoutes':{'silicone':['DIMETHICONE@6'],'cationic_polymer':[],'cationic_conditioner':[],'payload_lipid':[],'weak_refatter':['2-OLEAMIDO-1,3-OCTADECANEDIOL@11 (ceramide-type lipid additive)'],'pearlizing_fatty_route':['GLYCOL DISTEARATE@3'],'humectants':['GLYCERIN@5']},
 'actives':['SELENIUM SULFIDE@15','SALICYLIC ACID@14','MENTHOL@10','TOCOPHERYL ACETATE@19'],
 'scalpRelevant':{'e4ComfortRoutesProminent':[],'e4HumectantRefattingProminent':['GLYCERIN@5'],'coolingAgents':['MENTHOL@10 (prominent)'],'essentialOilsOrAllergens':[],'recognizedDandruffActives':['SELENIUM SULFIDE@15']},
 'preservatives':['SODIUM BENZOATE@16','SELENIUM SULFIDE@15 (capped active, W-LINE class b)'],
 'labelFact':'Selenium sulfide: EU Annex III anti-dandruff-only active, max 1 % (DS1); informational only, no copy.'}
r['wLine']={'wLine':{'position':12,'inci':'PARFUM / FRAGRANCE','classes':['fragrance','alphabetical_tail']},
 'cap':{'e3Point':12},'alphabeticalRun':{'first':11,'last':19},'skipped':[],'codes':[],
 'payloadLipidMaterial':[],'payloadLipidNonMaterial':[],
 'derivation':'Alphabetical run 11 (2-OLEAMIDO-1,3-OCTADECANEDIOL) to 19 (TOCOPHERYL ACETATE): 9 ascending entries under the W-LINE comparison (digits sort before letters, so 2-OLEAMIDO@11 sorts before MENTHOL@10 and breaks the shorter run CARBOMER@7-MENTHOL@10). The run does not contain the earliest cleansing surfactant (SODIUM LAURETH SULFATE@2); its second entry PARFUM@12 is a candidate (class d) and is also the E3 marker (class a). No candidate precedes it. (i) SLES@2 before it; (ii) nothing between it and the cap -> plausible; W-line = cap = 12, no fallback code. Alternative reading (if the manufacturer\'s letter-sort of 2-OLEAMIDO is followed, run 7-19): tail candidate CI 19140@8, W-line 8. The formula has no payload_lipid, so either reading changes nothing.'}
wt={'cationic_polymer':[],'payload_lipid':[],'weak_refatter':['2-OLEAMIDO-1,3-OCTADECANEDIOL@11 (ceramide-type; if read as payload_lipid it would be material at 11 < W-line 12, which changes no route because reset is moderate and it sits after MENTHOL@10)'],'silicone':['DIMETHICONE@6'],'protein_film':[],'film_former':[],'cationic_conditioner':[],
 'reset':['SODIUM LAURETH SULFATE@2 (strong anionic, ether type)','COCO-BETAINE@4 (amphoteric buffer)'],
 'humectantContext':['GLYCERIN@5'],
 'excluded':['GLYCOL DISTEARATE@3 (pearlizing wax, 6.4)','CARBOMER@7 (anionic acrylate rheology polymer, suspends the selenium sulfide; 6.4)','PPG-5-CETETH-20@13 (solubilizer)','TOCOPHERYL ACETATE@19 (antioxidant)','MENTHOL@10 (cooling agent)','SELENIUM SULFIDE@15, SALICYLIC ACID@14 (actives)'],
 'unresolved':[]}
dp={}
dp['cleansingStrength']=prop('moderate','high','none',
 'moderate by C1: defining anionic SODIUM LAURETH SULFATE@2 (ether type) with the prominent buffer COCO-BETAINE@4 and no reinforcing strong anionic (the settled ether-sulfate-plus-betaine core).',
 ['C1','C3','C4','N-ALT'])
dp['conditioningLevel']=prop('moderate','moderate','low',
 'moderate: one meaningful conditioning system - prominent DIMETHICONE@6 - with light routes (pearlizing GLYCOL DISTEARATE@3, GLYCERIN@5, ceramide-type 2-OLEAMIDO-1,3-OCTADECANEDIOL@11). C2 is not met: there is no cationic polymer. Counter-signal: without a cationic deposition aid, silicone deposition from an SLES chassis may be limited, so low is the realistic neighbor.',
 ['C2','5','N-ALT'])
dp['weightPotential']=prop('moderate','moderate','low',
 'moderate: one plausibly persistent system - prominent DIMETHICONE@6 - in an ordinary C1 SLES/betaine chassis (reset moderate); bounded residue is plausible. No cationic polymer or conditioner, no payload lipid (W-line PARFUM@12 gates nothing), so neither W-RICH nor the convergence route for high exists.',
 ['6.6','6.7','W2','W-LINE','P0','N-ALT'],
 evidence=wt, depositionLoad='moderate', persistence='moderate', resetCapacity='moderate',
 counterevidence='No cationic polymer to aid silicone deposition; the second deposition family is only a trace ceramide-type additive after MENTHOL@10; moderate SLES reset.',
 whyThisBand='A prominent dimethicone is a plausibly persistent deposit; calling the product lightweight would understate the residue risk, while a single silicone without cationic aid and with moderate reset keeps it bounded.',
 whyNotNeighborBand='low rather than moderate would need the silicone to be light/late; it is the sixth entry, before Carbomer and the actives (W2: two families present, so "one light route" is not sufficient). high is excluded: one route kind only, no W-RICH.',
 confidenceLimitingFactor='Dimethicone deposition without cationic polymer is uncertain; realistic unknowns (silicone level, particle size) could move it to low.')
dp['focusPrimary']=focus_prov('nonspecific',['GLYCERIN@5'],['2-OLEAMIDO-1,3-OCTADECANEDIOL@11'],['DIMETHICONE@6'],'No coherent humectant or damage-care cluster.','scalp_active','Formula-led route that could matter: recognized dandruff active SELENIUM SULFIDE@15 (DS1) with SALICYLIC ACID@14 and MENTHOL@10.')
dp['focusSecondary']=secondary_prov(['shine'])
dp['usageRole']=usage_prov('treatment','treatment becomes possible because dandruffSupport is supported (needs a qualifying E2 dandruff claim, U3); alternating impossible (not strong).')
dp['scalpComfortTarget']=scalp_prov('CSA would pass only through the humectant list (GLYCERIN@5 prominent); there is no E4 comfort route, so an S-SENSITIVE gate would fail.','Counter-signals: prominent cooling agent MENTHOL@10; declared PARFUM@12.')
dp['dandruffSupport']=dandruff('SELENIUM SULFIDE@15')
r['directProperties']=dp
r['unresolvedMaterialIngredients']=[]
r['provisionalNotes']=['focusPrimary, focusSecondary, usageRole and scalpComfortTarget are claim-dependent and provisional (formula-only).','dandruffSupport supported via DS1 (selenium sulfide); a dandruff target depends on a qualifying E2 dandruff claim (S-DANDRUFF, R17.3).']
write('VT17',r)
