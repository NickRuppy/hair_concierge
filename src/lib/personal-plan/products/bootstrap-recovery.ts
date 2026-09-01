export class Stage3PreparationError extends Error {
  constructor(
    public readonly kind: "contract_violation",
    public readonly diagnosticQueued: boolean,
  ) {
    super("stage3_preparation_failed")
    this.name = "Stage3PreparationError"
  }
}
