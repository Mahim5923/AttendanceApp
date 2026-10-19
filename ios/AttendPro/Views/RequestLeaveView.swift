import SwiftUI

public struct RequestLeaveView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode

    @State private var selectedDate = Date()
    @State private var reason = ""
    @State private var isSubmitting = false

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    public init() {}

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Apply for Leave")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.black)
                        .padding(.top, 10)

                    // Date Selection
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Leave Date")
                            .font(.caption)
                            .foregroundColor(.gray)

                        DatePicker("", selection: $selectedDate, displayedComponents: .date)
                            .datePickerStyle(CompactDatePickerStyle())
                            .labelsHidden()
                            .padding(.horizontal, 16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .frame(height: 52)
                            .background(Color.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.gray.opacity(0.3), lineWidth: 1.5)
                            )
                    }

                    // Reason Text Field
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Reason for leave")
                            .font(.caption)
                            .foregroundColor(.gray)

                        TextEditor(text: $reason)
                            .padding(12)
                            .frame(height: 110)
                            .background(Color.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.gray.opacity(0.3), lineWidth: 1.5)
                            )
                    }

                    // Submit Button (56dp height, primaryRed)
                    if isSubmitting {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: primaryRed))
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                    } else {
                        Button(action: submitLeave) {
                            Text("Submit Request")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                                .background(reason.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray.opacity(0.4) : primaryRed)
                                .cornerRadius(16)
                        }
                        .disabled(reason.trimmingCharacters(in: .whitespaces).isEmpty)
                    }

                    Divider().padding(.vertical, 8)

                    // My Leave Requests List
                    Text("My Leave Requests")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.black)

                    let email = firebase.currentUserEmail?.lowercased() ?? ""
                    let myLeaves = firebase.leaveRequests.filter { $0.employeeId.lowercased() == email }

                    if myLeaves.isEmpty {
                        Text("No leave requests found.")
                            .foregroundColor(.gray)
                            .padding(.vertical, 12)
                    } else {
                        VStack(spacing: 10) {
                            ForEach(myLeaves) { req in
                                let dateStr = Date(timeIntervalSince1970: TimeInterval(req.dateTimestamp) / 1000.0)
                                    .formatted(date: .abbreviated, time: .omitted)

                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(dateStr)
                                            .font(.system(size: 15, weight: .semibold))
                                            .foregroundColor(.black)
                                        Text("\"\(req.reason)\"")
                                            .font(.subheadline)
                                            .foregroundColor(.gray)
                                    }
                                    Spacer()
                                    Text(req.status.rawValue)
                                        .font(.caption)
                                        .fontWeight(.bold)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(statusColor(req.status).opacity(0.12))
                                        .foregroundColor(statusColor(req.status))
                                        .clipShape(Capsule())
                                }
                                .padding(14)
                                .background(Color.white)
                                .cornerRadius(12)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                                )
                            }
                        }
                    }

                    Spacer().frame(height: 24)
                }
                .padding(20)
            }
            .navigationTitle("Request Leave")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }

    private func submitLeave() {
        guard let email = firebase.currentUserEmail, !reason.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isSubmitting = true

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: selectedDate)
        let timestamp = Int64(startOfDay.timeIntervalSince1970 * 1000)

        let req = LeaveRequest(
            employeeId: email,
            dateTimestamp: timestamp,
            reason: reason.trimmingCharacters(in: .whitespaces)
        )

        firebase.addLeaveRequest(req: req) { _ in
            isSubmitting = false
            reason = ""
            presentationMode.wrappedValue.dismiss()
        }
    }

    private func statusColor(_ status: LeaveStatus) -> Color {
        switch status {
        case .APPROVED: return Color(red: 46/255, green: 125/255, blue: 50/255)
        case .REJECTED: return primaryRed
        case .PENDING: return Color.orange
        }
    }
}
