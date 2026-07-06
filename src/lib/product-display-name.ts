const LEGACY_DUPLICATE_SUFFIX_PATTERN = /\s*\(legacy duplicate\)\s*$/i

type ProductDisplayNameOptions = {
  brandName?: string | null
  productLineName?: string | null
}

export function getProductDisplayName(
  name: string,
  options: ProductDisplayNameOptions = {},
): string {
  const trimmedName = name.trim()
  const displayName = stripVisibleIdentityPrefix(
    trimmedName.replace(LEGACY_DUPLICATE_SUFFIX_PATTERN, "").trim(),
    [options.brandName, options.productLineName],
  )

  return displayName || trimmedName
}

function stripVisibleIdentityPrefix(name: string, identityParts: Array<string | null | undefined>) {
  const parts = identityParts.map((part) => part?.trim()).filter((part): part is string => Boolean(part))
  if (parts.length === 0) return name

  const combinedPrefix = parts.join(" ")
  const combinedResult = stripPrefix(name, combinedPrefix)
  if (combinedResult !== name) return combinedResult

  let result = name
  for (const part of parts) {
    result = stripPrefix(result, part)
  }
  return result
}

function stripPrefix(name: string, prefix: string) {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return name.replace(new RegExp(`^\\s*${escapedPrefix}(?:\\s*[·:–—-]\\s*|\\s+)`, "i"), "").trim()
}
