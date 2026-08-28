# Current work projection reconciler

隐藏的 hybrid Connector。它要求 owner-bound provider 通过生产 Personal Knowledge Base 的全局串行维护队列，对最近持久 Session 的未消费增量执行 startup/offline reconciliation。

公共结果不返回 Session 正文、cwd、model route、cursor 数值或真实仓库路径。该能力不清空 cursor、不做全量重建，也不能确认知识 proposal。
