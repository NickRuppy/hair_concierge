import SwiftUI
import CoreFoundation

/// Discretionary German breaks preserve the supplied text and only appear when a word wraps.
enum GermanLineBreaks {
    static func text(_ value: String) -> String {
        let source = value as CFString
        let length = CFStringGetLength(source)
        let locale = Locale(identifier: "de") as CFLocale
        guard length > 0, CFStringIsHyphenationAvailableForLocale(locale) else { return value }
        let result = NSMutableString(string: value)
        var location = length
        while location > 0 {
            let next = CFStringGetHyphenationLocationBeforeIndex(source, location,
                CFRange(location: 0, length: length), 0, locale, nil)
            guard next != kCFNotFound else { break }
            result.insert("\u{00ad}", at: next)
            location = next
        }
        return result as String
    }
}

enum ChaarlieTheme {
    static let background = Color(hex: 0xfaf8f6)
    static let ink = Color(hex: 0x3b3532)
    static let muted = Color(hex: 0x68605b)
    static let plum = Color(hex: 0x6b50a0)
    static let plumMid = Color(hex: 0xa996cc)
    static let plumScale = Color(hex: 0xe7dff5)
    static let plumIce = Color(hex: 0xf2eefa)
    static let border = Color(hex: 0xe6e0da)
    static let coral = Color(hex: 0xaa464e)
    static func body(_ size: CGFloat = 15, weight: Font.Weight = .regular) -> Font {
        .custom("PlusJakartaSans-Regular", size: size, relativeTo: .body).weight(weight)
    }
    static func display(_ size: CGFloat = 28) -> Font {
        .custom("PlayfairDisplay-Regular", size: size, relativeTo: .title)
    }
}
extension Color {
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 255) / 255,
                  green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255, opacity: 1)
    }
}
struct ChaarlieButton: ButtonStyle {
    var outline = false
    @Environment(\.isEnabled) private var isEnabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(ChaarlieTheme.body(15, weight: .bold))
            .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity).padding(.vertical, 15).padding(.horizontal, 12)
            .foregroundStyle(outline ? ChaarlieTheme.plum : .white)
            .background(outline ? Color.white : ChaarlieTheme.coral)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(outline ? ChaarlieTheme.plum : .clear))
            .opacity(!isEnabled ? 0.45 : configuration.isPressed ? 0.7 : 1)
    }
}
struct ChaarlieTextButton: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
            .opacity(!isEnabled ? 0.45 : configuration.isPressed ? 0.7 : 1)
    }
}
struct ChaarlieField: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration.padding(.horizontal, 10).padding(.vertical, 12)
            .frame(minHeight: 44)
            .background(.white, in: RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(ChaarlieTheme.border))
    }
}
struct CloseButton: View {
    let label: String
    let action: () -> Void
    var body: some View {
        Button(action: action) { Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).frame(width: 44, height: 44) }
            .foregroundStyle(ChaarlieTheme.ink).accessibilityLabel(label)
    }
}
