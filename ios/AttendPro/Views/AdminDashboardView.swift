import SwiftUI

public struct AdminDashboardView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @State private var activeSheet: SheetType? = nil
    @State private var selectedEmployeeForDetail: String? = nil
    @State private var selectedEmployeeForEdit: String? = nil
    @State private var selectedEmployeeForChat: (id: String, name: String)? = nil
    @State private var shareURL: URL? = nil

    enum SheetType: Identifiable {
        case leaves
        case monthlyReport
        case detailEmployee
        case editEmployee
        case chatList
        case directChat
        case shareSheet
        var id: Int { hashValue }
    }

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    public init() {}

    public var body: some View {
        ZStack {
            Color.white
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header (matches Android AdminDashboardScreen)
                HStack {
                    Text("Admin Dashboard")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.black)
                    Spacer()
                    Button(action: { firebase.logout() }) {
                        Text("Logout")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(primaryRed)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 12)

                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // 1. Manage Leave Requests Button (matches Android 56dp)
                        Button(action: { activeSheet = .leaves }) {
                            HStack {
                                Text("Manage Leave Requests")
                                    .font(.system(size: 16, weight: .semibold))
                                Spacer()
                                let pendingCount = firebase.leaveRequests.filter { $0.status == .PENDING }.count
                                if pendingCount > 0 {
                                    Text("\(pendingCount)")
                                        .font(.caption)
                                        .fontWeight(.bold)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.white.opacity(0.3))
                                        .clipShape(Capsule())
                                }
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 20)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(primaryRed)
                            .cornerRadius(16)
                        }

                        // 2. View Monthly Report Button (matches Android 56dp)
                        Button(action: { activeSheet = .monthlyReport }) {
                            Text("View Monthly Report")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                                .background(primaryRed)
                                .cornerRadius(16)
                        }

                        // 3. Export Monthly Report (.csv)
                        Button(action: exportMonthlyReport) {
                            HStack(spacing: 8) {
                                Image(systemName: "square.and.arrow.up")
                                Text("Export Monthly Report (.csv)")
                                    .font(.system(size: 15, weight: .medium))
                            }
                            .foregroundColor(primaryRed)
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(primaryRed.opacity(0.08))
                            .cornerRadius(12)
                        }

                        Spacer().frame(height: 8)

                        // 4. Employees Section Header
                        Text("Employees")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.black)
                            .padding(.top, 8)

                        let employees = firebase.getAllEmployees()
                        if employees.isEmpty {
                            Text("No employees found.")
                                .foregroundColor(.gray)
                                .padding(.vertical, 20)
                        } else {
                            VStack(spacing: 12) {
                                ForEach(employees, id: \.self) { empId in
                                    let settings = firebase.getEmployeeSettings(employeeId: empId)
                                    let name = settings.displayName.isEmpty ? empId.components(separatedBy: "@").first?.capitalized ?? empId : settings.displayName

                                    HStack(spacing: 14) {
                                        // Avatar
                                        Circle()
                                            .fill(primaryRed.opacity(0.12))
                                            .frame(width: 48, height: 48)
                                            .overlay(
                                                Text(String(name.prefix(1)).uppercased())
                                                    .font(.system(size: 18, weight: .bold))
                                                    .foregroundColor(primaryRed)
                                            )

                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(name)
                                                .font(.system(size: 16, weight: .semibold))
                                                .foregroundColor(.black)
                                            Text(empId)
                                                .font(.system(size: 13))
                                                .foregroundColor(.gray)
                                        }

                                        Spacer()

                                        // Chat Button
                                        Button(action: {
                                            selectedEmployeeForChat = (id: empId, name: name)
                                            activeSheet = .directChat
                                        }) {
                                            Image(systemName: "message")
                                                .font(.system(size: 17))
                                                .foregroundColor(primaryRed)
                                                .padding(8)
                                                .background(primaryRed.opacity(0.08))
                                                .clipShape(Circle())
                                        }

                                        // Settings Edit Button
                                        Button(action: {
                                            selectedEmployeeForEdit = empId
                                            activeSheet = .editEmployee
                                        }) {
                                            Image(systemName: "gearshape")
                                                .font(.system(size: 17))
                                                .foregroundColor(primaryRed)
                                                .padding(8)
                                                .background(primaryRed.opacity(0.08))
                                                .clipShape(Circle())
                                        }
                                    }
                                    .padding(14)
                                    .background(Color.white)
                                    .cornerRadius(14)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 14)
                                            .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                                    )
                                    .onTapGesture {
                                        selectedEmployeeForDetail = empId
                                        activeSheet = .detailEmployee
                                    }
                                }
                            }
                        }

                        Spacer().frame(height: 80)
                    }
                    .padding(.horizontal, 20)
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
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .leaves:
                ManageLeavesView()
            case .monthlyReport:
                MonthlyReportView()
            case .detailEmployee:
                if let empId = selectedEmployeeForDetail {
                    AdminEmployeeDetailView(employeeId: empId)
                }
            case .editEmployee:
                if let empId = selectedEmployeeForEdit {
                    AdminEmployeeSettingsView(employeeId: empId)
                }
            case .chatList:
                ChatListView()
            case .directChat:
                if let partner = selectedEmployeeForChat {
                    ChatView(chatPartnerId: partner.id, chatPartnerName: partner.name)
                }
            case .shareSheet:
                if let url = shareURL {
                    ShareSheet(activityItems: [url])
                }
            }
        }
    }

    private func exportMonthlyReport() {
        let employees = firebase.getAllEmployees()
        var csv = "Employee Name,Base Salary,Total Working Days,Days Present,Approved Leaves,Days Absent,Per Day Salary,Deduction,Net Salary\n"
        for empId in employees {
            let settings = firebase.getEmployeeSettings(employeeId: empId)
            let name = settings.displayName.isEmpty ? empId : settings.displayName
            let calc = firebase.calculateSalaryForEmployee(employeeId: empId)
            csv += "\"\(name)\",\(Int(calc.baseSalary)),\(calc.totalWorkingDays),\(calc.presentDays),\(calc.approvedLeaveDays),\(calc.absentDays),\(Int(calc.perDaySalary)),\(Int(calc.deduction)),\(Int(calc.netSalary))\n"
        }

        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent("Attendance_Monthly_Report_\(Int(Date().timeIntervalSince1970)).csv")
        try? csv.write(to: fileURL, atomically: true, encoding: .utf8)
        self.shareURL = fileURL
        self.activeSheet = .shareSheet
    }
}

// ShareSheet Wrapper for UIActivityViewController
struct ShareSheet: UIViewControllerRepresentable {
    var activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
