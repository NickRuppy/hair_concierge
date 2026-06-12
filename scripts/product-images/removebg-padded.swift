import Foundation
import Vision
import CoreImage
import AppKit

// usage: swift removebg_padded.swift <input> <output.png>
// Pads the image with a white border so Vision can find a frame-filling subject,
// then crops the cutout back to the original canvas.
let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard let original = CIImage(contentsOf: inputURL) else {
    print("cannot read \(inputURL.path)"); exit(1)
}
let pad: CGFloat = 100
let extent = original.extent
let canvas = CGRect(x: 0, y: 0, width: extent.width + 2 * pad, height: extent.height + 2 * pad)
let white = CIImage(color: .white).cropped(to: canvas)
let padded = original.transformed(by: .init(translationX: pad, y: pad)).composited(over: white)

let handler = VNImageRequestHandler(ciImage: padded, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([request])
guard let result = request.results?.first else {
    print("still no subject found"); exit(1)
}
let maskedBuffer = try result.generateMaskedImage(
    ofInstances: result.allInstances,
    from: handler,
    croppedToInstancesExtent: false
)
// Crop back to original canvas
let masked = CIImage(cvPixelBuffer: maskedBuffer)
    .cropped(to: CGRect(x: pad, y: pad, width: extent.width, height: extent.height))
    .transformed(by: .init(translationX: -pad, y: -pad))

let ciContext = CIContext()
try ciContext.writePNGRepresentation(of: masked, to: outURL, format: .RGBA8,
                                     colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
print("OK: \(outURL.lastPathComponent)")
