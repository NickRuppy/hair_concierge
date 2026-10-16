"""Check frozen round-8 evidence and independent output integrity, not efficacy."""
import copy
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "data/research/oil-inci/v1.0/corpus/exploratory/build-up-round-8"
READS = {"method.md", "blind-packet.json", "blind-lexicon.json", "natural-oil-build-up-v0.1.json"}


def read(name):
    return json.loads((RUN / name).read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def indexed(records):
    result = {r["neutral_id"]: r for r in records}
    require(len(result) == len(records), "duplicate neutral ID")
    return result


def validate_lane(payload, lane, packet, dictionary):
    require(payload["run_id"] == "oil-build-up-round-8" and payload["lane"] == lane, "wrong lane/run")
    records = indexed(payload["records"])
    require(records.keys() == packet.keys(), "missing/extra output case")
    for key, record in records.items():
        expected = packet[key]["ingredients"]
        ledger = record["ingredient_ledger"]
        require(len(ledger) == len(expected), "ingredient rank coverage")
        for row, ingredient in zip(ledger, expected):
            require(all(row[k] == ingredient[k] for k in ("rank", "raw_name", "canonical_name")), "ingredient rank/name parity")
            require(row["roles"] == dictionary[row["canonical_name"]]["roles"], "dictionary role parity")
            require(row["formula_role"] in {"principal", "secondary", "auxiliary", "unresolved"}, "invalid formula role")
            require(isinstance(row["role_reason"], str) and row["role_reason"].strip(), "missing role reason")
        require(isinstance(record["residual_architecture"], str) and record["residual_architecture"].strip(), "missing architecture")
        p = record["build_up_potential"]
        require(set(p) == {"value", "estimate", "confidence", "evidence", "counter_signal", "nearest_alternative", "reason", "unresolved"}, "property fields")
        require(p["value"] in {"low", "elevated"}, "binary build-up value")
        require(p["estimate"] is True and p["confidence"] == "low", "estimate/confidence policy")
        opposite = "low" if p["value"] == "elevated" else "elevated"
        require(p["nearest_alternative"] == opposite, "opposite binary alternative")
        require(isinstance(p["reason"], str) and p["reason"].strip(), "missing classification reason")
        require(isinstance(p["counter_signal"], list) and p["counter_signal"] and all(isinstance(v, str) and v.strip() for v in p["counter_signal"]), "missing counter-signals")
        require(isinstance(p["unresolved"], list) and all(isinstance(v, str) and v.strip() for v in p["unresolved"]), "invalid uncertainty metadata")
        require(isinstance(p["evidence"], list) and p["evidence"], "missing evidence")
        names = {i["rank"]: i["canonical_name"] for i in expected}
        for e in p["evidence"]:
            require(names.get(e["rank"]) == e["canonical_name"], "evidence rank/name parity")
    return records


def validate_manifest(manifest):
    require(set(manifest["run_inputs"]) == {"source-packet.json", "normalization-audit.json", "function-evidence.json", "method.md", "blind-packet.json", "blind-lexicon.json", "natural-oil-build-up-v0.1.json", "novelty-audit.json", "historical-preservation.json"}, "manifest input coverage")
    for name, expected in manifest["run_inputs"].items():
        require(digest(RUN / name) == expected, "changed frozen input: " + name)
    for name, expected in manifest["dependencies"].items():
        require(digest(ROOT / name) == expected, "changed method dependency: " + name)


def main():
    manifest = read("input-manifest.json")
    validate_manifest(manifest)
    packet = indexed(read("blind-packet.json")["records"])
    sources = indexed(read("source-packet.json")["records"])
    require(len(packet) == 4 and packet.keys() == sources.keys(), "four-slot accounting")
    dictionary_list = read("blind-lexicon.json")["entries"]
    dictionary = {e["canonical_name"]: e for e in dictionary_list}
    require(len(dictionary) == len(dictionary_list), "duplicate dictionary entry")
    names = set()
    audit = read("normalization-audit.json")["entries"]
    audit_lookup = {(r["neutral_id"], r["rank"]): r for r in audit}
    ranks = 0
    for key, record in packet.items():
        require(record["eligible"] is True and sources[key]["eligible"] is True, "category eligibility")
        for field in ("raw_inci", "primary_inci", "ingredients", "contextual_declarations"):
            require(record[field] == sources[key][field], "source/blind declaration parity")
        raw_names = [v.strip() for v in record["primary_inci"].split(",")]
        require(len(raw_names) == len(record["ingredients"]), "literal declaration coverage")
        for rank, ingredient in enumerate(record["ingredients"], 1):
            require(ingredient["rank"] == rank and ingredient["raw_name"] == raw_names[rank - 1], "literal rank/name coverage")
            require(all(audit_lookup[(key, rank)][k] == ingredient[k] for k in ("rank", "raw_name", "canonical_name")), "normalization audit parity")
            names.add(ingredient["canonical_name"])
            ranks += 1
    require(names == dictionary.keys(), "exact dictionary coverage")
    require(len(audit_lookup) == len(audit) == ranks, "normalization audit coverage")
    novelty = indexed(read("novelty-audit.json")["records"])
    require(novelty.keys() == packet.keys() and all(r["fresh_finished_formula"] and not r["identical_prior_declaration_paths"] for r in novelty.values()), "new-formula scope")
    lanes = {}
    seal = read("blind-stage-seal.json")
    for lane in ("a", "b"):
        for filename in ("records.json", "notes.json"):
            name = f"lane-{lane}/{filename}"
            require(digest(RUN / name) == seal["lane_output_hashes"][name], "changed sealed lane output")
        lanes[lane] = validate_lane(read(f"lane-{lane}/records.json"), lane, packet, dictionary)
        notes = read(f"lane-{lane}/notes.json")
        require(notes["run_id"] == "oil-build-up-round-8" and notes["lane"] == lane, "notes lane/run")
        require(len(notes["completed_ids"]) == 4 and set(notes["completed_ids"]) == packet.keys(), "notes completion")
        inputs = notes["read_inputs"]
        require(len(inputs) == len(READS) and {Path(e["path"]).resolve() for e in inputs} == {RUN / n for n in READS}, "read allowlist")
        for e in inputs:
            require(digest(Path(e["path"])) == e["sha256"], "read input digest")
        require(isinstance(notes["recognized_formulas"], list) and isinstance(notes["access_incidents"], list) and notes["limits"], "read attestations")
        for item in notes["recognized_formulas"]:
            require(item["neutral_id"] in packet and item["details"], "recognition accounting")
        require(not notes["access_incidents"], "blind access incident requires explicit review")
    metrics = {
        "case_count": 4,
        "assessment_count": 8,
        "binary_completion_count": 8,
        "value_agreement_count": sum(lanes["a"][k]["build_up_potential"]["value"] == lanes["b"][k]["build_up_potential"]["value"] for k in packet),
        "value_agreement_denominator": 4,
        "classes_by_lane": {lane: {v: sum(r["build_up_potential"]["value"] == v for r in rows.values()) for v in ("low", "elevated")} for lane, rows in lanes.items()},
    }
    require(read("metrics.json") == metrics, "recomputed metrics parity")
    working = indexed(read("working-records.json")["records"])
    require(working.keys() == packet.keys(), "working case accounting")
    with (RUN / "results.csv").open(newline="") as f:
        rows = list(csv.DictReader(f))
    require(len(rows) == 4 and {r["neutral_id"] for r in rows} == packet.keys(), "CSV case accounting")
    for row in rows:
        key = row["neutral_id"]
        w = working[key]
        require(w["identity"] == sources[key]["identity"] and w["source_url"] == sources[key]["source_url"], "unblind identity parity")
        require(w["status"] == "provisional_research_estimate_not_human_adjudicated", "research approval boundary")
        for lane in ("a", "b"):
            value = lanes[lane][key]["build_up_potential"]["value"]
            require(w["lane_values"][lane] == row[f"lane_{lane}"] == value, "CSV/lane/working value parity")
        selected = w["selected_lane"]
        require(selected in lanes and w["build_up_potential"] == lanes[selected][key]["build_up_potential"], "integrated payload preservation")
        require(row["recommendation"] == w["build_up_potential"]["value"] and w["selection_reason"], "recommendation parity")
    historical = read("historical-preservation.json")
    for name, expected in historical.items():
        require(digest(ROOT / name) == expected, "changed historical artifact: " + name)
    # These controls protect evidence/output gates against credible corruptions.
    controls = []
    mutations = [
        ("unknown_output", "binary build-up value", lambda p: p["records"][0]["build_up_potential"].update(value="unknown")),
        ("missing_rank", "ingredient rank coverage", lambda p: p["records"][0]["ingredient_ledger"].pop()),
        ("wrong_evidence_name", "evidence rank/name parity", lambda p: p["records"][0]["build_up_potential"]["evidence"][0].update(canonical_name="UNRELATED MATERIAL")),
    ]
    for label, expected, mutate in mutations:
        payload = copy.deepcopy(read("lane-a/records.json"))
        mutate(payload)
        try:
            validate_lane(payload, "a", packet, dictionary)
        except ValueError as e:
            require(str(e) == expected, "mutation rejected at wrong guard")
            controls.append(label)
        else:
            raise ValueError("mutation escaped: " + label)
    bad_manifest = copy.deepcopy(manifest)
    bad_manifest["run_inputs"]["method.md"] = "0" * 64
    try:
        validate_manifest(bad_manifest)
    except ValueError as e:
        require(str(e) == "changed frozen input: method.md", "manifest control wrong guard")
        controls.append("changed_input")
    else:
        raise ValueError("changed input escaped")
    receipt = {"status": "passed", "checks": "Frozen source/input/lane integrity, complete binary metadata, independent-read attestations, metrics and CSV parity; not measured accuracy", "primary_ranks": ranks, "exact_dictionary_names": len(names), "historical_files_preserved": len(historical), "mutation_controls_rejected": controls, "metrics": metrics, "recognized_formulas": {lane: read(f"lane-{lane}/notes.json")["recognized_formulas"] for lane in ("a", "b")}, "command": "python3 plans/oil-inci/verify-build-up-round-8.py"}
    (RUN / "verification-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({k: v for k, v in receipt.items() if k not in {"metrics", "recognized_formulas"}}))


if __name__ == "__main__":
    main()
