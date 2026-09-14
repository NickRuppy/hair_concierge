import SwiftUI

struct ProfileView: View {
    @Bindable var model: AppModel
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("chaarlie").font(ChaarlieTheme.display(28))
                    Text("Meine Haarangaben").font(ChaarlieTheme.display(30)).accessibilityAddTraits(.isHeader)
                    Text("Diese Angaben verwenden wir, um Produkte für dich einzuschätzen.").foregroundStyle(ChaarlieTheme.muted)
                    if let profile = model.profile {
                        VStack(spacing: 0) {
                            ForEach(profile.answers) { answer in
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(answer.label).font(ChaarlieTheme.body(14, weight: .semibold))
                                    Text(answer.values.joined(separator: ", ")).font(ChaarlieTheme.body(14)).foregroundStyle(ChaarlieTheme.muted)
                                }.frame(maxWidth: .infinity, alignment: .leading).padding(16)
                                    .accessibilityElement(children: .combine)
                                if answer.id != profile.answers.last?.id { Divider() }
                            }
                        }.background(.white).clipShape(RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(ChaarlieTheme.border))
                    } else if model.profileError == nil { ProgressView("Haarangaben werden geladen …") }
                    if let error = model.profileError {
                        Text(error)
                        Button("Erneut versuchen") { Task { await model.loadProfile() } }.buttonStyle(ChaarlieButton())
                    }
                    Button("Abmelden") { Task { await model.logout() } }.buttonStyle(ChaarlieButton(outline: true))
                        .accessibilityIdentifier("profile.logout")
                }.padding(24)
            }.background(ChaarlieTheme.background).toolbar(.hidden, for: .navigationBar)
                .task { await model.loadProfile() }
        }
    }
}
