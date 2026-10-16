"""Commit the parent's research judgments and render the local trial report."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
RUN = ROOT / "data/research/oil-inci/v1.0/corpus/holdout/persistence-contrast-v0.1"


def read(name):
    return json.loads((RUN / name).read_text())


def digest(name):
    return hashlib.sha256((RUN / name).read_bytes()).hexdigest()


def write(name, value):
    assert not (RUN / name).exists()
    (RUN / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


sources = read("source-bindings-v0.2.json")["records"]
lane_a = {r["neutral_id"]: r for r in read("lane-a/results.json")["records"]}
lane_b = {r["neutral_id"]: r for r in read("lane-b/results.json")["records"]}
decisions = {
    "PC01": ("high", "A substantive dimethiconol-supported silicone film, with complementary conditioning fluids/emollients, is the stronger complete-system reading. Mobile hydrocarbons/ether do not cancel the film; no grade or amount is inferred.", "The gum meaningfully organizes the retained conditioning coating rather than only modifying product texture."),
    "PC02": ("high", "The dimethicone/dimethiconol conditioning system supports a cohesive retained film within aqueous/solvent delivery. PEG-14 dimethicone and polyquaternium-7 supply complementary conditioning clues, not independently proven adhesive/gum mechanisms. Polyacrylamide remains rheology, and PEG-60 hydrogenated castor oil remains a solubilizer/emulsifier.", "The silicone gum route remains functionally substantive after application; the high reading does not require actual plasticization, particular deposition, or a persistent-film role for every polymer."),
    "PC03": ("moderate", "The exact peanut, wheat-germ and sunflower oil functions support an ordinary retained lipid coat. Lecithin stabilization does not establish an especially cohesive hair film; unassessed extract/aroma contributions remain gaps rather than zero.", "The retained fixed-oil system behaves as ordinary fluid conditioning, with lecithin primarily stabilizing the preparation rather than organizing a persistent coating."),
    "PC04": ("moderate", "The complete ester/alkane and fixed-oil system favors an ordinary retained fluid coat. Hydrogenated coco-glycerides supply a real film-forming/structuring counter-signal, but generic capability does not establish a particularly cohesive whole-film architecture. No late-rank trace assumption, supplier melting grade or percentage is imported.", "The modified glycerides contribute meaningfully within a fluid emollient coating rather than becoming the organizing mechanism of a particularly cohesive film."),
}
records, projection = [], []
for source in sources:
    case = source["neutral_id"]
    value, reason, assumption = decisions[case]
    identity = source["identity"]
    name = identity.get("product_name", identity.get("product"))
    product_key = "|".join([identity["brand"], name, identity["market"], str(identity["size_ml"]) + "ml"])
    records.append({"neutral_id": case, "product_key": product_key, "identity": identity,
                    "persistence_potential": value, "reason": reason,
                    "tipping_assumption": assumption,
                    "source_id": source["source_id"], "direction_id": source["direction_id"],
                    "application_context": source["admitted_neutral_context"],
                    "evidence": lane_a[case]["evidence"],
                    "considered_ranks": lane_a[case]["considered_ranks"],
                    "lane_values": {"a": lane_a[case]["persistence_potential"], "b": lane_b[case]["persistence_potential"]},
                    "lane_result_hashes": {"a": digest("lane-a/results.json"), "b": digest("lane-b/results.json")},
                    "recognition_limit": "Lane A disclosed a tentative unverified identity association, stated unused; keep the disclosure and do not call this case clean model-unfamiliar blind validation." if case == "PC03" else None,
                    "source_limits": source["limits"], "formula_conflicts": source["formula_conflicts"]})
    projection.append({"product_key": product_key, "policy_version": "oil-persistence-boundaries-v0.1", "persistence_potential": value})

write("parent-adjudication.json", {"scope": "Parent source-disclosed adjudication, after both sealed independent formula-only assessments. Parent preliminary readings were recorded before either result was read, not a third blind vote.", "records": records,
      "policy_change_required": False, "critical_owner_decision_required": False,
      "limits": ["Repeatability only, not measured accuracy.", "Project-new exact European source formulas, not established model-level unseen products.", "PC03 lane A tentative recognition disclosure retained; no rerun to obtain a cleaner attestation.", "No full profiles, Lab additions, adapter repins, manual matching approvals, database writes or activation."]})
write("projection.json", projection)
assert not (RUN / "projection.csv").exists()
with (RUN / "projection.csv").open("w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["product_key", "policy_version", "persistence_potential"])
    writer.writeheader()
    writer.writerows(projection)

lines = ["# European oil persistence contrast — results", "", "2026-10-15. **Completed: no critical decision or further rule change required.** New local research under standard v0.9 / guidance v0.3; authoritative trial inputs are the context-complete v0.2 files in `input-manifest-v0.2.json`. Initial preflight inputs remain preserved and were never assessed.", "", "Two independent formula-only assessors agreed **4/4**: **two high, two moderate, zero low**. Parent retained those values after reviewing the complete declarations, exact functions, neighboring readings and assumptions. This measures repeatability, not actual persistence accuracy.", "", "| Product and exact source market | Persistence | Main boundary tested |", "| --- | --- | --- |"]
tests = {
    "PC01": "Mobile delivery does not erase a substantive silicone-gum conditioning system.",
    "PC02": "An aqueous/solvent oil can support high; product rheology and conditioning-film functions remain distinct.",
    "PC03": "Ordinary botanical coating is a positive moderate reading; lecithin stability is not automatically a persistent hair film.",
    "PC04": "A genuine modified-lipid film-forming clue does not automatically make the whole formula high.",
}
for row, source in zip(records, sources):
    i = row["identity"]
    label = i["brand"] + " " + i.get("product_name", i.get("product"))
    lines.append(f"| [{label}]({source['source_url']}) — {i['market']}, {i['size_ml']} ml | **{row['persistence_potential']}** | {tests[row['neutral_id']]} |")
lines += ["", "## Most useful challenge", "", "L’Occitane contains **Hydrogenated Coco-Glycerides**, whose exact-INCI supplier example documents film-forming and viscosity-increasing capability. Both lanes treated this as a real high counter-signal, while choosing moderate from the complete fluid emollient architecture. They did not dismiss it as trace because of position, transfer the supplier grade/melting range, or assume every botanical system must be moderate. Root retained the same interpretation. The specific remaining assumption is whether that modified lipid organizes the finished coating; the ingredient list does not establish this experimentally.", "", "## Independence and coverage limits", "", "- All four are project-new exact product/formula candidates against this local oil corpus: 625 prior JSON files / 87 distinct raw declaration strings checked, no literal matches. Source agents separately checked names/variants. Literal case/whitespace comparison cannot prove chemical equivalence or model-level unfamiliarity. Oil Ultime Rose was already exposed; the Argan product is a distinct formula within that familiar family.", "- **PC03 / Dr. Hauschka:** lane A disclosed a tentative unverified product-identity association and stated it was not pursued or used. Lane B reported no recognition. Retain the 4/4 declared-formula agreement, but do not present all four as clean model-unfamiliar blind validation. No sealed outputs were rewritten or rerun to conceal the incident.", "- Coverage is **89 ordered ranks / 72 exact function identities**, including explicit unassessed functions and unresolved botanical preparation limits. Unknown function never means negligible contribution. No ingredient percentages, exact supplier grades, measured hours, wash counts or repeated-use build-up were inferred.", "- The German Oil Ultime Argan declaration differs from encountered NL/Greek declarations; this trial uses only its matching DE producer/shop identity. Metal Detox uses the independently complete **NL** producer declaration, without German equivalence. Hauschka and L’Occitane have page/size/SKU identity but no verified GTIN in this pass. These are published-source packets, not physical-label batch verification.", "- The four candidates still provide **no low example**. The earlier Mist/Vanishing/Two-Way Mirror search was bounded and disclosed, not an exhaustive shelf audit. Zero low is acceptable; it does not prove no low-persistence oil exists or validate that boundary.", "", "## Disposition and next step", "", "The agreed boundary rules and seven disclosed discussion anchors are documented in the successor guidance; their labels were withheld from both lanes. The existing **37 full profiles and v0.8 Lab/adapter pins remain unchanged**. These four results are persistence-only research, not full intake packages, new database products, matching approvals or publication permission.", "", "Recommended next step: complete source-bound full profiles for selected European candidates under the reviewed current research contract, then deliberately reconcile version pins before any Lab/intake handoff. Keep matching tags under manual review. No additional serial persistence decision is needed from this trial.", "", "Evidence: [parent decisions](parent-adjudication.json), [flat projection](projection.json), [CSV](projection.csv), [final input manifest](input-manifest-v0.2.json), [context correction](context-correction-receipt.json), [lane A](lane-a/results.json), [lane B](lane-b/results.json). Source excerpts, functions, novelty and preservation receipts live in `plans/oil-inci/research/persistence-contrast-2026-10-15/`."]
assert not (RUN / "results-for-review.md").exists()
(RUN / "results-for-review.md").write_text("\n".join(lines) + "\n")
print("Committed four local research judgments; report and scalar projections written.")
