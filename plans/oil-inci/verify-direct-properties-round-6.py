#!/usr/bin/env python3
"""Structural verifier for the sealed direct-properties round-six artifacts.

This deliberately checks provenance, schema and gate consequences, rather than
selecting a formula classification.  It has no network or catalogue dependency.
"""
import argparse
import copy
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN_REL = Path("data/research/oil-inci/v1.0/corpus/exploratory/direct-properties-round-6")
IDS = {f"D{i:02d}" for i in range(1, 7)}
LANES = ("a", "b")
FLAGS = {"silicones", "mineral_oil", "drying_alcohol", "fragrance", "scalp_active_botanicals"}
PROPERTY_KEYS = {"value", "estimate", "confidence", "evidence", "counter_signal", "nearest_alternative", "reason", "unresolved"}
BASE = {"pure_plant_oil", "plant_oil_blend", "silicone_led", "ester_alkane_led", "hybrid", "water_based", "unknown"}
PENETRATION = {"penetration_potential", "surface_led", "unknown"}
BUILD_UP = {"low", "elevated", "unknown"}
PROMINENCE = {"leading", "supporting", "trace", "absent", "unknown"}
DISPENSER = {"dropper", "pump", "spray", "pour", "metered_drop", "other", "unknown"}
USES = {"pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish", "scalp_application"}
FIT = {"thickness": {"fine", "normal", "coarse"}, "texture": {"straight", "wavy", "curly", "coily"}, "damage": {"healthy", "moderately_damaged", "highly_damaged"}}
BLIND_FIELDS = {"neutral_id", "raw_inci", "ingredient_ledger", "auxiliary_suffix", "base", "penetration_potential", "build_up_potential", "ingredient_flags", "completion_status", "issues"}
STAGE1_FILES = {"method.md", "blind-packet.json", "blind-lexicon.json"}
STAGE2_FILES = STAGE1_FILES | {"unblinded-packet-v0.1.1.json", "blind-stage-seal.json"}


def read(path):
    return json.loads(Path(path).read_text())


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def norm(value):
    return " ".join(value.upper().split())


def safe_file(root, name):
    path = root / name
    require(not Path(name).is_absolute() and ".." not in Path(name).parts and path.is_file(), f"Missing/unsafe file: {name}")
    return path


def scoped_read_name(run, name):
    path = Path(name)
    candidate = path if path.is_absolute() else run / path
    try:
        relative = candidate.resolve().relative_to(run.resolve())
    except ValueError:
        raise ValueError("Read path outside run")
    require(len(relative.parts) == 1, "Read path outside stage scope")
    return str(relative)


def records_by_id(doc, label):
    records = doc.get("records")
    require(isinstance(records, list) and len(records) == 6, f"{label} record count")
    ids = [row.get("neutral_id") for row in records]
    require(set(ids) == IDS and len(ids) == len(set(ids)), f"{label} duplicate/missing ID")
    return {row["neutral_id"]: row for row in records}


def property_object(value, allowed, label, *, factual=False, substantive=False):
    require(isinstance(value, dict) and set(value) == PROPERTY_KEYS, f"{label} property keys")
    require(value["value"] in allowed and (allowed != {True, False} or type(value["value"]) is bool), f"{label} value")
    require(isinstance(value["estimate"], bool) and value["confidence"] in {"high", "moderate", "low"}, f"{label} estimate/confidence")
    require(all(isinstance(value[k], list) for k in ("evidence", "counter_signal", "unresolved")), f"{label} evidence lists")
    require(isinstance(value["reason"], str) and value["reason"], f"{label} reason")
    require(value["nearest_alternative"] is None or value["nearest_alternative"] in allowed - {value["value"]}, f"{label} alternative")
    if value["value"] == "unknown":
        require(not value["estimate"] and value["confidence"] == "low" and value["unresolved"], f"{label} unknown gap")
    if factual:
        require(not value["estimate"], f"{label} factual estimate")
    if substantive and value["value"] != "unknown":
        require(value["estimate"] and value["confidence"] in {"moderate", "low"}, f"{label} estimated confidence")


def packet_rows(packet):
    return records_by_id(packet, "blind packet")


def dictionary_index(lexicon):
    entries = lexicon.get("entries", [])
    result = {}
    for entry in entries:
        canonical = entry.get("canonical_name")
        require(isinstance(canonical, str) and canonical, "Dictionary canonical name")
        for name in [canonical, *entry.get("aliases", [])]:
            key = norm(name)
            require(key not in result, f"Dictionary duplicate alias: {name}")
            result[key] = entry
    return result


def role_set(entry):
    return set(entry.get("roles", [])) | set(entry.get("flags", []))


def expected_flag_matches(ingredients, dictionary, flag):
    return {(item["rank"], item["canonical_name"]) for item in ingredients
            if flag in role_set(dictionary[norm(item["canonical_name"])])}


def evidence_rank_names(prop):
    result = set()
    for item in prop["evidence"]:
        if isinstance(item, dict) and "rank" in item and "canonical_name" in item:
            result.add((item["rank"], item["canonical_name"]))
    return result


def evidence_parity(prop, ledger):
    admitted = {(row["rank"], row["canonical_name"]) for row in ledger}
    for item in prop["evidence"]:
        if isinstance(item, dict) and ("rank" in item or "canonical_name" in item):
            require((item.get("rank"), item.get("canonical_name")) in admitted, "Formula evidence rank/name parity")


def auxiliary_families(roles):
    families = set()
    for role in roles:
        if "cooling" in role: families.add("cooling")
        elif "fragrance" in role or role == "aromatic_auxiliary": families.add("fragrance")
        elif "antioxidant" in role: families.add("antioxidant")
        elif "preservative" in role: families.add("preservative")
        elif "chelat" in role: families.add("chelator")
        elif "ph_adjust" in role: families.add("ph_adjustment")
    return families


def expected_direction_roles(direction):
    # Existing approved direction semantics on this finite source vocabulary.
    site = set(direction["site"]); roles = set()
    fibre = bool(site & {"hair", "lengths", "mid_lengths", "ends"})
    if "scalp" in site: roles.add("scalp_application")
    if fibre and direction["removal"] == "shampoo": roles.add("pre_wash_fibre_treatment")
    if fibre and direction["removal"] == "leave_on":
        stage = direction["stage"]
        if stage == "dry_finish": roles.add("dry_finish")
        elif stage in {"damp_or_dry", "clean_wet_or_dry"}: roles.update({"leave_on_fibre_conditioning", "dry_finish"})
        elif stage in {"after_wash", "unspecified"}: roles.add("leave_on_fibre_conditioning")
        else: raise ValueError("Unreviewed retained direction stage")
    return roles


def validate_ledger(record, packet, dictionary):
    ingredients = packet["ingredients"]
    require(record["raw_inci"] == packet["raw_inci"], "Raw INCI changed")
    ledger = record["ingredient_ledger"]
    require(isinstance(ledger, list) and len(ledger) == len(ingredients), "Ingredient ledger count")
    for row, source in zip(ledger, ingredients):
        require(set(row) == {"rank", "raw_name", "canonical_name", "dictionary_roles", "formula_role", "role_reason", "ambiguity"}, "Ledger keys")
        require(row["rank"] == source["rank"] and row["raw_name"] == source["raw_name"] and row["canonical_name"] == source["canonical_name"], "Ledger raw/rank parity")
        entry = dictionary[norm(source["canonical_name"])]
        require(row["dictionary_roles"] == entry.get("roles", []), "Ledger dictionary-role parity")
        require(row["formula_role"] in {"principal", "secondary", "auxiliary", "unresolved"} and bool(row["role_reason"]), "Ledger formula role")
        if "not_assessed" in entry.get("roles", []):
            require(row["formula_role"] == "unresolved" and isinstance(row["ambiguity"], list) and row["ambiguity"], "Unassessed dictionary material missing gap")
    suffix = record["auxiliary_suffix"]
    require(set(suffix) == {"start_rank", "markers", "reason"} and (suffix["start_rank"] is None or isinstance(suffix["start_rank"], int)), "Auxiliary suffix")
    if suffix["start_rank"] is not None:
        start = suffix["start_rank"]; markers = suffix["markers"]
        require(type(start) is int and 1 <= start <= len(ledger), "Auxiliary suffix range")
        require(isinstance(markers, list) and len(markers) >= 2, "Auxiliary suffix markers")
        require(all(set(marker) == {"rank", "function"} and type(marker["rank"]) is int and start <= marker["rank"] <= len(ledger) and marker["function"] for marker in markers), "Auxiliary suffix marker shape")
        require(len({marker["rank"] for marker in markers}) == len(markers), "Auxiliary suffix distinct ingredients")
        functions = []
        for marker in markers:
            declared = auxiliary_families([marker["function"]])
            admitted = auxiliary_families(ledger[marker["rank"] - 1]["dictionary_roles"])
            require(len(declared) == 1 and declared <= admitted, "Auxiliary suffix function evidence")
            functions.extend(declared)
        require(len(set(functions)) >= 2, "Auxiliary suffix independent functions")
        require(any(row["formula_role"] in {"principal", "secondary"} for row in ledger[:start-1]), "Auxiliary suffix prior carrier")
        for row in ledger[start-1:]:
            roles = set(row["dictionary_roles"])
            require(row["formula_role"] != "unresolved" and ("intact_botanical_fixed_oil" in roles or (bool(auxiliary_families(roles)) and not roles & {"not_assessed", "botanical_preparation_unspecified"})), "Auxiliary suffix competing/unresolved material")
    else:
        require(suffix["markers"] == [], "Unestablished suffix markers")


def validate_blind(record, packet, dictionary):
    require(set(record) == BLIND_FIELDS, "Blind record closed fields")
    validate_ledger(record, packet, dictionary)
    property_object(record["base"], BASE, "base", substantive=True)
    property_object(record["penetration_potential"], PENETRATION, "penetration", substantive=True)
    property_object(record["build_up_potential"], BUILD_UP, "build-up", substantive=True)
    for field in ("base", "penetration_potential", "build_up_potential"):
        evidence_parity(record[field], record["ingredient_ledger"])
    flags = record["ingredient_flags"]
    require(set(flags) == FLAGS, "Flag keys")
    for flag, prop in flags.items():
        property_object(prop, {True, False}, f"flag {flag}", factual=True)
        matches = expected_flag_matches(packet["ingredients"], dictionary, flag)
        require(all(isinstance(item, dict) and set(item) == {"rank", "canonical_name"} for item in prop["evidence"]), f"Flag evidence shape: {flag}")
        require((prop["value"] is True) == bool(matches), f"Flag dictionary parity: {flag}")
        if matches:
            require(evidence_rank_names(prop) == matches, f"Flag evidence parity: {flag}")
        else:
            require(not evidence_rank_names(prop), f"Flag invented rank evidence: {flag}")


def accepted_claim(claim):
    return isinstance(claim, dict) and claim.get("accepted") is True and claim.get("review_complete") is True and bool(claim.get("source_id")) and isinstance(claim.get("excerpt"), str) and bool(claim["excerpt"])


def uv_gate(filter_present, claim):
    return bool(filter_present and accepted_claim(claim))


def source_index(packet):
    rows = records_by_id(packet, "unblinded packet")
    result = {}
    for ident, row in rows.items():
        sources = {item["id"]: item for item in row.get("sources", [])}
        directions = {item.get("direction_id", item.get("id")): item for item in row.get("directions", [])}
        require(len(sources) == len(row.get("sources", [])) and None not in sources, "Duplicate/missing source ID")
        require(len(directions) == len(row.get("directions", [])) and None not in directions, "Duplicate/missing direction ID")
        hero_rows = row.get("heroes", row.get("advertised_oils", []))
        reviewed = row.get("advertised_oils_reviewed", row.get("positioning_review_complete"))
        require(reviewed is True, "Hero review incomplete")
        heroes = {item["hero_id"]: item for item in hero_rows}
        require(len(heroes) == len(hero_rows), "Duplicate hero ID")
        result[ident] = {"sources": sources, "directions": directions, "heroes": heroes, "claims": row.get("claims", {}), "packaging": row.get("packaging", {})}
    return result


def validate_source_packet(packet, blind_packet, dictionary):
    rows = records_by_id(packet, "source packet")
    for ident, row in rows.items():
        require(row.get("raw_inci") == blind_packet[ident]["raw_inci"], "Source/blind raw INCI parity")
        sources = {source.get("id") for source in row.get("sources", [])}
        require(None not in sources and len(sources) == len(row.get("sources", [])), "Source packet source IDs")
        for name, claim in row.get("claims", {}).items():
            require(name in {"heat", "uv"} and isinstance(claim, dict) and claim.get("review_complete") is True and claim.get("source_id") in sources, "Claim review/source")
            require(claim.get("accepted") in {True, False} and type(claim["accepted"]) is bool, "Claim boolean")
            require(claim.get("accepted") is False or isinstance(claim.get("excerpt"), str) and claim["excerpt"].strip(), "Positive claim excerpt")
            require(claim.get("excerpt") != "review_required", "Claim placeholder")
    d05 = blind_packet["D05"]
    require(any(dictionary[norm(item["canonical_name"])].get("uv_filter") is True for item in d05["ingredients"]), "D05 UV filter recognition")


def source_refs(value):
    refs = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "source_id" and isinstance(item, str): refs.add(item)
            elif key in {"source_ids", "review_scope", "accepted_source_ids"} and isinstance(item, list): refs.update(x for x in item if isinstance(x, str))
            else: refs |= source_refs(item)
    elif isinstance(value, list):
        for item in value: refs |= source_refs(item)
    return refs


def validate_fit(fit):
    require(set(fit) == set(FIT), "Fit axes")
    for axis, cells in FIT.items():
        require(set(fit[axis]) == cells, f"Fit {axis} cells")
        for cell in cells:
            require(fit[axis][cell] == {"value": "unknown", "reason": "policy_not_defined"}, "Fit policy gap")


def validate_final(final, blind, source, dictionary):
    require(set(final) == BLIND_FIELDS | {"named_oils", "dispenser", "provides_heat_protection", "provides_uv_protection", "supported_uses", "use_evidence", "application_scenarios", "fit", "reviewed_inputs"}, "Final record closed fields")
    require({key: final[key] for key in BLIND_FIELDS} == blind, "Changed blind fields")
    property_object(final["dispenser"], DISPENSER, "dispenser", factual=True)
    require(final["dispenser"]["value"] == source["packaging"]["value"], "Dispenser observation parity")
    for name in ("provides_heat_protection", "provides_uv_protection"):
        property_object(final[name], {True, False}, name, factual=True)
    require(final["provides_heat_protection"]["value"] is accepted_claim(source["claims"].get("heat")), "Heat gate")
    filter_present = any(dictionary[norm(row["canonical_name"])].get("uv_filter") is True for row in blind["ingredient_ledger"])
    expected_uv = uv_gate(filter_present, source["claims"].get("uv"))
    require(final["provides_uv_protection"]["value"] is expected_uv, "UV conjunction gate")
    if expected_uv:
        require(source["claims"]["uv"]["source_id"] in source_refs(final["provides_uv_protection"]), "UV accepted claim evidence")
        filters = {(row["rank"], row["canonical_name"]) for row in blind["ingredient_ledger"] if dictionary[norm(row["canonical_name"])].get("uv_filter") is True}
        require(filters <= evidence_rank_names(final["provides_uv_protection"]), "UV exact filter evidence")
    uses = final["supported_uses"]
    require(isinstance(uses, list) and len(uses) == len(set(uses)) and set(uses) <= USES, "Supported uses")
    use_evidence = final["use_evidence"]
    require(set(use_evidence) == PROPERTY_KEYS and isinstance(use_evidence["value"], list)
            and set(use_evidence["value"]) <= USES and len(use_evidence["value"]) == len(set(use_evidence["value"]))
            and use_evidence["estimate"] is False and use_evidence["confidence"] in {"high", "moderate", "low"}
            and isinstance(use_evidence["evidence"], list) and isinstance(use_evidence["counter_signal"], list)
            and isinstance(use_evidence["unresolved"], list) and bool(use_evidence["reason"]), "Use evidence schema")
    require(final["use_evidence"]["value"] == uses, "Use evidence/value parity")
    named = final["named_oils"]
    require(isinstance(named, list) and len({item.get("hero_id") for item in named}) == len(named), "Named-oil duplicate ID")
    require({item["hero_id"] for item in named} == set(source["heroes"]), "Named-oil coverage")
    for item in named:
        require(set(item) == {"hero_id", "hero_name", "matched_ranks", "prominence"}, "Named oil keys")
        hero = source["heroes"][item["hero_id"]]
        require(item["hero_name"] == hero.get("hero_name", hero.get("name")) and isinstance(item["matched_ranks"], list), "Named oil identity")
        property_object(item["prominence"], PROMINENCE, "Prominence", substantive=item["prominence"].get("value") not in {"absent", "unknown"})
        if item["prominence"]["value"] == "absent":
            require(item["prominence"]["estimate"] is False, "Absent prominence factual")
        canonical = hero.get("canonical_ingredients", [hero.get("canonical_ingredient")])
        expected = [x["rank"] for x in blind["ingredient_ledger"] if x["canonical_name"] in canonical]
        require(item["matched_ranks"] == expected, "Named-oil rank parity")
        if item["prominence"]["value"] == "absent": require(not expected, "Absent named oil has match")
        roles = {row["formula_role"] for row in blind["ingredient_ledger"] if row["rank"] in expected}
        suffix_start = blind["auxiliary_suffix"]["start_rank"]
        prominence = "unknown" if hero.get("identity_unresolved") else "absent" if not expected else "unknown"
        if roles == {"principal"}: prominence = "leading"
        elif roles == {"secondary"}: prominence = "supporting"
        elif roles == {"auxiliary"} and suffix_start is not None and all(rank >= suffix_start for rank in expected): prominence = "trace"
        require(item["prominence"]["value"] == prominence, "Frozen-role prominence parity")
        evidence_parity(item["prominence"], blind["ingredient_ledger"])
    scenarios = final["application_scenarios"]
    require(isinstance(scenarios, list), "Scenario list")
    seen = set()
    for scenario in scenarios:
        required = {"source_id", "direction_id", "supported_roles", "site", "stage", "dose", "contact_time", "removal", "restrictions"}
        require(required <= set(scenario) and set(scenario["supported_roles"]) <= USES and scenario["supported_roles"], "Scenario shape")
        pair = (scenario["source_id"], scenario["direction_id"])
        require(pair not in seen and scenario["source_id"] in source["sources"] and scenario["direction_id"] in source["directions"], "Scenario source/direction")
        seen.add(pair)
        direction = source["directions"][scenario["direction_id"]]
        require(direction["source_id"] == scenario["source_id"], "Scenario direction source parity")
        for key in ("site", "stage", "dose", "contact_time", "removal", "restrictions"):
            require(scenario[key] == direction[key], "Scenario fact parity")
        require(set(scenario["supported_roles"]) == expected_direction_roles(direction), "Direction-role constraint")
        for key in ("shake", "frequency"):
            if key in scenario:
                if key in direction:
                    require(scenario[key] == direction[key], "Optional direction fact parity")
                elif key == "shake":
                    require(isinstance(scenario[key], str) and scenario[key].startswith("Shake ") and direction["text"].startswith(scenario[key]), "Optional direction fact parity")
                else: require(scenario[key] == "unestablished", "Optional direction fact parity")
    require(set(uses) == {role for scenario in scenarios for role in scenario["supported_roles"]}, "Use/scenario union")
    require({pair[1] for pair in seen} == set(source["directions"]), "Direction coverage")
    validate_fit(final["fit"])
    require(final["reviewed_inputs"] == {"stage": "controlled_unblind", "blind_fields_preserved": True, "claims_review_complete": True, "directions_review_complete": True, "positioning_review_complete": True, "packaging_review_complete": True}, "Reviewed-inputs metadata")
    require(source_refs(final) <= set(source["sources"]), "Invented source reference")
    for field in ("dispenser", "provides_heat_protection", "provides_uv_protection", "use_evidence"):
        evidence_parity(final[field], blind["ingredient_ledger"])


def metric_values(final):
    values = {name: final[name]["value"] for name in ("base", "penetration_potential", "build_up_potential", "dispenser", "provides_heat_protection", "provides_uv_protection")}
    values.update({f"ingredient_flags.{key}": value["value"] for key, value in final["ingredient_flags"].items()})
    values["supported_uses"] = sorted(final["supported_uses"])
    values["named_oils"] = {row["hero_id"]: row["prominence"]["value"] for row in final["named_oils"]}
    return values


def calculated_comparison(finals):
    fields = {}
    boolean_names = [f"ingredient_flags.{name}" for name in sorted(FLAGS)] + ["provides_heat_protection", "provides_uv_protection"]
    all_fields = ["base", "penetration_potential", "build_up_potential", "dispenser", "supported_uses", "named_oils", *boolean_names]
    for field in all_fields:
        pairs = [(metric_values(finals["a"][ident])[field], metric_values(finals["b"][ident])[field]) for ident in sorted(IDS)]
        def known_value(value):
            return value != "unknown" and not (isinstance(value, dict) and "unknown" in value.values())
        known = [(a, b) for a, b in pairs if known_value(a) and known_value(b)]
        fields[field] = {"total": len(pairs), "equal": sum(a == b for a, b in pairs), "both_known": len(known), "both_known_equal": sum(a == b for a, b in known)}
    booleans = {}
    for field in boolean_names:
        pairs = [(metric_values(finals["a"][ident])[field], metric_values(finals["b"][ident])[field]) for ident in sorted(IDS)]
        booleans[field] = {"lane_a_true": sum(a is True for a, _ in pairs), "lane_b_true": sum(b is True for _, b in pairs), "both_true": sum(a is b is True for a, b in pairs), "both_false": sum(a is b is False for a, b in pairs), "either_true": sum(a is True or b is True for a, b in pairs), "either_false": sum(a is False or b is False for a, b in pairs), "equal_when_either_true": sum(a == b for a, b in pairs if a is True or b is True), "equal_when_either_false": sum(a == b for a, b in pairs if a is False or b is False)}
    return {"fields": fields, "booleans": booleans}


def verify(root_or_run=RUN_REL, inputs_only=False):
    run = Path(root_or_run)
    if not (run / "method.md").is_file(): run = run / RUN_REL
    require((run / "method.md").is_file(), "Round-six run directory")
    repository = next((parent for parent in [run, *run.parents] if (parent / "plans").is_dir()), ROOT)
    manifest = read(run / "input-manifest.json")
    require(isinstance(manifest.get("files"), dict) and set(manifest["files"]) == {"method.md", "blind-packet.json", "blind-lexicon.json", "source-packet.json", "unblinded-packet.json", "ingredient-lexicon.json", "normalization-audit.json", "cohort.json", "historical-preservation.json"}, "Input manifest files")
    for name, expected in manifest["files"].items(): require(digest(safe_file(run, name)) == expected, f"Input manifest hash: {name}")
    require(STAGE1_FILES <= set(manifest["files"]) and "historical-preservation.json" in manifest["files"], "Input manifest stage-one files")
    historical = read(run / "historical-preservation.json")
    history = historical.get("files")
    require(isinstance(history, dict) and history, "Historical snapshot nonempty")
    required_old = {"data/research/oil-inci/v1.0/corpus/exploratory/round-1/method.md", "data/research/oil-inci/v1.0/corpus/exploratory/blend-weight-round-4/method.md", "data/research/oil-inci/v1.0/corpus/exploratory/blend-weight-round-5/method.md"}
    require(required_old <= set(history), "Historical snapshot required artifacts")
    for name, expected in history.items(): require(digest(safe_file(repository, name)) == expected, f"Historical artifact changed: {name}")
    blind_packet = packet_rows(read(run / "blind-packet.json")); dictionary = dictionary_index(read(run / "blind-lexicon.json"))
    for row in blind_packet.values():
        ingredients = row.get("ingredients", [])
        require(row.get("raw_inci") and [item.get("rank") for item in ingredients] == list(range(1, len(ingredients) + 1)), "Blind packet ranks/raw INCI")
        require(all({"rank", "raw_name", "canonical_name"} <= set(item) and set(item) <= {"rank", "raw_name", "canonical_name", "normalization"} and norm(item["canonical_name"]) in dictionary for item in ingredients), "Blind dictionary parity")
    derivation = read(run / "derivation-manifest-v0.1.1.json")
    revision_files = {"input-manifest.json", "source-packet-v0.1.1.json", "unblinded-packet-v0.1.1.json", "post-seal-source-amendment-v0.1.1.json", "initial-stage2-preservation.json", "blind-stage-seal.json"}
    require(set(derivation.get("files", {})) == revision_files, "Derivation manifest files")
    for name, expected in derivation["files"].items(): require(digest(safe_file(run, name)) == expected, f"Derivation input changed: {name}")
    initial = read(run / "initial-stage2-preservation.json")
    archived = {"input-manifest.json", "source-packet.json", "unblinded-packet.json", "comparison.json", "lane-a/final-records.json", "lane-a/final-notes.md", "lane-b/final-records.json", "lane-b/final-notes.md"}
    require(set(initial.get("files", {})) == archived, "Initial stage-two archive membership")
    for name, expected in initial["files"].items(): require(digest(safe_file(run, name)) == expected, f"Initial stage-two artifact changed: {name}")
    source_packet = read(run / "source-packet-v0.1.1.json")
    unblinded_doc = read(run / "unblinded-packet-v0.1.1.json")
    require(unblinded_doc == source_packet, "Unblind/source facts changed")
    validate_source_packet(source_packet, blind_packet, dictionary)
    report = {"status": "passed", "cases": 6, "scope": "structural/gate verification; no classification judgment"}
    if inputs_only:
        return dict(report, mode="inputs_only")
    unblinded = source_index(unblinded_doc)
    require(set(unblinded) == set(blind_packet), "Blind/unblind coverage")
    blinds, finals = {}, {}
    for lane in LANES:
        blind_doc = read(run / f"lane-{lane}/blind-records.json"); final_doc = read(run / f"lane-{lane}/final-records-v0.1.1.json")
        for doc, suffix in ((blind_doc, "blind"), (final_doc, "final")):
            require(doc.get("run_id") == "oil-direct-properties-round-6" and doc.get("method_revision") == "direct-properties-v0.1" and doc.get("lane_id") == f"lane-{lane}", f"{lane} {suffix} provenance")
            require(isinstance(doc.get("files_read"), list), f"{lane} {suffix} files_read")
        for files, expected, suffix in ((blind_doc["files_read"], STAGE1_FILES, "blind"), (final_doc["files_read"], STAGE2_FILES, "final")):
            require(isinstance(files, list) and {scoped_read_name(run, item.get("path", "")) for item in files} == expected and len(files) == len(expected), f"{lane} {suffix} read scope")
            require(all(set(item) == {"path", "sha256"} and item["sha256"] == digest(safe_file(run, scoped_read_name(run, item["path"]))) for item in files), f"{lane} {suffix} read hashes")
        blinds[lane] = records_by_id(blind_doc, f"lane {lane} blind"); finals[lane] = records_by_id(final_doc, f"lane {lane} final")
        for ident in IDS:
            validate_blind(blinds[lane][ident], blind_packet[ident], dictionary)
            validate_final(finals[lane][ident], blinds[lane][ident], unblinded[ident], dictionary)
    seal = read(run / "blind-stage-seal.json")
    seal_files = {row.get("path"): row.get("sha256") for row in seal.get("files", [])}
    expected_seal = {f"lane-{lane}/blind-records.json" for lane in LANES} | {f"lane-{lane}/blind-notes.md" for lane in LANES}
    require(set(seal_files) == expected_seal and all(digest(safe_file(run, name)) == value for name, value in seal_files.items()), "Blind-stage seal")
    require(seal.get("access_receipts_reviewed") is True, "Blind-stage access receipt")
    comparison = read(run / "comparison-v0.1.1.json")
    expected_comparison = calculated_comparison(finals)
    require(comparison.get("fields") == expected_comparison["fields"] and comparison.get("booleans") == expected_comparison["booleans"], "Comparison denominator/value error")
    validate_projection(run, finals)
    return dict(report, mode="complete", lanes=2, fit_cells_excluded=120, historical_files_unchanged=len(history), revision="source-only-v0.1.1")


def validate_projection(run, finals):
    working = read(run / "working-records-v0.1.1.json")
    rows = records_by_id(working, "working projection")
    require(rows == finals["a"], "Working projection differs from declared lane-a metadata")
    expected_parents = {f"lane-{lane}/final-records-v0.1.1.json": digest(run / f"lane-{lane}/final-records-v0.1.1.json") for lane in LANES}
    require(working.get("parents") == expected_parents, "Working parent hashes")
    sources = records_by_id(read(run / "source-packet-v0.1.1.json"), "projection source")
    weights = records_by_id(read(run / "weight-carry-in.json"), "weight carry-in")
    with (run / "working-property-sheet-v0.1.1.csv").open(newline="") as stream:
        sheet = list(csv.DictReader(stream))
    require(len(sheet) == 6 and {row["neutral_id"] for row in sheet} == IDS, "CSV case coverage")
    for row in sheet:
        ident = row["neutral_id"]; final = finals["a"][ident]; identity = sources[ident]["identity"]; weight = weights[ident]
        expected = {"neutral_id": ident, "product": identity["brand"] + " " + identity["product"], "market": identity["market"], "size_ml": str(identity["size_ml"]), "fit": "unknown:policy_not_defined", "weight_carry_in": weight["value"], "weight_authority": weight["authority"], "weight_confidence": weight["confidence"], "weight_alternative": weight["nearest_alternative"]}
        for field in ("base", "penetration_potential", "build_up_potential", "dispenser", "provides_heat_protection", "provides_uv_protection"):
            expected[field] = str(final[field]["value"])
        expected.update({field: str(prop["value"]) for field, prop in final["ingredient_flags"].items()})
        require(set(row) == set(expected) | {"supported_uses", "named_oils"}, "CSV column coverage")
        require(all(row[field] == value for field, value in expected.items()), "CSV value/source parity")
        require(json.loads(row["supported_uses"]) == sorted(final["supported_uses"]) and json.loads(row["named_oils"]) == {item["hero_id"]: item["prominence"]["value"] for item in final["named_oils"]}, "CSV set/property parity")


def self_test(root_or_run=ROOT):
    # Start from the real complete corpus, then corrupt one independent contract.
    # No copied toy classifier fixture, repository mutation or synthetic guard.
    baseline = verify(root_or_run)
    run = Path(root_or_run)
    if not (run / "method.md").is_file(): run = run / RUN_REL
    packet = packet_rows(read(run / "blind-packet.json"))
    dictionary = dictionary_index(read(run / "blind-lexicon.json"))
    blind = records_by_id(read(run / "lane-a/blind-records.json"), "baseline blind")
    final = records_by_id(read(run / "lane-a/final-records-v0.1.1.json"), "baseline final")
    sources = source_index(read(run / "unblinded-packet-v0.1.1.json"))
    controls = []
    def rejects(label, action, expected):
        try:
            action()
        except ValueError as error:
            require(str(error) == expected, f"{label} wrong guard: {error}")
            controls.append({"control": label, "guard": expected})
            return
        raise ValueError(f"{label} corruption accepted")
    for filter_present, accepted, expected in ((False, False, False), (False, True, False), (True, False, False), (True, True, True)):
        claim = {"accepted": accepted, "review_complete": True, "source_id": "explicit-maker", "excerpt": "Hair UV protection" if accepted else None}
        require(uv_gate(filter_present, claim) is expected, "UV four-combination gate")
    # Test the public verifier with an in-memory read override for unsealed outputs.
    def overlay_verify(filename, changed):
        original = globals()["read"]
        def overlay(path):
            return copy.deepcopy(changed) if Path(path) == run / filename else original(path)
        globals()["read"] = overlay
        try: verify(run)
        finally: globals()["read"] = original
    manifest = read(run / "input-manifest.json"); del manifest["files"]["cohort.json"]
    rejects("truncated manifest", lambda: overlay_verify("input-manifest.json", manifest), "Input manifest files")
    doc = read(run / "lane-a/final-records-v0.1.1.json"); doc["records"][1]["neutral_id"] = doc["records"][0]["neutral_id"]
    rejects("duplicate case", lambda: overlay_verify("lane-a/final-records-v0.1.1.json", doc), "lane a final duplicate/missing ID")
    doc = copy.deepcopy(final["D01"]); doc["base"]["reason"] += " corrupted"
    rejects("post-unblind formula rewrite", lambda: validate_final(doc, blind["D01"], sources["D01"], dictionary), "Changed blind fields")
    doc = copy.deepcopy(blind["D01"]); del doc["ingredient_flags"]["fragrance"]
    rejects("omitted flag", lambda: validate_blind(doc, packet["D01"], dictionary), "Flag keys")
    doc = copy.deepcopy(blind["D01"]); doc["ingredient_flags"]["fragrance"]["value"] = False; doc["ingredient_flags"]["fragrance"]["nearest_alternative"] = None
    rejects("false fragrance despite matches", lambda: validate_blind(doc, packet["D01"], dictionary), "Flag dictionary parity: fragrance")
    doc = copy.deepcopy(final["D05"]); doc["provides_uv_protection"]["value"] = False; doc["provides_uv_protection"]["nearest_alternative"] = None
    rejects("wrong UV gate", lambda: validate_final(doc, blind["D05"], sources["D05"], dictionary), "UV conjunction gate")
    doc = copy.deepcopy(final["D03"]); doc["provides_heat_protection"]["value"] = False; doc["provides_heat_protection"]["nearest_alternative"] = None
    rejects("lost heat claim", lambda: validate_final(doc, blind["D03"], sources["D03"], dictionary), "Heat gate")
    doc = copy.deepcopy(final["D01"]); doc["application_scenarios"][0]["source_id"] = "invented"
    rejects("invented source", lambda: validate_final(doc, blind["D01"], sources["D01"], dictionary), "Scenario source/direction")
    doc = copy.deepcopy(final["D01"]); doc["application_scenarios"][0]["direction_id"] = "invented"
    rejects("invented direction", lambda: validate_final(doc, blind["D01"], sources["D01"], dictionary), "Scenario source/direction")
    doc = copy.deepcopy(final["D01"]); del doc["fit"]["thickness"]["fine"]
    rejects("missing fit cell", lambda: validate_final(doc, blind["D01"], sources["D01"], dictionary), "Fit thickness cells")
    doc = read(run / "comparison-v0.1.1.json"); doc["fields"]["base"]["total"] = 7
    rejects("false metric denominator", lambda: overlay_verify("comparison-v0.1.1.json", doc), "Comparison denominator/value error")
    doc = copy.deepcopy(final["D02"]); doc["application_scenarios"][0]["dose"] = "100 tablespoons"
    rejects("invented dose with valid direction", lambda: validate_final(doc, blind["D02"], sources["D02"], dictionary), "Scenario fact parity")
    doc = copy.deepcopy(final["D02"]); doc["application_scenarios"][0]["supported_roles"] = ["dry_finish"]
    rejects("dry prewash mislabelled finish", lambda: validate_final(doc, blind["D02"], sources["D02"], dictionary), "Direction-role constraint")
    doc = copy.deepcopy(blind["D02"]); doc["auxiliary_suffix"] = {"start_rank": 99, "markers": [{"rank": 99, "function": "fragrance"}, {"rank": 99, "function": "antioxidant"}], "reason": "invented"}
    rejects("invalid suffix ranks", lambda: validate_blind(doc, packet["D02"], dictionary), "Auxiliary suffix range")
    doc = copy.deepcopy(final["D02"]); doc["named_oils"][0]["prominence"]["value"] = "trace"; doc["named_oils"][0]["prominence"]["nearest_alternative"] = None
    rejects("principal oil falsely trace", lambda: validate_final(doc, blind["D02"], sources["D02"], dictionary), "Frozen-role prominence parity")
    doc = copy.deepcopy(blind["D02"]); doc["base"]["evidence"].append({"rank": 999, "canonical_name": "UNDECLARED OIL"})
    rejects("fabricated formula evidence", lambda: validate_blind(doc, packet["D02"], dictionary), "Formula evidence rank/name parity")
    doc = copy.deepcopy(final["D02"]); doc["application_scenarios"][0]["shake"] = "Shake 100 times"
    rejects("invented optional instructions", lambda: validate_final(doc, blind["D02"], sources["D02"], dictionary), "Optional direction fact parity")
    doc = copy.deepcopy(final["D02"]); doc["provides_uv_protection"]["evidence"].append({"rank": 999, "canonical_name": "UNDECLARED FILTER"})
    rejects("fabricated factual ingredient evidence", lambda: validate_final(doc, blind["D02"], sources["D02"], dictionary), "Formula evidence rank/name parity")
    doc = read(run / "blind-stage-seal.json"); doc["files"] = doc["files"][:-1]
    rejects("truncated blind seal", lambda: overlay_verify("blind-stage-seal.json", doc), "Blind-stage seal")
    return {"status": "passed", "baseline": baseline, "uv_truth_combinations": 4, "mutation_controls": controls}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("root_or_run", nargs="?", default=str(ROOT))
    parser.add_argument("--inputs-only", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    print(json.dumps(self_test(args.root_or_run) if args.self_test else verify(args.root_or_run, args.inputs_only), indent=2))
