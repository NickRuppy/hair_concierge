import Link from "next/link"

export const metadata = {
  title: "Impressum",
}

export default function ImpressumPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Letzte Aktualisierung: Mai 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Impressum</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Angaben gemäß § 5 DDG und Art. 13 EU-Verbraucherrechte-Richtlinie.
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 font-medium text-foreground">Anbieter</h2>
            <address className="not-italic">
              <strong className="text-foreground">Haarmony LLC</strong>
              <br />
              1111B S Governors Ave # 84075
              <br />
              Dover, DE 19904
              <br />
              Vereinigte Staaten von Amerika
            </address>
          </section>

          <section>
            <h2 className="mb-2 font-medium text-foreground">Vertretungsberechtigt</h2>
            <p>Jonas Eidenschink, Geschäftsführer</p>
          </section>

          <section>
            <h2 className="mb-2 font-medium text-foreground">Kontakt</h2>
            <p>
              E-Mail:{" "}
              <a href="mailto:info@chaarlie.de" className="text-foreground underline">
                info@chaarlie.de
              </a>
              <br />
              Web:{" "}
              <a href="https://chaarlie.de" className="text-foreground underline">
                www.chaarlie.de
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-medium text-foreground">Steuernummer / Registrierung</h2>
            <p>
              Employer Identification Number (EIN): 38-4392612
              <br />
              Rechtsform: Limited Liability Company (LLC) nach dem Recht des Bundesstaates Delaware,
              USA
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-medium text-foreground">
              Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
            </h2>
            <p>Jonas Eidenschink, Anschrift wie oben</p>
          </section>

          <section>
            <h2 className="mb-2 font-medium text-foreground">
              Plattform der EU-Kommission zur Online-Streitbeilegung
            </h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
              bereit, die du unter{" "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline"
              >
                ec.europa.eu/consumers/odr
              </a>{" "}
              findest.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-medium text-foreground">Verbraucherstreitbeilegung</h2>
            <p>
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-medium text-foreground">Haftung für Inhalte</h2>
            <p>
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten
              nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als
              Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
              Informationen zu überwachen oder nach Umständen zu forschen, die auf eine
              rechtswidrige Tätigkeit hinweisen.
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

          <section>
            <h2 className="mb-2 font-medium text-foreground">Hinweis zu fachlichen Empfehlungen</h2>
            <p>
              Chaarlie ist kein medizinisches Produkt und ersetzt keine medizinische Beratung. Die
              Empfehlungen dienen ausschließlich der allgemeinen Haarpflege. Bei medizinischen Haar-
              oder Kopfhautproblemen wende dich an eine Dermatologin oder einen Dermatologen.
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
