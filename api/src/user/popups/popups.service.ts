import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface PublicPopup {
  id: number;
  title: string;
  content: string;
  is_html: boolean;
  image_url: string | null;
  image_url_webp: string | null;
  link_url: string | null;
  disable_hours: number;
}

/**
 * 사용자 팝업(공지 레이어) 노출 — 관리자(/mng/popup-layers)가 등록한 popup_notice 중
 * 현재 활성+기간 내인 것을 사용자 앱에 내려준다. (2026-06-12 신설)
 *
 * 대상(audience) + 위치(area) 분기 (2026-06-12):
 *   - area='home'(회원 영역, 홈): 비로그인 → 'all' 만 / 로그인 → 'all'+'member'
 *   - area='counselor'(상담사 마이페이지): 상담사 계정만 → 'all'+'counselor', 그 외 → 없음
 * device 는 모바일 웹앱이므로 'both'/'mobile' 만.
 */
@Injectable()
export class UserPopupsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async listActive(opts: { area: 'home' | 'counselor'; role?: string }): Promise<PublicPopup[]> {
    const { area, role } = opts;

    let audienceCond;
    if (area === 'counselor') {
      if (role !== 'counselor') return []; // 상담사 영역인데 상담사 계정 아님 → 없음
      audienceCond = this.sql`audience IN ('all', 'counselor')`;
    } else {
      // home
      audienceCond = role
        ? this.sql`audience IN ('all', 'member')`
        : this.sql`audience = 'all'`;
    }

    return this.sql<PublicPopup[]>`
      SELECT id, title, content, is_html, image_url, image_url_webp, link_url,
             COALESCE(disable_hours, 24) AS disable_hours
        FROM popup_notice
       WHERE is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at   IS NULL OR ends_at   >= now())
         AND (device IS NULL OR device IN ('both', 'mobile'))
         AND ${audienceCond}
       ORDER BY id DESC
    `;
  }
}
