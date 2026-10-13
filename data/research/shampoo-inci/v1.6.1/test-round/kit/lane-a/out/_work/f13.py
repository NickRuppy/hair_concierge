import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from final_common import *
fp=load_fp('VT13'); fpr=fp['directProperties']['focusPrimary']
cd={}
cd['focusPrimary']={'value':'moisture','confidence':'moderate','neighboringAlternative':'repair',
 'careDirection':fpr['careDirection'],'claimRole':'tie_breaker',
 'counterSignal':'The formula is dual_supported: amino-silicone, silicone quat, cationic conditioners and Hydrolyzed Milk Protein@26 support repair, and the manufacturer text also names "sprödem" (brittle) hair; most routes sit after sub-1 % vitamins.',
 'decisionTrace':'Claim direction: moisture (manufacturer_de, moderate: "Gib stumpfem, sprödem und trockenem Haar einen pflegenden Feuchtigkeitskick", "feuchtigkeitsspendendes WASH Produkt", "ideal für von Natur aus trockenes Haar"). Formula compatible: yes, verdict dual_supported (moisture routes Glycerin@8, Panthenol@11, Shea Butter@19, Evening Primrose Oil@20, Rosa Canina Fruit Oil@24). Decision: a moderate-graded claim breaks the dual tie toward moisture (F1, CL-SRC).',
 'rationale':'moisture: a dual_supported formula plus a dominant moderate-graded dryness/hydration claim (tie_breaker, F1). Confidence moderate because the claim is manufacturer-only (moderate) and the formula supports repair equally; neighbor repair.',
 'ruleIds':['7.2','7.3','F1','CL-SRC','E1','N-ALT']}
cd['focusSecondary']={'value':[],'confidence':'moderate','neighboringAlternative':['shine'],
 'decisionTrace':'Empty default considered and kept. Shine wording ("super glättendes", "zu einem gesunden Glanz verhelfen") is stated as an outcome of the same moisture/antioxidant care, not distinct positioning (F2); retailer smoothing/sealing text is low-graded. No exception code.',
 'rationale':'[]: no distinct secondary positioning with an independent route (Section 8, F2, F3).','ruleIds':['8','F2','F3','CL-SRC','N-ALT']}
cd['usageRole']={'value':'regular','confidence':'moderate','neighboringAlternative':'frequent','triggerCode':'none','triggerEvidence':[],
 'losingTriggers':['explicit_frequent_non_strong not fired: "Kann täglich ... verwendet werden" appears only in retailer copy (amazon_de, low; CL-SRC)'],
 'rationale':'regular: no trigger from a moderate/high source. The only frequency wording is retailer-only (low), which cannot fire frequent (CL-SRC, Section 9). Neighbor frequent.','ruleIds':['9','U2','CL-SRC','N-ALT']}
cd['scalpComfortTarget']={'value':'not_targeted','confidence':'high','neighboringAlternative':'none',
 'rationale':'not_targeted: no E2 sensitive or dry-scalp claim unit (only dry hair/lengths wording), so SC1 fails; complete ordinary formula.','ruleIds':['10','SC1','E2'],'counterSignal':'CSA formula half would pass (Panthenol@11, Glycerin@8).'}
scalp={'targets':['ordinary'],'scalpTargets':{'primary':{'target':'ordinary','confidence':'high','rationale':'S-ORDINARY way 1: no qualifying E2 claim unit ("trockenes Haar" is a lengths claim); the packet has a manufacturer source -> high (13.8).'},'secondary':None}}
recon=['Blind-to-final: focusPrimary general -> moisture (manufacturer_de moderate dryness/hydration claim breaks the dual_supported tie, F1).',
 'Blind-to-final: focusSecondary [] kept; confidence low -> moderate (positioning now visible).',
 'Blind-to-final: usageRole regular kept; confidence low -> moderate (only retailer "täglich" wording, low).',
 'Blind-to-final: scalpComfortTarget not_targeted kept; confidence low -> high (no SC1 positioning).',
 'Formula-only properties (cleansing, conditioning, weight, dandruff) unchanged (3.2).',
 'Identity: manufacturer DE storefront shows a "Made in U.S.A." and a "Made in EU" INCI list; the frozen formula is the EU list, truncated by the shop at "Benzyl Alcoho". Recorded as provenance (ID-3).']
unc=['Formula truncation at the last entry ("Benzyl Alcoho"): treated as complete per packet. Any further entry would follow Fragrance@45 (not prominent) and could only matter if it were a dandruff active, which is implausible; alternative: low/unknown dandruffSupport.',
 'Weight high vs moderate: all deposition routes follow sub-1 % vitamins; W-RICH + weak reset chosen (P0); alternative moderate.',
 'Conditioning high via C2 with late routes; alternative moderate.',
 'Focus moisture vs repair ("sprödem" brittle wording, protein + amino-silicone); moisture chosen as the dominant claim direction.',
 'Retinyl Palmitate@9 read as a vitamin active, not a payload emollient; reading it as payload_lipid changes nothing (material, other lipids already material).']
build('VT13','Kevin.Murphy','Hydrate-Me.Wash','Packet market DE (German-language EU storefront).',cd,{},scalp,False,None,[],[],[],unc,recon,SELF)
