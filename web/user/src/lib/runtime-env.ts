/**
 * 단일 환경 플래그 sajumoonEnv (test|prod) 한 곳에서만 도메인 결정.
 * localhost 는 어디서도 fallback 으로 쓰지 않는다. (로컬에서 API 를 띄우지 않음)
 *
 *   test → https://sajumoon.kr      / https://api.sajumoon.kr     (테스트)
 *   prod → https://sajumoon.co.kr   / https://api.sajumoon.co.kr  (운영)
 *
 * 환경 결정은 **런타임**에 이루어진다:
 *   index.html 이 React 번들보다 먼저 /config.js 를 로드.
 *   /config.js 는 `window.__SAJUMOON_CONFIG = { env: 'test'|'prod' }` 을 셋팅.
 *   서버별로 /config.js 내용이 다름 (deploy.sh 가 dist/config.js 를 환경에 맞게 작성).
 *
 *   장점: dist 번들이 환경 독립적 → 한 번 빌드로 test/prod 양쪽 배포 가능.
 *   폴백: window.__SAJUMOON_CONFIG 가 없으면(예: dev 서버), Vite env 변수 또는 'test'.
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
  // 1순위: 런타임 주입 (/config.js 의 window.__SAJUMOON_CONFIG)
  // 2순위: 빌드타임 Vite env (구버전 호환, 로컬 dev 서버용)
  // 3순위: 'test' 폴백 (운영 흰 화면 사고 방지)
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
