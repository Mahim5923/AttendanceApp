import SwiftUI

public struct ChatView: View {
    public let chatPartnerId: String
    public let chatPartnerName: String

    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode
    @State private var messageText: String = ""

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    public init(chatPartnerId: String, chatPartnerName: String) {
        self.chatPartnerId = chatPartnerId
        self.chatPartnerName = chatPartnerName
    }

    public var body: some View {
        let currentEmail = firebase.currentUserEmail?.lowercased() ?? ""
        let partnerLower = chatPartnerId.lowercased()

        // Filter conversation (matches Android ChatScreen)
        let conversation = firebase.messages.filter { msg in
            let sender = msg.senderId.lowercased()
            let receiver = msg.receiverId.lowercased()
            return (sender == currentEmail && receiver == partnerLower) ||
                   (sender == partnerLower && receiver == currentEmail) ||
                   (receiver == "all")
        }.sorted { $0.timestamp < $1.timestamp }

        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(conversation) { msg in
                            let isMine = msg.senderId.lowercased() == currentEmail

                            HStack {
                                if isMine {
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 2) {
                                        Text(msg.content)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 10)
                                            .background(primaryRed)
                                            .foregroundColor(.white)
                                            .cornerRadius(16)
                                        Text(Date(timeIntervalSince1970: TimeInterval(msg.timestamp) / 1000.0).formatted(date: .omitted, time: .shortened))
                                            .font(.caption2)
                                            .foregroundColor(.gray)
                                    }
                                } else {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(msg.content)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 10)
                                            .background(Color.gray.opacity(0.12))
                                            .foregroundColor(.black)
                                            .cornerRadius(16)
                                        Text(Date(timeIntervalSince1970: TimeInterval(msg.timestamp) / 1000.0).formatted(date: .omitted, time: .shortened))
                                            .font(.caption2)
                                            .foregroundColor(.gray)
                                    }
                                    Spacer()
                                }
                            }
                            .id(msg.id)
                            .padding(.horizontal, 16)
                        }
                    }
                    .padding(.vertical, 12)
                }
                .onChange(of: conversation.count) { _ in
                    if let last = conversation.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            // Bottom Input Bar (matches Android ChatScreen OutlinedTextField)
            HStack(spacing: 10) {
                TextField("Message...", text: $messageText)
                    .padding(.horizontal, 16)
                    .frame(height: 48)
                    .background(Color.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 24)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1.5)
                    )

                Button(action: sendMessage) {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 18))
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(messageText.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray.opacity(0.4) : primaryRed)
                        .clipShape(Circle())
                }
                .disabled(messageText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.white)
            .shadow(color: Color.black.opacity(0.04), radius: 4, y: -2)
        }
        .navigationTitle(chatPartnerName)
        .onAppear(perform: markUnreadMessagesAsRead)
    }

    private func sendMessage() {
        let text = messageText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty, let email = firebase.currentUserEmail else { return }

        let msg = ChatMessage(
            senderId: email,
            receiverId: chatPartnerId,
            content: text
        )

        messageText = ""
        firebase.sendMessage(message: msg) { _ in }
    }

    private func markUnreadMessagesAsRead() {
        let currentEmail = firebase.currentUserEmail?.lowercased() ?? ""
        let unread = firebase.messages.filter {
            $0.receiverId.lowercased() == currentEmail &&
            $0.senderId.lowercased() == chatPartnerId.lowercased() &&
            !$0.isRead
        }
        unread.forEach { msg in
            firebase.markMessageAsRead(messageId: msg.id) { _ in }
        }
    }
}
