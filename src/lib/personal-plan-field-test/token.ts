import { createHash, randomBytes } from "node:crypto"

export function issuePersonalPlanFieldTestToken() {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashPersonalPlanFieldTestToken(token) }
}

export function hashPersonalPlanFieldTestToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}
