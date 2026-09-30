import assert from "node:assert/strict"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createHash } from "node:crypto"
import { loadLocalEnvironment, stack } from "./local-stack.mjs"
import { prepareScannerContext, type ScannerSourceRead } from "../../src/lib/scan/scanner-context"
import { MOBILE_PROFILE_GUARD_TABLES } from "./profile-fixture"
import { holdProfileWrite } from "./local-postgres.mjs"

async function main() {
  // Run only after local fixtures/auth sessions and the API on port 3224 are ready.
  // Errors deliberately contain case labels/digests, never session or profile data.
  const environment = loadLocalEnvironment()
  const admin = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  type Session = { userId: string; accessToken: string }
  const sessions = JSON.parse(
    readFileSync(resolve(stack, "integration-sessions.json"), "utf8"),
  ) as {
    free: Session
    detailed: Session
    incomplete: Session
  }
  for (const session of Object.values(sessions)) {
    assert.ok(
      /^[0-9a-f-]{36}$/i.test(session.userId) && typeof session.accessToken === "string",
      "Invalid local session fixture",
    )
  }
  const base = "http://127.0.0.1:3224/api/mobile/v1"
  const digest = (value: unknown) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex")
  const samePrivateValue = (actual: unknown, expected: unknown, label: string) =>
    assert.equal(digest(actual), digest(expected), label)
  const noError = (error: unknown, label: string) => assert.ok(!error, label)
  function errorCode(error: { code?: string } | null, expected: string, label: string) {
    assert.equal(error?.code, expected, label)
  }
  async function get(path: string, session = sessions.free) {
    const response = await fetch(base + path, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    return { status: response.status, body: await response.json() }
  }
  async function scan(productId: string, session = sessions.free) {
    const response = await fetch(base + "/scan/resolve", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId }),
    })
    return { status: response.status, body: await response.json() }
  }
  async function bootstrap(session = sessions.free) {
    const response = await get("/bootstrap", session)
    assert.equal(response.status, 200, "Bootstrap HTTP status")
    assert.equal(response.body.status, "ready", "Bootstrap admission")
    assert.ok(
      typeof response.body.contextRevision === "string",
      "Bootstrap context revision missing",
    )
    return response.body as { status: "ready"; contextRevision: string; profileRevision: string }
  }
  async function paidFingerprint() {
    const rows = []
    for (const table of MOBILE_PROFILE_GUARD_TABLES) {
      const result = await admin
        .from(table)
        .select("*")
        .in("user_id", [sessions.free.userId, sessions.detailed.userId])
      noError(result.error, `Paid guard read failed: ${table}`)
      rows.push([table, (result.data ?? []).sort((a, b) => a.id.localeCompare(b.id))])
    }
    return digest(rows)
  }
  async function readSource(userId: string): Promise<ScannerSourceRead> {
    const result = await admin.rpc("scanner_context_read_source", { p_user_id: userId })
    noError(result.error, "Source read failed")
    assert.ok(result.data && result.data.userId === userId, "Source owner mismatch")
    return result.data as ScannerSourceRead
  }
  function publicationArgs(source: ScannerSourceRead) {
    const prepared = prepareScannerContext(source)
    assert.ok(prepared, "Fixture source must compute")
    return {
      p_user_id: source.userId,
      p_expected_source_revision: source.sourceRevision,
      p_source_hash: prepared.sourceHash,
      p_engine_version: prepared.snapshot.computationVersion,
      p_input_snapshot: {
        source: prepared.source,
        userRefinementAnswers: prepared.userRefinementAnswers,
        assumedQuestionIds: prepared.assumedQuestionIds,
        userRefinementQuestionIds: prepared.userRefinementQuestionIds,
      },
      p_output_snapshot: prepared.snapshot,
      p_snapshot_source: prepared.snapshotSource,
    }
  }
  async function contextState(userId: string) {
    const versions = await admin
      .from("scanner_context_versions")
      .select("*")
      .eq("user_id", userId)
      .order("id")
    const head = await admin.from("scanner_context_heads").select("*").eq("user_id", userId)
    noError(versions.error, "Context version guard read failed")
    noError(head.error, "Context head guard read failed")
    return digest({ versions: versions.data, head: head.data })
  }
  async function readVersion(userId: string, id: string) {
    const result = await admin
      .from("scanner_context_versions")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .single()
    noError(result.error, "Context version missing")
    assert.ok(result.data, "Context version missing")
    return result.data
  }
  async function setThickness(userId: string, thickness: unknown) {
    const result = await admin
      .from("hair_profiles")
      .update({ thickness })
      .eq("user_id", userId)
      .select("user_id")
    noError(result.error, "Profile fixture write failed")
    assert.equal(result.data?.length, 1, "Profile fixture write did not affect exactly one owner")
  }
  function publicClient(session?: Session) {
    return createClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        ...(session
          ? { global: { headers: { Authorization: `Bearer ${session.accessToken}` } } }
          : {}),
      },
    )
  }

  const before = await paidFingerprint()
  // Assert the preservation guard is non-vacuous before relying on its digest.
  for (const table of [
    "personal_plan_routine_versions",
    "personal_plan_portfolio_versions",
    "user_products",
    "billing_subscriptions",
  ]) {
    const result = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", sessions.detailed.userId)
    noError(result.error, `Nonempty paid fixture read failed: ${table}`)
    assert.ok((result.count ?? 0) > 0, `Missing nonempty paid fixture: ${table}`)
  }
  const [one, two] = await Promise.all([bootstrap(), bootstrap()])
  assert.equal(
    one.contextRevision,
    two.contextRevision,
    "Concurrent duplicate publication must converge",
  )
  const duplicateSource = await readSource(sessions.free.userId)
  const duplicateArgs = publicationArgs(duplicateSource)
  const duplicateCount = await admin
    .from("scanner_context_versions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", sessions.free.userId)
    .eq("source_revision", duplicateSource.sourceRevision)
    .eq("source_hash", duplicateArgs.p_source_hash)
    .eq("engine_version", duplicateArgs.p_engine_version)
  noError(duplicateCount.error, "Duplicate version count failed")
  assert.equal(duplicateCount.count, 1, "Exactly one immutable version per source and engine")
  const detailed = await bootstrap(sessions.detailed)
  const detailedSource = await readSource(sessions.detailed.userId)
  assert.ok(detailedSource.refined, "Detailed fixture needs an immutable refined source")
  const detailedVersion = await readVersion(sessions.detailed.userId, detailed.contextRevision)
  assert.equal(detailedVersion.snapshot_source, "refined", "Detailed source must remain refined")
  samePrivateValue(
    detailedVersion.output_snapshot.decisions,
    detailedSource.refined.output_snapshot.decisions,
    "Every compatible paid category decision must survive scanner publication",
  )
  const profile = await get("/profile")
  assert.equal(profile.status, 200, "Profile HTTP status")
  assert.ok(profile.body.answers.length >= 10, "Saved profile answer coverage")
  const result = await scan("10000000-0000-4000-8000-000000000001")
  assert.equal(result.status, 200, "Scan HTTP status")
  assert.equal(result.body.kind, "assessment", "Scan result kind")
  assert.ok(
    result.body.rows.length >= 3 && result.body.alternatives.length >= 1,
    "Connected assessment completeness",
  )
  assert.equal(
    result.body.product.id,
    "10000000-0000-4000-8000-000000000001",
    "Exact product identity",
  )
  assert.ok(!("savedState" in result.body), "Native result must not include saves")
  const incomplete = await get("/bootstrap", sessions.incomplete)
  assert.equal(incomplete.status, 200, "Incomplete profile bootstrap HTTP status")
  assert.equal(
    incomplete.body.status,
    "profile_required",
    "Incomplete profile is distinct from a failed source",
  )
  assert.equal(
    (await scan(result.body.product.id, sessions.incomplete)).body.kind,
    "profile_required",
    "Incomplete scan denial",
  )
  const found = await get("/scan/search?q=Chaarlie%20Local")
  assert.ok(
    found.body.results.some((product: { id: string }) => product.id === result.body.product.id),
    "Seeded catalog search",
  )
  assert.equal(await paidFingerprint(), before, "Read-only connected journey changed paid state")

  // Service-role UPDATE cannot mutate an immutable version. Same-key publication
  // with a different payload must not silently re-use or overwrite it either.
  const immutableBefore = await contextState(sessions.free.userId)
  const immutable = await admin
    .from("scanner_context_versions")
    .update({ source_hash: "f".repeat(64) })
    .eq("id", one.contextRevision)
  errorCode(immutable.error, "P0001", "Immutable UPDATE must fail in the database")
  assert.ok(
    immutable.error?.message.includes("scanner_context_version_immutable"),
    "Wrong immutable failure",
  )
  for (const collision of [
    { ...duplicateArgs, p_input_snapshot: { ...duplicateArgs.p_input_snapshot, unexpected: true } },
    {
      ...duplicateArgs,
      p_output_snapshot: {
        ...duplicateArgs.p_output_snapshot,
        createdAt: "2000-01-01T00:00:00.000Z",
      },
    },
  ]) {
    const response = await admin.rpc("scanner_context_publish", collision)
    errorCode(response.error, "P0001", "Same-key altered publication must fail")
    assert.ok(
      response.error?.message.includes("scanner_context_input_collision"),
      "Wrong collision failure",
    )
    assert.equal(
      await contextState(sessions.free.userId),
      immutableBefore,
      "Rejected publication changed a context/head",
    )
  }

  // ABA: restore the original answer BEFORE the fresh bootstrap. Equal answer
  // bytes cannot revive the originally captured source revision.
  const abaSource = await readSource(sessions.free.userId)
  assert.equal(abaSource.profile?.thickness, "fine", "Free fixture starts fine")
  const abaBefore = await contextState(sessions.free.userId)
  try {
    await setThickness(sessions.free.userId, "coarse")
    await setThickness(sessions.free.userId, "fine")
    const afterABA = await readSource(sessions.free.userId)
    assert.equal(
      BigInt(afterABA.profileRevision),
      BigInt(abaSource.profileRevision) + BigInt(2),
      "ABA must advance the profile revision twice",
    )
    const stale = await admin.rpc("scanner_context_publish", publicationArgs(abaSource))
    noError(stale.error, "Stale-source RPC execution failed")
    assert.equal(stale.data.outcome, "stale_source", "ABA must reject the old revision")
    assert.equal(
      await contextState(sessions.free.userId),
      abaBefore,
      "Stale attempt must not insert or move the head",
    )
    const refreshed = await bootstrap()
    assert.notEqual(
      refreshed.contextRevision,
      one.contextRevision,
      "ABA needs a fresh immutable context",
    )
    assert.equal(
      refreshed.profileRevision,
      afterABA.profileRevision,
      "Bootstrap profile revision after ABA",
    )
    const version = await readVersion(sessions.free.userId, refreshed.contextRevision)
    assert.equal(
      version.output_snapshot.profile.hair.thickness,
      "fine",
      "Fresh context uses the restored answer",
    )
  } finally {
    await setThickness(sessions.free.userId, abaSource.profile!.thickness)
  }

  // Two real database transactions: publication waits for the source clock,
  // rejects the old revision after COMMIT, and can reuse it after ROLLBACK.
  for (const commit of [false, true]) {
    const source = await readSource(sessions.free.userId)
    const held = await holdProfileWrite(sessions.free.userId, "coarse")
    let settled = false
    const publication = Promise.resolve(
      admin.rpc("scanner_context_publish", publicationArgs(source)),
    ).then((result) => {
      settled = true
      return result
    })
    try {
      await new Promise((resolve) => setTimeout(resolve, 200))
      assert.equal(settled, false, "Publication must wait for an uncommitted source write")
      await held.finish(commit)
      const outcome = await publication
      noError(outcome.error, "Concurrent publication failed")
      assert.equal(
        outcome.data.outcome,
        commit ? "stale_source" : "ready",
        "Transaction clock linearization",
      )
    } finally {
      await held.finish(false)
      await publication
      await setThickness(sessions.free.userId, "fine")
    }
  }

  // The stronger D2 case: an old paid snapshot remains physically unchanged while
  // scanner context follows changed shared basics and retains explicit habits.
  const originalDetailedThickness = detailedSource.profile!.thickness
  try {
    await setThickness(sessions.detailed.userId, "coarse")
    const changed = await bootstrap(sessions.detailed)
    assert.notEqual(
      changed.contextRevision,
      detailed.contextRevision,
      "Detailed edit needs a new context",
    )
    const version = await readVersion(sessions.detailed.userId, changed.contextRevision)
    assert.equal(
      version.output_snapshot.profile.hair.thickness,
      "coarse",
      "Paid snapshot must not roll shared basics back",
    )
    samePrivateValue(
      version.output_snapshot.profile.routine.shampooFrequency,
      detailedVersion.output_snapshot.profile.routine.shampooFrequency,
      "Explicit wash frequency was lost",
    )
    samePrivateValue(
      version.output_snapshot.profile.routine.heatToolUse,
      detailedVersion.output_snapshot.profile.routine.heatToolUse,
      "Explicit heat events were lost",
    )
    samePrivateValue(
      version.input_snapshot.userRefinementAnswers,
      detailedVersion.input_snapshot.userRefinementAnswers,
      "Explicit refined answers were lost",
    )
    assert.equal(
      await paidFingerprint(),
      before,
      "Detailed profile reconciliation changed paid/routine/billing state",
    )
  } finally {
    await setThickness(sessions.detailed.userId, originalDetailedThickness)
  }
  const restoredDetailed = await bootstrap(sessions.detailed)
  const restoredVersion = await readVersion(
    sessions.detailed.userId,
    restoredDetailed.contextRevision,
  )
  samePrivateValue(
    restoredVersion.output_snapshot.decisions,
    detailedVersion.output_snapshot.decisions,
    "Restored shared profile changed paid decision parity",
  )

  // Retryable source/provenance ambiguity without rewriting any existing paid
  // row: insert a temporary duplicate terminal provenance source, then remove ONLY
  // that exact local row in finally. Original fields/timestamps remain identical.
  // This exercises actual API503 and no publication, not just a mocked throw.
  const fixtureDraft = await admin
    .from("personal_plan_refinement_drafts")
    .select("*")
    .eq("user_id", sessions.detailed.userId)
    .eq("result_refined_need_version_id", detailedSource.refined!.id)
    .single()
  noError(fixtureDraft.error, "Detailed provenance fixture missing")
  assert.ok(fixtureDraft.data, "Detailed provenance fixture missing")
  const temporaryDraftId = "00000000-0000-4000-8200-000000000099"
  const duplicateDraft = { ...fixtureDraft.data, id: temporaryDraftId }
  const failureBefore = await contextState(sessions.detailed.userId)
  let insertedTemporaryDraft = false
  try {
    const inserted = await admin.from("personal_plan_refinement_drafts").insert(duplicateDraft)
    noError(inserted.error, "Unable to stage local source ambiguity")
    insertedTemporaryDraft = true
    const failed = await get("/bootstrap", sessions.detailed)
    assert.equal(failed.status, 503, "Ambiguous provenance must be retryable")
    assert.equal(
      failed.body.status,
      "temporarily_unavailable",
      "Source failure must not become profile_required",
    )
    const failedProfile = await get("/profile", sessions.detailed)
    assert.equal(failedProfile.status, 503, "Profile source failure must be retryable")
    assert.equal(failedProfile.body.error, "temporarily_unavailable", "Profile source failure code")
    assert.equal(
      await contextState(sessions.detailed.userId),
      failureBefore,
      "Failed source read/compute published partial context",
    )
  } finally {
    if (insertedTemporaryDraft) {
      const removed = await admin
        .from("personal_plan_refinement_drafts")
        .delete()
        .eq("id", temporaryDraftId)
        .eq("user_id", sessions.detailed.userId)
        .select("id")
      noError(removed.error, "Temporary provenance cleanup failed")
      assert.equal(
        removed.data?.length,
        1,
        "Temporary provenance cleanup must delete exactly its own row",
      )
    }
  }
  assert.equal(
    await paidFingerprint(),
    before,
    "Provenance recovery did not restore exact paid state",
  )
  await bootstrap(sessions.detailed)

  // Data API permissions: test positive own reads as well as all denied write
  // operations. A foreign empty result alone could mean every read was broken.
  const ownerClient = publicClient(sessions.free)
  const anonClient = publicClient()
  const ownerVersion = await ownerClient
    .from("scanner_context_versions")
    .select("id")
    .eq("user_id", sessions.free.userId)
  noError(ownerVersion.error, "Owner version SELECT must work")
  assert.ok((ownerVersion.data?.length ?? 0) > 0, "Owner version SELECT returned no owned data")
  for (const table of ["scanner_context_versions", "scanner_context_heads"]) {
    const foreign = await ownerClient
      .from(table)
      .select("user_id")
      .eq("user_id", sessions.detailed.userId)
    noError(foreign.error, `Foreign ${table} SELECT should be filtered by RLS`)
    assert.equal(foreign.data?.length, 0, `Foreign ${table} rows leaked`)
    errorCode(
      (await anonClient.from(table).select("user_id")).error,
      "42501",
      `Anon ${table} SELECT must be denied`,
    )
  }
  const permissionSource = await readSource(sessions.free.userId)
  const permissionArgs = publicationArgs(permissionSource)
  const permissionBefore = await contextState(sessions.free.userId)
  const denied = async (client: SupabaseClient, userId: string) => {
    errorCode(
      (await client.rpc("scanner_context_read_source", { p_user_id: userId })).error,
      "42501",
      "Public source-read RPC must be denied",
    )
    errorCode(
      (await client.rpc("scanner_context_publish", { ...permissionArgs, p_user_id: userId })).error,
      "42501",
      "Public publication RPC must be denied",
    )
  }
  await denied(ownerClient, sessions.free.userId)
  await denied(ownerClient, sessions.detailed.userId)
  await denied(anonClient, sessions.free.userId)
  const insertion = {
    user_id: sessions.free.userId,
    source_revision: permissionSource.sourceRevision,
    profile_revision: permissionSource.profileRevision,
    source_hash: permissionArgs.p_source_hash,
    engine_version: permissionArgs.p_engine_version,
    snapshot_source: permissionArgs.p_snapshot_source,
    input_snapshot: permissionArgs.p_input_snapshot,
    output_snapshot: permissionArgs.p_output_snapshot,
  }
  errorCode(
    (await ownerClient.from("scanner_context_versions").insert(insertion)).error,
    "42501",
    "Authenticated version INSERT must be denied",
  )
  errorCode(
    (
      await ownerClient
        .from("scanner_context_versions")
        .update({ source_hash: "e".repeat(64) })
        .eq("user_id", sessions.free.userId)
    ).error,
    "42501",
    "Authenticated version UPDATE must be denied",
  )
  errorCode(
    (
      await ownerClient
        .from("scanner_context_versions")
        .delete()
        .eq("user_id", sessions.free.userId)
    ).error,
    "42501",
    "Authenticated version DELETE must be denied",
  )
  errorCode(
    (
      await ownerClient
        .from("scanner_context_heads")
        .upsert({ user_id: sessions.free.userId, context_version_id: detailed.contextRevision })
    ).error,
    "42501",
    "Authenticated head write must be denied",
  )
  errorCode(
    (await ownerClient.from("scanner_context_heads").delete().eq("user_id", sessions.free.userId))
      .error,
    "42501",
    "Authenticated head DELETE must be denied",
  )
  errorCode(
    (
      await ownerClient
        .from("scanner_context_sources")
        .update({ revision: 0 })
        .eq("user_id", sessions.free.userId)
    ).error,
    "42501",
    "Authenticated source-clock UPDATE must be denied",
  )
  errorCode(
    (await ownerClient.from("scanner_context_sources").insert({ user_id: sessions.free.userId }))
      .error,
    "42501",
    "Authenticated source-clock INSERT must be denied",
  )
  errorCode(
    (await ownerClient.from("scanner_context_sources").delete().eq("user_id", sessions.free.userId))
      .error,
    "42501",
    "Authenticated source-clock DELETE must be denied",
  )
  assert.equal(
    await contextState(sessions.free.userId),
    permissionBefore,
    "Denied Data API operations changed context state",
  )
  assert.equal(
    await paidFingerprint(),
    before,
    "Connected context checks changed paid/routine/billing state",
  )
  console.log(
    "PASS real local context: duplicate publication, immutable/collision guards, ABA revisions, detailed-source preservation, retry recovery, RLS/service-only writes, unchanged nonempty paid/routine/billing state.",
  )
  // Still separate: a two-connection held-lock commit/rollback test. The HTTP
  // duplicate + interleaving cases above do not claim that transaction proof.
}

main().catch((error: unknown) => {
  // Do not let AssertionError dump actual/expected profile rows or session data.
  const label =
    error instanceof assert.AssertionError
      ? error.message.split("\n")[0]
      : "Local setup or request failed"
  console.error(`FAIL local context integration: ${label}`)
  process.exitCode = 1
})
