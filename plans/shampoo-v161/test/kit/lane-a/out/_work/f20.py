import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from final_common import *
fp=load_fp('VT20'); fpr=fp['directProperties']['focusPrimary']
cd={}
cd['focusPrimary']={'value':'general','confidence':'moderate','neighboringAlternative':'volume',
 'careDirection':fpr['careDirection'],'claimRole':'not_applicable',
 'counterSignal':'Manufacturer: "Bewusst leicht dosierte Pflegestoffe pflegen das Haar, ohne es zu beschweren – damit die Frisur ihr Volumen behält" (volume-adjacent, protective framing) and "Speziell für feines, brüchiges Haar" (brittle -> repair candidate).',
 'decisionTrace':'Claim direction: hair loss (dominant; "Beugt menopausalem Haarausfall vor", Phyto-Coffein-Complex) -> ignored (F5). Remaining in-scope claims: "brüchiges Haar" (repair candidate) - formula verdict nonspecific (one late protein @17, PQ-7@13), not compatible; volume retention wording is a "does not weigh down" statement, not a dominant lift/body job. Decision: general.',
 'rationale':'general: the dominant claim is hair loss (out of scope, F5); the remaining brittle-hair claim has no repair_supported formula and the volume wording is protective, so no specialist focus has a claim-plus-formula case. Neighbor volume (light formula, volume-retention wording).','ruleIds':['7.2','F5','F1','N-ALT']}
cd['focusSecondary']={'value':[],'confidence':'moderate','neighboringAlternative':['volume'],
 'decisionTrace':'Empty default considered and kept: no distinct secondary with an independent route (hair-loss claims excluded, F5).','rationale':'[] (Section 8, F5).','ruleIds':['8','F5','N-ALT']}
cd['usageRole']={'value':'frequent','confidence':'moderate','neighboringAlternative':'regular','triggerCode':'explicit_frequent_non_strong',
 'triggerEvidence':['manufacturer_de directions (moderate): "Täglich anwenden", "Bei jeder Haarwäsche benutzen"','cleansingStrength moderate (not strong)'],'losingTriggers':[],
 'rationale':'frequent: explicit "Täglich anwenden" from a moderate-graded manufacturer source and a non-strong formula (U2). The caffeine/hair-loss positioning never fires treatment (U3, F5).','ruleIds':['9','U2','U3','F5','CL-SRC','N-ALT']}
cd['scalpComfortTarget']={'value':'not_targeted','confidence':'high','neighboringAlternative':'none',
 'rationale':'not_targeted: no E2 sensitive/dry-scalp claim unit ("stärken die Widerstandskraft von Kopfhaut und Haarfollikeln" is not lexicon wording and is ingredient-reputation framing).','ruleIds':['10','SC1','E2','E2a'],'counterSignal':'CSA would pass (Panthenol@4, Niacinamide@16).'}
scalp={'targets':['ordinary'],'scalpTargets':{'primary':{'target':'ordinary','confidence':'moderate','rationale':'S-ORDINARY ways 1 and 2: no qualifying E2 claim unit (way 1, manufacturer source -> high) and the only scalp-adjacent positioning is hair loss (way 2 -> moderate); lowest = moderate (13.8). Hair-loss claim not evaluated.'},'secondary':None}}
recon=['Blind-to-final: focusPrimary general kept (low -> moderate); neighbor clarifying -> volume.',
 'Blind-to-final: usageRole regular -> frequent ("Täglich anwenden", manufacturer, moderate).',
 'Blind-to-final: focusSecondary [] kept; scalpComfortTarget not_targeted kept (low -> high).',
 'Hair-loss claims (menopausal hair loss, caffeine reaching the follicle, growth factors) not evaluated (F5, S-HAIRLOSS).']
unc=['Volume vs general: "damit die Frisur ihr Volumen behält" read as protective/no-weigh-down wording; alternative focus volume (formula compatible: weight low, conditioning low).',
 'Weight low with two light families (W2); neighbor moderate raises the fine T4 flag.',
 '"für feines Haar" is a thickness claim and never changes fit (T2).']
build('VT20','Plantur 39 (Dr. Kurt Wolff)','Plantur 39 Phyto-Coffein-Shampoo für feines, brüchiges Haar','Market DE; identity confidence moderate per packet.',cd,{},scalp,False,None,[],['hair_loss_claim_not_evaluated'],[],unc,recon,SELF)
