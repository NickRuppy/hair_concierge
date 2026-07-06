type ProductIntakeEnv = Partial<
  Pick<NodeJS.ProcessEnv, "NODE_ENV" | "PRODUCT_INTAKE_ENABLED" | "VERCEL_ENV">
>

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])
const FALSE_VALUES = new Set(["0", "false", "no", "off"])

export function isProductIntakeEnabled(env: ProductIntakeEnv = process.env): boolean {
  const explicit = env.PRODUCT_INTAKE_ENABLED?.trim().toLowerCase()

  if (explicit) {
    if (TRUE_VALUES.has(explicit)) return true
    if (FALSE_VALUES.has(explicit)) return false
  }

  const deploymentEnv = env.VERCEL_ENV ?? env.NODE_ENV
  return deploymentEnv !== "production"
}
