# Integrated oil-method review receipt — 2026-10-01

Read-only external counterpart review through `.agents/skills/claude-plan-review`: Claude Opus 4.8, effort high, terminal advisory scope. Shell API key unset. Verdict: **approve with revisions for preparatory method shape; not a frozen run/implementation approval**. Main verified the findings against current files and the original handoff rather than accepting dated memory as authority.

| Finding | Type / disposition | Verification and change |
| --- | --- | --- |
| Missing category charter before freezing boundary cases | Defect, accepted | Only the property file existed. Created `docs/research/oil-inci/v1.0/00_category_charter.md` as an explicit draft; food/styling probes remain unresolved before freeze. |
| Worked examples can leak cohort answers | Invariant, accepted | Original handoff line 61 specifies example-disjoint calibration. Added product/formula example exclusion to method/charter; ingredient science entries can overlap legitimately. No actual product labels/packets have been frozen. |
| Broadening coconut to camellia/safflower must be visible | Scope/admission issue, accepted in part | Original handoff line 30 says **mostly** coconut-led, while line 40 calls the study rules unverified pending science. Current approved property requires credible oil evidence, not an exclusive coconut rule. Reject exclusive-coconut interpretation; explicitly mark new three-oil admission as proposed evidence-based set for the method checkpoint. No labels changed. |
| E01 reserve / E08 boundary could be read as settled | Scope/wording issue, accepted | They were proposed preparation choices, not frozen inclusion. Kept proposed/pending language and new charter's boundary checkpoint; original candidate history retained. |
| Five source slots remain unreachable | Stale source status, superseded in part | New exact DE sources resolve E05 and support current E03 capture with a retained conflicting list; main resolves E02 as **75 ml** from DE retailer + manufacturer image identifier. E06 still has genuine tail-version conflict. Access failures do not apply to all current dm pages. Updated source-preflight receipt rather than claiming frozen completeness. |
| Defer trace heuristic to unknown | Tradeoff, rejected as default | Nick directly chose approximate rules clearly marked as estimates (OE14). Retain narrow contextual heuristic and explicit no-quantity wording; real unresolved roles can still be unknown. No empirical validation claimed. |
| Rename penetration enum | Nice-to-have, deferred | Vocabulary was already signed off. No code/schema exists; no unsolicited rename. |

Main additionally rejected the agent's automatic first-two-carrier hybrid shortcut and protected botanical inventory from tail-based erasure. The chosen draft uses whole-formula rival challenges, marked estimates and coherent application scenarios.

## Review and verification limits

The reviewer assessed a preparatory research spec, not implementation or final packet bytes. Stage-based role/flag/source follow-ups were integrated while/after review and checked locally; no claim of final-byte external review. Review cited stale property-file line numbers for the disjointness invariant; main verified its actual source in the preserved original handoff. No executable tests, classification rounds, production/database operations, commit or push occurred.

Transient raw report was generated outside the repository at `/var/folders/zq/tmsmyfv96wqf0jmfz3gpdfq80000gn/T/claude-plan-review-classification-mechanism-proposal-97686.md`. This concise verified receipt is durable; the temporary raw report is explicitly retained outside the repository for this research session and excluded from deliverables/PR contents.
