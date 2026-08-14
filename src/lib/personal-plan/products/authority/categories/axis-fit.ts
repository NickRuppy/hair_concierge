export type AxisFitResult = "pass" | "caution" | "fail"

export function orderedAxisFitResult<T extends string>(
  product: T,
  target: T,
  values: readonly T[],
): AxisFitResult {
  if (product === target) return "pass"
  const distance = Math.abs(values.indexOf(product) - values.indexOf(target))
  return distance === 1 ? "caution" : "fail"
}

export function careDirectionAxisFitResult(product: string, target: string): AxisFitResult {
  if (product === target) return "pass"
  return product === "balanced" || target === "balanced" ? "caution" : "fail"
}

export function repairSupportAxisFitResult<T extends string>(
  product: T,
  target: T,
  values: readonly T[],
): AxisFitResult {
  if (product === target) return "pass"
  const productIndex = values.indexOf(product)
  const targetIndex = values.indexOf(target)
  if (productIndex < 0 || targetIndex < 0) return "fail"
  if (productIndex > targetIndex) return "caution"
  return targetIndex - productIndex === 1 ? "caution" : "fail"
}
