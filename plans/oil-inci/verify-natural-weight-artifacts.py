#!/usr/bin/env python3
"""Validate the research artifact contract, not scientific class accuracy.

This owns alias/source/record completeness and immutable-input checks. A
misbound derivative, missing case, invalid estimate or changed sealed input
must fail independently of the classifications chosen by either lane.
No production seam, network call or classification algorithm is involved.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / 'data/research/oil-inci/v1.0/corpus/exploratory/natural-base-round-2'
REFERENCE = ROOT / 'data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.2.json'
VALUES = {'light', 'medium', 'rich', 'unknown'}
CONFIDENCE = {'low': 0, 'moderate': 1}


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
    require(ref == read(RUN / 'material-reference.json'), 'Current reference diverged from sealed revision')
    entries = ref['entries']
    ids = [e['id'] for e in entries]
    require(len(ids) == len(set(ids)) == 25, 'Reference entry IDs/count')
    aliases = {}
    for entry in entries:
        require(entry['validated_hair_weight'] is False, 'Unsupported hair validation')
        w = entry['weight_prior']
        require(w['value'] in VALUES and w['estimate'] is True, f"Prior contract: {entry['id']}")
        require(w['confidence'] in CONFIDENCE, f"Confidence: {entry['id']}")
        require(w['nearest_alternative'] in w['alternatives'], 'Nearest alternative missing')
        require(len(w['alternatives']) == len(set(w['alternatives'])), 'Duplicate alternatives')
        require(all(a in VALUES and a != w['value'] for a in w['alternatives']), 'Invalid alternatives')
        require(w['reason'] and w['unresolved'] and w['evidence_ids'], 'Missing prior evidence/limits')
        require(set(w['evidence_ids']) <= set(ref['sources']), 'Broken source reference')
        require({e['source_id'] for e in entry['evidence']} == set(w['evidence_ids']), 'Evidence IDs differ')
        for name in [entry['canonical_inci'], *entry['aliases']]:
            normalized = key(name)
            require(normalized not in aliases, f'Duplicate alias: {name}')
            aliases[normalized] = entry['id']
    # Independent form boundaries; substring matching must never be implied.
    for name in ['PEG-40 HYDROGENATED CASTOR OIL', 'HYDROGENATED CASTOR OIL',
                 'COCO-CAPRYLATE/CAPRATE', 'COCONUT ALKANES', 'JOJOBA ESTERS',
                 'CAMELLIA SINENSIS LEAF EXTRACT', 'HIPPOPHAE RHAMNOIDES SEED OIL',
                 'COCOS NUCIFERA FRUIT OIL', 'MCT OIL', 'TRIHEPTANOIN']:
        require(name not in aliases, f'Invalid inherited identity: {name}')
    old = read(ROOT / 'data/research/oil-inci/v1.0/corpus/exploratory/round-1/ingredient-lexicon.json')
    old_oils = {e['canonical_name'] for e in old['entries'] if 'intact_botanical_fixed_oil' in e['roles']}
    require(len(old_oils) == 15, 'Unexpected source lexicon fixed-oil coverage')
    require(old_oils <= set(aliases), f'Prior fixed-oil coverage gaps: {old_oils-set(aliases)}')
    manifest = read(RUN / 'input-manifest.json')
    for filename, expected in manifest['files'].items():
        require(digest(RUN / filename) == expected, f'Sealed input changed: {filename}')
    historical = read(RUN / 'historical-round1-baseline.json')
    for filename, expected in historical.items():
        require(digest(ROOT / filename) == expected, f'Round-1 artifact changed: {filename}')
    packet = read(RUN / 'blind-packet.json')['records']
    input_ids = {r['neutral_id'] for r in packet}
    require(len(packet) == len(input_ids) == 14, 'Duplicate/missing input IDs')
    require(sum(r['input_kind'] == 'cosmetic_material_benchmark' for r in packet) == 8, 'Material count')
    require(sum(r['input_kind'] == 'hypothetical_formula_probe' for r in packet) == 6, 'Probe count')
    identity = read(RUN / 'identity-map.json')['records']
    require(len(identity) == len({r['neutral_id'] for r in identity}) == 8, 'Identity coverage')
    for p in packet:
        require([i['rank'] for i in p['ingredients']] == list(range(1, len(p['ingredients'])+1)), 'Ingredient ranks')
        if p['input_kind'] == 'cosmetic_material_benchmark':
            require(len(p['ingredients']) == 1 and p['ingredients'][0]['canonical_name'] in aliases, 'Material identity')
    summary = {'status': 'passed', 'scope': 'artifact invariants; no scientific accuracy assertion',
               'reference_materials': len(entries), 'source_records': len(ref['sources']),
               'reviewed_aliases': len(aliases), 'old_fixed_oil_identities': len(old_oils),
               'historical_files_unchanged': len(historical), 'sealed_input_files': len(manifest['files']),
               'material_cases': 8, 'synthetic_probes': 6}
    if inputs_only:
        summary['mode'] = 'inputs_only'
        return summary
    seal = read(RUN / 'output-seal.json')
    for filename, expected in seal['files'].items():
        require(digest(RUN / filename) == expected, f'Sealed output changed: {filename}')
    for lane in ['a', 'b']:
        output = read(RUN / f'lane-{lane}/records.json')
        require(output['run_id'] == manifest['run_id'] and output['method_revision'] == 'weight-v0.2', 'Run provenance')
        require(output['lane_id'] == lane, 'Lane identity')
        records = output['records']
        require(len(records) == len({r['neutral_id'] for r in records}) == 14, 'Output record count')
        require({r['neutral_id'] for r in records} == input_ids, 'Output ID coverage')
        permitted = set(manifest['blind_input_files'])
        require({Path(n).name for n in output['files_read']} == permitted, 'Classifier read scope')
        for record in records:
            w = record['weight']
            require(w['value'] in VALUES and w['estimate'] is True, 'Output weight contract')
            require(w['confidence'] in CONFIDENCE, 'Output confidence')
            require(w['nearest_alternative'] in VALUES and (w['value'] == 'unknown' or w['nearest_alternative'] != w['value']), 'Output alternative')
            require(w['reason'] and isinstance(w['unresolved'], list), 'Output reasoning/gaps')
            require(isinstance(w['evidence'], list) and isinstance(w['counter_signal'], list), 'Output evidence shape')
            require(record['completion_status'] in {'weight_only_complete', 'weight_only_blocked'}, 'Scope/completion')
            require({m['reference_id'] for m in record['material_matches']} <= set(ids), 'Output material IDs')
            submitted = next(p for p in packet if p['neutral_id'] == record['neutral_id'])
            names_at_rank = {i['rank']: i['canonical_name'] for i in submitted['ingredients']}
            require(record['input_kind'] == submitted['input_kind'], 'Changed input kind')
            roles = record['ingredient_roles']
            require(len(roles) == len(names_at_rank) and {i['rank']: i['canonical_name'] for i in roles} == names_at_rank, 'Output ingredient coverage')
            expected_matches = {(rank, aliases[key(name)]) for rank, name in names_at_rank.items() if key(name) in aliases}
            actual_matches = {(m['rank'], m['reference_id']) for m in record['material_matches']}
            require(actual_matches == expected_matches and len(actual_matches) == len(record['material_matches']), 'Output material coverage')
            for match in record['material_matches']:
                require(aliases.get(key(names_at_rank[match['rank']])) == match['reference_id'], 'False material match')
            if submitted['input_kind'] == 'cosmetic_material_benchmark':
                material_id = aliases[key(submitted['ingredients'][0]['canonical_name'])]
                prior = next(e['weight_prior'] for e in entries if e['id'] == material_id)
                require(CONFIDENCE[w['confidence']] <= CONFIDENCE[prior['confidence']], 'Pure-material confidence inflation')
            if w['value'] == 'unknown':
                require(w['confidence'] == 'low' and w['unresolved'], 'Unknown without gap')
    summary['mode'] = 'inputs_and_sealed_lanes'
    summary['lane_records_verified'] = 28
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--inputs-only', action='store_true')
    args = parser.parse_args()
    print(json.dumps(verify(args.inputs_only), indent=2))
