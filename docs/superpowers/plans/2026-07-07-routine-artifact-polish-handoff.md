# Routine Artifact · UI Polish · Handoff / Resume State

> Living handoff doc. Purpose: if the session is cut off (spend limit or otherwise),
> a fresh session can resume the polish work without re-deriving context.
> Update the "State" section after each completed batch.

**Worktree:** `.worktrees/routine-artifact-current-main` · branch `codex/routine-artifact-current-main`
**Dev server:** `http://localhost:3315` (dev-login: `GET /api/dev/login?next=/routine` gives an authenticated session)
**Implementation reference:** this handoff doc. The original routine spec/plan files are historical planning inputs and are not part of the current `origin/main` tree.
**Verification pattern:** Playwright script at 430×930, `page.goto("http://localhost:3315/api/dev/login?next=/routine")`, dismiss cookie banner ("Alle akzeptieren"), screenshot. Never commit the script.

## Design tokens (from locked mockups v17–v22)

- Card grid: `88px tile · 1fr content · auto action`, ~110px tall, whole card = tap target → drawer
- Tints: green `rgba(110,170,110,0.10)`/border `…0.22` dot `#6FAA70` · yellow `rgba(220,180,60,0.12)`/`rgba(200,160,40,0.22)` dot `#C8A038` · red `rgba(200,100,80,0.09)`/`…0.22` dot `#C86850`
- Pending: bg `repeating-linear-gradient(135deg, rgba(232,188,100,0.05) 0 6px, transparent 6px 14px), rgba(232,188,100,0.10)` + `border-left: 3px solid #E8BC64` + amber hourglass tile `linear-gradient(155deg,#F5EBD2,#E6D4A8)` icon `#8a6a30`
- Suggestion: gray inset `rgba(110,105,95,0.10)` + inset shadows, ghost tile, plum dot, no slider, dismiss ×
- Drawer CTA order: Shop (coral `#D4616A` filled) → contextual chat (plum outlined; "Alternativen ansehen"+swap icon only for verified_swap, else "Im Chat besprechen") → "Aus Routine entfernen" (destructive text `#C86850`)
- Slider: 6px track, coral gradient fill, 28px thumb (white + 3px coral border), 4px ticks, 22px filled plum `#6B50A0` C-marker with arrow tip, plum `rgba(107,80,160,0.15)` target-range band ABOVE the fill, 3 anchors (`<1×/M` left · `1×/Woche` @ stop 3 · `Täglich` right). All positions use `index/(stops-1)`.
- Pending drawer: no shop / no chat CTA / no C-marker / no band; "Angaben ergänzen" only for `needs_more_info`.
- German UI everywhere.

## State (update after each batch)

### Done · committed on the branch

| Commit | Content |
|---|---|
| `a24eea2` | P0 — compact cards + drawer inversion (cards: tile/eyebrow/name/freq/action; whole-card tap; brand-name dedup in `shape-for-ui.ts` `appendDistinct`; buttons/slider/comment removed from cards) |
| `5a69edb` | P1 — state visual identities (tints/dots, amber pending w/ hourglass + stripes, gray inset suggestion w/o slider) |
| `3b27203` | P2 — new `routine-drawer.tsx` (verified + pending variants, slider inside, coral shop CTA, contextual chat CTA, remove), slider restyle in `routine-frequency-control.tsx`, header slimmed, stats wording |
| `9f25d80` | Batch 2 Commit 1 — stats pluralization ("1 Vorschlag"), disjoint buckets ("aktiv · in Prüfung · Vorschläge"), suggestion eyebrow → category + plum "Vorgeschlagen" pill, drawer top-right decramped |
| `27403f0` | Batch 2 Commit 2 — C-marker pixel-exact on its stop tick (verified numerically, 240.14px === 240.14px); plum target band rendered above coral fill with 2px vertical overhang, now visible |
| `4f051d9` | Batch 2 Commit 3 — slider failure toast + rollback. Fixed 2 real bugs: `/routine` had no layout so ToastProvider was never mounted (added `src/app/routine/layout.tsx`); toast viewport z-index below drawer (bumped to z-[60] in `src/providers/toast-provider.tsx`) |
| `334d9a2` | Batch 2 — empty state extended with spec reassurance line + "Onboarding anpassen" CTA → /onboarding |
| `62ee6a5` | This handoff doc |
| `ac0b6fa` | Final adoption — ball indicator on verified + suggestion cards (8 dots, coral fill; suggestion shows preferred stop); pending cards lose frequency line entirely ("von dir angelegt" scratched — pending card = eyebrow + pill + name, frequency stays editable in drawer); pending muted (24px hourglass, half-opacity stripes) |

### In flight

Nothing — UI polish complete, feature fully committed, Codex review findings fixed.

### Codex review (2026-07-07) — all findings fixed

| Commit | Finding fixed |
|---|---|
| `743c286` | Add/replace writes review-managed fields via service-role client (DB trigger `protect_user_product_usage_review_fields` blocked session-client writes). Auth/ownership stay session-side; admin writes user-scoped. PATCH/DELETE audited: unaffected by trigger. |
| `b0e182e` | Silent GET re-fetch after frequency PATCH (400ms debounced, sequence-guarded) — card state/delta text now live-refresh from CareBalance. |
| `3cb05e4` | `VALID_CATEGORIES` sourced from engine `INVENTORY_CATEGORIES` (heat_protectant addressable). New contract test `tests/routine-category-contract.test.ts`. |
| `3ee2f38` | Trigger-created conversations get German titles ("Routine · {Kategorie}" etc.). |
| `e5e8230` | BONUS bug found in verification: `products.category` raw labels ("Shampoo") vs API keys ("shampoo") — strict equality 422'd all adds. Now compares via `normalizeCategoryKey`. |

Verification: routine suite 54/54, live add/replace 200 through trigger-protected DB, heat_protectant dismiss 200, CareBalance delta text live-flips both directions without reload.

### Open decisions (user)

None. Next: clean working tree → push + PR (user confirmation pending).

### Backlog (explicitly deferred, next work package)

1. **Reason-code copy map (IMPORTANT — user-flagged):** suggestion cards + "Warum es passt" boxes currently use static one-liners. CareBalance rows expose `decisiveReasonCodes` / `contextReasonCodes` — build a code→German-copy map so each suggestion/assessment reads specifically ("Bei Spliss-Signalen wirkt ein Bond Builder…"). Extra scoped work package after polish.
2. "Angaben ergänzen" deep-link: currently routes to a generic `discuss_product` chat trigger; designed behavior is a pre-populated ProductIntakeCard (`existing_submission_id` + `existing_usage_id`). Needs a routable surface (e.g. query params the chat page reads).
3. Pending ETA copy "meist innerhalb 24 h" is a hardcoded promise — align with ops reality or soften.

### After polish completes (ship gate, per CLAUDE.md)

1. Keep the worktree clean except intentional PR content.
2. Push + PR (squash-merge).
3. Apply migration `20260706130000_dismissed_suggestions.sql` to production Supabase as an explicit deploy step.
4. Run one authenticated production smoke on `/routine` after deploy.

## Constraints for any resuming session

- Worktree should be clean before push. If local tool metadata appears under `supabase/.temp/*`, do not include it in the PR.
- Do not touch the data layer (`src/lib/routines/*.ts` logic, API handlers) except where the punch list requires it.
- 8-stop frequency enum from `src/lib/vocabulary/frequencies.ts` is canonical; never invent values.
- Typecheck before every commit (pre-commit hook enforces).
