# Product Intake Phase 3 Clawpatch Fixups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patch the four Phase-3-relevant Clawpatch findings on PR #177 without mixing in unrelated profile/auth/product-identity/shampoo cleanup.

**Architecture:** Keep the fix-up surgical. Product-intake cleanup becomes conservative by treating DB image references as protected storage paths; the product-intake client aligns submit readiness with payload shape; AgentV2 production orchestration gains a pipeline-level conversation ownership guard; `select_products` keeps parallel execution but no longer relies on a shared "latest result" variable.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase service-role repositories, Node test runner via `tsx --test`, Clawpatch local review.

---

## Scope

### In Scope

- Fix Clawpatch finding `fnd_sig-feat-library-095071f340-4a60_680fbfd852`: cleanup script must not remove stale `tmp/...` storage objects that are still referenced by active or not-yet-cleaned `product_submissions`.
- Fix Clawpatch finding `fnd_sig-feat-cli-command-8b2aeb085d-_da94465e61`: photo intake submit readiness and payload shape must agree when an existing pending onboarding usage reuses a committed front image.
- Fix Clawpatch finding `fnd_sig-feat-library-036dec98b1-855d_672e9e5335`: AgentV2 production pipeline must verify `conversationId` belongs to `userId` before admin-client history/state reads.
- Fix Clawpatch finding `fnd_sig-feat-library-036dec98b1-eda4_803266fcf0`: concurrent `select_products` calls must not share a mutable raw-result slot.
- Re-run targeted tests and targeted Clawpatch revalidation.
- Push one fix-up commit to `codex/product-intake-phase-3` to update draft PR #177 after verification.

### Out Of Scope

- Product identity apply transactionality and cross-type identifier conflicts.
- Auth magic-link post-send cleanup.
- Generic onboarding single-select delayed-back behavior.
- Profile goals/subscription button findings.
- Shampoo/conditioner helper findings.
- Applying Supabase migrations or creating the production `product-intake` storage bucket.

---

## Current Branch And PR Context

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-phase-3`
- Branch: `codex/product-intake-phase-3`
- PR: `https://github.com/NickRuppy/hair_concierge/pull/177`
- Stack base: `origin/codex/product-intake-phase-2`
- Current implementation commit before this fix-up: `9f3a084 feat(product-intake): wire chat and onboarding intake`
- Keep `claude-code-review.md`, `.clawpatch/`, `clawpatch-report.md`, and `clawpatch-summary.md` out of the PR unless explicitly requested.

---

## Files To Modify

- `scripts/product-intake/cleanup-photos.ts`
  - Add a referenced-image-path loader for `product_submissions`.
  - Pass protected paths into abandoned tmp cleanup.
  - Export only the functions needed by tests.

- `tests/product-intake-cleanup-photos.test.ts`
  - Expand the fake Supabase client to distinguish `product_submissions` query shapes and storage list/remove calls.
  - Add a regression test for stale tmp image referenced by pending submission.

- `src/lib/product-intake/client.ts`
  - Add `committedFrontImagePath?: string | null` to `buildProductIntakeSubmissionPayload`.
  - Let committed front images make photo intake submittable only when paired with `existingUsageId`.
  - For photo payloads, emit `front_image_path` only for current temporary uploads. Reuse committed images through `existing_usage_id`.

- `src/hooks/use-onboarding-product-intake-controller.ts`
  - Pass `drilldown.committedFrontImagePath` into `buildProductIntakeSubmissionPayload`.

- `tests/product-intake-client-image-compression.test.ts`
  - This file is currently the closest product-intake client unit test. Add payload/guard tests here or split to a new `tests/product-intake-client.test.ts` if the implementation would make this file semantically muddy. Prefer a new file if adding more than two payload tests.

- `src/lib/agent-v2/production/conversation-history.ts`
  - Add a pipeline ownership helper that uses the same query shape as the existing product-intake repository helper at `src/lib/product-intake/repository.ts:342`.
  - Do not import product-intake repository code into AgentV2; match the prior-art query shape to avoid a cross-domain dependency.

- `src/lib/chat-runtime/conversation-state-store.ts`
  - Add an AgentV2 state loader that filters by both `conversation_id` and `user_id`, or accepts a `userId` parameter on `loadAgentV2ConversationState`.

- `src/lib/agent-v2/production/chat-pipeline.ts`
  - Update dependency signatures so tests can assert user-aware history/state loads.
  - Load history/state through user-bound loaders before model/tool execution.
  - Refactor `select_products` raw-result capture so each invocation owns its result.
  - Replace the post-turn `deriveEngineArtifacts(latestSelectProductsResult)` consumer with the last append-only selected-product result.

- `tests/agent-v2-production-chat-pipeline.spec.ts`
  - Add conversation ownership regression.
  - Add concurrent `select_products` out-of-order regression.
  - Add `verifyConversationOwnership: async () => true` to the existing direct pipeline test setups so they do not call the real admin-client ownership helper.

---

## Task 1: Product-Intake Cleanup Protects Referenced Tmp Images

**Files:**
- Modify: `scripts/product-intake/cleanup-photos.ts`
- Modify: `tests/product-intake-cleanup-photos.test.ts`

- [ ] **Step 1: Write the failing cleanup test**

Add a test to `tests/product-intake-cleanup-photos.test.ts` that proves apply-mode tmp cleanup skips old tmp files still referenced by `product_submissions`.

The test should create:

```ts
const pendingReferencedTmp = "tmp/user-1/referenced-front.jpg"
const orphanTmp = "tmp/user-1/orphan-front.jpg"
```

The fake Supabase storage list should return both files as stale under `tmp/user-1`. The fake `product_submissions` query should return one pending row:

```ts
{
  id: "submission-1",
  front_image_path: pendingReferencedTmp,
  barcode_image_path: null,
}
```

Expected result after `cleanupAbandonedTmpUploads(fake as never, true, cutoff, new Set([pendingReferencedTmp]))`:

```ts
assert.deepEqual(fake.removedPaths, [orphanTmp])
assert.deepEqual(result, { objects: 1 })
```

The fake storage client needs both `list` and `remove`:

```ts
storage: {
  from(bucket: string) {
    return {
      async list(path: string, options: { limit: number; offset: number }) {
        calls.push(`list:${bucket}:${path}:${options.offset}`)
        if (path === "tmp") {
          return { data: [{ name: "user-1" }], error: null }
        }
        if (path === "tmp/user-1") {
          return {
            data: [
              { name: "referenced-front.jpg", updated_at: "2026-06-14T00:00:00.000Z" },
              { name: "orphan-front.jpg", updated_at: "2026-06-14T00:00:00.000Z" },
            ],
            error: null,
          }
        }
        return { data: [], error: null }
      },
      async remove(paths: string[]) {
        calls.push(`remove:${bucket}:${paths.join(",")}`)
        removedPaths.push(...paths)
        return { error: null }
      },
    }
  },
}
```

Export the function for tests:

```ts
export async function cleanupAbandonedTmpUploads(
  supabase: SupabaseClient,
  apply: boolean,
  cutoff: Date,
  protectedPaths: ReadonlySet<string> = new Set(),
) {
  // implementation in Step 3
}
```

- [ ] **Step 2: Run the cleanup test and verify RED**

Run:

```bash
npx tsx --test tests/product-intake-cleanup-photos.test.ts
```

Expected: FAIL because `cleanupAbandonedTmpUploads` either is not exported or removes both stale tmp paths.

- [ ] **Step 3: Implement protected-path filtering**

In `scripts/product-intake/cleanup-photos.ts`, add a referenced path loader:

```ts
type ReferencedSubmissionPhotoRow = {
  front_image_path: string | null
  barcode_image_path: string | null
}

export async function loadReferencedSubmissionImagePaths(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const paths = new Set<string>()

  for (let offset = 0; ; offset += SUBMISSION_BATCH_SIZE) {
    const { data, error } = await supabase
      .from("product_submissions")
      .select("front_image_path, barcode_image_path")
      .is("photos_deleted_at", null)
      .range(offset, offset + SUBMISSION_BATCH_SIZE - 1)

    if (error) {
      throw new Error(`load referenced submission photos: ${error.message}`)
    }

    const rows = (data ?? []) as ReferencedSubmissionPhotoRow[]
    for (const row of rows) {
      for (const path of uniquePaths([row.front_image_path, row.barcode_image_path])) {
        paths.add(path)
      }
    }

    if (rows.length < SUBMISSION_BATCH_SIZE) break
  }

  return paths
}
```

Change abandoned tmp cleanup to accept the set:

```ts
export async function cleanupAbandonedTmpUploads(
  supabase: SupabaseClient,
  apply: boolean,
  cutoff: Date,
  protectedPaths: ReadonlySet<string> = new Set(),
) {
  const users = await listAllStorageEntries(supabase, "tmp")
  let totalObjects = 0

  for (const userEntry of users) {
    if (!userEntry.name) continue
    const userPath = `tmp/${userEntry.name}`
    const files = await listAllStorageEntries(supabase, userPath)
    const stalePaths = files
      .filter((file) => isOlderThan(file.updated_at ?? file.created_at, cutoff))
      .map((file) => `${userPath}/${file.name}`)
      .filter((path) => !protectedPaths.has(path))

    totalObjects += await removeStorageObjects(supabase, stalePaths, apply)
  }

  return { objects: totalObjects }
}
```

Add a direct loader test too, so the new database query is covered:

```ts
test("referenced submission image path loader paginates and collects both image columns", async () => {
  const rows = [
    { front_image_path: "tmp/user-1/front.jpg", barcode_image_path: null },
    { front_image_path: null, barcode_image_path: "tmp/user-1/barcode.jpg" },
  ]
  const supabase = createCleanupSupabaseFake({ referencedRows: rows })

  const paths = await loadReferencedSubmissionImagePaths(supabase as never)

  assert.deepEqual([...paths].sort(), ["tmp/user-1/barcode.jpg", "tmp/user-1/front.jpg"])
})
```

Change `main()` to avoid parallel cleanup:

```ts
const expiredSubmissions = await cleanupExpiredSubmissionPhotos(supabase, apply)
const protectedPaths = await loadReferencedSubmissionImagePaths(supabase)
const tmpUploads = await cleanupAbandonedTmpUploads(supabase, apply, tmpCutoff, protectedPaths)
```

Rationale: sequence this so expired/rejected rows can be stamped first in apply mode, then the tmp sweep uses the current DB reference set.

Also update the existing summary `console.log` lines to read the sequential `expiredSubmissions` and `tmpUploads` constants. This is intentionally a small control-flow change, not a logging-format change.

- [ ] **Step 4: Run cleanup tests and verify GREEN**

Run:

```bash
npx tsx --test tests/product-intake-cleanup-photos.test.ts
```

Expected: PASS.

---

## Task 2: Committed Front Image Payload Reuse

**Files:**
- Modify: `src/lib/product-intake/client.ts`
- Modify: `src/hooks/use-onboarding-product-intake-controller.ts`
- Modify or create: `tests/product-intake-client.test.ts`

- [ ] **Step 1: Write failing guard/payload consistency tests**

Create `tests/product-intake-client.test.ts` if it does not exist.

Add:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import {
  buildProductIntakeSubmissionPayload,
  canSubmitProductIntake,
} from "../src/lib/product-intake/client"

test("photo intake can submit with a committed front image only for an existing usage edit", () => {
  const committedFrontImagePath = "user-1/submission-1/front.jpg"
  const existingUsageId = "00000000-0000-4000-8000-000000000001"

  assert.equal(
    canSubmitProductIntake({
      method: "photo",
      category: "shampoo",
      frequency: "weekly_1x",
      brandText: "",
      productName: "",
      frontImagePath: null,
      committedFrontImagePath,
    }),
    false,
  )

  assert.equal(
    canSubmitProductIntake({
      method: "photo",
      category: "shampoo",
      frequency: "weekly_1x",
      brandText: "",
      productName: "",
      frontImagePath: null,
      committedFrontImagePath,
      existingUsageId,
    }),
    true,
  )

  const payload = buildProductIntakeSubmissionPayload({
    method: "photo",
    category: "shampoo",
    frequency: "weekly_1x",
    brandText: "",
    productName: "",
    frontImagePath: null,
    committedFrontImagePath,
    existingUsageId,
    barcodeImagePath: null,
  })

  assert.equal(payload.front_image_path, undefined)
  assert.equal(payload.existing_usage_id, existingUsageId)
})
```

- [ ] **Step 2: Run the client test and verify RED**

Run:

```bash
npx tsx --test tests/product-intake-client.test.ts
```

Expected: FAIL because `committedFrontImagePath` is not part of the builder/readiness contract for existing usage edits.

Note: committed storage paths are not temporary upload paths. The desired payload shape for a same pending onboarding edit is `existing_usage_id` without `front_image_path`; the server then reuses the prior committed image.

- [ ] **Step 3: Implement payload fallback**

In `src/lib/product-intake/client.ts`, extend the builder params:

```ts
committedFrontImagePath?: string | null
```

Extend `canSubmitProductIntake` with:

```ts
existingUsageId?: string | null
```

For photo readiness, allow:

```ts
Boolean(params.frontImagePath || (params.committedFrontImagePath && params.existingUsageId))
```

In the photo payload branch, compute:

```ts
const frontImagePath = params.frontImagePath ?? null
```

Emit `front_image_path` only when `frontImagePath` is a current temporary upload. Do not serialize `committedFrontImagePath` into `front_image_path`; the server rejects committed `user/submission/...` paths as stale upload paths. Keep barcode behavior unchanged.

- [ ] **Step 4: Pass the committed path from onboarding**

In `src/hooks/use-onboarding-product-intake-controller.ts`, add:

```ts
committedFrontImagePath: drilldown.committedFrontImagePath,
```

to the existing `buildProductIntakeSubmissionPayload` call.

Also pass `existingUsageId` into onboarding readiness checks so a committed-only photo can continue only for the same pending onboarding usage edit.

Do not add `committedFrontImagePath` to the chat card. The chat card only has current tmp upload paths and no committed pending image path.

- [ ] **Step 5: Run product-intake client tests and verify GREEN**

Run:

```bash
npx tsx --test tests/product-intake-client.test.ts tests/product-intake-submissions.test.ts
```

Expected: PASS.

---

## Task 3: Pipeline-Level Conversation Ownership Guard

**Files:**
- Modify: `src/lib/agent-v2/production/conversation-history.ts`
- Modify: `src/lib/chat-runtime/conversation-state-store.ts`
- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
- Modify: `tests/agent-v2-production-chat-pipeline.spec.ts`

- [ ] **Step 1: Write failing ownership regression test**

In `tests/agent-v2-production-chat-pipeline.spec.ts`, add a test near the existing production pipeline tests:

```ts
test("AgentV2 production pipeline rejects mismatched user and conversation before loading history or state", async () => {
  let historyLoaded = false
  let stateLoaded = false

  await assert.rejects(
    () =>
      runAgentV2ProductionPipeline(
        {
          message: "Hallo",
          conversationId: "conversation-owned-by-user-2",
          userId: "user-1",
          requestId: "request-ownership",
        },
        {
          verifyConversationOwnership: async ({ conversationId, userId }) => {
            assert.equal(conversationId, "conversation-owned-by-user-2")
            assert.equal(userId, "user-1")
            return false
          },
          loadConversationHistory: async () => {
            historyLoaded = true
            return []
          },
          loadConversationState: async () => {
            stateLoaded = true
            return createDefaultConversationState()
          },
          getUserContext: async () => ({
            profile: createCompleteHairProfile(),
            routine_inventory: [],
            relevant_memory: [],
            derived_signals: [],
            suggested_overlays: [],
            missing_profile: [],
          }),
          loadUserMemoryContext: async () => ({
            enabled: true,
            entries: [],
            promptContext: null,
            dislikedProductNames: [],
          }),
          runAgentV2ResponsesTurn: async () => createAgentV2Result(),
        },
      ),
    /does not belong to user/i,
  )

  assert.equal(historyLoaded, false)
  assert.equal(stateLoaded, false)
})
```

This test introduces the dependency contract:

```ts
verifyConversationOwnership?: (params: {
  conversationId: string
  userId: string
}) => Promise<boolean>
```

- [ ] **Step 2: Run the AgentV2 pipeline test and verify RED**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: FAIL because `verifyConversationOwnership` is not part of `ProductionAgentV2PipelineDeps` and/or the pipeline does not reject before history/state load.

- [ ] **Step 3: Add ownership helper in conversation history module**

In `src/lib/agent-v2/production/conversation-history.ts`, add:

```ts
type ConversationOwnershipQueryResult = {
  data: { id: string } | null
  error: unknown
}

type ConversationOwnershipClient = {
  from(table: "conversations"): {
    select(columns: string): {
      eq(column: "id" | "user_id", value: string): {
        eq(column: "id" | "user_id", value: string): {
          maybeSingle(): Promise<ConversationOwnershipQueryResult>
        }
        maybeSingle(): Promise<ConversationOwnershipQueryResult>
      }
    }
  }
}

export async function verifyAgentV2ProductionConversationOwnership(
  params: { conversationId: string; userId: string },
  client: unknown = createAdminClient(),
): Promise<boolean> {
  const admin = client as ConversationOwnershipClient
  const { data, error } = await admin
    .from("conversations")
    .select("id")
    .eq("id", params.conversationId)
    .eq("user_id", params.userId)
    .maybeSingle()

  if (error) {
    console.error("Failed to verify AgentV2 production conversation ownership:", error)
    return false
  }

  return Boolean(data?.id)
}
```

This intentionally matches the existing prior-art query in `src/lib/product-intake/repository.ts:342-353`, but keeps AgentV2 independent from product-intake repository code.

If the local Supabase type shape makes the chained `eq` type awkward, prefer a small `unknown` cast inside this helper rather than spreading casts through the pipeline.

- [ ] **Step 4: Wire guard into production pipeline**

In `src/lib/agent-v2/production/chat-pipeline.ts`:

1. Import the helper:

```ts
import {
  loadAgentV2ProductionConversationHistory,
  verifyAgentV2ProductionConversationOwnership,
} from "@/lib/agent-v2/production/conversation-history"
```

2. Extend `ProductionAgentV2PipelineDeps`:

```ts
verifyConversationOwnership?: (params: {
  conversationId: string
  userId: string
}) => Promise<boolean>
```

3. Before the current `Promise.all` that loads history/context/memory/state, add:

```ts
const ownsConversation = await (deps.verifyConversationOwnership ??
  verifyAgentV2ProductionConversationOwnership)({ conversationId, userId })

if (!ownsConversation) {
  throw new Error("AgentV2 production conversation does not belong to user.")
}
```

This must happen before `loadConversationHistory` and `loadConversationState`.

- [ ] **Step 5: Update existing pipeline tests to stub the new guard**

There are existing direct `runAgentV2ProductionPipeline(` calls in `tests/agent-v2-production-chat-pipeline.spec.ts` at these current line anchors:

```text
751, 908, 990, 1036, 1084, 1231, 1556, 1636, 1740, 1894, 1967, 2031, 2083
```

Each test dependency object that is meant to exercise normal successful pipeline behavior must add:

```ts
verifyConversationOwnership: async ({ conversationId, userId }) => {
  assert.equal(typeof conversationId, "string")
  assert.equal(typeof userId, "string")
  return true
},
```

Tests that intentionally exercise failure behavior can use the same stub unless the failure is ownership-specific. Do not let existing tests fall through to the real helper, because the real helper creates an admin Supabase client and will fail in unit tests without environment.

- [ ] **Step 6: Make default state reads user-bound where practical**

For default production code, the guard is the hard boundary. To make the state read less foot-gunny, also add a user-bound AgentV2 state loader in `src/lib/chat-runtime/conversation-state-store.ts`:

```ts
export async function loadAgentV2ConversationStateForUser(
  supabase: SupabaseClient,
  params: { conversationId: string | null | undefined; userId: string },
): Promise<AgentV2ConversationStateV2> {
  if (!params.conversationId) return normalizeAgentV2ConversationState(null)

  const { data, error } = await supabase
    .from("conversation_states")
    .select("state")
    .eq("conversation_id", params.conversationId)
    .eq("user_id", params.userId)
    .maybeSingle()

  if (error) {
    console.error("Failed to load AgentV2 conversation state:", error)
    return normalizeAgentV2ConversationState(null)
  }

  return normalizeAgentV2ConversationState(data?.state)
}
```

Then in the pipeline default state path use:

```ts
loadAgentV2ConversationStateForUser(createAdminClient(), { conversationId, userId })
```

This requires updating the import near the existing state-store import in `src/lib/agent-v2/production/chat-pipeline.ts`. Replace the current alias-only import shape:

```ts
import {
  loadAgentV2ConversationState as loadPersistedConversationState,
  saveAgentV2ConversationState,
} from "@/lib/chat-runtime/conversation-state-store"
```

with an import that also brings in the new helper:

```ts
import {
  loadAgentV2ConversationState as loadPersistedConversationState,
  loadAgentV2ConversationStateForUser,
  saveAgentV2ConversationState,
} from "@/lib/chat-runtime/conversation-state-store"
```

Keep `deps.loadConversationState` available for tests, but update its signature to:

```ts
loadConversationState?: (params: { conversationId: string; userId: string }) => Promise<unknown>
```

Update the pipeline call site that currently passes a positional conversation id into `deps.loadConversationState`. The call must pass the new object:

```ts
deps.loadConversationState({ conversationId, userId })
```

Most existing test stubs use zero-argument async functions and remain assignable to this dependency type; do not churn those just for parameter shape. Only update stubs that inspect the argument or otherwise need the new object.

- [ ] **Step 7: Run AgentV2 pipeline tests and verify GREEN**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: PASS.

---

## Task 4: Preserve Parallel `select_products` Without Shared Raw Result

**Files:**
- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
- Modify: `tests/agent-v2-production-chat-pipeline.spec.ts`

- [ ] **Step 1: Write failing out-of-order concurrency test**

In `tests/agent-v2-production-chat-pipeline.spec.ts`, add a test that calls the runtime tool twice in parallel and resolves out of order.

Use two `SelectProductsToolResult` objects:

```ts
const shampooSelection: SelectProductsToolResult = {
  projection: { category: "shampoo", /* use same required fields as existing tests */ },
  products: [createProduct("shampoo-product")],
  effectiveHairProfile: hairProfile,
  runtime: buildRecommendationEngineRuntimeForChat({
    hairProfile,
    routineItems: [],
    productCategory: "shampoo",
    message: "Vergleiche Shampoo und Conditioner.",
  }),
}

const conditionerSelection: SelectProductsToolResult = {
  projection: { category: "conditioner", /* use same required fields as existing tests */ },
  products: [createProduct("conditioner-product")],
  effectiveHairProfile: hairProfile,
  runtime: buildRecommendationEngineRuntimeForChat({
    hairProfile,
    routineItems: [],
    productCategory: "conditioner",
    message: "Vergleiche Shampoo und Conditioner.",
  }),
}
```

The fake `createSelectProductsTool` should return promises controlled by the test:

```ts
const resolvers = new Map<string, (value: SelectProductsToolResult) => void>()

createSelectProductsTool:
  (options) =>
  async (input: SelectProductsToolParams) =>
    new Promise((resolve) => {
      resolvers.set(input.category, (result) => {
        options.onResult?.(result)
        resolve(result.projection)
      })
    })
```

The fake must call `options.onResult?.(result)` before resolving and must resolve with `result.projection`, mirroring the real `select_products` tool. Without that callback, the current buggy shared `latestSelectProductsResult` slot is never populated and the test can pass for the wrong reason.

The fake `runAgentV2ResponsesTurn` should:

```ts
const shampooPromise = params.tools.select_products({ category: "shampoo" })
const conditionerPromise = params.tools.select_products({ category: "conditioner" })

resolvers.get("conditioner")?.(conditionerSelection)
resolvers.get("shampoo")?.(shampooSelection)

const [shampooProjection, conditionerProjection] = await Promise.all([
  shampooPromise,
  conditionerPromise,
])

assert.equal(shampooProjection.category, "shampoo")
assert.equal(conditionerProjection.category, "conditioner")
```

Expected under the current code: FAIL or flake because the first awaited projection can be derived from the out-of-order shared `latestSelectProductsResult` rather than from that invocation's raw result.

- [ ] **Step 2: Run AgentV2 pipeline test and verify RED**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: FAIL on the new concurrency test.

- [ ] **Step 3: Capture raw results per invocation in the pipeline**

In `src/lib/agent-v2/production/chat-pipeline.ts`, remove this shared slot:

```ts
let latestSelectProductsResult: SelectProductsToolResult | null = null
```

Replace the single shared tool instance with a per-call wrapper. Inside `tools.select_products`, instantiate a tool with local capture:

```ts
let rawResult: SelectProductsToolResult | null = null
const selectProductsForCall = (deps.createSelectProductsTool ?? createSelectProductsTool)({
  onResult: (result) => {
    rawResult = result
  },
})

const projection = await selectProductsForCall({
  category: input.category as Parameters<typeof selectProductsForCall>[0]["category"],
  message: productToolMessage,
  hairProfile: effectiveHairProfile,
  memoryContext,
  routineItems: effectiveRoutineItems,
  effectiveCareContext,
})
```

Then use the local value:

```ts
const resultForProjection =
  rawResult ??
  ({
    projection,
    products: [],
    effectiveHairProfile,
    runtime: {} as SelectProductsToolResult["runtime"],
  } satisfies SelectProductsToolResult)

selectedProductResults.push(resultForProjection)

const agentProjection = projectSelectProductsForAgentV2(resultForProjection, {
  includeCareBalanceContext: true,
})
selectedProductProjections.push(agentProjection)
return agentProjection
```

Important: preserve `selectedProductResults` and `selectedProductProjections` as turn-level append-only arrays. Only the per-call capture becomes local.

This intentionally pushes the local fallback result as well as real raw results. In production the real tool always calls `onResult`, so the fallback should only matter for defensive tests/fakes; keeping the append-only array populated makes the post-turn artifact source deterministic.

Also delete the existing outer shared tool instance:

```ts
const selectProducts = (deps.createSelectProductsTool ?? createSelectProductsTool)({
  onResult: (result) => {
    latestSelectProductsResult = result
    selectedProductResults.push(result)
  },
})
```

and delete the reset inside `tools.select_products`:

```ts
latestSelectProductsResult = null
```

Do not modify `src/lib/agent/tools/select-products.ts`. Its `onResult` callback already exists and already emits the raw result.

- [ ] **Step 4: Replace post-turn engine artifact source**

In `src/lib/agent-v2/production/chat-pipeline.ts`, replace:

```ts
const { categoryDecision, engineTrace } = deriveEngineArtifacts(latestSelectProductsResult)
```

with:

```ts
const { categoryDecision, engineTrace } = deriveEngineArtifacts(
  selectedProductResults.at(-1) ?? null,
)
```

This preserves the current "last selected product result drives exposed engine artifacts" behavior without a shared mutable slot.

- [ ] **Step 5: Run AgentV2 pipeline tests and verify GREEN**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: PASS.

---

## Task 5: Verification And Targeted Clawpatch Revalidation

**Files:**
- No production files should be modified in this task.

- [ ] **Step 1: Run focused test bundle**

Run:

```bash
npx tsx --test \
  tests/product-intake-cleanup-photos.test.ts \
  tests/product-intake-client.test.ts \
  tests/product-intake-client-image-compression.test.ts \
  tests/product-intake-submissions.test.ts \
  tests/product-intake-schema.test.ts \
  tests/product-intake-lookup.test.ts \
  tests/agent-v2-production-chat-pipeline.spec.ts \
  tests/agent-v2-responses-runtime.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run repo checks**

Run:

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected:
- `typecheck`: PASS
- `lint`: PASS with only the known pre-existing warnings if still present
- `build`: PASS
- `git diff --check`: PASS

For the final pre-push gate, prefer the repo aggregate command:

```bash
npm run ci:verify
```

Expected: PASS. This runs `typecheck && lint && build`.

- [ ] **Step 3: Run targeted Clawpatch revalidation**

Run:

```bash
npm run clawpatch:revalidate -- --finding fnd_sig-feat-library-095071f340-4a60_680fbfd852
npm run clawpatch:revalidate -- --finding fnd_sig-feat-cli-command-8b2aeb085d-_da94465e61
npm run clawpatch:revalidate -- --finding fnd_sig-feat-library-036dec98b1-855d_672e9e5335
npm run clawpatch:revalidate -- --finding fnd_sig-feat-library-036dec98b1-eda4_803266fcf0
```

Expected: each finding is closed, downgraded to non-actionable, or produces a narrower remaining issue that is triaged before shipping.

The flag is valid for the current Clawpatch CLI (`clawpatch revalidate --help` lists `--finding <id>`).

- [ ] **Step 4: Generate updated Clawpatch report**

Run:

```bash
npm run clawpatch:report -- --output clawpatch-report.md
npm run clawpatch:summary -- --output clawpatch-summary.md --base origin/codex/product-intake-phase-2
```

Expected: report reflects targeted finding status. Keep generated report files out of git unless Nick explicitly asks to include them.

- [ ] **Step 5: Commit and push fix-up**

After Nick approves the patched diff:

```bash
git status --short --branch
git add scripts/product-intake/cleanup-photos.ts \
  src/lib/product-intake/client.ts \
  src/hooks/use-onboarding-product-intake-controller.ts \
  src/lib/agent-v2/production/conversation-history.ts \
  src/lib/chat-runtime/conversation-state-store.ts \
  src/lib/agent-v2/production/chat-pipeline.ts \
  tests/product-intake-cleanup-photos.test.ts \
  tests/product-intake-client.test.ts \
  tests/agent-v2-production-chat-pipeline.spec.ts
git commit -m "fix(product-intake): address phase 3 review findings"
git push
```

Do not stage:

```text
claude-code-review.md
clawpatch-report.md
clawpatch-summary.md
.clawpatch/
```

- [ ] **Step 6: Update PR #177 notes**

Update the PR body or add a PR comment summarizing:

- the four targeted Clawpatch findings patched
- verification commands and results
- remaining Clawpatch findings intentionally deferred because they are outside PR #177 scope
- Supabase migration/storage bucket still unapplied to production

---

## Verification Matrix

| Risk | Regression Test | Runtime Check |
| --- | --- | --- |
| Cleanup deletes reviewed image | `tests/product-intake-cleanup-photos.test.ts` referenced tmp test | `npm run clawpatch:revalidate` for cleanup finding |
| UI can submit without a reusable image reference | `tests/product-intake-client.test.ts` committed path existing-usage test | product-intake focused bundle |
| Cross-user chat history/state load | `tests/agent-v2-production-chat-pipeline.spec.ts` ownership mismatch test | Clawpatch revalidation for ownership finding |
| Parallel tool result mix-up | `tests/agent-v2-production-chat-pipeline.spec.ts` out-of-order parallel tool test | Clawpatch revalidation for concurrency finding |

---

## Open Risks And Notes

- The cleanup script will be more conservative. If old tmp paths are referenced by active rows, they will be skipped. That can retain extra storage temporarily, which is preferable to losing review evidence.
- The pipeline ownership guard introduces a new failure mode: a mismatched `userId`/`conversationId` throws before assistant execution. This should surface as a server error unless the API route maps it. If tests reveal poor UX, add a route-level controlled response, but keep the pipeline guard.
- The `select_products` per-call refactor should preserve existing matched-products output because `selectedProductResults` remains append-only for the turn.
- Do not address non-Phase-3 Clawpatch findings in this PR unless they block the targeted tests or revalidation.
