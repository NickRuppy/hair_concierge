export const TOOL_IMAGE_BASE = "/images/tools"

export type ToolImage = {
  src: string
  alt: string
  /**
   * Every file under `TOOL_IMAGE_BASE` is a 1.9:1 letterbox-blur composition
   * (see `plans/tool-bildkarten.md`): the square packshot sits centered on a
   * hard-blurred, stretched copy of itself. Rendered full-bleed on a card well
   * those side panels read as ghost shapes of the tool, so a card carrying this
   * flag must crop to the centered square window instead.
   *
   * Deliberately carried by the tool image data rather than sniffed from the
   * file extension: the hair-texture and thickness photos are full-bleed
   * compositions and must keep rendering edge-to-edge.
   */
  packshot: true
}

function toolImage(file: string, alt: string): ToolImage {
  return { src: `${TOOL_IMAGE_BASE}/${file}.webp`, alt, packshot: true }
}

/** Bürsten & Kämme (Onboarding `brush_type`) */
export const BRUSH_TYPE_IMAGES: Record<string, ToolImage> = {
  wide_tooth_comb: toolImage("wide_tooth_comb", "Grobzinkiger Kamm"),
  detangling: toolImage("detangling", "Detangling-Bürste"),
  paddle: toolImage("paddle", "Paddle-Bürste"),
  round: toolImage("round", "Rundbürste"),
  boar_bristle: toolImage("boar_bristle", "Wildschweinborsten-Bürste"),
  fingers: toolImage("fingers", "Finger, die durch Haar gleiten"),
}

export const BRUSH_TYPE_DESCRIPTIONS: Record<string, string> = {
  wide_tooth_comb: "Wenige, dicke Zinken mit viel Abstand.",
  detangling: "Flexible Borsten, z. B. Tangle Teezer.",
  paddle: "Große, flache Bürste mit Kissen.",
  round: "Runder Kopf, meist zum Föhnen.",
  boar_bristle: "Dichte, weiche Naturborsten.",
  fingers: "Du entwirrst dein Haar mit den Händen.",
}

/** Handtuch-Material (Stage-2-Refinement `towel_handling`) */
export const TOWEL_MATERIAL_IMAGES: Record<string, ToolImage> = {
  frottee: toolImage("frottee", "Frottee-Handtuch"),
  mikrofaser: toolImage("microfiber_towel", "Mikrofaser-Handtuch"),
  tshirt: toolImage("smooth_cotton_cloth", "Glattes Baumwolltuch / T-Shirt"),
  turban_mikrofaser: toolImage("drying_wrap", "Haarturban aus Mikrofaser"),
}

/** Zusätzliche Hitze-Tools (Stage-2-Refinement `additional_heat_tools`) */
export const ADDITIONAL_HEAT_TOOL_IMAGES: Record<string, ToolImage> = {
  dryer_brush: toolImage("dryer_brush", "Föhnbürste"),
  hot_air_styler: toolImage("hot_air_styler", "Heißluft-Multistyler"),
  straightener: toolImage("straightener", "Glätteisen"),
  curling_or_wave_iron: toolImage("curling_or_wave_iron", "Lockenstab"),
  thermal_rollers: toolImage("thermal_rollers", "Thermo-Wickler"),
}

/** Hitzetools (Onboarding `styling_tools`) */
export const STYLING_TOOL_IMAGES: Record<string, ToolImage> = {
  blow_dryer: toolImage("blow_dryer", "Föhn"),
  flat_iron: toolImage("straightener", "Glätteisen"),
  curling_iron: toolImage("curling_or_wave_iron", "Lockenstab"),
  wave_iron: toolImage("wave_iron", "Welleneisen"),
  hot_air_brush: toolImage("dryer_brush", "Warmluftbürste"),
  thermal_rollers: toolImage("thermal_rollers", "Thermo-Lockenwickler"),
  multi_tool: toolImage("hot_air_styler", "Multi-Styler"),
  diffuser: toolImage("diffuser", "Diffusor"),
}
