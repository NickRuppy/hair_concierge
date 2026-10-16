"""Source/admission and closed-output checks for the oil persistence replay.

Preflight is not a classification-completion receipt. No runtime seam or DB access.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / 'data/research/oil-inci/v1.0/corpus/exploratory/persistence-replay-v0.1'
VALUES = {'low', 'moderate', 'high'}


def read(name):
    return json.loads((RUN / name).read_text())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_projection(rows, keys):
    require(isinstance(rows, list) and len(rows) == len(keys), 'projection coverage')
    require({r['product_key'] for r in rows} == set(keys), 'projection keys')
    for row in rows:
        require(set(row) == {'product_key', 'policy_version', 'persistence_potential'}, 'projection fields')
        require(row['policy_version'] == 'shared-persistence-v0.1', 'projection policy')
        require(row['persistence_potential'] in VALUES, 'projection value')


def validate_evidence(evidence, ingredients):
    names = {i['rank']: i['canonical_name'] for i in ingredients}
    require(bool(evidence), 'missing evidence')
    for e in evidence:
        require(set(e) == {'rank', 'canonical_name'} and names.get(e['rank']) == e['canonical_name'], 'evidence binding')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--preflight', action='store_true')
    args = parser.parse_args()
    source = read('source-packet-staged.json')['records']
    require(len(source) == 28 and len({r['case_id'] for r in source}) == 28, 'source case coverage')
    require(len({r['product_key'] for r in source}) == 28, 'unique product keys')
    for name, expected in read('source-bindings-staged.json').items():
        require(digest(ROOT / name) == expected, 'source dependency: ' + name)
    rank_count = 0
    for row in source:
        ref = row['source_refs']
        native = json.loads((ROOT / ref['formula_packet']).read_text())['records']
        original = next(r for r in native if r[ref['formula_key_field']] == ref['formula_key'])
        # Round-1 raw formula is in its blind packet, while identity/context are in unblind.
        raw_original = original.get('raw_inci')
        ingredients_native = json.loads((ROOT / ref['ingredient_packet']).read_text())['records']
        ingredient_original = next(r for r in ingredients_native if r['neutral_id'] == ref['ingredient_key'])
        require(row['raw_inci'] == (raw_original or ingredient_original['raw_inci']), 'raw declaration binding')
        ingredients = row['ingredients']
        require([i['rank'] for i in ingredients] == list(range(1, len(ingredients) + 1)), 'rank coverage')
        require([(i['rank'], i['canonical_name']) for i in ingredients] == [(i['rank'], i['canonical_name']) for i in ingredient_original['ingredients']], 'ingredient binding')
        context_rows = json.loads((ROOT / ref['context_packet']).read_text())['records']
        context = next(r for r in context_rows if r.get('neutral_id', r.get('case_id')) == ref['context_key'])
        captured = context.get('directions', context.get('hair_directions', context.get('directions_summary', context.get('directions_paraphrase'))))
        require(row['directions_capture'] == captured and bool(captured), 'context source binding')
        rank_count += len(ingredients)
    names = {i['canonical_name'] for r in source for i in r['ingredients']}
    entries = read('function-dictionary-staged.json')['entries']
    require(len(entries) == len(names) and {e['canonical_name'] for e in entries} == names, 'dictionary coverage')
    require(all(e['roles'] and e['notes'] and e['function_source_refs'] and all((ROOT / p).is_file() for p in e['function_source_refs']) for e in entries), 'function evidence')
    inventory = read('coverage-inventory.json')['records']
    require(len(inventory) == 64 and sum(r['disposition'] == 'included' for r in inventory) == 28, 'inventory denominator')
    require({r['case_id'] for r in inventory if r['case_id']} == {r['case_id'] for r in source}, 'inventory cohort')
    prior = read('historical-preservation.json')
    for name, expected in prior.items():
        require(digest(ROOT / name) == expected, 'historical preservation: ' + name)
    # These are schema corruption probes, not product classifications or targets.
    probe = [{'product_key': 'synthetic-contract-probe', 'policy_version': 'shared-persistence-v0.1', 'persistence_potential': 'low'}]
    validate_projection(probe, ['synthetic-contract-probe'])
    controls = []
    for label, expected, mutate in [
        ('unknown_class', 'projection value', lambda r: r[0].update(persistence_potential='unknown')),
        ('confidence_field', 'projection fields', lambda r: r[0].update(confidence='high')),
        ('dropped_case', 'projection coverage', lambda r: r.pop()),
    ]:
        changed = copy.deepcopy(probe)
        mutate(changed)
        try:
            validate_projection(changed, ['synthetic-contract-probe'])
        except ValueError as e:
            require(str(e) == expected, 'wrong corruption guard')
            controls.append(label)
        else:
            raise ValueError('escaped corruption: ' + label)
    try:
        validate_evidence([{'rank': 999, 'canonical_name': 'SYNTHETIC'}], [{'rank': 1, 'canonical_name': 'SYNTHETIC'}])
    except ValueError as e:
        require(str(e) == 'evidence binding', 'wrong evidence guard')
        controls.append('broken_evidence')
    else:
        raise ValueError('broken evidence escaped')
    receipt = {'status': 'preflight_passed', 'classification_status': 'not_dispatched_context_selection_pending', 'cases': 28, 'primary_ranks': rank_count, 'dictionary_identities': len(names), 'inventoried_prior_cases': len(inventory), 'historical_files_preserved': len(prior), 'negative_controls_rejected': controls, 'limits': 'Source/schema integrity only; selected context, frozen run inputs, lanes, decisions and completed replay verification still required.'}
    if not args.preflight:
        raise ValueError('Replay incomplete: context selection, freeze, lanes and final decision verification required; use --preflight for staging checks')
    (RUN / 'preflight-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
