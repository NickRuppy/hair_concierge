# Routine Artifact · UI Polish · Handoff / Resume State

> Living handoff doc. Purpose: if the session is cut off (spend limit or otherwise),
> a fresh session can resume the polish work without re-deriving context.
> Update the "State" section after each completed batch.

**Worktree:** `.worktrees/routine-artifact-current-main` · branch `codex/routine-artifact-current-main`
**Dev server:** `http://localhost:3315` (dev-login: `GET /api/dev/login?next=/routine` gives an authenticated session)
**Spec:** `docs/superpowers/specs/2026-06-08-routine-artifact-design.md` (root checkout — note the 2026-07-06 deltas section)
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

### In flight (agent batch 2, may be partially done — check `git log` + `git status`)

- **Commit 2 "fix(routine): slider C-marker alignment + target band visibility"** — `routine-frequency-control.tsx` edits possibly uncommitted in the working tree. Verify: C-marker must sit exactly on its stop tick (same `index/(stops-1)` math as ticks/thumb); plum band must render ABOVE the coral fill so it's visible. Zoom-screenshot the slider to confirm.
- **Commit 3 "fix(routine): slider failure feedback"** — PATCH failure → rollback to previous value + German toast ("Speichern fehlgeschlagen. Bitte versuche es noch einmal."). Toast pattern: `src/providers/toast-provider` as used in `src/app/profile/page.tsx`.
- **Empty-state audit** — verify `isEmpty` path in `routine-page-client.tsx` renders spec popup ("Sicher, dass du noch nichts eingetragen hast?" + CTA "/onboarding"). Fix + commit only if broken.
- **A/B screenshots (no commits, revert afterwards):** `/tmp/ab-balls-with.png` (7-ball freq indicator on cards) vs `/tmp/ab-balls-without.png`; `/tmp/ab-pending-muted.png` (24px hourglass, half-opacity stripes). User decides afterwards whether to adopt either.
- **Cleanup:** delete `check.local.mjs` / `check2.local.mjs` from worktree root if present.

### Open decisions (user)

1. Ball indicator on cards: adopt or skip (pending A/B screenshots).
2. Pending softening: adopt or skip (pending A/B screenshot).

### Backlog (explicitly deferred, next work package)

1. **Reason-code copy map (IMPORTANT — user-flagged):** suggestion cards + "Warum es passt" boxes currently use static one-liners. CareBalance rows expose `decisiveReasonCodes` / `contextReasonCodes` — build a code→German-copy map so each suggestion/assessment reads specifically ("Bei Spliss-Signalen wirkt ein Bond Builder…"). Extra scoped work package after polish.
2. "Angaben ergänzen" deep-link: currently routes to a generic `discuss_product` chat trigger; designed behavior is a pre-populated ProductIntakeCard (`existing_submission_id` + `existing_usage_id`). Needs a routable surface (e.g. query params the chat page reads).
3. Pending ETA copy "meist innerhalb 24 h" is a hardcoded promise — align with ops reality or soften.

### After polish completes (ship gate, per CLAUDE.md)

1. `npm run ci:verify`
2. Codex review via `codex:codex-rescue` agent on `git diff main...HEAD`
3. Fix real findings
4. Push + PR (squash-merge)

## Constraints for any resuming session

- Worktree contains OTHER uncommitted work (chat/header/agent/api files). NEVER `git add -A` — stage explicitly by path.
- Do not touch the data layer (`src/lib/routines/*.ts` logic, API handlers) except where the punch list requires it.
- 8-stop frequency enum from `src/lib/vocabulary/frequencies.ts` is canonical; never invent values.
- Typecheck before every commit (pre-commit hook enforces).
