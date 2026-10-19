import Foundation

public struct ChatMessage: Identifiable, Codable {
    public var id: String
    public var senderId: String
    public var receiverId: String
    public var content: String
    public var timestamp: Int64
    public var isRead: Bool

    public init(
        id: String = UUID().uuidString,
        senderId: String,
        receiverId: String,
        content: String,
        timestamp: Int64 = Int64(Date().timeIntervalSince1970 * 1000),
        isRead: Bool = false
    ) {
        self.id = id
        self.senderId = senderId
        self.receiverId = receiverId
        self.content = content
        self.timestamp = timestamp
        self.isRead = isRead
    }
}
