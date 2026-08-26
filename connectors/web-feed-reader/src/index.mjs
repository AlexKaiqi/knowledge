import { createHash } from 'node:crypto'
import { SaxesParser } from 'saxes'

export const MAX_RESPONSE_BYTES = 512 * 1024
export const MAX_DOCUMENT_ENTRIES = 1000
export const MAX_RETURNED_ENTRIES = 20
export const REGISTERED_FEEDS = Object.freeze({
  'nodejs-releases': Object.freeze({
    id: 'nodejs-releases',
    feedUrl: 'https://nodejs.org/en/feed/releases.xml',
    homeUrl: 'https://nodejs.org/en',
    title: 'Node.js Blog: Releases',
    format: 'rss-2.0',
    language: 'en',
    entryOrigin: 'https://nodejs.org',
    entryPathPrefix: '/en/blog/release/',
  }),
})

const ALLOWED_INPUT_KEYS = new Set(['feedId', 'limit'])
const ALLOWED_CONTENT_TYPES = new Set(['application/atom+xml', 'application/rss+xml', 'application/xml', 'text/xml'])
const digest = (value) => createHash('sha256').update(value).digest('hex')

export class WebFeedReaderError extends Error {
  constructor(message, { code, httpStatus, retryAt = null } = {}) {
    super(message)
    this.name = 'WebFeedReaderError'
    this.code = code
    this.httpStatus = httpStatus
    this.retryAt = retryAt
  }
}

function assertInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.feedId !== 'string' || !Object.hasOwn(REGISTERED_FEEDS, input.feedId)) throw new Error('feedId must name one registered public feed')
  const limit = input.limit ?? 10
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RETURNED_ENTRIES) throw new Error(`limit must be an integer between 1 and ${MAX_RETURNED_ENTRIES}`)
  return { feedId: input.feedId, limit }
}

function attribute(node, localName) {
  return Object.values(node.attributes).find((entry) => entry.local === localName && !entry.uri)?.value ?? null
}

function boundedText(value, field, maximum, { required = true } = {}) {
  const normalized = value.replace(/\s+/gu, ' ').trim()
  if (!normalized && !required) return null
  if (!normalized || [...normalized].length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) throw new Error(`feed ${field} is missing or exceeds its bound`)
  if (/[<>]/u.test(normalized)) throw new Error(`feed ${field} contains markup instead of bounded text`)
  return normalized
}

function dateTime(value, field, { required = true } = {}) {
  const normalized = boundedText(value, field, 128, { required })
  if (normalized === null) return null
  if (!Number.isFinite(Date.parse(normalized))) throw new Error(`feed ${field} is not a valid date`)
  return new Date(normalized).toISOString()
}

function httpsUrl(value, field) {
  const normalized = boundedText(value, field, 2048)
  let url
  try { url = new URL(normalized) } catch { throw new Error(`feed ${field} is not a valid URL`) }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) throw new Error(`feed ${field} is not a safe canonical HTTPS URL`)
  return url.href
}

function normalizeRssItem(item) {
  const id = boundedText(item.guid || item.link, 'entry id', 2048)
  return {
    id,
    title: boundedText(item.title, 'entry title', 512),
    url: httpsUrl(item.link, 'entry link'),
    publishedAt: dateTime(item.pubDate, 'entry publication date'),
    updatedAt: null,
  }
}

function normalizeAtomEntry(entry) {
  return {
    id: boundedText(entry.id, 'entry id', 2048),
    title: boundedText(entry.title, 'entry title', 512),
    url: httpsUrl(entry.link, 'entry link'),
    publishedAt: dateTime(entry.published, 'entry publication date', { required: false }),
    updatedAt: dateTime(entry.updated, 'entry update date'),
  }
}

export function parseFeedDocument(xml) {
  if (typeof xml !== 'string' || xml.length === 0) throw new Error('feed document must be non-empty UTF-8 XML')
  const stack = []
  const entries = []
  const feed = { title: '', link: '', id: '', language: '', updated: '', lastBuildDate: '' }
  let format = null
  let currentEntry = null
  let elementCount = 0
  let parseFailure = null
  const parser = new SaxesParser({ xmlns: true, defaultXMLVersion: '1.0', forceXMLVersion: true })

  parser.on('doctype', () => { throw new Error('feed XML must not contain a DOCTYPE') })
  parser.on('error', (error) => { parseFailure = error; throw error })
  parser.on('opentag', (node) => {
    elementCount += 1
    if (elementCount > 20_000) throw new Error('feed XML exceeds the element budget')
    if (stack.length >= 64) throw new Error('feed XML exceeds the nesting budget')
    const frame = { local: node.local, uri: node.uri, attributes: node.attributes, text: '' }
    stack.push(frame)
    if (stack.length === 1) {
      if (node.local === 'rss' && !node.uri && attribute(node, 'version') === '2.0') format = 'rss-2.0'
      else if (node.local === 'feed' && node.uri === 'http://www.w3.org/2005/Atom') format = 'atom-1.0'
      else throw new Error('feed root must be RSS 2.0 or Atom 1.0')
    }
    const parent = stack.at(-2)
    if (format === 'rss-2.0' && node.local === 'item' && !node.uri && parent?.local === 'channel') currentEntry = { title: '', link: '', guid: '', pubDate: '' }
    if (format === 'atom-1.0' && node.local === 'entry' && node.uri === 'http://www.w3.org/2005/Atom' && parent?.local === 'feed') currentEntry = { title: '', link: '', id: '', published: '', updated: '' }
    if (format === 'atom-1.0' && node.local === 'link' && node.uri === 'http://www.w3.org/2005/Atom') {
      const rel = attribute(node, 'rel') ?? 'alternate'
      const href = attribute(node, 'href')
      if (rel === 'alternate' && href) {
        if (currentEntry && parent?.local === 'entry' && !currentEntry.link) currentEntry.link = href
        else if (!currentEntry && parent?.local === 'feed' && !feed.link) feed.link = href
      }
    }
  })
  const append = (value) => {
    const frame = stack.at(-1)
    if (frame) frame.text += value
  }
  parser.on('text', append)
  parser.on('cdata', append)
  parser.on('closetag', () => {
    const frame = stack.pop()
    const parent = stack.at(-1)
    if (!frame) throw new Error('feed XML close tag has no matching frame')
    const text = frame.text
    if (format === 'rss-2.0') {
      if (currentEntry && parent?.local === 'item' && !frame.uri && ['title', 'link', 'guid', 'pubDate'].includes(frame.local)) currentEntry[frame.local] = text
      else if (!currentEntry && parent?.local === 'channel' && !frame.uri && ['title', 'link', 'language', 'lastBuildDate'].includes(frame.local)) feed[frame.local] = text
      if (frame.local === 'item' && !frame.uri) {
        entries.push(normalizeRssItem(currentEntry ?? {}))
        currentEntry = null
      }
    } else if (format === 'atom-1.0') {
      const atom = frame.uri === 'http://www.w3.org/2005/Atom'
      if (currentEntry && parent?.local === 'entry' && atom && ['title', 'id', 'published', 'updated'].includes(frame.local)) currentEntry[frame.local] = text
      else if (!currentEntry && parent?.local === 'feed' && atom && ['title', 'id', 'updated'].includes(frame.local)) feed[frame.local] = text
      if (frame.local === 'entry' && atom) {
        entries.push(normalizeAtomEntry(currentEntry ?? {}))
        currentEntry = null
      }
    }
    if (entries.length > MAX_DOCUMENT_ENTRIES) throw new Error(`feed contains more than ${MAX_DOCUMENT_ENTRIES} entries`)
  })
  try { parser.write(xml).close() } catch (error) { throw new Error(`feed XML is invalid or unsupported: ${parseFailure?.message ?? error.message}`) }
  if (parser.xmlDecl.encoding && parser.xmlDecl.encoding.toLowerCase().replace('_', '-') !== 'utf-8') throw new Error('feed XML declaration must use UTF-8')
  if (!format || entries.length === 0) throw new Error('feed document has no supported entries')
  const ids = entries.map((entry) => entry.id)
  if (new Set(ids).size !== ids.length) throw new Error('feed entry identifiers must be unique')
  return {
    format,
    feed: format === 'rss-2.0'
      ? { title: boundedText(feed.title, 'title', 512), homeUrl: httpsUrl(feed.link, 'home link'), language: boundedText(feed.language, 'language', 64, { required: false }), updatedAt: dateTime(feed.lastBuildDate, 'last build date') }
      : { title: boundedText(feed.title, 'title', 512), homeUrl: httpsUrl(feed.link, 'home link'), language: null, updatedAt: dateTime(feed.updated, 'updated date') },
    entries,
  }
}

function retryAt(headers, now) {
  const value = headers.get('retry-after')
  if (value !== null && /^\d+$/.test(value)) return new Date(now.getTime() + Number(value) * 1000).toISOString()
  if (value !== null && Number.isFinite(Date.parse(value))) return new Date(value).toISOString()
  return null
}

async function readXmlResponse(response) {
  const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) throw new Error(`registered feed returned ${contentType || 'no content type'}`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_RESPONSE_BYTES) throw new Error('registered feed response exceeds the 512 KiB budget')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('registered feed response has no body')
  const chunks = []
  let receivedBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (receivedBytes > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('registered feed response exceeds the 512 KiB budget') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  let source
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new Error('registered feed response is not valid UTF-8') }
  return { source, receivedBytes, documentSha256: digest(bytes), contentType }
}

export function normalizeRegisteredPublicFeed(xml, { input, observedAt = new Date().toISOString(), transport = {} } = {}) {
  const normalizedInput = assertInput(input)
  const registration = REGISTERED_FEEDS[normalizedInput.feedId]
  const parsed = parseFeedDocument(xml)
  if (parsed.format !== registration.format || parsed.feed.title !== registration.title || parsed.feed.homeUrl !== registration.homeUrl || parsed.feed.language !== registration.language) throw new Error('registered feed identity or format changed')
  for (const entry of parsed.entries) {
    const url = new URL(entry.url)
    if (url.origin !== registration.entryOrigin || !url.pathname.startsWith(registration.entryPathPrefix)) throw new Error('registered feed entry escaped its reviewed origin or path')
  }
  // Feed-level updated timestamps are often deployment/build timestamps. Keep
  // them observable, but exclude them from the semantic digest so an unchanged
  // entry set does not become a false knowledge change on every site rebuild.
  const feedDigest = digest(JSON.stringify({
    feed: { title: parsed.feed.title, homeUrl: parsed.feed.homeUrl, language: parsed.feed.language },
    entries: parsed.entries,
  }))
  const projection = {
    source: { id: registration.id, feedUrl: registration.feedUrl, homeUrl: registration.homeUrl, format: registration.format },
    request: normalizedInput,
    feed: { title: parsed.feed.title, language: parsed.feed.language, updatedAt: parsed.feed.updatedAt, feedDigest, documentSha256: transport.documentSha256 ?? digest(xml) },
    coverage: { documentEntryCount: parsed.entries.length, returnedCount: Math.min(normalizedInput.limit, parsed.entries.length), maximumDocumentEntries: MAX_DOCUMENT_ENTRIES, returnedComplete: parsed.entries.length <= normalizedInput.limit },
    entries: parsed.entries.slice(0, normalizedInput.limit),
    transport: { contentType: transport.contentType ?? null, receivedBytes: transport.receivedBytes ?? Buffer.byteLength(xml), etag: transport.etag ?? null, lastModified: transport.lastModified ?? null },
  }
  const serialized = JSON.stringify(projection)
  const assertions = [
    { id: 'registered-fixed-source', passed: true },
    { id: 'rss-2.0-format', passed: parsed.format === 'rss-2.0' },
    { id: 'reviewed-feed-identity', passed: true },
    { id: 'bounded-document', passed: projection.transport.receivedBytes <= MAX_RESPONSE_BYTES },
    { id: 'bounded-entry-count', passed: parsed.entries.length <= MAX_DOCUMENT_ENTRIES },
    { id: 'unique-entry-identifiers', passed: new Set(parsed.entries.map((entry) => entry.id)).size === parsed.entries.length },
    { id: 'reviewed-entry-origin', passed: true },
    { id: 'personal-and-content-fields-excluded', passed: !/(\"author\"|\"email\"|\"content\"|\"description\"|\"enclosure\")/i.test(serialized) },
  ]
  return { ...projection, observedAt, resultDigest: digest(serialized), conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions } }
}

export async function readRegisteredPublicFeed(input, { fetchImpl = fetch, timeoutMs = 15_000, userAgent = 'dsh-knowledge-catalog/0.1', now = () => new Date() } = {}) {
  const normalizedInput = assertInput(input)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60_000) throw new Error('timeoutMs must be an integer between 1000 and 60000')
  if (typeof userAgent !== 'string' || userAgent.length < 1 || userAgent.length > 128 || /[\r\n]/.test(userAgent)) throw new Error('userAgent must be a bounded single-line string')
  const registration = REGISTERED_FEEDS[normalizedInput.feedId]
  const response = await fetchImpl(registration.feedUrl, {
    method: 'GET',
    headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9', 'user-agent': userAgent },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const code = response.status === 404 ? 'feed-not-found' : [429, 503].includes(response.status) ? 'rate-limited' : `http-${response.status}`
    throw new WebFeedReaderError(`registered feed read failed: HTTP_${response.status}`, { code, httpStatus: response.status, retryAt: retryAt(response.headers, now()) })
  }
  const document = await readXmlResponse(response)
  return normalizeRegisteredPublicFeed(document.source, {
    input: normalizedInput,
    observedAt: now().toISOString(),
    transport: {
      ...document,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    },
  })
}
