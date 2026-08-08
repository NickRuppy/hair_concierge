type FactProvenance = "catalog_spec" | "bond_usage_protocol"

type LeaveInSpecRow = {
  format: "spray" | "milk" | "lotion" | "cream" | "serum"
  roles: string[]
  provides_heat_protection: boolean
  heat_protection_max_c: number | null
  heat_activation_required: boolean
  application_stage: string[]
}

type DryShampooSpecRow = {
  format: "aerosol_spray" | "powder" | "foam_or_liquid"
}

type BondbuilderSpecRow = {
  application_mode: "pre_shampoo" | "post_wash_leave_in"
  treatment_mode: "rinse_out" | "leave_in"
  product_format: "cream_treatment" | "primer_treatment" | "leave_in_mask" | "spray_treatment"
  usage_protocol:
    | "olaplex_3plus"
    | "olaplex_0_booster"
    | "olaplex_3_legacy"
    | "k18_leave_in"
    | "epres_spray"
}

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
    case "leave_in":
      return {
        facts: {
          format: input.spec.format,
          roles: input.spec.roles,
          providesHeatProtection: input.spec.provides_heat_protection,
          heatProtectionMaxC: input.spec.heat_protection_max_c,
          heatActivationRequired: input.spec.heat_activation_required,
          applicationStage: input.spec.application_stage,
        },
        provenance: {
          format: catalogSpec,
          roles: catalogSpec,
          providesHeatProtection: catalogSpec,
          heatProtectionMaxC: catalogSpec,
          heatActivationRequired: catalogSpec,
          applicationStage: catalogSpec,
        },
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
