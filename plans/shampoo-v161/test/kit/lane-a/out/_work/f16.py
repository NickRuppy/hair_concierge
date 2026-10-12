import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from final_common import *
cd={}
cd['focusPrimary']={'value':'scalp_active','confidence':'high','neighboringAlternative':'none',
 'careDirection':{'verdict':'not_applicable','moistureRoutes':[],'repairRoutes':[],'sharedConditioningRoutes':[],'limitation':'Chosen focus is a scalp role, not a repair/moisture decision.'},
 'claimRole':'candidate',
 'counterSignal':'Lengths-care wording also present (manufacturer: "Kräftigt sensibilisierte Haarfasern", "Spendet dem Haar intensive Feuchtigkeit"); a recognized dandruff active (PIROCTONE OLAMINE@24) is present without any dandruff claim.',
 'decisionTrace':'Claim direction: dry/sensitive scalp (product name "... Shampoo trockene Kopfhaut", high; manufacturer_de, moderate: "Gegen Juckreiz", "Für empfindliche, trockene Kopfhaut", "Mildert effektiv Juckreiz, Hautbrennen und Rötungen"). F7 step 1: the product name names the scalp role ("trockene Kopfhaut"), so scalp_active is primary. Formula compatible: scalpComfortTarget targeted (CSA: PANTHENOL@21 comfort, GLYCERIN@6 humectant, both prominent). Decision: scalp_active.',
 'rationale':'scalp_active: explicit dry/sensitive-scalp positioning named in the product name (F7 step 1) with a targeted, formula-compatible comfort architecture (7.2, SC1, CSA).',
 'ruleIds':['7.2','F7','SC1','CSA','E1','N-ALT']}
cd['focusSecondary']={'value':[],'confidence':'moderate','neighboringAlternative':['moisture'],
 'decisionTrace':'Empty default considered. Moisture ("Spendet dem Haar intensive Feuchtigkeit") is positioned, but the formula moisture verdict is nonspecific (GLYCERIN@6 and PANTHENOL@21 only, both cited for the scalp route) - no independent route (F3). Repair ("Kräftigt sensibilisierte Haarfasern") is generic strengthening without damage/breakage positioning (F1). Kept [].',
 'rationale':'[]: no secondary with distinct positioning and an independent route (Section 8, F3).','ruleIds':['8','F1','F3','N-ALT']}
cd['usageRole']={'value':'regular','confidence':'high','neighboringAlternative':'none','triggerCode':'none','triggerEvidence':[],
 'losingTriggers':['treatment not fired: dandruffSupport supported but no E2 dandruff claim unit (U3, R17.3)'],
 'rationale':'regular: no frequency wording, no D1, not strong, and no dandruff claim for treatment (U3).','ruleIds':['9','U3','N-ALT']}
cd['scalpComfortTarget']={'value':'targeted','confidence':'high','neighboringAlternative':'none',
 'rationale':'targeted: SC1 holds (E2 sensitive/dry claim units from the product name, high, and manufacturer_de, moderate: "Gegen Juckreiz", "Für empfindliche, trockene Kopfhaut", "Mildert effektiv Juckreiz, Hautbrennen und Rötungen") and CSA holds (prominent E4 comfort route PANTHENOL@21, humectant GLYCERIN@6; E3 point PARFUM@38). No CSA counter-signal (cleansing low, no cooling agent, no prominent essential oil).',
 'ruleIds':['10','SC1','CSA','E2','E3','E4'],'counterSignal':'PANTHENOL@21 sits inside the alphabetized block (run 9-37), so its amount is unknown; declared PARFUM@38.'}
scalp={'targets':['dry','sensitive'],'scalpTargets':{
 'primary':{'target':'dry','confidence':'moderate','rationale':'S-DRY passes: positioning "trockene Kopfhaut" in the exact product name (high) and "Für empfindliche, trockene Kopfhaut" (manufacturer, moderate); formula: scalpComfortTarget targeted and prominent humectant/refatting routes GLYCERIN@6, PANTHENOL@21; cleansing low (no review). S-PRIMARY: of the passing targets (dry, sensitive) the product name names dry. Confidence = min(positioning high, scalpComfortTarget high, cleansingStrength moderate used for the strong-cleansing check) = moderate.'},
 'secondary':{'target':'sensitive','confidence':'moderate','rationale':'S-SENSITIVE passes with its own claim units ("Gegen Juckreiz", "Mildert effektiv Juckreiz, Hautbrennen und Rötungen", manufacturer, moderate) and formula (targeted + prominent comfort route PANTHENOL@21). S-SECONDARY: one secondary allowed, no dandruff claim (E2b not applicable), dry+sensitive is permitted. Confidence moderate (positioning moderate, cleansing moderate).'}}}
recon=['Blind-to-final: focusPrimary general -> scalp_active (name names dry scalp, F7 step 1; targeted).',
 'Blind-to-final: scalpComfortTarget not_targeted -> targeted (SC1 positioning revealed; CSA already passed in the blind pass).',
 'Blind-to-final: usageRole regular kept; neighbor treatment no longer possible (no dandruff claim) -> confidence high.',
 'Blind-to-final: focusSecondary [] kept (moisture route not independent).',
 'dandruffSupport supported unchanged; no dandruff claim -> regular shampoo, note active_without_dandruff_positioning (S-DANDRUFF, R17.3); sensitive and dry paths stay open.']
unc=['"Besänftigt die Kopfhaut" is not a lexicon term (lexicon: "beruhigt die Kopfhaut"); not needed because other units qualify.',
 '"Ultra-Sensitiv" in the name does not name the scalp (F7 post-round 2); primary chosen from "trockene Kopfhaut" in the name.',
 'Cleansing low (moderate confidence, four mild anionics ahead of the first amphoteric) drives the two I3 review flags.',
 'Weight high (convergence route in alphabetized tail); alternative moderate would make fine acceptable anyway via T6 and normal ideal.',
 'Scalp-target confidence: included cleansingStrength (used by the gate\'s strong-cleansing check); alternative reading high for dry.']
build('VT16','Vichy','Dercos Ultra-Sensitiv Shampoo trockene Kopfhaut','Market DE.',cd,{},scalp,False,None,[],['active_without_dandruff_positioning'],[],unc,recon,SELF)
