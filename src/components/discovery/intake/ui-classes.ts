/**
 * The participant flow's two button looks (batch 7, Nick's style rules): coral is the ONE
 * call to action of a screen; a secondary action is an outline button in plum — never an
 * underlined text link.
 */

export const CORAL_BUTTON =
  "flex min-h-14 w-full items-center justify-center rounded-full bg-[var(--brand-coral)] px-6 text-[17px] font-bold text-white shadow-[0_8px_18px_rgba(212,97,106,0.26)] transition hover:bg-[var(--brand-coral-dark)] active:scale-[0.985] disabled:opacity-45 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum-dark)] focus-visible:ring-offset-2"

export const OUTLINE_BUTTON =
  "flex min-h-[52px] w-full items-center justify-center rounded-full border-[1.5px] border-[var(--brand-plum)] bg-transparent px-6 text-base font-bold text-[var(--brand-plum)] transition active:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2 disabled:opacity-50"

/** The sticky bar a screen's CTAs sit in, fading the content out behind them. */
export const CTA_BAR =
  "sticky bottom-0 z-20 flex flex-col gap-2 bg-[linear-gradient(rgba(250,248,246,0),#faf8f6_30%)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3.5"

export const SCREEN_TITLE =
  "font-header text-[32px] font-medium leading-[1.1] tracking-[-0.015em] text-[var(--brand-plum-darkest)]"

export const BACK_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-xl text-[var(--brand-plum)] active:bg-[var(--brand-plum-ice)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)]"
