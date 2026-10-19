import SwiftUI

public struct MainEmployeeView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @State private var activeSheet: SheetType? = nil
    @State private var currentTimeFormatted: String = ""
    @State private var alertMessage: String? = nil
    @State private var showAlert: Bool = false

    enum SheetType: Identifiable {
        case markIn
        case markOut
        case history
        case salary
        case leave
        case profile
        case chatList
        var id: Int { hashValue }
    }

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    public init() {}

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    private var displayName: String {
        guard let email = firebase.currentUserEmail else { return "Employee" }
        let settings = firebase.getEmployeeSettings(employeeId: email)
        if !settings.displayName.isEmpty {
            return settings.displayName
        }
        return email.components(separatedBy: "@").first?.capitalized ?? "Employee"
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
                        .frame(width: 60, height: 60)
                        .foregroundColor(primaryRed)
                    Text("AttendPro")
                        .font(.title2)
                        .fontWeight(.bold)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 180)
    }

    public var body: some View {
        ZStack {
            Color.white
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Top Right "Edit Profile" Button (matches Android MainScreen.kt)
                HStack {
                    Spacer()
                    Button(action: { activeSheet = .profile }) {
                        Text("Edit Profile")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(primaryRed)
                            .padding(.horizontal, 16)
                            .padding(.top, 12)
                    }
                }

                ScrollView {
                    VStack(spacing: 0) {
                        // Company Banner Logo (matches Android 220dp height)
                        logoImage
                            .padding(.horizontal, 24)
                            .padding(.top, 8)

                        Spacer().frame(height: 16)

                        // Live Date & Time (matches Android SimpleDateFormat "EEEE, dd MMM yyyy\nhh:mm:ss a")
                        Text(currentTimeFormatted.isEmpty ? "Monday, 19 Oct 2026\n09:00:00 AM" : currentTimeFormatted)
                            .font(.system(size: 20, weight: .semibold))
                            .multilineTextAlignment(.center)
                            .foregroundColor(.black)
                            .lineSpacing(4)

                        Spacer().frame(height: 8)

                        // Welcome Text (matches Android "Welcome, $displayName")
                        Text("Welcome, \(displayName)")
                            .font(.system(size: 16))
                            .foregroundColor(Color.gray)

                        Spacer().frame(height: 28)

                        // Side-by-Side [ In ] and [ Out ] Buttons (matches Android Row of 2 buttons)
                        HStack(spacing: 16) {
                            Button(action: { triggerClock(.IN) }) {
                                Text("In")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 56)
                                    .background(primaryRed)
                                    .cornerRadius(16)
                            }

                            Button(action: { triggerClock(.OUT) }) {
                                Text("Out")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 56)
                                    .background(primaryRed)
                                    .cornerRadius(16)
                            }
                        }
                        .padding(.horizontal, 32)

                        Spacer().frame(height: 16)

                        // Full-Width Feature Buttons (matches Android 56dp red buttons)
                        VStack(spacing: 16) {
                            Button(action: { activeSheet = .history }) {
                                Text("View My Attendance")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 56)
                                    .background(primaryRed)
                                    .cornerRadius(16)
                            }

                            Button(action: { activeSheet = .leave }) {
                                Text("Request Leave")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 56)
                                    .background(primaryRed)
                                    .cornerRadius(16)
                            }

                            Button(action: { activeSheet = .salary }) {
                                Text("Salary Calculator")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 56)
                                    .background(primaryRed)
                                    .cornerRadius(16)
                            }
                        }
                        .padding(.horizontal, 32)

                        Spacer().frame(height: 24)

                        // Logout TextButton (matches Android TextButton)
                        Button(action: { firebase.logout() }) {
                            Text("Logout")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(primaryRed)
                        }

                        Spacer().frame(height: 80)
                    }
                }
            }

            // Floating Action Button for Chat (matches Android Scaffold FloatingActionButton)
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button(action: { activeSheet = .chatList }) {
                        Image(systemName: "message.fill")
                            .font(.system(size: 22))
                            .foregroundColor(.white)
                            .frame(width: 56, height: 56)
                            .background(primaryRed)
                            .cornerRadius(16)
                            .shadow(color: primaryRed.opacity(0.4), radius: 8, x: 0, y: 4)
                    }
                    .padding(.trailing, 24)
                    .padding(.bottom, 24)
                }
            }
        }
        .onAppear {
            updateClock()
        }
        .onReceive(timer) { _ in
            updateClock()
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .markIn:
                MarkAttendanceView(type: .IN)
            case .markOut:
                MarkAttendanceView(type: .OUT)
            case .history:
                ViewAttendanceView()
            case .salary:
                SalaryCalculatorView()
            case .leave:
                RequestLeaveView()
            case .profile:
                EmployeeProfileView()
            case .chatList:
                ChatListView()
            }
        }
        .alert(isPresented: $showAlert) {
            Alert(
                title: Text("Notice"),
                message: Text(alertMessage ?? ""),
                dismissButton: .default(Text("OK"))
            )
        }
    }

    private func updateClock() {
        let now = Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, dd MMM yyyy\nhh:mm:ss a"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        currentTimeFormatted = formatter.string(from: now)
    }

    // Android MainScreen.kt validation before opening MarkAttendance
    private func triggerClock(_ type: AttendanceType) {
        if let error = firebase.validateAttendance(type: type) {
            alertMessage = error
            showAlert = true
            return
        }
        if type == .IN {
            activeSheet = .markIn
        } else {
            activeSheet = .markOut
        }
    }
}
