export class MobileError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code)
  }
}
