import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from final_common import *
fp=load_fp('VT15'); fpr=fp['directProperties']['focusPrimary']
cd={}
cd['focusPrimary']={'value':'general','confidence':'moderate','neighboringAlternative':'moisture',
 'careDirection':fpr['careDirection'],'claimRole':'not_applicable',
 'counterSignal':'The manufacturer mentions "hydratisiertes ... Blond" and Provitamin B5 (Panthenol@11), a possible moisture candidate; "reichhaltige Formel" is a claim that cannot raise conditioning (C7/3.2).',
 'decisionTrace':'Claim direction: colour toning (yellow-tone neutralization with violet pigments, Acid Violet 43@22 / Acid Blue 9@21), which has no focus value; secondary wording "hydratisiertes Blond" (moisture candidate, moderate). Formula compatible with moisture: no - verdict nonspecific (single humectant Panthenol@11, one lipid). Decision: general (F1: moisture language over a nonspecific formula stays general).',
 'rationale':'general: the dominant job is toning, which no focus value covers, and the only in-scope care wording (hydration) sits on a nonspecific formula (F1). Neighbor moisture.',
 'ruleIds':['7.2','7.3','F1','CL-SRC','N-ALT']}
cd['focusSecondary']={'value':[],'confidence':'moderate','neighboringAlternative':['moisture'],
 'decisionTrace':'Empty default considered and kept: no secondary positioning with an independent compatible route ("strahlendes Blond" is colour brightness, not gloss; moisture route nonspecific).','rationale':'[] (Section 8).','ruleIds':['8','N-ALT']}
cd['usageRole']={'value':'regular','confidence':'moderate','neighboringAlternative':'occasional_reset','triggerCode':'none','triggerEvidence':[],
 'losingTriggers':['occasional_reset not fired: manufacturer directions "Wöchentlich oder nach Bedarf anwenden, um Gelbstich zu neutralisieren" limit use for toning, not for a reset/deep-cleansing purpose; no D1 stem anywhere (D1 not true)','alternating not fired: cleansingStrength moderate (and no reset intent)','retailer "abwechselnd mit deinem regulären Shampoo verwenden" is low-graded (CL-SRC)'],
 'rationale':'regular: no trigger fires. The weekly-use direction is a toning schedule, not reset positioning, so D1 is false; alternating needs a strong formula. Confidence moderate because the weekly direction could be read as D1 (neighbor occasional_reset).','ruleIds':['9','U1','U4','D1','CL-SRC','N-ALT']}
cd['scalpComfortTarget']={'value':'not_targeted','confidence':'high','neighboringAlternative':'none',
 'rationale':'not_targeted: no E2 sensitive/dry-scalp claim unit; "ohne auszutrocknen" (retailer) is protective wording.','ruleIds':['10','SC1','E2a'],'counterSignal':'none'}
scalp={'targets':['ordinary'],'scalpTargets':{'primary':{'target':'ordinary','confidence':'high','rationale':'S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present -> high.'},'secondary':None}}
recon=['Blind-to-final: focusPrimary general kept; confidence low -> moderate (claims reveal a toning job without a focus value; moisture wording over a nonspecific formula).',
 'Blind-to-final: usageRole regular kept; confidence low -> moderate; neighbor frequent -> occasional_reset (weekly toning direction).',
 'Blind-to-final: scalpComfortTarget not_targeted kept (low -> high).',
 'Claim "silikonfreie Formel" matches the INCI (no silicone); "reichhaltige Formel" cannot raise conditioning or weight (3.2, C7).']
unc=['D1 from "Wöchentlich oder nach Bedarf anwenden": read as a toning schedule, not an occasional reset; alternative D1 true -> usageRole occasional_reset and note deep_cleansing_name_ordinary_formula (no row change, intensity stays regular).',
 'Conditioning moderate vs high (Glyceryl Oleate as fatty route for C2); kept moderate.',
 'Weight moderate vs high (W-RICH with moderate reset); kept moderate, neighbor high drives the T4 flags.']
build('VT15','JOHN FRIEDA','Violet Crush Intensiv Silber Shampoo','Market DE.',cd,{},scalp,False,None,[],[],[],unc,recon,SELF)
