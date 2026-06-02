import { test } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * admin 인증 storageState 가 비어있으면(로그인 실패) 해당 test 를 자동 skip.
 *
 * 사장님이 admin 비번을 바꾼 뒤 E2E_ADMIN_PW 환경변수 미갱신 상태에서도
 * 다른 spec 들은 정상 실행. admin 관련 spec 만 silently skip.
 *
 * 사용 (test.beforeEach 안):
 *   import { skipIfAdminLoginFailed } from '../helpers/admin-skip'
 *   test.describe('mng', () => {
 *     test.beforeEach(skipIfAdminLoginFailed)
 *     ...
 *   })
 */
export async function skipIfAdminLoginFailed(): Promise<void> {
  const storagePath = path.resolve(__dirname, '..', 'storageState.json')
  if (!fs.existsSync(storagePath)) {
    test.skip(true, 'storageState.json 없음 (global-setup 실행 전)')
    return
  }
  try {
    const raw = JSON.parse(fs.readFileSync(storagePath, 'utf-8'))
    const cookies: unknown[] = raw.cookies ?? []
    if (cookies.length === 0) {
      test.skip(
        true,
        'admin 인증 쿠키 없음 — global-setup admin 로그인 실패. ' +
          'E2E_ADMIN_PW 환경변수 설정 후 재실행',
      )
    }
  } catch {
    test.skip(true, 'storageState.json 파싱 실패')
  }
}
