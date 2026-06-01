# Codex Review Map

This map tells Codex and Clawpatch how to review Hair Concierge by product function instead of by file list alone. Use it before large reviews, risky fixes, and PR handoff.

Clawpatch owns the semantic feature map and explicit finding/fix loop. Codex still owns product judgment, domain constraints, and final diff review.

## Review Stack

| Layer | Use | Output |
| --- | --- | --- |
| CI | Every PR | Typecheck, lint, build, deterministic contracts, path-filtered live evals |
| Clawpatch | Large or risky branches | Semantic feature findings, report, explicit patch attempts |
| `$code-reviewer` | Before handoff or after Clawpatch fixes | Diff-focused bug/security/regression review |
| Domain skills | Evidence-sensitive hair-care changes | Conservative rules, caveats, open risks |
| Manual product check | Trust-facing UX changes | German copy, flow fit, screenshots or traces |

## Functional Slices

| Slice | Primary files | Review focus | Useful checks |
| --- | --- | --- | --- |
| Quiz and lead capture | `src/app/quiz/`, `src/components/quiz/`, `src/lib/quiz/` | German copy, field normalization, answered-vs-skipped semantics, lead lifecycle | `npm run test:node`, relevant `tests/quiz-*.test.ts`, `tests/quiz-onboarding-e2e.spec.ts` |
| Onboarding and profile shaping | `src/app/onboarding/`, `src/components/onboarding/`, `src/lib/onboarding/`, `src/lib/profile/`, `src/hooks/use-hair-profile.ts` | `hair_texture` vs `thickness`, persistence safety, none-state handling, profile-derived signals | `tests/onboarding-*.test.ts`, `tests/hair-profile-derived.test.ts`, `tests/profile-*.spec.ts` |
| Recommendation engine | `src/lib/recommendation-engine/`, `src/lib/product-specs/`, category constants and backfill scripts | Deterministic mappings, conservative fallbacks, `recommendation_meta`, category-specific fit logic | `tests/recommendation-engine-*.test.ts`, category flow specs, `npm run test:contracts` |
| Agentic chat and tools | `src/app/api/chat/`, `src/lib/agent/`, `src/lib/agent-v2/`, `src/components/chat/`, `src/hooks/use-chat.ts` | Tool routing, product selection, answer composition, visible failure handling, German response UX | `npm run test:agent`, `npm run test:chat:ci`, selected Playwright chat specs |
| Chat memory, state, and traces | `src/lib/chat-runtime/`, `src/app/api/memory/`, `src/app/api/chat/`, chat trace tests | Memory extraction, conversation state, debug trace shape, source/projection grounding | `tests/conversation-state.spec.ts`, `tests/user-memory.spec.ts`, `tests/chat-debug-trace.spec.ts` |
| Product matching and catalog chunks | `src/lib/product-matching/`, `scripts/ingest-product-chunks.ts`, `scripts/eval-retrieval.ts` | Catalog chunk shape, product matching determinism, retrieval eval ingestion boundaries | `npm run test:retrieval:ci`, `tests/product-matcher.spec.ts`, `tests/product-list-chunks.test.ts` |
| Langfuse and eval loop | `src/lib/langfuse/`, `src/lib/openai/`, `scripts/eval-chat/`, `scripts/langfuse/` | Trace masking, prompt fallback behavior, dataset metadata, score publication | `tests/langfuse-*.test.ts`, `npm run test:chat:judge`, `npm run test:chat:langfuse` when comparing runs |
| Stripe, auth, and access gates | `src/app/api/stripe/`, `src/lib/stripe/`, `src/app/auth/`, `src/lib/auth/`, `src/proxy.ts` | Checkout activation, webhook idempotency, session routing, pricing gates, password recovery | `tests/stripe-*.spec.ts`, `tests/auth-*.test.ts`, `tests/checkout-activation.spec.ts` |
| Supabase schema and policies | `supabase/migrations/`, `src/lib/supabase/`, data ingestion/backfill scripts | RLS assumptions, admin boundaries, enum drift, migration reversibility, local-secret handling | Targeted migration review, affected persistence tests, `npm run test:node` |
| Admin and product operations | `src/app/admin/`, `src/app/api/products/`, product seed/backfill scripts | Admin-only assumptions, product lifecycle state, support category specs, accidental public exposure | `tests/admin-*.test.ts`, `tests/product-*.test.ts`, script dry-runs where available |
| Public UI shell | `src/app/page.tsx`, `src/app/pricing/`, `src/components/ui/`, layout/providers | German UI text, responsive layout, accessibility, PostHog/Sentry side effects | `npm run lint`, targeted Playwright/mobile specs, browser screenshot review |
| Review tooling and CI | `.github/`, `scripts/ci/`, `AGENTS.md`, `docs/codex-review-map.md`, `docs/clawpatch-code-review.md`, `clawpatch.config.json`, `package.json` | Non-blocking automation, generated state hygiene, provider availability, artifact usefulness | YAML parse, `node --check`, `npm run clawpatch:doctor`, `npm run clawpatch:map`, `npm run clawpatch:summary` |

## Clawpatch-Derived Inventory

This inventory was distilled from `npm run clawpatch:map` on 2026-05-18. Keep `.clawpatch/` ignored; commit only the stable conclusions that help future reviews.

Clawpatch mapped:

- 223 total features
- 90 `library` features
- 72 `ui-flow` features
- 53 `route` features
- 4 `release` features
- 2 `config` features
- 2 `service` features
- 62 features with at least one mapped test

Mapped trust-boundary counts:

- `network`: 126 features
- `serialization`: 126 features
- `user-input`: 125 features
- `filesystem`: 7 features
- `process-exec`: 6 features
- `database`: 1 feature
- `external-api`: 1 feature

Clawpatch-generated test links are useful triage hints, not proof of adequate coverage. Route features often inherit broad routing tests; when a finding matters, verify the linked tests actually exercise the behavior under review.

| Slice | Clawpatch features | Shape | Mapped tests | Notable generated feature records |
| --- | ---: | --- | ---: | --- |
| Quiz and lead capture | 25 | 5 library, 1 route, 19 UI flow | 4 | `feat_route_58541ef7ee` Route `/quiz`; `feat_route_61d1080a4c` Route `/api/quiz/lead` |
| Onboarding and profile shaping | 19 | 6 library, 1 route, 12 UI flow | 1 | `feat_library_0153fe859f` source group `src/components/onboarding/screens`; `feat_route_e82b77cd40` Route `/onboarding` |
| Recommendation engine | 7 | 7 library | 0 | `feat_library_d9d76394b4` source group `src/lib/recommendation-engine/categories`; `feat_library_a72310a0b6` source group `src/lib/recommendation-engine` |
| Agentic chat and tools | 22 | 9 library, 3 route, 10 UI flow | 3 | `feat_route_4f2453eb75` Route `/api/chat`; `feat_route_4c11dbaf4b` Route `/api/chat/feedback`; `feat_library_82fa133a7f` source group `src/lib/agent/orchestrator` |
| Chat memory, state, and traces | 11 | 9 library, 2 route | 5 | Current live review focus is `src/lib/chat-runtime`, `/api/chat`, and `/api/memory`; generated inventory counts will be refreshed in Task 6 |
| Product matching and catalog chunks | 0 | Pending refreshed Clawpatch map | 0 | Current live review focus is `src/lib/product-matching`, product chunk ingestion, and retrieval eval scripts until Task 6 refreshes the generated inventory |
| Langfuse and eval loop | 4 | 3 library, 1 service | 0 | `feat_library_f4f86a7094` source group `src/lib/langfuse`; `feat_library_2e94e5b193` source group `scripts/langfuse`; `feat_library_77bde163e7` source group `scripts/eval-chat` |
| Stripe, auth, and access gates | 12 | 5 library, 7 route | 8 | `feat_route_a92aa7d78f` Route `/api/stripe/webhook`; `feat_route_7909897458` Route `/api/stripe/create-checkout-session`; `feat_route_717e4d949f` Route `/api/auth/send-magic-link` |
| Supabase schema and policies | 1 | 1 library | 0 | `feat_library_fd97feb5a0` source group `src/lib/supabase`; migrations are covered by the committed slice map rather than rich Clawpatch records today |
| Admin and product operations | 10 | 2 library, 8 route | 8 | `feat_route_895fc98cd0` Route `/api/admin/conversations`; `feat_route_7c6f93d269` Route `/api/admin/products/:id`; `feat_route_404dea4499` Route `/api/products` |
| Public UI shell | 31 | 5 library, 2 route, 24 UI flow | 2 | `feat_route_98ac42d5da` Route `/pricing`; `feat_library_9c1c27264e` and `feat_library_ae197173fa` source groups `src/components/ui` |
| Review tooling and CI | 7 | 1 config, 2 library, 4 release | 0 | `feat_config_7528cb5b98` Project config `package.json`; `feat_library_0aad9458b7` source group `scripts/ci`; workflow files are covered by the committed slice map rather than rich Clawpatch records today |

Review priority from the generated map:

- High trust-boundary route features should get first review attention on risky branches: `/api/chat`, `/api/chat/feedback`, `/api/stripe/webhook`, `/api/stripe/create-checkout-session`, `/api/auth/*`, `/api/admin/*`, `/api/memory/*`, `/api/quiz/*`.
- `Recommendation engine` and `Langfuse and eval loop` have low or zero mapped test coverage in Clawpatch despite having repo tests elsewhere. Reviewers should explicitly choose the relevant package scripts instead of relying on generated links.
- `Onboarding and profile shaping` has many UI-flow records but only one mapped test. Visual checks and focused onboarding/profile tests matter for that slice.
- Supabase migrations are not richly mapped by Clawpatch today. Treat migration review as a manual checklist plus affected persistence tests.

## Clawpatch Review Recipes

For a broad pre-PR pass:

```bash
npm run clawpatch:init
npm run clawpatch:doctor
npm run clawpatch:map
npm run clawpatch:review -- --limit 10
npm run clawpatch:report
```

For a risky slice, run smaller batches and cross-check the relevant row above:

```bash
npm run clawpatch:review -- --limit 3
npm run clawpatch:next
```

For an explicit fix:

```bash
npm run clawpatch:fix -- --finding <finding-id>
npm run clawpatch:revalidate -- --finding <finding-id>
git diff
```

Only run fixes in a task worktree. Treat the patch as a draft change until Codex has checked the diff, run the slice-specific tests, and reconciled the behavior with the project conventions in `AGENTS.md`.

## Escalation Rules

- Use `hair-care-expert` before changing medically adjacent scalp, shedding, hair-loss, or evidence-sensitive guidance.
- Use `category-specific-recommendation` before redesigning a single product-category recommendation flow.
- Add to `questions-for-domain-review.md` only when local context and external evidence cannot resolve the question.
- Mark weak Clawpatch findings as `uncertain` or `false-positive` rather than turning them into churn.
- Prefer screenshots, traces, or Langfuse experiment links for trust-facing behavior changes.

## Automation Recommendations

Automate these now:

- PR feature-map generation: implemented by `.github/workflows/clawpatch.yml`, which runs `npm run clawpatch:map` and uploads generated artifacts without committing `.clawpatch/`.
- PR Clawpatch review report for changed branches: implemented as a non-blocking provider-backed step when the `OPENAI_API_KEY` secret and `codex` are available in CI.
- PR slice detection: implemented by `npm run clawpatch:summary`, which reads changed files and `.clawpatch/features`.
- Weekly main-branch review digest: implemented as the same workflow on a Tuesday schedule.
- Visual artifacts for trust-facing flows: attach Playwright screenshots/traces for quiz, onboarding, chat, product drawer, pricing, and admin trace views.
- Langfuse quality digest: schedule a non-blocking report for judged chat evals, production triage samples, overclaim risk, product-fit failures, latency, and tool-call count.

Keep these manual for now:

- `npm run clawpatch:fix -- --finding <id>` because fixes should stay one finding at a time and need human/Codex diff review.
- Any domain behavior change involving scalp, shedding, hair loss, ingredient claims, or deterministic recommendation rules.
- PR merge/auto-approval decisions. Clawpatch can supply evidence, but this repo still needs product and domain judgment before shipping.
