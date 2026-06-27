import Foundation
import CoreImage
import AppKit

// usage: swift qa_composite.swift <outputDir> <input pngs...>
// Composites each cutout onto a magenta background to inspect edge quality.
let outputDir = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try? FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)
let ciContext = CIContext()

for path in CommandLine.arguments.dropFirst(2) {
    let url = URL(fileURLWithPath: path)
    guard let img = CIImage(contentsOf: url) else { continue }
    let bg = CIImage(color: CIColor(red: 1, green: 0, blue: 1)).cropped(to: img.extent)
    let composited = img.composited(over: bg)
    let outURL = outputDir.appendingPathComponent(url.lastPathComponent)
    try ciContext.writePNGRepresentation(of: composited, to: outURL, format: .RGBA8,
                                         colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
}
print("done")
