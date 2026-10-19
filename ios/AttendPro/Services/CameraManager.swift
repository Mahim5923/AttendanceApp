import SwiftUI
import UIKit

public struct CameraPicker: UIViewControllerRepresentable {
    @Binding public var image: UIImage?
    @Environment(\.presentationMode) private var presentationMode

    public init(image: Binding<UIImage?>) {
        self._image = image
    }

    public func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            picker.sourceType = .camera
            picker.cameraDevice = .front
        } else {
            picker.sourceType = .photoLibrary
        }
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }

    public func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    public func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    public class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: CameraPicker

        init(_ parent: CameraPicker) {
            self.parent = parent
        }

        public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let uiImage = info[.originalImage] as? UIImage {
                // Compress & resize to 400x400 max
                let scaled = uiImage.resized(toMaxDimension: 400)
                parent.image = scaled
            }
            parent.presentationMode.wrappedValue.dismiss()
        }

        public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.presentationMode.wrappedValue.dismiss()
        }
    }
}

extension UIImage {
    public func resized(toMaxDimension maxDim: CGFloat) -> UIImage {
        let scale = min(maxDim / size.width, maxDim / size.height)
        if scale >= 1.0 { return self }
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in
            self.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }

    public func toBase64Jpeg(compressionQuality: CGFloat = 0.6) -> String {
        guard let data = self.jpegData(compressionQuality: compressionQuality) else { return "" }
        return "data:image/jpeg;base64," + data.base64EncodedString()
    }
}
