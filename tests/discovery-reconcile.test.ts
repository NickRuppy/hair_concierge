import assert from "node:assert/strict"
import test from "node:test"

import {
  parseDiscoveryCommand,
  parseDiscoveryReconcileScope,
  planDiscoveryReconciliation,
  runDiscoveryCommand,
  type DiscoveryReconcileGateway,
  type DiscoveryReconcileReceipt,
  type DiscoveryReconcileTarget,
} from "../scripts/discovery"
import {
  assignDiscoveryIntakeItemProduct,
  loadDiscoveryReconcileTargets,
  type DiscoveryAdminClient,
} from "../src/lib/discovery/reconcile"

/**
 * `npm run discovery -- reconcile` — the T-1 walk back from an approved product
 * submission to the intake row that is still waiting for it.
 *
 * Three things this suite exists to pin, because getting any of them wrong is
 * silent in production:
 *
 * 1. The production gate refuses BEFORE the database, exactly as the other
 *    subcommands do — a `--apply` without the full gate must not even read.
 * 2. Only rows with `product_id IS NULL` are ever touched, asserted on the query
 *    the loader builds and again on the update's own predicate.
 * 3. An approved product that fails scan eligibility is reported, never written.
 */

const SECRET = "discovery-enrollment-secret-with-enough-length"
const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  pendingItem: "50000000-0000-4000-8000-000000000001",
  eligibleItem: "50000000-0000-4000-8000-000000000002",
  ineligibleItem: "50000000-0000-4000-8000-000000000003",
  openSubmission: "30000000-0000-4000-8000-000000000001",
  approvedSubmission: "30000000-0000-4000-8000-000000000002",
  quarantinedSubmission: "30000000-0000-4000-8000-000000000003",
  eligibleProduct: "20000000-0000-4000-8000-000000000001",
  ineligibleProduct: "20000000-0000-4000-8000-000000000002",
}

const applyEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://pqdkhefxsxkyeqelqegq.supabase.co",
  ALLOW_DISCOVERY_PRODUCTION_WRITE: "1",
}
const applyArgs = ["reconcile", "--all", "--apply", "--confirm-project=pqdkhefxsxkyeqelqegq"]

/**
 * One participant with three research-pending items: research still open,
 * approved onto an eligible product, approved onto one scan would not surface.
 */
function target(): DiscoveryReconcileTarget {
  return {
    enrollmentId: ids.enrollment,
    name: "Lea Sommer",
    email: "lea@example.test",
    intakeId: ids.intake,
    finalizedAt: null,
    items: [
      {
        itemId: ids.pendingItem,
        category: "shampoo",
        source: "name_research",
        brandText: "Balea",
        productNameText: "Professional Repair Shampoo",
        productSubmissionId: ids.openSubmission,
      },
      {
        itemId: ids.eligibleItem,
        category: "conditioner",
        source: "dm_search",
        brandText: "Nivea",
        productNameText: "Repair Spülung",
        productSubmissionId: ids.approvedSubmission,
      },
      {
        itemId: ids.ineligibleItem,
        category: "mask",
        source: "barcode_unknown",
        brandText: null,
        productNameText: null,
        productSubmissionId: ids.quarantinedSubmission,
      },
    ],
  }
}

function fakeGateway(overrides: Partial<DiscoveryReconcileGateway> = {}) {
  const writes: Array<{ itemId: string; productId: string }> = []
  const gateway: DiscoveryReconcileGateway = {
    loadTargets: async () => [target()],
    loadSubmissionOutcomes: async (submissionIds) => {
      const outcomes = new Map<
        string,
        { status: string | null; approvedProductId: string | null }
      >()
      for (const id of submissionIds) {
        if (id === ids.openSubmission)
          outcomes.set(id, { status: "researching", approvedProductId: null })
        if (id === ids.approvedSubmission)
          outcomes.set(id, { status: "approved", approvedProductId: ids.eligibleProduct })
        if (id === ids.quarantinedSubmission)
          outcomes.set(id, { status: "approved", approvedProductId: ids.ineligibleProduct })
      }
      return outcomes
    },
    // Only the first approved product survives scan eligibility.
    filterEligibleProductIds: async (productIds) =>
      new Set(productIds.filter((id) => id === ids.eligibleProduct)),
    assignProductId: async (assignment) => {
      writes.push(assignment)
      return true
    },
    ...overrides,
  }
  return { gateway, writes }
}

/** Every method fails the test: the gate must refuse before the database. */
function forbiddenReconcileGateway(): DiscoveryReconcileGateway {
  const refuse = (name: string) => () => {
    throw new Error(`reconcileGateway.${name} must not run before the production gate passes`)
  }
  return {
    loadTargets: refuse("loadTargets"),
    loadSubmissionOutcomes: refuse("loadSubmissionOutcomes"),
    filterEligibleProductIds: refuse("filterEligibleProductIds"),
    assignProductId: refuse("assignProductId"),
  }
}

async function run(
  args: readonly string[],
  environment: Record<string, string | undefined>,
  overrides: Partial<DiscoveryReconcileGateway> = {},
) {
  const { gateway, writes } = fakeGateway(overrides)
  const logged: unknown[] = []
  await runDiscoveryCommand({
    args,
    environment,
    reconcileGateway: gateway,
    secret: SECRET,
    log: (value) => logged.push(value),
  })
  return { writes, receipt: logged[0] as DiscoveryReconcileReceipt }
}

// --- Parsing -----------------------------------------------------------------

test("reconcile takes exactly one scope and normalizes the email", () => {
  assert.deepEqual(parseDiscoveryCommand(["reconcile", "--all"]), {
    action: "reconcile",
    apply: false,
    scope: { kind: "all" },
  })
  assert.deepEqual(
    parseDiscoveryCommand(["reconcile", `--enrollment=${ids.enrollment}`, "--apply"]),
    {
      action: "reconcile",
      apply: true,
      scope: { kind: "enrollment", enrollmentId: ids.enrollment },
    },
  )
  assert.deepEqual(parseDiscoveryReconcileScope(["reconcile", "--email= LEA@Example.Test "]), {
    kind: "email",
    email: "lea@example.test",
  })

  assert.throws(() => parseDiscoveryReconcileScope(["reconcile"]), /exactly one of/)
  assert.throws(
    () => parseDiscoveryReconcileScope(["reconcile", "--all", `--enrollment=${ids.enrollment}`]),
    /exactly one of/,
  )
  assert.throws(
    () => parseDiscoveryReconcileScope(["reconcile", "--email=not-an-email"]),
    /valid --email/,
  )
})

// --- The production gate -----------------------------------------------------

test("a half-gated reconcile reaches no database call at all", async () => {
  const refuses = (args: readonly string[], environment: Record<string, string | undefined>) =>
    assert.rejects(
      runDiscoveryCommand({
        args,
        environment,
        reconcileGateway: forbiddenReconcileGateway(),
        secret: SECRET,
        log: () => {},
      }),
      /Writes require ALLOW_DISCOVERY_PRODUCTION_WRITE=1/,
    )

  await refuses(applyArgs, { ...applyEnvironment, ALLOW_DISCOVERY_PRODUCTION_WRITE: undefined })
  await refuses(applyArgs, { ...applyEnvironment, ALLOW_DISCOVERY_PRODUCTION_WRITE: "0" })
  await refuses(
    applyArgs.filter((argument) => !argument.startsWith("--confirm-project")),
    applyEnvironment,
  )
  await refuses(applyArgs, {
    ...applyEnvironment,
    NEXT_PUBLIC_SUPABASE_URL: "https://wrong-project.supabase.co",
  })
  await refuses(
    ["reconcile", `--email=lea@example.test`, "--apply", "--confirm-project=pqdkhefxsxkyeqelqegq"],
    { ...applyEnvironment, ALLOW_DISCOVERY_PRODUCTION_WRITE: undefined },
  )
})

// --- Dry run and apply -------------------------------------------------------

test("without --apply reconcile reports the plan and writes nothing", async () => {
  const { writes, receipt } = await run(["reconcile", "--all"], applyEnvironment)

  assert.deepEqual(writes, [])
  assert.equal(receipt.mode, "dry-run")
  assert.equal(receipt.writes, false)
  assert.deepEqual(receipt.scope, { kind: "all" })
  assert.deepEqual(receipt.totals, {
    reconciled: 1,
    research_pending: 1,
    approved_but_ineligible: 1,
    already_assigned: 0,
  })
})

test("a gated reconcile writes only the approved, eligible product", async () => {
  const { writes, receipt } = await run(applyArgs, applyEnvironment)

  // The one write, and only it: the still-open research and the approved-but-
  // ineligible product reach no update at all.
  assert.deepEqual(writes, [{ itemId: ids.eligibleItem, productId: ids.eligibleProduct }])

  assert.equal(receipt.action, "reconcile")
  assert.equal(receipt.mode, "apply")
  assert.equal(receipt.writes, true)
  assert.deepEqual(receipt.totals, {
    reconciled: 1,
    research_pending: 1,
    approved_but_ineligible: 1,
    already_assigned: 0,
  })
  assert.equal(receipt.participants.length, 1)
  const participant = receipt.participants[0]
  assert.equal(participant.enrollmentId, ids.enrollment)
  assert.equal(participant.name, "Lea Sommer")
  assert.equal(participant.email, "lea@example.test")
  assert.equal(participant.intakeId, ids.intake)
  assert.equal(participant.finalizedAt, null)
  assert.deepEqual(participant.items, [
    {
      itemId: ids.pendingItem,
      category: "shampoo",
      source: "name_research",
      product: "Balea Professional Repair Shampoo",
      submissionId: ids.openSubmission,
      submissionStatus: "researching",
      productId: null,
      outcome: "research_pending",
    },
    {
      itemId: ids.eligibleItem,
      category: "conditioner",
      source: "dm_search",
      product: "Nivea Repair Spülung",
      submissionId: ids.approvedSubmission,
      submissionStatus: "approved",
      productId: ids.eligibleProduct,
      outcome: "reconciled",
    },
    {
      // Approved, but deactivated or disposition-quarantined: the capture gate
      // would have refused the same product, so neither does this.
      itemId: ids.ineligibleItem,
      category: "mask",
      source: "barcode_unknown",
      product: null,
      submissionId: ids.quarantinedSubmission,
      submissionStatus: "approved",
      productId: null,
      outcome: "approved_but_ineligible",
    },
  ])
})

test("a submission with no row of its own reads as research-pending, not as approved", () => {
  const [participant] = planDiscoveryReconciliation({
    targets: [target()],
    outcomes: new Map(),
    eligible: new Set([ids.eligibleProduct]),
  })
  assert.deepEqual(
    participant.items.map((item) => item.outcome),
    ["research_pending", "research_pending", "research_pending"],
  )
  assert.deepEqual(
    participant.items.map((item) => item.productId),
    [null, null, null],
  )
})

test("a row claimed between plan and write is reported, never counted as reconciled", async () => {
  const { receipt } = await run(applyArgs, applyEnvironment, {
    assignProductId: async () => false,
  })
  assert.deepEqual(receipt.totals, {
    reconciled: 0,
    research_pending: 1,
    approved_but_ineligible: 1,
    already_assigned: 1,
  })
})

// --- The database layer's own predicates -------------------------------------

type RecordedCall = { table: string; filters: string[]; update?: unknown }

/**
 * A recording stand-in for the service-role client. It proves the PostgREST
 * predicates the loader and the write actually build — the part no gateway fake
 * can see.
 */
function recordingClient(tables: Record<string, unknown[]>) {
  const calls: RecordedCall[] = []
  const client = {
    from(table: string) {
      const call: RecordedCall = { table, filters: [] }
      calls.push(call)
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          call.filters.push(`eq:${column}=${String(value)}`)
          return chain
        },
        is: (column: string, value: unknown) => {
          call.filters.push(`is:${column}=${String(value)}`)
          return chain
        },
        in: (column: string, values: readonly unknown[]) => {
          call.filters.push(`in:${column}=${values.join(",")}`)
          return chain
        },
        not: (column: string, operator: string, value: unknown) => {
          call.filters.push(`not:${column}:${operator}=${String(value)}`)
          return chain
        },
        order: () => chain,
        limit: () => chain,
        update: (payload: unknown) => {
          call.update = payload
          return chain
        },
        then: (resolve: (result: { data: unknown; error: null }) => unknown) =>
          Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve),
      }
      return chain
    },
  } as unknown as DiscoveryAdminClient
  return { client, calls }
}

const enrollmentRow = {
  id: ids.enrollment,
  display_name: "Lea Sommer",
  normalized_email: "lea@example.test",
}
const intakeRow = { id: ids.intake, enrollment_id: ids.enrollment, call_finalized_at: null }

test("the pending-item read only ever asks for rows without a product id", async () => {
  const { client, calls } = recordingClient({
    discovery_enrollments: [enrollmentRow],
    discovery_intakes: [intakeRow],
    discovery_intake_items: [
      {
        id: ids.pendingItem,
        intake_id: ids.intake,
        category: "shampoo",
        source: "name_research",
        brand_text: "Balea",
        product_name_text: "Repair Shampoo",
        product_submission_id: ids.openSubmission,
      },
    ],
  })

  const targets = await loadDiscoveryReconcileTargets({ kind: "all" }, client)

  const items = calls.find((call) => call.table === "discovery_intake_items")
  assert.ok(items?.filters.includes("is:product_id=null"))
  assert.ok(items?.filters.includes("not:product_submission_id:is=null"))
  // `--all` is the narrow scope: no revoked enrollments, no finalized calls.
  assert.ok(
    calls
      .find((call) => call.table === "discovery_enrollments")
      ?.filters.includes("is:revoked_at=null"),
  )
  assert.ok(
    calls
      .find((call) => call.table === "discovery_intakes")
      ?.filters.includes("is:call_finalized_at=null"),
  )
  assert.deepEqual(
    targets.map((entry) => entry.items.map((item) => item.itemId)),
    [[ids.pendingItem]],
  )
})

test("a named enrollment is reported even with nothing pending; a sweep stays quiet", async () => {
  const tables = {
    discovery_enrollments: [enrollmentRow],
    discovery_intakes: [intakeRow],
    discovery_intake_items: [],
  }

  const named = recordingClient(tables)
  const byId = await loadDiscoveryReconcileTargets(
    { kind: "enrollment", enrollmentId: ids.enrollment },
    named.client,
  )
  assert.equal(byId.length, 1)
  assert.deepEqual(byId[0].items, [])
  // A named enrollment is reconciled whatever its state — the receipt carries
  // `finalizedAt` so a needed re-finalize is visible rather than assumed.
  assert.ok(
    !named.calls
      .find((call) => call.table === "discovery_intakes")
      ?.filters.includes("is:call_finalized_at=null"),
  )

  const sweep = recordingClient(tables)
  assert.deepEqual(await loadDiscoveryReconcileTargets({ kind: "all" }, sweep.client), [])
})

test("the write is itself guarded on product_id IS NULL", async () => {
  const wrote = recordingClient({ discovery_intake_items: [{ id: ids.eligibleItem }] })
  assert.equal(
    await assignDiscoveryIntakeItemProduct(
      { itemId: ids.eligibleItem, productId: ids.eligibleProduct },
      wrote.client,
    ),
    true,
  )
  const call = wrote.calls[0]
  assert.equal(call.table, "discovery_intake_items")
  assert.deepEqual(call.update, { product_id: ids.eligibleProduct })
  assert.deepEqual(call.filters, [`eq:id=${ids.eligibleItem}`, "is:product_id=null"])

  // No row came back: the item was claimed in between and keeps its own answer.
  const raced = recordingClient({ discovery_intake_items: [] })
  assert.equal(
    await assignDiscoveryIntakeItemProduct(
      { itemId: ids.eligibleItem, productId: ids.eligibleProduct },
      raced.client,
    ),
    false,
  )
})
