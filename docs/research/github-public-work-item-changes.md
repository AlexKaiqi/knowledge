# GitHub 公共仓库 Work Item 变更接入调研

## 为什么排在这里

架构路线图 M3 在 RSS 之后明确要求 GitHub Issues 官方 API Connector。更直接的维护价值是：小红书与抖音开源项目目录已经把 `issue-change` 列为复审触发器，但此前自动信号只有 branch HEAD、release tag 和 ranked repository search，issue 仍依赖到期人工检查。该能力提供一个可复用、无身份、无副作用的增量观测原语。

## 官方契约

- [List repository issues](https://docs.github.com/en/rest/issues/issues?apiVersion=2026-03-10) 可在只请求公共资源时不带身份调用；支持 `state`、`sort`、`direction`、`since`、`per_page` 和 `page`。`since` 的语义是只返回在给定时间之后更新的结果，单页上限为 100。
- GitHub REST 把每个 pull request 同时视为 issue，因此同一 endpoint 会返回 issue 和 pull request；必须通过 `pull_request` 字段区分，不能把 PR 静默当成普通 issue，也不能在分页后随意过滤而冒充完整 issue 集合。
- [REST pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api?apiVersion=2026-03-10) 通过 `Link` header 的 `rel="next"` 暴露后续页。Connector 不跟随 header 中的任意 URL，而是只把它作为“还有下一页”的信号，随后重建固定官方 endpoint 的编号页。
- [REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2026-03-10) 当前说明匿名请求按来源 IP 计入每小时 60 次的 primary limit。Connector 输出 `core` bucket 状态，在耗尽后返回带 `retryAt` 的 typed error，且不重试。

## 开源实现证据

- `github/rest-api-description` 是 GitHub REST API 的官方 OpenAPI 描述；审阅 revision `6601e5ced001a05f4574552116ebcb276413eceb`，MIT。它用于观察 endpoint/response schema 漂移，但生成描述可能落后于部署行为，不能替代 live probe。
- `octokit/plugin-paginate-rest.js` 展示基于 `Link rel="next"` 的 REST iterator；审阅 revision `27411a02014add863308588113dd4d703bf3d165`，MIT。它是分页参考，不是 Connector runtime 依赖，也不解决可变结果排序或 checkpoint 语义。

Connector 没有引入 Octokit 依赖。固定 API 与有界循环足以实现当前单一 endpoint；少一层依赖也减少 token、默认重试、hook 和通用 endpoint 注入面。Collector 仍持续观察上述官方描述和分页参考，以便发现我们的实现假设是否落后。

## 公共抽象

公开 Capability 是“列出一个明确公共仓库在 checkpoint 之后的 Work Item 变更”，而不是“读取 GitHub Issues 原始 JSON”。输入只有：

- `owner`、`repository`；
- 上次输出的复合 `checkpoint`；
- 1–500 的 `maxItems`。

Connector 固定 `state=all&sort=updated&direction=asc`，最多读取 5 页，每页最多 100。输出将 issue 与 pull request 统一为 Work Item，但显式保留 `kind`；Concept 身份是 repository + number，且 API 返回的 PR number 是 issue number，不冒充 Pull Request API 的独立 ID。

## Checkpoint 设计

单纯保存 `updatedAt` 会在多个 Work Item 共享同一秒时间戳时丢失或永久重复。当前 checkpoint 保存：

```json
{
  "updatedAt": "2026-08-19T02:50:19.000Z",
  "seenItemDigests": [{ "number": 18, "digest": "..." }]
}
```

下一次请求从 checkpoint 前一秒开始，重读边界秒；同一 number + 同一语义 digest 被去重，同一秒内 digest 变化则重新输出。新 checkpoint 只在已返回 Work Item 上推进，因此截断窗口可以继续恢复。

这个模型比裸时间戳更可靠，但不是数据库快照：REST 列表在翻页期间仍可被并发更新，GitHub 的时间精度只有秒，超过 500 个同秒变更或同一项在一秒内多次变化仍可能无法重建所有中间状态。输出因此声明为 `bounded-composite-checkpoint`，只证明有界增量观测，不声称事件日志、exactly-once 或历史完整性。长期 Collector 仍应保留 item digest 去重，并做周期性重叠/基线复核。

## 数据最小化与安全

- 固定 `https://api.github.com/repos/{owner}/{repository}/issues` 和 API version `2026-03-10`；拒绝 alternate base URL、重定向、header/token 注入和失败重试。
- 每页最多 2 MiB，最多 5 个请求和 500 个输出项。
- 校验 API URL、HTML URL 和 repository identity 都留在请求的公开仓库。
- 保留 number、kind、公开 URL、state/state reason、title、label 名、comments count、locked 和生命周期时间。
- body 只保留 presence、Unicode 长度和 SHA-256；不保留正文。
- user、author、assignee、email、avatar、milestone creator、评论正文、timeline、raw payload、request ID 和凭据全部排除。
- body digest、label 与 title 是公开内容的变化证据，不代表事实正确、内容安全、许可证允许复用或项目缺陷已经复现。

## 当前 fixture 与维护策略

live probe 使用公开、低体量的 `tamnd/xiaohongshu-cli` 增量窗口，并验证 issue 18 的原生身份。该 fixture 与小红书 Collector 的真实研究对象一致，同时避免为 probe 制造账号或 Issue。

proposal-only Collector 每次串行检查三份官方文档、两个固定开源上游和 fixture window；分别处理规范语义漂移、上游 HEAD 漂移、窗口变化、分页预算不足、fixture 消失、限流与验证过期。它不会自动推进业务项目 checkpoint、接受 OpenAPI 变化、升级 SDK、创建 Issue 或修改 canonical OKF。

该 Capability 准入后，下一步再把小红书/抖音高优先级项目的 `issue-change` 从“到期人工 checklist”迁移为有界轮换消费；checkpoint 的推进仍需要 proposal review，不能由观察运行静默提交。
