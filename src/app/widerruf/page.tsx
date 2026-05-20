import Link from "next/link"

export const metadata = {
  title: "Widerrufsbelehrung",
}

export default function WiderrufPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-16">
      <div className="w-full max-w-2xl space-y-8">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Letzte Aktualisierung: Mai 2026
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Widerrufsbelehrung
        </h1>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">Widerrufsrecht</h2>
            <p>
              Du hast das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu
              widerrufen. Die Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsschlusses.
            </p>
            <p className="mt-2">Um dein Widerrufsrecht auszuüben, musst du uns:</p>
            <address className="mt-2 not-italic">
              Haarmony LLC
              <br />
              1111B S Governors Ave # 84075
              <br />
              Dover, DE 19904, USA
              <br />
              E-Mail:{" "}
              <a href="mailto:info@chaarlie.de" className="text-foreground underline">
                info@chaarlie.de
              </a>
            </address>
            <p className="mt-2">
              mittels einer eindeutigen Erklärung (z.B. ein per Post versandter Brief oder eine
              E-Mail) über deinen Entschluss, diesen Vertrag zu widerrufen, informieren.
            </p>
            <p className="mt-2">
              Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung über die Ausübung
              des Widerrufsrechts vor Ablauf der Widerrufsfrist absendest.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">Folgen des Widerrufs</h2>
            <p>
              Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir
              erhalten haben, unverzüglich und spätestens binnen 14 Tagen ab dem Tag zurückzuzahlen,
              an dem die Mitteilung über deinen Widerruf bei uns eingegangen ist. Für diese
              Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen
              Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes
              vereinbart.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              Erlöschen des Widerrufsrechts bei digitalen Inhalten
            </h2>
            <p>
              Bei einem Vertrag über die Lieferung von nicht auf einem körperlichen Datenträger
              befindlichen digitalen Inhalten erlischt das Widerrufsrecht, wenn der Anbieter mit der
              Ausführung des Vertrags begonnen hat, nachdem du ausdrücklich zugestimmt hast, dass
              mit der Ausführung des Vertrags vor Ablauf der Widerrufsfrist begonnen wird, und du
              deine Kenntnis davon bestätigt hast, dass durch deine Zustimmung mit Beginn der
              Ausführung des Vertrags dein Widerrufsrecht erlischt.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">Muster-Widerrufsformular</h2>
            <p>
              Wenn du den Vertrag widerrufen willst, kannst du dieses Formular ausfüllen und uns
              zurücksenden:
            </p>
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-5 text-foreground">
              <p>
                An Haarmony LLC, 1111B S Governors Ave # 84075, Dover, DE 19904, USA, E-Mail:
                info@chaarlie.de
              </p>
              <p>
                Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über
                den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*):
              </p>
              <p>Bestellt am (*) / erhalten am (*):</p>
              <p>Name des/der Verbraucher(s):</p>
              <p>Anschrift des/der Verbraucher(s):</p>
              <p>Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):</p>
              <p>Datum:</p>
              <p className="text-xs text-muted-foreground">(*) Unzutreffendes streichen</p>
            </div>
          </section>
        </div>

        <Link href="/" className="inline-block text-sm text-muted-foreground hover:underline">
          ← Zurück zur Startseite
        </Link>
      </div>
    </div>
  )
}
