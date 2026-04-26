import Foundation

enum APIError: LocalizedError {
    case missingConfig
    case badStatus(Int, String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .missingConfig:
            return "API_BASE_URL or API_KEY missing in Info.plist"
        case .badStatus(let code, let body):
            return "API \(code): \(body)"
        case .invalidResponse:
            return "Invalid response"
        }
    }
}

struct APIClient {
    let baseURL: URL
    let apiKey: String

    init() throws {
        let info = Bundle.main.infoDictionary ?? [:]
        guard let urlString = info["API_BASE_URL"] as? String,
              let url = URL(string: urlString),
              let key = info["API_KEY"] as? String,
              !key.isEmpty
        else {
            throw APIError.missingConfig
        }
        self.baseURL = url
        self.apiKey = key
    }

    func listArtifacts() async throws -> [Artifact] {
        let request = makeRequest(path: "/artifacts")
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode([Artifact].self, from: data)
    }

    func fetchHTML(id: String) async throws -> String {
        let request = makeRequest(path: "/artifacts/\(id)/html")
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return String(data: data, encoding: .utf8) ?? ""
    }

    func runQuery(artifactId: String, sql: String) async throws -> Data {
        var request = makeRequest(path: "/artifacts/\(artifactId)/query")
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["sql": sql])
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return data
    }

    private func makeRequest(path: String) -> URLRequest {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        return request
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw APIError.badStatus(http.statusCode, body)
        }
    }
}
