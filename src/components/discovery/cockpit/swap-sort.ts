/**
 * Verdict-layer T2 (R19): the cockpit's swap / „Neu" options re-sorted by price.
 *
 * Display only. The price never reaches a verdict, a ranking or a bucket — the parser reads
 * the label the catalog already formatted (`presentCatalogCommerce` / the comparison's
 * `presentation.priceLabel`), and the sorter only reorders the list the engine delivered.
 * „Fit" is that delivered order, unchanged.
 */

export type DiscoverySwapSort = "fit" | "price"

const NUMBER_TOKEN = /\d[\d.,]*/g
const GERMAN_THOUSANDS = /^\d{1,3}(\.\d{3})+$/
const PLAIN_NUMBER = /^\d+(\.\d+)?$/

/**
 * „5,45 €" → 5.45. A label with no number or more than one („5,45 € – 7,90 €",
 * „24,90 € / 100 ml") is no price: null, never a guess.
 */
export function parseDiscoveryPriceLabel(label: string | null | undefined): number | null {
  if (typeof label !== "string") return null
  const tokens = label.match(NUMBER_TOKEN)
  if (!tokens || tokens.length !== 1) return null
  const token = tokens[0]!
  let normalized: string
  if (token.includes(",")) {
    // German: dots group thousands, the one comma is the decimal separator.
    const [whole, fraction, ...rest] = token.split(",")
    if (rest.length > 0 || !fraction || !/^\d+$/.test(fraction)) return null
    if (!/^\d+$/.test(whole!) && !GERMAN_THOUSANDS.test(whole!)) return null
    normalized = `${whole!.replaceAll(".", "")}.${fraction}`
  } else if (GERMAN_THOUSANDS.test(token)) {
    normalized = token.replaceAll(".", "")
  } else {
    normalized = token
  }
  if (!PLAIN_NUMBER.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/**
 * „Preis": ascending by parsed price; ties and options without a readable price keep the
 * delivered order, the priceless ones at the end. Always a new array.
 */
export function sortDiscoverySwapOptions<T extends { priceLabel?: string | null }>(
  options: readonly T[],
  sort: DiscoverySwapSort,
): T[] {
  if (sort === "fit") return [...options]
  return options
    .map((option, index) => ({ option, index, price: parseDiscoveryPriceLabel(option.priceLabel) }))
    .sort((left, right) => {
      if (left.price !== null && right.price !== null && left.price !== right.price)
        return left.price - right.price
      if (left.price === null && right.price !== null) return 1
      if (left.price !== null && right.price === null) return -1
      return left.index - right.index
    })
    .map((entry) => entry.option)
}
