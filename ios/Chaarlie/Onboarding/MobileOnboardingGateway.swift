import Foundation

/// The only native caller of the disabled registration endpoints. It retains the
/// short-lived completion capability in actor memory, never in the draft or Keychain.
actor MobileOnboardingGateway: OnboardingGateway {
    nonisolated let isSyntheticFixture = false

    private let client: MobileClient
    private var pending: (attempt: AuthAttempt, token: String, account: OnboardingVerifiedAccount)?

    init(client: MobileClient) { self.client = client }

    func register(_ submission: OnboardingSubmission) async throws -> AuthAttempt {
        pending = nil
        return try await client.registrationStart(submission.body)
    }

    func verify(_ attempt: AuthAttempt, code: String?, tokenHash: String?) async throws -> OnboardingVerifiedAccount {
        guard pending == nil else { throw MobileError.stale }
        let response = try await client.registrationVerify(attemptId: attempt.attemptId, code: code, tokenHash: tokenHash)
        let account = OnboardingVerifiedAccount(id: response.userId,
                                                hasExistingProfile: response.hasExistingProfile,
                                                profileRevision: response.profileRevision)
        pending = (attempt, response.completionToken, account)
        return account
    }

    func complete(_ account: OnboardingVerifiedAccount, submission: OnboardingSubmission,
                  choice: RegistrationCompleteRequest.Choice) async throws -> RegistrationCompletion {
        guard let pending, pending.account == account else { throw MobileError.stale }
        let response = try await client.registrationComplete(.init(completionToken: pending.token,
                                                                    submission: submission.body,
                                                                    choice: choice,
                                                                    expectedProfileRevision: account.profileRevision))
        return response
    }
}

private extension OnboardingSubmission {
    var body: RegistrationSubmissionBody {
        .init(requestId: requestId, answers: answers, firstName: firstName, email: email, marketingOptIn: marketingOptIn)
    }
}
