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

test("Rev. 6: on (all) is the default; only `off` switches it off and `admin` stages it", () => {
  for (const value of [undefined, "", "1", "true", "ALL", "on", "internal", "false"]) {
    assert.equal(resolve(value), "all", `${String(value)} resolves to all`)
  }
  assert.equal(resolve("all"), "all")
  assert.equal(resolve("off"), "off")
  assert.equal(resolve(" off "), "off", "surrounding whitespace is trimmed")
  assert.equal(resolve("admin"), "admin")
  assert.equal(resolve(" admin "), "admin", "surrounding whitespace is trimmed")
  for (const value of ["OFF", "Off", " Off "]) assert.equal(resolve(value), "off", value)
  for (const value of ["ADMIN", "Admin", " Admin "]) assert.equal(resolve(value), "admin", value)
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

test("off never enables tools and never reads the identity", async () => {
  for (const value of ["off", " off "]) {
    const { client, reads } = adminClient(true)
    assert.equal(
      await withRollout(value, () => isPersonalPlanToolsEnabledForUser("u", client)),
      false,
    )
    assert.equal(reads(), 0)
  }
})

test("all — and an unset or unknown value — enables tools for everyone without an identity read", async () => {
  for (const value of ["all", undefined, "", "ALL", "true"]) {
    const { client, reads } = adminClient(false)
    assert.equal(
      await withRollout(value, () => isPersonalPlanToolsEnabledForUser("u", client)),
      true,
      String(value),
    )
    assert.equal(reads(), 0)
  }
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
