# Leave-In research runbook (Standard v1.0)

The reusable seven-dimension classification logic is locked as Leave-In Standard v1.0. The logic lock covers the vocabulary, anchors, thresholds, evidence ceilings, gates and the reasoning contract; it does **not** approve an individual product and does **not** authorize catalog, database, matching-policy, Product Intake or production use. The machine-readable receipt is `data/research/leave-in-inci/v1.0/v1.0-logic-lock-receipt.json`.

This runbook describes the procedure **as it was actually practised** across calibration rounds 1–4 and the unseen-product test. Every rule below is sourced from an artifact in `data/research/leave-in-inci/v1.0/corpus/`, not from intent.

No command in this runbook writes to Supabase or production.

---

## 1. Where the artifacts live

| Artifact | Path |
| --- | --- |
| Normative standard | `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md` |
| Reviewed source snapshot (round 4 ran against these exact bytes) | `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.v1.0-rc1.md` |
| Rule-change ledger (T1–T19 + housekeeping row 20/20a) | `docs/research/leave-in-inci/v1.0/rule-changes.md` |
| Category charter (G0 boundary, market) | `docs/research/leave-in-inci/v1.0/00_category_charter.md` |
| Calibration corpus | `data/research/leave-in-inci/v1.0/corpus/gold-set/`, `…/corpus/unseen-test/` |
| Lab fixture + review state | `data/research/leave-in-inci/v1.0/lab-fixture.json`, `…/lab-review-state.json` |
| Science authority (**SR §x**) | `plans/leave-in-inci/research/leave-on-science-review.md` |
| Hard-rule audit (T17's source) | `plans/leave-in-inci/research/hard-rule-audit.md` |
| Handover (**HO §x**) | `plans/leave-in-inci/handover/` |

The freeze moved the corpus from `plans/leave-in-inci/research/{gold-set,unseen-test}/` into the artifact root above. The standard's body still cites the old paths — deliberately, so the normative file and the reviewed rc1 snapshot stay diffable to the version stamps alone. The standard's **Version** preamble carries the redirect; this table is the current map.

---

## 2. Frozen-packet capture, and the amendment log

Classification never reads the web. It reads a **frozen packet**: one JSON file per lane family holding, per product, the exact-market identity, the raw INCI with its `rawInciSha256`, the normalized ingredient list with its `formulaFingerprintSha256`, the verbatim `directions_of_use` with its source tier, and the frozen `claims[]` with C-tiers (§2.4, R11/R12 and v0.3 change 8).

- **Two packets, one evidence set.** `corpus/gold-set/calibration-packet.json` (reference-key lane) and `corpus/gold-set/blind-packet.json` (sealed lane) carry identical evidence; the blind packet is the one a sealed lane is given. `corpus/unseen-test/unseen-packet.json` and `unseen-packet-lane.json` are the unseen round's equivalents.
- **A packet is amended, never silently edited.** Every change appends a dated entry to the packet's `amendment_log` naming what was added, from which source, at which tier, and what was *not* touched. Both packets are amended identically when the evidence is shared.
- **Hashes are the amendment's proof.** An evidence-only amendment re-verifies that `rawInciSha256` and `formulaFingerprintSha256` are unchanged across every entry, and says so in the log entry. A change that moves a hash is a new formula, not an amendment (§16, G7).

**The four standing precedents.** Use them as the model for any future capture gap:

1. **u1 — the frozen primary can be the outlier.** Three mutually contradicting same-market captures (38/35/31 ingredients). The recency investigation (`corpus/unseen-test/u1-formula-recency.md`) found three-source convergence on the 31-ingredient list; the packet primary was **re-anchored by amendment**, the outliers **demoted to additional captures with notes, never deleted**, and the record re-derived in `corpus/unseen-test/rederived/`. This is the worked example for §2.4.2 tier 1 (T18).
2. **u4 — a post-freeze gap-fill.** A manufacturer page unreachable at freeze time, recovered later from an archive, added to one slot only, with directions, claims, an additional INCI capture proven byte-identical to the frozen one, and a source entry — each listed in the amendment entry.
3. **u5 — a presentation-form evidence pass.** `corpus/unseen-test/u5-format-evidence.md`: packshot inspection at zoom, corroborated by a second source, verdict recorded with its confidence. It became the precedent the gold set reused.
4. **slots 2 / 6 / 9 / 10 — round 4's evidence-gap closure.** Round 4 proved a *packet* gap rather than a rule gap: the blind packet carried no form evidence for four slots, and the honest lane emitted `unknown`. The closure pass (`corpus/gold-set/round-4/evidence-gap-closure.md`) captured pack-shot and directions evidence, amended both packets identically, and only then were the four forms E1 facts and the key delta applied.

**The rule the four share:** a disagreement caused by missing packet evidence is closed by an **evidence pass and a packet amendment**, never by a rule change and never by letting a lane guess. A lane that guesses is the defect (round 4 item 1: 2 of 4 guesses were wrong).

---

## 3. The sealed-lane protocol

A calibration round runs **two independent lanes** on the same frozen packet. The sealed lane's contract, as practised in rounds 3–4 and the unseen test:

- **Two files, and only two.** The lane may read the standard and its own packet. Nothing else: no reference key, no `transform-notes`, nothing under `agreement/`, no other lane's output, no `rule-changes.md`, no fixture, no audit.
- **No web access of any kind.** No fetch, no search, no browser, no MCP fetch. The packet is the complete and only evidence. A product is never re-researched inside a lane.
- **Writes are the two deliverables only** — `records.json` and `notes.md` in the lane's own directory. Scratch work stays outside the repo.
- **The lane ends with a written SEAL CONFIRMATION** listing every file read (with line ranges where a file was read partially), stating the no-web fact explicitly, and reporting **incidents** — anything the lane saw that could have contaminated it, whether or not it sought it out. Round 4's lanes both reported two: the standard's own §21.3 ledger quotes per-record gold-set adjudications, and one packet `claims[]` note reproduced a reference-lane conclusion. Both were reported rather than hidden, and the agreement analysis discounts the affected fields.
- **A binding rule inside the standard is applied as a rule, even when it names this gold set.** Round 4's lanes were right to do so; the honest move is to apply it and flag it in the seal, not to treat it as a leaked answer or to ignore it.
- **`notes.md` carries an ambiguity register.** Every place the lane had to choose a reading gets a bullet naming the choice and the alternative. Those bullets are the raw material of the next rule change — the six "Secondary findings" that became housekeeping row 20 all came from lane registers.

---

## 4. The agreement diff

Comparison is mechanical and value-only (`corpus/gold-set/agreement/compare*.mjs`):

- **Values are diffed; evidence prose is not.** Prose is adjudication reading, not a diffable field. Confidence is compared separately from the value.
- **The compared surface** is `g0`, every §7 dimension, `care_direction`, every lean-profile field, `focus.primary`, `focus.secondary`, the heat binary, and every cell of `hair_thickness_fit` / `damage_fit` / `texture_fit`. Array fields are compared as sorted sets; `derived_from`/`note` metadata is excluded.
- **G0 short-circuits.** Where either lane excluded a product at G0, downstream fields are intentionally absent or informational, so the only substantive disagreement is `g0` itself.
- **Every difference is retained and adjudicated**, and is classified by cause — packet evidence gap, standard defect, unstated convention, or genuine lane deviation. The class decides the fix: an evidence gap closes with a packet amendment (§2), a standard defect or unstated convention with a ledger row (§6), a genuine deviation with an adjudication.
- **Each round produces one report** — `agreement/round-2-report.md`, `round-3-report.md`, `round-4/round-4-report.md`, `unseen-test/unseen-test-report.md` — with the headline agreement figure, the residue enumerated exhaustively, and each item's class, resolution and status. The trajectory of record: **86.2 % (r1) → 93.0 % (r2) → 97.5 % (r3) → zero value disagreements (r4)**.
- **Agreement measures the repeatability of the rules, never the truth of a value.** Say so in every report.

---

## 5. The Lab review flow

The Lab (`/labs/leave-in-research`, development only) reads `lab-fixture.json` and persists to `lab-review-state.json`.

- **The queue shows the complete cohort**, both batches (13 gold-set + 6 unseen-test = 19 products, 397 reviewable properties).
- **Four actions**, and nothing else: `approve_property`, `request_rework` (comment required), `approve_product` (atomically approves every property on the product), and `approve_boundary` (the G0 confirmation, the only completion path for an excluded product — an excluded record emits no lean profile to review).
- **Every reviewable row carries reasoning.** A value with no rationale is a research defect, not a review item: the builder fails the run if any extraction gap remains (`rationale extraction gaps: 0`), and low-confidence reasoning is acceptable where absent reasoning is not.
- **`request_rework` is a worker handoff, not a note.** It opens an entry in the rework queue naming product, property path, comment and the fingerprints in force.
- **Approval semantics.** Approval binds an exact artifact state, not a product. Review state stores, per product, the `formulaFingerprint`, the `productFingerprint`, the per-property fingerprints and the `standardVersion`. A stored decision survives only while all of them still match the fixture; otherwise the item reads **`erneut prüfen`** (stale) and the approval does not count.
- **Field fingerprints cover the evidence, not just the value.** A property's fingerprint is a deterministic unsalted SHA-256 over `{path, value, rationale, observations, counterSignals, derivedFrom, echo}`. A material change to an explanation therefore reopens that property even when its enum value is unchanged. Path-provenance metadata (`rationaleSource`) is deliberately **outside** the fingerprint, so relocating an artifact never invalidates a review.
- **The fixture's `standardVersion` is a derivation stamp, not a lock stamp.** It stays `leave-in-inci-v0.4` after the freeze, because that is the text the 19 reviewed records were derived under and v1.0 promotes it unchanged. Bumping it would invalidate all 19 stored approvals for no evidentiary reason. The next regeneration that actually re-derives values under a changed rule bumps it, and the reopening is then correct.
- **Local Lab approval accepts only the exact research artifact and version. It never implies Product Intake, catalog, Supabase, deployment, or production approval.**

Regenerate the fixture with:

```
node scripts/leave-in-research/build-lab-fixture.mjs \
  data/research/leave-in-inci/v1.0/corpus/gold-set \
  data/research/leave-in-inci/v1.0
```

The unseen-test batch is picked up automatically from the sibling `corpus/unseen-test/`; pass an explicit `""` as a third argument to build the gold-set batch only.

---

## 6. Rule-change discipline (the T-ledger)

Every rule change in this program took the same five steps. Follow them.

1. **A correction is found against a real record.** T13 while reviewing GLISS, T14 while reviewing Olaplex, T16 while reviewing Redken, T18 against the unseen test's u1, T19 against EVO. A rule change motivated by nothing but a wish is not in this ledger.
2. **It is generalised into a rule, not a product exception.** T16 did not special-case Redken; it made the tail-marker rank prong conditional on a *checkable* plausibility test that every record is then re-checked against. T17 is the same move applied reflexively — Nick's "which other rules have that shape?" became a structured audit of every hard rule in the standard.
3. **It gets a ledger row** in `rule-changes.md` and in the standard's §21.3, stating the change, what it does **not** change, its consequence on every affected record, its *Motivated by* and its *Traces to*. A change with no product-model decision behind it is recorded as **housekeeping, explicitly "not a ruling"**, and may not later be cited as one (rows 20 and 20a).
4. **Every affected record is mechanically re-derived and the unaffected ones are re-checked, not assumed.** The v4 reference key is a declared mechanical transform of the round-3 key (`derived_from_run: reference-key-2026-09-04-r3`), never a re-classification.
5. **The re-derivation produces a delta report.** `corpus/gold-set/reference-key-v4/transform-notes.md` carries one numbered section per ruling with the per-record table — §12 (T13), §14 (T14), §16 (T15), §18 (T16), §20–21 (T17), §22 (T19), §24 (row 20), §25 (round-4 deltas). A reader must be able to trace any moved value to the ruling that moved it.

**A material rule change forces a calibration re-run.** A change that only re-homes an observation onto a different carrier is a *re-projection* and reproduces its values by construction — but it must still be re-measured for *reading*, because a rule that reads differently can be read differently. Say which kind a change is, in its own row.

**Separate "implemented" from "calibrated."** Several rules are implemented and unexercised — T7's `manufacturer_hold_level`, T14's cross-market exception beyond its one record, T17's H3/H8 triggers, T18's two tiers (tier 1 demonstrated once, by investigation rather than by two lanes), T19's film-led row (exercised on exactly one record). Each says so in its own row. Do not describe an unexercised rule as calibrated.

---

## 7. §1.1 — the test a future rule must pass

Every hard rule — every threshold, closed enumeration, gate and marker convention — must fail in exactly one of two directions when its own input is implausible, absent or untrustworthy: **toward human review, or toward the anchor's own conservative value. Never toward a recommendation, an upgrade, or any value that reads more favourably to a user than the evidence supports.**

This is the acceptance test for any proposed rule or amendment. A proposal that can be shown to fail toward a confident, more-favourable value on a plausible German-market input does not clear the bar, however cheap or well-motivated it otherwise is. Apply it explicitly and record the result in the ledger row, as T18 and T19 both do.

---

## 8. Guidance synchronization

- Every reusable classification or review-workflow change must update the **normative standard** and **every consuming guide** before the next leave-in batch: `product-research-prompt.v0.1.md`, `00_category_charter.md`, this runbook, `rule-changes.md`, and the fixture builders' header contracts in `scripts/leave-in-research/`.
- **Bump the semantic `standard_version`** when classification meaning, evidence thresholds, routes, field derivation or review eligibility changes. Copy, formatting and typo-only corrections do not invalidate product approvals. The research envelope version tracks the standard version (§10).
- A **product-specific** evidence correction stays in that product's versioned artifact and review history. Promote it into shared guidance only when it reveals a reusable rule.
- **Historical runs are immutable.** A policy change produces a new version or an overlay, never a silent rewrite: `…v0.1.md` through `…v0.4.md` are retained as the frozen round-1 through round-3 rule sets and the promoted draft, and `…v1.0-rc1.md` is the exact text round 4 reviewed.
- **Review state is invalidated rather than migrated** across a shape change. When a trim changes which items exist to be reviewed, no property approval is silently carried across.

---

## 9. The stop condition, restated

This package produces **research artifacts only**. On its authority, nothing changes in the catalog, in recommendations, in Product Intake rules, in Supabase, in user-facing copy or in the production matcher. `repair_support_level` is deliberately named after a live conditioner DB column; naming states an intended alignment and authorizes nothing.

**A production adapter does not exist.** Four adapter decisions are open and are named in the [README](../README.md); `plans/leave-in-inci/adapter-decisions.md` holds AD-1/AD-2 and the rest. Building one is separate work under a separate approval, and a valid projection would still be separate from Product Intake approval and from every guarded publish gate.
