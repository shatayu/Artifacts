import Foundation

struct Artifact: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let description: String?
    let versionTs: Int64

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case versionTs = "version_ts"
    }
}
