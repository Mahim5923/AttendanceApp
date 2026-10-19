import SwiftUI

public struct AdminEmployeeSettingsView: View {
    public let employeeId: String
    @ObservedObject var firebase = FirebaseService.shared
    @StateObject private var locationManager = LocationManager()
    @Environment(\.presentationMode) var presentationMode

    @State private var displayName: String = ""
    @State private var baseSalaryStr: String = ""
    @State private var checkInH: String = ""
    @State private var checkInM: String = ""
    @State private var checkOutH: String = ""
    @State private var checkOutM: String = ""

    // Week Offs (1 = Sunday, 2 = Monday, ... 7 = Saturday)
    @State private var isSundayOff: Bool = true
    @State private var isMondayOff: Bool = false
    @State private var isTuesdayOff: Bool = false
    @State private var isWednesdayOff: Bool = false
    @State private var isThursdayOff: Bool = false
    @State private var isFridayOff: Bool = false
    @State private var isSaturdayOff: Bool = true

    @State private var targetLatStr: String = ""
    @State private var targetLonStr: String = ""
    @State private var targetRadiusStr: String = ""

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    public init(employeeId: String) {
        self.employeeId = employeeId
    }

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Employee: \(employeeId)")
                        .font(.subheadline)
                        .foregroundColor(.gray)

                    // Display Name
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Display Name")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.gray)
                        TextField("Name", text: $displayName)
                            .padding(.horizontal, 16)
                            .frame(height: 52)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.3), lineWidth: 1.5))
                    }

                    // Base Salary
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Base Salary (₹)")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.gray)
                        TextField("30000", text: $baseSalaryStr)
                            .keyboardType(.decimalPad)
                            .padding(.horizontal, 16)
                            .frame(height: 52)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.3), lineWidth: 1.5))
                    }

                    // Check-In Time
                    Text("Check-In Time (24h)")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.gray)
                    HStack(spacing: 12) {
                        TextField("Hour (0-23)", text: $checkInH)
                            .keyboardType(.numberPad)
                            .padding(.horizontal, 16)
                            .frame(height: 52)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.3), lineWidth: 1.5))
                        TextField("Minute (0-59)", text: $checkInM)
                            .keyboardType(.numberPad)
                            .padding(.horizontal, 16)
                            .frame(height: 52)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.3), lineWidth: 1.5))
                    }

                    // Check-Out Time
                    Text("Check-Out Time (24h)")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.gray)
                    HStack(spacing: 12) {
                        TextField("Hour (0-23)", text: $checkOutH)
                            .keyboardType(.numberPad)
                            .padding(.horizontal, 16)
                            .frame(height: 52)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.3), lineWidth: 1.5))
                        TextField("Minute (0-59)", text: $checkOutM)
                            .keyboardType(.numberPad)
                            .padding(.horizontal, 16)
                            .frame(height: 52)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.gray.opacity(0.3), lineWidth: 1.5))
                    }

                    // Week Offs (matching Android WeekOffCheckbox)
                    Text("Select Week Offs:")
                        .font(.system(size: 16, weight: .semibold))
                        .padding(.top, 8)

                    VStack(spacing: 8) {
                        Toggle("Monday", isOn: $isMondayOff)
                        Toggle("Tuesday", isOn: $isTuesdayOff)
                        Toggle("Wednesday", isOn: $isWednesdayOff)
                        Toggle("Thursday", isOn: $isThursdayOff)
                        Toggle("Friday", isOn: $isFridayOff)
                        Toggle("Saturday", isOn: $isSaturdayOff)
                        Toggle("Sunday", isOn: $isSundayOff)
                    }
                    .toggleStyle(SwitchToggleStyle(tint: primaryRed))
                    .padding()
                    .background(Color.gray.opacity(0.06))
                    .cornerRadius(12)

                    // Office Geofence Coordinates
                    Text("Office Geofence Location")
                        .font(.system(size: 16, weight: .semibold))
                        .padding(.top, 8)

                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Latitude").font(.caption).foregroundColor(.gray)
                            TextField("0.0", text: $targetLatStr)
                                .keyboardType(.decimalPad)
                                .padding(.horizontal, 12)
                                .frame(height: 48)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Longitude").font(.caption).foregroundColor(.gray)
                            TextField("0.0", text: $targetLonStr)
                                .keyboardType(.decimalPad)
                                .padding(.horizontal, 12)
                                .frame(height: 48)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                        }
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Allowed Radius (Meters)").font(.caption).foregroundColor(.gray)
                        TextField("100", text: $targetRadiusStr)
                            .keyboardType(.numberPad)
                            .padding(.horizontal, 12)
                            .frame(height: 48)
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                    }

                    // Button: Set Current GPS
                    Button(action: fillCurrentGps) {
                        HStack {
                            Image(systemName: "location.fill")
                            Text("Set to My Current Location")
                        }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(primaryRed)
                    }

                    Spacer().frame(height: 12)

                    // Save Settings Button (56dp height)
                    Button(action: saveSettings) {
                        Text("Save Settings")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(primaryRed)
                            .cornerRadius(16)
                    }
                    .padding(.bottom, 32)
                }
                .padding(20)
            }
            .navigationTitle("Employee Settings")
            .navigationBarItems(trailing: Button("Cancel") { presentationMode.wrappedValue.dismiss() })
            .onAppear(perform: loadSettings)
        }
    }

    private func loadSettings() {
        locationManager.requestPermission()
        let s = firebase.getEmployeeSettings(employeeId: employeeId)
        displayName = s.displayName
        baseSalaryStr = "\(Int(s.baseSalary))"
        checkInH = "\(s.checkInTimeHours)"
        checkInM = "\(s.checkInTimeMinutes)"
        checkOutH = "\(s.checkOutTimeHours)"
        checkOutM = "\(s.checkOutTimeMinutes)"

        isSundayOff = s.weekOffs.contains(1)
        isMondayOff = s.weekOffs.contains(2)
        isTuesdayOff = s.weekOffs.contains(3)
        isWednesdayOff = s.weekOffs.contains(4)
        isThursdayOff = s.weekOffs.contains(5)
        isFridayOff = s.weekOffs.contains(6)
        isSaturdayOff = s.weekOffs.contains(7)

        targetLatStr = "\(s.targetLatitude)"
        targetLonStr = "\(s.targetLongitude)"
        targetRadiusStr = "\(Int(s.targetRadiusMeters))"
    }

    private func fillCurrentGps() {
        if let loc = locationManager.currentLocation?.coordinate {
            targetLatStr = String(format: "%.6f", loc.latitude)
            targetLonStr = String(format: "%.6f", loc.longitude)
        }
    }

    private func saveSettings() {
        var offs: [Int] = []
        if isSundayOff { offs.append(1) }
        if isMondayOff { offs.append(2) }
        if isTuesdayOff { offs.append(3) }
        if isWednesdayOff { offs.append(4) }
        if isFridayOff { offs.append(6) }
        if isSaturdayOff { offs.append(7) }

        let updated = EmployeeSettings(
            employeeId: employeeId,
            displayName: displayName.trimmingCharacters(in: .whitespaces),
            baseSalary: Double(baseSalaryStr) ?? 30000.0,
            checkInTimeHours: Int(checkInH) ?? 9,
            checkInTimeMinutes: Int(checkInM) ?? 0,
            checkOutTimeHours: Int(checkOutH) ?? 17,
            checkOutTimeMinutes: Int(checkOutM) ?? 0,
            weekOffs: offs,
            targetLatitude: Double(targetLatStr) ?? 0.0,
            targetLongitude: Double(targetLonStr) ?? 0.0,
            targetRadiusMeters: Double(targetRadiusStr) ?? 100.0
        )

        firebase.saveEmployeeSettings(settings: updated) { _ in
            presentationMode.wrappedValue.dismiss()
        }
    }
}
