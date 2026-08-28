# 反馈观察对账调研

状态：已吸收经同意的自有反馈接收 Revision、本地持久化 receipt、receipt-bound 逻辑撤回、policy/deadline/hold-bound 到期逻辑清理、本地对账底座、主题证据契约与首个 Steam 平台观测适配；生产授权签发与调度、介质/备份/下游删除及完整平台增量仍未证明
核验日期：2026-08-27

“收集反馈”至少包含四层，不能用一个万能评论 Schema 混在一起：自有反馈接收负责目的、通知、同意、隐私审阅、保留与撤回边界；平台读取负责分页、窗口、权限和外部 ID；观察对账负责 item-level mutation 与未知性；Agent 主题归纳负责从有界证据提出问题模式和反证。经同意的 intake review revision 与中间对账层已准入；Steam 现有首个窄上游适配，但仍只产生 partial window，不冒充完整增量。

`feedback.prepare-consented-intake-review-revision` 是“准备接收”而不是“已经收集”。它精确冻结 scope/product/form/notice revision、decision、purpose、逐字段内容摘要、consent evidence、其他人员数据声明、隐私审阅、删除期限和撤回机制；撤回/过期 consent、越界用途、字段漂移、身份/敏感信息未解决和超期保留会阻断。它不扫描 PII、不认证 consent 法律效力，也不自行存储或执行撤回/回复。

`feedback.persist-consented-intake-revision` 是独立的 `local-write` 能力。它只接受已验证 revision 的 ref/hash、预配置 store ref、可信 review grant ref 和幂等键；隐藏 Connector 重算 canonical revision，并核对授权是否精确绑定 capability/effect/store/revision。隔离 probe 已真实写入、同步、读回、并发重放和清理私有 envelope；receipt 绑定 revision、记录摘要、删除期限和撤回机制。它当前只使用 scripted trusted grant provider 证明接口契约，不能冒充生产人审 UI/授权签发器，也不证明删除或撤回已发生。

`feedback.withdraw-consented-intake-record` 再消费 storage receipt，以可信 withdrawal grant 精确绑定 store/receipt/digest/request/mechanism，经 durable pending journal 逻辑删除准确记录并提交独立 receipt。隔离 probe 已覆盖并发、unlink 前后中断恢复、篡改和伪授权拒绝。它明确不把 filesystem unlink 冒充 NIST media sanitization，也不声称备份、索引、分析集或外部平台副本已删除。

`feedback.expire-consented-intake-record` 与用户撤回保持独立。它重新核对 storage receipt、record digest、原始 retention policy/deadline 和当前时间；deadline 前不会请求 grant 或建立删除控制状态，deadline 后仍只接受精确绑定且返回 `disposition=delete`、`holdStatus=clear` 的可信 retention grant。隐藏库存只暴露无正文的 receipt/digest/policy/deadline，Collector 对 due 项仅生成待审 proposal。隔离 probe 在固定的 deadline 后一秒执行了真实文件 unlink/sync，并覆盖并发、post-unlink 恢复、active hold、篡改和越界路径拒绝；这证明本地逻辑删除契约，不证明生产 scheduler、法律适用性、介质擦除或备份/下游副本清除。

生产 Social Workbench 已证明反馈应该回链已发布对象、保存 source/evidence refs、使用 immutable ledger，并禁止跨平台身份归并；但其 append-only FeedbackItem 还不能表达同一外部评论的编辑、隐藏、删除或回复状态变化。本地对账能力以 opaque item ref 和 digest 补这一层，不复制正文和人员身份。

最重要的规则是“缺失不是删除”。评论可能因为分页、排序变化、时间窗、权限、审核、限流或来源故障暂时消失。只有上游明确给出 `deleted|hidden` tombstone，才能记录对应生命周期 mutation；否则保留 `missingUnresolved`。Checkpoint 同样只给 advance proposal，实际推进必须由采集事务在持久层原子完成。

后续能力按顺序是：

1. 独立持久化、receipt-bound 用户撤回与 retention-expiry 逻辑清理已完成三个本地窄闭环；下一步接真实 owner-bound review/withdrawal/retention grant、hold resolver 与 scheduler，但仍不得把 review revision、自报布尔值、Collector proposal 或 scripted probe grant 当生产授权。
2. 介质擦除、备份、索引、分析集和下游副本清除继续拆成有独立覆盖证据的能力；当前 withdrawal/retention deletion receipt 都不能代表这些结果。
3. Steam 已验证 recommendation ID、更新时间和语义摘要到 partial observation window 的投影；公开 route 没有证明 tombstone、reply state、窗口完整性或全局 checkpoint。App 评论、小红书自有评论等仍需逐路线验证。
4. 继续建立平台专属 ingestion，把原生证据映射到本能力输入并保存 observation provenance；只有来源证明 complete window 或显式 lifecycle 时，才能提升 checkpoint 与删除语义。
5. `feedback.synthesize-feedback-theme-evidence` 已完成 scripted-Agent 契约 probe：输入有界 evidence，输出主题、支持/反例、样本线索、置信与未知；真实 Agent L3 质量仍待验证，不得把样本频次外推为市场比例。
6. 回复、创建 issue、修改 roadmap 或发布修复继续是显式写操作，并与具体 revision/receipt 对账。

证据：

- W3C Privacy Principles：<https://www.w3.org/TR/privacy-principles/>
- ICO Storage limitation：<https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/>
- W3C Data Privacy Vocabulary：<https://www.w3.org/community/reports/dpvcg/CG-FINAL-dpv-20221205/>
- OWASP Logging Cheat Sheet：<https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Node.js File system API：<https://nodejs.org/api/fs.html>
- NIST SP 800-88 Rev. 2：<https://csrc.nist.gov/pubs/sp/800/88/r2/final>
- dsh-social-workbench FeedbackItem：<https://github.com/AlexKaiqi/dsh-social-workbench/blob/0bb63b6f6963992e121d719f9a671637f6ab6c7f/spec/feedback-item.schema.json>
- dsh-social-workbench feedback ledger：<https://github.com/AlexKaiqi/dsh-social-workbench/blob/0bb63b6f6963992e121d719f9a671637f6ab6c7f/runtime/src/loop-control.mjs>
