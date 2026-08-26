import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { JSON_SCHEMA, load as loadYaml } from 'js-yaml'

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const SUBJECT_TYPES = new Set(['Tool', 'Platform', 'Information Source', 'Dataset', 'Service', 'Protocol'])
const EXEMPT_ORPHAN_TYPES = new Set(['Capability', 'Policy', 'Reference', 'Log'])

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(target))
    else files.push(target)
  }
  return files
}

function parseDocument(source, relativePath) {
  const match = source.match(FRONTMATTER)
  if (!match) return { relativePath, frontmatter: null, body: source }
  return {
    relativePath,
    frontmatter: loadYaml(match[1], { schema: JSON_SCHEMA }) ?? {},
    body: source.slice(match[0].length),
  }
}

function withoutCodeFences(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '')
}

function markdownLinks(markdown) {
  return [...withoutCodeFences(markdown).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1].trim())
}

function normalizeBundleRef(reference) {
  return reference.replace(/^\//, '').replace(/\\/g, '/')
}

function safeBundlePath(root, reference) {
  const resolved = path.resolve(root, normalizeBundleRef(reference))
  const relative = path.relative(root, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null
  return resolved
}

function safeRepositoryOrBundlePath({ bundleRoot, repositoryRoot, reference }) {
  if (reference.startsWith('repo:/')) {
    const resolved = path.resolve(repositoryRoot, reference.slice('repo:/'.length))
    const relative = path.relative(repositoryRoot, resolved)
    return relative.startsWith('..') || path.isAbsolute(relative) ? null : resolved
  }
  return safeBundlePath(bundleRoot, reference)
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

function createValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  return ajv.compile(schema)
}

function schemaErrors(validate) {
  return (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`)
}

export async function validateKnowledgeBundle({ root, now = new Date(), contractRoot } = {}) {
  if (!root) throw new TypeError('root is required')
  const absoluteRoot = path.resolve(root)
  const absoluteContractRoot = path.resolve(contractRoot ?? path.join(absoluteRoot, '..', 'spec'))
  const errors = []
  const addError = (code, relativePath, message) => errors.push({ code, path: relativePath, message })
  let files
  try {
    files = await walk(absoluteRoot)
  } catch (error) {
    return {
      valid: false,
      errors: [{ code: 'bundle.unreadable', path: '.', message: error.message }],
      summary: { documents: 0, capabilities: 0, admittedSubjects: 0 },
    }
  }

  const markdownFiles = files.filter((file) => file.endsWith('.md'))
  const documents = new Map()
  for (const file of markdownFiles) {
    const relativePath = path.relative(absoluteRoot, file).replaceAll(path.sep, '/')
    try {
      documents.set(relativePath, parseDocument(await readFile(file, 'utf8'), relativePath))
    } catch (error) {
      addError('document.frontmatter-invalid', relativePath, error.message)
    }
  }

  if (!documents.has('index.md')) addError('bundle.index-missing', 'index.md', 'bundle root must contain index.md')

  for (const document of documents.values()) {
    const basename = path.posix.basename(document.relativePath)
    if (basename !== 'index.md' && !document.frontmatter?.type) {
      addError('document.type-missing', document.relativePath, 'non-index OKF documents must declare frontmatter type')
    }
    for (const link of markdownLinks(document.body)) {
      if (/^(?:[a-z]+:|#)/i.test(link)) continue
      const target = decodeURIComponent(link.split('#')[0].split('?')[0])
      if (!target) continue
      const resolved = path.resolve(absoluteRoot, path.posix.dirname(document.relativePath), target)
      const relative = path.relative(absoluteRoot, resolved)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        addError('link.outside-bundle', document.relativePath, `link escapes bundle: ${link}`)
      } else if (!files.includes(resolved)) {
        addError('link.missing', document.relativePath, `linked resource does not exist: ${link}`)
      }
    }
  }

  const policyPath = path.join(absoluteRoot, 'references/admission-policy.json')
  const capabilitySchemaPath = path.join(absoluteContractRoot, 'okf-capability-profile.schema.json')
  const admissionSchemaPath = path.join(absoluteContractRoot, 'knowledge-admission-policy.schema.json')
  const reportSchemaPath = path.join(absoluteContractRoot, 'probe-report.schema.json')
  const probeSchemaPath = path.join(absoluteContractRoot, 'probe-definition.schema.json')
  const identitySchemaPath = path.join(absoluteContractRoot, 'probe-identity.schema.json')
  const identityPoolSchemaPath = path.join(absoluteContractRoot, 'probe-identity-pool.schema.json')
  const connectorSchemaPath = path.join(absoluteContractRoot, 'connector-definition.schema.json')
  let policy
  let validateCapability
  let validateReport
  let validateProbe
  let validateIdentity
  let validateIdentityPool
  let validateConnector
  try {
    const [policyValue, capabilitySchema, admissionSchema, reportSchema, probeSchema, identitySchema, identityPoolSchema, connectorSchema] = await Promise.all([
      readJson(policyPath),
      readJson(capabilitySchemaPath),
      readJson(admissionSchemaPath),
      readJson(reportSchemaPath),
      readJson(probeSchemaPath),
      readJson(identitySchemaPath),
      readJson(identityPoolSchemaPath),
      readJson(connectorSchemaPath),
    ])
    const validateAdmission = createValidator(admissionSchema)
    if (!validateAdmission(policyValue)) {
      addError('policy.invalid', 'references/admission-policy.json', schemaErrors(validateAdmission).join('; '))
    }
    policy = policyValue
    validateCapability = createValidator(capabilitySchema)
    validateReport = createValidator(reportSchema)
    validateProbe = createValidator(probeSchema)
    validateIdentity = createValidator(identitySchema)
    validateIdentityPool = createValidator(identityPoolSchema)
    validateConnector = createValidator(connectorSchema)
  } catch (error) {
    addError('policy.unreadable', 'references/admission-policy.json', error.message)
  }

  const capabilities = [...documents.values()].filter((document) => document.frontmatter?.type === 'Capability')
  const admittedSubjects = new Set()
  const referencedConcepts = new Set()

  if (policy && validateCapability && validateReport && validateProbe && validateIdentity && validateIdentityPool && validateConnector) {
    const repositoryRoot = path.dirname(absoluteContractRoot)
    for (const document of documents.values()) {
      const frontmatter = document.frontmatter
      if (!frontmatter?.type || frontmatter.type === 'Log') continue
      const errorPrefix = frontmatter.type === 'Capability' ? 'capability' : 'knowledge'
      if (policy.requireSources && (!Array.isArray(frontmatter.sources) || frontmatter.sources.length === 0)) {
        addError(`${errorPrefix}.sources-missing`, document.relativePath, 'canonical knowledge must declare at least one source')
      }
      if (policy.requireVerified && (!Array.isArray(frontmatter.verified) || frontmatter.verified.length === 0)) {
        addError(`${errorPrefix}.verification-missing`, document.relativePath, 'canonical knowledge must declare verified evidence')
      }
      if (policy.requireFreshKnowledge) {
        const staleAfter = Date.parse(frontmatter.stale_after)
        if (!Number.isFinite(staleAfter)) addError(`${errorPrefix}.freshness-missing`, document.relativePath, 'canonical knowledge must declare a valid stale_after timestamp')
        else if (staleAfter <= now.getTime()) addError(`${errorPrefix}.stale`, document.relativePath, `knowledge became stale at ${frontmatter.stale_after}`)
      }
      for (const source of frontmatter.sources ?? []) {
        if (!source || typeof source.resource !== 'string' || source.resource.length === 0) {
          addError(`${errorPrefix}.source-invalid`, document.relativePath, 'every source must declare resource')
          continue
        }
        if (/^[a-z][a-z0-9+.-]*:/i.test(source.resource) && !source.resource.startsWith('repo:/')) continue
        let sourceFile
        if (source.resource.startsWith('repo:/')) sourceFile = path.resolve(repositoryRoot, source.resource.slice('repo:/'.length))
        else sourceFile = path.resolve(absoluteRoot, path.posix.dirname(document.relativePath), source.resource)
        const sourceBase = source.resource.startsWith('repo:/') ? repositoryRoot : absoluteRoot
        const relativeSource = path.relative(sourceBase, sourceFile)
        if (relativeSource.startsWith('..') || path.isAbsolute(relativeSource)) {
          addError(`${errorPrefix}.source-outside-root`, document.relativePath, `source escapes its declared root: ${source.resource}`)
          continue
        }
        try {
          await readFile(sourceFile)
        } catch (error) {
          addError(`${errorPrefix}.source-unreadable`, document.relativePath, `${source.resource}: ${error.message}`)
        }
      }
    }

    for (const document of capabilities) {
      const errorsBeforeCapability = errors.length
      const frontmatter = document.frontmatter
      const outcomeField = policy.valueAlignment.capabilityOutcomeField
      const outcomes = frontmatter[outcomeField]
      const acceptedOutcomes = new Set(policy.valueAlignment.acceptedOutcomeDomains)
      if (!Array.isArray(outcomes) || outcomes.length === 0) {
        addError('capability.outcome-missing', document.relativePath, `canonical capability must declare at least one ${outcomeField} value`)
      } else {
        const invalidOutcomes = outcomes.filter((outcome) => !acceptedOutcomes.has(outcome))
        if (invalidOutcomes.length > 0) addError('capability.outcome-invalid', document.relativePath, `unsupported outcome domains: ${invalidOutcomes.join(', ')}`)
      }
      const profile = { capability: frontmatter.capability, access: frontmatter.access, verification: frontmatter.verification }
      if (!validateCapability(profile)) {
        addError('capability.profile-invalid', document.relativePath, schemaErrors(validateCapability).join('; '))
        continue
      }

      const subjectPath = normalizeBundleRef(frontmatter.capability.subjectRef)
      const subject = documents.get(subjectPath)
      if (!subject?.frontmatter?.type) {
        addError('capability.subject-missing', document.relativePath, `subject does not exist or lacks type: ${frontmatter.capability.subjectRef}`)
        continue
      }
      if (!SUBJECT_TYPES.has(subject.frontmatter.type)) {
        addError('capability.subject-type', document.relativePath, `unsupported subject type: ${subject.frontmatter.type}`)
        continue
      }

      for (const key of ['inputSchema', 'outputSchema']) {
        const reference = frontmatter.capability[key]
        const file = safeBundlePath(absoluteRoot, reference)
        if (!file || !files.includes(file)) {
          addError('capability.schema-missing', document.relativePath, `${key} does not exist: ${reference}`)
          continue
        }
        try {
          createValidator(await readJson(file))
        } catch (error) {
          addError('capability.schema-invalid', document.relativePath, `${key} is not a valid JSON Schema: ${error.message}`)
        }
      }

      for (const reference of [...(frontmatter.capability.inputConcepts ?? []), ...(frontmatter.capability.resultConcepts ?? [])]) {
        const conceptPath = normalizeBundleRef(reference)
        if (!documents.has(conceptPath)) addError('capability.concept-missing', document.relativePath, `concept does not exist: ${reference}`)
        else referencedConcepts.add(conceptPath)
      }

      const reportReference = frontmatter.verification.report
      const reportFile = safeBundlePath(absoluteRoot, reportReference)
      let report
      if (!reportFile || !files.includes(reportFile)) {
        addError('probe.report-missing', document.relativePath, `probe report does not exist: ${reportReference}`)
        continue
      }
      try {
        report = await readJson(reportFile)
      } catch (error) {
        addError('probe.report-unreadable', normalizeBundleRef(reportReference), error.message)
        continue
      }
      if (!validateReport(report)) {
        addError('probe.report-invalid', normalizeBundleRef(reportReference), schemaErrors(validateReport).join('; '))
        continue
      }
      const capabilityRef = `/${document.relativePath}`
      if (report.capabilityRef !== capabilityRef) addError('probe.capability-mismatch', normalizeBundleRef(reportReference), `expected capabilityRef ${capabilityRef}`)
      if (report.level !== frontmatter.verification.level) addError('probe.level-mismatch', normalizeBundleRef(reportReference), 'report level differs from capability verification level')
      if (policy.requirePassedReport && report.outcome !== 'passed') addError('probe.not-passed', normalizeBundleRef(reportReference), `probe outcome is ${report.outcome}`)
      if (policy.requireFreshReport && Date.parse(report.expiresAt) <= now.getTime()) addError('probe.expired', normalizeBundleRef(reportReference), `probe expired at ${report.expiresAt}`)

      const connectorPath = path.join(repositoryRoot, 'connectors', report.connectorId, 'connector.json')
      try {
        const connector = await readJson(connectorPath)
        if (!validateConnector(connector)) {
          addError('connector.definition-invalid', document.relativePath, schemaErrors(validateConnector).join('; '))
        } else {
          if (!connector.capabilityRefs.includes(capabilityRef)) addError('connector.capability-missing', document.relativePath, `connector ${report.connectorId} does not bind ${capabilityRef}`)
          const handler = connector.handlers.find((candidate) => candidate.capabilityRef === capabilityRef)
          if (!handler) addError('connector.handler-missing', document.relativePath, `connector ${report.connectorId} has no handler for ${capabilityRef}`)
          const conformance = handler?.conformance ?? connector.conformance
          if (conformance.status !== 'verified') addError('connector.not-verified', document.relativePath, `connector ${report.connectorId} handler is ${conformance.status}`)
          if (conformance.probeReportRef !== reportReference) addError('connector.report-mismatch', document.relativePath, `connector ${report.connectorId} handler references a different conformance report`)
          const entrypoint = path.resolve(repositoryRoot, connector.execution.entrypoint)
          const relativeEntrypoint = path.relative(repositoryRoot, entrypoint)
          if (relativeEntrypoint.startsWith('..') || path.isAbsolute(relativeEntrypoint)) addError('connector.entrypoint-outside-repository', document.relativePath, `connector entrypoint escapes repository: ${connector.execution.entrypoint}`)
          else await readFile(entrypoint)
        }
      } catch (error) {
        addError('connector.definition-unreadable', document.relativePath, `${report.connectorId}: ${error.message}`)
      }

      for (const evidence of report.evidence) {
        if (!evidence.ref.startsWith('repo:/')) continue
        const evidenceFile = path.resolve(repositoryRoot, evidence.ref.slice('repo:/'.length))
        const relativeEvidencePath = path.relative(repositoryRoot, evidenceFile)
        if (relativeEvidencePath.startsWith('..') || path.isAbsolute(relativeEvidencePath)) {
          addError('probe.evidence-outside-repository', normalizeBundleRef(reportReference), `evidence escapes repository: ${evidence.ref}`)
          continue
        }
        try {
          const digest = createHash('sha256').update(await readFile(evidenceFile)).digest('hex')
          if (digest !== evidence.sha256) addError('probe.evidence-hash-mismatch', normalizeBundleRef(reportReference), `evidence hash mismatch: ${evidence.ref}`)
        } catch (error) {
          addError('probe.evidence-unreadable', normalizeBundleRef(reportReference), `${evidence.ref}: ${error.message}`)
        }
      }

      const acceptedLevels = policy.subjectTypes[subject.frontmatter.type]?.acceptedVerificationLevels ?? []
      if (!acceptedLevels.includes(report.level)) {
        addError('probe.level-insufficient', normalizeBundleRef(reportReference), `${report.level} is not accepted for ${subject.frontmatter.type}`)
      }

      const probeFile = safeRepositoryOrBundlePath({
        bundleRoot: absoluteRoot,
        repositoryRoot,
        reference: report.probeDefinitionRef,
      })
      if (!probeFile) {
        addError('probe.definition-missing', normalizeBundleRef(reportReference), `probe definition does not exist: ${report.probeDefinitionRef}`)
      } else {
        try {
          const probe = await readJson(probeFile)
          if (!validateProbe(probe)) addError('probe.definition-invalid', normalizeBundleRef(report.probeDefinitionRef), schemaErrors(validateProbe).join('; '))
          if (probe.capabilityRef !== capabilityRef || probe.connectorId !== report.connectorId) {
            addError('probe.definition-mismatch', normalizeBundleRef(report.probeDefinitionRef), 'probe definition does not match capability or connector')
          }
          if (probe.identity.required) {
            if (!report.identityRef || !report.identityPoolRef) {
              addError('probe.identity-missing', normalizeBundleRef(reportReference), 'identity-required probe report must bind an identity and identity pool')
            } else {
              if (report.identityPoolRef !== probe.identity.poolRef) {
                addError('probe.identity-pool-mismatch', normalizeBundleRef(reportReference), 'report identity pool differs from probe definition')
              }
              const identityId = report.identityRef.slice('identity:'.length)
              const poolId = report.identityPoolRef.slice('identity-pool:'.length)
              const identityPath = path.join(repositoryRoot, 'probes/identities', `${identityId}.json`)
              const poolPath = path.join(repositoryRoot, 'probes/pools', `${poolId}.json`)
              try {
                const identity = await readJson(identityPath)
                if (!validateIdentity(identity)) addError('probe.identity-invalid', normalizeBundleRef(reportReference), schemaErrors(validateIdentity).join('; '))
                else {
                  if (identity.id !== identityId) addError('probe.identity-id-mismatch', normalizeBundleRef(reportReference), 'identity file id differs from report identityRef')
                  if (identity.subjectRef !== frontmatter.capability.subjectRef) addError('probe.identity-subject-mismatch', normalizeBundleRef(reportReference), 'identity subject differs from capability subject')
                  if (!identity.allowedCapabilityRefs.includes(capabilityRef)) addError('probe.identity-capability-missing', normalizeBundleRef(reportReference), 'identity does not allow this capability')
                  if (identity.lifecycle.state !== 'active') addError('probe.identity-inactive', normalizeBundleRef(reportReference), `identity is ${identity.lifecycle.state}`)
                }
              } catch (error) {
                addError('probe.identity-unreadable', normalizeBundleRef(reportReference), `${report.identityRef}: ${error.message}`)
              }
              try {
                const pool = await readJson(poolPath)
                if (!validateIdentityPool(pool)) addError('probe.identity-pool-invalid', normalizeBundleRef(reportReference), schemaErrors(validateIdentityPool).join('; '))
                else {
                  if (pool.id !== poolId) addError('probe.identity-pool-id-mismatch', normalizeBundleRef(reportReference), 'identity pool file id differs from report identityPoolRef')
                  if (!pool.identityRefs.includes(report.identityRef)) addError('probe.identity-not-in-pool', normalizeBundleRef(reportReference), 'identity pool does not contain report identity')
                }
              } catch (error) {
                addError('probe.identity-pool-unreadable', normalizeBundleRef(reportReference), `${report.identityPoolRef}: ${error.message}`)
              }
            }
          } else if (report.identityRef || report.identityPoolRef) {
            addError('probe.identity-unexpected', normalizeBundleRef(reportReference), 'identity-free probe report must not bind an identity or identity pool')
          }
        } catch (error) {
          addError('probe.definition-unreadable', normalizeBundleRef(report.probeDefinitionRef), error.message)
        }
      }

      if (errors.length === errorsBeforeCapability && !errors.some((error) => error.path === document.relativePath || error.path === subjectPath)) {
        admittedSubjects.add(subjectPath)
      }
    }
  }

  if (policy?.rejectOrphans) {
    for (const document of documents.values()) {
      const type = document.frontmatter?.type
      if (!type || EXEMPT_ORPHAN_TYPES.has(type)) continue
      if (SUBJECT_TYPES.has(type) && !admittedSubjects.has(document.relativePath)) {
        addError('knowledge.orphan-subject', document.relativePath, `${type} is not backed by an admitted capability`)
      } else if (!SUBJECT_TYPES.has(type) && !referencedConcepts.has(document.relativePath)) {
        addError('knowledge.orphan-concept', document.relativePath, `${type} is not reachable from an admitted capability`)
      }
    }
  }

  errors.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code))
  return {
    valid: errors.length === 0,
    errors,
    summary: {
      documents: documents.size,
      capabilities: capabilities.length,
      admittedSubjects: admittedSubjects.size,
    },
  }
}
