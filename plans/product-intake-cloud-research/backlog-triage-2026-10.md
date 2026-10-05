# Product Intake backlog triage — 2026-10-05

Plan task 0.6. Read-only snapshot of live Supabase `pqdkhefxsxkyeqelqegq`, 2026-10-05. Scope: submissions in `pending_review`, `researching`, `ready_for_review`, `needs_more_info` (88), each with its latest research job. No data was changed.

| Bucket | Count | Older than 14 days | What it is | Proposed action (each a gated prod write) |
| --- | --- | --- | --- | --- |
| Internal test accounts | 10 | — | Nick's `+` aliases, `ux-audit-test`, `local-dev*` accounts | cancel (`cancelled_by_user`), close jobs |
| Field-test guest accounts | 28 | most | `field-test+<uuid>@guest.chaarlie.invalid` guests, 9 accounts | **Nick decides**: real field testers (keep, research) or test sessions (cancel) |
| Failed on infrastructure | 3 | 1 | Codex spawn timeout / stdin trap / JSON parse (fixed by task 0.3) | re-queue after the S0 deploy |
| Shampoo, engine pending | 14 | 4 | waits for Shampoo v1.6 (D4) | keep; re-run when the v1.6 slot activates (S2) |
| Brand not matched | 22 | 5 | blocker is the missing canonical brand, or no recorded blocker with `resolved_brand` empty | re-run through the new identity stage (S1) — expected to clear most without Nick |
| Real human decision | 11 | 1 | identity conflict, category doubt, missing sale unit, image unavailable | Nick reviews in the new admin page (S4a), or in the cockpit before that |

Caveats: buckets are assigned in table order, so a test-account shampoo counts as a test account. The brand bucket is a heuristic (blocker text mentions brand, or the brand field is empty with no blocker text) and may contain some products that also need image review. The field-test guest classification needs Nick's confirmation before anything is cancelled.

Zombie job `f74b64cf-47c5-49e2-a3ed-e8274f2e1a51` (queued since 2026-06-30, attempts 3/3) belongs to submission `73502850-65e8-45fc-beb3-8de21cb6080d`; after the 0.5 migration it is moved to `failed` automatically on the next claim.

Onboarding free text (D8b): 13 products from 3 real customers (60 days) are not submissions yet; they are re-submitted after the 0.8 deploy (gated).
