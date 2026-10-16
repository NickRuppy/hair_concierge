"""Build source-bound, label-free local research inputs; never writes existing runs."""
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[4]
PLAN = pathlib.Path(__file__).resolve().parent
RUN = ROOT / "data/research/oil-inci/v1.0/corpus/holdout/persistence-contrast-v0.1"
POLICY = "oil-persistence-boundaries-v0.1"


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    assert not path.exists(), f"Preserve previously prepared artifact: {path}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def norm(text):
    return re.sub(r"\s+", " ", text).strip().upper()


def literal_formula(text):
    return norm(text).rstrip(".")


# Only optional source-provided common-name/alternate-language descriptors are
# removed. Scientific identity, plant part and derivative remain unchanged.
ALIASES = {
    "PARFUM/FRAGRANCE": "PARFUM",
    "PARFUM / FRAGRANCE": "PARFUM",
    "PARFUM (FRAGRANCE)": "PARFUM",
    "AQUA / WATER": "AQUA",
    "HELIANTHUS ANNUUS (SUNFLOWER) SEED OIL": "HELIANTHUS ANNUUS SEED OIL",
    "HELIANTHUS ANNUUS (SUNFLOWER) SEED EXTRACT": "HELIANTHUS ANNUUS SEED EXTRACT",
    "RICINUS COMMUNIS (CASTOR) SEED OIL": "RICINUS COMMUNIS SEED OIL",
    "PRUNUS AMYGDALUS DULCIS (SWEET ALMOND) OIL": "PRUNUS AMYGDALUS DULCIS OIL",
    "CITRUS AURANTIUM DULCIS (ORANGE) PEEL OIL": "CITRUS AURANTIUM DULCIS PEEL OIL",
    "LAVANDULA ANGUSTIFOLIA (LAVENDER) OIL": "LAVANDULA ANGUSTIFOLIA OIL",
    "GLYCINE SOJA (SOYBEAN) OIL": "GLYCINE SOJA OIL",
    "CI 40800 (BETA-CAROTENE)": "CI 40800",
    "CI 19140 / YELLOW 5": "CI 19140",
    "CI 15985 / YELLOW 6": "CI 15985",
}


def canonical(raw):
    # Asterisk marks a source footnote, not an ingredient or plant-part change.
    clean = norm(raw.rstrip("*").strip())
    return ALIASES.get(clean, clean)


def ingredients(raw):
    text = raw.strip().removesuffix(".")
    separator = " • " if "•" in text else " - " if " - " in text else ", "
    parts = [p.strip() for p in text.split(separator)]
    assert all(parts)
    return [{"rank": i, "raw_name": name, "canonical_name": canonical(name)}
            for i, name in enumerate(parts, 1)]


def extract_formulas(value, path, pointer=""):
    found = []
    if isinstance(value, dict):
        for key, item in value.items():
            at = f"{pointer}/{key}"
            if key in {"raw_inci", "primary_inci", "inci_raw"} and isinstance(item, str) and item.strip():
                found.append((literal_formula(item), {"path": path, "pointer": at}))
            else:
                found.extend(extract_formulas(item, path, at))
    elif isinstance(value, list):
        for i, item in enumerate(value):
            found.extend(extract_formulas(item, path, f"{pointer}/{i}"))
    return found


def main():
    baseline = read(PLAN / "historical-preservation.json")
    exposed = {}
    scanned = 0
    for rel in baseline["files"]:
        p = ROOT / rel
        if p.suffix != ".json":
            continue
        try:
            value = read(p)
        except json.JSONDecodeError:
            continue
        scanned += 1
        for formula, origin in extract_formulas(value, rel):
            exposed.setdefault(formula, []).append(origin)

    a = read(PLAN / "source-a/candidates.json")["candidates"]
    b = read(PLAN / "source-b/candidates.json")["candidates"]
    supplements = [read(PLAN / f"source-{lane}/function-supplement.json") for lane in "ab"]
    # Admitted prior functions, never prior product or material class labels.
    prior_paths = [
        "data/research/oil-inci/v1.0/corpus/exploratory/persistence-replay-v0.1/function-dictionary.json",
        "data/research/oil-inci/v1.0/corpus/holdout/blend-contrast-v0.1/function-dictionary.json",
    ]
    prior = {}
    observations = {}
    for rel in prior_paths:
        for entry in read(ROOT / rel)["entries"]:
            name = canonical(entry["canonical_name"])
            observations.setdefault(name, []).append({"source": rel, "entry": entry})
            prior.setdefault(name, entry)
    fresh = {}
    for lane, supplement in zip("ab", supplements):
        rows = supplement.get("entries", supplement.get("rank_bound_functions", []))
        for entry in rows:
            name = canonical(entry["canonical_name"])
            observations.setdefault(name, []).append({"source": f"source-{lane}/function-supplement.json", "entry": entry})
            # Fresh exact primary function evidence augments rather than erases
            # earlier roles. Missing function is never interpreted as absence.
            fresh.setdefault(name, []).append(entry)

    packet, source_records, normalizations = [], [], []
    novelty = []
    for index, candidate in enumerate(a + b, 1):
        neutral_id = f"PC{index:02}"
        source_key = candidate.get("product_key", candidate.get("candidate_id"))
        ing = ingredients(candidate["raw_inci"])
        identity = candidate["identity"]
        assert identity["market"] in {"DE", "NL", "FR"}
        formula = literal_formula(candidate["raw_inci"])
        matches = exposed.get(formula, [])
        assert not matches, (source_key, matches)
        novelty.append({"neutral_id": neutral_id, "source_key": source_key,
                        "raw_normalized_sha256": hashlib.sha256(formula.encode()).hexdigest(),
                        "literal_matches": matches,
                        "named_exposure_review": candidate.get("novelty_check", "Source-b recorded no prior local name/source matches; root confirmed name inventory.")})
        direction = candidate.get("directions_exact_excerpt", candidate.get("directions_exact"))
        assert direction
        context = "Retained leave-on hair-fibre conditioning; damp or dry hair. No scalp or shampoo-removal assessment."
        if source_key == "PSB01":
            context = "Retained leave-on hair-fibre conditioning; very small amount on damp or dry ends after washing. No scalp or shampoo-removal assessment."
        packet.append({"neutral_id": neutral_id, "ingredients": ing,
                       "application_context": context,
                       "contextual_declarations": ["Asterisks identify constituents from natural essential oils; not extra ingredients."] if source_key == "PSB01" else []})
        source_records.append({"neutral_id": neutral_id, "source_key": source_key,
                               "identity": identity, "raw_inci": candidate["raw_inci"],
                               "source_url": candidate.get("source_url", identity.get("producer_url")),
                               "source_id": candidate["formula_source_id"],
                               "direction_id": candidate.get("direction_source_id", candidate.get("use_source_id")),
                               "selected_direction": direction,
                               "admitted_neutral_context": context,
                               "limits": candidate.get("source_limits", candidate.get("limits", [])),
                               "formula_conflicts": candidate.get("formula_conflicts", [])})
        for item in ing:
            normalizations.append({"neutral_id": neutral_id, **item,
                                   "reason": "Literal uppercase/whitespace normalization; source asterisk removed as footnote marker; only explicitly listed source descriptor/alternate-language aliases applied."})

    selected_names = sorted({i["canonical_name"] for row in packet for i in row["ingredients"]})
    dictionary, provenance = [], []
    for i, name in enumerate(selected_names, 1):
        source_id = f"F{i:03}"
        old = prior.get(name)
        newer = fresh.get(name, [])
        roles = list(dict.fromkeys(role for e in ([old] if old else []) + newer for role in e.get("roles", [])))
        notes = list(dict.fromkeys(note for e in ([old] if old else []) + newer
                                  for note in [e.get("notes"), e.get("limits")] if note))
        if not roles:
            roles = ["not_assessed"]
            notes.append("Exact function not assessed. Contribution is not assumed negligible; do not infer a film, preparation or persistence class from the name.")
        if name == "DIMETHICONE":
            notes.append("The INCI spans different grades, including low-viscosity volatile fluids and high-molecular-weight conditioning material. The finished-product grade is undisclosed; do not assume universal nonvolatility, gum structure or substantial residue.")
        if name == "HYDROGENATED COCO-GLYCERIDES":
            notes.append("Generic exact-INCI film-forming capability is admitted; supplier grade melting range and concentration must not be transferred to this formula. It is neither intact coconut oil nor automatic high persistence.")
        dictionary.append({"canonical_name": name, "roles": roles, "notes": notes, "source_ids": [source_id]})
        provenance.append({"source_id": source_id, "canonical_name": name,
                           "observations": observations.get(name, []),
                           "resolution": "Retain reviewed exact generic roles and all limits; no grade, amount, material label or product label transfer."})

    write(RUN / "neutral-packet.json", {"packet_id": "oil-persistence-eu-contrast-v0.1", "records": packet})
    write(RUN / "function-dictionary.json", {"scope": "Exact generic functions only; sources are opaque identifiers bound outside the blind lane. No product/material labels or exact finished grades/amounts.", "entries": dictionary})
    write(RUN / "source-bindings.json", {"records": source_records})
    write(PLAN / "normalization-receipt.json", {"aliases": ALIASES, "rows": normalizations})
    write(PLAN / "function-provenance.json", {"entries": provenance, "primary_supplement_sources": [s["sources"] for s in supplements]})
    write(PLAN / "formula-exposure-check.json", {"prior_json_files_scanned": scanned,
          "distinct_prior_raw_formula_strings": len(exposed), "candidates": novelty,
          "normalization": "Case/whitespace/terminal period only; source separators and chemical aliases are not equated. Identity/family exposure reviewed separately.",
          "limits": "Project-new exact product/formula checks do not establish model-level unfamiliarity, chemical equivalence or exhaustive market coverage. Oil Ultime Rose was previously exposed; Argan is a distinct product/formula within that familiar family."})
    dependencies = prior_paths + [f"docs/research/oil-inci/v1.0/{n}" for n in [
        "02_classification-standard-v0.9.md", "10_persistence-guidance-v0.3.md", "11_operating-guide-v0.3.md"]]
    input_files = ["method.md", "neutral-packet.json", "function-dictionary.json"]
    all_source_files = [p for lane in "ab" for p in sorted((PLAN / f"source-{lane}").glob("*")) if p.is_file()]
    write(RUN / "input-manifest.json", {"policy_version": POLICY,
          "allowed_blind_inputs": {n: digest(RUN / n) for n in input_files},
          "dependencies": {n: digest(ROOT / n) for n in dependencies},
          "source_bindings_sha256": digest(RUN / "source-bindings.json"),
          "source_receipts": {p.relative_to(ROOT).as_posix(): digest(p) for p in all_source_files},
          "records": len(packet), "ranks": sum(len(r["ingredients"]) for r in packet),
          "unique_exact_functions": len(dictionary), "freeze_stage": "before_blind_assessment"})
    print(json.dumps({"records": len(packet), "ranks": sum(len(r["ingredients"]) for r in packet),
                      "unique_names": len(dictionary), "not_assessed": [e["canonical_name"] for e in dictionary if "not_assessed" in e["roles"]]}))


if __name__ == "__main__":
    main()
