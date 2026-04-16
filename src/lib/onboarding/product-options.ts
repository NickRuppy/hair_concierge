import type { IconName } from "@/components/ui/icon"

export const BASIC_PRODUCT_OPTIONS: { value: string; label: string; icon: IconName }[] = [
  { value: "shampoo", label: "Shampoo", icon: "product-shampoo" },
  { value: "conditioner", label: "Conditioner", icon: "product-conditioner" },
  { value: "leave_in", label: "Leave-in", icon: "product-leave-in" },
  { value: "oil", label: "Öl", icon: "product-oil" },
  { value: "mask", label: "Maske", icon: "product-mask" },
]

export const EXTRA_PRODUCT_OPTIONS: { value: string; label: string; icon: IconName }[] = [
  { value: "peeling", label: "Peeling (Serum/Scrub)", icon: "product-peeling" },
  { value: "dry_shampoo", label: "Trockenshampoo", icon: "product-dry-shampoo" },
  { value: "bondbuilder", label: "Bondbuilder", icon: "product-bond-builder" },
  {
    value: "deep_cleansing_shampoo",
    label: "Tiefenreinigungsshampoo",
    icon: "product-deep-cleansing",
  },
]

export const BASIC_PRODUCT_ORDER = BASIC_PRODUCT_OPTIONS.map((option) => option.value)
export const EXTRA_PRODUCT_ORDER = EXTRA_PRODUCT_OPTIONS.map((option) => option.value)
export const PRODUCT_CATEGORY_ORDER = [...BASIC_PRODUCT_ORDER, ...EXTRA_PRODUCT_ORDER]

export const PRODUCT_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  [...BASIC_PRODUCT_OPTIONS, ...EXTRA_PRODUCT_OPTIONS].map((option) => [
    option.value,
    option.label,
  ]),
)
