#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { validateKnowledgeBundle } from './okf-catalog-lib.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
let root = 'knowledge'
let now
let json = false

for (let index = 0; index < args.length; index += 1) {
  const argument = args[index]
  if (argument === '--root') root = args[++index]
  else if (argument === '--now') now = new Date(args[++index])
  else if (argument === '--json') json = true
  else throw new Error(`unknown argument: ${argument}`)
}

if (!root) throw new Error('--root requires a value')
if (now && Number.isNaN(now.getTime())) throw new Error('--now must be an RFC 3339 timestamp')

const resolvedRoot = path.resolve(process.cwd(), root)
const rootRelativeToRepository = path.relative(repositoryRoot, resolvedRoot)
if (rootRelativeToRepository.startsWith('..') || path.isAbsolute(rootRelativeToRepository)) {
  throw new Error('--root must stay inside the package repository')
}

const result = await validateKnowledgeBundle({
  root: resolvedRoot,
  contractRoot: path.join(repositoryRoot, 'spec'),
  now,
})

if (json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else if (result.valid) {
  process.stdout.write(`OKF knowledge valid: ${result.summary.documents} documents, ${result.summary.capabilities} capabilities, ${result.summary.admittedSubjects} admitted subjects\n`)
} else {
  for (const error of result.errors) process.stderr.write(`${error.path}: ${error.code}: ${error.message}\n`)
}

if (!result.valid) process.exitCode = 1
