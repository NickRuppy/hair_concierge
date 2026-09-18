import AVFoundation
import SwiftUI

/// All capture session mutation and duplicate suppression run on this single queue.
final class CaptureWorker: NSObject, AVCaptureMetadataOutputObjectsDelegate, @unchecked Sendable {
    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "de.chaarlie.scanner.capture")
    private var configured = false
    private var detecting = false
    private var generation = UUID()
    private var onBarcode: (@Sendable (String, UUID) -> Void)?
    private var onFailure: (@Sendable () -> Void)?

    func update(running: Bool, detecting: Bool, generation: UUID,
                onBarcode: @escaping @Sendable (String, UUID) -> Void,
                onFailure: @escaping @Sendable () -> Void) {
        queue.async { [self] in
            self.generation = generation
            self.onBarcode = onBarcode
            self.onFailure = onFailure
            self.detecting = detecting && running
            if running {
                guard configure() else { onFailure(); return }
                if !session.isRunning { session.startRunning() }
            } else if session.isRunning { session.stopRunning() }
        }
    }
    private func configure() -> Bool {
        if configured { return true }
        guard let camera = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: camera) else { return false }
        session.beginConfiguration()
        defer { session.commitConfiguration() }
        guard session.canAddInput(input) else { return false }
        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { session.removeInput(input); return false }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: queue)
        output.metadataObjectTypes = [.ean8, .ean13].filter { output.availableMetadataObjectTypes.contains($0) }
        configured = true
        return true
    }
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard detecting,
              let code = metadataObjects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first else { return }
        detecting = false
        onBarcode?(code, generation)
    }
    func stop() { queue.async { [self] in detecting = false; if session.isRunning { session.stopRunning() } } }
}

@MainActor
@Observable
final class CameraController {
    enum Availability { case pending, available, denied, unavailable }
    let worker = CaptureWorker()
    var availability: Availability = .pending
    private var generation = UUID()
    private var active = false
    private var detectorActive = false
    private var scan: ((String) -> Void)?

    func permission() async {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: availability = .available
        case .notDetermined:
            availability = await AVCaptureDevice.requestAccess(for: .video) ? .available : .denied
        case .denied, .restricted: availability = .denied
        @unknown default: availability = .unavailable
        }
    }
    func update(active: Bool, detecting: Bool, scan: @escaping (String) -> Void) {
        self.active = active && availability == .available
        detectorActive = detecting && self.active
        self.scan = scan
        generation = UUID()
        let expected = generation
        worker.update(running: self.active, detecting: detectorActive, generation: expected) { [weak self] code, token in
            Task { @MainActor [weak self] in
                guard let self, self.active, self.detectorActive, self.generation == token else { return }
                self.detectorActive = false
                self.scan?(code)
            }
        } onFailure: { [weak self] in
            Task { @MainActor [weak self] in
                guard let self, self.generation == expected else { return }
                self.availability = .unavailable
            }
        }
    }
    func stop() { active = false; detectorActive = false; generation = UUID(); worker.stop() }
}

private final class CameraPreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var preview: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}
struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession
    func makeUIView(context: Context) -> UIView {
        let view = CameraPreviewView()
        view.preview.session = session
        view.preview.videoGravity = .resizeAspectFill
        return view
    }
    func updateUIView(_ uiView: UIView, context: Context) {}
}
