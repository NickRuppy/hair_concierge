# Personal-Plan App (Journey v8) Implementation Plan

> **Superseded:** This draft is retained for provenance. The selected implementation plan is `plans/2026-08-02-personal-plan-app-implementation-v2.md`, which replaces the duplicated product/day/log tables and the `locked_plan`-first computation with a dedicated deterministic Personal Plan engine. Existing CareBalance/runtime rules may be inspected or extracted, but they are not the new plan's runtime authority.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Gates:** CLAUDE.md branch-gate MUST run before execution. Mockup review: **confirmed (v8, 2026-07-30)**. Designed-user-journey sign-off: **granted implicitly via v8 acceptance — re-confirm with Nick at the first review checkpoint before merging anything user-visible.**

**Goal:** Deliver the promise-fulfilling post-payment product for personal-plan buyers: a 10-screen locked onboarding (analysis → ideal plan → product reconciliation → habits → saved plan) followed by a three-tab app (Heute · Produkte · Fortschritt, Profil behind avatar).

**Architecture:** A new `src/lib/plan/` domain layer (pure, TDD) turns the already-computed `personal_plan_prepared_artifacts.locked_plan` + owned products + habits into one canonical persisted plan (`user_plans` + child tables). A new locked onboarding route `/plan-start` collects products/habits and finalizes the plan; three new app routes render it. Verdicts reuse the existing CareBalance engine; product search/intake reuse the existing catalog + review-queue flows.

**Tech Stack:** Next.js (app router), Supabase (Postgres + RLS), Tailwind with existing tokens in `src/app/globals.css`, Vitest for unit tests, Playwright for flow verification. No new dependencies.

**Visual source of truth:** `plans/mockups/2026-07-30-promise-product-journey.html` (v8). Screen numbers below (S1–S15) refer to it. Copy MUST be taken verbatim from that file unless a task says otherwise. All UI text German.

**Rendered references (look at these, don't just read CSS):** `plans/mockups/v8-screens/*.png` — pre-rendered screenshots of v8, sliced by stage: `01-…s1-s3`, `02-…s4-s7`, `03-…s8-s10`, `04-…s11-s15`. **Mandatory visual loop for every UI task:** (1) Read the matching PNG(s) with the Read tool BEFORE writing markup; (2) after implementing, screenshot your screen at 375px viewport (Playwright CLI or the repo's e2e tooling) and Read it side-by-side against the reference; (3) fix visible deviations (spacing, hierarchy, chip/badge styles, colors) before committing. The mockup HTML holds the exact CSS values (hex colors, radii, font sizes) — use it as the numeric source when the screenshot leaves doubt.

## Global Constraints

- Feature flag: `PERSONAL_PLAN_APP_V1_ENABLED === "true"` gates every new route and the redirect change; off = current behavior untouched.
- Rollout scope: `quiz_kind === "personal_plan"` buyers only. Legacy buyers keep `/onboarding` → `/chat`.
- Brand tokens only (globals.css): plum `#6b50a0` family, coral `#d4616a` (primary CTA only), bg `#FDFBF9`, border `#E6E2DD`; serif (`font-header`) only for page titles; **no emojis — Lucide icons**.
- Buttons: `quiz-btn-primary` style (coral, radius 12px, h-14, font-bold). Cards: radius 12px (plain) / 20px (routine cards).
- Onboarding screens (S1–S10): NO tab bar, NO header nav — only progress bar (sections `Analyse · Produkte · Alltag`).
- No purchase inside onboarding; shop links exist only on the Einkaufsliste segment of `/produkte`.
- Vocabulary: `hair_texture` = pattern, `thickness` = diameter. Frequency labels use `×` (e.g. `2–3×/Woche`).
- Supabase project `pqdkhefxsxkyeqelqegq`; new tables need RLS matching existing per-user tables (see `supabase/migrations/` for the pattern used by `tracking_days`).
- Verify with `npm run ci:verify` (typecheck + lint + build) before every commit batch; dev server restart before manual verification (hot reload serves stale deep-lib code).
- Worktree: `npm run worktree:new -- personal-plan-app` → branch `codex/personal-plan-app`.

## File Structure (locked-in decomposition)

```
supabase/migrations/<ts>_personal_plan_app.sql        Task 1
src/lib/plan/types.ts                                 Task 2
src/lib/plan/ideal-plan.ts                            Task 2
src/lib/plan/verdict.ts                               Task 3
src/lib/plan/day-types.ts                             Task 4
src/lib/plan/suggest-today.ts                         Task 5
src/lib/plan/checkins.ts                              Task 6
src/lib/plan/persistence.ts                           Task 7  (server-only supabase I/O)
src/app/api/plan/route.ts                             Task 7  (GET current plan)
src/app/api/plan/finalize/route.ts                    Task 7  (POST compile+save)
src/app/api/plan/log-day/route.ts                     Task 16
src/app/api/plan/shopping/route.ts                    Task 17 (PATCH bought)
src/app/api/plan/checkin/route.ts                     Task 18 (POST bilanz/day7)
src/app/plan-start/page.tsx                           Task 8  (server gate)
src/components/plan-onboarding/flow.tsx               Task 8  (state machine + progress bar)
src/components/plan-onboarding/screen-analyse.tsx     Task 9  (S1)
src/components/plan-onboarding/screen-idealplan.tsx   Task 9  (S2)
src/components/plan-onboarding/screen-transition.tsx  Task 9  (S3 + S8, parameterized)
src/components/plan-onboarding/screen-categories.tsx  Task 10 (S4)
src/components/plan-onboarding/screen-product-pick.tsx Task 10 (S5)
src/components/plan-onboarding/screen-overview.tsx    Task 11 (S6)
src/components/plan-onboarding/compare-sheet.tsx      Task 11 (S7)
src/components/plan-onboarding/screen-habits.tsx      Task 12 (S9 wrapper around existing onboarding screens)
src/components/plan-onboarding/screen-finished.tsx    Task 12 (S10)
src/components/plan-app/tab-bar.tsx                   Task 14
src/components/plan-app/app-shell.tsx                 Task 14 (header + avatar + tab bar)
src/app/heute/page.tsx                                Task 15 (S11)
src/app/heute/[dayType]/page.tsx                      Task 16 (S12 runbook)
src/components/plan-app/runbook.tsx                   Task 16 (accordion)
src/app/produkte/page.tsx                             Task 17 (S13)
src/app/fortschritt/page.tsx                          Task 18 (S14)
src/components/plan-app/progress-bars.tsx             Task 18
src/components/plan-app/bilanz-sheet.tsx              Task 18
src/lib/billing/checkout-success-redirect.ts          Task 13 (modify)
src/lib/supabase/middleware.ts                        Task 14 (modify: gate new routes)
src/lib/funnel/flags.ts                               Task 8  (modify: add flag)
tests under src/lib/plan/__tests__/                   Tasks 2–6
```

Existing code you will reuse (read before the task that names it):
- `src/lib/personal-plan-quiz/prepared-plan.ts:299-317` — `lockedPlan` builder (shape source).
- `src/lib/quiz/link-to-profile.ts` — how quiz answers land in `hair_profiles`.
- `src/lib/recommendation-engine/care-balance/` — verdict engine (used live by `GET /api/routine`).
- `src/components/routine/routine-card.tsx` + `routine-card-model.ts` — card visuals + status matrix.
- `src/components/onboarding/screens/heat-tools-screen.tsx`, `onboarding-flow.tsx:860-940` — habit questions to embed.
- `src/components/quiz/quiz-option-card.tsx` — option card component.
- `src/lib/product-intake/` — photo submission + review queue.
- `src/components/tracker/tracker-widgets.tsx` — 8-day strip pattern.
- `src/lib/tracking/api-handlers.ts` — day-log persistence pattern.

---

### Task 1: Database schema

**Files:**
- Create: `supabase/migrations/20260731T000000_personal_plan_app.sql`

**Interfaces:**
- Produces tables consumed by Task 7 persistence: `user_plans`, `plan_products`, `plan_day_types`, `plan_day_logs`, `plan_checkins`.

- [ ] **Step 1: Write the migration**

```sql
create table user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references leads(id),
  status text not null default 'onboarding' check (status in ('onboarding','active')),
  dimensions jsonb not null default '[]',
  -- [{ "key":"kopfhaut_balance", "label":"Kopfhaut-Balance", "start":4, "current":4 }]
  habits jsonb not null default '{}',
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique (user_id)
);

create table plan_products (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references user_plans(id) on delete cascade,
  role_key text not null,            -- 'shampoo','conditioner','leave_in','styling','clarifying','mask'
  role_label text not null,          -- 'Shampoo', 'Conditioner', ...
  position int not null,
  product_id uuid references products(id),
  product_name text not null,
  source text not null check (source in ('ideal','owned','alternative','pending_review')),
  status text not null check (status in ('active','shopping','in_review')),
  cadence_key text not null,         -- reuse frequency keys from src/lib/vocabulary/frequencies.ts
  cadence_label text not null,
  reason text not null default '',
  bought_at timestamptz,
  unique (plan_id, role_key)
);

create table plan_day_types (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references user_plans(id) on delete cascade,
  day_key text not null check (day_key in ('wash','intensive_care_wash','refresh','clarifying_wash','rest')),
  title text not null,
  cadence_label text not null,
  minutes int not null,
  steps jsonb not null default '[]',
  -- step: { "position":1, "roleKey":"shampoo", "roleLabel":"Reinigen", "productName":"...",
  --   "ownership":"owned"|"recommended"|"shopping",
  --   "phases":[{"verb":"Verteilen","duration":"20 Sek.","detail":"Haselnussgroß auf die nasse Kopfhaut."}, ...] }
  unique (plan_id, day_key)
);

create table plan_day_logs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references user_plans(id) on delete cascade,
  log_date date not null,
  day_key text not null,
  adjustments jsonb not null default '[]',  -- ["skipped:leave_in"]
  created_at timestamptz not null default now(),
  unique (plan_id, log_date)
);

create table plan_checkins (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references user_plans(id) on delete cascade,
  kind text not null check (kind in ('day7','bilanz')),
  due_at date not null,
  completed_at timestamptz,
  scores jsonb,   -- bilanz: [{ "key":"kopfhaut_balance", "value":6 }]
  answers jsonb   -- day7: { "fits": true, "notes": "..." }
);

alter table user_plans enable row level security;
alter table plan_products enable row level security;
alter table plan_day_types enable row level security;
alter table plan_day_logs enable row level security;
alter table plan_checkins enable row level security;

create policy "own plan" on user_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- child tables: join through user_plans
create policy "own plan products" on plan_products for all
  using (exists (select 1 from user_plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from user_plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "own plan day types" on plan_day_types for all
  using (exists (select 1 from user_plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from user_plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "own plan logs" on plan_day_logs for all
  using (exists (select 1 from user_plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from user_plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "own plan checkins" on plan_checkins for all
  using (exists (select 1 from user_plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from user_plans p where p.id = plan_id and p.user_id = auth.uid()));
```

- [ ] **Step 2: Check migration version uniqueness** — `ls supabase/migrations/ | sort | tail -5`; the new timestamp must sort last and collide with nothing (a duplicate-version incident happened before in this repo).
- [ ] **Step 3: Apply locally / typecheck** — run the project's migration flow (see `supabase/README` or existing npm scripts; if none, note in PR that migration is applied via Supabase MCP on deploy). Regenerate DB types if the repo does (`grep -r "database.types" src/lib/supabase` to find the types file and its generation command).
- [ ] **Step 4: Commit** — `git commit -m "feat(plan): schema for user plans, day types, logs, check-ins"`

---

### Task 2: Plan domain types + ideal plan builder

**Files:**
- Create: `src/lib/plan/types.ts`, `src/lib/plan/ideal-plan.ts`
- Test: `src/lib/plan/__tests__/ideal-plan.test.ts`

**Interfaces:**
- Consumes: the `locked_plan` JSON shape produced by `buildPreparedPlan` (read `src/lib/personal-plan-quiz/prepared-plan.ts:200-320` first; it contains named products per category, `routine.order`, `applicationGuidance`, `targetFrequency`).
- Produces:
  - `type PlanRoleKey = 'shampoo'|'conditioner'|'leave_in'|'styling'|'clarifying'|'mask'`
  - `interface IdealPlanEntry { roleKey: PlanRoleKey; roleLabel: string; position: number; productId: string|null; productName: string; reason: string; cadenceKey: string; cadenceLabel: string }`
  - `function buildIdealPlan(lockedPlan: LockedPlan, opts: { includeHeatProtection: boolean }): IdealPlanEntry[]`
  - `interface PlanDimension { key: string; label: string; start: number; current: number }`
  - `function deriveDimensions(artifact: PreparedArtifact): PlanDimension[]` — maps the artifact's per-dimension `todaySegments` (1–3) to a 0–10 scale: `start = todaySegments * 2 + baseOffset` where the exact mapping is `1→3, 2→5, 3→7` (documented constant `SEGMENT_TO_TEN = {1:3, 2:5, 3:7}`; granularity beyond this comes from future Bilanz answers, not fabricated precision). Labels: `Kopfhaut-Balance`, `Feuchtigkeit`, `Definition`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { buildIdealPlan, deriveDimensions } from "../ideal-plan";
import lockedPlanFixture from "./fixtures/locked-plan.json"; // copy a real one: select locked_plan from personal_plan_prepared_artifacts limit 1 (dev DB), anonymized

describe("buildIdealPlan", () => {
  it("returns one entry per role in routine order with names and cadences", () => {
    const plan = buildIdealPlan(lockedPlanFixture, { includeHeatProtection: false });
    expect(plan.map(p => p.roleKey)).toEqual(["shampoo","conditioner","leave_in","styling","clarifying","mask"]);
    expect(plan[0].productName).toBeTruthy();
    expect(plan[0].cadenceLabel).toMatch(/Woche|Wäsche|Bedarf/);
  });
  it("omits roles the locked plan does not contain", () => {
    const noMask = { ...lockedPlanFixture, products: lockedPlanFixture.products.filter((p: any) => p.category !== "mask") };
    expect(buildIdealPlan(noMask, { includeHeatProtection: false }).find(p => p.roleKey === "mask")).toBeUndefined();
  });
});

describe("deriveDimensions", () => {
  it("maps segments 1/2/3 to 3/5/7 and initializes current = start", () => {
    const dims = deriveDimensions({ todaySegments: { kopfhaut_balance: 2, feuchtigkeit: 1, definition: 3 } } as any);
    expect(dims).toEqual([
      { key: "kopfhaut_balance", label: "Kopfhaut-Balance", start: 5, current: 5 },
      { key: "feuchtigkeit", label: "Feuchtigkeit", start: 3, current: 3 },
      { key: "definition", label: "Definition", start: 7, current: 7 },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/lib/plan/__tests__/ideal-plan.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `types.ts` (the interfaces above) and `ideal-plan.ts`. IMPORTANT: read the real `locked_plan` shape first and write the fixture from a real row; if field names differ from this plan's assumption, adapt the implementation, not the DB.
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `feat(plan): ideal plan builder + dimension derivation from prepared artifact`

---

### Task 3: Verdict adapter over CareBalance

**Files:**
- Create: `src/lib/plan/verdict.ts`
- Test: `src/lib/plan/__tests__/verdict.test.ts`

**Interfaces:**
- Consumes: the CareBalance engine. Read `src/lib/routines/load-routine-artifact-data.ts` and `src/lib/recommendation-engine/care-balance/` to find the existing entry point that judges a product against a profile (the same call `GET /api/routine` uses to produce `verified_matches`/`verified_swap`).
- Produces:
  - `type PlanVerdict = 'fits' | 'swap' | 'in_review'`
  - `interface VerdictDetail { verdict: PlanVerdict; requirements: { label: string; owned: 'pass'|'partial'|'fail'; recommended: 'pass' }[]; fazit: string }`
  - `function judgeOwnedProduct(entry: IdealPlanEntry, ownedProduct: CatalogProduct | PendingProduct, profile: HairProfile): VerdictDetail`

Requirement labels come from the role's needs (3 per role, German, e.g. Shampoo: `Milde Reinigung`, `Leicht für feines Haar`, `Sensible Kopfhaut`). Fazit template: `"{ownedName} erfüllt {n} von {m} Anforderungen."` plus, when the engine flags a re-role opportunity (owned clarifying-capable shampoo while `clarifying` role is empty): fazit appends `" Als Klär-Shampoo ist es perfekt."` and the detail carries `reassignRole: 'clarifying'`.

- [ ] **Step 1: Failing tests** — three cases with fixture products: (a) owned product that passes all requirement checks → `fits`; (b) product failing ≥1 hard requirement → `swap` with matrix rows containing one `'fail'`; (c) `PendingProduct` (from intake) → `in_review` and empty requirements. Use real catalog rows as fixtures (query two products via Supabase MCP, anonymize nothing — they're public catalog data).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** as a thin adapter: call the engine, map its verdict kinds (`verified_matches → fits`, `verified_swap|verified_unnecessary|verified_more_freq → swap`) and build requirement rows from the engine's reasoning output; if the engine exposes no per-requirement granularity, derive the three rows from the role-needs table defined in this file (constant `ROLE_REQUIREMENTS: Record<PlanRoleKey, string[]>`) and mark them pass/fail from the engine's flags. Do NOT fork engine logic.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `feat(plan): verdict adapter mapping CareBalance to plan verdicts`

---

### Task 4: Day-type compiler

**Files:**
- Create: `src/lib/plan/day-types.ts`
- Test: `src/lib/plan/__tests__/day-types.test.ts`

**Interfaces:**
- Consumes: `IdealPlanEntry[]` finalized into `PlanProductRecord[]` (same fields + `source`, `status`), plus `habits: { heatStyling: 'often'|'sometimes'|'never'; drying: string; washFrequency: string }`.
- Produces:
  - `interface DayTypeStepPhase { verb: string; duration: string; detail: string }`
  - `interface DayTypeStep { position: number; roleKey: PlanRoleKey; roleLabel: string; productName: string; ownership: 'owned'|'recommended'|'shopping'; phases: DayTypeStepPhase[] }`
  - `interface DayType { dayKey: 'wash'|'intensive_care_wash'|'refresh'|'clarifying_wash'|'rest'; title: string; cadenceLabel: string; minutes: number; steps: DayTypeStep[] }`
  - `function compileDayTypes(products: PlanProductRecord[], habits: Habits): DayType[]`

Rules (all covered by tests):
1. `wash` = shampoo → conditioner → leave_in → styling (present roles only), title `Waschtag`.
2. `intensive_care_wash` exists iff mask present: oil/pre-step only if such a product exists, then shampoo → mask → leave_in → styling, cadence `jede 2. Wäsche`.
3. `refresh` = water + ½ leave_in + styling, cadence `bei Bedarf`.
4. `clarifying_wash` exists iff clarifying role filled, cadence from its cadence label.
5. `rest` ALWAYS present: title `Pausentag`, cadence `bewusst frei`, zero steps.
6. Phases per step come from the product's `recommendation_meta.usage_hint` when structured data exists, else from `DEFAULT_PHASES: Record<PlanRoleKey, DayTypeStepPhase[]>` — a constant in this file holding exactly the German phase copy from mockup S12 (Verteilen 20 Sek. „Haselnussgroß auf die nasse Kopfhaut." / Massieren 60 Sek. „Sanft mit den Fingerspitzen." / Ausspülen 30 Sek. „Bis das Wasser klar ist." — and the equivalents for conditioner, leave-in, styling, mask, clarifying, oil).
7. Heat styling `often` inserts a `heat_protection` styling step note; `never` = no change. Drying method `air` appends the towel technique detail to the last step (`Lufttrocknen — mit dem Shirt drücken, nicht rubbeln.`).
8. `minutes` = sum of parsable phase durations rounded to friendly values (18, 35, 5, 20).

- [ ] **Step 1: Write failing tests** for rules 1–5 and 8 (six `it` blocks; construct `PlanProductRecord[]` fixtures inline).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(plan): day-type compiler with default phase copy`

---

### Task 5: Today suggestion

**Files:**
- Create: `src/lib/plan/suggest-today.ts`
- Test: `src/lib/plan/__tests__/suggest-today.test.ts`

**Interfaces:**
- Produces: `function suggestToday(logs: { logDate: string; dayKey: string }[], today: string): { dayKey: DayType['dayKey']; reasonLine: string }`

Rules: days since last `wash|intensive_care_wash|clarifying_wash` ≥ 3 → suggest `wash` (alternate to `intensive_care_wash` when the last wash-class log was `wash` and a mask exists — pass day types in); 1–2 days → `refresh`; washed today/yesterday with no styling need → `rest`. `reasonLine` format: `Letzte Wäsche vor {n} Tagen · Rhythmus 2–3× pro Woche.` (rhythm text passed in as arg). Pure function of inputs — `today` is a parameter, never `Date.now()`.

- [ ] **Step 1: Failing tests** — four cases (3-day gap → wash; alternation → intensive; 1-day gap → refresh; same-day → rest).
- [ ] **Step 2–4:** Run FAIL → implement → PASS.
- [ ] **Step 5: Commit** — `feat(plan): today suggestion from day logs`

---

### Task 6: Check-in scheduling

**Files:**
- Create: `src/lib/plan/checkins.ts`
- Test: `src/lib/plan/__tests__/checkins.test.ts`

**Interfaces:**
- Produces: `function dueCheckin(plan: { finalizedAt: string }, completed: { kind: string; dueAt: string }[], today: string): { kind: 'day7'|'bilanz'; dueAt: string } | null` and `function nextBilanzDate(lastBilanz: string): string` (+1 month, clamped to month end).

Rules: day7 due at finalized+7d until completed; first bilanz at finalized+30d; thereafter monthly from last completed bilanz. Only ONE due check-in returned (day7 wins if both somehow open).

- [ ] **Steps 1–4:** failing tests (day7 due, day7 done → nothing until day 30, bilanz due, monthly rollover incl. Jan 31 → Feb 28) → implement → PASS.
- [ ] **Step 5: Commit** — `feat(plan): check-in scheduler (day 7 / 30 / monthly)`

---

### Task 7: Persistence + core API routes

**Files:**
- Create: `src/lib/plan/persistence.ts`, `src/app/api/plan/route.ts`, `src/app/api/plan/finalize/route.ts`

**Interfaces:**
- Consumes: Tasks 1–4, 6. Supabase server client pattern: copy from `src/lib/tracking/api-handlers.ts` (auth check → 401, entitlement via `hasCurrentAppAccess` → 403).
- Produces:
  - `getPlan(userId): Promise<FullPlan | null>` where `FullPlan = { plan: UserPlanRow; products: PlanProductRecord[]; dayTypes: DayType[]; logs: DayLog[]; dueCheckin: DueCheckin | null; shoppingCount: number }`
  - `POST /api/plan/finalize` body: `{ leadId: string; decisions: { roleKey: PlanRoleKey; choice: 'ideal'|'keep_owned'|'alternative'|'none'; ownedProductId?: string; ownedProductName?: string; pendingIntakeId?: string; reassignToRole?: PlanRoleKey }[]; habits: Habits }` → compiles (Tasks 2+4), writes `user_plans` (status `active`, `finalized_at`), `plan_products` (status: owned+fits → `active`; ideal not owned → `shopping`; pending → `in_review`), `plan_day_types`; seeds `plan_checkins` (day7 + first bilanz); fires PostHog `plan_finalized` and Customer.io event `plan_finalized` (follow the pattern in `src/lib/customerio/stripe-lifecycle.ts`).
  - `GET /api/plan` → `FullPlan` as JSON, 404 if none.

- [ ] **Step 1:** Implement `persistence.ts` (no unit tests — thin I/O; correctness covered by route test + Playwright later).
- [ ] **Step 2:** Implement both routes. Finalize must be idempotent: second call for same user upserts, not duplicates (the `unique(user_id)` + `unique(plan_id, role_key)` constraints back this).
- [ ] **Step 3:** `npm run ci:verify` → green.
- [ ] **Step 4: Commit** — `feat(plan): persistence + GET /api/plan + POST /api/plan/finalize`

---

### Task 8: Locked onboarding shell at /plan-start

**Files:**
- Create: `src/app/plan-start/page.tsx`, `src/components/plan-onboarding/flow.tsx`
- Modify: `src/lib/funnel/flags.ts` (add `isPersonalPlanAppEnabled()` reading `PERSONAL_PLAN_APP_V1_ENABLED`)

**Interfaces:**
- Consumes: server-side — auth session, `hasCurrentAppAccess`, lead with `quiz_kind='personal_plan'`, the prepared artifact (loader used by `/plan-bereit`: see `src/app/plan-bereit/readiness.ts`), `hair_profiles`.
- Produces for Tasks 9–12: `flow.tsx` exports `PlanOnboardingFlow` — client component holding `step` state over the ordered enum
  `['analyse','idealplan','transition_products','categories','product_pick','overview','habits_transition','habits','finished']`
  (product_pick iterates internally over selected categories; compare-sheet is an overlay on `overview`, not a step). Each screen gets `{ data, onNext, onBack }`. Progress bar: 6px track, plum gradient fill, widths per step `[12,24,32,42,56,72,82,100]`-style mapping; section labels row `Analyse · Produkte · Alltag` with the active one plum/bold. State persisted to `sessionStorage` key `plan-onboarding-v1` so refresh resumes.

- [ ] **Step 1:** Server page: flag off → `notFound()`; not authed → redirect `/auth?next=/plan-start`; no access → `/pricing`; no personal_plan lead → `/onboarding` (legacy fallback); loads artifact + profile, renders flow. NO `<Header/>` — bare screen with wordmark row only (copy the app-head pattern: brand bars + „Chaarlie").
- [ ] **Step 2:** Flow component with progress bar + step switching + sessionStorage resume; steps render placeholder `<div data-screen="analyse"/>` etc. for now (replaced by Tasks 9–12 — acceptable here because each named screen lands in a numbered later task in THIS plan).
- [ ] **Step 3:** Playwright smoke: `/plan-start` with flag on + seeded session shows the progress bar and section labels. Run `npx playwright test` if repo has a config, else verify manually via dev server and record in commit message.
- [ ] **Step 4: Commit** — `feat(plan): locked onboarding shell with progress bar at /plan-start`

---

### Task 9: Screens S1–S3 (Analyse, Idealplan, Übergang)

**Files:**
- Create: `screen-analyse.tsx`, `screen-idealplan.tsx`, `screen-transition.tsx` (in `src/components/plan-onboarding/`)

**Interfaces:**
- Consumes: `data.artifact.publicOfferModel` (focus areas + signals — same fields the offer page reads, see `src/components/personal-plan-offer/personal-plan-offer.tsx:213-290`), `buildIdealPlan` (Task 2).
- Produces: three screens wired into `flow.tsx` steps `analyse`, `idealplan`, `transition_products`.

Copy (verbatim from mockup v8):
- S1: hero overline `Deine Analyse`, headline `Dein Haar, gelesen aus {n} Antworten.`, profile chips from artifact profile line; three focus cards with `Erkannt:`/`Hilft:` bold-lead sentences; four signal tiles `Zugtest / Oberflächentest / Kopfhaut-Check / Produktabgleich`; CTA `Zu deinem Plan`.
- S2: overline `Dein Haarplan`, H1 (sans, `text-[23px] font-semibold`) `Dein Idealplan`, sub `Sechs Empfehlungen aus deiner Analyse.`; product cards MUST reuse the real `RoutineCard`-style markup: 88×100 tile with catalog image (fallback serif letter), status dot plum, uppercase category, title 15px semibold, frequency line with the 8-dot meter (reuse/extract the meter from `src/components/routine/routine-card.tsx:` frequency row — if not cleanly extractable, create `src/components/plan-app/freq-meter.tsx` and use it in both). CTA `Weiter`.
- S3 (parameterized `screen-transition.tsx` with `variant='products'|'habits'`): products variant — overline `Nächster Schritt`, serif headline `Das war unser Idealplan. Jetzt machen wir ihn zu deinem.`, body `Wir gleichen jede Kategorie mit den Produkten ab, die du schon benutzt. Was passt, bleibt.`, CTA `Meine Produkte abgleichen`. Habits variant — overline `Fast geschafft`, headline `Noch kurz zu deinem Alltag.`, body `Ein paar Gewohnheiten entscheiden über Reihenfolge und Häufigkeit — damit der Plan zu deinem Leben passt, nicht umgekehrt.`, CTA `Weiter`.

- [ ] **Step 1:** Implement all three; real catalog images via the same `<Image>` usage as `routine-card.tsx:32-80`.
- [ ] **Step 2:** Manual verification against mockup S1–S3 side by side (open both; dev server restarted).
- [ ] **Step 3:** `npm run ci:verify` → green. **Step 4: Commit** — `feat(plan): onboarding screens analyse, idealplan, transition`

---

### Task 10: Screens S4–S5 (categories, product pick)

**Files:**
- Create: `screen-categories.tsx`, `screen-product-pick.tsx`

**Interfaces:**
- Consumes: `QuizOptionCard` (`src/components/quiz/quiz-option-card.tsx`), catalog product search (find the API the chat product-drawer or onboarding drilldown uses — grep `search` under `src/app/api/products`), product intake submission (`src/lib/product-intake/`).
- Produces: flow state `ownedByRole: Record<PlanRoleKey, { productId?: string; productName: string; pendingIntakeId?: string } | null>`; `categories` step writes the selected role set, `product_pick` iterates them.

Copy: S4 headline (serif 28px) `Welche Produkte nutzt du aktuell?`, sub `Mehrfachauswahl möglich.`, options `Shampoo / Conditioner ∕ Spülung / Leave-in ∕ Pflege ohne Ausspülen / Stylingprodukte / Klärendes Shampoo / Haarmaske ∕ Kur` as multi-select QuizOptionCards (Lucide icons; selected = check badge), CTA `Weiter`. S5 per category: overline `{Rolle} · {i} von {n}`, headline `Welches {Rolle} nutzt du?`, sub `Wenn dein Produkt passt, bleibt es. Versprochen.`, search input (plum-light border), `Häufig genannt:` list (top catalog products of that category — order by an existing popularity field or fallback alphabetical, limit 3), escape chip `Weiß ich gerade nicht`, link `Nicht gefunden? Foto einreichen` opening the existing intake flow.

- [ ] **Step 1:** Implement S4 (pure client state). **Step 2:** Implement S5 with debounced search (300ms) against the catalog endpoint; selecting stores into `ownedByRole` and advances to the next chosen category; photo intake creates a pending submission and stores `pendingIntakeId`.
- [ ] **Step 3:** Manual flow test: pick 4 categories, search & select 3 real products, submit 1 photo intake; confirm state in React devtools/sessionStorage.
- [ ] **Step 4:** `ci:verify` → **Step 5: Commit** — `feat(plan): category multi-select and per-category product picker`

---

### Task 11: Screens S6–S7 (overview with verdicts, compare sheet)

**Files:**
- Create: `screen-overview.tsx`, `compare-sheet.tsx`

**Interfaces:**
- Consumes: `judgeOwnedProduct` (Task 3) — computed client-side is NOT allowed (engine is server code): add `POST /api/plan/judge` in this task (`src/app/api/plan/judge/route.ts`) taking `{ decisions-in-progress }` and returning `VerdictDetail` per role; overview calls it once on entry.
- Produces: flow state `decisions` (the exact array shape POSTed to `/api/plan/finalize` in Task 7 — keep field names identical).

Copy & behavior: S6 overline `Produkt-Abgleich`, H1 sans `Dein Regal, geprüft.`, sub `Grün bleibt. Gelb sehen wir uns gemeinsam an.` Card states = live routine matrix: fits → green tint + green dot; swap → yellow tint + `Tausch` icon-puck; in_review → amber striped left border + `meist innerhalb 24 h`; empty role → inset slot `Nichts angegeben — Empfehlung übernehmen?` with plum `+` puck (tap = accept ideal → decision `choice:'ideal'`). CTA `Tausch ansehen` (present while ≥1 swap undecided; else `Weiter`). S7 bottom sheet (radix Dialog/Sheet if already a dependency — check `package.json`; else fixed-position div like the tracker sheet): grabber, overline `{Rolle} · Tausch empfohlen`, Duell (Deins | Chaarlies Wahl with images + price ca.), fit matrix (`Soll / Deins / Empf.` rows with ✓ △ ×), Fazit line from `VerdictDetail.fazit`, three option cards `Wechseln` (+ reassign note `Dein {X} wird dein Klär-Shampoo. Nichts wird weggeworfen.` when applicable) / `Trotzdem behalten` / `Andere Alternative ansehen` (lists 2 validated alternatives from the engine's alternative lookup — same source as the routine drawer's `Alternativen ansehen`), CTA labeled with the consequence: `{Produkt} auf die Einkaufsliste` for Wechseln, `Behalten` otherwise. Sheet dims + blurs the page behind (`filter: blur(1.5px)`, opacity .5).

- [ ] **Step 1:** `/api/plan/judge` route (auth + access guarded).
- [ ] **Step 2:** Overview screen. **Step 3:** Compare sheet incl. decision writing.
- [ ] **Step 4:** Manual: full pass over 6 roles producing all four decision types; sheet opens/closes; verdicts match `/api/routine` for the same products (sanity).
- [ ] **Step 5:** `ci:verify` → **Step 6: Commit** — `feat(plan): reconciliation overview + compare sheet with judge API`

---

### Task 12: Screens S8–S10 (habits, finished) + finalize wiring

**Files:**
- Create: `screen-habits.tsx`, `screen-finished.tsx`

**Interfaces:**
- Consumes: existing onboarding question components — reuse copy+option data VERBATIM via their vocab sources (`src/lib/vocabulary/profile-labels.ts:97-121` heat tools, `frequencies.ts:194-200` heat frequency chips, `onboarding-care.ts` towel/drying) but render inside the plan-onboarding flow (do NOT mount the legacy `useOnboardingStore` flow; lift only the option lists + `QuizOptionCard`). Questions asked: `Welche Hitzetools nutzt du?` (multi, `Nichts davon` chip) → if any: `Wie oft nutzt du Hitzetools?` (chips) → `Womit trocknest du dein Haar?` → `Wie trocknest du dein Haar hauptsächlich?`. Answers ALSO written to `profiles`/hair profile via the same save path the legacy onboarding uses (find the save handler in `onboarding-flow.tsx` and call its underlying API) so chat/engine stay consistent.
- Produces: `habits` object for finalize `{ heatTools: string[], heatFrequency: string|null, towel: string, drying: string }`; S10 calls `POST /api/plan/finalize` and on success `router.replace('/heute')`.

S10 copy: overline `Geschafft`, serif headline `Dein Plan ist fertig — und gespeichert.`, sub `6 Produkte · 4 davon deine` (computed), full lineup as routine cards — owned = green tint `deins`, shopping = plain card with amber chip `Einkaufsliste`, in_review = amber striped; CTA `Meinen Plan öffnen`. 100% progress, section label `Fertig`.

- [ ] **Step 1:** Habits screens. **Step 2:** Finished screen + finalize call + error state (finalize failure → inline error `Speichern hat nicht geklappt. Erneut versuchen.` with retry button; never lose local state).
- [ ] **Step 3:** End-to-end manual run of the full 10-screen flow against dev DB → row appears in `user_plans` with day types compiled.
- [ ] **Step 4:** `ci:verify` → **Step 5: Commit** — `feat(plan): habits + finish screens; finalize persists the plan`

---

### Task 13: Post-payment redirect switch

**Files:**
- Modify: `src/lib/billing/checkout-success-redirect.ts:14-23`
- Modify: `src/app/plan-bereit/personal-plan-ready-client.tsx` (CTA target)

**Interfaces:** personal_plan + flag on → destination `/plan-start` (replacing `/plan-bereit?lead=…` as the first-time destination, OR keep `/plan-bereit` as the polling gate and change its success CTA from `/onboarding?returnTo=/routine` to `/plan-start` — choose the second (smaller blast radius: payment race/polling logic untouched) and document it in the commit).

- [ ] **Step 1:** Change `/plan-bereit` ready-state CTA + copy: button `Meinen Plan ansehen` (was `Plan mit Produkten verfeinern`), body `Deine Analyse ist ausgewertet. Als Nächstes siehst du deinen Plan — und machst ihn zu deinem.` Flag off → old behavior (both CTA and destination) preserved via `isPersonalPlanAppEnabled()`.
- [ ] **Step 2:** Existing route tests for checkout redirect still green (`grep -r "checkout-success-redirect" --include="*.test.*"`); add a case: flag on + personal_plan → `/plan-bereit` still (unchanged first destination), and plan-bereit CTA renders `/plan-start` href.
- [ ] **Step 3:** `ci:verify` → **Step 4: Commit** — `feat(plan): route personal-plan buyers into /plan-start after payment`

---

### Task 14: App shell — tab bar, avatar, route gating

**Files:**
- Create: `src/components/plan-app/tab-bar.tsx`, `src/components/plan-app/app-shell.tsx`
- Modify: `src/lib/supabase/middleware.ts:14-26` (add `/heute`, `/produkte`, `/fortschritt`, `/plan-start` + `/api/plan` to the subscription-gated set)

**Interfaces:**
- Produces: `<PlanAppShell active="heute"|"produkte"|"fortschritt" shoppingCount={n} checkinDue={bool}>` rendering: header (brand bars + wordmark + avatar button 30px, initials from profile name or `Du`; tap → `/profile`), children, bottom tab bar — 3 tabs with Lucide icons (`Sun` Heute, `FlaskConical`-like bottle → use `Milk` or `SprayCan` per what Lucide offers — pick the closest bottle glyph — Produkte, `BarChart3` Fortschritt), active = plum + bold; Produkte tab shows coral count badge when `shoppingCount > 0`; Fortschritt shows 6px plum dot when `checkinDue`. Users whose `user_plans.status = 'active'` see this shell on the three routes; personal-plan users WITHOUT a finalized plan hitting any of the three → redirect `/plan-start`.

- [ ] **Step 1:** Build shell + tab bar (no legacy `<Header/>` on these routes).
- [ ] **Step 2:** Middleware additions + redirect-to-onboarding logic (server-side in each route's page, via `getPlan`).
- [ ] **Step 3:** `ci:verify` → **Step 4: Commit** — `feat(plan): app shell with three-tab navigation and avatar`

---

### Task 15: /heute (S11)

**Files:**
- Create: `src/app/heute/page.tsx` (server: load `FullPlan`), plus client component in the same folder.

Content: serif H1 `Was ist heute dran?`; 7-day strip (reuse the tracker tab visual: weekday `EE` de, day number, marker — plum dot logged, hollow ring rest-day, empty none; today outlined; markers from `plan_day_logs`); day-type rows (icon well 40px: Droplets wash, Sparkles intensive, Wind refresh, Filter clarifying, Moon rest) with `{steps} Schritte · ~{min} Min`, cadence right; the row matching `suggestToday(...)` gets plum border + ` · Vorschlag für heute` bold suffix and sits first; check-in nudge card (border-l plum, ice bg) when `dueCheckin` — day7: `Woche 1 geschafft — sitzt deine Routine?` / `3 Fragen, 1 Minute` linking to the bilanz-sheet (Task 18 exports it; until then link `/fortschritt`). Row tap → `/heute/{dayKey}`.

- [ ] **Step 1:** Implement. **Step 2:** Manual against mockup S11. **Step 3:** `ci:verify` → **Step 4: Commit** — `feat(plan): Heute tab with strip, suggestion, day-type list`

---

### Task 16: Runbook /heute/[dayType] (S12) + logging

**Files:**
- Create: `src/app/heute/[dayType]/page.tsx`, `src/components/plan-app/runbook.tsx`, `src/app/api/plan/log-day/route.ts`

Behavior (mockup S12, the accepted interaction): plum-gradient header card (overline `{Titel} · {Kadenz}`, serif `Dein {Titel}`, `{n} Schritte · etwa {m} Minuten`); `Alle aufklappen`/`zuklappen` toggle; accordion steps — collapsed row = number circle, uppercase role, product name, `~{x} Min.` pill, chevron; expanded = 3 phase rows (`verb + duration em + detail`), footer ownership chip (`Dein Produkt` green / `Empfohlen` plum / `Ab Kauf` amber) + `Frag Chaarlie` link (`/chat?prefill=` with `Frage zu Schritt {n} ({Produkt}) an meinem {Tagestyp}:` — verify the chat page supports a prefill query param; if not, add it reading `?prefill=` into the input); at most one step open unless expand-all; steps with `ownership='shopping'` show hint line `Bis dahin: … · ` + link `Zur Einkaufsliste` (`/produkte?tab=einkaufsliste`). Bottom: coral `Erledigt` → `POST /api/plan/log-day { dayKey, date, adjustments }` → toast `Eingetragen` → back to `/heute`; link `Kleine Anpassung?` opens a checklist sheet of the day's steps to mark skipped ones (writes `adjustments: ["skipped:leave_in"]`).

`POST /api/plan/log-day`: upsert on `(plan_id, log_date)`; auth+access guarded; returns the updated logs array.

- [ ] **Step 1:** API route. **Step 2:** Runbook component (accordion a11y: buttons with `aria-expanded`). **Step 3:** Wire logging + adjustment sheet.
- [ ] **Step 4:** Playwright: open `/heute` → tap Waschtag → expand step 2 → Erledigt → strip shows today's dot. **Step 5:** `ci:verify` → **Step 6: Commit** — `feat(plan): foldable runbook with one-tap logging and adjustments`

---

### Task 17: /produkte (S13)

**Files:**
- Create: `src/app/produkte/page.tsx`, `src/app/api/plan/shopping/route.ts`

Behavior: serif H1 `Produkte`, sub `Deine Aufstellung — und was noch fehlt.`; segmented control `Meine Produkte | Einkaufsliste` (state via `?tab=` param; segment pill style from mockup; Einkaufsliste segment shows coral count badge while `shoppingCount>0`). „Meine Produkte" = full lineup as routine cards (green tint owned `· deins`, plain + amber chip `Einkaufsliste`, amber striped in_review). „Einkaufsliste" = shop rows (tile, name, `{Rolle} · {Tagestypen} · ca. {Preis} €`, coral outline button `Zum Shop ↗` using the product's affiliate link — same field the routine drawer shop CTA uses); card `Schon besorgt?` / `Markiere es hier — der Schritt wechselt im Plan von „ab Kauf" auf aktiv.` with a check control per item → `PATCH /api/plan/shopping { planProductId }` → sets `status='active'`, `bought_at=now()`, recompiles affected `plan_day_types` steps' ownership (server-side, via Task 4 compiler); footer line `Chaarlie verkauft keine eigenen Produkte. Shop-Links können Partnerlinks sein.`

- [ ] **Step 1:** API. **Step 2:** Page with both segments. **Step 3:** Manual: mark bought → runbook chip flips to `Dein Produkt`, badge count drops. **Step 4:** `ci:verify` → **Step 5: Commit** — `feat(plan): Produkte tab with Einkaufsliste and bought-flow`

---

### Task 18: /fortschritt (S14) + Bilanz

**Files:**
- Create: `src/app/fortschritt/page.tsx`, `src/components/plan-app/progress-bars.tsx`, `src/components/plan-app/bilanz-sheet.tsx`, `src/app/api/plan/checkin/route.ts`

Behavior: serif H1 `Fortschritt`, sub `Tag {n} · gemessen an deinem Start`; ice card with three dimension tracks — track 8px, gradient fill to `current/10`, start tick (plum-light) at `start/10`, current tick (dark) with caps `Start`/`heute` (when equal: single cap `Start = heute`), value text `{start} → {current}`; explainer line after a completed bilanz (`Aus deiner Bilanz, Tag {x}. Definition braucht am längsten — neues Haar wächst ~1 cm im Monat.` — the second sentence only when the definition dimension is flat); nudge `Nächste Bilanz: {Monat}. / 3 Minuten — wir erinnern dich per E-Mail.`; Verlauf card = full strip for the current month + line `Seit {n} Wochen in deinem Rhythmus.` (weeks counted where wash-class logs within the cadence target — reuse the rhythm calc idea from `src/lib/tracking/` if directly reusable, else compute simply: consecutive weeks with 2–3 wash logs). Bilanz sheet: per dimension a 0–10 slider prefilled with `current`, day7 variant instead asks `Sitzt deine Routine?` (Ja / Teilweise / Nein + free text ≤200); `POST /api/plan/checkin { kind, scores?|answers }` marks completed, updates `user_plans.dimensions[].current`, seeds next bilanz row, fires Customer.io event `plan_checkin_completed` and PostHog `plan_checkin_completed`.
Customer.io reminder emails: fire event `plan_checkin_due` from a check inside `GET /api/plan` when a check-in becomes due and no event was sent for it yet (store `notified_at` column? — no: add `notified_at timestamptz` to `plan_checkins` in THIS task via a small second migration `<ts>_plan_checkin_notified.sql`). Campaign itself lives in Customer.io (outside repo) — note in PR.

- [ ] **Step 1:** Second migration (notified_at). **Step 2:** API. **Step 3:** Progress bars + page. **Step 4:** Bilanz sheet (both variants). **Step 5:** Manual: complete a bilanz → bars move, next date advances. **Step 6:** `ci:verify` → **Step 7: Commit** — `feat(plan): Fortschritt tab with bilanz check-ins moving the bars`

---

### Task 19: Profil entry via avatar

**Files:**
- Modify: `src/components/plan-app/app-shell.tsx` (avatar → `/profile`)
- Modify: `src/app/profile/page.tsx` (top-of-page only)

Behavior: existing `/profile` remains the destination (S15 in the mockup is a stylistic target for a LATER dedicated redesign — out of scope here; capture as follow-up). Required now: for plan users (flag on + active plan) `/profile` shows a back affordance to `/heute` instead of the legacy header nav, and the „Mitgliedschaft" section stays reachable exactly as today (German cancellation path untouched).

- [ ] **Step 1:** Wire avatar. **Step 2:** Conditional back-link on `/profile` for plan users. **Step 3:** `ci:verify` → commit — `feat(plan): avatar entry to profile for plan users`

---

### Task 20: Analytics, flag QA, full verification

**Files:**
- Modify: the screens/routes above (event calls only)

- [ ] **Step 1:** PostHog events (follow existing capture pattern — grep `posthog.capture` for the helper): `plan_onboarding_started`, `plan_onboarding_step` `{step}`, `plan_product_added` `{roleKey, source}`, `plan_decision` `{roleKey, choice}`, `plan_finalized` `{ownedCount, shoppingCount}`, `plan_day_logged` `{dayKey, adjusted}`, `plan_shopping_bought` `{roleKey}`, `plan_checkin_completed` `{kind}`.
- [ ] **Step 2:** Flag-off QA: with `PERSONAL_PLAN_APP_V1_ENABLED` unset, verify `/plan-start`, `/heute`, `/produkte`, `/fortschritt` all 404/redirect and legacy flows are byte-identical (spot-check `/plan-bereit`, `/onboarding`, `/routine`).
- [ ] **Step 3:** Full Playwright pass of the golden path: seeded personal_plan purchase → `/plan-bereit` → `/plan-start` all 10 screens → `/heute` → log Waschtag → `/produkte` mark bought → `/fortschritt` complete bilanz.
- [ ] **Step 4:** `npm run ci:verify` + `npm run test:chat` (dev server running) — both green.
- [ ] **Step 5: Commit** — `feat(plan): analytics + flag QA for personal-plan app v1`

---

## Post-implementation (per CLAUDE.md — not part of task execution)

1. Whole-branch Codex review via `codex:codex-rescue` agent (read-only brief, `git diff origin/main...HEAD`, `--effort xhigh`) — fix real findings.
2. `/ship` (runs verify → simplify → review → confirm) — PR is the clean artifact.
3. After deploy: Sentry check (`haircare-fw/hair-concierge`, last hour) + PostHog funnel sanity on the new events.

## Known follow-ups (explicitly out of scope)

- Profile page redesign to mockup S15 styling.
- Share card („Plan teilen").
- Legacy-funnel migration onto the new app.
- Chat prefill polish beyond query param; plan-edit/undo depth; trust-gate semantics for the rhythm line.
- Customer.io campaigns for `plan_checkin_due` (outside repo).
