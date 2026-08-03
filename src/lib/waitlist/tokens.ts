import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export function issueWaitlistSurveyToken() {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashWaitlistSurveyToken(token) }
}

export function hashWaitlistSurveyToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function verifyWaitlistSurveyToken(token: string, expectedHash: string) {
  const actual = Buffer.from(hashWaitlistSurveyToken(token), "hex")
  const expected = Buffer.from(expectedHash, "hex")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
