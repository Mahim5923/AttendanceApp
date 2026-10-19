import SwiftUI

@main
public struct AttendProApp: App {
    @StateObject private var firebase = FirebaseService.shared

    public init() {}

    public var body: some Scene {
        WindowGroup {
            if firebase.currentUserEmail != nil {
                if firebase.isAdmin {
                    // Admin View or Main Employee View
                    MainEmployeeView()
                } else {
                    MainEmployeeView()
                }
            } else {
                LoginView()
            }
        }
    }
}
