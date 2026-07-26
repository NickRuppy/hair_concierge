export function FounderLetter({ firstName }: { firstName: string }) {
  return (
    <section
      id="unlock-plan"
      className="scroll-mt-5 border-t border-border py-9"
      data-offer-section="founder_letter"
    >
      <article className="rounded-[20px] border border-[var(--brand-plum-light)]/70 bg-[var(--brand-plum-ice)]/45 px-5 py-6 text-[14.5px] leading-[1.7] text-[var(--brand-plum-darkest)] shadow-[0_18px_48px_-38px_rgba(var(--brand-plum-rgb),0.55)] sm:px-6">
        <h2
          id="guided-story-chapter-2-heading"
          tabIndex={-1}
          className="font-header text-[30px] font-medium leading-[1.15] text-[var(--brand-plum-darkest)] outline-none"
        >
          {firstName ? `Liebe ${firstName},` : "Hallo,"}
        </h2>
        <div className="mt-5 space-y-4">
          <p>falls du dich fragst, wieso du gerade jetzt starten solltest und nicht irgendwann:</p>
          <p>
            Die meisten Menschen finden <strong>nie</strong> heraus, was ihr Haar wirklich braucht.
            Sie pflegen jahrelang daran vorbei. Und Schäden, die sich über Jahre aufbauen, lassen
            sich irgendwann kaum noch reparieren. Dann hilft oft nur noch abschneiden und von vorn
            anfangen.
          </p>
          <p>
            Dazu kommt das Geld: In unseren Auswertungen sehen wir immer wieder, dass viele{" "}
            <strong>300 bis 470 Euro im Jahr</strong> für Produkte ausgeben, von denen die meisten
            nicht zu ihrem Haar passen. Genau deshalb gibt es Chaarlie: Du weißt, was bei dir wirkt,{" "}
            <em>bevor</em> du kaufst. Viele sparen damit 30 Euro und mehr im Monat, und die
            Empfehlungen kannst du genauso für deine Familie nutzen.
          </p>
          <p>
            Am Ende geht es um mehr als Produkte: eine gesunde Kopfhaut, Haare, die sich wieder gut
            anfühlen, und das gute Gefühl, es <strong>zu wissen statt zu raten</strong>.
          </p>
          <p>
            Nick &amp; Jonas
            <br />
            <span className="text-[13px] text-muted-foreground">Gründer von Chaarlie</span>
          </p>
        </div>
      </article>
    </section>
  )
}
