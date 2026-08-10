import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export function issuePersonalPlanFieldTestToken() {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashPersonalPlanFieldTestToken(token) }
}

export function hashPersonalPlanFieldTestToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function verifyPersonalPlanFieldTestToken(token: string, expectedHash: string) {
  const actual = Buffer.from(hashPersonalPlanFieldTestToken(token), "hex")
  const expected = Buffer.from(expectedHash, "hex")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
