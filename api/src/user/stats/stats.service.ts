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
}
