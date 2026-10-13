import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W212','Split synonym entries "Aqua (Water" (packet @1) and "Eau)" (packet @2) merged into one entry Aqua (Water, Eau) before numbering (ID-2 split entries); all positions below are normalized = packet position - 1 from packet @3 on. The packet list has 29 raw entries, 28 normalized.','Parfum (Fragrance) @9 (normalized); prominent = normalized positions 1-8 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Laureth Sulfate @2 (strong anionic, ether type)','reinforcingRoutes':[],'buffers':['Cocamidopropyl Betaine @3 (amphoteric)'],
   'notCleansing':['Laureth-4 @15','PEG-40 Hydrogenated Castor Oil @16','PEG-120 Methyl Glucose Dioleate @17','Laureth-23 @19','Trideceth-10 @21','Glycol Distearate @14'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'silicone':['Dimethicone @7 (prominent)','Amodimethicone @11'],'cationic_polymer':['Guar Hydroxypropyltrimonium Chloride @12'],'protein_film':['Hydrolyzed Keratin @6'],'weak_refatter':['PEG-7 Glyceryl Cocoate @5'],
   'payload_lipid':['Hydrogenated Castor Oil @13 (waxy)','Prunus Armeniaca (Apricot) Kernel Oil @20'],'pearlizing':['Glycol Distearate @14 (after E3)']},
 'humectants':[],'actives':['Hydrolyzed Keratin @6'],'recognizedDandruffActives':[],
 'exposure':{'fragrance':'Parfum @9, Tetramethyl Acetyloctahydronaphthalenes @18, Linalool @23, Linalyl Acetate @24, Acetyl Cedrene @26','coolingAgents':[],'essentialOils':[]},
 'csa':{'listedComfortRoutesProminent':[],'listedHumectantRefattingRoutesProminent':['PEG-7 Glyceryl Cocoate @5'],'mildBase':'no: prominent Sodium Laureth Sulfate @2','csaHolds':True,'note':'No prominent comfort route and no MB, so an S-SENSITIVE gate would fail; S-DRY could pass via PEG-7 Glyceryl Cocoate.'},
 'preservativesAndOther':['Sodium Chloride @4','Sodium Benzoate @8','Citric Acid @10','Sodium Hydroxide @22','Propylene Glycol @25','Phenoxyethanol @27','Sodium Salicylate @28']}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C1 - defining anionic Sodium Laureth Sulfate @2 with prominent buffer Cocamidopropyl Betaine @3 and no reinforcing route.',['C1','C3','C4','E3']),
 'conditioningLevel':prop('moderate','moderate','high','Moderate: C2 is not met only because the humectant element is missing - early silicone Dimethicone @7 (prominent), cationic Guar HPTC @12 and the pearlizing/fatty route Glycol Distearate @14 / Hydrogenated Castor Oil @13 are present, plus Amodimethicone @11, Hydrolyzed Keratin @6 and PEG-7 Glyceryl Cocoate @5, but no listed C2 humectant (no Glycerin, Panthenol etc.). Missing humectant recorded as the counter-signal; neighbor high (C2). No prominent payload lipid, so no W-RICH rich architecture for Section 5.',['C2','5','E3','W-RICH','N-ALT']),
 'weightPotential':weight('moderate','moderate','high','Moderate: a silicone pair (Dimethicone @7, Amodimethicone @11) with cationic guar and a prominent keratin film plausibly leave noticeable but bounded residue; the lipids are non-material and the C1 reset is effective.',
   ev(cp=['Guar Hydroxypropyltrimonium Chloride @12'],pl=['Hydrogenated Castor Oil @13 (non-material: after W-line @8)','Prunus Armeniaca Kernel Oil @20 (non-material)'],wr=['PEG-7 Glyceryl Cocoate @5'],si=['Dimethicone @7','Amodimethicone @11'],pf=['Hydrolyzed Keratin @6'],
      reset=['Sodium Laureth Sulfate @2','Cocamidopropyl Betaine @3'],hum=[],
      exc=['Glycol Distearate @14 (pearlizing wax, 6.4)','PEG-40 Hydrogenated Castor Oil @16 (solubilizer, 6.4)','PEG-120 Methyl Glucose Dioleate @17 (PEG thickener, 6.4)','Laureth-4 @15, Laureth-23 @19, Trideceth-10 @21 (ethoxylates)']),
   wline(8,'Sodium Benzoate',['preservative_or_capped_active'],{'e3Point':9},nonmat=['Hydrogenated Castor Oil @13','Prunus Armeniaca Kernel Oil @20']),
   'moderate','moderate','moderate',
   'Convergence of silicone + cationic + protein argues toward high; post-line Hydrogenated Castor Oil @13 (waxy) and Apricot Oil @20 are recorded as the counter-signal (W-LINE item 6).',
   'Silicones plus guar plus a prominent keratin film are plausibly persistent depositing systems; calling it lightweight would understate residue.',
   'Not high: no material payload lipid (Hydrogenated Castor Oil @13 and Apricot Oil @20 are after the W-line @8), so neither W-RICH nor a lipid leg exists; the remaining set is the silicone/guar/late-amodimethicone type in an SLES/betaine C1 chassis, whose holdout reading is moderate - W1 itself is not applied because the prominent keratin film (@6) is a further family under W1 (c), so the full method decides and the protein film is judged too light to make the coating persistent against the C1 reset. Not low: multiple plausibly persistent families (W2).',
   'W-LINE item 6: the post-line lipids are what keeps the band from high, so confidence is at most moderate, neighbor high.',
   rules=('6.6','W1','W-RICH','W-LINE','W2','W3','N-ALT')),
 'focusPrimary':focus('repair_supported',[],['Hydrolyzed Keratin @6','Dimethicone @7','Amodimethicone @11'],['Guar HPTC @12','PEG-7 Glyceryl Cocoate @5'],'Coherent deposition/damage-care cluster (keratin + silicones incl. amodimethicone + guar); no listed humectant, so moisture is not supported.','repair','the formula verdict is repair_supported, so a damage/repair claim would make repair the focus.'),
 'focusSecondary':secondary(['shine']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_holds('CSA holds via the prominent listed refatting route PEG-7 Glyceryl Cocoate @5; no prominent comfort route and MB does not apply (prominent SLES @2).'),
 'dandruffSupport':NODAND}
r['unresolvedMaterialIngredients']=[]
r['notes']=['Acetyl Cedrene @26 read as a fragrance material.']
write(r)
