# Personal Plan Stage 5 — Anwendung implementation plan

**Status:** approved visual direction; evidence review confirmed by Nick on 2026-08-08; counterpart plan review reconciled; final designed-user-journey signed off by Nick on 2026-08-08; isolated contract-independent implementation completed and locally verified in `codex/personal-plan-stage5-application`; consolidation and activation remain blocked by the audited Task-0 production prerequisites

**Outcome:** add a persistent `Anwendung` destination that turns the explicitly accepted Stage-4 Routine into a small personalized set of product-led day instructions. The user sees the exact products in physical use order, detailed application steps inside each product block, and necessary productless actions between them. V1 is read-only guidance: it has no dates, calendar, completion state, logging, diary, progress, or product-use tracking.

**Implementation gate:** Stage 5 may consume only an owner-scoped, explicitly accepted `PersonalPlanRoutineVersionV1` from the Stage-4 production contract. The current Stage-1–3 work is still fixture/Labs-only and the Stage-4 implementation is intentionally paused on Milestone-B persistence. Implementation must not invent a parallel user-product model or compile from legacy `user_product_usage` merely to bypass that gate.

## 1. Outcome and source context

Authoritative product and planning inputs:

- `plans/2026-08-07-personal-plan-five-stage-product-journey.md` — Stage 5 is the executable application layer after the accepted Routine; planned, pending, excluded, and uncovered products are never executable.
- `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-stage4-routine/plans/2026-08-07-personal-plan-stage4-routine-implementation.md` — Stage-4 active-version, executable-item, immutable source, legacy-route, and prerequisite contracts. This external worktree artifact must be integrated as a reviewed commit before implementation begins.
- `plans/mockups/2026-08-08-personal-plan-stage5-complete-application-flow.html` — approved responsive Stage-5 design and recovery-state authority.
- `plans/mockups/2026-08-08-personal-plan-stage5-product-led-wash-patterns.html` and `plans/mockups/2026-08-08-personal-plan-stage5-step-patterns.html` — option evidence that led to the chosen product-led hierarchy.
- `plans/routine-application-architecture-spec.md` — older internal input for deterministic application composition. Its chat-first/no-persistence direction is superseded where it conflicts with the five-stage product.
- Current production seams: `src/components/layout/header.tsx`, `src/app/routine/**`, `src/components/routine/**`, `src/lib/routines/**`, the product catalog/spec tables, and the authenticated route/provider conventions.

External evidence remains distinct from runtime policy. It supports the authoring model and representative guidance, while exact launch copy is stored with its verified source in the guidance protocol:

- [USWDS process list](https://designsystem.digital.gov/components/process-list/) — sequential instructional content rather than a progress tracker.
- [Carbon progress guidance](https://carbondesignsystem.com/components/progress-indicator/usage/) — vertical reading direction is the appropriate baseline.
- [WAI-ARIA accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) — considered but not selected as the main experience because it hides instructions.
- Manufacturer directions for exact-product fixtures, including [K18 Molecular Repair Mask](https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-15ml), [K18 HeatBounce](https://www.k18hair.com/products/heatbounce-4oz), [Batiste Original](https://www.batistehair.com/products/dry-shampoo/fragrance-original), [OLAPLEX Nº.5 Leave-In](https://olaplex.com/products/pro-olaplex-n-5-leave-in-moisturize-mend-leave-in-conditioner), and [Moroccanoil Treatment Light](https://www.moroccanoil.com/products/moroccanoil-treatment-light).

## 2. Chosen direction

### 2.1 User-facing hierarchy

- `Anwendung` is a first-class tab in the authenticated Personal Plan bottom navigation.
- The entry page shows only the day types that can be compiled completely for this accepted Routine. It does not show the entire canonical taxonomy or an arbitrary fixed count.
- Selecting a day opens one recipe at a time.
- The outer sequence answers: **What do I do or pick up next?**
- A large coloured product block represents one physical product application. Its nested numbered actions contain that product's complete resolved application guidance.
- A quieter dashed connector represents a necessary action without a product: wetting, squeezing out water, towel-drying, waiting between products, air-drying, blow-drying, sectioning, or using a tool.
- Phase headings such as preparation, washing, or styling do not own the large sections. The physical product order is the memory model.
- Styling is a composable block. It may be appended to another day or rendered as a standalone `Styling-Tag` when the same block is executable independently.
- One application that covers several roles appears once. A Leave-in that also supplies heat protection gets one block plus the compact note `Diese Anwendung übernimmt zugleich deinen Hitzeschutz.` A genuinely separate reapplication for another heat event remains a separate product block.
- The customer-facing page header stays compact: back navigation, day title, and resolved cadence only. There are no summary pills, explanatory subheaders, phase chips, or internal variant labels.

### 2.2 Read-time compilation, not a user activity artifact

Stage 5 is a deterministic read model compiled on demand from:

1. the owner-scoped active Stage-4 Routine version;
2. the immutable refined profile referenced by that version;
3. the latest active canonical day-type definitions;
4. the latest active compatible application-guidance protocols.

V1 does **not** persist a user-specific Stage-5 version, current day, completion state, calendar assignment, usage event, or read history. Protocol rows are versioned for provenance and safe replacement. Activating a new verified protocol changes the resolved instructions on the next load without mutating the accepted Routine.

This is intentionally different from Stage 4: changing the product composition requires an accepted Routine successor; improving verified instructions does not require the user to reconfirm the same products.

### 2.3 Guidance authority and writing rules

Guidance resolves in this order:

1. active exact-product + semantic-role protocol;
2. active application-family protocol plus verified modifiers;
3. safe category baseline only for families explicitly allowed to inherit it.

An incomplete higher-priority protocol never silently falls through when the product/family requires exact guidance.

All visible copy is German. English is limited to internal keys and exact product names. Canonical product vocabulary such as `Shampoo`, `Conditioner`, `Leave-in`, `Bond-Repair`, and `Styling` may remain because it is established customer vocabulary; mixed German/English sentences do not.

Profile facts resolve internally. The user sees a direct instruction, never `Wenn du feines Haar hast ...` when the system already knows thickness. Bounded personalization inputs are:

- hair length, density, and thickness for an honest amount range or qualitative amount;
- product format for the physical action: spray, mist, pump, drops, lotion, cream, balm, serum, powder, foam, or aerosol;
- confirmed application area such as scalp/roots, lengths and ends, or ends;
- hair state: wet, towel-dried, damp, dry, or dry-unwashed;
- sectioning/distribution technique when supported by the profile and product;
- drying route and confirmed heat events/tools;
- exact product restrictions, contact time, rinse behavior, sequencing, and cautions.

Amount rules:

- use an exact amount only when the manufacturer provides it;
- resolve a manufacturer range only when its stated conditions map to known profile facts;
- otherwise use honest qualitative copy such as `eine kleine Menge`, `sparsam`, or `portionsweise ergänzen, bis ... gleichmäßig bedeckt ist`;
- never invent pumps, sprays, millilitres, coin/nut sizes, or false precision from the profile alone.

Standard Shampoo and reset cleansing are one pass. Stage 5 never recommends or suggests double cleansing for them. A targeted treatment Shampoo may show an optional two-product/two-pass sequence only when exact verified guidance explicitly allows it.

## 3. Scope and non-goals

### In scope

- eight canonical day types with stable internal keys and versioned German metadata;
- deterministic eligibility, composition, ordering, deduplication, and suppression of incomplete days;
- one global versioned guidance store shared by Stage 5 and future guidance consumers;
- application-family templates, format modifiers, exact-product overrides, sources, and completeness validation;
- representative V1 protocol seeds and a launch-completeness audit for every product executable in the initial Personal Plan portfolio;
- owner-scoped server loading from the accepted Stage-4 version and its referenced refined profile;
- `/anwendung` overview, day detail, loading, not-yet-ready, unavailable, and no-complete-day states;
- a Personal Plan bottom navigation with `Chat`, `Routine`, `Anwendung`, and `Profil`, while preserving the legacy authenticated navigation for users without a Personal Plan;
- responsive product blocks and productless connectors matching the approved design;
- accessibility, German-copy validation, auth/RLS tests, and legacy regressions;
- a bounded feature gate for internal rollout and safe route disablement.

### Non-goals

- calendar dates, weekdays, scheduling, “today”, reminders, recommendations for a specific date, or weekly planning;
- checkboxes, completion/progress state, day logging, streaks, history, adherence, diary behavior, or behavioral analytics;
- reusing or extending the existing `/tracker` day-type schema as the Stage-5 taxonomy;
- changing Stage-4 Routine contents, ownership, cadence, or product decisions from the Anwendung page;
- making planned purchases, pending reviews, excluded products, uncovered roles, or unresolved product identities executable;
- product shopping, acquisition, substitution, or intake actions inside Stage 5;
- an admin guidance editor or full product-intake authoring integration in V1; initial protocols are migration/fixture-backed and audited, with a later authoring workflow as a separate workstream;
- medical diagnosis or treatment advice. Cosmetic scalp guidance stays conservative and is suppressed by the existing safety pause;
- literal reuse of mockup CSS or placeholder product initials as production product imagery;
- a global navigation redesign for legacy/non-Personal-Plan users.

## 4. Authoritative contracts and invariants

### 4.1 Stage-4 and profile input

The browser never submits trusted Routine or profile JSON. The server resolves the authenticated owner, loads the current active Routine version, checks ownership, and loads the immutable refined snapshot referenced by `source.refinedVersionId`.

Only Routine items with all of the following may become product steps:

```ts
item.state.inclusion === "included"
item.state.availability === "owned"
item.product.kind === "owned"
item.product.productId is a canonical catalog UUID
item.executable === true
```

The Stage-4 `role`, `assignmentKey`, category authority IDs, and product ID are preserved. Stage 5 does not infer identity from display names and does not read current legacy `user_product_usage` as a substitute.

### 4.2 Canonical day types

```ts
type ApplicationDayTypeKey =
  | "wash_day"
  | "intensive_care_day"
  | "bond_repair_day"
  | "clarifying_wash_day"
  | "refresh_day"
  | "between_wash_care_day"
  | "styling_day"
  | "rest_day"
```

The migration seeds version `1` for every key:

| Internal key            | German label            | Inclusion condition                                                                                                                               | Core product roles / exclusions                                                                                                                                                                                                                                                       |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wash_day`              | `Waschtag`              | A complete base wet-wash recipe can be resolved.                                                                                                  | Requires a compatible Shampoo cleanse. May compose rinse-out Conditioner, allowed Scalp Care anchors, Leave-in, damp heat protection, styling, and dry finish. A scheduled Mask, Bondbuilder, or reset cleanser moves the recipe to its dedicated day instead of duplicating it here. |
| `intensive_care_day`    | `Intensiv-Pflegetag`    | A complete post-Shampoo rinse-out Mask protocol exists together with the wash anchors it requires.                                                | Requires Shampoo + Mask. Conditioner follows only when the exact Mask relationship says so. May append Leave-in/styling. Generic pre-Shampoo Mask is not a standard family; a verified special product may add an exact pre-Shampoo block.                                            |
| `bond_repair_day`       | `Bond-Repair-Tag`       | At least one owned executable Bondbuilder has a complete exact protocol and every required surrounding step can be resolved.                      | The exact protocol controls Shampoo/Conditioner relationship, wet/dry state, rinse, wait, and subsequent care. Never infer a generic Bondbuilder sequence.                                                                                                                            |
| `clarifying_wash_day`   | `Klär-Waschtag`         | An executable reset cleanser and required aftercare resolve completely.                                                                           | Reset cleanser replaces regular Shampoo. One pass only. No automatic Scalp Peeling or second Shampoo. Conditioner/Mask appears only when compatible.                                                                                                                                  |
| `refresh_day`           | `Auffrisch-Tag`         | At least one approved refresh capability resolves: Dry Shampoo, verified damp between-wash Leave-in, or a profile-supported water reshape action. | Root refresh and length reshaping are independent ordered actions. Dry Shampoo formats never borrow another format's actions. May append air-dry or the Styling block.                                                                                                                |
| `between_wash_care_day` | `Pflegetag ohne Wäsche` | At least one Leave-in or Oil is explicitly verified for dry between-wash care.                                                                    | Hair remains dry. No Dry Shampoo block; root/appearance refresh belongs to `Auffrisch-Tag`. Styling is appended only when independently applicable.                                                                                                                                   |
| `styling_day`           | `Styling-Tag`           | A standalone styling block has at least one executable product/tool event and every required protection step resolves.                            | May contain dry heat protection, styling products as the catalog grows, tool actions, and dry finish. A second heat event creates reapplication only when the exact product requires it.                                                                                              |
| `rest_day`              | `Pausentag`             | Always available after an active Routine exists.                                                                                                  | No product. No catch-up instruction, completion state, or implied schedule.                                                                                                                                                                                                           |

There is no artificial “three days” cap. The overview is the deterministic subset of complete relevant days, sorted in the canonical order above with `Pausentag` last. `Intensiv-Pflegetag` and `Klär-Waschtag`, for example, remain canonical but stay absent for users without the required products/protocols.

### 4.3 Application families and independent modifiers

The taxonomy splits only when the physical application changes. Formula weight, shine, protein/moisture direction, repair strength, or marketing claims may affect product selection without creating another application family.

| Category        | Application families                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shampoo         | `standard_rinse_out_cleanse`, `targeted_treatment_shampoo`                                                                                                 |
| Conditioner     | `standard_rinse_out_conditioning`                                                                                                                          |
| Mask            | `post_shampoo_rinse_out_mask`; unusual pre-Shampoo use is exact-product-only                                                                               |
| Leave-in        | `post_wash_booster`, `conditioner_replacement`, `between_wash_damp_refresh`, `between_wash_dry_care`, `pre_heat_damp`, `pre_heat_dry`, `post_style_finish` |
| Oil             | `pre_wash_lengths_treatment`, `post_wash_damp_conditioning`, `between_wash_dry_care`, `dry_finish`                                                         |
| Deep Cleansing  | `reset_cleanse`; contact time is a modifier, not another family                                                                                            |
| Dry Shampoo     | `aerosol_spray`, `powder`, `foam`, `liquid_to_dry`, `paste_or_balm`                                                                                        |
| Heat Protectant | `damp_hair_protection`, `dry_hair_protection`, `either_state_protection`                                                                                   |
| Bondbuilder     | `pre_shampoo_single_treatment`, `pre_shampoo_booster_plus_treatment`, `post_shampoo_rinse_out_treatment`, `post_shampoo_timed_leave_in`                    |
| Scalp Care      | `leave_on_scalp_care`, `rinse_off_scalp_care`; before/after Shampoo is an exact sequence anchor                                                            |

Independent modifiers include format, required hair state, application area, sectioning/distribution action, rinse behavior, contact time, Conditioner relationship, sequence anchor, reapplication rule, heat activation, exact amount, and cautions. In V1, safety-relevant cautions must be written into the ordered step copy; the reserved `cautions` array stays empty until a separate caution treatment is designed and reviewed.

The family taxonomy is broader than some current catalog columns by design, but V1 does not create a second product-fact source. The resolver first adapts existing typed catalog facts:

- `product_leave_in_specs.format`, `application_stage`, and heat-protection fields;
- `product_dry_shampoo_specs.format`, currently `aerosol_spray | powder | foam_or_liquid`;
- `product_bondbuilder_specs.application_mode`, `treatment_mode`, `product_format`, and `usage_protocol`;
- current Mask, Oil, reset-cleanser, and other category spec columns where they still exist in the final migration state.

The repository migration history is not assumed to equal the live final schema. Task 0 compares the integrated local schema with the linked Supabase schema before freezing adapters; for example, legacy Mask `format` and `leave_on_minutes` columns were later removed and are absent from the current live project.

`foam_or_liquid` is deliberately coarse. It never guesses between foam and liquid actions: a product-specific active protocol must select `foam` or `liquid_to_dry`. `paste_or_balm` remains an exact-product future family until a real product supplies it. This preserves the accepted taxonomy without changing or ambiguously backfilling the current catalog enum.

### 4.4 Guidance payload and resolution

```ts
type ApplicationGuidanceProtocolV1 = {
  schemaVersion: 1
  guidanceKey: string
  protocolVersion: number
  locale: "de"
  scope:
    | { kind: "application_family"; category: PersonalPlanCategory }
    | { kind: "product"; category: PersonalPlanCategory; productId: string }
  role: Stage3SemanticRole | null
  applicationFamily: ApplicationFamily
  compatibleDayTypes: ApplicationDayTypeKey[]
  exactGuidanceRequired: boolean
  sequence: {
    anchor: ApplicationSequenceAnchor
    before: string[]
    after: string[]
    conflictsWith: string[]
  }
  requirements: {
    requiredCatalogFacts: CatalogApplicationFactKey[]
    requiredProtocolFacts: ProtocolApplicationFactKey[]
    requiredProfileFacts: string[]
  }
  protocolFacts: {
    applicationArea: ApplicationArea | null
    rinse: "rinse_out" | "leave_in" | null
    contactTimeSeconds: number | null
    conditionerRelationship:
      | "not_applicable"
      | "replaces_conditioner"
      | "conditioner_before"
      | "conditioner_after"
      | "no_conditioner"
      | null
    reapplication: "none" | "each_separate_heat_event" | null
    amount: ApplicationAmountGuidance | null
    cautions: string[]
  }
  steps: Array<{
    stepKey: string
    action: ApplicationActionKey
    copyTemplateDe: string
  }>
  evidence: Array<{
    sourceUrl: string
    sourceType: "manufacturer" | "professional_authority" | "internal_authority"
    checkedAt: string
  }>
}
```

`protocolFacts` contains only exact application facts that have no canonical typed home for that product/category today. It must not restate an existing catalog value merely for convenience. A separate `CatalogApplicationFactsV1` adapter assembles the final inputs and records field provenance as `catalog_spec | bond_usage_protocol | guidance_protocol | refined_profile`.

The existing `src/lib/bondbuilder/usage-protocols.ts` is prior art, not a second authority to ignore. Its five usage protocols are reconciled into version-1 product guidance. During the Stage-5 rollout:

- `product_bondbuilder_specs.usage_protocol` remains the typed product discriminator;
- the versioned protocol store becomes authoritative for detailed German application steps;
- the existing compact Bondbuilder hint remains only a legacy compatibility summary and is covered by a drift test against the matching version-1 protocol;
- the Personal Plan Routine/Anwendung path never renders the legacy Routine planner's separate application prose. Non-Personal-Plan legacy users remain unchanged.

`ApplicationSequenceAnchor` is a small ordered vocabulary such as `pre_wash`, `wet_cleanse`, `post_cleanse_rinse_off`, `post_rinse_towel_dry`, `timed_treatment`, `damp_leave_on`, `dry_pre_heat`, `heat_tool`, and `dry_finish`. It is not a free-form sort number.

Exact guidance is required for:

- every Bondbuilder and Scalp Care product;
- targeted treatment Shampoo;
- every Heat Protectant carrier/product claim;
- Mask contact time and Conditioner relationship;
- pre-wash Oil permission/contact time;
- between-wash permission for Leave-in and Oil;
- unusual multi-use or cross-role products;
- any product whose label changes the safe fallback order, hair state, rinse behavior, or reapplication.

If any required exact fact is missing, the exact block is non-executable. If that block is required by a day, the complete day is omitted rather than rendered partially.

### 4.5 Product blocks, transitions, order, and deduplication

```ts
type CompiledApplicationDayV1 = {
  schemaVersion: 1
  dayType: ApplicationDayTypeKey
  labelDe: string
  summaryDe: string
  cadenceDe: string | null
  sourceRoutineVersionId: string
  steps: ApplicationOuterStepV1[]
  protocolRefs: Array<{ id: string; version: number }>
}

type ApplicationOuterStepV1 =
  | {
      kind: "product"
      stepKey: string
      applicationInstanceKey: string
      productId: string
      productName: string
      categoryLabelDe: string
      purposeDe: string
      actions: Array<{ actionKey: string; copyDe: string }>
      coverageNoteDe: string | null
      protocolRef: { id: string; version: number }
    }
  | {
      kind: "transition"
      stepKey: string
      action: ProductlessActionKey
      copyDe: string
    }
```

Rules:

- outer step numbers are derived after composition; stored protocols do not hard-code page-level numbers;
- product microstep numbers restart inside each product block;
- `applicationInstanceKey` is derived from product ID + protocol + semantic event, not a React array index;
- roles deduplicate only when one physical application satisfies them at the same point in the sequence;
- separate heat events or different hair states remain separate instances even for the same product;
- ordering is topologically validated from typed anchors/constraints. A cycle or unresolved required anchor fails that day closed;
- a productless action is inserted only when it changes state/order or prevents misuse. Decorative transitions are not added;
- cadence comes from the accepted Routine target or exact product course and is rendered relative to routine events, never assigned to weekdays in V1.

### 4.6 Versioned database content

Create the migration with the repository-supported `supabase migration new personal_plan_application_guidance` command during implementation; do not invent the timestamp.

`application_day_type_definitions`:

- `day_type_key text not null`
- `definition_version integer not null check (definition_version > 0)`
- `locale text not null default 'de'`
- `label text not null`
- `summary text not null`
- `sort_order integer not null`
- `status text not null check (status in ('draft','active','retired'))`
- timestamps
- primary key `(day_type_key, definition_version, locale)`
- partial unique index allowing one active row per `(day_type_key, locale)`
- seed all eight rows as version `1`

`application_guidance_protocols`:

- `id uuid primary key`
- `guidance_key text not null`
- `protocol_version integer not null check (protocol_version > 0)`
- `locale text not null default 'de'`
- `scope_kind text not null check (scope_kind in ('application_family','product'))`
- `category_key text not null`
- `role_key text null`
- `product_id uuid null references public.products(id) on delete restrict`
- `application_family text not null`
- `payload jsonb not null`
- `status text not null check (status in ('draft','active','retired'))`
- `verified_at timestamptz null`
- timestamps
- unique `(guidance_key, protocol_version, locale)`
- partial unique index allowing one active row per `(guidance_key, locale)`
- check constraint requiring `product_id` exactly when `scope_kind = 'product'`
- GIN is not added to `payload` in V1 because runtime reads are keyed by indexed scalar columns, not arbitrary JSON search

Both tables live in `public` only to match current project conventions. Enable RLS; `REVOKE ALL` from `PUBLIC`, `anon`, and `authenticated`; grant `SELECT` only to `service_role`; add no broad client read policy; and load them only through the authenticated server resolver after entitlement/ownership checks. Explicit grants must be reviewed because current Supabase projects may not expose newly created tables automatically. No user-controlled write path or `SECURITY DEFINER` function is introduced.

Active content is immutable at the database boundary. A normal invoker trigger rejects changes to keys, version, locale, payload, evidence, product identity, family, or order after a row becomes active; the only allowed change is `active → retired` plus `updated_at`. Revoke function execution from `PUBLIC`, `anon`, and `authenticated`. A correction is inserted as version `n + 1`, activated in the same migration transaction that retires version `n`, and never overwrites live instructions.

The day-definition table is the single source for German labels and `sort_order`; the TypeScript registry owns only typed inclusion/composition behavior for each key. Tests assert that the eight active version-1 rows have exactly one matching compiler rule, preventing a second code-owned order.

The TypeScript/Zod schema is authoritative for `payload`. Migration seed tests parse every active row through it. Invalid or unverified rows cannot be activated.

## 5. Target map

Exact filenames may be adjusted only to align with the integrated Stage-4 directory structure. Behavior and ownership remain fixed.

### Contracts and deterministic compiler

- `src/lib/routines/personal-plan/application/contracts.ts` — Zod/types for day keys, families, modifiers, protocols, compiled steps, views, and typed failure reasons.
- `src/lib/routines/personal-plan/application/day-type-registry.ts` — deterministic inclusion/composition rules keyed by the eight DB-backed definitions; it does not own labels or order.
- `src/lib/routines/personal-plan/application/catalog-facts.ts` — canonical adapter over existing `product_*_specs`, coarse Dry-Shampoo mapping, and Bondbuilder usage protocols, with per-field provenance.
- `src/lib/routines/personal-plan/application/guidance-resolver.ts` — exact-product/family precedence, catalog/protocol fact reconciliation, completeness validation, format action, and profile-resolved copy variables.
- `src/lib/routines/personal-plan/application/compiler.ts` — pure complete-day compiler including typed ordering, cycle detection, and multi-role deduplication, developed test-first.
- `src/lib/routines/personal-plan/application/german-copy.ts` — bounded labels/templates and no recommendation policy.

### Persistence and server loading

- `supabase/migrations/<generated>_personal_plan_application_guidance.sql` — tables, indexes, constraints, RLS/grants, and version-1 seed data.
- `src/lib/routines/personal-plan/application/repository.ts` — server-only active day/protocol reads and row-to-contract parsing.
- `src/lib/routines/personal-plan/application/load-application-view.ts` — authenticated active-Routine/profile resolution, compilation, and recovery-state mapping.
- `src/lib/personal-plan/stage5-rollout.ts` — server-only `PERSONAL_PLAN_STAGE5_ROLLOUT=off|internal|all`; `internal` requires the existing admin/internal profile signal, `all` still requires a true owner-scoped Personal Plan.
- no Stage-5 API route in V1. The server page loads the read model; `Erneut laden` calls `router.refresh()` through a tiny client boundary.

### Route, navigation, and UI

- `src/app/anwendung/page.tsx`, `loading.tsx`, and `layout.tsx` — authenticated resolver, loading shell, metadata/providers.
- `src/components/application/application-page.tsx` — overview/detail state and route-safe day selection.
- `application-overview.tsx`, `application-day-card.tsx` — only complete relevant days.
- `application-day.tsx`, `product-application-block.tsx`, `productless-step.tsx` — approved outer sequence and nested product actions.
- `application-state.tsx` — `Routine bestätigen`, unavailable/retry, and active-but-no-complete-day recovery.
- `src/components/layout/personal-plan-navigation.tsx` — Personal Plan bottom navigation on mobile and desktop with `Chat`, `Routine`, `Anwendung`, `Profil`.
- `src/components/layout/authenticated-app-shell.tsx` plus the existing Chat, Routine, Profile, and new Anwendung page seams — one explicit shared shell for Personal Plan users. It owns the top brand header, bottom-nav clearance, and the CSS custom property consumed by fixed/sticky children.
- `src/components/layout/header.tsx` — retain the existing legacy variant and add only the Personal Plan top-header behavior needed by the shared shell.
- `src/components/chat/chat-input.tsx` and other fixed-bottom consumers reached by the Personal Plan shell — use shared nav clearance in addition to `safe-area-inset-bottom`, preventing the composer, toasts, sheets, or content from colliding with navigation.
- `src/lib/auth/route-classification.ts`, `src/lib/auth/unauthenticated-redirect.ts`, and `src/lib/auth/intake-state.ts` — register `/anwendung` and `/api/personal-plan/application` only if such an API is later introduced. V1 registers `/anwendung` in all three route guards.

### Tests and launch evidence

- `tests/personal-plan-stage5-contracts.test.ts`
- `tests/personal-plan-stage5-guidance-resolver.test.ts`
- `tests/personal-plan-stage5-compiler.test.ts`
- `tests/personal-plan-stage5-repository.test.ts`
- `tests/personal-plan-stage5-route.test.tsx`
- `tests/personal-plan-stage5-navigation.test.tsx`
- `tests/personal-plan-stage5-german-copy.test.ts`
- `tests/personal-plan-stage5.spec.ts`
- extend `tests/agent-v2-german-orthography.spec.ts` with the new customer-facing guidance source files rather than creating a disconnected orthography allowlist.
- `scripts/personal-plan/audit-application-guidance.ts` — read-only launch audit over products executable in the initial Personal Plan portfolio.
- add `test:playwright:personal-plan-stage5` and include it explicitly in `test:contracts` rather than relying on an undocumented manual command.

## 6. Designed user journey

### Actor and entry condition

The actor is an authenticated Personal Plan customer. Stage 4 has an explicitly accepted active Routine version. That version may contain owned executable products, planned products, products in review, excluded roles, and honest gaps; Stage 5 uses only its owned executable items.

### Personal Plan navigation and entry

1. The authenticated Personal Plan shell shows `Chat`, `Routine`, `Anwendung`, and `Profil` in the bottom navigation on mobile and desktop. `Anwendung` has an active state on `/anwendung` and its day-detail state.
2. Selecting `Anwendung` opens the overview. No date or “today” is selected and no event is recorded.
3. The overview title is `Anwendung`, followed by the single purpose line `Wähle den passenden Tag und folge der Reihenfolge.`
4. The server compiles the accepted Routine against the latest active guidance protocols and shows only complete relevant days, in canonical order. The reviewed representative overview contains Waschtag, Bond-Repair-Tag, Auffrisch-Tag, Pflegetag ohne Wäsche, Styling-Tag, and Pausentag; another user may legitimately receive a different subset.

### Reading a day

1. The user selects a day card.
2. The day opens with `Alle Tage`, its German name, and the resolved cadence/trigger.
3. The outer sequence immediately shows the next physical action or product.
4. For a product step, the card names the exact owned product and purpose. Nested numbered actions explain amount, format-aware application, area, distribution, wait/rinse, and the next required product state.
5. Necessary non-product actions remain visible between product cards.
6. A multi-role product appears once with a short coverage note. The user is never asked to remember that two category labels refer to the same physical application.
7. The user may return to `Alle Tage` or switch tabs. Reading or leaving changes no server state.

### Important day variants

- **Waschtag:** water → Shampoo → Conditioner/allowed rinse-off care → towel-dry → Leave-in/heat protection → drying/styling → dry finish. Standard cleansing is one pass.
- **Intensiv-Pflegetag:** Shampoo → water-state transition → exact Mask → exact rinse/Conditioner relationship → post-wash block.
- **Bond-Repair-Tag:** exact Bondbuilder protocol owns surrounding Conditioner, wait, rinse, and later-care rules. K18, for example, explicitly shows no Conditioner, towel-dry, 1–3 pumps, four minutes, no rinse, and later care only after waiting.
- **Klär-Waschtag:** reset cleanser replaces Shampoo, remains one pass, and is followed by compatible care.
- **Auffrisch-Tag:** root refresh and reshaping lengths are independent; only the applicable product/format actions appear.
- **Pflegetag ohne Wäsche:** hair remains dry; only products explicitly permitted for dry between-wash care appear.
- **Styling-Tag:** the standalone composable block applies the correct hair state, protection, product/tool order, any exact reapplication, and dry finish.
- **Pausentag:** `An einem Pausentag ist keine Anwendung nötig`; the user is not told to catch up and no specific date is implied.

### Loading, unavailable, and incomplete states

- **Loading:** show the stable page/navigation shell and restrained content skeleton; do not flash legacy Routine or the full canonical day list.
- **No active Stage-4 Routine:** show `Bestätige zuerst deine Routine`, explain that instructions come from confirmed products, and link to Routine. Planned or pending products are not previewed as steps.
- **One incomplete day:** omit that entire day. Other complete days remain available. Never render a half-executable recipe.
- **Active Routine but no complete product day:** show `Noch keine vollständige Anleitung verfügbar`, retain `Pausentag`, explain that the Routine remains unchanged, and link to Routine for the unresolved products. This is not a completion blocker or a tracking state.
- **Protocol/product mismatch:** fail the affected day closed and log a structured server error without exposing internal keys or unsafe fallback copy.
- **Load failure:** show `Anwendung gerade nicht verfügbar`, state that the Routine is unchanged, and offer `Erneut laden`.
- **Feature gate disabled:** with `PERSONAL_PLAN_STAGE5_ROLLOUT=off`, keep the active Routine available, remove the Personal Plan Anwendung destination, and return a compact unavailable state for a direct bookmarked route. `internal` enables only internal/admin Personal Plan owners; `all` enables every eligible owner. No data rollback is required because V1 stores no user Stage-5 activity.
- **Unauthenticated or foreign plan source:** normal auth handling redirects/denies before any Routine or guidance data is returned.

### Completion state

There is no day-completion state. The experience is complete when the user can read the relevant instructions and leave. Returning recompiles from the same active Routine and latest verified guidance. Nothing is marked done and nothing needs to be reset.

## 7. Planning evidence

### Approved final artifact

`plans/mockups/2026-08-08-personal-plan-stage5-complete-application-flow.html`

**Questions answered:**

- Can Stage 5 work as a first-class tab without calendar or tracking behavior?
- Does a product-led sequence make the “what do I grab next?” mental model easier to remember than phase-led cards, a wizard, or a progress rail?
- Can productless state changes remain visible without competing with products?
- Can the same hierarchy support all canonical days and the key recovery states on mobile and desktop?

**Selected direction:** compact overview → one selected recipe → large product blocks with nested microsteps → quiet productless connectors → optional composable Styling block.

**Feedback incorporated:**

- own bottom-navigation tab named `Anwendung`;
- overview first; no calendar;
- product, not phase, owns the large section;
- real physical grab order;
- productless actions remain first-class;
- selected coloured product-block variant;
- substantially reduced page-top copy and removal of pills/subheaders;
- all visible copy German;
- `Abschlusspflege` instead of mixed-language `Finish`;
- overview cards and `Alle Tage` navigation are interactive;
- separate refresh, care-without-wash, styling, and rest days;
- not-ready and retry states.

**Evidence-review status:** confirmed by Nick on 2026-08-08: `looks good - lock this design into the plan pls`.

**Artifact verification:** all 11 states were checked on mobile and desktop (22 state/viewport combinations), exactly one state remained active, overview/back interactions worked, and no horizontal overflow, console error, or page error occurred.

**Authority boundary:** information hierarchy, step ownership, navigation placement, visible density, state behavior, and German copy direction are authoritative. Production reuses the existing Chaarlie design tokens, focus states, product imagery, and accessibility primitives rather than copying artifact CSS literally.

**Designed-user-journey sign-off:** confirmed by Nick on 2026-08-08 after the post-counterpart walkthrough.

### Compared artifacts

- `plans/mockups/2026-08-08-personal-plan-stage5-step-patterns.html` — five responsive process patterns. Research established that Stage 5 is an instructional reference, not a wizard/progress tracker.
- `plans/mockups/2026-08-08-personal-plan-stage5-product-led-wash-patterns.html` — four product-led variants. Nick selected the coloured product-block direction and requested a quieter top area.
- `plans/mockups/2026-08-07-personal-plan-stage5-application-flow.html` — initial overview and recipe hierarchy; superseded by the final artifact but retained as decision history.

## 8. Ordered implementation tasks

### Task 0 — integrate and freeze prerequisite contracts

**Consumes:** reviewed Stage-1–3 Milestone-B persistence and the Stage-4 production implementation/active-version contract.

**Work:**

- integrate only clean reviewed commits; do not copy adjacent dirty worktrees;
- confirm one canonical Personal Plan category/role/order vocabulary;
- confirm `PersonalPlanRoutineVersionV1`, `executable`, exact product ID, immutable `refinedVersionId`, and owner-scoped active-version loading exist as reviewed production seams;
- compare the integrated migration result with the linked Supabase schema and freeze exactly one catalog-fact adapter; do not revive columns removed by later migrations;
- preserve legacy `/routine`, `/tracker`, `user_product_usage`, and legacy navigation behavior;
- record the exact prerequisite commit SHAs in this plan before Task 1 starts.

**Produces:** frozen imports and an implementation gate receipt.

**Completion criterion:** a reviewed prerequisite commit exists and a test can load an owner-scoped active Routine with one multi-role product and reject a foreign/unaccepted version. Today no such Stage-4 commit exists. Nick explicitly authorized contract-independent Stage-5 work to proceed in a fresh worktree on 2026-08-08 for later consolidation. The real Stage-4 adapter, shared entitlement shell wiring, migration ordering, end-to-end tests, and any rollout/activation remain stopped until this criterion passes; Stage 5 must not invent substitute persistence.

**Task-0 audit receipt — 2026-08-08:**

- `main`, `origin/main`, and `codex/personal-plan-stage4-routine` resolve to `de93e93a`; the Stage-4 worktree contains planning evidence only and no committed implementation.
- No committed `PersonalPlanRoutineVersionV1`, immutable refined-version persistence, durable Stage-3 portfolio/item persistence, accepted active-Routine pointer, or owner-scoped Stage-4 repository exists on the inspected clean refs.
- Stage 3 remains Labs-gated and fixture-backed with in-memory maps and synthetic IDs. The current `/routine` route still loads mutable legacy `user_product_usage` data.
- `user_product_usage` remains a one-product-per-user/category legacy model and cannot represent the required multi-product semantic roles or substitute for the accepted Routine contract.
- No clean adjacent branch supplies the missing contract, and no two-user RLS/foreign-owner/immutability test suite exists for it.
- Two independent read-only explorer passes returned `BLOCKED`, so the first implementation attempt stopped before writers were assigned. Nick then authorized isolated parallel implementation in `codex/personal-plan-stage5-application`; its workers own only contract-independent Stage-5 slices and must leave the real Stage-4 source adapter unconnected.

**Consolidation unblock condition:** land reviewed production commits for immutable owner-scoped refined versions, durable Stage-3 portfolios/items with semantic roles and exact catalog IDs, atomic Stage-3 completion/freezing, immutable Stage-4 proposal/version persistence with an accepted active pointer, an owner-scoped resolver, and RLS/foreign-owner/immutability tests. Record those exact commit SHAs here, rerun Task 0, then consolidate the isolated Stage-5 work and replace its normalized input port with the real server-owned adapter before end-to-end verification.

**Isolated implementation checkpoint — 2026-08-08:**

- Created fresh worktree `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-stage5-application` on `codex/personal-plan-stage5-application`, based on `origin/main` at `de93e93a`.
- Implemented the canonical day/protocol contracts, catalog-fact adapter, exact-over-family resolver, fail-closed deterministic compiler, versioned server-read-only content migration/repository, rollout and auth boundaries, product-led UI, recovery states, four-tab Personal Plan shell primitives, and focused tests.
- The production `/anwendung` route deliberately renders a compact disabled/not-ready state and hides its navigation item until the real owner-scoped accepted-Routine adapter is available. It contains no fixture product path and does not read `user_product_usage`.
- The real Stage-4 loader, entitlement-driven shell integration across Chat/Routine/Profile, launch-portfolio protocol audit, migration ordering, end-to-end owner/foreign-owner tests, and rollout activation remain consolidation work. No production database migration, flag activation, commit, push, or deployment occurred.
- Local proof: Stage-5/auth/routing suite `87/87`, German orthography `3/3`, TypeScript, ESLint, diff/format checks, and Next.js production build passed. The exact UI components were rendered at 390 px and 1440 px through a temporary local preview that was removed afterward; overview and product-led detail matched the approved hierarchy. Local Postgres migration/RLS execution remains unverified because Docker/local Supabase is unavailable in the worktree environment.

**Integrated implementation checkpoint — 2026-08-08:**

- Consolidated the isolated Stage-5 source onto reviewed Stage-4 commit `43059081957e2ec698d57790839c7710d492aeb6`; the earlier Task-0 audit remains historical context rather than the current integration state.
- `/anwendung` now authenticates, resolves the owner-scoped accepted active Routine, bulk-revalidates its executable owned catalog products, loads the immutable refined profile referenced by that Routine version, and compiles only complete guidance. It never reads legacy `user_product_usage`.
- Exact guidance fails closed for targeted Shampoo, every Heat-protection occurrence, Mask sequencing/contact time, pre-wash Oil, between-wash Leave-in/Oil, Bondbuilder, and Scalp Care. Missing launch protocols suppress the affected block/day instead of weakening the rule.
- Stage 4 `Header` remains the single navigation authority. While rollout is off, it does not expose an Anwendung link. Direct day URLs and `Alle Tage` are non-persistent; no-active-Routine and no-complete-day states route back to Routine.
- The compiler merges compatible multi-role uses of one physical product, keeps explicitly separate heat reapplications separate, and fails an affected day closed when exact guidance or Conditioner sequencing conflicts. Runtime inputs must contain all eight canonical day definitions.
- Operational failures are reported with privacy-safe stable IDs, duration, and a typed reason only; product names, instructions, and profile payloads never enter telemetry.
- The production-shaped database transition applies all Stage 1–5 migrations and passes `185/185` pgTAP assertions. Focused Stage-5 tests pass `99/99`, the full Personal Plan suite passes `703/703`, Stage-4 browser regression passes `1/1`, and the authenticated Stage-5 browser journey passes `2/2` at 320, 390, and 1440 px. TypeScript, lint with zero errors, diff hygiene, and the flags-off production build pass.
- Cadence remains intentionally hidden rather than displaying an internal `displayKey`: the accepted Routine contract does not yet provide an approved customer-facing German cadence value. Adding that typed handoff is a documented follow-up before cadence appears in the UI.
- The application remains off by default. Broader activation is still blocked on reviewed exact guidance/catalog coverage for every executable product/role in the enabled cohort; this implementation deliberately does not invent or backfill those product facts.

### Task 1 — add application contracts and fixture matrix test-first

**Consumes:** Task-0 category/role/Routine/profile contracts and the application/day taxonomy in section 4.

**Work:**

- implement Zod schemas and typed vocabularies;
- implement the catalog-fact adapter over the final live/local schema and preserve provenance for each resolved fact;
- create fixtures for all eight day types, all application families, format-aware Leave-in and Dry Shampoo, standard one-pass Shampoo/reset, targeted treatment optional sequence, K18, HeatBounce, exact Scalp Care, multi-role deduplication, separate heat-event reapplication, and missing-guidance suppression;
- encode the German-writing and honest-amount rules as testable renderer constraints;
- add no UI or database write yet.

**Produces:** `ApplicationGuidanceProtocolV1`, `CompiledApplicationDayV1`, canonical fixture builders, and failing compiler/resolver tests.

**Completion criterion:** schemas reject unknown keys, invalid scope/product combinations, nonpositive versions, unresolved visible template variables, and mixed-language internal placeholders.

### Task 2 — create and secure versioned canonical content

**Consumes:** Task-1 Zod payload and exact version-1 seeds.

**Work:**

- create the migration with `supabase migration new`;
- add the two content tables, constraints, indexes, RLS, revokes/grants, and eight day-type seeds at version 1;
- seed the reusable family baselines and representative exact protocols required by the initial fixture portfolio, all at `protocol_version = 1` and without copying catalog-owned facts into protocol payloads;
- reconcile the five existing Bondbuilder usage protocols into the version-1 rows and add a compatibility-drift test for the legacy compact hints;
- store source references and verification timestamps inside each payload;
- use indexed scalar lookup columns; do not add speculative JSON indexes or privileged public functions;
- parse the seed rows through the same runtime schema in migration/repository tests.

**Produces:** one reviewable migration and server-only versioned content source.

**Completion criterion:** `PUBLIC`/anon/authenticated direct reads and writes fail; service-role access is read-only; server reads return exactly one active row per key; a second active version for the same key is rejected; active content cannot be updated/deleted in place; all active payloads parse.

### Task 3 — implement guidance resolution and day compilation test-first

**Consumes:** Task-1 contracts/fixtures and Task-2 rows.

**Work:**

- implement exact-product > family resolution and exact-only completeness checks;
- resolve existing catalog facts plus protocol-only facts, format actions, known profile inputs, and honest amount text without hypothetical user branches;
- require an exact protocol to disambiguate the existing `foam_or_liquid` Dry-Shampoo value into `foam` or `liquid_to_dry`;
- compile every canonical day from executable items;
- insert typed productless state transitions;
- topologically order anchors, reject cycles, deduplicate shared application instances, and preserve true reapplications;
- suppress incomplete days and retain `Pausentag`;
- return structured internal failure reasons for diagnostics without user-facing leakage.

**Produces:** pure `compileApplicationView()` and one focused guidance resolver; ordering/deduplication stay internal to the compiler unless implementation evidence shows independent reuse.

**Completion criterion:** the complete fixture matrix produces the approved product order and copy invariants; repeated compilation with identical Routine/profile/protocol inputs is deep-equal; shuffled input rows do not change output.

### Task 4 — add the owner-scoped server resolver and recovery mapping

**Consumes:** Task-0 active Routine/profile loaders and Task-3 compiler.

**Work:**

- authenticate, resolve the Personal Plan owner, and load the accepted active Routine plus its immutable refined profile;
- load only active day definitions/protocols through the server repository;
- map no active version, zero complete product days, protocol mismatch, and load errors to typed page states;
- implement retry as `router.refresh()` without adding an API;
- use request-level `cache()`/memoization for shared owner/Routine/profile reads and one bulk protocol/day query—no per-product query;
- measure the pure compiler over a 20-product fixture (target under 10 ms locally) and record loader query count/duration; if the server loader exceeds four post-auth database round trips or 500 ms p95 in the internal cohort, add a short server cache keyed by active protocol/day version set before broader activation;
- add Sentry-backed structured operational logging through `src/lib/observability/`, with IDs/versions and duration but no application-read or completion analytics.

**Produces:** `loadApplicationView()` or equivalent server-owned view.

**Completion criterion:** auth, foreign-owner, no-active-Routine, active-success, partial-guidance, zero-complete-day, and database-error tests pass without returning untrusted source JSON.

### Task 5 — add the Personal Plan bottom navigation without changing legacy navigation

**Consumes:** Task-0 plan/entitlement resolver and the approved four-tab shell.

**Work:**

- build one accessible Personal Plan navigation component for mobile and desktop;
- expose `Chat`, `Routine`, `Anwendung`, `Profil`, with exact active-route behavior and bottom safe-area spacing;
- introduce the explicit shared Personal Plan shell at the current independent Header call sites used by Chat, Routine, Profile, and Anwendung;
- select it only for authenticated Personal Plan users through a request-memoized cheap plan/rollout read; do not perform Routine/application compilation in the shell;
- make the Chat composer and every reachable fixed-bottom element consume shared navigation clearance plus the device safe area;
- keep the existing Header navigation, `/tracker`, and all legacy routes unchanged for users without a Personal Plan;
- ensure the navigation does not cover content, toasts, drawers, or keyboard focus targets.

**Produces:** reusable Personal Plan shell navigation and route tests.

**Completion criterion:** all four destinations are keyboard/touch accessible at 44px minimum targets, active state is not colour-only, Personal Plan users see Anwendung without content/composer/toast/sheet overlap at 320–430px widths, and legacy users retain the exact prior nav set.

### Task 6 — build the approved Anwendung overview and product-led recipe

**Consumes:** Task-4 view states and Task-5 shell.

**Work:**

- render the compact overview with only compiled days;
- implement route-safe selection/back behavior and direct bookmarked day handling without persisting a selected day;
- render product blocks, nested actions, coverage notes, and productless connectors with semantic ordered lists;
- implement responsive mobile/desktop density from the mockup using production design tokens;
- implement loading, no-active-Routine, zero-complete-day, retry, and feature-disabled states;
- provide visible focus, screen-reader product/action structure, reduced-motion safety, and no completion semantics.

**Produces:** `/anwendung` and the complete reviewed UI.

**Completion criterion:** browser tests reproduce the approved hierarchy for every canonical day/recovery fixture; no tracker/calendar/completion control or mutation request exists in the rendered route.

### Task 7 — complete launch guidance coverage and fail-closed audit

**Consumes:** the initial production-ready Stage-3/4 portfolio set and Task-2 protocol store.

**Work:**

- run the read-only audit over every product/role that can be `executable: true` in the launch cohort;
- classify each as safe family inheritance, complete exact protocol, or launch blocker;
- add reviewed product protocols/backfills as version 1 without weakening exact-guidance requirements;
- verify source links, checked dates, German copy, format, hair state, amount honesty, contact/rinse/sequence, and day compatibility;
- retain incomplete products as non-executable Stage-5 gaps; never synthesize missing directions from product marketing text.

**Produces:** zero-blocker launch audit for the enabled cohort and an explicit deferred-product list.

**Completion criterion:** every enabled product/role resolves completely or is deliberately excluded from Stage-5 execution; the audit exits nonzero on a future regression.

### Task 8 — integrated verification and review-ready handoff

**Consumes:** Tasks 0–7.

**Work:**

- run focused unit, repository, route, nav, German-copy, and Playwright suites;
- run migration reset/apply tests, RLS owner/anon/foreign checks, schema validation, and Supabase security/performance advisors;
- run legacy Routine/Header/Tracker regressions;
- verify mobile/desktop overview, every day type, long product name, long instructions, no-active-Routine, zero-complete-day, retry, direct URL, and keyboard/screen-reader semantics;
- run `typecheck`, lint, formatting/diff checks, and production build;
- invoke `ready-check` and `request-code-review` through `implementation-loop` before any ship authorization.

**Produces:** review-ready branch receipt with exact commands/results and retained planning evidence.

**Completion criterion:** every designed-journey acceptance check passes, no high-severity advisor/review finding remains, and the feature gate stays off until publication/activation is separately authorized.

## 9. Verification

### Automated checks

- contract parsing for all day/family/protocol payloads;
- guidance precedence and exact-only fail-closed behavior;
- amount, format, profile-resolution, and German-copy invariants;
- day eligibility, canonical order, accepted product roles, and dedicated-day substitution;
- productless connector insertion;
- topological order/cycle failure;
- multi-role deduplication and separate-event reapplication;
- deterministic compilation under shuffled inputs;
- owner/auth/foreign/active-version server resolution;
- navigation entitlement and legacy parity;
- no mutation endpoint/method in Stage-5 UI code;
- protocol activation uniqueness and seed-schema parsing.

### Compiler fixture matrix

At minimum:

1. standard Waschtag with Shampoo, Conditioner, Leave-in + heat protection, blow-dry, and Oil finish;
2. multi-role Leave-in appears once;
3. targeted treatment Shampoo exact optional sequence; missing exact time suppresses the day;
4. reset cleanser replaces regular Shampoo and remains one pass;
5. Mask replaces/permits/follows Conditioner according to three exact relationships;
6. K18 exact timed leave-in and no-Conditioner sequence;
7. pre-Shampoo Bondbuilder booster + treatment sequence;
8. aerosol, foam, and powder Dry Shampoo do not share physical actions;
9. refresh with root only, lengths only, and both;
10. dry-care day with verified Leave-in/Oil and rejection of unverified between-wash use;
11. HeatBounce blow-dry plus separate hot-tool reapplication;
12. Styling day with no eligible product is absent;
13. Scalp safety pause suppresses the exact step/day without adding medical copy;
14. incomplete one day does not hide unrelated complete days;
15. active Routine with no complete product day retains Pausentag and recovery copy.

### Migration, RLS, and live-state checks

- apply from a clean local database using the generated migration;
- verify PK/FK/check/partial-unique constraints and expected indexes;
- verify `anon` and direct `authenticated` access are revoked/denied;
- verify server resolver cannot load foreign Routine versions;
- verify an inactive/draft/retired protocol is never selected;
- run Supabase security and performance advisors after DDL;
- inspect Data API exposure/grants explicitly because new-table defaults may vary;
- do not apply the migration to production, enable the flag, or backfill live products without separate publication/activation authority.

### Manual/browser checks

- mobile widths 320, 375/390, and 430; representative tablet and desktop;
- overview subset, every day detail, and `Alle Tage` return;
- four-tab bottom navigation and active state on mobile/desktop;
- long German product names and four-to-seven microsteps;
- visible order can be understood without colour;
- keyboard order, focus visibility, semantic list announcements, and 200% zoom;
- bottom safe area and no content hidden behind navigation;
- loading does not flash wrong days;
- no-active-Routine, zero-complete-day, unavailable/retry, and feature-disabled states;
- reading, switching, refreshing, and leaving create no day/completion/calendar state.

### Evidence-sensitive review

- hair-care reviewer checks every exact-product version-1 protocol against its stored source;
- copy review confirms direct German instructions, no hypothetical known-profile branches, no invented precision, and no mixed-language sentences;
- visual comparison confirms the approved product-block hierarchy and reduced top density;
- legacy review confirms non-Personal-Plan users retain Header/Tagebuch behavior.

## 10. Rollout, risks, and recovery

### Rollout

1. merge schema/compiler/UI behind a server-owned Personal Plan Stage-5 feature gate;
2. run the launch-guidance audit against the enabled internal cohort;
3. verify an authenticated internal Personal Plan end to end from accepted Stage 4 into Anwendung;
4. activate separately for a bounded cohort only after Stage-1–4 production prerequisites, protocol coverage, advisors, and review gates pass;
5. broader activation is a separate decision. No calendar/tracking capability is activated implicitly.

### Primary risks and mitigations

- **Unsafe generic fallback:** exact-required families fail closed and the complete day is suppressed.
- **Instruction drift:** active protocols are immutable versioned rows; new guidance activates as a successor version, never an in-place rewrite.
- **Routine/profile mismatch:** Stage 5 loads the refined version referenced by the active Routine, not an unrelated live profile snapshot.
- **Duplicate or missing product application:** application-instance deduplication and separate-event fixtures cover both directions.
- **Ordering cycle:** typed anchors are topologically checked; the affected day fails closed.
- **Sparse styling catalog:** styling remains a composable block and standalone day appears only when complete; no empty placeholder block.
- **Navigation regression:** Personal Plan shell selection is entitlement-scoped and legacy nav has explicit regression tests.
- **Content-store exposure:** RLS + revoked client grants + server-only reads; no public privileged function.
- **False amount precision:** schema/copy tests prevent unsupported numeric quantities.
- **Stage-4 prerequisite drift:** Task 0 records exact reviewed inputs and stops rather than adapting to fixtures.

### Recovery

- disable the Stage-5 feature gate to remove the destination and return a compact unavailable state for direct routes;
- retain guidance tables and versions; no user activity data needs rollback;
- retire an incorrect protocol and activate a corrected successor version; never update an active version in place;
- if a protocol correction cannot be verified immediately, retire it so affected days disappear rather than serving unsafe instructions;
- Routine and all legacy surfaces remain usable during a Stage-5 rollback.

## 11. Review and handoff

### Planning gates

- Branch/worktree gate: passed; durable artifacts live in `codex/personal-plan-five-stage-journey`.
- Evidence review: confirmed on the final interactive mockup.
- Counterpart plan review: completed read-only with Claude Opus at high effort on 2026-08-08.
- Findings reconciliation: completed; implementation defects were incorporated, scope-reducing proposals that contradicted confirmed product decisions were rejected, and one false repository-workflow claim was verified and rejected.
- Final designed-user-journey walkthrough/sign-off: confirmed by Nick on 2026-08-08.

### Implementation and publication gates

- Implementation begins only through `implementation-loop` after final journey sign-off and Task-0 prerequisites are reviewed production contracts.
- `ready-check` and `request-code-review` are implementation-loop gates.
- Commit/push/draft PR requires explicit `ship it` authorization.
- Merge, Supabase production migration, feature activation, deployment, and customer rollout are separate states and authorizations.

### Artifact disposition

- **Commit:** this implementation plan; the final complete mockup; the two comparison mockups; representative retained screenshots already present under `plans/mockups/` when tracked by repository policy.
- **Archive or retain as decision history:** the initial Stage-5 overview mockup.
- **Discard:** transient local server output, browser traces, and any counterpart-review scratch file unless Nick explicitly asks to retain it.

### Stop point

After counterpart findings are reconciled, present section 6 as the final user journey. Do not implement until Nick explicitly confirms that walkthrough.

## 12. Findings ledger

| ID    | Type      | Evidence                                                                                                              | Decision | Plan change                                                                                                                     | Revalidation                                                                                   |
| ----- | --------- | --------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| S5-01 | Defect    | `/anwendung` was absent from the three current authenticated-route registries.                                        | Accepted | Added every registry to the target map and Task 5 acceptance scope.                                                             | Route tests cover authenticated, unauthenticated, intake, and foreign-source behavior.         |
| S5-02 | Defect    | Existing `product_*_specs` already own format, application mode, treatment mode, timing, and similar product facts.   | Accepted | Added a provenance-preserving catalog-fact adapter; protocol payloads own only missing facts and resolved German instructions.  | Seed/schema tests reject copied or conflicting catalog facts.                                  |
| S5-03 | Defect    | The existing Dry-Shampoo enum uses the coarse value `foam_or_liquid`, which cannot select one physical action safely. | Accepted | Require an exact protocol to resolve it to foam or liquid-to-dry; future paste/balm formats are exact-only.                     | Resolver fixtures cover aerosol, powder, foam, liquid-to-dry, and unresolved coarse values.    |
| S5-04 | Defect    | `src/lib/bondbuilder/usage-protocols.ts` already contains compact sequencing rules.                                   | Accepted | The versioned protocol becomes the detailed authority and a drift test keeps the legacy compact hints compatible.               | Bondbuilder fixtures compare both authorities until the legacy seam is retired separately.     |
| S5-05 | Defect    | Independent Header call sites and fixed Chat controls make a new bottom tab vulnerable to overlap and drift.          | Accepted | Added one entitlement-scoped authenticated Personal Plan shell and shared bottom/safe-area clearance.                           | Mobile tests cover Chat composer, toasts, sheets, focus targets, and legacy navigation parity. |
| S5-06 | Defect    | The original feature-gate wording did not define states or eligibility.                                               | Accepted | Defined server-only rollout states `off`, `internal`, and `all`, plus exact direct-route behavior.                              | Rollout-state route and navigation tests are explicit.                                         |
| S5-07 | Defect    | Client grants and application-only immutability would leave canonical guidance insufficiently protected.              | Accepted | Revoke `PUBLIC`, `anon`, and `authenticated`; grant service-role `SELECT` only; enforce active-row retirement rules by trigger. | Migration tests cover denied roles, activation uniqueness, mutation rejection, and retirement. |
| S5-08 | Defect    | `Heute ist keine Anwendung nötig` implied a current-day/calendar model.                                               | Accepted | Replaced it with `An einem Pausentag ist keine Anwendung nötig` in the plan and approved mockup.                                | Copy search and browser-state checks cover the Pausentag state.                                |
| S5-09 | Defect    | Read-time compilation needed explicit query-count and latency constraints.                                            | Accepted | Added one bulk content query, request memoization, a compiler budget, internal-cohort measurement, and a bounded cache trigger. | Repository tests prevent per-product queries; internal rollout records duration/query count.   |
| S5-10 | Trade-off | Reviewer proposed reducing V1 to Waschtag and Pausentag.                                                              | Rejected | Retained the eight confirmed canonical day types; incomplete individual days already fail closed.                               | Full eight-day fixture matrix remains mandatory.                                               |
| S5-11 | Trade-off | Reviewer proposed removing database-backed canonical day definitions.                                                 | Rejected | Retained the requested canonical database, while code owns only typed composition rules and tests one-to-one coverage.          | Migration/compiler contract test detects missing, extra, or duplicate day definitions.         |
| S5-12 | Defect    | Reviewer stated that the implementation/review workflow skills were unavailable.                                      | Rejected | Repository-local skills and `AGENTS.md` confirm `implementation-loop`, `ready-check`, and `request-code-review` exist.          | No plan change; the existing project workflow remains authoritative.                           |
