#!/usr/bin/env node

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { XiaohongshuSkillCliDriver } from '../connectors/xiaohongshu-browser/src/index.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = path.resolve(process.env.KNOWLEDGE_XHS_SKILL_RUNTIME_ROOT ?? path.join(repositoryRoot, '.runtime/xiaohongshu-skill'))
const profile = process.env.KNOWLEDGE_XHS_SKILL_PROFILE
if (!profile) throw new Error('KNOWLEDGE_XHS_SKILL_PROFILE must be an opaque local profile identifier')

const driver = new XiaohongshuSkillCliDriver({ runtimeRoot, profile, headless: false })
const result = await driver.authorize()
process.stdout.write(`${JSON.stringify({
  routeId: 'creator-web-xiaohongshu-skill',
  profile,
  ...result,
  note: 'Browser session data remains in the upstream profile store outside Git.',
}, null, 2)}\n`)
if (!result.readReady || !result.writeReady) process.exitCode = 2
