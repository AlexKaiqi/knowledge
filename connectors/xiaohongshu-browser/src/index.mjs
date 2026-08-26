import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PRIVATE_VISIBILITY = '仅自己可见'
const FUTURE_CAPABILITY_ID = 'xiaohongshu.note.publish-private-and-observe'

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

export class XiaohongshuBrowserConnector {
  constructor({
    baseUrl = 'http://127.0.0.1:18060',
    token,
    stateRoot = path.resolve('.runtime/xiaohongshu-browser/operations'),
    fetchImpl = fetch,
    requestTimeoutMs = 60_000,
    verificationTimeoutMs = 120_000,
    verificationPollMs = 3_000,
    now = () => new Date(),
  } = {}) {
    assertLoopbackUrl(baseUrl)
    if (typeof token !== 'string' || !token) throw new Error('sidecar token credential is required')
    this.baseUrl = baseUrl
    this.token = token
    this.fetchImpl = fetchImpl
    this.requestTimeoutMs = requestTimeoutMs
    this.verificationTimeoutMs = verificationTimeoutMs
    this.verificationPollMs = verificationPollMs
    this.now = now
    this.ledger = new OperationLedger(stateRoot)
  }

  async request(pathname, { method = 'GET', body, timeoutMs = this.requestTimeoutMs } = {}) {
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
    const health = unwrapData(await this.request('/health', { timeoutMs: 5_000 }))
    const login = unwrapData(await this.request('/api/v1/login/status'))
    return { ready: login?.is_logged_in === true, health, login: { isLoggedIn: login?.is_logged_in === true } }
  }

  async baseline() {
    const feeds = findFeeds(await this.request('/api/v1/user/me?tab=note'))
    return { feedIds: feeds.map(feedId).filter(Boolean), observedAt: this.now().toISOString() }
  }

  async submitPrivate(revision) {
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
      const feeds = findFeeds(await this.request('/api/v1/user/me?tab=note'))
      const candidate = feeds.find((feed) => !previousIds.has(feedId(feed)) && feedTitle(feed) === revision.title)
      const id = feedId(candidate)
      const token = feedToken(candidate)
      if (id && token) {
        const detail = await this.request('/api/v1/feeds/detail', {
          method: 'POST',
          body: { feed_id: id, xsec_token: token, load_all_comments: false },
        })
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
    const feeds = findFeeds(await this.request('/api/v1/user/me?tab=note'))
    const owned = feeds.find((feed) => feedId(feed) === platformObject.id)
    const token = feedToken(owned)
    if (!token) throw new Error('owned note is unavailable from the current account profile')
    const detail = await this.request('/api/v1/feeds/detail', {
      method: 'POST',
      body: {
        feed_id: platformObject.id,
        xsec_token: token,
        load_all_comments: true,
        comment_config: { max_comment_items: limit, click_more_replies: false, scroll_speed: 'normal' },
      },
    })
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
    if (!session.ready) throw new Error('owned Xiaohongshu session is not logged in')
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
  PRIVATE_VISIBILITY,
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
