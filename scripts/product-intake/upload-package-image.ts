import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { extname, resolve } from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"

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
    }
  | {
      status: "already_uploaded" | "uploaded"
      bucket: string
      storage_path: string
      public_url: string
      local_file: string
      content_type: string
      asset_sha256: string
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
  const contentType = contentTypeFor(file)

  if (!params.apply) {
    return {
      status: "dry_run",
      bucket: decision.storage_bucket,
      storage_path: decision.storage_path,
      public_url: decision.public_url,
      local_file: file,
      content_type: contentType,
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

  const bucket = params.supabase.storage.from(decision.storage_bucket)
  const existing = await bucket.download(decision.storage_path)
  if (!existing.error && existing.data) {
    return {
      status: "already_uploaded",
      bucket: decision.storage_bucket,
      storage_path: decision.storage_path,
      public_url: decision.public_url,
      local_file: file,
      content_type: contentType,
      asset_sha256: actualSha256,
    }
  }

  const { error: uploadError } = await bucket.upload(decision.storage_path, bytes, {
    contentType,
    upsert: false,
  })
  if (uploadError) {
    throw new Error(`upload final product image: ${uploadError.message}`)
  }

  const verify = await bucket.download(decision.storage_path)
  if (verify.error || !verify.data) {
    throw new Error(`verify uploaded product image: ${verify.error?.message ?? "not found"}`)
  }

  return {
    status: "uploaded",
    bucket: decision.storage_bucket,
    storage_path: decision.storage_path,
    public_url: decision.public_url,
    local_file: file,
    content_type: contentType,
    asset_sha256: actualSha256,
  }
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
