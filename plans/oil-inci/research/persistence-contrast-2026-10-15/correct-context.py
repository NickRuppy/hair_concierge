"""Preserve initial preflight inputs; create the context-complete successor."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
RUN = ROOT / "data/research/oil-inci/v1.0/corpus/holdout/persistence-contrast-v0.1"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(name, value):
    path = RUN / name
    assert not path.exists()
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


contexts = {
    "PC01": "Retained leave-on hair-fibre application; small amount on towel-dried or dry hair; style as usual. No scalp or shampoo-removal assessment.",
    "PC02": "Retained leave-on hair-fibre application; 1–2 pumps warmed in palms, applied from mid-lengths to ends on dry or towel-dried hair; do not rinse, then blow-dry or air-dry. No scalp or shampoo-removal assessment.",
    "PC03": "Retained leave-on hair-fibre application; very small amount on damp or dry ends after washing; do not rinse. No scalp or shampoo-removal assessment.",
    "PC04": "Retained leave-on hair-fibre application; 3–4 drops warmed between hands, applied to lengths and ends of damp or dry hair. No scalp or shampoo-removal assessment; separate overnight pre-wash scenario excluded.",
}
packet = json.loads((RUN / "neutral-packet.json").read_text())
binding = json.loads((RUN / "source-bindings.json").read_text())
changes = []
for row in packet["records"]:
    changes.append({"neutral_id": row["neutral_id"], "before": row["application_context"], "after": contexts[row["neutral_id"]]})
    row["application_context"] = contexts[row["neutral_id"]]
for row in binding["records"]:
    row["admitted_neutral_context"] = contexts[row["neutral_id"]]
write("neutral-packet-v0.2.json", packet)
write("source-bindings-v0.2.json", binding)
method = (RUN / "method.md").read_text().replace("blind method v0.1", "blind method v0.2").replace("`neutral-packet.json`", "`neutral-packet-v0.2.json`")
method += "\nPre-dispatch context revision: every record carries its source-stated qualitative amount/unit and application site where established; do not convert pumps/drops to absolute amounts or use dose as a standalone persistence class. Initial v0.1 preflight inputs remain preserved and were never assessed.\n"
assert not (RUN / "method-v0.2.md").exists()
(RUN / "method-v0.2.md").write_text(method)
manifest = json.loads((RUN / "input-manifest.json").read_text())
manifest["input_revision"] = "v0.2"
manifest["supersedes_preflight_manifest_sha256"] = digest(RUN / "input-manifest.json")
manifest["allowed_blind_inputs"] = {name: digest(RUN / name) for name in ["method-v0.2.md", "neutral-packet-v0.2.json", "function-dictionary.json"]}
manifest["source_bindings_sha256"] = digest(RUN / "source-bindings-v0.2.json")
write("input-manifest-v0.2.json", manifest)
write("context-correction-receipt.json", {"stage": "before any blind assessment", "reason": "Source application-context parity across all four formulas; no chemical or policy change, dose conversion or persistence prediction.", "changes": changes, "original_inputs_preserved": True})
print("Context-complete v0.2 inputs frozen; original unassessed preflight preserved.")
