import SwiftUI

public struct EmployeeProfileView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode

    @State private var displayName: String = ""
    @State private var photoBase64: String = ""
    @State private var showingCamera = false
    @State private var capturedImage: UIImage? = nil
    @State private var isSaving = false

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    public init() {}

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    Spacer().frame(height: 12)

                    // Profile Photo Avatar (matches Android 120dp Circle)
                    Group {
                        if let img = profileUIImage {
                            Image(uiImage: img)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 120, height: 120)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(primaryRed, lineWidth: 2))
                        } else {
                            Circle()
                                .fill(Color.gray.opacity(0.15))
                                .frame(width: 120, height: 120)
                                .overlay(
                                    Image(systemName: "person.fill")
                                        .font(.system(size: 50))
                                        .foregroundColor(.gray)
                                )
                        }
                    }

                    // Take Profile Photo Button
                    Button(action: { showingCamera = true }) {
                        HStack {
                            Image(systemName: "camera")
                            Text("Take Profile Photo")
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(primaryRed)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(primaryRed.opacity(0.08))
                        .cornerRadius(10)
                    }

                    // Email (Read Only)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email")
                            .font(.caption)
                            .foregroundColor(.gray)
                        Text(firebase.currentUserEmail ?? "")
                            .padding(.horizontal, 16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .frame(height: 52)
                            .background(Color.gray.opacity(0.08))
                            .cornerRadius(12)
                            .foregroundColor(.gray)
                    }
                    .padding(.horizontal, 24)

                    // Display Name (matches Android OutlinedTextField)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Display Name")
                            .font(.caption)
                            .foregroundColor(.gray)
                        TextField("Enter your name", text: $displayName)
                            .padding(.horizontal, 16)
                            .frame(height: 52)
                            .background(Color.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.gray.opacity(0.3), lineWidth: 1.5)
                            )
                    }
                    .padding(.horizontal, 24)

                    Spacer().frame(height: 12)

                    // Save Profile Button (56dp height, primaryRed)
                    if isSaving {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: primaryRed))
                            .frame(height: 56)
                    } else {
                        Button(action: saveProfile) {
                            Text("Save Profile")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                                .background(primaryRed)
                                .cornerRadius(16)
                        }
                        .padding(.horizontal, 24)
                    }

                    Spacer()
                }
            }
            .navigationTitle("My Profile")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
            .onAppear(perform: loadProfile)
            .sheet(isPresented: $showingCamera) {
                CameraPicker(image: $capturedImage)
                    .onDisappear(perform: handleCapturedPhoto)
            }
        }
    }

    private var profileUIImage: UIImage? {
        if let captured = capturedImage {
            return captured
        }
        if !photoBase64.isEmpty {
            var str = photoBase64
            if let commaIndex = str.firstIndex(of: ",") {
                str = String(str[str.index(after: commaIndex)...])
            }
            if let data = Data(base64Encoded: str) {
                return UIImage(data: data)
            }
        }
        return nil
    }

    private func loadProfile() {
        guard let email = firebase.currentUserEmail else { return }
        let settings = firebase.getEmployeeSettings(employeeId: email)
        displayName = settings.displayName
        photoBase64 = settings.profilePhotoUri
    }

    private func handleCapturedPhoto() {
        if let img = capturedImage {
            photoBase64 = img.toBase64Jpeg()
        }
    }

    private func saveProfile() {
        guard let email = firebase.currentUserEmail else { return }
        isSaving = true
        var settings = firebase.getEmployeeSettings(employeeId: email)
        settings.displayName = displayName.trimmingCharacters(in: .whitespaces)
        settings.profilePhotoUri = photoBase64

        firebase.saveEmployeeSettings(settings: settings) { _ in
            isSaving = false
            presentationMode.wrappedValue.dismiss()
        }
    }
}
