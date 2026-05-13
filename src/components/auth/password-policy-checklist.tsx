"use client"

import { CheckCircle2, Circle, Info } from "lucide-react"
import {
  getPasswordPolicyItems,
  MIN_PASSWORD_LENGTH,
  type PasswordPolicyContext,
  type PasswordPolicyItemId,
} from "@/lib/auth/password-policy"

interface PasswordPolicyChecklistProps {
  password: string
  confirmPassword: string
  context: PasswordPolicyContext
}

export function PasswordPolicyChecklist({
  password,
  confirmPassword,
  context,
}: PasswordPolicyChecklistProps) {
  const items = getPasswordPolicyItems(context)

  return (
    <ul className="space-y-2 rounded-lg bg-muted/40 px-3 py-3 text-left text-xs text-muted-foreground">
      {items.map((item) => {
        if (item.id === "different") {
          return (
            <li key={item.id} className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </li>
          )
        }

        const met = isPolicyItemMet(item.id, password, confirmPassword)
        const Icon = met ? CheckCircle2 : Circle

        return (
          <li
            key={item.id}
            className={met ? "flex items-center gap-2 text-primary" : "flex items-center gap-2"}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </li>
        )
      })}
    </ul>
  )
}

function isPolicyItemMet(
  id: PasswordPolicyItemId,
  password: string,
  confirmPassword: string,
): boolean {
  if (id === "length") return password.length >= MIN_PASSWORD_LENGTH
  if (id === "match") return password.length > 0 && password === confirmPassword
  return false
}
