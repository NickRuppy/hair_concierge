import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from common import *
r,d=base('VT19')
r['formulaFacts']={
 'e3Point':{'position':16,'inci':'FRAGRANCE'},
 'surfactants':[
  {'inci':'DISODIUM LAURETH SULFOSUCCINATE','position':2,'class':'mild anionic (sulfosuccinate)','prominent':True},
  {'inci':'SODIUM LAUROYL SARCOSINATE','position':3,'class':'mild anionic (sarcosinate)','prominent':True},
  {'inci':'COCAMIDOPROPYL HYDROXYSULTAINE','position':4,'class':'amphoteric (buffer)','prominent':True},
  {'inci':'SODIUM LAURYL SULFOACETATE','position':5,'class':'mild anionic (sulfoacetate)','prominent':True},
  {'inci':'COCAMIDE MEA','position':6,'class':'not a cleansing route (alkanolamide)','prominent':True},
  {'inci':'C12-13 PARETH-23 / C12-13 PARETH-3 / TRIDECETH-12','position':[21,22,23],'class':'not a cleansing route (emulsifiers)'}],
 'conditioningRoutes':{'silicone':['DIMETHICONE@8','DIVINYLDIMETHICONE/DIMETHICONE COPOLYMER@24','AMODIMETHICONE@29','DIMETHICONOL@30','CYCLOPENTASILOXANE@33 (volatile)'],'payload_lipid':['ARGANIA SPINOSA (ARGAN) KERNEL OIL@9','PERSEA GRATISSIMA (AVOCADO) OIL@10'],'protein_film':['HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL@15','SILK AMINO ACIDS@17','HYDROLYZED KERATIN@18','KERATIN AMINO ACIDS@19'],'cationic_polymer':['POLYQUATERNIUM-7@25','POLYQUATERNIUM-10@26','POLYQUATERNIUM-59@42'],'cationic_conditioner':['QUATERNIUM-80@27','COCAMIDOPROPYL DIMETHYLAMINE@43','CETRIMONIUM CHLORIDE@48'],'weak_refatter':['PEG-6 CAPRYLIC/CAPRIC GLYCERIDES@31'],'pearlizing_fatty_route':['GLYCOL DISTEARATE@7'],'humectants':['PANTHENOL@32','GLYCERIN@34','SODIUM PCA@36','BUTYLENE GLYCOL@38 / PROPYLENE GLYCOL@41 (solvents)']},
 'actives':[],
 'scalpRelevant':{'e4ComfortRoutesProminent':[],'e4HumectantRefattingProminent':['ARGANIA SPINOSA (ARGAN) KERNEL OIL@9','PERSEA GRATISSIMA (AVOCADO) OIL@10'],'coolingAgents':[],'essentialOilsOrAllergens':['LAVANDULA ANGUSTIFOLIA FLOWER EXTRACT@12, ROSMARINUS OFFICINALIS LEAF EXTRACT@13 (extracts)','ALPHA-ISOMETHYL IONONE@55','HYDROXYCITRONELLAL@56','LINALOOL@57'],'recognizedDandruffActives':[]},
 'preservatives':['CHLORPHENESIN@49','PHENOXYETHANOL@50','SODIUM BENZOATE@51','POTASSIUM SORBATE@52','ETHYLHEXYLGLYCERIN@35 (booster)']}
r['wLine']={'wLine':{'position':16,'inci':'FRAGRANCE','classes':['fragrance']},
 'cap':{'e3Point':16},'alphabeticalRun':None,'skipped':[],'codes':[],
 'payloadLipidMaterial':['ARGANIA SPINOSA (ARGAN) KERNEL OIL@9','PERSEA GRATISSIMA (AVOCADO) OIL@10'],'payloadLipidNonMaterial':[],
 'derivation':'No class a/b/c candidate precedes the E3 marker FRAGRANCE@16 (Panthenol@32 and the preservatives come later); no alphabetical run (longest ascending run 4). The marker is a class a candidate: (i) DISODIUM LAURETH SULFOSUCCINATE@2 before it; (ii) nothing between it and the cap -> W-line = cap = 16, no fallback code.'}
wt={'cationic_polymer':['POLYQUATERNIUM-7@25','POLYQUATERNIUM-10@26','POLYQUATERNIUM-59@42'],'payload_lipid':['ARGANIA SPINOSA (ARGAN) KERNEL OIL@9 (material)','PERSEA GRATISSIMA (AVOCADO) OIL@10 (material)'],'weak_refatter':['PEG-6 CAPRYLIC/CAPRIC GLYCERIDES@31'],'silicone':['DIMETHICONE@8','DIVINYLDIMETHICONE/DIMETHICONE COPOLYMER@24','AMODIMETHICONE@29','DIMETHICONOL@30'],'protein_film':['HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL@15','SILK AMINO ACIDS@17','HYDROLYZED KERATIN@18','KERATIN AMINO ACIDS@19'],'film_former':[],'cationic_conditioner':['QUATERNIUM-80@27','COCAMIDOPROPYL DIMETHYLAMINE@43','CETRIMONIUM CHLORIDE@48'],
 'reset':['DISODIUM LAURETH SULFOSUCCINATE@2','SODIUM LAUROYL SARCOSINATE@3','SODIUM LAURYL SULFOACETATE@5 (mild anionics)','COCAMIDOPROPYL HYDROXYSULTAINE@4 (amphoteric)'],
 'humectantContext':['PANTHENOL@32','GLYCERIN@34','SODIUM PCA@36','BUTYLENE GLYCOL@38','PROPYLENE GLYCOL@41'],
 'excluded':['GLYCOL DISTEARATE@7 (pearlizing wax)','PEG-150 PENTAERYTHRITYL TETRASTEARATE@28 (PEG thickener)','ACRYLATES/PALMETH-25 ACRYLATE COPOLYMER@39 (anionic associative acrylate thickener; role named as rheology modifier, 6.4 by analogy)','CYCLOPENTASILOXANE@33 (volatile silicone carrier, evaporates)','SIMMONDSIA CHINENSIS (JOJOBA) SEED EXTRACT@14 (extract, not the oil)','C12-13 PARETH-23@21, C12-13 PARETH-3@22, TRIDECETH-12@23 (emulsifiers)','botanical extracts @11-13'],
 'unresolved':[]}
dp={}
dp['cleansingStrength']=prop('low','moderate','moderate',
 'low by C6: no prominent strong anionic; the earliest prominent cleansing surfactant is the mild anionic DISODIUM LAURETH SULFOSUCCINATE@2, with the prominent amphoteric COCAMIDOPROPYL HYDROXYSULTAINE@4. Counter-signal: three mild anionics (@2, @3, @5) against one amphoteric, plus the foam booster COCAMIDE MEA@6; confidence moderate, neighbor moderate.',
 ['C3','C4','C6','N-ALT'])
dp['conditioningLevel']=prop('high','high','none',
 'high: C2 is met - early (prominent) DIMETHICONE@8, cationic polymers (POLYQUATERNIUM-7@25, -10@26, -59@42), pearlizing GLYCOL DISTEARATE@7 and humectants (PANTHENOL@32, GLYCERIN@34, SODIUM PCA@36) - and a rich architecture (W-RICH, E3 reading) holds independently: prominent payload lipids ARGAN OIL@9 and AVOCADO OIL@10 converge with the prominent silicone. Further routes: amodimethicone, dimethiconol, silicone copolymer, three cationic conditioners and four protein/amino-acid routes. Counter-signal: the cationic polymers and humectants sit after FRAGRANCE@16; the prominent silicone + oils + pearlizer core alone does not plausibly fall to moderate.',
 ['C2','W-RICH','E3','N-ALT'])
dp['weightPotential']=prop('high','high','none',
 'high: rich architecture (W-RICH) with limited reset - material payload lipids ARGAN OIL@9 and AVOCADO OIL@10 (before the W-line FRAGRANCE@16) converge with a prominent DIMETHICONE@8 and further persistent silicones (amodimethicone@29, dimethiconol@30, copolymer@24) and cationic deposition (three polyquaterniums, three cationic conditioners) in a mild C6 chassis (resetCapacity weak). The convergence route holds as well (silicone + payload_lipid + cationic_polymer + cationic_conditioner + protein_film).',
 ['6.6','6.7','W-RICH','W-LINE','N-ALT'],
 evidence=wt, depositionLoad='high', persistence='high', resetCapacity='weak',
 counterevidence='Most cationic, amino-silicone and protein routes sit after FRAGRANCE@16 and are probably low-dose; the volatile cyclopentasiloxane is excluded.',
 whyThisBand='A prominent silicone plus two prominent oils form a rich deposit, reinforced by amino-functional silicone and multiple cationics that persist at low dose; the mild sulfosuccinate/sarcosinate/sulfoacetate + sultaine chassis does not offset them.',
 whyNotNeighborBand='moderate would need effective reset or light, non-converging routes; here at least five families converge, the prominent core (dimethicone@8, oils@9-10) is itself rich, and reset is weak.',
 confidenceLimitingFactor='None material: identity exact, formula complete, recognition complete and both high routes hold; the late routes only add to an already rich prominent core.')
dp['focusPrimary']=focus_prov('repair_supported',['ARGANIA SPINOSA (ARGAN) KERNEL OIL@9','PERSEA GRATISSIMA (AVOCADO) OIL@10','PANTHENOL@32','GLYCERIN@34','SODIUM PCA@36'],['HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL@15','HYDROLYZED KERATIN@18','KERATIN AMINO ACIDS@19','SILK AMINO ACIDS@17','AMODIMETHICONE@29','QUATERNIUM-80@27'],['DIMETHICONE@8','POLYQUATERNIUM-7@25','POLYQUATERNIUM-10@26','GLYCOL DISTEARATE@7'],'Humectants are post-fragrance (probably trace), so the moisture side is weaker than the protein/deposition side; claims decide.','repair','Coherent protein/keratin + amino-silicone cluster supports repair; moisture side rests mainly on oils.')
dp['focusSecondary']=secondary_prov(['shine'])
dp['usageRole']=usage_prov('frequent','alternating impossible (not strong); treatment impossible (no active).')
dp['scalpComfortTarget']=scalp_prov('CSA would pass only through prominent payload oils (ARGAN OIL@9, AVOCADO OIL@10, E4 humectant/refatting list); there is no prominent E4 comfort route (PANTHENOL@32 is after FRAGRANCE@16), so an S-SENSITIVE gate would fail.','Counter-signals: declared FRAGRANCE@16, lavender/rosemary extracts, allergens at the end.')
dp['dandruffSupport']=dandruff(None)
r['directProperties']=dp
r['unresolvedMaterialIngredients']=[]
r['provisionalNotes']=['focusPrimary, focusSecondary, usageRole and scalpComfortTarget are claim-dependent and provisional (formula-only).']
write('VT19',r)
