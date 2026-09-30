#if DEBUG
import SwiftUI
import Foundation

/// Explicit in-memory QA host. No URLSession, provider, real token, or auth Keychain access.
struct OnboardingFixtureView: View {
    static var enabled: Bool { ProcessInfo.processInfo.arguments.contains("--ui-onboarding-fixture") }
    @State private var model: OnboardingModel
    @State private var login = false
    private let scannerScenario: DesignReviewScenario
    init() {
        let scenario = ProcessInfo.processInfo.environment["CHAARLIE_ONBOARDING_SCENARIO"] ?? "fresh"
        scannerScenario = scenario == "scan-retry" ? .scanResolveError : .scan
        let questions = try! OnboardingQuestions.bundled()
        var seed: OnboardingDraft?
        if scenario == "quiz" {
            let environment = ProcessInfo.processInfo.environment
            let step = Int(environment["CHAARLIE_QUIZ_QUESTION"] ?? "1") ?? 1
            let texture = environment["CHAARLIE_QUIZ_TEXTURE"] ?? "wavy"
            var draft = Self.completedDraft()
            draft.step = min(max(step - 1, 0), 9)
            draft.answers.structure = ["straight", "wavy", "curly", "coily"].contains(texture) ? texture : "wavy"
            draft.answers.treatment = []; draft.answers.concerns = []; draft.answers.goals = []
            draft.hasAnsweredScalpGate = false
            seed = draft
        } else if scenario == "resume" {
            var draft = OnboardingDraft(); draft.answers.structure = "wavy"; draft.answers.thickness = "fine"; draft.step = 2
            seed = draft
        } else if scenario != "fresh" {
            seed = Self.completedDraft()
        }
        let gateway: any OnboardingGateway = scenario == "unavailable" ? UnavailableOnboardingGateway() : SyntheticOnboardingGateway(scenario: scenario)
        let model = OnboardingModel(questions: questions, store: FixtureOnboardingDraftStore(seed), gateway: gateway)
        model.load()
        if scenario != "resume" { model.resume() }
        _model = State(initialValue: model)
    }
    var body: some View {
        Group {
            if model.stage == .finished {
                DesignReviewFixture(scenario: scannerScenario, onboardingAnswers: model.keptExistingProfile ? nil : model.draft.answers)
            } else if login { DesignReviewFixture(scenario: .login) }
            else {
                OnboardingView(model: model) { login = true }
                    .onOpenURL { url in Task { await model.receive(url) } }
            }
        }
        .chaarlieSystemFont().foregroundStyle(ChaarlieTheme.ink)
        .tint(ChaarlieTheme.plum).background(ChaarlieTheme.background).preferredColorScheme(.light)
    }
    static func completedDraft() -> OnboardingDraft {
        var draft = OnboardingDraft()
        draft.answers = QuizAnswers(structure: "wavy", thickness: "fine", density: "medium", hair_length: "long",
            fingertest: "glatt", pulltest: "stretches_bounces", scalp_type: "ausgeglichen", has_scalp_issue: false,
            scalp_condition: nil, treatment: ["natur"], concerns: [], goals: ["shine"], concerns_other_text: nil)
        draft.step = 10; draft.hasAnsweredScalpGate = true
        return draft
    }
}

final class FixtureOnboardingDraftStore: OnboardingDraftPersistence, @unchecked Sendable {
    private let lock = NSLock()
    private var value: OnboardingDraft?
    init(_ draft: OnboardingDraft? = nil) { value = draft }
    func load() throws -> OnboardingDraft? { lock.withLock { value } }
    func save(_ draft: OnboardingDraft?) throws { lock.withLock { value = draft } }
}
actor SyntheticOnboardingGateway: OnboardingGateway {
    nonisolated let isSyntheticFixture = true
    private let scenario: String
    private var pending: AuthAttempt?
    private var submission: OnboardingSubmission?
    private var verified: OnboardingVerifiedAccount?
    private var completeAttempts = 0
    init(scenario: String) { self.scenario = scenario }
    func register(_ submission: OnboardingSubmission) async throws -> AuthAttempt {
        self.submission = submission; verified = nil
        let attempt = AuthAttempt(attemptId: UUID().uuidString, codeLength: 8)
        pending = attempt; return attempt
    }
    func verify(_ attempt: AuthAttempt, code: String?, tokenHash: String?) async throws -> OnboardingVerifiedAccount {
        guard attempt == pending, submission != nil,
              (code == "12345678" && tokenHash == nil) || (code == nil && tokenHash == "onboarding-fixture-token") else { throw MobileError.invalidCode }
        pending = nil
        let value = OnboardingVerifiedAccount(id: UUID(), hasExistingProfile: scenario == "conflict")
        verified = value; return value
    }
    func complete(_ account: OnboardingVerifiedAccount, submission: OnboardingSubmission,
                  choice: RegistrationCompleteRequest.Choice) async throws -> RegistrationCompletion {
        guard account == verified, submission == self.submission,
              !account.hasExistingProfile || choice != .create else { throw MobileError.profileConflict }
        completeAttempts += 1
        if scenario == "completion-failure", completeAttempts == 1 { throw MobileError.unavailable }
        // In-memory acknowledgement only. Does not create/link/publish any real account/profile.
        return .init(session: .init(accessToken: "synthetic-access", refreshToken: "synthetic-refresh",
                                    expiresAt: 4_102_444_800, userId: account.id.uuidString),
                     bootstrap: .init(status: .ready, profileRevision: "synthetic", contextRevision: "synthetic"))
    }
}
#endif
