# Bondbuilder Full Topic Pilot Migration

Source folder: `data/agent-guidance/topics/bond-builder/`
Target package: `category.bondbuilder.v1`
Note: the filename keeps the original pilot path, but the reviewed unit is now the full Bondbuilder topic folder, not only `confusions.md`.

## Source Files Reviewed

| Source | Role in old guidance | AgentV2 transfer |
|---|---|---|
| `README.md` | Load order and topic identity | Folded into package scope and this migration note. |
| `core-fit.md` | Relevance, fit, realistic benefit, non-fit boundaries | Transferred into `Purpose`, `Use When`, `Best Fit`, `Weak Fit`, and `Realistic Benefit`. |
| `response-playbook.md` | Answer shape, routine placement, technology lanes, K18 vs OLAPLEX/Epres guidance | Transferred into `Lane Decision`, `Routine Placement`, `Missing Required Data`, and `German Answer Shape`. |
| `guardrails.md` | Overclaim, evidence, scalp/hair-loss escalation, no default reset rule | Transferred into hard rules, `Evidence Framing`, `Safety Boundary`, and `Do Not`. |
| `confusions.md` | Look-alikes, brand-line/product-name confusion, technology examples | Transferred into `Technology Examples`, `Common Confusions`, hard rules, and look-alike rubric. |

## Transfer Decisions

| Source knowledge | Decision | AgentV2 target | Reason |
|---|---|---|---|
| Bondbuilders are targeted structural-repair treatments, not baseline care. | transfer | Markdown purpose + hard rule `category.bondbuilder.not_conditioner` | Prevents moisture/conditioner substitution and keeps the category narrow. |
| Relevant after bleach, highlights, oxidative color, perms, relaxers, keratin, repeated high heat, snapping, breakage, mushy/elastic wet feel, or upcoming chemical service. | transfer | `Use When`, `Best Fit`, rubric `category.bondbuilder.core_fit_structural_signals` | Gives GPT-5.4 concrete semantic anchors for relevance without adding deterministic routing. |
| Poor fit: healthy untreated hair, scalp concerns, softness/hydration/frizz/slip alone, split ends alone, protein/moisture imbalance alone, hair loss/shedding/scalp pain. | transfer | `Weak Fit`, `Safety Boundary`, hard rules | Keeps the model from overusing Bondbuilder for generic damage language. |
| Realistic benefit: better strength, elasticity, resilience, reduced breakage; partial/incremental ceiling. | transfer | `Realistic Benefit`, hard rule `category.bondbuilder.no_unrealistic_repair_claims` | Preserves the old conservative claims boundary. |
| OLAPLEX No.3PLUS, No.0, No.3 legacy, K18, and Epres are high-confidence examples, not automatic recommendations. | transfer with caution | `Technology Examples, Not Recommendations` + grounding rule | Useful category knowledge, but recommendations still require product tools. |
| OLAPLEX/Epres vs K18 lane distinction. | transfer | `Lane Decision`, rubric `category.bondbuilder.lane_decision_clarity` | This was too important to omit; it helps answer comparison and product-choice questions. |
| OLAPLEX No.0 booster, No.3 legacy, No.3PLUS successor, Epres easier spray route/lineage, severe mixed damage two-lane phase. | transfer | `Technology Examples`, `Lane Decision`, `Routine Placement` | Specific guidance is preserved as model-usable context while exact product/cadence remains tool-grounded. |
| Product-specific usage protocol metadata controls timing/cadence. | transfer | `Routine Placement`, `Required Grounding` | Avoids hallucinated usage schedules. |
| Ask at most one follow-up when structural damage, chemical history, service timing, or severity would change the recommendation. | transfer | `Missing Required Data`, `ask_when` | Keeps conversation ergonomic and avoids over-questioning. |
| Evidence framing is mechanism-plausible, practitioner-validated, limited independent peer-reviewed evidence. | transfer | `Evidence Framing`, rubric `category.bondbuilder.evidence_framing` | Preserves uncertainty without making every answer defensive. |
| Do not treat full brand lines or generic bond products as true Bondbuilders. | transfer | Hard rules `no_generic_bond_labels`, `no_brand_line_generalization` | Directly addresses the failed “Bondbuilder types” behavior. |
| Do not deep-cleanse before every bondbuilder use. | transfer | Hard rule `category.bondbuilder.no_default_deep_cleanse` | Prevents leakage from reset guidance into Bondbuilder usage. |
| Scalp pain, significant irritation, unusual shedding, patchy hair loss should move away from bondbuilder advice. | transfer | `Safety Boundary`, `ask_when` safety condition | Keeps cosmetic repair separate from medically adjacent symptoms. |

## Rejected Or Deferred

| Source content | Decision | Reason |
|---|---|---|
| Treat old default load order as runtime overlay logic. | defer | AgentV2 V0 uses one category package; source-map keeps provenance. |
| Use example products as default recommendations. | reject | Concrete product recommendations must come from `select_products`. |
| Brand-default timings as app-level rules. | reject | Exact cadence and protocol should come from product-specific metadata. |
| Profile nuance such as curl/coily or porosity handling inside this package. | defer | The old file explicitly says those belong in overlays/product metadata later; for V0, only Bondbuilder-specific fit and safety boundaries are migrated. |

## Pilot Acceptance Criteria

- `category.bondbuilder.v1` contains core fit, poor fit, realistic benefit, lane decision, routine placement, evidence framing, confusion, and safety boundary guidance.
- The package preserves concrete examples as technology examples, not automatic recommendations.
- Product and protocol claims require `select_products` grounding.
- Category education answers for Bondbuilder must load `category.bondbuilder.v1`.
- AgentV2 must not describe shampoo, conditioner, mask, or serum as Bondbuilder types unless product/category data explicitly curates them.
