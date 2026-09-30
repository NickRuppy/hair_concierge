import AVFoundation
import SwiftUI

/// All capture session mutation and duplicate suppression run on this single queue.
final class CaptureWorker: NSObject, AVCaptureMetadataOutputObjectsDelegate, @unchecked Sendable {
    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "de.chaarlie.scanner.capture")
    private var camera: AVCaptureDevice?
    private var configured = false
    private var detecting = false
    private var generation = UUID()
    private var onBarcode: (@Sendable (String, UUID) -> Void)?
    private var onFailure: (@Sendable () -> Void)?

    func update(running: Bool, detecting: Bool, generation: UUID,
                onBarcode: @escaping @Sendable (String, UUID) -> Void,
                onTorchAvailability: @escaping @Sendable (Bool, UUID) -> Void,
                onFailure: @escaping @Sendable () -> Void) {
        queue.async { [self] in
            self.generation = generation
            self.onBarcode = onBarcode
            self.onFailure = onFailure
            self.detecting = detecting && running
            if running {
                guard configure() else { onFailure(); return }
                if !session.isRunning { session.startRunning() }
                onTorchAvailability(camera?.hasTorch == true && camera?.isTorchAvailable == true, generation)
            } else {
                setTorch(false)
                onTorchAvailability(false, generation)
                if session.isRunning { session.stopRunning() }
            }
        }
    }
    private func configure() -> Bool {
        if configured { return true }
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
                ?? AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: camera) else { return false }
        session.beginConfiguration()
        defer { session.commitConfiguration() }
        if session.canSetSessionPreset(.high) { session.sessionPreset = .high }
        guard session.canAddInput(input) else { return false }
        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { session.removeInput(input); return false }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: queue)
        output.metadataObjectTypes = [.ean8, .ean13].filter { output.availableMetadataObjectTypes.contains($0) }
        self.camera = camera
        configureContinuousCapture(on: camera)
        configured = true
        return true
    }
    private func configureContinuousCapture(on camera: AVCaptureDevice) {
        guard (try? camera.lockForConfiguration()) != nil else { return }
        defer { camera.unlockForConfiguration() }
        if camera.isFocusModeSupported(.continuousAutoFocus) {
            camera.focusMode = .continuousAutoFocus
        }
        if camera.isExposureModeSupported(.continuousAutoExposure) {
            camera.exposureMode = .continuousAutoExposure
        }
    }
    func focus(at point: CGPoint, generation: UUID) {
        queue.async { [self] in
            guard self.generation == generation, session.isRunning, let camera,
                  (try? camera.lockForConfiguration()) != nil else { return }
            defer { camera.unlockForConfiguration() }
            if camera.isFocusPointOfInterestSupported {
                camera.focusPointOfInterest = point
                if camera.isFocusModeSupported(.continuousAutoFocus) {
                    camera.focusMode = .continuousAutoFocus
                } else if camera.isFocusModeSupported(.autoFocus) {
                    camera.focusMode = .autoFocus
                }
            }
            if camera.isExposurePointOfInterestSupported {
                camera.exposurePointOfInterest = point
                if camera.isExposureModeSupported(.continuousAutoExposure) {
                    camera.exposureMode = .continuousAutoExposure
                } else if camera.isExposureModeSupported(.autoExpose) {
                    camera.exposureMode = .autoExpose
                }
            }
        }
    }
    func setTorch(_ enabled: Bool, generation: UUID,
                  completion: @escaping @Sendable (Bool, UUID) -> Void) {
        queue.async { [self] in
            guard self.generation == generation, session.isRunning else {
                completion(false, generation)
                return
            }
            completion(setTorch(enabled), generation)
        }
    }
    @discardableResult
    private func setTorch(_ enabled: Bool) -> Bool {
        guard let camera, camera.hasTorch, camera.isTorchAvailable,
              camera.isTorchModeSupported(enabled ? .on : .off),
              (try? camera.lockForConfiguration()) != nil else { return false }
        defer { camera.unlockForConfiguration() }
        camera.torchMode = enabled ? .on : .off
        return camera.torchMode == .on
    }
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard detecting,
              let code = metadataObjects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first else { return }
        detecting = false
        onBarcode?(code, generation)
    }
    func stop() {
        queue.async { [self] in
            detecting = false
            setTorch(false)
            if session.isRunning { session.stopRunning() }
        }
    }
}

@MainActor
@Observable
final class CameraController {
    enum Availability { case pending, available, denied, unavailable }
    let worker = CaptureWorker()
    var availability: Availability = .pending
    var isTorchAvailable = false
    var isTorchEnabled = false
    private weak var previewView: CameraPreviewView?
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
        } onTorchAvailability: { [weak self] available, token in
            Task { @MainActor [weak self] in
                guard let self, self.generation == token else { return }
                self.isTorchAvailable = available
                if !available { self.isTorchEnabled = false }
            }
        } onFailure: { [weak self] in
            Task { @MainActor [weak self] in
                guard let self, self.generation == expected else { return }
                self.availability = .unavailable
            }
        }
    }
    fileprivate func attach(previewView: CameraPreviewView) {
        self.previewView = previewView
    }
    @discardableResult
    func focus(at windowPoint: CGPoint) -> Bool {
        guard active, let previewView, let window = previewView.window else { return false }
        let previewPoint = previewView.convert(windowPoint, from: window)
        let devicePoint = previewView.preview.captureDevicePointConverted(fromLayerPoint: previewPoint)
        worker.focus(at: devicePoint, generation: generation)
        return true
    }
    func toggleTorch() {
        guard active, isTorchAvailable else { return }
        let expected = generation
        let desired = !isTorchEnabled
        isTorchEnabled = desired
        worker.setTorch(desired, generation: expected) { [weak self] enabled, token in
            Task { @MainActor [weak self] in
                guard let self, self.generation == token else { return }
                self.isTorchEnabled = enabled
            }
        }
    }
    func stop() {
        active = false
        detectorActive = false
        isTorchAvailable = false
        isTorchEnabled = false
        generation = UUID()
        worker.stop()
    }
}

private final class CameraPreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var preview: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}
struct CameraPreview: UIViewRepresentable {
    let controller: CameraController
    func makeUIView(context: Context) -> UIView {
        let view = CameraPreviewView()
        view.preview.session = controller.worker.session
        view.preview.videoGravity = .resizeAspectFill
        controller.attach(previewView: view)
        return view
    }
    func updateUIView(_ uiView: UIView, context: Context) {
        guard let view = uiView as? CameraPreviewView else { return }
        controller.attach(previewView: view)
    }
}
