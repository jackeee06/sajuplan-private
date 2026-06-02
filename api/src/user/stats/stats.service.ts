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
   * 메인 카드 두 개 — 2026-05-25 정책 변경:
   *  표시값 = 어드민 디폴트(override) + 실제 자동 집계
   *
   *  실제 집계:
   *   - recent_consultations: 최근 24시간 consultation INSERT (reason='DISCONNECT/END_CHAT/END_CHAT_LOCAL')
   *   - online_counselors:    role='counselor' + state 활동 상태 + 채널 활성
   *
   *  마케팅 의도: 초기에는 실제=0 이라 디폴트만 보이고, 사용이 늘면 자동으로 합산 증가.
   *  운영자가 디폴트 점점 줄이면서 정직한 수치로 자연스럽게 이행.
   */
  async getMainStats(): Promise<{
    recent_consultations: number;
    online_counselors: number;
  }> {
    // 1) 어드민 디폴트 (override) — setting 테이블
    const overrideRows = await this.sql<{ key: string; value: string | null }[]>`
      SELECT key, value FROM setting
       WHERE namespace = 'site'
         AND key IN (
           'stat_recent_consultations_override',
           'stat_online_counselors_override',
           'stat_recent_hours_window'
         )
    `;
    const readOverride = (k: string): number => {
      const r = overrideRows.find((x) => x.key === k);
      const v = (r?.value ?? '').trim().replace(/[^0-9]/g, '');
      return v ? Number(v) : 0;
    };
    const recentOverride = readOverride('stat_recent_consultations_override');
    const onlineOverride = readOverride('stat_online_counselors_override');
    // 집계 기간(시간) — 어드민에서 조정. 0 또는 미설정 시 기본 24시간.
    const hoursWindow = readOverride('stat_recent_hours_window') || 24;

    // 2) 실제 자동 집계 — interval 은 setting 의 stat_recent_hours_window 시간 적용
    const recentRows = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM consultation
       WHERE created_at > now() - (${hoursWindow}::int || ' hours')::interval
         AND reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
    `;
    const onlineRows = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM member
       WHERE role = 'counselor'
         AND left_at IS NULL
         AND state IN ('IDLE', 'RDCH', 'RDVC', 'CRDY', 'CONN', 'CNCH')
         AND (use_phone = true OR use_chat = true)
    `;
    const recentActual = Number(recentRows[0]?.cnt ?? 0);
    const onlineActual = Number(onlineRows[0]?.cnt ?? 0);

    return {
      recent_consultations: recentOverride + recentActual,
      online_counselors: onlineOverride + onlineActual,
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
