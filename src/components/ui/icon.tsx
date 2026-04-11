import {
  type LucideIcon,
  Waves,
  Droplets,
  Zap,
  Target,
  Ruler,
  Sparkles,
  Mountain,
  Hand,
  Dumbbell,
  CircleDot,
  Wind,
  FlameKindling,
  Diamond,
  Crown,
  Clock,
  Check,
  ArrowRight,
  User,
  HelpCircle,
  Star,
  ClipboardList,
  Flame,
  Scissors,
  ShowerHead,
  Pipette,
  Palette,
  ThermometerSun,
  Shield,
  Mail,
  Lock,
  Beaker,
  Timer,
  Feather,
  Sun,
  SplitSquareVertical,
  Grip,
  CloudRain,
  MoveRight,
  Fingerprint,
  Scale,
  Dna,
  Ban,
  Brush,
  Wrench,
} from "lucide-react"

// Each key is a semantic icon name. Values are Lucide icons today,
// swappable to custom SVG components later in this single file.
const iconMap = {
  // Hair texture
  "hair-straight": MoveRight,
  "hair-wavy": Waves,
  "hair-curly": CircleDot,
  "hair-coily": Fingerprint,
  // Hair thickness
  "hair-fine": Feather,
  "hair-normal": Hand,
  "hair-coarse": Dumbbell,
  // Surface feel
  "surface-smooth": Sparkles,
  "surface-uneven": Palette,
  "surface-rough": Mountain,
  // Elasticity
  "elastic-bounces": Target,
  "elastic-stays": Ruler,
  "elastic-snaps": Zap,
  // Chemical treatment
  "treatment-natural": Sparkles,
  "treatment-colored": Pipette,
  "treatment-lightened": FlameKindling,
  // Products
  "product-shampoo": ShowerHead,
  "product-conditioner": Droplets,
  "product-oil": Pipette,
  "product-mask": FlameKindling,
  "product-leave-in": Sparkles,
  "product-peeling": Scissors,
  "product-dry-shampoo": Wind,
  "product-bond-builder": Shield,
  "product-deep-cleansing": ShowerHead,
  // Heat tools
  "heat-blow-dryer": Wind,
  "heat-flat-iron": Flame,
  "heat-curling-iron": CircleDot,
  "heat-wave-iron": Waves,
  "heat-hot-air-brush": Brush,
  "heat-multi-tool": Wrench,
  "heat-diffuser": Sparkles,
  "heat-protection-yes": Shield,
  "heat-protection-no": Ban,
  // Result cards
  "result-dna": Dna,
  "result-clipboard": ClipboardList,
  "result-microscope": Beaker,
  "result-balance": Scale,
  "result-scalp": Droplets,
  // Badges
  "badge-star": Star,
  "badge-clipboard": ClipboardList,
  "badge-flame": Flame,
  "badge-diamond": Diamond,
  "badge-crown": Crown,
  // UI
  check: Check,
  "arrow-right": ArrowRight,
  user: User,
  help: HelpCircle,
  clock: Clock,
  mail: Mail,
  lock: Lock,
  // Scalp
  "scalp-oily": Droplets,
  "scalp-dry": Mountain,
  "scalp-normal": ThermometerSun,
  "scalp-unsure": HelpCircle,
  // Scalp conditions
  "scalp-sensitive": ThermometerSun,
  "scalp-flaky": Mountain,
  "scalp-irritated": Flame,
  // Heat tool (generic fallback)
  "heat-tool": ThermometerSun,
  // Towel material
  "towel-frottee": Waves,
  "towel-mikrofaser": Sparkles,
  "towel-tshirt": Hand,
  "towel-turban": Crown,
  // Towel technique
  "technique-rubbeln": Dumbbell,
  "technique-tupfen": Hand,
  // Drying method
  "drying-air": Wind,
  "drying-blow": Flame,
  "drying-diffuser": CircleDot,
  // Brush type
  "brush-wide-tooth": Ruler,
  "brush-detangling": Shield,
  "brush-paddle": Hand,
  "brush-round": CircleDot,
  "brush-boar-bristle": Brush,
  "brush-fingers": Hand,
  "brush-none": Ban,
  // Night protection
  "night-silk-pillow": Star,
  "night-silk-bonnet": Crown,
  "night-loose-braid": Waves,
  "night-loose-bun": Sparkles,
  "night-pineapple": FlameKindling,
  // Goals
  "goal-moisture": Droplets,
  "goal-shine": Sun,
  "goal-volume": Wind,
  "goal-repair": Wrench,
  "goal-definition": Grip,
  "goal-frizz": CloudRain,
  "goal-growth": Dna,
  "goal-split-ends": SplitSquareVertical,
  "goal-color-protection": Palette,
  "goal-scalp-health": Shield,
  "goal-smoothness": Feather,
  "goal-strength": Dumbbell,
  "goal-time-saving": Timer,
  "goal-less-washing": Timer,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof iconMap

interface IconProps {
  name: IconName
  className?: string
  size?: number
  "aria-label"?: string
}

export function Icon({ name, className, size = 20, "aria-label": ariaLabel }: IconProps) {
  const LucideComponent = iconMap[name]
  if (!LucideComponent) return null
  return (
    <LucideComponent
      className={className}
      size={size}
      strokeWidth={1.5}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
    />
  )
}
