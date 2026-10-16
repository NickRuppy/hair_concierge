#!/usr/bin/env python3
"""Verify round-5 artifact contracts; never validate or choose hair-weight labels."""
import argparse
import copy
import csv
import hashlib
import json
import re
import shutil
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "data/research/oil-inci/v1.0/corpus/exploratory/blend-weight-round-5"
BLIND_FILES = {"method.md", "material-reference.json", "policy.json", "role-lexicon.json",
               "blind-packet.json", "input-manifest.json"}
PROVENANCE_FILES = {"source-capture.json", "identity-map.json", "display-receipts.json",
                    "role-source-ledger.json", "preflight-receipt.json",
                    "historical-baseline.json", "input-manifest.json"}
IDS = {f"R{i:02d}" for i in range(1, 9)}
VALUES = {"light", "medium", "rich", "unknown"}
ROLES = {"principal", "secondary", "auxiliary", "unresolved"}
RULES = {f"B{i}" for i in range(8)}


def read(path):
    return json.loads(Path(path).read_text())


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def norm(value):
    return " ".join(value.upper().split())


def index(entries, name, aliases):
    result = {}
    for entry in entries:
        for value in [entry[name], *entry[aliases]]:
            key = norm(value)
            require(key not in result, f"Ambiguous alias: {value}")
            result[key] = entry
    return result


def projected_materials(reference):
    fields = {"id", "canonical_inci", "aliases", "material_family", "weight_prior"}
    prior = {"value", "estimate", "confidence", "nearest_alternative", "alternatives"}
    entries = []
    for entry in reference["entries"]:
        require(set(entry) >= fields and set(entry["weight_prior"]) >= prior,
                "v0.10 source material shape")
        entries.append({field: ( {k: entry[field][k] for k in prior} if field == "weight_prior"
                                else entry[field]) for field in fields})
    return entries


def exact_matches(ingredients, materials):
    return [{"rank": item["rank"], "reference_id": materials[norm(item["canonical_name"])]["id"],
             "value": materials[norm(item["canonical_name"])]["weight_prior"]["value"],
             "confidence": materials[norm(item["canonical_name"])]["weight_prior"]["confidence"]}
            for item in ingredients if norm(item["canonical_name"]) in materials]


def raw_tokens(capture):
    tokens, current, depth = [], [], 0
    for char in capture["raw_inci"]:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            require(depth >= 0, "Unbalanced raw INCI parentheses")
        if char == "," and depth == 0:
            tokens.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    require(depth == 0, "Unbalanced raw INCI parentheses")
    tokens.append("".join(current).strip())
    return tokens


def receipt_normalizes(receipt, capture, ingredient, token, is_last):
    require(set(receipt) == {"neutral_id", "rank", "raw_token", "canonical_name", "kind", "limit", "authority_url"},
            "Display receipt shape")
    require(receipt["raw_token"] == token and receipt["canonical_name"] == ingredient["canonical_name"]
            and receipt["authority_url"] == capture["source_url"] and bool(receipt["limit"]),
            "Display receipt scope")
    value = norm(token)
    if receipt["kind"] == "source_footnote_removal":
        require(re.fullmatch(r".*(?:\*+|\[[^\[\]]+\])", value) is not None,
                "Display receipt is not a source footnote")
        value = re.sub(r"(?:\*+|\[[^\[\]]+\])$", "", value).strip()
    elif receipt["kind"] == "terminal_punctuation_removal":
        require(is_last and value.endswith((".", ";", ":")), "Display receipt is not terminal punctuation")
        value = value[:-1].strip()
    elif receipt["kind"] == "source_translation_label":
        allowed = {
            "ZEA MAYS GERM OIL / CORN GERM OIL": "ZEA MAYS GERM OIL",
            "PARFUM / FRAGRANCE": "PARFUM",
        }
        require(token in allowed and ingredient["canonical_name"] == allowed[token],
                "Unreviewed source translation label")
        value = ingredient["canonical_name"]
    elif receipt["kind"] == "source_explanatory_annotation":
        aroma_zone = "https://www.aroma-zone.com/en/product/haircare-oil-with-7-precious-oil"
        allowed = {
            "Ricinus communis seed oil* (organic Ricin carrier oil)": "RICINUS COMMUNIS SEED OIL",
            "Olea europaea fruit oil* (organic Olive carrier oil)": "OLEA EUROPAEA FRUIT OIL",
            "Cocos nucifera oil* (organic Coconut carrier oil)": "COCOS NUCIFERA OIL",
            "Persea gratissima oil* (organic Avocado carrier oil)": "PERSEA GRATISSIMA OIL",
            "Brassica nigra seed oil* (organic Mustard carrier oil)": "BRASSICA NIGRA SEED OIL",
            "Simmondsia chinensis seed oil* (organic Jojoba plant oil)": "SIMMONDSIA CHINENSIS SEED OIL",
            "Brassica oleracea italica seed oil* (organic Broccoli plant oil)": "BRASSICA OLERACEA ITALICA SEED OIL",
            "Emblica officinalis fruit powder* (organic Amla powder)": "EMBLICA OFFICINALIS FRUIT POWDER",
            "Tocopherol (vitamin E)": "TOCOPHEROL",
            "Helianthus annuus seed oil (Sunflower plant oil, tocopherol carrier oil)": "HELIANTHUS ANNUUS SEED OIL",
            "Helianthus annuus seed oil (Sunflower plant oil, tocopherol carrier oil).": "HELIANTHUS ANNUUS SEED OIL",
        }
        require(capture["source_url"] == aroma_zone and token in allowed
                and ingredient["canonical_name"] == allowed[token], "Unreviewed source explanatory annotation")
        value = ingredient["canonical_name"]
    else:
        raise ValueError("Unreviewed display receipt kind")
    require(value == ingredient["canonical_name"], "Invalid display-only transformation")


def check_outputs(data, packet, materials, roles, blind, run):
    require(set(data) == {"run_id", "records", "read_scope"} and data["run_id"] == "oil-blend-weight-round-5",
            "Output top-level contract")
    records = data["records"]
    require(len(records) == 8 and {row["neutral_id"] for row in records} == IDS, "Output case completeness")
    scope = data["read_scope"]
    if blind:
        require(set(scope) == {"files", "hashes", "forbidden_access", "recognition_note"}, "Read scope shape")
        require(set(scope["files"]) == BLIND_FILES and len(scope["files"]) == len(BLIND_FILES), "Forbidden read scope")
        require(scope["forbidden_access"] is False and isinstance(scope["recognition_note"], str) and bool(scope["recognition_note"]),
                "Forbidden access disclosure")
        require(scope["hashes"] == {name: digest(run / name) for name in BLIND_FILES}, "Read-scope hashes")
    else:
        require(scope.get("source_access_disclosed") is True and scope.get("written_before_lanes") is True,
                "Main independence disclosure")
    for row in records:
        require(set(row) == {"neutral_id", "ingredient_roles", "material_matches", "weight"}, "Record shape")
        ingredients = packet[row["neutral_id"]]["ingredients"]
        assignments = row["ingredient_roles"]
        require(len(assignments) == len(ingredients), "Role coverage")
        for assignment, ingredient in zip(assignments, ingredients):
            require(set(assignment) == {"rank", "canonical_name", "role", "reason"}, "Role shape")
            require(assignment["rank"] == ingredient["rank"] and assignment["canonical_name"] == ingredient["canonical_name"],
                    "Role rank/name")
            require(assignment["role"] in ROLES and bool(assignment["reason"]), "Role judgment missing")
            if "not_assessed" in roles[norm(ingredient["canonical_name"])]["roles"]:
                require(assignment["role"] == "unresolved", "Unassessed role silently classified")
        require(row["material_matches"] == exact_matches(ingredients, materials), "False or missing exact material match")
        weight = row["weight"]
        require(set(weight) == {"value", "estimate", "confidence", "evidence", "counter_signal", "nearest_alternative",
                                "alternatives", "rule_ids", "reason", "unresolved"}, "Weight shape")
        require(weight["value"] in VALUES and weight["confidence"] == "low", "Mixture confidence ceiling")
        require(weight["estimate"] is (weight["value"] != "unknown"), "Estimate/unknown contract")
        for field in ("evidence", "counter_signal", "alternatives", "rule_ids", "unresolved"):
            require(isinstance(weight[field], list) and weight[field] and all(isinstance(x, str) and x for x in weight[field]),
                    f"Missing {field} argument/gap")
        require(bool(weight["reason"]), "Missing architecture judgment")
        require(set(weight["alternatives"]) <= VALUES - {weight["value"]}
                and len(set(weight["alternatives"])) == len(weight["alternatives"])
                and weight["nearest_alternative"] in weight["alternatives"], "Alternative contract")
        require(set(weight["rule_ids"]) <= RULES and {"B0", "B1"} <= set(weight["rule_ids"]), "Policy rule IDs")
        require(weight["value"] != "unknown" or "B7" in weight["rule_ids"], "Unknown without B7")
        gaps = "\n".join(weight["unresolved"])
        for ingredient in ingredients:
            if "not_assessed" in roles[norm(ingredient["canonical_name"])]["roles"]:
                require(ingredient["canonical_name"] in gaps, "Unassessed ingredient missing from gap ledger")


def calculated_metrics(outputs, identity):
    values = {lane: {row["neutral_id"]: row["weight"]["value"] for row in output["records"]}
              for lane, output in outputs.items()}
    cohorts = {}
    for group, expected_total in (("fresh", 6), ("replay", 2)):
        ids = [identifier for identifier, row in identity.items() if row["cohort_group"] == group]
        require(len(ids) == expected_total, "Cohort denominators")
        cohorts[group] = {
            "total": len(ids),
            "lane_pair_raw_equal": sum(values["a"][i] == values["b"][i] for i in ids),
            "lane_pair_known_equal": sum(values["a"][i] == values["b"][i] != "unknown" for i in ids),
            "lane_pair_both_known": sum(values["a"][i] != "unknown" and values["b"][i] != "unknown" for i in ids),
            "classified_by_lane": {lane: sum(lane_values[i] != "unknown" for i in ids)
                                   for lane, lane_values in values.items()},
        }
    return cohorts, values


def verify(run=RUN, inputs_only=False):
    reference_path = ROOT / "data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.10.json"
    reference = read(reference_path)
    projection = read(run / "material-reference.json")
    require(set(projection) == {"reference_id", "version", "projection_note", "entries"}, "Material projection shape")
    require(projection["reference_id"] == reference["reference_id"] and projection["version"] == reference["version"]
            and isinstance(projection["projection_note"], str) and bool(projection["projection_note"])
            and projection["entries"] == projected_materials(reference), "v0.10 material projection changed")
    materials = index(projection["entries"], "canonical_inci", "aliases")

    policy_source = read(ROOT / "data/research/oil-inci/v1.0/reference/blend-weight-policy-v0.2.json")
    require("provenance" in policy_source, "v0.2 policy provenance missing")
    policy_public = copy.deepcopy(policy_source); policy_public.pop("provenance")
    require(read(run / "policy.json") == policy_public, "Policy mirror/provenance")

    manifest = read(run / "input-manifest.json")
    require(set(manifest["blind_input_files"]) == BLIND_FILES and set(manifest["files"]) == BLIND_FILES - {"input-manifest.json"}
            and set(manifest["neutral_ids"]) == IDS, "Input read contract")
    for name, value in manifest["files"].items():
        require(digest(run / name) == value, f"Sealed input changed: {name}")
    provenance = read(run / "provenance-seal.json")
    require(set(provenance) == {"files", "scope"} and isinstance(provenance["scope"], str) and bool(provenance["scope"]),
            "Provenance seal shape")
    require(set(provenance["files"]) == PROVENANCE_FILES, "Provenance seal completeness")
    for name, value in provenance["files"].items():
        require(not Path(name).is_absolute() and ".." not in Path(name).parts, "Provenance seal path scope")
        require(digest(run / name) == value, f"Sealed provenance changed: {name}")
    historical = read(run / "historical-baseline.json")
    predecessor = read(ROOT / "plans/oil-inci/research/hair-weight-v0.10-historical-hashes-2026-10-04.json")["files"]
    required_history = {**predecessor, str(reference_path.relative_to(ROOT)): digest(reference_path)}
    require(all(historical.get(name) == value for name, value in required_history.items()),
            "Historical baseline completeness")
    for name, value in historical.items():
        require(digest(ROOT / name) == value, f"Historical artifact changed: {name}")

    packet_rows = read(run / "blind-packet.json")["records"]
    capture_rows = read(run / "source-capture.json")["records"]
    identity_rows = read(run / "identity-map.json")["records"]
    for rows, label in ((packet_rows, "packet"), (capture_rows, "capture"), (identity_rows, "identity")):
        require(len(rows) == 8 and len({row["neutral_id"] for row in rows}) == 8, f"Duplicate or missing {label} input IDs")
    packet = {row["neutral_id"]: row for row in packet_rows}
    captures = {row["neutral_id"]: row for row in capture_rows}
    identity = {row["neutral_id"]: row for row in identity_rows}
    require(set(packet) == set(captures) == set(identity) == IDS,
            "Input case completeness")
    require(sum(row["cohort_group"] == "fresh" for row in identity.values()) == 6
            and sum(row["cohort_group"] == "replay" for row in identity.values()) == 2, "Cohort denominators")
    roles_doc = read(run / "role-lexicon.json")
    require(set(roles_doc) == {"version", "entries", "unresolved_names", "limits"}, "Role projection shape")
    for entry in roles_doc["entries"]:
        require(set(entry) == {"canonical_name", "aliases", "roles", "validation_status", "notes"}, "Role projection fields")
    roles = index(roles_doc["entries"], "canonical_name", "aliases")
    ledger = read(run / "role-source-ledger.json")
    projection_fields = {"canonical_name", "aliases", "roles", "validation_status", "notes"}
    require("entries" in ledger and provenance["files"].get("role-source-ledger.json") == digest(run / "role-source-ledger.json"),
            "Role provenance ledger")
    require([{field: entry[field] for field in projection_fields} for entry in ledger["entries"]] == roles_doc["entries"],
            "Role/source projection mismatch")
    receipts = read(run / "display-receipts.json")["receipts"]
    seen_receipts = set()
    for identifier, capture in captures.items():
        item = packet[identifier]
        require(set(item) == {"neutral_id", "input_kind", "ingredients"} and capture["ingredients"] == item["ingredients"],
                "Capture/packet mismatch")
        require(item["input_kind"] == "mixed_formula", "Input kind contract")
        require(capture["source_url"] == identity[identifier]["source_url"], "Source identity mismatch")
        require(capture["cohort_group"] == identity[identifier]["cohort_group"], "Source cohort mismatch")
        ingredients = item["ingredients"]
        require([x["rank"] for x in ingredients] == list(range(1, len(ingredients) + 1))
                and all(set(x) == {"rank", "canonical_name"} and norm(x["canonical_name"]) in roles for x in ingredients),
                "Input ranks/function map")
        tokens = raw_tokens(capture)
        require(len(tokens) == len(ingredients), "Raw ingredient count")
        for ingredient, token in zip(ingredients, tokens):
            applicable = [r for r in receipts if r["neutral_id"] == identifier and r["rank"] == ingredient["rank"]]
            require(len(applicable) <= 1, "Ambiguous display receipt")
            if applicable:
                receipt_normalizes(applicable[0], capture, ingredient, token, ingredient["rank"] == len(ingredients))
                seen_receipts.add((identifier, ingredient["rank"]))
            else:
                require(norm(token) == ingredient["canonical_name"], "Unrecorded normalization")
    require(len(seen_receipts) == len(receipts), "Unused display receipt")
    report = {"status": "passed", "scope": "Artifact contracts, not scientific/sensory accuracy", "cases": 8,
              "fresh": 6, "replay": 2, "read_scope_limit": "Self-report, not sandbox proof"}
    if inputs_only:
        return dict(report, mode="inputs_only")

    outputs = {lane: read(run / f"lane-{lane}/records.json") for lane in ("a", "b")}
    outputs["main"] = read(run / "main-working.json")
    seal = read(run / "main-before-lanes-seal.json")
    require(seal.get("sha256") == digest(run / "main-working.json") and seal.get("written_before_lanes") is True,
            "Main judgment changed after independent lanes")
    for lane, output in outputs.items():
        check_outputs(output, packet, materials, roles, lane != "main", run)
    cohorts, values = calculated_metrics(outputs, identity)
    comparison = read(run / "comparison.json")
    require(set(comparison) == {"run_id", "cohorts", "disagreements", "limits"}
            and comparison["run_id"] == "oil-blend-weight-round-5" and comparison["cohorts"] == cohorts,
            "Comparison denominator/value error")
    expected_disagreements = sorted(i for i in IDS if len({values[lane][i] for lane in values}) > 1)
    require(sorted(comparison["disagreements"]) == expected_disagreements and len(set(comparison["disagreements"])) == len(comparison["disagreements"]),
            "Comparison disagreement IDs")
    adjudication = read(run / "adjudication.json")
    require(adjudication.get("run_id") == "oil-blend-weight-round-5" and adjudication.get("policy_changes_during_round") is False,
            "Working adjudication contract")
    adjudication_rows = adjudication.get("rows", [])
    require(len(adjudication_rows) == 8 and len({row["neutral_id"] for row in adjudication_rows}) == 8
            and {row["neutral_id"] for row in adjudication_rows} == IDS, "Working adjudication coverage")
    adjudicated = {row["neutral_id"]: row for row in adjudication_rows}
    for identifier, row in adjudicated.items():
        require(row.get("value") in VALUES and row.get("confidence") == "low"
                and row.get("estimate") is (row["value"] != "unknown")
                and row.get("nearest_alternative") in VALUES - {row["value"]}
                and bool(row.get("reason")) and bool(row.get("choice_basis"))
                and isinstance(row.get("unresolved"), list) and row["unresolved"], "Working estimate contract")
        gaps = "\n".join(row["unresolved"])
        for ingredient in packet[identifier]["ingredients"]:
            if "not_assessed" in roles[norm(ingredient["canonical_name"])]["roles"]:
                require(ingredient["canonical_name"] in gaps, "Working gap accounting")
    with (run / "working-weights.csv").open(newline="") as handle:
        csv_rows = list(csv.DictReader(handle))
    require(len(csv_rows) == 8 and len({row["neutral_id"] for row in csv_rows}) == 8
            and {row["neutral_id"] for row in csv_rows} == IDS, "Working CSV coverage")
    for row in csv_rows:
        identifier = row["neutral_id"]
        expected = {**{field: identity[identifier][field] for field in
                       ("neutral_id", "brand", "product", "market", "size", "cohort_group", "source_url")},
                    "lane_a": values["a"][identifier], "lane_b": values["b"][identifier],
                    "main_initial": values["main"][identifier],
                    "working_value": adjudicated[identifier]["value"],
                    "estimate": str(adjudicated[identifier]["estimate"]).lower(),
                    "confidence": adjudicated[identifier]["confidence"],
                    "nearest_alternative": adjudicated[identifier]["nearest_alternative"],
                    "status": adjudicated[identifier]["status"]}
        require(row == expected, "Working CSV mismatch")
    output_seal = read(run / "output-seal.json")
    required = {"main-working.json", "main-before-lanes-seal.json", "comparison.json", "adjudication.json", "results-for-review.md",
                "working-weights.csv", "lane-a/records.json", "lane-a/notes.md",
                "lane-b/records.json", "lane-b/notes.md"}
    require(set(output_seal["files"]) == required, "Output seal scope")
    for name, value in output_seal["files"].items():
        require(not Path(name).is_absolute() and ".." not in Path(name).parts, "Output seal path scope")
        require(digest(run / name) == value, f"Sealed output changed: {name}")
    return dict(report, mode="complete", cohorts=cohorts)


def mutate_json(path, mutate):
    data = read(path); mutate(data); Path(path).write_text(json.dumps(data, indent=2) + "\n")


def reseal_input_manifest(run):
    manifest_path = run / "input-manifest.json"
    manifest = read(manifest_path)
    for name in manifest["files"]:
        manifest["files"][name] = digest(run / name)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    seal_path = run / "provenance-seal.json"
    seal = read(seal_path)
    seal["files"]["input-manifest.json"] = digest(manifest_path)
    seal_path.write_text(json.dumps(seal, indent=2) + "\n")


def reseal_ledger(run):
    ledger_path = run / "role-source-ledger.json"
    seal_path = run / "provenance-seal.json"
    seal = read(seal_path)
    seal["files"]["role-source-ledger.json"] = digest(ledger_path)
    seal_path.write_text(json.dumps(seal, indent=2) + "\n")


def reseal_provenance_file(run, name):
    mutate_json(run / "provenance-seal.json",
                lambda data: data["files"].__setitem__(name, digest(run / name)))


def mutate_csv_label(run):
    path = run / "working-weights.csv"
    with path.open(newline="") as handle:
        reader = csv.DictReader(handle); fields = reader.fieldnames; rows = list(reader)
    rows[0]["working_value"] = "rich" if rows[0]["working_value"] != "rich" else "light"
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(rows)


def negative_controls():
    verify()  # Prove the live baseline before any temporary mutation.
    controls = [
        ("fabricated_material_match", "False or missing exact material match",
         lambda r: mutate_json(r / "lane-a/records.json", lambda d: d["records"][0]["material_matches"].append({"rank": 999, "reference_id": "fabricated", "value": "light", "confidence": "low"}))),
        ("confidence_inflation", "Mixture confidence ceiling",
         lambda r: mutate_json(r / "lane-a/records.json", lambda d: d["records"][0]["weight"].__setitem__("confidence", "high"))),
        ("missing_role", "Role coverage",
         lambda r: mutate_json(r / "lane-a/records.json", lambda d: d["records"][0].__setitem__("ingredient_roles", []))),
        ("missing_case", "Output case completeness",
         lambda r: mutate_json(r / "lane-a/records.json", lambda d: d.__setitem__("records", d["records"][:-1]))),
        ("missing_gap", "Missing unresolved argument/gap",
         lambda r: mutate_json(r / "lane-a/records.json", lambda d: d["records"][0]["weight"].__setitem__("unresolved", []))),
        ("metric_tampering", "Comparison denominator/value error",
         lambda r: mutate_json(r / "comparison.json", lambda d: d["cohorts"]["fresh"].__setitem__("total", 999))),
        ("forbidden_scope", "Forbidden access disclosure",
         lambda r: mutate_json(r / "lane-a/records.json", lambda d: d["read_scope"].__setitem__("forbidden_access", True))),
        ("mutated_input_hash", "Sealed input changed: blind-packet.json",
         lambda r: (r / "blind-packet.json").open("a").write("\n")),
        ("duplicate_packet_input", "Duplicate or missing packet input IDs",
         lambda r: (mutate_json(r / "blind-packet.json", lambda d: d["records"].__setitem__(-1,
                      dict(d["records"][-1], neutral_id=d["records"][0]["neutral_id"]))), reseal_input_manifest(r))),
        ("truncated_provenance", "Provenance seal completeness",
         lambda r: mutate_json(r / "provenance-seal.json", lambda d: d.__setitem__("files",
                    {"role-source-ledger.json": d["files"]["role-source-ledger.json"]}))),
        ("empty_historical_baseline", "Historical baseline completeness",
         lambda r: (mutate_json(r / "historical-baseline.json", lambda d: d.clear()),
                    reseal_provenance_file(r, "historical-baseline.json"))),
        ("duplicate_adjudication", "Working adjudication coverage",
         lambda r: mutate_json(r / "adjudication.json", lambda d: d["rows"].append(
                    dict(d["rows"][0], value="rich")))),
        ("csv_label_mismatch", "Working CSV mismatch", mutate_csv_label),
        ("role_projection_mismatch", "Role/source projection mismatch",
         lambda r: (mutate_json(r / "role-source-ledger.json", lambda d: d["entries"][0].__setitem__("notes", "tampered")),
                    reseal_ledger(r))),
    ]
    results = []
    for name, expected, mutate in controls:
        with tempfile.TemporaryDirectory() as temporary:
            copied = Path(temporary) / "run"; shutil.copytree(RUN, copied); mutate(copied)
            try:
                verify(copied)
            except ValueError as error:
                require(str(error) == expected, f"Negative control {name} wrong guard: {error}")
                results.append({"name": name, "expected_guard": expected, "rejected": True})
            else:
                raise ValueError(f"Negative control {name} was accepted")
    return {"status": "passed", "controls": results}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs-only", action="store_true")
    parser.add_argument("--negative-controls", action="store_true")
    args = parser.parse_args()
    if args.negative_controls:
        print(json.dumps(negative_controls(), indent=2))
    else:
        print(json.dumps(verify(inputs_only=args.inputs_only), indent=2))
