import SwiftUI

public struct AdminEmployeeDetailView: View {
    let employeeId: String
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode

    @State private var selectedDate: Date = Date()
    @State private var currentMonth: Date = Date()
    @State private var showingSettings: Bool = false

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    private var calendar: Calendar { Calendar.current }

    public init(employeeId: String) {
        self.employeeId = employeeId
    }

    private var settings: EmployeeSettings {
        firebase.getEmployeeSettings(employeeId: employeeId)
    }

    private var displayName: String {
        if !settings.displayName.isEmpty {
            return settings.displayName
        }
        return employeeId.components(separatedBy: "@").first?.capitalized ?? employeeId
    }

    private var daysInMonth: [Date] {
        guard let monthInterval = calendar.dateInterval(of: .month, for: currentMonth),
              let monthFirstWeek = calendar.dateInterval(of: .weekOfMonth, for: monthInterval.start),
              let monthLastWeek = calendar.dateInterval(of: .weekOfMonth, for: monthInterval.end - 1) else {
            return []
        }

        var dates: [Date] = []
        var current = monthFirstWeek.start
        while current < monthLastWeek.end {
            dates.append(current)
            current = calendar.date(byAdding: .day, value: 1, to: current) ?? current
        }
        return dates
    }

    private var weekDaysMap: [Int: String] {
        [
            1: "Sunday",
            2: "Monday",
            3: "Tuesday",
            4: "Wednesday",
            5: "Thursday",
            6: "Friday",
            7: "Saturday"
        ]
    }

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // 1. Employee Info Card (matches Android AdminEmployeeDetailScreen.kt)
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(displayName)
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundColor(.black)
                                Text(employeeId)
                                    .font(.system(size: 14))
                                    .foregroundColor(.gray)
                            }
                            Spacer()
                            Button(action: { showingSettings = true }) {
                                HStack(spacing: 6) {
                                    Image(systemName: "gearshape")
                                    Text("Settings")
                                }
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(primaryRed)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(primaryRed.opacity(0.1))
                                .cornerRadius(8)
                            }
                        }

                        Divider()

                        HStack {
                            Text("Base Salary:")
                                .foregroundColor(.gray)
                            Spacer()
                            Text("₹\(settings.baseSalary)")
                                .fontWeight(.semibold)
                        }
                        .font(.system(size: 14))

                        HStack {
                            Text("Shift:")
                                .foregroundColor(.gray)
                            Spacer()
                            Text(String(format: "%02d:%02d - %02d:%02d", settings.checkInTimeHours, settings.checkInTimeMinutes, settings.checkOutTimeHours, settings.checkOutTimeMinutes))
                                .fontWeight(.semibold)
                        }
                        .font(.system(size: 14))

                        let offs = settings.weekOffs.compactMap { weekDaysMap[$0] }.joined(separator: ", ")
                        HStack(alignment: .top) {
                            Text("Week Offs:")
                                .foregroundColor(.gray)
                            Spacer()
                            Text(offs.isEmpty ? "None" : offs)
                                .fontWeight(.semibold)
                                .multilineTextAlignment(.trailing)
                        }
                        .font(.system(size: 14))
                    }
                    .padding(16)
                    .background(Color.white)
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.gray.opacity(0.18), lineWidth: 1)
                    )
                    .padding(.horizontal, 16)

                    // 2. Attendance History Header & Month Navigation
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Attendance History")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.black)
                            .padding(.horizontal, 16)

                        // Month Switcher
                        HStack {
                            Button(action: { changeMonth(by: -1) }) {
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(primaryRed)
                                    .padding(8)
                            }

                            Spacer()

                            Text(currentMonth.formatted(.dateTime.month().year()))
                                .font(.system(size: 17, weight: .bold))
                                .foregroundColor(.black)

                            Spacer()

                            Button(action: { changeMonth(by: 1) }) {
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(primaryRed)
                                    .padding(8)
                            }
                        }
                        .padding(.horizontal, 20)

                        // Weekday Headers
                        let daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"]
                        HStack {
                            ForEach(daysOfWeek.indices, id: \.self) { i in
                                Text(daysOfWeek[i])
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .foregroundColor(.gray)
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .padding(.horizontal, 20)

                        // Calendar Grid (matches Android CalendarAttendanceView)
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 8) {
                            ForEach(daysInMonth, id: \.self) { date in
                                let isCurrentMonth = calendar.isDate(date, equalTo: currentMonth, toGranularity: .month)
                                let isSelected = calendar.isDate(date, inSameDayAs: selectedDate)
                                let status = dayStatus(for: date)

                                VStack(spacing: 4) {
                                    Text("\(calendar.component(.day, from: date))")
                                        .font(.system(size: 14, weight: isSelected ? .bold : .regular))
                                        .foregroundColor(isSelected ? .white : (isCurrentMonth ? .black : .gray.opacity(0.35)))
                                        .frame(width: 30, height: 30)
                                        .background(isSelected ? primaryRed : Color.clear)
                                        .clipShape(Circle())

                                    // Status Dot
                                    if isCurrentMonth {
                                        Circle()
                                            .fill(statusColor(status))
                                            .frame(width: 6, height: 6)
                                    } else {
                                        Spacer().frame(height: 6)
                                    }
                                }
                                .frame(height: 44)
                                .onTapGesture {
                                    if isCurrentMonth {
                                        selectedDate = date
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.gray.opacity(0.04))
                        .cornerRadius(16)
                        .padding(.horizontal, 16)

                        // Legend
                        HStack(spacing: 16) {
                            legendItem(color: Color(red: 46/255, green: 125/255, blue: 50/255), label: "Present")
                            legendItem(color: Color.red, label: "Absent")
                            legendItem(color: Color.orange, label: "Leave")
                            legendItem(color: Color.gray, label: "Week Off")
                        }
                        .font(.caption2)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 4)

                        Divider().padding(.vertical, 8)

                        // 3. Attendances for Selected Date (matches Android AttendanceItem list)
                        let dayAtts = attendancesForDay(selectedDate)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Attendances for \(selectedDate.formatted(date: .abbreviated, time: .omitted))")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.black)

                            if dayAtts.isEmpty {
                                Text("No attendance records for this date.")
                                    .font(.subheadline)
                                    .foregroundColor(.gray)
                                    .padding(.vertical, 16)
                            } else {
                                ForEach(dayAtts) { att in
                                    HStack(spacing: 14) {
                                        // Selfie preview
                                        if !att.photoUri.isEmpty, let img = decodeBase64Image(att.photoUri) {
                                            Image(uiImage: img)
                                                .resizable()
                                                .scaledToFill()
                                                .frame(width: 52, height: 52)
                                                .cornerRadius(10)
                                                .clipped()
                                        } else {
                                            RoundedRectangle(cornerRadius: 10)
                                                .fill(Color.gray.opacity(0.15))
                                                .frame(width: 52, height: 52)
                                                .overlay(Image(systemName: "camera").foregroundColor(.gray))
                                        }

                                        VStack(alignment: .leading, spacing: 4) {
                                            HStack {
                                                Text(att.type.rawValue)
                                                    .font(.headline)
                                                    .foregroundColor(att.type == .IN ? Color(red: 46/255, green: 125/255, blue: 50/255) : primaryRed)
                                                Spacer()
                                                Text(att.date.formatted(date: .omitted, time: .shortened))
                                                    .font(.subheadline)
                                                    .foregroundColor(.gray)
                                            }

                                            if att.latitude != 0.0 {
                                                Text("GPS: \(String(format: "%.4f", att.latitude)), \(String(format: "%.4f", att.longitude))")
                                                    .font(.caption)
                                                    .foregroundColor(.gray)
                                            }
                                        }
                                    }
                                    .padding(12)
                                    .background(Color.white)
                                    .cornerRadius(12)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color.gray.opacity(0.18), lineWidth: 1)
                                    )
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)

                        Spacer().frame(height: 32)
                    }
                }
                .padding(.top, 12)
            }
            .navigationTitle("Details: \(displayName)")
            .navigationBarItems(
                leading: Button("Back") { presentationMode.wrappedValue.dismiss() },
                trailing: Button(action: { showingSettings = true }) {
                    Image(systemName: "gearshape")
                        .foregroundColor(primaryRed)
                }
            )
            .sheet(isPresented: $showingSettings) {
                AdminEmployeeSettingsView(employeeId: employeeId)
            }
        }
    }

    private func changeMonth(by value: Int) {
        if let newDate = calendar.date(byAdding: .month, value: value, to: currentMonth) {
            currentMonth = newDate
        }
    }

    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label).foregroundColor(.gray)
        }
    }

    enum DayStatus {
        case present, absent, leave, weekOff, none
    }

    private func dayStatus(for date: Date) -> DayStatus {
        let weekday = calendar.component(.weekday, from: date)

        if settings.weekOffs.contains(weekday) {
            return .weekOff
        }

        let userAtts = firebase.attendances.filter { $0.employeeId.lowercased() == employeeId.lowercased() }
        if userAtts.contains(where: { calendar.isDate($0.date, inSameDayAs: date) }) {
            return .present
        }

        let approvedLeaves = firebase.leaveRequests.filter { $0.employeeId.lowercased() == employeeId.lowercased() && $0.status == .APPROVED }
        if approvedLeaves.contains(where: {
            let d = Date(timeIntervalSince1970: TimeInterval($0.dateTimestamp) / 1000.0)
            return calendar.isDate(d, inSameDayAs: date)
        }) {
            return .leave
        }

        if date < calendar.startOfDay(for: Date()) {
            return .absent
        }

        return .none
    }

    private func statusColor(_ status: DayStatus) -> Color {
        switch status {
        case .present: return Color(red: 46/255, green: 125/255, blue: 50/255)
        case .absent: return Color.red
        case .leave: return Color.orange
        case .weekOff: return Color.gray.opacity(0.5)
        case .none: return Color.clear
        }
    }

    private func attendancesForDay(_ date: Date) -> [Attendance] {
        return firebase.attendances.filter {
            $0.employeeId.lowercased() == employeeId.lowercased() && calendar.isDate($0.date, inSameDayAs: date)
        }.sorted { $0.timestamp < $1.timestamp }
    }

    private func decodeBase64Image(_ base64: String) -> UIImage? {
        var str = base64
        if let commaIndex = str.firstIndex(of: ",") {
            str = String(str[str.index(after: commaIndex)...])
        }
        guard let data = Data(base64Encoded: str) else { return nil }
        return UIImage(data: data)
    }
}
