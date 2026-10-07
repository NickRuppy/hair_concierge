type ProductIdentityTitleInput = {
  brand?: string | null
  productLine?: string | null
  name?: string | null
}

function normalized(value: string) {
  return value.toLocaleLowerCase("de")
}

function appendDistinct(parts: string[], value: string | null | undefined) {
  const text = value?.trim()
  if (!text) return

  const candidate = normalized(text)
  if (
    parts.some((part) => {
      const existing = normalized(part)
      return existing === candidate || existing.includes(candidate)
    })
  )
    return

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (candidate.includes(normalized(parts[index]))) parts.splice(index, 1)
  }
  parts.push(text)
}

/** Render-ready identity title shared by routine and mobile product surfaces. */
export function composeProductIdentityTitle(input: ProductIdentityTitleInput): string {
  const parts: string[] = []
  appendDistinct(parts, input.brand)
  appendDistinct(parts, input.productLine)
  appendDistinct(parts, input.name)
  return parts.join(" ").trim()
}
