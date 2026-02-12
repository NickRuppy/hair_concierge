export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="font-header text-2xl text-foreground">
            Hair Concierge
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lass uns dein Haarprofil erstellen
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
