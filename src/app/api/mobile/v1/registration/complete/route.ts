import { completionResult } from "@/lib/mobile/registration-http"
import { createAdminClient } from "@/lib/supabase/admin"
import { mobileBody, mobileJSON } from "@/lib/mobile/auth"
import { MobileError } from "@/lib/mobile/errors"
import {
  registrationCompleteSchema,
  registrationSubmissionHash,
} from "@/lib/mobile/registration-contract"
import {
  registrationRoute,
  validateRegistrationCompletion,
  issueRegisteredSession,
  recordDeferredRegistrationKeep,
  createProfileCompletionCapability,
} from "@/lib/mobile/registration-auth"
import { completeMobileRegistration } from "@/lib/mobile/registration-completion"

export async function POST(request: Request) {
  return registrationRoute(async () => {
    const parsed = registrationCompleteSchema.safeParse(await mobileBody(request, 24576))
    if (!parsed.success) throw new MobileError("invalid_request", 400)
    const client = createAdminClient()
    const proof = await validateRegistrationCompletion(parsed.data.completionToken, client)
    if (
      proof.email !== parsed.data.submission.email ||
      proof.requestHash !== registrationSubmissionHash(parsed.data.submission)
    )
      throw new MobileError("unauthorized", 401)
    let bootstrap
    try {
      bootstrap = await completionResult(
        completeMobileRegistration(client, proof.userId, proof.email, {
          attemptId: proof.attemptId,
          sendGeneration: proof.sendGeneration,
          submission: parsed.data.submission,
          choice: parsed.data.choice,
          expectedProfileRevision: parsed.data.expectedProfileRevision,
        }),
      )
    } catch (error) {
      if (
        !(error instanceof MobileError) ||
        error.code !== "profile_required" ||
        parsed.data.choice !== "keep"
      )
        throw error
      await recordDeferredRegistrationKeep(
        proof,
        parsed.data.submission,
        parsed.data.expectedProfileRevision,
        client,
      )
      return mobileJSON(await createProfileCompletionCapability(proof, client))
    }
    const session = await issueRegisteredSession(proof.session, proof.email, client)
    return mobileJSON({ session, bootstrap })
  })
}
