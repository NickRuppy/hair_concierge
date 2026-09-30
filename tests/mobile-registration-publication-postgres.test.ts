import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import {
  completeMobileRegistration,
  completeMobileProfile,
} from "../src/lib/mobile/registration-completion"
import { registrationSubmissionHash } from "../src/lib/mobile/registration-contract"
import { loadSharedScannerContext } from "../src/lib/scan/scanner-context-supabase"
import { quizSupersedesFacts, writeAccountLinkFacts } from "../src/lib/user-facts/account-link"
import { deriveDiagnosticsColumns } from "../src/lib/user-facts/derive-legacy-columns"
import { projectLegacyLeadToFacts } from "../src/lib/user-facts/project-legacy-lead"
import { parseUserFactsRow } from "../src/lib/user-facts/read"
import type { QuizAnswers } from "../src/lib/quiz/types"
import {
  DIAGNOSTICS_COLUMNS,
  leadCreatedAt,
  mobileFactsDatabase,
  pgliteAdminClient,
  pgliteRpcClient,
  readClock,
  readRow,
} from "./mobile-profile-facts-pglite.fixtures"
import {
  legacyMissingProfilePatch,
  legacyMobileEditProfilePatch,
} from "./mobile-legacy-profile-patch.oracle"
import { insertProfile, saveUserFacts } from "./personal-plan-pglite-migration.fixtures"

// Executes the real SQL functions, constraints and triggers on the real schema (clean-switch
// task 4: `mobile_registration_publish` saves through `user_facts_save_v1`). Embedded
// PostgreSQL is not a two-session lock proof; that lane needs Docker (see the task report).
const owner = "11111111-1111-4111-8111-111111111111",
  foreign = "22222222-2222-4222-8222-222222222222"
const answers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  treatment: ["natur"],
  concerns: ["dryness"],
  goals: ["moisture"],
}

type Client = ReturnType<typeof pgliteRpcClient>

/** `cleanSwitch: false` runs the pre-task-4 function; the shim then turns the facts argument
 * back into today's column patch so the OLD behaviour can be measured on the same schema. */
async function fixture(
  t: { after: (fn: () => Promise<void>) => void },
  options: { cleanSwitch?: boolean } = {},
) {
  const db = await mobileFactsDatabase(t, options)
  await insertProfile(db, owner)
  await insertProfile(db, foreign)
  await db.query("update profiles set full_name='Existing' where id=$1", [owner])
  const real = pgliteRpcClient(db)
  const client: Client =
    options.cleanSwitch === false
      ? {
          calls: real.calls,
          async rpc(name: string, args: Record<string, unknown>) {
            if (name !== "mobile_registration_publish") return real.rpc(name, args)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- not in the old signature
            const { p_facts, p_quiz_taken_at, ...rest } = args
            const read = (await real.rpc("scanner_context_read_source", { p_user_id: owner }))
              .data as { profile: Record<string, unknown> | null }
            const quiz = args.p_quiz_answers as QuizAnswers
            const patch =
              args.p_mode === "keep"
                ? {}
                : args.p_mode === "missing"
                  ? p_facts
                    ? legacyMissingProfilePatch(read.profile, quiz).patch
                    : {}
                  : legacyMobileEditProfilePatch(quiz)
            return real.rpc(name, { ...rest, p_patch: patch })
          },
        }
      : real
  async function intent(
    choice: "create" | "replace" | "keep" = "create",
    override: Record<string, unknown> = {},
  ) {
    const submission = {
      requestId: randomUUID(),
      email: "registration@example.test",
      firstName: "New Name",
      marketingOptIn: true,
      answers,
      ...override,
    }
    const attemptId = randomUUID(),
      sendGeneration = randomUUID()
    await db.query(
      `insert into mobile_registration_intents(id,request_id,request_hash,email,send_generation,provider_user_id,verified_user_id,verified_at)values($1,$2,$3,$4,$5,$6,$6,now())`,
      [
        attemptId,
        submission.requestId,
        registrationSubmissionHash(submission as never),
        submission.email,
        sendGeneration,
        owner,
      ],
    )
    const source = (await client.rpc("scanner_context_read_source", { p_user_id: owner })).data as {
      profileRevision: string
    }
    return {
      attemptId,
      sendGeneration,
      submission,
      choice,
      expectedProfileRevision: source.profileRevision,
    }
  }
  return {
    db,
    client,
    calls: real.calls,
    intent,
    complete: async (input: Awaited<ReturnType<typeof intent>>) =>
      completeMobileRegistration(client as never, owner, input.submission.email, input as never),
  }
}

function derived(row: Record<string, unknown>) {
  return Object.fromEntries(DIAGNOSTICS_COLUMNS.map((column) => [column, row[column]]))
}

test("C1/C4 atomic new source, consent, ready enrollment, byte-equal replay and stable later bootstrap", async (t) => {
  const f = await fixture(t)
  const input = await f.intent()
  const result = await f.complete(input)
  assert.equal(result.status, "ready")
  assert.deepEqual(await f.complete(input), result)
  assert.equal((await f.db.query("select * from hair_profiles")).rows.length, 1)
  const leads = (await f.db.query<any>("select * from leads")).rows
  assert.equal(leads.length, 1)
  assert.equal(leads[0].user_id, owner)
  assert.equal(leads[0].marketing_consent, true)
  assert.equal(
    (await f.db.query<any>("select ready_at from mobile_registration_enrollments")).rows[0]
      .ready_at !== null,
    true,
  )
  assert.equal(
    (await f.db.query<any>("select full_name from profiles where id=$1", [owner])).rows[0]
      .full_name,
    "New Name",
  )
  const loaded = await loadSharedScannerContext(f.client as never, owner)
  assert.equal(loaded?.contextRevision, result.contextRevision)
  await f.db.query(
    "update mobile_registration_intents set expires_at=now()-interval '1 second' where id=$1",
    [input.attemptId],
  )
  assert.deepEqual(await f.complete(input), result, "completed receipt survives intent expiry")
  assert.equal((await f.db.query("select * from personal_plans")).rows.length, 0)
})

test("create saves the quiz through the door: facts sourced from the new lead, columns derived", async (t) => {
  const f = await fixture(t)
  await f.complete(await f.intent())
  const row = (await readRow(f.db, owner))!
  const lead = (await f.db.query<any>("select id from leads")).rows[0].id
  const facts = parseUserFactsRow(owner, row)
  assert.equal(row.facts_revision, 1)
  assert.equal(facts.diagnostics?.source.kind, "legacy_quiz")
  assert.equal(facts.diagnostics?.source.leadId, lead)
  assert.ok(facts.diagnostics?.source.takenAt, "the quiz time is when it was taken: now")
  assert.deepEqual(facts.provenance.diagnostics?.source, { kind: "legacy_lead", id: lead })
  assert.equal(facts.provenance.diagnostics?.editedAt, undefined)
  assert.deepEqual(derived(row), deriveDiagnosticsColumns(facts.diagnostics!))
  // The same lead the scanner source and the stored quiz were built from.
  const edit = (await f.db.query<any>("select profile_snapshot from scanner_profile_edits")).rows[0]
  assert.equal(edit.profile_snapshot.facts_revision, 1)
})

test("fix round 1 (E): the iOS quiz and its lead carry one timestamp — a web re-link of that lead is a pure preserve", async (t) => {
  const f = await fixture(t)
  await f.complete(await f.intent())
  const row = (await readRow(f.db, owner))!
  const lead = (await f.db.query<any>("select id, quiz_answers from leads")).rows[0]
  const createdAt = await leadCreatedAt(f.db, lead.id)
  const takenAt = (parseUserFactsRow(owner, row).diagnostics!.source as { takenAt?: string })
    .takenAt!
  assert.equal(Date.parse(createdAt), Date.parse(takenAt), "leads.created_at == source.takenAt")

  const outcome = await writeAccountLinkFacts(pgliteAdminClient(f.db) as never, {
    userId: owner,
    quiz: { kind: "lead", leadId: lead.id, quizAnswers: lead.quiz_answers, createdAt },
  })
  assert.equal(outcome, "preserved")
  const after = (await readRow(f.db, owner))!
  assert.equal(after.facts_revision, row.facts_revision, "no new revision")
  assert.deepEqual(after.diagnostics, row.diagnostics)
})

test("fix round 1 (E): the quiz time is validated — required, equal to the facts' takenAt, never in the future", async (t) => {
  const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  const variants: Array<[string, (args: Record<string, any>) => void]> = [
    ["missing", (args) => (args.p_quiz_taken_at = null)],
    [
      "differs from the facts",
      (args) =>
        (args.p_quiz_taken_at = new Date(Date.parse(args.p_quiz_taken_at) + 1).toISOString()),
    ],
    [
      "in the future",
      (args) => {
        args.p_quiz_taken_at = future
        args.p_facts.diagnostics.patch.source.takenAt = future
      },
    ],
  ]
  for (const [name, mutate] of variants) {
    const f = await fixture(t)
    const input = await f.intent()
    const client = {
      rpc(fn: string, args: Record<string, any>) {
        if (fn === "mobile_registration_publish") {
          args = structuredClone(args)
          mutate(args)
        }
        return f.client.rpc(fn, args)
      },
    }
    await assert.rejects(
      completeMobileRegistration(client as never, owner, input.submission.email, input as never),
      /temporarily_unavailable/,
      name,
    )
    for (const table of ["hair_profiles", "leads", "mobile_registration_publication_receipts"])
      assert.equal((await f.db.query(`select * from ${table}`)).rows.length, 0, `${name}: ${table}`)
  }
})

test("C2 keep preserves profile/source/edit rows, records checkbox without a new lead", async (t) => {
  const f = await fixture(t)
  await f.complete(await f.intent())
  const before = await f.db.query("select * from hair_profiles"),
    leads = await f.db.query("select * from leads"),
    edits = await f.db.query("select * from scanner_profile_edits"),
    clock = await readClock(f.db, owner)
  const input = await f.intent("keep", { marketingOptIn: false })
  await f.complete(input)
  assert.deepEqual(await f.db.query("select * from hair_profiles"), before)
  assert.deepEqual(await f.db.query("select * from leads"), leads)
  assert.deepEqual(await f.db.query("select * from scanner_profile_edits"), edits)
  assert.deepEqual(await readClock(f.db, owner), clock)
  assert.equal(f.calls.at(-1)?.args.p_facts, null, "keep hands no facts to the function")
  const consent = (
    await f.db.query<any>(
      "select consent from mobile_registration_publication_receipts where request_id=$1",
      [input.submission.requestId],
    )
  ).rows[0].consent
  assert.equal(consent.marketingOptIn, false)
})

test("C3/C5 explicit replace leaves paid and unrelated fields intact, changed retry refuses overwrite", async (t) => {
  const f = await fixture(t)
  await f.complete(await f.intent())
  await f.db.query(`update hair_profiles set towel_material='mikrofaser' where user_id=$1`, [owner])
  await f.db.query("insert into personal_plans(id,user_id) values($1,$2)", [randomUUID(), owner])
  const paid = await f.db.query("select * from personal_plans")
  const input = await f.intent("replace", { answers: { ...answers, thickness: "coarse" } })
  const result = await f.complete(input)
  assert.deepEqual(await f.db.query("select * from personal_plans"), paid)
  const row = (await readRow(f.db, owner))!
  assert.equal(row.towel_material, "mikrofaser")
  assert.equal(row.thickness, "coarse")
  await assert.rejects(
    f.complete({ ...input, submission: { ...input.submission, marketingOptIn: false } }),
    /invalid_attempt/,
  )
  await assert.rejects(f.complete({ ...input, choice: "keep" }), /profile_conflict/)
  assert.deepEqual(await f.complete(input), result)
})

test("replace is the latest own quiz: an older web quiz linked later loses, a newer one wins", async (t) => {
  const f = await fixture(t)
  await f.complete(await f.intent())
  await f.complete(await f.intent("replace", { answers: { ...answers, thickness: "coarse" } }))
  const row = (await readRow(f.db, owner))!
  const facts = parseUserFactsRow(owner, row)
  const leads = (await f.db.query<any>("select id from leads order by created_at, id")).rows
  assert.equal(leads.length, 2)
  assert.equal(facts.diagnostics?.thickness, "coarse")
  assert.equal(row.facts_revision, 2)
  const source = facts.diagnostics!.source
  assert.equal(source.kind, "legacy_quiz")
  const takenAt = (source as { takenAt?: string }).takenAt!
  assert.equal(quizSupersedesFacts(facts, "2026-09-01T00:00:00.000Z"), false)
  assert.equal(quizSupersedesFacts(facts, new Date(Date.parse(takenAt) + 1000).toISOString()), true)
})

test("replace clears a quiz_context an earlier artifact left (F4) in the same transaction", async (t) => {
  const f = await fixture(t)
  await f.complete(await f.intent())
  await saveUserFacts(f.db, {
    userId: owner,
    domain: "quiz_context",
    patch: { routineClarity: "clear" },
    provenance: {
      source: { kind: "personal_plan_artifact", id: "artifact-1" },
      schemaVersion: 1,
      at: "2026-09-02T00:00:00.000Z",
    },
  })
  const before = await readClock(f.db, owner)
  await f.complete(await f.intent("replace"))
  const after = await readClock(f.db, owner)
  assert.equal(after.revision - before.revision, BigInt(3))
  assert.equal(after.profile - before.profile, BigInt(2))
  const row = (await readRow(f.db, owner))!
  assert.deepEqual(row.quiz_context, {})
  const lead = (await f.db.query<any>("select id from leads order by created_at desc limit 1"))
    .rows[0].id
  assert.deepEqual((row.facts_provenance as any).quiz_context.source, {
    kind: "legacy_lead",
    id: lead,
  })
})

test("fix round 1 (D): a later replace does not clear the already-cleared {} quiz_context again", async (t) => {
  const f = await fixture(t)
  await f.complete(await f.intent())
  await saveUserFacts(f.db, {
    userId: owner,
    domain: "quiz_context",
    patch: { routineClarity: "clear" },
    provenance: {
      source: { kind: "personal_plan_artifact", id: "artifact-1" },
      schemaVersion: 1,
      at: "2026-09-02T00:00:00.000Z",
    },
  })
  await f.complete(await f.intent("replace"))
  const cleared = (await readRow(f.db, owner))!
  assert.deepEqual(cleared.quiz_context, {})
  const before = await readClock(f.db, owner)
  await f.complete(await f.intent("replace", { answers: { ...answers, thickness: "coarse" } }))
  const after = await readClock(f.db, owner)
  // Exactly the plain replace: one door write, then the lead (+2 / +1).
  assert.equal(after.revision - before.revision, BigInt(2))
  assert.equal(after.profile - before.profile, BigInt(1))
  const row = (await readRow(f.db, owner))!
  assert.equal(row.facts_revision, (cleared.facts_revision as number) + 1)
  assert.deepEqual(row.quiz_context, {})
  assert.deepEqual(row.facts_provenance, {
    ...(row.facts_provenance as object),
    quiz_context: (cleared.facts_provenance as any).quiz_context,
  })
  const lastFacts = f.calls.filter((call) => call.name === "mobile_registration_publish").at(-1)!
    .args.p_facts as Record<string, unknown>
  assert.deepEqual(Object.keys(lastFacts), ["diagnostics"], "no quiz_context write handed over")
})

test("C6 source revision CAS and invalid output roll back an absent profile/lead/consent/enrollment", async (t) => {
  const f = await fixture(t)
  const input = await f.intent()
  await f.complete(input)
  const call = f.calls.find((c) => c.name === "mobile_registration_publish")!.args
  // Reset only our fresh synthetic database publication state, preserving intent.
  await f.db.exec(
    "delete from mobile_registration_publication_receipts;delete from scanner_profile_edits;delete from scanner_context_heads;delete from scanner_context_versions;delete from leads;delete from hair_profiles;delete from mobile_registration_enrollments;update mobile_registration_intents set completed_at=null,completion_receipt=null;update scanner_context_sources set revision=0,profile_revision=0",
  )
  const invalid = await f.client.rpc("mobile_registration_publish", {
    ...call,
    p_output_snapshot: { computationVersion: "wrong" },
  })
  assert.ok(invalid.error)
  for (const table of [
    "hair_profiles",
    "leads",
    "scanner_profile_edits",
    "mobile_registration_publication_receipts",
    "mobile_registration_enrollments",
  ])
    assert.equal((await f.db.query(`select * from ${table}`)).rows.length, 0)
  await f.db.exec("update scanner_context_sources set revision=1")
  const stale = await f.client.rpc("mobile_registration_publish", call)
  assert.equal((stale.data as any).outcome, "profile_conflict")
  assert.equal((await f.db.query("select * from hair_profiles")).rows.length, 0)
})

test("a door-level conflict while creating rolls everything back to profile_conflict", async (t) => {
  const f = await fixture(t)
  const input = await f.intent()
  await f.db.exec(`
    ALTER FUNCTION public.user_facts_save_v1(uuid,text,jsonb,jsonb,integer,text,uuid,bigint,uuid)
      RENAME TO user_facts_save_v1_real;
    CREATE FUNCTION public.user_facts_save_v1(p_user_id uuid, p_domain text, p_patch jsonb,
      p_provenance jsonb, p_expected_revision integer DEFAULT NULL, p_mode text DEFAULT 'upsert',
      p_source_draft_id uuid DEFAULT NULL, p_expected_draft_revision bigint DEFAULT NULL,
      p_expected_initial_version_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
    BEGIN
      -- A concurrent creator won the absent-row race with a facts write of its own.
      INSERT INTO public.hair_profiles(user_id) VALUES (p_user_id) ON CONFLICT DO NOTHING;
      RETURN jsonb_build_object('status','revision_conflict','revision',1);
    END $$;`)
  await assert.rejects(f.complete(input), /profile_conflict/)
  for (const table of ["hair_profiles", "leads", "mobile_registration_publication_receipts"])
    assert.equal((await f.db.query(`select * from ${table}`)).rows.length, 0, table)
})

/** Renames the real door and installs `body` (plpgsql) as `user_facts_save_v1`; the real one
 * stays callable as `user_facts_save_v1_real`. */
async function wrapDoor(db: Awaited<ReturnType<typeof fixture>>["db"], body: string) {
  await db.exec(`
    ALTER FUNCTION public.user_facts_save_v1(uuid,text,jsonb,jsonb,integer,text,uuid,bigint,uuid)
      RENAME TO user_facts_save_v1_real;
    CREATE FUNCTION public.user_facts_save_v1(p_user_id uuid, p_domain text, p_patch jsonb,
      p_provenance jsonb, p_expected_revision integer DEFAULT NULL, p_mode text DEFAULT 'upsert',
      p_source_draft_id uuid DEFAULT NULL, p_expected_draft_revision bigint DEFAULT NULL,
      p_expected_initial_version_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
    BEGIN ${body} END $$;`)
}

const REAL_DOOR_CALL =
  "public.user_facts_save_v1_real(p_user_id,p_domain,p_patch,p_provenance,p_expected_revision,p_mode)"

test("fix round 1 (C): a conflict after a completed door write raises, never returns a status", async (t) => {
  const f = await fixture(t)
  await f.complete(await f.intent())
  await saveUserFacts(f.db, {
    userId: owner,
    domain: "quiz_context",
    patch: { routineClarity: "clear" },
    provenance: {
      source: { kind: "personal_plan_artifact", id: "artifact-1" },
      schemaVersion: 1,
      at: "2026-09-02T00:00:00.000Z",
    },
  })
  // diagnostics goes through the real door; quiz_context then reports a concurrent writer.
  await wrapDoor(
    f.db,
    `IF p_domain = 'quiz_context' THEN
       RETURN jsonb_build_object('status','revision_conflict','revision',99);
     END IF;
     RETURN ${REAL_DOOR_CALL};`,
  )
  const facts = {
    diagnostics: {
      patch: { thickness: "coarse" },
      provenance: {
        source: { kind: "profile_editor" },
        schemaVersion: 1,
        at: "2026-09-03T00:00:00.000Z",
      },
    },
    quiz_context: {
      patch: { routineClarity: null },
      provenance: {
        source: { kind: "profile_editor" },
        schemaVersion: 1,
        at: "2026-09-03T00:00:00.000Z",
      },
    },
  }
  // The helper itself: never a return a caller without an EXCEPTION block could pass on.
  await f.db.exec("BEGIN")
  await assert.rejects(
    f.db.query("select public.mobile_profile_facts_save_v1($1,$2,true)", [
      owner,
      JSON.stringify(facts),
    ]),
    (error: { code?: string }) => error.code === "P0002",
  )
  await f.db.exec("ROLLBACK")

  // Through the registration replace: everything rolls back to profile_conflict.
  const row = await readRow(f.db, owner)
  const clock = await readClock(f.db, owner)
  const leads = (await f.db.query("select * from leads")).rows.length
  const receipts = (await f.db.query("select * from mobile_registration_publication_receipts")).rows
    .length
  await assert.rejects(
    f.complete(await f.intent("replace", { answers: { ...answers, thickness: "coarse" } })),
    /profile_conflict/,
  )
  assert.deepEqual(await readRow(f.db, owner), row)
  assert.deepEqual(await readClock(f.db, owner), clock)
  assert.equal((await f.db.query("select * from leads")).rows.length, leads)
  assert.equal(
    (await f.db.query("select * from mobile_registration_publication_receipts")).rows.length,
    receipts,
  )
})

test("fix round 1 (B): a non-door creator that wins the absent-row race is refused, not overwritten", async (t) => {
  const f = await fixture(t)
  const input = await f.intent()
  const clock = await readClock(f.db, owner)
  // A concurrent NON-door writer creates the row first (facts_revision 0, no facts), then the
  // real door runs: its INSERT loses, its CAS on revision 0 passes, and the clock delta happens
  // to match. Only the door's own "created" report can tell the publisher it did not create it.
  await wrapDoor(
    f.db,
    `INSERT INTO public.hair_profiles(user_id,hair_texture,goals)
       VALUES (p_user_id,'straight',ARRAY['shine']) ON CONFLICT DO NOTHING;
     RETURN ${REAL_DOOR_CALL};`,
  )
  await assert.rejects(f.complete(input), /profile_conflict/)
  // In one PGlite session the simulated writer's row lives in the publication's transaction and
  // rolls back with it; in production it is committed and nothing of this publication touches it.
  assert.equal((await f.db.query("select * from hair_profiles")).rows.length, 0)
  assert.deepEqual(await readClock(f.db, owner), clock)
  for (const table of [
    "leads",
    "mobile_registration_publication_receipts",
    "scanner_profile_edits",
  ])
    assert.equal((await f.db.query(`select * from ${table}`)).rows.length, 0, table)
  assert.equal(
    (await f.db.query<any>("select full_name from profiles where id=$1", [owner])).rows[0]
      .full_name,
    "Existing",
  )

  // The same wrapper against a row the door DID create (no competing writer) still publishes.
  await f.db.exec(`
    DROP FUNCTION public.user_facts_save_v1(uuid,text,jsonb,jsonb,integer,text,uuid,bigint,uuid);
    ALTER FUNCTION public.user_facts_save_v1_real(uuid,text,jsonb,jsonb,integer,text,uuid,bigint,uuid)
      RENAME TO user_facts_save_v1;`)
  assert.equal((await f.complete(input)).status, "ready")
})

test("C8 wrong owner, stale generation, expiry, login intent and unverified binding never publish", async (t) => {
  const f = await fixture(t)
  const input = await f.intent()
  await assert.rejects(
    completeMobileRegistration(f.client as never, foreign, input.submission.email, input as never),
    /invalid_attempt/,
  )
  await assert.rejects(f.complete({ ...input, sendGeneration: randomUUID() }), /invalid_attempt/)
  for (const mutation of [
    "flow='login'",
    "expires_at=now()-interval '1 second'",
    "verified_at=null,verified_user_id=null",
    "superseded_at=now()",
  ]) {
    await f.db.query(`update mobile_registration_intents set ${mutation} where id=$1`, [
      input.attemptId,
    ])
    await assert.rejects(f.complete(input), /invalid_attempt/)
    await f.db.query(
      `update mobile_registration_intents set flow='registration',expires_at=now()+interval '1 hour',verified_at=now(),verified_user_id=$2,superseded_at=null where id=$1`,
      [input.attemptId, owner],
    )
  }
  assert.equal((await f.db.query("select * from hair_profiles")).rows.length, 0)
})

async function seedLegacyRow(db: Awaited<ReturnType<typeof fixture>>["db"]) {
  // A row a legacy direct writer left (no facts), hair length missing.
  await db.query(
    `insert into hair_profiles(user_id,hair_texture,thickness,density,cuticle_condition,protein_moisture_balance,scalp_type,scalp_condition,chemical_treatment,concerns,goals,towel_material) values($1,'wavy','fine','medium','rough','stretches_bounces','balanced',null,ARRAY['natural'],ARRAY[]::text[],ARRAY['moisture'],'mikrofaser')`,
    [owner],
  )
}

test("missing-only preserves valid false/empty/NULL and unrelated fields; no consent/lead/enrollment write", async (t) => {
  const f = await fixture(t)
  await seedLegacyRow(f.db)
  const current = (await f.client.rpc("scanner_context_read_source", { p_user_id: owner }))
    .data as any
  const input = {
    requestId: randomUUID(),
    expectedProfileRevision: current.profileRevision,
    answers: { hair_length: "short" as const, thickness: "coarse" },
  }
  const result = await completeMobileProfile(f.client as never, owner, input)
  assert.deepEqual(await completeMobileProfile(f.client as never, owner, input), result)
  const row = (await f.db.query<any>("select * from hair_profiles")).rows[0]
  assert.equal(row.thickness, "fine")
  assert.equal(row.hair_length, "short")
  assert.equal(row.scalp_condition, null)
  assert.deepEqual(row.concerns, [])
  assert.equal(row.towel_material, "mikrofaser")
  // No facts before: the completion wrote the whole document (a partial one would NULL the
  // other columns), as a hand edit.
  const facts = parseUserFactsRow(owner, row)
  assert.equal(facts.diagnostics?.hairLength, "short")
  assert.equal(facts.diagnostics?.source.leadId, "profile")
  assert.ok(facts.provenance.diagnostics?.editedAt)
  assert.equal((await f.db.query("select * from leads")).rows.length, 0)
  assert.equal((await f.db.query("select * from mobile_registration_enrollments")).rows.length, 0)
  assert.equal(
    (await f.db.query<any>("select consent from mobile_registration_publication_receipts")).rows[0]
      .consent,
    null,
  )
  assert.ok(await loadSharedScannerContext(f.client as never, owner))
})

test("missing-only on a facts profile names only the missing answer", async (t) => {
  const f = await fixture(t)
  await insertLeadAndFacts(f.db, { ...answers, hair_length: undefined } as never)
  const before = (await readRow(f.db, owner))!
  const current = (await f.client.rpc("scanner_context_read_source", { p_user_id: owner }))
    .data as any
  await completeMobileProfile(f.client as never, owner, {
    requestId: randomUUID(),
    expectedProfileRevision: current.profileRevision,
    answers: { hair_length: "short" },
  })
  const call = f.calls.at(-1)!.args as any
  assert.deepEqual(call.p_facts.diagnostics.patch, { hairLength: "short" })
  const row = (await readRow(f.db, owner))!
  const facts = parseUserFactsRow(owner, row)
  assert.equal(facts.diagnostics?.source.kind, "legacy_quiz", "the quiz source is kept")
  assert.equal(facts.diagnostics?.source.leadId, "44444444-4444-4444-8444-444444444444")
  assert.equal(row.hair_length, "short")
  for (const column of DIAGNOSTICS_COLUMNS.filter((c) => c !== "hair_length"))
    assert.deepEqual(row[column], before[column], column)
})

test("fix round 1 (G) adversarial: missing mode on a backfilled legacy_columns document", async (t) => {
  const f = await fixture(t)
  const quiz = { ...answers, hair_length: undefined } as unknown as QuizAnswers
  const projected = projectLegacyLeadToFacts({ leadId: "x", quizAnswers: quiz }).diagnostics
  await saveUserFacts(f.db, {
    userId: owner,
    domain: "diagnostics",
    patch: { ...projected, source: { kind: "legacy_columns", version: 1, raw: {} } },
    provenance: {
      source: { kind: "legacy_columns" },
      schemaVersion: 1,
      at: "2026-09-20T00:00:00.000Z",
      fields: { texture: "unknown_historical", thickness: "unknown_historical" },
    },
  })
  const before = (await readRow(f.db, owner))!
  assert.equal(before.hair_length, null, "baseline: hair length is missing")
  const current = (await f.client.rpc("scanner_context_read_source", { p_user_id: owner }))
    .data as any
  await completeMobileProfile(f.client as never, owner, {
    requestId: randomUUID(),
    expectedProfileRevision: current.profileRevision,
    answers: { hair_length: "short", thickness: "coarse" },
  })
  const row = (await readRow(f.db, owner))!
  const facts = parseUserFactsRow(owner, row)
  // A legacy_columns document cannot be emitted: it is re-sourced as a quiz under "profile".
  assert.equal(facts.diagnostics?.source.kind, "legacy_quiz")
  assert.equal(facts.diagnostics?.source.leadId, "profile")
  assert.equal(facts.diagnostics?.hairLength, "short")
  assert.ok(facts.provenance.diagnostics?.editedAt)
  // Only the missing answer is hers now; the supplied thickness is ignored; old markers stay.
  assert.equal(row.thickness, "fine")
  assert.deepEqual(facts.provenance.diagnostics?.fields, {
    texture: "unknown_historical",
    thickness: "unknown_historical",
    hairLength: "user",
  })
  for (const column of DIAGNOSTICS_COLUMNS.filter((c) => c !== "hair_length"))
    assert.deepEqual(row[column], before[column], column)
  assert.deepEqual(derived(row), deriveDiagnosticsColumns(facts.diagnostics!))
  assert.equal((await f.db.query("select * from leads")).rows.length, 0)
  assert.ok(await loadSharedScannerContext(f.client as never, owner))
})

test("fix round 1 (G) adversarial: a registration replay whose first attempt rolled back runs fresh, exactly once", async (t) => {
  const f = await fixture(t)
  const input = await f.intent()
  await wrapDoor(f.db, `RETURN jsonb_build_object('status','revision_conflict','revision',0);`)
  await assert.rejects(f.complete(input), /profile_conflict/)
  for (const table of ["hair_profiles", "leads", "mobile_registration_publication_receipts"])
    assert.equal((await f.db.query(`select * from ${table}`)).rows.length, 0, table)
  await f.db.exec(`
    DROP FUNCTION public.user_facts_save_v1(uuid,text,jsonb,jsonb,integer,text,uuid,bigint,uuid);
    ALTER FUNCTION public.user_facts_save_v1_real(uuid,text,jsonb,jsonb,integer,text,uuid,bigint,uuid)
      RENAME TO user_facts_save_v1;`)

  const result = await f.complete(input)
  assert.equal(result.status, "ready")
  assert.deepEqual(await f.complete(input), result, "then a byte-equal receipt")
  assert.equal((await f.db.query("select * from hair_profiles")).rows.length, 1)
  assert.equal((await f.db.query("select * from leads")).rows.length, 1)
  assert.equal((await readRow(f.db, owner))!.facts_revision, 1)
})

async function insertLeadAndFacts(
  db: Awaited<ReturnType<typeof fixture>>["db"],
  quizAnswers: QuizAnswers,
) {
  const lead = "44444444-4444-4444-8444-444444444444"
  await db.query(
    "insert into leads(id,user_id,quiz_kind,quiz_answers,status) values($1,$2,'legacy',$3,'linked')",
    [lead, owner, JSON.stringify(quizAnswers)],
  )
  await saveUserFacts(db, {
    userId: owner,
    domain: "diagnostics",
    patch: projectLegacyLeadToFacts({ leadId: lead, quizAnswers }).diagnostics,
    provenance: {
      source: { kind: "legacy_lead", id: lead },
      schemaVersion: 1,
      at: "2026-09-01T00:00:00.000Z",
    },
  })
}

test("all publication privileges are denied to anon/authenticated", async (t) => {
  const f = await fixture(t)
  for (const role of ["anon", "authenticated"]) {
    const rows = (
      await f.db.query<{ ok: boolean }>(
        `select has_function_privilege($1,'public.mobile_registration_publication_receipt(uuid,uuid,text,text,uuid,uuid,text,text)','EXECUTE') ok`,
        [role],
      )
    ).rows
    assert.equal(rows[0].ok, false)
    assert.equal(
      (
        await f.db.query<{ ok: boolean }>(
          `select has_function_privilege($1,'public.mobile_registration_publish(uuid,uuid,text,text,uuid,uuid,text,text,bigint,bigint,jsonb,jsonb,uuid,timestamptz,jsonb,text,text,jsonb,jsonb,text)','EXECUTE') ok`,
          [role],
        )
      ).rows[0].ok,
      false,
    )
    assert.equal(
      (
        await f.db.query<{ ok: boolean }>(
          `select has_table_privilege($1,'public.mobile_registration_publication_receipts','SELECT') ok`,
          [role],
        )
      ).rows[0].ok,
      false,
    )
  }
})

test("profile CAS rejects a web change after preparation without publishing another source", async (t) => {
  const f = await fixture(t)
  await f.complete(await f.intent())
  const input = await f.intent("replace", { answers: { ...answers, thickness: "coarse" } })
  const leads = await f.db.query("select * from leads")
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "mobile_registration_publish")
        await f.db.query("update hair_profiles set towel_material='frottee' where user_id=$1", [
          owner,
        ])
      return f.client.rpc(name, args)
    },
  }
  await assert.rejects(
    completeMobileRegistration(client as never, owner, input.submission.email, input as never),
    /profile_conflict/,
  )
  assert.deepEqual(await f.db.query("select * from leads"), leads)
  const row = (await readRow(f.db, owner))!
  assert.equal(row.thickness, "fine")
  assert.equal(row.facts_revision, 1, "no facts written")
  assert.equal(row.towel_material, "frottee")
})

// ---------------------------------------------------------------------------
// Scanner clock deltas per outcome, OLD function vs NEW function, same schema.
// ---------------------------------------------------------------------------

type Delta = { source: number; profile: number }

async function measure(
  t: { after: (fn: () => Promise<void>) => void },
  cleanSwitch: boolean,
  outcome: string,
): Promise<Delta> {
  const f = await fixture(t, { cleanSwitch })
  if (outcome.startsWith("replace") || outcome === "keep") await f.complete(await f.intent())
  if (outcome === "replace+quiz_context")
    await saveUserFacts(f.db, {
      userId: owner,
      domain: "quiz_context",
      patch: { routineClarity: "clear" },
      provenance: {
        source: { kind: "personal_plan_artifact", id: "a" },
        schemaVersion: 1,
        at: "2026-09-02T00:00:00.000Z",
      },
    })
  if (outcome === "missing (row exists)") await seedLegacyRow(f.db)
  const before = await readClock(f.db, owner)
  if (outcome.startsWith("missing")) {
    const current = (await f.client.rpc("scanner_context_read_source", { p_user_id: owner }))
      .data as any
    await completeMobileProfile(f.client as never, owner, {
      requestId: randomUUID(),
      expectedProfileRevision: current.profileRevision,
      answers: (outcome === "missing (row exists)"
        ? { hair_length: "short" }
        : answers) as Partial<QuizAnswers>,
    })
  } else {
    const choice = outcome.startsWith("replace") ? "replace" : (outcome as "create" | "keep")
    await f.complete(await f.intent(choice))
  }
  const after = await readClock(f.db, owner)
  return {
    source: Number(after.revision - before.revision),
    profile: Number(after.profile - before.profile),
  }
}

test("scanner clock deltas per outcome, old vs new (documented in the migration header)", async (t) => {
  const table: Record<string, { old: Delta; new: Delta }> = {
    create: { old: { source: 2, profile: 1 }, new: { source: 3, profile: 2 } },
    replace: { old: { source: 2, profile: 1 }, new: { source: 2, profile: 1 } },
    "replace+quiz_context": { old: { source: 2, profile: 1 }, new: { source: 3, profile: 2 } },
    "missing (row exists)": { old: { source: 1, profile: 1 }, new: { source: 1, profile: 1 } },
    "missing (no row)": { old: { source: 1, profile: 1 }, new: { source: 2, profile: 2 } },
    keep: { old: { source: 0, profile: 0 }, new: { source: 0, profile: 0 } },
  }
  for (const [outcome, expected] of Object.entries(table)) {
    assert.deepEqual(await measure(t, false, outcome), expected.old, `old ${outcome}`)
    assert.deepEqual(await measure(t, true, outcome), expected.new, `new ${outcome}`)
  }
})
