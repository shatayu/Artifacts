import Foundation
@preconcurrency import WebKit

@MainActor
final class CoworkBridge: NSObject, WKScriptMessageHandler {
    static let messageHandlerName = "coworkQuery"

    static let injectedJavaScript = """
    (function() {
      window._coworkPending = window._coworkPending || {};
      window.cowork = {
        callMcpTool: function(tool, args) {
          return new Promise(function(resolve, reject) {
            var id = (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID())
              || (Date.now().toString(36) + Math.random().toString(36).slice(2));
            window._coworkPending[id] = { resolve: resolve, reject: reject };
            window.webkit.messageHandlers.\(messageHandlerName).postMessage({
              id: id,
              tool: tool,
              args: args || {}
            });
          });
        }
      };
      window._coworkResolve = function(id, ok, payload) {
        var p = window._coworkPending[id];
        if (!p) return;
        delete window._coworkPending[id];
        if (ok) p.resolve(payload);
        else p.reject(new Error(typeof payload === 'string' ? payload : JSON.stringify(payload)));
      };
    })();
    """

    let artifactId: String
    weak var webView: WKWebView?

    init(artifactId: String) {
        self.artifactId = artifactId
        super.init()
    }

    func loadArtifactHTML() async {
        do {
            let api = try APIClient()
            let html = try await api.fetchHTML(id: artifactId)
            webView?.loadHTMLString(html, baseURL: api.baseURL)
        } catch {
            let safe = error.localizedDescription
                .replacingOccurrences(of: "<", with: "&lt;")
                .replacingOccurrences(of: ">", with: "&gt;")
            let errorHTML = """
            <html><body style="font-family:-apple-system;padding:20px;">
            <h2>Couldn't load artifact</h2>
            <p style="color:#666">\(safe)</p>
            </body></html>
            """
            webView?.loadHTMLString(errorHTML, baseURL: nil)
        }
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.messageHandlerName else { return }

        let body = message.body as? [String: Any] ?? [:]
        guard let id = body["id"] as? String,
              let tool = body["tool"] as? String
        else { return }

        let args = body["args"] as? [String: Any] ?? [:]

        if tool == "mcp__hamster-db__query" {
            let sql = args["sql"] as? String ?? ""
            Task { await self.handleHamsterQuery(messageId: id, sql: sql) }
        } else {
            Task {
                await self.respond(
                    messageId: id,
                    success: false,
                    payloadJSON: Self.jsonStringLiteral("unsupported tool: \(tool)")
                )
            }
        }
    }

    private func handleHamsterQuery(messageId: String, sql: String) async {
        do {
            let api = try APIClient()
            let serverData = try await api.runQuery(artifactId: artifactId, sql: sql)
            let parsed = (try? JSONSerialization.jsonObject(with: serverData)) as? [String: Any] ?? [:]
            let rows = (parsed["rows"] as? [[String: Any]]) ?? []
            let rowsData = (try? JSONSerialization.data(withJSONObject: rows)) ?? Data("[]".utf8)
            let rowsText = String(data: rowsData, encoding: .utf8) ?? "[]"

            let mcpResponse: [String: Any] = [
                "isError": false,
                "structuredContent": rows,
                "content": [["type": "text", "text": rowsText]]
            ]
            let mcpData = try JSONSerialization.data(withJSONObject: mcpResponse)
            let mcpJSON = String(data: mcpData, encoding: .utf8) ?? "{}"

            await respond(messageId: messageId, success: true, payloadJSON: mcpJSON)
        } catch {
            await respond(
                messageId: messageId,
                success: false,
                payloadJSON: Self.jsonStringLiteral(error.localizedDescription)
            )
        }
    }

    private func respond(messageId: String, success: Bool, payloadJSON: String) async {
        let safeId = messageId
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let okLiteral = success ? "true" : "false"
        let js = "window._coworkResolve('\(safeId)', \(okLiteral), \(payloadJSON))"

        // Use the callback-based API instead of `try await`. The async wrapper around
        // WKWebView.evaluateJavaScript force-unwraps the result and crashes when the
        // JavaScript expression evaluates to undefined/void (FB8718166 / SR-15243).
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            guard let webView else {
                continuation.resume()
                return
            }
            webView.evaluateJavaScript(js) { _, error in
                if let error {
                    print("CoworkBridge.respond JS error: \(error)")
                }
                continuation.resume()
            }
        }
    }

    private static func jsonStringLiteral(_ s: String) -> String {
        let escaped = s
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
        return "\"\(escaped)\""
    }
}
