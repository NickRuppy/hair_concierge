import type { ScanExampleCard as ScanExampleCardModel } from "@/lib/quiz/scan-insert-examples"

/** Generic bottle silhouette — the example product carries no packshot. */
function BottleGlyph() {
  return (
    <svg aria-hidden="true" className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24">
      <path
        d="M10 2.75h4v2.5l1.6 2.1a3 3 0 0 1 .65 1.85v9.05a3 3 0 0 1-3 3h-4.5a3 3 0 0 1-3-3V9.2a3 3 0 0 1 .65-1.85L10 5.25v-2.5Z"
        stroke="var(--brand-plum)"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M6.75 13.5h10.5" stroke="var(--brand-plum)" strokeWidth="1.5" />
    </svg>
  )
}

/**
 * The scanner verdict floating over the photo of a scan insert. It is marked as
 * an example on the card itself, never on the photo: the picture is a scene,
 * the card is the claim about a product.
 */
export function ScanExampleCard({ card }: { card: ScanExampleCardModel }) {
  return (
    <div className="scan-insert-example-card absolute inset-x-[14px] bottom-[14px] rounded-[18px] bg-white px-[14px] py-3 shadow-[0_20px_40px_-18px_rgba(42,24,69,0.55)]">
      <span className="absolute -top-[10px] right-3 rounded-full bg-[var(--brand-plum)] px-2 py-[3px] text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-white">
        Beispiel
      </span>
      <div className="flex items-center gap-2.5">
        <div className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-[var(--brand-plum-ice)]">
          <BottleGlyph />
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold leading-[1.25] text-[var(--brand-plum-darkest)]">
            {card.product.name}
          </p>
          <p className="text-[11px] text-[var(--text-sub)]">
            {card.product.category} · {card.product.price}
          </p>
        </div>
      </div>
      <p
        className={`scan-insert-example-verdict mb-[2px] mt-2 ${
          card.verdict === "warn"
            ? "text-[var(--status-pending-text)]"
            : "text-[var(--brand-plum-darkest)]"
        }`}
      >
        {card.headline}
      </p>
      <p className="text-[12px] text-[var(--text-body)]">{card.deviation}</p>
    </div>
  )
}
