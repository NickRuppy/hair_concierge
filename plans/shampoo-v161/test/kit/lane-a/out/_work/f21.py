import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from final_common import *
cd={}
cd['focusPrimary']={'value':'clarifying','confidence':'moderate','neighboringAlternative':'general',
 'careDirection':{'verdict':'not_applicable','moistureRoutes':[],'repairRoutes':[],'sharedConditioningRoutes':[],'limitation':'Clarifying role; the dry-lengths moisture claim is recorded as a counter-signal (moisture verdict nonspecific).'},
 'claimRole':'candidate',
 'counterSignal':'Manufacturer also claims "spendet trockenen Haarlängen bis zu 72 Stunden Feuchtigkeit" (lengths moisture); the formula has a prominent oil (NIGELLA SATIVA SEED OIL@5) and guar@8, but no coherent humectant cluster.',
 'decisionTrace':'Claim direction: deep cleansing for oily scalp (manufacturer_de, moderate: "ist ein Tiefenreinigungsshampoo, das schnell fettende Kopfhaut reinigt", "Tiefenreinigungsshampoo gegen schnell fettende Kopfhaut und trockene Haarlängen"). F6 compatibility: cleansingStrength strong, conditioningLevel moderate, weightPotential moderate -> compatible. Route: ALS@2 chassis with Charcoal Powder@9. Decision: clarifying (dominant deep-cleansing/oily-scalp job).',
 'rationale':'clarifying: explicit deep-cleansing and oily-scalp positioning (E2 "schnell fettende Kopfhaut", D1 "Tiefenreinigungsshampoo") on an F6-compatible strong formula. Confidence moderate (manufacturer-only; lengths-moisture claim competes).','ruleIds':['7.2','F6','D1','E2','CL-SRC','N-ALT']}
cd['focusSecondary']={'value':[],'confidence':'moderate','neighboringAlternative':['moisture'],
 'decisionTrace':'Empty default considered. Moisture for dry lengths is distinctly positioned, but the formula moisture verdict is nonspecific (no closed-list humectant; Polyglycerin-10 is not on it; one oil@5) - no compatible moisture route. Kept [].','rationale':'[]: positioned moisture lacks a moisture_supported route (Section 8, F1).','ruleIds':['8','F1','C2','N-ALT']}
cd['usageRole']={'value':'occasional_reset','confidence':'moderate','neighboringAlternative':'alternating','triggerCode':'explicit_deep_cleansing',
 'triggerEvidence':['D1 true: manufacturer_de (moderate) "ist ein Tiefenreinigungsshampoo", "Tiefenreinigungsshampoo gegen schnell fettende Kopfhaut"'],
 'losingTriggers':['alternating (cleansingStrength strong + reset intent: D1 lexicon, oily-scalp wording, "zieht Rückstände und Unreinheiten ... an") - loses to occasional_reset under U1'],
 'rationale':'occasional_reset: D1 true from a moderate-graded manufacturer source; U1 precedence over alternating. No daily-use directions (no U5 conflict). Confidence moderate (D1 rests on manufacturer text only, not the name).','ruleIds':['9','U1','U4','D1','CL-SRC','N-ALT']}
cd['scalpComfortTarget']={'value':'not_targeted','confidence':'high','neighboringAlternative':'none',
 'rationale':'not_targeted: no E2 sensitive/dry-scalp claim unit ("trockene Haarlängen" is a lengths claim).','ruleIds':['10','SC1','E2'],'counterSignal':'cleansingStrength strong.'}
scalp={'targets':['oily'],'scalpTargets':{'primary':{'target':'oily','confidence':'moderate','rationale':'S-OILY passes: positioning "schnell fettende Kopfhaut" (E2 oily lexicon; manufacturer_de, moderate; the dm listing name "fettige Kopfhaut" and "Haartyp: fettiges Haar" are retailer/listing attributes, low); formula: cleansingStrength strong, weightPotential moderate, conditioningLevel moderate. Confidence = min(moderate, high, moderate, moderate) = moderate. "trockene Haarlängen" is a lengths claim, so no dry target (no oily+dry conflict).'},'secondary':None}}
deep={'listing':'flagged','conf':'moderate','record':'needs_record','rationale':'D2: cleansingStrength strong, focusPrimary clarifying, usageRole occasional_reset and D1 true ("Tiefenreinigungsshampoo", manufacturer, moderate) -> flagged; regular-shampoo entry kept with intensity clarifying. Confidence = min(cleansing high, focus moderate, usage moderate, D1 moderate) = moderate. Lane records deepCleanserRecord: needs_record.'}
recon=['Blind-to-final: focusPrimary general -> clarifying (deep-cleansing + oily-scalp positioning, F6 compatible).',
 'Blind-to-final: usageRole regular -> occasional_reset (D1 true, U1 over alternating).',
 'Blind-to-final: focusSecondary [] kept (neighbor clarifying -> moisture); scalpComfortTarget not_targeted kept (low -> high).',
 'Projection: D1 true with strong formula -> observed intensity clarifying (I1) and deep-cleanser listing flagged (D2).',
 'Identity: a retailer page belongs to a different GTIN (250 ml); recorded as provenance only; packet states the same formula for the 250 ml pack.']
unc=['D1 rests on manufacturer body text ("Tiefenreinigungsshampoo"), not on the product name; graded moderate as a manufacturer claim (packet does not separate pack front/back).',
 'Weight moderate (W-RICH with strong reset); neighbor high raises the normal T4 flag.',
 'Alphabetical run 9-15 (exactly 7 entries) sets the W-line at CITRIC ACID@10; NIGELLA SATIVA SEED OIL@5 is material either way (also before any class a/b candidate).']
build('VT21','Wahre Schätze (Garnier)','Garnier Wahre Schätze Ausgleichendes Shampoo Anziehende Aktivkohle & Schwarzkümmelöl','Market DE; 300 ml; same formula published for a 250 ml GTIN (not combined).',cd,{},scalp,True,'moderate',[],['deep_cleanser_listing: needs_record'],[],unc,recon,SELF,deep=deep)
