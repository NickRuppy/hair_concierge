import SwiftUI

/// Shared surface, motion and feedback building blocks. Presentation only:
/// nothing here owns state, copy decisions or server-authored content.
extension ChaarlieTheme {
    static let surfaceMuted = Color(hex: 0xf3efeb)
    static let success = Color(hex: 0x356b45)
    static let shadow = Color(hex: 0x3b3532)
    enum Radius {
        static let control: CGFloat = 14
        static let card: CGFloat = 18
    }
    enum Motion {
        static let press = Animation.spring(response: 0.26, dampingFraction: 0.72)
        static let state = Animation.spring(response: 0.38, dampingFraction: 0.86)
        static let reveal = Animation.spring(response: 0.5, dampingFraction: 0.88)
    }
}

/// White content surface: continuous corners, hairline border and one soft ambient shadow.
private struct ChaarlieCard: ViewModifier {
    let radius: CGFloat
    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        content.background(.white, in: shape)
            .overlay(shape.strokeBorder(ChaarlieTheme.border.opacity(0.75), lineWidth: 1))
            .shadow(color: ChaarlieTheme.shadow.opacity(0.05), radius: 14, y: 5)
    }
}

/// Tappable cards settle slightly under the finger instead of only dimming.
struct ChaarliePressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.975 : 1)
            .opacity(configuration.isPressed ? 0.82 : 1)
            .animation(ChaarlieTheme.Motion.press, value: configuration.isPressed)
    }
}

/// One-time staggered entrance for list content. Reduce Motion keeps a plain fade.
private struct ChaarlieReveal: ViewModifier {
    let index: Int
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func body(content: Content) -> some View {
        content.opacity(shown ? 1 : 0).offset(y: shown || reduceMotion ? 0 : 12)
            .onAppear {
                guard !shown else { return }
                withAnimation(ChaarlieTheme.Motion.reveal.delay(reduceMotion ? 0 : Double(min(index, 8)) * 0.045)) { shown = true }
            }
    }
}

/// Loading placeholder sweep. Without motion it stays a calm static block.
private struct ChaarlieShimmer: ViewModifier {
    @State private var phase: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func body(content: Content) -> some View {
        content.overlay {
            if !reduceMotion {
                GeometryReader { geometry in
                    LinearGradient(colors: [.clear, .white.opacity(0.7), .clear], startPoint: .leading, endPoint: .trailing)
                        .frame(width: geometry.size.width * 0.6)
                        .offset(x: phase * geometry.size.width * 1.4)
                }.allowsHitTesting(false)
            }
        }.clipped()
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 1.25).repeatForever(autoreverses: false)) { phase = 1 }
            }
    }
}

/// Movement or scale only when the user allows it; Reduce Motion keeps a plain fade.
private struct ChaarlieMotionTransition: ViewModifier {
    let transition: AnyTransition
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func body(content: Content) -> some View { content.transition(reduceMotion ? .opacity : transition) }
}

extension View {
    func chaarlieTransition(_ transition: AnyTransition) -> some View { modifier(ChaarlieMotionTransition(transition: transition)) }
    func chaarlieCard(radius: CGFloat = ChaarlieTheme.Radius.card) -> some View { modifier(ChaarlieCard(radius: radius)) }
    func chaarlieReveal(_ index: Int = 0) -> some View { modifier(ChaarlieReveal(index: index)) }
    func chaarlieShimmer() -> some View { modifier(ChaarlieShimmer()) }
}

/// Product-row shaped placeholder shown while a list request is running.
struct SkeletonProductRows: View {
    let label: String
    var count = 3
    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<count, id: \.self) { index in
                HStack(spacing: 14) {
                    block(width: 76, height: 92, radius: 12)
                    VStack(alignment: .leading, spacing: 9) {
                        block(width: index.isMultiple(of: 2) ? 190 : 150, height: 13, radius: 6)
                        block(width: 110, height: 10, radius: 5)
                        block(width: 72, height: 22, radius: 11)
                    }
                    Spacer(minLength: 0)
                }.padding(12).chaarlieCard().opacity(1 - Double(index) * 0.25)
            }
        }.chaarlieShimmer()
            .accessibilityElement(children: .ignore).accessibilityLabel(label)
            .accessibilityAddTraits(.updatesFrequently)
    }
    private func block(width: CGFloat, height: CGFloat, radius: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous).fill(ChaarlieTheme.surfaceMuted)
            .frame(width: width, height: height)
    }
}

/// Small state label. Colour supports the text; it never carries the meaning alone.
struct StatusPill: View {
    enum Tone { case accent, neutral }
    let text: String
    let systemImage: String
    var tone: Tone = .neutral
    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: systemImage).font(.system(size: 10, weight: .bold)).accessibilityHidden(true)
            Text(text).chaarlieSystemFont(12, weight: .semibold, relativeTo: .caption)
        }.padding(.horizontal, 9).padding(.vertical, 5)
            .foregroundStyle(tone == .accent ? ChaarlieTheme.plum : ChaarlieTheme.muted)
            .background(tone == .accent ? ChaarlieTheme.plumIce : ChaarlieTheme.surfaceMuted, in: Capsule())
    }
}

/// Inline recoverable problem: what happened, then the way forward.
struct NoticeCard<Actions: View>: View {
    let systemImage: String
    let message: String
    @ViewBuilder var actions: Actions
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: systemImage).font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(ChaarlieTheme.coral).accessibilityHidden(true)
                Text(message).chaarlieSystemFont(15).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            actions
        }.padding(16).chaarlieCard()
    }
}

/// Branded inline progress: spinner and label share one quiet capsule.
struct BusyLabel: View {
    let text: String
    var onDark = false
    var body: some View {
        HStack(spacing: 10) {
            ProgressView().tint(onDark ? .white : ChaarlieTheme.plum)
            Text(text).chaarlieSystemFont(14, weight: .medium)
        }.padding(.horizontal, 16).padding(.vertical, 11)
            .foregroundStyle(onDark ? .white : ChaarlieTheme.ink)
            .background {
                if onDark { Capsule().fill(.ultraThinMaterial).environment(\.colorScheme, .dark) }
                else { Capsule().fill(ChaarlieTheme.plumIce) }
            }
            .accessibilityElement(children: .combine)
    }
}

/// Centered empty or idle state with an icon medallion in the brand tint.
struct EmptyStateView<Actions: View>: View {
    let systemImage: String
    let title: String
    let message: String
    @ViewBuilder var actions: Actions
    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle().fill(ChaarlieTheme.plumIce).frame(width: 84, height: 84)
                Circle().strokeBorder(ChaarlieTheme.plumScale, lineWidth: 1).frame(width: 84, height: 84)
                Image(systemName: systemImage).font(.system(size: 30, weight: .regular)).foregroundStyle(ChaarlieTheme.plum)
            }.padding(.bottom, 10).accessibilityHidden(true)
            Text(title).chaarlieHeading(24, relativeTo: .title2).accessibilityAddTraits(.isHeader)
            Text(message).chaarlieSystemFont(15).foregroundStyle(ChaarlieTheme.muted)
            actions
        }.multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 36)
    }
}
