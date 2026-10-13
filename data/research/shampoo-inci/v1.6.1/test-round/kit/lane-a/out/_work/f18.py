import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from final_common import *
cd={}
cd['focusPrimary']={'value':'clarifying','confidence':'moderate','neighboringAlternative':'general',
 'careDirection':{'verdict':'not_applicable','moistureRoutes':[],'repairRoutes':[],'sharedConditioningRoutes':[],'limitation':'Clarifying/oily role, not a repair/moisture decision.'},
 'claimRole':'candidate',
 'counterSignal':'The cleansing is only moderate (C5 brought down by the C3b amine oxide), and "sanft gereinigt" softens the reset message; shine ("voller Glanz") is also claimed.',
 'decisionTrace':'Claim direction: clarifying / oily hair (manufacturer_de, moderate: "Normales bis fettiges Haar wird mit diesem ... klärenden Shampoo sanft gereinigt", "Mizellen entfernen sanft Produktrückstände und Verunreinigungen"). F6 compatibility: cleansingStrength moderate, conditioningLevel moderate (not high), weightPotential moderate (not high) -> compatible. Compatible route: Sodium Coco-Sulfate@2 chassis with micellar co-surfactants and Vinegar@13. Decision: clarifying.',
 'rationale':'clarifying: oily-hair (E2 oily term "normales bis fettiges Haar", v1.6.1) and clarifying/buildup positioning on an F6-compatible formula. Confidence moderate (manufacturer-only, wayback capture).','ruleIds':['7.2','F6','E2','CL-SRC','N-ALT']}
cd['focusSecondary']={'value':[],'confidence':'moderate','neighboringAlternative':['shine'],
 'decisionTrace':'Empty default considered. Shine ("voller Glanz") has no independent route: Vinegar@13/Citric Acid@15 are pH adjusters/acids that cannot create a secondary shine (F4). Volume appears only in retailer copy (low). Kept [].','rationale':'[] (Section 8, F4).','ruleIds':['8','F4','CL-SRC','N-ALT']}
cd['usageRole']={'value':'regular','confidence':'moderate','neighboringAlternative':'alternating','triggerCode':'none','triggerEvidence':[],
 'losingTriggers':['alternating not fired: reset intent present ("klärenden", "entfernen ... Produktrückstände", oily-hair wording; manufacturer, moderate) but cleansingStrength is moderate, not strong (U4)'],
 'rationale':'regular: reset intent exists but alternating needs cleansingStrength strong; no frequency wording, no D1 ("Purifying", "klärend" are not D1 stems), no active. Confidence moderate because the cleansing neighbor is strong (neighbor alternating).','ruleIds':['9','U1','U4','D1','N-ALT']}
cd['scalpComfortTarget']={'value':'not_targeted','confidence':'high','neighboringAlternative':'none',
 'rationale':'not_targeted: no E2 sensitive or dry-scalp claim unit.','ruleIds':['10','SC1'],'counterSignal':'Prominent cooling agents/essential oil (Peppermint Oil@7, Menthol@8, Camphor@9).'}
scalp={'targets':['oily'],'scalpTargets':{'primary':{'target':'oily','confidence':'moderate','rationale':'S-OILY passes: positioning "Normales bis fettiges Haar wird mit diesem ... klärenden Shampoo sanft gereinigt" (E2 oily-hair term, v1.6.1; manufacturer_de, moderate); formula: cleansingStrength moderate, weightPotential moderate (not high), conditioningLevel moderate (not high). Confidence = min(positioning moderate, cleansing moderate, weight moderate, conditioning moderate) = moderate.'},'secondary':None}}
recon=['Blind-to-final: focusPrimary general -> clarifying (oily-hair + clarifying positioning, F6 compatible).',
 'Blind-to-final: focusSecondary neighbor ["clarifying"] -> ["shine"] (clarifying became primary).',
 'Blind-to-final: usageRole regular kept, neighbor frequent -> alternating (reset intent with a moderate formula whose neighbor is strong).',
 'Blind-to-final: scalpComfortTarget not_targeted kept (low -> high).',
 'The oily target relies on the v1.6.1 oily-hair term ("normales bis fettiges Haar", S3); under v1.6 it would have been ordinary.']
unc=['Oily claim unit reading: "Normales bis fettiges Haar wird ... gereinigt" read as the product being for oily hair (E2a "für/bei"); alternative: a hair-type description only, which would make the target ordinary (way 1).',
 'Manufacturer source is a Wayback capture (2026-04-16) of the DE page; graded moderate as manufacturer_de per packet.',
 'cleansingStrength moderate rests on Cocamidopropylamine Oxide@16 as the second buffer (C3b); neighbor strong would fire alternating (U4) and S-OILY still passes; I1 stays regular (no D1).',
 'weightPotential neighbor high would fail the S-OILY weight clause; no rule raises a flag for that, recorded here.',
 'Retailer claims (volume for fine hair, "ohne zu beschweren", "schwerelos") are low and cannot move anything.']
build('VT18','Aveda','Rosemary Mint Purifying Shampoo','Market DE; identity confidence moderate per packet.',cd,{},scalp,False,None,[],[],[],unc,recon,SELF)
