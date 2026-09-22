/**
 * The discovery-call funnel has no landing page by design: `/lp/call`
 * redirects straight into the quiz (see `src/app/lp/[slug]/page.tsx`). This
 * variant exists only to satisfy the landing registry and as a safety net if
 * the redirect is ever bypassed — it hands the visitor into the quiz.
 */
export default function FunnelCallDirectLandingVariant() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fcfaf7] px-4 text-center text-[var(--brand-plum-darkest)]">
      <section className="max-w-lg">
        <h1 className="font-header text-3xl">Lass uns mit deinen Haaren starten.</h1>
        <p className="mt-4 leading-7 text-[var(--text-sub)]">
          10 kurze Fragen zu deinem Haar – die Vorbereitung auf dein Gespräch mit uns.
        </p>
        <a
          className="mt-6 inline-flex rounded-full bg-[var(--brand-coral)] px-6 py-3 font-bold text-white"
          href="/quiz"
        >
          Los geht’s
        </a>
      </section>
    </main>
  )
}
