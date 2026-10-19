import Foundation

public enum LeaveStatus: String, Codable, CaseIterable {
    case PENDING
    case APPROVED
    case REJECTED
}

public struct LeaveRequest: Identifiable, Codable {
    public var id: String
    public var employeeId: String
    public var dateTimestamp: Int64
    public var reason: String
    public var status: LeaveStatus
    public var requestedAtTimestamp: Int64

    public init(
        id: String = UUID().uuidString,
        employeeId: String,
        dateTimestamp: Int64,
        reason: String,
        status: LeaveStatus = .PENDING,
        requestedAtTimestamp: Int64 = Int64(Date().timeIntervalSince1970 * 1000)
    ) {
        self.id = id
        self.employeeId = employeeId
        self.dateTimestamp = dateTimestamp
        self.reason = reason
        self.status = status
        self.requestedAtTimestamp = requestedAtTimestamp
    }
}
