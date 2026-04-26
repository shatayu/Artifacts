import SwiftUI

struct ArtifactCard: View {
    let artifact: Artifact

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(artifact.name)
                .font(.headline)
                .foregroundStyle(.primary)
            if let description = artifact.description, !description.isEmpty {
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
        }
        .padding(.vertical, 4)
    }
}
