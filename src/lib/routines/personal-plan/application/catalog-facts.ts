import type { ProductBondbuilderSpecs } from "@/lib/bondbuilder/constants"
import type { HeatActivationRoute } from "@/lib/heat-activation/contract"

type FactProvenance = "catalog_spec" | "bond_usage_protocol"

type LeaveInSpecRow = {
  format: "spray" | "milk" | "lotion" | "cream" | "serum"
  roles: string[]
  provides_heat_protection: boolean
  heat_activation_required: boolean
  /** Leave-In v1.2: the heat route that activates the product; NULL iff not activated. */
  heat_activation_route?: HeatActivationRoute | null
  application_stage: string[]
}

type DryShampooSpecRow = {
  format: "aerosol_spray" | "powder" | "foam_or_liquid"
}

type BondbuilderSpecRow = Pick<
  ProductBondbuilderSpecs,
  "application_mode" | "treatment_mode" | "product_format" | "usage_protocol"
>

export type CatalogApplicationFacts = {
  facts: Record<string, unknown>
  provenance: Record<string, FactProvenance>
}

export type CatalogApplicationFactsInput =
  | { category: "leave_in"; spec: LeaveInSpecRow }
  | { category: "dry_shampoo"; spec: DryShampooSpecRow }
  | { category: "bondbuilder"; spec: BondbuilderSpecRow }

const catalogSpec = "catalog_spec" as const

export function adaptCatalogApplicationFacts(
  input: CatalogApplicationFactsInput,
): CatalogApplicationFacts {
  switch (input.category) {
    case "leave_in": {
      // The route key exists only for an activated product, so every other Leave-in keeps
      // byte-identical facts (S3 P10); `null` = activated but the route is not in the read.
      const activated = input.spec.heat_activation_required === true
      return {
        facts: {
          format: input.spec.format,
          roles: input.spec.roles,
          providesHeatProtection: input.spec.provides_heat_protection,
          heatActivationRequired: input.spec.heat_activation_required,
          ...(activated ? { heatActivationRoute: input.spec.heat_activation_route ?? null } : {}),
          applicationStage: input.spec.application_stage,
        },
        provenance: {
          format: catalogSpec,
          roles: catalogSpec,
          providesHeatProtection: catalogSpec,
          heatActivationRequired: catalogSpec,
          ...(activated ? { heatActivationRoute: catalogSpec } : {}),
          applicationStage: catalogSpec,
        },
      }
    }
    case "dry_shampoo": {
      const formatResolution =
        input.spec.format === "foam_or_liquid"
          ? { status: "requires_exact_protocol" as const, candidates: ["foam", "liquid_to_dry"] }
          : { status: "resolved" as const, applicationFamily: input.spec.format }

      return {
        facts: { format: input.spec.format, formatResolution },
        provenance: { format: catalogSpec, formatResolution: catalogSpec },
      }
    }
    case "bondbuilder":
      return {
        facts: {
          applicationMode: input.spec.application_mode,
          treatmentMode: input.spec.treatment_mode,
          productFormat: input.spec.product_format,
          usageProtocol: input.spec.usage_protocol,
        },
        provenance: {
          applicationMode: catalogSpec,
          treatmentMode: catalogSpec,
          productFormat: catalogSpec,
          usageProtocol: "bond_usage_protocol",
        },
      }
  }
}
