import SwiftUI

public struct LoginView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil
    @State private var isHindi: Bool = false
    @State private var isSignUpMode: Bool = false

    public init() {}

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    private var logoImage: some View {
        Group {
            if let path = Bundle.main.path(forResource: "logo", ofType: "png"),
               let uiImage = UIImage(contentsOfFile: path) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFit()
            } else if let uiImage = UIImage(named: "logo") {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFit()
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "person.crop.circle.badge.checkmark")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 70, height: 70)
                        .foregroundColor(primaryRed)
                    Text("AttendPro")
                        .font(.title)
                        .fontWeight(.bold)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 200)
    }

    public var body: some View {
        ZStack {
            Color.white
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 24)

                    // Top Banner Logo (matches Android 220dp height)
                    logoImage
                        .padding(.horizontal, 24)

                    Spacer().frame(height: 28)

                    // Form Fields
                    VStack(alignment: .leading, spacing: 16) {
                        // Email Field
                        VStack(alignment: .leading, spacing: 6) {
                            Text(isHindi ? "ईमेल" : "Email")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.gray)

                            TextField("", text: $email)
                                .padding(.horizontal, 16)
                                .frame(height: 56)
                                .background(Color.white)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.gray.opacity(0.4), lineWidth: 1.5)
                                )
                                .foregroundColor(.black)
                                .autocapitalization(.none)
                                .keyboardType(.emailAddress)
                        }

                        // Password Field
                        VStack(alignment: .leading, spacing: 6) {
                            Text(isHindi ? "पासवर्ड" : "Password")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.gray)

                            SecureField("", text: $password)
                                .padding(.horizontal, 16)
                                .frame(height: 56)
                                .background(Color.white)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.gray.opacity(0.4), lineWidth: 1.5)
                                )
                                .foregroundColor(.black)
                        }

                        // Error Banner
                        if let err = errorMessage {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(err)
                                    .font(.footnote)
                                    .foregroundColor(primaryRed)
                                
                                if err.contains("Account not found") || err.contains("INVALID_LOGIN_CREDENTIALS") {
                                    Button(action: {
                                        isSignUpMode = true
                                        performAction()
                                    }) {
                                        Text(isHindi ? "नया खाता बनाएं" : "Create Account with this email")
                                            .font(.caption)
                                            .fontWeight(.bold)
                                            .foregroundColor(primaryRed)
                                    }
                                }
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.red.opacity(0.08))
                            .cornerRadius(8)
                        }

                        Spacer().frame(height: 12)

                        // Primary Action Button (56dp height, Red)
                        if isLoading {
                            HStack {
                                Spacer()
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: primaryRed))
                                    .scaleEffect(1.2)
                                Spacer()
                            }
                            .frame(height: 56)
                        } else {
                            Button(action: performAction) {
                                Text(buttonText)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 56)
                                    .background(primaryRed)
                                    .cornerRadius(16)
                            }
                            .disabled(email.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty)
                        }

                        // Sign up toggle
                        Button(action: {
                            isSignUpMode.toggle()
                            errorMessage = nil
                        }) {
                            Text(isSignUpMode
                                 ? (isHindi ? "पहले से खाता है? लॉग इन करें" : "Already have an account? Login")
                                 : (isHindi ? "नया उपयोगकर्ता? खाता बनाएं" : "New user? Tap to Register / Sign Up"))
                                .font(.footnote)
                                .foregroundColor(primaryRed)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 4)
                        }
                    }
                    .padding(.horizontal, 32)

                    Spacer().frame(height: 28)

                    // Language Toggle TextButton (matches Android LanguageManager)
                    Button(action: {
                        isHindi.toggle()
                    }) {
                        Text(isHindi ? "English" : "हिंदी")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(primaryRed)
                    }

                    Spacer().frame(height: 24)
                }
            }
        }
    }

    private var buttonText: String {
        if isSignUpMode {
            return isHindi ? "खाता बनाएं" : "Create Account"
        } else {
            return isHindi ? "लॉग इन करें" : "Login"
        }
    }

    private func performAction() {
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        guard !trimmedEmail.isEmpty && !password.isEmpty else { return }

        isLoading = true
        errorMessage = nil

        if isSignUpMode {
            firebase.signUp(email: trimmedEmail, pass: password) { result in
                DispatchQueue.main.async {
                    self.isLoading = false
                    switch result {
                    case .success:
                        break
                    case .failure(let err):
                        self.errorMessage = err.localizedDescription
                    }
                }
            }
        } else {
            firebase.login(email: trimmedEmail, pass: password) { result in
                DispatchQueue.main.async {
                    self.isLoading = false
                    switch result {
                    case .success:
                        break
                    case .failure(let err):
                        let desc = err.localizedDescription
                        if desc.contains("INVALID_LOGIN_CREDENTIALS") || desc.contains("user-not-found") {
                            self.errorMessage = isHindi 
                                ? "खाता नहीं मिला या गलत पासवर्ड। क्या आप नया खाता बनाना चाहते हैं?" 
                                : "Account not found or wrong password. Would you like to create an account?"
                        } else {
                            self.errorMessage = desc
                        }
                    }
                }
            }
        }
    }
}
