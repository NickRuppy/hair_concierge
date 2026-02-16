"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

// --- Context ---

interface AccordionContextValue {
  openItems: string[]
  toggle: (value: string) => void
}

const AccordionContext = React.createContext<AccordionContextValue>({
  openItems: [],
  toggle: () => {},
})

// --- Accordion ---

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "multiple"
  defaultValue?: string[]
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ className, defaultValue = [], children, ...props }, ref) => {
    const [openItems, setOpenItems] = React.useState<string[]>(defaultValue)

    const toggle = React.useCallback((value: string) => {
      setOpenItems((prev) =>
        prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value]
      )
    }, [])

    return (
      <AccordionContext.Provider value={{ openItems, toggle }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    )
  }
)
Accordion.displayName = "Accordion"

// --- AccordionItem ---

interface AccordionItemContextValue {
  value: string
  isOpen: boolean
}

const AccordionItemContext = React.createContext<AccordionItemContextValue>({
  value: "",
  isOpen: false,
})

interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const { openItems } = React.useContext(AccordionContext)
    const isOpen = openItems.includes(value)

    return (
      <AccordionItemContext.Provider value={{ value, isOpen }}>
        <div
          ref={ref}
          className={cn("rounded-lg border", className)}
          {...props}
        >
          {children}
        </div>
      </AccordionItemContext.Provider>
    )
  }
)
AccordionItem.displayName = "AccordionItem"

// --- AccordionTrigger ---

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { toggle } = React.useContext(AccordionContext)
  const { value, isOpen } = React.useContext(AccordionItemContext)

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={isOpen}
      onClick={() => toggle(value)}
      className={cn(
        "flex w-full items-center justify-between px-4 py-3 text-sm font-semibold transition-colors hover:bg-accent/50",
        isOpen && "rounded-t-lg",
        !isOpen && "rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "shrink-0 text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180"
        )}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  )
})
AccordionTrigger.displayName = "AccordionTrigger"

// --- AccordionContent ---

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen } = React.useContext(AccordionItemContext)

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      <div className="overflow-hidden">
        <div ref={ref} className={cn("px-4 pb-4", className)} {...props}>
          {children}
        </div>
      </div>
    </div>
  )
})
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
