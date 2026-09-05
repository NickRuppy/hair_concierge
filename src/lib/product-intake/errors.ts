export class ProductIntakePersistenceError extends Error {
  /**
   * Postgres SQLSTATE of the failing query, when the repository could preserve it.
   * `submitScanProductIntake` needs `23505` to tell a lost race on
   * `idx_product_submissions_one_open_scan` apart from a real persistence outage.
   */
  readonly code?: string

  constructor(message: string, options: { code?: string } = {}) {
    super(message)
    this.name = "ProductIntakePersistenceError"
    this.code = options.code
  }
}

export class ProductIntakeUserInputError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message)
    this.name = "ProductIntakeUserInputError"
    this.status = options.status ?? 400
    this.code = options.code ?? "product_intake_invalid_input"
  }
}

export class ProductIntakeUploadExpiredError extends ProductIntakeUserInputError {
  constructor(message = "Upload nicht gefunden oder abgelaufen.") {
    super(message, {
      status: 410,
      code: "product_intake_upload_expired",
    })
    this.name = "ProductIntakeUploadExpiredError"
  }
}
