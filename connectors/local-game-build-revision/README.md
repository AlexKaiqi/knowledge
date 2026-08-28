# Local game build revision

Hidden deterministic Connector for `/capabilities/game/prepare-local-build-revision.md`.

It walks one Workspace-relative build directory, rejects boundary escapes, symlinks, special files and secret-like filenames, streams every regular file through SHA-256, validates target entrypoints and returns an immutable local revision. It does not archive, sign, upload, submit, set a branch live or create a platform receipt.
