export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-[#231F20]">
      {/* Left panel — brand (hidden on mobile) */}
      <div className="sticky top-0 hidden h-screen w-1/2 items-center justify-center overflow-hidden md:flex">
        <OnboardingBrandPanel />
      </div>

      {/* Right panel — onboarding content (full-width on mobile) */}
      <div className="w-full overflow-y-auto md:w-1/2">
        <div className="mx-auto max-w-[540px] px-5 py-8 md:px-10 md:py-12">
          {children}
        </div>
      </div>
    </div>
  )
}

function OnboardingBrandPanel() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-12">
      {/* Charcoal base + noise texture */}
      <div className="absolute inset-0 bg-[#1A1618]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Yellow brush-stroke accent */}
      <div
        className="absolute left-[-20%] top-[15%] h-[300px] w-[140%] rotate-[-8deg] opacity-[0.07]"
        style={{
          background: "linear-gradient(90deg, transparent, #FFBE10 30%, #F5C518 70%, transparent)",
          borderRadius: "50%",
          filter: "blur(40px)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-[360px] text-center">
        <h2 className="font-header text-5xl leading-[0.95] text-white mb-6">
          TOM<br />BOT
        </h2>
        <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-[#F5C518]/40" />
        <p className="text-lg text-white/50 leading-relaxed">
          Dein Haar, dein Plan.
        </p>
      </div>
    </div>
  )
}
