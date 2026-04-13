import {
  type LucideIcon,
  Waves,
  Droplets,
  Droplet,
  Zap,
  Sparkles,
  Hand,
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
  ShowerHead,
  Pipette,
  Palette,
  Shield,
  Mail,
  Lock,
  Beaker,
  Timer,
  Feather,
  Sun,
  SunDim,
  SplitSquareVertical,
  Grip,
  CloudRain,
  Scale,
  Dna,
  Ban,
  Brush,
  Wrench,
  Dumbbell,
  Minus,
  Cylinder,
  RefreshCw,
  MoveHorizontal,
  Leaf,
  Snowflake,
  Circle,
  Cloud,
  CloudMoon,
  CloudOff,
  Shirt,
  Fan,
  RectangleHorizontal,
  HeartPulse,
  Columns3,
  Unlink,
  Lasso,
  Infinity,
  Equal,
  Activity,
  Moon,
  Link2,
  SprayCan,
  Layers,
  TrendingUp,
  RotateCcw,
  Atom,
  Flower2,
  Eraser,
} from "lucide-react"

// Each key is a semantic icon name. Values are Lucide icons today,
// swappable to custom SVG components later in this single file.
const iconMap = {
  // Hair texture
  "hair-straight": Minus,
  "hair-wavy": Waves,
  "hair-curly": Lasso,
  "hair-coily": Infinity,
  // Hair thickness
  "hair-fine": Feather,
  "hair-normal": Equal,
  "hair-coarse": Cylinder,
  // Surface feel
  "surface-smooth": Sparkles,
  "surface-uneven": Activity,
  "surface-rough": Hand,
  // Elasticity
  "elastic-bounces": RefreshCw,
  "elastic-stays": MoveHorizontal,
  "elastic-snaps": Zap,
  // Chemical treatment
  "treatment-natural": Leaf,
  "treatment-colored": Pipette,
  "treatment-lightened": FlameKindling,
  // Products
  "product-shampoo": ShowerHead,
  "product-conditioner": Droplets,
  "product-oil": Pipette,
  "product-mask": Layers,
  "product-leave-in": Sparkles,
  "product-peeling": RotateCcw,
  "product-dry-shampoo": SprayCan,
  "product-bond-builder": Atom,
  "product-deep-cleansing": Eraser,
  // Heat tools
  "heat-blow-dryer": Wind,
  "heat-flat-iron": Flame,
  "heat-curling-iron": CircleDot,
  "heat-wave-iron": Waves,
  "heat-hot-air-brush": Brush,
  "heat-multi-tool": Wrench,
  "heat-diffuser": Fan,
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
  // Scalp type
  "scalp-oily": Droplet,
  "scalp-dry": SunDim,
  "scalp-normal": Scale,
  "scalp-unsure": HelpCircle,
  // Scalp conditions
  "scalp-sensitive": HeartPulse,
  "scalp-flaky": Snowflake,
  "scalp-irritated": Flame,
  "scalp-dry-flakes": CloudOff,
  // Heat tool (generic fallback)
  "heat-tool": Flame,
  // Towel material
  "towel-frottee": Waves,
  "towel-mikrofaser": Cloud,
  "towel-tshirt": Shirt,
  "towel-turban": Crown,
  // Towel technique
  "technique-rubbeln": Zap,
  "technique-tupfen": Feather,
  // Drying method
  "drying-air": Wind,
  "drying-blow": Flame,
  "drying-diffuser": Fan,
  // Brush type
  "brush-wide-tooth": Columns3,
  "brush-detangling": Unlink,
  "brush-paddle": RectangleHorizontal,
  "brush-round": CircleDot,
  "brush-boar-bristle": Flower2,
  "brush-fingers": Hand,
  "brush-none": Ban,
  // Night protection
  "night-silk-pillow": Moon,
  "night-silk-bonnet": CloudMoon,
  "night-loose-braid": Link2,
  "night-loose-bun": Circle,
  "night-pineapple": TrendingUp,
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
