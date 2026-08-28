# 游戏构建 Revision 与发布前预检调研

状态：已吸收通用 build、Steam store asset、text-only description、ordered tags、Content Survey、Early Access、supported features 与逐 OS system requirements review revision；平台上传仍未接入
核验日期：2026-08-27

## 结论

游戏发布不能从“有一个 build 目录”直接跳到平台写操作。跨 Steam、itch.io、Apple 与 Google Play 能稳定复用的最小前置对象，不是统一上传请求，而是一个冻结的本地构建 revision：确切字节、入口点、来源 revision、权利依据和发布意图可以在平台外先复核。

平台状态必须另立能力。SteamPipe 支持 `Preview=1`，只产生日志和文件 manifest、不上传；真实上传后才有 depot manifest 与 BuildID，设为 live branch 又是后续状态。itch.io 的 Butler `push` 是会创建/更新远端 build 的写操作；其 channel 与 visibility 语义不能由本地 `target=itch-portable` 代替。Apple 用 bundle ID、version、build string 识别上传 build，上传后还要处理；Google Play 用 edit/bundle/track 表达上传和发布轨道。它们没有一个安全、诚实的“统一 publish”状态机。

第一步准入 `game.prepare-local-build-revision`：读取工作区目录、阻断明显不安全或不完整的文件集、生成逐文件摘要和 revision hash。随后按平台差异分别准入 Steam store asset、text-only description、ordered tags、Content Survey、Early Access、initial base price、supported features 与 system requirements review revision。Content Survey 切片不复制动态题库，而是绑定观察到的 questionnaire revision、三部分封闭问题集合、逐题答案/内容/证据、成人内容完整声明和生成式 AI evidence；Early Access 切片绑定六项公开 Q&A、当前 build、非绑定未来计划、社区、价格和第三方披露，同时因官方日期字段说明冲突而不暴露独立 1.0 日期；initial base price 切片绑定标准 package、41-market 完整表、调用方观察 minimum/catalog revision 和商业证据，但不认证 Steamworks 后台；系统要求切片按 Windows、macOS、Linux/SteamOS 保存原始字段，并把每个平台绑定到 build artifact、depot、public package、launch tests 与配置 evidence。平台 Connector 以后只能消费明确 revision，并继续独立处理凭据、签名、后台保存/预览、CSV、价格/问卷/答卷提交、上传、processing、review、release confirmation 和 receipt reconcile。

Steam asset、description、Tag、Content Survey、Early Access、supported feature 或 system requirements schema 都没有上升为 `game.prepare-store-metadata-revision`。App Store、Google Play、itch.io、TapTap 和主机商店的资产、文案、分级、localization 与状态字段不同；复用的是“不可变 revision + 独立高影响动作”原则，不是字段表。

## 已验证边界

- 路径必须相对工作区，源目录和内部文件都不能是 symlink；输出不泄露绝对路径。
- 只接收常规文件；阻断 `.env*`、credential/cookie/auth JSON、私钥和证书容器等疑似密钥文件名。
- 文件按相对路径稳定排序并流式计算 SHA-256；revision hash 不含观察时间。
- portable 目标必须声明入口点，Web 目标必须有 `index.html`；Steam content root 只做文件集预检，不解释 depot build script。
- `ready` 固定 `uploaded=false`、`executionAuthorized=false`。不生成签名、不运行游戏、不解包归档、不做病毒扫描、不访问任何平台。

## Collector 维护面

Collector 观察固定和移动两类生产原语、SteamPipe 官方 preview 语义以及 itch.io 官方 Butler 仓库。固定提交或文档语义变化生成知识复审；生产 `main` 或 Butler `master` 漂移生成 Connector 复审；本地报告到期只提议重跑 effect-free probe。

itch.io 人类可读文档当前对无会话抓取返回 403，因此没有伪装成稳定定时源。机器维护路线使用官方 `itchio/butler` 仓库，人工语义复审仍链接官方 pushing 文档。这是路线冗余，不是绕过访问控制。

Steam store asset Collector 另行观察官方 overview、store graphical assets、graphical rules 与 review process 四页；尺寸、五截图下限、视觉规则或 `Mark as ready for review` 语义变化只生成 proposal，不自动改 Connector 或既有 revision。当前四页检查均为 `current`，本地验证报告有效至 2026-09-26。

Steam store description Collector 分开观察 written description、review process 与 supported languages 三页；plain short copy、时效文案、链接、首发功能一致、详细连贯描述、English fallback 或 language code 变化只生成 proposal。它不自动重写自有文案，也不会把规则变化变成 Partner 后台操作。

Steam system requirements Collector 观察官方 platform/review 指南和 Valve 第一方公开商店页字段形态。支持 OS、depot/package、对应系统要求、预览发布、全平台启动或字段形态变化只生成 proposal；不会自动改硬件声明或执行 Partner 操作。

Steam Content Survey Collector 分开观察官方问卷、德国分级可见性和 review process。三部分结构、所有已上传成人内容披露、pre/live-generated AI、live AI guardrail、获批后修改门、有效分级与地区可见性边界任一变化只生成 proposal；不会自动更改答案、提交问卷、申请分级或改变商店状态。

Steam Early Access Collector 观察官方 Early Access、review process 与 store page。可玩/未完成产品定位、众筹/预购排除、未来承诺、价格平价、六项 Q&A、第三方披露和 1.0 日期字段冲突任一变化只生成 proposal；不会自动改答卷、价格、checkbox、日期或发布状态。

## 后续独立能力

1. `game.validate-engine-export`：按 Godot/Unity/Unreal 及目标平台验证导出结构；需要真实引擎 fixture。
2. `game.validate-signed-bundle`：Apple/Android/Windows/macOS 分别验证签名、公证或 bundle identity，不能做一个假统一 Schema。
3. Steam Content Survey 已绑定观察问卷 revision、三部分完整答卷、成人内容和生成式 AI 证据；Early Access 已绑定六项 Q&A、可玩 build、资格、价格与披露；initial base price 已绑定 37 个 live currencies、四个 USD region groups、调用方观察 minimum/catalog 与商业证据；初始 release date 已绑定精确日期、五种玩家显示、Coming Soon 14 天、两周日期锁定和调用方观察到的 store/build 审核状态；supported features 也绑定当前 build、目录观察、实现和测试证据并阻断 planned/unknown。真实后台 catalog/minimum、Launch Discount 与后续调价仍依 owned target 建立，不扩张 description、Tag、survey、Early Access、price、release-date、feature 或 system requirements schema。
4. `steam.preview-depot-build`：调用 SteamPipe preview，读取 manifest，effect 仍为 none；需要合法 SDK 与项目配置。
5. `itch.preview-channel-diff`：使用官方 Butler preview 路线比较远端 channel，需本人账号和受控测试项目。
6. 平台上传、processing/review、人工 release 与 receipt reconcile：每个平台分别做 sandbox/live probe 后才准入。

## 证据

- SteamPipe 上传与 preview：<https://partner.steamgames.com/doc/sdk/uploading?l=english&language=english>
- Steam build/depot manifest：<https://partner.steamgames.com/doc/store/application/builds>
- Steam Content Survey 与德国分级：<https://partner.steamgames.com/doc/gettingstarted/contentsurvey?language=english>、<https://partner.steamgames.com/doc/gettingstarted/contentsurvey/germany?language=english>
- Steam Early Access：<https://partner.steamgames.com/doc/store/earlyaccess?language=english>
- Steam 商店图像、描述、本地化与审核：<https://partner.steamgames.com/doc/store/assets>、<https://partner.steamgames.com/doc/store/assets/standard>、<https://partner.steamgames.com/doc/store/assets/rules>、<https://partner.steamgames.com/doc/store/page/description>、<https://partner.steamgames.com/doc/store/localization/languages>、<https://partner.steamgames.com/doc/store/review_process>
- itch.io Butler pushing：<https://itch.io/docs/butler/pushing.html>
- itch.io Butler 官方仓库：<https://github.com/itchio/butler>
- Apple build upload：<https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/>
- Google Play bundle upload：<https://developers.google.com/android-publisher/api-ref/rest/v3/edits.bundles/upload>
