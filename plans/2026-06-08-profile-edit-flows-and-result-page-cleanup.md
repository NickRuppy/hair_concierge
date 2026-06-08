# Profile Edit Flows And Result Page Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the old quiz result experience from active production paths and make authenticated profile edits happen in dedicated quiz/onboarding-style edit flows instead of inline profile controls.

**Architecture:** Keep `/profile` as the overview and source of edit entry points. Reuse existing onboarding edit routing for onboarding-backed fields, add a protected quiz-style Hair-Check edit route for quiz-derived fields, and make `/quiz` plus `/result/[leadId]` always render the modern result offer page. Do not use `/quiz?mode=retake` for authenticated profile edits.

**Tech Stack:** Next.js App Router, React client components, Supabase client/server helpers, existing quiz/onboarding UI primitives, Node test runner via `tsx --test`, Playwright for browser flow checks.

---

## Spec Source

**Spec:** Conversation-approved direction from 2026-06-08. No separate long-lived product spec exists yet.

**User Situation:** A user was redirected to the old quiz result page in production, without payment and plan selection. Investigation confirmed production still branches to `QuizResultsView` for entitled users. The user also wants profile editing to feel like the original quiz/onboarding question experience, not like a dense inline admin form.

**Promised End-State:**

- Anonymous/acquisition quiz completion always shows the modern result offer page with payment/plan selection.
- Authenticated paid/manual-access users are not sent through public quiz retake/result branches.
- `/profile` remains the place to review profile data.
- Clicking an editable profile field opens a dedicated edit flow in the style of the original quiz/onboarding screens, saves the selected property, and returns to `/profile`.
- The old result page component and active-access branch are removed if no production usage remains.

## Scope Boundaries

**In Scope**

- Retire old quiz result rendering from `/quiz` and `/result/[leadId]`.
- Remove the active-access UI branch that renders `QuizResultsView`.
- Remove `/quiz?mode=retake` as an authenticated app-routing exception.
- Add protected Hair-Check edit routing under `/profile/edit/hair-check`.
- Route Hair-Check profile cards to field-specific edit pages instead of inline editing.
- Keep existing onboarding edit behavior for products, styling, and routine fields.
- Keep existing `/profile/edit/goals` behavior unless a small routing polish is needed for consistent `returnTo`.
- Update tests for the new flow and deleted old result branch.

**Out of Scope**

- Redesigning the visual language of quiz/onboarding screens.
- Changing recommendation logic or product matching.
- Changing billing, checkout pricing, Stripe, or PayPal logic.
- Building a full multi-step authenticated Hair-Check retake flow.
- Migrating existing profile data.
- Creating new database columns.

## Target File Map

- Modify `src/app/profile/page.tsx`
  - Remove inline Hair-Check editor state/UI.
  - Route quiz-derived profile fields to `/profile/edit/hair-check?field=<field>&returnTo=/profile`.
  - Keep product/styling/routine/goals routing behavior.

- Create `src/app/profile/edit/hair-check/page.tsx`
  - Protected server page.
  - Validates `field` and `returnTo`.
  - Loads the current `hair_profiles` row.
  - Renders the field-specific edit client.

- Create `src/components/profile/edit-hair-check-flow.tsx`
  - Client component for field-specific Hair-Check edits.
  - Uses quiz/onboarding-style option controls and explanatory question copy.
  - Saves one property or a tightly coupled property group, then routes back.

- Create `src/lib/profile/hair-check-edit-config.ts`
  - Defines valid Hair-Check edit fields, copy, UI type, options, save payload mapping, and grouping rules.
  - Keeps profile page, edit page, and tests using one source of truth.

- Modify `src/lib/profile/section-config.ts`
  - Change Hair-Check `editTarget` from generic `{ kind: "quiz" }` to a field-aware target, or keep `kind: "quiz"` and pass the field key through the profile page router.

- Modify `src/components/quiz/quiz-results.tsx`
  - Remove active-access subscription/manual-grant check and old `QuizResultsView` branch.
  - Always render `QuizResultOfferPage` for completed quiz results.
  - Keep result artifact email trigger once per completed lead.

- Modify `src/app/result/[leadId]/result-client.tsx`
  - Always render `QuizResultOfferPage`.
  - Remove `hasAccess` UI branch.

- Modify `src/app/result/[leadId]/page.tsx`
  - Stop loading authenticated billing access solely to choose result UI.

- Modify `src/lib/auth/intake-state.ts`
  - Remove `isQuizRetake` option from `getAuthenticatedAppRedirect`.

- Modify `src/lib/supabase/middleware.ts`
  - Stop treating `/quiz?mode=retake` as an authenticated routing bypass.

- Modify `src/components/landing/landing-header.tsx`
  - Change `Anmelden` from `/chat` to `/auth?next=/chat` for an explicit login destination.

- Delete if unused:
  - `src/components/quiz/quiz-results-view.tsx`
  - `src/lib/quiz/result-cta.ts`
  - tests that only assert old result-page behavior.

- Modify `src/lib/quiz/result-narrative.ts`
  - Remove the retired `cta` payload from the narrative type and builder once old result rendering is gone.

- Tests:
  - Modify `tests/result-page-client.test.tsx`.
  - Modify `tests/quiz-result-artifact-trigger.test.ts`.
  - Modify `tests/auth-intake-state.test.ts`.
  - Modify or delete `tests/quiz-result-cta.test.ts`.
  - Modify or delete `tests/quiz-results-view.test.tsx`.
  - Add `tests/profile-hair-check-edit-config.test.ts`.
  - Add or modify profile routing tests if existing test style supports it.

---

## Task 1: Add Hair-Check Edit Configuration

**Files:**

- Create: `src/lib/profile/hair-check-edit-config.ts`
- Test: `tests/profile-hair-check-edit-config.test.ts`

- [ ] **Step 1: Write failing tests for supported fields and grouped fields**

Create `tests/profile-hair-check-edit-config.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import {
  HAIR_CHECK_EDIT_FIELDS,
  getHairCheckEditConfig,
  getHairCheckEditHref,
  isHairCheckEditField,
} from "../src/lib/profile/hair-check-edit-config"

test("Hair-Check edit config exposes every profile Hair-Check field", () => {
  assert.deepEqual(HAIR_CHECK_EDIT_FIELDS, [
    "hair_texture",
    "thickness",
    "density",
    "cuticle_condition",
    "protein_moisture_balance",
    "chemical_treatment",
    "scalp",
    "concerns",
  ])
})

test("Hair-Check edit config validates fields", () => {
  assert.equal(isHairCheckEditField("thickness"), true)
  assert.equal(isHairCheckEditField("scalp"), true)
  assert.equal(isHairCheckEditField("unknown"), false)
})

test("Hair-Check edit href points to the protected profile edit route", () => {
  assert.equal(
    getHairCheckEditHref("thickness"),
    "/profile/edit/hair-check?field=thickness&returnTo=%2Fprofile",
  )
})

test("scalp edit config groups scalp type and scalp condition", () => {
  const config = getHairCheckEditConfig("scalp")

  assert.equal(config.field, "scalp")
  assert.deepEqual(config.profileKeys, ["scalp_type", "scalp_condition"])
  assert.match(config.title, /Kopfhaut/i)
})

test("edit options include QuizOptionCard metadata", () => {
  const config = getHairCheckEditConfig("thickness")
  const firstOption = config.options[0]

  assert.equal(firstOption.value, "fine")
  assert.equal(typeof firstOption.label, "string")
  assert.equal(typeof firstOption.description, "string")
  assert.equal(firstOption.icon, "hair-fine")
})
```

- [ ] **Step 2: Run config test and verify it fails**

Run:

```bash
npx tsx --test tests/profile-hair-check-edit-config.test.ts
```

Expected: FAIL because `src/lib/profile/hair-check-edit-config.ts` does not exist.

- [ ] **Step 3: Implement the config module**

Create `src/lib/profile/hair-check-edit-config.ts`:

```ts
import {
  CHEMICAL_TREATMENT_LABELS,
  PROFILE_CONCERN_LABELS,
  SCALP_CONDITION_LABELS,
  SCALP_TYPE_LABELS,
  type ChemicalTreatment,
  type ProfileConcern,
} from "@/lib/types"
import type { IconName } from "@/components/ui/icon"

export const HAIR_CHECK_EDIT_FIELDS = [
  "hair_texture",
  "thickness",
  "density",
  "cuticle_condition",
  "protein_moisture_balance",
  "chemical_treatment",
  "scalp",
  "concerns",
] as const

export type HairCheckEditField = (typeof HAIR_CHECK_EDIT_FIELDS)[number]

export type HairCheckOption = {
  value: string
  label: string
  description?: string
  icon: IconName
}

export type HairCheckEditConfig = {
  field: HairCheckEditField
  profileKeys: readonly string[]
  title: string
  description: string
  mode: "single" | "multi" | "scalp"
  options: readonly HairCheckOption[]
  secondaryOptions?: readonly HairCheckOption[]
  maxSelected?: number
}

const SURFACE_OPTIONS: HairCheckOption[] = [
  {
    value: "smooth",
    label: "Glatt wie Glas",
    description: "Die Finger gleiten gleichmäßig durch.",
    icon: "surface-smooth",
  },
  {
    value: "slightly_rough",
    label: "Leicht uneben",
    description: "Kleine Hügel spürbar, nicht durchgehend.",
    icon: "surface-uneven",
  },
  {
    value: "rough",
    label: "Rau und huckelig",
    description: "Deutlich rau und uneben.",
    icon: "surface-rough",
  },
]

const ELASTICITY_OPTIONS: HairCheckOption[] = [
  {
    value: "stretches_bounces",
    label: "Dehnt sich und geht zurück",
    description: "Federt in den Ursprungszustand zurück.",
    icon: "elastic-bounces",
  },
  {
    value: "stretches_stays",
    label: "Dehnt sich, bleibt ausgeleiert",
    description: "Bleibt länger gedehnt.",
    icon: "elastic-stays",
  },
  {
    value: "snaps",
    label: "Reißt sofort",
    description: "Gibt kaum nach und bricht schnell.",
    icon: "elastic-snaps",
  },
]

const CHEMICAL_TREATMENT_OPTIONS: HairCheckOption[] = [
  {
    value: "natural",
    label: CHEMICAL_TREATMENT_LABELS.natural,
    description: "Keine Farbe, Blondierung oder chemische Umformung.",
    icon: "treatment-natural",
  },
  {
    value: "colored",
    label: CHEMICAL_TREATMENT_LABELS.colored,
    description: "Gefärbt, getönt oder glossed.",
    icon: "treatment-colored",
  },
  {
    value: "bleached",
    label: CHEMICAL_TREATMENT_LABELS.bleached,
    description: "Aufgehellt oder blondiert.",
    icon: "treatment-lightened",
  },
]

const CONCERN_OPTIONS: HairCheckOption[] = [
  {
    value: "hair_damage",
    label: PROFILE_CONCERN_LABELS.hair_damage,
    description: "Dein Haar wirkt angegriffen oder überstrapaziert.",
    icon: "goal-repair",
  },
  {
    value: "split_ends",
    label: PROFILE_CONCERN_LABELS.split_ends,
    description: "Die Spitzen wirken gespalten oder fransen aus.",
    icon: "goal-split-ends",
  },
  {
    value: "breakage",
    label: PROFILE_CONCERN_LABELS.breakage,
    description: "Längen brechen leichter ab.",
    icon: "goal-strength",
  },
  {
    value: "dryness",
    label: PROFILE_CONCERN_LABELS.dryness,
    description: "Längen fühlen sich trocken oder spröde an.",
    icon: "goal-moisture",
  },
  {
    value: "frizz",
    label: PROFILE_CONCERN_LABELS.frizz,
    description: "Das Haar wirkt unruhig oder steht ab.",
    icon: "goal-frizz",
  },
  {
    value: "tangling",
    label: PROFILE_CONCERN_LABELS.tangling,
    description: "Es verknotet oder lässt sich schwer entwirren.",
    icon: "brush-detangling",
  },
]

const SCALP_TYPE_OPTIONS: HairCheckOption[] = [
  {
    value: "oily",
    label: SCALP_TYPE_LABELS.oily,
    description: "Der Ansatz fettet schnell nach.",
    icon: "scalp-oily",
  },
  {
    value: "balanced",
    label: SCALP_TYPE_LABELS.balanced,
    description: "Weder besonders ölig noch besonders trocken.",
    icon: "scalp-normal",
  },
  {
    value: "dry",
    label: SCALP_TYPE_LABELS.dry,
    description: "Die Kopfhaut fühlt sich eher trocken oder gespannt an.",
    icon: "scalp-dry",
  },
]

const SCALP_CONDITION_OPTIONS: HairCheckOption[] = [
  { value: "", label: "Keine Beschwerden", icon: "check" },
  {
    value: "dandruff",
    label: SCALP_CONDITION_LABELS.dandruff,
    description: "Sichtbare Schuppen, die wiederkehren.",
    icon: "scalp-flaky",
  },
  {
    value: "dry_flakes",
    label: SCALP_CONDITION_LABELS.dry_flakes,
    description: "Trockene, feine Schüppchen.",
    icon: "scalp-dry-flakes",
  },
  {
    value: "irritated",
    label: SCALP_CONDITION_LABELS.irritated,
    description: "Juckreiz, Brennen oder gereiztes Gefühl.",
    icon: "scalp-irritated",
  },
]

const HAIR_TEXTURE_EDIT_OPTIONS: HairCheckOption[] = [
  {
    value: "straight",
    label: "Glatt",
    description: "Die Strähne hängt glatt runter.",
    icon: "hair-straight",
  },
  {
    value: "wavy",
    label: "Wellig",
    description: "Bildet eine S-Kurve, keine 3D-Windung.",
    icon: "hair-wavy",
  },
  {
    value: "curly",
    label: "Lockig",
    description: "Formt sich zu einer deutlichen 3D-Locke.",
    icon: "hair-curly",
  },
  {
    value: "coily",
    label: "Kraus",
    description: "Enge Windungen, die sich in sich selbst drehen.",
    icon: "hair-coily",
  },
]

const HAIR_THICKNESS_EDIT_OPTIONS: HairCheckOption[] = [
  {
    value: "fine",
    label: "Fein",
    description: "Kaum spürbar - dünner als ein Nähfaden.",
    icon: "hair-fine",
  },
  {
    value: "normal",
    label: "Mittel",
    description: "Spürbar - ähnlich wie ein Nähfaden.",
    icon: "hair-normal",
  },
  {
    value: "coarse",
    label: "Dick",
    description: "Deutlich spürbar - dicker als ein Nähfaden.",
    icon: "hair-coarse",
  },
]

const HAIR_DENSITY_EDIT_OPTIONS: HairCheckOption[] = [
  {
    value: "low",
    label: "Wenig Haare",
    description: "Der Scheitel wirkt breiter oder die Kopfhaut scheint schnell durch.",
    icon: "hair-fine",
  },
  {
    value: "medium",
    label: "Mittlere Dichte",
    description: "Weder auffällig wenig noch auffällig viele Haare.",
    icon: "hair-normal",
  },
  {
    value: "high",
    label: "Viele Haare",
    description: "Dein Haar fühlt sich insgesamt voll an.",
    icon: "hair-coarse",
  },
]

const CONFIG_BY_FIELD: Record<HairCheckEditField, HairCheckEditConfig> = {
  hair_texture: {
    field: "hair_texture",
    profileKeys: ["hair_texture"],
    title: "Wie fällt dein Haar natürlich?",
    description: "Wähle die Struktur, die deinem frisch gewaschenen Haar am nächsten kommt.",
    mode: "single",
    options: HAIR_TEXTURE_EDIT_OPTIONS,
  },
  thickness: {
    field: "thickness",
    profileKeys: ["thickness"],
    title: "Wie dick ist ein einzelnes Haar?",
    description: "Es geht um den Durchmesser eines einzelnen Haares, nicht um die Gesamtmenge.",
    mode: "single",
    options: HAIR_THICKNESS_EDIT_OPTIONS,
  },
  density: {
    field: "density",
    profileKeys: ["density"],
    title: "Wie dicht ist dein Haar insgesamt?",
    description: "Gemeint ist, wie viele Haare du auf dem Kopf hast.",
    mode: "single",
    options: HAIR_DENSITY_EDIT_OPTIONS,
  },
  cuticle_condition: {
    field: "cuticle_condition",
    profileKeys: ["cuticle_condition"],
    title: "Wie fühlt sich deine Haaroberfläche an?",
    description: "Denke an den Finger-Test: glatt, leicht uneben oder deutlich rau.",
    mode: "single",
    options: SURFACE_OPTIONS,
  },
  protein_moisture_balance: {
    field: "protein_moisture_balance",
    profileKeys: ["protein_moisture_balance"],
    title: "Wie reagiert dein Haar im Zug-Test?",
    description:
      "Diese Antwort hilft einzuschätzen, ob dein Haar eher Feuchtigkeit oder Stabilität braucht.",
    mode: "single",
    options: ELASTICITY_OPTIONS,
  },
  chemical_treatment: {
    field: "chemical_treatment",
    profileKeys: ["chemical_treatment"],
    title: "Welche chemischen Behandlungen hatte dein Haar?",
    description: "Wähle alles, was aktuell für deine Längen relevant ist.",
    mode: "multi",
    options: CHEMICAL_TREATMENT_OPTIONS,
  },
  scalp: {
    field: "scalp",
    profileKeys: ["scalp_type", "scalp_condition"],
    title: "Wie verhält sich deine Kopfhaut?",
    description: "Wähle zuerst deinen Kopfhauttyp und dann, ob aktuell Beschwerden bestehen.",
    mode: "scalp",
    options: SCALP_TYPE_OPTIONS,
    secondaryOptions: SCALP_CONDITION_OPTIONS,
  },
  concerns: {
    field: "concerns",
    profileKeys: ["concerns"],
    title: "Was stört dich gerade am meisten?",
    description:
      "Wähle bis zu drei Themen, die für deine Längen und Spitzen aktuell relevant sind.",
    mode: "multi",
    options: CONCERN_OPTIONS,
    maxSelected: 3,
  },
}

export function isHairCheckEditField(
  value: string | null | undefined,
): value is HairCheckEditField {
  return HAIR_CHECK_EDIT_FIELDS.includes(value as HairCheckEditField)
}

export function getHairCheckEditConfig(field: HairCheckEditField): HairCheckEditConfig {
  return CONFIG_BY_FIELD[field]
}

export function getHairCheckEditHref(field: HairCheckEditField, returnTo = "/profile") {
  const params = new URLSearchParams({ field, returnTo })
  return `/profile/edit/hair-check?${params.toString()}`
}

export function toggleChemicalTreatmentValue(
  currentValues: ChemicalTreatment[],
  treatment: ChemicalTreatment,
): ChemicalTreatment[] {
  if (treatment === "natural") {
    return currentValues.includes("natural") ? [] : ["natural"]
  }

  const withoutNatural = currentValues.filter((value) => value !== "natural")

  if (withoutNatural.includes(treatment)) {
    return withoutNatural.filter((value) => value !== treatment)
  }

  return [...withoutNatural, treatment]
}

export function toggleConcernValue(
  currentValues: ProfileConcern[],
  concern: ProfileConcern,
  maxSelected = 3,
): ProfileConcern[] {
  if (currentValues.includes(concern)) {
    return currentValues.filter((value) => value !== concern)
  }

  if (currentValues.length >= maxSelected) {
    return currentValues
  }

  return [...currentValues, concern]
}
```

- [ ] **Step 4: Run config test and verify it passes**

Run:

```bash
npx tsx --test tests/profile-hair-check-edit-config.test.ts
```

Expected: PASS.

---

## Task 2: Add Protected Hair-Check Edit Route

**Files:**

- Create: `src/app/profile/edit/hair-check/page.tsx`
- Create: `src/components/profile/edit-hair-check-flow.tsx`
- Test: `tests/profile-hair-check-edit-config.test.ts`

- [ ] **Step 1: Add route validation tests for safe return URLs**

Extend `tests/profile-hair-check-edit-config.test.ts`:

```ts
import { resolveHairCheckReturnTo } from "../src/lib/profile/hair-check-edit-config"

test("Hair-Check returnTo resolver accepts only local paths", () => {
  assert.equal(resolveHairCheckReturnTo("/profile"), "/profile")
  assert.equal(resolveHairCheckReturnTo("/profile?tab=hair"), "/profile?tab=hair")
  assert.equal(resolveHairCheckReturnTo("https://evil.test"), "/profile")
  assert.equal(resolveHairCheckReturnTo("//evil.test"), "/profile")
  assert.equal(resolveHairCheckReturnTo(null), "/profile")
})
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npx tsx --test tests/profile-hair-check-edit-config.test.ts
```

Expected: FAIL because `resolveHairCheckReturnTo` is not exported yet.

- [ ] **Step 3: Add `resolveHairCheckReturnTo`**

Append to `src/lib/profile/hair-check-edit-config.ts`:

```ts
export function resolveHairCheckReturnTo(value: string | null | undefined): string {
  if (!value) return "/profile"

  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) return "/profile"
  if (trimmed.startsWith("//")) return "/profile"
  if (trimmed.includes("\\")) return "/profile"
  if (/\s/.test(trimmed)) return "/profile"
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return "/profile"

  return trimmed
}
```

- [ ] **Step 4: Create the server page**

Create `src/app/profile/edit/hair-check/page.tsx`:

```tsx
import { redirect } from "next/navigation"

import { EditHairCheckFlow } from "@/components/profile/edit-hair-check-flow"
import {
  getHairCheckEditConfig,
  isHairCheckEditField,
  resolveHairCheckReturnTo,
} from "@/lib/profile/hair-check-edit-config"
import { createClient } from "@/lib/supabase/server"
import type { HairProfile } from "@/lib/types"

interface PageProps {
  searchParams: Promise<{
    field?: string | string[]
    returnTo?: string | string[]
  }>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ProfileEditHairCheckPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const field = firstParam(params.field)
  const returnTo = resolveHairCheckReturnTo(firstParam(params.returnTo))

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?next=${encodeURIComponent("/profile/edit/hair-check")}`)
  }

  if (!isHairCheckEditField(field)) {
    redirect(returnTo)
  }

  const { data: hairProfile } = await supabase
    .from("hair_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  return (
    <div className="mx-auto max-w-[540px] px-5 py-8 md:px-10 md:py-12">
      <EditHairCheckFlow
        userId={user.id}
        config={getHairCheckEditConfig(field)}
        hairProfile={(hairProfile as HairProfile | null) ?? null}
        returnTo={returnTo}
      />
    </div>
  )
}
```

- [ ] **Step 5: Create the edit flow client**

Create `src/components/profile/edit-hair-check-flow.tsx` with one field-saving component:

```tsx
"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import { Button } from "@/components/ui/button"
import {
  type HairCheckEditConfig,
  toggleChemicalTreatmentValue,
  toggleConcernValue,
} from "@/lib/profile/hair-check-edit-config"
import { createClient } from "@/lib/supabase/client"
import type { ChemicalTreatment, HairProfile, ProfileConcern } from "@/lib/types"
import { useToast } from "@/providers/toast-provider"

type DraftState = {
  singleValue: string
  multiValues: string[]
  scalpType: string
  scalpCondition: string
}

function initialDraft(config: HairCheckEditConfig, profile: HairProfile | null): DraftState {
  if (config.field === "scalp") {
    return {
      singleValue: "",
      multiValues: [],
      scalpType: profile?.scalp_type ?? "",
      scalpCondition: profile?.scalp_condition ?? "",
    }
  }

  if (config.field === "chemical_treatment") {
    return {
      singleValue: "",
      multiValues: profile?.chemical_treatment ?? [],
      scalpType: "",
      scalpCondition: "",
    }
  }

  if (config.field === "concerns") {
    return {
      singleValue: "",
      multiValues: profile?.concerns ?? [],
      scalpType: "",
      scalpCondition: "",
    }
  }

  const value = profile?.[config.field as keyof HairProfile]

  return {
    singleValue: typeof value === "string" ? value : "",
    multiValues: [],
    scalpType: "",
    scalpCondition: "",
  }
}

function buildPayload(config: HairCheckEditConfig, draft: DraftState) {
  switch (config.field) {
    case "chemical_treatment":
      return { chemical_treatment: draft.multiValues }
    case "concerns":
      return { concerns: draft.multiValues }
    case "scalp":
      return {
        scalp_type: draft.scalpType || null,
        scalp_condition: draft.scalpCondition || null,
      }
    default:
      return { [config.field]: draft.singleValue || null }
  }
}

function canSave(config: HairCheckEditConfig, draft: DraftState) {
  if (config.mode === "scalp") return Boolean(draft.scalpType)
  if (config.mode === "multi") {
    if (config.field === "concerns") return true
    return draft.multiValues.length > 0
  }
  return Boolean(draft.singleValue)
}

export function EditHairCheckFlow({
  userId,
  config,
  hairProfile,
  returnTo,
}: {
  userId: string
  config: HairCheckEditConfig
  hairProfile: HairProfile | null
  returnTo: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [draft, setDraft] = useState<DraftState>(() => initialDraft(config, hairProfile))
  const [saving, setSaving] = useState(false)
  const saveDisabled = !canSave(config, draft) || saving

  const selectedValues = useMemo(() => new Set(draft.multiValues), [draft.multiValues])

  const handleMultiToggle = useCallback(
    (value: string) => {
      setDraft((current) => {
        if (config.field === "chemical_treatment") {
          return {
            ...current,
            multiValues: toggleChemicalTreatmentValue(
              current.multiValues as ChemicalTreatment[],
              value as ChemicalTreatment,
            ),
          }
        }

        return {
          ...current,
          multiValues: toggleConcernValue(
            current.multiValues as ProfileConcern[],
            value as ProfileConcern,
            config.maxSelected ?? 3,
          ),
        }
      })
    },
    [config.field, config.maxSelected],
  )

  const handleSave = useCallback(async () => {
    if (saveDisabled) return

    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from("hair_profiles").upsert(
        {
          user_id: userId,
          ...buildPayload(config, draft),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )

      if (error) throw error

      toast({ title: "Profil aktualisiert" })
      router.push(returnTo)
    } catch (error) {
      console.error("[edit-hair-check-flow] save failed:", error)
      toast({
        title: "Speichern fehlgeschlagen. Bitte versuche es erneut.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [config, draft, returnTo, router, saveDisabled, toast, userId])

  return (
    <main className="min-h-[70vh]">
      <button
        type="button"
        onClick={() => router.push(returnTo)}
        className="mb-8 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
      >
        Zurück zum Profil
      </button>

      <div className="mb-8">
        <p className="type-overline text-primary">Haar-Check bearbeiten</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium leading-tight text-[var(--text-heading)]">
          {config.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{config.description}</p>
      </div>

      {config.mode === "single" ? (
        <div className="grid gap-3">
          {config.options.map((option) => (
            <QuizOptionCard
              key={option.value}
              icon={option.icon}
              label={option.label}
              description={option.description}
              active={draft.singleValue === option.value}
              onClick={() => setDraft((current) => ({ ...current, singleValue: option.value }))}
            />
          ))}
        </div>
      ) : null}

      {config.mode === "multi" ? (
        <div className="grid gap-3">
          {config.field === "concerns" ? (
            <QuizOptionCard
              icon="check"
              label="Nichts davon"
              active={draft.multiValues.length === 0}
              onClick={() => setDraft((current) => ({ ...current, multiValues: [] }))}
            />
          ) : null}
          {config.options.map((option) => {
            const selected = selectedValues.has(option.value)
            const disabled =
              config.field === "concerns" &&
              !selected &&
              draft.multiValues.length >= (config.maxSelected ?? 3)

            return (
              <QuizOptionCard
                key={option.value}
                icon={option.icon}
                label={option.label}
                description={option.description}
                active={selected}
                disabled={disabled}
                onClick={() => handleMultiToggle(option.value)}
              />
            )
          })}
        </div>
      ) : null}

      {config.mode === "scalp" ? (
        <div className="space-y-7">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-heading)]">Kopfhauttyp</h2>
            <div className="grid gap-3">
              {config.options.map((option) => (
                <QuizOptionCard
                  key={option.value}
                  icon={option.icon}
                  label={option.label}
                  description={option.description}
                  active={draft.scalpType === option.value}
                  onClick={() => setDraft((current) => ({ ...current, scalpType: option.value }))}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-heading)]">Beschwerden</h2>
            <div className="grid gap-3">
              {(config.secondaryOptions ?? []).map((option) => (
                <QuizOptionCard
                  key={option.value || "none"}
                  icon={option.icon}
                  label={option.label}
                  description={option.description}
                  active={draft.scalpCondition === option.value}
                  onClick={() =>
                    setDraft((current) => ({ ...current, scalpCondition: option.value }))
                  }
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={handleSave} disabled={saveDisabled}>
          {saving ? "Speichern..." : "Speichern und zurück zum Profil"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(returnTo)}>
          Abbrechen
        </Button>
      </div>
    </main>
  )
}
```

- [ ] **Step 6: Run typecheck for newly referenced component props**

Run:

```bash
npm run typecheck
```

Expected: PASS. The plan intentionally uses the existing `QuizOptionCard` API: `icon`, `label`, optional `description`, `active`, optional `disabled`, and `onClick`.

---

## Task 3: Route Profile Hair-Check Cards To The New Edit Flow

**Files:**

- Modify: `src/app/profile/page.tsx`
- Modify: `src/lib/profile/section-config.ts` only when the `ProfileEditTarget` type must become field-aware for TypeScript to compile
- Test: `tests/profile-hair-check-edit-config.test.ts` covers edit href generation; `npm run typecheck` verifies the profile page wiring compiles

- [ ] **Step 1: Remove inline Hair-Check editor state and helpers**

In `src/app/profile/page.tsx`, remove local-only quiz editor state and functions:

- `QuizDraft`
- `QuizSaveNotice`
- `QUIZ_SURFACE_OPTIONS`
- `QUIZ_ELASTICITY_OPTIONS`
- `QUIZ_SCALP_TYPE_OPTIONS`
- `QUIZ_SCALP_CONDITION_OPTIONS`
- `QUIZ_CHEMICAL_TREATMENT_OPTIONS`
- `QUIZ_CONCERN_OPTIONS`
- `createQuizDraft`
- `createLocalHairProfile`
- `toggleChemicalTreatment`
- `toggleConcern`
- `QuizEditorField`
- `quizEditing`, `quizSaving`, `quizDraft`, `quizNotice`, `pendingQuizFocusKey`, `quizFieldRefs`
- `startQuizEditing`
- `resetQuizEditing`
- `handleSaveQuiz`
- related effects that only sync/focus inline quiz editing

- [ ] **Step 2: Route Hair-Check clicks to protected edit URLs**

Import:

```ts
import { getHairCheckEditHref, isHairCheckEditField } from "@/lib/profile/hair-check-edit-config"
```

Update `openTarget` quiz handling. Use this grouped version only, so `scalp_type` and `scalp_condition` both open the same scalp editor:

```ts
const editField = fieldKey === "scalp_type" || fieldKey === "scalp_condition" ? "scalp" : fieldKey

if (target.kind === "quiz" && isHairCheckEditField(editField)) {
  goToSectionStep("quiz", getHairCheckEditHref(editField))
  return
}
```

- [ ] **Step 3: Replace the Hair-Check section copy**

Change the section description from inline-edit language to route-edit language:

```tsx
description =
  "Deine Antworten aus dem Haar-Check. Tippe eine Karte an, um die passende Frage erneut im Bearbeitungsmodus zu öffnen."
```

Remove the `Haar-Check bearbeiten` button if it only opened the removed inline editor. Keep individual cards as the edit entry point. If a general button is desired, point it to `getHairCheckEditHref("hair_texture")`.

- [ ] **Step 4: Verify profile file no longer imports unused UI controls**

Run:

```bash
npm run typecheck
```

Expected: PASS. Remove unused imports reported by TypeScript or ESLint.

---

## Task 4: Remove Old Result Page Branches

**Files:**

- Modify: `src/components/quiz/quiz-results.tsx`
- Modify: `src/app/result/[leadId]/result-client.tsx`
- Modify: `src/app/result/[leadId]/page.tsx`
- Delete if unused: `src/components/quiz/quiz-results-view.tsx`
- Delete if unused: `src/lib/quiz/result-cta.ts`
- Modify/delete tests: `tests/result-page-client.test.tsx`, `tests/quiz-result-cta.test.ts`, `tests/quiz-results-view.test.tsx`, `tests/quiz-result-artifact-trigger.test.ts`

- [ ] **Step 1: Flip the result client test first**

Modify `tests/result-page-client.test.tsx` so it asserts modern offer page output for an entitled/previously-access case. If `hasAccess` is removed from the component API in this task, test the rendered client without that prop.

Expected assertions:

```ts
assert.match(html, /Angebot:/i)
assert.match(html, /So können sich deine Haare in 4 Wochen anfühlen\./i)
assert.doesNotMatch(html, /SO KOMMEN WIR DEINEM HAARZIEL NÄHER/i)
assert.doesNotMatch(html, /MEINE ROUTINE STARTEN/i)
```

- [ ] **Step 2: Run the result client test and verify it fails**

Run:

```bash
npx tsx --test tests/result-page-client.test.tsx
```

Expected: FAIL because current code renders `QuizResultsView` for `hasAccess`.

- [ ] **Step 3: Make `/result/[leadId]` always render `QuizResultOfferPage`**

In `src/app/result/[leadId]/result-client.tsx`:

- Remove `QuizResultsView` import.
- Remove `getQuizResultCta` import.
- Remove `hasAccess` prop.
- Remove the `if (hasAccess)` branch.
- Always return:

```tsx
return (
  <QuizResultOfferPage
    name={name}
    narrative={narrative}
    leadId={leadId}
    focusRoutine={focusRoutine}
  />
)
```

In `src/app/result/[leadId]/page.tsx`:

- Remove `cookies`, `createServerClient`, and `hasCurrentAppAccess`.
- Delete `getAuthenticatedResultAccess`.
- Load only `lead`.
- Render `ResultPageClient` without `hasAccess`.

- [ ] **Step 4: Make `/quiz` result state always render `QuizResultOfferPage`**

In `src/components/quiz/quiz-results.tsx`:

- Remove `useRouter`, `useSearchParams`, `useState`, auth provider, `isSubscriptionActive`, and access-check state.
- Remove `/api/billing/access` fetch.
- Remove `canGoStraightToRoutine`.
- Remove loading copy `Wir prüfen deinen Zugang`.
- Remove `handleStart`.
- Always return:

```tsx
return (
  <QuizResultOfferPage
    name={lead.name}
    narrative={narrative}
    leadId={leadId}
    onCheckoutOpen={captureQuizCompleted}
  />
)
```

Keep `shouldTriggerResultArtifactEmail`, but simplify it to only check:

```ts
if (!leadId) return false
if (previouslyTriggeredLeadId === leadId) return false
return true
```

- [ ] **Step 5: Delete old result view/helper and remove retired CTA data**

Run:

```bash
rg -n "QuizResultsView|getQuizResultCta|result-cta|narrative\\.cta|MEINE ROUTINE STARTEN" src tests -S
```

Delete:

- `src/components/quiz/quiz-results-view.tsx`
- `src/lib/quiz/result-cta.ts`
- `tests/quiz-results-view.test.tsx`
- `tests/quiz-result-cta.test.ts`

Remove the retired CTA payload from `src/lib/quiz/result-narrative.ts`:

```ts
export interface QuizResultNarrative {
  heroHeadline: string
  intro: string
  rows: [QuizResultNarrativeRow, QuizResultNarrativeRow, QuizResultNarrativeRow]
  needs: QuizResultNeedsSection
  primaryConcern: QuizConcern | null
  primaryGoal: Goal | null
}
```

and remove this block from `buildQuizResultNarrative`:

```ts
cta: {
  lead: "Als Nächstes: dein persönlicher Plan",
  label: "MEINE ROUTINE STARTEN",
  subline: "Mit passenden Produkten, Reihenfolge und Anwendung.",
},
```

Update `tests/quiz-result-narrative.test.ts` by deleting assertions that read `narrative.cta.lead`, `narrative.cta.label`, or `narrative.cta.subline`. Keep the row/needs assertions intact.

After edits, run:

```bash
rg -n "QuizResultsView|getQuizResultCta|result-cta|narrative\\.cta|MEINE ROUTINE STARTEN" src tests -S
```

Expected: no matches, except unrelated historical docs if any appear outside `src` and `tests`.

- [ ] **Step 6: Update result artifact trigger test**

Modify `tests/quiz-result-artifact-trigger.test.ts` so it no longer references `canGoStraightToRoutine` or `isCheckingAccess`.

Expected cases:

```ts
assert.equal(
  shouldTriggerResultArtifactEmail({
    leadId: null,
    previouslyTriggeredLeadId: null,
  }),
  false,
)

assert.equal(
  shouldTriggerResultArtifactEmail({
    leadId: "lead-1",
    previouslyTriggeredLeadId: null,
  }),
  true,
)

assert.equal(
  shouldTriggerResultArtifactEmail({
    leadId: "lead-1",
    previouslyTriggeredLeadId: "lead-1",
  }),
  false,
)
```

- [ ] **Step 7: Run narrow tests**

Run:

```bash
npx tsx --test tests/result-page-client.test.tsx tests/quiz-result-artifact-trigger.test.ts tests/quiz-result-narrative.test.ts
```

Expected: PASS.

---

## Task 5: Remove Authenticated Quiz Retake Bypass And Clarify Login Route

**Files:**

- Modify: `src/lib/auth/intake-state.ts`
- Modify: `src/lib/supabase/middleware.ts`
- Modify: `tests/auth-intake-state.test.ts`
- Modify: `src/components/landing/landing-header.tsx`
- Modify E2E tests that assert `MEINE ROUTINE STARTEN` on authenticated retake result paths.

- [ ] **Step 1: Flip auth intake test**

In `tests/auth-intake-state.test.ts`, replace:

```ts
test("getAuthenticatedAppRedirect preserves quiz retake access", () => {
  assert.equal(getAuthenticatedAppRedirect("/quiz", "ready", { isQuizRetake: true }), null)
})
```

with:

```ts
test("getAuthenticatedAppRedirect sends ready users away from the public quiz", () => {
  assert.equal(getAuthenticatedAppRedirect("/quiz", "ready"), "/chat")
})
```

- [ ] **Step 2: Remove `isQuizRetake` from intake routing**

In `src/lib/auth/intake-state.ts`:

- Remove `options?: { isQuizRetake?: boolean }`.
- Remove the early return for `pathname === "/quiz" && options?.isQuizRetake`.

- [ ] **Step 3: Remove middleware retake detection**

In `src/lib/supabase/middleware.ts`:

- Remove:

```ts
const isQuizRetake = pathname === "/quiz" && request.nextUrl.searchParams.get("mode") === "retake"
```

- Change:

```ts
const redirectPath = getAuthenticatedAppRedirect(pathname, intakeState, { isQuizRetake })
```

to:

```ts
const redirectPath = getAuthenticatedAppRedirect(pathname, intakeState)
```

- [ ] **Step 4: Point landing login to explicit auth route**

In `src/components/landing/landing-header.tsx`, change:

```tsx
href = "/chat"
```

to:

```tsx
href = "/auth?next=/chat"
```

for the `Anmelden` link.

- [ ] **Step 5: Update or remove E2E expectations for old retake result**

Search:

```bash
rg -n "MEINE ROUTINE STARTEN|mode=retake|retake the quiz|existing account can retake" tests -S
```

For tests that represent authenticated public quiz retake:

- Delete assertions that click or expect `MEINE ROUTINE STARTEN`.
- Add or keep an auth-routing assertion that a ready authenticated user who visits `/quiz` is redirected to `/chat`.
- Cover the new `/profile/edit/hair-check` route through `tests/profile-hair-check-edit-config.test.ts` plus the manual browser checks in Task 6.

- [ ] **Step 6: Run auth tests**

Run:

```bash
npx tsx --test tests/auth-intake-state.test.ts
```

Expected: PASS.

---

## Task 6: Verification And Browser Review

**Files:**

- No planned production files unless verification finds defects.

- [ ] **Step 1: Run focused node tests**

Run:

```bash
npx tsx --test \
  tests/profile-hair-check-edit-config.test.ts \
  tests/result-page-client.test.tsx \
  tests/quiz-result-artifact-trigger.test.ts \
  tests/quiz-result-narrative.test.ts \
  tests/auth-intake-state.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run broader static checks**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Manual browser checks**

Start a worktree dev server:

```bash
npm run dev:worktree
```

Check:

- `/profile` shows Hair-Check cards but no inline Hair-Check editor.
- Clicking `Haar-Dicke` opens `/profile/edit/hair-check?field=thickness&returnTo=%2Fprofile`.
- Saving the field returns to `/profile`.
- Clicking a scalp-related card opens the grouped scalp editor.
- Products still route to `/onboarding?step=products_basics&returnTo=%2Fprofile`.
- Product detail rows still route to `/onboarding?step=product_drilldown&returnTo=%2Fprofile&category=...&editMode=single-step`.
- Styling fields still route to the relevant onboarding steps.
- Routine fields still route to the relevant onboarding steps.
- Goals still route to `/profile/edit/goals`.
- Anonymous `/quiz` completion shows modern offer/payment result page.
- `/result/[leadId]` shows modern offer/payment result page.
- No reachable result page shows `SO KOMMEN WIR DEINEM HAARZIEL NÄHER` or `MEINE ROUTINE STARTEN`.

- [ ] **Step 5: Run `ready-check` before shipping**

Because this touches UI, onboarding/profile behavior, auth routing, and payments-adjacent result flow, run the repo `ready-check` skill before any shipping handoff.

---

## Risks And Review Notes

- Hair-Check edit options must include `icon`, `label`, optional `description`, and `value` so `EditHairCheckFlow` can use the existing `QuizOptionCard` API without changing shared quiz UI.
- Removing `/quiz?mode=retake` changes an existing E2E scenario. The replacement should be profile-edit coverage, not preserving public quiz retake.
- Hair-Check fields currently include compact inline explanatory copy. The new route should preserve or improve that context so users are not dropped onto unexplained choices.
- `scalp_type` and `scalp_condition` should be grouped; editing only one without context is less coherent.
- `/result/[leadId]` remains intentionally public-by-unguessable lead ID because result contents are not considered highly sensitive and emailed result links should open without login friction.
- Result page cleanup and profile edit routing can be implemented in one branch, but keep commits separated by behavior:
  - profile edit flows
  - old result page removal
  - auth/login routing cleanup

## Follow-Up Backlog From Adversarial Review

These findings are intentionally kept out of the current patch unless separately prioritized:

- Audit profile completion counting for empty arrays versus explicit none-states.
- Audit memory loader failure handling so stale memory state is not shown after `/api/memory` errors.
- Audit middleware redirects for Supabase session cookie preservation.

## Execution Handoff

After plan approval:

1. Run `branch-gate`.
2. Use repo-local worktree `codex/retire-old-result-page` or create a fresh worktree if this one is no longer clean.
3. Use `superpowers:subagent-driven-development` by default.
4. Run focused tests after each task and full verification before `autoreview`.
5. Ask for explicit approval before commit, push, or PR.
