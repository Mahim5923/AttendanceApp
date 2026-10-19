import SwiftUI
import CoreLocation

public struct MarkAttendanceView: View {
    public let type: AttendanceType
    @ObservedObject var firebase = FirebaseService.shared
    @StateObject private var locationManager = LocationManager()
    @Environment(\.presentationMode) var presentationMode

    @State private var showingCamera = false
    @State private var capturedImage: UIImage? = nil
    @State private var alertMessage: String? = nil
    @State private var showAlert = false
    @State private var isSubmitting = false

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    public init(type: AttendanceType) {
        self.type = type
    }

    public var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Spacer()

                // Header icon
                Circle()
                    .fill(primaryRed.opacity(0.12))
                    .frame(width: 90, height: 90)
                    .overlay(
                        Image(systemName: type == .IN ? "arrow.down.right.circle.fill" : "arrow.up.forward.circle.fill")
                            .font(.system(size: 46))
                            .foregroundColor(primaryRed)
                    )

                Text("Mark \(type.rawValue)")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundColor(.black)

                let email = firebase.currentUserEmail ?? ""
                let settings = firebase.getEmployeeSettings(employeeId: email)

                // GPS & Geofence Status
                if let loc = locationManager.currentLocation?.coordinate,
                   settings.targetLatitude != 0, settings.targetLongitude != 0 {
                    let loc1 = CLLocation(latitude: loc.latitude, longitude: loc.longitude)
                    let loc2 = CLLocation(latitude: settings.targetLatitude, longitude: settings.targetLongitude)
                    let dist = loc1.distance(from: loc2)
                    let inGeofence = dist <= settings.targetRadiusMeters

                    HStack(spacing: 8) {
                        Circle()
                            .fill(inGeofence ? Color.green : Color.orange)
                            .frame(width: 10, height: 10)
                        Text(inGeofence ? "Within Office Geofence (\(Int(dist))m)" : "Outside Geofence (\(Int(dist))m, limit \(Int(settings.targetRadiusMeters))m)")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.gray.opacity(0.08))
                    .clipShape(Capsule())
                }

                Spacer()

                // Take Photo & Mark Location Button (matches Android 56dp)
                if isSubmitting {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: primaryRed))
                        .frame(height: 56)
                } else {
                    Button(action: handleMarkAttendanceClick) {
                        Text("Take Photo & Mark Location")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(primaryRed)
                            .cornerRadius(16)
                    }
                    .padding(.horizontal, 32)
                }

                Spacer().frame(height: 40)
            }
            .navigationTitle("Mark Attendance")
            .navigationBarItems(trailing: Button("Cancel") { presentationMode.wrappedValue.dismiss() })
            .onAppear {
                locationManager.requestPermission()
            }
            .sheet(isPresented: $showingCamera) {
                CameraPicker(image: $capturedImage)
                    .onDisappear(perform: handleCapturedPhoto)
            }
            .alert(isPresented: $showAlert) {
                Alert(
                    title: Text("Notice"),
                    message: Text(alertMessage ?? ""),
                    dismissButton: .default(Text("OK"))
                )
            }
        }
    }

    private func handleMarkAttendanceClick() {
        guard let email = firebase.currentUserEmail else { return }
        let settings = firebase.getEmployeeSettings(employeeId: email)

        // 1. Week Off check (matches Android)
        let calendar = Calendar.current
        let currentDayOfWeek = calendar.component(.weekday, from: Date())
        if settings.weekOffs.contains(currentDayOfWeek) {
            alertMessage = "You cannot mark attendance on your week off"
            showAlert = true
            return
        }

        // 2. Geofence Distance check (matches Android)
        if let loc = locationManager.currentLocation?.coordinate,
           settings.targetLatitude != 0, settings.targetLongitude != 0 {
            let loc1 = CLLocation(latitude: loc.latitude, longitude: loc.longitude)
            let loc2 = CLLocation(latitude: settings.targetLatitude, longitude: settings.targetLongitude)
            let distance = loc1.distance(from: loc2)

            if distance > settings.targetRadiusMeters {
                alertMessage = "You are too far from the attendance location. Distance: \(Int(distance))m"
                showAlert = true
                return
            }
        }

        showingCamera = true
    }

    private func handleCapturedPhoto() {
        guard let image = capturedImage, let email = firebase.currentUserEmail else { return }
        isSubmitting = true
        let base64 = image.toBase64Jpeg()
        let loc = locationManager.currentLocation?.coordinate

        let record = Attendance(
            employeeId: email,
            latitude: loc?.latitude ?? 0.0,
            longitude: loc?.longitude ?? 0.0,
            photoUri: base64,
            type: type
        )

        firebase.addAttendance(attendance: record) { _ in
            isSubmitting = false
            presentationMode.wrappedValue.dismiss()
        }
    }
}
