import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { extname, resolve } from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"
import sharp from "sharp"

import { createSupabaseClientFromEnv, flagBool, parseArgs, printJson, requireFlag } from "./cli"
import type { ProductIntakeImageFinalizationDecision } from "./image-finalization"

type ApprovedImageDecision = Extract<
  ProductIntakeImageFinalizationDecision,
  { status: "approved_asset" }
>

export type ProductIntakeImageUploadResult =
  | {
      status: "not_required"
      reason: string
    }
  | {
      status: "dry_run"
      bucket: string
      storage_path: string
      public_url: string
      local_file: string
      content_type: string
      thumbnail_storage_path: string
      thumbnail_public_url: string
      thumbnail_local_file: string
    }
  | {
      status: "already_uploaded" | "uploaded"
      bucket: string
      storage_path: string
      public_url: string
      local_file: string
      content_type: string
      asset_sha256: string
      thumbnail_storage_path: string
      thumbnail_public_url: string
      thumbnail_local_file: string
      thumbnail_asset_sha256: string
    }

function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}

function contentTypeFor(path: string): string {
  const extension = extname(path).toLowerCase()
  if (extension === ".webp") return "image/webp"
  if (extension === ".png") return "image/png"
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg"
  return "application/octet-stream"
}

function isApprovedImageDecision(value: unknown): value is ApprovedImageDecision {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { status?: unknown }).status === "approved_asset"
  )
}

function localFinalFile(packageDir: string, finalFile: string): string {
  const packageRoot = resolve(packageDir)
  const file = resolve(packageRoot, finalFile)
  if (!file.startsWith(`${packageRoot}/`) && file !== packageRoot) {
    throw new Error("Approved image final_file must stay inside the research package")
  }
  return file
}

export async function uploadApprovedPackageImage(params: {
  supabase: SupabaseClient
  packageDir: string
  imageFinalization: unknown
  apply: boolean
  confirm: boolean
}): Promise<ProductIntakeImageUploadResult> {
  if (!isApprovedImageDecision(params.imageFinalization)) {
    return {
      status: "not_required",
      reason: "No approved image asset to upload.",
    }
  }

  const decision = params.imageFinalization
  const file = localFinalFile(params.packageDir, decision.final_file)
  const thumbnailFile = localFinalFile(params.packageDir, decision.thumbnail_final_file)
  const contentType = contentTypeFor(file)

  if (!params.apply) {
    return {
      status: "dry_run",
      bucket: decision.storage_bucket,
      storage_path: decision.storage_path,
      public_url: decision.public_url,
      local_file: file,
      content_type: contentType,
      thumbnail_storage_path: decision.thumbnail_storage_path,
      thumbnail_public_url: decision.thumbnail_public_url,
      thumbnail_local_file: thumbnailFile,
    }
  }
  if (!params.confirm) {
    throw new Error("Product image upload writes require --confirm")
  }

  const bytes = await readFile(file)
  const actualSha256 = sha256Buffer(bytes)
  if (actualSha256 !== decision.asset_sha256) {
    throw new Error("Local final image SHA-256 does not match image-finalization.json")
  }
  const thumbnailBytes = await readFile(thumbnailFile)
  const actualThumbnailSha256 = sha256Buffer(thumbnailBytes)
  if (actualThumbnailSha256 !== decision.thumbnail_asset_sha256) {
    throw new Error("Local thumbnail SHA-256 does not match image-finalization.json")
  }
  const thumbnailMetadata = await sharp(thumbnailBytes).metadata()
  if (
    thumbnailMetadata.format !== "webp" ||
    thumbnailMetadata.width !== 144 ||
    thumbnailMetadata.height !== 144
  ) {
    throw new Error("Local thumbnail must be a 144x144 WebP image")
  }

  const bucket = params.supabase.storage.from(decision.storage_bucket)
  const canonicalStatus = await ensureStorageObject({
    bucket,
    path: decision.storage_path,
    bytes,
    expectedSha256: actualSha256,
    contentType,
  })
  const thumbnailStatus = await ensureStorageObject({
    bucket,
    path: decision.thumbnail_storage_path,
    bytes: thumbnailBytes,
    expectedSha256: actualThumbnailSha256,
    contentType: "image/webp",
    cacheControl: "31536000",
    validateExisting: async (existingBytes) => {
      const existingMetadata = await sharp(existingBytes).metadata()
      if (
        existingMetadata.format !== "webp" ||
        existingMetadata.width !== 144 ||
        existingMetadata.height !== 144 ||
        existingMetadata.hasAlpha !== thumbnailMetadata.hasAlpha ||
        existingBytes.length === 0 ||
        existingBytes.length > 200_000
      ) {
        throw new Error(
          `Existing Storage thumbnail contract mismatch: ${decision.thumbnail_storage_path}`,
        )
      }
    },
  })

  return {
    status:
      canonicalStatus === "already_uploaded" && thumbnailStatus === "already_uploaded"
        ? "already_uploaded"
        : "uploaded",
    bucket: decision.storage_bucket,
    storage_path: decision.storage_path,
    public_url: decision.public_url,
    local_file: file,
    content_type: contentType,
    asset_sha256: actualSha256,
    thumbnail_storage_path: decision.thumbnail_storage_path,
    thumbnail_public_url: decision.thumbnail_public_url,
    thumbnail_local_file: thumbnailFile,
    thumbnail_asset_sha256: actualThumbnailSha256,
  }
}

async function ensureStorageObject(params: {
  bucket: ReturnType<SupabaseClient["storage"]["from"]>
  path: string
  bytes: Buffer
  expectedSha256: string
  contentType: string
  cacheControl?: string
  validateExisting?: (bytes: Buffer) => Promise<void>
}): Promise<"already_uploaded" | "uploaded"> {
  const existing = await params.bucket.download(params.path)
  if (!existing.error && existing.data) {
    const existingBytes = Buffer.from(await existing.data.arrayBuffer())
    if (params.validateExisting) {
      await params.validateExisting(existingBytes)
    } else if (sha256Buffer(existingBytes) !== params.expectedSha256) {
      throw new Error(`Existing Storage object checksum mismatch: ${params.path}`)
    }
    return "already_uploaded"
  }

  const { error: uploadError } = await params.bucket.upload(params.path, params.bytes, {
    contentType: params.contentType,
    cacheControl: params.cacheControl,
    upsert: false,
  })
  if (uploadError) throw new Error(`upload product image object: ${uploadError.message}`)

  const verify = await params.bucket.download(params.path)
  if (verify.error || !verify.data) {
    throw new Error(`verify uploaded product image object: ${verify.error?.message ?? "not found"}`)
  }
  const verifiedSha256 = sha256Buffer(Buffer.from(await verify.data.arrayBuffer()))
  if (verifiedSha256 !== params.expectedSha256) {
    throw new Error(`Uploaded Storage object checksum mismatch: ${params.path}`)
  }
  return "uploaded"
}

async function main() {
  const args = parseArgs()
  const packageDir = requireFlag(args, "package")
  const imageFinalization = JSON.parse(
    await readFile(resolve(packageDir, "image-finalization.json"), "utf8"),
  ) as unknown
  const result = await uploadApprovedPackageImage({
    supabase: createSupabaseClientFromEnv(),
    packageDir,
    imageFinalization,
    apply: flagBool(args, "apply"),
    confirm: flagBool(args, "confirm"),
  })

  printJson(result)
}

if (process.argv[1]?.endsWith("upload-package-image.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
