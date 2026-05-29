import type { ReactNode } from "react"

type Props = {
  eyebrow: string
  title: ReactNode
  lede?: ReactNode
  className?: string
}

export function SectionHeading({ eyebrow, title, lede, className }: Props) {
  return (
    <div className={className}>
      <span className="mb-3 block font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--brand-plum)]">
        {eyebrow}
      </span>
      <h2 className="mb-4 font-header text-[clamp(28px,4vw,44px)] font-medium leading-[1.2] text-[var(--brand-plum-darkest)]">
        {title}
      </h2>
      {lede ? <p className="max-w-[640px] text-lg text-muted-foreground">{lede}</p> : null}
    </div>
  )
}
