import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQL, type Sql } from '../../shared/db/db.module';
import { M2netService } from '../../shared/m2net/m2net.service';
import { SmsService } from '../sms/sms.service';
import { PushService } from '../../shared/push/push.service';

export interface PublicCounselor {
  id: number;
  mb_id: string | null;
  name: string;
  nickname: string;
  csrid: string | null;
  /** 회원이 ARS에서 누르는 상담사 연결번호 (자동 부여) — 카드/상세에 노출 */
  dtmfno: string | null;
  state: string;
  use_phone: boolean;
  use_chat: boolean;
  is_rising: boolean;
  is_recommended: boolean;
  /** post_counselor 에서 — 헤드라인/특기/단가 */
  title: string | null;
  headline: string | null;
  specialty: string | null;
  hashtag1: string | null;
  hashtag2: string | null;
  unit_seconds: number | null;
  unit_cost: number | null;
  review_count: number;
  fan_count: number;
  /** 프로필 사진 URL — member_file 에서 kind='profile' 첫 번째 */
  profile_image: string | null;
  /** 프로필 사진 WebP 변환본 (있으면) — <picture> source 로 우선 사용 */
  profile_image_webp: string | null;
  /** 카테고리 추정 (specialty 또는 hashtag 에서 사주/타로/신점 매칭) */
  category: '사주' | '타로' | '신점' | '기타';
  /** 요청자가 이 상담사를 단골 등록했는지 (비로그인이면 false) */
  is_liked: boolean;
  /** 24시간 내 "상담요청하기" 신청 여부 (2026-05-22) — 부재 상담사 카드 버튼 분기에 사용. */
  is_requested: boolean;
  /** 신규 상담사 — 가입 후 90일 이내 (2026-05-15 신설). 카드 NEW 뱃지 노출용. */
  is_new: boolean;
  /**
   * 후기 평균 별점 (1~5, 후기 없으면 0).
   * ⚠️ 현재 사용자 UI(상담사 리스트 카드 등)에서 노출하지 않는 **비활성 기능** (2026-05-15).
   *     별점 데이터 정착도가 낮아 0.0 노출이 오히려 신뢰도를 해친다는 운영 판단.
   *     데이터는 계속 누적되며 (`review.rating` 컬럼 그대로 수집), 시스템 정착 시 UI 부활 예정.
   *     필드 자체와 SQL 계산은 유지해서 호환성·복귀 비용을 최소화.
   */
  rating_avg: number;
}

export type CounselorTab = 'all' | 'popular' | 'chat' | 'new';

/** 상담사 상세 (단건) — 메인 리스트에 더해 intro/bio/traits/content/notice/specialty 배열 등 풍부한 정보 */
export interface PublicCounselorDetail {
  id: number;
  mb_id: string | null;
  name: string;
  nickname: string;
  csrid: string | null;
  /** 회원이 ARS에서 누르는 상담사 연결번호 (자동 부여) — 카드/상세에 노출 */
  dtmfno: string | null;
  state: string;
  use_phone: boolean;
  use_chat: boolean;
  is_rising: boolean;
  is_recommended: boolean;
  /** 한줄소개 */
  headline: string | null;
  /** 전문분야 — '|' 또는 ',' 구분 → 배열로 변환된 결과 */
  fields: string[];
  /** 스타일 키워드 배열 */
  traits: string[];
  /** 약력 (multiline) */
  bio: string | null;
  /** 약력을 줄바꿈으로 분리한 배열 (UI 에서 ul 로 노출) */
  career: string[];
  /** 상담사 공지사항 본문 */
  notice_content: string | null;
  /** 공지 마지막 갱신일 (ISO) */
  notice_date: string;
  /** 소개 본문 (탭=intro) */
  intro: string | null;
  /** 해시태그 (post_counselor.hashtag1/2 + 추가 가능 시) */
  hashtags: string[];
  unit_seconds: number | null;
  unit_cost: number | null;
  review_count: number;
  fan_count: number;
  /** 프로필 이미지 (avatar) */
  profile_image: string | null;
  profile_image_webp: string | null;
  /** 히어로 이미지 (wide) — 없으면 profile_image fallback */
  hero_image: string | null;
  hero_image_webp: string | null;
  /** 히어로 이미지 위 헤드라인 캡션 (빈 문자열이면 미노출) */
  wide_headline: string | null;
  /** 히어로 이미지 위 서브카피 (빈 문자열이면 미노출) */
  wide_subcaption: string | null;
  category: '사주' | '타로' | '신점' | '기타';
  /**
   * "현재 N명이 같은 페이지를 보고 있습니다" 표시값.
   * 신 시스템엔 실시간 presence 추적이 없어 상담사 ID + 5분 시간버킷 해시로 자연스럽게 변동하는 의사값.
   */
  live_viewers: number;
  /** 해당 상담사의 문의(counselor_qna) 총 건수 */
  qna_count: number;
  /** 요청자가 이 상담사를 단골 등록했는지 (비로그인이면 false) */
  is_liked: boolean;
}

/**
 * 사용자 메인 페이지 상담사 리스트.
 * sample/theme/basic/mobile/index.php 의 메인 탭 중 tab02 인기 / tab04 채팅 / tab05 전체 매핑.
 * 후기 탭은 별도 서비스 (`UserReviewsService.recent`) 에서 처리.
 */
@Injectable()
export class UserCounselorsService {
  private readonly logger = new Logger(UserCounselorsService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly m2net: M2netService,
    private readonly sms: SmsService,
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 회원이 부재중 상담사에게 "지금 접속해주세요" 호출 알림 발송 (2026-05-22).
   *
   * 흐름:
   *   1) 본인 본인 차단
   *   2) 24시간 내 같은 (member, counselor) 중복 신청 차단
   *   3) DB INSERT (counselor_request_alert)
   *   4) BizM 알림톡 발송 시도 (템플릿 코드: BIZM_TPL_COUNSELOR_REQUEST 또는 'counselor_request_v1')
   *   5) FCM 푸시 발송 시도 (member_push_token 의 active token)
   *   6) DB UPDATE (notified_at, notify_method)
   *
   * 알림톡이 BizM 콘솔에 등록 + 카카오 승인되어야 발송됨. 미승인 상태에서는 K104 반환 → silent fail.
   * 푸시는 FCM 인프라가 있고 토큰이 등록된 회원에게만 도달.
   */
  async requestConsult(params: {
    requesterId: number;
    counselorId: number;
  }): Promise<{ ok: true; already?: boolean; notified: { alimtalk: boolean; push: boolean } }> {
    if (params.requesterId === params.counselorId) {
      throw new BadRequestException('본인에게 상담을 요청할 수 없습니다.');
    }

    // 상담사 정보 조회 + 검증
    const counselorRows = await this.sql<{
      id: number; role: string; nickname: string; name: string; phone: string | null; left_at: Date | null;
    }[]>`
      SELECT id, role, nickname, name, phone, left_at
        FROM member WHERE id = ${params.counselorId} LIMIT 1
    `;
    const counselor = counselorRows[0];
    if (!counselor || counselor.role !== 'counselor' || counselor.left_at) {
      throw new NotFoundException('상담사를 찾을 수 없습니다.');
    }

    // 24시간 내 중복 신청 차단
    const recent = await this.sql<{ id: number }[]>`
      SELECT id FROM counselor_request_alert
       WHERE member_id = ${params.requesterId}
         AND counselor_id = ${params.counselorId}
         AND requested_at > now() - interval '24 hours'
       LIMIT 1
    `;
    if (recent.length > 0) {
      return { ok: true, already: true, notified: { alimtalk: false, push: false } };
    }

    // 요청자 닉네임 조회 (알림 내용용)
    const requesterRows = await this.sql<{ nickname: string | null; name: string | null }[]>`
      SELECT nickname, name FROM member WHERE id = ${params.requesterId} LIMIT 1
    `;
    const requesterNick =
      (requesterRows[0]?.nickname || requesterRows[0]?.name || '회원').trim();

    // DB INSERT
    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO counselor_request_alert (counselor_id, member_id, requested_at)
      VALUES (${params.counselorId}, ${params.requesterId}, now())
      RETURNING id
    `;
    const rowId = inserted[0].id;

    // 알림 발송 — 알림톡 + 푸시 모두 시도. 둘 다 실패해도 DB row 는 유지 (이력).
    const counselorDisplayName = (counselor.nickname || counselor.name || '').trim();
    let alimtalkOk = false;
    let pushOk = false;
    let lastError = '';

    if (counselor.phone) {
      const tplCode = this.config.get<string>('BIZM_TPL_COUNSELOR_REQUEST') ?? 'counselor_request_v1';
      try {
        const r = await this.sms.sendAlimtalkByCode(
          tplCode,
          counselor.phone,
          { member_nickname: requesterNick, url: 'mypage' },
          `[사주플랜] ${requesterNick} 님이 상담을 요청했습니다.`,
        );
        alimtalkOk = !!r.ok;
        if (!r.ok) lastError = `alimtalk: ${r.reason ?? 'unknown'}`;
      } catch (e) {
        lastError = `alimtalk: ${e instanceof Error ? e.message : String(e)}`;
        this.logger.warn(`[requestConsult] 알림톡 실패 counselorId=${params.counselorId}: ${lastError}`);
      }
    }

    try {
      const tokenRows = await this.sql<{ token: string }[]>`
        SELECT token FROM member_push_token
         WHERE member_id = ${params.counselorId} AND is_active = true
      `;
      const tokens = tokenRows.map((t) => t.token).filter(Boolean);
      if (tokens.length > 0) {
        const r = await this.push.sendToTokens(tokens, {
          title: '상담 요청이 도착했습니다',
          body: `${requesterNick} 님이 상담을 요청했습니다. 지금 접속해주세요.`,
          data: { type: 'counselor_request', counselor_id: String(params.counselorId), link: '/mypage' },
        });
        pushOk = r.success > 0;
        if (!pushOk && r.error) lastError = `${lastError} | push: ${r.error}`.trim();
      }
    } catch (e) {
      this.logger.warn(`[requestConsult] FCM 실패 counselorId=${params.counselorId}: ${e instanceof Error ? e.message : String(e)}`);
    }

    // DB 업데이트 — 알림 발송 결과 기록
    const method =
      alimtalkOk && pushOk ? 'alimtalk+push'
      : alimtalkOk ? 'alimtalk'
      : pushOk ? 'push'
      : 'failed';
    await this.sql`
      UPDATE counselor_request_alert
         SET notified_at = now(),
             notify_method = ${method},
             notify_error = ${lastError || null}
       WHERE id = ${rowId}
    `;

    this.logger.log(
      `[requestConsult] member=${params.requesterId}(${requesterNick}) → counselor=${params.counselorId}(${counselorDisplayName}) alimtalk=${alimtalkOk} push=${pushOk}`,
    );

    return { ok: true, notified: { alimtalk: alimtalkOk, push: pushOk } };
  }

  /**
   * 상담사 본인의 상담 가능 토글 — use_phone / use_chat / available 변경.
   *  - DB 갱신 + member.state 를 use_phone/use_chat 조합으로 자동 보정
   *  - m2net chat-mgr csrstat 으로 외부 상태 동기화 (실패해도 DB 는 반영됨)
   *
   * available=false 면 두 토글값과 무관하게 state='ABSE' 강제 (휴식 모드).
   * available 이 명시되지 않으면 use_phone/use_chat 기준으로 재계산.
   */
  async setMyAvailability(
    counselorId: number,
    input: { use_phone?: boolean; use_chat?: boolean; available?: boolean },
  ): Promise<{ use_phone: boolean; use_chat: boolean; available: boolean; state: string }> {
    const rows = await this.sql<{
      id: number;
      role: string;
      csrid: string | null;
      use_phone: boolean;
      use_chat: boolean;
      state: string;
    }[]>`
      SELECT id, role, csrid, use_phone, use_chat, state
        FROM member WHERE id = ${counselorId} LIMIT 1
    `;
    const c = rows[0];
    if (!c) throw new NotFoundException('회원을 찾을 수 없습니다.');
    if (c.role !== 'counselor') {
      throw new BadRequestException('상담사만 변경할 수 있습니다.');
    }

    const usePhone = input.use_phone ?? c.use_phone;
    const useChat = input.use_chat ?? c.use_chat;
    // available=false → ABSE (휴식). 미지정이면 활성으로 간주 (기존 토글 유지).
    const available = input.available ?? !(c.state === 'ABSE');

    const target = !available
      ? 'ABSE'
      : usePhone && useChat
        ? 'RDVC'
        : usePhone && !useChat
          ? 'IDLE'
          : !usePhone && useChat
            ? 'RDCH'
            : 'ABSE';

    await this.sql`
      UPDATE member
         SET use_phone = ${usePhone},
             use_chat = ${useChat},
             state = ${target},
             updated_at = now()
       WHERE id = ${counselorId}
    `;

    // m2net 외부 상태 동기화 — chat-mgr csrstat. 실패해도 DB 는 반영됨.
    if (c.csrid) {
      const csrid = String(c.csrid).padStart(5, '0');
      this.m2net.updateCounselorState(csrid, target).then((r) => {
        if (!r.ok) {
          this.logger.warn(`[setMyAvailability] csrstat 실패 csrid=${csrid} target=${target}: ${r.error ?? ''}`);
        }
      }).catch((e) => {
        this.logger.error(`[setMyAvailability] csrstat 예외 csrid=${csrid}: ${e instanceof Error ? e.message : String(e)}`);
      });
    }

    return { use_phone: usePhone, use_chat: useChat, available, state: target };
  }

  /** 본인 상담사 토글 현재값 조회 (마이페이지 prefill 용) */
  async getMyAvailability(counselorId: number): Promise<{
    use_phone: boolean;
    use_chat: boolean;
    available: boolean;
    state: string;
  }> {
    const rows = await this.sql<{
      role: string;
      use_phone: boolean;
      use_chat: boolean;
      state: string;
    }[]>`
      SELECT role, use_phone, use_chat, state FROM member WHERE id = ${counselorId} LIMIT 1
    `;
    const c = rows[0];
    if (!c) throw new NotFoundException('회원을 찾을 수 없습니다.');
    if (c.role !== 'counselor') {
      throw new BadRequestException('상담사만 조회할 수 있습니다.');
    }
    return {
      use_phone: !!c.use_phone,
      use_chat: !!c.use_chat,
      available: c.state !== 'ABSE',
      state: c.state,
    };
  }

  /**
   * 상담사 본인 소개(intro) 조회 — post_counselor.intro.
   * 상담사 row 가 없으면 빈 문자열 반환 (마이그레이션 누락된 레거시 회원 대응).
   */
  async getMyIntro(counselorId: number): Promise<{ intro: string }> {
    const meRows = await this.sql<{ role: string }[]>`
      SELECT role FROM member WHERE id = ${counselorId} LIMIT 1
    `;
    const me = meRows[0];
    if (!me) throw new NotFoundException('회원을 찾을 수 없습니다.');
    if (me.role !== 'counselor') {
      throw new BadRequestException('상담사만 조회할 수 있습니다.');
    }
    const rows = await this.sql<{ intro: string | null }[]>`
      SELECT intro FROM post_counselor WHERE member_id = ${counselorId} LIMIT 1
    `;
    return { intro: rows[0]?.intro ?? '' };
  }

  /** 상담사 본인 소개(intro) 수정 — post_counselor row 가 없으면 INSERT. */
  async setMyIntro(
    counselorId: number,
    intro: string,
  ): Promise<{ intro: string }> {
    const meRows = await this.sql<{ role: string }[]>`
      SELECT role FROM member WHERE id = ${counselorId} LIMIT 1
    `;
    const me = meRows[0];
    if (!me) throw new NotFoundException('회원을 찾을 수 없습니다.');
    if (me.role !== 'counselor') {
      throw new BadRequestException('상담사만 수정할 수 있습니다.');
    }
    const normalized = (intro ?? '').toString();
    // 200KB 초과는 거절 — 본문 인라인 이미지는 별도 URL 로 저장되므로 일반 텍스트/HTML 본문은 충분.
    if (Buffer.byteLength(normalized, 'utf8') > 200 * 1024) {
      throw new BadRequestException('본인 소개가 너무 깁니다 (200KB 이내).');
    }
    const existing = await this.sql<{ id: number }[]>`
      SELECT id FROM post_counselor WHERE member_id = ${counselorId} LIMIT 1
    `;
    if (existing.length > 0) {
      await this.sql`
        UPDATE post_counselor
           SET intro = ${normalized}, updated_at = now()
         WHERE member_id = ${counselorId}
      `;
    } else {
      // post_counselor 가 없는 레거시/신규 상담사 — title 은 NOT NULL 이라 닉네임으로 임시 채움.
      const nameRows = await this.sql<{ nickname: string }[]>`
        SELECT nickname FROM member WHERE id = ${counselorId} LIMIT 1
      `;
      const title = nameRows[0]?.nickname ?? '상담사 프로필';
      await this.sql`
        INSERT INTO post_counselor (member_id, title, intro, created_at, updated_at)
        VALUES (${counselorId}, ${title}, ${normalized}, now(), now())
      `;
    }
    return { intro: normalized };
  }

  async list(params: {
    tab?: CounselorTab;
    category?: string;
    limit?: number;
    /** 로그인된 회원 ID — is_liked 계산용. 비로그인이면 undefined → 항상 false */
    requesterId?: number;
    /** [이벤트 상담사] true 시 현재 활성 이벤트 (event_starts_at <= now < event_ends_at) 만 노출 */
    eventOnly?: boolean;
  }): Promise<PublicCounselor[]> {
    const tab = params.tab ?? 'all';
    const limit = Math.min(50, Math.max(1, params.limit ?? 13));

    // 보호 가드 — m2net 푸시 지연으로 stuck 된 CNCH/CONN 상담사를 리스트 조회 시점에 자동 복구.
    //   조건: state='CNCH' or 'CONN' 이지만 실제 진행 중 chat_room/consultation 이 없음.
    //   조치: use_phone/use_chat 조합으로 ready state(RDVC/IDLE/RDCH/ABSE)로 강제 복귀.
    //   m2net 측 동기화는 별도(다음 startChat 시도 또는 webhook 으로 정리). DB 만 즉시 정정.
    await this.sql`
      UPDATE member SET state = CASE
          WHEN use_phone AND use_chat THEN 'RDVC'
          WHEN use_phone AND NOT use_chat THEN 'IDLE'
          WHEN NOT use_phone AND use_chat THEN 'RDCH'
          ELSE 'ABSE'
        END,
        updated_at = now()
       WHERE role = 'counselor'
         AND state IN ('CNCH', 'CONN')
         AND NOT EXISTS (
           SELECT 1 FROM chat_room cr
            WHERE cr.counselor_id = member.id
              AND cr.status IN ('STAY', 'CNCH')
         )
         AND NOT EXISTS (
           SELECT 1 FROM consultation c
            WHERE c.counselor_id = member.id
              AND c.ended_at IS NULL
              AND c.created_at > now() - interval '2 hours'
         )
    `;

    // sample latest.lib.php 의 itab 분기를 신규 state set 으로 재현.
    // 신규 state: IDLE/ABSE/CONN/RESV/CRDY/RDCH/RDVC/CNCH
    //   - 활성(노출 대상): IDLE, RDCH, RDVC, CRDY, CONN, CNCH (= ABSE/RESV 제외)
    //   - 채팅 즉시 가능: IDLE, RDCH, CRDY  / 채팅 통화중: CNCH / 음성 대기: RDVC
    //   - sample 은 IDLE/RDVC/CONN 만 보지만 신규 state 가 더 세분화되어 있어 동일 의미로 확장
    //
    // 정렬 우선순위 — 2026-05-15 운영 정책 변경:
    //   "최근 5분 내 상담 시작한 상담중(CONN/CNCH)" 만 최상단(0).
    //   "활동 보여주기" 마케팅 효과 (이렇게 많이 상담중! 인기 앱이군!).
    //   그 외 전부 동등(1) → updated_at(최근접속) 순으로 자연스럽게 섞임.
    // 2026-05-22: 부재(ABSE/RESV) 도 리스트에 노출하되 정렬은 가장 뒤로.
    //   회원 입장에서 "지금 가능한 상담사" 가 위에, 부재 상담사는 아래.
    //   부재 카드에는 "상담요청하기" 버튼이 노출되어 회원이 호출 알림을 보낼 수 있다.
    const statePriority = this.sql`(CASE
      WHEN m.state IN ('CONN','CNCH') AND m.updated_at >= now() - interval '5 minutes' THEN 0
      WHEN m.state IN ('ABSE','RESV') THEN 2
      ELSE 1
    END)`;

    const orderBy = (() => {
      switch (tab) {
        case 'popular':
          // 인기 마킹(is_rising) 우선 + 최근 5분 상담중 + 최근접속순
          return this.sql`m.is_rising DESC, ${statePriority}, m.updated_at DESC NULLS LAST, m.id DESC`;
        case 'chat':
          // 채팅 가능 상담사 — 최근 5분 상담중 + 최근접속순
          return this.sql`${statePriority}, m.updated_at DESC NULLS LAST, m.id DESC`;
        case 'new':
          // 신규상담사 — 가입순(created_at DESC) 유지. 신규 본래 의미 보존.
          return this.sql`m.created_at DESC NULLS LAST, m.id DESC`;
        default: // all
          // 1) 어드민 상위노출(is_recommended) — 평소 비활성, 깜짝 노출용
          // 2) 최근 5분 상담중 (마케팅 포인트)
          // 3) 최근접속순 (updated_at DESC)
          return this.sql`m.is_recommended DESC, ${statePriority}, m.updated_at DESC NULLS LAST, m.id DESC`;
      }
    })();

    // tab 별 WHERE — sample latest.lib.php 의 itab 분기 (line 103~152) 매핑 + 신규 정책 보정
    const tabWhere = (() => {
      switch (tab) {
        case 'popular':
          // 부재(ABSE/RESV) 도 노출 — 회원이 "상담요청하기" 로 호출 가능 (2026-05-22).
          return this.sql`AND m.state IN ('IDLE','RDCH','RDVC','CRDY','CONN','CNCH','ABSE','RESV') AND (m.use_phone = true OR m.use_chat = true)`;
        case 'chat':
          // 채팅 가능 + 부재 모두 노출. 부재는 회원이 호출 알림 보낼 수 있게.
          return this.sql`AND m.use_chat = true AND m.state IN ('IDLE','RDCH','RDVC','CNCH','ABSE','RESV')`;
        case 'new':
          // 신규상담사 — 가입 후 90일 이내. ABSE/RESV 도 포함.
          return this.sql`AND m.state IN ('IDLE','RDCH','RDVC','CRDY','CONN','CNCH','ABSE','RESV') AND m.created_at >= now() - interval '90 days'`;
        default: // all
          // 2026-05-22 부재 노출 정책 — ABSE/RESV 포함. 부재는 statePriority 로 정렬에서 뒤로 빠짐.
          return this.sql`AND m.state IN ('IDLE','RDCH','RDVC','CRDY','CONN','CNCH','ABSE','RESV') AND (m.use_phone = true OR m.use_chat = true)`;
      }
    })();

    // 카테고리 필터 — [2026-06-02 fix] member.counselor_category 가 진실원.
    //   어드민에서 [타로/신점/사주/심리] 칩으로 정확히 분류한 결과 (member.counselor_category 컬럼).
    //   기존 specialty/hashtag ILIKE 매칭은 사장님 입력 미스로 누락 다수 발생 (월아신녀 신점 케이스).
    //   진실원: counselor_category 정확 매칭. fallback: 옛 데이터 호환 (counselor_category NULL).
    const cat = (params.category ?? '').trim();
    const categoryWhere =
      cat && cat !== '전체'
        ? this.sql`AND (
            m.counselor_category = ${cat}
            OR (m.counselor_category IS NULL AND (
              COALESCE(pc.specialty, '') ILIKE ${'%' + cat + '%'}
              OR COALESCE(pc.hashtag1, '') ILIKE ${'%' + cat + '%'}
              OR COALESCE(pc.hashtag2, '') ILIKE ${'%' + cat + '%'}
            ))
          )`
        : this.sql``;

    // 2026-05-22 정책 변경: 본인 카드도 리스트에 노출.
    //   상담사가 본인 카드가 다른 회원에게 어떻게 보이는지 확인할 수 있어야 한다는 운영 요청.
    //   "본인이 본인에게 상담 요청" 사고는 consult.service.ts:67/196 의 안전망이 차단함.
    const selfExclude = this.sql``;

    // [이벤트 상담사] 활성 기간 (event_starts_at <= now < event_ends_at) 인 상담사만 노출
    const eventWhere = params.eventOnly
      ? this.sql`AND pc.event_starts_at IS NOT NULL
                 AND pc.event_starts_at <= now()
                 AND (pc.event_ends_at IS NULL OR pc.event_ends_at > now())`
      : this.sql``;

    type Row = {
      id: number;
      mb_id: string | null;
      name: string;
      nickname: string;
      csrid: string | null;
      dtmfno: string | null;
      state: string;
      use_phone: boolean;
      use_chat: boolean;
      is_rising: boolean;
      is_recommended: boolean;
      title: string | null;
      headline: string | null;
      specialty: string | null;
      hashtag1: string | null;
      hashtag2: string | null;
      unit_seconds: number | null;
      unit_cost: number | null;
      review_count: number | null;
      fan_count: number | null;
      profile_stored_name: string | null;
      profile_stored_name_webp: string | null;
      rating_avg: number | null;
      is_new: boolean;
    };

    // 단가/단위시간 source of truth: member.call_070_unit_cost / chat_unit_cost / call_unit_seconds / chat_unit_seconds
    // (관리자 폼·M2net 동기화·정산 로직이 모두 member.* 사용. post_counselor.unit_cost 는 g5_write_5 레거시 — 안 쓰임)
    // 카드의 "30초당 X,XXX원" 표시용으로 통화 단가 우선, 채팅 단가 fallback.
    const rows = await this.sql<Row[]>`
      SELECT m.id, m.mb_id, m.name, m.nickname, m.csrid, m.dtmfno, m.state,
             m.use_phone, m.use_chat, m.is_rising, m.is_recommended,
             pc.title, pc.headline, pc.specialty, pc.hashtag1, pc.hashtag2,
             COALESCE(m.call_unit_seconds, m.chat_unit_seconds, pc.unit_seconds) AS unit_seconds,
             COALESCE(NULLIF(m.call_070_unit_cost, 0), NULLIF(m.chat_unit_cost, 0), pc.unit_cost) AS unit_cost,
             pc.review_count, pc.fan_count,
             (SELECT mf.stored_name FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name_webp,
             COALESCE((SELECT AVG(r.rating)::float FROM post_review r
                       WHERE r.counselor_id = m.id AND r.rating IS NOT NULL), 0) AS rating_avg,
             (m.created_at >= now() - interval '90 days') AS is_new
        FROM member m
        LEFT JOIN post_counselor pc ON pc.member_id = m.id
       WHERE m.role = 'counselor'
         AND m.left_at IS NULL
         ${tabWhere}
         ${categoryWhere}
         ${selfExclude}
         ${eventWhere}
       ORDER BY ${orderBy}
       LIMIT ${limit}
    `;

    // 로그인 회원의 단골 등록 ID 셋 — is_liked 계산용.
    // postgres.js 가 BIGINT 를 string 으로 줄 수 있어 비교는 항상 Number 로 정규화.
    let likedIds = new Set<number>();
    let requestedIds = new Set<number>();
    if (params.requesterId != null && rows.length > 0) {
      const ids = rows.map((r) => Number(r.id));
      const likedRows = await this.sql<{ counselor_id: number | string }[]>`
        SELECT counselor_id FROM member_favorite_counselor
         WHERE member_id = ${params.requesterId}
           AND counselor_id = ANY(${ids}::bigint[])
      `;
      likedIds = new Set(likedRows.map((r) => Number(r.counselor_id)));

      // 2026-05-22: 24시간 내 "상담요청하기" 신청 여부 — 검색 결과 카드의 버튼 UI 분기.
      const reqRows = await this.sql<{ counselor_id: number | string }[]>`
        SELECT counselor_id FROM counselor_request_alert
         WHERE member_id = ${params.requesterId}
           AND counselor_id = ANY(${ids}::bigint[])
           AND requested_at > now() - interval '24 hours'
      `;
      requestedIds = new Set(reqRows.map((r) => Number(r.counselor_id)));
    }

    return rows.map((r) => ({
      id: Number(r.id),
      mb_id: r.mb_id,
      name: r.name,
      nickname: r.nickname,
      csrid: r.csrid,
      dtmfno: r.dtmfno,
      state: r.state,
      use_phone: r.use_phone,
      use_chat: r.use_chat,
      is_rising: r.is_rising,
      is_recommended: r.is_recommended,
      title: r.title,
      headline: r.headline,
      specialty: r.specialty,
      hashtag1: r.hashtag1,
      hashtag2: r.hashtag2,
      unit_seconds: r.unit_seconds,
      unit_cost: r.unit_cost,
      review_count: r.review_count ?? 0,
      fan_count: r.fan_count ?? 0,
      // member_file 은 stored_name 만 저장 → 사용자 페이지가 그대로 쓸 수 있도록 풀 경로로 변환
      profile_image: r.profile_stored_name ? `/uploads/member/${r.profile_stored_name}` : null,
      profile_image_webp: r.profile_stored_name_webp ? `/uploads/member/${r.profile_stored_name_webp}` : null,
      category: this.inferCategory(r.specialty, r.hashtag1, r.hashtag2),
      is_liked: likedIds.has(Number(r.id)),
      is_requested: requestedIds.has(Number(r.id)),
      is_new: !!r.is_new,
      rating_avg: Number(r.rating_avg ?? 0),
    }));
  }

  private inferCategory(
    ...vals: (string | null)[]
  ): '사주' | '타로' | '신점' | '기타' {
    const text = vals.filter(Boolean).join(' ');
    if (text.includes('타로')) return '타로';
    if (text.includes('신점')) return '신점';
    if (text.includes('사주')) return '사주';
    return '기타';
  }

  /**
   * 상담사 리스트 필터용 옵션 조회 — DB 의 실제 hashtag 값들에서 distinct.
   *  - 활성 상담사의 post_counselor.hashtag1/2 합집합 (중복/공백 제거)
   *  - 빈도 내림차순 정렬, 최대 30개
   */
  async getFilterOptions(): Promise<{ fields: string[] }> {
    const rows = await this.sql<{ tag: string; cnt: number }[]>`
      SELECT tag, COUNT(*)::int AS cnt FROM (
        SELECT pc.hashtag1 AS tag
          FROM post_counselor pc
          INNER JOIN member m ON m.id = pc.member_id
         WHERE m.role = 'counselor' AND m.left_at IS NULL
           AND pc.hashtag1 IS NOT NULL AND pc.hashtag1 <> ''
        UNION ALL
        SELECT pc.hashtag2 AS tag
          FROM post_counselor pc
          INNER JOIN member m ON m.id = pc.member_id
         WHERE m.role = 'counselor' AND m.left_at IS NULL
           AND pc.hashtag2 IS NOT NULL AND pc.hashtag2 <> ''
      ) t
      GROUP BY tag
      ORDER BY cnt DESC, tag ASC
      LIMIT 30
    `;
    return {
      fields: rows.map((r) => r.tag.replace(/^#/, '').trim()).filter(Boolean),
    };
  }

  /**
   * 인기 검색어.
   *
   * 정책:
   *  - 우선 실제 검색 로그(search_log, 최근 7일, result_count > 0) 의 빈도 상위
   *    keyword 를 cap 까지 가져온다.
   *  - cap 보다 적게 나오면, 부족한 자리만큼 활성 상담사의 hashtag 빈도로 채운다.
   *    (이미 등장한 keyword 는 중복 제외.)
   *
   * 이전 구현은 logRows.length < cap 일 때 통째로 hashtag fallback 으로 교체
   * 해서 실제 검색어가 한두 개 있어도 화면엔 hashtag 만 보였다 — 그래서 사용자가
   * 직접 검색한 단어가 인기검색어에 안 떠 보였음. 이제는 항상 실 검색이 우선.
   *
   * isNew 규칙:
   *  - 검색로그 출신: 최근 24h 안에 처음 로그된(MIN(created_at) > now-24h) 키워드.
   *  - hashtag fallback 출신: 해당 hashtag 의 가장 최근 가입 상담사가 30일 이내.
   */
  async popularKeywords(
    limit = 6,
  ): Promise<{ rank: number; keyword: string; isNew: boolean }[]> {
    const cap = Math.min(20, Math.max(1, limit));
    const now = Date.now();
    const LOG_NEW_MS = 24 * 60 * 60 * 1000;
    const TAG_NEW_MS = 30 * 24 * 60 * 60 * 1000;

    // 1) 실제 검색 로그 — 최근 7일.
    //    sample(그누보드) 의 g5_popular 정책과 동일하게 result_count 와 무관하게
    //    검색 횟수 그대로 집계한다. 즉 "사랑" 처럼 결과 0건이어도 사용자가
    //    많이 입력했다면 인기검색어로 노출. 자모만/한 글자 같은 노이즈는
    //    logSearch() 단계의 필터로 이미 차단.
    const logRows = await this.sql<
      { keyword: string; cnt: number; first_seen: Date }[]
    >`
      SELECT keyword,
             COUNT(*)::int AS cnt,
             MIN(created_at) AS first_seen
        FROM search_log
       WHERE created_at > now() - interval '7 days'
         AND keyword <> ''
       GROUP BY keyword
       ORDER BY cnt DESC, keyword ASC
       LIMIT ${cap}
    `;

    const fromLog = logRows.map((r) => ({
      keyword: r.keyword,
      isNew:
        !!r.first_seen &&
        now - new Date(r.first_seen).getTime() < LOG_NEW_MS,
    }));

    // 충분히 채워졌으면 그대로 반환
    if (fromLog.length >= cap) {
      return fromLog.map((it, i) => ({ rank: i + 1, ...it }));
    }

    // 2) 부족분만큼 hashtag fallback 으로 보충
    const need = cap - fromLog.length;
    const seen = new Set(
      fromLog.map((it) =>
        it.keyword.toLowerCase().replace(/^#+/, '').trim(),
      ),
    );

    // 중복 가능성 대비 cap*2 정도 넉넉히 가져와서 필터링
    const tagRows = await this.sql<
      { tag: string; cnt: number; latest_joined: Date | null }[]
    >`
      SELECT tag, COUNT(*)::int AS cnt, MAX(joined) AS latest_joined FROM (
        SELECT pc.hashtag1 AS tag, m.created_at AS joined
          FROM post_counselor pc
          INNER JOIN member m ON m.id = pc.member_id
         WHERE m.role = 'counselor' AND m.left_at IS NULL
           AND pc.hashtag1 IS NOT NULL AND pc.hashtag1 <> ''
        UNION ALL
        SELECT pc.hashtag2 AS tag, m.created_at AS joined
          FROM post_counselor pc
          INNER JOIN member m ON m.id = pc.member_id
         WHERE m.role = 'counselor' AND m.left_at IS NULL
           AND pc.hashtag2 IS NOT NULL AND pc.hashtag2 <> ''
      ) t
      GROUP BY tag
      ORDER BY cnt DESC, tag ASC
      LIMIT ${cap * 2}
    `;

    const fromTag: { keyword: string; isNew: boolean }[] = [];
    for (const r of tagRows) {
      const key = r.tag.replace(/^#+/, '').trim();
      const norm = key.toLowerCase();
      if (!key || seen.has(norm)) continue;
      seen.add(norm);
      fromTag.push({
        keyword: key,
        isNew:
          !!r.latest_joined &&
          now - new Date(r.latest_joined).getTime() < TAG_NEW_MS,
      });
      if (fromTag.length >= need) break;
    }

    return [...fromLog, ...fromTag].map((it, i) => ({
      rank: i + 1,
      ...it,
    }));
  }

  /**
   * 검색 로그 적재 — fire-and-forget.
   * 검색 응답 지연을 막기 위해 INSERT 실패는 조용히 무시(catch).
   * 다음은 통계 노이즈라 스킵:
   *   - 빈 keyword / 200자 초과
   *   - 1글자
   *   - 한글 자모(ㄱ~ㅎ, ㅏ~ㅣ) 만으로 이루어진 미완성 입력
   *     (예: "ㅎ", "ㅅㅏ", "ㄱㅈ"). 한글 IME 가 조합 중에 발사되는 검색어는
   *     인기검색어 통계를 왜곡하므로 완성된 음절 또는 ASCII 문자가 하나라도
   *     있어야 통과시킨다.
   */
  async logSearch(
    rawQuery: string,
    memberId: number | undefined,
    resultCount: number,
    ip: string | undefined,
  ): Promise<void> {
    // 정규화: lowercase + trim + leading '#' 제거. UI 가 같은 의미를 다른 형태로
    // 보내도(#사주 / 사주 / 사주 ) 같은 row 로 카운트되게.
    const keyword = rawQuery.trim().toLowerCase().replace(/^#+/, '').trim();
    if (!keyword || keyword.length < 2 || keyword.length > 200) return;
    // 자모/공백/특수문자만 있으면 reject. 완성형 한글(가-힯) 이나
    // 영숫자가 최소 1자 있어야 의미있는 검색으로 간주.
    if (!/[가-힯a-z0-9]/i.test(keyword)) return;
    try {
      await this.sql`
        INSERT INTO search_log (keyword, member_id, search_ip, result_count)
        VALUES (
          ${keyword},
          ${memberId ?? null},
          ${ip && /^[0-9a-f.:]+$/i.test(ip) ? ip : null}::inet,
          ${resultCount}
        )
      `;
    } catch {
      // 통계 누락은 사용자 경험에 영향 X — 조용히 무시
    }
  }

  /**
   * 검색 — 상담사 이름·닉네임·해시태그·전문분야·헤드라인·소개·약력에서 부분 일치.
   * 정렬 우선순위 (relevance ASC):
   *   0: 이름 또는 닉네임 정확히 일치
   *   1: 해시태그 정확히 일치 (# prefix 유무 모두 매칭)
   *   2: 이름·닉네임 부분 일치
   *   3: 해시태그 부분 일치
   *   4: 전문분야·헤드라인 부분 일치
   *   5: 그 외 (intro / bio)
   * 동순위 안에선 review_count DESC, id DESC.
   *
   * 빈 q 는 빈 결과. left_at NULL + role='counselor' 만.
   */
  async search(params: {
    q: string;
    limit?: number;
    requesterId?: number;
  }): Promise<PublicCounselor[]> {
    const term = params.q.trim();
    if (!term) return [];
    const limit = Math.min(50, Math.max(1, params.limit ?? 30));
    const pat = `%${term}%`;
    // 해시태그 정확 일치는 # prefix 유무 양쪽 다 매칭 (DB엔 #포함/미포함 혼재)
    const tagWithHash = term.startsWith('#') ? term : `#${term}`;
    const tagNoHash = term.replace(/^#/, '');

    // 2026-05-22 정책 변경: 본인 카드도 검색 결과에 노출. (위 list 와 동일 사유)
    const selfExclude = this.sql``;

    type Row = {
      id: number;
      mb_id: string | null;
      name: string;
      nickname: string;
      csrid: string | null;
      dtmfno: string | null;
      state: string;
      use_phone: boolean;
      use_chat: boolean;
      is_rising: boolean;
      is_recommended: boolean;
      title: string | null;
      headline: string | null;
      specialty: string | null;
      hashtag1: string | null;
      hashtag2: string | null;
      unit_seconds: number | null;
      unit_cost: number | null;
      review_count: number | null;
      fan_count: number | null;
      profile_stored_name: string | null;
      profile_stored_name_webp: string | null;
      rating_avg: number | null;
      is_new: boolean;
    };

    const rows = await this.sql<Row[]>`
      SELECT m.id, m.mb_id, m.name, m.nickname, m.csrid, m.dtmfno, m.state,
             m.use_phone, m.use_chat, m.is_rising, m.is_recommended,
             pc.title, pc.headline, pc.specialty, pc.hashtag1, pc.hashtag2,
             COALESCE(m.call_unit_seconds, m.chat_unit_seconds, pc.unit_seconds) AS unit_seconds,
             COALESCE(NULLIF(m.call_070_unit_cost, 0), NULLIF(m.chat_unit_cost, 0), pc.unit_cost) AS unit_cost,
             pc.review_count, pc.fan_count,
             (SELECT mf.stored_name FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name_webp,
             COALESCE((SELECT AVG(r.rating)::float FROM post_review r
                       WHERE r.counselor_id = m.id AND r.rating IS NOT NULL), 0) AS rating_avg,
             (m.created_at >= now() - interval '90 days') AS is_new,
             (CASE
                WHEN m.name ILIKE ${term} OR m.nickname ILIKE ${term} THEN 0
                WHEN COALESCE(pc.hashtag1,'') ILIKE ${tagWithHash}
                  OR COALESCE(pc.hashtag2,'') ILIKE ${tagWithHash}
                  OR COALESCE(pc.hashtag1,'') ILIKE ${tagNoHash}
                  OR COALESCE(pc.hashtag2,'') ILIKE ${tagNoHash} THEN 1
                WHEN m.name ILIKE ${pat} OR m.nickname ILIKE ${pat} THEN 2
                WHEN COALESCE(pc.hashtag1,'') ILIKE ${pat}
                  OR COALESCE(pc.hashtag2,'') ILIKE ${pat} THEN 3
                WHEN COALESCE(pc.specialty,'') ILIKE ${pat}
                  OR COALESCE(pc.headline,'') ILIKE ${pat} THEN 4
                ELSE 5
              END) AS relevance
        FROM member m
        LEFT JOIN post_counselor pc ON pc.member_id = m.id
       WHERE m.role = 'counselor'
         AND m.left_at IS NULL
         ${selfExclude}
         AND (
              m.name ILIKE ${pat}
           OR m.nickname ILIKE ${pat}
           OR COALESCE(pc.headline,'') ILIKE ${pat}
           OR COALESCE(pc.specialty,'') ILIKE ${pat}
           OR COALESCE(pc.hashtag1,'') ILIKE ${pat}
           OR COALESCE(pc.hashtag2,'') ILIKE ${pat}
           OR COALESCE(pc.intro,'') ILIKE ${pat}
           OR COALESCE(pc.bio,'') ILIKE ${pat}
         )
       ORDER BY relevance ASC,
                pc.review_count DESC NULLS LAST,
                m.id DESC
       LIMIT ${limit}
    `;

    let likedIds = new Set<number>();
    let requestedIds = new Set<number>();
    if (params.requesterId != null && rows.length > 0) {
      const ids = rows.map((r) => Number(r.id));
      const likedRows = await this.sql<{ counselor_id: number | string }[]>`
        SELECT counselor_id FROM member_favorite_counselor
         WHERE member_id = ${params.requesterId}
           AND counselor_id = ANY(${ids}::bigint[])
      `;
      likedIds = new Set(likedRows.map((r) => Number(r.counselor_id)));

      const reqRows = await this.sql<{ counselor_id: number | string }[]>`
        SELECT counselor_id FROM counselor_request_alert
         WHERE member_id = ${params.requesterId}
           AND counselor_id = ANY(${ids}::bigint[])
           AND requested_at > now() - interval '24 hours'
      `;
      requestedIds = new Set(reqRows.map((r) => Number(r.counselor_id)));
    }

    return rows.map((r) => ({
      id: Number(r.id),
      mb_id: r.mb_id,
      name: r.name,
      nickname: r.nickname,
      csrid: r.csrid,
      dtmfno: r.dtmfno,
      state: r.state,
      use_phone: r.use_phone,
      use_chat: r.use_chat,
      is_rising: r.is_rising,
      is_recommended: r.is_recommended,
      title: r.title,
      headline: r.headline,
      specialty: r.specialty,
      hashtag1: r.hashtag1,
      hashtag2: r.hashtag2,
      unit_seconds: r.unit_seconds,
      unit_cost: r.unit_cost,
      review_count: r.review_count ?? 0,
      fan_count: r.fan_count ?? 0,
      profile_image: r.profile_stored_name
        ? `/uploads/member/${r.profile_stored_name}`
        : null,
      profile_image_webp: r.profile_stored_name_webp
        ? `/uploads/member/${r.profile_stored_name_webp}`
        : null,
      category: this.inferCategory(r.specialty, r.hashtag1, r.hashtag2),
      is_liked: likedIds.has(Number(r.id)),
      is_requested: requestedIds.has(Number(r.id)),
      rating_avg: Number(r.rating_avg ?? 0),
      is_new: !!r.is_new,
    }));
  }

  /**
   * 회원의 단골 상담사 목록.
   *  - 좋아요(member_favorite_counselor)에 등록된 상담사 중 활성(role='counselor', left_at IS NULL) 만.
   *  - 정렬: 단골 등록 최신순 (created_at DESC).
   *  - 카테고리 필터(전체/사주/타로/신점) 옵션 적용.
   */
  async listFavorites(params: {
    memberId: number;
    category?: string;
    limit?: number;
  }): Promise<PublicCounselor[]> {
    const limit = Math.min(100, Math.max(1, params.limit ?? 50));

    const cat = (params.category ?? '').trim();
    const categoryWhere =
      cat && cat !== '전체'
        ? this.sql`AND (
            COALESCE(pc.specialty, '') ILIKE ${'%' + cat + '%'}
            OR COALESCE(pc.hashtag1, '') ILIKE ${'%' + cat + '%'}
            OR COALESCE(pc.hashtag2, '') ILIKE ${'%' + cat + '%'}
          )`
        : this.sql``;

    type Row = {
      id: number;
      mb_id: string | null;
      name: string;
      nickname: string;
      csrid: string | null;
      dtmfno: string | null;
      state: string;
      use_phone: boolean;
      use_chat: boolean;
      is_rising: boolean;
      is_recommended: boolean;
      title: string | null;
      headline: string | null;
      specialty: string | null;
      hashtag1: string | null;
      hashtag2: string | null;
      unit_seconds: number | null;
      unit_cost: number | null;
      review_count: number | null;
      fan_count: number | null;
      profile_stored_name: string | null;
      profile_stored_name_webp: string | null;
      rating_avg: number | null;
      is_new: boolean;
    };

    const rows = await this.sql<Row[]>`
      SELECT m.id, m.mb_id, m.name, m.nickname, m.csrid, m.dtmfno, m.state,
             m.use_phone, m.use_chat, m.is_rising, m.is_recommended,
             pc.title, pc.headline, pc.specialty, pc.hashtag1, pc.hashtag2,
             COALESCE(m.call_unit_seconds, m.chat_unit_seconds, pc.unit_seconds) AS unit_seconds,
             COALESCE(NULLIF(m.call_070_unit_cost, 0), NULLIF(m.chat_unit_cost, 0), pc.unit_cost) AS unit_cost,
             pc.review_count, pc.fan_count,
             (SELECT mf.stored_name FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name_webp,
             COALESCE((SELECT AVG(r.rating)::float FROM post_review r
                       WHERE r.counselor_id = m.id AND r.rating IS NOT NULL), 0) AS rating_avg,
             (m.created_at >= now() - interval '90 days') AS is_new
        FROM member_favorite_counselor mfc
        INNER JOIN member m ON m.id = mfc.counselor_id
        LEFT JOIN post_counselor pc ON pc.member_id = m.id
       WHERE mfc.member_id = ${params.memberId}
         AND m.role = 'counselor'
         AND m.left_at IS NULL
         ${categoryWhere}
       ORDER BY mfc.created_at DESC
       LIMIT ${limit}
    `;

    return rows.map((r) => ({
      id: Number(r.id),
      mb_id: r.mb_id,
      name: r.name,
      nickname: r.nickname,
      csrid: r.csrid,
      dtmfno: r.dtmfno,
      state: r.state,
      use_phone: r.use_phone,
      use_chat: r.use_chat,
      is_rising: r.is_rising,
      is_recommended: r.is_recommended,
      title: r.title,
      headline: r.headline,
      specialty: r.specialty,
      hashtag1: r.hashtag1,
      hashtag2: r.hashtag2,
      unit_seconds: r.unit_seconds,
      unit_cost: r.unit_cost,
      review_count: r.review_count ?? 0,
      fan_count: r.fan_count ?? 0,
      profile_image: r.profile_stored_name ? `/uploads/member/${r.profile_stored_name}` : null,
      profile_image_webp: r.profile_stored_name_webp ? `/uploads/member/${r.profile_stored_name_webp}` : null,
      category: this.inferCategory(r.specialty, r.hashtag1, r.hashtag2),
      is_liked: true,
      is_requested: false,
      rating_avg: Number(r.rating_avg ?? 0),
      is_new: !!r.is_new,
    }));
  }

  /**
   * 단골 상담사 중 "접속중" (state != 'ABSE') 인 사람만 경량 조회.
   * 홈 진입 시 인앱 배너용 — 단골이 지금 상담 가능한지 안내.
   *
   *  - 비로그인은 호출되지 않음 (UserAuthGuard 부착).
   *  - 단골 등록 0건이면 빈 배열 + totalFavorites=0 → 프론트에서 "단골 등록 유도" 배너.
   *  - 단골은 있는데 접속중 0명이면 빈 배열 + totalFavorites>0 → 배너 미노출.
   *  - 접속중 단골 있으면 최대 5명 + totalFavorites → "단골 N명 접속중" 배너.
   */
  async listFavoritesOnline(memberId: number): Promise<{
    online: Array<{
      id: number;
      name: string;
      nickname: string;
      code: string | null;
      profile_image: string | null;
    }>;
    totalFavorites: number;
  }> {
    // 총 단골 수 (단골 등록 유도 분기용)
    const totalRow = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
        FROM member_favorite_counselor
       WHERE member_id = ${memberId}
    `;
    const totalFavorites = Number(totalRow[0]?.count ?? '0');
    if (totalFavorites === 0) {
      return { online: [], totalFavorites: 0 };
    }

    type Row = {
      id: number;
      name: string;
      nickname: string;
      dtmfno: string | null;
      profile_stored_name: string | null;
    };
    const rows = await this.sql<Row[]>`
      SELECT m.id, m.name, m.nickname, m.dtmfno,
             (SELECT mf.stored_name FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name
        FROM member_favorite_counselor mfc
        INNER JOIN member m ON m.id = mfc.counselor_id
       WHERE mfc.member_id = ${memberId}
         AND m.role = 'counselor'
         AND m.left_at IS NULL
         AND (m.state IS NULL OR m.state <> 'ABSE')
       ORDER BY mfc.created_at DESC
       LIMIT 5
    `;
    return {
      online: rows.map((r) => ({
        id: Number(r.id),
        name: r.name,
        nickname: r.nickname,
        code: r.dtmfno,
        profile_image: r.profile_stored_name ? `/uploads/member/${r.profile_stored_name}` : null,
      })),
      totalFavorites,
    };
  }

  /** 상담사 단건 — 상세 페이지용. NotFoundException 시 404. */
  async getDetail(id: number, requesterId?: number): Promise<PublicCounselorDetail> {
    type Row = {
      id: number;
      mb_id: string | null;
      name: string;
      nickname: string;
      csrid: string | null;
      dtmfno: string | null;
      state: string;
      use_phone: boolean;
      use_chat: boolean;
      is_rising: boolean;
      is_recommended: boolean;
      headline: string | null;
      specialty: string | null;
      hashtag1: string | null;
      hashtag2: string | null;
      bio: string | null;
      content: string | null;
      intro: string | null;
      traits: string[] | null;
      unit_seconds: number | null;
      unit_cost: number | null;
      review_count: number | null;
      fan_count: number | null;
      pc_updated_at: Date | null;
      wide_headline: string | null;
      wide_subcaption: string | null;
      profile_stored_name: string | null;
      profile_stored_name_webp: string | null;
      hero_stored_name: string | null;
      hero_stored_name_webp: string | null;
    };

    const rows = await this.sql<Row[]>`
      SELECT m.id, m.mb_id, m.name, m.nickname, m.csrid, m.dtmfno, m.state,
             m.use_phone, m.use_chat, m.is_rising, m.is_recommended,
             pc.headline, pc.specialty, pc.hashtag1, pc.hashtag2,
             pc.bio, pc.content, pc.intro, pc.traits,
             COALESCE(m.call_unit_seconds, m.chat_unit_seconds, pc.unit_seconds) AS unit_seconds,
             COALESCE(NULLIF(m.call_070_unit_cost, 0), NULLIF(m.chat_unit_cost, 0), pc.unit_cost) AS unit_cost,
             pc.review_count, pc.fan_count,
             pc.updated_at AS pc_updated_at,
             pc.wide_headline, pc.wide_subcaption,
             (SELECT mf.stored_name      FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name_webp,
             (SELECT mf.stored_name      FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'wide'
               ORDER BY mf.id DESC LIMIT 1) AS hero_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'wide'
               ORDER BY mf.id DESC LIMIT 1) AS hero_stored_name_webp
        FROM member m
        LEFT JOIN post_counselor pc ON pc.member_id = m.id
       WHERE m.id = ${id}
         AND m.role = 'counselor'
         AND m.left_at IS NULL
       LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException('상담사를 찾을 수 없습니다.');
    }
    const r = rows[0];

    // 상담사 문의 총 건수
    const qnaCountRows = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM counselor_qna WHERE counselor_id = ${id}
    `;
    const qnaCount = Number(qnaCountRows[0]?.count ?? 0);

    // 단골 등록 여부 (로그인된 회원만)
    let isLiked = false;
    if (requesterId != null) {
      const likedRows = await this.sql<{ id: number }[]>`
        SELECT id FROM member_favorite_counselor
         WHERE member_id = ${requesterId} AND counselor_id = ${id}
         LIMIT 1
      `;
      isLiked = likedRows.length > 0;
    }

    // fan_count 실시간 조회 — post_counselor.fan_count 캐시 대신 정확한 값
    const fanCountRows = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM member_favorite_counselor WHERE counselor_id = ${id}
    `;
    const fanCount = Number(fanCountRows[0]?.count ?? 0);

    // specialty 가 '|' 또는 ',' 로 구분된 경우 배열로 분해. 단일 단어면 [단어].
    const fields = (r.specialty ?? '')
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    // bio 를 줄바꿈으로 분해 → career 리스트
    const career = (r.bio ?? '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    // hashtag1/2 정리 (#prefix 유지)
    const hashtags = [r.hashtag1, r.hashtag2]
      .filter((t): t is string => !!t && t.trim() !== '')
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    const profileImage = r.profile_stored_name
      ? `/uploads/member/${r.profile_stored_name}`
      : null;
    const profileImageWebp = r.profile_stored_name_webp
      ? `/uploads/member/${r.profile_stored_name_webp}`
      : null;
    const heroImage = r.hero_stored_name
      ? `/uploads/member/${r.hero_stored_name}`
      : profileImage;
    const heroImageWebp = r.hero_stored_name_webp
      ? `/uploads/member/${r.hero_stored_name_webp}`
      : profileImageWebp;

    return {
      id: Number(r.id),
      mb_id: r.mb_id,
      name: r.name,
      nickname: r.nickname,
      csrid: r.csrid,
      dtmfno: r.dtmfno,
      state: r.state,
      use_phone: r.use_phone,
      use_chat: r.use_chat,
      is_rising: r.is_rising,
      is_recommended: r.is_recommended,
      headline: r.headline,
      fields,
      traits: r.traits ?? [],
      bio: r.bio,
      career,
      notice_content: r.content,
      notice_date: (r.pc_updated_at ?? new Date()).toISOString(),
      intro: r.intro,
      hashtags,
      unit_seconds: r.unit_seconds,
      unit_cost: r.unit_cost,
      review_count: r.review_count ?? 0,
      fan_count: fanCount,
      profile_image: profileImage,
      profile_image_webp: profileImageWebp,
      hero_image: heroImage,
      hero_image_webp: heroImageWebp,
      wide_headline: r.wide_headline,
      wide_subcaption: r.wide_subcaption,
      live_viewers: pseudoLiveViewers(r.id, fanCount),
      qna_count: qnaCount,
      is_liked: isLiked,
      category: this.inferCategory(r.specialty, r.hashtag1, r.hashtag2),
    };
  }

  /** 단골 등록 (idempotent — 이미 있어도 OK). 새 fan_count 반환. */
  async addFavorite(memberId: number, counselorId: number): Promise<{ fan_count: number }> {
    if (memberId === counselorId) {
      throw new ForbiddenException('본인을 단골 등록할 수 없습니다.');
    }
    const cnt = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM member
       WHERE id = ${counselorId} AND role = 'counselor' AND left_at IS NULL
    `;
    if (Number(cnt[0]?.count ?? 0) === 0) {
      throw new NotFoundException('상담사를 찾을 수 없습니다.');
    }
    await this.sql`
      INSERT INTO member_favorite_counselor (member_id, counselor_id)
      VALUES (${memberId}, ${counselorId})
      ON CONFLICT (member_id, counselor_id) DO NOTHING
    `;
    const fan = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM member_favorite_counselor WHERE counselor_id = ${counselorId}
    `;
    return { fan_count: Number(fan[0]?.count ?? 0) };
  }

  /** 단골 해제 (idempotent). 새 fan_count 반환. */
  async removeFavorite(memberId: number, counselorId: number): Promise<{ fan_count: number }> {
    await this.sql`
      DELETE FROM member_favorite_counselor
       WHERE member_id = ${memberId} AND counselor_id = ${counselorId}
    `;
    const fan = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM member_favorite_counselor WHERE counselor_id = ${counselorId}
    `;
    return { fan_count: Number(fan[0]?.count ?? 0) };
  }

  /** 현재 활성 이벤트 상담사 목록 (최대 3명, event_starts_at 오름차순) */
  async listEvent(): Promise<PublicEventCounselor[]> {
    const rows = await this.sql<{
      id: string;
      nickname: string;
      headline: string | null;
      hashtag1: string | null;
      hashtag2: string | null;
      unit_seconds: number | null;
      unit_cost: number | null;
      state: string;
      use_phone: boolean;
      use_chat: boolean;
      event_starts_at: string;
      event_ends_at: string | null;
      event_banner_image_url: string | null;
      wide_headline: string | null;
      wide_subcaption: string | null;
      profile_stored_name: string | null;
      profile_stored_name_webp: string | null;
      hero_stored_name: string | null;
      hero_stored_name_webp: string | null;
    }[]>`
      SELECT m.id::text, m.nickname, m.state, m.use_phone, m.use_chat,
             pc.headline, pc.hashtag1, pc.hashtag2,
             COALESCE(m.call_unit_seconds, m.chat_unit_seconds, pc.unit_seconds) AS unit_seconds,
             COALESCE(NULLIF(m.call_070_unit_cost, 0), NULLIF(m.chat_unit_cost, 0), pc.unit_cost) AS unit_cost,
             pc.event_starts_at, pc.event_ends_at, pc.event_banner_image_url,
             pc.wide_headline, pc.wide_subcaption,
             (SELECT mf.stored_name FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name_webp,
             (SELECT mf.stored_name FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'wide'
               ORDER BY mf.id DESC LIMIT 1) AS hero_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'wide'
               ORDER BY mf.id DESC LIMIT 1) AS hero_stored_name_webp
        FROM member m
        JOIN post_counselor pc ON pc.member_id = m.id
       WHERE m.role = 'counselor'
         AND m.left_at IS NULL
         AND pc.event_starts_at IS NOT NULL
         AND pc.event_starts_at <= now()
         AND (pc.event_ends_at IS NULL OR pc.event_ends_at > now())
       ORDER BY pc.event_starts_at ASC
       LIMIT 3
    `;

    return rows.map((r) => ({
      id: Number(r.id),
      nickname: r.nickname,
      headline: r.headline,
      hashtag1: r.hashtag1,
      hashtag2: r.hashtag2,
      unit_seconds: r.unit_seconds,
      unit_cost: r.unit_cost,
      state: r.state,
      use_phone: r.use_phone,
      use_chat: r.use_chat,
      event_starts_at: r.event_starts_at,
      event_ends_at: r.event_ends_at,
      event_banner_image_url: r.event_banner_image_url,
      profile_image: r.profile_stored_name ? `/uploads/member/${r.profile_stored_name}` : null,
      profile_image_webp: r.profile_stored_name_webp ? `/uploads/member/${r.profile_stored_name_webp}` : null,
      hero_image: r.hero_stored_name ? `/uploads/member/${r.hero_stored_name}` : null,
      hero_image_webp: r.hero_stored_name_webp ? `/uploads/member/${r.hero_stored_name_webp}` : null,
      wide_headline: r.wide_headline,
      wide_subcaption: r.wide_subcaption,
    }));
  }
}

/**
 * "현재 N명이 같은 페이지를 보고 있습니다" 의사값 생성.
 *
 *  - 신 시스템엔 g5_login 같은 실시간 presence 테이블이 없어 진짜 카운트 불가.
 *  - 상담사 ID + 5분 단위 시간버킷으로 해시 → 같은 상담사를 같은 5분 내에 보면 같은 숫자, 5분 지나면 살짝 변동.
 *  - 인기도(fan_count) 가 높을수록 base 가 살짝 더 큼.
 *  - 결과 범위: 약 3 ~ 35명 (인기 상담사면 더 위쪽).
 *
 *  레거시 saju.live_num(보정값)은 사용하지 않음 — 너무 큰 숫자가 노출되는 문제.
 */
function pseudoLiveViewers(counselorId: number, fanCount: number): number {
  // 5분 단위 시간 버킷 — 5분마다 변동
  const bucket = Math.floor(Date.now() / (1000 * 60 * 5));
  // FNV-1a 비슷한 해시 (>>> 0 으로 unsigned)
  let h = 2166136261;
  h = Math.imul(h ^ counselorId, 16777619) >>> 0;
  h = Math.imul(h ^ bucket, 16777619) >>> 0;
  // base 0~24
  const base = h % 25;
  // 인기 보정 (팬 수 100명당 +1, 최대 +10)
  const popularity = Math.min(10, Math.floor(fanCount / 100));
  // 최저 3명 보장
  return 3 + base + popularity;
}

export interface PublicEventCounselor {
  id: number;
  nickname: string;
  headline: string | null;
  hashtag1: string | null;
  hashtag2: string | null;
  unit_seconds: number | null;
  unit_cost: number | null;
  state: string;
  use_phone: boolean;
  use_chat: boolean;
  event_starts_at: string;
  event_ends_at: string | null;
  event_banner_image_url: string | null;
  profile_image: string | null;
  profile_image_webp: string | null;
  /** 와이드 이미지 — 이벤트 배너 자동 카드에 우선 사용. 없으면 profile_image */
  hero_image: string | null;
  hero_image_webp: string | null;
  wide_headline: string | null;
  wide_subcaption: string | null;
}
