import SwiftUI

public struct LoginView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil

    public init() {}

    public var body: some View {
        ZStack {
            Color(red: 10/255, green: 13/255, blue: 20/255)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                VStack(spacing: 12) {
                    Image(systemName: "person.crop.circle.badge.checkmark")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 80, height: 80)
                        .foregroundColor(Color(red: 229/255, green: 57/255, blue: 53/255))
                        .shadow(color: Color(red: 229/255, green: 57/255, blue: 53/255).opacity(0.4), radius: 15)

                    Text("AttendPro")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(.white)

                    Text("Smart Attendance & Workforce")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                }

                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("EMAIL")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.gray)

                        TextField("name@company.com", text: $email)
                            .padding(14)
                            .background(Color.white.opacity(0.06))
                            .cornerRadius(12)
                            .foregroundColor(.white)
                            .autocapitalization(.none)
                            .keyboardType(.emailAddress)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("PASSWORD")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.gray)

                        SecureField("••••••••", text: $password)
                            .padding(14)
                            .background(Color.white.opacity(0.06))
                            .cornerRadius(12)
                            .foregroundColor(.white)
                    }

                    if let err = errorMessage {
                        Text(err)
                            .font(.footnote)
                            .foregroundColor(.red)
                    }

                    Button(action: performLogin) {
                        HStack {
                            if isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Login")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(16)
                        .background(
                            LinearGradient(
                                colors: [Color(red: 229/255, green: 57/255, blue: 53/255), Color(red: 198/255, green: 40/255, blue: 40/255)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .shadow(color: Color(red: 229/255, green: 57/255, blue: 53/255).opacity(0.4), radius: 10, y: 5)
                    }
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                }
                .padding(24)
                .background(Color(red: 18/255, green: 23/255, blue: 34/255))
                .cornerRadius(20)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )

                Spacer()
            }
            .padding(20)
        }
    }

    private func performLogin() {
        isLoading = true
        errorMessage = nil
        firebase.login(email: email.trimmingCharacters(in: .whitespaces), pass: password) { result in
            isLoading = false
            switch result {
            case .success:
                break
            case .failure(let err):
                self.errorMessage = err.localizedDescription
            }
        }
    }
}
