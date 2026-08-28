import { executeCandidateXiaohongshuAndroidSearch } from '../connectors/xiaohongshu-android-observation/src/index.mjs'

function argument(name, fallback) {
  const prefix = `--${name}=`
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix))
  return value ? value.slice(prefix.length) : fallback
}

const route = argument('route', 'portal-http')
const query = argument('query', '拼豆')
const runtimeOrigin = argument('origin', route === 'portal-http' ? 'http://127.0.0.1:8080' : 'http://127.0.0.1:4723')

if (!['portal-http', 'appium-w3c'].includes(route)) throw new Error('route must be portal-http or appium-w3c')

const config = {
  routeId: route,
  runtimeOrigin,
  settleMs: 1_500,
  ...(route === 'appium-w3c' ? { appiumSessionId: process.env.XHS_ANDROID_APPIUM_SESSION_ID } : {}),
}
const credentials = route === 'portal-http' ? { portalToken: process.env.XHS_ANDROID_PORTAL_TOKEN } : undefined
const result = await executeCandidateXiaohongshuAndroidSearch({ platform: 'xiaohongshu', query, limit: 10 }, { config, credentials })
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
