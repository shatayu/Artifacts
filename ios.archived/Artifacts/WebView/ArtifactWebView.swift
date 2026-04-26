import SwiftUI
@preconcurrency import WebKit

struct ArtifactWebView: UIViewRepresentable {
    let artifact: Artifact

    func makeCoordinator() -> CoworkBridge {
        CoworkBridge(artifactId: artifact.id)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()

        let userScript = WKUserScript(
            source: CoworkBridge.injectedJavaScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(userScript)
        configuration.userContentController.add(
            context.coordinator,
            name: CoworkBridge.messageHandlerName
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.scrollView.bounces = true
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground

        context.coordinator.webView = webView

        Task { @MainActor in
            await context.coordinator.loadArtifactHTML()
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: CoworkBridge) {
        uiView.configuration.userContentController.removeScriptMessageHandler(
            forName: CoworkBridge.messageHandlerName
        )
    }
}
