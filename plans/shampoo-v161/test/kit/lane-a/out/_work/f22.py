import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from final_common import *
fp=load_fp('VT22'); fpr=fp['directProperties']['focusPrimary']
cd={}
cd['focusPrimary']={'value':'general','confidence':'moderate','neighboringAlternative':'moisture',
 'careDirection':fpr['careDirection'],'claimRole':'not_applicable',
 'counterSignal':'Retailer copy (low) claims "Spendet trockenem Haar Feuchtigkeit" and "beruhigt die aus dem Gleichgewicht geratene Kopfhaut"; a recognized dandruff active (Piroctone Olamine@12) is present.',
 'decisionTrace':'Claim direction: moisture for dry hair and dry/unbalanced scalp, plus thinning/density (dm, low; Austrian retailer, low). Low-graded claims can be a focus candidate only when the formula independently supports the focus: moisture verdict nonspecific (no prominent humectant; Panthenol@24 late) -> no; scalp_active needs scalpComfortTarget targeted (fails: low positioning, CSA fails). Density/thinning claims ignored (F5). Decision: general.',
 'rationale':'general: every claim is retailer-only (low, CL-SRC), and no specialist focus is independently supported by the formula. Neighbor moisture.','ruleIds':['7.2','CL-SRC','F1','F5','N-ALT']}
cd['focusSecondary']={'value':[],'confidence':'moderate','neighboringAlternative':['scalp_active'],
 'decisionTrace':'Empty default considered and kept: only low-graded positioning; no independently supported secondary.','rationale':'[] (Section 8, CL-SRC).','ruleIds':['8','CL-SRC','N-ALT']}
cd['usageRole']={'value':'regular','confidence':'moderate','neighboringAlternative':'frequent','triggerCode':'none','triggerEvidence':[],
 'losingTriggers':['frequent not fired: "für den täglichen Gebrauch geeignet" is retailer-only (low) and cleansingStrength is strong','treatment not fired: no dandruff claim (U3, R17.3)','alternating not fired: no reset intent from a moderate/high source'],
 'rationale':'regular: no trigger from a moderate/high source; the active has no dandruff positioning.','ruleIds':['9','U2','U3','U4','CL-SRC','N-ALT']}
cd['scalpComfortTarget']={'value':'not_targeted','confidence':'high','neighboringAlternative':'none',
 'rationale':'not_targeted: SC1 fails (dry/sensitive-scalp wording "trockener Kopfhaut", "beruhigt die aus dem Gleichgewicht geratene Kopfhaut" is retailer-only, low) and CSA fails (no prominent E4 comfort or humectant/refatting route; Panthenol@24 and Niacinamide@30 follow Parfum@11).','ruleIds':['10','SC1','CSA','CL-SRC','E4'],'counterSignal':'cleansingStrength strong.'}
scalp={'targets':['ordinary'],'scalpTargets':{'primary':{'target':'ordinary','confidence':'moderate','rationale':'S-ORDINARY ways 2, 3 and 4: thinning/density wording is hair-loss adjacent (way 2); recognized active without a dandruff claim (way 3); the claimed dry and sensitive targets fail (way 4, S-FAIL): positioning gate fails (claim units graded low, retailer only) and the formula gate also fails (scalpComfortTarget not_targeted; no prominent E4 route). Confidence moderate.'},'secondary':None}}
recon=['Blind-to-final: focusPrimary general kept (low -> moderate); neighbor scalp_active -> moisture.',
 'Blind-to-final: usageRole regular kept (low -> moderate); neighbor treatment -> frequent (no dandruff claim).',
 'Blind-to-final: scalpComfortTarget not_targeted kept (low -> high).',
 'S-FAIL raised: dry and sensitive claim units exist but only in retailer copy (low) and the formula gates fail.',
 'All positioning is retailer-only; one source is Austrian (non-German) retailer copy, also low.']
unc=['Formula source tier 4 (retailer fallback) and identity confidence moderate; no conflict visible.',
 'Weight moderate vs high (silicone + guar coacervate with strong reset); neighbor high raises fine/normal T4 flags; conditioning neighbor moderate raises the coarse flag.',
 '"Bei dünner werdendem ... Haar", "für dichtes, volleres Haar" treated as hair-density (out of scope, F5/S-HAIRLOSS), not volume.']
build('VT22','Hair Biology (Procter & Gamble)','hair biology Shampoo Revitalize & Soothe (Meno Balance)','Market DE (dm.de); identity confidence moderate per packet.',cd,{},scalp,False,None,
 ['review_specialist_gate_failed: dry (positioning gate: only low-graded retailer units "trockener Kopfhaut"; formula gate: scalpComfortTarget not_targeted, no prominent E4 humectant/refatting route); sensitive (positioning gate: only low-graded "beruhigt die aus dem Gleichgewicht geratene Kopfhaut"; formula gate: not_targeted, no prominent E4 comfort route)'],
 ['active_without_dandruff_positioning','hair_loss_claim_not_evaluated'],[],unc,recon,SELF)
