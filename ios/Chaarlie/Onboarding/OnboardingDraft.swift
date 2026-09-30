import Foundation

struct OnboardingQuestions: Codable, Sendable {
    static let supportedVersion = 1
    static let questionIDs = ["structure", "thickness", "density", "hair_length", "fingertest", "pulltest", "treatment", "scalp_type", "concerns", "goals"]

    let version: Int
    let questions: [EditQuestion]

    static func bundled() throws -> Self {
        guard let url = Bundle.main.url(forResource: "onboarding-questions-v1", withExtension: "json") else {
            throw MobileError.invalidResponse
        }
        let value = try JSONDecoder().decode(Self.self, from: Data(contentsOf: url))
        try value.validate()
        return value
    }

    func validate() throws {
        guard version == Self.supportedVersion,
              questions.map(\.id) == Self.questionIDs,
              Set(questions.map(\.id)).count == questions.count else {
            throw MobileError.invalidResponse
        }
        for question in questions {
            guard !question.title.isEmpty, !question.instruction.isEmpty,
                  !question.options.isEmpty,
                  Set(question.options.map(\.value)).count == question.options.count,
                  question.options.allSatisfy({ !$0.value.isEmpty }),
                  question.maxSelections.map({ $0 > 0 }) ?? true else {
                throw MobileError.invalidResponse
            }
            for options in question.optionsByTexture?.values ?? Dictionary<String, [EditQuestion.Option]>().values {
                guard !options.isEmpty,
                      Set(options.map(\.value)).count == options.count,
                      options.allSatisfy({ !$0.value.isEmpty }) else { throw MobileError.invalidResponse }
            }
        }
        guard let scalp = questions.first(where: { $0.id == "scalp_type" }),
              let conditions = scalp.conditionOptions, !conditions.isEmpty,
              Set(conditions.map(\.value)).count == conditions.count,
              conditions.allSatisfy({ !$0.value.isEmpty }) else { throw MobileError.invalidResponse }
    }

    func question(_ id: String) -> EditQuestion? { questions.first { $0.id == id } }
}

struct OnboardingDraft: Codable, Equatable, Sendable {
    enum ScalpStep: String, Codable, Sendable { case type, gate, condition }

    let version: Int
    var answers: QuizAnswers
    var step: Int
    var scalpStep: ScalpStep
    var hasAnsweredScalpGate: Bool

    init(version: Int = OnboardingQuestions.supportedVersion, answers: QuizAnswers = .blank,
         step: Int = 0, scalpStep: ScalpStep = .type, hasAnsweredScalpGate: Bool = false) {
        self.version = version
        self.answers = answers
        self.step = step
        self.scalpStep = scalpStep
        self.hasAnsweredScalpGate = hasAnsweredScalpGate
    }

    func question(in questions: OnboardingQuestions) -> EditQuestion? {
        questions.questions.indices.contains(step) ? questions.questions[step] : nil
    }

    func options(in question: EditQuestion) -> [EditQuestion.Option] {
        let available = question.options(for: answers.structure)
        let known = allOptions(in: question)
        let retained = answers.values(for: question.id).compactMap { value in known.first { $0.value == value } }
        return unique(available + retained)
    }

    func options(in questions: OnboardingQuestions) -> [EditQuestion.Option] {
        guard let question = question(in: questions) else { return [] }
        return options(in: question)
    }

    func canAdvance(in questions: OnboardingQuestions) -> Bool {
        guard let question = question(in: questions) else { return step == questions.questions.count }
        if question.id == "scalp_type" {
            switch scalpStep {
            case .type: return isCurrentSelectionValid(for: question)
            case .gate: return hasAnsweredScalpGate
            case .condition:
                return answers.scalp_condition.flatMap { value in
                    question.conditionOptions?.contains { $0.value == value } == true ? value : nil
                } != nil
            }
        }
        if question.id == "concerns" { return isCurrentSelectionValid(for: question, permitsEmpty: true) }
        return isCurrentSelectionValid(for: question)
    }

    func isComplete(in questions: OnboardingQuestions) -> Bool {
        guard step == questions.questions.count, hasAnsweredScalpGate else { return false }
        for question in questions.questions where question.id != "scalp_type" {
            if !isCurrentSelectionValid(for: question, permitsEmpty: question.id == "concerns") { return false }
        }
        guard let scalp = questions.question("scalp_type"), isCurrentSelectionValid(for: scalp) else { return false }
        if answers.has_scalp_issue {
            guard let condition = answers.scalp_condition,
                  scalp.conditionOptions?.contains(where: { $0.value == condition }) == true else { return false }
        } else if answers.scalp_condition != nil { return false }
        return (answers.concerns_other_text?.count ?? 0) <= 50
    }

    func validate(in questions: OnboardingQuestions) throws {
        try questions.validate()
        guard version == questions.version, (0...questions.questions.count).contains(step),
              (answers.concerns_other_text?.count ?? 0) <= 50 else { throw MobileError.invalidResponse }
        for question in questions.questions where question.id != "scalp_type" {
            guard isKnownSelection(for: question) else { throw MobileError.invalidResponse }
        }
        guard let scalp = questions.question("scalp_type"), isKnownSelection(for: scalp) else {
            throw MobileError.invalidResponse
        }
        if !hasAnsweredScalpGate {
            guard !answers.has_scalp_issue, answers.scalp_condition == nil else { throw MobileError.invalidResponse }
        } else if !answers.has_scalp_issue, answers.scalp_condition != nil {
            throw MobileError.invalidResponse
        } else if let condition = answers.scalp_condition,
                  scalp.conditionOptions?.contains(where: { $0.value == condition }) != true {
            throw MobileError.invalidResponse
        }
    }

    mutating func select(_ value: String, in questions: OnboardingQuestions) {
        guard let question = question(in: questions) else { return }
        if question.id == "scalp_type" {
            guard scalpStep == .type,
                  QuizAnswerSelection.apply(value, question: question, answers: &answers) else { return }
            advance(in: questions)
            return
        }
        guard QuizAnswerSelection.apply(value, question: question, answers: &answers) else { return }
        if question.selectionMode == .single { advance(in: questions) }
    }

    mutating func advance(in questions: OnboardingQuestions) {
        guard canAdvance(in: questions), let question = question(in: questions) else { return }
        if question.id == "scalp_type" {
            switch scalpStep {
            case .type: scalpStep = .gate
            case .gate where answers.has_scalp_issue: scalpStep = .condition
            case .gate, .condition: step += 1
            }
            return
        }
        step += 1
    }

    mutating func back(in questions: OnboardingQuestions) {
        guard step > 0 else { return }
        if question(in: questions)?.id == "scalp_type" {
            switch scalpStep {
            case .condition: scalpStep = .gate; return
            case .gate: scalpStep = .type; return
            case .type: break
            }
        }
        step -= 1
        if question(in: questions)?.id == "scalp_type" {
            scalpStep = hasAnsweredScalpGate ? .gate : .type
        }
    }

    mutating func setScalpIssue(_ value: Bool, in questions: OnboardingQuestions) {
        guard question(in: questions)?.id == "scalp_type", scalpStep == .gate else { return }
        hasAnsweredScalpGate = true
        answers.has_scalp_issue = value
        if !value { answers.scalp_condition = nil }
        advance(in: questions)
    }

    mutating func selectCondition(_ value: String, in questions: OnboardingQuestions) {
        guard let question = question(in: questions), question.id == "scalp_type", scalpStep == .condition,
              question.conditionOptions?.contains(where: { $0.value == value }) == true else { return }
        answers.scalp_condition = value
        advance(in: questions)
    }

    mutating func clearConcerns() { answers.concerns = []; answers.concerns_other_text = nil }
    mutating func setOtherText(_ value: String) { answers.concerns_other_text = String(value.prefix(50)) }

    private func isCurrentSelectionValid(for question: EditQuestion, permitsEmpty: Bool = false) -> Bool {
        let values = answers.values(for: question.id)
        if values.isEmpty { return permitsEmpty }
        let allowed = Set(question.options(for: answers.structure).map(\.value))
        return values.allSatisfy(allowed.contains)
    }

    private func isKnownSelection(for question: EditQuestion) -> Bool {
        let values = answers.values(for: question.id)
        if values.isEmpty { return true }
        if values.count == 1, values[0].isEmpty {
            return question.selectionMode == .single && step < OnboardingQuestions.questionIDs.count
        }
        let allowed = Set(allOptions(in: question).map(\.value))
        return values.allSatisfy(allowed.contains)
    }

    private func allOptions(in question: EditQuestion) -> [EditQuestion.Option] {
        unique(question.options + (question.optionsByTexture?.values.flatMap { $0 } ?? []))
    }

    private func unique(_ options: [EditQuestion.Option]) -> [EditQuestion.Option] {
        var values = Set<String>()
        return options.filter { values.insert($0.value).inserted }
    }
}

extension QuizAnswers {
    static let blank = QuizAnswers(structure: "", thickness: "", density: "", hair_length: nil,
        fingertest: "", pulltest: "", scalp_type: "", has_scalp_issue: false,
        scalp_condition: nil, treatment: [], concerns: [], goals: [], concerns_other_text: nil)
}
