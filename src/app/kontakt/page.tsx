import Link from "next/link"

export const metadata = {
  title: "Kontakt",
}

export default function KontaktPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Kontakt</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Hast du Fragen, möchtest du dein Abo kündigen, oder brauchst du Hilfe? Schreib uns
          einfach.
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">E-Mail</h2>
            <p>
              <a href="mailto:info@chaarlie.de" className="text-foreground underline">
                info@chaarlie.de
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">Postanschrift</h2>
            <address className="not-italic">
              Haarmony LLC
              <br />
              1111B S Governors Ave # 84075
              <br />
              Dover, DE 19904
              <br />
              USA
            </address>
          </section>

          <p>Wir antworten in der Regel innerhalb von 24 Stunden, an Werktagen.</p>
        </div>

        <Link href="/" className="inline-block text-sm text-muted-foreground hover:underline">
          ← Zurück zur Startseite
        </Link>
      </div>
    </div>
  )
}
