import { deriveLeaveInCareDirectionT20 } from "@/lib/leave-in-research/care-direction-t20"
const S = (rank: number, inci: string, speciesClass: string) => ({ rank, inci, speciesClass })
const cases: Record<string, unknown> = {
  aussie_A_marker_plausible_PL_lipid: {
    proteinAnchor: false,
    markerStatus: "plausible",
    speciesAboveTail: [
      S(2, "DIMETHICONE", "persistent_film"),
      S(3, "PARAFFINUM LIQUIDUM", "medium_rich_lipid"),
    ],
  },
  aussie_B_marker_plausible_PL_other: {
    proteinAnchor: false,
    markerStatus: "plausible",
    speciesAboveTail: [
      S(2, "DIMETHICONE", "persistent_film"),
      S(3, "PARAFFINUM LIQUIDUM", "other"),
    ],
  },
  aussie_C_marker_implausible_ordinal: {
    proteinAnchor: false,
    markerStatus: "implausible",
    speciesAboveTail: [
      S(2, "DIMETHICONE", "persistent_film"),
      S(3, "PARAFFINUM LIQUIDUM", "medium_rich_lipid"),
      S(5, "BETAINE", "settled_humectant"),
      S(8, "C13-14 ALKANE", "volatile_carrier"),
    ],
  },
  bali: {
    proteinAnchor: false,
    markerStatus: "plausible",
    speciesAboveTail: [
      S(2, "CETEARYL ALCOHOL", "fatty_alcohol"),
      S(3, "GLYCERIN", "settled_humectant"),
      S(4, "COCO-CAPRYLATE", "dry_feel_ester"),
      S(5, "GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE", "cationic"),
    ],
  },
  balea_vacuous_ordinal: {
    proteinAnchor: false,
    markerStatus: "vacuous",
    speciesAboveTail: [
      S(2, "PROPYLENE GLYCOL", "multifunctional_glycol"),
      S(4, "DIMETHICONE", "persistent_film"),
      S(5, "CETYL ALCOHOL", "fatty_alcohol"),
      S(6, "GLYCERIN", "settled_humectant"),
      S(7, "ETHYLHEXYL STEARATE", "dry_feel_ester"),
      S(8, "SIMMONDSIA CHINENSIS SEED OIL", "medium_rich_lipid"),
      S(9, "PANTHENOL", "settled_humectant"),
      S(12, "DIMETHICONOL", "persistent_film"),
      S(13, "CETRIMONIUM CHLORIDE", "cationic"),
    ],
  },
  neqi_check: {
    proteinAnchor: false,
    markerStatus: "plausible",
    speciesAboveTail: [
      S(2, "DIPROPYLENE GLYCOL", "multifunctional_glycol"),
      S(6, "PENTYLENE GLYCOL", "multifunctional_glycol"),
      S(7, "POLYSILICONE-29", "persistent_film"),
    ],
  },
}
for (const [k, v] of Object.entries(cases))
  console.log(
    k,
    JSON.stringify(
      deriveLeaveInCareDirectionT20(v as Parameters<typeof deriveLeaveInCareDirectionT20>[0]),
    ),
  )
