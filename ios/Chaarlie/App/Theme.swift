import SwiftUI
import CoreFoundation
import CoreText

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
    /// Native serif metrics keep explanation spacing aligned with the New York heading role.
    static func headingFont(_ size: CGFloat) -> CTFont {
        let system = UIFont.systemFont(ofSize: size)
        return UIFont(descriptor: system.fontDescriptor.withDesign(.serif) ?? system.fontDescriptor, size: size) as CTFont
    }
    static func wordmark(_ size: CGFloat = 28) -> Font {
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
        configuration.label.chaarlieSystemFont(15, weight: .bold)
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

/// Keeps the existing base sizes while scaling SF/New York with semantic Dynamic Type metrics.
private struct ChaarlieSystemFont: ViewModifier {
    @ScaledMetric private var size: CGFloat
    let weight: Font.Weight
    let design: Font.Design

    init(size: CGFloat, weight: Font.Weight, design: Font.Design, relativeTo style: Font.TextStyle) {
        _size = ScaledMetric(wrappedValue: size, relativeTo: style)
        self.weight = weight
        self.design = design
    }

    func body(content: Content) -> some View {
        content.font(.system(size: size, weight: weight, design: design))
    }
}

/// Light root screens scroll beneath the system status area; keep that area opaque.
private struct ChaarlieStatusBarBackground: ViewModifier {
    var enabled: Bool
    func body(content: Content) -> some View {
        content.overlay {
            if enabled {
                GeometryReader { geometry in
                    VStack(spacing: 0) {
                        ChaarlieTheme.background.frame(height: geometry.safeAreaInsets.top)
                        Spacer(minLength: 0)
                    }.ignoresSafeArea(.container, edges: .top)
                }.allowsHitTesting(false).accessibilityHidden(true)
            }
        }
    }
}

extension View {
    func chaarlieStatusBarBackground(enabled: Bool = true) -> some View {
        modifier(ChaarlieStatusBarBackground(enabled: enabled))
    }
    func chaarlieHeading(_ size: CGFloat = 28, relativeTo style: Font.TextStyle = .title) -> some View {
        modifier(ChaarlieSystemFont(size: size, weight: .regular, design: .serif, relativeTo: style))
    }
    func chaarlieSystemFont(_ size: CGFloat = 15, weight: Font.Weight = .regular,
                           design: Font.Design = .default, relativeTo style: Font.TextStyle = .body) -> some View {
        modifier(ChaarlieSystemFont(size: size, weight: weight, design: design, relativeTo: style))
    }
}
