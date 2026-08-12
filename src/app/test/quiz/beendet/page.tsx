import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function RegularQuizFieldTestEndedPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">Dein Produkttest ist beendet.</h1>
      <p className="mt-4 text-muted-foreground">Danke, dass du Chaarlie getestet hast.</p>
      <Link
        className="mt-8 inline-flex rounded-full border px-5 py-3 text-sm font-semibold"
        href="/test/quiz/beendet/normal"
        prefetch={false}
      >
        Testzugang verlassen und zum regulären Haarquiz
      </Link>
    </main>
  )
}
