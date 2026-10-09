import { ProductIntakeUserInputError } from "@/lib/product-intake/errors"

export function assertTemporaryUploadPathBelongsToUser(
  path: string | null | undefined,
  userId: string,
) {
  if (!path) return
  const normalized = path.trim()
  if (normalized.startsWith(`tmp/${userId}/`) && !normalized.includes("..")) {
    return
  }

  if (normalized.startsWith(`${userId}/`)) {
    throw new ProductIntakeUserInputError(
      "Bitte verwende den temporären Upload-Pfad aus dem aktuellen Upload.",
      { code: "product_intake_stale_upload_path" },
    )
  }

  throw new ProductIntakeUserInputError("Bildpfad gehört nicht zu diesem Nutzer.", {
    code: "product_intake_upload_owner_mismatch",
  })
}
