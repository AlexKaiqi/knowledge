import { createHash } from 'node:crypto'
import { SaxesParser } from 'saxes'

export const API_ENDPOINT = 'https://export.arxiv.org/api/query'
export const DOCUMENTATION_URL = 'https://info.arxiv.org/help/api/user-manual.html'
export const TERMS_URL = 'https://info.arxiv.org/help/api/tou.html'

const ALLOWED_INPUT_KEYS = new Set(['query', 'field', 'category', 'sortBy', 'sortOrder', 'start', 'limit'])
const FIELDS = new Map([['all', 'all'], ['title', 'ti'], ['abstract', 'abs']])
const SORTS = new Set(['relevance', 'lastUpdatedDate', 'submittedDate'])
const ORDERS = new Set(['ascending', 'descending'])
const CATEGORY = /^[a-z][a-z0-9-]*(?:\.[A-Za-z0-9-]+)?$/
const ARXIV_ID = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}(?:v[1-9][0-9]*)?$/
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

let requestTail = Promise.resolve()
let nextRequestAt = 0

export class ArxivMetadataSearchError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'ArxivMetadataSearchError'
    this.code = code
    this.details = details
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

function boundedText(value, field, maximum, { nullable = false } = {}) {
  if ((value === null || value === undefined || value === '') && nullable) return null
  if (typeof value !== 'string') throw new ArxivMetadataSearchError('response-shape-changed', `${field} is not text`)
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length < 1 || normalized.length > maximum) throw new ArxivMetadataSearchError('response-shape-changed', `${field} is outside its bound`)
  return normalized
}

export function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ArxivMetadataSearchError('invalid-input', 'input must be an object')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_INPUT_KEYS.has(key))
  if (unknown.length > 0) throw new ArxivMetadataSearchError('invalid-input', `unknown input fields: ${unknown.join(', ')}`)
  if (typeof input.query !== 'string') throw new ArxivMetadataSearchError('invalid-input', 'query must be text')
  const query = input.query.replace(/\s+/g, ' ').trim()
  if (query.length < 2 || query.length > 200 || /[\r\n\0":()\\]/.test(query) || /\b(?:AND|OR|ANDNOT)\b/i.test(query)) {
    throw new ArxivMetadataSearchError('invalid-input', 'query must be a plain bounded phrase without arXiv operators')
  }
  const field = input.field ?? 'all'
  if (!FIELDS.has(field)) throw new ArxivMetadataSearchError('invalid-input', `unsupported field: ${field}`)
  const category = input.category ?? null
  if (category !== null && (typeof category !== 'string' || !CATEGORY.test(category))) throw new ArxivMetadataSearchError('invalid-input', 'category is invalid')
  const sortBy = input.sortBy ?? 'submittedDate'
  const sortOrder = input.sortOrder ?? 'descending'
  if (!SORTS.has(sortBy)) throw new ArxivMetadataSearchError('invalid-input', `unsupported sortBy: ${sortBy}`)
  if (!ORDERS.has(sortOrder)) throw new ArxivMetadataSearchError('invalid-input', `unsupported sortOrder: ${sortOrder}`)
  const start = input.start ?? 0
  const limit = input.limit ?? 10
  if (!Number.isInteger(start) || start < 0 || start > 1000) throw new ArxivMetadataSearchError('invalid-input', 'start must be between 0 and 1000')
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new ArxivMetadataSearchError('invalid-input', 'limit must be between 1 and 20')
  return { query, field, category, sortBy, sortOrder, start, limit }
}

export function buildSearchQuery(input) {
  const query = normalizeInput(input)
  const phrase = `${FIELDS.get(query.field)}:"${query.query}"`
  return query.category ? `${phrase} AND cat:${query.category}` : phrase
}

function attributes(node) {
  return Object.fromEntries(Object.values(node.attributes).map((attribute) => [attribute.local, attribute.value]))
}

function parseAtom(xml) {
  if (typeof xml !== 'string' || xml.length < 1) throw new ArxivMetadataSearchError('response-shape-changed', 'Atom response is empty')
  if (/<!DOCTYPE/i.test(xml)) throw new ArxivMetadataSearchError('response-shape-changed', 'Atom response must not contain a doctype')
  const feed = { updated: null, link: null, totalResults: null, startIndex: null, itemsPerPage: null, entries: [] }
  let entry = null
  let author = null
  const stack = []
  const parser = new SaxesParser({ xmlns: true })
  parser.on('opentag', (node) => {
    const frame = { local: node.local, uri: node.uri, attrs: attributes(node), text: '' }
    stack.push(frame)
    if (node.local === 'entry' && node.uri === 'http://www.w3.org/2005/Atom') entry = { id: null, title: null, summary: null, published: null, updated: null, authors: [], categories: [], primaryCategory: null, links: [], comment: null, journalRef: null, doi: null }
    else if (entry && node.local === 'author' && node.uri === 'http://www.w3.org/2005/Atom') author = { name: null }
    else if (node.local === 'link' && node.uri === 'http://www.w3.org/2005/Atom') {
      if (entry) entry.links.push(frame.attrs)
      else if (!feed.link && frame.attrs.href) feed.link = frame.attrs.href
    } else if (entry && node.local === 'category' && node.uri === 'http://www.w3.org/2005/Atom' && frame.attrs.term) entry.categories.push(frame.attrs.term)
    else if (entry && node.local === 'primary_category' && node.uri === 'http://arxiv.org/schemas/atom') entry.primaryCategory = frame.attrs.term ?? null
  })
  parser.on('text', (text) => { if (stack.length > 0) stack.at(-1).text += text })
  parser.on('cdata', (text) => { if (stack.length > 0) stack.at(-1).text += text })
  parser.on('closetag', () => {
    const frame = stack.pop()
    const text = frame.text
    if (entry) {
      if (author && frame.local === 'name' && frame.uri === 'http://www.w3.org/2005/Atom') author.name = text
      else if (frame.local === 'author' && frame.uri === 'http://www.w3.org/2005/Atom') { if (author?.name) entry.authors.push(author.name); author = null }
      else if (!author && ['id', 'title', 'summary', 'published', 'updated'].includes(frame.local) && frame.uri === 'http://www.w3.org/2005/Atom') entry[frame.local] = text
      else if (frame.local === 'comment' && frame.uri === 'http://arxiv.org/schemas/atom') entry.comment = text
      else if (frame.local === 'journal_ref' && frame.uri === 'http://arxiv.org/schemas/atom') entry.journalRef = text
      else if (frame.local === 'doi' && frame.uri === 'http://arxiv.org/schemas/atom') entry.doi = text
      else if (frame.local === 'entry' && frame.uri === 'http://www.w3.org/2005/Atom') { feed.entries.push(entry); entry = null }
    } else if (frame.uri === 'http://a9.com/-/spec/opensearch/1.1/') {
      if (frame.local === 'totalResults') feed.totalResults = text
      else if (frame.local === 'startIndex') feed.startIndex = text
      else if (frame.local === 'itemsPerPage') feed.itemsPerPage = text
    } else if (frame.local === 'updated' && frame.uri === 'http://www.w3.org/2005/Atom') feed.updated = text
  })
  parser.on('error', (error) => { throw new ArxivMetadataSearchError('response-shape-changed', `Atom XML is invalid: ${error.message}`) })
  try { parser.write(xml).close() } catch (error) {
    if (error instanceof ArxivMetadataSearchError) throw error
    throw new ArxivMetadataSearchError('response-shape-changed', `Atom XML is invalid: ${error.message}`)
  }
  return feed
}

function integer(value, field) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new ArxivMetadataSearchError('response-shape-changed', `${field} is invalid`)
  return parsed
}

function iso(value, field) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new ArxivMetadataSearchError('response-shape-changed', `${field} is invalid`)
  return new Date(timestamp).toISOString()
}

function normalizeArxivId(value) {
  let url
  try { url = new URL(boundedText(value, 'entry id', 512)) } catch { throw new ArxivMetadataSearchError('response-shape-changed', 'entry id is not a URL') }
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'arxiv.org' || !url.pathname.startsWith('/abs/')) throw new ArxivMetadataSearchError('response-shape-changed', 'entry id is not an arXiv abstract URL')
  const id = decodeURIComponent(url.pathname.slice('/abs/'.length))
  if (!ARXIV_ID.test(id) || id.includes('..') || id.includes('//')) throw new ArxivMetadataSearchError('response-shape-changed', 'arXiv identifier is invalid')
  return id
}

function normalizeEntry(item) {
  const arxivId = normalizeArxivId(item.id)
  const authors = item.authors.map((name, index) => boundedText(name, `author[${index}]`, 512))
  if (authors.length < 1 || authors.length > 100) throw new ArxivMetadataSearchError('response-shape-changed', 'author count is invalid')
  const categories = [...new Set(item.categories.filter((category) => CATEGORY.test(category)))].sort()
  if (categories.length < 1 || categories.length > 50) throw new ArxivMetadataSearchError('response-shape-changed', 'categories are invalid')
  const primaryCategory = item.primaryCategory
  if (!CATEGORY.test(primaryCategory ?? '') || !categories.includes(primaryCategory)) throw new ArxivMetadataSearchError('response-shape-changed', 'primary category is invalid')
  const alternate = item.links.find((link) => link.rel === 'alternate')?.href
  const pdf = item.links.find((link) => link.title === 'pdf')?.href
  if (!alternate || !pdf) throw new ArxivMetadataSearchError('response-shape-changed', 'entry links are incomplete')
  const abstractUrl = new URL(alternate)
  const pdfUrl = new URL(pdf)
  if (abstractUrl.hostname !== 'arxiv.org' || pdfUrl.hostname !== 'arxiv.org' || !abstractUrl.pathname.startsWith('/abs/') || !pdfUrl.pathname.startsWith('/pdf/')) throw new ArxivMetadataSearchError('response-shape-changed', 'entry links escaped arXiv')
  return {
    arxivId,
    title: boundedText(item.title, 'title', 2000),
    summary: boundedText(item.summary, 'summary', 20_000),
    authors,
    publishedAt: iso(item.published, 'published'),
    updatedAt: iso(item.updated, 'updated'),
    primaryCategory,
    categories,
    abstractUrl: `https://arxiv.org/abs/${arxivId}`,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
    comment: boundedText(item.comment, 'comment', 4000, { nullable: true }),
    journalReference: boundedText(item.journalRef, 'journal reference', 4000, { nullable: true }),
    doi: boundedText(item.doi, 'doi', 512, { nullable: true }),
  }
}

export function normalizeAtomResponse(xml, { input, collectedAt = new Date().toISOString() } = {}) {
  const query = normalizeInput(input)
  const feed = parseAtom(xml)
  const totalResults = integer(feed.totalResults, 'totalResults')
  const startIndex = integer(feed.startIndex, 'startIndex')
  const itemsPerPage = integer(feed.itemsPerPage, 'itemsPerPage')
  if (startIndex !== query.start || itemsPerPage > query.limit || feed.entries.length > query.limit) throw new ArxivMetadataSearchError('response-identity-drift', 'Atom page does not match requested bounds')
  const entries = feed.entries.map(normalizeEntry)
  if (new Set(entries.map((entry) => entry.arxivId)).size !== entries.length) throw new ArxivMetadataSearchError('response-shape-changed', 'duplicate arXiv identifiers returned')
  const sortField = query.sortBy === 'submittedDate' ? 'publishedAt' : query.sortBy === 'lastUpdatedDate' ? 'updatedAt' : null
  const orderValid = !sortField || entries.every((entry, index) => index === 0 || (query.sortOrder === 'descending' ? entries[index - 1][sortField] >= entry[sortField] : entries[index - 1][sortField] <= entry[sortField]))
  const observedAt = iso(feed.updated, 'feed updated')
  const projection = {
    source: {
      id: 'arxiv-public-metadata-api',
      documentation: DOCUMENTATION_URL,
      terms: TERMS_URL,
    },
    query,
    coverage: {
      representation: 'offset-page',
      totalResults,
      startIndex,
      itemsPerPage,
      returnedCount: entries.length,
      corpusComplete: query.start === 0 && entries.length >= totalResults,
      resultSetMutable: true,
      checkpointSemantics: 'offset-is-not-stable-delta',
      metadataOnly: true,
      contentFilesRetained: false,
    },
    entries,
    observedAt,
    collectedAt: iso(collectedAt, 'collectedAt'),
  }
  const assertions = [
    { id: 'page-bound', passed: entries.length <= query.limit && query.limit <= 20 },
    { id: 'request-identity', passed: startIndex === query.start && itemsPerPage <= query.limit },
    { id: 'sort-order', passed: orderValid },
    { id: 'unique-identifiers', passed: new Set(entries.map((entry) => entry.arxivId)).size === entries.length },
    { id: 'metadata-only', passed: projection.coverage.metadataOnly && !projection.coverage.contentFilesRetained },
    { id: 'offset-not-delta', passed: projection.coverage.checkpointSemantics === 'offset-is-not-stable-delta' },
  ]
  return { ...projection, resultDigest: sha256(stableStringify(projection)), conformance: { status: assertions.every((assertion) => assertion.passed) ? 'passed' : 'review-required', assertions } }
}

async function readTextWithLimit(response, maximum) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maximum) throw new ArxivMetadataSearchError('response-too-large', `Atom response exceeds ${maximum} bytes`)
  if (!response.body) throw new ArxivMetadataSearchError('response-shape-changed', 'Atom response has no body')
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maximum) { await reader.cancel(); throw new ArxivMetadataSearchError('response-too-large', `Atom response exceeds ${maximum} bytes`) }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

async function scheduleRequest(operation, { minimumIntervalMs, sleep, clock }) {
  const run = requestTail.then(async () => {
    const wait = Math.max(0, nextRequestAt - clock())
    if (wait > 0) await sleep(wait)
    nextRequestAt = clock() + minimumIntervalMs
    return operation()
  })
  requestTail = run.catch(() => {})
  return run
}

export async function searchPublicEprintMetadata(input, {
  fetchImpl = fetch,
  timeoutMs = 30_000,
  maxResponseBytes = 1_048_576,
  minimumIntervalMs = 3_000,
  userAgent = 'dsh-knowledge-catalog/0.1 (https://github.com/AlexKaiqi/knowledge)',
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  clock = () => Date.now(),
  now = () => new Date(),
} = {}) {
  const query = normalizeInput(input)
  if (!Number.isInteger(minimumIntervalMs) || minimumIntervalMs < 3000 || minimumIntervalMs > 60000) throw new ArxivMetadataSearchError('configuration-error', 'minimumIntervalMs must respect arXiv limits')
  if (typeof userAgent !== 'string' || userAgent.length < 10 || userAgent.length > 256 || /[\r\n]/.test(userAgent)) throw new ArxivMetadataSearchError('configuration-error', 'userAgent must identify a bounded service')
  const url = new URL(API_ENDPOINT)
  url.searchParams.set('search_query', buildSearchQuery(query))
  url.searchParams.set('start', String(query.start))
  url.searchParams.set('max_results', String(query.limit))
  url.searchParams.set('sortBy', query.sortBy)
  url.searchParams.set('sortOrder', query.sortOrder)
  return scheduleRequest(async () => {
    const response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/atom+xml, application/xml;q=0.9', 'user-agent': userAgent }, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) {
      const code = response.status === 429 ? 'rate-limited' : response.status === 503 ? 'temporarily-unavailable' : 'http-error'
      throw new ArxivMetadataSearchError(code, `arXiv request failed: HTTP_${response.status}`, { status: response.status })
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!/(?:atom|xml)/i.test(contentType)) throw new ArxivMetadataSearchError('response-shape-changed', `arXiv returned ${contentType || 'no content type'}`)
    const xml = await readTextWithLimit(response, maxResponseBytes)
    return normalizeAtomResponse(xml, { input: query, collectedAt: now().toISOString() })
  }, { minimumIntervalMs, sleep, clock })
}
