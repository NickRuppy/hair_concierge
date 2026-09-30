/**
 * Reads a JSON request body without ever buffering more than `maxBytes`. Returns
 * `{ ok: false }` for a missing, oversized or unparseable body; callers map that to
 * their own 400 error shape.
 */
export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return { ok: false }
  const reader = request.body?.getReader()
  if (!reader) return { ok: false }
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > maxBytes) {
      await reader.cancel()
      return { ok: false }
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) }
  } catch {
    return { ok: false }
  }
}
