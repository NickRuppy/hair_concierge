#!/usr/bin/env python3
"""Verify the neutral single-case successor and its four-case current view."""
import copy,csv,importlib.util,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('first_pass',ROOT/'plans/oil-inci/verify-oil-targeted-coverage.py');F=importlib.util.module_from_spec(s);s.loader.exec_module(F)
V=F.V;M=F.M;RUN=F.RUN;C=RUN/'correction-v0.2';VIEW=RUN/'current-view-v0.2';EXPECTED=['T01','T02','T04','T06']
def validate(records=None):
 first=F.validate();manifest=V.read(C/'input-manifest.json');V.hashes(C,manifest['inputs'])
 for name in ['blind-seal.json','stage2-seal.json']:V.hashes(C,V.read(C/name)['outputs'])
 V.require(V.sha(C/'stage2-packet.json')==V.read(C/'stage2-manifest.json')['stage2-packet.json'],'corrected source packet hash')
 parent=V.idx(V.read(RUN/'blind-packet.json'));correct=V.idx(V.read(C/'blind-packet.json'));V.require(list(correct)==['T02'] and correct['T02']==parent['T02'],'corrected ordered declaration/context parity')
 old={e['canonical_name']:e for e in V.read(RUN/'function-dictionary.json')['entries']};new={e['canonical_name']:e for e in V.read(C/'function-dictionary.json')['entries']}
 V.require(set(new)=={i['canonical_name'] for i in correct['T02']['ingredients']},'corrected dictionary exact membership')
 for name,entry in new.items():
  expected=copy.deepcopy(old[name])
  if name=='ARGANIA KERNEL OIL':expected['notes']=expected['notes'].replace('Secondary contribution remains unresolved;','Identity and function remain unresolved;')
  V.require(entry==expected,'only declared neutrality-note correction allowed')
 V.require(V.read(C/'stage2-packet.json')['records']==[V.idx(V.read(RUN/'stage2-packet.json'))['T02']],'corrected source facts unchanged')
 for lane in ['a','b']:
  V.attestation(C,'blind-notes.json',lane,F.ALLOWED,['T02'])
  V.attestation(C,'stage2-notes.json',lane,['stage2-packet.json',f'lane-{lane}/blind-records.json','method.md','function-dictionary.json'],['T02'])
  row=V.idx(V.read(C/f'lane-{lane}/blind-records.json'))['T02'];trace=V.idx(V.read(C/f'lane-{lane}/persistence-research-trace.json'))['T02']
  V.require([{k:i[k] for k in ['rank','raw_name','canonical_name']} for i in row['ingredient_ledger']]==correct['T02']['ingredients'],'corrected ordered ledger parity')
  V.require(trace['considered_ranks']==list(range(1,7)) and trace['application_context']==correct['T02']['application_context'],'corrected trace coverage/context')
  for i in row['ingredient_ledger']:V.require(i['dictionary_roles']==new[i['canonical_name']]['roles'],'corrected dictionary-role parity')
  for k,values in [('base',['pure_plant_oil','plant_oil_blend','silicone_led','ester_alkane_led','hybrid','water_based','unknown']),('weight',['light','medium','rich','unknown']),('penetration_potential',['penetration_potential','surface_led','unknown'])]:V.property_check(row[k],values)
  for flag in M.FLAGS:V.property_check(row['ingredient_flags'][flag],[True,False])
  V.require(type(row['persistence_potential']) is str and row['persistence_potential'] in ['low','moderate','high'],'corrected scalar enum')
 V.stage_check(C,C,['T02'])
 source=V.idx(V.read(C/'stage2-packet.json'))['T02'];pairs={};stages={}
 for lane in ['a','b']:
  pairs[lane]=V.idx(V.read(RUN/f'lane-{lane}/blind-records.json'));pairs[lane]['T02']=V.idx(V.read(C/f'lane-{lane}/blind-records.json'))['T02']
  stages[lane]=V.idx(V.read(RUN/f'lane-{lane}/stage2-records.json'));stages[lane]['T02']=V.idx(V.read(C/f'lane-{lane}/stage2-records.json'))['T02']
  stage=stages[lane]['T02'];heroes={h['hero_id']:h for h in source['heroes']}
  V.require([h['hero_id'] for h in stage['named_oils']]==list(heroes),'corrected hero membership')
  for h in stage['named_oils']:
   ranks=[i['rank'] for i in pairs[lane]['T02']['ingredient_ledger'] if i['canonical_name'] in heroes[h['hero_id']]['canonical_ingredients']]
   V.require(h['matched_ranks']==ranks,'corrected hero exact-rank mapping')
  V.require(stage['supported_uses']==['leave_on_fibre_conditioning'] and all(s['supported_roles']==['leave_on_fibre_conditioning'] for s in stage['application_scenarios']),'generic finishing does not imply dry stage')
 rows=V.read(VIEW/'profiles.json')['records'] if records is None else records
 V.records_check(rows,EXPECTED,RUN)
 prior=V.idx(V.read(RUN/'profiles.json'));selected=V.read(VIEW/'root-selection.json')['cases']['T02']['lane']
 for row in rows:
  cid=row['case_id']
  if cid!='T02':V.require(row==prior[cid],'unaffected profile deep preservation')
  else:
   for k in M.FORM+['persistence_potential']:V.require(row['field_authority'][k]['path']==str((C/f'lane-{selected}/blind-records.json').relative_to(ROOT)),'corrected coherent formula authority')
   for k in M.SOURCE:V.require(row['field_authority'][k]['path']==str((C/f'lane-{selected}/stage2-records.json').relative_to(ROOT)),'corrected source authority')
  a=row['persistence_trace_reference'];trace=V.idx(V.read(ROOT/a['path']))
  V.require(a['record_key']==cid and cid in trace,'selected trace record-key binding')
  V.require(trace[cid]['application_context']==row['formula']['application_context'],'selected trace context')
 V.require(V.read(VIEW/'scenario-fit.json')==M.fit(rows),'current fit parity')
 V.require(V.read(VIEW/'projection.json')==[{'product_key':r['product_key'],'policy_version':'oil-persistence-leave-on-v0.1','persistence_potential':r['persistence_potential']} for r in rows],'current projection parity')
 csvrows=list(csv.DictReader((VIEW/'results.csv').open()));V.require([r['case_id'] for r in csvrows]==EXPECTED and all(a['persistence_potential']==b['persistence_potential'] for a,b in zip(csvrows,rows)),'current CSV scalar parity')
 metrics=V.read(VIEW/'metrics.json');V.require(metrics['formula_fields']==M.metrics(pairs['a'],pairs['b']) and metrics['source_fields']==M.source_metrics(stages['a'],stages['b']),'current metrics exclude primed pair')
 inventory=V.read(VIEW/'combined-profile-inventory.json');combined=[]
 for path in [M.COMP/'profiles.json',M.HOLD/'profiles.json',VIEW/'profiles.json']:
  combined.extend({'product_key':r['product_key'],'persistence_potential':r['persistence_potential'],'path':str(path.relative_to(ROOT)),'sha256':V.sha(path)} for r in V.read(path)['records'])
 V.require(inventory['records']==combined and len(combined)==len({r['product_key'] for r in combined})==inventory['count']==inventory['distinct_product_keys']==37,'combined inventory authority and uniqueness')
 V.require(inventory['persistence_counts']=={b:sum(r['persistence_potential']==b for r in combined) for b in ['low','moderate','high']},'combined inventory counts')
 review=V.read(ROOT/'plans/oil-inci/reviews/oil-targeted-coverage-review-attempt-v0.1-2026-10-12.json')
 for rel,sha in review['artifact_hashes'].items():
  path=VIEW/'historical-routing-index-snapshot'/rel if rel in F.ROUTING else ROOT/rel
  V.require(V.sha(path)==sha,'first targeted pass preserved: '+rel)
 return {**first,'fresh_corrected_case_count':1,'corrected_ranks':6,'current_view_cases':len(rows)}
def main():
 summary=validate();base=V.read(VIEW/'profiles.json')['records'];checks=[]
 for label,mutate,expected in [('unknown corrected scalar',lambda r:r[1].update(persistence_potential='unknown'),'persistence scalar enum'),('wrong corrected authority key',lambda r:r[1]['field_authority']['base'].update(record_key='T01'),'authority record/field resolution'),('wrong selected trace key',lambda r:r[1]['persistence_trace_reference'].update(record_key='T01'),'selected trace record-key binding'),('unaffected profile drift',lambda r:r[0].update(completion_status='changed'),'unaffected profile deep preservation')]:
  bad=copy.deepcopy(base);mutate(bad)
  try:validate(bad)
  except V.Failure as err:
   V.require(expected in str(err),'wrong rejection: '+label+' '+str(err));checks.append({'mutation':label,'rejected_for':str(err)})
  else:raise V.Failure('accepted correction-boundary corruption: '+label)
 hashes={str(p.relative_to(RUN)):V.sha(p) for p in sorted(RUN.rglob('*')) if p.is_file() and '__pycache__' not in p.parts and p!=VIEW/'verification-receipt.json'}
 M.save(VIEW/'verification-receipt.json',{'status':'passed','summary':summary,'correction_boundary_corruptions':checks,'original_seven_boundary_checks':'Original receipt remains unchanged; parent validate() reruns all structural gates.','artifact_hashes':hashes,'limits':'Current view replaces only T02 with fresh neutral inputs; original primed pass preserved and excluded from clean-calibration claims. Repeatability not accuracy; no runtime/activation.'});print(json.dumps({'status':'passed',**summary,'additional_corruptions_rejected':len(checks)}))
if __name__=='__main__':main()
