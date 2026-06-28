type ProductLineLookupClient = {
  from: (table: "product_lines") => {
    select: (columns: string) => {
      in: (column: "id", values: string[]) => PromiseLike<ProductLineLookupResult>
    }
  }
}

type ProductLineLookupResult = {
  data: Array<{ id: string; canonical_name: string | null }> | null
  error: unknown
}

type ProductLineDisplayProduct = {
  brand?: string | null
  product_line_id?: string | null
  product_line_name?: string | null
}

function trimValue(value: string | null | undefined): string {
  return value?.trim() ?? ""
}

function normalizeDisplay(value: string): string {
  return value.toLocaleLowerCase("de-DE")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function removeLineSuffixFromBrand(brand: string, line: string): string {
  const normalizedBrand = normalizeDisplay(brand)
  const normalizedLine = normalizeDisplay(line)
  if (!normalizedLine || normalizedBrand === normalizedLine) return brand
  if (!normalizedBrand.endsWith(normalizedLine)) return brand

  const prefix = brand
    .replace(new RegExp(`${escapeRegExp(line)}$`, "iu"), "")
    .replace(/[\s·|,-]+$/g, "")
    .trim()
  return prefix || brand
}

export function getProductIdentityDisplayParts(product: ProductLineDisplayProduct): string[] {
  const brand = trimValue(product.brand)
  const line = trimValue(product.product_line_name)
  if (!brand && !line) return []
  if (!brand) return [line]
  if (!line) return [brand]

  const displayBrand = removeLineSuffixFromBrand(brand, line)
  if (normalizeDisplay(displayBrand) === normalizeDisplay(line)) return [displayBrand]
  return [displayBrand, line]
}

export function getProductIdentityDisplayLabel(product: ProductLineDisplayProduct): string {
  return getProductIdentityDisplayParts(product).join(" · ")
}

function uniqueLineIds(products: ProductLineDisplayProduct[]): string[] {
  return [
    ...new Set(
      products
        .map((product) => product.product_line_id?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ]
}

export async function attachProductLineNamesToProducts<T extends ProductLineDisplayProduct>(
  products: T[],
  client: unknown,
  options: { onError?: (error: unknown) => void } = {},
): Promise<T[]> {
  const lineIds = uniqueLineIds(products)
  if (lineIds.length === 0) return products
  if (products.every((product) => !product.product_line_id || product.product_line_name)) {
    return products
  }

  let result: ProductLineLookupResult
  try {
    const productLineClient = client as ProductLineLookupClient
    result = await productLineClient
      .from("product_lines")
      .select("id, canonical_name")
      .in("id", lineIds)
  } catch (error) {
    options.onError?.(error)
    return products
  }

  if (result.error) {
    options.onError?.(result.error)
    return products
  }

  const namesById = new Map((result.data ?? []).map((line) => [line.id, line.canonical_name]))

  return products.map((product) => {
    if (!product.product_line_id || product.product_line_name) return product
    return {
      ...product,
      product_line_name: namesById.get(product.product_line_id) ?? null,
    }
  })
}
