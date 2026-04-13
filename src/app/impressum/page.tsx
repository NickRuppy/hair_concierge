import Link from "next/link"

export const metadata = {
  title: "Impressum",
}

export default function ImpressumPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Impressum</h1>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 font-medium text-foreground">Angaben gemäß § 5 DDG</h2>
            <p>Haarmony, LLC</p>
            <p>1111B S Governors Ave Ste 84075</p>
            <p>Dover, Delaware 19904</p>
            <p>USA</p>
          </section>

          <section>
            <h2 className="mb-2 font-medium text-foreground">Kontakt</h2>
            <p>E-Mail: info@haarmony.com</p>
          </section>

          <section>
            <h2 className="mb-2 font-medium text-foreground">Haftung für Inhalte</h2>
            <p>
              Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
              Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
              Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen
              Gesetzen verantwortlich. Eine Verpflichtung zur Überwachung übermittelter oder
              gespeicherter fremder Informationen besteht jedoch nicht.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-medium text-foreground">Haftung für Links</h2>
            <p>
              Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir
              keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr
              übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
              oder Betreiber der Seiten verantwortlich.
            </p>
          </section>
        </div>

        <Link href="/" className="inline-block text-sm text-muted-foreground hover:underline">
          ← Zurück zur Startseite
        </Link>
      </div>
    </div>
  )
}
