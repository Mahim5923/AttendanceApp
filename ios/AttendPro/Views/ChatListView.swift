import SwiftUI

public struct ChatListView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode
    @State private var selectedPartner: (id: String, name: String)? = nil

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    public init() {}

    public var body: some View {
        NavigationView {
            Group {
                let currentEmail = firebase.currentUserEmail?.lowercased() ?? ""
                let allUsers = firebase.getAllEmployees().filter { $0.lowercased() != currentEmail }

                if allUsers.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)
                        Text("No users to chat with.")
                            .foregroundColor(.gray)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(allUsers, id: \.self) { userId in
                            let settings = firebase.getEmployeeSettings(employeeId: userId)
                            let name = settings.displayName.isEmpty ? userId.components(separatedBy: "@").first?.capitalized ?? userId : settings.displayName

                            NavigationLink(destination: ChatView(chatPartnerId: userId, chatPartnerName: name)) {
                                HStack(spacing: 14) {
                                    Circle()
                                        .fill(primaryRed.opacity(0.12))
                                        .frame(width: 44, height: 44)
                                        .overlay(
                                            Text(String(name.prefix(1)).uppercased())
                                                .font(.system(size: 17, weight: .bold))
                                                .foregroundColor(primaryRed)
                                        )

                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(name)
                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundColor(.black)
                                        Text(userId)
                                            .font(.caption)
                                            .foregroundColor(.gray)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }
                    .listStyle(PlainListStyle())
                }
            }
            .navigationTitle("Chats")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }
}
