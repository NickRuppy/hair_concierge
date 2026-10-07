import Foundation

struct QuizAnswers: Codable, Equatable, Sendable {
    var structure: String
    var thickness: String
    var density: String
    var hair_length: String?
    var fingertest: String
    var pulltest: String
    var scalp_type: String
    var has_scalp_issue: Bool
    var scalp_condition: String?
    var treatment: [String]
    var concerns: [String]
    var goals: [String]
    var concerns_other_text: String?

    func values(for id: String) -> [String] {
        switch id {
        case "structure": [structure]
        case "thickness": [thickness]
        case "density": [density]
        case "hair_length": hair_length.map { [$0] } ?? []
        case "fingertest": [fingertest]
        case "pulltest": [pulltest]
        case "scalp_type": [scalp_type]
        case "treatment": treatment
        case "concerns": concerns
        case "goals": goals
        default: []
        }
    }
    mutating func set(_ values: [String], for id: String) {
        let first = values.first ?? ""
        switch id {
        case "structure": structure = first
        case "thickness": thickness = first
        case "density": density = first
        case "hair_length": hair_length = values.first
        case "fingertest": fingertest = first
        case "pulltest": pulltest = first
        case "scalp_type": scalp_type = first
        case "treatment": treatment = values
        case "concerns": concerns = values
        case "goals": goals = values
        default: break
        }
    }
}
struct EditQuestion: Codable, Identifiable, Sendable {
    enum SelectionMode: String, Codable, Sendable { case single, multi }
    struct Option: Codable, Identifiable, Sendable {
        let value: String
        let label: String
        let description: String?
        var id: String { value }
    }
    let id: String
    let title: String
    let instruction: String
    let selectionMode: SelectionMode
    let options: [Option]
    let maxSelections: Int?
    let conditionOptions: [Option]?
    var optionsByTexture: [String: [Option]]? = nil
    func options(for texture: String) -> [Option] { optionsByTexture?[texture] ?? options }
}
struct ProfileEditSnapshot: Codable, Sendable {
    static let questionIDs = ["structure", "thickness", "density", "hair_length", "fingertest", "pulltest", "treatment", "scalp_type", "concerns", "goals"]
    let profileRevision: String
    let answers: QuizAnswers
    let questions: [EditQuestion]
    func validate() throws {
        guard !profileRevision.isEmpty, questions.map(\.id) == Self.questionIDs,
              questions.allSatisfy({ !$0.options.isEmpty }) else { throw MobileError.invalidResponse }
    }
}
struct ProfileEditRequest: Codable, Sendable {
    let expectedProfileRevision: String
    let requestId: String
    let answers: QuizAnswers
}
struct ProfileEditResponse: Codable, Sendable {
    let profileRevision: String
    let contextRevision: String
    let answers: [HairProfile.Answer]
}

/// Account-bound, in-memory draft. No profile changes until the server acknowledges publication.
struct ProfileEditDraft {
    enum ScalpStep { case type, gate, condition }
    let snapshot: ProfileEditSnapshot
    let propertyID: String?
    var answers: QuizAnswers
    var step = -1 // Introduction, ten question groups, then review.
    var scalpStep: ScalpStep = .type
    private var attemptedAnswers: QuizAnswers?
    private var requestId = UUID().uuidString
    init(snapshot: ProfileEditSnapshot, propertyID: String? = nil) {
        self.snapshot = snapshot
        self.propertyID = propertyID
        answers = snapshot.answers
        if let propertyID { step = snapshot.questions.firstIndex { $0.id == propertyID } ?? -1 }
    }
    var isSingleProperty: Bool { propertyID != nil }
    var hasChanges: Bool {
        // Multi-select order is presentation history, not a changed answer. Compare
        // sorted copies without rewriting the authoritative payload or retry identity.
        var current = answers, saved = snapshot.answers
        current.goals.sort(); saved.goals.sort()
        current.concerns.sort(); saved.concerns.sort()
        current.treatment.sort(); saved.treatment.sort()
        return current != saved
    }
    var canSave: Bool { isComplete && (isSingleProperty ? hasChanges : isReview) }
    /// Keep this explicit legacy follow-up visible after selecting a value.
    var missingLengthQuestion: EditQuestion? {
        guard isSingleProperty, propertyID != "hair_length", snapshot.answers.hair_length == nil else { return nil }
        return snapshot.questions.first { $0.id == "hair_length" }
    }
    mutating func selectMissingLength(_ value: String) {
        guard let question = missingLengthQuestion, question.options.contains(where: { $0.value == value }) else { return }
        answers.hair_length = value
    }
    var question: EditQuestion? { snapshot.questions.indices.contains(step) ? snapshot.questions[step] : nil }
    var isReview: Bool { step == snapshot.questions.count }
    var canAdvance: Bool {
        guard let question else { return true }
        if question.id == "scalp_type", scalpStep == .condition { return !(answers.scalp_condition ?? "").isEmpty }
        if question.id == "concerns" { return true }
        return !answers.values(for: question.id).isEmpty && answers.values(for: question.id).allSatisfy { !$0.isEmpty }
    }
    var isComplete: Bool {
        ProfileEditSnapshot.questionIDs.filter { $0 != "concerns" }.allSatisfy {
            !answers.values(for: $0).isEmpty && answers.values(for: $0).allSatisfy { !$0.isEmpty }
        } && (!answers.has_scalp_issue || !(answers.scalp_condition ?? "").isEmpty)
            && (answers.concerns_other_text?.count ?? 0) <= 50
    }
    mutating func advance() {
        guard !isSingleProperty, canAdvance, !isReview else { return }
        if question?.id == "scalp_type" {
            if scalpStep == .type { scalpStep = .gate; return }
            if scalpStep == .gate, answers.has_scalp_issue { scalpStep = .condition; return }
        }
        step += 1
    }
    mutating func back() {
        guard !isSingleProperty else { return }
        if question?.id == "scalp_type" {
            if scalpStep == .condition { scalpStep = .gate; return }
            if scalpStep == .gate { scalpStep = .type; return }
        }
        step = max(-1, step - 1)
        if question?.id == "scalp_type" { scalpStep = answers.has_scalp_issue ? .condition : .gate }
    }
    mutating func select(_ value: String) {
        guard let question, QuizAnswerSelection.apply(value, question: question, answers: &answers) else { return }
        if question.selectionMode == .single { advance() }
    }
    mutating func setScalpIssue(_ value: Bool) {
        answers.has_scalp_issue = value
        if !value { answers.scalp_condition = nil }
        advance()
    }
    mutating func selectCondition(_ value: String) {
        guard question?.conditionOptions?.contains(where: { $0.value == value }) == true else { return }
        answers.scalp_condition = value
        advance()
    }
    mutating func clearConcerns() { answers.concerns = []; answers.concerns_other_text = nil }
    mutating func setOtherText(_ value: String) { answers.concerns_other_text = String(value.prefix(50)) }
    mutating func saveRequest() -> ProfileEditRequest {
        if let attemptedAnswers, attemptedAnswers != answers { requestId = UUID().uuidString }
        attemptedAnswers = answers
        return .init(expectedProfileRevision: snapshot.profileRevision, requestId: requestId, answers: answers)
    }
}

/// Shared selection semantics for existing-profile edits and the anonymous local quiz.
enum QuizAnswerSelection {
    static func apply(_ value: String, question: EditQuestion, answers: inout QuizAnswers) -> Bool {
        var values = answers.values(for: question.id)
        let removing = question.selectionMode == .multi && values.contains(value)
        guard removing || question.options(for: answers.structure).contains(where: { $0.value == value }) else { return false }
        if question.selectionMode == .single { answers.set([value], for: question.id); return true }
        if removing { values.removeAll { $0 == value } }
        else {
            if question.id == "treatment" {
                if value == "natur" { values = [] } else { values.removeAll { $0 == "natur" } }
            }
            if question.id == "goals" {
                if value == "volume" { values.removeAll { $0 == "less_volume" } }
                if value == "less_volume" { values.removeAll { $0 == "volume" } }
            }
            if let limit = question.maxSelections, values.count >= limit { return false }
            values.append(value)
        }
        answers.set(values, for: question.id)
        return true
    }
}
