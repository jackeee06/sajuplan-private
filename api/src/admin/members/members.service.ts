import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SQL, type Sql } from '../../shared/db/db.module';
import { M2netService } from '../../shared/m2net/m2net.service';

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
  // 첨부파일
  files: { id: number; kind: string | null; source_name: string; stored_name: string; stored_name_webp: string | null; filesize: number; created_at: Date }[];
  // 집계
  total_consult: string;
  total_usetm: string;
  this_month_070: string;
  this_month_060: string;
  last_month_070: string;
  last_month_060: string;
}

export interface ListFilter {
  q?: string;          // mb_id/name/nickname/phone 통합 검색
  fr_date?: string;    // 가입일 시작
  to_date?: string;    // 가입일 종료
  status?: 'all' | 'active' | 'left' | 'blocked';
  state?: string;      // 상담사 상태(IDLE/CONN/...)
  category?: string;   // 상담사 분야(타로/신점/사주/심리)
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
  async findAll(opts: { limit?: number; offset?: number; role?: string } = {}): Promise<MemberRow[]> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    if (opts.role) {
      return this.sql<MemberRow[]>`
        SELECT id, mb_id, name, nickname, email, phone, role, level, point, state, created_at, last_login_at
        FROM member
        WHERE role = ${opts.role}
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
    return conds;
  }

  private joinWhere(conds: ReturnType<Sql>[]): ReturnType<Sql> {
    if (conds.length === 0) return this.sql``;
    return conds.reduce((acc, c, i) => i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`, this.sql``);
  }

  // ─────────────────────────────────────────────
  // 고객 리스트
  // ─────────────────────────────────────────────
  async findCustomers(f: ListFilter): Promise<{ items: CustomerRow[]; total: number; summary: { total: number; active: number; left: number; blocked: number } }> {
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

    return {
      items,
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
  async findCounselors(f: ListFilter): Promise<{
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
               SUM(CASE WHEN preflag = 'Y' THEN amt ELSE 0 END) AS amt_070,
               SUM(CASE WHEN preflag IS NULL OR preflag <> 'Y' THEN amt ELSE 0 END) AS amt_060
          FROM consultation
         WHERE ended_at >= date_trunc('month', CURRENT_DATE)
         GROUP BY counselor_id
      ),
      last_m AS (
        SELECT counselor_id,
               SUM(CASE WHEN preflag = 'Y' THEN amt ELSE 0 END) AS amt_070,
               SUM(CASE WHEN preflag IS NULL OR preflag <> 'Y' THEN amt ELSE 0 END) AS amt_060
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
        COALESCE(tc.cnt, 0)        AS total_consult,
        COALESCE(tc.total_sec, 0)  AS total_usetm,
        COALESCE(tm.amt_070, 0)    AS this_month_070,
        COALESCE(tm.amt_060, 0)    AS this_month_060,
        COALESCE(lm.amt_070, 0)    AS last_month_070,
        COALESCE(lm.amt_060, 0)    AS last_month_060
      FROM member m
      LEFT JOIN total_c tc ON tc.counselor_id = m.id
      LEFT JOIN this_m  tm ON tm.counselor_id = m.id
      LEFT JOIN last_m  lm ON lm.counselor_id = m.id
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

    return {
      items,
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

  // ─────────────────────────────────────────────
  // 고객 단건 조회 / 생성 / 수정
  // ─────────────────────────────────────────────
  async getCustomerDetail(id: number): Promise<CustomerRow> {
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
    return rows[0];
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
    if (input.phone !== undefined) updates.phone = input.phone ? input.phone.replace(/[^0-9]/g, '') : null;
    if (input.password) updates.password = await bcrypt.hash(input.password, 10);

    if (Object.keys(updates).length > 0) {
      await this.sql`UPDATE member SET ${this.sql(updates)}, updated_at = now() WHERE id = ${id}`;
    }
    return { id };
  }

  // ─────────────────────────────────────────────
  // 상담사 단건 조회 (상세/수정용 — 모든 컬럼)
  // ─────────────────────────────────────────────
  async getCounselorDetail(id: number): Promise<CounselorRow> {
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
             0::bigint AS this_month_070, 0::bigint AS this_month_060,
             0::bigint AS last_month_070, 0::bigint AS last_month_060
        FROM member m
   LEFT JOIN post_counselor p ON p.member_id = m.id
       WHERE m.id = ${id} AND m.role = 'counselor'
    `;
    if (rows.length === 0) throw new NotFoundException('상담사를 찾을 수 없습니다.');
    return rows[0];
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
  }): Promise<number> {
    if (!input.mb_id) throw new BadRequestException('mb_id는 필수입니다.');
    if (!input.password_hash) throw new BadRequestException('password_hash는 필수입니다.');

    const existing = await this.sql<{ id: number }[]>`SELECT id FROM member WHERE mb_id = ${input.mb_id} LIMIT 1`;
    if (existing.length > 0) throw new ConflictException('이미 사용 중인 아이디입니다.');

    const dtmfnoFinal = await this.nextAvailableDtmfno();
    const stateValue = 'IDLE';
    const telnoFinal = input.telno ? input.telno.replace(/[^0-9]/g, '') : null;

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
        30, 0, 0,
        30, 0, 'P',
        true, true, false
      )
      RETURNING id
    `;
    const memberId = inserted[0].id;

    // post_counselor 프로필 — 신청서의 intro/specialty 만 채움
    await this.upsertCounselorProfile(memberId, {
      profile_intro: input.profile_intro ?? undefined,
      profile_specialty: input.profile_specialty ?? undefined,
      nickname: input.nickname,
    });

    return memberId;
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
        ${input.call_unit_seconds ?? 30}, ${input.call_070_unit_cost ?? 0}, ${input.call_060_unit_cost ?? 0},
        ${input.chat_unit_seconds ?? 30}, ${input.chat_unit_cost ?? 0}, ${input.preflag ?? 'P'},
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
        dectm: input.call_unit_seconds ?? 30,
        decamt: input.call_070_unit_cost ?? 0,
        preflag: (input.preflag ?? 'P') as 'P' | 'Y' | '',
        chatdectm: input.chat_unit_seconds ?? 30,
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
      input.wide_subcaption !== undefined;
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
    setIf('call_unit_seconds');
    setIf('call_070_unit_cost');
    setIf('call_060_unit_cost');
    setIf('chat_unit_seconds');
    setIf('chat_unit_cost');
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
    if (input.phone !== undefined) updates.phone = input.phone ? input.phone.replace(/[^0-9]/g, '') : null;
    if (input.telno !== undefined) updates.telno = input.telno ? input.telno.replace(/[^0-9]/g, '') : null;
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
      free_balance: number; paid_balance: number; total: number;
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
      free_balance: number; paid_balance: number; total_earned: string; total_used: string;
    }[]>`
      SELECT free_balance, paid_balance, total_earned::text, total_used::text
        FROM point WHERE member_id = ${member.id}
    `;
    const point = ptRows.length === 0 ? null : {
      free_balance: Number(ptRows[0].free_balance) || 0,
      paid_balance: Number(ptRows[0].paid_balance) || 0,
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
