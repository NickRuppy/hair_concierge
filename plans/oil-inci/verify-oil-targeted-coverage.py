#!/usr/bin/env python3
"""Read-only checks for the targeted research boundary; emit one local receipt."""
import copy, csv, hashlib, importlib.util, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('full_profile_checks',ROOT/'plans/oil-inci/verify-oil-full-profiles.py')
V=importlib.util.module_from_spec(spec);spec.loader.exec_module(V)
M=V.M
RUN=ROOT/'data/research/oil-inci/v1.0/corpus/holdout/targeted-coverage-v0.1'
ALLOWED=['method.md','blind-packet.json','function-dictionary.json','material-weight-reference.json']
ROUTING=['docs/research/README.md','docs/research/oil-inci/README.md']
def preservation():
 baseline=V.read(ROOT/'plans/oil-inci/reviews/oil-full-profile-completion-2026-10-09.json')
 prior=baseline['artifact_hashes']
 V.hashes(ROOT,baseline['unchanged_inherited_dependencies'])
 for path,sha in prior.items():
  p=RUN/'historical-routing-index-snapshot'/path if path in ROUTING else ROOT/path
  V.require(V.sha(p)==sha,'historical artifact drift: '+path)
 return {'frozen_files_unchanged':len(prior)-len(ROUTING),'routing_predecessors_preserved':len(ROUTING)}
def validate(profiles=None,stage_override=None):
 manifest=V.read(RUN/'input-manifest.json');expected=manifest['case_ids'];packet=V.idx(V.read(RUN/'blind-packet.json'))
 V.hashes(RUN,manifest['inputs']);V.hashes(RUN,manifest['sources'])
 deps=V.read(RUN/'dependency-manifest.json');V.hashes(ROOT,deps['upstream_hashes'])
 weight=V.read(RUN/'material-weight-reference.json');upstream=V.read(ROOT/deps['weight_only_derivation']['source'])
 keys=deps['weight_only_derivation']['selected_entry_keys']
 V.require(weight['entries']==[{k:r[k] for k in keys if k in r} for r in upstream['entries']],'weight-only transformation parity')
 formulas=[tuple(i['canonical_name'] for i in row['ingredients']) for row in packet.values()]
 V.require(len(formulas)==len(set(formulas)),'intra-cohort formula duplicate')
 dictionary={e['canonical_name']:e for e in V.read(RUN/'function-dictionary.json')['entries']}
 for file in ['blind-seal.json','stage2-seal.json']:V.hashes(RUN,V.read(RUN/file)['outputs'])
 V.require(V.sha(RUN/'stage2-packet.json')==V.read(RUN/'stage2-manifest.json')['stage2-packet.json'],'source stage hash')
 V.no_prior_formula_overlap(RUN)
 for lane in ['a','b']:
  V.attestation(RUN,'blind-notes.json',lane,ALLOWED,expected)
  V.attestation(RUN,'stage2-notes.json',lane,['stage2-packet.json',f'lane-{lane}/blind-records.json','method.md','function-dictionary.json'],expected)
  blind=V.idx(V.read(RUN/f'lane-{lane}/blind-records.json'));trace=V.idx(V.read(RUN/f'lane-{lane}/persistence-research-trace.json'))
  V.require(list(trace)==expected,'trace case coverage')
  for cid in expected:
   row=blind[cid];ingredients=packet[cid]['ingredients']
   V.require([{k:i[k] for k in ['rank','raw_name','canonical_name']} for i in row['ingredient_ledger']]==ingredients,'ordered blind ingredient parity')
   for i in row['ingredient_ledger']:V.require(i['dictionary_roles']==dictionary[i['canonical_name']]['roles'],'dictionary roles parity')
   for key,values in [('base',['pure_plant_oil','plant_oil_blend','silicone_led','ester_alkane_led','hybrid','water_based','unknown']),('weight',['light','medium','rich','unknown']),('penetration_potential',['penetration_potential','surface_led','unknown'])]:V.property_check(row[key],values)
   for flag in M.FLAGS:V.property_check(row['ingredient_flags'][flag],[True,False])
   V.require(type(row['persistence_potential']) is str and row['persistence_potential'] in ['low','moderate','high'],'blind persistence scalar enum')
   V.require(trace[cid]['considered_ranks']==list(range(1,len(ingredients)+1)),'trace rank coverage')
   V.require(trace[cid]['application_context']==packet[cid]['application_context'],'trace context parity')
 V.stage_check(RUN,RUN,expected)
 sources=V.idx(V.read(RUN/'stage2-packet.json'))
 for lane in ['a','b']:
  blind=V.idx(V.read(RUN/f'lane-{lane}/blind-records.json'));stages=V.idx(V.read(RUN/f'lane-{lane}/stage2-records.json'))
  for cid in expected:
   heroes={h['hero_id']:h for h in sources[cid]['heroes']};named=stages[cid]['named_oils']
   V.require([n['hero_id'] for n in named]==list(heroes),'source hero coverage')
   for n in named:
    matching=[i for i in blind[cid]['ingredient_ledger'] if i['canonical_name'] in heroes[n['hero_id']]['canonical_ingredients']]
    V.require(n['matched_ranks']==[i['rank'] for i in matching],'source hero exact ranks')
    V.require(bool(matching) or n['prominence']['value']=='absent','source hero absence')
 if stage_override is not None:
  for row in stage_override:
   V.require(set(row)=={'case_id',*M.SOURCE},'Stage2 must not rewrite formula fields')
 records=V.read(RUN/'profiles.json')['records'] if profiles is None else profiles
 V.records_check(records,expected,RUN)
 for row in records:
  V.require([{k:i[k] for k in ['rank','raw_name','canonical_name']} for i in row['ingredient_ledger']]==packet[row['case_id']]['ingredients'],'ordered selected ingredient parity')
 V.require(M.MATRIX=={'light':['suitable','suitable','conditional'],'medium':['conditional','suitable','suitable'],'rich':['conditional','conditional','suitable'],'unknown':['unknown']*3},'approved thickness policy')
 V.require(V.read(RUN/'scenario-fit.json')==M.fit(records),'fit policy/scenario parity')
 V.require(V.read(RUN/'projection.json')==[{'product_key':r['product_key'],'policy_version':'oil-persistence-leave-on-v0.1','persistence_potential':r['persistence_potential']} for r in records],'scalar projection parity')
 rows=list(csv.DictReader((RUN/'results.csv').open()));V.require([r['case_id'] for r in rows]==expected,'CSV cohort parity')
 V.require(all(a['persistence_potential']==b['persistence_potential'] for a,b in zip(rows,records)),'CSV scalar parity')
 return {'cases':len(records),'ranks':sum(len(x['ingredient_ledger']) for x in records),'scenario_roles':len(M.fit(records)['records']),**preservation()}
def main():
 summary=validate();base=V.read(RUN/'profiles.json')['records'];checks=[]
 mutations=[('missing case',lambda x:x.pop(),'case membership/order'),('uncertainty wrapper',lambda x:x[0].update(persistence_potential={'value':'low'}),'persistence scalar enum'),('unknown persistence',lambda x:x[0].update(persistence_potential='unknown'),'persistence scalar enum'),('unbound scenario',lambda x:x[0]['application_scenarios'][0].update(source_id=''),'unbound source'),('changed ordered ingredient',lambda x:x[0]['ingredient_ledger'][0].update(raw_name='MUTATED'),'selected field authority parity'),('selected base drift',lambda x:x[0]['base'].update(value='unknown' if x[0]['base']['value']!='unknown' else 'water_based'),'selected field authority parity')]
 for label,mutate,expected in mutations:
  bad=copy.deepcopy(base);mutate(bad)
  try:validate(profiles=bad)
  except V.Failure as err:
   V.require(expected in str(err),'wrong rejection: '+label+' '+str(err));checks.append({'mutation':label,'rejected_for':str(err)})
  else:raise V.Failure('accepted corruption: '+label)
 bad=copy.deepcopy(V.read(RUN/'lane-a/stage2-records.json')['records']);bad[0]['weight']={'value':'rich'}
 try:validate(stage_override=bad)
 except V.Failure as err:checks.append({'mutation':'source stage rewrites weight','rejected_for':str(err)})
 else:raise V.Failure('accepted source rewrite')
 hashes={str(p.relative_to(RUN)):V.sha(p) for p in sorted(RUN.rglob('*')) if p.is_file() and p.name!='verification-receipt.json'}
 M.save(RUN/'verification-receipt.json',{'status':'passed','summary':summary,'meaningful_boundary_corruptions':checks,'artifact_hashes':hashes,'limits':'Structural, attribution, source gates and policy consistency; repeatability/coverage reported separately. No measured accuracy or intake readiness.'})
 print(json.dumps({'status':'passed',**summary,'corruptions_rejected':len(checks)}))
if __name__=='__main__':main()
