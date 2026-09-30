import { generateKeyPairSync, sign, type KeyObject } from "node:crypto"

// ---- Minimal DER/X.509 builder: a local CA → intermediate → leaf chain carrying
// Apple's marker OIDs, so the library's real chain verification runs offline.

function der(tag: number, body: Buffer): Buffer {
  const length =
    body.length < 0x80
      ? Buffer.from([body.length])
      : body.length < 0x100
        ? Buffer.from([0x81, body.length])
        : Buffer.from([0x82, body.length >> 8, body.length & 0xff])
  return Buffer.concat([Buffer.from([tag]), length, body])
}
const seq = (...parts: Buffer[]) => der(0x30, Buffer.concat(parts))
function oid(value: string): Buffer {
  const arcs = value.split(".").map(Number)
  const bytes = [40 * arcs[0] + arcs[1]]
  for (const arc of arcs.slice(2)) {
    const chunk = [arc & 0x7f]
    for (let rest = arc >> 7; rest > 0; rest >>= 7) chunk.unshift((rest & 0x7f) | 0x80)
    bytes.push(...chunk)
  }
  return der(0x06, Buffer.from(bytes))
}
const name = (cn: string) => seq(der(0x31, seq(oid("2.5.4.3"), der(0x0c, Buffer.from(cn)))))
const utc = (iso: string) => der(0x17, Buffer.from(iso.replace(/[-:T]/g, "").slice(2, 14) + "Z"))
const ecdsaSha256 = seq(oid("1.2.840.10045.4.3.2"))
function extension(id: string, value: Buffer, critical = false) {
  return seq(oid(id), ...(critical ? [der(0x01, Buffer.from([0xff]))] : []), der(0x04, value))
}

export type Issued = { der: Buffer; key: KeyObject; cn: string }
export function certificate(
  cn: string,
  issuer: Issued | null,
  ca: boolean,
  markerOid?: string,
): Issued {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
  const extensions = [
    extension("2.5.29.19", ca ? seq(der(0x01, Buffer.from([0xff]))) : seq(), true),
    ...(markerOid ? [extension(markerOid, der(0x05, Buffer.alloc(0)))] : []),
  ]
  const tbs = seq(
    der(0xa0, der(0x02, Buffer.from([2]))),
    der(
      0x02,
      Buffer.from([1, ...Array.from({ length: 7 }, () => Math.floor(Math.random() * 256))]),
    ),
    ecdsaSha256,
    name(issuer?.cn ?? cn),
    seq(utc("2020-01-01T00:00:00"), utc("2045-01-01T00:00:00")),
    name(cn),
    publicKey.export({ type: "spki", format: "der" }),
    der(0xa3, seq(...extensions)),
  )
  const signature = sign("sha256", tbs, issuer?.key ?? privateKey)
  return {
    der: seq(tbs, ecdsaSha256, der(0x03, Buffer.concat([Buffer.from([0]), signature]))),
    key: privateKey,
    cn,
  }
}

export function chain() {
  const root = certificate("Local Test Root", null, true)
  const intermediate = certificate("Local Test WWDR", root, true, "1.2.840.113635.100.6.2.1")
  const leaf = certificate("Local Test Signer", intermediate, false, "1.2.840.113635.100.6.11.1")
  return { root, intermediate, leaf }
}
export const trusted = chain()

export const b64url = (value: Buffer | string) => Buffer.from(value).toString("base64url")
export function jws(
  payload: object,
  signer = trusted,
  x5c = [signer.leaf, signer.intermediate, signer.root],
) {
  const header = b64url(
    JSON.stringify({ alg: "ES256", x5c: x5c.map((cert) => cert.der.toString("base64")) }),
  )
  const body = b64url(JSON.stringify(payload))
  const signature = sign("sha256", Buffer.from(`${header}.${body}`), {
    key: signer.leaf.key,
    dsaEncoding: "ieee-p1363",
  })
  return `${header}.${body}.${b64url(signature)}`
}
