# Oil bridge implementation review

Initial scope: whole task-owned uncommitted/untracked tree on codex/oil-intake-bridge-v1, base 81201a9e4e577ce03730809cc367ab21b10ce091. Initial fingerprint 539c415bf474608f7d3674a543e1da35e07896eca9f1a4f518916e8730fdafd2. Manifest explicitly covers transferred historical inputs and new code, docs, tests and replay. Generated manifest/verification/review receipts are excluded from self-fingerprinting and classified as commit-intended metadata.

Counterpart: local Claude Code 2.1.234, opus alias resolved claude-opus-5, high effort, safe-mode, only Read/Grep/Glob, no MCP, no session persistence. API-key environment unset. Read-only terminal review completed exit0; no nested reviewer or edits. Original verdict: **“Approve with revisions — do not ship as-is.”** Correctness and structural lenses ran together because the implementation adds a strict type boundary and several modules.

## Findings and reconciliation

1. High: recursive stable-key sorting invalidates the original-record digest in the admitted CLI output. Accepted; plain-order envelope serialization and actual child-process round-trip regression required.
2. Medium: O04 also references unresolved identity source E01-retailer-de. Accepted underlying omission. Preserve that truthful unresolved reference and the original refusal artifact; do not filter away provenance or invent the source. A successor replay records both this source gap and rank1 representation conflict.
3. Medium: status-only oracle failed to identify additional refusal causes. Accepted; compare independently established reason classes and reject unexplained actual diagnostics.
4. Medium: historical complete-declaration assumption disclosed by exporter but not required by schema. Accepted; require existing declaration_admission mapping receipt. No new source or research judgment.
5. Medium: mis-split numeric comma can create bare-number ingredient. Accepted; alphabetic INCI-name refinement plus negative example.
6. Medium: retained-use removal/site admission lacks direct negative tests. Accepted; named vocabulary constants and boundary regressions.
7. Medium: no fresh-export hash binding to committed replay. Accepted; compare exact37 envelope byte hashes to preserved v0.1 manifest.
8. Low: helper could translate future not_applicable empty issues to no blocker. Currently unreachable because helper admits only full envelope and that branch never returns not_applicable. No current silent success. A defensive status fallback may be added without broadening admission.
9. Low: UUID-case normalization preference. Not adopted: approved contract uses exact submission binding. Differently formatted UUIDs fail conservatively before mutation; no incorrect binding occurs.
10. Low: outside-category exclusions should ban all fibre directions. Rejected: outside hair-oil category is not outside hair care. A conditioner may have retained fibre directions while correctly outside this category. Preserve explicit category semantics.
11. Low: repeated diagnostics and incomplete summary profile. Accepted: dedupe diagnostics and show full preserved profile.

Structural: accepted focused validation checks instead of monolithic dispatcher, shared local safe-directory IO with direct atomic rename onto empty target, declarative historical amendments, source formatting and explicit fit-policy path subset. Repeated parsing of a bounded inactive local envelope is not a material defect; retain safe public renderer API unless a concrete simplification warrants changing it. No speculative general framework.

Root independently established additional behavioral failures before fixes: canonical trace explanation and de-aliased scenario fit could differ from originals; malformed source_id= claim evidence and out-of-range rank references could pass; scalp-only exclusion could have fibre site. These are internal consistency fixes within approved strict admission, not research reclassification.

## Disposition

All initial revisions are fixed or explicitly reconciled above. Three existing agents handled disjoint follow-up scopes; after interruption root completed the exporter hash regression, successor publication, integration checks and final fixes. Original v0.1 replay remains immutable; current verification is v0.2.

## Focused counterpart follow-up

The tool-based follow-up timed out after600seconds (exit142) while exploring dependency internals; it returned no verdict and is not counted as a completed review. A fixed14-file packet rerun used the same local Claude Opus/high lane, with no tools and no nested reviewer. It completed exit0. Verbatim verdicts: **“Correctness: Approve with revisions.”** and **“Structural: No regression.”** It reviewed fingerprint c42a7549cedba08037fe432e6729754294dc566ad2b02817466feddb842b1ee7.

D1. Mixed-use oils could project a pre-wash fibre role from a scalp-only scenario. Accepted and fixed: every pre-wash role now requires fibre site and an established wash-out context, matching exclusion semantics. The regression first failed ready-versus-needs_research, then passes for both incorrect site and retained removal; legitimate dual use remains ready. No role is silently dropped.
D2. Multiple declaration suffixes were stripped in the wrong order. Accepted and fixed by peeling a copied suffix array in reverse document order. The new natural-order positive failed before the fix, now passes; reversed metadata is refused. No input array mutation. All37 historical inputs have zero or one suffix and remain unchanged.
D3. Duplicate source/direction/role scenario keys could mask an unrelated fit row. Accepted and fixed: reject duplicate keys and require exact set equality between scenarios and fit rows. We reject ambiguous duplicates rather than silently collapse differing contexts, enforcing the existing exactly-once contract. The duplicate-plus-unbound-row regression passed incorrectly before the fix and now refuses.
D4. Numeric-comma test assurance wording. Clarified: the regression protects rejection of **bare numeric INCI fragments** by the ingredient-name guard. It does not prove universal comma tokenization. Test renamed and raw-coverage comment narrowed to literal preservation of commas within recorded names. No ambiguous positional splitting rule or invented dictionary inference was added.
Minor: stable projection serialization now uses binary key comparison instead of locale-dependent localeCompare. Admitted envelope serialization still preserves natural order.

## Final local delta review

Root inspected all supported fixes, their relevant schema/projector callers and tests, and reused the unchanged counterpart structural conclusions under request-code-review's refresh-after-findings contract. The changes are local guards and regression coverage; they do not change architecture, permissions, policy values or research classifications, so no new whole-branch review lane was stacked. The external conditional verdicts above remain conditional historical verdicts; the final readiness decision is the orchestrator's after verified fixes.

**No blocking verified findings remain for the approved inactive local bridge scope.** The final77-test suite, full replay-receipt equality, typecheck, lint and build are recorded in the verification receipt. Original research and first replay hashes remain preserved. Publication, activation, method lock, sensory accuracy and unseen-product classification remain separate gates. Root main is clean; task changes remain uncommitted on the recorded base.

Detailed reviewer/terminal scratch is discarded after this concise reconciliation. All source, docs, tests, plans, transfer evidence, original/updated replay and generated receipts are commit-intended; no commit, push, PR or production action is authorized.


Final canonical fingerprint: 719f414f020c3a86c574d3475834f0b42fa5706e16347cb9ac16f34dfc81d262. The generated manifest/verification/review receipts are excluded from self-fingerprinting; every other task-owned path is included.
