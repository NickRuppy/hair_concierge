import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from final_common import *
cd={}
cd['focusPrimary']={'value':'scalp_active','confidence':'high','neighboringAlternative':'none',
 'careDirection':{'verdict':'not_applicable','moistureRoutes':[],'repairRoutes':[],'sharedConditioningRoutes':[],'limitation':'Scalp role, not a repair/moisture decision.'},
 'claimRole':'candidate',
 'counterSignal':'Oily-scalp wording ("für normale bis fettige Kopfhaut") could point to clarifying; it describes the dandruff variant. Prominent MENTHOL@10 is a comfort counter-signal.',
 'decisionTrace':'Claim direction: anti-dandruff (product name "Anti-Schuppen Shampoo ...", high; manufacturer "Effektives Anti-Schuppen Shampoo für fettige Schuppen", "Beugt Schuppen ... vor", moderate). Formula compatible: dandruffSupport supported (SELENIUM SULFIDE@15, DS1). Decision: problem-led product with recognized active and dandruff positioning -> scalp_active (7.2).',
 'rationale':'scalp_active: anti-dandruff positioning in the product name plus the recognized active Selenium Sulfide@15 (7.2, DS1).','ruleIds':['7.2','DS1','E1','E2','N-ALT']}
cd['focusSecondary']={'value':[],'confidence':'moderate','neighboringAlternative':['clarifying'],
 'decisionTrace':'Empty default considered. Oily wording ("für normale bis fettige Kopfhaut", "fettige Schuppen") sits inside the dandruff units and describes the dandruff type (E2a absorbs it); it is not distinct secondary positioning for clarifying. No other in-scope claim. Kept [].',
 'rationale':'[]: no distinct secondary positioning (Section 8, E2a).','ruleIds':['8','E2a','F6','N-ALT']}
cd['usageRole']={'value':'treatment','confidence':'high','neighboringAlternative':'none','triggerCode':'recognized_active_problem_led',
 'triggerEvidence':['dandruffSupport supported: SELENIUM SULFIDE@15','product name "Anti-Schuppen Shampoo für normale bis fettige Kopfhaut" (high)','manufacturer_de: "Effektives Anti-Schuppen Shampoo für fettige Schuppen" (moderate)'],
 'losingTriggers':['none (alternating impossible: cleansing moderate)'],
 'rationale':'treatment: recognized anti-dandruff active plus a qualifying E2 dandruff claim graded high (U3). The directions ("In akuten Phasen dreimal wöchentlich ... Danach einmal wöchentlich") are a treatment schedule, not D1 reset wording.','ruleIds':['9','U1','U3','CL-SRC']}
cd['scalpComfortTarget']={'value':'not_targeted','confidence':'high','neighboringAlternative':'none',
 'rationale':'not_targeted: the only comfort wording ("Lindert Juckreiz auf der Kopfhaut") is bundled with dandruff units (next sentence, same manufacturer list) and is a dandruff symptom (SC1, E2b layer 1); no separate sensitive/dry-scalp unit.','ruleIds':['10','SC1','E2a','E2b'],'counterSignal':'Prominent MENTHOL@10; no E4 comfort route.'}
scalp={'targets':['dandruff'],'scalpTargets':{'primary':{'target':'dandruff','confidence':'high','rationale':'S-DANDRUFF passes: dandruff claim in the product name (high) plus dandruffSupport supported (SELENIUM SULFIDE@15, DS1). S-PRIMARY: dandruff is primary (R17.1); no secondary target on a dandruff-primary product (R17.2). Confidence = min(high, high).'},'secondary':None}}
recon=['Blind-to-final: focusPrimary general -> scalp_active (dandruff claim + active).',
 'Blind-to-final: usageRole regular -> treatment (U3).',
 'Blind-to-final: scalpComfortTarget not_targeted kept (low -> high): comfort wording is bundled with dandruff.',
 'Blind-to-final: focusSecondary [] kept (oily wording absorbed by the dandruff units).',
 'E2b layer 2: sensitive - bundled "Lindert Juckreiz auf der Kopfhaut" (moderate) but the S-SENSITIVE gate fails (CSA passes via GLYCERIN@5, yet no prominent E4 comfort route) -> not recorded, note dandruff_bundled_comfort_wording. Oily - "normale bis fettige Kopfhaut" in the product name (high) and "fettige Schuppen" (moderate); S-OILY clause passes (cleansing moderate, weight moderate, conditioning moderate) -> "oily", note suits_dandruff_with_oily_scalp. Dry - no dry-scalp wording.']
unc=['"fettige Schuppen" alone would be a dandruff-type descriptor; the oily combination rests on "für normale bis fettige Kopfhaut" in the product name (E2 oily lexicon "fettige Kopfhaut").',
 'VT17 alphabetical run read strictly (11-19); the alternative (7-19) changes nothing (no payload_lipid).',
 'Weight moderate vs low (dimethicone without cationic aid); kept moderate.']
build('VT17','Vichy','Dercos Anti-Schuppen Shampoo für normale bis fettige Kopfhaut','Market DE.',cd,{},scalp,False,None,[],
 ['dandruff_bundled_comfort_wording: "Lindert Juckreiz auf der Kopfhaut dank einem ausgeglichen Mikrobiom" (manufacturer, moderate); failed clause: S-SENSITIVE gate - no prominent E4 comfort route (CSA passes only via GLYCERIN@5); counter-signal MENTHOL@10',
  'suits_dandruff_with_oily_scalp: "für normale bis fettige Kopfhaut" (product name, high); S-OILY clause passed'],['oily'],unc,recon,SELF)
