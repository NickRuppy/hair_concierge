# Claude Review - Product Catalog Additions Plan

Date: 2026-06-27
Review route: direct constrained `claude --print` prompt, because the wrapper `/reviewing-plans` route repeatedly stayed silent and produced empty artifacts.

## Claude Findings

### Finding 1: Product/identity fields may not exist on this branch

Claude reported that fields such as `category_key`, `brand_id`, `product_line_id`, `origin`, and `is_chaarlie_recommended`, plus identity tables such as `brands`, `brand_aliases`, and `product_lines`, are not represented in this branch's migration/code search and could fail at insert time.

Classification: partially accepted.

Resolution: live Supabase introspection confirms these columns/tables exist in production. The real risk is branch schema drift versus live DB schema. The plan now requires mandatory live schema preflight for `products`, identity tables, and spec tables before preparing payloads or writes.

### Finding 2: Image helper scripts are absent on this branch

Claude reported that `scripts/product-images/removebg.swift`, `removebg-padded.swift`, `remove-baked-shadow.py`, and `qa-composite.swift` are not present on the `origin/main`-based worktree, while the plan referenced them.

Classification: accepted.

Resolution: the plan now explicitly includes porting or reusing the minimal product-image helper scripts from `.worktrees/product-intake-full-flow-smoke/scripts/product-images/` before using them. The implementation remains standalone and does not depend on unfinished `products:intake:*` commands.

### Finding 3: Base the writer on existing seed script patterns

Claude reported that the plan should avoid inventing a separate writer style when existing `seed-*-products.ts` scripts already establish dry-run/confirmation/upsert patterns.

Classification: accepted.

Resolution: the plan now says to base the writer on existing `seed-*-products.ts` conventions and to preserve explicit confirmation guards.

### Finding 4: Open-ended Claude review route can hang

Observed during this debugging session: the wrapper `/reviewing-plans` route and an open-ended direct review prompt both stayed silent for minutes. A constrained direct prompt did complete after about 94 seconds and produced the findings above.

Classification: accepted as tooling note.

Resolution: for this plan, use this review artifact as the Claude review result. Future wrapper reviews may need a more bounded prompt or investigation of the Claude-side `/reviewing-plans` skill.
