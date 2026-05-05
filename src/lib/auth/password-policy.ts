export type PasswordPolicyContext = "create" | "reset"
export type PasswordPolicyItemId = "length" | "match" | "different"

export type PasswordPolicyItem = {
  id: PasswordPolicyItemId
  label: string
}

export const MIN_PASSWORD_LENGTH = 8

const BASE_POLICY_ITEMS: PasswordPolicyItem[] = [
  { id: "length", label: "Mindestens 8 Zeichen" },
  { id: "match", label: "Beide Passwörter stimmen überein" },
]

const RESET_ONLY_POLICY_ITEM: PasswordPolicyItem = {
  id: "different",
  label: "Nicht dasselbe Passwort erneut verwenden",
}

export function getPasswordPolicyItems(context: PasswordPolicyContext): PasswordPolicyItem[] {
  return context === "reset" ? [...BASE_POLICY_ITEMS, RESET_ONLY_POLICY_ITEM] : BASE_POLICY_ITEMS
}

export function validatePasswordDraft(
  password: string,
  confirmPassword: string,
): { ok: true } | { ok: false; message: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: "Passwort muss mindestens 8 Zeichen lang sein." }
  }

  if (password !== confirmPassword) {
    return { ok: false, message: "Passwörter stimmen nicht überein." }
  }

  return { ok: true }
}
