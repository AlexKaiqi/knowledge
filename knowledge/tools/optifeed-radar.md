---
type: Tool
title: Optifeed Radar
description: 对公开商店站点执行零密钥、零 AI 调用的 point-in-time AI readiness 审计。
tags: [distribution, ecommerce, ai-readiness, geo, aeo, robots, structured-data]
generated: { by: connector:optifeed-radar-ai-readiness, at: 2026-08-31T15:23:02.625Z }
verified:
  - { by: probe:optifeed-radar-ai-readiness-live-20260831, at: 2026-08-31T15:57:28.081Z }
status: experimental
stale_after: 2026-09-07T15:57:28.081Z
sources:
  - id: upstream
    resource: https://github.com/optifeed/optifeed-radar/tree/2e0af8990de6914eefe4665bfe98f5d5c5e9e81b
    title: Optifeed Radar reviewed source revision
    author: organization:optifeed
  - id: upstream-readme
    resource: https://github.com/optifeed/optifeed-radar/blob/2e0af8990de6914eefe4665bfe98f5d5c5e9e81b/README.md
    title: Optifeed Radar README
    author: organization:optifeed
  - id: upstream-license
    resource: https://github.com/optifeed/optifeed-radar/blob/2e0af8990de6914eefe4665bfe98f5d5c5e9e81b/LICENSE
    title: Optifeed Radar MIT License
    author: organization:optifeed
  - id: live-report
    resource: ../verifications/distribution/ai-readiness-audit/report.json
    title: Optifeed Radar AI readiness live verification
    author: probe:optifeed-radar-ai-readiness-live
---

# Optifeed Radar

当前只准入 Radar `0.3.0` 的免费 readiness audit：读取公开 HTTPS 站点的 `robots.txt`、`llms.txt`、`llms-full.txt`、首页、`sitemap.xml` 和最多三张 sitemap 页面，返回 0–100 readiness 分数、五类分项、发现项与 AI crawler 根路径访问判断。

隐藏 Connector 固定到已检查的 Git commit，从独立源码 clone 加载 build；每次请求和重定向都重新解析 DNS、拒绝私网/本地/保留地址并将连接固定到已验证公网 IP。Provider key 不属于这个 handler，也不会传入 Radar。

未准入 Radar 的 `check`、`shopping`、buyer-query generation 或 snapshot diff。这些路线会使用第三方 Provider key、消费 API credit，并且与 readiness 是不同结果；在独立费用、身份、数据与 live probe 门完成前不得由 Gateway 选择。

- [审计公开商店 AI readiness](../capabilities/distribution/audit-store-ai-readiness.md)
- [AI Readiness Audit](../concepts/distribution/ai-readiness-audit.md)
