import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * sample/adm/coin_counsel_history.php 정확 매핑.
 *
 *   sample:                          신규:
 *   ─────────────────────────────────────────
 *   FROM platform_consulting         FROM consultation
 *   csrid                            consultation.csrid
 *   membid                           consultation.membid
 *   wr_datetime                      consultation.created_at
 *   start                            consultation.started_at
 *   end                              consultation.ended_at
 *   eventtm                          consultation.eventtm
 *   reason ('DISCONNECT'|'END_CHAT') consultation.reason
 *   preflag ('Y'|'')                 consultation.preflag
 *   no (PK 레거시)                   consultation.no
 *   from (고객 전화)                  consultation.caller_phone
 *
 *   get_csrid(csrid):                LEFT JOIN member c ON c.csrid = cs.csrid
 *     g5_member.mb_id  → c.mb_id
 *     g5_member.mb_nick → c.nickname
 *     g5_member.mb_4   → c.call_070_unit_cost  (환불 임계값)
 *     g5_write_counselor.ca_name → c.counselor_category (분야)
 *
 *   get_mbid(membid):                LEFT JOIN member m ON m.id = cs.member_id
 *     g5_member.mb_id  → m.mb_id
 *     g5_member.mb_name → m.name
 *     (회원 정보 없으면 caller_phone 폴백)
 *
 *   탭(view) 분류 — sample SQL 그대로:
 *     all : reason IN ('DISCONNECT','END_CHAT')
 *     call: reason = 'DISCONNECT'
 *     chat: reason = 'END_CHAT'
 *
 *   카운트 배지 — sample SQL 그대로:
 *     070  : reason='DISCONNECT' AND preflag='Y'
 *     060  : reason='DISCONNECT' AND preflag=''
 *     채팅: reason='END_CHAT'
 *
 *   검색 (sfl=...):
 *     mb_id   : 회원아이디 → m.mb_id 매칭
 *     cmb_id  : 상담사 아이디 → c.mb_id 매칭
 *     mb_hp   : 휴대폰번호 → cs.caller_phone (하이픈 제거 비교)
 *     mb_nick : 상담사닉네임 → c.nickname 매칭
 *     preflag : preflag='Y' (070) 또는 '' (060) 직접 비교
 */

export interface ConsultationRow {
  id: number;
  no: number | null;
  // 시각/식별자
  eventtm: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  csrid: string | null;
  membid: string | null;
  caller_phone: string | null;
  callee_phone: string | null;
  callid: string | null;
  roomid: string | null;
  // 상담 데이터
  reason: string | null;
  preflag: string | null;
  usetm: number;
  amt: number;
  amt_free: number;
  amt_pro: number;
  is_paid: boolean;
  is_settled: boolean;
  is_absent_disconnect: boolean;
  skip_charge: boolean;
  // JOIN: 회원
  member_id: number | null;
  member_mb_id: string | null;
  member_name: string | null;
  // JOIN: 상담사
  counselor_id: number | null;
  counselor_mb_id: string | null;
  counselor_name: string | null;
  counselor_nickname: string | null;
  counselor_category: string | null;
  // 통화 시점 등급/단가 스냅샷 (Phase 2 추가 — 분쟁 시 추적용)
  unit_cost_snapshot?: number | null;
  grade_at_session?: string | null;
  // 환불 (Phase 10)
  refunded_amount?: number;
  refund_status?: string | null;
  counselor_unit_cost: number | null; // mb_4
  // 차단 여부 (counselor_block)
  is_blocked: boolean;
  block_reason: string | null;
  // 수익 분해 (2026-06-02 / 2026-06-14 선결제 정확화)
  counselor_grade?: string | null;
  counselor_revenue_rate?: number | null;
  counselor_earning?: number;
  m2net_deduction?: number;      // baseAmt × (통신사% + 통신료%) — m2net 변동비
  sajuplan_revenue?: number;     // baseAmt × 영업이익률
  // [2026-06-14] 선결제(amt=0) 정확화. baseAmt = 종량제는 amt, 선결제는 m2net 실시간 실과금(mrtn).
  m2net_charge?: number | null;  // m2net 실시간 실과금 (mrtn.amt). 선결제 수익 계산 기준값.
  customer_paid?: number;        // 고객 지출 코인 (baseAmt) — 선결제는 실사용 m2net 과금 기준
  real_earning?: number | null;  // 내부 계산용 — point_history 실제 적립액
}

export type View = 'all' | 'call' | 'chat';

export type Sfl = 'mb_id' | 'cmb_id' | 'mb_hp' | 'mb_nick' | 'preflag';

export interface ConsultationFilter {
  view?: View;
  sfl?: Sfl;
  stx?: string;
  fr_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ConsultationsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** sample where_base + where_reason + sql_search_preflag 빌드 */
  private buildWhere(filter: ConsultationFilter, withReason: boolean) {
    const conds: ReturnType<Sql>[] = [];

    // sample: where_base = " where (1) and csrid !='' "
    conds.push(this.sql`cs.csrid IS NOT NULL AND cs.csrid <> ''`);

    // 검색 — 부분 매칭 (ILIKE %stx%)
    if (filter.stx) {
      const stx = filter.stx;
      const q = `%${stx}%`;
      switch (filter.sfl) {
        case 'mb_id':
          // 회원아이디 + 이름/닉네임도 함께 부분 매칭
          conds.push(this.sql`(m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR m.nickname ILIKE ${q})`);
          break;
        case 'cmb_id':
          // 상담사 아이디 + 이름/닉네임도 함께
          conds.push(this.sql`(c.mb_id ILIKE ${q} OR c.name ILIKE ${q} OR c.nickname ILIKE ${q})`);
          break;
        case 'mb_hp':
          // 휴대폰: 하이픈 제거 후 부분 매칭 (앞/뒤 % 모두)
          conds.push(
            this.sql`REGEXP_REPLACE(cs.caller_phone, '[^0-9]', '', 'g') ILIKE ${'%' + stx.replace(/[^0-9]/g, '') + '%'}`,
          );
          break;
        case 'mb_nick':
          // 상담사 닉네임 + 이름도 함께
          conds.push(this.sql`(c.nickname ILIKE ${q} OR c.name ILIKE ${q})`);
          break;
        case 'preflag':
          // 060/070 카운트 클릭 시 (sql_search_preflag) — 정확 비교
          conds.push(this.sql`cs.preflag = ${stx}`);
          break;
        default:
          // 전체 검색
          conds.push(this.sql`(
            m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR m.nickname ILIKE ${q}
            OR c.mb_id ILIKE ${q} OR c.nickname ILIKE ${q}
            OR cs.callid ILIKE ${q} OR cs.roomid ILIKE ${q}
          )`);
      }
    }

    // 기간 (sample: wr_datetime, 신규: created_at)
    if (filter.fr_date && filter.to_date) {
      conds.push(this.sql`cs.created_at BETWEEN ${filter.fr_date + ' 00:00:00'}::timestamptz AND ${filter.to_date + ' 23:59:59'}::timestamptz`);
    } else if (filter.fr_date) {
      conds.push(this.sql`cs.created_at >= ${filter.fr_date + ' 00:00:00'}::timestamptz`);
    } else if (filter.to_date) {
      conds.push(this.sql`cs.created_at <= ${filter.to_date + ' 23:59:59'}::timestamptz`);
    }

    // view에 따른 reason
    if (withReason) {
      const view = filter.view ?? 'all';
      if (view === 'call') {
        conds.push(this.sql`cs.reason = 'DISCONNECT'`);
      } else if (view === 'chat') {
        conds.push(this.sql`cs.reason = 'END_CHAT'`);
      } else {
        conds.push(this.sql`(cs.reason = 'DISCONNECT' OR cs.reason = 'END_CHAT')`);
      }
    }

    return conds.reduce(
      (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`),
      this.sql``,
    );
  }

  async findAll(filter: ConsultationFilter, isSuper = false) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 20)));
    const offset = (page - 1) * limit;

    // m2net 변동비 요율 — profit_simulator_config 에서 읽음 (없으면 기본값 10%+5%=15%)
    const simRows = await this.sql<{ data: { m2net?: { telecom_rate?: number; phone_call_rate?: number } } }[]>`
      SELECT data FROM profit_simulator_config ORDER BY updated_at DESC LIMIT 1
    `;
    const simCfg = simRows[0]?.data?.m2net ?? {};
    const telecomRate = (simCfg.telecom_rate ?? 10) / 100;
    const phoneRate   = (simCfg.phone_call_rate ?? 5)  / 100;
    const m2netRate   = telecomRate + phoneRate; // 0.15 (기본)

    const whereClause = this.buildWhere(filter, true);

    const items = await this.sql<ConsultationRow[]>`
      SELECT
        cs.id, cs.no,
        cs.eventtm, cs.started_at, cs.ended_at, cs.created_at,
        cs.csrid, cs.membid, cs.caller_phone, cs.callee_phone, cs.callid, cs.roomid,
        cs.reason, cs.preflag, cs.usetm, cs.amt, cs.amt_free, cs.amt_pro,
        cs.is_paid, cs.is_settled, cs.is_absent_disconnect, cs.skip_charge,
        cs.member_id, cs.counselor_id,
        m.mb_id AS member_mb_id, m.name AS member_name,
        c.mb_id AS counselor_mb_id, c.name AS counselor_name,
        c.nickname AS counselor_nickname,
        c.counselor_category AS counselor_category,
        c.call_070_unit_cost AS counselor_unit_cost,
        c.grade AS counselor_grade,
        -- 등급별 수익률 (setting 테이블 subquery — 행 수 적어 성능 무관)
        (SELECT NULLIF(s.value,'')::numeric
           FROM setting s
          WHERE s.namespace='grade' AND s.key = 'revenue_rate.' || COALESCE(c.grade,'')
          LIMIT 1
        ) AS counselor_revenue_rate,
        -- [2026-06-14] m2net 실시간 실과금 (선결제는 consultation.amt=0 이라 이 값이 진짜 기준)
        NULLIF(cs.mrtn::json->>'amt','')::int AS m2net_charge,
        -- [2026-06-14] 실제 적립된 상담사 수익금 (point_history 원장 — 선결제도 정확)
        (SELECT COALESCE(SUM(ph.earn_point - ph.use_point), 0)
           FROM point_history ph
          WHERE ph.rel_table='consultation' AND ph.rel_id = cs.id::text AND ph.balance_kind='earning'
        ) AS real_earning,
        -- 차단 여부
        (cb.id IS NOT NULL) AS is_blocked,
        cb.reason AS block_reason
      FROM consultation cs
      LEFT JOIN member m ON m.id = cs.member_id
      LEFT JOIN member c ON c.id = cs.counselor_id
      LEFT JOIN counselor_block cb ON cb.counselor_id = cs.counselor_id AND cb.member_id = cs.member_id
      ${whereClause}
      ORDER BY cs.created_at DESC, cs.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // 수익 분해 파생 컬럼 계산
    // 영업이익: 23% 일괄 적용 (관리자 레퍼런스용 근사치 — 고정비 포함 추정)
    const SAJUPLAN_OPERATING_RATE = 0.23;
    const enriched = items.map((row) => {
      const amt = Number(row.amt);  // BigInt/string 등 안전 변환
      // [2026-06-14] baseAmt = 기준 과금액. 종량제는 amt, 선결제(amt=0)는 m2net 실시간 실과금(mrtn).
      //   → 선결제도 종량제와 동일 공식으로 수익금/m2net차감/매출이 0 이 아닌 실제값으로 계산됨.
      const m2netCharge = row.m2net_charge != null ? Number(row.m2net_charge) : 0;
      const baseAmt = amt > 0 ? amt : (m2netCharge > 0 ? m2netCharge : 0);
      const rate = row.counselor_revenue_rate != null ? Number(row.counselor_revenue_rate) : null;
      const m2netDeduction = baseAmt > 0 ? Math.floor(baseAmt * m2netRate) : 0;
      // 상담사 수익금: 실제 적립(point_history) 우선 — 선결제 정확. 적립 없으면 baseAmt×요율 근사.
      const realEarn = row.real_earning != null ? Number(row.real_earning) : 0;
      const earning = realEarn > 0
        ? realEarn
        : (rate != null && baseAmt > 0 ? Math.floor(baseAmt * rate) : null);
      // 사주플랜매출(회사 매출 = 비밀 수치)은 슈퍼관리자에게만 노출 (비-슈퍼는 아예 미전송).
      const sajuplanRev = isSuper && baseAmt > 0 ? Math.floor(baseAmt * SAJUPLAN_OPERATING_RATE) : undefined;
      return {
        ...row,
        counselor_revenue_rate: rate,
        counselor_earning: earning ?? undefined,
        m2net_deduction: baseAmt > 0 ? m2netDeduction : undefined,
        sajuplan_revenue: sajuplanRev,
        m2net_charge: m2netCharge > 0 ? m2netCharge : null,
        customer_paid: baseAmt > 0 ? baseAmt : undefined,
      };
    });

    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt
      FROM consultation cs
      LEFT JOIN member m ON m.id = cs.member_id
      LEFT JOIN member c ON c.id = cs.counselor_id
      ${whereClause}
    `;

    // sample의 카운트 배지: where_base만 적용 + reason/preflag 분기
    // (검색/기간 조건은 적용하되 view/preflag는 무시 — 사용자가 다른 탭으로 이동해도 다른 탭 건수 정확히 보이게)
    const baseFilter: ConsultationFilter = {
      ...filter,
      view: undefined, // reason 분기 안 함
      sfl: filter.sfl === 'preflag' ? undefined : filter.sfl, // preflag 검색은 분기에서만 사용
      stx: filter.sfl === 'preflag' ? undefined : filter.stx,
    };
    const baseWhere = this.buildWhere(baseFilter, false);

    const summaryRows = await this.sql<{
      cnt_total: string;
      cnt_070: string;
      cnt_060: string;
      cnt_chat: string;
    }[]>`
      SELECT
        count(*) FILTER (WHERE cs.reason IN ('DISCONNECT','END_CHAT'))::text AS cnt_total,
        count(*) FILTER (WHERE cs.reason = 'DISCONNECT' AND cs.preflag = 'Y')::text AS cnt_070,
        count(*) FILTER (WHERE cs.reason = 'DISCONNECT' AND (cs.preflag = '' OR cs.preflag IS NULL))::text AS cnt_060,
        count(*) FILTER (WHERE cs.reason = 'END_CHAT')::text AS cnt_chat
      FROM consultation cs
      LEFT JOIN member m ON m.id = cs.member_id
      LEFT JOIN member c ON c.id = cs.counselor_id
      ${baseWhere}
    `;

    return {
      items: enriched,
      total: Number(totalRows[0].cnt),
      page,
      limit,
      summary: {
        cnt_total: Number(summaryRows[0].cnt_total),
        cnt_070: Number(summaryRows[0].cnt_070),
        cnt_060: Number(summaryRows[0].cnt_060),
        cnt_chat: Number(summaryRows[0].cnt_chat),
      },
    };
  }

  async getDetail(id: number) {
    const rows = await this.sql<ConsultationRow[]>`
      SELECT
        cs.id, cs.no,
        cs.eventtm, cs.started_at, cs.ended_at, cs.created_at,
        cs.csrid, cs.membid, cs.caller_phone, cs.callee_phone, cs.callid, cs.roomid,
        cs.reason, cs.preflag, cs.usetm, cs.amt, cs.amt_free, cs.amt_pro,
        cs.is_paid, cs.is_settled, cs.is_absent_disconnect, cs.skip_charge,
        cs.member_id, cs.counselor_id,
        cs.unit_cost_snapshot, cs.grade_at_session,
        cs.refunded_amount, cs.refund_status,
        m.mb_id AS member_mb_id, m.name AS member_name,
        c.mb_id AS counselor_mb_id, c.name AS counselor_name,
        c.nickname AS counselor_nickname,
        c.counselor_category AS counselor_category,
        c.call_070_unit_cost AS counselor_unit_cost
      FROM consultation cs
      LEFT JOIN member m ON m.id = cs.member_id
      LEFT JOIN member c ON c.id = cs.counselor_id
      WHERE cs.id = ${id}
      LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException('해당 상담을 찾을 수 없습니다.');
    }
    return rows[0];
  }
}
