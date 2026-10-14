import assert from "node:assert/strict"
import test from "node:test"

import { canApplyPartnerAccess, parsePartnerAccessCommand } from "../scripts/partner-access"

test("partner access CLI is dry-run by default and parses a bounded batch", async () => {
  assert.deepEqual(
    await parsePartnerAccessCommand(["create", "--name=Lea", "--email=lea@example.test"]),
    {
      action: "create",
      apply: false,
      creators: [{ name: "Lea", email: "lea@example.test" }],
    },
  )
  assert.deepEqual(
    await parsePartnerAccessCommand(["create", "--file=creators.json"], async () =>
      JSON.stringify([{ name: "Mia", email: "mia@example.test" }]),
    ),
    {
      action: "create",
      apply: false,
      creators: [{ name: "Mia", email: "mia@example.test" }],
    },
  )
})

test("partner access CLI mutations require all production confirmation gates", () => {
  const args = [
    "revoke",
    "--invitation=10000000-0000-4000-8000-000000000001",
    "--apply",
    "--confirm-project=pqdkhefxsxkyeqelqegq",
  ]
  const environment = {
    NEXT_PUBLIC_SUPABASE_URL: "https://pqdkhefxsxkyeqelqegq.supabase.co",
    ALLOW_PARTNER_ACCESS_PRODUCTION_WRITE: "1",
  }
  assert.equal(canApplyPartnerAccess(args, environment), true)
  assert.equal(
    canApplyPartnerAccess(
      args.filter((arg) => arg !== "--apply"),
      environment,
    ),
    false,
  )
  assert.equal(
    canApplyPartnerAccess(args, { ...environment, ALLOW_PARTNER_ACCESS_PRODUCTION_WRITE: "0" }),
    false,
  )
  assert.equal(
    canApplyPartnerAccess(args, {
      ...environment,
      NEXT_PUBLIC_SUPABASE_URL: "https://wrong.supabase.co",
    }),
    false,
  )
})
