# Profile page — editorial v3 implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewire `src/app/profile/page.tsx` to match the agreed v3 editorial mockup — strip out the gamified progress card, Schnellzugriff shortcut grid, and section collapsibles; render every field as a chip inside an always-open section; make each field card click-to-edit. **Memory, Account, and "Dein Abo" panels stay** (functional and needed) but move below the five editorial sections and get light visual polish so they read as footer utilities rather than peers of Haar-Check.

**Architecture:** In-place simplification of the existing page.tsx — we delete two JSX blocks (top progress card, shortcut grid) and simplify three local components (`SectionHeader`, `ProfileFieldCard`, the `goals` section render). We keep the data-loading effects (including memory), the inline `QuizEditorField` editor, the per-field `editTarget` routing, the `PROFILE_FIELD_CONFIG` mapping, and the memory / subscription / account JSX. Memory keeps its Mehr/Weniger collapsible because the entry list can be long. No new routes, no new lib modules.

**Tech Stack:** Next.js 15 app router, React 19, Tailwind v4, shadcn-ui primitives, Supabase, Playwright for visual smoke tests.

**Reference mockup:** `docs/mockups/profile-editorial-v3-applied.html`
**UX audit:** `ux-audits/2026-04-21-profile-page/report.md`
**Seeded test user:** `ux-audit-test@hairconscierge.test` / `uxAudit!Test123` (matches the mockup data).
**Dev server:** `npm run dev:worktree` (runs on port 3761 in this worktree).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/app/globals.css` | Add a `.profile-page` scope with the cream background + two radial tints. | Modify |
| `src/lib/profile/profile-overview.ts` | `getDefaultOpenProfileSections` + `getProfileOverviewSummary` — both obsolete once every section is always-open and the progress card is gone. | **Delete** |
| `tests/profile-overview.test.ts` | Test for the obsolete helpers. | **Delete** |
| `src/lib/profile/section-config.ts` | Rename the `memory` entry: title "Was Hair Concierge sich merkt" → "Erinnerungen"; shorten description. Memory still rendered below the core sections. | Modify |
| `src/app/profile/page.tsx` | Main rewrite: remove progress card + shortcut grid; simplify `SectionHeader`, `ProfileFieldCard`; default core section `openSections` to all keys; render Ziele full-width; keep memory + account + subscription panels but move them below Ziele and downshift their styling. | Modify (incremental) |
| `tests/profile-page-smoke.spec.ts` | Drop `ensureSectionOpen` helper (sections can't be collapsed anymore). | Modify |
| `tests/profile-editorial-v3.spec.ts` | New UI smoke test asserting v3 layout invariants. | **Create** |

---

## Task 1: Add cream background + radial gradients for the profile route

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/profile/page.tsx:~1295` (the outer `<main>`)

- [ ] **Step 1: Inspect the end of globals.css**

Run: `grep -n "^}" src/app/globals.css | tail -5`

Then read the last ~30 lines to find a good spot to add a new scoped block.

- [ ] **Step 2: Add the `.profile-page` scope at the end of globals.css**

Append:

```css
/* Editorial profile surface — cream base + subtle brand tints. */
.profile-page {
  background:
    radial-gradient(circle at top left, rgba(var(--brand-coral-rgb), 0.08), transparent 26%),
    radial-gradient(circle at top right, rgba(var(--brand-plum-rgb), 0.08), transparent 24%),
    hsl(var(--background));
  min-height: 100vh;
}
```

- [ ] **Step 3: Apply the class on the profile `<main>`**

In `src/app/profile/page.tsx` find the `<main className="mx-auto max-w-5xl px-4 py-8">` opening tag (search: `max-w-5xl px-4 py-8`). Replace the surrounding structure so the new class wraps the page:

```tsx
return (
  <>
    <Header />
    <div className="profile-page">
      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* existing contents */}
      </main>
    </div>
  </>
)
```

Do the same for the `authLoading` branch so the loading spinner shares the background.

- [ ] **Step 4: Visual check**

Start the dev server if not running:
```bash
npm run dev:worktree
```
Open `http://localhost:3761/profile` as the seeded user. Expected: cream background with a faint coral tint top-left and plum tint top-right. Nothing else should have changed yet.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/profile/page.tsx
git commit -m "feat(profile): cream background with subtle brand tints"
```

---

## Task 2: Delete the obsolete `profile-overview` helpers + test

**Files:**
- Delete: `src/lib/profile/profile-overview.ts`
- Delete: `tests/profile-overview.test.ts`
- Modify: `src/app/profile/page.tsx` (remove imports + callsites)

- [ ] **Step 1: Confirm the helpers are only used from page.tsx**

Run:
```bash
grep -rn "getDefaultOpenProfileSections\|getProfileOverviewSummary" src/ tests/
```
Expected: matches only in `src/lib/profile/profile-overview.ts`, `src/app/profile/page.tsx`, and `tests/profile-overview.test.ts`. If anything else shows up, stop and flag — it needs its own migration.

- [ ] **Step 2: Delete the lib file and the test**

```bash
rm src/lib/profile/profile-overview.ts tests/profile-overview.test.ts
```

- [ ] **Step 3: Remove the import + the two callsites in page.tsx**

In `src/app/profile/page.tsx`:
- Delete the import block:
  ```tsx
  import {
    getDefaultOpenProfileSections,
    getProfileOverviewSummary,
  } from "@/lib/profile/profile-overview"
  ```
- Delete the `const overviewSummary = getProfileOverviewSummary(...)` assignment (around line 1017).
- Delete the `useEffect` that computes `defaultOpenSections` via `getDefaultOpenProfileSections` (around line 1025–1045).
- Replace the `useState` default for `openSections` so every section is open from first paint:
  ```tsx
  const [openSections, setOpenSections] = useState<ProfileJourneySectionKey[]>([
    "quiz",
    "products",
    "styling",
    "routine",
    "goals",
  ])
  const [sectionsInitialized] = useState(true) // kept as const since the hook still reads it
  ```
  (We can remove `sectionsInitialized` entirely in Task 5; keep for now to minimise edits per task.)

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: passes. If `overviewSummary` is referenced elsewhere in the JSX, remove those references now (they all live in the progress-card JSX that Task 4 will delete — replace them with `null` for now so the build passes, the whole block gets cut in Task 4).

- [ ] **Step 5: Run the remaining unit tests**

```bash
npx playwright test --list 2>/dev/null >/dev/null; npm test --silent 2>&1 | tail -20
```
Expected: no test failures referencing `profile-overview`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(profile): drop obsolete overview helpers (progress card is being removed)"
```

---

## Task 3: Rename the memory section meta

**Files:**
- Modify: `src/lib/profile/section-config.ts`

- [ ] **Step 1: Rename the memory entry in `PROFILE_SECTION_META`**

Open `src/lib/profile/section-config.ts` and find:
```ts
  {
    key: "memory",
    title: "Was Hair Concierge sich merkt",
    description:
      "Langfristige Erinnerungen aus deinem Chat, damit Empfehlungen konsistenter werden.",
  },
```
Replace with:
```ts
  {
    key: "memory",
    title: "Erinnerungen",
    description: "Hinweise aus dem Chat, langfristig gespeichert.",
  },
```

- [ ] **Step 2: Update `PROFILE_JOURNEY_STEPS` memory label (if referenced)**

Find:
```ts
  { key: "memory", label: "Merkt sich" },
```
Change to:
```ts
  { key: "memory", label: "Erinnerungen" },
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/profile/section-config.ts
git commit -m "chore(profile): rename memory meta to 'Erinnerungen'"
```

---

## Task 4: Playwright smoke test for the v3 layout invariants (RED)

**Files:**
- Create: `tests/profile-editorial-v3.spec.ts`

- [ ] **Step 1: Write the failing smoke test**

Paste into `tests/profile-editorial-v3.spec.ts`:

```ts
import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3761"
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = "ux-audit-test@hairconscierge.test"
const PASSWORD = "uxAudit!Test123"

test.describe.serial("profile editorial v3", () => {
  test.beforeAll(async () => {
    // Ensure the seeded user exists; the audit scripts created it, but CI may not.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (!list.users.find((u) => u.email === EMAIL)) {
      await admin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
      })
    }
  })

  test("renders editorial layout without the removed blocks", async ({ page }) => {
    await page.goto(`${baseUrl}/auth`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(chat|profile|quiz|onboarding)/, { timeout: 10_000 })

    await page.goto(`${baseUrl}/profile`)
    await expect(page.getByRole("heading", { name: "Mein Profil", level: 1 })).toBeVisible()

    // 1. No gamified progress card
    await expect(page.getByText("Profil-Fortschritt")).toHaveCount(0)
    await expect(page.getByText("Nächster Fokus")).toHaveCount(0)

    // 2. No shortcut grid
    await expect(page.getByText("Schnellzugriff")).toHaveCount(0)
    await expect(page.getByText("Zum offenen Bereich springen")).toHaveCount(0)

    // 3. No Mehr/Weniger collapse buttons
    await expect(page.getByRole("button", { name: /aufklappen|zuklappen/ })).toHaveCount(0)
    await expect(page.locator('[aria-expanded="false"]')).toHaveCount(0)

    // 4. Footer utilities still render, with the new copy
    await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Erinnerungen" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Mitgliedschaft" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible()
    // Old copy must be gone
    await expect(page.getByRole("heading", { name: "Was Hair Concierge sich merkt" })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Dein Abo" })).toHaveCount(0)

    // 5. All five core sections are present and open
    for (const name of ["Haar-Check", "Produkte", "Styling", "Alltag", "Ziele"]) {
      await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible()
    }

    // 5b. Core sections render before the Einstellungen group in DOM order
    const coreLocator = page.getByRole("heading", { name: "Ziele", level: 2 })
    const einstellungenLocator = page.getByRole("heading", { name: "Einstellungen" })
    const [coreY, settingsY] = await Promise.all([
      coreLocator.boundingBox().then((b) => b?.y ?? 0),
      einstellungenLocator.boundingBox().then((b) => b?.y ?? 0),
    ])
    expect(settingsY).toBeGreaterThan(coreY)

    // 6. No per-field "Bearbeiten →" CTAs
    await expect(page.getByText(/^Bearbeiten$/)).toHaveCount(0)

    // 7. Hero has no body paragraph
    await expect(page.getByText("Je vollständiger dein Profil ist")).toHaveCount(0)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Start the dev server if not already running: `npm run dev:worktree`. Then:
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3761 npx playwright test tests/profile-editorial-v3.spec.ts --reporter=list
```
Expected: the test fails on most assertions — "Profil-Fortschritt" is present, "Schnellzugriff" is present, etc. That's correct — the next tasks make each assertion pass.

- [ ] **Step 3: Commit the red test**

```bash
git add tests/profile-editorial-v3.spec.ts
git commit -m "test(profile): red smoke test for v3 editorial layout"
```

---

## Task 5: Strip the top chrome — progress card + shortcut grid

**Files:**
- Modify: `src/app/profile/page.tsx` (delete JSX between the hero and the first section)

- [ ] **Step 1: Identify the block to delete**

Search page.tsx for the progress card opener:
```tsx
<section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
```
This opens the wrapper that contains the progress `Card` AND the `OverviewShortcutCard` grid. The block ends with `</section>` right before `<Card id="profile-section-quiz"`.

- [ ] **Step 2: Delete the whole wrapper section**

Delete the entire `<section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"> … </section>` block (approximately lines 1311–1370). Also delete the surrounding `<div className="space-y-6">` **only** if it becomes empty — it still wraps the section cards below, so leave it.

- [ ] **Step 3: Delete the now-unused `OverviewShortcutCard` component**

Scroll to the component definition (search `function OverviewShortcutCard`). Delete the entire function + its type props. Also delete the `coreSectionSummaries` `.map((section)` iteration's support fields if not used elsewhere — check with `grep`:

```bash
grep -n "OverviewShortcutCard\|coreSectionSummaries\|overviewSummary\b" src/app/profile/page.tsx
```
Expected after edits: zero matches.

- [ ] **Step 4: Delete the hero description paragraph**

Find:
```tsx
<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
  Je vollständiger dein Profil ist, desto besser werden Empfehlungen. Jeder Abschnitt
  zeigt dir direkt, wie viel schon da ist und was noch ergänzt werden kann.
</p>
```
Delete this element. Also swap the heading classes to the editorial tone:
```tsx
<div className="mb-10">
  <p className="type-overline text-primary">Profilübersicht</p>
  <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium leading-[0.96] tracking-tight text-[var(--text-heading)] sm:text-5xl">
    Mein Profil
  </h1>
</div>
```

- [ ] **Step 5: Typecheck + build**

```bash
npm run typecheck && npm run build
```
Expected: passes.

- [ ] **Step 6: Re-run the smoke test**

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3761 npx playwright test tests/profile-editorial-v3.spec.ts --reporter=list
```
Expected progress: assertions 1, 2, 7 now pass. Others still fail.

- [ ] **Step 7: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): drop progress card, shortcut grid, hero description"
```

---

## Task 6: Visually demote the memory / subscription / account panels

**Files:**
- Modify: `src/app/profile/page.tsx`

These three panels stay functional but should read as footer utilities, not peers of Haar-Check. Memory keeps its Mehr/Weniger collapsible because the entry list can be long; the three panels move below Ziele and get a muted visual treatment.

- [ ] **Step 1: Move the memory / subscription / account JSX below Ziele**

The render order inside `<div className="space-y-6">` is currently: progress card → shortcut grid → quiz → products → styling → routine → goals → **memory** → subscription → account. After Task 5 removed the first two, the order is quiz → … → goals → memory → subscription → account — which is already correct. No move needed, just confirm with:

```bash
grep -n "profile-section-memory\|stripe_customer_id\|bg-muted/35" src/app/profile/page.tsx
```
Expected: memory appears after the goals section and before subscription + account.

- [ ] **Step 2: Wrap the three footer panels in a shared "Einstellungen" group with a serif header**

Just above the memory `<Card id="profile-section-memory">`, insert:

```tsx
<div className="mt-12 border-t border-border/60 pt-8">
  <h2 className="font-[family-name:var(--font-display)] text-3xl font-medium leading-none text-[var(--text-heading)]">
    Einstellungen
  </h2>
</div>
```

Single Playfair heading at ~32px (one tier larger than core section h2s) so it reads as a group header, not a peer. No eyebrow, no subtitle.

- [ ] **Step 3: Downshift the memory card**

The memory `<Card>` currently gets the same full section card styling. Downshift it:

- Swap `className={cn("scroll-mt-24 overflow-hidden transition-colors", isMemoryOpen ? "border-primary/20" : "border-border/80")}` to `className="mt-4 overflow-hidden border-border/60 bg-card/60"` (no primary accent).
- Note: in Task 7 we'll add a `size="sm"` prop to `SectionHeader`. Come back after Task 7 and add `size="sm"` to the memory section's `<SectionHeader …>` callsite.

Memory keeps its Mehr/Weniger toggle since the entry list can be long — Task 7's simplification only applies to the five core sections, not memory.

- [ ] **Step 4: Downshift + rename the subscription block**

The subscription card currently says "Dein Abo" with an "Abo verwalten" button. Rename to **"Mitgliedschaft"** (warmer than *Abonnement*, fits the concierge positioning better than *Abo*) and shorten the button to **"Verwalten"**. Also tighten the visual styling:

Find:
```tsx
<section className="rounded-xl border bg-card p-6">
  <h2 className="mb-3 font-header text-xl">Dein Abo</h2>
```
Change to:
```tsx
<section className="mt-4 rounded-2xl border border-border/60 bg-card/60 p-6">
  <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-medium text-[var(--text-heading)]">Mitgliedschaft</h2>
```

If `<ManageSubscriptionButton />` takes a children-based label (check by opening `src/components/profile/manage-subscription-button.tsx`), pass `children="Verwalten"`. If it always renders its own fixed label, update the component's internal label string from "Abo verwalten" to "Verwalten" (it's a simple one-line change inside the component).

- [ ] **Step 5: Downshift + retitle the account block**

The Account card's heading is fine conceptually — keep "Account" as the title since there's no better single-word alternative. Just tighten the styling:

- Change `<Card className="bg-muted/35">` → `<Card className="mt-4 border-border/60 bg-card/60">`.
- Inside, reduce the `CardTitle` font size: `className="text-lg text-[var(--text-heading)]"` → `className="font-[family-name:var(--font-display)] text-lg font-medium text-[var(--text-heading)]"` (serif at the utility tier, smaller than core section titles).

- [ ] **Step 6: Keep all memory-related state, effects, imports**

Do not remove any memory state or the memory `useEffect` loader. Do not remove the `Switch`, `Textarea`, `Avatar*`, or `ManageSubscriptionButton` imports — they are still referenced by the kept JSX.

- [ ] **Step 7: Re-run the smoke test**

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3761 npx playwright test tests/profile-editorial-v3.spec.ts --reporter=list
```
Expected: the "memory renders below the core sections" assertion (5b) passes. Also: "Einstellungen" heading is visible, "Mitgliedschaft" heading is visible, the v3 smoke test for "Erinnerungen" heading passes (see Task 4 Step 1 update below). Mehr/Weniger and Bearbeiten assertions still fail (addressed in Tasks 7 + 9).

- [ ] **Step 8: Commit**

```bash
git add src/app/profile/page.tsx src/components/profile/manage-subscription-button.tsx
git commit -m "feat(profile): demote memory/mitgliedschaft/account into an Einstellungen group"
```

---

## Task 7: Simplify `SectionHeader` — no collapse button, no preview

**Files:**
- Modify: `src/app/profile/page.tsx` (function `SectionHeader` + every callsite)

- [ ] **Step 1: Replace the `SectionHeader` implementation**

Find `function SectionHeader({` (around line 358). Replace the entire function + its props type with:

```tsx
function SectionHeader({
  title,
  description,
  status,
  controls,
  isOpen = true,
  preview,
  size = "lg",
}: {
  title: string
  description: string
  status: string
  controls?: ReactNode
  isOpen?: boolean
  preview?: SectionPreview
  size?: "lg" | "sm"
}) {
  const titleClass =
    size === "sm"
      ? "font-[family-name:var(--font-display)] text-xl font-medium leading-tight text-[var(--text-heading)]"
      : "font-[family-name:var(--font-display)] text-2xl font-medium leading-tight text-[var(--text-heading)]"

  return (
    <div>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className={titleClass}>{title}</CardTitle>
            <SectionStatusBadge label={status} />
          </div>
          <CardDescription className="mt-2 max-w-2xl text-sm">{description}</CardDescription>
        </div>
        {controls ? <div className="flex flex-wrap items-center gap-2">{controls}</div> : null}
      </div>

      {!isOpen && preview ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/35 p-4">
          <p className="text-sm font-semibold text-[var(--text-heading)]">{preview.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{preview.text}</p>
        </div>
      ) : null}
    </div>
  )
}
```

The `isOpen` + `preview` props are retained because memory still uses them (it stays collapsible). The `size="sm"` variant is passed from the memory callsite in Task 6 to downshift the memory heading. Core sections use the default `size="lg"` and pass `isOpen` as a literal `true`.

- [ ] **Step 2: Delete the "Mehr/Weniger" toggle button from the five core sections only**

Search page.tsx for `aria-expanded=` (around lines 1404, 1803, 2046, 2150, 2252, 2341). The first five belong to quiz / products / styling / routine / goals — delete the inner `<Button>` with the `ChevronDown` at each. The sixth (memory, around 2341) stays — the entry list can be long so the collapsible is useful.

Example of what to delete per core section:
```tsx
<Button
  type="button"
  variant="ghost"
  size="sm"
  className="w-auto px-3 text-primary hover:bg-primary/[0.06]"
  onClick={() => toggleSection("…")}
  aria-expanded={…}
  ...
>
  <span>{… ? "Weniger" : "Mehr"}</span>
  <ChevronDown … />
</Button>
```
Leave the surrounding `controls={<>…</>}` fragment and the per-section "… bearbeiten" button intact.

- [ ] **Step 3: Keep the `ChevronDown` import**

Don't delete it — memory still uses it. Confirm:
```bash
grep -n "ChevronDown" src/app/profile/page.tsx
```
Expected: one match, inside the memory `SectionHeader` callsite.

- [ ] **Step 4: Force the five core sections open, keep toggle logic for memory**

Replace the initial state:

```tsx
const [openSections, setOpenSections] = useState<ProfileJourneySectionKey[]>([
  "quiz",
  "products",
  "styling",
  "routine",
  "goals",
])

const isQuizOpen = true
const isProductsOpen = true
const isStylingOpen = true
const isRoutineOpen = true
const isGoalsOpen = true
const isMemoryOpen = openSections.includes("memory")
```

Keep `toggleSection` + `ensureSectionOpen` — memory still uses them. Delete only:
- `sectionsInitialized` state and its `useEffect`
- `focusSection` helper (its only callsites were the progress card's CTA and the shortcut grid, both deleted in Task 5)
- `readRecentProfileSections`, `rememberRecentProfileSection`, `PROFILE_RECENT_SECTION_STORAGE_KEY`, `PROFILE_RECENT_SECTION_LIMIT` — memory doesn't need the "recent sections" heuristic since it's the only collapsible now

After edits, `toggleSection` should only ever receive `"memory"`:
```bash
grep -n "toggleSection(" src/app/profile/page.tsx
```
Expected: references only inside the memory `<SectionHeader>` callsite.

- [ ] **Step 5: Typecheck + build**

```bash
npm run typecheck && npm run build
```
Expected: passes.

- [ ] **Step 6: Re-run the smoke test**

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3761 npx playwright test tests/profile-editorial-v3.spec.ts --reporter=list
```
Expected progress: assertion 3 now passes.

- [ ] **Step 7: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): always-open sections, remove collapse toggles"
```

---

## Task 8: Remove `{isXOpen ? …}` conditionals + `preview` wiring (core sections only)

**Files:**
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Unwrap each `{isXOpen ? <CardContent …> … : null}` conditional for quiz, products, styling, routine, goals**

For the five core sections only, find the pattern:
```tsx
{isQuizOpen ? (
  <CardContent id="profile-section-panel-quiz">
    {/* section body */}
  </CardContent>
) : null}
```
Replace with the unconditional body:
```tsx
<CardContent>
  {/* section body */}
</CardContent>
```
Drop the `id="profile-section-panel-…"` since nothing targets it anymore. Leave the memory section's `{isMemoryOpen ? <CardContent …>` conditional untouched.

- [ ] **Step 2: Delete the `preview` prop from the five core `SectionHeader` callsites**

At quiz / products / styling / routine / goals remove `preview={…SectionSummary.preview}`. Leave the memory callsite's `preview={memorySectionSummary.preview}` intact.

- [ ] **Step 3: Delete the `preview` field from the five `coreSectionSummaries` entries**

In `coreSectionSummaries` (around line 812) delete the `preview: …` field on each of the 5 entries (they're unused once the core sections are always open). Keep `memorySectionSummary.preview` intact — memory still renders it when collapsed. Keep `summary` for now (unused by the core UI but harmless; Task 12 removes it).

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "refactor(profile): unconditionally render section bodies"
```

---

## Task 9: Rework `ProfileFieldCard` — chip values, whole-card click-to-edit, no "Bearbeiten →" footer

**Files:**
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Replace `ProfileFieldValue` so every value renders as a chip**

Find `function ProfileFieldValue({` (around line 465). Replace the whole function with:

```tsx
function ProfileFieldValue({
  value,
  emptyLabel = "Noch offen",
}: {
  value: ProfileFieldValue
  emptyLabel?: string
}) {
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return (
      <div className="flex flex-wrap gap-2">
        <Badge
          variant="outline"
          className="rounded-full border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground"
        >
          {emptyLabel}
        </Badge>
      </div>
    )
  }

  const items = Array.isArray(value) ? value : [value]

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          key={item}
          variant="outline"
          className="rounded-full border-primary/20 bg-background px-3 py-1 text-xs font-semibold text-[var(--text-heading)]"
        >
          {item}
        </Badge>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Replace `ProfileFieldCard` so the whole card is the click target**

Replace the function (around line 410) with:

```tsx
function ProfileFieldCard({
  field,
  children,
  onClick,
  className,
}: {
  field: JourneyField
  children?: ReactNode
  onClick?: () => void
  className?: string
}) {
  const interactive = Boolean(onClick)

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        "rounded-[22px] border border-primary/10 bg-[hsl(var(--background))]/70 p-5 transition-colors",
        interactive
          ? "cursor-pointer hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          : "",
        className,
      )}
    >
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {field.label}
      </p>
      {children ?? <ProfileFieldValue value={field.value} />}
    </div>
  )
}
```

Key differences from the old version: the help text is gone (label is enough), the "Bearbeiten →" footer is gone, padding bumped to `p-5`, labels set in IBM Plex caps, shape matches the mockup's 22px radius.

- [ ] **Step 3: Remove `actionLabel` / `getFieldActionLabel` usage**

`getFieldActionLabel` is no longer needed — delete the helper at ~line 182 and every `actionLabel={getFieldActionLabel(field.editTarget)}` prop on `ProfileFieldCard` callsites.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 5: Re-run the smoke test**

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3761 npx playwright test tests/profile-editorial-v3.spec.ts --reporter=list
```
Expected: assertion 6 now passes — no stray "Bearbeiten" buttons at field level.

- [ ] **Step 6: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): chip-style field values + click-to-edit cards"
```

---

## Task 10: Ziele — full-width chips, drop the nested field-card wrapper

**Files:**
- Modify: `src/app/profile/page.tsx` (the Ziele section JSX around line 2232)

- [ ] **Step 1: Replace the Ziele `<CardContent>` body**

Find the `<Card id="profile-section-goals"` block's body. Replace the inner content (the part that used `<ProfileFieldCard>` to host the goal chips) with:

```tsx
<CardContent>
  <button
    type="button"
    onClick={() => openTarget("goals", goalsField.editTarget)}
    className="flex w-full flex-wrap gap-2 rounded-[22px] border border-primary/10 bg-[hsl(var(--background))]/70 p-5 text-left transition-colors hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    aria-label={`${goalsField.label} bearbeiten`}
  >
    {Array.isArray(goalsField.value) && goalsField.value.length > 0 ? (
      goalsField.value.map((goal) => (
        <Badge
          key={goal}
          variant="outline"
          className="rounded-full border-primary/20 bg-background px-4 py-1.5 text-sm font-semibold text-[var(--text-heading)]"
        >
          {goal}
        </Badge>
      ))
    ) : (
      <span className="text-sm text-muted-foreground">Noch keine Ziele gewählt</span>
    )}
  </button>
</CardContent>
```

Remove the surrounding `<ProfileFieldCard>` wrapper and the nested `<div className="section-grid">` equivalent. The chips are now children of the section card directly, filling the width.

- [ ] **Step 2: Visual check**

Reload `/profile`. Expected: Ziele chips sit under the section header with no inner card frame and no right-side dead space.

- [ ] **Step 3: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): ziele full-width chips, drop nested field-card"
```

---

## Task 11: Coral highlight for the incomplete field in Alltag

**Files:**
- Modify: `src/app/profile/page.tsx` (the Alltag section render)

- [ ] **Step 1: Extend `ProfileFieldCard` to accept a `tone` prop**

At the top of `ProfileFieldCard` in page.tsx, add a `tone` prop:

```tsx
function ProfileFieldCard({
  field,
  children,
  onClick,
  className,
  tone = "default",
}: {
  field: JourneyField
  children?: ReactNode
  onClick?: () => void
  className?: string
  tone?: "default" | "attention"
}) {
```

In the `className={cn(...)}` expression, append:

```tsx
tone === "attention"
  ? "border-[var(--brand-coral)]/35 bg-[var(--brand-coral-light)]"
  : "",
```

- [ ] **Step 2: Pass `tone="attention"` for any `null`-valued routine field**

In the Alltag/routine section render (around line 2128), where you `.map(field => <ProfileFieldCard …>)`, set:

```tsx
<ProfileFieldCard
  field={field}
  onClick={() => openTarget("routine", field.editTarget)}
  tone={field.value == null ? "attention" : "default"}
/>
```

Apply the same pattern in Styling and the Quiz section if they expose nullable fields.

- [ ] **Step 3: Visual check**

With the seeded user (`night_protection: null`), `/profile` should show the Nachtschutz card with a faint coral wash and stronger coral border. All other Alltag fields render in the default neutral style.

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): coral highlight for incomplete routine fields"
```

---

## Task 12: Final cleanup — remove dead code + visual diff vs mockup

**Files:**
- Modify: `src/app/profile/page.tsx`
- Modify: `tests/profile-page-smoke.spec.ts`

- [ ] **Step 1: Purge dead code**

Search + delete anything the new render path doesn't use:

```bash
grep -n "preview\|summary:\|collapsibleSectionSummaries\|memorySectionSummary\|SectionPreview\|InlinePromptCard" src/app/profile/page.tsx
```

For each match, confirm it's unreferenced by the JSX and delete. Also delete the `summary` field on `ProfileSectionSummary` and remove any unused helper props at the component definitions.

- [ ] **Step 2: Update the old smoke test to not expect `aufklappen`**

In `tests/profile-page-smoke.spec.ts`, find and delete the `ensureSectionOpen` helper, and delete every callsite. Sections are always open now.

Run the updated test to confirm green:
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3761 npx playwright test tests/profile-page-smoke.spec.ts --reporter=list
```

- [ ] **Step 3: Run the full verify chain**

```bash
npm run ci:verify
```
Expected: typecheck + lint + build all pass.

- [ ] **Step 4: Run both profile Playwright specs**

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3761 npx playwright test tests/profile-editorial-v3.spec.ts tests/profile-page-smoke.spec.ts --reporter=list
```
Expected: both green.

- [ ] **Step 5: Visual diff vs mockup**

Re-run the audit capture against the new implementation and side-by-side against the v3 mockup:

```bash
node scripts/ux-audit-profile.mjs
```

Then open these three files and visually confirm parity:
- `ux-audits/2026-04-21-profile-page/screenshots/02-desktop-fullpage.png` (new implementation)
- `ux-audits/2026-04-21-profile-page/screenshots/99-v3-applied-desktop.png` (mockup)

Differences you should see vs the earlier "insane" version: no progress card, no shortcut grid, sections open, chip values, serif hero + h2s, cream background, Ziele full width, Nachtschutz coral highlight, no memory/account.

- [ ] **Step 6: Commit**

```bash
git add src/app/profile/page.tsx tests/profile-page-smoke.spec.ts
git commit -m "chore(profile): remove dead code and update smoke test for always-open layout"
```

---

## Self-review checklist

- **Spec coverage:** Progress card → Task 5; shortcut grid → Task 5; Mehr/Weniger on core sections → Task 7 / 8; per-field Bearbeiten → Task 9; chip values → Task 9; 8 Haar-Check fields → already in `PROFILE_FIELD_CONFIG`; Ziele full-width → Task 10; coral highlight → Task 11; Playfair typography → Task 5 (h1) + Task 7 (h2); cream bg + gradients → Task 1; hero paragraph → Task 5. **Memory / Mitgliedschaft / Account panels are preserved** — demoted into an "Einstellungen" footer group (Task 6). Memory retitled "Erinnerungen" via section meta (Task 3); subscription retitled "Mitgliedschaft" + button "Verwalten" (Task 6 Step 4).
- **Placeholder scan:** every step contains real code or real shell commands. No "add validation", no "similar to Task N", no TBD. The only conditional is the `ManageSubscriptionButton` label change — the plan tells the executor to check which approach the component uses before editing.
- **Type consistency:** `ProfileJourneySectionKey` is unchanged. `SectionHeader`'s props are extended (`size`, retained `isOpen` + `preview`) with defaults so core callsites compile without passing them. `ProfileFieldCard`'s new `tone` prop (Task 11) has a default, so earlier callsites continue to compile. `openSections` stays a mutable `ProfileJourneySectionKey[]` because memory still needs `setOpenSections` to toggle.
