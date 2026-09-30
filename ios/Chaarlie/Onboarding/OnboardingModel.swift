import Foundation
import Observation

struct OnboardingSubmission: Equatable, Sendable {
    let requestId: UUID
    let answers: QuizAnswers
    let firstName: String
    let email: String
    let marketingOptIn: Bool
}
struct OnboardingVerifiedAccount: Equatable, Sendable {
    let id: UUID
    let hasExistingProfile: Bool
    let profileRevision: String
    init(id: UUID, hasExistingProfile: Bool, profileRevision: String = "") {
        self.id = id; self.hasExistingProfile = hasExistingProfile; self.profileRevision = profileRevision
    }
}
protocol OnboardingGateway: Sendable {
    var isSyntheticFixture: Bool { get }
    func register(_ submission: OnboardingSubmission) async throws -> AuthAttempt
    func verify(_ attempt: AuthAttempt, code: String?, tokenHash: String?) async throws -> OnboardingVerifiedAccount
    /// The response must already acknowledge scanner admission. It contains a session
    /// that the gateway itself is forbidden to install.
    func complete(_ account: OnboardingVerifiedAccount, submission: OnboardingSubmission,
                  choice: RegistrationCompleteRequest.Choice) async throws -> RegistrationCompletion
}
struct UnavailableOnboardingGateway: OnboardingGateway {
    let isSyntheticFixture = false
    func register(_ submission: OnboardingSubmission) async throws -> AuthAttempt { throw MobileError.unavailable }
    func verify(_ attempt: AuthAttempt, code: String?, tokenHash: String?) async throws -> OnboardingVerifiedAccount { throw MobileError.unavailable }
    func complete(_ account: OnboardingVerifiedAccount, submission: OnboardingSubmission,
                  choice: RegistrationCompleteRequest.Choice) async throws -> RegistrationCompletion { throw MobileError.unavailable }
}

@MainActor @Observable
final class OnboardingModel {
    enum Stage: Equatable { case welcome, resume, quiz, registration, verification, profileChoice, completion, finished, storageError }
    let questions: OnboardingQuestions
    private(set) var draft: OnboardingDraft
    private(set) var stage: Stage = .welcome
    private(set) var busy = false
    private(set) var error: String?
    private(set) var attempt: AuthAttempt?
    var firstName = ""
    var email = ""
    var marketingOptIn = false
    var code = ""
    var isSyntheticFixture: Bool { gateway.isSyntheticFixture }
    var keptExistingProfile: Bool { replaceExisting == false }
    var question: EditQuestion? { draft.question(in: questions) }
    var options: [EditQuestion.Option] { draft.options(in: questions) }
    var canAdvance: Bool { !busy && draft.canAdvance(in: questions) }
    var canSubmit: Bool {
        let name = firstName.trimmingCharacters(in: .whitespacesAndNewlines)
        let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
        return !busy && draft.isComplete(in: questions) && (1...100).contains(name.count)
            && address.count <= 254 && address.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil
    }
    var canVerify: Bool { !busy && attempt != nil && code.count == attempt?.codeLength && code.allSatisfy { $0.isASCII && $0.isNumber } }
    private let store: any OnboardingDraftPersistence
    private let gateway: any OnboardingGateway
    private var generation = UUID()
    private var submitted: OnboardingSubmission?
    private var verified: OnboardingVerifiedAccount?
    private var replaceExisting: Bool?
    private let ready: @MainActor @Sendable (RegistrationCompletion) async -> Bool
    private var loaded = false
    private var pendingSave = false

    init(questions: OnboardingQuestions, store: any OnboardingDraftPersistence = KeychainOnboardingDraftStore(),
         gateway: any OnboardingGateway = UnavailableOnboardingGateway(),
         ready: @escaping @MainActor @Sendable (RegistrationCompletion) async -> Bool = { _ in true }) {
        self.questions = questions; self.store = store; self.gateway = gateway; self.ready = ready
        draft = OnboardingDraft(version: questions.version)
    }
    func load() {
        guard !loaded || stage == .storageError else { return }
        do {
            try questions.validate()
            if pendingSave { try store.save(draft); pendingSave = false; routeDraft() }
            else if let saved = try store.load() {
                try saved.validate(in: questions)
                draft = saved; stage = .resume
            } else { stage = .welcome }
            loaded = true; error = nil
        } catch {
            stage = .storageError
            self.error = "Dein Haar-Check konnte auf diesem iPhone nicht geladen oder gespeichert werden. Bitte versuche es erneut."
        }
    }
    func startQuiz() { guard !busy, stage == .welcome else { return }; routeDraft() }
    func resume() { guard !busy, stage == .resume else { return }; routeDraft() }
    func restart() {
        invalidate()
        do {
            try store.save(nil)
            draft = OnboardingDraft(version: questions.version)
            pendingSave = false; loaded = true; stage = .quiz; error = nil
        } catch { stage = .storageError; self.error = "Der bisherige Haar-Check konnte nicht entfernt werden. Bitte versuche es erneut." }
    }
    func select(_ value: String) { update { $0.select(value, in: questions) } }
    func advance() { update { $0.advance(in: questions) } }
    func back() {
        if stage == .quiz, draft.step == 0, !busy {
            stage = .welcome // Presentation-only navigation: keep answers and the persisted draft.
            return
        }
        update { $0.back(in: questions) }
    }
    func setScalpIssue(_ value: Bool) { update { $0.setScalpIssue(value, in: questions) } }
    func selectCondition(_ value: String) { update { $0.selectCondition(value, in: questions) } }
    func clearConcerns() { update { $0.clearConcerns() } }
    func setOtherText(_ value: String) { update { $0.setOtherText(value) } }
    private func update(_ change: (inout OnboardingDraft) -> Void) {
        guard !busy, stage == .quiz || stage == .registration else { return }
        change(&draft); invalidateRegistrationAttempt(); error = nil
        do { try store.save(draft); routeDraft() }
        catch { pendingSave = true; stage = .storageError; self.error = "Deine letzte Antwort konnte nicht gespeichert werden. Bitte versuche es erneut." }
    }
    private func routeDraft() { stage = draft.step == questions.questions.count ? .registration : .quiz }
    func editAccount() {
        guard !busy else { return }
        invalidateRegistrationAttempt(); error = nil; stage = .registration
    }
    func suspend() {
        invalidate()
        // An existing login never claims, publishes or replaces this anonymous quiz.
        if stage != .welcome && stage != .storageError && stage != .finished { stage = .resume }
    }
    private func invalidate() {
        invalidateRegistrationAttempt(); busy = false
        firstName = ""; email = ""; marketingOptIn = false; code = ""; error = nil
    }
    private func invalidateRegistrationAttempt() {
        generation = UUID(); attempt = nil; verified = nil; submitted = nil; replaceExisting = nil; code = ""
    }
    func submit() async {
        guard stage == .registration, canSubmit else { return }
        let candidate = OnboardingSubmission(requestId: submitted?.requestId ?? UUID(), answers: draft.answers,
            firstName: firstName.trimmingCharacters(in: .whitespacesAndNewlines),
            email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), marketingOptIn: marketingOptIn)
        if let prior = submitted, prior.answers != candidate.answers || prior.firstName != candidate.firstName || prior.email != candidate.email || prior.marketingOptIn != candidate.marketingOptIn {
            generation = UUID()
            submitted = .init(requestId: UUID(), answers: candidate.answers, firstName: candidate.firstName, email: candidate.email, marketingOptIn: candidate.marketingOptIn)
        } else { submitted = candidate }
        await sendRegistration()
    }
    func resend() async {
        guard !busy, stage == .verification, submitted != nil else { return }
        // Retain exact submitted values; replacing the attempt invalidates old link/code routes.
        generation = UUID(); attempt = nil; verified = nil; code = ""
        await sendRegistration()
    }
    private func sendRegistration() async {
        guard let submission = submitted else { return }
        let current = generation
        busy = true; error = nil
        do {
            let value = try await gateway.register(submission)
            guard current == generation else { return }
            guard UUID(uuidString: value.attemptId) != nil, (6...12).contains(value.codeLength) else { throw MobileError.invalidResponse }
            attempt = value; code = ""; stage = .verification
        } catch {
            guard current == generation else { return }
            self.error = "Die E-Mail konnte gerade nicht angefordert werden. Bitte versuche es erneut."
            if attempt == nil { stage = .registration }
        }
        guard current == generation else { return }; busy = false
    }
    func verifyCode() async { guard canVerify else { return }; await verify(code: code, tokenHash: nil) }
    func receive(_ url: URL) async -> Bool {
        guard RegistrationCallback.matchesDestination(url) else { return false }
        guard stage == .verification, !busy, let attempt,
              let callback = RegistrationCallback.parse(url, pending: attempt), callback.attemptId == attempt.attemptId else { return true }
        await verify(code: nil, tokenHash: callback.tokenHash)
        return true
    }
    #if DEBUG
    func simulateLink() async {
        guard isSyntheticFixture, let attempt,
              let url = URL(string: "chaarlie-local://auth#attemptId=\(attempt.attemptId)&tokenHash=onboarding-fixture-token") else { return }
        _ = await receive(url)
    }
    #endif
    private func verify(code: String?, tokenHash: String?) async {
        guard !busy, stage == .verification, let attempt else { return }
        let current = generation; busy = true; error = nil
        do {
            let value = try await gateway.verify(attempt, code: code, tokenHash: tokenHash)
            guard current == generation else { return }
            verified = value; self.attempt = nil; self.code = ""; busy = false
            if value.hasExistingProfile { stage = .profileChoice }
            else { stage = .completion; await retryCompletion() }
        } catch {
            guard current == generation else { return }
            self.error = "Der Code oder Link ist ungültig oder abgelaufen. Prüfe den Code oder fordere eine neue E-Mail an."
            busy = false
        }
    }
    func chooseExistingProfile(replace: Bool) async {
        guard !busy, stage == .profileChoice, verified?.hasExistingProfile == true else { return }
        replaceExisting = replace; stage = .completion; await retryCompletion()
    }
    func retryCompletion() async {
        guard !busy, stage == .completion, let verified, let submitted,
              !verified.hasExistingProfile || replaceExisting != nil else { return }
        let current = generation; busy = true; error = nil
        do {
            let choice: RegistrationCompleteRequest.Choice
            if verified.hasExistingProfile { choice = replaceExisting == true ? .replace : .keep }
            else { choice = .create }
            let response = try await gateway.complete(verified, submission: submitted, choice: choice)
            guard current == generation else { return }
            guard await ready(response), current == generation else { throw MobileError.unavailable }
            try store.save(nil)
            pendingSave = false; stage = .finished; firstName = ""; email = ""; marketingOptIn = false
            self.submitted = nil; self.verified = nil
        } catch {
            guard current == generation else { return }
            if error as? MobileError == .unauthorized || error as? MobileError == .invalidCode {
                invalidateRegistrationAttempt()
                stage = .registration
                self.error = "Deine Bestätigung ist abgelaufen. Fordere eine neue E-Mail an."
                busy = false
                return
            } else if error as? MobileError == .profileConflict {
                invalidateRegistrationAttempt()
                stage = .registration
                self.error = "Dein Haarprofil wurde geändert. Bitte fordere eine neue E-Mail an."
                busy = false
                return
            } else {
                self.error = "Deine Haarangaben konnten noch nicht bestätigt werden. Deine Antworten bleiben erhalten. Bitte versuche es erneut."
            }
        }
        guard current == generation else { return }; busy = false
    }
}
