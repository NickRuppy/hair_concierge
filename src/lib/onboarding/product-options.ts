import type { IconName } from "@/components/ui/icon"
import type { InfoTipId } from "@/lib/help/info-tips"

export interface ProductCategoryOption {
  value: string
  label: string
  icon: IconName
  infoTipId: InfoTipId
  drilldownTitle: string
}

export const BASIC_PRODUCT_OPTIONS: ProductCategoryOption[] = [
  {
    value: "shampoo",
    label: "Shampoo",
    icon: "product-shampoo",
    infoTipId: "product.shampoo",
    drilldownTitle: "Dein Shampoo",
  },
  {
    value: "conditioner",
    label: "Conditioner",
    icon: "product-conditioner",
    infoTipId: "product.conditioner",
    drilldownTitle: "Dein Conditioner",
  },
  {
    value: "leave_in",
    label: "Leave-in",
    icon: "product-leave-in",
    infoTipId: "product.leave_in",
    drilldownTitle: "Dein Leave-in",
  },
  {
    value: "oil",
    label: "Haaröl",
    icon: "product-oil",
    infoTipId: "product.hair_oil",
    drilldownTitle: "Dein Haaröl",
  },
  {
    value: "mask",
    label: "Haarmaske",
    icon: "product-mask",
    infoTipId: "product.mask",
    drilldownTitle: "Deine Haarmaske",
  },
]

export const EXTRA_PRODUCT_OPTIONS: ProductCategoryOption[] = [
  {
    value: "peeling",
    label: "Kopfhautpeeling",
    icon: "product-peeling",
    infoTipId: "product.scalp_peeling",
    drilldownTitle: "Dein Kopfhautpeeling",
  },
  {
    value: "dry_shampoo",
    label: "Trockenshampoo",
    icon: "product-dry-shampoo",
    infoTipId: "product.dry_shampoo",
    drilldownTitle: "Dein Trockenshampoo",
  },
  {
    value: "bondbuilder",
    label: "Bondbuilder",
    icon: "product-bond-builder",
    infoTipId: "product.bond_builder",
    drilldownTitle: "Dein Bondbuilder",
  },
  {
    value: "deep_cleansing_shampoo",
    label: "Tiefenreinigungsshampoo",
    icon: "product-deep-cleansing",
    infoTipId: "product.deep_cleansing_shampoo",
    drilldownTitle: "Dein Tiefenreinigungsshampoo",
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

export const PRODUCT_CATEGORY_DRILLDOWN_TITLES: Record<string, string> = Object.fromEntries(
  [...BASIC_PRODUCT_OPTIONS, ...EXTRA_PRODUCT_OPTIONS].map((option) => [
    option.value,
    option.drilldownTitle,
  ]),
)
