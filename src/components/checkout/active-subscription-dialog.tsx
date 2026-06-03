"use client"

import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type ActiveSubscriptionDialogProps = {
  open: boolean
  email?: string | null
  onOpenChange: (open: boolean) => void
}

export const checkoutAccessAlreadyExistsError = "checkout_access_already_exists"

export function isCheckoutAccessAlreadyExistsResponse(response: Response, body: unknown): boolean {
  return (
    response.status === 409 &&
    typeof body === "object" &&
    body !== null &&
    (body as { error?: unknown }).error === checkoutAccessAlreadyExistsError
  )
}

export function readCheckoutAccessAlreadyExistsEmail(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null
  const email = (body as { email?: unknown }).email
  return typeof email === "string" && email.trim() ? email.trim() : null
}

export function ActiveSubscriptionDialog({
  open,
  email,
  onOpenChange,
}: ActiveSubscriptionDialogProps) {
  const normalizedEmail = email?.trim() || null
  const loginHref = normalizedEmail ? `/auth?email=${encodeURIComponent(normalizedEmail)}` : "/auth"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-md rounded-[8px]">
        <DialogHeader>
          <DialogTitle>Aktives Abo gefunden</DialogTitle>
          <DialogDescription>
            {normalizedEmail
              ? "Für diese Chaarlie-E-Mail gibt es bereits ein aktives Abo."
              : "Für dieses Konto gibt es bereits ein aktives Abo."}
          </DialogDescription>
        </DialogHeader>

        {normalizedEmail ? (
          <p className="rounded-[8px] border border-border bg-muted/60 px-3 py-2 text-center text-sm font-semibold text-foreground">
            {normalizedEmail}
          </p>
        ) : null}

        <p className="text-sm leading-6 text-muted-foreground">
          {normalizedEmail
            ? "Bitte melde dich mit dieser E-Mail an, um dein Abo zu nutzen."
            : "Bitte melde dich an, um dein Abo zu nutzen."}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
          <Link className={buttonVariants()} href={loginHref}>
            Einloggen
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
