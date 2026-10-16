"""Bounded research-artifact verification; no application, database or runtime writes."""
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PLAN = Path(__file__).resolve().parent
RUN = ROOT / "data/research/oil-inci/v1.0/corpus/holdout/persistence-contrast-v0.1"


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


manifest = read(RUN / "input-manifest-v0.2.json")
for name, expected in manifest["allowed_blind_inputs"].items():
    assert digest(RUN / name) == expected, name
for name, expected in {**manifest["dependencies"], **manifest["source_receipts"]}.items():
    assert digest(ROOT / name) == expected, name
assert digest(RUN / "source-bindings-v0.2.json") == manifest["source_bindings_sha256"]
assert digest(RUN / "input-manifest.json") == manifest["supersedes_preflight_manifest_sha256"]

packet = {r["neutral_id"]: r for r in read(RUN / "neutral-packet-v0.2.json")["records"]}
sources = {r["neutral_id"]: r for r in read(RUN / "source-bindings-v0.2.json")["records"]}
functions = {r["canonical_name"]: r for r in read(RUN / "function-dictionary.json")["entries"]}
assert len(packet) == len(sources) == 4
assert sum(len(r["ingredients"]) for r in packet.values()) == 89
assert len(functions) == 72
assert all(r["identity"]["market"] in {"DE", "NL", "FR"} for r in sources.values())
for key, record in packet.items():
    assert record["application_context"] == sources[key]["admitted_neutral_context"]
    assert sources[key]["selected_direction"] and sources[key]["source_id"] and sources[key]["direction_id"]
    assert [x["rank"] for x in record["ingredients"]] == list(range(1, len(record["ingredients"]) + 1))
    assert all(i["canonical_name"] in functions for i in record["ingredients"])

values, recognition = {}, {}
for lane in "ab":
    output = read(RUN / f"lane-{lane}/results.json")
    seal = read(RUN / f"lane-{lane}/seal.json")
    assert output["policy_version"] == "oil-persistence-boundaries-v0.1"
    assert {i["filename"]: i["sha256"] for i in seal["allowed_inputs"]} == manifest["allowed_blind_inputs"]
    assert seal["results"]["filename"] == f"lane-{lane}/results.json"
    assert seal["results"]["sha256"] == digest(RUN / f"lane-{lane}/results.json")
    assert seal["completed_ids"] == list(packet)
    assert seal["access_incidents"] in ("none", ["none"])
    recognition[lane] = seal["recognition_incidents"]
    assert len(output["records"]) == 4
    values[lane] = {}
    for record in output["records"]:
        key = record["neutral_id"]
        assert key not in values[lane]
        value = record["persistence_potential"]
        assert isinstance(value, str) and value in {"low", "moderate", "high"}
        assert not {"confidence", "estimate", "alternatives", "weight", "fit"} & record.keys()
        values[lane][key] = value
        expected = packet[key]["ingredients"]
        assert record["considered_ranks"] == [i["rank"] for i in expected]
        ledger = record["ingredient_ledger"]
        assert len(ledger) == len(expected)
        for row, ingredient in zip(ledger, expected):
            assert all(row[k] == ingredient[k] for k in ["rank", "raw_name", "canonical_name"])
            assert row["dictionary_roles"] == functions[ingredient["canonical_name"]]["roles"]
            assert row["formula_role"] in {"principal", "secondary", "auxiliary", "unresolved"}
            assert row["role_reason"] and row["ambiguity"]
        for evidence in record["evidence"]:
            ingredient = expected[evidence["rank"] - 1]
            assert evidence["canonical_name"] == ingredient["canonical_name"]
            if "raw_name" in evidence:
                assert evidence["raw_name"] == ingredient["raw_name"]
        assert set(record["neighbor_comparison"]) == {"low", "moderate", "high"}
        assert record["reason"] and record["tipping_assumption"]
        context = record.get("research_context", record)
        assert context["application_context"] == packet[key]["application_context"]
        assert context["contextual_declarations"] == packet[key]["contextual_declarations"]

parent = read(RUN / "parent-adjudication.json")
projection = read(RUN / "projection.json")
assert len(parent["records"]) == len(projection) == 4
for row, flat in zip(parent["records"], projection):
    assert set(flat) == {"product_key", "policy_version", "persistence_potential"}
    assert row["product_key"] == flat["product_key"]
    assert row["persistence_potential"] == flat["persistence_potential"]
    assert flat["policy_version"] == output["policy_version"]
    assert row["lane_values"] == {lane: values[lane][row["neutral_id"]] for lane in "ab"}
    assert row["application_context"] == packet[row["neutral_id"]]["application_context"]
    if row["neutral_id"] == "PC03":
        assert row["recognition_limit"]
with (RUN / "projection.csv").open() as f:
    assert list(csv.DictReader(f)) == projection

preserved = read(PLAN / "historical-preservation.json")["files"]
assert all(digest(ROOT / name) == sha for name, sha in preserved.items())
authorized = {".agents/skills/product-research-engine/SKILL.md", "docs/research/README.md", "docs/research/oil-inci/README.md"}
implementation_mismatches = []
old_lines = (ROOT / "plans/oil-inci/lab-implementation-content-manifest-2026-10-13.sha256").read_text().splitlines()
for line in old_lines:
    name, sha = line.split("\t")
    if digest(ROOT / name) != sha:
        implementation_mismatches.append(name)
assert set(implementation_mismatches) == authorized

new_docs = [ROOT / "docs/research/oil-inci/v1.0" / name for name in [
    "02_classification-standard-v0.9.md", "10_persistence-guidance-v0.3.md", "11_operating-guide-v0.3.md",
    "01_property-set-v0.3.md", "00_category-charter-v0.3.md", "12_persistence-boundaries-v0.1.md"]]
link_count = 0
for path in new_docs + [RUN / "results-for-review.md", PLAN / "completion.md", ROOT / "docs/research/oil-inci/README.md"]:
    content = path.read_text()
    if path.name == "README.md":
        content = content.split("\n\n", 1)[0]  # Newly updated authority paragraph only.
    for target in re.findall(r"\]\(([^)]+)\)", content):
        if target.startswith(("https://", "http://", "#")):
            continue
        assert (path.parent / target.split("#")[0]).exists(), (path, target)
        link_count += 1

receipt = {
    "verdict": "PASS", "command": "python3 plans/oil-inci/research/persistence-contrast-2026-10-15/verify.py",
    "records": 4, "ranks_per_lane": 89, "unique_exact_names": 72,
    "declared_formula_agreement": {"numerator": sum(values["a"][k] == values["b"][k] for k in packet), "denominator": 4},
    "parent_classes": dict(Counter(x["persistence_potential"] for x in projection)),
    "recognition_incidents": recognition, "historical_research_paths_preserved": len(preserved),
    "prior_implementation_paths_checked": len(old_lines), "authorized_routing_doc_changes": implementation_mismatches,
    "application_code_and_existing_profiles_unchanged": True,
    "relative_document_links_checked": link_count,
    "checks": ["final input, source receipt and normative dependency hashes", "full rank/name/function/context parity", "sealed independent outputs", "closed scalar shapes and source-bound parent projection", "CSV parity", "prior research preservation", "existing implementation receipt unchanged except authorized routing docs", "local document links"],
    "limits": ["Repeatability only; no measured accuracy.", "PC03 lane A recognition disclosure retained; not four clean model-unfamiliar cases.", "No low coverage demonstrated.", "Data/document-only QA; no new application suite/typecheck/build or live database check required or performed."]}
(RUN / "verification.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"verdict": receipt["verdict"], "agreement": receipt["declared_formula_agreement"], "classes": receipt["parent_classes"], "historical_paths": len(preserved), "implementation_paths": len(old_lines)}))
