import Foundation
import Vision
import CoreImage
import AppKit

// usage: swift removebg.swift <outputDir> <input files...>
guard CommandLine.arguments.count >= 3 else {
    print("usage: removebg <outputDir> <input files...>")
    exit(1)
}

let outputDir = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try? FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)

let ciContext = CIContext()
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!

for path in CommandLine.arguments.dropFirst(2) {
    let inputURL = URL(fileURLWithPath: path)
    guard let inputImage = CIImage(contentsOf: inputURL) else {
        print("SKIP (cannot read): \(inputURL.lastPathComponent)")
        continue
    }
    let handler = VNImageRequestHandler(ciImage: inputImage, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    do {
        try handler.perform([request])
        guard let result = request.results?.first else {
            print("SKIP (no subject found): \(inputURL.lastPathComponent)")
            continue
        }
        // Soft-matted cutout on the original canvas size
        let maskedBuffer = try result.generateMaskedImage(
            ofInstances: result.allInstances,
            from: handler,
            croppedToInstancesExtent: false
        )
        let masked = CIImage(cvPixelBuffer: maskedBuffer)
        let baseName = inputURL.deletingPathExtension().lastPathComponent
        let outURL = outputDir.appendingPathComponent(baseName + ".png")
        try ciContext.writePNGRepresentation(of: masked, to: outURL, format: .RGBA8, colorSpace: colorSpace)
        print("OK: \(outURL.lastPathComponent)")
    } catch {
        print("FAIL: \(inputURL.lastPathComponent) — \(error.localizedDescription)")
    }
}
