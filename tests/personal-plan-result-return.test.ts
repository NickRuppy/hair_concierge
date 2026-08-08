import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import {
  createPersonalPlanResultReturnCredential,
  hashPersonalPlanResultReturnToken,
  issuePersonalPlanResultReturn,
  isConnectionTransportFailure,
  isPersonalPlanResultReturnForLead,
  isValidPersonalPlanResultReturnToken,
  PERSONAL_PLAN_RESULT_RETURN_COOKIE,
  personalPlanResultReturnCookieOptions,
  resolvePersonalPlanResultReturn,
  resolvePersonalPlanReturnLanding,
  revokePersonalPlanResultReturn,
} from "../src/lib/personal-plan-quiz/result-return"

const LEAD_ID = "9b4ddf24-83a9-4f85-9daa-a9eaf0526fc6"

test("result-return credentials are opaque 32-byte values and cookies have the host-only contract", () => {
  const credential = createPersonalPlanResultReturnCredential()
  assert.match(credential.token, /^[A-Za-z0-9_-]{43}$/)
  assert.match(credential.tokenHash, /^[a-f0-9]{64}$/)
  assert.equal(credential.tokenHash, createHash("sha256").update(credential.token).digest("hex"))
  assert.equal(hashPersonalPlanResultReturnToken(credential.token), credential.tokenHash)
  assert.equal(isValidPersonalPlanResultReturnToken(credential.token), true)
  assert.equal(isValidPersonalPlanResultReturnToken("not-a-token"), false)
  assert.equal(PERSONAL_PLAN_RESULT_RETURN_COOKIE.startsWith("__Host-"), true)
  assert.deepEqual(personalPlanResultReturnCookieOptions, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  })
})

test("malformed cookies fail closed without invoking the resolver", async () => {
  let calls = 0
  const resolved = await resolvePersonalPlanResultReturn("bad", {
    rpc: async () => {
      calls += 1
      return { data: [{ lead_id: LEAD_ID }], error: null }
    },
  })
  assert.deepEqual(resolved, { leadId: null, status: "invalid" })
  assert.equal(calls, 0)
})

test("result lookup returns only a lead id and retries exactly once for a transport failure", async () => {
  const token = createPersonalPlanResultReturnCredential().token
  let calls = 0
  const resolved = await resolvePersonalPlanResultReturn(token, {
    rpc: async (_name, args) => {
      calls += 1
      assert.deepEqual(args, { p_token_hash: hashPersonalPlanResultReturnToken(token) })
      if (calls === 1) throw new TypeError("fetch failed")
      return { data: [{ lead_id: LEAD_ID, email: "must-not-leak@example.com" }], error: null }
    },
  })
  assert.deepEqual(resolved, { leadId: LEAD_ID, status: "resolved" })
  assert.equal(calls, 2)
})

test("lookup neither retries application errors nor clears the capability", async () => {
  const token = createPersonalPlanResultReturnCredential().token
  let calls = 0
  const warnings: string[] = []
  const resolved = await resolvePersonalPlanResultReturn(token, {
    rpc: async () => {
      calls += 1
      return { data: null, error: { code: "42501", message: "permission denied" } }
    },
    warn: (message) => warnings.push(message),
  })
  assert.deepEqual(resolved, { leadId: null, status: "unavailable" })
  assert.equal(calls, 1)
  assert.equal(isConnectionTransportFailure({ code: "42501", message: "permission denied" }), false)
  assert.deepEqual(warnings, ["Personal Plan result return lookup unavailable"])
})

test("returned transport errors retry once, then warn without disclosing capability data", async () => {
  const token = createPersonalPlanResultReturnCredential().token
  let calls = 0
  const warnings: string[] = []
  const resolved = await resolvePersonalPlanResultReturn(token, {
    rpc: async () => {
      calls += 1
      return {
        data: null,
        error: {
          code: "",
          message: "TypeError: fetch failed",
          details: "TypeError: fetch failed\n\nCaused by: Error: read ECONNRESET (ECONNRESET)",
          hint: "",
        },
      }
    },
    warn: (message) => warnings.push(message),
  })
  assert.deepEqual(resolved, { leadId: null, status: "unavailable" })
  assert.equal(calls, 2)
  assert.deepEqual(warnings, ["Personal Plan result return lookup unavailable"])
  assert.equal(warnings.join(" ").includes(token), false)
})

test("a resolved PostgREST transport envelope retries before succeeding", async () => {
  const token = createPersonalPlanResultReturnCredential().token
  let calls = 0
  const resolved = await resolvePersonalPlanResultReturn(token, {
    rpc: async () => {
      calls += 1
      if (calls === 1) {
        return {
          data: null,
          error: {
            code: "",
            message: "TypeError: fetch failed",
            details: "TypeError: fetch failed\n\nCaused by: Error: read ECONNRESET (ECONNRESET)",
            hint: "",
          },
        }
      }
      return { data: [{ lead_id: LEAD_ID }], error: null }
    },
  })
  assert.deepEqual(resolved, { leadId: LEAD_ID, status: "resolved" })
  assert.equal(calls, 2)
})

test("issue rotates the single lead capability and revoke clears the host-only cookie", async () => {
  const cookieWrites: Array<{ name: string; value: string; options: Record<string, unknown> }> = []
  const response = {
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown>) =>
        cookieWrites.push({ name, value, options }),
    },
  }
  let upserted: Record<string, unknown> | undefined
  let revokedHash: string | undefined
  const admin = {
    rpc: async () => ({ data: null, error: null }),
    from: () => ({
      upsert: async (values: Record<string, unknown>) => {
        upserted = values
        return { error: null }
      },
      update: () => ({
        eq: async (_column: string, value: string) => {
          revokedHash = value
          return { error: null }
        },
      }),
    }),
  }
  const issued = await issuePersonalPlanResultReturn({
    leadId: LEAD_ID,
    response,
    admin: admin as never,
  })
  assert.deepEqual(issued, { issued: true })
  assert.equal(upserted?.lead_id, LEAD_ID)
  assert.match(String(upserted?.token_hash), /^[a-f0-9]{64}$/)
  assert.equal(cookieWrites[0]?.name, PERSONAL_PLAN_RESULT_RETURN_COOKIE)
  assert.match(cookieWrites[0]?.value ?? "", /^[A-Za-z0-9_-]{43}$/)
  assert.equal(cookieWrites[0]?.options.domain, undefined)

  const revoked = await revokePersonalPlanResultReturn({
    cookieValue: cookieWrites[0]?.value,
    response,
    admin: admin as never,
  })
  assert.deepEqual(revoked, { revoked: true })
  assert.equal(revokedHash, hashPersonalPlanResultReturnToken(cookieWrites[0]?.value ?? ""))
  assert.equal(cookieWrites[1]?.value, "")
  assert.equal(cookieWrites[1]?.options.maxAge, 0)
})

test("valid result has fixed precedence over an explicit resume token and an existing draft", () => {
  assert.deepEqual(
    resolvePersonalPlanReturnLanding({
      resultReturn: { leadId: LEAD_ID, status: "resolved" },
      resumeToken: "resume",
      hasDraft: true,
    }),
    { kind: "result", leadId: LEAD_ID },
  )
  assert.deepEqual(
    resolvePersonalPlanReturnLanding({
      resultReturn: { leadId: null, status: "unavailable" },
      resumeToken: "resume",
      hasDraft: true,
    }),
    { kind: "unavailable" },
  )
  assert.deepEqual(
    resolvePersonalPlanReturnLanding({
      resultReturn: { leadId: null, status: "invalid" },
      resumeToken: "resume",
      hasDraft: true,
    }),
    { kind: "resume_token" },
  )
  assert.deepEqual(
    resolvePersonalPlanReturnLanding({
      resultReturn: { leadId: null, status: "invalid" },
      hasDraft: true,
    }),
    { kind: "draft" },
  )
  assert.deepEqual(resolvePersonalPlanReturnLanding({}), { kind: "fresh" })
})

test("return-entry trust requires a resolved capability for the requested lead", () => {
  assert.equal(
    isPersonalPlanResultReturnForLead({ leadId: LEAD_ID, status: "resolved" }, LEAD_ID),
    true,
  )
  assert.equal(
    isPersonalPlanResultReturnForLead(
      { leadId: LEAD_ID, status: "resolved" },
      "11111111-1111-4111-8111-111111111111",
    ),
    false,
  )
  assert.equal(
    isPersonalPlanResultReturnForLead({ leadId: null, status: "unavailable" }, LEAD_ID),
    false,
  )
})
