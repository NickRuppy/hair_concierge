/* Frozen consolidation policy: historical field decisions retain their own methods. */
export const OIL_POLICY_PINS = {
  "docs/research/oil-inci/v1.0/02_classification-standard-v0.8.md":
    "2238a966c7cefbae48bec2df72293bef98837e29cba15c0eed9b5c2e91a281cc",
  "docs/research/oil-inci/v1.0/01_property-set-v0.2.md":
    "b9bc09bdf9c6076530d9d34ac33c4e8b7ba3b4b47dc11d91491f72e05b9eefd5",
  "docs/research/oil-inci/v1.0/11_operating-guide-v0.2.md":
    "c7ca970424c3004d825c2faa4a636a8df0d93e214e293671acdab9a00ca5d28d",
  "docs/research/oil-inci/v1.0/10_persistence-guidance-v0.2.md":
    "251bcbfd705e521df4303a9f5b24c4007d0dd138a2c7dce554bb14fbb99e6208",
  "docs/research/shared/persistence-potential-v0.1.md":
    "b8b9ef91e408af0756dcb7d9f931f5fe0f8c3874f92ffc780512baf423f31fd4",
  "docs/research/oil-inci/v1.0/03_weight-reference-v0.10.md":
    "dc6d7f117cae895014620ce9b3f542f5cb35c980581d0e692aa022862ede657d",
  "data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.10.json":
    "f2a57bd84195fa911578b69cb2153743f839d1d64f403e1bda625028bb855b50",
  "docs/research/oil-inci/v1.0/04_blend-weight-policy-v0.2.md":
    "5db652413c5dd814f9a9488dfab6a8bedbd7dcc107a9fe002448203429db8391",
  "data/research/oil-inci/v1.0/reference/blend-weight-policy-v0.2.json":
    "00d916f2faab0b07f607b3a220e788c4d82e026a36381faab40c49bcae9d5305",
  "docs/research/oil-inci/v1.0/05_thickness-fit-standard-v0.1.md":
    "1a28981bedf298ace48924125f12c5610ad84da4d2de5866239e4db00dc5b43c",
  "docs/research/oil-inci/v1.0/06_curl-pattern-fit-standard-v0.1.md":
    "93df70950d1e9cc803aa69e200a967a365c39489028859fbbe26b21fba2ce5e4",
  "docs/research/oil-inci/v1.0/07_damage-fit-standard-v0.1.md":
    "6c7f2c8e3bae83ee796d36af5fa8da7398ef3d071fcde97abdd93395c0e82b6b",
} as const

export const OIL_RESEARCH_METHOD = {
  purpose: "consolidation_serialization",
  policy_pins: OIL_POLICY_PINS,
} as const

/**
 * The only method tuple accepted for a newly authored Product Intake oil
 * record. Historical consolidation envelopes deliberately keep their own
 * method declaration above; changing this value must not make them current.
 */
export const OIL_LEGACY_INTAKE_METHOD = {
  purpose: "intake_research",
  engine_id: "oil-standard",
  methodology_version: "v0.8",
  adapter_version: "oil-production-adapter-v1",
  policy_pins: OIL_POLICY_PINS,
} as const

/**
 * Local, pre-Intake research is intentionally versioned separately from both
 * the frozen consolidation corpus and the v0.8 Product Intake contract. It
 * may be reviewed in the Lab but cannot become an Intake record by sharing a
 * method tuple with either of those lanes.
 */
export const OIL_LOCAL_RESEARCH_POLICY_PINS = {
  "docs/research/oil-inci/v1.0/02_classification-standard-v0.9.md":
    "d00a7fd6d870163e6d95ad0fb52e9a0208c9232736f4b0c204abf4b31a1446ba",
  "docs/research/oil-inci/v1.0/01_property-set-v0.3.md":
    "b8c6ef11ea0e64188f0a7f432c4ee0b78cbfe891d2be425ecbda3b1d2bea5d6b",
  "docs/research/oil-inci/v1.0/11_operating-guide-v0.3.md":
    "3087b412c1e9bb7b2d444a0c032a39086762318bcf3dde4094981ea4ffc2c925",
  "docs/research/oil-inci/v1.0/10_persistence-guidance-v0.3.md":
    "01c3c1caa317d588cc4bdc429dc171fcc1f47c51f289402652ede1adae08b248",
  "docs/research/shared/persistence-potential-v0.1.md":
    "b8b9ef91e408af0756dcb7d9f931f5fe0f8c3874f92ffc780512baf423f31fd4",
  "docs/research/oil-inci/v1.0/03_weight-reference-v0.10.md":
    "dc6d7f117cae895014620ce9b3f542f5cb35c980581d0e692aa022862ede657d",
  "data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.10.json":
    "f2a57bd84195fa911578b69cb2153743f839d1d64f403e1bda625028bb855b50",
  "docs/research/oil-inci/v1.0/04_blend-weight-policy-v0.2.md":
    "5db652413c5dd814f9a9488dfab6a8bedbd7dcc107a9fe002448203429db8391",
  "data/research/oil-inci/v1.0/reference/blend-weight-policy-v0.2.json":
    "00d916f2faab0b07f607b3a220e788c4d82e026a36381faab40c49bcae9d5305",
  "docs/research/oil-inci/v1.0/05_thickness-fit-standard-v0.1.md":
    "1a28981bedf298ace48924125f12c5610ad84da4d2de5866239e4db00dc5b43c",
  "docs/research/oil-inci/v1.0/06_curl-pattern-fit-standard-v0.1.md":
    "93df70950d1e9cc803aa69e200a967a365c39489028859fbbe26b21fba2ce5e4",
  "docs/research/oil-inci/v1.0/07_damage-fit-standard-v0.1.md":
    "6c7f2c8e3bae83ee796d36af5fa8da7398ef3d071fcde97abdd93395c0e82b6b",
} as const

export const OIL_LOCAL_RESEARCH_METHOD = {
  purpose: "local_research",
  engine_id: "oil-standard",
  methodology_version: "v0.9",
  adapter_version: "oil-production-adapter-v1",
  policy_pins: OIL_LOCAL_RESEARCH_POLICY_PINS,
} as const

export const OIL_FIT_POLICY_PINS = {
  "docs/research/oil-inci/v1.0/05_thickness-fit-standard-v0.1.md":
    OIL_POLICY_PINS["docs/research/oil-inci/v1.0/05_thickness-fit-standard-v0.1.md"],
  "docs/research/oil-inci/v1.0/06_curl-pattern-fit-standard-v0.1.md":
    OIL_POLICY_PINS["docs/research/oil-inci/v1.0/06_curl-pattern-fit-standard-v0.1.md"],
  "docs/research/oil-inci/v1.0/07_damage-fit-standard-v0.1.md":
    OIL_POLICY_PINS["docs/research/oil-inci/v1.0/07_damage-fit-standard-v0.1.md"],
} as const

/** Current lean intake policy. Legacy envelopes retain their original tuples. */
export const OIL_CURRENT_POLICY_PINS = {
  "docs/research/oil-inci/v1.0/02_classification-standard-v0.10.md":
    "57a4b4a0e160fdbd7a7bd0e171e2cc58ec3cdf7a0eb7d8303d803f709dd16bbb",
  "docs/research/oil-inci/v1.0/01_property-set-v0.4.md":
    "bcf5f60d6df11fd01b2d4a60465db4664e2eff4c7b31a16963d3a8e9d3b1606b",
  "docs/research/oil-inci/v1.0/11_operating-guide-v0.4.md":
    "a24114c000c074d9fbabd221d1c3da56283ec7d20146a3198c8047c0507f3a66",
  "docs/research/oil-inci/v1.0/10_persistence-guidance-v0.3.md":
    "01c3c1caa317d588cc4bdc429dc171fcc1f47c51f289402652ede1adae08b248",
  "docs/research/shared/persistence-potential-v0.1.md":
    "b8b9ef91e408af0756dcb7d9f931f5fe0f8c3874f92ffc780512baf423f31fd4",
  "docs/research/oil-inci/v1.0/03_weight-reference-v0.10.md":
    "dc6d7f117cae895014620ce9b3f542f5cb35c980581d0e692aa022862ede657d",
  "data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.10.json":
    "f2a57bd84195fa911578b69cb2153743f839d1d64f403e1bda625028bb855b50",
  "docs/research/oil-inci/v1.0/04_blend-weight-policy-v0.2.md":
    "5db652413c5dd814f9a9488dfab6a8bedbd7dcc107a9fe002448203429db8391",
  "data/research/oil-inci/v1.0/reference/blend-weight-policy-v0.2.json":
    "00d916f2faab0b07f607b3a220e788c4d82e026a36381faab40c49bcae9d5305",
  "docs/research/oil-inci/v1.0/05_thickness-fit-standard-v0.1.md":
    "1a28981bedf298ace48924125f12c5610ad84da4d2de5866239e4db00dc5b43c",
} as const

export const OIL_INTAKE_METHOD = {
  purpose: "intake_research",
  engine_id: "oil-standard",
  methodology_version: "v0.10",
  adapter_version: "oil-production-adapter-v1",
  policy_pins: OIL_CURRENT_POLICY_PINS,
} as const
