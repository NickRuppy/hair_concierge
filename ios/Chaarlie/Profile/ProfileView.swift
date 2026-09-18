import SwiftUI

/// Presentation metadata only. Answer choices and their constraints remain server-owned.
struct ProfileProperty: Identifiable {
    let id: String
    let title: String
    let definition: String
    let displayIDs: [String]
    var isEssentialTest: Bool { id == "fingertest" || id == "pulltest" }
    var isMultiline: Bool { ["treatment", "scalp_type", "goals", "concerns"].contains(id) }

    static let hair: [Self] = [
        .init(id: "structure", title: "Haarstruktur", definition: "Wie verläuft dein Haar von Natur aus?", displayIDs: ["hair_texture"]),
        .init(id: "thickness", title: "Haardicke", definition: "Wie dick ist ein einzelnes Haar?", displayIDs: ["thickness"]),
        .init(id: "density", title: "Haardichte", definition: "Wie dicht wächst dein Haar?", displayIDs: ["density"]),
        .init(id: "hair_length", title: "Haarlänge", definition: "Wie lang ist dein Haar aktuell?", displayIDs: ["hair_length"]),
        .init(id: "fingertest", title: "Haaroberfläche", definition: "Wie fühlt sich dein Haar an, wenn du darüberstreichst?", displayIDs: ["cuticle_condition"]),
        .init(id: "pulltest", title: "Dehnbarkeit", definition: "Wie verhält sich dein Haar beim vorsichtigen Dehnen?", displayIDs: ["protein_moisture_balance"])
    ]
    static let care: [Self] = [
        .init(id: "treatment", title: "Behandlungen", definition: "Was trifft aktuell auf dein Haar zu?", displayIDs: ["chemical_treatment"]),
        .init(id: "scalp_type", title: "Kopfhaut", definition: "Pflegebedarf und Beschwerden an einem Ort.", displayIDs: ["scalp_type", "scalp_condition"]),
        .init(id: "goals", title: "Meine Ziele", definition: "Was möchtest du mit deiner Haarpflege erreichen?", displayIDs: ["goals"]),
        .init(id: "concerns", title: "Haarprobleme", definition: "Was beschäftigt dich aktuell?", displayIDs: ["concerns", "concerns_other_text"])
    ]
    static var all: [Self] { hair + care }
    static func find(_ id: String?) -> Self? { all.first { $0.id == id } }
    func value(in profile: HairProfile) -> String {
        let hasConcernNote = profile.answers.first { $0.id == "concerns_other_text" }?.values
            .contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } == true
        let values = displayIDs.compactMap { id -> String? in
            guard let row = profile.answers.first(where: { $0.id == id }) else { return nil }
            if id == "concerns_other_text", !hasConcernNote { return nil }
            if id == "concerns", hasConcernNote, row.values.isEmpty || row.values == ["Keine"] { return nil }
            if row.values.isEmpty {
                if id == "concerns" { return "Keine" }
                if id == "scalp_condition" { return "Beschwerden: Keine" }
                return nil
            }
            let value = row.values.joined(separator: ", ")
            return id == "scalp_condition" ? "Beschwerden: \(value)" : value
        }
        return values.isEmpty ? "Noch nicht angegeben" : values.joined(separator: " · ")
    }
}

struct ProfileView: View {
    @Bindable var model: AppModel
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("chaarlie").font(ChaarlieTheme.wordmark(28))
                    Text("Meine Haarangaben").chaarlieHeading(30).accessibilityAddTraits(.isHeader)
                    Text("Diese Angaben verwenden wir, um Produkte für dich einzuschätzen.").foregroundStyle(ChaarlieTheme.muted)
                    if let profile = model.profile {
                        propertyGroup("Dein Haar", properties: ProfileProperty.hair, profile: profile)
                        propertyGroup("Pflege & Wünsche", properties: ProfileProperty.care, profile: profile)
                        Button("Alle Angaben überprüfen") { Task { await model.beginProfileEdit() } }
                            .buttonStyle(ChaarlieTextButton()).accessibilityIdentifier("profile.edit")
                        let primaryIDs = Set(ProfileProperty.all.flatMap(\.displayIDs))
                        let details = profile.answers.filter { !primaryIDs.contains($0.id) }
                        if !details.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                sectionTitle("Weitere Angaben")
                                VStack(spacing: 0) {
                                    ForEach(details) { answer in
                                        VStack(alignment: .leading, spacing: 8) {
                                            Text(answer.label).chaarlieSystemFont(14, weight: .semibold)
                                            Text(answer.values.joined(separator: ", ")).chaarlieSystemFont(14).foregroundStyle(ChaarlieTheme.muted)
                                        }.frame(maxWidth: .infinity, alignment: .leading).padding(16)
                                            .accessibilityElement(children: .combine)
                                        if answer.id != details.last?.id { Divider() }
                                    }
                                }.chaarlieCard()
                            }
                        }
                    } else if model.profileError == nil { BusyLabel(text: "Haarangaben werden geladen …") }
                    if let error = model.profileError {
                        NoticeCard(systemImage: "wifi.slash", message: error) {
                            Button("Erneut versuchen") { Task { await model.loadProfile() } }.buttonStyle(ChaarlieButton())
                        }
                    }
                    if let message = model.profileSavedMessage {
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill").accessibilityHidden(true)
                            Text(message).chaarlieSystemFont(14, weight: .medium).accessibilityIdentifier("profile.saved")
                        }.foregroundStyle(ChaarlieTheme.plum).padding(.horizontal, 14).padding(.vertical, 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(ChaarlieTheme.plumIce, in: RoundedRectangle(cornerRadius: ChaarlieTheme.Radius.control, style: .continuous))
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                    Button("Abmelden") { Task { await model.logout() } }.buttonStyle(ChaarlieButton(outline: true))
                        .accessibilityIdentifier("profile.logout")
                }.padding(24)
                    .animation(ChaarlieTheme.Motion.state, value: model.profileSavedMessage)
                    .animation(ChaarlieTheme.Motion.state, value: model.profile == nil)
            }.background(ChaarlieTheme.background).toolbar(.hidden, for: .navigationBar)
                .sensoryFeedback(.success, trigger: model.profileSavedMessage) { _, message in message != nil }
                .chaarlieStatusBarBackground()
                .task { await model.loadProfile() }
                .sheet(isPresented: $model.profileEditPresented, onDismiss: { model.cancelProfileEdit() }) {
                    ProfileEditView(model: model)
                        .presentationDetents([.large]).presentationDragIndicator(.visible)
                }
        }
    }
    private func sectionTitle(_ text: String) -> some View {
        Text(text).chaarlieSystemFont(13, weight: .semibold)
            .foregroundStyle(ChaarlieTheme.muted).accessibilityAddTraits(.isHeader)
    }
    private func propertyGroup(_ title: String, properties: [ProfileProperty], profile: HairProfile) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle(title)
            VStack(spacing: 0) {
                ForEach(properties) { property in
                    Button { Task { await model.beginProfileEdit(propertyID: property.id) } } label: {
                        HStack(spacing: 12) {
                            if property.isMultiline || dynamicTypeSize.isAccessibilitySize {
                                propertyText(property, profile: profile)
                            } else {
                                ViewThatFits(in: .horizontal) {
                                    HStack(alignment: .firstTextBaseline, spacing: 14) {
                                        Text(property.title).chaarlieSystemFont(16).fixedSize()
                                        Spacer(minLength: 4)
                                        Text(property.value(in: profile)).chaarlieSystemFont(15)
                                            .foregroundStyle(ChaarlieTheme.muted).fixedSize()
                                    }
                                    propertyText(property, profile: profile)
                                }
                            }
                            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(ChaarlieTheme.muted).accessibilityHidden(true)
                        }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading).padding(16)
                            .contentShape(Rectangle())
                    }.buttonStyle(ProfileRowStyle()).accessibilityElement(children: .combine)
                        .accessibilityIdentifier("profile.property.\(property.id)")
                        .accessibilityHint("Angabe bearbeiten")
                    if property.id != properties.last?.id { Divider().padding(.leading, 16) }
                }
            }.clipShape(RoundedRectangle(cornerRadius: ChaarlieTheme.Radius.card, style: .continuous)).chaarlieCard()
        }
    }
    private func propertyText(_ property: ProfileProperty, profile: HairProfile) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(property.title).chaarlieSystemFont(16)
            Text(property.value(in: profile)).chaarlieSystemFont(14).foregroundStyle(ChaarlieTheme.muted)
        }.fixedSize(horizontal: false, vertical: true).frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Grouped rows highlight in place; scaling a single row inside a shared card would tear its edges.
private struct ProfileRowStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.background(configuration.isPressed ? ChaarlieTheme.plumIce : .clear)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}
