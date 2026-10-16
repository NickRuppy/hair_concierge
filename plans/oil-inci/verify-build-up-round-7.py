#!/usr/bin/env python3
"""Verify frozen declarations, blind provenance and result integrity, not hair efficacy."""
import argparse
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REL = Path('data/research/oil-inci/v1.0/corpus/exploratory/build-up-round-7')
IDS = {'N01', 'N02', 'N03', 'N04'}
INPUTS = {'source-packet.json', 'normalization-audit.json', 'function-evidence.json', 'method.md', 'blind-packet.json', 'blind-lexicon.json'}
SCOPE = {'method.md', 'blind-packet.json', 'blind-lexicon.json'}
LANEFILES = {f'lane-{lane}/{name}.json' for lane in ('a', 'b') for name in ('judgments', 'access-log')}
PROPERTY = {'value', 'estimate', 'confidence', 'evidence', 'counter_signal', 'nearest_alternative', 'reason', 'unresolved'}


def read(p):
    return json.loads(p.read_text())


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def need(ok, message):
    if not ok:
        raise ValueError(message)


def keyed(rows):
    need(len(rows) == len(IDS) and {r['neutral_id'] for r in rows} == IDS, 'Duplicate/missing case')
    return {r['neutral_id']: r for r in rows}


def validate_property(prop, ingredients):
    need(set(prop) == PROPERTY, 'Property fields')
    need(prop['value'] in {'low', 'elevated', 'unknown'}, 'Build-up enum')
    need(prop['confidence'] == 'low', 'Confidence ceiling')
    need(type(prop['estimate']) is bool and prop['estimate'] == (prop['value'] != 'unknown'), 'Estimate metadata')
    need(prop['nearest_alternative'] in {'low', 'elevated', 'unknown'} and prop['nearest_alternative'] != prop['value'], 'Alternative')
    need(bool(prop['reason']) and bool(prop['unresolved']), 'Reason/gaps')
    need(isinstance(prop['counter_signal'], list) and isinstance(prop['evidence'], list) and prop['evidence'], 'Counter/evidence fields')
    allowed = {(x['rank'], x['canonical_name']) for x in ingredients}
    need(all(set(e) == {'rank', 'canonical_name'} and (e['rank'], e['canonical_name']) in allowed for e in prop['evidence']), 'Evidence rank/name parity')


def verify(inputs_only=False):
    run = ROOT / REL
    manifest = read(run / 'input-manifest.json')
    need(set(manifest['files']) == INPUTS, 'Input manifest file set')
    need(manifest['historical_snapshot_sha256'] == sha(run / 'historical-preservation.json'), 'Historical snapshot binding')
    for name, h in manifest['files'].items():
        need(sha(run / name) == h, 'Input hash: ' + name)
    deps = {'docs/research/oil-inci/v1.0/08_build-up-guidance-v0.1.md', 'docs/research/oil-inci/v1.0/00_category_charter.md'}
    need(set(manifest['dependencies']) == deps, 'Dependency set')
    for name, h in manifest['dependencies'].items():
        need(sha(ROOT / name) == h, 'Dependency hash: ' + name)
    need((run / 'method.md').read_bytes() == (ROOT / 'docs/research/oil-inci/v1.0/08_build-up-guidance-v0.1.md').read_bytes(), 'Guide/method parity')
    history = read(run / 'historical-preservation.json')['files']
    need(len(history) == 324, 'Historical snapshot membership count')
    for name, h in history.items():
        need(sha(ROOT / name) == h, 'Historical preservation: ' + name)
    source = keyed(read(run / 'source-packet.json')['records'])
    packet = keyed(read(run / 'blind-packet.json')['records'])
    dictionary_rows = read(run / 'blind-lexicon.json')['entries']
    dictionary = {e['canonical_name']: e for e in dictionary_rows}
    need(len(dictionary) == len(dictionary_rows), 'Duplicate dictionary name')
    frows = read(run / 'function-evidence.json')['entries']
    frefs = {e['source_id']: e for e in frows}
    need(len(frefs) == len(frows), 'Duplicate function source')
    audit = read(run / 'normalization-audit.json')['records']
    expected_audit = []
    ranks = 0
    for nid in sorted(IDS):
        s, b = source[nid], packet[nid]
        need(set(b) == {'neutral_id', 'eligible', 'raw_inci', 'primary_inci', 'ingredients', 'contextual_declarations'}, 'Blind packet fields')
        need(b['eligible'] is True, 'All four must be in scope')
        for field in ('raw_inci', 'primary_inci', 'ingredients', 'contextual_declarations'):
            need(b[field] == s[field], 'Source/blind parity: ' + field)
        primary = s['primary_inci'].rstrip('.').split(', ')
        need(len(primary) == len(b['ingredients']), 'Primary rank count')
        need(b['raw_inci'].startswith(b['primary_inci']), 'Raw primary binding')
        suffix = b['raw_inci'][len(b['primary_inci']):]
        contextual = b['contextual_declarations']
        need(suffix == (contextual[0].get('separator', '; ' if nid == 'N01' else ' ') + contextual[0]['raw'] if contextual else ''), 'Raw contextual binding')
        for rank, (raw, ingredient) in enumerate(zip(primary, b['ingredients']), 1):
            canonical = ' '.join(raw.rstrip('*').upper().split())
            need(ingredient == {'rank': rank, 'raw_name': raw, 'canonical_name': canonical}, 'Literal rank normalization')
            need(canonical in dictionary, 'Missing reviewed dictionary row')
            expected_audit.append((nid, rank, raw, canonical))
        ranks += len(primary)
    need([(a['neutral_id'], a['rank'], a['raw_name'], a['canonical_name']) for a in audit] == expected_audit, 'Normalization audit parity')
    need(set(dictionary) == {i['canonical_name'] for p in packet.values() for i in p['ingredients']}, 'Closed lexicon names')
    for e in dictionary.values():
        need(e['roles'] and e['notes'] and e['source_refs'], 'Role documentation')
        for ref in e['source_refs']:
            need(ref in frefs and frefs[ref]['canonical_name'] == e['canonical_name'] and frefs[ref]['urls'], 'Function provenance parity')
    if inputs_only:
        return {'status': 'passed', 'stage': 'inputs', 'cases': 4, 'primary_ranks': ranks, 'preserved_files': len(history)}
    seal = read(run / 'blind-stage-seal.json')
    need(set(seal['files']) == LANEFILES | INPUTS | {'input-manifest.json', 'historical-preservation.json'}, 'Blind seal file set')
    need(seal['stage'] == 'blind_outputs_before_unblind', 'Seal stage')
    for name, h in seal['files'].items():
        need(sha(run / name) == h, 'Blind seal hash: ' + name)
    lanes = {}
    for lane in ('a', 'b'):
        output = read(run / f'lane-{lane}/judgments.json')
        need(output['lane'] == lane, 'Lane identity')
        rows = keyed(output['records']); lanes[lane] = rows
        log = read(run / f'lane-{lane}/access-log.json')
        need(log['lane'] == lane and set(log['read_files']) == SCOPE and len(log['read_files']) == 3, 'Lane read scope')
        need(bool(log['independence_attestation']) and isinstance(log['recognition'], list) and isinstance(log['incidents'], list), 'Lane independence metadata')
        for nid, row in rows.items():
            fields = {'neutral_id', 'ingredient_ledger', 'architecture', 'build_up_potential', 'issues'}
            need(set(row) in (fields, fields | {'contextual_declarations'}), 'Lane record fields')
            if 'contextual_declarations' in row:
                need(row['contextual_declarations'] == packet[nid]['contextual_declarations'], 'Copied contextual parity')
            want = [{'rank': i['rank'], 'canonical_name': i['canonical_name'], 'roles': dictionary[i['canonical_name']]['roles']} for i in packet[nid]['ingredients']]
            need(row['ingredient_ledger'] == want, 'Full ledger role/rank parity')
            validate_property(row['build_up_potential'], packet[nid]['ingredients'])
            need(row['architecture'] and isinstance(row['issues'], list), 'Architecture/issues')
    working = keyed(read(run / 'working-records.json')['records'])
    for nid, row in working.items():
        validate_property(row['build_up_potential'], packet[nid]['ingredients'])
        need(row['identity'] == source[nid]['identity'] and row['source_url'] == source[nid]['source_url'] and row['raw_inci'] == source[nid]['raw_inci'], 'Working source binding')
        need(row['lane_values'] == {l: lanes[l][nid]['build_up_potential']['value'] for l in lanes}, 'Working lane binding')
        need(row['build_up_potential'] == lanes[row['working_property_from_lane']][nid]['build_up_potential'], 'Working selected property integrity')
        need(row['directions_summary'] == source[nid]['directions_summary'], 'Working source directions')
    want_metrics = {'in_scope_cases': 4, 'excluded_cases': 0, 'lane_agreement': sum(lanes['a'][n]['build_up_potential']['value'] == lanes['b'][n]['build_up_potential']['value'] for n in IDS), 'known_in_both': sum(all(lanes[l][n]['build_up_potential']['value'] != 'unknown' for l in lanes) for n in IDS), 'known_by_lane': {l: sum(r['build_up_potential']['value'] != 'unknown' for r in lanes[l].values()) for l in lanes}, 'working_known': sum(r['build_up_potential']['value'] != 'unknown' for r in working.values())}
    need(read(run / 'metrics.json') == want_metrics, 'Metric denominator/value parity')
    with (run / 'results.csv').open(newline='') as file:
        sheet = list(csv.DictReader(file))
    need(len(sheet) == 4 and {r['neutral_id'] for r in sheet} == IDS, 'CSV IDs')
    for r in sheet:
        w = working[r['neutral_id']]; p = w['build_up_potential']
        need(r == {'neutral_id': w['neutral_id'], 'brand': w['identity']['brand'], 'product': w['identity']['product'], 'build_up': p['value'], 'estimate': str(p['estimate']).lower(), 'confidence': p['confidence'], 'lane_a': w['lane_values']['a'], 'lane_b': w['lane_values']['b'], 'source_url': w['source_url']}, 'CSV/working parity')
    return {'status': 'passed', 'stage': 'complete', 'primary_ranks': ranks, 'closed_ingredients': len(dictionary), 'preserved_files': len(history), 'metrics': want_metrics, 'limits': 'Structural provenance and repeatability only; not sensory/wash-cycle validation.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--inputs-only', action='store_true')
    args = parser.parse_args()
    print(json.dumps(verify(args.inputs_only), indent=2))
