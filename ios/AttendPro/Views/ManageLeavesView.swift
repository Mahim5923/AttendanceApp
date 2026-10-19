import SwiftUI

public struct ManageLeavesView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    public init() {}

    public var body: some View {
        NavigationView {
            Group {
                if firebase.leaveRequests.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "tray")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)
                        Text("No leave requests found.")
                            .foregroundColor(.gray)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(firebase.leaveRequests) { req in
                            let dateStr = Date(timeIntervalSince1970: TimeInterval(req.dateTimestamp) / 1000.0)
                                .formatted(date: .abbreviated, time: .omitted)

                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(req.employeeId)
                                        .font(.headline)
                                        .foregroundColor(.black)
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

                                Text("Date: \(dateStr)")
                                    .font(.subheadline)
                                    .foregroundColor(.gray)

                                Text("\"\(req.reason)\"")
                                    .font(.body)
                                    .foregroundColor(.black)
                                    .padding(.vertical, 2)

                                if req.status == .PENDING {
                                    HStack(spacing: 12) {
                                        Button(action: {
                                            firebase.updateLeaveStatus(id: req.id, status: .APPROVED) { _ in }
                                        }) {
                                            Text("Approve")
                                                .font(.system(size: 14, weight: .bold))
                                                .foregroundColor(.white)
                                                .frame(maxWidth: .infinity)
                                                .frame(height: 38)
                                                .background(Color(red: 46/255, green: 125/255, blue: 50/255))
                                                .cornerRadius(10)
                                        }

                                        Button(action: {
                                            firebase.updateLeaveStatus(id: req.id, status: .REJECTED) { _ in }
                                        }) {
                                            Text("Reject")
                                                .font(.system(size: 14, weight: .bold))
                                                .foregroundColor(.white)
                                                .frame(maxWidth: .infinity)
                                                .frame(height: 38)
                                                .background(primaryRed)
                                                .cornerRadius(10)
                                        }
                                    }
                                    .padding(.top, 4)
                                }
                            }
                            .padding(.vertical, 6)
                        }
                    }
                    .listStyle(PlainListStyle())
                }
            }
            .navigationTitle("Leave Requests")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }

    private func statusColor(_ status: LeaveStatus) -> Color {
        switch status {
        case .APPROVED:
            return Color(red: 46/255, green: 125/255, blue: 50/255)
        case .REJECTED:
            return primaryRed
        case .PENDING:
            return Color.orange
        }
    }
}
