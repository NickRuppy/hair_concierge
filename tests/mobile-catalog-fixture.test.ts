import assert from "node:assert/strict"
import test from "node:test"
import {
  buildMobileCatalogFixture,
  buildMobileCatalogFixtureSql,
  seedMobileCatalogFixture,
} from "../scripts/mobile/catalog-fixture"
import { validateEanInput } from "../src/lib/scan/identifier-lookup"
import { applicationGuidanceProtocolSchema } from "../src/lib/routines/personal-plan/application/contracts"
import { productApplicationPointerV2Schema } from "../src/lib/routines/personal-plan/application/contracts-v2"

test("six synthetic products include valid exact V1 and V2 contracts plus schema-valid eligibility", () => {
  const fixture = buildMobileCatalogFixture()
  assert.equal(fixture.products.length, 6)
  assert.equal(fixture.identifiers.length, 6)
  assert.equal(fixture.protocols.length, 6)
  for (const identifier of fixture.identifiers)
    assert.equal(validateEanInput(identifier.identifier_value).ok, true)
  for (const protocol of fixture.protocols) {
    const v1 = applicationGuidanceProtocolSchema.parse(protocol.guidance_payload)
    const v2 = productApplicationPointerV2Schema.parse(protocol.guidance_payload_v2)
    assert.deepEqual(v1.scope, v2.scope)
    assert.equal(v2.runtimeBlockerCode, null)
    assert.equal(v2.sourceRole, protocol.role)
    assert.ok(v1.evidence.some((e) => e.sourceUrl === protocol.source_url))
    assert.equal(v1.evidence[0].sourceType, "internal_authority")
    assert.match(protocol.source_text, /synthetisch/i)
  }
  assert.equal(fixture.conditionerSpecs.length, 9)
  assert.ok(fixture.conditionerSpecs.every((row) => row.protein_moisture_balance === "snaps"))
  assert.equal(fixture.shampooSpecs.length, 9)
})

test("single SQL transaction explicitly verifies real publication gates before commit", () => {
  const sql = buildMobileCatalogFixtureSql()
  assert.ok(sql.startsWith("BEGIN;"))
  assert.ok(sql.trimEnd().endsWith("COMMIT;"))
  assert.match(sql, /assert_personal_plan_curated_publication/)
  assert.match(sql, /product_application_protocols/)
  assert.match(sql, /SET CONSTRAINTS ALL IMMEDIATE/)
  assert.doesNotMatch(
    sql,
    /DISABLE TRIGGER|session_replication_role|DROP CONSTRAINT|CREATE (?:OR REPLACE )?FUNCTION|DELETE FROM/i,
  )
  assert.match(sql, /mobile_catalog_fixture_identity_collision/)
})

test("local wrapper executes exactly one transaction, refuses remote targets and propagates failure", async () => {
  const calls: string[] = []
  const result = await seedMobileCatalogFixture({
    databaseUrl: "postgresql://127.0.0.1:54322/postgres",
    executeTransaction: async (sql) => {
      calls.push(sql)
    },
  })
  assert.equal(calls.length, 1)
  assert.equal(result.productIds.length, 6)
  await assert.rejects(
    seedMobileCatalogFixture({
      databaseUrl: "postgresql://production.example.test:54322/postgres",
      executeTransaction: async () => {
        throw new Error("must not run")
      },
    }),
    /requires_isolated_local_database/,
  )
  await assert.rejects(
    seedMobileCatalogFixture({
      databaseUrl: "postgresql://127.0.0.1:54322/postgres",
      executeTransaction: async () => {
        throw new Error("transaction failed")
      },
    }),
    /transaction failed/,
  )
})
