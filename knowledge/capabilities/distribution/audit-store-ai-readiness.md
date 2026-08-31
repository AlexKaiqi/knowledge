---
type: Capability
title: 审计公开商店 AI readiness
description: 对一个 bare public domain 执行无账号、无 Provider key、零 AI 调用的时点 readiness 审计。
tags: [distribution, ecommerce, ai-readiness, geo, aeo, public-site, read]
outcomes: [distribution, product-research]
generated: { by: connector:optifeed-radar-ai-readiness, at: 2026-08-31T15:23:02.625Z }
verified:
  - { by: probe:optifeed-radar-ai-readiness-live-20260831, at: 2026-08-31T15:57:28.081Z }
status: experimental
stale_after: 2026-09-07T15:57:28.081Z
sources:
  - id: subject
    resource: ../../tools/optifeed-radar.md
    title: Optifeed Radar
    author: organization:optifeed
  - id: upstream-readme
    resource: https://github.com/optifeed/optifeed-radar/blob/2e0af8990de6914eefe4665bfe98f5d5c5e9e81b/README.md
    title: Optifeed Radar README at reviewed revision
    author: organization:optifeed
  - id: upstream-methodology
    resource: https://github.com/optifeed/optifeed-radar/blob/2e0af8990de6914eefe4665bfe98f5d5c5e9e81b/METHODOLOGY.md
    title: Optifeed Radar methodology at reviewed revision
    author: organization:optifeed
  - id: live-report
    resource: ../../verifications/distribution/ai-readiness-audit/report.json
    title: Optifeed Radar AI readiness live verification
    author: probe:optifeed-radar-ai-readiness-live
capability:
  id: distribution.audit-store-ai-readiness
  version: 1.0.0
  subjectRef: /tools/optifeed-radar.md
  kind: query
  effect: none
  inputSchema: /schemas/distribution/audit-store-ai-readiness-input.schema.json
  outputSchema: /schemas/distribution/audit-store-ai-readiness-output.schema.json
  resultConcepts: [/concepts/distribution/ai-readiness-audit.md]
  executionCharacteristics:
    determinism: nondeterministic
    humanReview: required
    agentInvolvement: none
access:
  class: public
  methods: [cli]
  accountRequired: false
  durableRetention: restricted
  authorizationNotes: 只读取调用者指定的公开 HTTPS hostname；不接受 URL、路径、端口、IP 或凭据。每次请求与重定向都拒绝内网/本地/保留 DNS 结果。Provider key、AI engine call 与付费 Radar 能力不在本 handler 内。
verification:
  level: live
  report: /verifications/distribution/ai-readiness-audit/report.json
---

# 审计公开商店 AI readiness

输入仅有一个 bare public DNS hostname。Connector 固定已审阅的 Radar `0.3.0` 源码 revision，执行公开站点 readiness audit，输出五类加权技术分项、发现项、crawler root access 与明确的测量边界。

结果只支持上线前技术检查和分发准备决策。它不访问 AI Provider、不消耗 API credit，不生成 buyer questions，不测品牌/商品推荐、不做持续监控，也不证明 crawler 实际抓取或 AI 系统使用了页面。一次 100 分只表示当次采样满足上游 readiness 规则。

2026-08-31 live probe 通过安全包装真实审计 `optifeed.com`，返回 readiness 100、五个分项和九个 crawler access 项；公共 Schema、精确 domain、零费用、零 Provider 调用、runtime/secret 最小化与 readiness/visibility 区分全部通过。当前只验证一个公网 fixture，保持 experimental 并七天复验。

独立克隆本仓库后的正式 CLI 复现路径：

```sh
source ~/.nvm/nvm.sh
nvm use 24.17.0
npm ci
npm run distribution:ai-readiness:bootstrap
npm run distribution:ai-readiness:audit -- optifeed.com
```

`bootstrap` 只在 Git 忽略的 `.runtime/optifeed-radar` 中检出已审阅 commit，核对 package identity，运行上游完整 check、格式检查和 build。`audit` 接受一个 bare public domain，并在输出前同时验证产品输入与输出 Schema；可用 `OPTIFEED_RADAR_ROOT` 显式覆盖隐藏 runtime 路径。

- [输入 Schema](../../schemas/distribution/audit-store-ai-readiness-input.schema.json)
- [输出 Schema](../../schemas/distribution/audit-store-ai-readiness-output.schema.json)
- [验证报告](../../verifications/distribution/ai-readiness-audit/report.json)
