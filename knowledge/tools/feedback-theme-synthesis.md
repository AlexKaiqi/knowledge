---
type: Tool
title: 反馈主题证据归纳器
description: 从调用者授权、去身份化且有界的反馈证据样本生成带支持项、反例、冲突、缺口和下一步 probe 的待人审主题。
tags: [feedback, themes, evidence, counterexample, agentic, decision-support]
generated: { by: connector:feedback-theme-synthesis-agent, at: 2026-08-27T02:43:34Z }
verified:
  - { by: probe:feedback-theme-synthesis-local-20260827, at: 2026-08-27T02:43:34Z }
status: experimental
stale_after: 2026-09-10T02:43:34Z
sources:
  - id: production-learning-loop
    resource: https://github.com/AlexKaiqi/dsh-social-workbench/blob/0bb63b6f6963992e121d719f9a671637f6ab6c7f/runtime/src/loop-control.mjs
    title: dsh-social-workbench feedback learning loop
    author: organization:alex-kaiqi
  - id: local-verification
    resource: ../verifications/feedback/theme-synthesis/report.json
    title: Feedback theme synthesis local verification
    author: probe:feedback-theme-synthesis-local
---

# 反馈主题证据归纳器

这个 Agent 工具接收一份调用者有权处理、已去身份化且最多 100 项的反馈证据样本。它按用户工作流、问题、后果和 workaround 归纳主题，不按关键词堆词频，也不把功能请求直接当需求结论。

每个主题必须回链 supporting evidence refs，并显式保留 counterevidence、冲突、未分配证据和信息缺口。支持数与总样本数由结果规范化层重新计算，固定标记 `sample-only`；Agent 不能提供市场比例、用户总体频率或因果结论。

输出永远要求人工审阅且不授权执行。它不抓取平台、不回复用户、不创建 issue、不改变 roadmap、不发布修复。当前 probe 使用 scripted Agent 验证契约；真实 Agent 的主题质量、召回、稳定性与多语言表现尚未完成 L3 eval。

- [归纳反馈主题证据](../capabilities/feedback/synthesize-feedback-theme-evidence.md)
- [Feedback Theme Evidence](../concepts/feedback/feedback-theme-evidence.md)
