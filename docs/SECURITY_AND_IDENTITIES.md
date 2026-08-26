# Probe identity and security rules

## 可以进入 Git

- opaque identity ID；
- `credential:<ref>`；
- owned-test、provider-sandbox、synthetic-test、partner-test 类型；
- ownership、purpose、环境、允许的 Capability；
- 授权/条款证据引用；
- 生命周期、配额、冷却、并发与隔离策略；
- `noRiskEvasion`、`noCrossIdentityCorrelation`、`noThirdPartyImpersonation` 限制。

## 永远不能进入 Git

- 用户名、邮箱、手机号和真实姓名；
- 密码、Cookie、token、API key、session storage；
- 浏览器 profile、二维码、验证码；
- 可反查实际账号的运营清单；
- 跨身份、跨平台的身份归并数据。

真实 secret 只能存在仓库外 Credentials/runtime store。身份可以很多，但每一个都必须合法、授权、用途受限、可隔离、可停用，不能用于伪造用户、刷量或绕过平台风控。
