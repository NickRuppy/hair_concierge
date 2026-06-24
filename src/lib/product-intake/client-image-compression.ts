"use client"

import { PRODUCT_INTAKE_MAX_IMAGE_BYTES } from "@/lib/product-intake/image-validation"

export const PRODUCT_INTAKE_CLIENT_MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const PRODUCT_INTAKE_CLIENT_MAX_IMAGE_EDGE = 1800
export const PRODUCT_INTAKE_CLIENT_IMAGE_QUALITY = 0.82

export class ProductIntakeClientImageCompressionError extends Error {
  constructor(
    message = "Das Bild ist zu groß. Bitte lade ein kleineres oder schärfer zugeschnittenes Bild hoch.",
  ) {
    super(message)
    this.name = "ProductIntakeClientImageCompressionError"
  }
}

function isBrowserImageCompressionAvailable() {
  return typeof document !== "undefined" && typeof Image !== "undefined"
}

function compressedFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]*$/, "") || "produktfoto"
  return `${baseName}.jpg`
}

function shouldBypassCanvasDecode(file: File) {
  const type = file.type.toLowerCase()
  return type === "image/heic" || type === "image/heif"
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new ProductIntakeClientImageCompressionError())
    }
    image.src = objectUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new ProductIntakeClientImageCompressionError())
      },
      type,
      quality,
    )
  })
}

export function getProductIntakeClientScaledImageDimensions(width: number, height: number) {
  const longestEdge = Math.max(width, height)
  if (longestEdge <= PRODUCT_INTAKE_CLIENT_MAX_IMAGE_EDGE) {
    return { width, height }
  }

  const scale = PRODUCT_INTAKE_CLIENT_MAX_IMAGE_EDGE / longestEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function shouldPrepareProductIntakeImageForUpload(params: {
  fileSizeBytes: number
  width: number
  height: number
}) {
  return (
    params.fileSizeBytes > PRODUCT_INTAKE_CLIENT_MAX_UPLOAD_BYTES ||
    Math.max(params.width, params.height) > PRODUCT_INTAKE_CLIENT_MAX_IMAGE_EDGE
  )
}

export async function prepareProductIntakeImageForUpload(file: File): Promise<File> {
  if (shouldBypassCanvasDecode(file)) {
    if (file.size > PRODUCT_INTAKE_MAX_IMAGE_BYTES) {
      throw new ProductIntakeClientImageCompressionError()
    }
    return file
  }

  if (
    file.size <= PRODUCT_INTAKE_CLIENT_MAX_UPLOAD_BYTES &&
    !isBrowserImageCompressionAvailable()
  ) {
    return file
  }

  if (!isBrowserImageCompressionAvailable()) {
    throw new ProductIntakeClientImageCompressionError()
  }

  const image = await loadImage(file)
  const imageWidth = image.naturalWidth || image.width
  const imageHeight = image.naturalHeight || image.height
  if (
    !shouldPrepareProductIntakeImageForUpload({
      fileSizeBytes: file.size,
      width: imageWidth,
      height: imageHeight,
    })
  ) {
    return file
  }

  const dimensions = getProductIntakeClientScaledImageDimensions(imageWidth, imageHeight)
  const canvas = document.createElement("canvas")
  canvas.width = dimensions.width
  canvas.height = dimensions.height

  const context = canvas.getContext("2d")
  if (!context) {
    throw new ProductIntakeClientImageCompressionError()
  }

  context.drawImage(image, 0, 0, dimensions.width, dimensions.height)

  const compressed = await canvasToBlob(canvas, "image/jpeg", PRODUCT_INTAKE_CLIENT_IMAGE_QUALITY)
  if (compressed.size > PRODUCT_INTAKE_CLIENT_MAX_UPLOAD_BYTES) {
    throw new ProductIntakeClientImageCompressionError()
  }

  return new File([compressed], compressedFileName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  })
}
