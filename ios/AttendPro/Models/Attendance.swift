import Foundation

public enum AttendanceType: String, Codable, CaseIterable {
    case IN
    case OUT
    case UNKNOWN
}

public struct Attendance: Identifiable, Codable {
    public var id: String
    public var employeeId: String
    public var timestamp: Int64
    public var latitude: Double
    public var longitude: Double
    public var photoUri: String
    public var type: AttendanceType

    public init(
        id: String = UUID().uuidString,
        employeeId: String,
        timestamp: Int64 = Int64(Date().timeIntervalSince1970 * 1000),
        latitude: Double,
        longitude: Double,
        photoUri: String,
        type: AttendanceType
    ) {
        self.id = id
        self.employeeId = employeeId
        self.timestamp = timestamp
        self.latitude = latitude
        self.longitude = longitude
        self.photoUri = photoUri
        self.type = type
    }

    public var date: Date {
        Date(timeIntervalSince1970: TimeInterval(timestamp) / 1000.0)
    }
}
