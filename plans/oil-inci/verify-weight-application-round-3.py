#!/usr/bin/env python3
"""Check round-3 provenance/contracts; this does not validate hair feel."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / 'data/research/oil-inci/v1.0/corpus/exploratory/weight-application-round-3'
REFERENCE = ROOT / 'data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.7.json'
VALUES = {'light', 'medium', 'rich', 'unknown'}
ROLES = {'principal', 'secondary', 'auxiliary', 'unresolved'}
CONFIDENCE = {'low': 1, 'moderate': 2}


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def key(name):
    return ' '.join(name.upper().split())


def verify(inputs_only=False):
    ref = read(REFERENCE)
    require(digest(REFERENCE) == digest(RUN / 'material-reference.json'), 'v0.7 pin changed')
    entries = {e['id']: e for e in ref['entries']}
    require(len(entries) == len(ref['entries']) == 65, 'Material identities')
    aliases = {}
    for e in entries.values():
        for name in [e['canonical_inci'], *e['aliases']]:
            require(key(name) not in aliases, 'Ambiguous material alias')
            aliases[key(name)] = e['id']
    require(len(aliases) == 104, 'Reviewed exact names')
    for excluded in ['CALENDULA OFFICINALIS FLOWER EXTRACT', 'CASTOR ISOSTEARATE SUCCINATE',
                     'HELIANTHUS ANNUUS OIL', 'COCOS NUCIFERA FRUIT OIL', 'MCT OIL']:
        require(excluded not in aliases, f'Invalid botanical inheritance: {excluded}')
    audit = read(RUN / 'complete-list-review.json')
    require({r['id'] for r in audit['rows']} == set(entries) and len(audit['rows']) == 65,
            'Incomplete list review')
    for row in audit['rows']:
        e = entries[row['id']]
        require(row['canonical_inci'] == e['canonical_inci'] and row['weight'] == e['weight_prior']['value'],
                'Audit/material disagreement')
        require(row['source_references_resolve'] and row['identity_limits_recorded']
                and not row['validated_hair_weight'], 'Unsupported or incomplete audit')
    manifest = read(RUN / 'input-manifest.json')
    permitted = set(manifest['blind_input_files'])
    require(permitted == {'method.md', 'material-reference.json', 'role-lexicon.json',
                          'blind-packet.json', 'input-manifest.json'}, 'Blind input contract')
    require(manifest['method_revision'] == 'weight-v0.7', 'Wrong method revision')
    for filename, expected in manifest['files'].items():
        require(digest(RUN / filename) == expected, f'Sealed input changed: {filename}')
    historical = read(RUN / 'historical-baseline.json')
    for filename, expected in historical.items():
        require(digest(ROOT / filename) == expected, f'Historical artifact changed: {filename}')
    packet = read(RUN / 'blind-packet.json')['records']
    input_ids = {r['neutral_id'] for r in packet}
    require(len(packet) == len(input_ids) == 10, 'Input IDs')
    identity = read(RUN / 'identity-map.json')['records']
    captures = read(RUN / 'source-capture.json')['records']
    require(len(identity) == len(captures) == 10, 'Identity/capture count')
    require({r['neutral_id'] for r in identity} == {r['neutral_id'] for r in captures} == input_ids,
            'Identity/capture coverage')
    require(sum(r['cohort_group'] == 'single_material_product' for r in identity) == 5
            and sum(r['cohort_group'] == 'blend_product' for r in identity) == 4
            and sum(r['cohort_group'] == 'raw_material_benchmark' for r in identity) == 1,
            'Separate cohort denominators')
    require(all(r['reused_development'] for r in identity if r['neutral_id'] in {'W01', 'W02', 'W05', 'W06', 'W09'}),
            'Reused development hidden')
    displays = {(r['neutral_id'], r['rank']): r for r in read(RUN / 'display-receipts.json')['records']}
    captures_by_id = {r['neutral_id']: r for r in captures}
    for p in packet:
        require(set(p) == {'neutral_id', 'input_kind', 'ingredients'}, 'Non-formula input metadata')
        require([r['rank'] for r in p['ingredients']] == list(range(1, len(p['ingredients']) + 1)), 'Ranks')
        capture = captures_by_id[p['neutral_id']]
        raw = [s.strip() for s in capture['raw_inci'].strip().rstrip('.').split(',')]
        require(len(raw) == len(p['ingredients']), 'Raw/canonical ingredient count')
        for ing, raw_display in zip(p['ingredients'], raw):
            default = key(raw_display.replace('*', '').strip())
            receipt = displays.get((p['neutral_id'], ing['rank']))
            require(ing['canonical_name'] == (receipt['resolved_display'] if receipt else default),
                    'Unrecorded input normalization')
            if receipt:
                require(receipt['raw_display'] == raw_display and receipt['source_url'] == capture['source_url']
                        and receipt['scope'] == 'exact captured product only', 'Display receipt scope')
    report = {'status': 'passed', 'scope': 'artifact contracts, not scientific accuracy',
              'materials_reviewed': 65, 'exact_names': 104, 'input_cases': 10,
              'single_material_products': 5, 'blended_products': 4, 'raw_material_benchmarks': 1,
              'historical_files_unchanged': len(historical), 'v0_7_pin_verified': True,
              'read_scope_limit': 'declared files and recorded hashes; no proof of hidden recognition/access'}
    if inputs_only:
        report['mode'] = 'inputs_only'
        return report
    seal = read(RUN / 'output-seal.json')
    for filename, expected in seal['files'].items():
        require(digest(RUN / filename) == expected, f'Sealed output changed: {filename}')
    packet_by_id = {r['neutral_id']: r for r in packet}
    outputs = {}
    for lane in ['a', 'b', 'main']:
        path = RUN / f'lane-{lane}/records.json' if lane != 'main' else RUN / 'main-working-weights-v0.7.json'
        data = read(path)
        require(data['run_id'] == manifest['run_id'] and data['method_revision'] == 'weight-v0.7', 'Output provenance')
        require(data['lane_id'] == lane, 'Output owner')
        records = data['records']
        require(len(records) == len({r['neutral_id'] for r in records}) == 10, 'Output IDs/count')
        require({r['neutral_id'] for r in records} == input_ids, 'Output coverage')
        outputs[lane] = {r['neutral_id']: r for r in records}
        if lane != 'main':
            require({Path(p).name for p in data['files_read']} == permitted, 'Declared blind read scope')
            require(len(data['files_read']) == 5, 'Extra declared reads')
            notes = (RUN / f'lane-{lane}/notes.md').read_text()
            for filename in permitted:
                require(filename in notes and digest(RUN / filename) in notes, 'Missing input attestation')
        for record in records:
            p = packet_by_id[record['neutral_id']]
            require(record['input_kind'] == p['input_kind'], 'Input kind changed')
            w = record['weight']
            require(w['value'] in VALUES and w['confidence'] in CONFIDENCE, 'Weight/confidence vocabulary')
            require(w['reason'] and isinstance(w['unresolved'], list) and isinstance(w['evidence'], list)
                    and isinstance(w['counter_signal'], list), 'Missing reason/evidence/limits')
            if w['value'] == 'unknown':
                require(w['estimate'] is False and w['confidence'] == 'low' and w['unresolved'], 'Unknown shape')
                require(record['completion_status'] == 'weight_only_blocked', 'Hidden blocked result')
                require(w['nearest_alternative'] in VALUES - {'unknown'} or w['nearest_alternative'] is None,
                        'Unknown alternative')
            else:
                require(w['estimate'] is True and w['nearest_alternative'] in VALUES - {w['value'], 'unknown'},
                        'Substantive estimate/alternative')
                require(record['completion_status'] == 'weight_only_complete' and w['evidence'], 'Empty class rationale')
            roles = record['ingredient_roles']
            require(len(roles) == len(p['ingredients'])
                    and {(r['rank'], r['canonical_name']) for r in roles}
                    == {(r['rank'], r['canonical_name']) for r in p['ingredients']}, 'Ingredient ledger coverage')
            require(all(r['role'] in ROLES and r['reason'] for r in roles), 'Role contract')
            expected = {(r['rank'], aliases[key(r['canonical_name'])]) for r in p['ingredients']
                        if key(r['canonical_name']) in aliases}
            matches = record['material_matches']
            require({(m['rank'], m['reference_id']) for m in matches} == expected
                    and len(matches) == len(expected), 'False/missing material match')
            for m in matches:
                require(m['formula_role'] in ROLES and m['reason']
                        and m['prior'] == entries[m['reference_id']]['weight_prior'], 'Match prior/role')
            if len(p['ingredients']) == 1:
                mid = aliases.get(key(p['ingredients'][0]['canonical_name']))
                require(mid is not None, 'Unresearched pure material')
                prior = entries[mid]['weight_prior']
                require(w['value'] == prior['value']
                        and CONFIDENCE[w['confidence']] <= CONFIDENCE[prior['confidence']], 'Pure prior altered/inflated')
    comparison = read(RUN / 'comparison.json')
    require(len(comparison['cases']) == 10 and {c['neutral_id'] for c in comparison['cases']} == input_ids,
            'Comparison coverage')
    for case in comparison['cases']:
        rid = case['neutral_id']
        a, b = outputs['a'][rid]['weight']['value'], outputs['b'][rid]['weight']['value']
        require((case['lane_a'], case['lane_b'], case['main']) == (a, b, outputs['main'][rid]['weight']['value']),
                'Comparison value disagreement')
        require(case['agreement'] == (a == b) and case['both_substantive'] == (a != 'unknown' and b != 'unknown'),
                'Comparison counters')
    for group in comparison['groups']:
        members = [c for c in comparison['cases'] if c['cohort_group'] == group['group']]
        require(group['cases'] == len(members)
                and group['raw_agreement'] == sum(c['agreement'] for c in members)
                and group['both_substantive'] == sum(c['both_substantive'] for c in members)
                and group['substantive_agreement'] == sum(c['agreement'] and c['both_substantive'] for c in members),
                'Group metrics')
    report.update(mode='sealed_outputs', independent_lane_records=20, main_records=10,
                  declared_read_scope_verified=True, comparison_denominators_verified=True)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--inputs-only', action='store_true')
    args = parser.parse_args()
    print(json.dumps(verify(args.inputs_only), indent=2))
