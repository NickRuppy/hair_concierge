"use client"

import { ToolThumb } from "@/components/personal-plan-tools/tool-thumb"
import { TOOL_FAMILY_LABELS, toolImageAlt, toolImageSrc } from "@/lib/personal-plan/tools/labels"
import { TOOL_PRODUCT_TYPE_LABELS } from "@/lib/personal-plan/tools/labels"
import { TOOL_STATE_LABELS } from "@/lib/personal-plan/tools/presentation"
import type { ToolAsset } from "@/lib/personal-plan/tools/contracts"

/**
 * `Deine Tools` — the last Routine section, after `Später ergänzen`.
 *
 * One physical Tool is one row even when it supports several occurrences. Tool
 * assets are durable: this section deliberately renders no cadence, no
 * replacement hint, no low-stock nudge and no reorder or acquisition action.
 */
export function RoutineToolSection({ assets }: { assets: readonly ToolAsset[] }) {
  if (assets.length === 0) return null

  return (
    <section
      className="rounded-[20px] border border-border bg-white/80 px-4 py-4"
      data-routine-tool-section
      aria-label="Deine Tools"
    >
      <h2 className="text-sm font-semibold text-[var(--brand-plum-darkest)]">Deine Tools</h2>
      <ul className="mt-3 space-y-2.5">
        {assets.map((asset) => (
          <ToolRow key={asset.assetKey} asset={asset} />
        ))}
      </ul>
    </section>
  )
}

function ToolRow({ asset }: { asset: ToolAsset }) {
  const lead = asset.productTypes[0]

  return (
    <li
      className="flex items-start gap-3"
      data-routine-tool-row={asset.assetKey}
      data-routine-tool-state={asset.presentationState}
    >
      <ToolThumb
        src={toolImageSrc(lead)}
        alt={toolImageAlt(lead)}
        size={44}
        className="h-11 w-11 rounded-xl border border-[rgba(31,26,20,0.05)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug text-[var(--brand-plum-darkest)]">
          {TOOL_PRODUCT_TYPE_LABELS[lead]}
        </span>
        <span className="block text-xs leading-snug text-muted-foreground">
          {TOOL_FAMILY_LABELS[asset.family]} · {asset.purposeKey}
        </span>
        {/* Own line: long German state labels must not squeeze the Tool name. */}
        <span className="mt-1 inline-block rounded-full bg-[var(--brand-plum-ice)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-plum)]">
          {TOOL_STATE_LABELS[asset.presentationState]}
        </span>
      </span>
    </li>
  )
}
