import Link from "next/link"

export const metadata = {
  title: "Impressum",
}

export default function ImpressumPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Impressum
        </h1>

        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Angaben gemäß § 5 TMG</p>
            <p>Haarmony, LLC</p>
            <p>1111B S Governors Ave Ste 84075</p>
            <p>Dover, Delaware 19904</p>
            <p>USA</p>
          </div>

          <div>
            <p className="font-medium text-foreground">Kontakt</p>
            <p>E-Mail: info@haarmony.com</p>
          </div>
        </div>

        <Link
          href="/"
          className="inline-block text-sm text-muted-foreground hover:underline"
        >
          ← Zurück zur Startseite
        </Link>
      </div>
    </div>
  )
}
