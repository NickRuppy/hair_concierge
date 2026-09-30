import Security
import XCTest
@testable import Chaarlie

final class OnboardingDraftTests: XCTestCase {
    func testBlankDraftDoesNotInferNoForScalpGate() throws {
        let questions = try fixture()
        var draft = OnboardingDraft()
        draft.step = try XCTUnwrap(questions.questions.firstIndex { $0.id == "scalp_type" })
        draft.select("balanced", in: questions)
        XCTAssertEqual(draft.scalpStep, .gate)
        XCTAssertFalse(draft.canAdvance(in: questions))
        XCTAssertFalse(draft.hasAnsweredScalpGate)
        XCTAssertFalse(draft.answers.has_scalp_issue)
    }

    func testScalpNoIsExplicitAndBackRetainsAnswers() throws {
        let questions = try fixture()
        var draft = OnboardingDraft()
        draft.step = try XCTUnwrap(questions.questions.firstIndex { $0.id == "scalp_type" })
        draft.answers.scalp_type = "balanced"
        draft.advance(in: questions)
        draft.setScalpIssue(false, in: questions)

        XCTAssertTrue(draft.hasAnsweredScalpGate)
        XCTAssertNil(draft.answers.scalp_condition)
        XCTAssertEqual(draft.step, 8)
        draft.back(in: questions)
        XCTAssertEqual(draft.step, 7)
        XCTAssertEqual(draft.scalpStep, .gate)
        XCTAssertEqual(draft.answers.scalp_type, "balanced")
    }

    func testChangedStructureRetainsLaterAnswerButBlocksCompletionUntilCorrected() throws {
        let questions = try fixture()
        var draft = completeDraft(questions)
        draft.step = 0
        draft.select("curly", in: questions)

        XCTAssertEqual(draft.answers.goals, ["volume"])
        XCTAssertEqual(draft.options(in: try XCTUnwrap(questions.question("goals"))).map(\.value), ["shine", "volume"])
        draft.step = questions.questions.count
        XCTAssertFalse(draft.isComplete(in: questions))
        draft.step = 9
        draft.select("volume", in: questions)
        draft.select("shine", in: questions)
        draft.step = questions.questions.count
        XCTAssertTrue(draft.isComplete(in: questions))
    }

    func testMalformedPositionAndUnansweredGateAreRejectedWithoutMutation() throws {
        let questions = try fixture()
        var draft = OnboardingDraft(step: questions.questions.count + 1)
        XCTAssertThrowsError(try draft.validate(in: questions))

        draft = OnboardingDraft(answers: QuizAnswers.blank, step: 0, scalpStep: .gate,
            hasAnsweredScalpGate: false)
        draft.answers.has_scalp_issue = true
        XCTAssertThrowsError(try draft.validate(in: questions))
    }

    func testPartialDraftRoundTripsWithBlankFutureSinglesButCannotAdvanceOrComplete() throws {
        let questions = try fixture()
        var answers = QuizAnswers.blank
        answers.structure = "straight"
        answers.thickness = "normal"
        let partial = OnboardingDraft(answers: answers, step: 2)
        let restored = try JSONDecoder().decode(OnboardingDraft.self, from: JSONEncoder().encode(partial))

        XCTAssertNoThrow(try restored.validate(in: questions))
        XCTAssertFalse(restored.canAdvance(in: questions))
        XCTAssertFalse(restored.isComplete(in: questions))
    }

    func testKeychainDraftRoundTripsAndDeleteUsesASeparateAccount() throws {
        let service = "de.chaarlie.scanner.local.tests.\(UUID().uuidString)"
        let store = KeychainOnboardingDraftStore(service: service)
        defer { try? store.save(nil) }
        let expected = OnboardingDraft()

        try store.save(expected)
        XCTAssertEqual(try store.load(), expected)
        try store.save(nil)
        XCTAssertNil(try store.load())
    }

    func testMalformedKeychainDraftFailsClosedAndIsNotDeleted() throws {
        let service = "de.chaarlie.scanner.local.tests.\(UUID().uuidString)"
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "onboarding-draft-v1",
            kSecAttrSynchronizable as String: false,
            kSecValueData as String: Data("not-json".utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        defer { SecItemDelete(query as CFDictionary) }
        XCTAssertEqual(SecItemAdd(query as CFDictionary, nil), errSecSuccess)

        let store = KeychainOnboardingDraftStore(service: service)
        XCTAssertThrowsError(try store.load()) { XCTAssertEqual($0 as? MobileError, .invalidResponse) }
        var readQuery = query
        readQuery[kSecReturnData as String] = true
        readQuery.removeValue(forKey: kSecValueData as String)
        var value: CFTypeRef?
        XCTAssertEqual(SecItemCopyMatching(readQuery as CFDictionary, &value), errSecSuccess)
        XCTAssertEqual(value as? Data, Data("not-json".utf8))
    }

    private func completeDraft(_ questions: OnboardingQuestions) -> OnboardingDraft {
        var answers = QuizAnswers.blank
        answers.structure = "straight"
        answers.thickness = "normal"
        answers.density = "medium"
        answers.hair_length = "long"
        answers.fingertest = "smooth"
        answers.pulltest = "elastic"
        answers.treatment = ["natural"]
        answers.scalp_type = "balanced"
        answers.has_scalp_issue = false
        answers.concerns = []
        answers.goals = ["volume"]
        return OnboardingDraft(answers: answers, step: questions.questions.count, scalpStep: .type,
            hasAnsweredScalpGate: true)
    }

    private func fixture() throws -> OnboardingQuestions {
        func option(_ value: String) -> EditQuestion.Option { .init(value: value, label: value, description: nil) }
        func question(_ id: String, _ options: [String], mode: EditQuestion.SelectionMode = .single,
                      byTexture: [String: [EditQuestion.Option]]? = nil) -> EditQuestion {
            .init(id: id, title: id, instruction: id, selectionMode: mode, options: options.map(option),
                maxSelections: mode == .multi ? 5 : nil, conditionOptions: id == "scalp_type" ? [option("dry")] : nil,
                optionsByTexture: byTexture)
        }
        let questions = OnboardingQuestions(version: 1, questions: [
            question("structure", ["straight", "curly"]), question("thickness", ["normal"]),
            question("density", ["medium"]), question("hair_length", ["long"]),
            question("fingertest", ["smooth"]), question("pulltest", ["elastic"]),
            question("treatment", ["natural"], mode: .multi), question("scalp_type", ["balanced"]),
            question("concerns", ["dryness"], mode: .multi),
            question("goals", ["shine"], mode: .multi, byTexture: [
                "straight": [option("shine"), option("volume")], "curly": [option("shine")]
            ])
        ])
        try questions.validate()
        return questions
    }
}
