# Distribution Impact Observation Evaluator

隐藏的确定性 Connector。它不读取 Steam、App Store Connect 或 Google Play，而是评估调用方已经取得并去身份化的 source-native 观察。

只有同 source/platform/surface/native metric/definition/scope/unit、等长且不重叠、完整并已最终化的 baseline/current 才计算 delta。阈值抑制、不可用、未最终化、定义漂移和未归因都保留为显式结果；平台归因还必须绑定 PublicationReceipt 与平台 evidence。

能力不会生成跨平台分数、因果结论、平台读取、知识写入、动作或授权。
