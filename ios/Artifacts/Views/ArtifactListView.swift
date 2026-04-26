import SwiftUI

struct ArtifactListView: View {
    @State private var artifacts: [Artifact] = []
    @State private var loadError: String?
    @State private var hasLoaded = false

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Artifacts")
                .navigationDestination(for: Artifact.self) { artifact in
                    ArtifactDetailView(artifact: artifact)
                }
                .refreshable { await load() }
                .task { await load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let error = loadError, artifacts.isEmpty {
            errorState(error)
        } else if !hasLoaded {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if artifacts.isEmpty {
            emptyState
        } else {
            list
        }
    }

    private var list: some View {
        List {
            ForEach(artifacts) { artifact in
                NavigationLink(value: artifact) {
                    ArtifactCard(artifact: artifact)
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "tray")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("No pinned artifacts")
                .foregroundStyle(.secondary)
            Text("Star artifacts in Cowork to see them here.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("Couldn't load artifacts")
                .font(.headline)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button("Retry") {
                Task { await load() }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private func load() async {
        do {
            let api = try APIClient()
            artifacts = try await api.listArtifacts()
            loadError = nil
        } catch {
            loadError = error.localizedDescription
        }
        hasLoaded = true
    }
}
