import XCTest
@testable import Chaarlie

@MainActor final class OnboardingModelTests: XCTestCase {
    func testNewDraftStartsAtWelcomeWithoutPersistingAnEmptyQuiz() throws {
        let store = TestOnboardingStore(nil)
        let model = try make(store: store)
        model.load()
        XCTAssertEqual(model.stage, .welcome)
        XCTAssertNil(try store.load())
        model.suspend()
        XCTAssertEqual(model.stage, .welcome, "Returning from existing login must not invent an empty resume prompt")
        XCTAssertNil(try store.load())
    }

    func testWelcomeBackPreservesAnswersAndDraftWhileResumeAndRestartStayExplicit() throws {
        let store = TestOnboardingStore(nil)
        let model = try make(store: store)
        model.load(); model.startQuiz()
        XCTAssertEqual(model.stage, .quiz)
        XCTAssertNil(try store.load(), "Starting alone does not create a persisted empty draft")
        model.select("curly")
        XCTAssertEqual(model.draft.step, 1)
        model.back(); XCTAssertEqual(model.draft.step, 0)
        let saved = try store.load()
        model.back()
        XCTAssertEqual(model.stage, .welcome)
        XCTAssertEqual(model.draft.answers.structure, "curly")
        XCTAssertEqual(try store.load(), saved)
        model.startQuiz()
        XCTAssertEqual(model.stage, .quiz)
        XCTAssertEqual(model.draft.answers.structure, "curly")
        let reopened = try make(store: store)
        reopened.load(); XCTAssertEqual(reopened.stage, .resume)
        reopened.resume(); XCTAssertEqual(reopened.stage, .quiz)
        XCTAssertEqual(reopened.draft.answers.structure, "curly")
        reopened.back(); XCTAssertEqual(reopened.stage, .welcome)
        reopened.suspend(); XCTAssertEqual(reopened.stage, .welcome)
        XCTAssertEqual(try store.load(), saved, "Existing login must not discard the anonymous draft")
        reopened.restart()
        XCTAssertEqual(reopened.stage, .quiz)
        XCTAssertEqual(reopened.draft.answers.structure, "")
        XCTAssertNil(try store.load())
    }

    func testFixtureSearchResolvesSelectedIdentityAndRejectsUnknownRequests() async throws {
        let store = MemorySessionStore()
        try store.saveSession(.init(accessToken: "synthetic-access", refreshToken: "synthetic-refresh",
                                    expiresAt: 4_102_444_800, userId: "synthetic-user"))
        let configuration = try MobileConfiguration(baseURL: XCTUnwrap(URL(string: "http://127.0.0.1:3218/api/mobile/v1")))
        let client = MobileClient(configuration: configuration, transport: DesignReviewTransport(scenario: .scan), store: store)
        let products = try await client.search("Chaarlie").results
        XCTAssertEqual(products.count, 2)
        for product in products {
            let result = try await client.resolve(.product(product.id))
            XCTAssertEqual(result.kind, .assessment)
            XCTAssertEqual(result.product?.id, product.id)
            XCTAssertTrue(result.mismatchSummary?.contains("Synthetische Testdaten") == true)
            XCTAssertNil(result.product?.imageUrl); XCTAssertNil(result.product?.purchaseUrl)
            try result.validate()
        }
        do { _ = try await client.resolve(.product("not-a-fixture-product")); XCTFail("Unknown fixture actions must fail locally") }
        catch { XCTAssertEqual(error as? MobileError, .invalidResponse) }
        let session = await client.currentSession()
        XCTAssertEqual(session?.userId, "synthetic-user")
    }

    func testResumeRestartStoresOnlyQuizAndClearsIdentityChoices() throws {
        let store = TestOnboardingStore(OnboardingFixtureView.completedDraft())
        let model = try make(store: store)
        model.load(); XCTAssertEqual(model.stage, .resume)
        model.resume(); XCTAssertEqual(model.stage, .registration)
        model.firstName = "Lea"; model.email = "lea@example.test"; model.marketingOptIn = true
        model.restart()
        XCTAssertNil(try store.load()); XCTAssertEqual(model.stage, .quiz)
        XCTAssertEqual(model.draft.answers.structure, "")
        XCTAssertEqual(model.email, ""); XCTAssertFalse(model.marketingOptIn)
    }
    func testDefaultGatewayNeverRegistersAndKeepsDraft() async throws {
        let store = TestOnboardingStore(OnboardingFixtureView.completedDraft())
        let model = try make(store: store)
        prepare(model); await model.submit()
        XCTAssertEqual(model.stage, .registration); XCTAssertNil(model.attempt)
        XCTAssertTrue(model.error?.contains("E-Mail") == true)
        XCTAssertNotNil(try store.load()); XCTAssertFalse(model.isSyntheticFixture)
    }
    func testWrongCodePreservesDraftAndVerificationDoesNotGrantMarketing() async throws {
        let store = TestOnboardingStore(OnboardingFixtureView.completedDraft())
        let gateway = RecordingOnboardingGateway()
        let model = try make(store: store, gateway: gateway)
        prepare(model); XCTAssertFalse(model.marketingOptIn)
        await model.submit(); model.code = "00000000"; await model.verifyCode()
        XCTAssertEqual(model.stage, .verification); XCTAssertNotNil(try store.load())
        XCTAssertFalse(model.marketingOptIn)
        model.code = "12345678"; await model.verifyCode()
        XCTAssertEqual(model.stage, .finished); XCTAssertNil(try store.load())
        let submissions = await gateway.submissions
        XCTAssertEqual(submissions.count, 1); XCTAssertFalse(submissions[0].marketingOptIn)
    }
    func testCompletionFailureKeepsSameOperationAndClearsOnlyAfterAcknowledgment() async throws {
        let store = TestOnboardingStore(OnboardingFixtureView.completedDraft())
        let gateway = RecordingOnboardingGateway(failComplete: true)
        let model = try make(store: store, gateway: gateway)
        prepare(model); await model.submit(); model.code = "12345678"; await model.verifyCode()
        XCTAssertEqual(model.stage, .completion); XCTAssertNotNil(try store.load())
        await model.retryCompletion()
        XCTAssertEqual(model.stage, .finished); XCTAssertNil(try store.load())
        let calls = await gateway.completions
        XCTAssertEqual(calls.count, 2); XCTAssertEqual(calls[0].requestId, calls[1].requestId)
    }
    func testExpiredOrConflictedCompletionReturnsToFreshRegistrationWithoutLosingQuiz() async throws {
        for error in [MobileError.unauthorized, .profileConflict] {
            let gateway = RecordingOnboardingGateway(completeError: error)
            let store = TestOnboardingStore(OnboardingFixtureView.completedDraft())
            let model = try make(store: store, gateway: gateway)
            prepare(model); await model.submit()
            let firstSubmissions = await gateway.submissions
            let firstID = try XCTUnwrap(firstSubmissions.last?.requestId)
            model.code = "12345678"; await model.verifyCode()
            XCTAssertEqual(model.stage, .registration)
            XCTAssertEqual(model.draft.answers, OnboardingFixtureView.completedDraft().answers)
            XCTAssertEqual(model.firstName, "Lea"); XCTAssertEqual(model.email, "lea@example.test")
            await model.submit()
            let secondSubmissions = await gateway.submissions
            let secondID = try XCTUnwrap(secondSubmissions.last?.requestId)
            XCTAssertNotEqual(firstID, secondID)
        }
    }
    func testResendAndLinkCannotConsumeOldAttempt() async throws {
        let store = TestOnboardingStore(OnboardingFixtureView.completedDraft())
        let gateway = RecordingOnboardingGateway()
        let model = try make(store: store, gateway: gateway)
        prepare(model); await model.submit()
        let old = try XCTUnwrap(model.attempt)
        await model.resend(); XCTAssertNotEqual(model.attempt?.attemptId, old.attemptId)
        _ = await model.receive(try XCTUnwrap(URL(string: "chaarlie-local://auth#attemptId=\(old.attemptId)&tokenHash=onboarding-fixture-token")))
        XCTAssertEqual(model.stage, .verification)
        await model.simulateLink()
        XCTAssertEqual(model.stage, .finished)
        let count = await gateway.verifyCalls
        XCTAssertEqual(count, 1)
    }
    func testExistingProfileRequiresExplicitChoiceBeforeCompletion() async throws {
        for replace in [false, true] {
            let store = TestOnboardingStore(OnboardingFixtureView.completedDraft())
            let gateway = RecordingOnboardingGateway(existing: true)
            let model = try make(store: store, gateway: gateway)
            prepare(model); await model.submit(); model.code = "12345678"; await model.verifyCode()
            XCTAssertEqual(model.stage, .profileChoice); XCTAssertNotNil(try store.load())
            let before = await gateway.completions.count; XCTAssertEqual(before, 0)
            await model.chooseExistingProfile(replace: replace)
            XCTAssertEqual(model.stage, .finished)
            let choice = await gateway.choices; XCTAssertEqual(choice, [replace])
        }
    }
    func testRegistrationRetryPreservesIDAndChangedInputRotatesIt() async throws {
        let gateway = RecordingOnboardingGateway(failRegister: true)
        let model = try make(store: TestOnboardingStore(OnboardingFixtureView.completedDraft()), gateway: gateway)
        prepare(model); await model.submit(); await model.submit()
        model.email = "second@example.test"; await model.submit()
        let submissions = await gateway.submissions
        XCTAssertEqual(submissions[0].requestId, submissions[1].requestId)
        XCTAssertNotEqual(submissions[1].requestId, submissions[2].requestId)
    }
    func testLateRegistrationAfterRestartCannotReplaceNewDraft() async throws {
        let gateway = SuspendedOnboardingGateway()
        let store = TestOnboardingStore(OnboardingFixtureView.completedDraft())
        let model = try make(store: store, gateway: gateway)
        prepare(model)
        let task = Task { await model.submit() }
        await gateway.waitForStart()
        model.restart(); model.select("curly")
        await gateway.release(); await task.value
        XCTAssertEqual(model.stage, .quiz); XCTAssertNil(model.attempt); XCTAssertFalse(model.busy)
        XCTAssertEqual(model.draft.answers.structure, "curly")
        XCTAssertEqual(try store.load()?.answers.structure, "curly")
    }
    func testExistingLoginSuspendsWithoutClaimingOrErasingAnonymousDraft() async throws {
        let gateway = SuspendedOnboardingGateway()
        let store = TestOnboardingStore(OnboardingFixtureView.completedDraft())
        let model = try make(store: store, gateway: gateway)
        prepare(model); let task = Task { await model.submit() }; await gateway.waitForStart()
        model.suspend(); await gateway.release(); await task.value
        XCTAssertEqual(model.stage, .resume); XCTAssertNil(model.attempt); XCTAssertNotNil(try store.load())
        XCTAssertEqual(model.email, ""); XCTAssertFalse(model.marketingOptIn)
    }
    func testFailedLocalWriteCanRetryWithoutLosingCurrentAnswer() throws {
        let store = TestOnboardingStore(nil)
        let model = try make(store: store); model.load(); model.startQuiz(); store.failSave = true
        model.select("wavy")
        XCTAssertEqual(model.stage, .storageError); XCTAssertEqual(model.draft.answers.structure, "wavy")
        store.failSave = false; model.load()
        XCTAssertEqual(model.stage, .quiz); XCTAssertEqual(try store.load()?.answers.structure, "wavy")
    }
    func testMalformedPositionIsPreservedUntilExplicitRestart() throws {
        var invalid = OnboardingDraft(); invalid.step = 99
        let store = TestOnboardingStore(invalid); let model = try make(store: store)
        model.load(); XCTAssertEqual(model.stage, .storageError); XCTAssertEqual(try store.load()?.step, 99)
        model.restart(); XCTAssertNil(try store.load()); XCTAssertEqual(model.stage, .quiz)
    }
    func testSyntheticCodeAndLinkShareOneUseAndResendInvalidatesOldAttempt() async throws {
        for useLink in [false, true] {
            let gateway = SyntheticOnboardingGateway(scenario: "fresh")
            let submission = OnboardingSubmission(requestId: UUID(), answers: OnboardingFixtureView.completedDraft().answers,
                firstName: "Lea", email: "lea@example.test", marketingOptIn: false)
            let old = try await gateway.register(submission)
            let attempt = try await gateway.register(submission)
            do { _ = try await gateway.verify(old, code: "12345678", tokenHash: nil); XCTFail("Old attempt must be rejected") }
            catch { XCTAssertEqual(error as? MobileError, .invalidCode) }
            _ = try await gateway.verify(attempt, code: useLink ? nil : "12345678", tokenHash: useLink ? "onboarding-fixture-token" : nil)
            do { _ = try await gateway.verify(attempt, code: useLink ? "12345678" : nil, tokenHash: useLink ? nil : "onboarding-fixture-token"); XCTFail("Other verification path must not replay") }
            catch { XCTAssertEqual(error as? MobileError, .invalidCode) }
        }
    }
    func testLateCompletionAfterRestartCannotEraseNewerDraft() async throws {
        let gateway = SuspendedCompletionGateway()
        let store = TestOnboardingStore(OnboardingFixtureView.completedDraft())
        let model = try make(store: store, gateway: gateway)
        prepare(model); await model.submit(); model.code = "12345678"
        let task = Task { await model.verifyCode() }
        await gateway.waitForStart()
        model.restart(); model.select("curly")
        await gateway.release(); await task.value
        XCTAssertEqual(model.stage, .quiz)
        XCTAssertEqual(try store.load()?.answers.structure, "curly")
        XCTAssertFalse(model.busy)
    }
    private func make(store: TestOnboardingStore, gateway: any OnboardingGateway = UnavailableOnboardingGateway()) throws -> OnboardingModel {
        OnboardingModel(questions: try OnboardingQuestions.bundled(), store: store, gateway: gateway)
    }
    private func prepare(_ model: OnboardingModel) {
        model.load(); model.resume(); model.firstName = "Lea"; model.email = "lea@example.test"
    }
}
private final class TestOnboardingStore: OnboardingDraftPersistence, @unchecked Sendable {
    var value: OnboardingDraft?; var failSave = false
    init(_ value: OnboardingDraft?) { self.value = value }
    func load() throws -> OnboardingDraft? { value }
    func save(_ draft: OnboardingDraft?) throws { if failSave { throw MobileError.unavailable }; value = draft }
}
private actor RecordingOnboardingGateway: OnboardingGateway {
    nonisolated let isSyntheticFixture = true
    var submissions: [OnboardingSubmission] = []; var completions: [OnboardingSubmission] = []; var choices: [Bool] = []; var verifyCalls = 0
    let existing: Bool; var failComplete: Bool; var completeError: MobileError?; let failRegister: Bool
    init(existing: Bool = false, failComplete: Bool = false, completeError: MobileError? = nil, failRegister: Bool = false) { self.existing = existing; self.failComplete = failComplete; self.completeError = completeError; self.failRegister = failRegister }
    func register(_ submission: OnboardingSubmission) async throws -> AuthAttempt {
        submissions.append(submission); if failRegister { throw MobileError.unavailable }
        return .init(attemptId: UUID().uuidString, codeLength: 8)
    }
    func verify(_ attempt: AuthAttempt, code: String?, tokenHash: String?) async throws -> OnboardingVerifiedAccount {
        verifyCalls += 1
        guard code == "12345678" || tokenHash == "onboarding-fixture-token" else { throw MobileError.invalidCode }
        return .init(id: UUID(), hasExistingProfile: existing)
    }
    func complete(_ account: OnboardingVerifiedAccount, submission: OnboardingSubmission,
                  choice: RegistrationCompleteRequest.Choice) async throws -> RegistrationCompletion {
        completions.append(submission)
        if choice != .create { choices.append(choice == .replace) }
        if let completeError { self.completeError = nil; throw completeError }
        if failComplete { failComplete = false; throw MobileError.unavailable }
        return registrationCompletion(account)
    }
}
private actor SuspendedOnboardingGateway: OnboardingGateway {
    nonisolated let isSyntheticFixture = true
    var continuation: CheckedContinuation<AuthAttempt, Never>?
    func register(_ submission: OnboardingSubmission) async throws -> AuthAttempt { await withCheckedContinuation { continuation = $0 } }
    func waitForStart() async { while continuation == nil { await Task.yield() } }
    func release() { continuation?.resume(returning: .init(attemptId: UUID().uuidString, codeLength: 8)); continuation = nil }
    func verify(_ attempt: AuthAttempt, code: String?, tokenHash: String?) async throws -> OnboardingVerifiedAccount { throw MobileError.unavailable }
    func complete(_ account: OnboardingVerifiedAccount, submission: OnboardingSubmission,
                  choice: RegistrationCompleteRequest.Choice) async throws -> RegistrationCompletion { throw MobileError.unavailable }
}

private actor SuspendedCompletionGateway: OnboardingGateway {
    nonisolated let isSyntheticFixture = true
    var continuation: CheckedContinuation<RegistrationCompletion, Never>?
    func register(_ submission: OnboardingSubmission) async throws -> AuthAttempt { .init(attemptId: UUID().uuidString, codeLength: 8) }
    func verify(_ attempt: AuthAttempt, code: String?, tokenHash: String?) async throws -> OnboardingVerifiedAccount { .init(id: UUID(), hasExistingProfile: false) }
    func complete(_ account: OnboardingVerifiedAccount, submission: OnboardingSubmission,
                  choice: RegistrationCompleteRequest.Choice) async throws -> RegistrationCompletion {
        await withCheckedContinuation { continuation = $0 }
    }
    func waitForStart() async { while continuation == nil { await Task.yield() } }
    func release() {
        continuation?.resume(returning: registrationCompletion(.init(id: UUID(), hasExistingProfile: false)))
        continuation = nil
    }
}

private func registrationCompletion(_ account: OnboardingVerifiedAccount) -> RegistrationCompletion {
    .init(session: .init(accessToken: "test-access", refreshToken: "test-refresh", expiresAt: 4_102_444_800,
                         userId: account.id.uuidString),
          bootstrap: .init(status: .ready, profileRevision: "revision", contextRevision: "context"))
}
