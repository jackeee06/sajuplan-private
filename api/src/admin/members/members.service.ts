import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SQL, type Sql } from '../../shared/db/db.module';
import { M2netService } from '../../shared/m2net/m2net.service';

export interface MemberRow {
  id: number;
  login_id: string | null;
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
  login_id: string | null;
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
  login_id: string | null;
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
  // 첨부파일
  files: { id: number; kind: string | null; source_name: string; stored_name: string; filesize: number; created_at: Date }[];
  // 집계
  total_consult: string;
  total_usetm: string;
  this_month_070: string;
  this_month_060: string;
  last_month_070: string;
  last_month_060: string;
}

export interface ListFilter {
  q?: string;          // login_id/name/nickname/phone 통합 검색
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
  login_id?: string;
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
  login_id?: string;
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
}

@Injectable()
export class MembersService {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly m2net: M2netService,
  ) {}

  // ─────────────────────────────────────────────
  // 기본 조회 (기존 호환)
  // ─────────────────────────────────────────────
  async findAll(opts: { limit?: number; offset?: number; role?: string } = {}): Promise<MemberRow[]> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    if (opts.role) {
      return this.sql<MemberRow[]>`
        SELECT id, login_id, name, nickname, email, phone, role, level, point, state, created_at, last_login_at
        FROM member
        WHERE role = ${opts.role}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    return this.sql<MemberRow[]>`
      SELECT id, login_id, name, nickname, email, phone, role, level, point, state, created_at, last_login_at
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
      SELECT id, login_id, name, nickname, email, phone, role, level, point, state, created_at, last_login_at
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
        m.login_id ILIKE ${like}
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
        m.id, m.login_id, m.name, m.nickname, m.phone, m.gender, m.birth_date,
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
        m.id, m.login_id, m.name, m.nickname, m.phone, m.csrid, m.telno,
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
      SELECT m.id, m.login_id, m.name, m.nickname, m.email, m.phone, m.gender, m.birth_date,
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
    if (!input.login_id) throw new BadRequestException('login_id는 필수입니다.');
    if (!input.password) throw new BadRequestException('password는 필수입니다.');
    if (!input.name) throw new BadRequestException('이름은 필수입니다.');

    const exists = await this.sql<{ id: number }[]>`SELECT id FROM member WHERE login_id = ${input.login_id} LIMIT 1`;
    if (exists.length > 0) throw new ConflictException('이미 사용 중인 아이디입니다.');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const phone = input.phone ? input.phone.replace(/[^0-9]/g, '') : null;

    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO member (
        login_id, password, name, nickname, email, phone, gender, birth_date,
        role, level, point, acquisition_source,
        zip, addr1, addr2, addr_jibeon
      ) VALUES (
        ${input.login_id}, ${passwordHash}, ${input.name},
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
      SELECT m.id, m.login_id, m.name, m.nickname, m.email, m.phone, m.gender,
             m.csrid, m.dtmfno, m.telno,
             m.counselor_category, m.counselor_priority,
             m.call_unit_seconds, m.call_070_unit_cost, m.call_060_unit_cost,
             m.chat_unit_seconds, m.chat_unit_cost,
             m.preflag,
             m.paid_royalty_pct, m.free_royalty_pct,
             m.bank_name, m.bank_holder, m.bank_account,
             m.use_phone, m.use_chat,
             m.level, m.point, m.state, m.is_rising, m.admin_memo, m.created_at,
             p.headline                                 AS profile_headline,
             p.hashtag1                                 AS profile_hashtag1,
             p.hashtag2                                 AS profile_hashtag2,
             COALESCE(string_to_array(p.specialty, '|'), ARRAY[]::TEXT[]) AS profile_specialty,
             COALESCE(p.traits, ARRAY[]::TEXT[])        AS profile_traits,
             p.bio                                      AS profile_bio,
             p.content                                  AS profile_notice,
             p.intro                                    AS profile_intro,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'id', f.id, 'kind', f.kind, 'source_name', f.source_name,
                 'stored_name', f.stored_name, 'filesize', f.filesize, 'created_at', f.created_at
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
  // 상담사 생성 — m2net (passcall) csr-mgr 등록까지 포함
  // ─────────────────────────────────────────────
  async createCounselor(input: CounselorInput): Promise<{ id: number; csrid: string | null; m2net: { ok: boolean; error?: string } }> {
    if (!input.login_id) throw new BadRequestException('login_id는 필수입니다.');
    if (!input.password) throw new BadRequestException('password는 필수입니다.');
    if (!input.name) throw new BadRequestException('이름은 필수입니다.');
    if (!input.nickname) throw new BadRequestException('닉네임은 필수입니다.');

    // 중복 검사
    const existing = await this.sql<{ id: number }[]>`SELECT id FROM member WHERE login_id = ${input.login_id} LIMIT 1`;
    if (existing.length > 0) throw new ConflictException('이미 사용 중인 아이디입니다.');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const phone = input.phone ? input.phone.replace(/[^0-9]/g, '') : null;
    const telno = input.telno ? input.telno.replace(/[^0-9]/g, '') : null;
    const stateValue = input.state ?? 'IDLE';

    // 1) member insert (csrid 는 m2net 응답으로 추후 갱신)
    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO member (
        login_id, password, name, nickname, email, phone, gender,
        role, level, state, counselor_category,
        dtmfno, telno, counselor_priority,
        call_unit_seconds, call_070_unit_cost, call_060_unit_cost,
        chat_unit_seconds, chat_unit_cost, preflag,
        paid_royalty_pct, free_royalty_pct,
        bank_name, bank_holder, bank_account,
        use_phone, use_chat, is_rising
      ) VALUES (
        ${input.login_id}, ${passwordHash}, ${input.name}, ${input.nickname},
        ${input.email ?? null}, ${phone}, ${input.gender ?? null},
        'counselor', 5, ${stateValue}, ${input.counselor_category ?? null},
        ${input.dtmfno ?? null}, ${telno}, ${input.counselor_priority ?? null},
        ${input.call_unit_seconds ?? 30}, ${input.call_070_unit_cost ?? 0}, ${input.call_060_unit_cost ?? 0},
        ${input.chat_unit_seconds ?? 30}, ${input.chat_unit_cost ?? 0}, ${input.preflag ?? 'P'},
        ${input.paid_royalty_pct ?? null}, ${input.free_royalty_pct ?? null},
        ${input.bank_name ?? null}, ${input.bank_holder ?? null}, ${input.bank_account ?? null},
        ${input.use_phone ?? true}, ${input.use_chat ?? true}, ${input.is_rising ?? false}
      )
      RETURNING id
    `;
    const memberId = inserted[0].id;

    // 2) m2net csr-mgr POST (env 활성 + register_m2net !== false 일 때)
    let m2netCsrid: string | null = input.csrid ?? null;
    let m2netStatus = { ok: false, error: '미수행' };
    const shouldRegister = input.register_m2net !== false && this.m2net.isEnabled();
    if (shouldRegister) {
      const result = await this.m2net.registerCounselor({
        csrnm: input.nickname,
        state: stateValue,
        sortno: input.counselor_priority ?? 1,
        dtmfno: input.dtmfno ?? '',
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
      input.nickname !== undefined; // title은 nickname을 미러링
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
    if (Object.keys(updates).length === 0) return;
    await this.sql`UPDATE post_counselor SET ${this.sql(updates)}, updated_at = now() WHERE member_id = ${memberId}`;
  }

  // 회원 첨부파일 추가 — kind: 'contract'(계약서) / 'profile'(프로필사진) / 'thumbnail' 등
  async addMemberFile(
    memberId: number,
    kind: string,
    file: { originalname: string; filename: string; size: number; mimetype: string },
  ): Promise<{ id: number; stored_name: string; kind: string; source_name: string }> {
    const exists = await this.sql<{ id: number }[]>`SELECT id FROM member WHERE id = ${memberId}`;
    if (exists.length === 0) throw new NotFoundException('회원을 찾을 수 없습니다.');

    // 단일 슬롯(profile)인 경우 기존 row 교체
    if (kind === 'profile') {
      await this.sql`DELETE FROM member_file WHERE member_id = ${memberId} AND kind = 'profile'`;
    }

    const next = await this.sql<{ next_no: number }[]>`
      SELECT COALESCE(MAX(no), -1) + 1 AS next_no FROM member_file WHERE member_id = ${memberId}
    `;
    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO member_file (
        member_id, no, kind, source_name, stored_name, filesize, file_type
      ) VALUES (
        ${memberId}, ${next[0].next_no}, ${kind},
        ${file.originalname}, ${file.filename}, ${file.size},
        ${file.mimetype.startsWith('image/') ? 1 : 0}
      )
      RETURNING id
    `;
    return { id: inserted[0].id, stored_name: file.filename, kind, source_name: file.originalname };
  }

  async deleteMemberFile(memberId: number, fileId: number): Promise<{ stored_name: string | null }> {
    const rows = await this.sql<{ stored_name: string }[]>`
      DELETE FROM member_file WHERE id = ${fileId} AND member_id = ${memberId}
      RETURNING stored_name
    `;
    return { stored_name: rows[0]?.stored_name ?? null };
  }

  // m2net 단독 연동 (csrid 발급 / 재연동) — 폼의 [엠투넷 연동하기] 버튼이 호출
  async linkCounselorToM2net(id: number): Promise<{ ok: boolean; csrid: string | null; error?: string }> {
    const rows = await this.sql<{
      id: number; nickname: string; dtmfno: string | null; telno: string | null;
      counselor_priority: number | null; call_unit_seconds: number | null;
      call_070_unit_cost: number | null; chat_unit_seconds: number | null;
      chat_unit_cost: number | null; preflag: 'P' | 'Y' | null; state: string;
      role: string;
    }[]>`
      SELECT id, nickname, dtmfno, telno, counselor_priority,
             call_unit_seconds, call_070_unit_cost, chat_unit_seconds, chat_unit_cost,
             preflag, state, role
        FROM member WHERE id = ${id}
    `;
    if (rows.length === 0 || rows[0].role !== 'counselor') {
      throw new NotFoundException('상담사를 찾을 수 없습니다.');
    }
    if (!this.m2net.isEnabled()) {
      return { ok: false, csrid: null, error: 'M2NET 환경변수 미설정' };
    }
    const m = rows[0];
    const result = await this.m2net.registerCounselor({
      csrnm: m.nickname,
      state: m.state || 'IDLE',
      sortno: m.counselor_priority ?? 1,
      dtmfno: m.dtmfno ?? '',
      telno: m.telno ?? '',
      dectm: m.call_unit_seconds ?? 30,
      decamt: m.call_070_unit_cost ?? 0,
      preflag: (m.preflag ?? 'P') as 'P' | 'Y' | '',
      chatdectm: m.chat_unit_seconds ?? 30,
      chatdecamt: m.chat_unit_cost ?? 0,
    });
    if (result.ok && result.csrid) {
      await this.sql`UPDATE member SET csrid = ${result.csrid} WHERE id = ${id}`;
      return { ok: true, csrid: result.csrid };
    }
    return { ok: false, csrid: null, error: result.error ?? '알 수 없음' };
  }

  // ─────────────────────────────────────────────
  // 상담사 수정 — 들어온 필드만 동적 업데이트
  // ─────────────────────────────────────────────
  async updateCounselor(id: number, input: Partial<CounselorInput>): Promise<{ id: number; m2net?: { ok: boolean; error?: string } }> {
    const exists = await this.sql<{ id: number; role: string; csrid: string | null; state: string }[]>`
      SELECT id, role, csrid, state FROM member WHERE id = ${id}
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
    setIf('dtmfno');
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
    setIf('state');
    setIf('use_phone');
    setIf('use_chat');
    setIf('is_rising');
    setIf('admin_memo');
    if (input.phone !== undefined) updates.phone = input.phone ? input.phone.replace(/[^0-9]/g, '') : null;
    if (input.telno !== undefined) updates.telno = input.telno ? input.telno.replace(/[^0-9]/g, '') : null;
    if (input.password) updates.password = await bcrypt.hash(input.password, 10);

    if (Object.keys(updates).length > 0) {
      await this.sql`UPDATE member SET ${this.sql(updates)}, updated_at = now() WHERE id = ${id}`;
    }

    // ── 프로필 (post_counselor) upsert ──
    await this.upsertCounselorProfile(id, input);

    // ── m2net 상태 동기화 ──
    // state가 입력되어 실제로 바뀐 경우에만 chat-mgr/csrstat 호출.
    // csrid 없으면(엠투넷 미등록 상담사) skip.
    let m2netResult: { ok: boolean; error?: string } | undefined;
    if (
      input.state !== undefined &&
      input.state !== before.state &&
      before.csrid &&
      this.m2net.isEnabled()
    ) {
      const r = await this.m2net.updateCounselorState(before.csrid, String(input.state));
      m2netResult = { ok: r.ok, error: r.error };
    }

    return { id, m2net: m2netResult };
  }
}
