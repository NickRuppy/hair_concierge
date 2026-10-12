import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from common import *
r,d=base('VT16')
r['formulaFacts']={
 'e3Point':{'position':38,'inci':'PARFUM / FRAGRANCE','note':'Positions 9-37 form an alphabetical run, so their order says nothing about relative amounts; E3 still counts them as prominent (convention).'},
 'surfactants':[
  {'inci':'SODIUM COCOYL ISETHIONATE','position':2,'class':'mild anionic (isethionate)','prominent':True},
  {'inci':'DISODIUM LAURETH SULFOSUCCINATE','position':3,'class':'mild anionic (sulfosuccinate)','prominent':True},
  {'inci':'SODIUM LAURYL SULFOACETATE','position':4,'class':'mild anionic (sulfoacetate)','prominent':True},
  {'inci':'SODIUM LAUROYL SARCOSINATE','position':5,'class':'mild anionic (sarcosinate)','prominent':True},
  {'inci':'COCAMIDOPROPYL BETAINE','position':8,'class':'amphoteric (buffer)','prominent':True},
  {'inci':'COCO-BETAINE','position':16,'class':'amphoteric (buffer)','prominent':True},
  {'inci':'DECYL GLUCOSIDE','position':17,'class':'nonionic cleansing (buffer)','prominent':True},
  {'inci':'C12-13 PARETH-23 / C12-13 PARETH-3 / POLYSORBATE 21 / PPG-5-CETETH-20 / PEG-55 PROPYLENE GLYCOL OLEATE / TRIDECETH-6','position':[11,12,27,28,22,37],'class':'not a cleansing route (emulsifiers/thickeners/solubilizers)'},
  {'inci':'SODIUM ISETHIONATE','position':36,'class':'not a surfactant (isethionate salt)'}],
 'conditioningRoutes':{'silicone':['AMODIMETHICONE@9','DIVINYLDIMETHICONE/DIMETHICONE COPOLYMER@18'],'cationic_conditioner':['CETRIMONIUM CHLORIDE@14'],'cationic_polymer':['POLYQUATERNIUM-10@25','POLYQUATERNIUM-7@26'],'payload_lipid':['HYDROGENATED COCONUT ACID@19 (fatty acid; non-material)','PRUNUS ARMENIACA KERNEL OIL / APRICOT KERNEL OIL@30 (non-material)'],'pearlizing_fatty_route':['GLYCOL DISTEARATE@7'],'humectants':['GLYCERIN@6','PANTHENOL@21','PROPYLENE GLYCOL@29 (solvent)']},
 'actives':['PIROCTONE OLAMINE@24','SALICYLIC ACID@31','PANTHENOL@21'],
 'scalpRelevant':{'e4ComfortRoutesProminent':['PANTHENOL@21'],'e4HumectantRefattingProminent':['GLYCERIN@6','PANTHENOL@21','PRUNUS ARMENIACA KERNEL OIL@30'],'coolingAgents':[],'essentialOilsOrAllergens':[],'recognizedDandruffActives':['PIROCTONE OLAMINE@24']},
 'preservatives':['BENZOIC ACID@10','PHENOXYETHANOL@23','SODIUM BENZOATE@33','PIROCTONE OLAMINE@24 (capped active)']}
r['wLine']={'wLine':{'position':10,'inci':'BENZOIC ACID','classes':['preservative_or_capped_active','alphabetical_tail']},
 'cap':{'e3Point':38},'alphabeticalRun':{'first':9,'last':37},'skipped':[],'codes':[],
 'payloadLipidMaterial':[],'payloadLipidNonMaterial':['HYDROGENATED COCONUT ACID@19','PRUNUS ARMENIACA KERNEL OIL / APRICOT KERNEL OIL@30'],
 'derivation':'Alphabetical run 9 (AMODIMETHICONE) to 37 (TRIDECETH-6): 29 consecutive ascending entries (C12-13 PARETH-23 / C12-13 PARETH-3 differ only in digits and count as in order). It does not contain the earliest cleansing surfactant (SODIUM COCOYL ISETHIONATE@2), so it is a tail; its second entry BENZOIC ACID@10 is a candidate (class d, and also class b). No candidate precedes it. (i) SODIUM COCOYL ISETHIONATE@2 before it; (ii) entries of the same run are ignored and nothing between the run end 37 and the cap 38 -> plausible. W-line 10.'}
wt={'cationic_polymer':['POLYQUATERNIUM-10@25','POLYQUATERNIUM-7@26'],'payload_lipid':['HYDROGENATED COCONUT ACID@19 (non-material; fatty acid, family payload_lipid vs weak_refatter uncertain - immaterial)','APRICOT KERNEL OIL@30 (non-material)'],'weak_refatter':[],'silicone':['AMODIMETHICONE@9','DIVINYLDIMETHICONE/DIMETHICONE COPOLYMER@18'],'protein_film':[],'film_former':[],'cationic_conditioner':['CETRIMONIUM CHLORIDE@14'],
 'reset':['SODIUM COCOYL ISETHIONATE@2','DISODIUM LAURETH SULFOSUCCINATE@3','SODIUM LAURYL SULFOACETATE@4','SODIUM LAUROYL SARCOSINATE@5 (mild anionics)','COCAMIDOPROPYL BETAINE@8','COCO-BETAINE@16 (amphoterics)','DECYL GLUCOSIDE@17 (nonionic)'],
 'humectantContext':['GLYCERIN@6','PANTHENOL@21','PROPYLENE GLYCOL@29'],
 'excluded':['GLYCOL DISTEARATE@7 (pearlizing wax)','CARBOMER@13 (anionic acrylate rheology polymer, 6.4)','PEG-55 PROPYLENE GLYCOL OLEATE@22, PPG-5-CETETH-20@28 (PEG/PPG thickeners/solubilizers)','C12-13 PARETH-23@11, C12-13 PARETH-3@12, POLYSORBATE 21@27, TRIDECETH-6@37 (emulsifiers)','ISOPROPYL ALCOHOL@20 (solvent)','PIROCTONE OLAMINE@24, SALICYLIC ACID@31 (actives)'],
 'unresolved':[]}
dp={}
dp['cleansingStrength']=prop('low','moderate','moderate',
 'low by C6: no prominent strong anionic; the earliest prominent cleansing surfactant is the mild anionic SODIUM COCOYL ISETHIONATE@2 and prominent amphoteric/glucoside co-surfactants are present (COCAMIDOPROPYL BETAINE@8, COCO-BETAINE@16, DECYL GLUCOSIDE@17). Counter-signal: four mild anionics occupy positions 2-5 ahead of the first amphoteric (@8), and positions 16-17 lie inside the alphabetical run, so the buffering share is uncertain; confidence moderate, neighbor moderate.',
 ['C3','C4','C6','N-ALT'])
dp['conditioningLevel']=prop('high','moderate','moderate',
 'high: C2 is met - early (prominent, E3 point 38) silicone AMODIMETHICONE@9 (plus DIVINYLDIMETHICONE/DIMETHICONE COPOLYMER@18), cationic polymers POLYQUATERNIUM-10@25 and POLYQUATERNIUM-7@26, pearlizing route GLYCOL DISTEARATE@7 and humectants GLYCERIN@6 / PANTHENOL@21; CETRIMONIUM CHLORIDE@14 adds a cationic conditioner. Counter-signal: everything from position 9 on is an alphabetized block (run 9-37), so the cationic and second silicone routes are probably sub-1 %; confidence moderate, neighbor moderate.',
 ['C2','E3','N-ALT'])
dp['weightPotential']=prop('high','moderate','moderate',
 'high via the convergence route: three plausibly persistent deposition families converge - amino-silicone AMODIMETHICONE@9 plus DIVINYLDIMETHICONE/DIMETHICONE COPOLYMER@18, cationic polymers POLYQUATERNIUM-10@25 / POLYQUATERNIUM-7@26 and the cationic conditioner CETRIMONIUM CHLORIDE@14 - in a mild C6 chassis whose reset is weak. No lipid leg is used: the only payload lipids (HYDROGENATED COCONUT ACID@19, APRICOT KERNEL OIL@30) lie after the W-line BENZOIC ACID@10 and are non-material, so W-RICH does not hold. Confidence moderate, neighbor moderate: all routes but amodimethicone sit in the alphabetized sub-1 % zone.',
 ['6.6','6.7','W-LINE','W-RICH','W3','P0','N-ALT'],
 evidence=wt, depositionLoad='moderate', persistence='high', resetCapacity='weak',
 counterevidence='Positions 9-37 are alphabetized (W-LINE run), so the cationic polymers, cetrimonium and the second silicone are likely low-dose; the payload lipids are non-material (after the W-line); the four mild anionics could give more reset than "weak".',
 whyThisBand='Amino-silicone, a silicone elastomer copolymer, two cationic polymers and a quat are designed to deposit and persist even at low dose (6.4/W-LINE rationale), and a mild isethionate/sulfosuccinate/sulfoacetate/sarcosinate chassis does not offset them.',
 whyNotNeighborBand='moderate would require the reset to offset the deposition or the deposition to be light; neither is shown by the formula - the late (alphabetized) listing argues for lower amounts but cannot bound them, and a lighter call on doubt is the recommending direction (P0).',
 confidenceLimitingFactor='Amounts inside the alphabetized block are unknown; the band rests on non-lipid families whose dose cannot be read from order.')
dp['focusPrimary']=focus_prov('nonspecific',['GLYCERIN@6','PANTHENOL@21'],['AMODIMETHICONE@9'],['POLYQUATERNIUM-10@25','POLYQUATERNIUM-7@26','CETRIMONIUM CHLORIDE@14','GLYCOL DISTEARATE@7'],'Generic silicone/cationic conditioning; no protein or damage-care cluster and only two humectants. A recognized anti-dandruff active (PIROCTONE OLAMINE@24) makes scalp_active possible if a dandruff claim appears.','scalp_active','Formula-led route that could matter: recognized dandruff active PIROCTONE OLAMINE@24 (with SALICYLIC ACID@31).')
dp['focusSecondary']=secondary_prov(['repair'])
dp['usageRole']=usage_prov('treatment','treatment becomes possible because dandruffSupport is supported (needs a qualifying E2 dandruff claim, U3); alternating impossible (not strong).')
dp['scalpComfortTarget']=scalp_prov('CSA would pass - prominent comfort route PANTHENOL@21 and humectant GLYCERIN@6 (prominent by E3).','Counter-signals: declared PARFUM@38; SALICYLIC ACID@31; no cooling agent.')
dp['dandruffSupport']=dandruff('PIROCTONE OLAMINE@24')
r['directProperties']=dp
r['unresolvedMaterialIngredients']=[]
r['provisionalNotes']=['focusPrimary, focusSecondary, usageRole and scalpComfortTarget are claim-dependent and provisional (formula-only).','dandruffSupport supported; a dandruff target depends on a qualifying E2 dandruff claim (S-DANDRUFF, R17.3).']
write('VT16',r)
