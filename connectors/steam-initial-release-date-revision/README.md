# Steam initial release-date revision Connector

隐藏的确定性实现。它把调用方提供的当前 Steam release-state 证据、精确拟定日期、玩家侧显示精度、store/build revision 冻结成待人审 Revision，并执行保守的 Coming Soon、日期锁定和审核状态预检。

它不登录 Steamworks，不认证调用方提供的状态，不保存日期，不发布 Coming Soon，不点击 Release App，也不触发愿望单通知。
