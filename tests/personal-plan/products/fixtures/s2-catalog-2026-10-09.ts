/**
 * Frozen copy of the live S2 catalogue (prod SELECT, 2026-10-09/11): the active, recommended dry
 * shampoos, deep cleansers and scalp-care products with the facts Stage 3 reads. Protocols are
 * treated as verified role protocols for every product. `targetScalpTypes` is null everywhere
 * (S2b backfills it); tests that need a projection set it explicitly.
 */
import { CATEGORY_ROLE_POLICIES } from "../../../../src/lib/personal-plan/products/authorities"
import type {
  Stage3AuthorityInput,
  Stage3DeepCleansingFacts,
  Stage3DryShampooFacts,
  Stage3ScalpCareFacts,
} from "../../../../src/lib/personal-plan/products/authority/contracts"
import {
  UNKNOWN_SELECTION_PROFILE,
  type Stage3SelectionProfile,
} from "../../../../src/lib/personal-plan/products/authority/selection-profile"
import type { PlanProductRole } from "../../../../src/lib/personal-plan/types"

type CommonOverrides = {
  productId: string
  displayName: string
  catalogSortOrder: number
  priceEur: number
  roles: PlanProductRole[]
}

function common(overrides: CommonOverrides) {
  return {
    productId: overrides.productId,
    displayName: overrides.displayName,
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["fine", "normal", "coarse"],
    knownReaction: false,
    protocols: overrides.roles.map((role) => ({
      role,
      status: "verified_complete" as const,
      fingerprint: `protocol-${overrides.productId}-${role}`,
    })),
    factFingerprint: `facts-${overrides.productId}`,
    catalogSortOrder: overrides.catalogSortOrder,
    priceEur: overrides.priceEur,
    currency: "EUR",
    purchaseLinkStatus: "available" as const,
  }
}

function dry(
  productId: string,
  displayName: string,
  catalogSortOrder: number,
  priceEur: number,
  primaryEffect: string,
  hairColorFit: string,
  scalpSensitivityFit: string,
  format: string,
): Stage3DryShampooFacts {
  return {
    ...common({
      productId,
      displayName,
      catalogSortOrder,
      priceEur,
      roles: ["root_refresh_bridge"],
    }),
    category: "dry_shampoo",
    spec: { primaryEffect, hairColorFit, scalpSensitivityFit, format },
  }
}

export const DRY = {
  batisteOriginal: dry(
    "786a1396-914e-4739-a32c-1c3ead39a3d1",
    "Batiste Trockenshampoo Original",
    9201,
    3.75,
    "classic_refresh",
    "universal",
    "normal_only",
    "aerosol_spray",
  ),
  isanaJedesHaar: dry(
    "b5b595d2-9ba3-4c99-8f99-b2b79d29eb56",
    "ISANA Trockenshampoo Jedes Haar",
    9202,
    1.99,
    "classic_refresh",
    "universal",
    "normal_only",
    "aerosol_spray",
  ),
  baleaSensitive: dry(
    "41e09958-5a1f-4997-b99b-f8384b7a8c0c",
    "Balea Trockenshampoo Kopfhaut Sensitive",
    9203,
    1.95,
    "sensitive_refresh",
    "universal",
    "sensitive_ok",
    "aerosol_spray",
  ),
  batisteSensible: dry(
    "57ec7a8e-aa1b-4260-81d6-7ec3dbc899b8",
    "Batiste Trockenshampoo Sensible Kopfhaut",
    9204,
    3.95,
    "sensitive_refresh",
    "universal",
    "sensitive_ok",
    "aerosol_spray",
  ),
  baleaSchaum: dry(
    "27fe4310-c1b8-4b02-a59e-cb9aa1f3314a",
    "Balea Trockenshampoo Schaum Kopfhaut Sensitive",
    9205,
    1.45,
    "sensitive_refresh",
    "universal",
    "sensitive_ok",
    "foam_or_liquid",
  ),
  got2bLiquid: dry(
    "dc8b8d4a-8ca9-452c-8d04-03b785b63275",
    "got2b Trockenshampoo Liquid to Dry",
    9206,
    3.95,
    "classic_refresh",
    "universal",
    "normal_only",
    "foam_or_liquid",
  ),
  got2bVolumen: dry(
    "2b2161a2-6c09-435f-adbb-49da44d434ae",
    "got2b Trockenshampoo Extra Volumen",
    9207,
    3.95,
    "volume_texture",
    "universal",
    "normal_only",
    "aerosol_spray",
  ),
  batisteBlond: dry(
    "ff309c8a-ecd5-415c-9016-1b726c9fb3a4",
    "Batiste Trockenshampoo Blond",
    9208,
    3.95,
    "classic_refresh",
    "blonde_light",
    "normal_only",
    "aerosol_spray",
  ),
  batisteBruenett: dry(
    "d28643c8-c340-4514-826a-6c1ac8419fe9",
    "Batiste Trockenshampoo Bruenett",
    9209,
    3.99,
    "classic_refresh",
    "brown",
    "normal_only",
    "aerosol_spray",
  ),
  batisteDunkel: dry(
    "6a1116a0-731f-46bb-9dd6-a0db89de5a13",
    "Batiste Trockenshampoo dunkel",
    9210,
    3.95,
    "classic_refresh",
    "dark",
    "normal_only",
    "aerosol_spray",
  ),
} as const

export const DRY_CATALOG: Stage3DryShampooFacts[] = Object.values(DRY)

function deep(
  productId: string,
  displayName: string,
  catalogSortOrder: number,
  priceEur: number,
  supportedResetRoles: PlanProductRole[],
): Stage3DeepCleansingFacts {
  return {
    ...common({ productId, displayName, catalogSortOrder, priceEur, roles: supportedResetRoles }),
    category: "deep_cleansing_shampoo",
    spec: {
      supportedResetRoles,
      targetScalpTypes: null,
      colorTreatedSuitability: "unsuitable_or_unknown",
    },
  }
}

export const DEEP = {
  neqi: deep("07895098-a301-4137-b5c6-9061589b1800", "NEQI Deep Cleansing Shampoo", 9301, 12.99, [
    "residue_reset",
  ]),
  swissOPar: deep(
    "898a5a1e-1cf1-4812-8f9e-f14563a740ca",
    "Swiss-O-Par Tiefenreinigung Shampoo",
    9302,
    2.45,
    ["residue_reset", "mineral_reset"],
  ),
  balea: deep("375ee7a0-3262-4b99-8e48-4f327c6e09aa", "Balea Shampoo Tiefenreinigung", 9303, 1.25, [
    "residue_reset",
  ]),
  isana: deep(
    "ae0e9d21-1e16-4c03-9792-773dbdc2fd18",
    "ISANA Professional Shampoo Tiefenreinigung",
    9304,
    1.29,
    ["residue_reset"],
  ),
  gliss: deep(
    "05753f93-907f-427d-a4dc-0a690ff3a76d",
    "Gliss Tiefenreinigungs-Shampoo",
    9305,
    5.95,
    ["residue_reset"],
  ),
} as const

export const DEEP_CATALOG: Stage3DeepCleansingFacts[] = Object.values(DEEP)

/** The plan's expected v1.6 projection (T2.9 confirms): Gliss oily, NEQI dry, the rest ordinary. */
export function deepCatalogWithExpectedTargets(): Stage3DeepCleansingFacts[] {
  const targets: Record<string, Stage3DeepCleansingFacts["spec"]["targetScalpTypes"]> = {
    [DEEP.neqi.productId]: ["dry"],
    [DEEP.swissOPar.productId]: [],
    [DEEP.balea.productId]: [],
    [DEEP.isana.productId]: [],
    [DEEP.gliss.productId]: ["oily"],
  }
  return DEEP_CATALOG.map((facts) => ({
    ...facts,
    spec: { ...facts.spec, targetScalpTypes: targets[facts.productId] ?? null },
    factFingerprint: `${facts.factFingerprint}-targets`,
  }))
}

function scalp(
  productId: string,
  displayName: string,
  priceEur: number,
  primaryRole: PlanProductRole,
  presentationFormat: string,
  rinseMode: string,
): Stage3ScalpCareFacts {
  return {
    ...common({ productId, displayName, catalogSortOrder: 0, priceEur, roles: [primaryRole] }),
    category: "scalp_care",
    spec: { primaryRole, presentationFormat, rinseMode },
  }
}

export const SCALP = {
  isanaPeeling: scalp(
    "2544de60-e295-47ec-98a1-6b4ca58ce4be",
    "Isana Kopfhautpeeling Tiefenreinigung",
    2.99,
    "scalp_exfoliant",
    "scrub",
    "rinse_off",
  ),
  baleaSerum: scalp(
    "35d2cc66-6d5a-49c1-9a9f-c03bf6942ab0",
    "Balea Kopfhautpflege Serum Sensitive",
    2.95,
    "scalp_comfort",
    "serum",
    "rinse_off",
  ),
  loreal: scalp(
    "3f3542c0-e82b-4306-a9e0-85df313a78cf",
    "L'Oréal Paris Anti-Haarverlust Serum",
    13.99,
    "density_claim_tonic",
    "serum",
    "leave_on",
  ),
  theOrdinary: scalp(
    "58aa2f19-b23a-4e09-ab0f-68c359371c9e",
    "The Ordinary Multi-Peptide Serum for Hair Density",
    26.5,
    "density_claim_tonic",
    "serum",
    "leave_on",
  ),
  glissSerum: scalp(
    "945ecca3-c4f0-4426-9af5-a5a8482b3b27",
    "Gliss Klärendes Serum",
    8.95,
    "scalp_flake_oil_adjunct",
    "serum",
    "leave_on",
  ),
  headShoulders: scalp(
    "c9b231ee-77b5-45b7-8127-7a85d3ae7dd0",
    "Head & Shoulders Kopfhaut-Feuchtigkeitspflege Leave-In Serum",
    5.95,
    "scalp_comfort",
    "serum",
    "leave_on",
  ),
  eucerin: scalp(
    "cd76afea-d332-4b1d-b44b-7de5bef9034f",
    "Eucerin Kopfhautberuhigendes Intensiv-Tonikum",
    16.95,
    "scalp_comfort",
    "tonic",
    "leave_on",
  ),
  baleaPeeling: scalp(
    "e51cfce0-fd76-4873-a868-cc3ca0301cbc",
    "Balea Kopfhautpflege Peeling Tiefenreinigung",
    2.95,
    "scalp_exfoliant",
    "scrub",
    "rinse_off",
  ),
} as const

/** S1 T1.5 (not yet published): Neqi Rosemary Oil with a verified density protocol. */
export const NEQI_ROSEMARY = scalp(
  "s2-fixture-neqi-rosemary-oil",
  "NEQI Smooth Strength Rosemary Oil",
  9.95,
  "density_claim_tonic",
  "oil",
  "rinse_off",
)

export const SCALP_CATALOG: Stage3ScalpCareFacts[] = Object.values(SCALP)

type S2Category = "dry_shampoo" | "deep_cleansing_shampoo" | "scalp_care"

function target(category: S2Category, role: PlanProductRole) {
  switch (category) {
    case "dry_shampoo":
      return { category, roles: [role], cadenceAdjustment: "keep" }
    case "deep_cleansing_shampoo":
      return { category, roles: [role] }
    case "scalp_care":
      return { category, roles: [role], roleTargets: [{ role, coverage: "primary" }] }
  }
}

/** One Stage-3 authority input for an S2 category (uncovered when `productFacts` is null). */
export function s2Input<C extends S2Category>(options: {
  category: C
  role: PlanProductRole
  candidates: ReadonlyArray<
    Extract<Stage3AuthorityInput["recommendationCandidates"][number], { category: C }>
  >
  selectionProfile?: Partial<Stage3SelectionProfile>
  productFacts?: Extract<
    Stage3AuthorityInput["recommendationCandidates"][number],
    { category: C }
  > | null
  coverage?: Stage3AuthorityInput["coverage"]
}): Stage3AuthorityInput {
  const productFacts = options.productFacts ?? null
  const input: Stage3AuthorityInput<C> = {
    category: options.category,
    authorityVersion: CATEGORY_ROLE_POLICIES[options.category].authorityVersion,
    refinedVersionId: "refined-s2",
    refinedInputHash: "input-s2",
    subjectKey: `decision:${options.category}:${options.role}:${productFacts ? "owned" : "gap"}`,
    role: options.role,
    capturedProductId: productFacts ? "owned-s2" : null,
    subjectIdentity: productFacts
      ? {
          kind: "catalog_product",
          productId: productFacts.productId,
          displayName: productFacts.displayName,
          category: options.category,
        }
      : null,
    categoryDecision: {
      category: options.category,
      resolution: "resolved",
      needTier: "optional",
      roles: [options.role],
      target: target(options.category, options.role),
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    } as never,
    coverage: options.coverage ?? [],
    hairThickness: "normal",
    selectionProfile: { ...UNKNOWN_SELECTION_PROFILE, ...options.selectionProfile },
    productFacts: productFacts as never,
    recommendationCandidates: [...options.candidates] as never,
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  }
  return input as unknown as Stage3AuthorityInput
}
