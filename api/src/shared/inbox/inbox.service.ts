import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../db/db.module';

/**
 * 알림함 기록 헬퍼 — "회원·상담사에게 온 모든 알림"을 종모양(notification_log)에 한 줄로 남긴다.
 *
 * 설계 원칙 (2026-06-19):
 *  - 비즈니스 이벤트(채팅요청/전화요청/문의/후기/등급/정산/선지급/쿠폰/답변 등)가 발생하는
 *    바로 그 지점에서 record() 를 **1회** 호출한다. → 한 사건 = 한 행 (중복 없음).
 *  - 그 사건이 실제로 어떤 채널로 나갔는지 via_push / via_alimtalk 플래그로 박는다.
 *    via_inapp 는 항상 true (종모양에 노출되어야 하므로).
 *  - 카카오 알림톡으로도 나간 사건이면 viaAlimtalk=true → 화면에 💬카톡 뱃지.
 *
 * 보안 (중요):
 *  - 인증번호(register_num_v2)·임시비밀번호(register_idpw1)·운영자 OpsAlert 는
 *    **record() 를 호출하지 않는다**. 알림함에 민감정보가 절대 들어오지 않도록 원천 차단.
 *
 * 안전:
 *  - 부가 기능이므로 어떤 경우에도 throw 하지 않는다(best-effort). 본 비즈니스/머니 흐름을
 *    절대 방해하면 안 됨. INSERT 실패는 warn 로그만 남기고 삼킨다.
 *  - DbModule(@Global) 의 SQL 토큰만 의존 → 트랜잭션 밖에서 독립 실행.
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger('InboxService');

  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 개별 회원/상담사 알림 1행 기록.
   * @param p.memberId   수신자 member.id (필수)
   * @param p.code       이벤트 코드 — 화면 아이콘/라벨 매핑 키 (예: 'chat_request','review','grade','settlement','coupon','qna_answer' ...)
   * @param p.title      알림 제목
   * @param p.content    본문(선택)
   * @param p.linkUrl    바로가기 경로(선택, 내부 경로 권장 — 예: '/chat/123')
   * @param p.viaPush    FCM 푸시로도 발송됐는가
   * @param p.viaAlimtalk 카카오 알림톡으로도 발송됐는가
   */
  async record(p: {
    memberId: number;
    code: string;
    title: string;
    content?: string;
    linkUrl?: string | null;
    viaPush?: boolean;
    viaAlimtalk?: boolean;
  }): Promise<void> {
    try {
      if (!p.memberId || !Number.isFinite(Number(p.memberId))) return;
      const memberId = Number(p.memberId);

      const mb = await this.sql<{ mb_id: string | null }[]>`
        SELECT mb_id FROM member WHERE id = ${memberId} LIMIT 1
      `;
      if (mb.length === 0) return; // 탈퇴/없는 회원 — 조용히 무시
      const mbId = mb[0].mb_id ?? '';

      await this.sql`
        INSERT INTO notification_log
          (member_id, mb_id, title, content, link_url, category, code,
           via_inapp, via_push, via_alimtalk)
        VALUES
          (${memberId}, ${mbId}, ${p.title}, ${p.content ?? ''},
           ${p.linkUrl ?? null}, '개별', ${p.code},
           true, ${p.viaPush ?? false}, ${p.viaAlimtalk ?? false})
      `;
    } catch (e) {
      // 알림함 기록 실패가 본 흐름을 막으면 안 됨 — 로그만.
      this.logger.warn(
        `[inbox record 실패] member=${p.memberId} code=${p.code}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}
