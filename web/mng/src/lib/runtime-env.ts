/**
 * 단일 환경 플래그 (test|prod) 한 곳에서만 도메인 결정. 런타임 결정 — /config.js 가
 * React 번들보다 먼저 로드되어 window.__SAJUMOON_CONFIG.env 를 셋팅한다.
 *
 *   test → sajumoon.kr     / api.sajumoon.kr     (테스트)
 *   prod → sajumoon.co.kr  / api.sajumoon.co.kr  (운영)
 *
 * dist 번들이 환경 독립적이라 한 번 빌드로 test/prod 양쪽 배포 가능.
 */
type SajumoonEnv = 'test' | 'prod'

const MAP: Record<SajumoonEnv, { userDomain: string; apiDomain: string }> = {
  test: { userDomain: 'sajumoon.kr', apiDomain: 'api.sajumoon.kr' },
  prod: { userDomain: 'sajumoon.co.kr', apiDomain: 'api.sajumoon.co.kr' },
}

declare global {
  interface Window {
    __SAJUMOON_CONFIG?: { env?: string }
  }
}

function resolve(): { env: SajumoonEnv; userDomain: string; apiDomain: string; userSiteUrl: string; apiBase: string; fileBase: string } {
  const runtimeEnv = typeof window !== 'undefined' ? window.__SAJUMOON_CONFIG?.env : undefined
  const buildEnv = import.meta.env.VITE_SAJUMOON_ENV
  const raw = String(runtimeEnv ?? buildEnv ?? '').trim().toLowerCase()
  const env: SajumoonEnv = raw === 'prod' ? 'prod' : 'test'
  const { userDomain, apiDomain } = MAP[env]
  const userSiteUrl = `https://${userDomain}`
  const apiOrigin = `https://${apiDomain}`
  return {
    env,
    userDomain,
    apiDomain,
    userSiteUrl,
    apiBase: `${apiOrigin}/api`,
    fileBase: apiOrigin,
  }
}

const RT = resolve()

export const SAJUMOON_ENV = RT.env
export const USER_DOMAIN = RT.userDomain
export const API_DOMAIN = RT.apiDomain
export const USER_SITE_URL = RT.userSiteUrl
export const API_BASE = RT.apiBase
export const FILE_BASE = RT.fileBase
