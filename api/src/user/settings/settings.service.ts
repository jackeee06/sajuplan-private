import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 사용자 페이지에 노출할 공개 setting 값.
 * 보안상 — 외부에 노출해도 안전한 키만 응답에 포함:
 *   footer.* (회사정보)
 *   site.kakao_channel_url (카카오 1:1 상담 링크)
 *   site.title (사이트 제목)
 *   review.* (후기 작성 포인트 지급 정책 — 안내 문구에 사용)
 *
 * 절대 노출 금지: social_*, security_*, recaptcha_secret 등
 */
@Injectable()
export class UserSettingsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async getPublicSettings(): Promise<Record<string, string>> {
    const rows = await this.sql<{ namespace: string; key: string; value: string | null }[]>`
      SELECT namespace, key, value
        FROM setting
       WHERE (
         namespace = 'footer'
         OR (namespace = 'site' AND key IN ('title', 'kakao_channel_url'))
         OR namespace = 'review'
         OR (namespace = 'maintenance' AND key IN ('banner_active', 'banner_title', 'banner_body', 'banner_link'))
       )
    `;
    const out: Record<string, string> = {};
    for (const r of rows) {
      out[`${r.namespace}.${r.key}`] = r.value ?? '';
    }
    return out;
  }
}
