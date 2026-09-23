import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { createDiscoveryIntakeRemainingNoneHandler } from "../src/app/api/beratung/intake/remaining-none/route"
import { DiscoveryIntakeChecklist } from "../src/components/discovery/intake/discovery-intake-checklist"
import type { DiscoveryIntakeItemView } from "../src/components/discovery/intake/types"
import type { DiscoveryEnrollment } from "../src/lib/discovery/enrollment"
import {
  DISCOVERY_INTAKE_CATEGORIES,
  insertDiscoveryIntakeNoneItems,
  type DiscoveryAdminClient,
  type DiscoveryIntake,
  type DiscoveryIntakeCategory,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/intake"

/**
 * „Mehr benutze ich nicht" — the bulk answer for the rest of the shelf.
 *
 * Three layers, each proven on its own:
 *   1. the endpoint: the shared guard chain (driven for real, like
 *      `discovery-intake-api.test.ts`), the freeze, and the rule that ONLY
 *      categories with no answer at all are touched;
 *   2. the write: one insert, `none`-shaped rows the real migration accepts;
 *   3. the overview: when the action is offered, and the whole journey
 *      3 products → bulk → 10/10 → „Absenden" (never an auto-submit).
 */

const ids = {
  enrollment: "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e",
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  otherUser: "20000000-0000-4000-8000-000000000003",
  product: "20000000-0000-4000-8000-000000000009",
}

const enrollment: DiscoveryEnrollment = {
  enrollmentId: ids.enrollment,
  name: "Lea Sommer",
  email: "lea@example.test",
  tokenVersion: 1,
  claimedUserId: ids.user,
  claimedAt: "2026-09-22T10:00:00.000Z",
  createdAt: "2026-09-22T09:00:00.000Z",
}

const draftIntake: DiscoveryIntake = {
  id: ids.intake,
  enrollmentId: ids.enrollment,
  userId: ids.user,
  state: "draft",
  submittedAt: null,
}

function item(
  category: DiscoveryIntakeCategory,
  source: DiscoveryIntakeItem["source"],
  id = `item-${category}-${source}`,
): DiscoveryIntakeItem {
  const none = source === "none"
  return {
    id,
    category,
    source,
    brandText: none ? null : "Balea",
    productNameText: none ? null : `Balea ${category}`,
    barcodeIdentifier: null,
    productId: none ? null : ids.product,
    productSubmissionId: null,
  }
}

type Deps = Record<string, unknown>

function baseDeps(overrides: Deps = {}): Deps {
  return {
    flagEnabled: () => true,
    getUserId: async () => ids.user,
    loadEnrollment: async (userId: string) =>
      userId === enrollment.claimedUserId ? enrollment : null,
    createAdminClient: () => ({}) as never,
    getOrCreateIntake: async () => draftIntake,
    loadItems: async () => [item("shampoo", "catalog_search")],
    insertNoneItems: async (input: { categories: DiscoveryIntakeCategory[] }) =>
      input.categories.map((category) => item(category, "none")),
    ...overrides,
  }
}

const call = (deps: Deps) => createDiscoveryIntakeRemainingNoneHandler(deps)()

const mustNotWrite = async () => {
  throw new Error("must not be reached")
}

// --- 1. The endpoint ----------------------------------------------------------

test("remaining-none refuses a signed-out caller with 401", async () => {
  const response = await call(baseDeps({ getUserId: async () => null }))
  assert.equal(response.status, 401)
})

test("remaining-none answers 404 for an account with no live enrollment", async () => {
  const response = await call(
    baseDeps({ loadEnrollment: async () => null, insertNoneItems: mustNotWrite }),
  )
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { code: "not_enrolled" })
})

test("remaining-none answers 403 when the intake belongs to another account", async () => {
  const response = await call(
    baseDeps({
      getOrCreateIntake: async () => ({ ...draftIntake, userId: ids.otherUser }),
      loadItems: mustNotWrite,
      insertNoneItems: mustNotWrite,
    }),
  )
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { code: "forbidden" })
})

test("remaining-none answers 403 for an enrollment claimed by someone else", async () => {
  const response = await call(
    baseDeps({
      loadEnrollment: async () => ({ ...enrollment, claimedUserId: ids.otherUser }),
      insertNoneItems: mustNotWrite,
    }),
  )
  assert.equal(response.status, 403)
})

test("remaining-none is refused with 409 once the intake is submitted", async () => {
  const response = await call(
    baseDeps({
      getOrCreateIntake: async () => ({
        ...draftIntake,
        state: "submitted" as const,
        submittedAt: "2026-09-22T12:00:00.000Z",
      }),
      loadItems: mustNotWrite,
      insertNoneItems: mustNotWrite,
    }),
  )
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { code: "already_submitted" })
})

test("remaining-none is inert while the kill switch is off", async () => {
  const response = await call(baseDeps({ flagEnabled: () => false, insertNoneItems: mustNotWrite }))
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { code: "unavailable" })
})

test("only categories with NO answer are touched — products and a standing none stay", async () => {
  const stored = [
    item("shampoo", "catalog_search"),
    item("shampoo", "barcode", "second-shampoo"),
    item("mask", "none"),
    item("oil", "dm_search"),
  ]
  const asked: Array<{ intakeId: string; categories: DiscoveryIntakeCategory[] }> = []
  const response = await call(
    baseDeps({
      loadItems: async () => stored,
      insertNoneItems: async (input: {
        intakeId: string
        categories: DiscoveryIntakeCategory[]
      }) => {
        asked.push(input)
        return input.categories.map((category) => item(category, "none"))
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.equal(asked.length, 1, "one write, not one per category")
  assert.equal(asked[0].intakeId, ids.intake)
  assert.deepEqual(
    asked[0].categories,
    DISCOVERY_INTAKE_CATEGORIES.filter(
      (category) => !["shampoo", "mask", "oil"].includes(category),
    ),
  )

  const body = (await response.json()) as { items: DiscoveryIntakeItemView[] }
  // The answer is the WHOLE list: the four stored rows untouched, then the new ones.
  assert.deepEqual(
    body.items.slice(0, 4).map((row) => row.id),
    stored.map((row) => row.id),
  )
  assert.equal(new Set(body.items.map((row) => row.category)).size, 10)
  // Browser projection only — the catalog identity stays on the server.
  for (const row of body.items) {
    assert.deepEqual(Object.keys(row).sort(), [
      "barcodeIdentifier",
      "brandText",
      "category",
      "id",
      "imageUrl",
      "productLine",
      "productNameText",
      "source",
    ])
  }
})

test("an intake with nothing answered has no „rest“ — 400 and no write", async () => {
  const response = await call(
    baseDeps({ loadItems: async () => [], insertNoneItems: mustNotWrite }),
  )
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { code: "nothing_answered" })
})

test("a failing write is a 503, never a silent success", async () => {
  const response = await call(
    baseDeps({
      insertNoneItems: async () => {
        throw new Error("postgres is down")
      },
    }),
  )
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { code: "unavailable" })
})

// --- 2. The write --------------------------------------------------------------

function recordingClient() {
  const calls: Array<{ table: string; rows: unknown[]; select: string }> = []
  const client = {
    from: (table: string) => ({
      insert: (rows: Array<Record<string, unknown>>) => ({
        select: async (columns: string) => {
          calls.push({ table, rows, select: columns })
          return {
            data: rows.map((row, index) => ({ ...row, id: `new-${index}`, created_at: "now" })),
            error: null,
          }
        },
      }),
    }),
  } as unknown as DiscoveryAdminClient
  return { client, calls }
}

test("the bulk write is ONE insert of none-shaped rows", async () => {
  const { client, calls } = recordingClient()
  const stored = await insertDiscoveryIntakeNoneItems(
    { intakeId: ids.intake, categories: ["oil", "dry_shampoo"] },
    client,
  )

  assert.equal(calls.length, 1)
  assert.equal(calls[0].table, "discovery_intake_items")
  assert.deepEqual(calls[0].rows, [
    {
      intake_id: ids.intake,
      category: "oil",
      source: "none",
      brand_text: null,
      product_name_text: null,
      barcode_identifier: null,
      product_id: null,
      product_submission_id: null,
    },
    {
      intake_id: ids.intake,
      category: "dry_shampoo",
      source: "none",
      brand_text: null,
      product_name_text: null,
      barcode_identifier: null,
      product_id: null,
      product_submission_id: null,
    },
  ])
  assert.deepEqual(
    stored.map((row) => [row.category, row.source]),
    [
      ["oil", "none"],
      ["dry_shampoo", "none"],
    ],
  )
})

test("nothing open means no write at all", async () => {
  const client = {
    from: () => {
      throw new Error("must not be reached")
    },
  } as unknown as DiscoveryAdminClient
  assert.deepEqual(
    await insertDiscoveryIntakeNoneItems({ intakeId: ids.intake, categories: [] }, client),
    [],
  )
})

test("the bulk rows are accepted by the real migration next to existing answers", async (t) => {
  const pg = new PGlite()
  t.after(async () => pg.close())
  await pg.exec(`
    CREATE SCHEMA auth;
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at = pg_catalog.now(); RETURN NEW; END;
    $$;
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, email text NOT NULL);
    CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);
    CREATE TABLE public.product_submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  `)
  await pg.exec(
    await readFile("supabase/migrations/20260922120000_discovery_call_toolkit.sql", "utf8"),
  )
  const participant = "10000000-0000-4000-8000-000000000001"
  await pg.query("INSERT INTO public.profiles (id, email) VALUES ($1, 'lea@example.test')", [
    participant,
  ])
  await pg.query("INSERT INTO public.products (id, name) VALUES ($1, 'Shampoo')", [ids.product])
  const enrollmentRow = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_enrollments (display_name, normalized_email, claimed_user_id, claimed_at) VALUES ('Lea Sommer', 'lea@example.test', $1, now()) RETURNING id",
    [participant],
  )
  const intakeRow = await pg.query<{ id: string }>(
    "INSERT INTO public.discovery_intakes (enrollment_id, user_id) VALUES ($1, $2) RETURNING id",
    [enrollmentRow.rows[0].id, participant],
  )
  const intakeId = intakeRow.rows[0].id
  // Existing answers: a product under shampoo, „benutze ich nicht" under mask.
  await pg.query(
    `INSERT INTO public.discovery_intake_items (intake_id, category, source, product_name_text, product_id)
     VALUES ($1, 'shampoo', 'catalog_search', 'Shampoo', $2)`,
    [intakeId, ids.product],
  )
  await pg.query(
    "INSERT INTO public.discovery_intake_items (intake_id, category, source) VALUES ($1, 'mask', 'none')",
    [intakeId],
  )

  const open = DISCOVERY_INTAKE_CATEGORIES.filter(
    (category) => category !== "shampoo" && category !== "mask",
  )
  const { client, calls } = recordingClient()
  await insertDiscoveryIntakeNoneItems({ intakeId, categories: open }, client)

  for (const row of calls[0].rows as Array<Record<string, unknown>>) {
    await pg.query(
      `INSERT INTO public.discovery_intake_items
         (intake_id, category, source, brand_text, product_name_text, barcode_identifier, product_id, product_submission_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        row.intake_id,
        row.category,
        row.source,
        row.brand_text,
        row.product_name_text,
        row.barcode_identifier,
        row.product_id,
        row.product_submission_id,
      ],
    )
  }

  const answered = await pg.query<{ category: string; sources: string }>(
    `SELECT category, string_agg(source, ',' ORDER BY source) AS sources
       FROM public.discovery_intake_items WHERE intake_id = $1 GROUP BY category`,
    [intakeId],
  )
  assert.equal(answered.rows.length, 10)
  const byCategory = Object.fromEntries(answered.rows.map((row) => [row.category, row.sources]))
  // The two standing answers are exactly what they were — no second none under mask.
  assert.equal(byCategory.shampoo, "catalog_search")
  assert.equal(byCategory.mask, "none")
  for (const category of open) assert.equal(byCategory[category], "none")
})

// --- 3. The overview -------------------------------------------------------------

function view(
  category: DiscoveryIntakeCategory,
  source: DiscoveryIntakeItemView["source"] = "catalog_search",
): DiscoveryIntakeItemView {
  const none = source === "none"
  return {
    id: `view-${category}-${source}`,
    category,
    source,
    brandText: none ? null : "Balea",
    productNameText: none ? null : `Balea ${category}`,
    barcodeIdentifier: null,
  }
}

const REST_LABEL = "Mehr benutze ich nicht"

function overview(items: DiscoveryIntakeItemView[]) {
  return renderToStaticMarkup(
    <DiscoveryIntakeChecklist
      initialItems={items}
      initialSubmitted={false}
      retailerSearchEnabled={false}
    />,
  )
}

test("the bulk action is hidden while nothing is answered", () => {
  const html = overview([])
  assert.match(html, /0 von 10/)
  assert.doesNotMatch(html, new RegExp(REST_LABEL))
})

test("the bulk action is offered once something is answered and something is open", () => {
  const html = overview([view("shampoo"), view("mask", "none")])
  assert.match(html, /2 von 10/)
  assert.match(html, new RegExp(`>${REST_LABEL}<`))
  // It sits under the list, and there is still no „Absenden" dock.
  assert.ok(html.indexOf(REST_LABEL) > html.indexOf("Trockenshampoo"))
  assert.doesNotMatch(html, />Absenden</)
})

test("the bulk action is hidden once every category is answered", () => {
  const html = overview(DISCOVERY_INTAKE_CATEGORIES.map((category) => view(category)))
  assert.match(html, /10 von 10/)
  assert.doesNotMatch(html, new RegExp(REST_LABEL))
  assert.match(html, />Absenden</)
})

// A hand-rolled `useState` dispatcher (no jsdom in this repo — same family as
// `tests/discovery-search-sheet-props.test.tsx`): the checklist is called directly,
// its element tree walked, and its handlers invoked as a tap would.

type AnyElement = ReactElement<Record<string, any>>
type ReactDispatcherInternals = { H: unknown }

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  return childrenOf(node).map(textOf).join("")
}

function findAll(node: ReactNode, predicate: (element: AnyElement) => boolean): AnyElement[] {
  if (!React.isValidElement(node)) return []
  const element = node as AnyElement
  return [
    ...(predicate(element) ? [element] : []),
    ...childrenOf(element).flatMap((child) => findAll(child, predicate)),
  ]
}

function button(tree: ReactNode, label: string): AnyElement | undefined {
  return findAll(tree, (element) => element.type === "button" && textOf(element) === label)[0]
}

function createHarness(render: () => ReactElement) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const values: unknown[] = []
  let cursor = 0
  const dispatcher = {
    useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void] {
      const index = cursor++
      if (values.length <= index) {
        values[index] = typeof initial === "function" ? (initial as () => T)() : initial
      }
      return [
        values[index] as T,
        (next) => {
          values[index] =
            typeof next === "function" ? (next as (previous: T) => T)(values[index] as T) : next
        },
      ]
    },
  }
  return {
    render(): ReactElement {
      cursor = 0
      const previous = internals.H
      internals.H = dispatcher
      try {
        return render()
      } finally {
        internals.H = previous
      }
    },
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

test("3 products → „Mehr benutze ich nicht“ → 10/10 → the participant submits herself", async (t) => {
  const initial = [view("shampoo"), view("conditioner"), view("heat_protectant")]
  const afterBulk = [
    ...initial,
    ...DISCOVERY_INTAKE_CATEGORIES.filter(
      (category) => !["shampoo", "conditioner", "heat_protectant"].includes(category),
    ).map((category) => view(category, "none")),
  ]
  const requests: Array<{ url: string; method: string | undefined }> = []
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    requests.push({ url, method: init?.method })
    const body = url.endsWith("/remaining-none")
      ? { items: afterBulk }
      : { state: "submitted", submittedAt: "2026-09-23T10:00:00.000Z" }
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  }) as typeof fetch

  const harness = createHarness(() =>
    DiscoveryIntakeChecklist({
      initialItems: initial,
      initialSubmitted: false,
      retailerSearchEnabled: false,
    }),
  )

  let tree = harness.render()
  assert.match(textOf(tree), /3 von 10/)
  assert.equal(button(tree, "Absenden"), undefined)
  const rest = button(tree, REST_LABEL)
  assert.ok(rest, "the bulk action is offered")

  rest.props.onClick()
  await settle()
  tree = harness.render()

  // One round-trip, and the state is the server's answer — not a local guess.
  assert.deepEqual(requests, [{ url: "/api/beratung/intake/remaining-none", method: "POST" }])
  assert.match(textOf(tree), /10 von 10/)
  assert.match(textOf(tree), /Alles da\. Schick es ab\./)
  assert.equal(button(tree, REST_LABEL), undefined, "gone once nothing is open")
  // The three products keep their brand; the rest read „benutze ich nicht".
  assert.equal((textOf(tree).match(/benutze ich nicht/g) ?? []).length, 7)

  // No auto-submit: „Absenden" is on screen and has not been called.
  const submit = button(tree, "Absenden")
  assert.ok(submit, "the ordinary „Absenden“ dock appears")
  assert.equal(requests.length, 1)

  submit.props.onClick()
  await settle()
  tree = harness.render()
  assert.deepEqual(requests[1], { url: "/api/beratung/intake/submit", method: "POST" })
  assert.match(textOf(tree), /Danke!/)
})

test("a failed bulk write keeps the list as it was and says so", async (t) => {
  const initial = [view("shampoo")]
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  globalThis.fetch = (async () =>
    ({
      ok: false,
      status: 503,
      json: async () => ({ code: "unavailable" }),
    }) as unknown as Response) as typeof fetch

  const harness = createHarness(() =>
    DiscoveryIntakeChecklist({
      initialItems: initial,
      initialSubmitted: false,
      retailerSearchEnabled: false,
    }),
  )
  let tree = harness.render()
  button(tree, REST_LABEL)!.props.onClick()
  await settle()
  tree = harness.render()

  assert.match(textOf(tree), /1 von 10/)
  assert.match(textOf(tree), /Das hat gerade nicht geklappt\. Versuch es nochmal\./)
  // Still offered, so the participant can simply tap again.
  assert.ok(button(tree, REST_LABEL))
})

test("while the bulk answer is in flight, no category can be opened and it cannot be re-tapped", async (t) => {
  const initial = [view("shampoo")]
  let release: () => void = () => {}
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  globalThis.fetch = (() =>
    new Promise<Response>((resolve) => {
      release = () =>
        resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              ...initial,
              ...DISCOVERY_INTAKE_CATEGORIES.filter((category) => category !== "shampoo").map(
                (category) => view(category, "none"),
              ),
            ],
          }),
        } as unknown as Response)
    })) as typeof fetch

  const harness = createHarness(() =>
    DiscoveryIntakeChecklist({
      initialItems: initial,
      initialSubmitted: false,
      retailerSearchEnabled: false,
    }),
  )
  const categoryRows = (tree: ReactNode) =>
    findAll(tree, (element) => element.type === "button" && textOf(element) !== REST_LABEL)

  let tree = harness.render()
  assert.equal(categoryRows(tree).length, 10)
  assert.ok(categoryRows(tree).every((row) => !row.props.disabled))

  button(tree, REST_LABEL)!.props.onClick()
  tree = harness.render()
  // A product captured now would be overwritten by the response, so the rows are shut.
  assert.ok(categoryRows(tree).every((row) => row.props.disabled === true))
  assert.equal(button(tree, REST_LABEL)!.props.disabled, true)

  release()
  await settle()
  tree = harness.render()
  assert.match(textOf(tree), /10 von 10/)
  assert.ok(categoryRows(tree).every((row) => !row.props.disabled))
})
