import SwiftUI

struct QuizOptionButton: View {
    let label: String
    var description: String? = nil
    let selected: Bool
    var multiple = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(label.components(separatedBy: " ").map(GermanLineBreaks.text).joined(separator: " ")).accessibilityLabel(label).chaarlieSystemFont(16, weight: .semibold)
                    if let description, !description.isEmpty {
                        Text(description).chaarlieSystemFont(14).foregroundStyle(ChaarlieTheme.muted)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: selected ? (multiple ? "checkmark.square.fill" : "checkmark.circle.fill") : (multiple ? "square" : "circle"))
                    .foregroundStyle(ChaarlieTheme.plum).accessibilityHidden(true)
            }.fixedSize(horizontal: false, vertical: true).padding(16).frame(minHeight: 54)
                .background(selected ? ChaarlieTheme.plumIce : .white, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? ChaarlieTheme.plum : ChaarlieTheme.border))
        }.buttonStyle(.plain).accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}
