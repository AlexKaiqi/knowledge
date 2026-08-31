# 可执行知识目录

`knowledge/` 是 OKF 公共门面。它只保留直接服务需求发现、产品研究、内容/App 发布、分发增长、反馈与影响力复盘的可验证知识。

## 导航

- [平台](platforms/index.md)
- [服务](services/index.md)
- [工具](tools/index.md)
- [信息源与数据源](sources/index.md)
- [概念](concepts/index.md)
- [能力](capabilities/index.md)
- [产品 Schema](schemas/index.md)
- [政策](policies/index.md)
- [验证](verifications/index.md)
- [参考资料](references/index.md)
- [知识变更历史](log.md)

当前 47 个能力覆盖小红书、抖音、TikTok、GitHub、Hugging Face、arXiv、Apple App Store、Steam、Optifeed Radar、本地证据化调研、传播影响评测、个人助理/宠物、游戏发布准备与反馈闭环原语。Radar 当前只准入固定源码 revision 的免费公开站点 readiness audit；付费 visibility、商品检查和 query generation 未准入。TikTok 当前只准入已知公开视频 URL 的官方 oEmbed 最小描述；YouTube 公共关键词搜索已实现为官方 API candidate，但没有 live probe，因此尚未进入 OKF。调研能力六类场景均已有真实样本；最新市场/竞品样本只把 Apple 目录当可变候选信号，把 persona implementation 与长程 continuity 分开，不生成市场规模、稳定排名或 companion quality 总分。传播影响评测只比较同平台、同原生定义、同 scope 且已最终化的观察，保留阈值抑制、未归因、定义漂移和 `temporal-association`，不生成跨平台分数或因果。GitHub 主要服务隐藏 Collector 的需求与生态观察；Hugging Face 服务模型、数据集和评测研究；arXiv 提供公开预印本元数据检索；Apple App Store 提供无账号、无排名主张的有界应用元数据搜索；Steam 提供去作者身份的公开评论页、partial 反馈观察投影及九类商店 review revision；最新 initial base-price revision 绑定 37 个 live currencies、四个 USD region groups、最小货币单位步进和调用方观察阈值，但不认证后台 catalog/minimum、生成 CSV、提交审核或发布价格。初始上线日期 revision 另行绑定精确后台日期、五种玩家显示精度、Coming Soon 最小时长、日期锁定和 store/build 审核证据。个人助理把 single-Session current 维护、最近持久 Session 的 startup/offline 增量对账和有界读取分开；对账可恢复已观察到的 cursor 后增量与中途失败，但不声称完整枚举、cursor reset 或全量重建。版本化记忆使用、experimental Persona 连续性与无阈值词法重复观测保持独立；重复观测不推断语义、质量或长期陪伴结果。反馈层把自有 submission 的待审 revision、可信授权后的本地存储、receipt-bound 用户撤回和 policy/deadline/hold-bound 到期清理分开；到期 Collector 只提出 proposal，执行仍需可信 grant。生产授权/hold/scheduler、介质/备份/下游副本清除仍未接入；observation 对账保留 mutation 未知性，主题归纳只生成待人审样本证据。
