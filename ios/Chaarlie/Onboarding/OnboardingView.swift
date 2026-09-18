import SwiftUI

struct OnboardingView: View {
    @Bindable var model: OnboardingModel
    let onExistingLogin: () -> Void
    @FocusState private var focusedField: Field?
    @State private var helpExpanded = false
    private enum Field { case firstName, email, code, other }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: model.stage == .welcome ? 18 : usesNativeTypography ? 20 : 22) {
                    header.id("top")
                    stageContent
                    if model.busy { ProgressView("Einen Moment …").accessibilityIdentifier("onboarding.busy") }
                    if let error = model.error {
                        Text(error).foregroundStyle(ChaarlieTheme.coral)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                            .background(.white, in: RoundedRectangle(cornerRadius: 12))
                            .accessibilityIdentifier("onboarding.error").id("error")
                    }
                    if model.isSyntheticFixture {
                        Text("Lokale Vorschau · Keine E-Mail, kein echtes Konto")
                            .chaarlieSystemFont(usesNativeTypography ? 13 : 12,
                                                 relativeTo: usesNativeTypography ? .footnote : .body)
                            .foregroundStyle(ChaarlieTheme.muted)
                            .accessibilityIdentifier("onboarding.fixture")
                    }
                }.padding(24)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if model.stage == .quiz, model.question?.selectionMode == .multi { quizFooter }
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: screenIdentity) { _, _ in
                focusedField = nil
                helpExpanded = false
                proxy.scrollTo("top", anchor: .top)
            }
            .onChange(of: model.error) { _, error in
                if error != nil { focusedField = nil; proxy.scrollTo("error", anchor: .bottom) }
            }
        }
        .chaarlieSystemFont(usesNativeTypography ? 17 : 15)
        .foregroundStyle(ChaarlieTheme.ink)
        .tint(ChaarlieTheme.plum).background(ChaarlieTheme.background)
        .chaarlieStatusBarBackground(enabled: usesNativeTypography)
        .task { model.load() }
    }

    private var usesNativeTypography: Bool {
        [.welcome, .quiz, .registration, .verification].contains(model.stage)
    }

    private var screenIdentity: String {
        "\(model.stage)-\(model.draft.step)-\(model.draft.scalpStep)"
    }

    @ViewBuilder private var header: some View {
        if model.stage == .quiz {
            quizHeader
        } else if model.stage == .welcome {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 16) {
                    welcomeBrand
                    Spacer(minLength: 8)
                    welcomeLogin
                }
                VStack(alignment: .leading, spacing: 8) {
                    welcomeBrand
                    HStack { Spacer(minLength: 0); welcomeLogin }
                }
            }
        } else if model.stage == .registration || model.stage == .verification {
            accountHeader
        } else {
            VStack(alignment: .leading, spacing: 12) {
                Text("chaarlie").font(ChaarlieTheme.wordmark(30)).accessibilityIdentifier("onboarding.brand")
                if model.stage != .finished {
                    Button("Schon dabei? Anmelden", action: existingLogin)
                        .buttonStyle(ChaarlieTextButton()).accessibilityIdentifier("onboarding.login")
                }
            }
        }
    }

    private var welcomeBrand: some View {
        Text("chaarlie").font(.custom("PlayfairDisplay-Regular", fixedSize: 30))
            .fixedSize().accessibilityIdentifier("onboarding.brand")
    }

    private var welcomeLogin: some View {
        Button("Anmelden", action: existingLogin)
            .font(.body).buttonStyle(.plain).foregroundStyle(ChaarlieTheme.plum)
            .fixedSize(horizontal: true, vertical: true)
            .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
            .accessibilityLabel("Schon dabei? Anmelden").accessibilityIdentifier("onboarding.login")
    }

    private var accountHeader: some View {
        HStack(spacing: 12) {
            if model.stage == .registration {
                Button { model.back() } label: {
                    ViewThatFits(in: .horizontal) {
                        Label("Zurück", systemImage: "chevron.left").fixedSize()
                        Image(systemName: "chevron.left").fixedSize()
                    }
                    .font(.body).frame(minWidth: 44, minHeight: 44, alignment: .leading)
                    .contentShape(Rectangle())
                }.buttonStyle(.plain).disabled(model.busy)
                    .accessibilityLabel("Zurück").accessibilityIdentifier("onboarding.back")
            }
            Spacer(minLength: 8)
            welcomeLogin
        }.accessibilityElement(children: .contain).accessibilityIdentifier("onboarding.account-header")
    }

    private var quizHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Button { model.back() } label: {
                    ViewThatFits(in: .horizontal) {
                        Label("Zurück", systemImage: "chevron.left").fixedSize()
                        Image(systemName: "chevron.left").fixedSize()
                    }
                    .font(.body).frame(minWidth: 44, minHeight: 44, alignment: .leading)
                    .contentShape(Rectangle())
                }.buttonStyle(.plain).disabled(model.busy)
                    .accessibilityLabel("Zurück").accessibilityIdentifier("onboarding.back")
                Spacer(minLength: 8)
                quizProgressCount.fixedSize(horizontal: true, vertical: false)
            }
            quizProgressBar
        }
        .accessibilityElement(children: .contain).accessibilityIdentifier("onboarding.quiz-header")
    }

    private var quizProgressCount: some View {
        Text("\(model.draft.step + 1) / 10").font(.subheadline)
            .foregroundStyle(ChaarlieTheme.muted).accessibilityIdentifier("onboarding.progress")
    }

    private var quizProgressBar: some View {
        ProgressView(value: Double(model.draft.step + 1), total: 10).accessibilityHidden(true)
    }

    private func existingLogin() {
        focusedField = nil
        model.suspend()
        onExistingLogin()
    }

    private var welcomeContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Gutes Produkt.\nAber für dich?").chaarlieHeading(38)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("Gutes Produkt. Aber für dich?")
                    .accessibilityAddTraits(.isHeader).accessibilityIdentifier("onboarding.title")
                Text("Lass uns deine Haare kennenlernen. Wir zeigen dir, welche Pflege zu ihnen passt – und warum.")
                    .font(.body).foregroundStyle(ChaarlieTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            welcomeExample
            VStack(spacing: 8) {
                Button("Haar-Check starten") { model.startQuiz() }
                    .buttonStyle(OnboardingNativeButton()).disabled(model.busy)
                    .accessibilityIdentifier("onboarding.start")
                Text("10 Fragen · Kostenlos").font(.footnote).foregroundStyle(ChaarlieTheme.muted)
            }.frame(maxWidth: .infinity)
        }
    }

    private var welcomeExample: some View {
        VStack(alignment: .leading, spacing: 12) {
            OnboardingExampleBottle().frame(maxWidth: .infinity).frame(height: 112)
                .accessibilityHidden(true)
            Text("DEIN PRODUKTCHECK · BEISPIEL").font(.caption)
                .foregroundStyle(ChaarlieTheme.muted).fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 12) {
                Label("Passende Pflege für dein Haar", systemImage: "checkmark")
                    .foregroundStyle(Color(hex: 0x32674a))
                Label("Könnte dein Haar beschweren", systemImage: "exclamationmark")
                    .foregroundStyle(Color(hex: 0x896323))
            }.font(.body).fixedSize(horizontal: false, vertical: true)
                .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                .background(.white, in: RoundedRectangle(cornerRadius: 15))
        }.padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(ChaarlieTheme.plumIce, in: RoundedRectangle(cornerRadius: 24))
            .accessibilityElement(children: .contain).accessibilityIdentifier("onboarding.example")
    }

    private var quizFooter: some View {
        VStack(spacing: 8) {
            let count = model.question.map { model.draft.answers.values(for: $0.id).count } ?? 0
            Text(count == 0 ? "Mehrfachauswahl möglich" : "\(count) ausgewählt")
                .font(.footnote).foregroundStyle(ChaarlieTheme.muted)
            Button("Weiter") { focusedField = nil; model.advance() }
                .buttonStyle(OnboardingNativeButton()).disabled(model.busy || !model.canAdvance)
                .accessibilityIdentifier("onboarding.next")
        }.padding(.horizontal, 24).padding(.vertical, 12)
            .frame(maxWidth: .infinity).background(ChaarlieTheme.background)
            .overlay(alignment: .top) { Divider() }
            .accessibilityElement(children: .contain).accessibilityIdentifier("onboarding.quiz-footer")
    }

    @ViewBuilder private var stageContent: some View {
        switch model.stage {
        case .welcome: welcomeContent
        case .resume:
            title("Dein Haar-Check wartet auf dich.")
            Text("Du hast schon begonnen. Mach dort weiter, wo du aufgehört hast.")
                .foregroundStyle(ChaarlieTheme.muted)
            Button("Haar-Check fortsetzen") { model.resume() }
                .buttonStyle(ChaarlieButton()).accessibilityIdentifier("onboarding.resume")
            restartButton
            Text("Beim Neustart werden die bisherigen Antworten auf diesem iPhone verworfen.")
                .chaarlieSystemFont(13).foregroundStyle(ChaarlieTheme.muted)
        case .quiz:
            if let question = model.question { questionContent(question) }
        case .registration: accountContent
        case .verification: verificationContent
        case .profileChoice:
            title("Du hast bereits Haarangaben.")
            Text("Für dieses Konto sind schon Haarangaben gespeichert. Welche möchtest du für deine Produkteinschätzungen verwenden?")
                .foregroundStyle(ChaarlieTheme.muted)
            Button("Vorhandene Haarangaben behalten") {
                Task { await model.chooseExistingProfile(replace: false) }
            }.buttonStyle(ChaarlieButton()).disabled(model.busy)
                .accessibilityIdentifier("onboarding.profile.keep")
            Button("Durch neue Haarangaben ersetzen") {
                Task { await model.chooseExistingProfile(replace: true) }
            }.buttonStyle(ChaarlieButton(outline: true)).disabled(model.busy)
                .accessibilityIdentifier("onboarding.profile.replace")
        case .completion:
            title(model.error == nil ? "Deine Angaben werden verknüpft." : "Deine Angaben sind noch nicht verknüpft.")
            Text("Dein Haar-Check bleibt erhalten. Sobald deine Angaben bestätigt sind, geht es direkt zum Scanner.")
                .foregroundStyle(ChaarlieTheme.muted)
            if !model.busy {
                Button("Erneut versuchen") { Task { await model.retryCompletion() } }
                    .buttonStyle(ChaarlieButton()).accessibilityIdentifier("onboarding.retry-completion")
            }
        case .finished:
            title("Dein Scanner ist bereit.")
            ProgressView("Scanner wird geöffnet …")
        case .storageError:
            title("Dein Haar-Check konnte nicht geladen werden.")
            Text("Versuche es erneut. Wenn du neu startest, werden deine bisherigen Antworten auf diesem iPhone verworfen.")
                .foregroundStyle(ChaarlieTheme.muted)
            Button("Erneut versuchen") { model.load() }
                .buttonStyle(ChaarlieButton()).accessibilityIdentifier("onboarding.retry-storage")
            restartButton
        }
    }

    private var restartButton: some View {
        Button("Neu starten") { model.restart() }.buttonStyle(ChaarlieButton(outline: true))
            .disabled(model.busy).accessibilityIdentifier("onboarding.restart")
    }

    @ViewBuilder private func questionContent(_ question: EditQuestion) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            if question.id == "scalp_type", model.draft.scalpStep == .gate {
                nativeIntroduction(title: "Hast du zusätzlich Kopfhaut-Beschwerden?",
                                 instruction: "Zum Beispiel Schuppen, Juckreiz oder Rötungen.")
                VStack(spacing: 10) {
                    option("no", label: "Nein", selected: model.draft.hasAnsweredScalpGate && !model.draft.answers.has_scalp_issue) {
                        model.setScalpIssue(false)
                    }
                    option("yes", label: "Ja", selected: model.draft.hasAnsweredScalpGate && model.draft.answers.has_scalp_issue) {
                        model.setScalpIssue(true)
                    }
                }
            } else if question.id == "scalp_type", model.draft.scalpStep == .condition {
                nativeIntroduction(title: "Was ist aktuell dein Hauptproblem?", instruction: "")
                VStack(spacing: 10) {
                    ForEach(question.conditionOptions ?? []) { item in
                        option(item.value, label: item.label, description: item.description,
                               selected: model.draft.answers.scalp_condition == item.value) { model.selectCondition(item.value) }
                    }
                }
            } else {
                let copy = OnboardingQuizCopy(question: question)
                nativeIntroduction(title: copy.title, instruction: copy.instruction,
                                 helpLabel: copy.helpLabel, help: copy.help)
                VStack(spacing: 10) {
                    ForEach(model.options) { item in
                        option(item.value, label: copy.label(for: item),
                               description: copy.description(for: item),
                               selected: model.draft.answers.values(for: question.id).contains(item.value),
                               multiple: question.selectionMode == .multi) { model.select(item.value) }
                    }
                }
                if question.selectionMode == .multi,
                   model.draft.answers.values(for: question.id).contains(where: { selected in
                       !question.options(for: model.draft.answers.structure).contains(where: { $0.value == selected })
                   }) {
                    Text("Eine frühere Auswahl ist für die aktuelle Haarstruktur nicht verfügbar. Wähle sie ab oder ändere deine Haarstruktur.")
                        .font(.callout).foregroundStyle(ChaarlieTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("onboarding.retained-choice-note")
                }
                if question.id == "concerns" { concernControls }
            }
        }.font(.body)
    }

    private func nativeIntroduction(title: String, instruction: String, accessibleInstruction: String? = nil,
                                  helpLabel: String? = nil, help: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            let heading = Text(title.replacingOccurrences(of: "Haarstruktur", with: "Haar\u{00ad}struktur")
                .replacingOccurrences(of: "Hauptproblem", with: "Haupt\u{00ad}problem")
                .replacingOccurrences(of: "überwiegend", with: "über\u{00ad}wiegend"))
            heading.chaarlieHeading().fixedSize(horizontal: false, vertical: true).accessibilityLabel(title)
                .accessibilityAddTraits(.isHeader).accessibilityIdentifier("onboarding.title")
            if !instruction.isEmpty {
                Text(instruction).font(.body).foregroundStyle(ChaarlieTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel(accessibleInstruction ?? instruction).accessibilityIdentifier("onboarding.instruction")
            }
            if let helpLabel, let help {
                DisclosureGroup(isExpanded: $helpExpanded) {
                    Text(help).font(.body).foregroundStyle(ChaarlieTheme.muted)
                        .fixedSize(horizontal: false, vertical: true).padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(ChaarlieTheme.plumIce, in: RoundedRectangle(cornerRadius: 14))
                        .accessibilityIdentifier("onboarding.help-content")
                } label: {
                    Text(helpLabel).font(.body).frame(minHeight: 44, alignment: .leading)
                        .accessibilityIdentifier("onboarding.help")
                }.disabled(model.busy)
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private var concernControls: some View {
        VStack(alignment: .leading, spacing: 16) {
            option("no-concerns", label: "Keine aktuellen Haarprobleme",
                   selected: model.draft.answers.concerns.isEmpty && (model.draft.answers.concerns_other_text ?? "").isEmpty) {
                model.clearConcerns()
            }
            Text("Etwas anderes? (optional)").font(.body.weight(.semibold))
            TextField("Beschreibe es in wenigen Worten", text: Binding(
                get: { model.draft.answers.concerns_other_text ?? "" }, set: { model.setOtherText($0) }
            ), axis: .vertical).font(.body).textFieldStyle(ChaarlieField()).lineLimit(1...3)
                .focused($focusedField, equals: .other).disabled(model.busy)
                .accessibilityIdentifier("onboarding.other")
            Text("\(model.draft.answers.concerns_other_text?.count ?? 0) / 50 Zeichen")
                .font(.footnote).foregroundStyle(ChaarlieTheme.muted)
        }
    }

    private var accountContent: some View {
        VStack(alignment: .leading, spacing: 20) {
            nativeIntroduction(title: "Dein Haar-Check ist fertig.",
                               instruction: "Verknüpfe deine Haarangaben mit deinem Konto.")
            VStack(alignment: .leading, spacing: 8) {
                Text("Vorname").font(.body.weight(.semibold))
                TextField("Dein Vorname", text: $model.firstName)
                    .textContentType(.givenName).textInputAutocapitalization(.words)
                    .textFieldStyle(OnboardingNativeField()).focused($focusedField, equals: .firstName)
                    .submitLabel(.next).onSubmit { focusedField = .email }
                    .accessibilityLabel("Vorname").accessibilityIdentifier("onboarding.first-name")
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("E-Mail-Adresse").font(.body.weight(.semibold))
                TextField("name@beispiel.de", text: $model.email)
                    .keyboardType(.emailAddress).textContentType(.emailAddress)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .textFieldStyle(OnboardingNativeField()).focused($focusedField, equals: .email)
                    .submitLabel(.done).onSubmit { focusedField = nil }
                    .accessibilityLabel("E-Mail-Adresse").accessibilityIdentifier("onboarding.email")
            }
            Button { model.marketingOptIn.toggle() } label: {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: model.marketingOptIn ? "checkmark.square.fill" : "square")
                        .font(.title3).foregroundStyle(ChaarlieTheme.plum).accessibilityHidden(true)
                    // Preserve the short word as a unit; SwiftUI otherwise hyphenates it at this width.
                    Text("Ich möchte Produkt-News und A\u{2060}n\u{2060}g\u{2060}e\u{2060}b\u{2060}o\u{2060}t\u{2060}e per E-Mail erhalten. Optional, jederzeit abbestellbar.")
                        .accessibilityLabel("Ich möchte Produkt-News und Angebote per E-Mail erhalten. Optional, jederzeit abbestellbar.")
                        .font(.body).multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading).contentShape(Rectangle())
            }.buttonStyle(.plain).accessibilityValue(model.marketingOptIn ? "Ausgewählt" : "Nicht ausgewählt")
                .accessibilityIdentifier("onboarding.marketing")
            Text("Wir senden dir einen Anmeldelink und einen Code.").foregroundStyle(ChaarlieTheme.muted)
            Text("Mit „Kostenloses Konto erstellen“ beantragst du dein kostenloses Konto und akzeptierst unsere [AGB](https://chaarlie.de/agb). Informationen zur Verarbeitung deiner Daten findest du in unserer [Datenschutzerklärung](https://chaarlie.de/datenschutz).")
                .font(.footnote).fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("onboarding.legal-notice")
            Button("Kostenloses Konto erstellen") {
                focusedField = nil
                Task { await model.submit() }
            }.buttonStyle(OnboardingNativeButton(color: ChaarlieTheme.coral)).disabled(!model.canSubmit)
                .accessibilityIdentifier("onboarding.submit")
        }.disabled(model.busy)
    }

    private var verificationContent: some View {
        // Permit narrow-screen wrapping without adding a hyphen to the email address.
        // The model and spoken instruction retain the exact original address.
        let displayedEmail = model.email.map(String.init).joined(separator: "\u{200b}")
        let instruction = "Öffne den Anmeldelink in der E-Mail an \(model.email) oder gib den Code hier ein."
        return VStack(alignment: .leading, spacing: 20) {
            nativeIntroduction(title: "Einmal kurz bestätigen.",
                               instruction: instruction.replacingOccurrences(of: model.email, with: displayedEmail),
                               accessibleInstruction: instruction)
            TextField("Code aus der E-Mail", text: $model.code)
                .keyboardType(.numberPad).textContentType(.oneTimeCode).textFieldStyle(OnboardingNativeField())
                .focused($focusedField, equals: .code).accessibilityIdentifier("onboarding.code")
                .onChange(of: model.code) { _, value in
                    model.code = String(value.filter { $0.isASCII && $0.isNumber }.prefix(model.attempt?.codeLength ?? 8))
                }
            Button("Bestätigen und scannen") { focusedField = nil; Task { await model.verifyCode() } }
                .buttonStyle(OnboardingNativeButton(color: ChaarlieTheme.coral)).disabled(!model.canVerify)
                .accessibilityIdentifier("onboarding.verify")
            Button("Neue E-Mail senden") { focusedField = nil; Task { await model.resend() } }
                .buttonStyle(ChaarlieTextButton()).accessibilityIdentifier("onboarding.resend")
            Button("Andere E-Mail verwenden") { model.editAccount() }
                .buttonStyle(ChaarlieTextButton()).accessibilityIdentifier("onboarding.edit-account")
            #if DEBUG
            if model.isSyntheticFixture {
                Button("Anmeldelink lokal simulieren") { Task { await model.simulateLink() } }
                    .buttonStyle(ChaarlieButton(outline: true)).accessibilityIdentifier("onboarding.simulate-link")
            }
            #endif
        }.disabled(model.busy)
    }

    private func title(_ text: String) -> some View {
        Text(text.components(separatedBy: " ").map(GermanLineBreaks.text).joined(separator: " "))
            .accessibilityLabel(text).chaarlieHeading(30)
            .fixedSize(horizontal: false, vertical: true).accessibilityAddTraits(.isHeader)
            .accessibilityIdentifier("onboarding.title")
    }

    private func option(_ value: String, label: String, description: String? = nil, selected: Bool,
                        multiple: Bool = false, action: @escaping () -> Void) -> some View {
        OnboardingNativeOption(label: label, description: description, selected: selected, multiple: multiple, action: action)
            .disabled(model.busy).accessibilityIdentifier("onboarding.option.\(value)")
    }
}

/// Presentation-only refinements. DTO values, ordering and texture variants remain authoritative.
private struct OnboardingQuizCopy {
    let questionID: String
    var title: String
    var instruction: String
    var helpLabel: String?
    var help: String?

    init(question: EditQuestion) {
        questionID = question.id
        title = question.title
        instruction = question.instruction
        switch question.id {
        case "structure":
            title = "Welche Haarstruktur hast du überwiegend?"
            instruction = "Beurteile die natürliche Form deiner Haare."
            helpLabel = "Bei chemisch veränderten Haaren"
            help = question.instruction
        case "thickness":
            title = "Wie dick ist ein einzelnes Haar?"
        case "hair_length":
            title = "Wie lang sind deine Haare?"
            instruction = "Locken sanft strecken. Im Zweifel die längere Option wählen."
            helpLabel = "So bestimmst du die Länge"
            help = ([question.instruction] + question.options.map { option in
                "\(option.label): \(option.description ?? "")"
            }).joined(separator: "\n\n")
        case "fingertest":
            instruction = "Fahre langsam mit zwei Fingern über ein sauberes, trockenes Haar."
        case "pulltest":
            instruction = "Ziehe dasselbe Haar vorsichtig auseinander. Wie reagiert es?"
            helpLabel = "So funktioniert der Test"
            help = question.instruction
        case "treatment":
            instruction = "Wähle alle Behandlungen, die noch in deinen Haarlängen sind."
            helpLabel = "Was zählt dazu?"
            help = """
            Unbehandelt: Keine Farbe, kein Blondieren.

            Gefärbt / getönt: Farbveränderung, aber kein Aufhellen.

            Blondiert / aufgehellt: Gebleacht, Strähnchen oder Balayage.

            Dauerwelle: Chemisch dauerhaft gewellte oder gelockte Längen.

            Chemisch geglättet: Relaxer, dauerhafte Glättung, Keratin-Glättung oder Brazilian Blowout.

            Normales Styling mit Föhn oder Glätteisen zählt hier nicht.
            """
        case "scalp_type":
            title = "Wie fühlt sich deine Kopfhaut an?"
            instruction = "Beurteile deine Kopfhaut und Ansätze im Alltag, nicht die Längen oder Spitzen."
        default: break
        }
    }

    func label(for option: EditQuestion.Option) -> String {
        if questionID == "treatment", option.value == "natur" { return "Unbehandelt" }
        if questionID == "pulltest" {
            switch option.value {
            case "stretches_bounces": return "Dehnt sich und federt zurück"
            case "stretches_stays": return "Dehnt sich und bleibt gedehnt"
            case "snaps": return "Reißt bei leichtem Zug"
            default: break
            }
        }
        return option.label
    }

    func description(for option: EditQuestion.Option) -> String? {
        if questionID == "hair_length" {
            if option.value == "very_short" { return "Etwa bis zu den Ohren." }
            if option.value == "short" { return "Unter den Ohren bis knapp über die Schultern." }
        }
        if questionID == "pulltest", ["stretches_bounces", "stretches_stays", "snaps"].contains(option.value) { return nil }
        if questionID == "treatment", ["natur", "gefaerbt", "blondiert", "dauerwelle", "chemisch_geglaettet"].contains(option.value) { return nil }
        return option.description
    }
}

/// Quiz-local system typography; the shared profile option component keeps its existing design.
private struct OnboardingNativeOption: View {
    let label: String
    let description: String?
    let selected: Bool
    let multiple: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(label).font(.body)
                    if let description, !description.isEmpty {
                        Text(description).font(.callout).foregroundStyle(ChaarlieTheme.muted)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: selected ? (multiple ? "checkmark.square.fill" : "checkmark.circle.fill") : (multiple ? "square" : "circle"))
                    .font(.body).foregroundStyle(ChaarlieTheme.plum).accessibilityHidden(true)
            }.multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                .padding(14).frame(minHeight: 56)
                .background(selected ? ChaarlieTheme.plumIce : .white, in: RoundedRectangle(cornerRadius: 15))
                .overlay(RoundedRectangle(cornerRadius: 15).stroke(selected ? ChaarlieTheme.plum : ChaarlieTheme.border))
        }.buttonStyle(.plain).accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}

private struct OnboardingNativeField: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration.font(.body).padding(14).frame(minHeight: 54)
            .background(.white, in: RoundedRectangle(cornerRadius: 15))
            .overlay(RoundedRectangle(cornerRadius: 15).stroke(ChaarlieTheme.border))
    }
}

private struct OnboardingNativeButton: ButtonStyle {
    var color = ChaarlieTheme.plum
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.body.weight(.semibold)).multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true).padding(.horizontal, 16).padding(.vertical, 15)
            .frame(maxWidth: .infinity, minHeight: 54).foregroundStyle(.white)
            .background(color, in: RoundedRectangle(cornerRadius: 16))
            .opacity(!isEnabled ? 0.45 : configuration.isPressed ? 0.7 : 1)
    }
}

private struct OnboardingExampleBottle: View {
    var body: some View {
        ZStack(alignment: .top) {
            RoundedRectangle(cornerRadius: 14)
                .fill(LinearGradient(colors: [Color(hex: 0xe1d8c7), Color(hex: 0xfaf7ee), Color(hex: 0xded4c1)],
                                     startPoint: .leading, endPoint: .trailing))
                .frame(width: 68, height: 90).offset(y: 14)
                .shadow(color: ChaarlieTheme.ink.opacity(0.12), radius: 8, x: 5, y: 6)
            RoundedRectangle(cornerRadius: 4).fill(ChaarlieTheme.ink).frame(width: 43, height: 18)
            Text("DEINE\nPFLEGE").font(.custom("PlayfairDisplay-Regular", fixedSize: 11))
                .tracking(1).multilineTextAlignment(.center).foregroundStyle(Color(hex: 0x685c4a))
                .padding(.vertical, 9).frame(width: 54)
                .overlay(alignment: .top) { Rectangle().fill(Color(hex: 0x9a8f78)).frame(height: 0.5) }
                .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: 0x9a8f78)).frame(height: 0.5) }
                .offset(y: 34)
        }.frame(width: 90, height: 108)
    }
}
