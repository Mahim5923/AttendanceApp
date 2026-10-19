import Foundation
import Combine

#if canImport(FirebaseCore)
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore
#endif

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
        // Mock mode for building without Cocoapods installed
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

        // Settings listener
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

        // Attendances listener
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

        // Leave Requests
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
        #endif
    }

    public func addAttendance(attendance: Attendance, completion: @escaping (Error?) -> Void) {
        #if canImport(FirebaseFirestore)
        guard let db = self.db else { return }
        let data: [String: Any] = [
            "id": attendance.id,
            "employeeId": attendance.employeeId,
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
            "employeeId": req.employeeId,
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
}
