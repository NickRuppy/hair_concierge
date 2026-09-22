import type { DiscoveryCockpitStepView, DiscoveryCockpitView } from "@/lib/discovery/cockpit"

/**
 * The participant's own document (mockup: `plans/discovery-call-toolkit/evidence/pdf-ansicht.html`).
 *
 * Everything on this page is written TO the participant — du-form, warm and short, cosmetic
 * reasoning only. There is no cockpit chrome here and no third person: „Ihr Produkt" belongs
 * to the call screen, „deine Routine" to this one. Nothing internal (ids, hashes, verdict
 * machinery, research state) reaches the paper.
 *
 * It decides nothing. Every line is a projection of the SAME `DiscoveryCockpitView` the
 * cockpit renders, so the sheet Nick reads out and the sheet the participant takes home
 * cannot disagree.
 *
 * The styling is a deliberate exception to the app's Tailwind surface: this is a printed A4
 * document with its own paper palette, so it carries its own scoped CSS — fixed colours that
 * survive a dark-mode session, `@page { size: A4 }`, and `print-color-adjust: exact` so the
 * status pills do not print as empty outlines.
 */

const WORDMARK = "Chaarlie"
const TITLE_PREFIX = "Deine Routine, "
const STEPS_TITLE = "So gehst du vor"
const SHELF_TITLE = "Deine bisherigen Produkte"
const DROP_TITLE = "Brauchst du nicht mehr"
const DROP_LEAD = "Diese Produkte kommen in deiner Routine nicht mehr vor."
const PENDING_TITLE = "Dazu melden wir uns noch"
const PENDING_LEAD = "Diese Produkte schauen wir uns in Ruhe an und sagen dir Bescheid."
const OPEN_STEP = "Noch offen – Empfehlung folgt"
const FALLBACK_SUB = "Deine Routine nach unserem Gespräch."

const BADGE_KEEP = "bleibt"
const BADGE_NEW = "neu"
const TAG_KEEP = "bleibt"
const TAG_SWAP = "ersetzt"
const TAG_OPEN = "noch offen"

const NOTE_KEEP = "Bleibt in deiner Routine."
const NOTE_OPEN = "Dazu melden wir uns noch."
const NOTE_SWAP_PREFIX = "Wird ersetzt durch "
const NOTE_SWAP_UNNAMED = "Wird ersetzt."

// --- projection ---------------------------------------------------------------

type PrintProduct = { name: string; badge: typeof BADGE_KEEP | typeof BADGE_NEW }

type PrintStep = {
  key: string
  categoryLabel: string
  frequencyLabel: string
  why: string
  product: PrintProduct | null
}

/**
 * What one routine step names on paper.
 *
 * Ruled (2026-09-22): a kept product keeps its own name badged „bleibt"; a swap and an open
 * step with the Idealplan's own recommendation read „neu"; an undecided step — and any step
 * whose named product could not be read — says „Noch offen" rather than quietly promoting a
 * different product into the slot.
 */
function stepProduct(step: DiscoveryCockpitStepView): PrintProduct | null {
  switch (step.outcome) {
    case "kept":
      return step.ownedLabel ? { name: step.ownedLabel, badge: BADGE_KEEP } : null
    case "swapped":
      return step.swapProductLabel ? { name: step.swapProductLabel, badge: BADGE_NEW } : null
    case "ideal":
      return step.idealRecommendation
        ? { name: step.idealRecommendation.name, badge: BADGE_NEW }
        : null
    case "undecided":
      return null
  }
}

function printSteps(view: DiscoveryCockpitView): PrintStep[] {
  return view.steps.map((step) => ({
    key: step.decisionKey,
    categoryLabel: step.categoryLabel,
    frequencyLabel: cadenceLabel(step.frequencyLabel),
    // The role's own sentence — what this step does, in the plan's established wording.
    why: step.roleDescription ?? step.roleLabel,
    product: stepProduct(step),
  }))
}

type ShelfEntry = {
  key: string
  name: string
  tag: typeof TAG_KEEP | typeof TAG_SWAP | typeof TAG_OPEN
  note: string
}

/**
 * The participant's own shelf: every product they brought that carries a routine step, and
 * what the call made of it. The note says what HAPPENS to the product — the engine's verdict
 * is the reasoning behind that decision and stays in the cockpit.
 */
function shelfEntries(view: DiscoveryCockpitView): ShelfEntry[] {
  return view.steps.flatMap((step): ShelfEntry[] => {
    if (!step.intakeItemId || !step.ownedLabel) return []
    if (step.outcome === "kept") {
      return [{ key: step.intakeItemId, name: step.ownedLabel, tag: TAG_KEEP, note: NOTE_KEEP }]
    }
    if (step.outcome === "swapped") {
      return [
        {
          key: step.intakeItemId,
          name: step.ownedLabel,
          tag: TAG_SWAP,
          note: step.swapProductLabel
            ? `${NOTE_SWAP_PREFIX}${step.swapProductLabel}.`
            : NOTE_SWAP_UNNAMED,
        },
      ]
    }
    return [{ key: step.intakeItemId, name: step.ownedLabel, tag: TAG_OPEN, note: NOTE_OPEN }]
  })
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function sentence(head: string, parts: string[]): string {
  return parts.length === 0 ? `${head}.` : `${head} — ${parts.join(", ")}.`
}

/** „7 Schritte — 4 bleiben, 3 sind neu." */
function routineSummary(steps: PrintStep[]): string {
  if (steps.length === 0) return FALLBACK_SUB
  const keep = steps.filter((step) => step.product?.badge === BADGE_KEEP).length
  const fresh = steps.filter((step) => step.product?.badge === BADGE_NEW).length
  const open = steps.filter((step) => step.product === null).length
  return sentence(countLabel(steps.length, "Schritt", "Schritte"), [
    ...(keep > 0 ? [`${keep} ${keep === 1 ? "bleibt" : "bleiben"}`] : []),
    ...(fresh > 0 ? [`${fresh} ${fresh === 1 ? "ist" : "sind"} neu`] : []),
    ...(open > 0 ? [`${open} ${open === 1 ? "ist" : "sind"} noch offen`] : []),
  ])
}

/**
 * „6 Produkte in deiner Routine — 4 bleiben, 2 werden ersetzt."
 *
 * Deliberately not „geprüft": this counts only the products that carry a routine step, so
 * „geprüft" would undercount everything listed further down the page.
 */
function shelfSummary(entries: ShelfEntry[]): string {
  const keep = entries.filter((entry) => entry.tag === TAG_KEEP).length
  const swap = entries.filter((entry) => entry.tag === TAG_SWAP).length
  const open = entries.filter((entry) => entry.tag === TAG_OPEN).length
  return sentence(`${countLabel(entries.length, "Produkt", "Produkte")} in deiner Routine`, [
    ...(keep > 0 ? [`${keep} ${keep === 1 ? "bleibt" : "bleiben"}`] : []),
    ...(swap > 0 ? [`${swap} ${swap === 1 ? "wird" : "werden"} ersetzt`] : []),
    ...(open > 0 ? [`${open} ${open === 1 ? "ist" : "sind"} noch offen`] : []),
  ])
}

/**
 * The date as the participant lived it.
 *
 * Fixed to Europe/Berlin rather than sliced off the UTC string: a call finalised at 00:30
 * CEST is stored as the previous day in UTC and would print yesterday's date on her sheet.
 * The zone is a constant, not the runtime's, so the server render and any hydration of this
 * text agree by construction.
 */
const DOCUMENT_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

function formatDiscoveryDocumentDate(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return DOCUMENT_DATE_FORMAT.format(date)
}

/**
 * The cadence column, guarded against the plan's own internal phrasings.
 *
 * `frequencyLabel` (decision-presentation.ts) answers „wird im nächsten Schritt verfeinert"
 * for a category with no frequency target yet, and prefixes „später: " while a category is
 * paused. Both are plan-machinery wording about a step that is not settled — on a finished
 * document they read as a loose end, so the cadence falls back to a neutral „nach Bedarf"
 * and the step's own line (open or named) carries the actual state.
 */
const CADENCE_FALLBACK = "nach Bedarf"
const CADENCE_UNREFINED = "wird im nächsten Schritt verfeinert"
const CADENCE_PAUSED_PREFIX = "später:"

function cadenceLabel(label: string): string {
  const value = label.trim()
  if (!value || value === CADENCE_UNREFINED || value.startsWith(CADENCE_PAUSED_PREFIX)) {
    return CADENCE_FALLBACK
  }
  return value
}

// --- document -----------------------------------------------------------------

export function DiscoveryRoutineDocument({
  name,
  view,
  finalizedAt,
}: {
  name: string
  view: DiscoveryCockpitView
  finalizedAt: string | null
}) {
  const steps = printSteps(view)
  const shelf = shelfEntries(view)
  const dropped = view.unassigned.filter((entry) => entry.reason === "no_ideal_step")
  // Still in research: nothing is known about these yet, so the document promises a follow-up
  // instead of filing them under „brauchst du nicht mehr" — that would be a claim we cannot make.
  const pending = view.unassigned.filter((entry) => entry.reason === "research_pending")
  const date = formatDiscoveryDocumentDate(finalizedAt)

  return (
    <>
      <style>{DOCUMENT_STYLES}</style>
      <div className="dcp-sheet">
        <div className="dcp-page">
          <header className="dcp-header">
            <p className="dcp-wordmark">{WORDMARK}</p>
            <h1 className="dcp-title">{`${TITLE_PREFIX}${name}`}</h1>
            <p className="dcp-sub">{routineSummary(steps)}</p>
          </header>

          {steps.length > 0 ? (
            <>
              <h2 className="dcp-section">{STEPS_TITLE}</h2>
              <ol className="dcp-steps">
                {steps.map((step, index) => (
                  <li key={step.key}>
                    <span className="dcp-num">{index + 1}</span>
                    <div className="dcp-step-top">
                      <span className="dcp-cat">{step.categoryLabel}</span>
                      <span className="dcp-freq">{step.frequencyLabel}</span>
                    </div>
                    {step.product ? (
                      <p className="dcp-prod">
                        {step.product.name}
                        <span
                          className={`dcp-badge ${
                            step.product.badge === BADGE_KEEP ? "dcp-b-keep" : "dcp-b-new"
                          }`}
                        >
                          {step.product.badge}
                        </span>
                      </p>
                    ) : (
                      <p className="dcp-prod dcp-prod-open">{OPEN_STEP}</p>
                    )}
                    <p className="dcp-why">{step.why}</p>
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          {shelf.length > 0 ? (
            <section className="dcp-block">
              <h2 className="dcp-section">{SHELF_TITLE}</h2>
              <p className="dcp-count">{shelfSummary(shelf)}</p>
              <ul className="dcp-checked">
                {shelf.map((entry) => (
                  <li key={entry.key}>
                    <span
                      className={`dcp-tag ${
                        entry.tag === TAG_KEEP
                          ? "dcp-t-keep"
                          : entry.tag === TAG_SWAP
                            ? "dcp-t-swap"
                            : "dcp-t-open"
                      }`}
                    >
                      {entry.tag}
                    </span>
                    <span>
                      <span className="dcp-pname">{entry.name}</span>
                      {" — "}
                      <span className="dcp-note">{entry.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {dropped.length > 0 ? (
            <section className="dcp-block">
              <h2 className="dcp-section">{DROP_TITLE}</h2>
              <p className="dcp-count">{DROP_LEAD}</p>
              <ul className="dcp-plain">
                {dropped.map((entry) => (
                  <li key={entry.itemId}>{entry.label}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {pending.length > 0 ? (
            <section className="dcp-block">
              <h2 className="dcp-section">{PENDING_TITLE}</h2>
              <p className="dcp-count">{PENDING_LEAD}</p>
              <ul className="dcp-plain">
                {pending.map((entry) => (
                  <li key={entry.itemId}>{entry.label}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <footer className="dcp-footer">
            <span>{`${WORDMARK} · Deine Routine für ${name}`}</span>
            <span>{date}</span>
          </footer>
        </div>
      </div>
    </>
  )
}

const DOCUMENT_STYLES = `
.dcp-sheet {
  --dcp-paper: #ffffff;
  --dcp-plum-darkest: #2a1845;
  --dcp-plum-dark: #3d2a62;
  --dcp-plum: #6b50a0;
  --dcp-plum-ice: #f2eefa;
  --dcp-plum-light: #c8b8e0;
  --dcp-ok-bg: #edf7ef;
  --dcp-ok-text: #356b45;
  --dcp-neutral-bg: #f3f0f6;
  --dcp-neutral-text: #574b61;
  --dcp-open-bg: #f6f1e8;
  --dcp-open-text: #7a6338;
  --dcp-rule: #e6e2df;
  --dcp-text: #3a3835;
  --dcp-text-sub: #6a6560;
  --dcp-text-caption: #857f79;
  /* The fallback lives INSIDE var(): an undefined custom property makes the whole
     font-family declaration invalid, which would silently drop the serif display face. */
  --dcp-display: var(--font-playfair-display, Georgia), Georgia, "Times New Roman", serif;
  --dcp-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  background: #e9e6e3;
  padding: 24px 8px;
  color: var(--dcp-text);
  font-family: var(--dcp-sans);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.dcp-sheet *, .dcp-sheet *::before, .dcp-sheet *::after { box-sizing: border-box; }
.dcp-page {
  width: 210mm;
  max-width: 100%;
  min-height: 297mm;
  margin: 0 auto;
  background: var(--dcp-paper);
  padding: 18mm 20mm 16mm;
  box-shadow: 0 16px 40px -26px rgba(42, 24, 69, 0.5);
}
.dcp-header {
  border-bottom: 2px solid var(--dcp-plum-darkest);
  padding-bottom: 12px;
  margin-bottom: 22px;
}
.dcp-wordmark {
  font-family: var(--dcp-display);
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--dcp-plum);
  margin: 0 0 14px;
}
.dcp-title {
  font-family: var(--dcp-display);
  font-weight: 500;
  font-size: 30px;
  line-height: 1.15;
  color: var(--dcp-plum-darkest);
  margin: 0;
}
.dcp-sub { margin: 6px 0 0; font-size: 13.5px; color: var(--dcp-text-sub); }
.dcp-section {
  font-family: var(--dcp-display);
  font-weight: 500;
  font-size: 18px;
  color: var(--dcp-plum-darkest);
  margin: 0 0 12px;
}
.dcp-block { margin-top: 26px; break-inside: avoid; }
.dcp-steps { list-style: none; margin: 0; padding: 0; }
.dcp-steps > li {
  display: grid;
  grid-template-columns: 26px 1fr;
  gap: 0 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--dcp-rule);
  break-inside: avoid;
}
.dcp-steps > li:first-child { border-top: 1px solid var(--dcp-rule); }
.dcp-num {
  font-family: var(--dcp-display);
  font-size: 17px;
  color: var(--dcp-plum-light);
  line-height: 1.25;
  grid-row: span 3;
}
.dcp-step-top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.dcp-cat {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dcp-plum);
}
.dcp-freq { font-size: 11.5px; color: var(--dcp-text-caption); margin-left: auto; }
.dcp-prod {
  font-size: 15.5px;
  font-weight: 700;
  color: var(--dcp-plum-darkest);
  margin: 3px 0 0;
  line-height: 1.3;
}
.dcp-prod-open { font-weight: 500; color: var(--dcp-text-sub); }
.dcp-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 2px 8px;
  margin-left: 8px;
  vertical-align: 2px;
}
.dcp-b-keep { background: var(--dcp-neutral-bg); color: var(--dcp-neutral-text); }
.dcp-b-new { background: var(--dcp-plum-ice); color: var(--dcp-plum-dark); }
.dcp-why { font-size: 13px; line-height: 1.55; color: var(--dcp-text-sub); margin: 4px 0 0; }
.dcp-count { font-size: 13px; color: var(--dcp-text-sub); margin: 0 0 12px; }
.dcp-checked { list-style: none; margin: 0; padding: 0; }
.dcp-checked li {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--dcp-rule);
  font-size: 13px;
  line-height: 1.5;
  break-inside: avoid;
}
.dcp-checked li:first-child { border-top: 1px solid var(--dcp-rule); }
.dcp-tag {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-radius: 4px;
  padding: 3px 7px;
  text-align: center;
  align-self: start;
}
.dcp-t-keep { background: var(--dcp-ok-bg); color: var(--dcp-ok-text); }
.dcp-t-swap { background: var(--dcp-plum-ice); color: var(--dcp-plum-dark); }
.dcp-t-open { background: var(--dcp-open-bg); color: var(--dcp-open-text); }
.dcp-pname { font-weight: 600; color: var(--dcp-plum-darkest); }
.dcp-note { color: var(--dcp-text-sub); }
.dcp-plain { list-style: none; margin: 0; padding: 0; }
.dcp-plain li {
  padding: 7px 0;
  border-bottom: 1px solid var(--dcp-rule);
  font-size: 13px;
  line-height: 1.5;
  color: var(--dcp-plum-darkest);
  font-weight: 600;
  break-inside: avoid;
}
.dcp-plain li:first-child { border-top: 1px solid var(--dcp-rule); }
.dcp-footer {
  margin-top: 28px;
  padding-top: 12px;
  border-top: 1px solid var(--dcp-rule);
  font-size: 11px;
  color: var(--dcp-text-caption);
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
@page { size: A4; margin: 0; }
@media print {
  .dcp-sheet { background: #fff; padding: 0; }
  .dcp-page {
    box-shadow: none;
    margin: 0;
    width: auto;
    max-width: none;
    min-height: auto;
    padding: 16mm 18mm;
  }
}
`
