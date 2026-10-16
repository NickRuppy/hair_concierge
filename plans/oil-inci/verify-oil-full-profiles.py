#!/usr/bin/env python3
"""Verify the new oil full-profile boundary, sealed stages and source/fit/projection contracts."""
import argparse, copy, csv, hashlib, importlib.util, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SPEC=importlib.util.spec_from_file_location('integrator',ROOT/'plans/oil-inci/integrate-oil-full-profiles.py');M=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(M)
FLAGS=M.FLAGS;PROP={'value','estimate','confidence','evidence','counter_signal','nearest_alternative','reason','unresolved'}
class Failure(ValueError):pass
def require(ok,reason):
 if not ok:raise Failure(reason)
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def idx(d):return {x['case_id']:x for x in d['records']}
def hashes(base,mapping):
 for rel,expected in mapping.items():require(sha(base/rel)==expected,'hash drift: '+str(base/rel))
def attestation(base,name,lane,allowed,expected):
 notes=read(base/f'lane-{lane}'/name);require(notes['lane_id']==lane,'lane attestation identity')
 require(set(notes['files_read'])==set(allowed) and len(notes['files_read'])==len(allowed),'read allowlist')
 require(set(notes['input_hashes'])==set(allowed),'input hash attestation coverage');hashes(base,notes['input_hashes'])
 require(notes['completed_ids']==expected and notes['access_incidents']==[],'completion/access attestation')
def no_prior_formula_overlap(run):
 audit=read(run/'formula-overlap-audit-v0.2.json');prior=set()
 def normalize(name):return re.sub('[^A-Z0-9]','',re.sub(r'\bORGANIC\b','',re.sub(r'\([^)]*\)','',name.upper())))
 def arrays(node):
  if isinstance(node,dict):
   for key,value in node.items():
    if key in ['ingredients','primary_ingredients','ingredient_ledger'] and isinstance(value,list) and value and all(isinstance(i,dict) and all(k in i for k in ['rank','raw_name','canonical_name']) for i in value) and [i['rank'] for i in value]==list(range(1,len(value)+1)):
     prior.add(tuple(normalize(i['canonical_name']) for i in value))
    arrays(value)
  elif isinstance(node,list):
   for value in node:arrays(value)
 for source in audit['source_files']:
  p=ROOT/source['path'];require(sha(p)==source['sha256'],'novelty source hash');arrays(read(p))
 require(len(audit['source_files'])==audit['files_scanned'],'novelty source membership')
 for case in read(run/'blind-packet.json')['records']:
  require(tuple(normalize(i['canonical_name']) for i in case['ingredients']) not in prior,'prior formula overlap recomputation')
def property_check(p,allowed):
 require(set(p)==PROP,'property schema');require(p['value'] in allowed,'property enum');require(type(p['estimate']) is bool,'estimate type');require(p['confidence'] in ['low','moderate','high'],'confidence enum');require(isinstance(p['evidence'],list),'evidence type')
def records_check(records,expected,run):
 require([x['case_id'] for x in records]==expected,'case membership/order');require(len(set(expected))==len(expected),'duplicate case')
 for x in records:
  cid=x['case_id'];require(type(x['persistence_potential']) is str and x['persistence_potential'] in ['low','moderate','high'],'persistence scalar enum');require('build_up_potential' not in x,'legacy binary leakage')
  for k,values in [('base',['pure_plant_oil','plant_oil_blend','silicone_led','ester_alkane_led','hybrid','water_based','unknown']),('weight',['light','medium','rich','unknown']),('penetration_potential',['penetration_potential','surface_led','unknown']),('dispenser',['dropper','pump','spray','pour','metered_drop','other','unknown']),('provides_heat_protection',[True,False]),('provides_uv_protection',[True,False])]:property_check(x[k],values)
  for k in ['provides_heat_protection','provides_uv_protection']:require(type(x[k]['value']) is bool,'protection boolean')
  require(set(x['ingredient_flags'])==set(FLAGS),'flag key set')
  for k in FLAGS:property_check(x['ingredient_flags'][k],[True,False]);require(type(x['ingredient_flags'][k]['value']) is bool,'flag boolean')
  ingredients=x['formula']['ingredients'];ledger=x['ingredient_ledger'];require([i['rank'] for i in ledger]==list(range(1,len(ingredients)+1)),'rank coverage')
  # Historical exact declarations use reviewed aliases/case in older ledgers; never relabel them as new exact-input lanes.
  auth=x['field_authority']['ingredient_ledger'];new='full-profile' in auth['path']
  if new:require([{k:i[k] for k in ['rank','raw_name','canonical_name']} for i in ledger]==ingredients,'ordered raw/canonical preservation')
  else:require(len(ledger)==len(ingredients),'inherited ledger length')
  require(set(x['field_authority'])==set(M.FORM+M.SOURCE+['formula','persistence_potential']),'field authority coverage')
  require(all(sc.get('source_id') and sc.get('direction_id') for sc in x['application_scenarios']),'unbound source')
  carried_weight=False
  if run==M.COMP:
   wi=next(r['weight'] for r in read(run/'source-staging/inventory.json')['cases'] if r['case_id']==cid);carried_weight=wi['status']!='missing'
  for k,a in x['field_authority'].items():
   require(sha(ROOT/a['path'])==a['sha256'],'inherited/new authority hash');require(a['record_key'] is not None,'authority record key')
   if k=='formula':
    source=idx(read(ROOT/a['path']))[a['record_key']];ingredients=source.get('ingredients',idx(read(run/'blind-packet.json'))[cid]['ingredients'] if run==M.HOLD else None);require(x['formula']['raw_inci']==source['raw_inci'] and x['formula']['ingredients']==ingredients,'formula declaration authority parity')
   if a['path'].endswith(('blind-records.json','stage2-records.json','direct-records.json','main-working-records-v0.1.1.json','working-records-v0.1.1.json')) and not (k=='weight' and carried_weight):
    data=read(ROOT/a['path']);candidates=data['records'];matches=[r for r in candidates if r.get('case_id',r.get('neutral_id'))==a['record_key']]
    require(len(matches)==1 and k in matches[0],'authority record/field resolution');require(x[k]==matches[0][k],'selected field authority parity: '+cid+'/'+k)
  require(set(x['use_evidence'])==PROP and x['use_evidence']['value']==x['supported_uses'],'use evidence schema/role parity')
  if run==M.COMP:
   inventory=read(run/'source-staging/inventory.json');wi=next(r['weight'] for r in inventory['cases'] if r['case_id']==cid)
   if wi['status']!='missing':require(x['weight']['value']==wi['value'] and x['weight']['confidence']==wi['confidence'],'inherited weight ceiling/value')
   if wi['status']=='working':
    prior=read(ROOT/inventory['artifacts'][wi['artifact']]['path']);prior=next(r for r in prior['records'] if r.get('neutral_id',r.get('case_id'))==wi['record_key'])['weight']
    require(x['weight']['nearest_alternative']==prior['nearest_alternative'],'inherited weight alternative parity')
   elif wi['status']=='accepted':require(x['weight']['nearest_alternative']==wi['alternative'],'accepted weight alternative parity')
   for field,key in [('penetration_potential','D02-penetration')] if cid=='O04' else [('dispenser','D06-dispenser')] if cid=='O18' else []:
    a=x['field_authority'][field];require(a['record_key']==key,'source successor finding key');finding=next(r for r in read(ROOT/a['path'])['findings'] if r['id']==key)
    require(x[field]['value']==finding['proposed'] and x[field]['confidence']==finding['confidence'] and x[field]['estimate']==finding['estimate'],'source successor proposal parity')
   if cid=='O08':
    successor=read(run/'source-staging/O08-retained-source-successor.json');require(successor['exact_product_binding']['formula_comparison']['normalized_ordered_match'],'O08 ordered formula binding')
    comparison=successor['exact_product_binding']['formula_comparison'];translations={r['source_token']:r['frozen_token'] for r in comparison['display_translation_receipts']}
    normalized=[translations.get(t.strip(),t.strip()) for t in comparison['raw_source_inci'].split(',')]
    require(normalized==[i['raw_name'] for i in x['formula']['ingredients']],'O08 ordered identity receipt replay')
    require(hashlib.sha256(x['formula']['raw_inci'].encode()).hexdigest()==comparison['raw_frozen_sha256'],'O08 frozen declaration hash')
    require(len(x['application_scenarios'])==len(successor['directions'])==2,'O08 successor scenario completeness')
    require(x['formula']['current_retained_context_confirmation']['selected_scenario']==x['application_scenarios'][0] and x['formula']['selected_context']['scenario']==x['application_scenarios'][0],'O08 current retained binding')
    for sc,dr in zip(x['application_scenarios'],successor['directions']):
     require(all(sc[k]==dr[k] for k in ['source_id','direction_id','site','stage','dose','contact_time','removal','restrictions']),'O08 successor scenario parity')
     require(sc['supported_roles']==[{'clean_towel_dried':'leave_on_fibre_conditioning','clean_dry':'dry_finish'}[dr['stage']]],'O08 source stage role')
  require(sha(ROOT/x['persistence_trace_reference']['path'])==x['persistence_trace_reference']['sha256'],'trace reference hash')
  roles=set()
  for sc in x['application_scenarios']:
   require(all(k in sc for k in ['source_id','direction_id','supported_roles','site','stage','dose','contact_time','removal','restrictions']),'scenario fields');require(sc['source_id'] and sc['direction_id'],'unbound source')
   roles.update(sc['supported_roles']);require(set(sc['supported_roles'])<=set(['pre_wash_fibre_treatment','leave_on_fibre_conditioning','dry_finish','scalp_application']),'supported role enum')
  require(set(x['supported_uses'])==roles and len(x['supported_uses'])==len(roles),'supported uses/scenario union')
  require(x['supported_uses'],'admitted retained fibre case has no uses')
  require('leave_on_fibre_conditioning' in roles or 'dry_finish' in roles,'retained fibre admission')
  for n in x['named_oils']:
   property_check(n['prominence'],['leading','supporting','trace','absent','unknown']);require(all(1<=i<=len(ledger) for i in n['matched_ranks']),'hero rank');require(n['prominence']['value']!='absent' or not n['matched_ranks'],'absent hero with matches')
  for axis in x['fit'].values():require(all(c['value']=='unknown' and c['reason']=='scenario_specific_fit' for c in axis.values()),'global fit aggregation')
def stage_check(run,blinddir,expected):
 source=idx(read(run/'stage2-packet.json'));dictionary={x['canonical_name']:x for x in read(blinddir/('dictionary.json' if blinddir==run and run.name.startswith('full-profile-v0.2') else 'function-dictionary.json'))['entries']};stats={}
 for l in ['a','b']:
  blind=idx(read(blinddir/f'lane-{l}/blind-records.json'));stage=idx(read(run/f'lane-{l}/stage2-records.json'));require(list(blind)==expected and list(stage)==expected,'stage case preservation')
  for cid in expected:
   require(set(stage[cid])=={'case_id',*M.SOURCE},'Stage2 must not rewrite formula fields');s=source[cid];scids={x['id'] for x in s['sources']};out=stage[cid];require(out['dispenser']['value']==s['packaging']['value'],'device source gate');require(out['provides_heat_protection']['value']==s['claims']['heat']['accepted'],'heat source gate');require(all(i['canonical_name'] in dictionary for i in blind[cid]['ingredient_ledger']),'dictionary identity coverage');filters=[i for i in blind[cid]['ingredient_ledger'] if dictionary[i['canonical_name']]['uv_filter']];require(out['provides_uv_protection']['value']==bool(filters and s['claims']['uv']['accepted']),'UV claim/filter AND gate')
   for flag in FLAGS:
    matches=[{'rank':i['rank'],'canonical_name':i['canonical_name']} for i in blind[cid]['ingredient_ledger'] if dictionary[i['canonical_name']]['flags'][flag]['value']];p=blind[cid]['ingredient_flags'][flag];require(p['value']==bool(matches) and p['evidence']==matches,'closed flag/match completeness')
   original={x['direction_id']:x for x in s['directions']};require({x['direction_id'] for x in out['application_scenarios']}==set(original),'source scenario coverage')
   for sc in out['application_scenarios']:
    require(sc['source_id'] in scids,'unbound source');dr=original[sc['direction_id']]
    for k in ['site','stage','dose','contact_time','removal','restrictions']:require(sc[k]==dr[k],'scenario source drift: '+cid+'/'+k)
  stats[l]={'cases':len(blind),'ranks':sum(len(x['ingredient_ledger']) for x in blind.values())}
 return stats
def validate(run,kind,profiles_override=None,fit_override=None,projection_override=None):
 profiles=read(run/'profiles.json')['records'] if profiles_override is None else profiles_override
 if kind=='completion':
  expected=[x['case_id'] for x in read(run/'source-staging/inventory.json')['cases']];blinddir=run/'derivation-v0.2';subset=read(blinddir/'input-manifest.json')['case_ids'];hashes(run,read(run/'input-manifest.json')['inputs']);hashes(run,read(run/'blind-seal.json')['outputs']);hashes(blinddir,read(blinddir/'input-manifest.json')['inputs']);hashes(blinddir,read(blinddir/'correction-seal.json')['outputs']);hashes(blinddir,read(blinddir/'blind-seal.json')['outputs'])
  for l in ['a','b']:
   reconstructed=read(run/f'lane-{l}/blind-records.json');patch=idx(read(blinddir/f'lane-{l}/correction-records.json'))
   for x in reconstructed['records']:x.update(patch[x['case_id']]['changed_fields'])
   require(reconstructed==read(blinddir/f'lane-{l}/blind-records.json'),'corrected deterministic reconstruction')
 else:
  expected=read(run/'input-manifest.json')['case_ids'];blinddir=run;subset=expected;hashes(run,read(run/'input-manifest.json')['inputs']);hashes(run,read(run/'input-manifest.json')['sources']);hashes(run,read(run/'blind-seal.json')['outputs']);require(read(run/'formula-overlap-audit-v0.2.json')['passed'],'prior formula overlap')
  for l in ['a','b']:
   trace=idx(read(run/f'lane-{l}/persistence-research-trace.json'));require(list(trace)==expected,'trace case coverage')
   for x in read(run/f'lane-{l}/blind-records.json')['records']:require(trace[x['case_id']]['considered_ranks']==list(range(1,len(x['ingredient_ledger'])+1)),'persistence trace rank coverage')
  no_prior_formula_overlap(run)
 for lane in ['a','b']:
  dictionary='function-dictionary.json' if kind=='completion' else 'dictionary.json';allowed=['method.md','blind-packet.json',dictionary,'material-weight-reference.json']
  if kind=='completion':
   attestation(run,'blind-notes.json',lane,allowed,subset)
   attestation(blinddir,'correction-notes.json',lane,allowed+[f'../lane-{lane}/blind-records.json',f'../lane-{lane}/blind-notes.json'],subset)
  else:attestation(run,'blind-notes.json',lane,allowed,expected)
  prefix='derivation-v0.2/' if kind=='completion' else ''
  attestation(run,'stage2-notes.json',lane,['stage2-packet.json',f'{prefix}lane-{lane}/blind-records.json',prefix+'method.md',prefix+dictionary],subset)
 require(M.MATRIX=={'light':['suitable','suitable','conditional'],'medium':['conditional','suitable','suitable'],'rich':['conditional','conditional','suitable'],'unknown':['unknown','unknown','unknown']},'approved thickness policy table')
 records_check(profiles,expected,run);stage_stats=stage_check(run,blinddir,subset)
 hashes(run,read(run/'stage2-seal.json')['outputs']);require(sha(run/'stage2-packet.json')==read(run/'stage2-manifest.json')['stage2-packet.json'],'controlled source packet hash')
 fit=read(run/'scenario-fit.json') if fit_override is None else fit_override;require(fit==M.fit(profiles),'scenario fit matrix/context/authority')
 projection=read(run/'projection.json') if projection_override is None else projection_override;require(projection==[{'product_key':x['product_key'],'policy_version':'oil-persistence-leave-on-v0.1','persistence_potential':x['persistence_potential']} for x in profiles],'projection parity')
 csvrows=list(csv.DictReader((run/'results.csv').open()));require([x['case_id'] for x in csvrows]==expected,'CSV cohort parity');require(all(row['persistence_potential']==x['persistence_potential'] for row,x in zip(csvrows,profiles)),'CSV scalar parity')
 if kind=='completion':
  previous=read(EX/'persistence-replay-v0.1/projection.json');require(projection==previous,'prior27 persistence changed')
 return {'case_count':len(profiles),'scenario_role_count':len(fit['records']),'lane_stage_counts':stage_stats}
EX=M.EX
def main():
 p=argparse.ArgumentParser();p.add_argument('--run',choices=['completion','holdout'],required=True);args=p.parse_args();run=M.COMP if args.run=='completion' else M.HOLD;summary=validate(run,args.run);base=read(run/'profiles.json')['records'];checks=[]
 for label,mutation,reason in [
  ('drop case',lambda x:x.pop(),'case membership/order'),
  ('persistence unknown',lambda x:x[0].update(persistence_potential='unknown'),'persistence scalar enum'),
  ('persistence confidence wrapper',lambda x:x[0].update(persistence_potential={'value':'moderate','confidence':'low'}),'persistence scalar enum'),
  ('unbound source',lambda x:x[0]['application_scenarios'][0].update(source_id=''),'unbound source'),
  ('changed ordered blind ingredient',lambda x:x[-1]['ingredient_ledger'][0].update(raw_name='MUTATED'),'ordered raw/canonical preservation'),
  ('changed selected base property',lambda x:x[-1]['base'].update(value='water_based'),'selected field authority parity'),
  ('changed inherited or first base property',lambda x:x[0]['base'].update(value='water_based'),'selected field authority parity')]:
  damaged=copy.deepcopy(base);mutation(damaged)
  try:validate(run,args.run,profiles_override=damaged)
  except Failure as err:require(reason in str(err),'wrong corruption failure: '+label+' '+str(err));checks.append({'mutation':label,'rejected_for':str(err)})
  else:raise Failure('corruption accepted: '+label)
 if args.run=='completion':
  for label,mutate,reason in [
   ('changed O12 inherited alternative',lambda x:next(r for r in x if r['case_id']=='O12')['weight'].update(nearest_alternative='light'),'inherited weight alternative parity'),
   ('unresolved successor finding key',lambda x:next(r for r in x if r['case_id']=='O04')['field_authority']['penetration_potential'].update(record_key='missing'),'source successor finding key')]:
   damaged=copy.deepcopy(base);mutate(damaged)
   try:validate(run,args.run,profiles_override=damaged)
   except Failure as err:require(reason in str(err),'wrong corruption failure: '+label);checks.append({'mutation':label,'rejected_for':str(err)})
   else:raise Failure('corruption accepted: '+label)
 snapshot={str(p.relative_to(run)):sha(p) for p in sorted(run.rglob('*')) if p.is_file() and p.name!='verification-receipt.json'}
 receipt={'status':'passed','scope':args.run,'summary':summary,'meaningful_boundary_corruptions':checks,'artifact_hashes':snapshot,'limits':'Structural/process/source/fit consistency, not sensory accuracy. Acceptance/coverage outcomes are separately reported in metrics.json. No runtime or production action.'};M.save(run/'verification-receipt.json',receipt);print(json.dumps({'status':'passed',**summary,'corruptions_rejected':len(checks)}))
if __name__=='__main__':main()
