export type ProductIdentityInput = {
  id?: string | null
  name: string
  category?: string | null
}

export type ProductIdentityAlias = {
  id: string
  aliases: Array<{
    name: string
    category?: string | null
  }>
}

export type CommercialProductFields = {
  affiliate_link?: string | null
  image_url?: string | null
  price_eur?: number | null
}

export type ExistingProduct = {
  id: string
  category: string | null
} & Required<CommercialProductFields>

export type ProductIdentityResolution = {
  product: ExistingProduct | null
  source: "id" | "alias" | "name_category" | "none"
}

export type ProductIdentityLookupDeps = {
  findProductById: (id: string) => Promise<ExistingProduct | null>
  findProductByNameCategory: (
    name: string,
    category?: string | null,
  ) => Promise<ExistingProduct | null>
}

export function productIdentityKey(name: string, category?: string | null): string {
  return `${name.trim().toLowerCase()}|${(category ?? "").trim().toLowerCase()}`
}

export function parseProductIdentityAliases(text: string): Map<string, string> {
  const aliases = JSON.parse(text) as ProductIdentityAlias[]
  const identityAliases = new Map<string, string>()

  for (const group of aliases) {
    for (const alias of group.aliases) {
      identityAliases.set(productIdentityKey(alias.name, alias.category), group.id)
    }
  }

  return identityAliases
}

function cleanCommercialString(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function mergeCommercialFields(
  existing: CommercialProductFields | null | undefined,
  incoming: CommercialProductFields,
  forceCommercialOverwrite: boolean,
): Required<CommercialProductFields> {
  const incomingAffiliateLink = cleanCommercialString(incoming.affiliate_link)
  const incomingImageUrl = cleanCommercialString(incoming.image_url)

  if (forceCommercialOverwrite) {
    return {
      affiliate_link: incomingAffiliateLink,
      image_url: incomingImageUrl,
      price_eur: incoming.price_eur ?? null,
    }
  }

  return {
    affiliate_link: incomingAffiliateLink ?? existing?.affiliate_link ?? null,
    image_url: incomingImageUrl ?? existing?.image_url ?? null,
    price_eur: incoming.price_eur ?? existing?.price_eur ?? null,
  }
}

export async function resolveProductIdentity(
  product: ProductIdentityInput,
  identityAliases: Map<string, string>,
  deps: ProductIdentityLookupDeps,
): Promise<ProductIdentityResolution> {
  if (product.id) {
    const productById = await deps.findProductById(product.id)
    if (!productById) {
      throw new Error(
        `Explicit product id ${product.id} for ${product.name} was not found. Aborting instead of falling back to name/category upsert.`,
      )
    }

    return { product: productById, source: "id" }
  }

  const aliasId = identityAliases.get(productIdentityKey(product.name, product.category))
  if (aliasId) {
    const productByAlias = await deps.findProductById(aliasId)
    if (!productByAlias) {
      throw new Error(
        `Product alias for ${product.name} resolves to missing id ${aliasId}. Aborting instead of falling back to name/category upsert.`,
      )
    }

    return { product: productByAlias, source: "alias" }
  }

  const productByNameCategory = await deps.findProductByNameCategory(product.name, product.category)
  return productByNameCategory
    ? { product: productByNameCategory, source: "name_category" }
    : { product: null, source: "none" }
}
