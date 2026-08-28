# Steam initial base-price revision Connector

隐藏的确定性 Connector。它把自有未发布游戏的标准基础包、当前 Steam 定价目录/最低阈值 observation、完整 37 个 live currency 与 4 个 USD region group 的基础价格和决策证据冻结为待人审 revision。

它不读取或登录 Steamworks，不认证 package、目录、最低阈值或权限，不生成/上传 CSV，不提交 Valve 审核、不发布价格，也不处理 Launch Discount、后续调价、DLC、bundle、微交易或订阅。
