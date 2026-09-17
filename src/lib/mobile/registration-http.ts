import { MobileError } from "./errors"
import { RegistrationCompletionError } from "./registration-completion"
/** Preserve the completion contract's actionable errors through the shared route boundary. */
export async function completionResult<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation
  } catch (error) {
    if (error instanceof RegistrationCompletionError) {
      if (error.code === "profile_conflict") throw new MobileError("profile_conflict", 409)
      if (error.code === "profile_required") throw new MobileError("profile_required", 403)
      if (error.code === "invalid_attempt") throw new MobileError("invalid_or_expired_code", 401)
      if (error.code === "invalid_submission") throw new MobileError("invalid_request", 400)
    }
    throw error
  }
}
