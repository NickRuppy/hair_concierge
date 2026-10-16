"""Verify a source-bound shared persistence pilot, not measured performance."""
import copy
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "data/research/shared/persistence-pilot-v0.1"
VALUES = {"low", "moderate", "high"}
READS = {"method.md", "blind-packet.json", "function-dictionary.json"}


def read(name):
    return json.loads((RUN / name).read_text())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def indexed(rows):
    result = {r["case_id"]: r for r in rows}
    require(len(rows) == len(result), "duplicate case")
    return result


def validate_records(rows, packet):
    records = indexed(rows)
    require(records.keys() == packet.keys(), "case coverage")
    for key, row in records.items():
        require(set(row) == {"case_id", "persistence_potential", "reason", "evidence", "considered_ranks"}, "research fields")
        require(row["persistence_potential"] in VALUES, "committed class")
        require(isinstance(row["reason"], str) and row["reason"].strip(), "missing reason")
        ingredients = packet[key]["ingredients"]
        require(row["considered_ranks"] == [i["rank"] for i in ingredients], "rank coverage")
        require(isinstance(row["evidence"], list) and row["evidence"], "missing evidence")
        names = {i["rank"]: i["canonical_name"] for i in ingredients}
        for evidence in row["evidence"]:
            require(set(evidence) == {"rank", "canonical_name"} and names.get(evidence["rank"]) == evidence["canonical_name"], "evidence binding")
    return records


def validate_projection(rows, sources, decisions):
    require(len(rows) == 6, "projection case coverage")
    mapping = {r["product_key"]: r for r in rows}
    require(len(mapping) == 6 and mapping.keys() == {s["product_key"] for s in sources.values()}, "projection product keys")
    for key, source in sources.items():
        row = mapping[source["product_key"]]
        require(set(row) == {"product_key", "policy_version", "persistence_potential"}, "projection fields")
        require(row["policy_version"] == "shared-persistence-v0.1", "projection policy")
        require(row["persistence_potential"] in VALUES and row["persistence_potential"] == decisions[key]["persistence_potential"], "projection decision parity")


def main():
    manifest = read("input-manifest.json")
    for name, expected in manifest["run_inputs"].items():
        require(digest(RUN / name) == expected, "changed input: " + name)
    for name, expected in manifest["dependencies"].items():
        require(digest(ROOT / name) == expected, "changed dependency: " + name)
    sources = indexed(read("source-packet.json")["records"])
    packet = indexed(read("blind-packet.json")["records"])
    require(len(sources) == 6 and sources.keys() == packet.keys(), "six cases")
    require({c: sum(r["category"] == c for r in sources.values()) for c in ("conditioner", "leave_in", "oil")} == {"conditioner": 2, "leave_in": 2, "oil": 2}, "category coverage")
    names = set()
    ranks = 0
    for key, source in sources.items():
        for field in packet[key]:
            require(source[field] == packet[key][field], "source/blind parity")
        parts = source["primary_inci"].split(", ")
        require(len(parts) == len(source["ingredients"]), "literal declaration coverage")
        for rank, (part, ingredient) in enumerate(zip(parts, source["ingredients"]), 1):
            require(rank == ingredient["rank"] and part == ingredient["raw_name"], "literal rank/name parity")
            names.add(ingredient["canonical_name"])
            ranks += 1
        ref = source["source_refs"]
        native = json.loads((ROOT / ref["formula_packet"]).read_text())
        if source["category"] == "conditioner":
            original = next(r for r in native["products"] if r["product_id"] == ref["formula_key"])
            directions = json.loads((ROOT / ref["protocol_packet"]).read_text())
            original_directions = next(r for r in directions["products"] if r["product_id"] == ref["protocol_key"])
            require(original["category_boundary_status"] == "eligible" and original_directions["rinse_out"] is True and source["directions_record"] == original_directions, "conditioner protocol binding")
        elif source["category"] == "leave_in":
            original = next(r for r in native["entries"] if r["slot"] == ref["formula_key"])
            require(source["directions_record"] == {"text": original["directions_of_use"], "source": original["directions_source"]}, "leave-in protocol binding")
            require([i["canonical_name"] for i in source["ingredients"]] == original["normalized_ingredients"], "native normalization parity")
        else:
            original = next(r for r in native["records"] if r["neutral_id"] == ref["formula_key"])
            require(source["ingredients"] == original["ingredients"] and source["contextual_declarations"] == original["contextual_declarations"], "oil declaration binding")
            require(source["directions_record"]["text"] == original["directions_summary"], "oil protocol binding")
        require(source["raw_inci"] == original["raw_inci"], "original raw declaration parity")
    entries = read("function-dictionary.json")["entries"]
    require(len(entries) == len(names) and {e["canonical_name"] for e in entries} == names, "dictionary coverage")
    require(all(e["roles"] and e["notes"] and e["function_source_refs"] for e in entries), "dictionary functions/provenance")
    definition = ROOT / "docs/research/shared/persistence-potential-v0.1.md"
    require((RUN / "method.md").read_text().startswith(definition.read_text()), "complete method definition")
    seal = read("blind-stage-seal.json")
    lanes = {}
    for lane in ("a", "b"):
        for filename in ("records.json", "notes.json"):
            name = f"lane-{lane}/{filename}"
            require(digest(RUN / name) == seal["lane_output_hashes"][name], "sealed output parity")
        payload = read(f"lane-{lane}/records.json")
        require(set(payload) == {"run_id", "lane", "records"} and payload["run_id"] == "canonical-persistence-pilot-v0.1" and payload["lane"] == lane, "lane identity")
        lanes[lane] = validate_records(payload["records"], packet)
        notes = read(f"lane-{lane}/notes.json")
        require(set(notes) == {"run_id", "lane", "read_inputs", "completed_ids", "recognized_formulas", "access_incidents", "limits"}, "notes fields")
        require(notes["run_id"] == payload["run_id"] and notes["lane"] == lane and len(notes["completed_ids"]) == 6 and set(notes["completed_ids"]) == packet.keys(), "notes identity/completion")
        require(len(notes["read_inputs"]) == 3 and {Path(r["path"]).resolve() for r in notes["read_inputs"]} == {RUN / n for n in READS}, "read allowlist")
        require(all(digest(Path(r["path"])) == r["sha256"] for r in notes["read_inputs"]), "read input hashes")
        require(isinstance(notes["recognized_formulas"], list) and not notes["access_incidents"] and notes["limits"], "access attestations")
    decisions = validate_records(read("research-decisions.json")["records"], packet)
    validate_projection(read("projection.json"), sources, decisions)
    schema = read("projection-schema.json")
    require(set(schema["items"]["properties"]) == {"product_key", "policy_version", "persistence_potential"} and schema["items"]["additionalProperties"] is False and set(schema["items"]["properties"]["persistence_potential"]["enum"]) == VALUES, "declared projection schema")
    with (RUN / "results.csv").open(newline="") as f:
        rows = list(csv.DictReader(f))
    csv_rows = indexed(rows)
    require(len(rows) == 6 and csv_rows.keys() == packet.keys(), "CSV coverage")
    integration = indexed(read("integration-notes.json")["records"])
    require(integration.keys() == packet.keys(), "integration coverage")
    for key, row in csv_rows.items():
        require(row["decision"] == decisions[key]["persistence_potential"] and row["brand"] == sources[key]["identity"]["brand"], "CSV decision/source parity")
        for lane in ("a", "b"):
            require(row[f"lane_{lane}"] == lanes[lane][key]["persistence_potential"], "CSV lane parity")
        selected = integration[key]["selected_from"]
        require(selected in {"a", "b", "root"} and integration[key]["reason"], "integration rationale")
        require(selected == "root" or decisions[key] == lanes[selected][key], "selected payload parity")
    historical = read("historical-preservation.json")
    for name, expected in historical.items():
        require(digest(ROOT / name) == expected, "changed historical file: " + name)
    controls = []
    for label, expected, mutate in [
        ("unknown_class", "committed class", lambda rows: rows[0].update(persistence_potential="unknown")),
        ("dropped_case", "case coverage", lambda rows: rows.pop()),
        ("broken_evidence", "evidence binding", lambda rows: rows[0]["evidence"][0].update(rank=999)),
    ]:
        rows = copy.deepcopy(read("research-decisions.json")["records"])
        mutate(rows)
        try:
            validate_records(rows, packet)
        except ValueError as error:
            require(str(error) == expected, "wrong negative-control guard")
            controls.append(label)
        else:
            raise ValueError("escaped negative control: " + label)
    projection = copy.deepcopy(read("projection.json"))
    projection[0]["confidence"] = "low"
    try:
        validate_projection(projection, sources, decisions)
    except ValueError as error:
        require(str(error) == "projection fields", "confidence control guard")
        controls.append("confidence_field")
    else:
        raise ValueError("confidence field escaped")
    receipt = {"status": "passed", "scope": "Source and output integrity, not measured performance", "cases": 6, "primary_ranks": ranks, "dictionary_identities": len(names), "historical_files_preserved": len(historical), "committed_values": {v: sum(r["persistence_potential"] == v for r in decisions.values()) for v in sorted(VALUES)}, "lane_value_agreement": {"count": sum(lanes["a"][k]["persistence_potential"] == lanes["b"][k]["persistence_potential"] for k in packet), "denominator": 6, "meaning": "repeatability, not accuracy"}, "negative_controls_rejected": controls, "recognized_formulas": {lane: read(f"lane-{lane}/notes.json")["recognized_formulas"] for lane in ("a", "b")}}
    (RUN / "verification-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
