# Steam store asset review revision

Hidden deterministic Connector for `/capabilities/steam/prepare-store-asset-review-revision.md`.

It reads a bounded Workspace-relative PNG/JPEG asset set, verifies the current Steam store capsule dimensions, requires the four base capsule kinds and at least five 16:9 gameplay screenshot slots, streams SHA-256 digests and produces an immutable revision for human visual review. It cannot verify artwork meaning, logo legibility, gameplay-only content, age suitability or rights from pixels, and it never uploads, marks a page ready for review or releases a product.
