# AgentV2 German Orthography Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec Source:** Thread decisions from 2026-06-01 after plan grill, Claude review, and thermo-nuclear code-quality review.

**User Situation:** German recommendation/routine answers can still contain ASCII replacement spellings like `Fuer`, `fuer`, `Laengen`, `wuerde`, or `Oel`. This is jarring in final answers and can be copied from upstream model-facing context.

**Promised End-State:** Current production AgentV2/CareBalance model-facing sources and current visible app-auth copy use standard German orthography. AgentV2 user-facing payload validation emits a warning when obvious ASCII-German transliterations still appear, without blocking answers or adding repair latency.

**Implementation Status (2026-06-01):** Implemented on `codex/final-answer-umlauts`. Final review approved after adding loaded `data/agent-v2/guidance/**` files and `src/lib/agent/tools/get-user-context.ts` to the guard. Fresh verification passed: `npm run test:agent`, `npm run ci:verify`, `npx playwright test tests/routine-planner.spec.ts --project=chromium`, `npx playwright test tests/conditioner-reranker.spec.ts tests/user-memory.spec.ts --project=chromium`, targeted orthography/guidance tests, auth browser copy check, and `git diff --check`. Pre-deploy caveat remains: run `npm run langfuse:sync-prompts` when publishing managed Langfuse prompts.

**Architecture:** Put ASCII-German detection behind one shared orthography module. Use that module from both the runtime validator and source guard. Clean current AgentV2/CareBalance upstream copy, recommendation-engine metadata that feeds AgentV2, and a tiny auth UI surface. Do not normalize raw user input. Do not mutate final answers. Do not add repair calls. Do not clean compare-only legacy/tool-loop archaeology.

**Tech Stack:** TypeScript, AgentV2 Responses runtime, recommendation-engine runtime metadata, existing AgentV2 final-answer validator, Node test runner via `tsx --test`, Playwright for affected UI only if needed.

---

## Alignment Decisions

- Use the upstream/source-ownership approach, not final-output rewriting.
- Keep the validator warning-only. No repair loop, no extra model call, no latency increase.
- Use curated token/stem patterns, not raw `ue|ae|oe` syllable checks.
- Preserve raw user messages, evidence quotes, source fixtures, and detector regexes that intentionally accept user-transliterated input.
- Exclude `classic` and `tool_loop` compare-only paths from this cleanup. They are not reachable from `/api/chat`; polishing them is archaeology.
- Include current production AgentV2/CareBalance model-facing context.
- Include recommendation-engine metadata when it flows into AgentV2 product/routine context.
- Include small visible auth UI copy cleanup because the quick app-UI scan found low-effort visible leaks.
- Exclude admin UI and labs UI.
- Reconcile existing branch drift before implementation: labs/compare-only edits already present on the branch should be removed from this change unless a current production AgentV2/CareBalance reason is found and documented.
- Do not broaden this into product-copy architecture decomposition. The broader copy ownership smell is real, but out of scope for this branch.

## Non-Goals

- No deterministic final-answer umlaut normalizer.
- No blocking validator for orthography.
- No model repair pass.
- No normalization of stored conversation history, user input, evidence quotes, product source data, or compare fixtures.
- No deletion or refactor of legacy `classic` / `tool_loop` compare systems.
- No broad UI linting project.
- No recommendation ranking, product selection, routine planning, or hair-care domain logic changes.
- No decomposition of large files like `select-products.ts` beyond the minimal copy cleanup needed here.

## Target File Map

Create:

- `src/lib/german-orthography/ascii-transliterations.ts`
  - Shared curated detector/registry for ASCII-German transliteration patterns.

Modify:

- `src/lib/agent-v2/runtime/prompt.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/lib/agent-v2/tools/routine-projection.ts`
- `src/lib/agent-v2/tools/tool-definitions.ts`
- `src/lib/agent-v2/tools/select-products-projection.ts`
- `src/lib/agent-v2/validation/user-facing-language.ts`
- `src/lib/agent/tools/select-products.ts`
- `src/lib/agent/tools/build-or-fix-routine.ts`
- `src/lib/recommendation-engine/selection.ts`
- `src/lib/rag/synthesizer.ts`
- `src/lib/rag/prompts.ts`
- `src/lib/routines/planner.ts`
- `src/lib/routines/brush-tools.ts`
- `src/lib/oil/constants.ts`
- `src/lib/leave-in/constants.ts`
- `src/lib/product-specs/constants.ts`
- `src/lib/bondbuilder/usage-protocols.ts`
- `src/app/auth/page.tsx`
- `src/components/auth/auth-form.tsx`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`
- `tests/agent-v2-tool-projections.spec.ts`
- `tests/agent-select-products-tool.spec.ts`
- `tests/routine-planner.spec.ts`
- `tests/conditioner-reranker.spec.ts`
- `tests/agent-v2-german-orthography.spec.ts`
- `package.json`

Explicitly exclude:

- `src/lib/agent/orchestrator/*`
- `src/lib/agent/legacy-production/*`
- `src/lib/agent/compare/*` except current AgentV2 compare tests already touched by this branch
- `src/app/api/labs/**`
- `src/app/labs/**`
- `src/components/labs/**`
- `src/app/admin/**`
- broad `tests/agentic-tool-loop.spec.ts` legacy cleanup

---

## Task 0: Reconcile Existing Branch Scope

**Files:**
- Inspect: current worktree diff.
- Potentially remove from this branch: `src/app/api/labs/agent-compare/judgments/route.ts` changes and related guard allowlists, unless a current production path requires them.

- [ ] **Step 1: Inspect branch drift against this plan**

Run:

```bash
git status --short
git diff --name-only
```

Identify files changed by the earlier implementation that this plan now excludes, especially labs/compare-only files.

- [ ] **Step 2: Remove excluded labs/compare changes from this branch**

If `src/app/api/labs/**`, `src/app/labs/**`, `src/components/labs/**`, `src/lib/agent/orchestrator/**`, `src/lib/agent/legacy-production/**`, or `src/lib/agent/compare/**` changes are only legacy/labs/compare cleanup, remove those edits from this branch. Do not remove unrelated user work; if a changed labs/compare file has a current production AgentV2/CareBalance reason, document that reason in the handoff and make the plan/guard manifest agree.

## Task 1: Create One Shared Orthography Detector

**Files:**
- Create: `src/lib/german-orthography/ascii-transliterations.ts`

- [ ] **Step 1: Add a shared detector module**

Create a small, direct module with one canonical pattern registry:

```ts
export interface AsciiGermanOrthographyMatch {
  id: string
  match: string
  index: number
}

export const ASCII_GERMAN_ORTHOGRAPHY_PATTERNS: Array<{
  id: string
  pattern: RegExp
}> = [
  { id: "fuer", pattern: /\b(?:fuer|dafuer|hierfuer)\b/gi },
  { id: "laengen", pattern: /\b(?:laengen|laengenschutz)\b/gi },
  // include the existing curated stems from the guard and validator:
  // wuerde, waere, koennen, moechte, moeglich, oel, waesche, rueck,
  // schueppchen, foehn, ausspuelen, erklaeren, naechst, ueber,
  // gruendlich, noetig, natuerlich, primaer, staerk, glaett,
  // groesser, taeglich, aerztlich, heisst, gross, ausser, weiss,
  // intensitaet, sensitivitaet, oberflaeche, loesung, abklaerung.
]

export function findAsciiGermanOrthography(text: string): AsciiGermanOrthographyMatch[] {
  const matches: AsciiGermanOrthographyMatch[] = []

  for (const { id, pattern } of ASCII_GERMAN_ORTHOGRAPHY_PATTERNS) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      matches.push({ id, match: match[0], index: match.index ?? 0 })
    }
  }

  return matches
}

export function hasAsciiGermanOrthography(text: string): boolean {
  return findAsciiGermanOrthography(text).length > 0
}
```

Use curated words/stems. Do not scan raw syllables like `ue`, `ae`, or `oe`.
Every pattern must be global and case-insensitive (`gi`) or explicitly enumerate uppercase variants. The validator must keep detecting sentence-initial forms like `Wuerde`, `Oel`, `Foehn`, and `Moechte`.

- [ ] **Step 2: Keep detector input-agnostic**

The module should not know about AgentV2 payload paths, source files, or allowlists. It only detects text.

- [ ] **Step 3: Add focused detector coverage if useful**

Cover detection of `Fuer`/`Laengen` and non-detection of `für`, `neue`, `heute`, `teuer`, either through a small standalone test or through Tasks 2 and 5.

## Task 2: Use The Shared Detector In Runtime Validation

**Files:**
- Modify: `src/lib/agent-v2/validation/user-facing-language.ts`
- Modify: `tests/agent-v2-final-answer-validator.spec.ts`

- [ ] **Step 1: Replace local regex with shared detector**

Import `hasAsciiGermanOrthography` from the shared module. Do not keep a second local `ASCII_GERMAN_ORTHOGRAPHY_PATTERN`.

- [ ] **Step 2: Emit warning-only findings**

Inside the existing loop over collected user-facing payload strings, emit warning id `user_facing_ascii_german_orthography` with `severity: "warn"`. The warning must not make `validateAgentV2FinalAnswer(...).ok` false.

- [ ] **Step 3: Add positive validator coverage with a valid fixture**

Use a known-passing `general_advice` fixture or build one with:

- `toolCallHistory: []`
- `selectedProductProjections: []`
- a valid `care_category` such as `conditioner` or `leave_in`
- a multi-word `evidence_quote` present in `latestUserMessage`
- matching `used_guidance_package_ids`

Then change only user-facing payload prose to include representative ASCII German. Assert `ok === true`, no blocking errors, and warning id `user_facing_ascii_german_orthography` is present.

- [ ] **Step 4: Add negative coverage for valid letter pairs**

Use another known-passing fixture with text like:

```txt
Heute ist eine neue, teure Pflege nicht nötig; Feuchtigkeit und sanftes Ausspülen reichen.
```

Assert no orthography warning. Avoid invalid `care_category` values and single-token evidence quotes.

- [ ] **Step 5: Run validator test**

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
```

Expected: pass.

## Task 3: Clean Current AgentV2/CareBalance Model-Facing Sources

**Files:**
- Modify current production/model-facing files from the target file map.
- Modify coupled current-path tests.

- [ ] **Step 1: Audit current-path source strings**

Run a source audit over only current production/model-facing paths:

```bash
rg -n "\b(fuer|Fuer|dafuer|Dafuer|wuerde|Wuerde|waere|Waere|koennte|Koennte|koennen|Koennen|moechte|Moechte|moeglich|Moeglich|laengen|Laengen|gefuehl|Gefuehl|fuelle|Fuelle|oel|Oel|waesche|Waesche|rueck\w*|Rueck\w*|schueppchen|Schueppchen|foehn\w*|Foehn\w*|ausspuelen|Ausspuelen|erklaeren|Erklaeren|naechste\w*|Naechste\w*|ueber\w*|Ueber\w*|gruendlich|Gruendlich|noetig|Noetig|natuerlich|Natuerlich|primaer|Primaer|staerk\w*|Staerk\w*|glaett\w*|Glaett\w*|taeglich|Taeglich|aerztlich|Aerztlich|heisst|Heisst|gross\w*|Gross\w*|ausser\w*|Ausser\w*|weiss|Weiss|zurueck\w*|Zurueck\w*|schliess\w*|Schliess\w*|aender\w*|Aender\w*|buerst\w*|Buerst\w*|haeufig\w*|Haeufig\w*|waehl\w*|Waehl\w*)\b" \
  src/lib/agent-v2 \
  src/lib/agent/tools/select-products.ts \
  src/lib/agent/tools/build-or-fix-routine.ts \
  src/lib/recommendation-engine/selection.ts \
  src/lib/rag/synthesizer.ts \
  src/lib/rag/prompts.ts \
  src/lib/routines/planner.ts \
  src/lib/routines/brush-tools.ts \
  src/lib/oil/constants.ts \
  src/lib/leave-in/constants.ts \
  src/lib/product-specs/constants.ts \
  src/lib/bondbuilder/usage-protocols.ts
```

- [ ] **Step 2: Convert model-facing and user-visible prose**

Convert strings the model may copy or the user may see, for example `fuer` -> `für`, `Laengen` -> `Längen`, `wuerde` -> `würde`, `Oel` -> `Öl`, `gruendlich ausspuelen` -> `gründlich ausspülen`, `Foehn/Foehnschutz` -> `Föhn/Föhnschutz`, `Rueckstaende` -> `Rückstände`, `Oberflaeche` -> `Oberfläche`, `Loesung` -> `Lösung`, `Abklaerung` -> `Abklärung`.

Do not change raw user-message fixtures, evidence quotes, stable slugs, enum-like internal values, or detector terms.

- [ ] **Step 3: Preserve transliteration-tolerant detectors**

Leave detector regexes/input-normalization values intact where they intentionally accept user text such as `oel`, `haaroel`, `kopfhautoel`, `fuer|fur`, `rueckstand`, `ueberpflegt`, and `naechster tag`. Each intentional source occurrence in guarded files must get a source-guard allowlist entry with a reason.

- [ ] **Step 4: Update coupled tests**

Update expected current-path assistant/model-facing strings. Do not “fix” user-input fixtures. Good rule:

- `payload.user_facing_answer_de`, `reason_de`, `usage_de`, `category_guidance`, `fit_reason`, `top_reasons`, `tradeoffs`, `usage_hint`, `conversation_prompt_de`: standard German.
- `latestUserMessage`, `message`, `evidence_quote`, raw compare prompt fixtures: preserve as-is unless the test is specifically about assistant output.

- [ ] **Step 5: Run focused current-path tests**

```bash
npx tsx --test \
  tests/agent-v2-responses-runtime.spec.ts \
  tests/agent-v2-tool-projections.spec.ts \
  tests/agent-select-products-tool.spec.ts
```

Then run the Playwright specs with the Playwright runner:

```bash
npx playwright test tests/routine-planner.spec.ts tests/conditioner-reranker.spec.ts --project=chromium
```

Expected: pass.

## Task 4: Add AgentV2 Prompt Contract

**Files:**
- Modify: `src/lib/agent-v2/runtime/prompt.ts`
- Verify: `tests/langfuse-prompts.test.ts`

- [ ] **Step 1: Add explicit standard-German instruction**

Ensure `AGENT_V2_RESPONSES_SYSTEM_PROMPT` says user-facing prose must use standard German orthography, including umlauts and `ß`, and must not use ASCII replacement spellings with `ae`, `oe`, or `ue` where standard German uses an umlaut.

- [ ] **Step 2: Run prompt fallback test**

```bash
npx tsx --test tests/langfuse-prompts.test.ts
```

Expected: pass.

- [ ] **Step 3: Run required managed-prompt sync before deploy**

Before deployment, run:

```bash
npm run langfuse:sync-prompts
```

This is load-bearing when a managed Langfuse prompt is published: production fetches the managed prompt first and falls back to `AGENT_V2_RESPONSES_SYSTEM_PROMPT` only if Langfuse is unavailable or fetch fails. If credentials/env are unavailable during implementation, do not claim the prompt instruction is deployed; document the sync as a required pre-deploy blocker or verify that no published managed override exists.

## Task 5: Add Current-Path Source Guard

**Files:**
- Modify/Create: `tests/agent-v2-german-orthography.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Use the shared detector**

The source guard must import `findAsciiGermanOrthography` instead of defining another forbidden-pattern list.

- [ ] **Step 2: Define a current-path source manifest**

Include only files in the target file map that are current production/model-facing or low-effort visible app UI. Exclude compare-only legacy/tool-loop/labs/admin paths explicitly in a comment so future reviewers know this is deliberate.

Do not line-scan pure detector/validator implementation files such as `src/lib/agent-v2/validation/user-facing-language.ts`; they intentionally contain normalized ASCII trigger terms and are covered by validator tests. The source guard should scan prompt/context/copy-producing files, not every file touched by this plan.

- [ ] **Step 3: Keep allowlists narrow and justified**

Each allowlist entry should specify file, detector id, source-line pattern, and reason. Allowed reasons should be specific: user-input detector, stable internal slug, normalized trigger token, or legacy compatibility input normalized before display. Do not allowlist broad prose lines just to make the guard pass.

- [ ] **Step 4: Assert guard failures are empty**

For each manifest file, scan source lines with `findAsciiGermanOrthography`. Skip allowlisted line/id pairs. Fail with `file:line`, detector id, match, and trimmed line.

- [ ] **Step 5: Wire guard into `test:agent`**

Ensure `package.json` includes `tests/agent-v2-german-orthography.spec.ts`, and ensure the file is tracked before handoff.

- [ ] **Step 6: Run guard**

```bash
npx tsx --test tests/agent-v2-german-orthography.spec.ts
```

Expected: pass.

## Task 6: Clean Tiny Visible App Auth UI Surface

**Files:**
- Modify: `src/app/auth/page.tsx`
- Modify: `src/components/auth/auth-form.tsx`

- [ ] **Step 1: Convert visible auth copy**

Convert only visible app-auth strings:

- `Willkommen zurueck` -> `Willkommen zurück`
- `zuruecksetzen` -> `zurücksetzen`
- `Zurueck zur Anmeldung` -> `Zurück zur Anmeldung`
- `moeglich` -> `möglich`
- `fuer dieses Konto` -> `für dieses Konto`

- [ ] **Step 2: Skip labs/admin**

Do not clean `src/app/labs/**`, `src/components/labs/**`, or `src/app/admin/**`.

- [ ] **Step 3: Verify auth build/type safety through typecheck**

No browser check is required unless these files need structural UI edits. This should be text-only.

## Task 7: Full Verification

- [ ] **Step 1: Run focused unit tests**

```bash
npx tsx --test tests/agent-v2-german-orthography.spec.ts
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
npx tsx --test tests/agent-v2-tool-projections.spec.ts tests/agent-select-products-tool.spec.ts
```

- [ ] **Step 2: Run current routine/product regression tests**

```bash
npx playwright test tests/routine-planner.spec.ts --project=chromium
npx playwright test tests/conditioner-reranker.spec.ts tests/user-memory.spec.ts --project=chromium
```

- [ ] **Step 3: Run repo agent suite and typecheck**

```bash
npm run test:agent
npm run ci:verify
git diff --check
```

- [ ] **Step 4: Ready-check before shipping**

Because this touches recommendations, copy, trust, and visible UI text, run the repo `ready-check` skill before handoff.

## Task 8: Handoff Notes

- [ ] **Step 1: Summarize residual risk**

Call out that warn-only validation observes residual model-generated transliterations but does not guarantee zero runtime leaks.

- [ ] **Step 2: Summarize explicit exclusions**

Mention that compare-only legacy/tool-loop paths, labs UI, admin UI, and broad copy architecture decomposition were deliberately excluded.

- [ ] **Step 3: Name next execution skill**

Next skill: `superpowers:subagent-driven-development`.
