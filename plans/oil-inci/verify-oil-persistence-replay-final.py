"""Verify the oil-only leave-on replay's source, output and preservation contracts.

No runtime imports, database writes or measured-performance assertions.
"""
import copy
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / 'data/research/oil-inci/v1.0/corpus/exploratory/persistence-replay-v0.1'
RUN_ID = 'oil-persistence-leave-on-replay-v0.1'
POLICY = 'oil-persistence-leave-on-v0.1'
VALUES = {'low', 'moderate', 'high'}
READS = {'method.md', 'blind-packet.json', 'function-dictionary.json'}


def read(name):
    return json.loads((RUN / name).read_text())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def indexed(rows):
    mapping = {r['case_id']: r for r in rows}
    require(len(mapping) == len(rows), 'duplicate case')
    return mapping


def validate_records(rows, packet):
    records = indexed(rows)
    require(records.keys() == packet.keys(), 'case coverage')
    for key, row in records.items():
        require(set(row) == {'case_id', 'persistence_potential', 'reason', 'evidence', 'considered_ranks'}, 'research fields')
        require(row['persistence_potential'] in VALUES, 'committed class')
        require(isinstance(row['reason'], str) and row['reason'].strip(), 'missing reason')
        ingredients = packet[key]['ingredients']
        require(row['considered_ranks'] == [i['rank'] for i in ingredients], 'rank coverage')
        require(isinstance(row['evidence'], list) and row['evidence'], 'missing evidence')
        names = {i['rank']: i['canonical_name'] for i in ingredients}
        for evidence in row['evidence']:
            require(set(evidence) == {'rank', 'canonical_name'} and names.get(evidence['rank']) == evidence['canonical_name'], 'evidence binding')
    return records


def validate_projection(rows, sources, decisions):
    require(len(rows) == len(sources), 'projection coverage')
    mapping = {r['product_key']: r for r in rows}
    require(len(mapping) == len(sources) and mapping.keys() == {s['product_key'] for s in sources.values()}, 'projection keys')
    for key, source in sources.items():
        row = mapping[source['product_key']]
        require(set(row) == {'product_key', 'policy_version', 'persistence_potential'}, 'projection fields')
        require(row['policy_version'] == POLICY, 'projection policy')
        require(row['persistence_potential'] in VALUES and row['persistence_potential'] == decisions[key]['persistence_potential'], 'projection decision parity')


def main():
    manifest = read('input-manifest.json')
    require(manifest['run_id'] == RUN_ID and manifest['policy_version'] == POLICY and set(manifest['read_allowlist']) == READS, 'manifest identity')
    for name, expected in manifest['run_inputs'].items():
        require(digest(RUN / name) == expected, 'changed input: ' + name)
    for name, expected in manifest['dependencies'].items():
        require(digest(ROOT / name) == expected, 'changed dependency: ' + name)
    sources = indexed(read('source-packet.json')['records'])
    packet = indexed(read('blind-packet.json')['records'])
    staged = indexed(read('source-packet-staged.json')['records'])
    scope = read('scope-decision.json')
    require(len(staged) == 28 and len(sources) == 27 and packet.keys() == sources.keys() == staged.keys() - {'O02'}, 'leave-on cohort')
    require(scope['candidate_formulas'] == 28 and scope['included_leave_on'] == 27 and len(scope['excluded_pre_wash_only']) == 1 and scope['excluded_pre_wash_only'][0]['case_id'] == 'O02' and scope['no_post_shampoo_classification'] is True and scope['no_other_category_migration'] is True, 'scope decision')
    ranks = 0
    for key, source in sources.items():
        require(set(packet[key]) == {'case_id', 'application_context', 'ingredients', 'contextual_declarations'}, 'neutral packet fields')
        for field in packet[key]:
            require(packet[key][field] == source[field], 'source/neutral parity')
        for field in ('raw_inci', 'primary_inci', 'ingredients', 'contextual_declarations', 'source_refs', 'directions_capture', 'identity', 'product_key'):
            require(source[field] == staged[key][field], 'staging source binding')
        require(source['selected_context']['mode'] == 'retained_fibre', 'retained context')
        context = source['selected_context']
        if key == 'O16':
            supplement = read('leave-on-source-supplement.json')
            require(context['source_context_packet'] == str((RUN / 'leave-on-source-supplement.json').relative_to(ROOT)) and context['source_context_key'] == key and context['scenario'] == {'text': supplement['use_evidence_paraphrase']}, 'protective-style context binding')
        else:
            require(context['source_context_packet'] == source['source_refs']['context_packet'] and context['source_context_key'] == source['source_refs']['context_key'], 'context packet binding')
            captured = source['directions_capture']
            selected = captured[context['scenario_index']] if isinstance(captured, list) else {'text': captured}
            require(context['scenario'] == selected, 'selected scenario binding')
            require(not isinstance(captured, list) or context['scenario'].get('removal') not in {'shampoo', 'rinse'}, 'removed scenario admitted')
        require([i['rank'] for i in source['ingredients']] == list(range(1, len(source['ingredients']) + 1)), 'primary ranks')
        ranks += len(source['ingredients'])
    names = {i['canonical_name'] for r in sources.values() for i in r['ingredients']}
    entries = read('function-dictionary.json')['entries']
    require(len(entries) == len(names) and {e['canonical_name'] for e in entries} == names, 'dictionary coverage')
    require(all(e['roles'] and e['notes'] and e['function_source_refs'] for e in entries), 'function evidence')
    definition = (ROOT / 'docs/research/shared/persistence-potential-v0.1.md').read_text()
    guidance = (ROOT / 'docs/research/oil-inci/v1.0/10_persistence-guidance-v0.2.md').read_text()
    require((RUN / 'method.md').read_text().startswith(definition + '\n' + guidance), 'verbatim method basis')
    seal = read('blind-stage-seal.json')
    require(seal['input_manifest_sha256'] == digest(RUN / 'input-manifest.json') and seal['semantic_inspection'] == 'not_performed_before_seal', 'blind seal ordering')
    lanes = {}
    for lane in ('a', 'b'):
        for filename in ('records.json', 'notes.json'):
            name = f'lane-{lane}/{filename}'
            require(digest(RUN / name) == seal['lane_output_hashes'][name], 'sealed output parity')
        payload = read(f'lane-{lane}/records.json')
        require(set(payload) == {'run_id', 'lane', 'records'} and payload['run_id'] == RUN_ID and payload['lane'] == lane, 'lane identity')
        lanes[lane] = validate_records(payload['records'], packet)
        notes = read(f'lane-{lane}/notes.json')
        require(set(notes) == {'run_id', 'lane', 'read_inputs', 'completed_ids', 'recognized_formulas', 'access_incidents', 'limits'}, 'notes fields')
        require(notes['run_id'] == RUN_ID and notes['lane'] == lane and len(notes['completed_ids']) == len(packet) and set(notes['completed_ids']) == packet.keys(), 'notes completion')
        require(len(notes['read_inputs']) == 3 and {Path(r['path']).resolve() for r in notes['read_inputs']} == {RUN / p for p in READS}, 'read allowlist')
        require(all(set(r) == {'path', 'sha256'} and digest(Path(r['path'])) == r['sha256'] for r in notes['read_inputs']), 'read input hashes')
        require(isinstance(notes['recognized_formulas'], list) and not notes['access_incidents'] and notes['limits'], 'access attestations')
    decision_payload = read('research-decisions.json')
    require(set(decision_payload) == {'run_id', 'records'} and decision_payload['run_id'] == RUN_ID, 'decision envelope')
    decisions = validate_records(decision_payload['records'], packet)
    validate_projection(read('projection.json'), sources, decisions)
    schema = read('projection-schema.json')
    require(schema['minItems'] == schema['maxItems'] == 27 and schema['items']['additionalProperties'] is False and set(schema['items']['properties']) == {'product_key', 'policy_version', 'persistence_potential'} and schema['items']['properties']['policy_version']['const'] == POLICY and set(schema['items']['properties']['persistence_potential']['enum']) == VALUES, 'projection schema')
    integration = indexed(read('integration-notes.json')['records'])
    require(integration.keys() == packet.keys(), 'integration coverage')
    with (RUN / 'results.csv').open(newline='') as f:
        rows = list(csv.DictReader(f))
    csv_rows = indexed(rows)
    require(len(rows) == len(packet) and csv_rows.keys() == packet.keys(), 'CSV coverage')
    for key, row in csv_rows.items():
        require(row['decision'] == decisions[key]['persistence_potential'] and row['brand'] == sources[key]['identity']['brand'] and row['product'] == sources[key]['identity']['product'], 'CSV decision/source parity')
        for lane in ('a', 'b'):
            require(row[f'lane_{lane}'] == lanes[lane][key]['persistence_potential'], 'CSV lane parity')
        selected = integration[key]['selected_from']
        require(selected in {'a', 'b', 'root'} and integration[key]['reason'] and integration[key]['selected_context'] == sources[key]['selected_context'], 'integration provenance')
        require(selected == 'root' or decisions[key] == lanes[selected][key], 'selected record parity')
    prior = read('historical-preservation-final.json')
    for name, expected in prior.items():
        require(digest(ROOT / name) == expected, 'historical preservation: ' + name)
    controls = []
    for label, expected, mutate in [
        ('unknown_class', 'committed class', lambda rows: rows[0].update(persistence_potential='unknown')),
        ('dropped_case', 'case coverage', lambda rows: rows.pop()),
        ('broken_evidence', 'evidence binding', lambda rows: rows[0]['evidence'][0].update(rank=999)),
    ]:
        rows = copy.deepcopy(decision_payload['records'])
        mutate(rows)
        try:
            validate_records(rows, packet)
        except ValueError as e:
            require(str(e) == expected, 'wrong corruption guard')
            controls.append(label)
        else:
            raise ValueError('escaped corruption: ' + label)
    rows = copy.deepcopy(read('projection.json'))
    rows[0]['confidence'] = 'low'
    try:
        validate_projection(rows, sources, decisions)
    except ValueError as e:
        require(str(e) == 'projection fields', 'wrong confidence guard')
        controls.append('confidence_field')
    else:
        raise ValueError('escaped confidence field')
    receipt = {'status': 'passed', 'run_id': RUN_ID, 'policy_version': POLICY, 'cases': len(packet), 'pre_wash_only_excluded': ['O02'], 'primary_ranks': ranks, 'dictionary_identities': len(names), 'historical_files_preserved': len(prior), 'committed_values': {v: sum(d['persistence_potential'] == v for d in decisions.values()) for v in sorted(VALUES)}, 'lane_value_agreement': {'count': sum(lanes['a'][k]['persistence_potential'] == lanes['b'][k]['persistence_potential'] for k in packet), 'denominator': len(packet), 'meaning': 'repeatability only, not measured accuracy'}, 'negative_controls_rejected': controls, 'recognized_formulas': {lane: read(f'lane-{lane}/notes.json')['recognized_formulas'] for lane in ('a', 'b')}, 'limits': 'Published exact declarations, committed qualitative leave-on estimates; no post-shampoo, physical batch, measured persistence/accumulation, holdout or production validation.'}
    (RUN / 'verification-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
