# Landing Page Conversion Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the root landing page (`/`) for Meta/Instagram ad conversion per the approved mockup: CTA above the fold, result-preview hero visual, sticky mobile CTA, no pricing, no Tom, merged value sections.

**Architecture:** Pure presentational changes in `src/components/landing/` plus section rewiring in `src/app/page.tsx`. No data-layer, quiz, or routing changes. New components follow the existing landing-component pattern (server components, Tailwind classes with `var(--brand-*)` tokens, `SectionHeading` where fitting).

**Tech Stack:** Next.js App Router, Tailwind, existing brand CSS custom properties in `globals.css`.

## Global Constraints

- ALL UI text in German, "du" form. Copy strings below are final — use them verbatim.
- CTA wording everywhere: **"Kostenlose Haaranalyse starten"** (header button: **"Haaranalyse starten"**). Never "Quiz starten" on the landing page.
- Question count in copy: **"10 Fragen"** (per Nick — counts lead-capture step; the in-quiz progress bar shows /9 via `QUIZ_TOTAL_QUESTIONS`, do NOT change that constant).
- Coral (`--brand-coral`) is for CTAs + selected states only. Checkmarks use `#2D9F5E`.
- No new dependencies. No Tom Hannemann anywhere on the landing page (leave `src/data/team.ts` untouched — other pages may use it).
- All landing CTAs link to `/quiz` (plain `<Link>`, `prefetch={false}` for below-fold ones, matching current code).
- Reference mockup (visual + copy source of truth): `/private/tmp/claude-501/-Users-nick-AI-work-hair-conscierge/8ffea52b-c838-49e5-a151-4830b16b7d2b/scratchpad/mockups/12-final.html`
- Verification per task: `npm run ci:verify` has typecheck+lint+build; for speed, per-task use `npx tsc --noEmit` + `npx next lint --file <changed files>` if fast, otherwise full `ci:verify` at the end. Visual verification happens in Task 10.
- This is UI work — project TDD rule applies only to `src/lib/` logic, so tasks verify via typecheck/build + visual check, not unit tests.

---

### Task 1: `ResultPreviewPhone` hero visual component

**Files:**
- Create: `src/components/landing/result-preview-phone.tsx`

**Interfaces:**
- Produces: `export function ResultPreviewPhone()` — a static, decorative (`aria-hidden`) phone-frame preview of the quiz result screen. No props. Used by Task 2's `Hero`.

Static miniature of the real result screen (see `src/components/quiz/quiz-result-transformation-card.tsx` and `quiz-result-lever-rows.tsx` for the visual language it mirrors — do not import them; this is a hand-sized static replica).

- [ ] **Step 1: Create the component**

```tsx
// src/components/landing/result-preview-phone.tsx
// Static hero preview of the quiz result screen (mirrors the real
// transformation card + lever card so the promise matches the product).
export function ResultPreviewPhone() {
  return (
    <div aria-hidden="true" className="flex justify-center">
      <div className="w-[300px] rounded-[36px] bg-[var(--brand-plum-darkest)] p-[10px] shadow-[0_30px_80px_-20px_rgba(42,24,69,0.4)] lg:w-[320px]">
        <div className="overflow-hidden rounded-[28px] bg-white">
          <div className="grid h-[22px] place-items-center">
            <span className="block h-[7px] w-[84px] rounded-full bg-[#efeae5]" />
          </div>
          <div className="bg-background px-3.5 pb-[18px] pt-3.5">
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--brand-plum)]">
              So sieht dein Ergebnis aus
            </p>
            <p className="mb-2.5 font-header text-[14.5px] font-medium uppercase leading-[1.25] text-[var(--brand-plum-darkest)]">
              So kommen wir deinem Haarziel näher
            </p>

            <div className="relative grid grid-cols-2 overflow-hidden rounded-[14px] border border-black/5 bg-white">
              <div className="bg-[linear-gradient(180deg,var(--brand-coral-light)_0%,#FBDDE0_100%)] py-2.5 pl-[11px] pr-[26px]">
                <h4 className="mb-2 font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--brand-coral-dark)]">
                  Heute
                </h4>
                <p className="mb-[9px] font-header text-[11px] italic leading-[1.3] text-[#6B3439]">
                  wenig Feuchtigkeit
                </p>
                <p className="font-header text-[11px] italic leading-[1.3] text-[#6B3439]">
                  wenig Kontrolle
                </p>
              </div>
              <div className="bg-[linear-gradient(180deg,#E8F4ED_0%,#D2EBDB_100%)] py-2.5 pl-[26px] pr-[11px]">
                <h4 className="mb-2 font-mono text-[8px] uppercase tracking-[0.14em] text-[#2D8A57]">
                  In 4 Wochen
                </h4>
                <p className="mb-[9px] font-header text-[11px] font-medium italic leading-[1.3] text-[#1F4D33]">
                  mehr Elastizität &amp; Geschmeidigkeit
                </p>
                <p className="font-header text-[11px] font-medium italic leading-[1.3] text-[#1F4D33]">
                  mehr Kontrolle
                </p>
              </div>
              <span className="absolute left-1/2 top-1/2 grid size-[30px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[14px] font-bold text-[#2D8A57] shadow-[0_6px_16px_-8px_rgba(45,138,87,0.5),0_0_0_3px_rgba(255,255,255,0.9)]">
                →
              </span>
            </div>

            <div className="mt-2.5 rounded-[14px] border border-black/5 bg-white px-3 py-[11px]">
              <p className="mb-[5px] font-mono text-[7.5px] uppercase tracking-[0.18em] text-[var(--brand-plum)]">
                Was dein Haar jetzt braucht
              </p>
              <p className="mb-2 font-header text-[13.5px] font-medium text-[var(--brand-plum-darkest)]">
                Feuchtigkeit gezielt aufbauen
              </p>
              <div className="mt-1.5 flex items-start gap-[7px]">
                <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[var(--brand-coral-light)] text-[9px] font-bold text-[var(--brand-coral-dark)]">
                  ★
                </span>
                <div>
                  <p className="text-[10.5px] font-semibold leading-[1.3] text-[var(--brand-plum-darkest)]">
                    Feuchtigkeits-Maske
                  </p>
                  <p className="text-[9.5px] leading-[1.35] text-muted-foreground">
                    Baut Elastizität in den Längen wieder auf.
                  </p>
                </div>
              </div>
              <div className="mt-1.5 flex items-start gap-[7px]">
                <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[var(--brand-plum-ice)] text-[9px] font-bold text-[var(--brand-plum)]">
                  +
                </span>
                <div>
                  <p className="text-[10.5px] font-semibold leading-[1.3] text-[var(--brand-plum-darkest)]">
                    Leichtes Leave-in
                  </p>
                  <p className="text-[9.5px] leading-[1.35] text-muted-foreground">
                    Hält die Feuchtigkeit zwischen den Wäschen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/result-preview-phone.tsx
git commit -m "feat(landing): add static result-preview phone component"
```

---

### Task 2: Rewrite `Hero`

**Files:**
- Modify: `src/components/landing/hero.tsx` (full rewrite)

**Interfaces:**
- Consumes: `ResultPreviewPhone` from `@/components/landing/result-preview-phone` (Task 1)
- Produces: `export function Hero()` (same export name as today — `page.tsx` import unchanged)

Removes: Tom quote (`TOM` import from `@/data/team`), 4,9/5 stars, four check-chips, "STARTE HEUTE DAMIT" eyebrow, the right-hand CTA card. Adds: eyebrow, new headline, short subline, inline CTA, trust row, `ResultPreviewPhone`.

- [ ] **Step 1: Replace the entire file content**

```tsx
import Link from "next/link"

import { ResultPreviewPhone } from "@/components/landing/result-preview-phone"

const trustMarkers = ["Kostenlos", "Ohne Anmeldung", "DSGVO-konform"] as const

export function Hero() {
  return (
    <section
      id="top"
      className="overflow-hidden bg-[linear-gradient(180deg,var(--background)_0%,var(--brand-plum-ice)_100%)] pt-10 lg:pt-14"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-9 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div>
          <p className="mb-3.5 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.11em] text-[var(--brand-coral)] before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--brand-coral)] before:content-['']">
            Kostenlose 2-Minuten-Haaranalyse
          </p>
          <h1 className="mb-4 font-header text-[clamp(31px,8vw,54px)] font-medium leading-[1.1] text-[var(--brand-plum-darkest)]">
            In 2 Minuten weißt du, was deine Haare{" "}
            <em className="font-medium italic text-[var(--brand-plum)]">wirklich</em> brauchen.
          </h1>
          <p className="mb-6 max-w-[480px] text-[17px] text-muted-foreground">
            Ehrliche Analyse statt Marketing — dein{" "}
            <b className="font-semibold text-[var(--brand-plum-darkest)]">Haarprofil</b>, deine{" "}
            <b className="font-semibold text-[var(--brand-plum-darkest)]">Routine</b>, deine{" "}
            <b className="font-semibold text-[var(--brand-plum-darkest)]">Produkte</b>.
          </p>

          <Link
            href="/quiz"
            className="block max-w-[440px] rounded-[14px] bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-dark))] px-8 py-4 text-center text-white shadow-[0_10px_32px_rgba(var(--brand-coral-rgb),0.31),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all hover:bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-deep))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-dark)] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
          >
            <span className="block text-lg font-bold text-white">
              Kostenlose Haaranalyse starten
            </span>
            <span className="mt-0.5 block text-[13px] font-normal text-white/85">
              2 Minuten · ohne Anmeldung · Ergebnis sofort
            </span>
          </Link>

          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.07em] text-muted-foreground">
            {trustMarkers.map((label) => (
              <span key={label} className="flex items-center gap-1">
                <span aria-hidden="true" className="text-[#2D9F5E]">
                  ✓
                </span>
                {label}
              </span>
            ))}
          </p>
        </div>

        <div className="-mb-[70px] lg:-mb-[90px]">
          <ResultPreviewPhone />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify compile + no leftover references**

Run: `npx tsc --noEmit && grep -n "TOM" src/components/landing/hero.tsx`
Expected: tsc clean; grep finds nothing (exit 1)

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/hero.tsx
git commit -m "feat(landing): conversion hero — CTA above fold, result preview, no Tom"
```

---

### Task 3: `StickyQuizCta` mobile bar

**Files:**
- Create: `src/components/landing/sticky-quiz-cta.tsx`
- Modify: `src/app/page.tsx` (render it after `<SiteFooter />`; also add `pb-[84px] md:pb-0` wrapper — see step 2)

**Interfaces:**
- Produces: `export function StickyQuizCta()` — fixed bottom bar, hidden at `md:` and up.

- [ ] **Step 1: Create the component**

```tsx
// src/components/landing/sticky-quiz-cta.tsx
import Link from "next/link"

export function StickyQuizCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-[rgba(253,251,249,0.92)] px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-[10px] md:hidden">
      <Link
        href="/quiz"
        prefetch={false}
        className="mx-auto block max-w-[560px] rounded-[12px] bg-[var(--brand-coral)] py-3 text-center font-bold text-[15.5px] text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-dark)]"
      >
        Kostenlose Haaranalyse starten
        <span className="block text-[11.5px] font-normal text-white/85">
          2 Minuten · ohne Anmeldung
        </span>
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `src/app/page.tsx`**

Add import and render; give `<main>` bottom padding so the bar never covers the footer links on mobile:

```tsx
import { StickyQuizCta } from "@/components/landing/sticky-quiz-cta"
// ...
      <main className="pb-[84px] md:pb-0">
        {/* existing sections */}
      </main>
      <SiteFooter />
      <StickyQuizCta />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/sticky-quiz-cta.tsx src/app/page.tsx
git commit -m "feat(landing): sticky mobile quiz CTA bar"
```

---

### Task 4: `PainStrip` section

**Files:**
- Create: `src/components/landing/pain-strip.tsx`
- Modify: `src/app/page.tsx` (render between `<Hero />` and the Task 5 section)

**Interfaces:**
- Produces: `export function PainStrip()`

Note: the hero's phone preview intentionally overlaps into this section (negative bottom margin on the hero side), so this section needs generous top padding: `pt-[88px] lg:pt-[110px]`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/landing/pain-strip.tsx
const pains = [
  "Ein Badezimmer voller Produkte, die nicht halten, was sie versprechen.",
  "Frizz, Spliss oder platte Längen — trotz teurer Pflege.",
  "Jede Empfehlung im Internet sagt etwas anderes.",
] as const

export function PainStrip() {
  return (
    <section className="bg-[var(--brand-plum-darkest)] pb-9 pt-[88px] text-white lg:pt-[110px]">
      <div className="mx-auto grid max-w-7xl gap-2 px-6">
        <div className="max-w-[660px]">
          <h2 className="mb-2 font-header text-[21px] font-medium text-white">
            Kommt dir das bekannt vor?
          </h2>
          {pains.map((pain) => (
            <p
              key={pain}
              className="flex items-baseline gap-2.5 text-[15px] text-white/80"
            >
              <span aria-hidden="true" className="shrink-0 text-[var(--brand-plum-light)]">
                —
              </span>
              {pain}
            </p>
          ))}
          <p className="mt-4 max-w-[520px] text-[15px] text-white">
            Alle drei haben dieselbe Ursache: Produkte, die nicht zu deinem Haar passen. Deshalb
            beginnt Chaarlie mit einer Analyse — nicht mit einer Empfehlung.
          </p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire into `page.tsx`** (import + render directly after `<Hero />`)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/pain-strip.tsx src/app/page.tsx
git commit -m "feat(landing): pain-recognition strip"
```

---

### Task 5: `WhatYouGet` section (replaces `WhatIs` + `Features`)

**Files:**
- Create: `src/components/landing/what-you-get.tsx`
- Modify: `src/app/page.tsx` (replace `<WhatIs />` and `<Features />` with `<WhatYouGet />`; remove both imports)
- Delete: `src/components/landing/what-is.tsx`, `src/components/landing/features.tsx`

**Interfaces:**
- Consumes: `SectionHeading` from `@/components/landing/section-heading` (existing: props `eyebrow`, `title`, optional `lede`)
- Produces: `export function WhatYouGet()`

- [ ] **Step 1: Create the component**

```tsx
// src/components/landing/what-you-get.tsx
import { SectionHeading } from "@/components/landing/section-heading"

type Item = { title: string; body: React.ReactNode }

const items: Item[] = [
  {
    title: "Dein Haarprofil",
    body: "6 Dimensionen — Struktur, Oberfläche, Kopfhaut, Feuchtigkeit, Protein, Glanz — und dein größter Pflege-Hebel, klar benannt.",
  },
  {
    title: "Deine Routine",
    body: "Was du wann anwendest, wie oft und wie lange. Abgestimmt auf dein Haar, nicht auf einen Haartyp von der Stange.",
  },
  {
    title: "Konkrete Produkte",
    body: (
      <>
        Mit Marke und Größe — und{" "}
        <span className="font-semibold text-[#2D9F5E]">
          immer einer günstigen Drogerie-Alternative
        </span>
        . Wir verkaufen nichts und sind keinem Hersteller verpflichtet.
      </>
    ),
  },
]

const honesty = [
  "Keine eigenen Produkte",
  "Keinem Hersteller verpflichtet",
  "Daten nur für deine Analyse",
] as const

export function WhatYouGet() {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Das bekommst du — sofort nach den 10 Fragen"
          title="Keine Produkt-Werbung. Eine Diagnose."
        />

        <div className="mt-7 grid gap-3.5 md:grid-cols-3">
          {items.map((item, index) => (
            <div key={item.title} className="rounded-[18px] border border-border bg-card p-6">
              <p className="mb-2.5 font-header text-3xl font-medium italic leading-none text-[var(--brand-plum)]">
                {index + 1}
              </p>
              <h3 className="mb-1.5 text-[16.5px] font-bold text-[var(--brand-plum-darkest)]">
                {item.title}
              </h3>
              <p className="text-[14.5px] leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
          {honesty.map((label) => (
            <span key={label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="font-bold text-[#2D9F5E]">
                ✓
              </span>
              {label}
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Rewire `page.tsx`, delete old components**

```bash
rm src/components/landing/what-is.tsx src/components/landing/features.tsx
```

In `page.tsx`: remove `WhatIs`/`Features` imports, import `WhatYouGet`, render it where `<WhatIs />` was.

- [ ] **Step 3: Verify nothing else imports the deleted files**

Run: `grep -rn "landing/what-is\|landing/features" src/ ; npx tsc --noEmit`
Expected: grep empty (exit 1), tsc clean

- [ ] **Step 4: Commit**

```bash
git add -A src/components/landing src/app/page.tsx
git commit -m "feat(landing): merge WhatIs+Features into WhatYouGet section"
```

---

### Task 6: `HowItWorks` copy + mid-page CTA

**Files:**
- Modify: `src/components/landing/how-it-works.tsx`

**Interfaces:**
- Produces: same `export function HowItWorks()`.

- [ ] **Step 1: Update the steps array and add CTA**

Replace `steps` content:

```tsx
const steps: Step[] = [
  {
    number: "1",
    title: "Haaranalyse machen",
    body: "2 Minuten, 10 Fragen. Zugtest, Oberfläche, Kopfhaut, deine Ziele.",
  },
  {
    number: "2",
    title: "Haarprofil erhalten",
    body: "Dein Profil sofort sichtbar. Dein größter Pflege-Hebel klar benannt.",
  },
  {
    number: "3",
    title: "Routine starten",
    body: "Deine Routine mit konkreten Produkten und Drogerie-Alternativen. Direkt anwendbar.",
  },
]
```

After the steps grid `</div>`, add (import `Link` from `next/link` at top):

```tsx
<div className="mt-8 flex justify-center">
  <Link
    href="/quiz"
    prefetch={false}
    className="block w-full max-w-[440px] rounded-[14px] bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-dark))] px-8 py-4 text-center text-white shadow-[0_10px_32px_rgba(var(--brand-coral-rgb),0.31),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all hover:bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-deep))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-dark)] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
  >
    <span className="block text-lg font-bold text-white">Kostenlose Haaranalyse starten</span>
    <span className="mt-0.5 block text-[13px] font-normal text-white/85">
      2 Minuten · ohne Anmeldung
    </span>
  </Link>
</div>
```

Keep the `SectionHeading` (eyebrow "So funktioniert's", title "In drei Schritten zu deiner Routine.") but change its `lede` to: `"Ohne Anmeldung starten. Ergebnis sofort sehen."`

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/how-it-works.tsx
git commit -m "feat(landing): update how-it-works copy, add mid-page CTA"
```

---

### Task 7: FAQ rewrite

**Files:**
- Modify: `src/components/landing/faq.tsx` (replace the `items` array only; keep component/rendering as is)

**Interfaces:** unchanged `export function Faq()`.

- [ ] **Step 1: Replace `items` with exactly these 6 entries**

```tsx
const items: FaqItem[] = [
  {
    question: "Wie unterscheidet sich die Haaranalyse von Beauty-Quizzes?",
    answer:
      "Klassische Quizzes fragen deinen Haartyp ab und schlagen dir eine Produkt-Range vor. Chaarlie kombiniert dein vollständiges Haarprofil (Struktur, Protein-Feuchtigkeits-Balance, Kopfhaut u. a.) mit deiner tatsächlichen Routine — und gibt dir konkrete Empfehlungen mit echten Produktnamen, inklusive Drogerie-Alternativen. Wir verkaufen keine eigenen Produkte.",
  },
  {
    question: "Brauche ich Vorwissen zur Haarpflege?",
    answer:
      "Nein. Die Analyse erklärt dir alles, was du wissen musst, während du sie ausfüllst. Wenn du dich noch nie mit Haarpflege beschäftigt hast, ist Chaarlie genau für dich gebaut.",
  },
  {
    question: "Wie lange dauert es, bis ich Ergebnisse sehe?",
    answer:
      "Dein Haarprofil und die Routine bekommst du sofort. Sichtbare Veränderungen im Haar zeigen sich in der Regel nach 2 bis 4 Wochen konsequenter Anwendung.",
  },
  {
    question: "Sind die empfohlenen Produkte teuer?",
    answer:
      "Wir empfehlen Produkte für jeden Preisbereich. Für jedes Salon-Produkt gibt es eine Drogerie-Alternative, die ähnlich gut funktioniert. Du entscheidest, was zu deinem Budget passt.",
  },
  {
    question: "Wer steht hinter Chaarlie?",
    answer:
      "Ein kleines, unabhängiges Team. Wir verkaufen keine eigenen Produkte und sind keinem Hersteller verpflichtet — unsere Empfehlungen richten sich nur nach deinem Haar.",
  },
  {
    question: "Was passiert mit meinen Daten?",
    answer: (
      <>
        Deine Antworten werden ausschließlich verwendet, um deine persönliche Analyse und Routine
        zu erstellen. Wir verkaufen keine Daten an Dritte. Details findest du in unserer{" "}
        <Link href="/datenschutz" className="underline hover:text-[var(--brand-plum-darkest)]">
          Datenschutzerklärung
        </Link>
        .
      </>
    ),
  },
]
```

(Removed: "Kann ich jederzeit kündigen?" and all Tom/Haarmony-LLC wording.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/faq.tsx
git commit -m "feat(landing): FAQ — Haaranalyse wording, drop Tom/Delaware/kündigen items"
```

---

### Task 8: Header + FinalCta copy

**Files:**
- Modify: `src/components/landing/landing-header.tsx` (button text `Quiz starten` → `Haaranalyse starten`; keep "Anmelden" link exactly as is)
- Modify: `src/components/landing/final-cta.tsx`

**Interfaces:** unchanged exports.

- [ ] **Step 1: Header button text**

In `landing-header.tsx`, change the CTA link's child text to `Haaranalyse starten`. Nothing else.

- [ ] **Step 2: FinalCta copy**

In `final-cta.tsx`: keep the headline (`Bereit, herauszufinden, was deine Haare wirklich brauchen?` with italic `wirklich`). Change the paragraph to `Zwei Minuten. Kostenlos. Ohne Anmeldung. Dein Haarprofil sofort.` and the button label to `Kostenlose Haaranalyse starten`.

- [ ] **Step 3: Verify + grep for stragglers**

Run: `npx tsc --noEmit && grep -rn "Quiz starten" src/components/landing/ src/app/page.tsx`
Expected: tsc clean; grep empty (exit 1)

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/landing-header.tsx src/components/landing/final-cta.tsx
git commit -m "feat(landing): Haaranalyse CTA wording in header and final CTA"
```

---

### Task 9: Remove pricing from the landing page

**Files:**
- Modify: `src/app/page.tsx` (remove `Pricing` import + `<Pricing />`)
- Delete: `src/components/landing/pricing.tsx`

`/pricing` route has its own `pricing-cards.tsx` — untouched.

- [ ] **Step 1: Remove usage + delete file**

```bash
rm src/components/landing/pricing.tsx
```

Final `page.tsx` section order must be:
`LandingTracking, LandingHeader / Hero, PainStrip, WhatYouGet, HowItWorks, Faq, FinalCta / SiteFooter, StickyQuizCta`

- [ ] **Step 2: Verify nothing else imports it**

Run: `grep -rn "landing/pricing" src/ ; npx tsc --noEmit`
Expected: grep empty (exit 1), tsc clean

- [ ] **Step 3: Commit**

```bash
git add -A src/components/landing/pricing.tsx src/app/page.tsx
git commit -m "feat(landing): remove pricing section from landing page"
```

---

### Task 10: Full verification (build + visual)

**Files:** none (verification only)

- [ ] **Step 1: Full CI verify**

Run: `npm run ci:verify`
Expected: typecheck + lint + build all pass

- [ ] **Step 2: Visual verification against the mockup**

Start dev server (`npm run dev:worktree` inside the worktree), then screenshot with the repo's Playwright at 390×844 (fold + full page) and 1440×900, and compare against `scratchpad/mockups/12-final.html`. Check specifically:
- Hero CTA fully visible above the fold at 390×844
- Phone preview overlaps into the dark PainStrip without clipping text
- Sticky bar visible on mobile, absent at ≥768px, never covers footer links (scroll to bottom)
- No "Quiz starten", no Tom, no pricing anywhere on `/`
- FAQ accordions open/close

- [ ] **Step 3: Fix any visual defects found, re-verify, commit fixes**

```bash
git add -A && git commit -m "fix(landing): visual polish after mockup comparison"
```

---

## Finishing (per CLAUDE.md)

1. `npm run ci:verify` passes (done in Task 10)
2. Codex review via `codex:codex-rescue` AGENT on `git diff main...HEAD`
3. Fix real findings
4. Confirm with Nick, then push + PR (squash-merge)
