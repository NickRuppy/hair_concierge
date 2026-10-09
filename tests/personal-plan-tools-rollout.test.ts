import assert from "node:assert/strict"
import test from "node:test"

import {
  canAccessPersonalPlanTools,
  resolvePersonalPlanToolsRollout,
} from "@/lib/personal-plan/release"
import { isPersonalPlanToolsEnabledForUser } from "@/lib/personal-plan/rollout-access"

function resolve(value: string | undefined) {
  return resolvePersonalPlanToolsRollout(
    value === undefined ? {} : { PERSONAL_PLAN_TOOLS_ROLLOUT: value },
  )
}

test("off is the default and every invalid value fails closed", () => {
  for (const value of [undefined, "", "1", "true", "ALL", "ADMIN", "Admin", "on", "internal"]) {
    assert.equal(resolve(value), "off", `${String(value)} must fail closed`)
  }
  assert.equal(resolve("all"), "all")
  assert.equal(resolve("admin"), "admin")
  assert.equal(resolve(" admin "), "admin", "surrounding whitespace is trimmed, case is not")
})

test("admin serves only admins and never a browser claim", () => {
  assert.equal(canAccessPersonalPlanTools({ rollout: "admin", isAdmin: false }), false)
  assert.equal(canAccessPersonalPlanTools({ rollout: "admin", isAdmin: true }), true)
  assert.equal(canAccessPersonalPlanTools({ rollout: "off", isAdmin: true }), false)
  assert.equal(canAccessPersonalPlanTools({ rollout: "all", isAdmin: false }), true)
})

function adminClient(isAdmin: unknown, error: unknown = null) {
  let reads = 0
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            reads += 1
            return { data: { is_admin: isAdmin }, error }
          },
        }),
      }),
    }),
  }
  return { client: client as never, reads: () => reads }
}

async function withRollout<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const previous = process.env.PERSONAL_PLAN_TOOLS_ROLLOUT
  if (value === undefined) delete process.env.PERSONAL_PLAN_TOOLS_ROLLOUT
  else process.env.PERSONAL_PLAN_TOOLS_ROLLOUT = value
  try {
    return await run()
  } finally {
    if (previous === undefined) delete process.env.PERSONAL_PLAN_TOOLS_ROLLOUT
    else process.env.PERSONAL_PLAN_TOOLS_ROLLOUT = previous
  }
}

test("unset, off and ALL never enable tools and never read the identity", async () => {
  for (const value of [undefined, "off", "ALL", "true"]) {
    const { client, reads } = adminClient(true)
    assert.equal(
      await withRollout(value, () => isPersonalPlanToolsEnabledForUser("u", client)),
      false,
    )
    assert.equal(reads(), 0)
  }
})

test("all enables tools for everyone", async () => {
  const { client } = adminClient(false)
  assert.equal(await withRollout("all", () => isPersonalPlanToolsEnabledForUser("u", client)), true)
})

test("admin enables tools only for profiles.is_admin", async () => {
  assert.equal(
    await withRollout("admin", () =>
      isPersonalPlanToolsEnabledForUser("u", adminClient(true).client),
    ),
    true,
  )
  assert.equal(
    await withRollout("admin", () =>
      isPersonalPlanToolsEnabledForUser("u", adminClient(false).client),
    ),
    false,
  )
})

test("admin fails closed on a read error, a throwing client or a missing client", async () => {
  assert.equal(
    await withRollout("admin", () =>
      isPersonalPlanToolsEnabledForUser("u", adminClient(true, { message: "boom" }).client),
    ),
    false,
  )
  const throwing = {
    from: () => {
      throw new Error("client exploded")
    },
  } as never
  assert.equal(
    await withRollout("admin", () => isPersonalPlanToolsEnabledForUser("u", throwing)),
    false,
  )
  assert.equal(await withRollout("admin", () => isPersonalPlanToolsEnabledForUser("u")), false)
})
