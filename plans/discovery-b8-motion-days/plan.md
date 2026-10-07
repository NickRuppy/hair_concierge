# Discovery toolkit — batch 8: smooth transitions + default days (Rev. 1, proposal)

Status: **proposal, awaiting Nick's go** (2026-09-25). Base `origin/main` `6458825e` (batch 7 live: #610–#612).
Source: Nick's live test of batch 7 on his iPhone („very sleek … some weird transitions/loading screens pop up only shortly — feel like a flicker and an interruption") + his ruling on the routine days.

## Part A — Default days in „Deine Routine" (ruled by Nick 2026-09-25)

Current (`src/lib/discovery/routine-days.ts`): days purely by product type; only non-empty cards.
Change:
1. **Always two default cards: „Waschtag" and „Tag ohne Wäsche"**, the latter shown even when empty (one quiet line „Nichts eingetragen").
2. „Zwischendurch" becomes „Tag ohne Wäsche": dry shampoo, finish oil, scalp care land there.
3. **Leave-in also on „Tag ohne Wäsche"** when its frequency is higher than her (most frequent) shampoo's frequency; otherwise Waschtag only. Display-only comparison — nothing else depends on it. Unknown/missing frequency → Waschtag only.
4. Intensiv-Pflegetag, Styling, Weitere unchanged (only when matching products exist). No „nicht jede Wäsche" note.
Tests: composer table (empty intake → both default cards; leave-in daily vs shampoo 2× → both cards; leave-in = shampoo → Waschtag only; unknown → Waschtag only).

## Part B — Transitions and loading states

Audit (code-level, 2026-09-25) inventoried every transition from invite → quiz → products → routine → heat → final → done. Root causes of the „flicker":
- **Leaving screens/steps are re-mounted instead of frozen** (`src/components/discovery/intake/discovery-motion.tsx` `SlideStage`): the old step replays its fade-ins, loses the tapped highlight, can restart the camera. The quiz already does it right (`quiz-shell.tsx` frozen snapshot).
- **Quiz ending for invitees is a chain of short loaders + artificial waits**: „Dein Zugang wird geladen …" → „Dein Haarprofil wird gespeichert …" → „Geschafft" → fixed 2.6 s „Einen Moment" → fixed 0.9 s „Bereit." → hard cut to `/beratung/produkte` (no `loading.tsx`, so prefetch does nothing).
- **Main-problem sheet vanishes in one frame** (step change unmounts the sheet owner) + scroll-lock restore jump.
- **Search blinks per keystroke** (results replaced by skeletons before the debounce; dm section and „Selbst eintragen" blink too).
- **Every save dims the whole page** (shared busy flag); remove has no exit animation → grid jump.
- Add sheet: height collapse, header disappears, keyboard drops, focus ring on X when picking a result.

### Unified motion spec (quiz + intake)
| Token | Value | Used for |
|---|---|---|
| Enter easing | `cubic-bezier(.32,.72,0,1)` | anything appearing |
| Exit easing | `cubic-bezier(.4,0,1,1)` | anything leaving |
| Settle | 200 ms | the one delay after a single-tap answer before advancing, everywhere |
| Step | 240 ms in / 160 ms out | quiz questions, heat questions, in-sheet steps |
| Screen | 320 ms | products ↔ routine ↔ heat ↔ final ↔ done, quiz → products |
| Sheet | 350 ms in / 250 ms out | bottom sheets (unchanged) |
| List | 220 ms | card land / remove / reorder |
| Loader delay | 300 ms | no loader/skeleton/„speichert" before this |
| Loader minimum | 500 ms | once shown, keep at least this long |
Rules: old step/screen = frozen snapshot on an opaque background; no per-option fade inside an animating step; a sheet always finishes closing before the next thing happens; buttons keep label/width and show an inline spinner only after 300 ms; never dim the page; lists keep old results while new ones load; reduced motion unchanged (off).

### Ranked changes
1. Freeze the leaving layer in `SlideStage` (quiz-shell technique; pin scroll; skip camera re-mount). **M, biggest win.**
2. Collapse the invitee quiz ending: „Geschafft" immediately, access check + profile save in the background (button waits, spinner after 300 ms), drop the 3.5 s artificial wait and the two calls invitees don't need. **M**
3. `app/beratung/produkte/loading.tsx` = exact empty products screen; prefetch at quiz end. **S**
4. Search keeps old results while loading; skeletons only on first load after 300 ms; dm rows and „Selbst eintragen" don't blink (shared with `/scan` → regression check). **S–M**
5. Main-problem sheet: selected state 200 ms → close → advance after close (`onClosed` on the bottom sheet). **S**
6. No whole-page dimming during saves; tapped option stays highlighted. **S**
7. Optimistic updates with rollback: remove (220 ms fade-collapse), heat answers advance immediately (submit waits for pending save), card lands right after the settle. **S–M**
8. Stable add sheet: one height for the whole flow, product header outside the sliding area, header never removed. **M**
9. Sheet focus: no focus jump to X on step changes, focus ring only for keyboard, search focus only on first open. **S**
10. Opaque step backgrounds, no double animation, heat bottom button always mounted (fade), preload tool photos. **S**
11. Invite card at final size immediately (loader only after 300 ms); render question 1 while `/quiz` checks the draft; optional cross-page view transition for the two full page loads. **S (M with view transition)**
12. Apply the motion tokens + settle delay everywhere; card landing after the sheet closed; clear the landed marker. **S**

Not verifiable from code (needs device recordings / Safari Web Inspector / Vercel+Sentry timings): real server times, iOS keyboard behaviour, camera restart, one-frame name-form paint, toolbar height jumps. Verification protocol: fixed script (invite → claim → quiz with 2 concerns + pick → products: type „olaplex" slowly, pick, answer; remove one; typed product; barcode → routine → heat → submit), 60 fps iPhone recording before/after + Playwright WebKit iPhone trace with network mocked at 150 ms and 800 ms.

## Delivery
One PR (Part A + B items 1–12), or split B into „motion polish" (1, 5, 6, 10, 12) + „quiz ending" (2, 3) + „add sheet" (4, 8, 9) + „instant saves" (7) + „invite/quiz start" (11) if the diff gets large. No migration. Production funnel touched by items 2, 5, 11 (quiz) and 4 (shared scan search).
