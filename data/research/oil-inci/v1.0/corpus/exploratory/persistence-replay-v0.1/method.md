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

# Oil persistence guidance v0.2

Confirmed scope (2026-10-09): oil only; persistence is assessed for source-supported leave-on fibre application. Pre-wash removal does not determine this value. Other category standards/adapters remain unchanged. This successor preserves the earlier prepared contract.
2026-10-09. The [shared persistence contract](../../shared/persistence-potential-v0.1.md) owns the endpoint and three values. This supersedes binary build-up for new oil research under [standard v0.8](02_classification-standard-v0.8.md); historical standards, priors and records remain reproducible. It introduces no weight/fit, repair, cleansing schedule, wash-count or measured repeated-accumulation rule.

1. Admit one exact complete declaration, its source-scoped product key and an explicit source-supported leave-on fibre application context before classification. The judgment concerns the retained coating for source-supported leave-on fibre use only. Nick selected leave-on on 2026-10-09 and excluded pre-wash removal from this property. Do not classify post-shampoo persistence or assign low merely because a product is washed out. Pre-wash/scalp-only declarations stay outside this property run; they retain their other research facts and are not assigned a fourth persistence class. Do not infer a shampoo step, fibre use or overnight permission from a scalp instruction. The chosen context and source belong in research provenance, not another consumer property or unknown output value. A missing declaration/context is an admission problem to repair first.
2. Freeze a source-neutral packet containing every ordered primary ingredient and separate contextual footnotes, plus the admitted neutral use context. Strip brands, identities, marketing/claims, earlier product labels and material weight/build-up values. Retain exact grade/derivative/plant-part distinctions and reviewed functions. An unreviewed function is not evidence of negligible contribution or high persistence. Do not expand fragrance footnotes into ranked parent-formula ingredients.
3. Judge all retained components as a system. Use the shared low/moderate/high anchors, challenge the neighboring readings, and commit the best value. Moderate positively describes ordinary retained coating. A mobile vehicle cannot cancel a substantive film; one polymer cannot establish a cohesive conditioning film on its own. No count, rank threshold, percentage, strongest-ingredient rule or universal botanical/silicone mapping.
4. Emit `persistence_potential` as one scalar. Do not emit confidence, estimate, unknown, indeterminate, alternatives or conditional gates for this property. Keep the reason, exact rank/name evidence, all considered ranks and admitted context/source in a separate research trace. Borderline assumptions can be described in ordinary prose without changing computation.
5. Preserve earlier binary labels solely as history. An old whole-oil binary prior is not a canonical persistence answer. Any material-function evidence reused from earlier work must be stripped of finished-product answers and binary value fields. Version a changed judgment; never rewrite a frozen run.
6. Two independent lanes read only the declared frozen method, neutral packet and exact-function dictionary. Seal all outputs before parent comparison/adjudication. The parent commits one value per admitted source-scoped product, retains reasons for disagreements and emits a flat projection with exactly product_key, policy_version and persistence_potential. Agreement measures repeatability only.

The standard requires explicit context admission. The selected reference context is source-supported leave-on fibre use. For dual-use oils select their retained fibre scenario and preserve pre-wash directions separately; they do not change this value. Purely pre-wash/scalp products are outside this leave-on property run, not low-persistence negatives. No rinse/pre-wash fallback is used. The six-product pilot remains its own frozen application-context test. No production consumer should combine a new persistence value and an old binary build-up value as two independent matching penalties.

## This oil-only replay: closed read/output contract

The shared definition above is explicitly integrated here for oil leave-on fibre use only. Its earlier pilot-only status and other-category examples of application contexts do not widen this run. Use only retained application_context in each neutral case. Do not assess washout, pre-wash/scalp use, weight, penetration, fit or claims.

Read only method.md, blind-packet.json and function-dictionary.json in this run directory. Do not follow links, browse, read source/staging/manifests/old records or peer outputs, infer identities, or dispatch another reviewer. File-scope isolation is contractual, not a sandbox. Read every input completely; recover truncated displays by smaller reads before deciding. A recognized formula must be reported in notes, never used as a target.

Write only lane-X/records.json and lane-X/notes.json for your assigned lane. No intermediate files elsewhere. Build and validate in memory before writing. records.json has exactly run_id (oil-persistence-leave-on-replay-v0.1), lane (a or b), and records. Each record has exactly case_id, persistence_potential (low/moderate/high), reason (short nonempty whole-formula rationale), evidence (nonempty list of exactly rank/canonical_name pairs from this formula), considered_ranks (all primary ranks in input order). No confidence, estimate, alternatives, unknown, indeterminate or additional property. One decision for each admitted case, no omissions. Context/identity provenance is joined by root separately; do not invent sources.

notes.json has exactly run_id, lane, read_inputs (three objects with absolute path and sha256), completed_ids (all input IDs), recognized_formulas (list, empty if none), access_incidents (list, empty if none), and limits (nonempty list). Attest actual reads and incidents candidly. Use all exact reviewed functions as clues; unassessed functions are not negligible by default and cannot independently justify a high-film claim. No concentration, grade, ingredient count/rank threshold, wash count or distribution target. Root seals both lanes before semantic inspection, then adjudicates independently; do not force peer agreement.
