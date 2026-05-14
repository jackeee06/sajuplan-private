import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 사용자 메인 페이지에 노출할 공개 통계.
 * 어드민 dashboard 와 같은 데이터 소스(consultation, member) 사용.
 */
@Injectable()
export class UserStatsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 메인 카드 두 개:
   *  - recent_consultations : 오늘 상담 건수 (최근 24시간)
   *  - online_counselors    : 현재 접속중인 상담사 (state 가 활동 상태)
   */
  async getMainStats(): Promise<{
    recent_consultations: number;
    online_counselors: number;
  }> {
    // 어드민에서 입력한 값 그대로 메인 카드에 표시
    const rows = await this.sql<{ key: string; value: string | null }[]>`
      SELECT key, value FROM setting
       WHERE namespace = 'site'
         AND key IN ('stat_recent_consultations_override', 'stat_online_counselors_override')
    `;
    const read = (k: string): number => {
      const r = rows.find((x) => x.key === k);
      const v = (r?.value ?? '').trim().replace(/[^0-9]/g, '');
      return v ? Number(v) : 0;
    };
    return {
      recent_consultations: read('stat_recent_consultations_override'),
      online_counselors: read('stat_online_counselors_override'),
    };
  }

  /**
   * 방문자 1건 기록.
   * - visit_log: (visit_ip, visit_date) UNIQUE → 같은 IP는 같은 날 1회만 카운트
   * - visit_summary: 신규 row 가 추가된 경우에만 카운트 증가
   * - 3개월 초과 데이터는 삭제 (DASHBOARD 가 최근 14일만 사용하므로 보존 부담 없음)
   */
  async recordVisit(ip: string, userAgent: string | null): Promise<void> {
    const safeIp = isValidIp(ip) ? ip : '0.0.0.0';
    const ua = userAgent ? userAgent.slice(0, 500) : null;

    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO visit_log (visit_ip, visit_date, visit_time, user_agent)
      VALUES (${safeIp}::inet, CURRENT_DATE, CURRENT_TIME, ${ua})
      ON CONFLICT (visit_ip, visit_date) DO NOTHING
      RETURNING id
    `;
    if (inserted.length > 0) {
      await this.sql`
        INSERT INTO visit_summary (visit_date, visit_count)
        VALUES (CURRENT_DATE, 1)
        ON CONFLICT (visit_date) DO UPDATE SET visit_count = visit_summary.visit_count + 1
      `;
    }

    await this.sql`DELETE FROM visit_log     WHERE visit_date < CURRENT_DATE - INTERVAL '3 months'`;
    await this.sql`DELETE FROM visit_summary WHERE visit_date < CURRENT_DATE - INTERVAL '3 months'`;
  }
}

function isValidIp(s: string): boolean {
  // Accept IPv4 (a.b.c.d) and IPv6 (contains colon). Postgres INET will validate; this just guards against empty/garbage.
  if (!s) return false;
  if (s.includes(':')) return /^[0-9a-fA-F:.%]+$/.test(s);
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(s);
}
