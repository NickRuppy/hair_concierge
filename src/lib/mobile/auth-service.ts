import type { MobileAuthVerification, MobileSession } from "./contracts"

/** The provider owns OTP creation/expiry/single-use; the attempt binds both entry paths. */
export interface MobileAuthDependencies {
  createAttempt(email: string): Promise<string>
  sendCodeAndLink(email: string, attemptId: string): Promise<void>
  claimVerification(attemptId: string): Promise<string | null>
  verify(
    email: string,
    input: MobileAuthVerification,
  ): Promise<(MobileSession & { email: string }) | null>
  finish(attemptId: string): Promise<boolean>
  issueSession?(session: MobileSession & { email: string }): Promise<MobileSession>
}

export async function startMobileAuth(email: string, deps: MobileAuthDependencies) {
  const attemptId = await deps.createAttempt(email)
  await deps.sendCodeAndLink(email, attemptId)
  return { attemptId, codeLength: 8 as const }
}

export async function verifyMobileAuth(
  input: MobileAuthVerification,
  deps: MobileAuthDependencies,
): Promise<MobileSession | null> {
  const email = await deps.claimVerification(input.attemptId)
  if (!email) return null
  const verified = await deps.verify(email, input)
  if (!verified || verified.email.toLowerCase() !== email.toLowerCase()) return null
  if (!(await deps.finish(input.attemptId))) return null
  if (deps.issueSession) return deps.issueSession(verified)
  return {
    accessToken: verified.accessToken,
    refreshToken: verified.refreshToken,
    expiresAt: verified.expiresAt,
    userId: verified.userId,
  }
}
