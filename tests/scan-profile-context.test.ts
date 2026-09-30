import assert from "node:assert/strict"
import test from "node:test"
import { loadScanEvaluationContext } from "../src/lib/scan/profile-context"
import { seedMobileProfileFixtures } from "../scripts/mobile/profile-fixture"
import type { ScannerSourceRead } from "../src/lib/scan/scanner-context"

/** Real source builders, RPC boundary only mocked. No production provider. */
async function fixture() {
  const rows: Record<string, Record<string, unknown>[]> = {}
  const client = {
    supabaseUrl: "http://127.0.0.1:54321",
    from(table: string) {
      return {
        async insert(data: Record<string, unknown> | Record<string, unknown>[]) {
          ;(rows[table] ??= []).push(...(Array.isArray(data) ? data : [data]))
          return { error: null }
        },
        update(data: Record<string, unknown>) {
          return {
            async eq(_column: string, id: string) {
              Object.assign(rows[table].find((row) => row.id === id)!, data)
              return { error: null }
            },
          }
        },
      }
    },
  }
  await seedMobileProfileFixtures(client as never, {
    free: "free",
    detailed: "owner",
    incomplete: "incomplete",
  })
  const source = {
    userId: "owner",
    sourceRevision: "3",
    profileRevision: "1",
    profile: rows.hair_profiles[1],
    plan: rows.personal_plans[0],
    initial: rows.personal_plan_need_versions[0],
    refined: rows.personal_plan_need_versions[1],
    refinements: rows.personal_plan_refinement_drafts,
    leads: [],
  } as unknown as ScannerSourceRead
  return source
}
function stubClient(source: ScannerSourceRead) {
  const calls: string[] = []
  return {
    calls,
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push(name)
      assert.equal(args.p_user_id, "owner")
      if (name === "scanner_context_read_source") return { data: source, error: null }
      assert.equal(name, "scanner_context_publish")
      assert.equal(args.p_expected_source_revision, source.sourceRevision)
      return { data: { outcome: "ready", contextRevision: "scanner-version" }, error: null }
    },
  }
}

test("loadScanEvaluationContext: refined source takes precedence and preserves every evaluated category decision", async () => {
  const source = await fixture()
  const context = await loadScanEvaluationContext(stubClient(source) as never, "owner")
  assert.equal(context?.snapshotSource, "refined")
  assert.equal(context?.refinedVersionId, "scanner-version")
  assert.match(context!.refinedInputHash, /^[a-f0-9]{64}$/)
  assert.deepEqual(context?.snapshot.decisions, source.refined!.output_snapshot.decisions)
  assert.deepEqual(
    context?.snapshot.profile.routine,
    source.refined!.output_snapshot.profile.routine,
  )
})

test("loadScanEvaluationContext: initial fallback without refined head preserves initial category decisions", async () => {
  const source = await fixture()
  source.plan!.current_refined_need_version_id = null
  source.refined = null
  const context = await loadScanEvaluationContext(stubClient(source) as never, "owner")
  assert.equal(context?.snapshotSource, "initial")
  assert.deepEqual(context?.snapshot.decisions, source.initial!.output_snapshot.decisions)
})

test("loadScanEvaluationContext: genuinely absent refined source falls back to compatible initial", async () => {
  const source = await fixture()
  source.refined = null
  const context = await loadScanEvaluationContext(stubClient(source) as never, "owner")
  assert.equal(context?.snapshotSource, "initial")
  assert.deepEqual(context?.snapshot.profile.hair, source.initial!.output_snapshot.profile.hair)
})

test("loadScanEvaluationContext: no plan and no completed source is null", async () => {
  const source = await fixture()
  Object.assign(source, { plan: null, initial: null, refined: null, profile: null })
  const client = stubClient(source)
  assert.equal(await loadScanEvaluationContext(client as never, "owner"), null)
  assert.deepEqual(client.calls, ["scanner_context_read_source"])
})

test("loadScanEvaluationContext: plan without need versions or completed source is null", async () => {
  const source = await fixture()
  Object.assign(source.plan!, {
    current_initial_need_version_id: null,
    current_refined_need_version_id: null,
  })
  source.initial = null
  source.refined = null
  assert.equal(await loadScanEvaluationContext(stubClient(source) as never, "owner"), null)
})

test("loadScanEvaluationContext: failed source reads and invalid hashes are retry, never missing profile", async () => {
  await assert.rejects(
    loadScanEvaluationContext(
      { rpc: async () => ({ data: null, error: new Error("read failed") }) } as never,
      "owner",
    ),
    /unavailable/,
  )
  const source = await fixture()
  source.refined!.input_hash = "0".repeat(64)
  await assert.rejects(
    loadScanEvaluationContext(stubClient(source) as never, "owner"),
    /unavailable/,
  )
})
