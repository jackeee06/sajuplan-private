/**
 * 단일 환경 플래그 VITE_SAJUMOON_ENV (test|prod) 한 곳에서만 도메인 결정.
 * localhost 는 어디서도 fallback 으로 쓰지 않는다.
 *
 *   VITE_SAJUMOON_ENV=test → sajumoon.kr     / api.sajumoon.kr     (테스트)
 *   VITE_SAJUMOON_ENV=prod → sajumoon.co.kr  / api.sajumoon.co.kr  (운영)
 */
type SajumoonEnv = 'test' | 'prod'

const MAP: Record<SajumoonEnv, { userDomain: string; apiDomain: string }> = {
  test: { userDomain: 'sajumoon.kr', apiDomain: 'api.sajumoon.kr' },
  prod: { userDomain: 'sajumoon.co.kr', apiDomain: 'api.sajumoon.co.kr' },
}

function resolve(): { env: SajumoonEnv; userDomain: string; apiDomain: string; userSiteUrl: string; apiBase: string; fileBase: string } {
  const raw = String(import.meta.env.VITE_SAJUMOON_ENV ?? '').trim().toLowerCase()
  // 미설정이면 test 로 폴백 (운영용 빌드는 반드시 VITE_SAJUMOON_ENV=prod 로 빌드).
  // throw 하지 않는 이유: 옛 빌드/캐시에서 환경변수 누락 시 흰 화면 사고 방지.
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
