import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from final_common import *
fp=load_fp('VT14'); fpr=fp['directProperties']['focusPrimary']
cd={}
cd['focusPrimary']={'value':'moisture','confidence':'moderate','neighboringAlternative':'repair',
 'careDirection':fpr['careDirection'],'claimRole':'tie_breaker',
 'counterSignal':'Repair routes are equally present (Hydrolyzed Wheat Protein@8, Hydrolyzed Vegetable Protein PG-Propyl Silanetriol@12, amino-silicone copolymer@16) and the manufacturer also claims "stärkt die Haarstruktur".',
 'decisionTrace':'Claim direction: moisture (manufacturer_de, moderate: "Shampoo für trockenes Haar, das geschmeidig macht, Feuchtigkeit spendet", "Perfekt für trockenes Haar", "feuchtigkeitsspendendes Shampoo speziell für trockenes Haar"). Formula compatible: dual_supported; moisture route Glycerin@6, Sodium PCA@14, Argan Oil@7, Sunflower Seed Oil@9. Decision: the dominant dry-hair/hydration claim breaks the tie (F1).',
 'rationale':'moisture: dual_supported formula, dominant moderate-graded dry-hair/hydration positioning as tie_breaker (F1). Confidence moderate (manufacturer-only claim; strengthening claim and protein routes also present); neighbor repair.',
 'ruleIds':['7.2','7.3','F1','CL-SRC','N-ALT']}
cd['focusSecondary']={'value':[],'confidence':'moderate','neighboringAlternative':['repair'],
 'decisionTrace':'Empty default considered. Candidates: repair ("stärkt die Haarstruktur", "Stärkt und reduziert Frizz") has an independent protein route but the wording is generic strengthening, not damage/breakage/brittleness positioning (F1), so it is not distinct repair positioning; shine ("Arganöl bringt das Haar zum Glänzen") rests on Argan Oil@7, already cited for moisture (F2/F3); colour/UV protection has no focus value. Kept [].',
 'rationale':'[]: no qualifying distinct secondary (Section 8, F1, F2, F3). Neighbor ["repair"].','ruleIds':['8','F1','F2','F3','N-ALT']}
cd['usageRole']={'value':'frequent','confidence':'moderate','neighboringAlternative':'regular','triggerCode':'explicit_frequent_non_strong',
 'triggerEvidence':['manufacturer_de directions (moderate): "Täglich anwendbar."','cleansingStrength low (not strong)'],'losingTriggers':[],
 'rationale':'frequent: explicit frequency wording "Täglich anwendbar" from a moderate-graded manufacturer source (U2, CL-SRC) and cleansingStrength is not strong. Confidence moderate (manufacturer-only); neighbor regular.','ruleIds':['9','U1','U2','CL-SRC','N-ALT']}
cd['scalpComfortTarget']={'value':'not_targeted','confidence':'high','neighboringAlternative':'none',
 'rationale':'not_targeted: no E2 sensitive or dry-scalp claim unit ("sanft", "trockenes Haar" are mildness/lengths wording), so SC1 fails.','ruleIds':['10','SC1','E2'],'counterSignal':'"sanftes Shampoo" is mildness wording only.'}
scalp={'targets':['ordinary'],'scalpTargets':{'primary':{'target':'ordinary','confidence':'high','rationale':'S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present -> high.'},'secondary':None}}
recon=['Blind-to-final: focusPrimary general -> moisture (claim tie_breaker over dual_supported formula).',
 'Blind-to-final: usageRole regular -> frequent (manufacturer "Täglich anwendbar", cleansing not strong).',
 'Blind-to-final: focusSecondary [] kept (confidence low -> moderate); scalpComfortTarget not_targeted kept (low -> high).',
 'Formula-only properties unchanged.']
unc=['Focus moisture vs repair: strengthening claim + two proteins; moisture chosen as the dominant claim (name "True Soft", "für trockenes Haar").',
 'Secondary repair from "stärkt die Haarstruktur": read as generic strengthening, not repair positioning; alternative ["repair"] (independent protein route exists).',
 'Weight high (W-RICH + weak reset with liquid oils at 7/9); alternative moderate.']
build('VT14','Maria Nila','True Soft Shampoo','Market DE (manufacturer DE shop).',cd,{},scalp,False,None,[],[],[],unc,recon,SELF)
