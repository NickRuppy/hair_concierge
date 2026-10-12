import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from final_common import *
cd={}
cd['focusPrimary']={'value':'scalp_active','confidence':'high','neighboringAlternative':'none',
 'careDirection':{'verdict':'not_applicable','moistureRoutes':[],'repairRoutes':[],'sharedConditioningRoutes':[],'limitation':'Scalp role, not a repair/moisture decision.'},
 'claimRole':'candidate',
 'counterSignal':'The name word "Purifying" and the foreign manufacturer page ("Clarifying and detoxifying shampoo", low) point to clarifying, but the formula is not clarifying-compatible (cleansingStrength low, F6).',
 'decisionTrace':'Claim direction: anti-dandruff (pack front, high, English pack text accepted under E1 v1.6.1: "SHAMPOO FOR SCALP WITH OILY OR DRY DANDRUFF"; E2 English equivalent "dandruff"). Formula compatible: dandruffSupport supported (SELENIUM SULFIDE@9, DS1). Decision: scalp_active (7.2 problem-led with recognized active).',
 'rationale':'scalp_active: high-graded pack-front dandruff claim plus the recognized active Selenium Sulfide@9.','ruleIds':['7.2','DS1','E1','E2','N-ALT']}
cd['focusSecondary']={'value':[],'confidence':'moderate','neighboringAlternative':['clarifying'],
 'decisionTrace':'Empty default considered. Clarifying ("Purifying" name word; foreign "Clarifying and detoxifying", "deep cleansed", low) fails F6 compatibility (cleansingStrength low). Shine ("Shine", foreign, low) has no route. Kept [].','rationale':'[] (Section 8, F6, CL-SRC).','ruleIds':['8','F6','CL-SRC','N-ALT']}
cd['usageRole']={'value':'treatment','confidence':'high','neighboringAlternative':'none','triggerCode':'recognized_active_problem_led',
 'triggerEvidence':['dandruffSupport supported: SELENIUM SULFIDE@9','pack front (high): "SHAMPOO FOR SCALP WITH OILY OR DRY DANDRUFF"'],
 'losingTriggers':['occasional_reset not fired: no D1 stem from a moderate/high source ("deep cleansed" and the intensive/maintenance schedule appear only on the foreign manufacturer page, low)'],
 'rationale':'treatment: recognized active plus a qualifying dandruff claim graded high (U3).','ruleIds':['9','U1','U3','D1','CL-SRC']}
cd['scalpComfortTarget']={'value':'not_targeted','confidence':'high','neighboringAlternative':'none',
 'rationale':'not_targeted: no E2 sensitive/dry-scalp claim unit graded moderate/high; "without causing irritation" is protective wording on a low-graded foreign page; "dry dandruff" is a dandruff claim.','ruleIds':['10','SC1','E2a','CL-SRC'],'counterSignal':'CSA would pass via GLYCERIN@5, GLYCERYL OLEATE@10.'}
scalp={'targets':['dandruff'],'scalpTargets':{'primary':{'target':'dandruff','confidence':'high','rationale':'S-DANDRUFF passes: pack-front dandruff claim (high; English pack text graded at pack grade, E1 v1.6.1; "dandruff" is an E2 English equivalent) plus dandruffSupport supported (SELENIUM SULFIDE@9, DS1). Dandruff primary (R17.1), no secondary (R17.2).'},'secondary':None}}
recon=['Blind-to-final: focusPrimary general -> scalp_active.',
 'Blind-to-final: usageRole regular -> treatment (U3).',
 'Blind-to-final: scalpComfortTarget not_targeted kept (low -> high); focusSecondary [] kept (neighbor ["scalp_active"] -> ["clarifying"]).',
 'E2b layer 2: "oily or dry dandruff" - per E2 English equivalents "oily dandruff" is a dandruff claim, not oily-scalp wording; "dry dandruff" is not E2 dry-scalp wording; no comfort wording from a moderate/high source -> researchCombinationTargets [] and no E2b note.',
 'Italian/French pack lines do not qualify (closed English list); recorded only.']
unc=['"oily or dry dandruff" read as dandruff-type wording (E2 English rule); alternative reading of "oily" as oily-scalp wording would add research-only "oily" only if S-OILY passed - it fails anyway (cleansingStrength low).',
 'Observed intensity gentle vs schuppen expectation regular: dandruff rows are amber and not ranked (I2) - truthful trade-off.',
 'Bronopol (2-Bromo-2-Nitropropane-1,3-Diol@19) is a preservative outside the closed W-LINE/E3 lists; no effect.']
build('VT23','Davines','NaturalTech Purifying Shampoo','Market DE (pack shown; international manufacturer page graded low).',cd,{},scalp,False,None,[],[],[],unc,recon,SELF)
