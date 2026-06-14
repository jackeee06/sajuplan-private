import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SQL, type Sql } from '../../shared/db/db.module';
import { M2netService } from '../../shared/m2net/m2net.service';

// [Audit E-C3] 휴대폰 마스킹.
//   01012345678 / 010-1234-5678 모두 처리 → 010-****-5678 형식 반환.
function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

// [PII 보호] 슈퍼관리자 + show_phone 토글 ON 일 때만 평문 노출.
//   일반 관리자는 list/detail 모두 마스킹. 슈퍼관리자 본인도 기본 마스킹 (토글 OFF 시).
function applyPhoneMask<T extends { phone?: string | null; telno?: string | null }>(
  row: T,
  showPhone: boolean,
): T {
  if (showPhone) return row;
  const out: T = { ...row };
  if ('phone' in out) out.phone = maskPhone(out.phone);
  if ('telno' in out) out.telno = maskPhone(out.telno);
  return out;
}

// [role/level 이중 진실원천] role 기반 level 매핑 — 향후 role 변경 API 추가 시 강제 동기화용.
//   현재 prod 매핑: admin=10, counselor=5, user=2 (전수 일관 검증됨, 2026-05-15)
//   정산 cron 이 level=5 기준이라 어긋나면 정산 누락. 반드시 이 매핑 사용.
//   health-check C-18 이 자동 감지 + Critical OpsAlert.
export function roleToLevel(role: string): number {
  switch (role) {
    case 'admin': return 10;
    case 'counselor': return 5;
    case 'user': return 2;
    default: throw new Error(`unknown role: ${role}`);
  }
}

export interface MemberRow {
  id: number;
  mb_id: string | null;
  name: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  role: string;
  level: number;
  point: number;
  state: string;
  created_at: Date;
  last_login_at: Date | null;
}

// ─────────────────────────────────────────────
// 고객 / 상담사 리스트 (확장 행)
// ─────────────────────────────────────────────
export interface CustomerRow {
  id: number;
  mb_id: string | null;
  name: string;
  nickname: string;
  phone: string | null;
  gender: string | null;
  birth_date: Date | null;
  level: number;
  point: number;
  acquisition_source: string | null;
  social_provider: string | null;
  last_login_at: Date | null;
  created_at: Date;
  left_at: Date | null;
  intercept_until: Date | null;
  // 집계
  pay_count: string;
  pay_total: string;
  consult_070: string;
  consult_060: string;
  consult_chat: string;
}

export interface CounselorRow {
  id: number;
  mb_id: string | null;
  name: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  gender: 'M' | 'F' | null;
  csrid: string | null;
  dtmfno: string | null;
  telno: string | null;
  counselor_category: string | null;
  counselor_priority: number | null;
  call_unit_seconds: number | null;
  call_070_unit_cost: number | null;
  call_060_unit_cost: number | null;
  chat_unit_seconds: number | null;
  chat_unit_cost: number | null;
  preflag: 'P' | 'Y' | null;
  paid_royalty_pct: number | null;
  free_royalty_pct: number | null;
  bank_name: string | null;
  bank_holder: string | null;
  bank_account: string | null;
  use_phone: boolean;
  use_chat: boolean;
  level: number;
  point: number;
  state: string;
  is_rising: boolean;
  /** 메인 상위노출 (2026-05-15 어드민 토글 신설) — 정렬 1순위에 적용됨 */
  is_recommended: boolean;
  admin_memo: string | null;
  created_at: Date;
  // 프로필 (post_counselor)
  profile_headline: string | null;
  profile_hashtag1: string | null;
  profile_hashtag2: string | null;
  profile_specialty: string[];
  profile_traits: string[];
  profile_bio: string | null;
  profile_notice: string | null;
  profile_intro: string | null;
  event_starts_at: string | null;
  event_ends_at: string | null;
  event_banner_image_url: string | null;
  wide_headline: string | null;
  wide_subcaption: string | null;
  is_exclusive: boolean;
  // 첨부파일
  files: { id: number; kind: string | null; source_name: string; stored_name: string; stored_name_webp: string | null; filesize: number; created_at: Date }[];
  // 집계
  total_consult: string;
  total_usetm: string;
  this_month_070: string;   // 전화(roomid 없음, 후불 060 흡수)
  this_month_chat: string;  // 채팅(roomid 있음)
  last_month_070: string;
  last_month_chat: string;
}

export interface ListFilter {
  q?: string;          // mb_id/name/nickname/phone 통합 검색
  fr_date?: string;    // 가입일 시작
  to_date?: string;    // 가입일 종료
  status?: 'all' | 'active' | 'left' | 'blocked';
  state?: string;      // 상담사 상태(IDLE/CONN/...)
  category?: string;   // 상담사 분야(타로/신점/사주/심리)
  // ─ 고객 운영 세그먼트 (user 전용)
  // new7d=가입7일 / no_pay=결제이력없음 / vip=누적10만+ / dormant_balance=잔액1만+ 30일무로그인
  // churn_risk=누적5만+ 14일무로그인
  segment?: 'new7d' | 'no_pay' | 'vip' | 'dormant_balance' | 'churn_risk';
  // ─ 사용 채널 (user 전용): chat=채팅만 / phone070=070있음 / phone060=060있음 / mixed=채팅+전화
  channel?: 'chat' | 'phone070' | 'phone060' | 'mixed';
  // ─ 유입 채널 (소셜): 'none'=일반가입(social_provider NULL), 그 외 'kakao'|'naver'|...
  social?: string;
  // ─ 성별: 'M' | 'F' | 'none'(=미입력)
  gender?: 'M' | 'F' | 'none';
  page?: number;
  limit?: number;
}

// ─────────────────────────────────────────────
// 고객 생성/수정 입력
// ─────────────────────────────────────────────
export interface CustomerInput {
  mb_id?: string;
  password?: string;
  name: string;
  nickname?: string;
  email?: string;
  phone?: string;
  gender?: 'M' | 'F' | null;
  birth_date?: string | null;
  point?: number;
  acquisition_source?: string | null;
  intercept_until?: string | null;
  left_at?: string | null;
  zip?: string | null;
  addr1?: string | null;
  addr2?: string | null;
  addr_jibeon?: string | null;
}

// ─────────────────────────────────────────────
// 상담사 생성/수정 입력
// ─────────────────────────────────────────────
export interface CounselorInput {
  // 계정 (생성 시 필수, 수정 시 선택)
  mb_id?: string;
  password?: string;
  // 기본 정보
  name: string;
  nickname: string;
  email?: string;
  phone?: string;
  gender?: 'M' | 'F' | null;
  // 분야
  counselor_category?: string | null;
  // 상담사 운영 필드
  dtmfno?: string | null;            // 상담사번호
  csrid?: string | null;             // 엠투넷 ID (보통 m2net 응답으로 채워짐)
  telno?: string | null;             // 실 연결 전화번호 (숫자)
  counselor_priority?: number | null;
  call_unit_seconds?: number | null;
  call_070_unit_cost?: number | null;
  call_060_unit_cost?: number | null;
  chat_unit_seconds?: number | null;
  chat_unit_cost?: number | null;
  preflag?: 'P' | 'Y' | '' | null;
  paid_royalty_pct?: number | null;
  free_royalty_pct?: number | null;
  bank_name?: string | null;
  bank_holder?: string | null;
  bank_account?: string | null;
  state?: string;
  use_phone?: boolean;
  use_chat?: boolean;
  is_rising?: boolean;
  /** 메인 상위노출 — 어드민이 켜면 정렬 최상위 (2026-05-15) */
  is_recommended?: boolean;
  admin_memo?: string | null;        // 관리자 메모
  // m2net 등록 강제 ON/OFF (기본: env 활성 시 ON)
  register_m2net?: boolean;
  // ── 상담사 프로필 (post_counselor) ──
  profile_headline?: string | null;       // wr_8 한줄소개
  profile_hashtag1?: string | null;       // wr_9
  profile_hashtag2?: string | null;       // wr_10
  profile_specialty?: string[] | null;    // wr_5 전문분야 (배열, '|'로 join 저장)
  profile_traits?: string[] | null;       // wr_6 스타일/특징
  profile_bio?: string | null;            // wr_7 약력 (max 1000)
  profile_notice?: string | null;         // wr_content 상담사 공지 (rich text)
  profile_intro?: string | null;          // wr_4 상담사 소개 (rich text)
  // ── 이벤트 상담사 ──
  event_starts_at?: string | null;        // ISO 문자열, null이면 이벤트 해제
  event_ends_at?: string | null;
  event_banner_image_url?: string | null;
  // ── 와이드 사진 오버레이 캡션 ──
  wide_headline?: string | null;
  wide_subcaption?: string | null;
  // ── 전속파트너 ──
  is_exclusive?: boolean;
}

@Injectable()
export class MembersService {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly m2net: M2netService,
  ) {}

  /**
   * 비어있는 가장 작은 양의 정수 dtmfno 를 반환.
   *  - DB 의 모든 counselor.dtmfno (숫자형 문자열) 를 정수로 캐스팅 후 1 부터 순차 검사.
   *  - 동시 호출 race 방지를 위해 advisory transaction lock 사용.
   *  - excludeId 가 주어지면 해당 회원의 기존 dtmfno 는 후보에서 제외(자기 자신 충돌 방지).
   *  - sample 동작과 달리 신규 정책: dtmfno 빈값 비허용, 입력 누락 시 자동 부여.
   */
  private async nextAvailableDtmfno(excludeId?: number): Promise<string> {
    return this.sql.begin(async (tx) => {
      // pg_advisory_xact_lock — counselor.dtmfno 할당 전역 직렬화
      await tx`SELECT pg_advisory_xact_lock(7777001)`;
      const rows = await tx<{ n: number }[]>`
        SELECT (dtmfno)::int AS n
          FROM member
         WHERE role = 'counselor'
           AND dtmfno IS NOT NULL
           AND dtmfno ~ '^[0-9]+$'
           ${excludeId !== undefined ? tx`AND id <> ${excludeId}` : tx``}
         ORDER BY (dtmfno)::int ASC
      `;
      const used = new Set(rows.map((r) => r.n));
      let candidate = 1;
      while (used.has(candidate)) candidate += 1;
      return String(candidate);
    });
  }

  // ─────────────────────────────────────────────
  // 기본 조회 (기존 호환)
  // ─────────────────────────────────────────────
  async findAll(opts: { limit?: number; offset?: number; role?: string; q?: string } = {}): Promise<MemberRow[]> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    // q 검색: name / nickname / mb_id LIKE %q% (대소문자 무시). role 무관, 전체 회원 (상담사 포함) 대상.
    //   2026-05-28: 푸시 발송 폼의 회원 검색용 — 사장님 (상담사) 본인이 검색돼야 함.
    const qLike = opts.q && opts.q.trim() ? `%${opts.q.trim()}%` : null;
    if (opts.role && qLike) {
      return this.sql<MemberRow[]>`
        SELECT id, mb_id, name, nickname, email, phone, role, level, point, state, created_at, last_login_at
        FROM member
        WHERE role = ${opts.role}
          AND (name ILIKE ${qLike} OR nickname ILIKE ${qLike} OR mb_id ILIKE ${qLike})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    if (opts.role) {
      return this.sql<MemberRow[]>`
        SELECT id, mb_id, name, nickname, email, phone, role, level, point, state, created_at, last_login_at
        FROM member
        WHERE role = ${opts.role}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    if (qLike) {
      return this.sql<MemberRow[]>`
        SELECT id, mb_id, name, nickname, email, phone, role, level, point, state, created_at, last_login_at
        FROM member
        WHERE (name ILIKE ${qLike} OR nickname ILIKE ${qLike} OR mb_id ILIKE ${qLike})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    return this.sql<MemberRow[]>`
      SELECT id, mb_id, name, nickname, email, phone, role, level, point, state, created_at, last_login_at
      FROM member
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async count(role?: string): Promise<number> {
    const rows = role
      ? await this.sql<{ count: string }[]>`SELECT count(*) FROM member WHERE role = ${role}`
      : await this.sql<{ count: string }[]>`SELECT count(*) FROM member`;
    return Number(rows[0].count);
  }

  async findById(id: number): Promise<MemberRow | null> {
    const rows = await this.sql<MemberRow[]>`
      SELECT id, mb_id, name, nickname, email, phone, role, level, point, state, created_at, last_login_at
      FROM member WHERE id = ${id}
    `;
    return rows[0] ?? null;
  }

  // ─────────────────────────────────────────────
  // 공통 필터 빌더
  // ─────────────────────────────────────────────
  private buildBaseFilter(role: 'user' | 'counselor', f: ListFilter) {
    const conds: ReturnType<Sql> [] = [this.sql`m.role = ${role}`];
    if (f.q) {
      const like = `%${f.q}%`;
      conds.push(this.sql`(
        m.mb_id ILIKE ${like}
        OR m.name ILIKE ${like}
        OR m.nickname ILIKE ${like}
        OR m.phone LIKE ${like}
      )`);
    }
    if (f.fr_date) conds.push(this.sql`m.created_at >= ${f.fr_date + ' 00:00:00'}::timestamptz`);
    if (f.to_date) conds.push(this.sql`m.created_at <= ${f.to_date + ' 23:59:59'}::timestamptz`);
    if (f.status === 'active') conds.push(this.sql`m.left_at IS NULL AND (m.intercept_until IS NULL OR m.intercept_until < now())`);
    if (f.status === 'left') conds.push(this.sql`m.left_at IS NOT NULL`);
    if (f.status === 'blocked') conds.push(this.sql`m.intercept_until IS NOT NULL AND m.intercept_until >= now()`);
    if (f.state) conds.push(this.sql`m.state = ${f.state}`);
    if (f.category) conds.push(this.sql`m.counselor_category = ${f.category}`);

    // 공통 — 성별 / 소셜 (member 컬럼 직접)
    if (f.gender === 'M' || f.gender === 'F') conds.push(this.sql`m.gender = ${f.gender}`);
    else if (f.gender === 'none') conds.push(this.sql`m.gender IS NULL`);
    if (f.social === 'none') conds.push(this.sql`m.social_provider IS NULL`);
    else if (f.social) conds.push(this.sql`m.social_provider = ${f.social}`);

    // user 전용 운영 세그먼트
    if (role === 'user') {
      if (f.segment === 'new7d') {
        conds.push(this.sql`m.created_at >= now() - interval '7 days'`);
      } else if (f.segment === 'no_pay') {
        conds.push(this.sql`NOT EXISTS (SELECT 1 FROM payment p WHERE p.member_id = m.id AND p.status = 'completed')`);
      } else if (f.segment === 'vip') {
        conds.push(this.sql`(SELECT COALESCE(SUM(p.amount),0) FROM payment p WHERE p.member_id = m.id AND p.status = 'completed') >= 100000`);
      } else if (f.segment === 'dormant_balance') {
        conds.push(this.sql`m.point >= 10000 AND (m.last_login_at IS NULL OR m.last_login_at < now() - interval '30 days')`);
      } else if (f.segment === 'churn_risk') {
        conds.push(this.sql`(SELECT COALESCE(SUM(p.amount),0) FROM payment p WHERE p.member_id = m.id AND p.status = 'completed') >= 50000 AND (m.last_login_at IS NULL OR m.last_login_at < now() - interval '14 days')`);
      }

      // 사용 채널 — consultation roomid NULL=전화, NOT NULL=채팅
      if (f.channel === 'chat') {
        conds.push(this.sql`EXISTS (SELECT 1 FROM consultation c WHERE c.member_id = m.id AND c.roomid IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM consultation c WHERE c.member_id = m.id AND c.roomid IS NULL)`);
      } else if (f.channel === 'phone070') {
        conds.push(this.sql`EXISTS (SELECT 1 FROM consultation c WHERE c.member_id = m.id AND c.preflag = 'Y' AND c.roomid IS NULL)`);
      } else if (f.channel === 'phone060') {
        conds.push(this.sql`EXISTS (SELECT 1 FROM consultation c WHERE c.member_id = m.id AND (c.preflag IS NULL OR c.preflag <> 'Y') AND c.roomid IS NULL)`);
      } else if (f.channel === 'mixed') {
        conds.push(this.sql`EXISTS (SELECT 1 FROM consultation c WHERE c.member_id = m.id AND c.roomid IS NOT NULL) AND EXISTS (SELECT 1 FROM consultation c WHERE c.member_id = m.id AND c.roomid IS NULL)`);
      }
    }

    return conds;
  }

  private joinWhere(conds: ReturnType<Sql>[]): ReturnType<Sql> {
    if (conds.length === 0) return this.sql``;
    return conds.reduce((acc, c, i) => i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`, this.sql``);
  }

  // ─────────────────────────────────────────────
  // 고객 리스트
  // ─────────────────────────────────────────────
  async findCustomers(f: ListFilter, showPhone = false): Promise<{ items: CustomerRow[]; total: number; summary: { total: number; active: number; left: number; blocked: number } }> {
    const limit = Math.min(f.limit ?? 30, 200);
    const page = Math.max(1, f.page ?? 1);
    const offset = (page - 1) * limit;

    const conds = this.buildBaseFilter('user', f);
    const where = this.joinWhere(conds);

    // 집계는 sub-query 로 회원당 1줄씩 미리 집계
    const items = await this.sql<CustomerRow[]>`
      SELECT
        m.id, m.mb_id, m.name, m.nickname, m.phone, m.gender, m.birth_date,
        m.level, m.point, m.acquisition_source, m.social_provider,
        m.last_login_at, m.created_at, m.left_at, m.intercept_until,
        COALESCE(p.cnt, 0) AS pay_count,
        COALESCE(p.total, 0) AS pay_total,
        COALESCE(c.amt_070, 0) AS consult_070,
        COALESCE(c.amt_060, 0) AS consult_060,
        COALESCE(c.amt_chat, 0) AS consult_chat
      FROM member m
      LEFT JOIN (
        SELECT member_id, COUNT(*) AS cnt, SUM(amount) AS total
          FROM payment WHERE status = 'completed' GROUP BY member_id
      ) p ON p.member_id = m.id
      LEFT JOIN (
        SELECT member_id,
               SUM(CASE WHEN preflag = 'Y' AND roomid IS NULL THEN amt ELSE 0 END) AS amt_070,
               SUM(CASE WHEN (preflag IS NULL OR preflag <> 'Y') AND roomid IS NULL THEN amt ELSE 0 END) AS amt_060,
               SUM(CASE WHEN roomid IS NOT NULL THEN amt ELSE 0 END) AS amt_chat
          FROM consultation GROUP BY member_id
      ) c ON c.member_id = m.id
      ${where}
      ORDER BY m.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*) AS cnt FROM member m ${where}
    `;
    const total = Number(totalRows[0].cnt);

    // 상태별 요약 (필터 무관 — 전체 user 기준)
    const summaryRows = await this.sql<{
      total: string; active: string; left: string; blocked: string;
    }[]>`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE left_at IS NULL AND (intercept_until IS NULL OR intercept_until < now())) AS active,
        COUNT(*) FILTER (WHERE left_at IS NOT NULL) AS left,
        COUNT(*) FILTER (WHERE intercept_until IS NOT NULL AND intercept_until >= now()) AS blocked
      FROM member WHERE role = 'user'
    `;

    // [PII 보호] 슈퍼관리자 + 토글 ON 일 때만 평문. 그 외 마스킹.
    const maskedItems = items.map((it) => applyPhoneMask(it, showPhone));

    return {
      items: maskedItems,
      total,
      summary: {
        total: Number(summaryRows[0].total),
        active: Number(summaryRows[0].active),
        left: Number(summaryRows[0].left),
        blocked: Number(summaryRows[0].blocked),
      },
    };
  }

  // ─────────────────────────────────────────────
  // 상담사 리스트
  // ─────────────────────────────────────────────
  async findCounselors(f: ListFilter, showPhone = false): Promise<{
    items: CounselorRow[];
    total: number;
    summary: { total: number; idle: number; busy: number; absent: number };
    by_category: Record<string, number>;
  }> {
    const limit = Math.min(f.limit ?? 30, 200);
    const page = Math.max(1, f.page ?? 1);
    const offset = (page - 1) * limit;

    const conds = this.buildBaseFilter('counselor', f);
    const where = this.joinWhere(conds);

    const items = await this.sql<CounselorRow[]>`
      WITH this_m AS (
        SELECT counselor_id,
               -- roomid 기준 분리(2026-06-12): 전화(roomid 없음 — 후불 060 흡수) / 채팅(roomid 있음).
               --   이전엔 preflag 기준이라 채팅이 전화(070)에 섞이는 문제가 있었음.
               SUM(CASE WHEN roomid IS NULL THEN amt ELSE 0 END) AS amt_call,
               SUM(CASE WHEN roomid IS NOT NULL THEN amt ELSE 0 END) AS amt_chat
          FROM consultation
         WHERE ended_at >= date_trunc('month', CURRENT_DATE)
         GROUP BY counselor_id
      ),
      last_m AS (
        SELECT counselor_id,
               SUM(CASE WHEN roomid IS NULL THEN amt ELSE 0 END) AS amt_call,
               SUM(CASE WHEN roomid IS NOT NULL THEN amt ELSE 0 END) AS amt_chat
          FROM consultation
         WHERE ended_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
           AND ended_at <  date_trunc('month', CURRENT_DATE)
         GROUP BY counselor_id
      ),
      total_c AS (
        SELECT counselor_id, COUNT(*) AS cnt, SUM(usetm) AS total_sec
          FROM consultation GROUP BY counselor_id
      )
      SELECT
        m.id, m.mb_id, m.name, m.nickname, m.phone, m.csrid, m.dtmfno, m.telno,
        m.counselor_category,
        m.counselor_priority,
        m.call_070_unit_cost, m.call_060_unit_cost, m.chat_unit_cost,
        m.paid_royalty_pct,
        m.level, m.point, m.state, m.is_rising, m.created_at,
        m.updated_at, m.last_login_at, m.use_phone, m.use_chat,
        COALESCE(p.earning_balance, 0) AS earning_balance,
        COALESCE(tc.cnt, 0)        AS total_consult,
        COALESCE(tc.total_sec, 0)  AS total_usetm,
        COALESCE(tm.amt_call, 0)   AS this_month_070,
        COALESCE(tm.amt_chat, 0)   AS this_month_chat,
        COALESCE(lm.amt_call, 0)   AS last_month_070,
        COALESCE(lm.amt_chat, 0)   AS last_month_chat,
        -- 2026-05-25: 빠른 필터 (데이터 미완성 / 이벤트 / 환불) 용 보조 필드
        (pc.id IS NOT NULL) AS has_profile,
        (COALESCE(pc.hashtag1,'') <> '' OR COALESCE(pc.hashtag2,'') <> '') AS has_hashtag,
        EXISTS (
          SELECT 1 FROM member_file mf
           WHERE mf.member_id = m.id AND mf.kind = 'profile'
           LIMIT 1
        ) AS has_profile_image,
        (pc.event_starts_at IS NOT NULL
           AND pc.event_starts_at <= now()
           AND (pc.event_ends_at IS NULL OR pc.event_ends_at > now())
        ) AS event_active,
        (SELECT COUNT(*) FROM refund_request rr
          WHERE rr.counselor_id = m.id
            AND rr.status = 'approved'
            AND rr.created_at >= now() - interval '30 days'
        )::int AS refund_30d_count
      FROM member m
      LEFT JOIN point          p  ON p.member_id  = m.id
      LEFT JOIN total_c        tc ON tc.counselor_id = m.id
      LEFT JOIN this_m         tm ON tm.counselor_id = m.id
      LEFT JOIN last_m         lm ON lm.counselor_id = m.id
      LEFT JOIN post_counselor pc ON pc.member_id  = m.id
      ${where}
      ORDER BY COALESCE(m.counselor_priority, 9999) ASC, m.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*) AS cnt FROM member m ${where}
    `;
    const total = Number(totalRows[0].cnt);

    const summaryRows = await this.sql<{
      total: string; idle: string; busy: string; absent: string;
    }[]>`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE state IN ('IDLE', 'RDCH', 'RDVC', 'CRDY')) AS idle,
        COUNT(*) FILTER (WHERE state IN ('CONN', 'CNCH', 'RESV')) AS busy,
        COUNT(*) FILTER (WHERE state = 'ABSE') AS absent
      FROM member WHERE role = 'counselor' AND left_at IS NULL
    `;

    const catRows = await this.sql<{ counselor_category: string | null; cnt: string }[]>`
      SELECT counselor_category, COUNT(*) AS cnt
        FROM member
       WHERE role = 'counselor' AND left_at IS NULL
       GROUP BY counselor_category
    `;
    const by_category: Record<string, number> = {};
    for (const r of catRows) {
      const k = r.counselor_category ?? '미지정';
      by_category[k] = Number(r.cnt);
    }

    // [PII 보호] 슈퍼관리자 + 토글 ON 일 때만 평문. 상담사는 phone + telno 둘 다 보호.
    const maskedItems = items.map((it) => applyPhoneMask(it, showPhone));

    return {
      items: maskedItems,
      total,
      summary: {
        total: Number(summaryRows[0].total),
        idle: Number(summaryRows[0].idle),
        busy: Number(summaryRows[0].busy),
        absent: Number(summaryRows[0].absent),
      },
      by_category,
    };
  }

  /**
   * 회원 역할 조회 (role 필터 없이) — 듀얼계정 폴백 리다이렉트용.
   * 고객/상담사 상세 화면이 "못 찾음" 일 때 이 id 의 실제 role 을 확인한다.
   */
  async whois(id: number): Promise<{ found: boolean; id: number; role: string | null; nickname: string | null; name: string | null }> {
    const rows = await this.sql<{ id: number; role: string | null; nickname: string | null; name: string | null }[]>`
      SELECT id, role, nickname, name FROM member WHERE id = ${id} LIMIT 1
    `;
    if (rows.length === 0) return { found: false, id, role: null, nickname: null, name: null };
    return { found: true, id: rows[0].id, role: rows[0].role, nickname: rows[0].nickname, name: rows[0].name };
  }

  // ─────────────────────────────────────────────
  // 고객 단건 조회 / 생성 / 수정
  // ─────────────────────────────────────────────
  async getCustomerDetail(id: number, showPhone = false): Promise<CustomerRow> {
    const rows = await this.sql<CustomerRow[]>`
      SELECT m.id, m.mb_id, m.name, m.nickname, m.email, m.phone, m.gender, m.birth_date,
             m.level, m.point, m.acquisition_source, m.social_provider,
             m.last_login_at, m.created_at, m.left_at, m.intercept_until,
             m.zip, m.addr1, m.addr2, m.addr_jibeon,
             0::bigint AS pay_count, 0::bigint AS pay_total,
             0::bigint AS consult_070, 0::bigint AS consult_060, 0::bigint AS consult_chat
        FROM member m
       WHERE m.id = ${id} AND m.role = 'user'
    `;
    if (rows.length === 0) throw new NotFoundException('고객을 찾을 수 없습니다.');
    return applyPhoneMask(rows[0], showPhone);
  }

  async createCustomer(input: CustomerInput): Promise<{ id: number }> {
    if (!input.mb_id) throw new BadRequestException('mb_id는 필수입니다.');
    if (!input.password) throw new BadRequestException('password는 필수입니다.');
    if (!input.name) throw new BadRequestException('이름은 필수입니다.');

    const exists = await this.sql<{ id: number }[]>`SELECT id FROM member WHERE mb_id = ${input.mb_id} LIMIT 1`;
    if (exists.length > 0) throw new ConflictException('이미 사용 중인 아이디입니다.');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const phone = input.phone ? input.phone.replace(/[^0-9]/g, '') : null;

    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO member (
        mb_id, password, name, nickname, email, phone, gender, birth_date,
        role, level, point, acquisition_source,
        zip, addr1, addr2, addr_jibeon
      ) VALUES (
        ${input.mb_id}, ${passwordHash}, ${input.name},
        ${input.nickname ?? input.name},
        ${input.email ?? null}, ${phone}, ${input.gender ?? null}, ${input.birth_date ?? null},
        'user', 2, ${input.point ?? 0}, ${input.acquisition_source ?? null},
        ${input.zip ?? null}, ${input.addr1 ?? null}, ${input.addr2 ?? null}, ${input.addr_jibeon ?? null}
      )
      RETURNING id
    `;
    return { id: inserted[0].id };
  }

  async updateCustomer(id: number, input: Partial<CustomerInput>): Promise<{ id: number }> {
    const exists = await this.sql<{ id: number; role: string }[]>`SELECT id, role FROM member WHERE id = ${id}`;
    if (exists.length === 0 || exists[0].role !== 'user') {
      throw new NotFoundException('고객을 찾을 수 없습니다.');
    }
    const updates: Record<string, unknown> = {};
    const setIf = <K extends keyof CustomerInput>(k: K) => {
      if (input[k] !== undefined) updates[k] = input[k] as unknown;
    };
    setIf('name'); setIf('nickname'); setIf('email'); setIf('gender');
    setIf('birth_date'); setIf('acquisition_source');
    setIf('intercept_until');
    setIf('left_at');
    setIf('zip'); setIf('addr1'); setIf('addr2'); setIf('addr_jibeon');
    // point 는 직접 수정 금지 — 별도 포인트 조정 기능(point_history 기록)으로만 변경
    // [Audit E-W4] phone 타입 강제 — 객체/배열 등 비문자열 injection 방지
    if (input.phone !== undefined) {
      if (input.phone !== null && typeof input.phone !== 'string') {
        throw new BadRequestException('휴대폰 번호는 문자열이어야 합니다.');
      }
      // [PII 마스킹 안전망 2026-06-02] 마스킹 패턴 (별표 포함) 또는 11자리 미만 거부.
      //   원인: 일반관리자가 마스킹 화면 (010-****-3396) 보고 다른 필드 수정 후 저장 시
      //         frontend formatPhone 이 별표 제거 → DB phone 7자리로 영구 손실 사고 차단.
      if (input.phone && input.phone.includes('*')) {
        throw new BadRequestException('전화번호 마스킹 값입니다. 평문 평소표시 권한이 필요합니다.');
      }
      const digits = input.phone ? input.phone.replace(/[^0-9]/g, '') : '';
      if (input.phone && digits.length > 0 && digits.length < 10) {
        throw new BadRequestException(`전화번호는 10~11자리여야 합니다 (현재 ${digits.length}자리).`);
      }
      updates.phone = input.phone ? digits : null;
    }
    if (input.password !== undefined && input.password !== null) {
      if (typeof input.password !== 'string') {
        throw new BadRequestException('비밀번호는 문자열이어야 합니다.');
      }
      if (input.password) updates.password = await bcrypt.hash(input.password, 10);
    }

    if (Object.keys(updates).length > 0) {
      await this.sql`UPDATE member SET ${this.sql(updates)}, updated_at = now() WHERE id = ${id}`;
    }
    return { id };
  }

  // ─────────────────────────────────────────────
  // 상담사 단건 조회 (상세/수정용 — 모든 컬럼)
  // ─────────────────────────────────────────────
  async getCounselorDetail(id: number, showPhone = false): Promise<CounselorRow> {
    const rows = await this.sql<CounselorRow[]>`
      SELECT m.id, m.mb_id, m.name, m.nickname, m.email, m.phone, m.gender,
             m.csrid, m.dtmfno, m.telno,
             m.counselor_category, m.counselor_priority,
             m.call_unit_seconds, m.call_070_unit_cost, m.call_060_unit_cost,
             m.chat_unit_seconds, m.chat_unit_cost,
             m.preflag,
             m.paid_royalty_pct, m.free_royalty_pct,
             m.bank_name, m.bank_holder, m.bank_account,
             m.use_phone, m.use_chat,
             m.level, m.point, m.state, m.is_rising, m.is_recommended, m.admin_memo, m.created_at,
             p.headline                                 AS profile_headline,
             p.hashtag1                                 AS profile_hashtag1,
             p.hashtag2                                 AS profile_hashtag2,
             COALESCE(string_to_array(p.specialty, '|'), ARRAY[]::TEXT[]) AS profile_specialty,
             COALESCE(p.traits, ARRAY[]::TEXT[])        AS profile_traits,
             p.bio                                      AS profile_bio,
             p.content                                  AS profile_notice,
             p.intro                                    AS profile_intro,
             p.event_starts_at                          AS event_starts_at,
             p.event_ends_at                            AS event_ends_at,
             p.event_banner_image_url                   AS event_banner_image_url,
             p.wide_headline                            AS wide_headline,
             p.wide_subcaption                          AS wide_subcaption,
             COALESCE(p.is_exclusive, FALSE)            AS is_exclusive,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'id', f.id, 'kind', f.kind, 'source_name', f.source_name,
                 'stored_name', f.stored_name, 'stored_name_webp', f.stored_name_webp,
                 'filesize', f.filesize, 'created_at', f.created_at
               ) ORDER BY f.created_at DESC)
                FROM member_file f WHERE f.member_id = m.id),
               '[]'::json
             ) AS files,
             0::bigint AS total_consult, 0::bigint AS total_usetm,
             0::bigint AS this_month_070, 0::bigint AS this_month_chat,
             0::bigint AS last_month_070, 0::bigint AS last_month_chat
        FROM member m
   LEFT JOIN post_counselor p ON p.member_id = m.id
       WHERE m.id = ${id} AND m.role = 'counselor'
    `;
    if (rows.length === 0) throw new NotFoundException('상담사를 찾을 수 없습니다.');
    return applyPhoneMask(rows[0], showPhone);
  }

  /**
   * 상담사 수익금 타임라인 — point_history(earning) 기준.
   *   문의 대응용: 건별 날짜·상담시간·대상고객·m2net 실과금·실제 적립을 한 화면에.
   *   ⚠️ 선결제 채팅은 consultation.amt=0 이지만 실제 적립(earn_point)은 m2net 실과금×정산률로 정상 발생 →
   *      반드시 point_history.earn_point(실제 적립) 기준으로 보여준다 (amt×rate 계산은 선결제에서 0 이 되어 틀림).
   */
  async getCounselorEarningHistory(counselorId: number, page = 1, limit = 30) {
    const p = Math.max(1, Math.trunc(page));
    const lim = Math.min(100, Math.max(1, Math.trunc(limit)));
    const offset = (p - 1) * lim;
    const [items, cnt] = await Promise.all([
      this.sql<{
        id: number; created_at: string; content: string | null;
        earn_point: number; use_point: number; balance_after: number | null;
        rel_table: string | null; consult_id: number | null;
        reason: string | null; usetm: number | null;
        customer_mb_id: string | null; customer_nickname: string | null;
        m2net_amt: number | null;
      }[]>`
        SELECT ph.id, ph.created_at, ph.content,
               ph.earn_point, ph.use_point, ph.balance_after,
               ph.rel_table,
               c.id AS consult_id, c.reason, c.usetm,
               cm.mb_id AS customer_mb_id, cm.nickname AS customer_nickname,
               NULLIF(c.mrtn::json->>'amt','')::int AS m2net_amt
          FROM point_history ph
          LEFT JOIN consultation c
                 ON ph.rel_table = 'consultation' AND c.id::text = ph.rel_id
          LEFT JOIN member cm ON cm.id = c.member_id
         WHERE ph.member_id = ${counselorId} AND ph.balance_kind = 'earning'
         ORDER BY ph.created_at DESC, ph.id DESC
         LIMIT ${lim} OFFSET ${offset}
      `,
      this.sql<{ count: string }[]>`
        SELECT COUNT(*) AS count FROM point_history
         WHERE member_id = ${counselorId} AND balance_kind = 'earning'
      `,
    ]);
    return { items, total: Number(cnt[0]?.count ?? 0), page: p, limit: lim };
  }

  // ─────────────────────────────────────────────
  // 상담사 생성 (사전 해시된 PW 사용) — 상담사 신청 승인 흐름 전용.
  // createCounselor 는 평문 PW 를 받아 bcrypt 로 해시하지만, 가입 신청 시점에 이미 해싱된
  // PW 를 extras 에 저장해두므로 그걸 그대로 INSERT 한다. m2net 연동은 호출처에서 별도 진행.
  // ─────────────────────────────────────────────
  async createCounselorWithHash(input: {
    mb_id: string;
    password_hash: string;
    name: string;
    nickname: string;
    email: string | null;
    phone: string | null;
    telno: string | null;
    counselor_category: string | null;
    profile_intro: string | null;
    profile_specialty: string[] | null;
    profile_traits?: string[] | null;
  }): Promise<number> {
    if (!input.mb_id) throw new BadRequestException('mb_id는 필수입니다.');
    if (!input.password_hash) throw new BadRequestException('password_hash는 필수입니다.');

    const existing = await this.sql<{ id: number }[]>`SELECT id FROM member WHERE mb_id = ${input.mb_id} LIMIT 1`;
    if (existing.length > 0) throw new ConflictException('이미 사용 중인 아이디입니다.');

    const dtmfnoFinal = await this.nextAvailableDtmfno();
    // 신규 상담사는 양쪽 대기 상태로 시작 — use_phone+use_chat 둘 다 true 로 INSERT 되므로
    // state 도 RDVC(Ready Voice+Chat)여야 사용자 카드에 "통화가능/채팅가능" 으로 정상 표시.
    // IDLE 로 두면 mapper 가 "둘 다 활성인데 RDVC 아님" → 'busy'("상담중")로 잘못 표시함.
    // (2026-05-21 사장님 결정 — 신규 상담사 첫 진입 UX 정정)
    const stateValue = 'RDVC';
    const telnoFinal = input.telno ? input.telno.replace(/[^0-9]/g, '') : null;

    // 신규 상담사 기본 단가 (2026-05-22 사장님 결정):
    //   가입 즉시 0원 노출 = 회원 혼란 → 자동 기본값 박기.
    //   setting.grade.default_new_unit_cost (기본 1000원, 어드민 변경 가능).
    //   상담사 본인이 마이페이지에서 등급별 옵션 중 다른 값으로 변경 가능.
    const defaultCostRow = await this.sql<{ value: string }[]>`
      SELECT value FROM setting
       WHERE namespace='grade' AND key='default_new_unit_cost' LIMIT 1
    `;
    const defaultUnitCost = Number(defaultCostRow[0]?.value) || 1000;

    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO member (
        mb_id, password, name, nickname, email, phone, gender,
        role, level, state, counselor_category,
        dtmfno, telno, counselor_priority,
        call_unit_seconds, call_070_unit_cost, call_060_unit_cost,
        chat_unit_seconds, chat_unit_cost, preflag,
        use_phone, use_chat, is_rising
      ) VALUES (
        ${input.mb_id}, ${input.password_hash}, ${input.name}, ${input.nickname},
        ${input.email}, ${input.phone}, NULL,
        'counselor', 5, ${stateValue}, ${input.counselor_category},
        ${dtmfnoFinal}, ${telnoFinal}, 1,
        30, ${defaultUnitCost}, ${defaultUnitCost},
        30, ${defaultUnitCost}, 'P',
        true, true, false
      )
      RETURNING id
    `;
    const memberId = inserted[0].id;

    // post_counselor 프로필 — 신청서의 intro/specialty/traits 채움
    await this.upsertCounselorProfile(memberId, {
      profile_intro: input.profile_intro ?? undefined,
      profile_specialty: input.profile_specialty ?? undefined,
      profile_traits: input.profile_traits ?? undefined,
      nickname: input.nickname,
    });

    // point 행 보장 — 신규 상담사도 earning_balance 적립 통장이 있어야 수익금 기록 가능
    await this.sql`
      INSERT INTO point (member_id, free_balance, paid_balance, earning_balance, total_earned, total_used)
      VALUES (${memberId}, 0, 0, 0, 0, 0)
      ON CONFLICT (member_id) DO NOTHING
    `;

    return memberId;
  }

  /**
   * 회원 → 상담사 승격 (2026-05-22 ID 통합 작업).
   * 기존 일반회원(role='user') row 의 role 을 'counselor' 로 바꾸고
   * 상담사로서의 운영 컬럼(dtmfno, telno, state, 단가, level) 을 채운다.
   * 회원으로서의 정보(name, mb_id, password, phone, email, m2net_membid) 는 그대로 유지.
   */
  async promoteToCounselor(input: {
    memberId: number;
    nickname: string;
    counselor_category: string | null;
    profile_intro: string | null;
    profile_specialty: string[] | null;
    profile_traits?: string[] | null;
  }): Promise<number> {
    const rows = await this.sql<{ id: number; role: string; phone: string | null }[]>`
      SELECT id, role, phone FROM member WHERE id = ${input.memberId} LIMIT 1
    `;
    const cur = rows[0];
    if (!cur) throw new BadRequestException('회원을 찾을 수 없습니다.');
    if (cur.role === 'counselor') {
      throw new ConflictException('이미 상담사로 등록된 회원입니다.');
    }
    if (cur.role !== 'user') {
      throw new ConflictException(`승격할 수 없는 role: ${cur.role}`);
    }

    const dtmfnoFinal = await this.nextAvailableDtmfno();
    const telnoFinal = (cur.phone ?? '').replace(/[^0-9]/g, '') || null;
    const defaultCostRow = await this.sql<{ value: string }[]>`
      SELECT value FROM setting
       WHERE namespace='grade' AND key='default_new_unit_cost' LIMIT 1
    `;
    const defaultUnitCost = Number(defaultCostRow[0]?.value) || 1000;

    await this.sql`
      UPDATE member SET
        role = 'counselor',
        level = 5,
        state = 'RDVC',
        nickname = ${input.nickname},
        counselor_category = ${input.counselor_category},
        dtmfno = ${dtmfnoFinal},
        telno = ${telnoFinal},
        counselor_priority = COALESCE(counselor_priority, 1),
        call_unit_seconds = COALESCE(call_unit_seconds, 30),
        call_070_unit_cost = COALESCE(call_070_unit_cost, ${defaultUnitCost}),
        call_060_unit_cost = COALESCE(call_060_unit_cost, ${defaultUnitCost}),
        chat_unit_seconds = COALESCE(chat_unit_seconds, 30),
        chat_unit_cost = COALESCE(chat_unit_cost, ${defaultUnitCost}),
        preflag = COALESCE(preflag, 'P'),
        use_phone = true,
        use_chat = true,
        updated_at = now()
       WHERE id = ${input.memberId}
    `;

    await this.upsertCounselorProfile(input.memberId, {
      profile_intro: input.profile_intro ?? undefined,
      profile_specialty: input.profile_specialty ?? undefined,
      profile_traits: input.profile_traits ?? undefined,
      nickname: input.nickname,
    });

    // point 행 보장 — 회원→상담사 승격 시에도 earning_balance 통장 필요
    await this.sql`
      INSERT INTO point (member_id, free_balance, paid_balance, earning_balance, total_earned, total_used)
      VALUES (${input.memberId}, 0, 0, 0, 0, 0)
      ON CONFLICT (member_id) DO NOTHING
    `;

    return input.memberId;
  }

  // ─────────────────────────────────────────────
  // 상담사 생성 — m2net (passcall) csr-mgr 등록까지 포함
  // ─────────────────────────────────────────────
  async createCounselor(input: CounselorInput): Promise<{ id: number; csrid: string | null; m2net: { ok: boolean; error?: string } }> {
    if (!input.mb_id) throw new BadRequestException('mb_id는 필수입니다.');
    if (!input.password) throw new BadRequestException('password는 필수입니다.');
    if (!input.name) throw new BadRequestException('이름은 필수입니다.');
    if (!input.nickname) throw new BadRequestException('닉네임은 필수입니다.');

    // 중복 검사
    const existing = await this.sql<{ id: number }[]>`SELECT id FROM member WHERE mb_id = ${input.mb_id} LIMIT 1`;
    if (existing.length > 0) throw new ConflictException('이미 사용 중인 아이디입니다.');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const phone = input.phone ? input.phone.replace(/[^0-9]/g, '') : null;
    const telno = input.telno ? input.telno.replace(/[^0-9]/g, '') : null;

    // sample/adm/member_form_update.php 동등: 신규 등록도 use_phone/use_chat 매트릭스로 state 결정.
    // ABSE/CONN/RESV/CRDY 명시는 그대로, 그 외(IDLE 포함)는 매트릭스로 도출.
    const usePhone = input.use_phone ?? true;
    const useChat = input.use_chat ?? true;
    const requestedState = input.state ?? 'IDLE';
    const readyState = computeReadyState(usePhone, useChat);
    const stateValue =
      requestedState === 'ABSE' ||
      requestedState === 'CONN' ||
      requestedState === 'RESV' ||
      requestedState === 'CRDY'
        ? requestedState
        : readyState;

    // dtmfno: 빈값 비허용. 입력이 비어있거나 숫자 외 문자 포함이면 1부터 비어있는 가장 작은 번호로 자동 부여.
    const dtmfnoInputRaw = (input.dtmfno ?? '').replace(/[^0-9]/g, '');
    const dtmfnoFinal = dtmfnoInputRaw || (await this.nextAvailableDtmfno());

    // 1) member insert (csrid 는 m2net 응답으로 추후 갱신)
    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO member (
        mb_id, password, name, nickname, email, phone, gender,
        role, level, state, counselor_category,
        dtmfno, telno, counselor_priority,
        call_unit_seconds, call_070_unit_cost, call_060_unit_cost,
        chat_unit_seconds, chat_unit_cost, preflag,
        paid_royalty_pct, free_royalty_pct,
        bank_name, bank_holder, bank_account,
        use_phone, use_chat, is_rising
      ) VALUES (
        ${input.mb_id}, ${passwordHash}, ${input.name}, ${input.nickname},
        ${input.email ?? null}, ${phone}, ${input.gender ?? null},
        'counselor', 5, ${stateValue}, ${input.counselor_category ?? null},
        ${dtmfnoFinal}, ${telno}, ${input.counselor_priority ?? null},
        30, ${input.call_070_unit_cost ?? 0}, ${input.call_060_unit_cost ?? 0},
        30, ${input.chat_unit_cost ?? 0}, ${input.preflag ?? 'P'},
        ${input.paid_royalty_pct ?? null}, ${input.free_royalty_pct ?? null},
        ${input.bank_name ?? null}, ${input.bank_holder ?? null}, ${input.bank_account ?? null},
        ${usePhone}, ${useChat}, ${input.is_rising ?? false}
      )
      RETURNING id
    `;
    const memberId = inserted[0].id;

    // 2) m2net csr-mgr POST + chat-mgr csrstat (env 활성 + register_m2net !== false 일 때)
    let m2netCsrid: string | null = input.csrid ?? null;
    let m2netStatus = { ok: false, error: '미수행' };
    const shouldRegister = input.register_m2net !== false && this.m2net.isEnabled();
    if (shouldRegister) {
      const result = await this.m2net.registerCounselor({
        csrnm: input.nickname,
        state: stateValue,
        sortno: input.counselor_priority ?? 1,
        dtmfno: dtmfnoFinal,
        telno: telno ?? '',
        dectm: 30,
        decamt: input.call_070_unit_cost ?? 0,
        preflag: (input.preflag ?? 'P') as 'P' | 'Y' | '',
        chatdectm: 30,
        chatdecamt: input.chat_unit_cost ?? 0,
      });
      m2netStatus = { ok: result.ok, error: result.error ?? '' };
      if (result.ok && result.csrid) {
        m2netCsrid = result.csrid;
        await this.sql`UPDATE member SET csrid = ${m2netCsrid} WHERE id = ${memberId}`;
        // chat-mgr csrstat 으로 즉시 상태 반영 (sample 의 set_crs_status_chg 동등)
        await this.m2net.updateCounselorState(m2netCsrid, stateValue);
      }
    } else if (input.csrid) {
      // m2net 미수행이지만 사용자가 직접 csrid 입력한 경우 저장
      await this.sql`UPDATE member SET csrid = ${input.csrid} WHERE id = ${memberId}`;
      m2netStatus = { ok: true, error: '수동입력' };
    }

    // 3) 프로필 (post_counselor) row 생성 — 프로필 필드 중 하나라도 있으면 upsert
    await this.upsertCounselorProfile(memberId, input);

    return { id: memberId, csrid: m2netCsrid, m2net: m2netStatus };
  }

  // 상담사 프로필 (post_counselor) 1:1 upsert
  private async upsertCounselorProfile(memberId: number, input: Partial<CounselorInput>): Promise<void> {
    const hasProfileInput =
      input.profile_headline !== undefined ||
      input.profile_hashtag1 !== undefined ||
      input.profile_hashtag2 !== undefined ||
      input.profile_specialty !== undefined ||
      input.profile_traits !== undefined ||
      input.profile_bio !== undefined ||
      input.profile_notice !== undefined ||
      input.profile_intro !== undefined ||
      input.nickname !== undefined ||
      input.event_starts_at !== undefined ||
      input.event_ends_at !== undefined ||
      input.event_banner_image_url !== undefined ||
      input.wide_headline !== undefined ||
      input.wide_subcaption !== undefined ||
      input.is_exclusive !== undefined;
    if (!hasProfileInput) return;

    const existing = await this.sql<{ id: number }[]>`
      SELECT id FROM post_counselor WHERE member_id = ${memberId} LIMIT 1
    `;

    const specialtyText = input.profile_specialty
      ? input.profile_specialty.filter(Boolean).join('|')
      : null;
    const traits = input.profile_traits ?? null;
    const title = input.nickname ?? '';

    if (existing.length === 0) {
      await this.sql`
        INSERT INTO post_counselor (
          member_id, title, content, specialty, traits, bio,
          headline, hashtag1, hashtag2, intro
        ) VALUES (
          ${memberId}, ${title}, ${input.profile_notice ?? null},
          ${specialtyText}, ${traits}, ${input.profile_bio ?? null},
          ${input.profile_headline ?? null}, ${input.profile_hashtag1 ?? null}, ${input.profile_hashtag2 ?? null},
          ${input.profile_intro ?? null}
        )
      `;
      return;
    }

    // 기존 row 업데이트 — 들어온 필드만 갱신
    const updates: Record<string, unknown> = {};
    if (input.nickname !== undefined) updates.title = input.nickname;
    if (input.profile_notice !== undefined) updates.content = input.profile_notice;
    if (input.profile_specialty !== undefined) updates.specialty = specialtyText;
    if (input.profile_traits !== undefined) updates.traits = traits;
    if (input.profile_bio !== undefined) updates.bio = input.profile_bio;
    if (input.profile_headline !== undefined) updates.headline = input.profile_headline;
    if (input.profile_hashtag1 !== undefined) updates.hashtag1 = input.profile_hashtag1;
    if (input.profile_hashtag2 !== undefined) updates.hashtag2 = input.profile_hashtag2;
    if (input.profile_intro !== undefined) updates.intro = input.profile_intro;
    if (input.event_starts_at !== undefined) updates.event_starts_at = input.event_starts_at || null;
    if (input.event_ends_at !== undefined) updates.event_ends_at = input.event_ends_at || null;
    if (input.event_banner_image_url !== undefined) updates.event_banner_image_url = input.event_banner_image_url || null;
    if (input.wide_headline !== undefined) updates.wide_headline = input.wide_headline || null;
    if (input.wide_subcaption !== undefined) updates.wide_subcaption = input.wide_subcaption || null;
    if (input.is_exclusive !== undefined) updates.is_exclusive = input.is_exclusive;
    if (Object.keys(updates).length === 0) return;

    // 이벤트 상담사 동시 3명 제한 체크 (신규 등록 시만 — event_starts_at이 새로 설정될 때)
    if (input.event_starts_at) {
      const startsAt = input.event_starts_at;
      const endsAt = input.event_ends_at || null;
      const conflictRows = await this.sql<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt
          FROM post_counselor
         WHERE member_id <> ${memberId}
           AND event_starts_at IS NOT NULL
           AND event_starts_at <= ${endsAt ?? '9999-12-31'}::timestamptz
           AND (event_ends_at IS NULL OR event_ends_at > ${startsAt}::timestamptz)
      `;
      const conflictCount = Number(conflictRows[0]?.cnt ?? 0);
      if (conflictCount >= 3) {
        throw new Error('이벤트 상담사는 동시에 최대 3명까지만 등록할 수 있습니다.');
      }
    }

    await this.sql`UPDATE post_counselor SET ${this.sql(updates)}, updated_at = now() WHERE member_id = ${memberId}`;
  }

  // 회원 첨부파일 추가 — kind: 'contract'(계약서) / 'profile'(프로필사진) / 'thumbnail' 등
  async addMemberFile(
    memberId: number,
    kind: string,
    file: {
      originalname: string;
      filename: string;
      size: number;
      mimetype: string;
      stored_name_webp?: string | null;
    },
  ): Promise<{
    id: number;
    stored_name: string;
    stored_name_webp: string | null;
    kind: string;
    source_name: string;
  }> {
    const exists = await this.sql<{ id: number }[]>`SELECT id FROM member WHERE id = ${memberId}`;
    if (exists.length === 0) throw new NotFoundException('회원을 찾을 수 없습니다.');

    // 단일 슬롯(profile, wide)인 경우 기존 row + 파일 교체
    if (kind === 'profile' || kind === 'wide') {
      await this.sql`DELETE FROM member_file WHERE member_id = ${memberId} AND kind = ${kind}`;
    }

    const next = await this.sql<{ next_no: number }[]>`
      SELECT COALESCE(MAX(no), -1) + 1 AS next_no FROM member_file WHERE member_id = ${memberId}
    `;
    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO member_file (
        member_id, no, kind, source_name, stored_name, stored_name_webp, filesize, file_type
      ) VALUES (
        ${memberId}, ${next[0].next_no}, ${kind},
        ${file.originalname}, ${file.filename}, ${file.stored_name_webp ?? null}, ${file.size},
        ${file.mimetype.startsWith('image/') ? 1 : 0}
      )
      RETURNING id
    `;
    return {
      id: inserted[0].id,
      stored_name: file.filename,
      stored_name_webp: file.stored_name_webp ?? null,
      kind,
      source_name: file.originalname,
    };
  }

  async deleteMemberFile(
    memberId: number,
    fileId: number,
  ): Promise<{ stored_name: string | null; stored_name_webp: string | null }> {
    const rows = await this.sql<{ stored_name: string; stored_name_webp: string | null }[]>`
      DELETE FROM member_file WHERE id = ${fileId} AND member_id = ${memberId}
      RETURNING stored_name, stored_name_webp
    `;
    return {
      stored_name: rows[0]?.stored_name ?? null,
      stored_name_webp: rows[0]?.stored_name_webp ?? null,
    };
  }

  // m2net 단독 연동 (csrid 발급 / 재연동) — 폼의 [엠투넷 연동하기] 버튼이 호출.
  //   - csrid 가 이미 있으면 PUT /csr-mgr/{csrid} 로 기존 레코드 갱신 (M2NET 중복등록 방지)
  //   - csrid 가 없으면 POST /csr-mgr/{cpid} 로 신규 발급 — 응답 csrid 를 DB 저장
  async linkCounselorToM2net(id: number): Promise<{ ok: boolean; csrid: string | null; error?: string }> {
    const rows = await this.sql<{
      id: number; nickname: string; dtmfno: string | null; telno: string | null;
      counselor_priority: number | null; call_unit_seconds: number | null;
      call_070_unit_cost: number | null; chat_unit_seconds: number | null;
      chat_unit_cost: number | null; preflag: 'P' | 'Y' | null; state: string;
      role: string; csrid: string | null;
    }[]>`
      SELECT id, nickname, dtmfno, telno, counselor_priority,
             call_unit_seconds, call_070_unit_cost, chat_unit_seconds, chat_unit_cost,
             preflag, state, role, csrid
        FROM member WHERE id = ${id}
    `;
    if (rows.length === 0 || rows[0].role !== 'counselor') {
      throw new NotFoundException('상담사를 찾을 수 없습니다.');
    }
    if (!this.m2net.isEnabled()) {
      return { ok: false, csrid: null, error: 'M2NET 환경변수 미설정' };
    }
    const m = rows[0];
    // dtmfno 빈값 비허용 — DB 에 비어있으면 1부터 비어있는 번호로 자동 부여하고 DB 도 동시에 채움.
    let dtmfnoFinal = (m.dtmfno ?? '').replace(/[^0-9]/g, '');
    if (!dtmfnoFinal) {
      dtmfnoFinal = await this.nextAvailableDtmfno(id);
      await this.sql`UPDATE member SET dtmfno = ${dtmfnoFinal} WHERE id = ${id}`;
    }
    const payload = {
      csrnm: m.nickname,
      state: m.state || 'IDLE',
      sortno: m.counselor_priority ?? 1,
      dtmfno: dtmfnoFinal,
      telno: m.telno ?? '',
      dectm: m.call_unit_seconds ?? 30,
      decamt: m.call_070_unit_cost ?? 0,
      preflag: (m.preflag ?? 'P') as 'P' | 'Y' | '',
      chatdectm: m.chat_unit_seconds ?? 30,
      chatdecamt: m.chat_unit_cost ?? 0,
    };

    // 이미 csrid 가 발급된 상태면 PUT 으로 갱신 (M2NET req_result=25 중복등록 방지)
    if (m.csrid) {
      // sample/adm/member_form_update.php:474,487 동등 — PUT 시에도 dtmfno 포함.
      // dtmfno 는 회원이 통화 연결 시 입력하는 상담사 식별 번호 (자유 입력, 빈값 허용).
      // 변경 시 M2NET·AG9 쪽에도 반영되어야 콜백/연결 매칭이 일관성 있게 동작함.
      const upd = await this.m2net.updateCounselorFull(m.csrid, payload);
      if (upd.ok) {
        await this.m2net.updateCounselorState(m.csrid, payload.state);
        return { ok: true, csrid: m.csrid };
      }
      // req_result=23 (ID not found) — DB 의 csrid 가 M2NET 에 존재하지 않음.
      // (M2NET DB 리셋·수동입력·테스트값 등). POST 로 신규 등록 폴백.
      const code = String(upd.raw?.req_result ?? '');
      if (code === '23') {
        const reg = await this.m2net.registerCounselor(payload);
        if (reg.ok && reg.csrid) {
          await this.sql`UPDATE member SET csrid = ${reg.csrid} WHERE id = ${id}`;
          await this.m2net.updateCounselorState(reg.csrid, payload.state);
          return { ok: true, csrid: reg.csrid };
        }
        return { ok: false, csrid: null, error: reg.error ?? '신규 등록 실패' };
      }
      return { ok: false, csrid: m.csrid, error: upd.error ?? '알 수 없음' };
    }

    // 최초 등록 — POST 로 신규 csrid 발급
    const result = await this.m2net.registerCounselor(payload);
    if (result.ok && result.csrid) {
      await this.sql`UPDATE member SET csrid = ${result.csrid} WHERE id = ${id}`;
      await this.m2net.updateCounselorState(result.csrid, payload.state);
      return { ok: true, csrid: result.csrid };
    }
    return { ok: false, csrid: null, error: result.error ?? '알 수 없음' };
  }

  // ─────────────────────────────────────────────
  // 상담사 수정 — 들어온 필드만 동적 업데이트
  // ─────────────────────────────────────────────
  async updateCounselor(id: number, input: Partial<CounselorInput>): Promise<{ id: number; m2net?: { csr_mgr?: { ok: boolean; error?: string }; csrstat?: { ok: boolean; error?: string } } }> {
    const exists = await this.sql<{
      id: number; role: string; csrid: string | null; state: string;
      use_phone: boolean; use_chat: boolean;
    }[]>`
      SELECT id, role, csrid, state, use_phone, use_chat FROM member WHERE id = ${id}
    `;
    if (exists.length === 0 || exists[0].role !== 'counselor') {
      throw new NotFoundException('상담사를 찾을 수 없습니다.');
    }
    const before = exists[0];

    const updates: Record<string, unknown> = {};
    const setIf = <K extends keyof CounselorInput>(k: K, alias?: string) => {
      if (input[k] !== undefined) updates[alias ?? k] = input[k] as unknown;
    };
    setIf('name');
    setIf('nickname');
    setIf('email');
    setIf('gender');
    setIf('counselor_category');
    // dtmfno: 빈값 비허용. 입력이 명시되었지만 비어있으면 1부터 비어있는 번호로 자동 부여.
    if (input.dtmfno !== undefined) {
      const cleaned = (input.dtmfno ?? '').replace(/[^0-9]/g, '');
      updates.dtmfno = cleaned || (await this.nextAvailableDtmfno(id));
    }
    setIf('csrid');
    setIf('counselor_priority');
    // ★ unit_seconds 는 30초 고정 정책 (2026-06-12). 입력값 무시하고 항상 30 강제 —
    //   사용자 화면이 단가를 "30초당 N원"으로 표시(unit_seconds 미사용)하므로 30 외 값이면 표시가 어긋난다.
    setIf('call_070_unit_cost');
    setIf('call_060_unit_cost');
    setIf('chat_unit_cost');
    updates.call_unit_seconds = 30;
    updates.chat_unit_seconds = 30;
    setIf('preflag');
    setIf('paid_royalty_pct');
    setIf('free_royalty_pct');
    setIf('bank_name');
    setIf('bank_holder');
    setIf('bank_account');
    setIf('use_phone');
    setIf('use_chat');
    setIf('is_rising');
    setIf('is_recommended');
    setIf('admin_memo');
    // [2026-06-12 긴급] 마스킹 방어 — 상담사 수정 경로에도 회원 수정(680~688)과 동일 가드 추가.
    //   누락 시 마스킹값(010-****-3004)이 \D 제거되어 phone 7자리(0103004)로 영구 손실 → m2net
    //   상담사 연결번호까지 손상되어 전화 라우팅 전면 장애가 발생했다(상담사 13명 손상 사고).
    if (input.phone !== undefined) {
      if (input.phone && input.phone.includes('*')) {
        throw new BadRequestException('전화번호 마스킹 값입니다. 평문 표시 권한이 필요합니다.');
      }
      const pd = input.phone ? input.phone.replace(/[^0-9]/g, '') : '';
      if (input.phone && pd.length > 0 && pd.length < 10) {
        throw new BadRequestException(`전화번호는 10~11자리여야 합니다 (현재 ${pd.length}자리).`);
      }
      updates.phone = input.phone ? pd : null;
    }
    if (input.telno !== undefined) {
      if (input.telno && input.telno.includes('*')) {
        throw new BadRequestException('연결번호 마스킹 값입니다. 평문 표시 권한이 필요합니다.');
      }
      const td = input.telno ? input.telno.replace(/[^0-9]/g, '') : '';
      if (input.telno && td.length > 0 && td.length < 10) {
        throw new BadRequestException(`연결번호는 10~11자리여야 합니다 (현재 ${td.length}자리).`);
      }
      updates.telno = input.telno ? td : null;
    }
    if (input.password) updates.password = await bcrypt.hash(input.password, 10);

    // ── state 결정: sample/adm/member_form_update.php:14-22, 169-199 동등 ──
    // 매트릭스: phone+chat → RDVC / phone-only → IDLE / chat-only → RDCH / 둘 다 N → ABSE
    // 입력 state 가 ABSE/CONN/RESV/CRDY 면 그대로, 그 외(IDLE 포함) 는 매트릭스로 도출.
    const usePhone = input.use_phone !== undefined ? !!input.use_phone : before.use_phone;
    const useChat = input.use_chat !== undefined ? !!input.use_chat : before.use_chat;
    const readyState = computeReadyState(usePhone, useChat);
    const requestedState = input.state !== undefined ? String(input.state) : before.state;
    const stateFinal: string =
      requestedState === 'ABSE' ||
      requestedState === 'CONN' ||
      requestedState === 'RESV' ||
      requestedState === 'CRDY'
        ? requestedState
        : readyState;
    updates.state = stateFinal;

    if (Object.keys(updates).length > 0) {
      await this.sql`UPDATE member SET ${this.sql(updates)}, updated_at = now() WHERE id = ${id}`;
    }

    // ── 프로필 (post_counselor) upsert ──
    await this.upsertCounselorProfile(id, input);

    // ── m2net 동기화 (sample/adm/member_form_update.php:381-413, 466-496, 558-565 동등) ──
    // 1) csrid 없으면 POST /csr-mgr/{cpid} 로 신규 발급 (저장 시 ag9 자동 등록)
    // 2) csrid 있으면 PUT 으로 풀 레코드 갱신
    // 3) chat-mgr csrstat — 즉시 상태 반영
    const m2netResult: {
      csr_mgr?: { ok: boolean; error?: string };
      csrstat?: { ok: boolean; error?: string };
    } = {};

    if (this.m2net.isEnabled()) {
      // 변경 후 최종 값 — input 우선, 없으면 before 그대로
      const after = await this.sql<{
        nickname: string;
        dtmfno: string | null;
        telno: string | null;
        counselor_priority: number | null;
        call_unit_seconds: number | null;
        call_070_unit_cost: number | null;
        chat_unit_seconds: number | null;
        chat_unit_cost: number | null;
        preflag: 'P' | 'Y' | null;
      }[]>`
        SELECT nickname, dtmfno, telno, counselor_priority,
               call_unit_seconds, call_070_unit_cost,
               chat_unit_seconds, chat_unit_cost, preflag
          FROM member WHERE id = ${id}
      `;
      const a = after[0];
      // sample/adm/member_form_update.php:474,487 동등 — PUT 시에도 dtmfno 포함.
      // dtmfno 는 회원이 통화 연결 시 입력하는 상담사 식별 번호 (자유 입력, 빈값 허용).
      // 변경 시 M2NET·AG9 쪽에도 반영되어야 콜백/연결 매칭이 일관성 있게 동작함.
      const csrMgrPayload = {
        csrnm: a.nickname,
        state: stateFinal,
        sortno: a.counselor_priority ?? 1,
        dtmfno: a.dtmfno ?? '',
        telno: a.telno ?? '',
        dectm: a.call_unit_seconds ?? 30,
        decamt: a.call_070_unit_cost ?? 0,
        preflag: (a.preflag ?? 'P') as 'P' | 'Y' | '',
        chatdectm: a.chat_unit_seconds ?? 30,
        chatdecamt: a.chat_unit_cost ?? 0,
      };
      // csrid 가 이미 있으면 PUT, 없으면 POST 신규 발급 — 저장 시 ag9 자동 등록
      if (before.csrid) {
        const r1 = await this.m2net.updateCounselorFull(before.csrid, csrMgrPayload);
        // req_result=23 (ID not found) → POST 신규 등록 폴백.
        // DB 의 csrid 가 M2NET 에 존재하지 않는 케이스 (M2NET DB 리셋·수동입력·테스트값 등).
        if (!r1.ok && String(r1.raw?.req_result ?? '') === '23') {
          const reg = await this.m2net.registerCounselor(csrMgrPayload);
          m2netResult.csr_mgr = { ok: reg.ok, error: reg.error };
          if (reg.ok && reg.csrid) {
            await this.sql`UPDATE member SET csrid = ${reg.csrid} WHERE id = ${id}`;
            const r2 = await this.m2net.updateCounselorState(reg.csrid, stateFinal);
            m2netResult.csrstat = { ok: r2.ok, error: r2.error };
          }
        } else {
          m2netResult.csr_mgr = { ok: r1.ok, error: r1.error };
          if (r1.ok) {
            const r2 = await this.m2net.updateCounselorState(before.csrid, stateFinal);
            m2netResult.csrstat = { ok: r2.ok, error: r2.error };
          }
        }
      } else {
        const r1 = await this.m2net.registerCounselor(csrMgrPayload);
        m2netResult.csr_mgr = { ok: r1.ok, error: r1.error };
        if (r1.ok && r1.csrid) {
          await this.sql`UPDATE member SET csrid = ${r1.csrid} WHERE id = ${id}`;
          const r2 = await this.m2net.updateCounselorState(r1.csrid, stateFinal);
          m2netResult.csrstat = { ok: r2.ok, error: r2.error };
        }
      }
    }

    return { id, m2net: m2netResult };
  }

  // ─────────────────────────────────────────────
  // 포인트 정합성 점검 (운영 진단용)
  // ─────────────────────────────────────────────
  //
  // 회원 1명에 대해 다음을 한 페이지에 모아 반환:
  //   - member.point / point.{free_balance,paid_balance,total_earned,total_used}
  //   - point_history 합계 (재계산)
  //   - consultation 합계 (member_id 기준)
  //   - m2net 측 실제 잔액 (member.csrid 가 있을 때) — sajumoon ↔ m2net 차이 계산
  //   - 최근 point_history 30행 / 최근 consultation 20건
  //
  // 사용: GET /admin/members/audit-points?mb_id=ubuub1234
  //       채팅·통화 재테스트 후 다시 호출해 변화를 비교.
  async auditPoints(mbId: string): Promise<{
    member: {
      id: number; mb_id: string | null; name: string; nickname: string | null;
      role: string; csrid: string | null; point: number; created_at: Date;
    };
    point: {
      free_balance: number; paid_balance: number; earning_balance: number; total: number;
      total_earned: number; total_used: number;
      matches_member_point: boolean;
    } | null;
    point_history_agg: {
      rows: number; sum_earn: number; sum_use: number; computed_balance: number;
      matches_member_point: boolean;
    };
    consultation_agg: {
      rows: number; sum_amt: number; sum_amt_free: number; sum_amt_pro: number;
    };
    history_consult_agg: {
      rows: number; sum_use: number; matches_consultation_amt: boolean;
    };
    m2net: { ok: boolean; amt: number | null; diff: number | null; error?: string };
    recent_history: Array<{
      id: number; content: string | null;
      earn_point: number; use_point: number; balance_after: number;
      rel_table: string | null; rel_id: string | null; rel_action: string | null;
      created_at: Date;
    }>;
    recent_consultation: Array<{
      id: number; reason: string; amt: number; amt_free: number; amt_pro: number;
      usetm: number; roomid: string | null; started_at: Date | null;
      ended_at: Date | null; created_at: Date;
    }>;
  }> {
    if (!mbId) throw new BadRequestException('mb_id 가 필요합니다.');

    const memberRows = await this.sql<{
      id: number; mb_id: string | null; name: string; nickname: string | null;
      role: string; csrid: string | null; point: number; created_at: Date;
    }[]>`
      SELECT id, mb_id, name, nickname, role, csrid, point, created_at
        FROM member WHERE mb_id = ${mbId} LIMIT 1
    `;
    if (memberRows.length === 0) throw new NotFoundException('회원을 찾을 수 없습니다.');
    const member = memberRows[0];

    const ptRows = await this.sql<{
      free_balance: number; paid_balance: number; earning_balance: number;
      total_earned: string; total_used: string;
    }[]>`
      SELECT free_balance, paid_balance, earning_balance,
             total_earned::text, total_used::text
        FROM point WHERE member_id = ${member.id}
    `;
    const point = ptRows.length === 0 ? null : {
      free_balance: Number(ptRows[0].free_balance) || 0,
      paid_balance: Number(ptRows[0].paid_balance) || 0,
      earning_balance: Number(ptRows[0].earning_balance) || 0,
      total: (Number(ptRows[0].free_balance) || 0) + (Number(ptRows[0].paid_balance) || 0),
      total_earned: Number(ptRows[0].total_earned) || 0,
      total_used: Number(ptRows[0].total_used) || 0,
      matches_member_point:
        (Number(ptRows[0].free_balance) || 0) + (Number(ptRows[0].paid_balance) || 0)
          === Number(member.point),
    };

    const phAgg = await this.sql<{ rows: string; sum_earn: string; sum_use: string }[]>`
      SELECT COUNT(*)::text                       AS rows,
             COALESCE(SUM(earn_point),0)::text    AS sum_earn,
             COALESCE(SUM(use_point),0)::text     AS sum_use
        FROM point_history WHERE member_id = ${member.id}
    `;
    const sumEarn = Number(phAgg[0].sum_earn);
    const sumUse = Number(phAgg[0].sum_use);

    const csAgg = await this.sql<{
      rows: string; sum_amt: string; sum_amt_free: string; sum_amt_pro: string;
    }[]>`
      SELECT COUNT(*)::text                       AS rows,
             COALESCE(SUM(amt),0)::text           AS sum_amt,
             COALESCE(SUM(amt_free),0)::text      AS sum_amt_free,
             COALESCE(SUM(amt_pro),0)::text       AS sum_amt_pro
        FROM consultation
       WHERE member_id = ${member.id} AND amt > 0
    `;

    const phConsultAgg = await this.sql<{ rows: string; sum_use: string }[]>`
      SELECT COUNT(*)::text AS rows, COALESCE(SUM(use_point),0)::text AS sum_use
        FROM point_history
       WHERE member_id = ${member.id}
         AND rel_table = 'consultation'
         AND use_point > 0
    `;

    // m2net 잔액 조회 (선택)
    let m2net: { ok: boolean; amt: number | null; diff: number | null; error?: string } = {
      ok: false, amt: null, diff: null, error: 'csrid 없음',
    };
    if (member.csrid && this.m2net.isEnabled()) {
      const r = await this.m2net.getMemberByMembid(member.csrid);
      if (r.ok && typeof r.amt === 'number') {
        m2net = { ok: true, amt: r.amt, diff: Number(member.point) - r.amt };
      } else {
        m2net = { ok: false, amt: null, diff: null, error: r.error ?? '응답 없음' };
      }
    }

    const recentHistory = await this.sql<{
      id: number; content: string | null; earn_point: number; use_point: number;
      balance_after: number; rel_table: string | null; rel_id: string | null;
      rel_action: string | null; created_at: Date;
    }[]>`
      SELECT id, content, earn_point, use_point, balance_after,
             rel_table, rel_id, rel_action, created_at
        FROM point_history
       WHERE member_id = ${member.id}
       ORDER BY created_at DESC, id DESC
       LIMIT 30
    `;

    const recentConsult = await this.sql<{
      id: number; reason: string; amt: number; amt_free: number; amt_pro: number;
      usetm: number; roomid: string | null; started_at: Date | null;
      ended_at: Date | null; created_at: Date;
    }[]>`
      SELECT id, reason, amt, amt_free, amt_pro, usetm, roomid,
             started_at, ended_at, created_at
        FROM consultation
       WHERE member_id = ${member.id}
       ORDER BY created_at DESC
       LIMIT 20
    `;

    return {
      member,
      point,
      point_history_agg: {
        rows: Number(phAgg[0].rows),
        sum_earn: sumEarn,
        sum_use: sumUse,
        computed_balance: sumEarn - sumUse,
        matches_member_point: sumEarn - sumUse === Number(member.point),
      },
      consultation_agg: {
        rows: Number(csAgg[0].rows),
        sum_amt: Number(csAgg[0].sum_amt),
        sum_amt_free: Number(csAgg[0].sum_amt_free),
        sum_amt_pro: Number(csAgg[0].sum_amt_pro),
      },
      history_consult_agg: {
        rows: Number(phConsultAgg[0].rows),
        sum_use: Number(phConsultAgg[0].sum_use),
        matches_consultation_amt:
          Number(phConsultAgg[0].sum_use) === Number(csAgg[0].sum_amt),
      },
      m2net,
      recent_history: recentHistory,
      recent_consultation: recentConsult,
    };
  }

  // ─────────────────────────────────────────────
  // 상담사 차단 관리 — 특정 회원에게 상담사가 노출되지 않도록
  // ─────────────────────────────────────────────

  async listBlocks(counselorId: number): Promise<Array<{
    id: number;
    member_id: number;
    member_mb_id: string | null;
    member_name: string | null;
    member_phone: string | null;
    reason: string | null;
    blocked_by_admin_id: number | null;
    blocked_by_mb_id: string | null;
    created_at: string;
  }>> {
    const rows = await this.sql<{
      id: number;
      member_id: number;
      member_mb_id: string | null;
      member_name: string | null;
      member_phone: string | null;
      reason: string | null;
      blocked_by_admin_id: number | null;
      blocked_by_mb_id: string | null;
      created_at: Date;
    }[]>`
      SELECT cb.id, cb.member_id,
             m.mb_id AS member_mb_id, m.name AS member_name, m.phone AS member_phone,
             cb.reason, cb.blocked_by_admin_id,
             a.mb_id AS blocked_by_mb_id,
             cb.created_at
        FROM counselor_block cb
        LEFT JOIN member m ON m.id = cb.member_id
        LEFT JOIN member a ON a.id = cb.blocked_by_admin_id
       WHERE cb.counselor_id = ${counselorId}
       ORDER BY cb.created_at DESC
    `;
    return rows.map(r => ({
      id: Number(r.id),
      member_id: Number(r.member_id),
      member_mb_id: r.member_mb_id,
      member_name: r.member_name,
      member_phone: r.member_phone,
      reason: r.reason,
      blocked_by_admin_id: r.blocked_by_admin_id ? Number(r.blocked_by_admin_id) : null,
      blocked_by_mb_id: r.blocked_by_mb_id,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }

  async addBlock(counselorId: number, params: {
    memberPhone?: string;
    memberId?: number;
    reason?: string;
    adminId: number;
  }): Promise<{ id: number; member_id: number; member_mb_id: string | null }> {
    let memberId = params.memberId;
    if (!memberId && params.memberPhone) {
      const phone = params.memberPhone.replace(/[^0-9]/g, '');
      const rows = await this.sql<{ id: number }[]>`
        SELECT id FROM member
         WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ${phone}
           AND left_at IS NULL
         LIMIT 1
      `;
      if (rows.length === 0) throw new NotFoundException(`휴대폰 ${params.memberPhone} 로 가입된 회원을 찾을 수 없습니다.`);
      memberId = Number(rows[0].id);
    }
    if (!memberId) throw new BadRequestException('member_id 또는 member_phone 을 입력해주세요.');
    if (Number(memberId) === Number(counselorId)) throw new BadRequestException('상담사 본인을 차단할 수 없습니다.');

    const mbRow = await this.sql<{ mb_id: string | null }[]>`SELECT mb_id FROM member WHERE id = ${memberId} LIMIT 1`;
    if (!mbRow.length) throw new NotFoundException('회원을 찾을 수 없습니다.');

    await this.sql`
      INSERT INTO counselor_block (counselor_id, member_id, blocked_by_admin_id, reason)
      VALUES (${counselorId}, ${memberId}, ${params.adminId}, ${params.reason ?? null})
      ON CONFLICT (counselor_id, member_id) DO UPDATE SET reason = EXCLUDED.reason, blocked_by_admin_id = EXCLUDED.blocked_by_admin_id
    `;
    const row = await this.sql<{ id: number }[]>`SELECT id FROM counselor_block WHERE counselor_id=${counselorId} AND member_id=${memberId} LIMIT 1`;
    return { id: Number(row[0].id), member_id: memberId, member_mb_id: mbRow[0].mb_id };
  }

  async removeBlock(counselorId: number, memberId: number): Promise<void> {
    const result = await this.sql`
      DELETE FROM counselor_block WHERE counselor_id = ${counselorId} AND member_id = ${memberId}
    `;
    if (!result.count) throw new NotFoundException('차단 기록을 찾을 수 없습니다.');
  }
}

/**
 * sample/adm/member_form_update.php:14-22 의 get_counselor_ready_state() 와 1:1 동등.
 *  phone=Y, chat=Y → RDVC (전화+채팅 가능)
 *  phone=Y, chat=N → IDLE (전화상담가능)
 *  phone=N, chat=Y → RDCH (채팅상담가능)
 *  둘 다 N         → ABSE (부재중)
 */
function computeReadyState(usePhone: boolean, useChat: boolean): string {
  if (usePhone && useChat) return 'RDVC';
  if (usePhone && !useChat) return 'IDLE';
  if (!usePhone && useChat) return 'RDCH';
  return 'ABSE';
}
