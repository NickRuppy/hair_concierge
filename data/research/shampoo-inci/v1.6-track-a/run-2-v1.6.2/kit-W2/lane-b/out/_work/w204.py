import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v16-rollout/tmp/tracka-run2/kit-W2/lane-b/out/_work')
from common import *
r=base('W204','No synonym or split entries; normalized positions = packet positions (ID-2).','Parfum @7; prominent = positions 1-6 (E3).')
r['formulaFacts']={
 'surfactants':{'definingAnionic':'Sodium Laureth Sulfate @2 (strong anionic, ether type)','reinforcingRoutes':[],'buffers':['Cocamidopropyl Betaine @4 (amphoteric)'],
   'notCleansing':['Sodium Xylenesulfonate @3 (hydrotrope)','Trideceth-10 @23 (ethoxylate solubilizer)'],
   'nonProminentSurfactants':['TEA-Dodecylbenzenesulfonate @18 (strong anionic, ether/sulfonate type, after E3: recorded, not a reinforcing route)'],'c3aOrC3b':'none'},
 'conditioningRoutes':{'silicone':['Dimethiconol @10','Dimethicone @14'],'cationic_polymer':['Guar Hydroxypropyltrimonium Chloride @11'],'payload_lipid':[],'weak_refatter':[],'pearlizing':[]},
 'humectants':['Panthenol @19'],'actives':['Piroctone Olamine @6 (recognized anti-dandruff active)','Sodium Salicylate @15','Panthenol @19','Niacinamide @30'],
 'recognizedDandruffActives':['Piroctone Olamine @6'],
 'exposure':{'fragrance':'Parfum @7 plus Hexamethylindanopyran @13, Coumarin @21, Hexyl Cinnamal @22, Linalyl Acetate @25, Tetramethyl Acetyloctahydronaphthalenes @26, Benzyl Salicylate @27, Linalool @28, Limonene @29','coolingAgents':['Menthol @12 (after Parfum, not prominent)'],'essentialOils':['Citrus Aurantium Peel Oil @24 (not prominent)']},
 'csa':{'listedComfortRoutesProminent':[],'listedHumectantRefattingRoutesProminent':[],'mildBase':'no: prominent Sodium Laureth Sulfate @2','csaHolds':False,'note':'Panthenol @19 and Niacinamide @30 are listed routes but not prominent; no prominent unlisted candidate either.'},
 'preservativesAndOther':['Sodium Citrate @5','Citric Acid @8','Sodium Chloride @9','Sodium Benzoate @16','Tetrasodium EDTA @17','Sodium Hydroxide @20','Acetic Acid @31','Benzyl Alcohol @32','Propylene Glycol @33','Triethylene Glycol @34','CI 19140 @35','CI 17200 @36']}
r['directProperties']={
 'cleansingStrength':prop('moderate','high','none','Moderate: C1 - defining anionic Sodium Laureth Sulfate @2 with prominent buffer Cocamidopropyl Betaine @4; TEA-Dodecylbenzenesulfonate @18 is after Parfum @7, so it is not a reinforcing route (C4). Sodium Xylenesulfonate @3 is a hydrotrope, not a route.',['C1','C3','C4','E3']),
 'conditioningLevel':prop('moderate','moderate','low','Moderate: one meaningful system - a silicone pair (Dimethiconol @10, Dimethicone @14) with cationic guar (@11) as a coacervate-type conditioning system. C2 not met: no silicone is early (both after Parfum @7), no pearlizing route, the only listed humectant (Panthenol @19) is late. Counter-signal: all conditioning routes are post-E3; neighbor low.',['5','C2','E3','N-ALT']),
 'weightPotential':weight('moderate','moderate','high','Moderate: silicones plus cationic guar plausibly deposit noticeable but bounded residue; no payload lipid, no rich architecture, effective C1 reset.',
   ev(cp=['Guar Hydroxypropyltrimonium Chloride @11'],si=['Dimethiconol @10','Dimethicone @14'],reset=['Sodium Laureth Sulfate @2','Cocamidopropyl Betaine @4','TEA-Dodecylbenzenesulfonate @18 (late)'],hum=['Panthenol @19'],
      exc=['Menthol @12, fragrance materials and Citrus Aurantium Peel Oil @24 (fragrance/cooling, 6.4)','Sodium Xylenesulfonate @3 (hydrotrope)','Trideceth-10 @23 (solubilizer)']),
   wline(6,'Piroctone Olamine',['preservative_or_capped_active'],{'e3Point':7}),
   'moderate','moderate','moderate',
   'Silicones and guar are listed after Parfum @7 and could be small amounts; W1 does not apply (no amodimethicone), so it gives no support either way.',
   'Two plausibly persistent deposition families (silicone, cationic polymer) converge; silicones deposit by dilution deposition even when listed late (W-LINE item: non-lipid families read as v1.6).',
   'Not high: only two families, no payload lipid (W-RICH impossible), no film former or protein, and an effective SLES/betaine reset offsets part of the deposit. Not low: a silicone pair plus guar is more than a single light route (W2). Neighbor high is recorded because the silicone/guar coacervate system is designed to deposit and the two adjacent bands are not clearly unequal toward low (N-ALT, heavier when equally realistic).',
   'Silicone and guar concentrations unknown (post-Parfum).'),
 'focusPrimary':focus('nonspecific',[],[],['Dimethiconol @10','Dimethicone @14','Guar HPTC @11'],'Generic silicone/guar conditioning; no coherent repair or moisture cluster.','scalp_active','a recognized dandruff active (Piroctone Olamine @6) with menthol makes an anti-dandruff positioning the most plausible specialist role.'),
 'focusSecondary':secondary(['scalp_active']),
 'usageRole':usage(False),
 'scalpComfortTarget':SCT_csa_fails('no listed comfort or humectant/refatting route is prominent (Panthenol @19, Niacinamide @30 are after Parfum @7) and MB fails (prominent SLES @2); counter-signal Menthol @12.'),
 'dandruffSupport':DAND(6)}
r['unresolvedMaterialIngredients']=[]
r['notes']=['Hexamethylindanopyran @13 read as a fragrance material (excluded).']
write(r)
