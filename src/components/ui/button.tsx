"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 min-h-[44px]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90 text-[13px] font-semibold rounded-[11px] w-full",
        cta: "bg-secondary text-secondary-foreground shadow hover:bg-secondary/90 text-[14px] font-semibold rounded-[12px]",
        landingCta:
          "relative h-auto w-full overflow-hidden rounded-[14px] bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-dark))] px-6 py-4 text-base font-bold text-white shadow-[0_10px_32px_rgba(var(--brand-coral-rgb),0.31),inset_0_1px_0_rgba(255,255,255,0.22)] transition-colors after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_45%)] motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-coral-deep))] hover:shadow-[0_12px_36px_rgba(var(--brand-coral-rgb),0.36),inset_0_1px_0_rgba(255,255,255,0.22)]",
        outline:
          "border-[1.5px] border-primary bg-transparent text-primary text-[13px] font-semibold rounded-[12px] hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        unstyled: "",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    const resolvedSize = variant === "landingCta" && size === undefined ? null : size

    return (
      <button
        className={cn(buttonVariants({ variant, size: resolvedSize, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
