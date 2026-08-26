import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const PRIVATE_VISIBILITY = '仅自己可见'
const FUTURE_CAPABILITY_ID = 'xiaohongshu.note.publish-private-and-observe'
const DEFAULT_ROUTE_ID = 'creator-web-xiaohongshu-mcp'
const SKILL_ROUTE_ID = 'creator-web-xiaohongshu-skill'
const SIDECAR_ROUTE_IDS = new Set(['owned-notes-xiaohongshu-mcp', DEFAULT_ROUTE_ID])
const XIAOHONGSHU_SKILL_REVISION = 'afa96802d3e61cdd5e7bd7b37ec59182bbe07d37'
const XIAOHONGSHU_SKILL_RUNTIME_DIFF_SHA256 = 'a95a9fae75c32d7b875c401a2ae46a5919ebec80288b9cbfb826056c4194838a'
const PROFILE_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/
const defaultExecFile = promisify(execFile)

function joinUrl(baseUrl, pathname) {
  return new URL(pathname, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
}

function assertLoopbackUrl(value) {
  const parsed = new URL(value)
  const host = parsed.hostname.replace(/^\[|\]$/g, '')
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('Xiaohongshu sidecar must use a loopback-only HTTP URL')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Xiaohongshu sidecar URL cannot contain credentials, query, or fragment')
  }
}

function unwrapData(value) {
  let current = value
  for (let index = 0; index < 5; index += 1) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !Object.hasOwn(current, 'data')) break
    current = current.data
  }
  return current
}

function findFeeds(value) {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value.feeds)) return value.feeds
  for (const child of Object.values(value)) {
    if (!child || typeof child !== 'object') continue
    const found = findFeeds(child)
    if (found.length > 0) return found
  }
  return []
}

function feedId(feed) {
  return feed?.id ?? feed?.noteId ?? feed?.note_id ?? ''
}

function feedTitle(feed) {
  return feed?.noteCard?.displayTitle ?? feed?.note_card?.display_title ?? ''
}

function feedToken(feed) {
  return feed?.xsecToken ?? feed?.xsec_token ?? ''
}

function detailParts(value) {
  const root = unwrapData(value)
  return {
    note: root?.note ?? root?.data?.note ?? root,
    comments: root?.comments?.list ?? root?.data?.comments?.list ?? [],
  }
}

function mediaCount(note) {
  if (Array.isArray(note?.imageList)) return note.imageList.length
  if (Array.isArray(note?.image_list)) return note.image_list.length
  return note?.video ? 1 : 0
}

function parseCount(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  if (typeof value !== 'string') return null
  const match = value.trim().replaceAll(',', '').match(/^(\d+(?:\.\d+)?)(万|千)?$/)
  if (!match) return null
  const multiplier = match[2] === '万' ? 10_000 : match[2] === '千' ? 1_000 : 1
  return Number(match[1]) * multiplier
}

function flattenComments(comments) {
  const output = []
  const visit = (comment) => {
    if (!comment || typeof comment !== 'object') return
    if (typeof comment.content === 'string' && comment.content.trim()) {
      const rawTime = Number(comment.createTime)
      output.push({
        externalId: String(comment.id ?? ''),
        body: comment.content.trim(),
        observedAt: Number.isFinite(rawTime)
          ? new Date(rawTime < 1e12 ? rawTime * 1000 : rawTime).toISOString()
          : null,
      })
    }
    for (const child of comment.subComments ?? []) visit(child)
  }
  for (const comment of comments ?? []) visit(comment)
  return output
}

function normalizedRevision(revision) {
  if (!revision || typeof revision !== 'object') throw new Error('revision is required')
  if (typeof revision.id !== 'string' || !revision.id.trim()) throw new Error('revision.id is required')
  if (typeof revision.title !== 'string' || !revision.title.trim()) throw new Error('revision.title is required')
  if (typeof revision.body !== 'string' || !revision.body.trim()) throw new Error('revision.body is required')
  if (typeof revision.verificationMarker !== 'string' || !revision.verificationMarker.trim()) {
    throw new Error('revision.verificationMarker is required')
  }
  if (!revision.body.includes(revision.verificationMarker)) {
    throw new Error('revision.body must contain revision.verificationMarker')
  }
  if (!Array.isArray(revision.media) || revision.media.length === 0) throw new Error('revision.media must not be empty')
  const media = revision.media.map((item) => {
    if (!item || !['image', 'video'].includes(item.kind)) throw new Error('each media item must be image or video')
    if (typeof item.path !== 'string' || !path.isAbsolute(item.path)) throw new Error('media paths must be absolute local paths')
    return { kind: item.kind, path: path.normalize(item.path), sha256: item.sha256 ?? null }
  })
  const videos = media.filter((item) => item.kind === 'video')
  if (videos.length > 0 && (media.length !== 1 || videos.length !== 1)) throw new Error('video revisions require exactly one video and no images')
  return {
    id: revision.id,
    title: revision.title,
    body: revision.body,
    topics: Array.isArray(revision.topics) ? revision.topics.map(String) : [],
    media,
    verificationMarker: revision.verificationMarker,
    visibility: 'private',
  }
}

export function computeRevisionDigest(revision) {
  return createHash('sha256').update(JSON.stringify(normalizedRevision(revision))).digest('hex')
}

function validateConfirmation(confirmation, revision, now) {
  if (!confirmation || typeof confirmation !== 'object') throw new Error('one-time confirmation is required')
  if (confirmation.capabilityId !== FUTURE_CAPABILITY_ID) throw new Error('confirmation capability does not match')
  if (confirmation.revisionId !== revision.id) throw new Error('confirmation revision does not match')
  const digest = computeRevisionDigest(revision)
  if (confirmation.revisionDigest !== digest) throw new Error('confirmation digest does not match the frozen revision')
  const expiresAt = Date.parse(confirmation.expiresAt)
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) throw new Error('confirmation is expired')
  return digest
}

class OperationLedger {
  constructor(root) {
    this.root = path.resolve(root)
  }

  fileFor(digest) {
    return path.join(this.root, `${digest}.json`)
  }

  async read(digest) {
    try { return JSON.parse(await readFile(this.fileFor(digest), 'utf8')) } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }

  async reserve(digest, value) {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    const handle = await open(this.fileFor(digest), 'wx', 0o600)
    try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`) } finally { await handle.close() }
  }

  async write(digest, value) {
    const target = this.fileFor(digest)
    const temporary = `${target}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, target)
  }
}

export class XiaohongshuSkillCliDriver {
  constructor({
    runtimeRoot,
    profile,
    execFileImpl = defaultExecFile,
    expectedRevision = XIAOHONGSHU_SKILL_REVISION,
    expectedRuntimeDiffSha256 = XIAOHONGSHU_SKILL_RUNTIME_DIFF_SHA256,
    headless = true,
    requestTimeoutMs = 60_000,
  } = {}) {
    if (typeof runtimeRoot !== 'string' || !path.isAbsolute(runtimeRoot)) throw new Error('skill runtimeRoot must be an absolute path')
    if (typeof profile !== 'string' || !PROFILE_RE.test(profile)) throw new Error('skill profile must be an opaque profile identifier')
    if (typeof execFileImpl !== 'function') throw new Error('skill execFileImpl must be a function')
    if (typeof headless !== 'boolean') throw new Error('skill headless must be a boolean')
    this.runtimeRoot = path.normalize(runtimeRoot)
    this.sourceRoot = path.join(this.runtimeRoot, 'src/xiaohongshu-skill')
    this.pythonExecutable = path.join(this.sourceRoot, '.venv/bin/python')
    this.profile = profile
    this.execFileImpl = execFileImpl
    this.expectedRevision = expectedRevision
    this.expectedRuntimeDiffSha256 = expectedRuntimeDiffSha256
    this.headless = headless
    this.requestTimeoutMs = requestTimeoutMs
    this.runtimeCheck = null
  }

  async run(file, args, options = {}) {
    return this.execFileImpl(file, args, { ...options, maxBuffer: 1024 * 1024 })
  }

  async ensureRuntime() {
    if (!this.runtimeCheck) {
      this.runtimeCheck = (async () => {
        let revision
        try {
          revision = (await this.run('git', ['rev-parse', 'HEAD'], { cwd: this.sourceRoot })).stdout.trim()
        } catch {
          throw new Error('xiaohongshu-skill runtime revision is unavailable')
        }
        if (revision !== this.expectedRevision) throw new Error('xiaohongshu-skill runtime revision does not match the pinned connector revision')
        let status
        let runtimeDiff
        try {
          status = (await this.run('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: this.sourceRoot })).stdout
          runtimeDiff = (await this.run('git', ['diff', '--binary', '--no-ext-diff', '--', 'scripts/__main__.py'], { cwd: this.sourceRoot })).stdout
        } catch {
          throw new Error('xiaohongshu-skill runtime patch state is unavailable')
        }
        if (status !== ' M scripts/__main__.py\n') throw new Error('xiaohongshu-skill runtime contains changes outside the reviewed adapter patch')
        const runtimeDiffSha256 = createHash('sha256').update(runtimeDiff).digest('hex')
        if (runtimeDiffSha256 !== this.expectedRuntimeDiffSha256) {
          throw new Error('xiaohongshu-skill runtime does not match the reviewed adapter patch')
        }
        let pythonVersion
        let help
        try {
          pythonVersion = (await this.run(this.pythonExecutable, ['--version'], { cwd: this.sourceRoot })).stdout.trim()
          help = (await this.run(this.pythonExecutable, ['-m', 'scripts', 'publish', '--help'], { cwd: this.sourceRoot })).stdout
        } catch {
          throw new Error('xiaohongshu-skill runtime CLI is unavailable')
        }
        if (!/^Python 3\.(?:10|11|12)\./.test(pythonVersion)) {
          throw new Error('xiaohongshu-skill runtime Python is outside the reviewed 3.10-3.12 range')
        }
        if (!/(?:^|\s)--visibility(?:\s|$)/m.test(help)) {
          throw new Error('xiaohongshu-skill runtime lacks the reviewed private-visibility CLI patch')
        }
        return { revision, runtimeDiffSha256, pythonVersion, privateVisibilityCli: true }
      })()
    }
    return this.runtimeCheck
  }

  async invoke(command, args = [], { timeoutMs = this.requestTimeoutMs, acceptedExitCodes = [0] } = {}) {
    await this.ensureRuntime()
    const cliArgs = ['-m', 'scripts', '--quiet', '--profile', this.profile, '--headless', String(this.headless), command, ...args]
    let result
    try {
      result = await this.run(this.pythonExecutable, cliArgs, { cwd: this.sourceRoot, timeout: timeoutMs })
    } catch (error) {
      if (!acceptedExitCodes.includes(Number(error.code)) || typeof error.stdout !== 'string') {
        throw new Error(`xiaohongshu-skill CLI operation failed: ${command}`)
      }
      result = error
    }
    let parsed
    try { parsed = JSON.parse(result.stdout) } catch { throw new Error(`xiaohongshu-skill CLI returned invalid JSON: ${command}`) }
    if (parsed === null || typeof parsed !== 'object') throw new Error(`xiaohongshu-skill CLI returned an invalid contract: ${command}`)
    return parsed
  }

  async inspectSession() {
    const runtime = await this.ensureRuntime()
    // The two checks may both launch a browser against the same persistent
    // profile. Serialize them to avoid profile locks and cross-process state.
    const publicLogin = await this.invoke('check-login')
    const creatorLogin = await this.invoke('check-creator-login')
    const readReady = publicLogin.is_logged_in === true
    const writeReady = creatorLogin.is_logged_in === true
    return {
      ready: readReady && writeReady,
      readReady,
      writeReady,
      health: { adapter: 'xiaohongshu-skill-json-cli', revision: runtime.revision, pythonVersion: runtime.pythonVersion, privateVisibilityCli: runtime.privateVisibilityCli },
      login: { isLoggedIn: readReady && writeReady },
    }
  }

  async authorize({ timeoutSeconds = 120 } = {}) {
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 30 || timeoutSeconds > 600) {
      throw new Error('authorization timeoutSeconds must be an integer from 30 to 600')
    }
    if (this.headless) throw new Error('authorization requires a visible browser')
    const acceptedExitCodes = [0, 1, 2]
    const timeoutMs = (timeoutSeconds + 30) * 1000
    const publicLogin = await this.invoke('login', ['--timeout', String(timeoutSeconds)], { timeoutMs, acceptedExitCodes })
    if (publicLogin.status !== 'logged_in') {
      return { readReady: false, writeReady: false, phase: 'public-web', status: String(publicLogin.status ?? 'failed') }
    }
    const creatorLogin = await this.invoke('creator-login', ['--timeout', String(timeoutSeconds)], { timeoutMs, acceptedExitCodes })
    const writeReady = creatorLogin.status === 'logged_in'
    return { readReady: true, writeReady, phase: writeReady ? 'complete' : 'creator-center', status: String(creatorLogin.status ?? 'failed') }
  }

  async listOwnedFeeds() {
    const profile = await this.invoke('me')
    return findFeeds(profile)
  }

  async submitPrivate(revision) {
    if (revision.topics.some((topic) => topic.includes(','))) throw new Error('skill route topics cannot contain commas')
    const common = ['--title', revision.title, '--content', revision.body, '--visibility', PRIVATE_VISIBILITY, '--auto-publish']
    if (revision.topics.length > 0) common.push('--tags', revision.topics.join(','))
    const isVideo = revision.media.length === 1 && revision.media[0].kind === 'video'
    let command
    let args
    if (isVideo) {
      command = 'publish-video'
      args = [...common, '--video', revision.media[0].path]
    } else {
      if (revision.media.some((item) => item.path.includes(','))) throw new Error('skill route image paths cannot contain commas')
      command = 'publish'
      args = [...common, '--images', revision.media.map((item) => item.path).join(',')]
    }
    const result = await this.invoke(command, args, { timeoutMs: 10 * 60_000, acceptedExitCodes: [0, 1, 2] })
    if (result.visibility !== PRIVATE_VISIBILITY) throw new Error('skill route did not confirm private visibility')
    if (result.status === 'submitted_unconfirmed') throw new Error('skill route submitted with an unconfirmed outcome')
    if (result.status !== 'confirmed' || result.published !== true) throw new Error('skill route did not confirm publication')
    return result
  }

  async getDetail({ id, token, loadAllComments, commentLimit }) {
    const args = [id]
    if (token) args.push(token)
    if (loadAllComments) args.push('--load-comments', '--max-comments', String(commentLimit))
    return this.invoke('feed', args)
  }
}

export class XiaohongshuBrowserConnector {
  constructor({
    routeId = DEFAULT_ROUTE_ID,
    baseUrl = 'http://127.0.0.1:18060',
    token,
    skillRuntimeRoot,
    profile,
    skillExecFileImpl,
    skillExpectedRuntimeDiffSha256,
    stateRoot = path.resolve('.runtime/xiaohongshu-browser/operations'),
    fetchImpl = fetch,
    requestTimeoutMs = 60_000,
    verificationTimeoutMs = 120_000,
    verificationPollMs = 3_000,
    now = () => new Date(),
  } = {}) {
    if (!SIDECAR_ROUTE_IDS.has(routeId) && routeId !== SKILL_ROUTE_ID) throw new Error(`unsupported Xiaohongshu route: ${routeId}`)
    if (SIDECAR_ROUTE_IDS.has(routeId)) {
      assertLoopbackUrl(baseUrl)
      if (typeof token !== 'string' || !token) throw new Error('sidecar token credential is required')
    }
    this.routeId = routeId
    this.baseUrl = baseUrl
    this.token = token
    this.fetchImpl = fetchImpl
    this.requestTimeoutMs = requestTimeoutMs
    this.verificationTimeoutMs = verificationTimeoutMs
    this.verificationPollMs = verificationPollMs
    this.now = now
    this.ledger = new OperationLedger(stateRoot)
    this.skillDriver = routeId === SKILL_ROUTE_ID
      ? new XiaohongshuSkillCliDriver({
        runtimeRoot: skillRuntimeRoot,
        profile,
        execFileImpl: skillExecFileImpl,
        expectedRuntimeDiffSha256: skillExpectedRuntimeDiffSha256,
        requestTimeoutMs,
      })
      : null
  }

  async request(pathname, { method = 'GET', body, timeoutMs = this.requestTimeoutMs } = {}) {
    if (this.skillDriver) throw new Error('HTTP sidecar requests are unavailable for the skill route')
    const headers = { accept: 'application/json', authorization: `Bearer ${this.token}` }
    if (body !== undefined) headers['content-type'] = 'application/json'
    const response = await this.fetchImpl(joinUrl(this.baseUrl, pathname), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await response.text()
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = null }
    if (!response.ok || parsed?.success === false || parsed === null) {
      const code = parsed?.code ?? `HTTP_${response.status}`
      throw new Error(`Xiaohongshu sidecar request failed: ${code}`)
    }
    return parsed
  }

  async inspectSession() {
    if (this.skillDriver) return this.skillDriver.inspectSession()
    const health = unwrapData(await this.request('/health', { timeoutMs: 5_000 }))
    const login = unwrapData(await this.request('/api/v1/login/status'))
    return { ready: login?.is_logged_in === true, health, login: { isLoggedIn: login?.is_logged_in === true } }
  }

  async baseline() {
    const feeds = await this.ownedFeeds()
    return { feedIds: feeds.map(feedId).filter(Boolean), observedAt: this.now().toISOString() }
  }

  async ownedFeeds() {
    if (this.skillDriver) return this.skillDriver.listOwnedFeeds()
    return findFeeds(await this.request('/api/v1/user/me?tab=note'))
  }

  async noteDetail({ id, token, loadAllComments = false, commentLimit = 20 }) {
    if (this.skillDriver) return this.skillDriver.getDetail({ id, token, loadAllComments, commentLimit })
    return this.request('/api/v1/feeds/detail', {
      method: 'POST',
      body: {
        feed_id: id,
        xsec_token: token,
        load_all_comments: loadAllComments,
        ...(loadAllComments ? { comment_config: { max_comment_items: commentLimit, click_more_replies: false, scroll_speed: 'normal' } } : {}),
      },
    })
  }

  async listOwnedNotes({ limit = 20 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('limit must be an integer from 1 to 100')
    const session = await this.inspectSession()
    if (!(session.readReady ?? session.ready)) throw new Error('owned Xiaohongshu session is not logged in')
    const feeds = await this.ownedFeeds()
    return {
      status: 'available',
      observedAt: this.now().toISOString(),
      items: feeds.slice(0, limit).flatMap((feed) => {
        const id = feedId(feed)
        if (!id) return []
        return [{ externalId: id, title: feedTitle(feed), url: `https://www.xiaohongshu.com/explore/${id}` }]
      }),
    }
  }

  async submitPrivate(revision) {
    if (this.skillDriver) return this.skillDriver.submitPrivate(revision)
    const common = {
      title: revision.title,
      content: revision.body,
      tags: revision.topics,
      visibility: PRIVATE_VISIBILITY,
    }
    const isVideo = revision.media.length === 1 && revision.media[0].kind === 'video'
    const endpoint = isVideo ? '/api/v1/publish_video' : '/api/v1/publish'
    const payload = isVideo
      ? { ...common, video: revision.media[0].path }
      : { ...common, images: revision.media.map((item) => item.path) }
    await this.request(endpoint, { method: 'POST', body: payload, timeoutMs: 10 * 60_000 })
  }

  async verify(revision, baseline) {
    const previousIds = new Set(baseline.feedIds)
    const deadline = Date.now() + this.verificationTimeoutMs
    while (Date.now() < deadline) {
      const feeds = await this.ownedFeeds()
      const candidate = feeds.find((feed) => !previousIds.has(feedId(feed)) && feedTitle(feed) === revision.title)
      const id = feedId(candidate)
      const token = feedToken(candidate)
      if (id && token) {
        const detail = await this.noteDetail({ id, token })
        const { note } = detailParts(detail)
        const checks = [
          { id: 'new-owned-note', status: 'passed' },
          { id: 'exact-title', status: feedTitle(candidate) === revision.title ? 'passed' : 'failed' },
          { id: 'media-count', status: mediaCount(note) === revision.media.length ? 'passed' : 'failed' },
          { id: 'body-marker', status: String(note?.desc ?? note?.content ?? '').includes(revision.verificationMarker) ? 'passed' : 'failed' },
        ]
        return {
          confirmed: checks.every((check) => check.status === 'passed'),
          checks,
          platformObject: { id, url: `https://www.xiaohongshu.com/explore/${id}` },
        }
      }
      await new Promise((resolve) => setTimeout(resolve, this.verificationPollMs))
    }
    return { confirmed: false, checks: [{ id: 'new-owned-note', status: 'unknown' }], platformObject: null }
  }

  async observeOwnedNote(platformObject, { limit = 20 } = {}) {
    if (!platformObject?.id) throw new Error('platform note id is required')
    const feeds = await this.ownedFeeds()
    const owned = feeds.find((feed) => feedId(feed) === platformObject.id)
    const token = feedToken(owned)
    if (!token) throw new Error('owned note is unavailable from the current account profile')
    const detail = await this.noteDetail({ id: platformObject.id, token, loadAllComments: true, commentLimit: limit })
    const { note, comments } = detailParts(detail)
    const observedAt = this.now().toISOString()
    const definitions = {
      likedCount: 'Likes displayed by the note detail page at observation time.',
      collectedCount: 'Collections displayed by the note detail page at observation time.',
      commentCount: 'Comments displayed by the note detail page at observation time.',
      sharedCount: 'Shares displayed by the note detail page at observation time.',
    }
    const metrics = Object.entries(definitions).flatMap(([name, definition]) => {
      const value = parseCount(note?.interactInfo?.[name])
      return value === null ? [] : [{ name, value, unit: 'count', definition }]
    })
    return {
      status: 'available',
      externalId: platformObject.id,
      observedAt,
      metrics,
      feedback: flattenComments(comments).map((comment) => ({
        externalId: comment.externalId,
        kind: 'comment',
        body: comment.body,
        observedAt: comment.observedAt ?? observedAt,
      })),
    }
  }

  async publishPrivateNoteAndObserve({ revision: rawRevision, confirmation }) {
    const revision = normalizedRevision(rawRevision)
    const digest = validateConfirmation(confirmation, revision, this.now())
    const existing = await this.ledger.read(digest)
    if (existing?.status === 'confirmed') return existing.receipt
    if (existing) throw new Error(`operation requires reconciliation before retry: ${existing.status}`)

    const session = await this.inspectSession()
    if (!(session.writeReady ?? session.ready)) throw new Error('owned Xiaohongshu session is not logged in')
    const baseline = await this.baseline()
    const operation = {
      schemaVersion: 'knowledge.xiaohongshu-operation/v1',
      revisionId: revision.id,
      revisionDigest: digest,
      status: 'reserved',
      updatedAt: this.now().toISOString(),
    }
    await this.ledger.reserve(digest, operation)

    try {
      operation.status = 'submitting'
      operation.updatedAt = this.now().toISOString()
      await this.ledger.write(digest, operation)
      await this.submitPrivate(revision)
      operation.status = 'submitted'
      operation.updatedAt = this.now().toISOString()
      await this.ledger.write(digest, operation)
    } catch (error) {
      operation.status = 'unknown'
      operation.updatedAt = this.now().toISOString()
      await this.ledger.write(digest, operation)
      throw new Error('publish outcome is unknown; reconcile the owned profile before any retry', { cause: error })
    }

    const verification = await this.verify(revision, baseline)
    if (!verification.confirmed) {
      operation.status = 'unknown'
      operation.checks = verification.checks
      operation.updatedAt = this.now().toISOString()
      await this.ledger.write(digest, operation)
      return {
        status: 'unknown',
        revisionId: revision.id,
        revisionDigest: digest,
        checks: verification.checks,
        nextAction: 'manual-reconciliation-required',
      }
    }

    const receipt = {
      status: 'confirmed',
      revisionId: revision.id,
      revisionDigest: digest,
      platformObject: verification.platformObject,
      confirmedAt: this.now().toISOString(),
      checks: verification.checks,
      observation: { status: 'unavailable' },
    }
    operation.status = 'confirmed'
    operation.receipt = receipt
    operation.updatedAt = this.now().toISOString()
    await this.ledger.write(digest, operation)

    try {
      receipt.observation = await this.observeOwnedNote(verification.platformObject)
      operation.receipt = receipt
      operation.updatedAt = this.now().toISOString()
      await this.ledger.write(digest, operation)
    } catch {
      // Publication remains confirmed. Observation failure is explicit and makes
      // the full admission probe fail without turning a known write into unknown.
    }
    return receipt
  }
}

export const xiaohongshuBrowserInternals = {
  DEFAULT_ROUTE_ID,
  PRIVATE_VISIBILITY,
  PROFILE_RE,
  SKILL_ROUTE_ID,
  XIAOHONGSHU_SKILL_REVISION,
  XIAOHONGSHU_SKILL_RUNTIME_DIFF_SHA256,
  FUTURE_CAPABILITY_ID,
  detailParts,
  feedId,
  feedTitle,
  feedToken,
  findFeeds,
  flattenComments,
  mediaCount,
  normalizedRevision,
  parseCount,
  unwrapData,
}
