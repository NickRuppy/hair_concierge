import SwiftUI

struct ProfileEditView: View {
    @Bindable var model: AppModel
    @State private var helpExpanded = false
    @State private var confirmDiscard = false
    private var isSingleProperty: Bool { model.profileEditPropertyID != nil }
    private var controlsDisabled: Bool { model.profileSaving || model.profileEditLoading || model.profileEditConflict }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        Color.clear.frame(height: 1).id("top")
                        if model.profileEditLoading {
                            ProgressView("Deine Haarangaben werden geladen …")
                        } else if let draft = model.profileDraft {
                            if draft.isSingleProperty, let question = draft.question {
                                singleProperty(question, draft: draft)
                            } else if draft.step < 0 { introduction }
                            else if draft.isReview { review }
                            else if let question = draft.question { fullQuestion(question, draft: draft) }
                        }
                        if model.profileSaving {
                            ProgressView("Haarangaben werden gespeichert …").accessibilityIdentifier("profile.edit.saving")
                        }
                        if let error = model.profileEditError { errorMessage(error) }
                    }.padding(.horizontal, 24).padding(.bottom, 28)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: model.profileDraft?.step) { _, _ in
                    if !isSingleProperty { proxy.scrollTo("top", anchor: .top) }
                }
                .onChange(of: model.profileDraft?.scalpStep) { _, _ in
                    if !isSingleProperty { proxy.scrollTo("top", anchor: .top) }
                }
                .onChange(of: model.profileEditError) { _, error in
                    if error != nil { proxy.scrollTo("error", anchor: .bottom) }
                }
            }
            .background(ChaarlieTheme.background)
            .toolbar {
                if isSingleProperty {
                    ToolbarItem(placement: .cancellationAction) { cancelButton }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Speichern") {
                            Task { await model.saveProfileEdit() }
                        }.font(nil) // Preserve native toolbar typography instead of inheriting scaled content text.
                            .disabled(controlsDisabled || model.profileDraft?.canSave != true)
                            .accessibilityIdentifier("profile.edit.save")
                            .accessibilityLabel(model.profileEditError == nil ? "Speichern" : "Erneut speichern")
                    }
                } else {
                    ToolbarItem(placement: .topBarLeading) {
                        if let draft = model.profileDraft, draft.step >= 0 {
                            Button { model.changeProfileDraft { $0.back() } } label: {
                                Label("Zurück", systemImage: "chevron.left")
                            }.font(nil).disabled(controlsDisabled).accessibilityIdentifier("profile.edit.back")
                        }
                    }
                    ToolbarItem(placement: .topBarTrailing) { cancelButton }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .chaarlieSystemFont().foregroundStyle(ChaarlieTheme.ink).tint(ChaarlieTheme.plum)
        .preferredColorScheme(.light)
        .interactiveDismissDisabled(model.profileSaving || model.profileDraft?.hasChanges == true)
        .alert("Änderungen verwerfen?", isPresented: $confirmDiscard) {
            Button("Weiter bearbeiten", role: .cancel) { }
            Button("Entwurf verwerfen", role: .destructive) { model.cancelProfileEdit() }
                .accessibilityIdentifier("profile.edit.confirm-discard")
        } message: { Text("Möchtest du deinen Entwurf verwerfen und die Bearbeitung schließen?") }
    }
    private var cancelButton: some View {
        Button("Abbrechen", action: requestCancel).font(nil).disabled(model.profileSaving)
            .accessibilityIdentifier("profile.edit.cancel")
    }
    private func requestCancel() {
        if model.profileDraft?.hasChanges == true { confirmDiscard = true }
        else { model.cancelProfileEdit() }
    }
    private var introduction: some View {
        VStack(alignment: .leading, spacing: 22) {
            title("Haarangaben aktualisieren")
            Text("Wir haben deine bisherigen Antworten vorausgefüllt. Erst Speichern übernimmt deine Änderungen.")
                .foregroundStyle(ChaarlieTheme.muted)
            Button("Angaben bearbeiten") { model.changeProfileDraft { $0.advance() } }
                .buttonStyle(ChaarlieButton()).accessibilityIdentifier("profile.edit.start")
        }
    }
    private var review: some View {
        VStack(alignment: .leading, spacing: 22) {
            title("Änderungen übernehmen?")
            Text("Deine Angaben gelten für neue Einschätzungen in der App und auf der Website. Deine Routine bleibt unverändert.")
                .foregroundStyle(ChaarlieTheme.muted)
            Button(model.profileEditError == nil ? "Haarangaben speichern" : "Erneut versuchen") {
                Task { await model.saveProfileEdit() }
            }.buttonStyle(ChaarlieButton()).disabled(controlsDisabled || model.profileDraft?.canSave != true)
                .accessibilityIdentifier("profile.edit.save")
            Button("Änderungen verwerfen", action: requestCancel).buttonStyle(ChaarlieButton(outline: true))
                .disabled(model.profileSaving).accessibilityIdentifier("profile.edit.discard")
        }
    }
    @ViewBuilder private func singleProperty(_ question: EditQuestion, draft: ProfileEditDraft) -> some View {
        if let property = ProfileProperty.find(draft.propertyID) {
            title(property.title)
            Text(property.definition).foregroundStyle(ChaarlieTheme.muted)
            guidance(question, property: property, draft: draft)
        } else { title(question.title) }
        questionOptions(question, draft: draft, showDescriptions: false)
        if question.id == "scalp_type" {
            scalpGate(draft)
            if draft.answers.has_scalp_issue { scalpConditions(question, draft: draft) }
        }
        if let missingLength = draft.missingLengthQuestion {
            VStack(alignment: .leading, spacing: 16) {
                Text("Ergänze noch deine Haarlänge").chaarlieSystemFont(17, weight: .semibold)
                    .accessibilityAddTraits(.isHeader).accessibilityIdentifier("profile.edit.missing-length")
                Text("Diese Angabe fehlt noch. Wähle deine aktuelle Haarlänge, damit du die Änderung speichern kannst.")
                    .foregroundStyle(ChaarlieTheme.muted)
                Text(missingLength.instruction).chaarlieSystemFont(14).foregroundStyle(ChaarlieTheme.muted)
                ForEach(missingLength.options) { item in
                    option(value: "length.\(item.value)", label: item.label, description: item.description,
                           selected: draft.answers.hair_length == item.value) {
                        model.changeProfileDraft { $0.selectMissingLength(item.value) }
                    }
                }
            }.padding(16).background(ChaarlieTheme.plumIce, in: RoundedRectangle(cornerRadius: 16))
        }
    }
    @ViewBuilder private func guidance(_ question: EditQuestion, property: ProfileProperty, draft: ProfileEditDraft) -> some View {
        let instruction = property.id == "pulltest"
            ? question.instruction.replacingOccurrences(of: "Nimm dasselbe Haar.", with: "Nimm ein einzelnes, sauberes, trockenes Haar.")
            : question.instruction
        if property.isEssentialTest {
            VStack(alignment: .leading, spacing: 8) {
                Text("So prüfst du es").chaarlieSystemFont(14, weight: .semibold)
                Text(instruction).fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("profile.edit.instruction")
            }.padding(16).background(ChaarlieTheme.plumIce, in: RoundedRectangle(cornerRadius: 14))
        } else {
            DisclosureGroup(isExpanded: $helpExpanded) {
                VStack(alignment: .leading, spacing: 14) {
                    Text(instruction).fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("profile.edit.instruction")
                    ForEach(question.options(for: draft.answers.structure).filter { !($0.description ?? "").isEmpty }) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.label).chaarlieSystemFont(14, weight: .semibold)
                            Text(item.description ?? "").chaarlieSystemFont(14).foregroundStyle(ChaarlieTheme.muted)
                        }
                    }
                }.padding(.top, 12)
            } label: {
                Text("Wie erkenne ich das?").chaarlieSystemFont(15)
                    .frame(minHeight: 44).accessibilityIdentifier("profile.edit.help")
            }
        }
    }
    @ViewBuilder private func fullQuestion(_ question: EditQuestion, draft: ProfileEditDraft) -> some View {
        Text("\(draft.step + 1) / 10 · Angaben aktualisieren")
            .chaarlieSystemFont(13).foregroundStyle(ChaarlieTheme.muted)
            .accessibilityIdentifier("profile.edit.progress")
        if question.id == "scalp_type", draft.scalpStep == .gate {
            title("Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen?")
            scalpGate(draft, showHeading: false)
        } else if question.id == "scalp_type", draft.scalpStep == .condition {
            title("Was ist aktuell dein Hauptproblem?")
            scalpConditions(question, draft: draft, showHeading: false)
        } else {
            title(question.title)
            if !question.instruction.isEmpty { Text(question.instruction).foregroundStyle(ChaarlieTheme.muted) }
            questionOptions(question, draft: draft, showDescriptions: true)
        }
        Button("Weiter") { model.changeProfileDraft { $0.advance() } }
            .buttonStyle(ChaarlieButton()).disabled(!draft.canAdvance || controlsDisabled)
            .accessibilityIdentifier("profile.edit.next")
    }
    @ViewBuilder private func questionOptions(_ question: EditQuestion, draft: ProfileEditDraft, showDescriptions: Bool) -> some View {
        ForEach(question.options(for: draft.answers.structure)) { item in
            option(value: item.value, label: item.label, description: showDescriptions ? item.description : nil,
                   selected: draft.answers.values(for: question.id).contains(item.value), multiple: question.selectionMode == .multi) {
                model.changeProfileDraft { $0.select(item.value) }
            }
        }
        if question.id == "concerns" { concernControls(draft) }
    }
    @ViewBuilder private func scalpGate(_ draft: ProfileEditDraft, showHeading: Bool = true) -> some View {
        if showHeading { Text("Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen?").chaarlieSystemFont(16, weight: .semibold) }
        option(value: "no", label: "Nein", selected: !draft.answers.has_scalp_issue) { model.changeProfileDraft { $0.setScalpIssue(false) } }
        option(value: "yes", label: "Ja", selected: draft.answers.has_scalp_issue) { model.changeProfileDraft { $0.setScalpIssue(true) } }
    }
    @ViewBuilder private func scalpConditions(_ question: EditQuestion, draft: ProfileEditDraft, showHeading: Bool = true) -> some View {
        if showHeading { Text("Was ist aktuell dein Hauptproblem?").chaarlieSystemFont(16, weight: .semibold) }
        ForEach(question.conditionOptions ?? []) { item in
            option(value: item.value, label: item.label, description: item.description, selected: draft.answers.scalp_condition == item.value) {
                model.changeProfileDraft { $0.selectCondition(item.value) }
            }
        }
    }
    @ViewBuilder private func concernControls(_ draft: ProfileEditDraft) -> some View {
        option(value: "no-concerns", label: "Keine aktuellen Haarprobleme",
               selected: draft.answers.concerns.isEmpty && (draft.answers.concerns_other_text ?? "").isEmpty) {
            model.changeProfileDraft { $0.clearConcerns() }
        }
        VStack(alignment: .leading, spacing: 8) {
            Text("Etwas anderes? (optional)").chaarlieSystemFont(14, weight: .semibold)
            TextField("Beschreibe es in wenigen Worten", text: Binding(
                get: { model.profileDraft?.answers.concerns_other_text ?? "" },
                set: { value in model.changeProfileDraft { $0.setOtherText(value) } }
            ), axis: .vertical).textFieldStyle(ChaarlieField()).lineLimit(1...3).disabled(controlsDisabled)
                .accessibilityIdentifier("profile.edit.other")
            Text("\(draft.answers.concerns_other_text?.count ?? 0) / 50 Zeichen")
                .chaarlieSystemFont(12).foregroundStyle(ChaarlieTheme.muted)
        }
    }
    private func errorMessage(_ error: String) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(model.profileEditConflict ? "Haarangaben inzwischen geändert" : "Bitte versuche es erneut")
                .chaarlieSystemFont(17, weight: .semibold)
            Text(error).fixedSize(horizontal: false, vertical: true).accessibilityIdentifier("profile.edit.error")
            if model.profileEditConflict {
                Button("Aktuelle Angaben neu laden") { Task { await model.reloadProfileEdit() } }
                    .buttonStyle(ChaarlieButton()).accessibilityIdentifier("profile.edit.reload")
            } else if model.profileDraft == nil {
                Button("Erneut versuchen") { Task { await model.reloadProfileEdit() } }.buttonStyle(ChaarlieButton())
            }
        }.padding(16).background(ChaarlieTheme.plumIce, in: RoundedRectangle(cornerRadius: 14)).id("error")
    }
    private func title(_ value: String) -> some View {
        Text(wrapping(value)).accessibilityLabel(value).chaarlieHeading(30).fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader).accessibilityIdentifier("profile.edit.title")
    }
    private func wrapping(_ value: String) -> String {
        value.components(separatedBy: " ").map(GermanLineBreaks.text).joined(separator: " ")
    }
    private func option(value: String, label: String, description: String? = nil, selected: Bool,
                        multiple: Bool = false, action: @escaping () -> Void) -> some View {
        QuizOptionButton(label: label, description: description, selected: selected, multiple: multiple, action: action)
            .accessibilityIdentifier("profile.edit.option.\(value)").disabled(controlsDisabled)
    }
}
