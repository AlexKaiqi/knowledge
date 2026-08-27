# 前沿研究发现与研究成果发布候选调研

状态：candidate research；不是 canonical knowledge  
核验日期：2026-08-27

## 1. 真正需要的不是“论文搜索器”

这一类接入服务两个不同闭环：

```text
明确研究问题
→ 持续发现新论文、新版本和公开评审
→ 跨来源去重并回到一手证据
→ 区分论文主张、外部评审和我们的推断
→ 形成技术判断或下一步实验
```

```text
冻结论文/数据/代码 revision
→ 元数据、作者、许可和编译预检
→ 由真实作者确认提交
→ 观察 moderation/review/deposit 状态
→ 获得 arXiv ID、OpenReview forum、DOI 或稳定 record receipt
```

一次性查论文通常无需 OKF：模型、Web 和平台搜索已经够用。值得隔离的复杂度是持续增量、版本/撤回、跨源 ID、查询预算、证据分层，以及作者身份、许可、venue schema 和不可逆发布。

## 2. 平台分工

| 平台 | 最适合承担的职责 | 不应承担的职责 | 候选结论 |
| --- | --- | --- | --- |
| arXiv | 计算机、数学、物理等领域的新论文/新版本增量；预印本的一手记录；自有投稿状态 | 影响力/质量真相；无人值守代作者投稿 | **首选一手增量源** |
| OpenAlex | 跨来源 work、topic、author、source、institution 和 citation 图谱；去重与趋势 | 替代原文、同行评审或发布平台原生状态 | **首选跨源研究图谱** |
| OpenReview | AI/ML 会议公开 submission、review、rebuttal、decision；venue-specific workflow | 跨会议统一投稿按钮 | **首选公开评审与会议状态源** |
| Semantic Scholar | 相关论文推荐、references/citations 和补充语义召回 | 唯一论文标识真相；把推荐排序当技术重要性事实 | **可选第二发现 route** |
| Crossref / DataCite | DOI、license、资助、引用元数据、修正/撤回与 Zenodo 等研究对象对账 | 普通作者论文投稿 | **隐藏 Collector/解析底座** |
| Zenodo | 数据集、代码、模型、报告、presentation、预印本等研究制品 deposit、DOI 与正式发布 | 期刊或会议 peer review | **首选可 sandbox 的研究制品发布源** |

领域源只在产品需要时加入：生命科学用 PubMed/Europe PMC/bioRxiv/medRxiv，社会科学可能用 SSRN。Google Scholar、ResearchGate 等在没有稳定官方自动化路线前只做人工研究入口，不用网页抓取补“覆盖率”。

## 3. 候选能力切片

### `research.read-frontier-work-delta`

输入应是一个版本化 research profile，而不是任意大查询：

- 研究问题与用途；
- arXiv categories、关键词/排除词、已知 seed works；
- 时间窗、每源上限和总请求预算；
- checkpoint 与允许的来源组合。

输出建议使用 `ResearchWorkDelta`：

- source work ID、arXiv ID/DOI/OpenReview ID 等 canonical identifiers；
- title、authors、published/updated/version、categories/topics、abstract 和一手 URL；
- `changeKind=new|revised|review-changed|decision-changed|corrected|retracted`；
- 跨源 match 的证据与置信度；
- 论文原始主张的有界摘录/摘要；
- 单独标注的 derived relevance/rationale，不冒充论文或同行评审事实；
- checkpoint、truncation、source freshness 和查询边界。

学术作者身份是引用与归属的必要事实，不能像社交评论者一样一律删除；但不得构建与研究任务无关的个人画像、邮箱/联系方式或跨平台行为图谱。全文只在许可与实际任务需要时读取，不因可下载就永久复制。

### `research.prepare-owned-submission`

这是预检和 handoff，不是最终发布：

- 对冻结 revision 计算 source/file digest；
- 校验 title、abstract、authors、categories、license 和关联 code/data；
- 对 arXiv 检查 TeX/source bundle、文件名、编译结果和可能的 endorsement 门；
- 对 OpenReview 读取当前 venue Invitation，按其 schema/deadline/readers 验证；
- 输出差异、缺项和准备就绪状态，不点击最终 Submit/Publish。

### `research.publish-owned-artifact`

首个可重复写入 probe 应选择 Zenodo sandbox，而不是 arXiv production：

- 建立 sandbox deposition；
- 上传一个无敏感信息的测试研究制品；
- 写入最小 metadata/license；
- 在明确确认后 publish，取得 test DOI/record URL；
- 验证 receipt、文件 digest 和 published state；
- 清楚声明 sandbox 可能被清理，正式 Zenodo 发布后不可删除。

arXiv 和 OpenReview 的最终提交应长期保留 visible/manual handoff：真实作者必须亲自确认作者、许可、category/venue、submission agreement 和最终内容。即使未来有可调用写入路线，也不能由 Collector 自动执行。

## 4. 最小 probe 提案

### Probe A：arXiv 前沿研究增量

1. 选择一个与当前技术方向直接相关的固定 research profile，例如一个 category 加 2–5 个关键词。
2. 使用官方 API，按 `submittedDate` 或 `lastUpdatedDate` 排序；单次最多 20 条，不做全库翻页。
3. 遵守官方建议的请求间隔并缓存，同一查询一天最多一次；返回 Atom entry，而不是只验证 HTTP 200。
4. 保存 arXiv ID、版本、时间、title、authors、category、abstract digest 和证据 URL。
5. 下一次运行必须区分新论文与已有论文新版本，并通过 overlap checkpoint 避免午夜/索引边界漏项。
6. 对一个 DOI 或 OpenReview 记录做可选二源对账，但派生源失败不应抹掉 arXiv 一手事实。

通过只证明“固定主题的新作/新版本增量”，不证明系统能判断论文正确、重要或可复现。

### Probe B：Zenodo sandbox 研究制品发布

1. 使用独立 sandbox account/token credential ref；token 不进入仓库。
2. 创建 deposition 并上传固定测试文件，记录 digest。
3. 验证 draft、metadata 和文件列表；未确认前不得调用 publish action。
4. 一次确认后发布，取得 test DOI（`10.5072` prefix）与 record URL，重新读取核对。
5. ProbeReport 只保存脱敏 receipt、digest、时间、状态和断言；不保存 token 或账号详情。

## 5. 发布边界

arXiv 官方规则要求注册作者，首次或新 category 可能需要 endorsement；提交受 moderation，作者需同意不可撤销的分发许可和 submission agreement，并被期望自行提交。因此 Connector 可以准备、编译、核对和交接，但不能替作者默许身份、作者顺序、许可或最终提交。

OpenReview 的 Invitation 本身定义 invitees、signatures、readers、字段 schema 和有效期。Connector 必须每个 venue 重新读取并冻结 Invitation digest；旧会议成功不能证明新会议可写。

Zenodo 把 `deposit:write` 与 `deposit:actions` 分开，并提供独立 sandbox。正式 publish 是高影响动作：发布后记录不能删除，因此生产 route 必须冻结 revision、显示 metadata/license/DOI 预览并一次确认。

## 6. Collector 维护范围

Collector 负责：

- arXiv API/RSS/OAI、category、submission、license、moderation 和 availability 规则变化；
- OpenAlex/Semantic Scholar 的字段、覆盖、定价、限额、派生语义和数据许可变化；
- OpenReview API 1/2 迁移、venue Invitation digest、deadline/readers/schema 变化；
- Crossref/DataCite 的 DOI metadata、correction/retraction 语义；
- Zenodo API/sandbox、scope、deposition/publish 状态和不可删除边界；
- probe 新鲜度、checkpoint 健康与跨源 match 漂移。

Collector 不自动投稿、不接受 submission agreement/许可、不猜作者顺序、不申请 endorsement、不代替 peer review，也不把 citation count、推荐排名或模型摘要写成“技术突破”事实。

## 7. 官方证据

- arXiv API access、用户手册、投稿规则与 endorsement：<https://info.arxiv.org/help/api/index.html>、<https://info.arxiv.org/help/api/user-manual.html>、<https://info.arxiv.org/help/submit/index.html>、<https://info.arxiv.org/help/endorsement.html>
- OpenAlex API 与 Works：<https://help.openalex.org/api/>、<https://help.openalex.org/data/works/>
- OpenReview API、Invitation 和 venue workflow：<https://docs.openreview.net/getting-started/using-the-api>、<https://docs.openreview.net/getting-started/using-the-api/objects-in-openreview/introductions-to-invitations>、<https://docs.openreview.net/workflows/conferences>
- Semantic Scholar Academic Graph API：<https://api.semanticscholar.org/api-docs/graph>
- Crossref REST API：<https://support.crossref.org/hc/en-us/articles/214320426-REST-API>
- DataCite REST API：<https://support.datacite.org/docs/rest-api>
- Zenodo REST API 与 sandbox：<https://developers.zenodo.org/>
