import XCTest
@testable import Chaarlie

final class ProfileEditTests: XCTestCase {
    func testMissingLegacyLengthRequiresAnExplicitAnswer() throws {
        var draft = ProfileEditDraft(snapshot: try snapshot(length: nil))
        draft.step = 3
        XCTAssertFalse(draft.canAdvance)
        draft.select("long")
        XCTAssertEqual(draft.answers.hair_length, "long")
        XCTAssertEqual(draft.step, 4)
    }
    func testPrefillBackAndCancelDoNotMutateSnapshot() throws {
        let source = try snapshot()
        var draft = ProfileEditDraft(snapshot: source)
        draft.advance()
        XCTAssertEqual(draft.answers.structure, "wavy")
        draft.select("straight")
        XCTAssertEqual(draft.step, 1)
        draft.back()
        XCTAssertEqual(draft.answers.structure, "straight")
        XCTAssertEqual(source.answers.structure, "wavy")
    }
    func testExclusiveTreatmentAndUncappedRegularQuizGoals() throws {
        var draft = ProfileEditDraft(snapshot: try snapshot(legacyVolumeGoal: true))
        draft.step = 6
        draft.select("blondiert")
        XCTAssertEqual(draft.answers.treatment, ["blondiert"])
        draft.select("natur")
        XCTAssertEqual(draft.answers.treatment, ["natur"])
        draft.step = 9
        draft.select("less_volume")
        XCTAssertEqual(draft.answers.goals, ["less_volume"])
        for goal in ["shine", "moisture", "strength_ends", "manageability_styling", "shape_definition"] { draft.select(goal) }
        XCTAssertEqual(draft.answers.goals.count, 6)
        XCTAssertTrue(draft.answers.goals.contains("shape_definition"))
    }
    func testScalpGateClearsConditionAndBackPreservesOtherAnswers() throws {
        var draft = ProfileEditDraft(snapshot: try snapshot())
        draft.step = 7
        draft.advance()
        XCTAssertEqual(draft.scalpStep, .gate)
        draft.setScalpIssue(false)
        XCTAssertNil(draft.answers.scalp_condition)
        XCTAssertEqual(draft.step, 8)
        draft.back()
        XCTAssertEqual(draft.step, 7)
        XCTAssertEqual(draft.scalpStep, .gate)
    }
    func testConcernsNoneAndOtherTextAreExplicitAndBounded() throws {
        var draft = ProfileEditDraft(snapshot: try snapshot())
        draft.step = 8
        draft.clearConcerns()
        XCTAssertTrue(draft.canAdvance)
        XCTAssertEqual(draft.answers.concerns, [])
        XCTAssertNil(draft.answers.concerns_other_text)
        draft.setOtherText(String(repeating: "x", count: 70))
        XCTAssertEqual(draft.answers.concerns_other_text?.count, 50)
    }
    func testSaveIdentitySurvivesRetryAndOnlyChangesForChangedPayload() throws {
        var draft = ProfileEditDraft(snapshot: try snapshot())
        let first = draft.saveRequest()
        XCTAssertEqual(first.requestId, draft.saveRequest().requestId)
        draft.step = 0
        draft.select("straight")
        let changed = draft.saveRequest()
        XCTAssertNotEqual(first.requestId, changed.requestId)
        XCTAssertEqual(changed.expectedProfileRevision, "2")
        XCTAssertEqual(changed.requestId, draft.saveRequest().requestId)
    }
    func testDTOUsesRawSnakeCaseAnswersAndUUIDRequestIdentity() throws {
        var draft = ProfileEditDraft(snapshot: try snapshot())
        let data = try JSONEncoder().encode(draft.saveRequest())
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertNotNil(UUID(uuidString: try XCTUnwrap(body["requestId"] as? String)))
        let answers = try XCTUnwrap(body["answers"] as? [String: Any])
        XCTAssertEqual(answers["has_scalp_issue"] as? Bool, true)
        XCTAssertEqual(answers["hair_length"] as? String, "long")
        XCTAssertNil(answers["hairLength"])
    }
    func testSharedServerFixturePrefillsAllQuestionsAndChangesTextureCopy() throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "profile-edit-v1", withExtension: "json"))
        let snapshot = try JSONDecoder().decode(ProfileEditSnapshot.self, from: Data(contentsOf: url))
        try snapshot.validate()
        XCTAssertEqual(snapshot.questions.map(\.id), ProfileEditSnapshot.questionIDs)
        XCTAssertEqual(snapshot.answers.concerns, ["dryness"])
        XCTAssertEqual(snapshot.answers.goals, ["less_volume"])
        XCTAssertEqual(snapshot.answers.concerns_other_text, "Meine Spitzen")
        let goals = try XCTUnwrap(snapshot.questions.last)
        XCTAssertNil(goals.maxSelections)
        XCTAssertNotNil(goals.optionsByTexture?["coily"])
        XCTAssertTrue(goals.options(for: "coily").contains { $0.value == "less_volume" })
        var draft = ProfileEditDraft(snapshot: snapshot)
        draft.step = 0
        draft.select("coily")
        XCTAssertEqual(draft.answers.structure, "coily")
        XCTAssertEqual(draft.answers.goals, ["less_volume"])
    }
    func testSinglePropertySelectionStaysOpenAndChangesOnlySelectedAnswer() throws {
        let source = try snapshot()
        var draft = ProfileEditDraft(snapshot: source, propertyID: "thickness")
        XCTAssertEqual(draft.question?.id, "thickness")
        XCTAssertFalse(draft.canSave)
        draft.select("coarse")
        XCTAssertEqual(draft.question?.id, "thickness", "One selection must not advance to another property")
        var expected = source.answers
        expected.thickness = "coarse"
        XCTAssertEqual(draft.answers, expected)
        XCTAssertTrue(draft.canSave)
        draft.select("fine")
        XCTAssertFalse(draft.hasChanges)
        XCTAssertFalse(draft.canSave)
    }
    func testSingleStructureEditPreservesLegacyGoalsAndEveryOtherAnswer() throws {
        let source = try snapshot(legacyVolumeGoal: true)
        var draft = ProfileEditDraft(snapshot: source, propertyID: "structure")
        draft.select("coily")
        var expected = source.answers
        expected.structure = "coily"
        XCTAssertEqual(draft.saveRequest().answers, expected)
        XCTAssertEqual(draft.question?.id, "structure")
        XCTAssertTrue(draft.canSave)
    }
    func testSingleScalpGroupRequiresExplicitConditionWithoutAdvancing() throws {
        let source = try snapshot()
        var draft = ProfileEditDraft(snapshot: source, propertyID: "scalp_type")
        draft.select("trocken")
        XCTAssertEqual(draft.question?.id, "scalp_type")
        draft.setScalpIssue(false)
        XCTAssertNil(draft.answers.scalp_condition)
        XCTAssertTrue(draft.canSave)
        draft.setScalpIssue(true)
        XCTAssertFalse(draft.canSave)
        draft.selectCondition("schuppen")
        XCTAssertTrue(draft.canSave)
        XCTAssertEqual(draft.question?.id, "scalp_type")
        var expected = source.answers
        expected.scalp_type = "trocken"
        expected.scalp_condition = "schuppen"
        XCTAssertEqual(draft.answers, expected)
    }
    func testSingleMissingLengthRecoveryIsExplicitAndPreservesOriginalChange() throws {
        let source = try snapshot(length: nil)
        var draft = ProfileEditDraft(snapshot: source, propertyID: "thickness")
        draft.select("coarse")
        XCTAssertFalse(draft.canSave)
        XCTAssertNil(draft.answers.hair_length)
        XCTAssertEqual(draft.missingLengthQuestion?.id, "hair_length")
        draft.selectMissingLength("invented")
        XCTAssertNil(draft.answers.hair_length)
        draft.selectMissingLength("short")
        var expected = source.answers
        expected.thickness = "coarse"
        expected.hair_length = "short"
        XCTAssertEqual(draft.answers, expected)
        XCTAssertEqual(draft.missingLengthQuestion?.id, "hair_length")
        XCTAssertTrue(draft.canSave)
        let first = draft.saveRequest()
        XCTAssertEqual(first.requestId, draft.saveRequest().requestId)
        XCTAssertEqual(first.answers, expected)
        var direct = ProfileEditDraft(snapshot: source, propertyID: "hair_length")
        XCTAssertNil(direct.missingLengthQuestion)
        direct.select("long")
        XCTAssertTrue(direct.canSave)
        XCTAssertEqual(direct.question?.id, "hair_length")
        XCTAssertNil(ProfileEditDraft(snapshot: try snapshot(), propertyID: "thickness").missingLengthQuestion)
    }
    func testSingleMultiChoiceUsesExistingExclusionsAndAllowsEmptyConcerns() throws {
        var draft = ProfileEditDraft(snapshot: try snapshot(legacyVolumeGoal: true), propertyID: "goals")
        draft.select("less_volume")
        XCTAssertEqual(draft.answers.goals, ["less_volume"])
        XCTAssertTrue(draft.canSave)
        draft.select("less_volume")
        XCTAssertFalse(draft.canSave)
        var concerns = ProfileEditDraft(snapshot: try snapshot(), propertyID: "concerns")
        concerns.clearConcerns()
        XCTAssertTrue(concerns.canSave)
        XCTAssertEqual(concerns.answers.concerns, [])
        XCTAssertNil(concerns.answers.concerns_other_text)
    }
    func testProfileSummariesReadActualWireIDsAndDoNotCallFreeTextNoConcern() throws {
        let profile = HairProfile(profileRevision: "2", answers: [
            .init(id: "hair_texture", label: "Haarstruktur", values: ["Wellig"]),
            .init(id: "cuticle_condition", label: "Haaroberfläche", values: ["Rau"]),
            .init(id: "protein_moisture_balance", label: "Dehntest", values: ["Reißt schnell"]),
            .init(id: "scalp_type", label: "Kopfhaut", values: ["Ausgeglichen"]),
            .init(id: "scalp_condition", label: "Beschwerden", values: ["Gereizte Kopfhaut"]),
            .init(id: "concerns", label: "Anliegen", values: ["Keine"]),
            .init(id: "concerns_other_text", label: "Weitere Anliegen", values: ["Meine Spitzen"])
        ])
        XCTAssertEqual(ProfileProperty.find("structure")?.value(in: profile), "Wellig")
        XCTAssertEqual(ProfileProperty.find("fingertest")?.value(in: profile), "Rau")
        XCTAssertEqual(ProfileProperty.find("pulltest")?.value(in: profile), "Reißt schnell")
        XCTAssertEqual(ProfileProperty.find("scalp_type")?.value(in: profile), "Ausgeglichen · Beschwerden: Gereizte Kopfhaut")
        XCTAssertEqual(ProfileProperty.find("concerns")?.value(in: profile), "Meine Spitzen")
        let empty = HairProfile(profileRevision: "2", answers: [.init(id: "concerns", label: "Anliegen", values: [])])
        XCTAssertEqual(ProfileProperty.find("concerns")?.value(in: empty), "Keine")
    }
    func testUndoingMultiSelectionsIsUnchangedWithoutReorderingSubmittedAnswers() throws {
        let source = try snapshot()
        var answers = source.answers
        answers.goals = ["shine", "moisture"]
        var draft = ProfileEditDraft(snapshot: .init(profileRevision: source.profileRevision, answers: answers, questions: source.questions), propertyID: "goals")
        draft.select("shine")
        XCTAssertTrue(draft.hasChanges)
        draft.select("shine")
        XCTAssertEqual(draft.answers.goals, ["moisture", "shine"])
        XCTAssertFalse(draft.hasChanges)
        XCTAssertFalse(draft.canSave)
        draft.select("strength_ends")
        XCTAssertTrue(draft.canSave)
        XCTAssertEqual(draft.saveRequest().answers.goals, ["moisture", "shine", "strength_ends"])
    }
    private func snapshot(length: String? = "long", legacyVolumeGoal: Bool = false) throws -> ProfileEditSnapshot {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "profile-edit-v1", withExtension: "json"))
        let source = try JSONDecoder().decode(ProfileEditSnapshot.self, from: Data(contentsOf: url))
        var answers = source.answers
        answers.hair_length = length
        answers.has_scalp_issue = true
        answers.scalp_condition = "gereizt"
        var questions = source.questions
        if legacyVolumeGoal {
            answers.goals = ["volume"]
            // Server withSavedOptions retains selected legacy goals in every texture's metadata.
            let index = try XCTUnwrap(questions.firstIndex { $0.id == "goals" })
            let goal = questions[index]
            let volume = EditQuestion.Option(value: "volume", label: "Mehr Volumen", description: nil)
            questions[index] = EditQuestion(id: goal.id, title: goal.title, instruction: goal.instruction,
                selectionMode: goal.selectionMode, options: goal.options + [volume],
                maxSelections: goal.maxSelections, conditionOptions: goal.conditionOptions,
                optionsByTexture: goal.optionsByTexture?.mapValues { $0 + [volume] })
        }
        return ProfileEditSnapshot(profileRevision: source.profileRevision, answers: answers, questions: questions)
    }
}
