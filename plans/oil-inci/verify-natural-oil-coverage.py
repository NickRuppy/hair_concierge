#!/usr/bin/env python3
"""Check reference/source/observed-declaration contracts, not sensory accuracy.

Protects missing entries, false aliases, broken provenance and historical
rewrites at the research-artifact boundary. It adds no production seam.
"""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESEARCH = ROOT / 'plans/oil-inci/research'
REFS = ROOT / 'data/research/oil-inci/v1.0/reference'
VALUES = {'light', 'medium', 'rich', 'unknown'}


def read(path):
    return json.loads(path.read_text())


def key(name):
    return ' '.join(name.upper().split())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)


def verify(ref=None):
    ref = ref if ref is not None else read(REFS / 'natural-oil-weight-v0.3.json')
    old = read(REFS / 'natural-oil-weight-v0.2.json')
    inventory = read(RESEARCH / 'natural-oil-coverage-local-inventory-2026-10-02.json')
    declarations = read(RESEARCH / 'natural-oil-coverage-observed-declarations-2026-10-02.json')
    display = read(RESEARCH / 'natural-oil-coverage-display-resolution-2026-10-02.json')
    catalog = read(RESEARCH / 'natural-oil-coverage-catalog-evidence-2026-10-02.json')
    counts = read(RESEARCH / 'natural-oil-coverage-catalog-counts-2026-10-02.json')
    require(ref['version'] == '0.3', 'Wrong revision')
    entries = ref['entries']
    ids = {e['id']: e for e in entries}
    require(len(entries) == len(ids), 'Duplicate material IDs')
    aliases = {}
    sources = ref['sources']
    for entry in entries:
        w = entry['weight_prior']
        require(w['value'] in VALUES and w['estimate'] is True, 'Invalid estimated prior')
        require(w['confidence'] in {'low', 'moderate'}, 'Confidence ceiling')
        require(entry['validated_hair_weight'] is False, 'Unsupported hair validation')
        require(w['nearest_alternative'] in w['alternatives'], 'Missing nearest alternative')
        require(len(w['alternatives']) == len(set(w['alternatives'])), 'Duplicate alternatives')
        require(all(v in VALUES and v != w['value'] for v in w['alternatives']), 'Invalid alternatives')
        require(w['reason'] and w['unresolved'] and entry['identity_limits'], 'Missing evidence limits')
        require(w['evidence_ids'] and set(w['evidence_ids']) <= set(sources), 'Broken source IDs')
        require({e['source_id'] for e in entry['evidence']} == set(w['evidence_ids']), 'Evidence/ID mismatch')
        excluded = set(entry.get('excluded_identity_source_ids', []))
        require(excluded <= set(sources) and not excluded & set(w['evidence_ids']), 'Excluded identity used positively')
        if w['value'] == 'unknown':
            require(w['confidence'] == 'low' and w['unresolved'], 'Unknown without explicit gap')
        for name in [entry['canonical_inci'], *entry['aliases']]:
            require(key(name) not in aliases, f'Duplicate alias: {name}')
            aliases[key(name)] = entry['id']
    for sid, source in sources.items():
        require(source['url'].startswith('https://') and source['title'] and source['limits'], f'Source metadata: {sid}')
    for entry in old['entries']:
        require(ids.get(entry['id']) == entry, f'Historical entry silently changed: {entry["id"]}')
    for sid, source in old['sources'].items():
        require(sources.get(sid) == source, f'Historical source changed: {sid}')
    # Independent negative identities: never inherit an intact-oil prior.
    for name in ['HYDROGENATED CASTOR OIL', 'PEG-40 HYDROGENATED CASTOR OIL',
                 'GLYCINE SOJA OIL UNSAPONIFIABLES', 'HELIANTHUS ANNUUS SEED CERA',
                 'JOJOBA ESTERS', 'CAMELLIA SINENSIS LEAF EXTRACT',
                 'BRASSICA CAMPESTRIS/ALEURITES FORDI OIL COPOLYMER',
                 'OLUS OIL', 'COCOS NUCIFERA FRUIT OIL', 'MCT OIL']:
        require(name not in aliases, f'False generic identity: {name}')
    # All researched additions must be present; grade copies are not new IDs.
    for lane in ['a', 'b']:
        ledger = read(RESEARCH / f'natural-oil-coverage-evidence-{lane}-2026-10-02.json')
        for row in ledger['materials']:
            require(key(row['exact_inci']) in aliases, f'Researched material omitted: {row["exact_inci"]}')
    main = read(RESEARCH / 'natural-oil-coverage-evidence-main-2026-10-02.json')
    for entry in main['entries']:
        require(aliases.get(entry['canonical_inci']) == entry['id'], 'Main material omitted')
    require(aliases['CANOLA OIL'] != aliases['BRASSICA NAPUS SEED OIL'], 'Canola silently species-aliased')
    require(aliases['ZEA MAYS OIL'] != aliases['ZEA MAYS GERM OIL'], 'Corn declarations merged')
    require(aliases['HIPPOPHAE RHAMNOIDES FRUIT/SEED OIL'] != aliases['HIPPOPHAE RHAMNOIDES FRUIT OIL'], 'Combined sea oil merged')
    cases = display['cases']
    require(len(cases) == len({c['case_id'] for c in cases}), 'Duplicate display case')
    display_by_name = {key(c['raw_name']): c for c in cases}
    require(len(display_by_name) == len(cases), 'Ambiguous display receipts')
    for case in cases:
        require(key(case['raw_name']) not in aliases, 'Scoped display promoted to generic alias')
        require(aliases.get(key(case['normalized_inci'])) == case['reference_entry'], 'Display target mismatch')
        for path in case['source_scope']:
            source = read(ROOT / path)
            if 'product_id' in case:
                source = [r for r in source['rows'] if r['product_id'] == case['product_id'] and r['source_url'] == case['source_url']]
                require(source, 'Display product/source scope missing')
            require(any(key(case['raw_name']) in key(s) for s in strings(source)), 'Display raw name not in bound source')
    gaps = {key(r['inci']) for r in inventory['missing_intact_fixed_oil_identities']}
    gaps |= {key(r['observed']) for r in inventory['exact_identity_or_alias_gaps_not_safe_to_auto_merge']}
    coverage = ref['coverage']
    rows = coverage['observed_omissions_and_variants']
    require(len(rows) == len({key(r['observed_name']) for r in rows}), 'Duplicate gap accounting')
    require({key(r['observed_name']) for r in rows} == gaps, 'Missing observed gap accounting')
    unresolved = {key(r['observed']) for r in ref['unresolved_declarations']}
    for row in rows:
        name = key(row['observed_name'])
        if name in aliases:
            require(row['reference_entry'] == aliases[name], 'Observed reference mismatch')
            require(row['weight'] == ids[aliases[name]]['weight_prior']['value'], 'Observed prior mismatch')
        else:
            require(name in unresolved and row['disposition'] == 'identity_review_required', 'Unmatched gap hidden')
    literal_results = Counter()
    for row in declarations['observed_name_rows']:
        source_paths = {p.rsplit(':', 1)[0] for p in row['evidence']}
        for literal in {key(n) for n in row['literal_forms']}:
            if literal in aliases:
                literal_results['generic_exact_match'] += 1
            elif literal in display_by_name:
                require(set(display_by_name[literal]['source_scope']) & source_paths, 'Unbound display normalization')
                literal_results['source_scoped_display_resolution'] += 1
            else:
                require(literal in unresolved, f'Unaccounted raw declaration: {literal}')
                literal_results['identity_review_required'] += 1
    require(len(catalog['rows']) == coverage['catalog_evidence_rows'], 'Catalog row count drift')
    require(len({r['product_id'] for r in catalog['rows']}) == coverage['catalog_evidence_products'], 'Catalog evidence-product count drift')
    require(sum(r['catalog_products'] for r in counts['rows']) == coverage['catalog_total_products'], 'Catalog total mismatch')
    weights = Counter(e['weight_prior']['value'] for e in entries)
    return {'status': 'passed', 'verification_scope': 'identity/provenance/accounting invariants; no sensory accuracy claim',
            'material_entries': len(entries), 'fixed_botanical_oils': sum(e['material_family'] == 'intact_fixed_botanical_oil' for e in entries),
            'source_records': len(sources), 'exact_names_and_aliases': len(aliases), 'weight_counts': dict(weights),
            'old_entries_unchanged': len(old['entries']), 'observed_gap_groups': len(gaps),
            'matched_gap_groups': sum(key(r['observed_name']) in aliases for r in rows),
            'literal_declaration_results': dict(literal_results), 'source_scoped_display_cases': len(cases),
            'catalog_evidence_products': coverage['catalog_evidence_products'], 'catalog_total_products': coverage['catalog_total_products']}


if __name__ == '__main__':
    print(json.dumps(verify(), indent=2))
