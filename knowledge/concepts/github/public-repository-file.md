---
type: Concept
title: GitHub 公共仓库文件
description: GitHub 公共仓库中由完整提交 ID 固定、具有内容完整性标识的有界 UTF-8 文件。
tags: [github, repository, file, immutable-revision, integrity]
generated: { by: connector:github-public-repository-file, at: 2026-08-26T17:54:29Z }
verified:
  - { by: probe:github-public-repository-file-live-20260826, at: 2026-08-26T17:54:29Z }
status: stable
stale_after: 2026-09-02T17:54:29Z
sources:
  - id: platform
    resource: ../../platforms/github.md
    title: GitHub
    author: organization:github
  - id: live-snapshot
    resource: ../../verifications/github/public-repository-file/snapshot.json
    title: Normalized live observation
    author: connector:github-public-repository-file
---

# GitHub 公共仓库文件

该概念表示公共仓库在一个完整 Git commit ID 下的单个普通文件。它包含仓库、路径、revision、Git blob ID、字节长度、规范网页地址、UTF-8 正文和正文 SHA-256；因此调用者可以区分“路径相同但内容已变”和“同一不可变对象”。

它不表示目录、分支当前值、私有内容、Git LFS 对象或任意大小的二进制文件。当前 Connector 只接受 40 位小写完整 commit ID，并把文件限制为 256 KiB、有效 UTF-8 且不含 NUL 字节。

公开可读取不等于具有再分发或商用许可。GitHub API 返回的文件内容仍受对应仓库许可证、作者权利、平台条款和删除状态约束；`gitBlobId` 与 SHA-256 只证明内容身份，不证明许可。
