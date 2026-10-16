# Shared persistence potential v0.1

Local draft contract, approved architecture on 2026-10-07. Applies to the accompanying six-case pilot; category standards remain their existing authorities until explicitly integrated.

**Question:** how persistent a conditioning coating does the complete formula plausibly leave on hair under its intended application? This is a committed qualitative research judgment. It does not score sensory weight or establish accumulation across repeated applications and washes.

| Value | Working anchor |
| --- | --- |
| `low` | A less persistent coating is the better whole-formula reading: a mainly mobile/dispersible remainder with little affirmative support for a coherent persistent conditioning film. Consider all retained components; generic spreading or a volatile vehicle does not cancel a film. |
| `moderate` | A retained conditioning coating is the better reading, but its architecture favors ordinary fluid/lipid or removable conditioner residue over a particularly persistent cohesive/adherent film. This is a positive middle judgment, never uncertainty encoded as a class. |
| `high` | The whole conditioning architecture favors a more persistent coating through a coherent gum/polymer/adherent or structured conditioning-film route. Challenge whether a polymer is really conditioning architecture, merely rheology, an auxiliary or an insufficient isolated clue. Presence and rank alone do not establish high. |

## One decision, one value

For every complete source-scoped product, choose `low`, `moderate` or `high`. No confidence, unknown, indeterminate, abstention class or confidence-based computational gate. When evidence is close, compare the neighboring readings and make the best judgment; put the tipping assumption in one short research reason. Changing an answer later creates a new policy/decision revision.

Use the complete exact declaration and admitted material functions, including grade/derivative/plant-part distinctions. Rank is order only; no amount, top-N threshold, 1% boundary or point count. Exact constituent priors are clues, not blend answers. No automatic “all oils are low,” “all silicones are high,” weight-to-persistence rule or promotion from an unassessed auxiliary.

Application context is part of the research input: rinse-out, retained damp/dry hair care or shampooed pre-wash. A rinsed product's judgment concerns its likely post-rinse coating; a retained product's judgment concerns its applied conditioning remainder. Context does not provide a measured removal factor or guarantee. Classification should not speculate about individual washing schedules or scalp tolerance.

The common reference describes exact ingredient identity and relevant functions, not universal finished-product values. Category-specific material readings provide evidence; this shared definition owns the output meaning. Prior Conditioner cumulative residue risk and Leave-In mechanism scores remain their distinct source facts. No automatic conversion of indeterminate to moderate, binary elevated to high, or neutral-non-volatile to moderate.

## Computational contract

`persistence_potential: "low" | "moderate" | "high"` is one plain value. The flat pilot projection contains product key and policy version for identity/provenance; no auxiliary field changes how the value is consumed.

Research reasons and exact ingredient references live in a separate decision record. They explain the commitment; computation does not parse them or branch on uncertainty language. Broken/missing identity or declarations must be repaired before a product enters a classification run, rather than encoded as an extra property value.

Evidence basis: current internal [Conditioner direct-property distinctions](../conditioner-inci/v1.0/conditioner-classification-standard.md), [Leave-In PERS mechanism interpretation](../leave-in-inci/v1.0/leave-in-classification-standard.md), and [Oil residual-system guidance](../oil-inci/v1.0/08_build-up-guidance-v0.3.md). These working anchors are a harmonization proposal tested on existing declarations, not newly established material constants or measured washout behaviour.

## Frozen pilot read/output contract

The independent research output is records.json with exactly run_id, lane and records. Each record contains exactly case_id, persistence_potential, reason, evidence, considered_ranks. Evidence is a nonempty array of {rank, canonical_name} exact matches. considered_ranks lists every primary ingredient rank exactly once in declaration order. reason is a nonempty short whole-system explanation including the tipping interpretation. No confidence, estimate, unknown, indeterminate, alternative or incomplete-value state.
notes.json contains exactly run_id, lane, read_inputs, completed_ids, recognized_formulas, access_incidents, limits. read_inputs lists all and only the three absolute allowed paths with sha256. Report any product recognition without browsing or using prior values. Write only the assigned lane directory. Do not follow links, read identity packets/native answers, browse, invoke other tools for unrelated files, inspect AGENTS/README or spawn agents/reviewers. Work only from frozen inputs.
