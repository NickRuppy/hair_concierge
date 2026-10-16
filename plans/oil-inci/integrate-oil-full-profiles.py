#!/usr/bin/env python3
"""Create local oil research successors from sealed, attributed decisions; no production payload."""
import argparse, copy, csv, hashlib, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
EX=ROOT/'data/research/oil-inci/v1.0/corpus/exploratory'
COMP=EX/'full-profile-completion-v0.1'
HOLD=ROOT/'data/research/oil-inci/v1.0/corpus/holdout/full-profile-v0.2'
FLAGS=['silicones','mineral_oil','drying_alcohol','fragrance','scalp_active_botanicals']
FORM=['ingredient_ledger','auxiliary_suffix','base','weight','penetration_potential','ingredient_flags']
SOURCE=['named_oils','dispenser','provides_heat_protection','provides_uv_protection','supported_uses','use_evidence','application_scenarios']
def read(p):return json.loads(p.read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def authority(p,key,reason='Attributed research decision'):
 return {'path':str(p.relative_to(ROOT)),'sha256':digest(p),'record_key':key,'reason':reason}
def prop(value,reason,evidence=None,estimate=False,confidence='high',alternative=None,unresolved=''):
 return {'value':value,'estimate':estimate,'confidence':confidence,'evidence':evidence or [],'counter_signal':'Estimate is not measured efficacy or amount.' if estimate else 'Source/declaration scope only.','nearest_alternative':alternative,'reason':reason,'unresolved':unresolved}
def index(d,key='case_id'):return {x[key]:x for x in d['records']}
def metrics(a,b):
 out={}
 for k in ['base','weight','penetration_potential','persistence_potential']+FLAGS:
  def value(x):return x['ingredient_flags'][k]['value'] if k in FLAGS else x[k] if k=='persistence_potential' else x[k]['value']
  if k not in FLAGS and any(k not in x for x in a.values()):continue
  pairs=[(value(a[c]),value(b[c])) for c in a];known=[p for p in pairs if 'unknown' not in p];entry={'matches':sum(x==y for x,y in pairs),'denominator':len(pairs),'both_known':len(known),'known_matches':sum(x==y for x,y in known),'lane_a_counts':{str(v):sum(x==v for x,y in pairs) for v in dict.fromkeys(x for x,y in pairs)},'lane_b_counts':{str(v):sum(y==v for x,y in pairs) for v in dict.fromkeys(y for x,y in pairs)}}
  if k in FLAGS:
   entry['positive_conditioned']={'matches':sum(x==y for x,y in pairs if x or y),'denominator':sum(x or y for x,y in pairs)};entry['negative_conditioned']={'matches':sum(x==y for x,y in pairs if not x or not y),'denominator':sum(not x or not y for x,y in pairs)}
  out[k]=entry
 return out
MATRIX={'light':['suitable','suitable','conditional'],'medium':['conditional','suitable','suitable'],'rich':['conditional','conditional','suitable'],'unknown':['unknown']*3}
def fit(records):
 out=[]
 for x in records:
  w=x['weight']['value'];alt=x['weight'].get('nearest_alternative');alt=alt if alt in MATRIX else None
  for sc in x['application_scenarios']:
   for role in sc['supported_roles']:
    scalp=role=='scalp_application';pre=role=='pre_wash_fibre_treatment';vals=['unknown']*3 if scalp else ['suitable']*3 if pre else MATRIX[w]
    cells={}
    for t,v in zip(['fine','normal','coarse'],vals):
     reason='scalp_role_not_fibre_fit' if scalp else 'no_weight_only_exclusion_in_shampooed_prewash' if pre else 'missing_usable_weight' if w=='unknown' else 'lighter_finish_may_be_less_substantial' if v=='conditional' and w=='light' else 'greater_load_or_flattening_concern' if v=='conditional' else 'thickness_weight_preference'
     condition='An option when a lighter finish is desired; no invented dose increase.' if v=='conditional' and w=='light' else 'Controlled application within the exact published directions and site; no invented numeric dose.' if v=='conditional' else None
     cells[t]={'value':v,'reason':reason,'condition':condition}
    out.append({'case_id':x['case_id'],'direction_id':sc['direction_id'],'source_id':sc['source_id'],'supported_role':role,'scenario':copy.deepcopy(sc),'weight':w,'weight_authority':x['field_authority']['weight'],'weight_confidence':x['weight']['confidence'],'estimate':True,'thickness':cells,'texture':{t:{'value':'unknown' if scalp else 'suitable','reason':'scalp_role_not_fibre_fit' if scalp else 'no_additional_pattern_gate'} for t in ['straight','wavy','curly','coily']},'damage':{t:{'value':'unknown' if scalp else 'suitable','reason':'scalp_role_not_fibre_fit' if scalp else 'no_additional_damage_gate'} for t in ['healthy','moderately_damaged','highly_damaged']},'alternative_weight':alt,'alternative_thickness':None if alt is None else dict(zip(['fine','normal','coarse'],['unknown']*3 if scalp else ['suitable']*3 if pre else MATRIX[alt]))})
 return {'policy_versions':['OE42-thickness-v0.1','OE43-pattern-v0.1','OE45-damage-v0.1'],'scope':'Role/scenario-specific research only. No product-wide eligibility or persistence penalty. Pre-wash is another supported-use fact, not persistence reference.','records':out}
def write_outputs(run,records,notes,measurement):
 save(run/'profiles.json',{'run_id':run.name,'scope':'Local research consolidation; no catalog/runtime/production activation. Legacy build-up omitted deliberately; original files preserved.','records':records})
 save(run/'scenario-fit.json',fit(records));save(run/'integration-notes.json',notes);save(run/'metrics.json',measurement)
 save(run/'projection.json',[{'product_key':x['product_key'],'policy_version':'oil-persistence-leave-on-v0.1','persistence_potential':x['persistence_potential']} for x in records])
 headers=['case_id','brand','product','base','weight','penetration_potential','persistence_potential','dispenser','heat','uv','supported_uses','unknown_fields']
 with (run/'results.csv').open('w') as f:
  writer=csv.DictWriter(f,fieldnames=headers);writer.writeheader()
  for x in records:
   unknown=[k for k in ['base','weight','penetration_potential','dispenser'] if x[k]['value']=='unknown']+['hero:'+n['hero_id'] for n in x['named_oils'] if n['prominence']['value']=='unknown'];writer.writerow(dict(case_id=x['case_id'],brand=x['identity']['brand'],product=x['identity']['product'],base=x['base']['value'],weight=x['weight']['value'],penetration_potential=x['penetration_potential']['value'],persistence_potential=x['persistence_potential'],dispenser=x['dispenser']['value'],heat=x['provides_heat_protection']['value'],uv=x['provides_uv_protection']['value'],supported_uses='|'.join(x['supported_uses']),unknown_fields='|'.join(unknown)))
 lines=['# Oil profiles — local research results','','| Case | Product | Weight | Persistence | Heat | UV |','|---|---|---|---|---|---|']
 for x in records:lines.append(f"| {x['case_id']} | {x['identity']['brand']} {x['identity']['product']} | {x['weight']['value']} | {x['persistence_potential']} | {str(x['provides_heat_protection']['value']).lower()} | {str(x['provides_uv_protection']['value']).lower()} |")
 lines+=['','See profiles.json for all property objects and exact field authorities; scenario-fit.json for separate use-specific thickness/pattern/damage. Non-persistence unknowns retain the approved evidence conventions. Agreement is repeatability, not accuracy.','',notes['summary'],''];(run/'results-for-review.md').write_text('\n'.join(lines))
def completion():
 run=COMP;inv=read(run/'source-staging/inventory.json');sources=index(read(EX/'persistence-replay-v0.1/source-packet.json'));persist={x['product_key']:x['persistence_potential'] for x in read(EX/'persistence-replay-v0.1/projection.json')};c=run/'derivation-v0.2';lanes={l:index(read(c/f'lane-{l}/blind-records.json')) for l in ['a','b']};stages={l:index(read(run/f'lane-{l}/stage2-records.json')) for l in ['a','b']};records=[];decisions=[]
 for info in inv['cases']:
  cid=info['case_id'];src=sources[cid];auth={};x={'case_id':cid,'product_key':src['product_key'],'identity':src['identity'],'formula':{'raw_inci':src['raw_inci'],'ingredients':src['ingredients'],'application_context':src['application_context'],'selected_context':src['selected_context']}}
  auth['formula']=authority(EX/'persistence-replay-v0.1/source-packet.json',cid)
  if info['direct']['status']=='available':
   p=ROOT/inv['artifacts'][info['direct']['artifact']]['path'];key=info['direct']['record_key'];old=index(read(p),'neutral_id')[key]
   for k in FORM+SOURCE:
    if k in old:x[k]=copy.deepcopy(old[k]);auth[k]=authority(p,key,'Inherited exact direct research record; historical evidence representation retained.')
  else:
   lane='b' if cid=='O27' else 'a';blind=lanes[lane][cid];stage=stages[lane][cid]
   for k in FORM:x[k]=copy.deepcopy(blind[k]);auth[k]=authority(c/f'lane-{lane}/blind-records.json',cid,'Selected corrected-dictionary development derivation; predecessor retained.')
   for k in SOURCE:x[k]=copy.deepcopy(stage[k]);auth[k]=authority(run/f'lane-{lane}/stage2-records.json',cid,'Controlled source reveal after corrected blind seal.')
  wi=info['weight']
  if wi['status']!='missing':
   if 'artifact' in wi:wp=ROOT/inv['artifacts'][wi['artifact']]['path'];wa=authority(wp,wi['record_key'],'Existing working weight retains authority, not upgraded to human acceptance.')
   else:wp=ROOT/wi['ref'].split('#')[0];wa=authority(wp,wi['ref'].split('#')[-1] if '#' in wi['ref'] else wi.get('decision'),f"Human accepted {wi.get('decision')}; prior lane diagnostics do not override.")
   prior_weight=index(read(wp),'neutral_id')[wi['record_key']]['weight'] if 'artifact' in wi else {}
   x['weight']=prop(wi['value'],'Carried exact accepted/working weight from attributed authority; original confidence ceiling retained.',[{'source_ref':wa['path'],'record_key':wa['record_key']}],True,wi['confidence'],wi.get('alternative',prior_weight.get('nearest_alternative')),'Quantities/grades/sensory performance unverified.');auth['weight']=wa
  x['persistence_potential']=persist[x['product_key']];auth['persistence_potential']=authority(EX/'persistence-replay-v0.1/projection.json',x['product_key'],'Unchanged current leave-on scalar; no legacy-label conversion.');x['persistence_trace_reference']=authority(EX/'persistence-replay-v0.1/lane-b/records.json',cid)
  if cid=='O04':
   p=ROOT/'plans/oil-inci/research/profile-completion-evidence-v0.1/evidence.json';x['penetration_potential']=prop('penetration_potential','Product-bound maker identity bridge identifies this sole Fruit Oil declaration as whole cold-pressed unrefined coconut oil. Admitted whole-coconut fibre evidence supports a rough potential estimate; no universal Fruit Oil alias, repair or ordinary-dose efficacy.',[{'rank':1,'canonical_name':src['ingredients'][0]['canonical_name']},{'source_ref':str(p.relative_to(ROOT))}],True,'low','unknown','No exact retail batch or ordinary-dose penetration measurement.');auth['penetration_potential']=authority(p,'D02-penetration','Separately logged source-informed successor, not a rewrite of the sealed old formula record.')
  if cid=='O18':
   p=ROOT/'plans/oil-inci/research/profile-completion-evidence-v0.1/evidence.json';x['dispenser']=prop('pour','Exact FR250ml supplied open neck continuously pours; current maker image inspected.',[{'source_ref':str(p.relative_to(ROOT))}]);auth['dispenser']=authority(p,'D06-dispenser','New exact-package observation; old unknown preserved in historical direct record.')
  if cid=='O08':
   p=run/'source-staging/O08-retained-source-successor.json';successor=read(p);scenarios=[];uses=[]
   for direction in successor['directions']:
    if direction['site']!=['ends'] or direction['removal']!='leave_on':raise ValueError('O08 successor is not a retained ends scenario')
    role={'clean_towel_dried':'leave_on_fibre_conditioning','clean_dry':'dry_finish'}[direction['stage']]
    sc={k:copy.deepcopy(direction[k]) for k in ['direction_id','source_id','site','stage','dose','contact_time','removal','restrictions']};sc['supported_roles']=[role];scenarios.append(sc);uses.append(role)
   x.update(supported_uses=uses,use_evidence=prop(uses,'Two coherent exact-DE retailer leave-on ends alternatives; historical dm context remains incomplete.',[{'source_id':sc['source_id'],'direction_id':sc['direction_id']} for sc in scenarios]),application_scenarios=scenarios)
   for k in ['supported_uses','use_evidence','application_scenarios']:auth[k]=authority(p,'O08','Source-informed successor closes earlier dm-only admission defect; historical directions and persistence judgment unchanged.')
   x['formula']['historical_selected_context']=x['formula']['selected_context']
   x['formula']['selected_context']={'mode':'retained_fibre','source_context_packet':str(p.relative_to(ROOT)),'source_context_key':'O08','scenario_index':0,'scenario':copy.deepcopy(scenarios[0]),'reason':'Current exact-DE explicit retained ends successor; historical dm-only binding is preserved separately.'}
   auth['formula']['reason']='Original frozen ingredient declaration; current retained-context successor has its own nested authority.'
   x['formula']['current_retained_context_confirmation']={'authority':authority(p,'O08'),'selected_scenario':scenarios[0],'prior_admission_defect':'Historical dm-only direction did not establish retention. Independently bound successor supplies that evidence; it does not retroactively validate the old admission.'}
  x['field_authority']=auth;x['fit']={axis:{v:{'value':'unknown','reason':'scenario_specific_fit'} for v in vals} for axis,vals in [('thickness',['fine','normal','coarse']),('texture',['straight','wavy','curly','coily']),('damage',['healthy','moderately_damaged','highly_damaged'])]};x['completion_status']='complete_research_with_permitted_gaps';records.append(x)
  decisions.append({'case_id':cid,'direct_authority':'inherited' if info['direct']['status']=='available' else 'corrected_lane_b' if cid=='O27' else 'corrected_lane_a','weight_authority_status':wi['status'] if wi['status']!='missing' else 'new_working','reason':'Existing decisions retained; new formula fields selected as a coherent lane record. O27 laneB treats the early safflower/coconut sequence as participating in the principal botanical conditioning backbone; low-confidence penetration potential, no measured fraction. O21 laneA light honors mobile carrier architecture without inventing a solid jojoba-ester grade.' if cid in ['O21','O27'] else 'No product positioning changes sealed formula truth.'})
 measurement={'scope':'17 missing-property development formulas; original dictionary defect and corrected replay both retained. Not unseen calibration.','formula_fields':metrics(lanes['a'],lanes['b']),'source_fields':source_metrics(stages['a'],stages['b'])}
 notes={'summary':'27 profiles consolidated:10 attributed direct records plus17 completed supplements;19 previous weights retained and8 newly judged. All27 prior persistence scalars unchanged. Product-bound coconut identity/penetration, exact-package pour and independently bound O08 retention successors close three evidence gaps. Permitted non-persistence unknowns remain explicit.','decisions':decisions,'disagreements_preserved':['O21 new weight light/medium: choose laneA light, with medium alternative.','O27 penetration unknown/positive: choose coherent laneB estimate, low confidence.','Source-only differences remain in metrics and root review, not erased.'],'history':'Original inputs, rejected dictionary staging, first-pass records and both corrected lanes are immutable.','no_production_writes':True}
 write_outputs(run,records,notes,measurement)
def source_metrics(a,b):
 out={}
 for k in ['dispenser','provides_heat_protection','provides_uv_protection','supported_uses']:
  pairs=[(a[c][k]['value'],b[c][k]['value']) if k!='supported_uses' else (sorted(a[c][k]),sorted(b[c][k])) for c in a];out[k]={'matches':sum(x==y for x,y in pairs),'denominator':len(pairs),'disagreements':[c for c,(x,y) in zip(a,pairs) if x!=y]}
 for k in ['provides_heat_protection','provides_uv_protection']:
  pairs=[(a[c][k]['value'],b[c][k]['value']) for c in a]
  out[k]['positive_conditioned']={'matches':sum(x==y for x,y in pairs if x or y),'denominator':sum(x or y for x,y in pairs)}
  out[k]['negative_conditioned']={'matches':sum(x==y for x,y in pairs if not x or not y),'denominator':sum(not x or not y for x,y in pairs)}
 pairs=[];differences=[]
 for cid in a:
  aa={n['hero_id']:n for n in a[cid]['named_oils']};bb={n['hero_id']:n for n in b[cid]['named_oils']}
  for hero in sorted(set(aa)|set(bb)):
   x=aa.get(hero,{}).get('prominence',{}).get('value');y=bb.get(hero,{}).get('prominence',{}).get('value');pairs.append((x,y))
   if x!=y:differences.append({'case_id':cid,'hero_id':hero,'lane_a':x,'lane_b':y})
 out['named_oil_prominence']={'matches':sum(x==y for x,y in pairs),'denominator':len(pairs),'both_known':sum(x not in [None,'unknown'] and y not in [None,'unknown'] for x,y in pairs),'disagreements':differences}
 return out
def holdout():
 run=HOLD;sources=index(read(run/'source-packet.json'));lanes={l:index(read(run/f'lane-{l}/blind-records.json')) for l in ['a','b']};stages={l:index(read(run/f'lane-{l}/stage2-records.json')) for l in ['a','b']};packet=index(read(run/'blind-packet.json'));records=[]
 # Selection is recorded explicitly after root review; do not alter first-pass metrics.
 selected=read(run/'root-selection-v0.2.json')
 for cid,src in sources.items():
  lane=selected['cases'][cid]['lane'];x=copy.deepcopy(lanes[lane][cid]);x.update(copy.deepcopy(stages[lane][cid]));x['product_key']='oil-holdout-'+cid.lower();x['identity']=src['identity'];x['formula']={'raw_inci':src['raw_inci'],'ingredients':packet[cid]['ingredients'],'application_context':packet[cid]['application_context']};x['field_authority']={k:authority(run/f'lane-{lane}/blind-records.json',cid,selected['cases'][cid]['reason']) for k in FORM+['persistence_potential']};x['field_authority'].update({k:authority(run/f'lane-{lane}/stage2-records.json',cid,'Controlled source stage after sealed neutral assessment') for k in SOURCE});x['field_authority']['formula']=authority(run/'source-packet.json',cid);x['persistence_trace_reference']=authority(run/f'lane-{lane}/persistence-research-trace.json',cid);x['fit']={axis:{v:{'value':'unknown','reason':'scenario_specific_fit'} for v in vals} for axis,vals in [('thickness',['fine','normal','coarse']),('texture',['straight','wavy','curly','coily']),('damage',['healthy','moderately_damaged','highly_damaged'])]};x['completion_status']='complete_research_with_permitted_gaps';records.append(x)
 fm=metrics(lanes['a'],lanes['b']);sm=source_metrics(stages['a'],stages['b']);threshold=read(run/'input-manifest.json')['acceptance']['formula_fields_min_exact_matches'];passed=all(x['matches']>=threshold for x in fm.values());counts={v:sum(x['persistence_potential']==v for x in records) for v in ['low','moderate','high']}
 measurement={'scope':'Six project-new declarations, two fresh isolated neutral lanes. Repeatability, not measured sensory accuracy.','formula_fields':fm,'source_fields':sm,'internal_formula_agreement_threshold_passed':passed,'selected_persistence_counts':counts,'three_band_coverage':all(counts.values()),'coverage_limits':['No source-complete aqueous/biphasic architecture in selected cohort.','No known pure-plant/blend base, rich weight or positive penetration result in this six-case set.','No positive mineral_oil, scalp_active_botanicals or UV-protection decision in this six-case set; all-negative agreement does not test the positive branches.','n=6 and agreement thresholds do not certify adapter/readiness/general accuracy.','Earlier v0.1 attempt aborted before outputs due brand cue in dictionary comment; this v0.2 uses neutral reference IDs and new workers. Raw botanical common names remain unchanged.']}
 notes={'summary':'Six new formula profiles completed with immutable independent judgments and controlled source stage; disagreement is retained and root selection attributed. See metrics.json for acceptance outcomes and missing class/archetype coverage. No activation is implied.','decisions':selected,'no_production_writes':True};write_outputs(run,records,notes,measurement)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--run',choices=['completion','holdout'],required=True);args=p.parse_args();completion() if args.run=='completion' else holdout()
