# Memory-to-action grounding 调研

状态：已形成一个窄的 deterministic capability；不等于完整个人助理执行闭环  
核验日期：2026-08-27

## 问题

现有 Personal Knowledge 能按真实问题返回有来源、受预算限制的 projection；Pet Assistant 把 projection 当作不可信数据，并在委派时再做当前用户原话授权检查。但“Agent 看过记忆后生成了工具参数”仍是一个不可独立审阅的黑盒：无法回答某个字段来自用户本轮、哪条记忆、过期记忆、冲突记忆还是模型猜测。

因此拆出独立能力：把调用者已经抽取成 field-addressed claim 的记忆，绑定到一个扁平 action contract，返回候选参数、逐字段 provenance 和 unresolved reason。它不解析 Markdown、不检索、不运行 Agent、不授权、更不执行 action。

## 方法证据

- [MemToolAgent v1](https://arxiv.org/abs/2606.07909v1) 说明结构化 memory entry 与检索可以改善个性化工具使用；这支持“先形成可检查 claim，再参与参数绑定”，而不是把整段历史直接塞入工具调用。
- [STALE v1](https://arxiv.org/abs/2605.06527v1) 明确指出“检索到更新证据”和“下游行动正确适配”之间仍有缺口；因此 `validUntil`、lifecycle 和显式 stale outcome 必须进入 grounding 契约。
- [TANGLE v1](https://arxiv.org/abs/2608.13921v1) 研究不可约个人记忆冲突，要求识别 underdetermination、保留冲突并针对性澄清；因此本能力不会按时间、数量或 authority 强行选一个冲突值。
- 当前生产 [Personal Knowledge projection](https://github.com/AlexKaiqi/dsh-personal-knowledge-base/blob/c8e181adcf3904f47fd33b85ffc1e97126cbbd66/dsh/service.js) 已提供 source set；[Pet Assistant](https://github.com/AlexKaiqi/dsh-pet-assistant/blob/77ea504f5267ac0f929d4fc81301f999899f270b/dsh/core.js) 已把 projection 标为 untrusted data，并把 action 委派授权放在独立 Host gate。新能力保持这两个边界。

## 决策

稳定公共输入只接受：

- action 名、effect、scope 和最多 50 个扁平 scalar 字段；
- 本轮显式参数；
- 最多 200 条带 action/field/scope、authority、lifecycle、时间和 provenance 的 memory claim；
- 冻结的 `now`。

字段逐个声明：

- `explicit-only`：目标、确认、收件人、revision 等高风险字段只能来自本轮显式参数；
- `allow-user-confirmed`：只接受用户确认记忆；
- `allow-confirmed-or-verified`：还可接受工具验证状态。

绑定必须 exact action + exact scope + exact field。`assistant-inferred`、contested、superseded、expired、类型不符和 enum 越界都不能填值。多个 eligible value 冲突时保留全部 claim ID 并返回 `conflicting-memory`。

## 尚未覆盖

- 从普通 Markdown 或 Session 文本抽取 field-addressed claim；
- 嵌套对象、数组、条件 Schema 和跨字段约束；
- 语义相似 scope 或“最近一条自动覆盖”；
- action impact assessment、授权、idempotency、执行与 receipt reconcile；
- 真实 Agent 是否会稳定地产生合格 claim 的 L3 eval。

这些是后续独立能力，不应塞回 grounding Connector。
