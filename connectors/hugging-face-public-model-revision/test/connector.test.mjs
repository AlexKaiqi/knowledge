import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HUGGING_FACE_ORIGIN,
  HuggingFacePublicModelRevisionError,
  MAX_FILES,
  MAX_RESPONSE_BYTES,
  normalizePublicModelRevisionResponse,
  readPublicModelRevisionManifest,
} from '../src/index.mjs'

const input = { repoId: 'openai-community/gpt2', commitSha: '607a30d783dfa663caf39e06633721c8d4cfcd7e' }
const rateHeaders = {
  ratelimit: '"api";r=499;t=156',
  'ratelimit-policy': '"fixed window";"api";q=500;w=300',
}

function payload(overrides = {}) {
  return {
    id: input.repoId,
    modelId: input.repoId,
    sha: input.commitSha,
    private: false,
    gated: false,
    disabled: false,
    pipeline_tag: 'text-generation',
    library_name: 'transformers',
    tags: ['transformers', 'license:mit', 'text-generation'],
    siblings: [
      { rfilename: 'README.md', size: 8092, blobId: 'a16a55fda99d2f2e7b69cce5cf93ff4ad3049930' },
      {
        rfilename: 'model.safetensors',
        size: 548105171,
        blobId: '44b36d6e32d13c8fb28b0feab0ac8bfefa7efeda',
        lfs: { size: 548105171, sha256: '248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707', pointerSize: 134 },
      },
    ],
    author: 'excluded-author',
    downloads: 999,
    likes: 999,
    spaces: ['excluded/space'],
    widgetData: [{ text: 'excluded' }],
    cardData: { license: 'mit', personal: 'excluded' },
    ...overrides,
  }
}

test('normalizes a complete exact-commit manifest and excludes identity and popularity fields', () => {
  const result = normalizePublicModelRevisionResponse(payload(), {
    input,
    headers: new Headers(rateHeaders),
    observedAt: '2026-08-27T00:00:00Z',
  })
  assert.equal(result.conformance.status, 'passed')
  assert.equal(result.modelRevision.repoId, input.repoId)
  assert.equal(result.modelRevision.commitSha, input.commitSha)
  assert.equal(result.modelRevision.fileCount, 2)
  const weights = result.modelRevision.files.find((file) => file.path === 'model.safetensors')
  assert.equal(weights.storage, 'lfs')
  assert.equal(weights.lfsSha256, '248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707')
  assert.equal(result.rateLimit.bucket, 'api')
  assert.equal(result.rateLimit.resetAt, '2026-08-27T00:02:36.000Z')
  const serialized = JSON.stringify(result)
  assert.equal(serialized.includes('excluded-author'), false)
  assert.equal(serialized.includes('excluded/space'), false)
  assert.equal(serialized.includes('"downloads"'), false)
  assert.equal(serialized.includes('"likes"'), false)
})

test('accepts Xet integrity and sorts files and tags deterministically', () => {
  const result = normalizePublicModelRevisionResponse(payload({
    tags: ['z', 'a', 'z'],
    siblings: [
      { rfilename: 'z.bin', size: 10, blobId: 'b'.repeat(40), xetHash: 'c'.repeat(64) },
      { rfilename: 'a.json', size: 2, blobId: 'a'.repeat(40) },
    ],
  }), { input, headers: new Headers(rateHeaders) })
  assert.deepEqual(result.modelRevision.tags, ['a', 'z'])
  assert.deepEqual(result.modelRevision.files.map((file) => file.path), ['a.json', 'z.bin'])
  assert.equal(result.modelRevision.files[1].storage, 'xet')
})

test('rejects mutable revisions, invalid repository IDs, alternate endpoints, and generic user agents before fetch', async () => {
  let calls = 0
  const fetchImpl = async () => { calls += 1 }
  await assert.rejects(() => readPublicModelRevisionManifest({ ...input, commitSha: 'main' }, { fetchImpl }), /full lowercase/)
  await assert.rejects(() => readPublicModelRevisionManifest({ ...input, repoId: 'datasets/openai/gpt2' }, { fetchImpl }), /namespace\/name/)
  await assert.rejects(() => readPublicModelRevisionManifest({ ...input, repoId: 'openai/../gpt2' }, { fetchImpl }), /namespace\/name/)
  await assert.rejects(() => readPublicModelRevisionManifest({ ...input, repoId: 'openai/foo--bar' }, { fetchImpl }), /namespace\/name/)
  await assert.rejects(() => readPublicModelRevisionManifest({ ...input, endpoint: 'https://example.com' }, { fetchImpl }), /unknown input fields/)
  await assert.rejects(() => readPublicModelRevisionManifest(input, { fetchImpl, userAgent: 'undici' }), /identify an application/)
  assert.equal(calls, 0)
})

test('rejects non-public models, response identity drift, unsafe paths, and integrity drift', () => {
  const options = { input, headers: new Headers(rateHeaders) }
  assert.throws(() => normalizePublicModelRevisionResponse(payload({ private: true }), options), /not public/)
  assert.throws(() => normalizePublicModelRevisionResponse(payload({ gated: 'manual' }), options), /access gate/)
  assert.throws(() => normalizePublicModelRevisionResponse(payload({ disabled: true }), options), /disabled/)
  assert.throws(() => normalizePublicModelRevisionResponse(payload({ sha: 'f'.repeat(40) }), options), /identity/)
  assert.throws(() => normalizePublicModelRevisionResponse(payload({ siblings: [{ rfilename: '../secret', size: 1, blobId: 'a'.repeat(40) }] }), options), /unsafe/)
  assert.throws(() => normalizePublicModelRevisionResponse(payload({ siblings: [{ rfilename: 'a', size: 1, blobId: 'bad' }] }), options), /Git blob/)
  assert.throws(() => normalizePublicModelRevisionResponse(payload({ siblings: [{ rfilename: 'a', size: 1, blobId: 'a'.repeat(40), lfs: { size: 2, sha256: 'b'.repeat(64) } }] }), options), /LFS identity/)
  assert.throws(() => normalizePublicModelRevisionResponse(payload({ siblings: [{ rfilename: 'a', size: 1, blobId: 'a'.repeat(40) }, { rfilename: 'a', size: 1, blobId: 'b'.repeat(40) }] }), options), /duplicate/)
  assert.throws(() => normalizePublicModelRevisionResponse(payload({ siblings: Array.from({ length: MAX_FILES + 1 }, (_, index) => ({ rfilename: `f-${index}`, size: 1, blobId: 'a'.repeat(40) })) }), options), /bounded shape/)
})

test('marks missing or changed API rate-limit headers for review without losing the manifest', () => {
  const missing = normalizePublicModelRevisionResponse(payload(), { input, headers: new Headers() })
  assert.equal(missing.modelRevision.fileCount, 2)
  assert.equal(missing.rateLimit, null)
  assert.equal(missing.conformance.status, 'review-required')
  const changed = normalizePublicModelRevisionResponse(payload(), {
    input,
    headers: new Headers({ ratelimit: '"pages";r=1;t=2', 'ratelimit-policy': '"fixed window";"pages";q=10;w=300' }),
  })
  assert.equal(changed.conformance.status, 'review-required')
})

test('uses one fixed official anonymous request with blobs metadata and no retry', async () => {
  let request
  const fetchImpl = async (url, options) => {
    request = { url: url.href, options }
    return new Response(JSON.stringify(payload()), { status: 200, headers: { 'content-type': 'application/json', ...rateHeaders } })
  }
  const times = [new Date('2026-08-27T00:00:00Z'), new Date('2026-08-27T00:00:01Z')]
  const result = await readPublicModelRevisionManifest(input, { fetchImpl, now: () => times.shift() })
  assert.equal(result.modelRevision.fileCount, 2)
  assert.equal(request.url, `${HUGGING_FACE_ORIGIN}/api/models/openai-community/gpt2/revision/${input.commitSha}?blobs=true`)
  assert.equal(request.options.redirect, 'error')
  assert.equal(Object.hasOwn(request.options.headers, 'authorization'), false)
  assert.match(request.options.headers['user-agent'], /https:\/\//)
})

test('enforces response budgets and exposes not-found, policy, and rate-limit failures without retrying', async () => {
  await assert.rejects(() => readPublicModelRevisionManifest(input, { fetchImpl: async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }) }), /text\/html/)
  await assert.rejects(() => readPublicModelRevisionManifest(input, { fetchImpl: async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'content-length': String(MAX_RESPONSE_BYTES + 1) } }) }), /4 MiB/)
  for (const [status, code] of [[404, 'not-found'], [403, 'access-policy-blocked'], [429, 'rate-limited']]) {
    let calls = 0
    await assert.rejects(
      () => readPublicModelRevisionManifest(input, {
        fetchImpl: async () => { calls += 1; return new Response('{}', { status, headers: { 'content-type': 'application/json', ...rateHeaders } }) },
        now: () => new Date('2026-08-27T00:00:00Z'),
      }),
      (error) => error instanceof HuggingFacePublicModelRevisionError && error.code === code && (code !== 'rate-limited' || error.retryAt === '2026-08-27T00:02:36.000Z'),
    )
    assert.equal(calls, 1)
  }
})
