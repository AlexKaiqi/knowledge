# YouTube / TikTok 接入裁决

目标不是累计平台名，而是为“调研需求、发布信息、获得影响力”建立互不冒充的闭环。

## 当前落地

| 平台 | 目标 | 当前路线 | 状态 | 还缺什么 |
| --- | --- | --- | --- | --- |
| TikTok | 已知公开视频证据解析 | 官方无账号 oEmbed | verified | 只解析已知 URL，不发现内容 |
| YouTube | 公共视频关键词调研 | 官方 Data API `search.list` 直连 | candidate | Google Cloud project、受限 API key、live probe |
| TikTok | 公共关键词/趋势调研 | 官方 Research API | suspended | 当前 commercial use 不符合资格 |
| TikTok | 公共关键词/趋势调研 | OOMOL 托管 Public Social Research | researching | 机器契约、平台授权、费用、去身份 live probe |
| TikTok | 自有公开视频维护/观测 | 官方 Display API | researching | app approval、OAuth、scope、owned identity probe |
| TikTok | 自有内容发布 | 官方 Content Posting API | researching | app audit、`video.publish`、user auth、receipt probe |

## 为什么 YouTube 不先用 OpenConnector

YouTube 官方公共搜索只需 Google project/API key；OpenConnector v1.4.0 的 YouTube Provider 统一要求 OAuth2，并暴露搜索、频道、播放列表、评论、上传等更大 action surface。对当前只读关键词搜索，直接 Connector 权限更小、调用链更短、quota 与保留策略更容易审计。OpenConnector 保留作未来自有账号操作的独立 failure domain，不作为当前搜索首选。

当前 YouTube quota 文档采用 granular bucket：`search.list` 进入独立 search bucket，默认每日 100 次、每次 1 unit。接口返回的 `pageInfo.totalResults` 只是近似值，因此 Connector 不保留它、不分页、不声称语料完整或需求规模。非授权 API Data 最迟 30 天删除或刷新。

## 为什么 TikTok 必须拆成三类

- Research API：面向合资格的非商业学术/公共利益研究，官方 FAQ 明确 commercial users 不符合资格。
- Display API：读取已授权 TikTok 用户自己的资料和公开视频列表，不是任意公众搜索。
- Content Posting API：平台写操作，包含 app approval、scope、用户授权、审计与回执对账；unaudited client 只能发 private content。

缺少官方 commercial public-search route 时，只能把 OOMOL/TikHub 等付费提供者作为候选 failure domain。任何 provider 的可调用、免费额度或代理能力都不等于 TikTok 的目标平台授权。

## 下一 probe

YouTube 的下一步是人工提供或批准创建一个最小 Google Cloud project 与受限 API key，然后运行一次最多 10 条、video-only、单页、无分页、无频道身份的 live probe，并核对 search bucket。TikTok 下一步若目标是运营自己的账号，应优先做 Display API owned-data 读闭环，再另做 Content Posting 的 private/audited sandbox 写闭环；公共关键词研究则先核清 OOMOL 的机器 schema、费用回执和平台内容使用边界。
