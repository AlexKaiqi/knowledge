#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { auditStoreAiReadiness } from '../connectors/optifeed-radar-ai-readiness/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const radarRoot = path.resolve(process.env.OPTIFEED_RADAR_ROOT ?? path.join(repositoryRoot, '.runtime/optifeed-radar'))
const domain = process.argv[2]

if (!domain || process.argv.length !== 3 || domain === '--help' || domain === '-h') {
  process.stderr.write('Usage: npm run distribution:ai-readiness:audit -- <bare-public-domain>\n')
  process.exitCode = domain === '--help' || domain === '-h' ? 0 : 2
} else {
  const [inputSchema, outputSchema] = await Promise.all([
    readFile(path.join(repositoryRoot, 'knowledge/schemas/distribution/audit-store-ai-readiness-input.schema.json'), 'utf8').then(JSON.parse),
    readFile(path.join(repositoryRoot, 'knowledge/schemas/distribution/audit-store-ai-readiness-output.schema.json'), 'utf8').then(JSON.parse),
  ])
  const ajv = new Ajv2020({ allErrors: true })
  addFormats(ajv)
  const input = { domain }
  const inputValid = ajv.compile(inputSchema)(input)
  if (!inputValid) throw new Error('domain does not conform to the public capability input schema')

  const result = await auditStoreAiReadiness(input, { radarRoot })
  const outputValid = ajv.compile(outputSchema)(result)
  if (!outputValid || result.conformance.status !== 'passed') throw new Error('Radar result did not conform to the public capability contract')
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
