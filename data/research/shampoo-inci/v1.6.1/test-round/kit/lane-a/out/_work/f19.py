import sys; sys.path.insert(0,'/Users/nick/AI_work/hair_conscierge/.worktrees/shampoo-v161/plans/shampoo-v161/test/kit/lane-a/out/_work')
from final_common import *
cd={}
cd['focusPrimary']={'value':'repair','confidence':'moderate','neighboringAlternative':'moisture',
 'careDirection':{'verdict':'repair_supported','moistureRoutes':['ARGANIA SPINOSA (ARGAN) KERNEL OIL@9','PERSEA GRATISSIMA (AVOCADO) OIL@10','PANTHENOL@32','GLYCERIN@34','SODIUM PCA@36'],
   'repairRoutes':['HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL@15','SILK AMINO ACIDS@17','HYDROLYZED KERATIN@18','KERATIN AMINO ACIDS@19','AMODIMETHICONE@29','QUATERNIUM-80@27'],
   'sharedConditioningRoutes':['DIMETHICONE@8','POLYQUATERNIUM-7@25','POLYQUATERNIUM-10@26','GLYCOL DISTEARATE@7'],
   'limitation':'Humectants follow FRAGRANCE@16 (likely trace); protein/keratin cluster is coherent but rinse-off.'},
 'claimRole':'candidate',
 'counterSignal':'"Moisture" is also in the product name; the moisture side rests on prominent oils plus late humectants.',
 'decisionTrace':'Claim direction: repair (product name "Moisture Repair Shampoo", high; manufacturer_de: "Reparieren Sie das durch Farbe, chemische Behandlungen oder Hitze-Styling geschädigte Haar", "Keratin, ... Proteine", moderate). Formula compatible: repair_supported (protein/keratin cluster @15-19 + amino-silicone@29 + quats). Decision: repair; the damage claim dominates the manufacturer text.',
 'rationale':'repair: damage-repair positioning (name + manufacturer) over a repair_supported formula (F1). Confidence moderate because "Moisture" is equally in the name; neighbor moisture.','ruleIds':['7.2','7.3','F1','E1','N-ALT']}
cd['focusSecondary']={'value':['moisture'],'confidence':'moderate','neighboringAlternative':[],
 'decisionTrace':'Empty default considered. Selected ["moisture"]: distinct positioning "Moisture" in the exact product name (high; DE name "Feuchtigkeitsspendendes Reparatur-Shampoo", manufacturer "genährtes, geschmeidiges ... Ergebnis"); independent route ARGAN OIL@9, AVOCADO OIL@10 with PANTHENOL@32, GLYCERIN@34, SODIUM PCA@36 - none cited in the repair route (F3); moisture is not a synonym of repair. One value, no exception code.',
 'rationale':'["moisture"]: name-level moisture positioning with an independent oil/humectant route (Section 8, F3). Confidence moderate (humectants are late); neighbor [].','ruleIds':['8','F2','F3','E1','N-ALT']}
cd['usageRole']={'value':'regular','confidence':'high','neighboringAlternative':'none','triggerCode':'none','triggerEvidence':[],'losingTriggers':[],
 'rationale':'regular: no frequency wording ("Bei Bedarf wiederholen" is not frequency), no D1, not strong, no active.','ruleIds':['9','U2']}
cd['scalpComfortTarget']={'value':'not_targeted','confidence':'high','neighboringAlternative':'none',
 'rationale':'not_targeted: no E2 sensitive/dry-scalp claim unit.','ruleIds':['10','SC1'],'counterSignal':'none'}
scalp={'targets':['ordinary'],'scalpTargets':{'primary':{'target':'ordinary','confidence':'high','rationale':'S-ORDINARY way 1: no qualifying E2 claim unit; manufacturer source present -> high.'},'secondary':None}}
recon=['Blind-to-final: focusPrimary general -> repair (claim candidate on a repair_supported formula).',
 'Blind-to-final: focusSecondary [] -> ["moisture"] (name-level moisture positioning with an independent oil/humectant route).',
 'Blind-to-final: usageRole regular kept (low -> high); scalpComfortTarget not_targeted kept (low -> high).',
 'Foreign (English EU) manufacturer page graded low; used only as corroboration (E1). "Sulfate-free" corroborates the C6 chassis.']
unc=['Primary repair vs moisture: both words are in the name; repair chosen because the manufacturer text leads with damage repair and the formula verdict is repair_supported.',
 'Secondary moisture: humectants are post-fragrance; alternative [] if the oils are read as shared conditioning.',
 'Cleansing low (moderate) - no projection effect because the ordinary bucket already differs (gentle vs regular).']
build('VT19','Moroccanoil','Moisture Repair Shampoo','Market DE (DE name "Feuchtigkeitsspendendes Reparatur-Shampoo").',cd,{},scalp,False,None,[],[],[],unc,recon,SELF)
