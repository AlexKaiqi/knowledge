---
type: Tool
title: 反馈接收本地撤回器
description: 以准确 Storage Receipt 和可信撤回授权，从预配置私有本地 store 逻辑删除反馈记录并签发可恢复的幂等回执。
tags: [feedback, intake, withdrawal, local-delete, receipt, recovery]
generated: { by: connector:feedback-intake-local-withdrawal, at: 2026-08-27T10:03:30.907Z }
verified:
  - { by: probe:feedback-intake-local-withdrawal-local-20260827, at: 2026-08-27T10:03:30.907Z }
status: experimental
stale_after: 2026-09-26T10:03:30.907Z
sources:
  - id: node-filesystem-api
    resource: https://nodejs.org/api/fs.html
    title: Node.js File system API
    author: organization:nodejs
  - id: w3c-privacy-principles
    resource: https://www.w3.org/TR/privacy-principles/
    title: Privacy Principles
    author: organization:w3c
  - id: nist-media-sanitization
    resource: https://csrc.nist.gov/pubs/sp/800/88/r2/final
    title: Guidelines for Media Sanitization
    author: organization:nist
  - id: local-verification
    resource: ../verifications/feedback/intake-local-withdrawal/report.json
    title: Feedback intake local withdrawal verification
    author: probe:feedback-intake-local-withdrawal-local
---

# 反馈接收本地撤回器

这是一个有副作用的本地工具。它在隐藏 Connector 内解析 storage receipt 对应的私有记录，校验内容摘要和撤回机制，并通过可信 grant verifier 核对精确授权。公开参数没有路径、反馈正文、内部文件名或自报审批字段。

工具先持久化恢复 journal，再删除记录并提交独立撤回回执；中断和准确并发可以幂等恢复。journal 不保留反馈正文，只保留对账所需 refs、摘要、授权回执和效果状态。

该工具只执行逻辑删除，不做介质擦除、备份清理、下游副本传播、平台回复或知识删除。当前真实文件操作已验证，但生产授权签发器尚未接入。

- [撤回经同意的反馈接收记录](../capabilities/feedback/withdraw-consented-intake-record.md)
- [Feedback Intake Withdrawal Receipt](../concepts/feedback/feedback-intake-withdrawal-receipt.md)
