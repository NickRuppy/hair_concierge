import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  createQuizEmailReturnCredential,
  hashQuizEmailReturnCredential,
  issueQuizEmailReturnCredential,
  isValidQuizEmailReturnCredential,
  resolveQuizEmailReturnLinkById,
  resolveQuizEmailReturnCredential,
  revokeQuizEmailReturnCredential,
  revokeQuizEmailReturnLinkById,
} from "../src/lib/quiz/email-return-credential"

const LEAD_ID = "10000000-0000-4000-8000-000000000001"

test("migration keeps the email-return capability service-only", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260918180721_quiz_email_return_links.sql"),
    "utf8",
  )
  assert.match(migration, /ALTER TABLE public\.quiz_email_return_links ENABLE ROW LEVEL SECURITY;/)
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.quiz_email_return_links FROM PUBLIC, anon, authenticated;/,
  )
  assert.match(
    migration,
    /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.quiz_email_return_links TO service_role;/,
  )
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.resolve_quiz_email_return_link\(text\) FROM PUBLIC, anon, authenticated;/,
  )
  assert.doesNotMatch(
    migration,
    /GRANT .* ON (TABLE public\.quiz_email_return_links|FUNCTION public\.resolve_quiz_email_return_link).* TO (anon|authenticated|PUBLIC)/,
  )
})

test("email-return credentials are opaque 32-byte values and only their SHA-256 hash is persisted", () => {
  const credential = createQuizEmailReturnCredential()
  assert.match(credential.token, /^[A-Za-z0-9_-]{43}$/)
  assert.match(credential.tokenHash, /^[a-f0-9]{64}$/)
  assert.equal(
    credential.tokenHash,
    createHash("sha256").update(credential.token, "utf8").digest("hex"),
  )
  assert.equal(hashQuizEmailReturnCredential(credential.token), credential.tokenHash)
  assert.equal(isValidQuizEmailReturnCredential(credential.token), true)
  assert.equal(isValidQuizEmailReturnCredential("not-a-credential"), false)
})

test("resolution is read-only, fails closed for malformed, expired, and revoked credentials", async () => {
  let calls = 0
  const invalid = await resolveQuizEmailReturnCredential("bad", {
    rpc: async () => {
      calls += 1
      return { data: [{ lead_id: LEAD_ID, package_key: "customerio_scan_return_v1" }], error: null }
    },
  })
  assert.deepEqual(invalid, {
    status: "invalid",
    linkId: null,
    leadId: null,
    quizKind: null,
    campaignKey: null,
    packageKey: null,
  })
  assert.equal(calls, 0)

  const token = createQuizEmailReturnCredential().token
  const expired = await resolveQuizEmailReturnCredential(token, {
    rpc: async (_name, args) => {
      calls += 1
      assert.deepEqual(args, { p_token_hash: hashQuizEmailReturnCredential(token) })
      return { data: [], error: null }
    },
  })
  assert.deepEqual(expired, {
    status: "invalid",
    linkId: null,
    leadId: null,
    quizKind: null,
    campaignKey: null,
    packageKey: null,
  })
  assert.equal(calls, 1)
})

test("token and signed-cookie link-id resolution both recheck the same live lifecycle", async () => {
  const token = createQuizEmailReturnCredential().token
  const linkId = "20000000-0000-4000-8000-000000000002"
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const rpc = async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    return {
      data: [
        {
          link_id: linkId,
          lead_id: LEAD_ID,
          quiz_kind: "personal_plan",
          campaign_key: "customerio_return_sep_2026",
          package_key: "customerio_scan_return_v1",
        },
      ],
      error: null,
    }
  }
  assert.deepEqual(await resolveQuizEmailReturnCredential(token, { rpc }), {
    status: "resolved",
    linkId,
    leadId: LEAD_ID,
    quizKind: "personal_plan",
    campaignKey: "customerio_return_sep_2026",
    packageKey: "customerio_scan_return_v1",
  })
  assert.deepEqual(await resolveQuizEmailReturnLinkById(linkId, { rpc }), {
    status: "resolved",
    linkId,
    leadId: LEAD_ID,
    quizKind: "personal_plan",
    campaignKey: "customerio_return_sep_2026",
    packageKey: "customerio_scan_return_v1",
  })
  assert.deepEqual(calls, [
    {
      name: "resolve_quiz_email_return_link",
      args: { p_token_hash: hashQuizEmailReturnCredential(token) },
    },
    { name: "resolve_quiz_email_return_link_by_id", args: { p_link_id: linkId } },
  ])
})

test("issuance persists the selected lead exactly once and does not reselect it on a later click", async () => {
  let inserted: Record<string, unknown> | undefined
  const issued = await issueQuizEmailReturnCredential({
    email: " LEA@EXAMPLE.TEST ",
    campaignKey: "customerio_return_sep_2026",
    packageKey: "customerio_scan_return_v1",
    now: new Date("2026-09-18T12:00:00.000Z"),
    loadCandidates: async () => [
      {
        id: LEAD_ID,
        email: "lea@example.test",
        quizKind: "legacy",
        quizAnswers: { structure: "wavy" },
        createdAt: "2026-08-01T12:00:00.000Z",
      },
    ],
    admin: {
      rpc: async () => ({ data: null, error: null }),
      from: () => ({
        insert: async (values: Record<string, unknown>) => {
          inserted = values
          return { error: null }
        },
      }),
    } as never,
  })

  assert.equal(issued.status, "issued")
  if (issued.status !== "issued") return
  assert.equal(issued.leadId, LEAD_ID)
  assert.equal(issued.quizKind, "legacy")
  assert.equal(inserted?.source_lead_id, LEAD_ID)
  assert.equal(inserted?.token_hash, hashQuizEmailReturnCredential(issued.token))
  assert.equal(inserted?.token_hash === issued.token, false)
  assert.equal(inserted?.expires_at, "2026-10-18T12:00:00.000Z")
})

test("issuance refuses a package that the return entry cannot redeem", async () => {
  const result = await issueQuizEmailReturnCredential({
    email: "lea@example.test",
    campaignKey: "customerio_return_sep_2026",
    packageKey: "default_organic",
    loadCandidates: async () => {
      throw new Error("invalid package must stop before lookup")
    },
  })
  assert.equal(result.status, "unavailable")
})

test("revoke marks the stored hash and never handles the plaintext credential beyond hashing", async () => {
  const token = createQuizEmailReturnCredential().token
  let revokedHash: string | undefined
  const revoked = await revokeQuizEmailReturnCredential(token, {
    now: new Date("2026-09-18T12:00:00.000Z"),
    admin: {
      from: () => ({
        update: () => ({
          eq: (_column: string, value: string) => {
            revokedHash = value
            return {
              is: () => ({
                select: () => ({
                  maybeSingle: async () => ({ data: { id: LEAD_ID }, error: null }),
                }),
              }),
            }
          },
        }),
      }),
    },
  })
  assert.deepEqual(revoked, { revoked: true })
  assert.equal(revokedHash, hashQuizEmailReturnCredential(token))
})

test("revocation by stored link ID reports no match rather than a false success", async () => {
  const linkId = "20000000-0000-4000-8000-000000000002"
  const result = await revokeQuizEmailReturnLinkById(linkId, {
    admin: {
      from: () => ({
        update: () => ({
          eq: (column: string, value: string) => {
            assert.equal(column, "id")
            assert.equal(value, linkId)
            return {
              is: () => ({
                select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
              }),
            }
          },
        }),
      }),
    },
  })
  assert.deepEqual(result, { revoked: false })
})
