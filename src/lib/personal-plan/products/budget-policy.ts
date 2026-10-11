import type { DiagnosticConcern } from "@/lib/quiz/diagnostic-input"

// Applies a saved per-package price budget on top of an existing fit ranking. Inputs are already in
// fit order (best first); this module never re-ranks by fit. Pure and deterministic.

export type BudgetPreference =
  | { kind: "capped"; limitEur: 5 | 15; allowExceptions: boolean }
  | { kind: "uncapped" }

export type BudgetCandidate = {
  productId: string
  priceEur: number | null
  verdict: "ideal" | "supportive"
  cautionCount: number
  /** Distance to the user's target per graded comparison dimension; a missing key is unknown. */
  needDistances: Record<string, number>
  /**
   * Optional trust rank (lower is better, e.g. the Bondbuilder claim trust level). When both sides
   * carry one, a swap or exception never trades a more trusted product for a less trusted one.
   */
  trustRank?: number
}

export type BudgetRoleInput = {
  roleKey: string
  ranked: BudgetCandidate[]
  required: boolean
  /**
   * No new purchase for this role: the user keeps an owned product or deliberately leaves the
   * role uncovered. It never counts in N, never takes an exception and has no default.
   */
  ownedKept: boolean
  preserved: { productId: string; explicit: boolean } | null
  /**
   * `trust_pair` (Bondbuilder, Nick 2026-10-09): under a cap the list shows the best affordable
   * product in ranked order next to the best product overall (over budget, labelled), then the
   * rest in ranked order. The default is the best affordable product; trust never earns an
   * improvement exception. Omitted means `default`.
   */
  displayMode?: "default" | "trust_pair"
}

export type BudgetPortfolioInput = {
  budget: BudgetPreference
  roles: BudgetRoleInput[]
  mainConcernDimensions: ReadonlySet<string>
  displayLimit: number
}

export type BudgetCandidateView = {
  productId: string
  overBudget: boolean
  label: "within_budget" | "recommended" | "alternative" | "neutral"
}

export type BudgetNotice =
  | "strict_none_affordable"
  | "strict_one_affordable"
  | "flex_improvement"
  | "flex_gap"
  | "allowance_used_elsewhere"

export type BudgetRoleAllocation = {
  roleKey: string
  candidates: BudgetCandidateView[]
  defaultProductId: string | null
  exception: { kind: "gap" | "improvement"; improvedDimensionIds: string[] } | null
  notice: BudgetNotice | null
}

export type CappedBudgetSummary = {
  newPurchaseCount: number
  allowance: number
  gapCount: number
  exceptionsUsed: number
  highPriceTarget?: never
  highPriceCount?: never
}

export type UncappedBudgetSummary = {
  newPurchaseCount: number
  highPriceTarget: number
  highPriceCount: number
  allowance?: never
  gapCount?: never
  exceptionsUsed?: never
}

export type BudgetPortfolioResult = {
  roles: BudgetRoleAllocation[]
  summary: CappedBudgetSummary | UncappedBudgetSummary
}

/** Graded comparison dimensions that express a user target (distance 0 = on target). */
export const BUDGET_NEED_DIMENSIONS: ReadonlySet<string> = new Set([
  "conditioner.weight",
  "conditioner.repair_support",
  "mask.weight",
  "mask.repair_support",
  "leave_in.weight",
  "leave_in.repair_support",
  "oil.weight",
])

const WEIGHT_DIMENSIONS = ["conditioner.weight", "mask.weight", "leave_in.weight", "oil.weight"]
const REPAIR_DIMENSIONS = [
  "conditioner.repair_support",
  "mask.repair_support",
  "leave_in.repair_support",
]

/**
 * Reviewed product mapping from a stated main concern to the need dimensions that earn price
 * priority (needs hair-care review before launch). Deliberately conservative: care direction and
 * frizz/shine/detangling/shape are not graded per product in the authorities or rest on weak
 * evidence; split ends cannot be repaired cosmetically; hair loss is medically adjacent. Unmapped
 * dimensions simply give no priority.
 */
export const CONCERN_DIMENSIONS: Readonly<Record<DiagnosticConcern, readonly string[]>> = {
  dry_lengths: [],
  frizz_flyaways: [],
  low_shine: [],
  lost_shape: [],
  low_volume_or_weighed_down: WEIGHT_DIMENSIONS,
  hair_damage: REPAIR_DIMENSIONS,
  hair_loss_or_thinning: [],
  breakage: REPAIR_DIMENSIONS,
  split_ends: [],
  tangling: [],
}

const HIGH_PRICE_EUR = 15

/* ---------------------------------------------------------------- shared helpers */

function priceOf(candidate: BudgetCandidate): number | null {
  const price = candidate.priceEur
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null
}

const isPriced = (candidate: BudgetCandidate) => priceOf(candidate) !== null

function byAscendingPrice(candidates: BudgetCandidate[]): BudgetCandidate[] {
  return [...candidates].sort((a, b) => priceOf(a)! - priceOf(b)!)
}

const cents = (price: number) => Math.round(price * 100)

const verdictRank = (candidate: BudgetCandidate) => (candidate.verdict === "ideal" ? 0 : 1)

function needDistance(candidate: BudgetCandidate, dimensionId: string): number | undefined {
  const distance = candidate.needDistances[dimensionId]
  return typeof distance === "number" && Number.isFinite(distance) ? distance : undefined
}

/** Need dimensions graded for both candidates; a missing side carries no information. */
function sharedNeedDimensions(a: BudgetCandidate, b: BudgetCandidate): string[] {
  return Object.keys(a.needDistances).filter(
    (id) =>
      BUDGET_NEED_DIMENSIONS.has(id) &&
      needDistance(a, id) !== undefined &&
      needDistance(b, id) !== undefined,
  )
}

/** Y is at least as good as D on verdict, trust (when both are ranked), compromises and distance
 *  to target on every need. */
function fitComparable(y: BudgetCandidate, d: BudgetCandidate): boolean {
  return (
    verdictRank(y) <= verdictRank(d) &&
    (y.trustRank === undefined || d.trustRank === undefined || y.trustRank <= d.trustRank) &&
    y.cautionCount <= d.cautionCount &&
    sharedNeedDimensions(y, d).every((id) => needDistance(y, id)! <= needDistance(d, id)!)
  )
}

/** Strictly closer need dimensions (in X's key order), or null when X does not improve on B. */
function improvedDimensions(x: BudgetCandidate, baseline: BudgetCandidate): string[] | null {
  if (!fitComparable(x, baseline)) return null
  const improved = sharedNeedDimensions(x, baseline).filter(
    (id) => needDistance(x, id)! < needDistance(baseline, id)!,
  )
  return improved.length > 0 ? improved : null
}

function allowanceFor(newPurchaseCount: number): number {
  return newPurchaseCount === 0 ? 0 : Math.max(1, Math.floor(0.25 * newPurchaseCount))
}

function uniqueCount(ids: (string | null)[]): number {
  return new Set(ids.filter((id): id is string => id !== null)).size
}

function cappedView(
  candidate: BudgetCandidate,
  limitEur: number,
  label?: BudgetCandidateView["label"],
): BudgetCandidateView {
  const price = priceOf(candidate)
  const overBudget = price !== null && price > limitEur
  const affordable = price !== null && !overBudget
  return {
    productId: candidate.productId,
    overBudget,
    label: label ?? (affordable ? "within_budget" : "alternative"),
  }
}

function neutralView(candidate: BudgetCandidate): BudgetCandidateView {
  return { productId: candidate.productId, overBudget: false, label: "neutral" }
}

function withPreserved(
  views: BudgetCandidateView[],
  preservedView: BudgetCandidateView | null,
  limit: number,
): BudgetCandidateView[] {
  if (!preservedView || views.some((view) => view.productId === preservedView.productId)) {
    return views
  }
  return [preservedView, ...views].slice(0, limit)
}

function findPreserved(role: BudgetRoleInput): BudgetCandidate | null {
  const preserved = role.preserved
  if (!preserved) return null
  return role.ranked.find((candidate) => candidate.productId === preserved.productId) ?? null
}

/* ---------------------------------------------------------------- standalone */

export function orderStandaloneAlternatives(
  ranked: BudgetCandidate[],
  budget: BudgetPreference,
  limit: number,
): BudgetCandidateView[] {
  if (budget.kind === "uncapped") return ranked.slice(0, limit).map(neutralView)
  const priced = ranked.filter(isPriced)
  const affordable = priced.filter((candidate) => priceOf(candidate)! <= budget.limitEur)
  const over = priced.filter((candidate) => priceOf(candidate)! > budget.limitEur)
  return [...affordable, ...over].slice(0, limit).map((c) => cappedView(c, budget.limitEur))
}

/**
 * The trust pair under a cap: the best affordable product (ranked order), the best priced product
 * overall when it differs (over budget), then every other priced product in ranked order. Without
 * an affordable product the priced list keeps its ranked order. Unpriced products never show.
 */
/**
 * Under a cap, equally trusted products of the same verdict are ordered cheaper first (Nick,
 * 2026-10-09: Olaplex and K18 share the top trust level, so a budget shows Olaplex); unpriced ones
 * close their run. Only consecutive runs move, so verdict and trust order stay intact. Without a
 * cap the ranked order (K18 house default) is kept.
 */
function trustTiesByPrice(ranked: BudgetCandidate[]): BudgetCandidate[] {
  const result: BudgetCandidate[] = []
  let run: BudgetCandidate[] = []
  const flush = () => {
    result.push(
      ...run
        .map((candidate, index) => ({ candidate, index }))
        .sort(
          (left, right) =>
            (priceOf(left.candidate) ?? Infinity) - (priceOf(right.candidate) ?? Infinity) ||
            left.index - right.index,
        )
        .map(({ candidate }) => candidate),
    )
    run = []
  }
  for (const candidate of ranked) {
    const head = run[0]
    if (
      head &&
      (candidate.trustRank === undefined ||
        candidate.trustRank !== head.trustRank ||
        candidate.verdict !== head.verdict)
    ) {
      flush()
    }
    run.push(candidate)
  }
  flush()
  return result
}

function trustPairOrder(ranked: BudgetCandidate[], limitEur: number): BudgetCandidate[] {
  const priced = trustTiesByPrice(ranked).filter(isPriced)
  const bestAffordable = priced.find((candidate) => priceOf(candidate)! <= limitEur)
  const bestOverall = priced[0]
  if (!bestAffordable || !bestOverall) return priced
  const lead = bestOverall === bestAffordable ? [bestAffordable] : [bestAffordable, bestOverall]
  return [...lead, ...priced.filter((candidate) => !lead.includes(candidate))]
}

/** Standalone (chat) form of the trust pair; uncapped budgets keep the ranked order. */
export function orderTrustPairAlternatives(
  ranked: BudgetCandidate[],
  budget: BudgetPreference,
  limit: number,
): BudgetCandidateView[] {
  if (budget.kind === "uncapped") return ranked.slice(0, limit).map(neutralView)
  return trustPairOrder(ranked, budget.limitEur)
    .slice(0, limit)
    .map((candidate) => cappedView(candidate, budget.limitEur))
}

const isTrustPair = (role: BudgetRoleInput) => role.displayMode === "trust_pair"

/* ---------------------------------------------------------------- capped */

type Improvement = {
  candidate: BudgetCandidate
  improvedDimensionIds: string[]
  mainConcern: boolean
  extraCostCents: number
}

type CappedRole = {
  input: BudgetRoleInput
  index: number
  kind: "owned" | "preserved" | "gap" | "plain"
  affordable: BudgetCandidate[]
  over: BudgetCandidate[]
  preserved: BudgetCandidate | null
  baseDefault: string | null
  improvement: Improvement | null
}

function classifyCappedRole(
  input: BudgetRoleInput,
  index: number,
  limitEur: number,
  flexible: boolean,
  mainConcernDimensions: ReadonlySet<string>,
): CappedRole {
  const priced = input.ranked.filter(isPriced)
  const affordable = priced.filter((candidate) => priceOf(candidate)! <= limitEur)
  const over = priced.filter((candidate) => priceOf(candidate)! > limitEur)
  const base = { input, index, affordable, over, improvement: null }

  if (input.ownedKept) {
    return { ...base, kind: "owned", preserved: null, baseDefault: null }
  }
  const preserved = findPreserved(input)
  if (preserved) {
    return { ...base, kind: "preserved", preserved, baseDefault: preserved.productId }
  }
  if (flexible && input.required && affordable.length === 0 && over.length > 0) {
    return { ...base, kind: "gap", preserved: null, baseDefault: over[0]!.productId }
  }

  const baseline = affordable[0] ?? null
  let improvement: Improvement | null = null
  if (flexible && baseline && !isTrustPair(input)) {
    for (const candidate of over) {
      const improvedDimensionIds = improvedDimensions(candidate, baseline)
      if (!improvedDimensionIds) continue
      improvement = {
        candidate,
        improvedDimensionIds,
        mainConcern: improvedDimensionIds.some((id) => mainConcernDimensions.has(id)),
        extraCostCents: cents(priceOf(candidate)!) - cents(priceOf(baseline)!),
      }
      break
    }
  }
  return {
    ...base,
    kind: "plain",
    preserved: null,
    baseDefault: baseline?.productId ?? null,
    improvement,
  }
}

function plainDisplay(role: CappedRole, limitEur: number, limit: number): BudgetCandidateView[] {
  const ordered = isTrustPair(role.input)
    ? trustPairOrder(role.input.ranked, limitEur)
    : role.affordable.length >= 2
      ? role.affordable
      : [...role.affordable, ...byAscendingPrice(role.over)]
  return ordered.slice(0, limit).map((candidate) => cappedView(candidate, limitEur))
}

function strictNotice(role: CappedRole): BudgetNotice | null {
  if (role.affordable.length === 0 && role.over.length > 0) return "strict_none_affordable"
  if (role.affordable.length === 1) return "strict_one_affordable"
  return null
}

function compareImprovements(a: CappedRole, b: CappedRole): number {
  const x = a.improvement!
  const y = b.improvement!
  if (x.mainConcern !== y.mainConcern) return x.mainConcern ? -1 : 1
  if (x.extraCostCents !== y.extraCostCents) return x.extraCostCents - y.extraCostCents
  return a.index - b.index
}

function allocateCapped(
  input: BudgetPortfolioInput,
  budget: Extract<BudgetPreference, { kind: "capped" }>,
): BudgetPortfolioResult {
  const { limitEur, allowExceptions: flexible } = budget
  const limit = input.displayLimit
  const roles = input.roles.map((role, index) =>
    classifyCappedRole(
      isTrustPair(role) ? { ...role, ranked: trustTiesByPrice(role.ranked) } : role,
      index,
      limitEur,
      flexible,
      input.mainConcernDimensions,
    ),
  )

  const gapCount = roles.filter((role) => role.kind === "gap").length
  const manualOver = roles.filter((role) => {
    if (role.kind !== "preserved" || !role.input.preserved?.explicit) return false
    const price = priceOf(role.preserved!)
    return price !== null && price > limitEur
  }).length

  const defaultsWith = (granted: CappedRole[]) =>
    roles.map((role) =>
      granted.includes(role) ? role.improvement!.candidate.productId : role.baseDefault,
    )

  const contenders = flexible
    ? roles.filter((role) => role.improvement !== null).sort(compareImprovements)
    : []
  const initialSlots = Math.max(
    0,
    allowanceFor(uniqueCount(defaultsWith([]))) - gapCount - manualOver,
  )
  let granted = contenders.slice(0, initialSlots)
  // Granting can change N (shared or duplicate products); revoke lowest priority until valid.
  while (granted.length > 0) {
    const allowance = allowanceFor(uniqueCount(defaultsWith(granted)))
    if (granted.length <= Math.max(0, allowance - gapCount - manualOver)) break
    granted = granted.slice(0, -1)
  }

  const allocations = roles.map((role): BudgetRoleAllocation => {
    const roleKey = role.input.roleKey
    if (role.kind === "owned") {
      return {
        roleKey,
        candidates: (isTrustPair(role.input)
          ? orderTrustPairAlternatives
          : orderStandaloneAlternatives)(role.input.ranked, budget, limit),
        defaultProductId: null,
        exception: null,
        notice: null,
      }
    }
    if (role.kind === "gap") {
      const [first, ...rest] = role.over
      return {
        roleKey,
        candidates: [first!, ...(isTrustPair(role.input) ? rest : byAscendingPrice(rest))]
          .slice(0, limit)
          .map((candidate, i) =>
            cappedView(candidate, limitEur, i === 0 ? "recommended" : "alternative"),
          ),
        defaultProductId: first!.productId,
        exception: { kind: "gap", improvedDimensionIds: [] },
        notice: "flex_gap",
      }
    }
    if (role.improvement && granted.includes(role)) {
      const chosen = role.improvement.candidate
      const others = byAscendingPrice(role.over.filter((candidate) => candidate !== chosen))
      return {
        roleKey,
        candidates: [
          cappedView(chosen, limitEur, "recommended"),
          ...[...role.affordable, ...others].map((candidate) => cappedView(candidate, limitEur)),
        ].slice(0, limit),
        defaultProductId: chosen.productId,
        exception: {
          kind: "improvement",
          improvedDimensionIds: role.improvement.improvedDimensionIds,
        },
        notice: "flex_improvement",
      }
    }

    const preservedView = role.preserved ? cappedView(role.preserved, limitEur) : null
    let notice: BudgetNotice | null = null
    if (!flexible) notice = strictNotice(role)
    else if (role.improvement) notice = "allowance_used_elsewhere"
    return {
      roleKey,
      candidates: withPreserved(plainDisplay(role, limitEur, limit), preservedView, limit),
      defaultProductId: role.baseDefault,
      exception: null,
      notice,
    }
  })

  const newPurchaseCount = uniqueCount(allocations.map((role) => role.defaultProductId))
  return {
    roles: allocations,
    summary: {
      newPurchaseCount,
      allowance: flexible ? allowanceFor(newPurchaseCount) : 0,
      gapCount,
      exceptionsUsed: gapCount + granted.length,
    },
  }
}

/* ---------------------------------------------------------------- uncapped */

function allocateUncapped(input: BudgetPortfolioInput): BudgetPortfolioResult {
  const limit = input.displayLimit
  const roles = input.roles.map((role) => {
    const preserved = role.ownedKept ? null : findPreserved(role)
    // A trust-pair role starts from its most trusted product even when it is unpriced: price
    // must not lift a less trusted product into the default (Nick, 2026-10-09).
    const initial = role.ownedKept
      ? null
      : (preserved ??
        (isTrustPair(role) ? undefined : role.ranked.find(isPriced)) ??
        role.ranked[0] ??
        null)
    return { input: role, preserved, current: initial }
  })

  const isHigh = (candidate: BudgetCandidate | null) => {
    const price = candidate ? priceOf(candidate) : null
    return price !== null && price > HIGH_PRICE_EUR
  }
  const newPurchaseCount = () => uniqueCount(roles.map((role) => role.current?.productId ?? null))
  const highPriceCount = () =>
    uniqueCount(roles.map((role) => (isHigh(role.current) ? role.current!.productId : null)))

  // Nudge toward round(0.6 N) defaults above 15 €, only via fit-comparable swaps, in role order.
  // A swap can merge two roles onto one product and so change the distinct N; the target and the
  // direction are therefore recomputed from the current purchase set before every step. One pass
  // over the roles bounds the work.
  const targetFor = () => Math.round(0.6 * newPurchaseCount())
  for (const role of roles) {
    const target = targetFor()
    if (highPriceCount() === target) break
    const raise = highPriceCount() < target
    const current = role.current
    if (!current || role.preserved || !isPriced(current) || isHigh(current) === raise) continue
    const swap = role.input.ranked.find(
      (candidate) =>
        isPriced(candidate) && isHigh(candidate) === raise && fitComparable(candidate, current),
    )
    if (swap) role.current = swap
  }

  const allocations = roles.map(({ input: role, current }): BudgetRoleAllocation => {
    const candidates = role.ownedKept
      ? orderStandaloneAlternatives(role.ranked, input.budget, limit)
      : (current ? [current, ...role.ranked.filter((candidate) => candidate !== current)] : [])
          .slice(0, limit)
          .map(neutralView)
    return {
      roleKey: role.roleKey,
      candidates,
      defaultProductId: current?.productId ?? null,
      exception: null,
      notice: null,
    }
  })

  return {
    roles: allocations,
    summary: {
      newPurchaseCount: newPurchaseCount(),
      highPriceTarget: targetFor(),
      highPriceCount: highPriceCount(),
    },
  }
}

export function allocateBudgetPortfolio(input: BudgetPortfolioInput): BudgetPortfolioResult {
  return input.budget.kind === "capped"
    ? allocateCapped(input, input.budget)
    : allocateUncapped(input)
}

/* ---------------------------------------------------------------- inference */

export function inferBudgetSuggestion(
  items: {
    productId: string | null
    category: string | null
    priceEur: number | null
    tool?: boolean
  }[],
): 5 | 15 | null {
  const seen = new Set<string>()
  const distinct = items.filter((item) => {
    if (item.tool) return false
    if (item.productId === null) return true
    if (seen.has(item.productId)) return false
    seen.add(item.productId)
    return true
  })
  const prices: number[] = []
  const categories = new Set<string>()
  for (const item of distinct) {
    const price = item.priceEur
    if (!item.productId || !item.category) continue
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue
    prices.push(price)
    categories.add(item.category)
  }

  if (prices.length < 3 || categories.size < 2) return null
  if (prices.length / distinct.length < 0.8) return null
  if (prices.some((price) => price > 15)) return null
  const share = (inBand: (price: number) => boolean) => prices.filter(inBand).length / prices.length
  if (share((price) => price <= 5) >= 0.8) return 5
  if (share((price) => price > 5 && price <= 15) >= 0.8) return 15
  return null
}
