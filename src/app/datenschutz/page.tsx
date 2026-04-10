import Link from "next/link"

export const metadata = {
  title: "Datenschutz",
}

export default function DatenschutzPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Datenschutz
        </h1>
        <p className="text-muted-foreground">
          Diese Seite wird in Kürze aktualisiert.
        </p>
        <Link
          href="/"
          className="inline-block text-sm text-muted-foreground hover:underline"
        >
          Zurück zur Startseite
        </Link>
      </div>
    </div>
  )
}
