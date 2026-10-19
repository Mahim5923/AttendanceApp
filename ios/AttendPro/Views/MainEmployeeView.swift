import SwiftUI

public struct MainEmployeeView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @StateObject private var locationManager = LocationManager()
    @State private var showingCamera = false
    @State private var capturedImage: UIImage? = nil
    @State private var attendanceType: AttendanceType = .IN
    @State private var activeSheet: SheetType? = nil
    @State private var currentTimeStr = ""
    @State private var currentDateStr = ""

    enum SheetType: Identifiable {
        case camera
        case history
        case salary
        case leave
        var id: Int { hashValue }
    }

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    public init() {}

    public var body: some View {
        ZStack {
            Color(red: 10/255, green: 13/255, blue: 20/255)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                // Header
                HStack {
                    HStack(spacing: 10) {
                        Image(systemName: "person.crop.circle.badge.checkmark")
                            .foregroundColor(Color(red: 229/255, green: 57/255, blue: 53/255))
                            .font(.title2)
                        Text("AttendPro")
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }

                    Spacer()

                    Button(action: { firebase.logout() }) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(.gray)
                            .padding(8)
                            .background(Color.white.opacity(0.06))
                            .clipShape(Circle())
                    }
                }
                .padding(.horizontal)

                ScrollView {
                    VStack(spacing: 16) {
                        // Status Card
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text(firebase.currentUserEmail?.components(separatedBy: "@").first?.capitalized ?? "Employee")
                                    .font(.subheadline)
                                    .foregroundColor(.gray)
                                Spacer()
                                Text(todayStatusText)
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(isTodayCheckedIn ? Color.green.opacity(0.15) : Color.red.opacity(0.15))
                                    .foregroundColor(isTodayCheckedIn ? .green : .red)
                                    .cornerRadius(20)
                            }

                            Text(currentTimeStr.isEmpty ? "09:00:00 AM" : currentTimeStr)
                                .font(.system(size: 38, weight: .bold, design: .rounded))
                                .foregroundColor(.white)

                            Text(currentDateStr.isEmpty ? "Today" : currentDateStr)
                                .font(.subheadline)
                                .foregroundColor(.gray)

                            Divider().background(Color.white.opacity(0.1))

                            HStack {
                                Circle()
                                    .fill(locationManager.isWithinGeofence ? Color.green : Color.orange)
                                    .frame(width: 10, height: 10)
                                Text(locationManager.isWithinGeofence ? "Within Office Geofence" : "Outside Geofence (\(Int(locationManager.distanceToOfficeMeters))m)")
                                    .font(.footnote)
                                    .foregroundColor(.gray)
                            }
                        }
                        .padding(20)
                        .background(Color(red: 18/255, green: 23/255, blue: 34/255))
                        .cornerRadius(20)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(Color.white.opacity(0.08), lineWidth: 1)
                        )

                        // Action Buttons: Mark IN & Mark OUT
                        HStack(spacing: 14) {
                            Button(action: { triggerClock(.IN) }) {
                                VStack(spacing: 8) {
                                    Image(systemName: "arrow.down.right.circle.fill")
                                        .font(.title)
                                    Text("Mark IN")
                                        .fontWeight(.bold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 22)
                                .background(LinearGradient(colors: [Color.green.opacity(0.2), Color.green.opacity(0.35)], startPoint: .top, endPoint: .bottom))
                                .foregroundColor(.green)
                                .cornerRadius(16)
                                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.green.opacity(0.4), lineWidth: 1))
                            }

                            Button(action: { triggerClock(.OUT) }) {
                                VStack(spacing: 8) {
                                    Image(systemName: "arrow.up.forward.circle.fill")
                                        .font(.title)
                                    Text("Mark OUT")
                                        .fontWeight(.bold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 22)
                                .background(LinearGradient(colors: [Color.red.opacity(0.2), Color.red.opacity(0.35)], startPoint: .top, endPoint: .bottom))
                                .foregroundColor(Color(red: 255/255, green: 82/255, blue: 82/255))
                                .cornerRadius(16)
                                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.red.opacity(0.4), lineWidth: 1))
                            }
                        }

                        // Feature Grid
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            MenuGridItem(icon: "calendar", title: "My Attendance", subtitle: "View history") {
                                activeSheet = .history
                            }
                            MenuGridItem(icon: "indianrupeesign.circle", title: "Salary Calc", subtitle: "Monthly estimate") {
                                activeSheet = .salary
                            }
                            MenuGridItem(icon: "doc.text.badge.plus", title: "Request Leave", subtitle: "Apply & status") {
                                activeSheet = .leave
                            }
                            MenuGridItem(icon: "message", title: "Chat Admin", subtitle: "Support message") {
                                // Chat action
                            }
                        }
                    }
                    .padding()
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
            }
        }
    }

    private var todayStatusText: String {
        guard let email = firebase.currentUserEmail else { return "NOT MARKED" }
        let calendar = Calendar.current
        let todayRecords = firebase.attendances.filter {
            $0.employeeId.lowercased() == email.lowercased() && calendar.isDateInToday($0.date)
        }
        if let last = todayRecords.first {
            let formatter = DateFormatter()
            formatter.timeStyle = .short
            return "\(last.type.rawValue) AT \(formatter.string(from: last.date))"
        }
        return "NOT MARKED"
    }

    private var isTodayCheckedIn: Bool {
        todayStatusText.contains("IN")
    }

    private func updateClock() {
        let now = Date()
        let tf = DateFormatter()
        tf.timeStyle = .medium
        currentTimeStr = tf.string(from: now)

        let df = DateFormatter()
        df.dateStyle = .full
        currentDateStr = df.string(from: now)
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

struct MenuGridItem: View {
    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(Color(red: 229/255, green: 57/255, blue: 53/255))
                    .frame(width: 40, height: 40)
                    .background(Color(red: 229/255, green: 57/255, blue: 53/255).opacity(0.15))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)

                Text(subtitle)
                    .font(.caption2)
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color(red: 18/255, green: 23/255, blue: 34/255))
            .cornerRadius(16)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.white.opacity(0.08), lineWidth: 1))
        }
    }
}

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
                            .foregroundColor(item.type == .IN ? .green : .red)
                        Text(item.date, style: .date)
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    Spacer()
                    Text(item.date, style: .time)
                        .font(.subheadline)
                        .foregroundColor(.white)
                }
                .listRowBackground(Color(red: 18/255, green: 23/255, blue: 34/255))
            }
            .navigationTitle("Attendance History")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }
}

struct SalaryReportSheet: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode

    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Salary Dashboard")
                    .font(.title2)
                    .fontWeight(.bold)
                Text("Estimations based on your attendance records")
                    .font(.subheadline)
                    .foregroundColor(.gray)

                Spacer()
            }
            .padding()
            .navigationTitle("Salary Calculator")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }
}

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
                    TextField("Reason (e.g. Personal, Health)", text: $reason)
                    Button("Submit Leave Request") {
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

                Section(header: Text("My Past Requests")) {
                    ForEach(firebase.leaveRequests) { req in
                        HStack {
                            Text(req.reason)
                            Spacer()
                            Text(req.status.rawValue)
                                .font(.caption)
                                .foregroundColor(req.status == .APPROVED ? .green : (req.status == .REJECTED ? .red : .orange))
                        }
                    }
                }
            }
            .navigationTitle("Leave Management")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }
}
