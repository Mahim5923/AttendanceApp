import SwiftUI

public struct MainEmployeeView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @StateObject private var locationManager = LocationManager()
    @State private var showingCamera = false
    @State private var capturedImage: UIImage? = nil
    @State private var attendanceType: AttendanceType = .IN
    @State private var activeSheet: SheetType? = nil
    @State private var currentTimeFormatted: String = ""

    enum SheetType: Identifiable {
        case camera
        case history
        case salary
        case leave
        case profile
        case chat
        var id: Int { hashValue }
    }

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    public init() {}

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    private var displayName: String {
        guard let email = firebase.currentUserEmail else { return "Employee" }
        if let setting = firebase.employeeSettings.first(where: { $0.employeeId.lowercased() == email.lowercased() }),
           !setting.displayName.isEmpty {
            return setting.displayName
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
                    Button(action: { activeSheet = .chat }) {
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
            locationManager.requestPermission()
            updateClock()
        }
        .onReceive(timer) { _ in
            updateClock()
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .camera:
                CameraPicker(image: $capturedImage)
                    .onDisappear(perform: handleCapturedImage)
            case .history:
                AttendanceHistorySheet()
            case .salary:
                SalaryReportSheet()
            case .leave:
                LeaveRequestSheet()
            case .profile:
                EditProfileSheet()
            case .chat:
                ChatSheet()
            }
        }
    }

    private func updateClock() {
        let now = Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, dd MMM yyyy\nhh:mm:ss a"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        currentTimeFormatted = formatter.string(from: now)
    }

    private func triggerClock(_ type: AttendanceType) {
        attendanceType = type
        activeSheet = .camera
    }

    private func handleCapturedImage() {
        guard let image = capturedImage, let email = firebase.currentUserEmail else { return }
        let base64 = image.toBase64Jpeg()
        let loc = locationManager.currentLocation?.coordinate
        let attendance = Attendance(
            employeeId: email,
            latitude: loc?.latitude ?? 0.0,
            longitude: loc?.longitude ?? 0.0,
            photoUri: base64,
            type: attendanceType
        )
        firebase.addAttendance(attendance: attendance) { _ in
            capturedImage = nil
        }
    }
}

// --- Attendance History Sheet ---
struct AttendanceHistorySheet: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode

    var body: some View {
        NavigationView {
            List(firebase.attendances) { item in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.type.rawValue)
                            .font(.headline)
                            .foregroundColor(item.type == .IN ? Color(red: 46/255, green: 125/255, blue: 50/255) : Color(red: 229/255, green: 57/255, blue: 53/255))
                        Text(item.date, style: .date)
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    Spacer()
                    Text(item.date, style: .time)
                        .font(.subheadline)
                        .foregroundColor(.black)
                }
            }
            .navigationTitle("My Attendance")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }
}

// --- Salary Calculator Sheet ---
struct SalaryReportSheet: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Salary Calculator Dashboard")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Base Salary: ₹30,000")
                            .font(.headline)
                        Text("Working Days: 26")
                            .foregroundColor(.gray)
                        Text("Days Present: \(firebase.attendances.count)")
                            .foregroundColor(.gray)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.gray.opacity(0.08))
                    .cornerRadius(12)

                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Salary Calculator")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }
}

// --- Leave Request Sheet ---
struct LeaveRequestSheet: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode
    @State private var date = Date()
    @State private var reason = ""

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Apply for Leave")) {
                    DatePicker("Leave Date", selection: $date, displayedComponents: .date)
                    TextField("Reason for leave", text: $reason)
                    Button(action: submitLeave) {
                        Text("Submit Request")
                            .foregroundColor(Color(red: 229/255, green: 57/255, blue: 53/255))
                            .fontWeight(.semibold)
                    }
                }

                Section(header: Text("My Leave Requests")) {
                    ForEach(firebase.leaveRequests) { req in
                        HStack {
                            Text(req.reason)
                            Spacer()
                            Text(req.status.rawValue)
                                .font(.caption)
                                .fontWeight(.bold)
                                .foregroundColor(req.status == .APPROVED ? .green : (req.status == .REJECTED ? .red : .orange))
                        }
                    }
                }
            }
            .navigationTitle("Request Leave")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }

    private func submitLeave() {
        guard let email = firebase.currentUserEmail, !reason.isEmpty else { return }
        let req = LeaveRequest(
            employeeId: email,
            dateTimestamp: Int64(date.timeIntervalSince1970 * 1000),
            reason: reason
        )
        firebase.addLeaveRequest(req: req) { _ in
            presentationMode.wrappedValue.dismiss()
        }
    }
}

// --- Edit Profile Sheet ---
struct EditProfileSheet: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode
    @State private var displayName: String = ""

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Profile Information")) {
                    Text("Email: \(firebase.currentUserEmail ?? "")")
                        .foregroundColor(.gray)
                    TextField("Display Name", text: $displayName)
                    Button("Save Profile") {
                        presentationMode.wrappedValue.dismiss()
                    }
                    .foregroundColor(Color(red: 229/255, green: 57/255, blue: 53/255))
                    .fontWeight(.semibold)
                }
            }
            .navigationTitle("Edit Profile")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }
}

// --- Chat Sheet ---
struct ChatSheet: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode
    @State private var messageText: String = ""

    var body: some View {
        NavigationView {
            VStack {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(firebase.messages) { msg in
                            HStack {
                                if msg.senderId.lowercased() == (firebase.currentUserEmail ?? "").lowercased() {
                                    Spacer()
                                    Text(msg.content)
                                        .padding(12)
                                        .background(Color(red: 229/255, green: 57/255, blue: 53/255))
                                        .foregroundColor(.white)
                                        .cornerRadius(14)
                                } else {
                                    Text(msg.content)
                                        .padding(12)
                                        .background(Color.gray.opacity(0.15))
                                        .foregroundColor(.black)
                                        .cornerRadius(14)
                                    Spacer()
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                    .padding(.top)
                }

                HStack {
                    TextField("Type a message...", text: $messageText)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                    Button(action: sendMessage) {
                        Image(systemName: "paperplane.fill")
                            .foregroundColor(Color(red: 229/255, green: 57/255, blue: 53/255))
                    }
                }
                .padding()
            }
            .navigationTitle("Chat with Admin")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }

    private func sendMessage() {
        let trimmed = messageText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, let email = firebase.currentUserEmail else { return }
        let chat = ChatMessage(
            senderId: email,
            receiverId: firebase.isAdmin ? "all" : "admin",
            content: trimmed,
            timestamp: Int64(Date().timeIntervalSince1970 * 1000)
        )
        firebase.sendMessage(message: chat) { _ in
            messageText = ""
        }
    }
}
