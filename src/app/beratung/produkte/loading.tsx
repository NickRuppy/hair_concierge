import { Plus, Search } from "lucide-react"

import { DISCOVERY_INTAKE_CATEGORY_COPY } from "@/components/discovery/intake/categories"
import { SCREEN_TITLE } from "@/components/discovery/intake/ui-classes"
import { Icon, type IconName } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/**
 * The route's loading boundary (batch 8, plan item 3): the EXACT empty „Deine Produkte"
 * screen — title, search field + „Scannen", the six ghost slots and „Weiteres" — as static
 * markup, so the hand-off from the quiz's „Geschafft" (which prefetches this boundary) lands
 * on the finished layout instead of a blank page, and the real screen replaces it in place.
 *
 * Mirrors `DiscoveryProductsScreen` (src/components/discovery/intake/discovery-products-
 * screen.tsx) inside `SlideStage`'s wrappers: same classes, same slot order and icons.
 * Keep the two in step when the products screen's layout changes.
 */

const GHOST_SLOTS: ReadonlyArray<{
  slot: keyof typeof DISCOVERY_INTAKE_CATEGORY_COPY
  icon: IconName
}> = [
  { slot: "shampoo", icon: "product-shampoo" },
  { slot: "conditioner", icon: "product-conditioner" },
  { slot: "leave_in", icon: "product-leave-in" },
  { slot: "mask", icon: "product-mask" },
  { slot: "oil", icon: "product-oil" },
  { slot: "heat_protectant", icon: "heat-protection-yes" },
]

function BarcodeGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M8 8.5v7M11 8.5v7M14 8.5v7M16.5 8.5v7" />
    </svg>
  )
}

export default function DiscoveryChecklistLoading() {
  return (
    <div className="discovery-stage relative overflow-x-clip">
      <div className="relative bg-[#faf8f6]">
        <main aria-busy="true" className="flex min-h-dvh flex-col bg-[#faf8f6]">
          <div className="flex-1 px-4 pb-8 pt-10">
            <h1 className={cn("mb-3.5", SCREEN_TITLE)}>Deine Produkte</h1>

            <div className="sticky top-0 z-20 -mx-4 flex gap-2 bg-[linear-gradient(#faf8f6_76%,rgba(250,248,246,0))] px-4 pb-4 pt-1.5">
              <div className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-[15px] border border-border bg-white px-3.5 text-left text-[15.5px] text-[var(--text-sub)] shadow-[0_1px_2px_rgba(42,24,69,0.04),0_6px_16px_rgba(42,24,69,0.05)]">
                <Search
                  className="h-5 w-5 shrink-0 text-[var(--brand-plum)]"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                <span className="truncate">Produkt suchen</span>
              </div>
              <div className="flex h-[50px] shrink-0 items-center gap-2 rounded-[15px] bg-[var(--brand-plum-darkest)] pl-3.5 pr-4 text-[15px] font-bold text-white">
                <BarcodeGlyph />
                Scannen
              </div>
            </div>

            <ul className="grid grid-cols-2 gap-2.5 [grid-auto-flow:row_dense]">
              {GHOST_SLOTS.map(({ slot, icon }) => (
                <li key={slot}>
                  <div className="flex h-[112px] w-full flex-col items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-[rgba(107,80,160,0.26)] bg-[rgba(242,238,250,0.62)] text-sm font-semibold text-[var(--brand-plum)]">
                    <Icon name={icon} size={26} className="opacity-50" />
                    {DISCOVERY_INTAKE_CATEGORY_COPY[slot].label}
                  </div>
                </li>
              ))}
              <li className="col-span-2">
                <div className="flex h-[54px] w-full items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-[rgba(107,80,160,0.18)] text-[14.5px] font-semibold text-[var(--brand-plum)]">
                  <Plus className="h-[18px] w-[18px] opacity-70" aria-hidden="true" />
                  Weiteres
                </div>
              </li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  )
}
