import { ToolThumb } from "@/components/personal-plan-tools/tool-thumb"

import type { ToolUseSectionView } from "./application-types"

/**
 * One Tool use, as its own image-led section in the ordered sequence — the same
 * grammar as a product-use block. No pills, no capability chips, no subordinate
 * callouts. When a fact is unverified the section stays visible and says so
 * instead of blocking the unrelated product steps around it.
 */
export function ToolUseBlock({ step, position }: { step: ToolUseSectionView; position: number }) {
  return (
    <li
      className="grid grid-cols-[34px_minmax(0,1fr)] gap-3"
      data-application-tool-use={step.assetKey}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-plum)] text-sm font-semibold text-white">
        {position}
      </span>
      <article className="rounded-md border border-[var(--brand-plum-light)] bg-[var(--brand-plum-ice)] p-4 shadow-[0_18px_42px_-34px_rgba(var(--brand-plum-rgb),0.78)]">
        <div className="flex min-w-0 items-start gap-3">
          <ToolThumb
            src={step.imageUrl}
            alt={step.imageAltDe}
            size={48}
            className="h-12 w-12 rounded-[10px] border border-[var(--brand-plum-light)]"
          />
          <div className="min-w-0">
            <p className="type-caption flex flex-wrap items-center gap-2 text-[var(--text-caption)]">
              {step.familyLabelDe}
            </p>
            <h2 className="type-h3 break-words text-[var(--text-heading)]">{step.typeLabelDe}</h2>
            <p className="type-body-sm mt-1 text-[var(--text-sub)]">{step.purposeDe}</p>
          </div>
        </div>

        {step.actionsDe.length > 0 ? (
          <ol className="mt-4 space-y-3">
            {step.actionsDe.map((action, index) => (
              <li key={action} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
                <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-[var(--brand-plum)]">
                  {index + 1}
                </span>
                <p className="type-body-sm text-[var(--text-body)]">{action}</p>
              </li>
            ))}
          </ol>
        ) : null}

        {step.conditionalNoteDe ? (
          <p
            className="type-body-sm mt-4 rounded-md border border-[var(--brand-plum-light)] bg-white/70 px-3 py-2 text-[var(--text-sub)]"
            data-application-tool-conditional
          >
            {step.conditionalNoteDe}
          </p>
        ) : null}
      </article>
    </li>
  )
}
