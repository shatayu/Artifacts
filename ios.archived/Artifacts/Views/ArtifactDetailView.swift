import SwiftUI

struct ArtifactDetailView: View {
    let artifact: Artifact

    var body: some View {
        ArtifactWebView(artifact: artifact)
            .ignoresSafeArea(edges: .bottom)
            .navigationTitle(artifact.name)
            .navigationBarTitleDisplayMode(.inline)
    }
}
