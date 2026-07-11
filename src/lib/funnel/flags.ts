export function isFunnelAttributionEnabled() {
  return process.env.FUNNEL_ATTRIBUTION_ENABLED === "true"
}

export function isFunnelMetaCustomDataEnabled() {
  return process.env.FUNNEL_META_CUSTOM_DATA_ENABLED === "true"
}

export function isFunnelMetaBrowserCustomDataEnabled() {
  return process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED === "true"
}
