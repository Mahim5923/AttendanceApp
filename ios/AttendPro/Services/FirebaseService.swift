import Foundation
import Combine

#if canImport(FirebaseCore)
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore
#endif

public struct SalaryCalculationResult {
    public var baseSalary: Double
    public var totalWorkingDays: Int
    public var presentDays: Int
    public var approvedLeaveDays: Int
    public var absentDays: Int
    public var perDaySalary: Double
    public var deduction: Double
    public var netSalary: Double

    public init(
        baseSalary: Double = 0.0,
        totalWorkingDays: Int = 0,
        presentDays: Int = 0,
        approvedLeaveDays: Int = 0,
        absentDays: Int = 0,
        perDaySalary: Double = 0.0,
        deduction: Double = 0.0,
        netSalary: Double = 0.0
    ) {
        self.baseSalary = baseSalary
        self.totalWorkingDays = totalWorkingDays
        self.presentDays = presentDays
        self.approvedLeaveDays = approvedLeaveDays
        self.absentDays = absentDays
        self.perDaySalary = perDaySalary
        self.deduction = deduction
        self.netSalary = netSalary
    }
}

public class FirebaseService: ObservableObject {
    public static let shared = FirebaseService()

    @Published public var currentUserEmail: String? = nil
    @Published public var isAdmin: Bool = false
    @Published public var attendances: [Attendance] = []
    @Published public var employeeSettings: [EmployeeSettings] = []
    @Published public var leaveRequests: [LeaveRequest] = []
    @Published public var messages: [ChatMessage] = []

    #if canImport(FirebaseFirestore)
    private var db: Firestore?
    private var attendancesListener: ListenerRegistration?
    private var settingsListener: ListenerRegistration?
    private var leavesListener: ListenerRegistration?
    private var messagesListener: ListenerRegistration?
    #endif

    private init() {
        #if canImport(FirebaseCore)
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
        setupFirestore()
        #endif
    }

    private func setupFirestore() {
        #if canImport(FirebaseFirestore)
        if let app = FirebaseApp.app() {
            self.db = Firestore.firestore(app: app, database: "attend")
        } else {
            self.db = Firestore.firestore()
        }
        #endif
    }

    public func login(email: String, pass: String, completion: @escaping (Result<Void, Error>) -> Void) {
        #if canImport(FirebaseAuth)
        Auth.auth().signIn(withEmail: email, password: pass) { [weak self] result, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let self = self, let user = result?.user else { return }
            let emailLower = (user.email ?? email).lowercased()
            self.currentUserEmail = emailLower
            self.isAdmin = emailLower == "admin" || emailLower == "mahimsinhsingoria@gmail.com"
            self.attachListeners()
            completion(.success(()))
        }
        #else
        let emailLower = email.lowercased()
        self.currentUserEmail = emailLower
        self.isAdmin = emailLower == "admin" || emailLower == "mahimsinhsingoria@gmail.com"
        completion(.success(()))
        #endif
    }

    public func signUp(email: String, pass: String, completion: @escaping (Result<Void, Error>) -> Void) {
        #if canImport(FirebaseAuth)
        Auth.auth().createUser(withEmail: email, password: pass) { [weak self] result, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let self = self, let user = result?.user else { return }
            let emailLower = (user.email ?? email).lowercased()
            self.currentUserEmail = emailLower
            self.isAdmin = emailLower == "admin" || emailLower == "mahimsinhsingoria@gmail.com"
            self.attachListeners()
            completion(.success(()))
        }
        #else
        let emailLower = email.lowercased()
        self.currentUserEmail = emailLower
        self.isAdmin = emailLower == "admin" || emailLower == "mahimsinhsingoria@gmail.com"
        completion(.success(()))
        #endif
    }

    public func logout() {
        #if canImport(FirebaseAuth)
        try? Auth.auth().signOut()
        #endif
        self.currentUserEmail = nil
        self.isAdmin = false
        #if canImport(FirebaseFirestore)
        attendancesListener?.remove()
        settingsListener?.remove()
        leavesListener?.remove()
        messagesListener?.remove()
        #endif
        self.attendances = []
        self.employeeSettings = []
        self.leaveRequests = []
        self.messages = []
    }

    public func attachListeners() {
        #if canImport(FirebaseFirestore)
        guard let db = self.db, let email = currentUserEmail else { return }

        // 1. Settings listener
        settingsListener = db.collection("settings").addSnapshotListener { [weak self] snapshot, error in
            guard let self = self, let docs = snapshot?.documents else { return }
            self.employeeSettings = docs.compactMap { doc -> EmployeeSettings? in
                let d = doc.data()
                return EmployeeSettings(
                    employeeId: d["employeeId"] as? String ?? doc.documentID,
                    displayName: d["displayName"] as? String ?? "",
                    profilePhotoUri: d["profilePhotoUri"] as? String ?? "",
                    baseSalary: d["baseSalary"] as? Double ?? 0.0,
                    checkInTimeHours: d["checkInTimeHours"] as? Int ?? 9,
                    checkInTimeMinutes: d["checkInTimeMinutes"] as? Int ?? 0,
                    checkOutTimeHours: d["checkOutTimeHours"] as? Int ?? 17,
                    checkOutTimeMinutes: d["checkOutTimeMinutes"] as? Int ?? 0,
                    weekOffs: d["weekOffs"] as? [Int] ?? [1, 7],
                    targetLatitude: d["targetLatitude"] as? Double ?? 0.0,
                    targetLongitude: d["targetLongitude"] as? Double ?? 0.0,
                    targetRadiusMeters: d["targetRadiusMeters"] as? Double ?? 100.0
                )
            }
        }

        // 2. Attendances listener
        let attQuery = isAdmin ? db.collection("attendances") : db.collection("attendances").whereField("employeeId", isEqualTo: email)
        attendancesListener = attQuery.addSnapshotListener { [weak self] snapshot, error in
            guard let self = self, let docs = snapshot?.documents else { return }
            self.attendances = docs.compactMap { doc -> Attendance? in
                let d = doc.data()
                let typeStr = d["type"] as? String ?? "IN"
                return Attendance(
                    id: doc.documentID,
                    employeeId: d["employeeId"] as? String ?? "",
                    timestamp: d["timestamp"] as? Int64 ?? 0,
                    latitude: d["latitude"] as? Double ?? 0.0,
                    longitude: d["longitude"] as? Double ?? 0.0,
                    photoUri: d["photoUri"] as? String ?? "",
                    type: AttendanceType(rawValue: typeStr) ?? .IN
                )
            }.sorted { $0.timestamp > $1.timestamp }
        }

        // 3. Leave Requests listener
        let leaveQuery = isAdmin ? db.collection("leaveRequests") : db.collection("leaveRequests").whereField("employeeId", isEqualTo: email)
        leavesListener = leaveQuery.addSnapshotListener { [weak self] snapshot, error in
            guard let self = self, let docs = snapshot?.documents else { return }
            self.leaveRequests = docs.compactMap { doc -> LeaveRequest? in
                let d = doc.data()
                let statusStr = d["status"] as? String ?? "PENDING"
                return LeaveRequest(
                    id: doc.documentID,
                    employeeId: d["employeeId"] as? String ?? "",
                    dateTimestamp: d["dateTimestamp"] as? Int64 ?? 0,
                    reason: d["reason"] as? String ?? "",
                    status: LeaveStatus(rawValue: statusStr) ?? .PENDING,
                    requestedAtTimestamp: d["requestedAtTimestamp"] as? Int64 ?? 0
                )
            }.sorted { $0.requestedAtTimestamp > $1.requestedAtTimestamp }
        }

        // 4. Messages listener
        messagesListener = db.collection("messages").addSnapshotListener { [weak self] snapshot, error in
            guard let self = self, let docs = snapshot?.documents else { return }
            self.messages = docs.compactMap { doc -> ChatMessage? in
                let d = doc.data()
                return ChatMessage(
                    id: doc.documentID,
                    senderId: d["senderId"] as? String ?? "",
                    receiverId: d["receiverId"] as? String ?? "",
                    content: d["content"] as? String ?? "",
                    timestamp: d["timestamp"] as? Int64 ?? 0,
                    isRead: d["isRead"] as? Bool ?? false
                )
            }.sorted { $0.timestamp < $1.timestamp }
        }
        #endif
    }

    public func getEmployeeSettings(employeeId: String) -> EmployeeSettings {
        let empLower = employeeId.lowercased()
        if let found = employeeSettings.first(where: { $0.employeeId.lowercased() == empLower }) {
            return found
        }
        return EmployeeSettings(
            employeeId: employeeId,
            displayName: employeeId.components(separatedBy: "@").first?.capitalized ?? employeeId,
            profilePhotoUri: "",
            baseSalary: 30000.0,
            checkInTimeHours: 9,
            checkInTimeMinutes: 0,
            checkOutTimeHours: 17,
            checkOutTimeMinutes: 0,
            weekOffs: [1, 7],
            targetLatitude: 0.0,
            targetLongitude: 0.0,
            targetRadiusMeters: 100.0
        )
    }

    public func saveEmployeeSettings(settings: EmployeeSettings, completion: @escaping (Error?) -> Void) {
        #if canImport(FirebaseFirestore)
        guard let db = self.db else { return }
        let data: [String: Any] = [
            "employeeId": settings.employeeId.lowercased(),
            "displayName": settings.displayName,
            "profilePhotoUri": settings.profilePhotoUri,
            "baseSalary": settings.baseSalary,
            "checkInTimeHours": settings.checkInTimeHours,
            "checkInTimeMinutes": settings.checkInTimeMinutes,
            "checkOutTimeHours": settings.checkOutTimeHours,
            "checkOutTimeMinutes": settings.checkOutTimeMinutes,
            "weekOffs": settings.weekOffs,
            "targetLatitude": settings.targetLatitude,
            "targetLongitude": settings.targetLongitude,
            "targetRadiusMeters": settings.targetRadiusMeters
        ]
        db.collection("settings").document(settings.employeeId.lowercased()).setData(data, merge: true, completion: completion)
        #else
        if let idx = employeeSettings.firstIndex(where: { $0.employeeId.lowercased() == settings.employeeId.lowercased() }) {
            employeeSettings[idx] = settings
        } else {
            employeeSettings.append(settings)
        }
        completion(nil)
        #endif
    }

    // Android MainScreenViewModel.validateAttendance logic
    public func validateAttendance(type: AttendanceType) -> String? {
        guard let email = currentUserEmail else { return "Please log in first." }
        let userAtts = attendances.filter { $0.employeeId.lowercased() == email.lowercased() }
        let settings = getEmployeeSettings(employeeId: email)

        let calendar = Calendar.current
        let now = Date()

        // 1. Check if already marked today
        let hasMarkedToday = userAtts.contains { att in
            att.type == type && calendar.isDateInToday(att.date)
        }
        if hasMarkedToday {
            return "You have already marked \(type.rawValue) today."
        }

        // 2. Check week off (1 = Sunday, 7 = Saturday)
        let weekday = calendar.component(.weekday, from: now)
        if settings.weekOffs.contains(weekday) {
            return "You cannot mark attendance on your week off."
        }

        // 3. Validate time window (within 1 hour of scheduled time)
        var scheduledComponents = calendar.dateComponents([.year, .month, .day], from: now)
        if type == .IN {
            scheduledComponents.hour = settings.checkInTimeHours
            scheduledComponents.minute = settings.checkInTimeMinutes
        } else {
            scheduledComponents.hour = settings.checkOutTimeHours
            scheduledComponents.minute = settings.checkOutTimeMinutes
        }
        scheduledComponents.second = 0

        if let scheduledDate = calendar.date(from: scheduledComponents) {
            let diffSeconds = abs(now.timeIntervalSince(scheduledDate))
            let diffHours = diffSeconds / 3600.0
            if diffHours > 1.0 {
                let formattedTime = String(format: "%02d:%02d",
                    type == .IN ? settings.checkInTimeHours : settings.checkOutTimeHours,
                    type == .IN ? settings.checkInTimeMinutes : settings.checkOutTimeMinutes
                )
                return "You can only mark \(type.rawValue) within 1 hour of your scheduled time (\(formattedTime))."
            }
        }

        return nil
    }

    // Android MainScreenViewModel.calculateSalaryForEmployee logic
    public func calculateSalaryForEmployee(employeeId: String, year: Int? = nil, month: Int? = nil) -> SalaryCalculationResult {
        let calendar = Calendar.current
        let now = Date()
        let targetYear = year ?? calendar.component(.year, from: now)
        let targetMonth = month ?? calendar.component(.month, from: now) // 1-indexed

        let settings = getEmployeeSettings(employeeId: employeeId)
        let baseSalary = settings.baseSalary > 0 ? settings.baseSalary : 30000.0

        var dateComponents = DateComponents()
        dateComponents.year = targetYear
        dateComponents.month = targetMonth
        guard let monthDate = calendar.date(from: dateComponents),
              let range = calendar.range(of: .day, in: .month, for: monthDate) else {
            return SalaryCalculationResult(baseSalary: baseSalary)
        }

        let daysInMonth = range.count
        var totalWorkingDays = 0
        for day in 1...daysInMonth {
            var comp = DateComponents()
            comp.year = targetYear
            comp.month = targetMonth
            comp.day = day
            if let d = calendar.date(from: comp) {
                let weekday = calendar.component(.weekday, from: d)
                if !settings.weekOffs.contains(weekday) {
                    totalWorkingDays += 1
                }
            }
        }

        let empLower = employeeId.lowercased()
        let userAtts = attendances.filter { att in
            if att.employeeId.lowercased() != empLower { return false }
            let y = calendar.component(.year, from: att.date)
            let m = calendar.component(.month, from: att.date)
            return y == targetYear && m == targetMonth
        }

        var presentDaySet = Set<Int>()
        userAtts.forEach { att in
            presentDaySet.insert(calendar.component(.day, from: att.date))
        }
        let presentDays = presentDaySet.count

        let userLeaves = leaveRequests.filter { req in
            if req.employeeId.lowercased() != empLower || req.status != .APPROVED { return false }
            let d = Date(timeIntervalSince1970: TimeInterval(req.dateTimestamp) / 1000.0)
            let y = calendar.component(.year, from: d)
            let m = calendar.component(.month, from: d)
            return y == targetYear && m == targetMonth
        }
        let approvedLeaveDays = userLeaves.count

        let effectivePresent = min(totalWorkingDays, presentDays + approvedLeaveDays)
        let absentDays = max(0, totalWorkingDays - effectivePresent)
        let perDaySalary = totalWorkingDays > 0 ? baseSalary / Double(totalWorkingDays) : 0.0
        let deduction = Double(absentDays) * perDaySalary
        let netSalary = max(0.0, baseSalary - deduction)

        return SalaryCalculationResult(
            baseSalary: baseSalary,
            totalWorkingDays: totalWorkingDays,
            presentDays: presentDays,
            approvedLeaveDays: approvedLeaveDays,
            absentDays: absentDays,
            perDaySalary: perDaySalary,
            deduction: deduction,
            netSalary: netSalary
        )
    }

    public func getAllEmployees() -> [String] {
        let fromSettings = employeeSettings.map { $0.employeeId.lowercased() }
        let fromAtts = attendances.map { $0.employeeId.lowercased() }.filter { $0 != "admin" }
        return Array(Set(fromSettings + fromAtts)).sorted()
    }

    public func addAttendance(attendance: Attendance, completion: @escaping (Error?) -> Void) {
        #if canImport(FirebaseFirestore)
        guard let db = self.db else { return }
        let data: [String: Any] = [
            "id": attendance.id,
            "employeeId": attendance.employeeId.lowercased(),
            "timestamp": attendance.timestamp,
            "latitude": attendance.latitude,
            "longitude": attendance.longitude,
            "photoUri": attendance.photoUri,
            "type": attendance.type.rawValue
        ]
        db.collection("attendances").document(attendance.id).setData(data, completion: completion)
        #else
        self.attendances.insert(attendance, at: 0)
        completion(nil)
        #endif
    }

    public func addLeaveRequest(req: LeaveRequest, completion: @escaping (Error?) -> Void) {
        #if canImport(FirebaseFirestore)
        guard let db = self.db else { return }
        let data: [String: Any] = [
            "id": req.id,
            "employeeId": req.employeeId.lowercased(),
            "dateTimestamp": req.dateTimestamp,
            "reason": req.reason,
            "status": req.status.rawValue,
            "requestedAtTimestamp": req.requestedAtTimestamp
        ]
        db.collection("leaveRequests").document(req.id).setData(data, completion: completion)
        #else
        self.leaveRequests.insert(req, at: 0)
        completion(nil)
        #endif
    }

    public func updateLeaveStatus(id: String, status: LeaveStatus, completion: @escaping (Error?) -> Void) {
        #if canImport(FirebaseFirestore)
        guard let db = self.db else { return }
        db.collection("leaveRequests").document(id).updateData(["status": status.rawValue], completion: completion)
        #else
        if let idx = leaveRequests.firstIndex(where: { $0.id == id }) {
            leaveRequests[idx].status = status
        }
        completion(nil)
        #endif
    }

    public func sendMessage(message: ChatMessage, completion: @escaping (Error?) -> Void) {
        #if canImport(FirebaseFirestore)
        guard let db = self.db else { return }
        let data: [String: Any] = [
            "id": message.id,
            "senderId": message.senderId.lowercased(),
            "receiverId": message.receiverId.lowercased(),
            "content": message.content,
            "timestamp": message.timestamp,
            "isRead": message.isRead
        ]
        db.collection("messages").document(message.id).setData(data, completion: completion)
        #else
        self.messages.append(message)
        completion(nil)
        #endif
    }

    public func markMessageAsRead(messageId: String, completion: @escaping (Error?) -> Void) {
        #if canImport(FirebaseFirestore)
        guard let db = self.db else { return }
        db.collection("messages").document(messageId).updateData(["isRead": true], completion: completion)
        #else
        if let idx = messages.firstIndex(where: { $0.id == messageId }) {
            messages[idx].isRead = true
        }
        completion(nil)
        #endif
    }
}
