#!/usr/bin/env python3
"""Verify frozen research contracts; never validate or choose hair-weight classes."""
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / 'data/research/oil-inci/v1.0/corpus/exploratory/blend-weight-round-4'
OLD = RUN.parent / 'weight-application-round-3'
FILES = {'method.md', 'material-reference.json', 'policy.json', 'role-lexicon.json',
         'blind-packet.json', 'input-manifest.json'}
VALUES = {'light', 'medium', 'rich', 'unknown'}
RULES = {f'B{i}' for i in range(8)}
ROLES = {'principal', 'secondary', 'auxiliary', 'unresolved'}


def read(p):
    return json.loads(p.read_text())


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def key(s):
    return ' '.join(s.upper().split())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def lookup(entries, canonical, aliases):
    result = {}
    for e in entries:
        for n in [e[canonical], *e[aliases]]:
            require(key(n) not in result, f'Ambiguous alias: {n}')
            result[key(n)] = e
    return result


def matches(ingredients, materials):
    return [{'rank': i['rank'], 'reference_id': materials[key(i['canonical_name'])]['id'],
             'value': materials[key(i['canonical_name'])]['weight_prior']['value'],
             'confidence': materials[key(i['canonical_name'])]['weight_prior']['confidence']}
            for i in ingredients if key(i['canonical_name']) in materials]


def check_display(receipt, capture, ingredient, token, last):
    require(receipt['raw_token'] == token and receipt['canonical_name'] == ingredient['canonical_name']
            and receipt['limit'], 'Display scope')
    kind = receipt['kind']
    if kind == 'source_annotation_or_terminal_punctuation':
        require(receipt['authority_url'] == capture['source_url'], 'Annotation source scope')
        normalized = key(token)
        if normalized.endswith('*'):
            require(capture['source_url'] == 'https://khadi.de/products/haare-haaroel-strong-amla',
                    'Unreviewed footnote source')
            normalized = normalized.rstrip('*').strip()
        if last and normalized.endswith('.'):
            normalized = normalized[:-1]
        require(normalized == ingredient['canonical_name'], 'Invalid display-only transformation')
    elif kind == 'reviewed_source_scoped_common_name_display':
        reviewed = {
            'CORYLUS AVELLANA (HAZELNUT) SEED OIL': (
                'CORYLUS AVELLANA SEED OIL', 'https://cosmileeurope.eu/inci/detail/3867/corylus-avellana-seed-oil/',
                'https://de.nuxe.com/products/wichtiger-ol%C2%AE/'),
            'ARGANIA SPINOSA (ARGAN) KERNEL OIL': (
                'ARGANIA SPINOSA KERNEL OIL', 'https://cosmileeurope.eu/inci/detail/1152/argania-spinosa-kernel-oil/',
                'https://de.moroccanoil.com/products/moroccanoil-treatment-original')}
        require(key(token) in reviewed, 'Unreviewed common-name display')
        canonical, authority, source = reviewed[key(token)]
        require(ingredient['canonical_name'] == canonical and receipt['authority_url'] == authority
                and receipt['display_source'] == capture['source_url'] == source, 'Common-name display scope')
    else:
        raise ValueError('Unreviewed display receipt kind')


def check_records(data, packet, materials, roles, blind=True):
    require(set(data) == {'run_id', 'records', 'read_scope'}, 'Output top-level contract')
    require(data['run_id'] == 'oil-blend-weight-round-4', 'Output run ID')
    records = data['records']
    require(len(records) == len(packet) and {r['neutral_id'] for r in records} == set(packet),
            'Output case completeness')
    scope = data['read_scope']
    if blind:
        require(set(scope) == {'files', 'hashes', 'forbidden_access', 'recognition_note'}, 'Scope shape')
        require(set(scope['files']) == FILES and len(scope['files']) == len(FILES), 'Forbidden read scope')
        require(scope['forbidden_access'] is False and bool(scope['recognition_note']), 'Access disclosure')
        require(scope['hashes'] == {f: digest(RUN / f) for f in FILES}, 'Read-scope hashes')
    else:
        require(scope.get('source_access_disclosed') is True and scope.get('written_before_lanes') is True,
                'Main independence disclosure')
    for r in records:
        require(set(r) == {'neutral_id', 'ingredient_roles', 'material_matches', 'weight'}, 'Record shape')
        ingredients = packet[r['neutral_id']]['ingredients']
        assigned = r['ingredient_roles']
        require(len(assigned) == len(ingredients), 'Role coverage')
        for a, i in zip(assigned, ingredients):
            require(set(a) == {'rank', 'canonical_name', 'role', 'reason'}, 'Role shape')
            require(a['rank'] == i['rank'] and a['canonical_name'] == i['canonical_name'], 'Role rank/name')
            require(a['role'] in ROLES and bool(a['reason']), 'Role judgment missing')
            if 'not_assessed' in roles[key(i['canonical_name'])]['roles']:
                require(a['role'] == 'unresolved', 'Unassessed role silently classified')
        require(r['material_matches'] == matches(ingredients, materials), 'False or missing exact material match')
        w = r['weight']
        require(set(w) == {'value', 'estimate', 'confidence', 'evidence', 'counter_signal',
                          'nearest_alternative', 'alternatives', 'rule_ids', 'reason', 'unresolved'}, 'Weight shape')
        require(w['value'] in VALUES and w['confidence'] == 'low', 'Mixture confidence ceiling')
        require(w['estimate'] is (w['value'] != 'unknown'), 'Estimate/unknown contract')
        for field in ['evidence', 'counter_signal', 'alternatives', 'rule_ids', 'unresolved']:
            require(isinstance(w[field], list) and w[field] and all(isinstance(x, str) and x for x in w[field]),
                    f'Missing {field} argument/gap')
        require(bool(w['reason']), 'Missing architecture judgment')
        gap_text = '\n'.join(w['unresolved'])
        require(all(i['canonical_name'] in gap_text for i in ingredients
                    if 'not_assessed' in roles[key(i['canonical_name'])]['roles']),
                'Unassessed ingredient missing from gap ledger')
        require(set(w['alternatives']) <= VALUES - {w['value']}
                and len(set(w['alternatives'])) == len(w['alternatives'])
                and w['nearest_alternative'] in w['alternatives'], 'Alternative contract')
        require(set(w['rule_ids']) <= RULES and {'B0', 'B1'} <= set(w['rule_ids']), 'Policy rule IDs')
        require(w['value'] != 'unknown' or 'B7' in w['rule_ids'], 'Unknown without B7')


def metrics(outputs, identity):
    indexed = {lane: {r['neutral_id']: r['weight']['value'] for r in d['records']}
               for lane, d in outputs.items()}
    cohorts = {}
    for group in ['fresh', 'replay']:
        ids = [i for i, r in identity.items() if r['cohort_group'] == group]
        cohorts[group] = {
            'total': len(ids),
            'lane_pair_raw_equal': sum(indexed['a'][i] == indexed['b'][i] for i in ids),
            'lane_pair_known_equal': sum(indexed['a'][i] == indexed['b'][i] != 'unknown' for i in ids),
            'lane_pair_both_known': sum(indexed['a'][i] != 'unknown' and indexed['b'][i] != 'unknown' for i in ids),
            'classified_by_lane': {lane: sum(values[i] != 'unknown' for i in ids)
                                   for lane, values in indexed.items()}}
    return cohorts, indexed


def verify(inputs_only=False):
    ref_path = ROOT / 'data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.7.json'
    ref = read(ref_path)
    require(digest(ref_path) == digest(RUN / 'material-reference.json'), 'v0.7 pin changed')
    materials = lookup(ref['entries'], 'canonical_inci', 'aliases')
    require(len(ref['entries']) == 65 and len(materials) == 104, 'Material scope changed')
    policy = read(RUN / 'policy.json')
    public = read(ROOT / 'data/research/oil-inci/v1.0/reference/blend-weight-policy-v0.1.json')
    provenance = public.pop('provenance')
    guide_path = ROOT / provenance['source_document']
    require(public == policy and provenance['authorization'] == 'OE30'
            and provenance['source_document_sha256'] == digest(guide_path), 'Policy mirror/provenance')
    guide = guide_path.read_text()
    clauses = guide.split('## Ordered interpretation\n', 1)[1].split('## Output and precedence', 1)[0]
    expected = [{'id': m.group(1), 'text': m.group(2).strip()}
                for m in re.finditer(r'\*\*(B[0-7]) — (.*?)\n(?=\n\*\*B|\Z)', clauses, re.S)]
    require(policy['rules'] == expected and {r['id'] for r in expected} == RULES, 'Policy clause drift')
    require(policy['precedence'] == guide.split('## Output and precedence\n', 1)[1]
            .split('## Trial and provenance', 1)[0].strip(), 'Policy precedence drift')
    manifest = read(RUN / 'input-manifest.json')
    require(set(manifest['blind_input_files']) == FILES and set(manifest['files']) == FILES - {'input-manifest.json'},
            'Input read contract')
    for f, h in manifest['files'].items():
        require(digest(RUN / f) == h, f'Sealed input changed: {f}')
    for f, h in read(RUN / 'provenance-seal.json')['files'].items():
        require(digest(RUN / f) == h, f'Sealed provenance changed: {f}')
    historical = read(RUN / 'historical-baseline.json')
    for f, h in historical.items():
        require(digest(ROOT / f) == h, f'Historical artifact changed: {f}')
    raw_packet = read(RUN / 'blind-packet.json')['records']
    packet = {r['neutral_id']: r for r in raw_packet}
    identity_rows = read(RUN / 'identity-map.json')['records']
    identity = {r['neutral_id']: r for r in identity_rows}
    captures = read(RUN / 'source-capture.json')['records']
    require(len(raw_packet) == len(identity_rows) == len(captures) == len(packet) == 10, 'Input cohort size')
    require(set(identity) == {r['neutral_id'] for r in captures} == set(packet)
            == set(manifest['neutral_ids']), 'Input IDs')
    require(sum(r['cohort_group'] == 'fresh' for r in identity_rows) == 6
            and sum(r['cohort_group'] == 'replay' for r in identity_rows) == 4, 'Cohort denominators')
    roles = lookup(read(RUN / 'role-lexicon.json')['entries'], 'canonical_name', 'aliases')
    receipts = read(RUN / 'display-receipts.json')['receipts']
    old_packet = {r['neutral_id']: r for r in read(OLD / 'blind-packet.json')['records']}
    old_capture = {r['neutral_id']: r for r in read(OLD / 'source-capture.json')['records']}
    old_formulas = []
    for folder in ['round-1', 'natural-base-round-2', 'weight-application-round-3']:
        old_formulas.extend(r['ingredients'] for r in read(RUN.parent / folder / 'blind-packet.json')['records'])
    for c in captures:
        p = packet[c['neutral_id']]
        require(set(p) == {'neutral_id', 'input_kind', 'ingredients'}, 'Identity leakage into packet')
        require(c['ingredients'] == p['ingredients'], 'Capture/packet mismatch')
        require([i['rank'] for i in p['ingredients']] == list(range(1, len(p['ingredients']) + 1)), 'Input ranks')
        require(all(set(i) == {'rank', 'canonical_name'} and key(i['canonical_name']) in roles
                    for i in p['ingredients']), 'Incomplete exact function map')
        require(c['source_url'] == identity[c['neutral_id']]['source_url'], 'Source identity mismatch')
        if identity[c['neutral_id']]['cohort_group'] == 'replay':
            oid = identity[c['neutral_id']]['reused_development_id']
            require(c['raw_inci'] == old_capture[oid]['raw_inci']
                    and p['ingredients'] == old_packet[oid]['ingredients'], 'Replay not pinned')
            require(all(c[field] == old_capture[oid][field] == identity[c['neutral_id']][field]
                        for field in ['brand', 'product', 'source_url', 'market', 'size']), 'Replay identity drift')
            continue
        require(p['ingredients'] not in old_formulas, 'Fresh formula is replay')
        raw = c['raw_inci']
        codes = [r for r in receipts if r['neutral_id'] == c['neutral_id'] and r['kind'] == 'formula_code_removal']
        for receipt in codes:
            require(receipt['raw_code'] == c['formula_code'] and receipt['authority_url'] == c['source_url'], 'Code scope')
            require((c['source_url'], receipt['raw_code']) in {
                ('https://de.nuxe.com/products/wichtiger-ol%C2%AE/', 'N2212/E'),
                ('https://de.moroccanoil.com/products/moroccanoil-treatment-original', 'MOT02')}, 'Unreviewed code removal')
            raw = re.sub(r'(?:\. | \[)' + re.escape(receipt['raw_code']) + r'\]?$', '', raw)
        tokens = [s.strip() for s in raw.split(',')]
        require(len(tokens) == len(p['ingredients']), 'Raw ingredient count')
        for i, token in zip(p['ingredients'], tokens):
            rs = [r for r in receipts if r['neutral_id'] == c['neutral_id'] and r.get('rank') == i['rank']]
            require(len(rs) <= 1, 'Ambiguous display receipt')
            if rs:
                check_display(rs[0], c, i, token, i['rank'] == len(tokens))
            else:
                require(key(token) == i['canonical_name'], 'Unrecorded normalization')
    report = {'status': 'passed', 'scope': 'Artifact contracts, not scientific/sensory accuracy',
              'cases': 10, 'fresh': 6, 'replay': 4, 'materials': 65, 'exact_material_names': 104,
              'historical_files_unchanged': len(historical), 'read_scope_limit': 'Self-report, not sandbox proof'}
    if inputs_only:
        return dict(report, mode='inputs_only')
    outputs = {lane: read(RUN / f'lane-{lane}/records.json') for lane in ['a', 'b']}
    outputs['main'] = read(RUN / 'main-working.json')
    require(read(RUN / 'main-before-lanes-seal.json')['sha256'] == digest(RUN / 'main-working.json'),
            'Main judgment changed after independent lanes')
    for lane, data in outputs.items():
        check_records(data, packet, materials, roles, blind=lane != 'main')
    seal = read(RUN / 'output-seal.json')
    require({'main-working.json', 'main-before-lanes-seal.json', 'comparison.json', 'adjudication.json',
             'results-for-review.md', 'working-weights.csv', 'negative-control-receipt.json', 'verification-receipt.json',
             'lane-a/records.json', 'lane-a/notes.md', 'lane-b/records.json', 'lane-b/notes.md'} <= set(seal['files']),
            'Unsealed result artifact')
    for f, h in seal['files'].items():
        require(digest(RUN / f) == h, f'Sealed output changed: {f}')
    receipt = read(RUN / 'verification-receipt.json')
    require(receipt['status'] == 'passed' and receipt['run_id'] == 'oil-blend-weight-round-4'
            and receipt['commands'] and all(c['exit_code'] == 0 for c in receipt['commands']),
            'Missing or failed positive verification receipt')
    comparison = read(RUN / 'comparison.json')
    cohorts, indexed = metrics(outputs, identity)
    require(comparison['cohorts'] == cohorts, 'Comparison denominator/value error')
    require(len(comparison['rows']) == 10 and {r['neutral_id'] for r in comparison['rows']} == set(packet),
            'Comparison row coverage')
    for r in comparison['rows']:
        i = r['neutral_id']
        require(r['cohort_group'] == identity[i]['cohort_group']
                and all(r[lane] == indexed[lane][i] for lane in outputs), 'Comparison class drift')
    consistency = comparison['accepted_replay_consistency']
    human = consistency['human_choices']
    require(set(human) == {i for i, r in identity.items() if r['cohort_group'] == 'replay'}
            and consistency['total'] == len(human), 'Replay consistency denominator')
    for lane, field in [('a', 'a_matches'), ('b', 'b_matches'), ('main', 'main_initial_matches')]:
        require(consistency[field] == sum(indexed[lane][i] == value for i, value in human.items()),
                'Replay consistency count')
    adjudication = read(RUN / 'adjudication.json')
    adjudicated = {r['neutral_id']: r for r in adjudication['rows']}
    require(len(adjudication['rows']) == len(adjudicated) == 10 and set(adjudicated) == set(packet),
            'Working adjudication coverage')
    require(adjudication['policy_changes_during_round'] is False, 'Mid-round policy tuning')
    for i, row in adjudicated.items():
        require(row['value'] in VALUES and row['confidence'] == 'low'
                and row['estimate'] is (row['value'] != 'unknown')
                and row['nearest_alternative'] in VALUES - {row['value']}
                and row['reason'] and row['choice_basis'] and row['unresolved'], 'Working estimate contract')
        require(all(x['canonical_name'] in '\n'.join(row['unresolved']) for x in packet[i]['ingredients']
                    if 'not_assessed' in roles[key(x['canonical_name'])]['roles']), 'Working gap accounting')
    with (RUN / 'working-weights.csv').open(newline='') as stream:
        sheet = list(csv.DictReader(stream))
    require(len(sheet) == 10 and {r['neutral_id'] for r in sheet} == set(packet), 'Working sheet coverage')
    for row in sheet:
        i = row['neutral_id']
        require(all(row[field] == indexed[lane][i] for field, lane in
                    [('lane_a', 'a'), ('lane_b', 'b'), ('main_initial', 'main')])
                and row['working_weight'] == adjudicated[i]['value']
                and row['nearest_alternative'] == adjudicated[i]['nearest_alternative']
                and row['cohort'] == identity[i]['cohort_group']
                and row['brand'] == identity[i]['brand'] and row['product'] == identity[i]['product']
                and row['confidence'] == 'low'
                and row['estimate'] == str(adjudicated[i]['estimate']).lower(), 'Working sheet value drift')
    return dict(report, mode='complete', cohorts=cohorts)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--inputs-only', action='store_true')
    print(json.dumps(verify(parser.parse_args().inputs_only), indent=2))
