import Foundation

public struct EmployeeSettings: Identifiable, Codable {
    public var id: String { employeeId }
    public var employeeId: String
    public var displayName: String
    public var profilePhotoUri: String
    public var baseSalary: Double
    public var checkInTimeHours: Int
    public var checkInTimeMinutes: Int
    public var checkOutTimeHours: Int
    public var checkOutTimeMinutes: Int
    public var weekOffs: [Int] // 1 = Sunday, 7 = Saturday
    public var targetLatitude: Double
    public var targetLongitude: Double
    public var targetRadiusMeters: Double

    public init(
        employeeId: String = "",
        displayName: String = "",
        profilePhotoUri: String = "",
        baseSalary: Double = 0.0,
        checkInTimeHours: Int = 9,
        checkInTimeMinutes: Int = 0,
        checkOutTimeHours: Int = 17,
        checkOutTimeMinutes: Int = 0,
        weekOffs: [Int] = [1, 7],
        targetLatitude: Double = 0.0,
        targetLongitude: Double = 0.0,
        targetRadiusMeters: Double = 100.0
    ) {
        self.employeeId = employeeId
        self.displayName = displayName
        self.profilePhotoUri = profilePhotoUri
        self.baseSalary = baseSalary
        self.checkInTimeHours = checkInTimeHours
        self.checkInTimeMinutes = checkInTimeMinutes
        self.checkOutTimeHours = checkOutTimeHours
        self.checkOutTimeMinutes = checkOutTimeMinutes
        self.weekOffs = weekOffs
        self.targetLatitude = targetLatitude
        self.targetLongitude = targetLongitude
        self.targetRadiusMeters = targetRadiusMeters
    }
}
