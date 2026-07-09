# Landing Metadata + Pricing Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Two independent landing/funnel improvements: (1) proper SEO + social-share metadata for the site with a branded generated OG image; (2) gate `/pricing` so anonymous visitors with no lead are redirected into the quiz.

**Architecture:** Metadata lives in the root `layout.tsx` (global, cascades to all routes) plus a generated `opengraph-image.tsx` at the app root (Next.js file convention, auto-wired to `og:image` and cascaded to child routes). The pricing gate is a server-component guard in `pricing/page.tsx`. No DB, no middleware changes.

**Tech Stack:** Next.js App Router metadata API, `ImageResponse` from `next/og` (satori), existing vendored fonts in `public/fonts/`, Supabase SSR client for the auth check.

## Global Constraints

- ALL UI/meta text in German. Copy strings below are final — verbatim.
- Domain / `metadataBase`: `https://chaarlie.de`
- Brand tokens (for the OG image, inline hex — satori has no CSS vars): bg `#FDFBF9`, plum-ice `#F2EEFA`, ink/plum-darkest `#2A1845`, plum `#6B50A0`, coral `#D4616A`, coral-dark `#C0555D`, green `#2D9F5E`, muted `#6b6461`.
- Fonts for the OG image (already in repo): `public/fonts/PlayfairDisplay-Regular.ttf` (headline serif), `public/fonts/PlusJakartaSans-Regular.ttf` (body/label). Only Regular weights are vendored — do NOT rely on italic or bold font files; use color/size for emphasis instead.
- `ImageResponse` runs under satori: **flexbox only (no CSS grid)**, inline styles only, every text node inside an element with an explicit `display`. Keep the layout to nested flex rows/columns.
- No new npm dependencies (`next/og` ships with Next).
- Meta copy (brand-forward, chosen):
  - Tab/SEO `title`: `Chaarlie — Dein persönlicher Haarpflege-Berater` (unchanged from today)
  - `description`: `Kostenlose Haaranalyse in 2 Minuten. Dein Haarprofil, deine Routine und konkrete Produkte — ehrlich, ohne Anmeldung.`
  - OG/Twitter `title`: `Weißt du, was deine Haare wirklich brauchen?`
- OG image direction (chosen): **Hero motif** — eyebrow `KOSTENLOSE 2-MINUTEN-HAARANALYSE`, headline `In 2 Minuten weißt du, was deine Haare wirklich brauchen.` (the word `wirklich` in plum `#6B50A0` for emphasis, not italic), a simplified result-phone card on the right, wordmark `chaarlie` bottom-left, on the `#FDFBF9`→`#F2EEFA` vertical gradient. 1200×630.
- Pricing gate (chosen): anonymous visitor with **no `lead` param AND no authenticated session** → `redirect("/quiz")`. Visitors with `?lead=…` or a logged-in session still see pricing (preserves the result-flow and resubscribe/authed paths).
- Verification: `npm run ci:verify` (typecheck+lint+build). Visual/behavioral checks are specified per task.

---

## Feature A — Site metadata + generated OG image

### Task A1: Generated OG image at app root

**Files:**
- Create: `src/app/opengraph-image.tsx`
- Create: `src/app/twitter-image.tsx` (re-exports A1's handler so Twitter cards get the same image)

**Interfaces:**
- Produces: a default async route handler returning `ImageResponse`, plus `export const size` and `export const contentType`. Next.js auto-wires this to `og:image` for `/` and all child routes without their own.

- [ ] **Step 1: Implement `src/app/opengraph-image.tsx`**

Note: `export const runtime = "nodejs"` is required here because this route reads font files from disk (`node:fs`). The existing `src/app/icon.tsx` uses `ImageResponse` without it, but it does not touch the filesystem — this one does.

```tsx
import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "nodejs"
export const alt = "Chaarlie — Kostenlose Haaranalyse in 2 Minuten"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OgImage() {
  const [serif, sans] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/PlayfairDisplay-Regular.ttf")),
    readFile(join(process.cwd(), "public/fonts/PlusJakartaSans-Regular.ttf")),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(160deg, #FDFBF9 0%, #F2EEFA 100%)",
          fontFamily: "Jakarta",
        }}
      >
        {/* Left: copy */}
        <div style={{ display: "flex", flexDirection: "column", width: "600px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontFamily: "Jakarta",
              fontSize: "22px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#D4616A",
              marginBottom: "28px",
            }}
          >
            ● Kostenlose 2-Minuten-Haaranalyse
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              fontFamily: "Playfair",
              fontSize: "62px",
              lineHeight: 1.1,
              color: "#2A1845",
            }}
          >
            In 2 Minuten weißt du, was deine Haare&nbsp;
            <span style={{ color: "#6B50A0", display: "flex" }}>wirklich</span>
            &nbsp;brauchen.
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: "44px",
              fontFamily: "Playfair",
              fontSize: "34px",
              color: "#2A1845",
            }}
          >
            <span style={{ display: "flex", color: "#2A1845" }}>chaarlie</span>
          </div>
        </div>

        {/* Right: simplified result-phone card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "300px",
            background: "#ffffff",
            borderRadius: "28px",
            border: "1px solid rgba(0,0,0,0.06)",
            padding: "22px",
            boxShadow: "0 30px 60px -20px rgba(42,24,69,0.35)",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Jakarta",
              fontSize: "13px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "#6B50A0",
              marginBottom: "12px",
            }}
          >
            Dein Haarprofil
          </div>
          <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                background: "#FDEEF0",
                borderRadius: "14px",
                padding: "14px",
              }}
            >
              <span
                style={{
                  display: "flex",
                  fontFamily: "Jakarta",
                  fontSize: "12px",
                  color: "#C0555D",
                  marginBottom: "10px",
                }}
              >
                HEUTE
              </span>
              <span style={{ display: "flex", fontFamily: "Playfair", fontSize: "17px", color: "#6B3439" }}>
                wenig Feuchtigkeit
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                background: "#E8F4ED",
                borderRadius: "14px",
                padding: "14px",
              }}
            >
              <span
                style={{
                  display: "flex",
                  fontFamily: "Jakarta",
                  fontSize: "12px",
                  color: "#2D8A57",
                  marginBottom: "10px",
                }}
              >
                IN 4 WOCHEN
              </span>
              <span style={{ display: "flex", fontFamily: "Playfair", fontSize: "17px", color: "#1F4D33" }}>
                mehr Elastizität
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "12px",
              background: "#F2EEFA",
              borderRadius: "14px",
              padding: "14px",
            }}
          >
            <span
              style={{
                display: "flex",
                fontFamily: "Jakarta",
                fontSize: "11px",
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "#6B50A0",
                marginBottom: "6px",
              }}
            >
              Dein größter Hebel
            </span>
            <span style={{ display: "flex", fontFamily: "Playfair", fontSize: "18px", color: "#2A1845" }}>
              Feuchtigkeit aufbauen
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Playfair", data: serif, style: "normal", weight: 400 },
        { name: "Jakarta", data: sans, style: "normal", weight: 400 },
      ],
    },
  )
}
```

- [ ] **Step 2: Implement `src/app/twitter-image.tsx`** (DRY re-export)

```tsx
export { default, alt, size, contentType } from "./opengraph-image"
```

- [ ] **Step 3: Build + render check**

Run: `npx tsc --noEmit && npm run build`
Expected: clean; build lists no error for the image routes.
Then start `npm run dev:worktree`, and with the repo's Playwright, `goto` `http://localhost:<port>/opengraph-image` and screenshot it. Read the screenshot and confirm: 1200×630, headline legible with the serif font, "wirklich" in plum, the phone card renders (no overlap/clipping, no satori fallback boxes), wordmark visible. Fix layout if any text overflows the 600px column or the phone card clips.

- [ ] **Step 4: Commit**

```bash
git add src/app/opengraph-image.tsx src/app/twitter-image.tsx
git commit -m "feat(seo): branded OG/Twitter share image for the site"
```

### Task A2: Wire metadata in root layout

**Files:**
- Modify: `src/app/layout.tsx` (the `metadata` export only)

**Interfaces:**
- Consumes: the OG image from A1 is auto-attached by Next; do NOT list `images` manually.

- [ ] **Step 1: Replace the `metadata` export**

```tsx
export const metadata: Metadata = {
  metadataBase: new URL("https://chaarlie.de"),
  title: "Chaarlie — Dein persönlicher Haarpflege-Berater",
  description:
    "Kostenlose Haaranalyse in 2 Minuten. Dein Haarprofil, deine Routine und konkrete Produkte — ehrlich, ohne Anmeldung.",
  openGraph: {
    title: "Weißt du, was deine Haare wirklich brauchen?",
    description:
      "Kostenlose Haaranalyse in 2 Minuten. Dein Haarprofil, deine Routine und konkrete Produkte — ehrlich, ohne Anmeldung.",
    url: "/",
    siteName: "Chaarlie",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Weißt du, was deine Haare wirklich brauchen?",
    description:
      "Kostenlose Haaranalyse in 2 Minuten. Dein Haarprofil, deine Routine und konkrete Produkte — ehrlich, ohne Anmeldung.",
  },
}
```

- [ ] **Step 2: Verify rendered head tags**

Run: `npx tsc --noEmit`, then on the dev server fetch `/` and confirm via Playwright `page.locator('meta[property="og:image"]').getAttribute('content')` is a non-empty absolute URL under `chaarlie.de`, and `meta[property="og:title"]` content equals `Weißt du, was deine Haare wirklich brauchen?`.
Expected: both present; og:image resolves (absolute URL, not a relative path — proves `metadataBase` works).

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(seo): site metadata with OG/Twitter cards and metadataBase"
```

---

## Feature B — Pricing gate for anonymous visitors

> **Codex review finding (HIGH) — must be done together with B1.** The `/pricing`
> "change plan" control strips the `lead` from the URL. On its own that's
> harmless, but combined with the B1 guard it becomes a regression: a post-quiz
> visitor who arrived via `?lead=…`, picks a plan, then clicks "change plan"
> would land on bare `/pricing`, which the guard then redirects to `/quiz` —
> kicking a mid-purchase user out of the funnel. Task B0 fixes the source.

### Task B0: Preserve the lead in the change-plan navigation

**Files:**
- Modify: `src/app/pricing/pricing-cards.tsx` (the `onChangePlan` handler, ~line 238)

- [ ] **Step 1: Keep the lead on `router.replace`**

Change the `onChangePlan` callback so it preserves the lead param:

```tsx
onChangePlan={() => {
  setCheckoutError(null)
  setSelectedInterval(null)
  router.replace(leadId ? `/pricing?lead=${encodeURIComponent(leadId)}` : "/pricing")
}}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean. (`leadId` is already in scope in this component — it's a prop used elsewhere in the file.)

- [ ] **Step 3: Commit**

```bash
git add src/app/pricing/pricing-cards.tsx
git commit -m "fix(pricing): preserve lead when changing plan (keeps funnel intact under the new guard)"
```

### Task B1: Redirect anon + no-lead `/pricing` visits to the quiz

**Files:**
- Modify: `src/app/pricing/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` (async server Supabase client), `redirect` from `next/navigation`.

- [ ] **Step 1: Add the guard after `leadId` is resolved**

In `src/app/pricing/page.tsx`, add imports and, immediately after `const leadId = sp.lead ?? null`, insert:

```tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
// ...
  const leadId = sp.lead ?? null

  // Pricing requires an identity to check out with. Anonymous visitors with no
  // lead (direct URL, stale /offer links) can't complete checkout — send them
  // into the quiz instead of a dead-end payment form. Lead-carrying (post-quiz)
  // and authenticated (resubscribe/app) visitors keep normal pricing.
  if (!leadId) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect("/quiz")
  }
```

- [ ] **Step 2: Behavioral test**

Add to `tests/e2e-smoke.spec.ts` (co-located with the other anon-landing assertions):

```ts
test("anonymous /pricing with no lead redirects into the quiz", async ({ page }) => {
  await page.goto("/pricing")
  await expect(page).toHaveURL(/\/quiz(\?.*)?$/)
})

test("/pricing with a lead param still renders the plans", async ({ page }) => {
  await page.goto("/pricing?lead=smoke-test-lead")
  await expect(page).toHaveURL(/\/pricing/)
  await expect(page.getByRole("heading", { name: /Haar-Concierge/i })).toBeVisible()
})
```

- [ ] **Step 3: Run the tests**

Run: `npx tsc --noEmit` then the two new tests via the repo's Playwright runner against a dev server (check `package.json` for the e2e-smoke script; e.g. `npm run test:e2e -- e2e-smoke` or the playwright-smoke invocation). If e2e can't run locally, statically confirm the redirect logic and note it.
Expected: anon `/pricing` ends on `/quiz`; `?lead=` stays on `/pricing` and shows the plans heading.

- [ ] **Step 4: Commit**

```bash
git add src/app/pricing/page.tsx tests/e2e-smoke.spec.ts
git commit -m "feat(pricing): redirect anonymous no-lead visitors into the quiz"
```

---

## Finishing (per CLAUDE.md)

1. `npm run ci:verify` passes.
2. Codex review via `codex:codex-rescue` AGENT on `git diff main...HEAD` (watch for: satori/`next/og` runtime issues, `metadataBase` correctness, the `getUser()` call not interfering with the resubscribe flow).
3. Fix real findings.
4. Confirm with Nick, then push + PR (squash-merge). One PR with the three commits is fine; features A and B are independent if you prefer two.
