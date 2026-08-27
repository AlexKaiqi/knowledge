# 个人助理/宠物目标研究

状态：active goal research；初始证据与假设，不是 canonical knowledge  
核验日期：2026-08-27

## 1. Goal

为单一用户提供长期存在的个人助理/宠物：它能在多个会话中理解当前工作和偏好，用自然但不打扰的方式交流，在明确授权下完成行动，并通过一致的角色/动画/声音让系统状态可感知；同时保持隐私、可撤销和失败可恢复。

成功不等于“会聊天”或“功能多”。可观察结果是：用户能完成原本需要记忆、切换应用或反复解释的工作流；助理不会因为错误记忆、误打断、越权行动或虚假状态降低信任；宠物表现能可靠传达当前状态并形成适度的持续陪伴感。

## 2. Workflow tree

| Facet | 用户工作流 | 主要研究问题 |
| --- | --- | --- |
| 记忆与连续性 | 过去约束逐步形成，之后一句简短请求触发正确行动 | 如何区分记住、检索、冲突更新和把记忆正确落到 tool arguments？ |
| 行动与授权 | 助理形成计划、请求批准、执行、对账、失败恢复 | 哪些动作可自动、哪些需逐 revision 确认；如何防止旧授权和模糊结果重试？ |
| 实时语音 | 用户与助理同时听说、插话、停顿、修正并继续任务 | 如何兼顾低打断延迟、噪声误触发、backchannel 和可配置对话策略？ |
| 主动性 | 助理在合适时间提醒、追踪未完成事项或主动关心 | 什么触发值得打扰；如何表达依据、静默期、频率与一键关闭？ |
| 跨入口连续性 | Web、桌面、手机、消息与语音共享正确身份和上下文 | 如何合并同一主人的状态，同时隔离其他人、频道临时态和敏感数据？ |
| 宠物表现 | 宠物把 thinking、working、waiting、review、failed 等状态表现出来 | 如何让状态投影、动画生命周期和个性行为一致，不让表现覆盖真实任务状态？ |
| 长期陪伴 | 角色在数周/月保持连贯、不过度重复，也不诱导不健康依赖 | 哪些体验可短期工程验证，哪些必须依赖纵向用户研究和安全边界？ |

## 3. 首轮 GitHub × arXiv 证据

以下只建立问题假设，不证明我们已经解决或应立即实现：

| Difficulty hypothesis | GitHub 一手信号 | arXiv 一手信号 | 独立解决判断 | 最小机会切片 |
| --- | --- | --- | --- | --- |
| 记忆系统能回答事实，但不能可靠地把历史约束用于工具行动 | 多个个人助理项目把 working/long-term memory、context compression 和 tool execution 分成独立模块，说明组合边界真实存在，但 README 只能证明实现选择 | Mem2ActBench 把缺口定义为从分散长期记忆重建可执行 tool arguments，并报告七种 memory framework 仍不足 | **independent**：可在本地用冻结历史、tool schema 和期望 arguments 验证 | `memory-to-action grounding eval`；先评测再改 memory store |
| 低延迟打断与噪声误触发相互冲突 | `huggingface/speech-to-speech#433` 给出约 384ms 确认等待和“降低阈值会制造假 turn/取消工作”的复现，提出 reversible candidate→confirm 状态 | Instruct-FD 把 Listen/Backchannel/Interrupt/Continue/Acknowledge 形式化；最佳系统总体 instruction adherence 为 64.4%，主动行为更弱 | **independent**：可用双通道音频 fixture 测事件时间线，不依赖训练新模型 | 可逆 pre-confirmation ducking + policy-conditioned turn eval |
| 宠物资产有多个状态，但 renderer/state projection 不能持续表达真实任务 | `openai/codex#20863`、`#23272`、`#35442` 分别显示硬编码 event mapping、active animation 回 idle、lookFrame 覆盖 idle animation；其中有可复现步骤和 PoC | 暂无必要的 arXiv 证据；这是局部 UI/runtime 状态机问题 | **independent**：完全可用本地 event trace、clock 和 spritesheet fixture 验证 | 独立 `task-state → pet-behavior` projection；动画状态支持 loop/once/idleFallback |
| 主动提醒很容易从“有帮助”变成打扰 | Vellum Assistant/MIRA 等项目都显式实现 quiet hours、channel routing、opt-in 和不在对话中打扰；目前主要是实现证据，不是需求证明 | AI companionship 纵向研究显示 agency、parasocial interaction、engagement 与心理影响随时间关联，提醒主动性不能只优化点击/时长 | **conditional**：调度/策略可独立实现，但“长期有益”必须通过用户研究 | 可解释的 proactive proposal：依据、优先级、静默期、频控、dismiss/snooze；默认只提案 |
| 跨入口共享记忆会同时放大便利与身份/隐私风险 | 多个个人助理项目实现 shared sessions、per-user/channel isolation、local storage 和 fail-closed actor identity，说明这是反复出现的工程边界 | 首轮尚无足够精确论文证据 | **conditional**：需要实际多入口身份和 threat model | owner-bound session resolution + channel-local ephemeral context |
| “形成陪伴感”不是短期功能测试能证明的 | GitHub 项目常用 personality、journal、proactive reach-out 作为产品主张，但缺少共同验收 | 纵向 AI companionship 研究显示用户心智模型、agency、parasocial interaction、engagement 和心理影响是动态关系 | **not-independent** 作为总体结果；只能拆出一致性、重复率、控制权等局部指标 | 暂不建“提升依恋”能力；先研究角色一致性、可控主动性和安全退出 |

## 4. 下一轮只研究两个问题

### RQ1：记忆如何安全地进入行动参数

GitHub query pack：

- `personal assistant memory tool calling preference conflict`
- `agent memory stale update action arguments issue`
- 目标项目内检索 memory provenance、confirmation、tool execution、context compression 的 issue/PR。

arXiv query pack：

- `long-term memory tool use personal assistant benchmark`
- `memory conflict temporal update agent action grounding`

停止条件：取得至少两个可复现工程 failure/workaround，加一个可运行 benchmark 或明确 eval schema；否则只保留研究问题，不建 Opportunity。

### RQ2：宠物如何忠实、持续地表达任务状态

GitHub query pack：

- `digital pet state animation mapping idle fallback issue`
- `desktop pet task state animation lifecycle`
- 重点复审 `openai/codex` pets label 及相关 PoC 的 HEAD、license、issue 状态。

arXiv 只在出现“embodied status cue / peripheral awareness / virtual agent state legibility”明确评测时使用；不为了二源形式主义硬找论文。

停止条件：形成最小状态表、事件优先级、loop/hold/fallback 语义和三类可复现 fixture；然后才能提出本地产品 probe。

## 5. 暂不激活的来源

- App Store/Google Play 评论：等确定个人助理/陪伴类竞品集合和具体问题词后再激活，不做泛搜。
- Reddit、X、微博、小红书：等需要用户语境、频率或长期体验反证时再启用；不拿大规模评论替代产品实验。
- Google Scholar/ResearchGate：现有 arXiv/OpenAlex/OpenReview 能满足首轮研究，不为覆盖率增加不稳定 route。

## 6. Evidence 与 proposal 边界

GitHub README 只证明一个项目声称或选择了某种设计；issue 也只证明报告者环境中的问题。arXiv 论文证明作者定义、数据和实验范围内的结论，不自动证明生产可用或产品价值。Collector 必须把 source claim、我们的 inference、反证和未验证项分栏保存。

本调研只允许产生 KnowledgeProposal：Workflow/Difficulty/Opportunity 候选和所需 probe。不得自动安装项目、采用 PoC、更新 Connector、发布 capability 或把论文摘要改写成已证实产品事实。

## 7. 初始来源

- Mem2ActBench：<https://arxiv.org/abs/2601.19935>
- LongMemEval-V2：<https://arxiv.org/abs/2605.12493>
- Instruct-FD：<https://arxiv.org/abs/2607.20460>
- How AI Companionship Develops：<https://arxiv.org/abs/2510.10079>
- Hugging Face speech-to-speech barge-in issue：<https://github.com/huggingface/speech-to-speech/issues/433>
- Codex configurable pet animation issue：<https://github.com/openai/codex/issues/20863>
- Codex active animation fallback issue：<https://github.com/openai/codex/issues/23272>
- Codex lookFrame/idle issue：<https://github.com/openai/codex/issues/35442>
- Vellum Assistant：<https://github.com/vellum-ai/vellum-assistant>
- MIRA：<https://github.com/Vexillon-ai/MIRA>
