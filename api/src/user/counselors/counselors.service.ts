import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { M2netService } from '../../shared/m2net/m2net.service';

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
  /** 후기 평균 별점 (1~5, 후기 없으면 0) */
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
  ) {}

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
    // 정렬 우선순위: state CASE → 인기/추천 보조 정렬
    //   IDLE(대기) = 0 / 채팅 또는 통화 가능 (RDCH/RDVC/CRDY) = 1 / 통화/채팅중 (CONN/CNCH) = 2 / 그 외 = 3
    const statePriority = this.sql`(CASE
      WHEN m.state = 'IDLE' THEN 0
      WHEN m.state IN ('RDCH','RDVC','CRDY') THEN 1
      WHEN m.state IN ('CONN','CNCH') THEN 2
      ELSE 3
    END)`;

    const orderBy = (() => {
      switch (tab) {
        case 'popular':
          // 인기 = 관리자가 마킹한 is_rising 가장 위, 그 외는 review_count + fan_count 순.
          // (sample 은 mb_rising 1~20 만 노출이지만 신규에선 마킹 부족 시에도 자동 채움)
          return this.sql`m.is_rising DESC, ${statePriority}, pc.review_count DESC NULLS LAST, pc.fan_count DESC NULLS LAST, m.id DESC`;
        case 'chat':
          // sample 기본 orderBy: state CASE → mb_nick
          return this.sql`${statePriority}, pc.review_count DESC NULLS LAST, m.nickname ASC, m.id DESC`;
        case 'new':
          // 신규상담사 — 최근 가입 순. created_at NULL 인 레거시는 id DESC 로 fallback.
          return this.sql`m.created_at DESC NULLS LAST, m.id DESC`;
        default: // all
          // sample: state CASE → mb_nick. 추천 상담사 가장 위로.
          return this.sql`m.is_recommended DESC, ${statePriority}, pc.review_count DESC NULLS LAST, m.id DESC`;
      }
    })();

    // tab 별 WHERE — sample latest.lib.php 의 itab 분기 (line 103~152) 매핑 + 신규 정책 보정
    const tabWhere = (() => {
      switch (tab) {
        case 'popular':
          // 활성 상태(ABSE 제외) + 채널 1개 이상 ON.
          // sample 은 is_rising 필수였지만 현재 마킹 1명뿐이라 사실상 빈 탭이 됨.
          // → 정렬에서 is_rising 가장 위로 끌어올리고, 나머지는 후기/단골 많은 순.
          return this.sql`AND m.state IN ('IDLE','RDCH','RDVC','CRDY','CONN','CNCH') AND (m.use_phone = true OR m.use_chat = true)`;
        case 'chat':
          // 채팅 가능/채팅 상담중 만 노출 — 전화 통화중(CONN) 은 채팅 즉시 응대 불가라 제외.
          // sample 은 CONN 도 포함시키지만 카드 채팅 버튼이 오프라인으로 노출되어
          // "채팅 안 되는데 왜 노출?" 문제 발생. 신규 정책: 버튼이 활성/상담중 인 케이스만.
          return this.sql`AND m.use_chat = true AND m.state IN ('IDLE','RDCH','RDVC','CNCH')`;
        case 'new':
          // 신규상담사 — 활성/대기/통화중 모두 노출 (ABSE/RESV 만 제외).
          // 채널 ON 여부 무관 (가입 직후 채널 미설정 상태도 카드에 노출되어야 함).
          return this.sql`AND m.state IN ('IDLE','RDCH','RDVC','CRDY','CONN','CNCH','ABSE')`;
        default: // all
          // sample line 151: state IN active AND NOT (use_phone='N' AND use_chat='N')
          return this.sql`AND m.state IN ('IDLE','RDCH','RDVC','CRDY','CONN','CNCH') AND (m.use_phone = true OR m.use_chat = true)`;
      }
    })();

    // 카테고리 필터 — specialty / hashtag1 / hashtag2 중 하나에 카테고리 키워드 포함
    const cat = (params.category ?? '').trim();
    const categoryWhere =
      cat && cat !== '전체'
        ? this.sql`AND (
            COALESCE(pc.specialty, '') ILIKE ${'%' + cat + '%'}
            OR COALESCE(pc.hashtag1, '') ILIKE ${'%' + cat + '%'}
            OR COALESCE(pc.hashtag2, '') ILIKE ${'%' + cat + '%'}
          )`
        : this.sql``;

    // 본인이 상담사로 로그인한 경우 자기 자신은 리스트에서 제외.
    // (비로그인/회원 로그인은 그대로 전체 노출)
    const selfExclude =
      params.requesterId != null
        ? this.sql`AND m.id <> ${params.requesterId}`
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
                       WHERE r.counselor_id = m.id AND r.rating IS NOT NULL), 0) AS rating_avg
        FROM member m
        LEFT JOIN post_counselor pc ON pc.member_id = m.id
       WHERE m.role = 'counselor'
         AND m.left_at IS NULL
         ${tabWhere}
         ${categoryWhere}
         ${selfExclude}
       ORDER BY ${orderBy}
       LIMIT ${limit}
    `;

    // 로그인 회원의 단골 등록 ID 셋 — is_liked 계산용.
    // postgres.js 가 BIGINT 를 string 으로 줄 수 있어 비교는 항상 Number 로 정규화.
    let likedIds = new Set<number>();
    if (params.requesterId != null && rows.length > 0) {
      const ids = rows.map((r) => Number(r.id));
      const likedRows = await this.sql<{ counselor_id: number | string }[]>`
        SELECT counselor_id FROM member_favorite_counselor
         WHERE member_id = ${params.requesterId}
           AND counselor_id = ANY(${ids}::bigint[])
      `;
      likedIds = new Set(likedRows.map((r) => Number(r.counselor_id)));
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

    // 본인이 상담사로 로그인한 경우 자기 자신은 검색 결과에서 제외.
    const selfExclude =
      params.requesterId != null
        ? this.sql`AND m.id <> ${params.requesterId}`
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
    if (params.requesterId != null && rows.length > 0) {
      const ids = rows.map((r) => Number(r.id));
      const likedRows = await this.sql<{ counselor_id: number | string }[]>`
        SELECT counselor_id FROM member_favorite_counselor
         WHERE member_id = ${params.requesterId}
           AND counselor_id = ANY(${ids}::bigint[])
      `;
      likedIds = new Set(likedRows.map((r) => Number(r.counselor_id)));
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
      rating_avg: Number(r.rating_avg ?? 0),
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
                       WHERE r.counselor_id = m.id AND r.rating IS NOT NULL), 0) AS rating_avg
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
      rating_avg: Number(r.rating_avg ?? 0),
    }));
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
