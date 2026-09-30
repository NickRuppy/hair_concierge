import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { PGlite } from "@electric-sql/pglite"
import {
  completeMobileRegistration,
  completeMobileProfile,
} from "../src/lib/mobile/registration-completion"
import { registrationSubmissionHash } from "../src/lib/mobile/registration-contract"
import { mobileEditProfilePatch } from "../src/lib/mobile/profile-edit-contract"
import { loadSharedScannerContext } from "../src/lib/scan/scanner-context-supabase"

// Executes the real SQL functions, constraints and triggers. Embedded PostgreSQL
// is not a two-session lock proof; parent integration runs that separately.
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
const signatures: Record<string, string[]> = {
  scanner_context_read_source: ["p_user_id"],
  scanner_context_publish: [
    "p_user_id",
    "p_expected_source_revision",
    "p_source_hash",
    "p_engine_version",
    "p_input_snapshot",
    "p_output_snapshot",
    "p_snapshot_source",
  ],
  mobile_registration_publication_receipt: [
    "p_user_id",
    "p_request_id",
    "p_request_hash",
    "p_mode",
    "p_attempt_id",
    "p_send_generation",
    "p_email",
    "p_submission_hash",
  ],
  mobile_registration_publish: [
    "p_user_id",
    "p_request_id",
    "p_request_hash",
    "p_mode",
    "p_attempt_id",
    "p_send_generation",
    "p_email",
    "p_submission_hash",
    "p_expected_profile_revision",
    "p_expected_source_revision",
    "p_patch",
    "p_quiz_answers",
    "p_lead_id",
    "p_submission",
    "p_source_hash",
    "p_engine_version",
    "p_input_snapshot",
    "p_output_snapshot",
    "p_snapshot_source",
  ],
}
async function fixture() {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
 create table profiles(id uuid primary key,full_name text);
 create table hair_profiles(id uuid default gen_random_uuid() primary key,user_id uuid unique references profiles(id),hair_texture text,thickness text,density text,hair_length text,cuticle_condition text,protein_moisture_balance text,scalp_type text,scalp_condition text,chemical_treatment text[],concerns text[],goals text[],desired_volume text,styling_methods text[],updated_at timestamptz default now());
 create table leads(id uuid primary key,name text,email text,marketing_consent boolean,quiz_answers jsonb,quiz_kind text,status text,user_id uuid references profiles(id));
 create table personal_plans(id uuid primary key,user_id uuid unique references profiles(id),current_initial_need_version_id uuid,current_refined_need_version_id uuid);
 create table personal_plan_need_versions(id uuid primary key,user_id uuid references profiles(id),personal_plan_id uuid,kind text,input_snapshot jsonb,output_snapshot jsonb);
 create table personal_plan_refinement_drafts(id uuid primary key,user_id uuid references profiles(id),personal_plan_id uuid,answers jsonb);
 insert into profiles values('${owner}','Existing'),('${foreign}','Other');`)
  for (const file of [
    "20260916175235_hosted_mobile_scanner_context",
    "20260916175239_hosted_mobile_profile_edit",
    "20260917063601_mobile_registration_intents",
    "20260917063827_mobile_registration_publication",
  ])
    await db.exec(
      await readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), "utf8"),
    )
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      try {
        return {
          data: (
            await db.query<{ result: unknown }>(
              `select ${name}(${signatures[name].map((_, i) => "$" + (i + 1)).join(",")}) result`,
              signatures[name].map((k) => args[k]),
            )
          ).rows[0].result,
          error: null,
        }
      } catch (error) {
        return { data: null, error }
      }
    },
  }
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
    calls,
    intent,
    complete: async (input: Awaited<ReturnType<typeof intent>>) =>
      completeMobileRegistration(client as never, owner, input.submission.email, input as never),
  }
}
test("C1/C4 atomic new source, consent, ready enrollment, byte-equal replay and stable later bootstrap", async () => {
  const f = await fixture()
  try {
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
  } finally {
    await f.db.close()
  }
})
test("C2 keep preserves profile/source/edit rows, records checkbox without a new lead", async () => {
  const f = await fixture()
  try {
    await f.complete(await f.intent())
    const before = await f.db.query("select * from hair_profiles"),
      leads = await f.db.query("select * from leads"),
      edits = await f.db.query("select * from scanner_profile_edits")
    const input = await f.intent("keep", { marketingOptIn: false })
    await f.complete(input)
    assert.deepEqual(await f.db.query("select * from hair_profiles"), before)
    assert.deepEqual(await f.db.query("select * from leads"), leads)
    assert.deepEqual(await f.db.query("select * from scanner_profile_edits"), edits)
    const consent = (
      await f.db.query<any>(
        "select consent from mobile_registration_publication_receipts where request_id=$1",
        [input.submission.requestId],
      )
    ).rows[0].consent
    assert.equal(consent.marketingOptIn, false)
  } finally {
    await f.db.close()
  }
})
test("C3/C5 explicit replace leaves paid and unrelated fields intact, changed retry refuses overwrite", async () => {
  const f = await fixture()
  try {
    await f.complete(await f.intent())
    await f.db.query(`update hair_profiles set styling_methods=ARRAY['air_dry'] where user_id=$1`, [
      owner,
    ])
    await f.db.query("insert into personal_plans(id,user_id) values($1,$2)", [randomUUID(), owner])
    const paid = await f.db.query("select * from personal_plans")
    const input = await f.intent("replace", { answers: { ...answers, thickness: "coarse" } })
    const result = await f.complete(input)
    assert.deepEqual(await f.db.query("select * from personal_plans"), paid)
    assert.deepEqual(
      (await f.db.query<any>("select styling_methods from hair_profiles")).rows[0].styling_methods,
      ["air_dry"],
    )
    await assert.rejects(
      f.complete({ ...input, submission: { ...input.submission, marketingOptIn: false } }),
      /invalid_attempt/,
    )
    await assert.rejects(f.complete({ ...input, choice: "keep" }), /profile_conflict/)
    assert.deepEqual(await f.complete(input), result)
  } finally {
    await f.db.close()
  }
})
test("C6 source revision CAS and invalid output roll back an absent profile/lead/consent/enrollment", async () => {
  const f = await fixture()
  try {
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
  } finally {
    await f.db.close()
  }
})
test("C8 wrong owner, stale generation, expiry, login intent and unverified binding never publish", async () => {
  const f = await fixture()
  try {
    const input = await f.intent()
    await assert.rejects(
      completeMobileRegistration(
        f.client as never,
        foreign,
        input.submission.email,
        input as never,
      ),
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
  } finally {
    await f.db.close()
  }
})
test("missing-only preserves valid false/empty/NULL and unrelated fields; no consent/lead/enrollment write", async () => {
  const f = await fixture()
  try {
    const profile = mobileEditProfilePatch({ ...answers, concerns: [] } as never)
    delete profile.hair_length
    await f.db.query(
      `insert into hair_profiles(user_id,hair_texture,thickness,density,cuticle_condition,protein_moisture_balance,scalp_type,scalp_condition,chemical_treatment,concerns,goals,styling_methods) values($1,'wavy','fine','medium','rough','stretches_bounces','balanced',null,ARRAY['natural'],ARRAY[]::text[],ARRAY['moisture'],ARRAY['air_dry'])`,
      [owner],
    )
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
    assert.deepEqual(row.styling_methods, ["air_dry"])
    assert.equal((await f.db.query("select * from leads")).rows.length, 0)
    assert.equal((await f.db.query("select * from mobile_registration_enrollments")).rows.length, 0)
    assert.equal(
      (await f.db.query<any>("select consent from mobile_registration_publication_receipts"))
        .rows[0].consent,
      null,
    )
    assert.ok(await loadSharedScannerContext(f.client as never, owner))
  } finally {
    await f.db.close()
  }
})
test("all publication privileges are denied to anon/authenticated", async () => {
  const f = await fixture()
  try {
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
            `select has_table_privilege($1,'public.mobile_registration_publication_receipts','SELECT') ok`,
            [role],
          )
        ).rows[0].ok,
        false,
      )
    }
  } finally {
    await f.db.close()
  }
})

test("profile CAS rejects a web change after preparation without publishing another source", async () => {
  const f = await fixture()
  try {
    await f.complete(await f.intent())
    const input = await f.intent("replace", { answers: { ...answers, thickness: "coarse" } })
    const leads = await f.db.query("select * from leads")
    const client = {
      async rpc(name: string, args: Record<string, unknown>) {
        if (name === "mobile_registration_publish")
          await f.db.query(
            "update hair_profiles set styling_methods=ARRAY['diffuser'] where user_id=$1",
            [owner],
          )
        return f.client.rpc(name, args)
      },
    }
    await assert.rejects(
      completeMobileRegistration(client as never, owner, input.submission.email, input as never),
      /profile_conflict/,
    )
    assert.deepEqual(await f.db.query("select * from leads"), leads)
    assert.equal(
      (await f.db.query<any>("select thickness from hair_profiles")).rows[0].thickness,
      "fine",
    )
    assert.deepEqual(
      (await f.db.query<any>("select styling_methods from hair_profiles")).rows[0].styling_methods,
      ["diffuser"],
    )
  } finally {
    await f.db.close()
  }
})
