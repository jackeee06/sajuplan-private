import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { SmsService } from '../../user/sms/sms.service';

/**
 * sample/adm/shop_admin/couponzonelist.php (메뉴 350520 "쿠폰존관리") 정확 매핑.
 *
 * 컬럼: 쿠폰이름 / 쿠폰종류(cz_type) / 적용대상(cp_method) / 포인트추가금액(cz_point + cp_type)
 *      / 쿠폰번호(cp_id) / 쿠폰사용기한(cz_period일) / 다운로드(cz_download) / 사용기한(cz_start~cz_end)
 *
 * 검색: cz_subject like '%stx%'
 */

export interface CouponZoneRow {
  id: number;
  cz_id: number | null;
  subject: string;
  cz_type: number;
  cp_method: number;
  cp_target: string | null;
  cz_point: number;
  cp_type: boolean;
  cp_id: string | null;
  cz_period: number;
  cz_download: number;
  cz_start: string | null;
  cz_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CouponZoneInput {
  subject: string;
  cz_type: number;
  cp_method: number;
  cp_target?: string | null;
  cz_point: number;
  cp_type?: boolean;
  cp_id?: string | null;
  cz_period?: number;
  cz_start?: string | null;
  cz_end?: string | null;
  is_active?: boolean;
  /**
   * 발급 대상 회원 ID 배열 — 다운로드쿠폰(cz_type=0) / 코드입력쿠폰(cz_type=3) 한정.
   * 빈 배열/undefined → 매핑 미설정(기존 사용자가 수동 다운로드).
   * coupon_zone_member 테이블에 (zone_id, member_id) 행으로 저장.
   */
  member_ids?: Array<number | string>;
}

export interface CouponZoneMemberRow {
  id: number;
  member_id: number;
  name: string;
  mb_id: string | null;
  phone: string | null;
  notified_at?: string | null;
}

@Injectable()
export class CouponZonesService {
  private readonly logger = new Logger(CouponZonesService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly sms: SmsService,
  ) {}

  async findAll(stx?: string, page = 1, limit = 20) {
    const safePage = Math.max(1, Math.trunc(page));
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
    const offset = (safePage - 1) * safeLimit;

    const whereClause = stx
      ? this.sql`WHERE subject ILIKE ${'%' + stx + '%'}`
      : this.sql``;

    const items = await this.sql<CouponZoneRow[]>`
      SELECT * FROM coupon_zone
      ${whereClause}
      ORDER BY id DESC
      LIMIT ${safeLimit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM coupon_zone ${whereClause}
    `;
    return { items, total: Number(totalRows[0].cnt), page: safePage, limit: safeLimit };
  }

  async getById(id: number): Promise<CouponZoneRow> {
    const rows = await this.sql<CouponZoneRow[]>`SELECT * FROM coupon_zone WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) throw new NotFoundException('쿠폰존을 찾을 수 없습니다.');
    return rows[0];
  }

  async create(input: CouponZoneInput) {
    if (!input.subject?.trim()) throw new BadRequestException('쿠폰이름은 필수입니다.');
    // 코드입력쿠폰은 발급 즉시 알림톡으로 코드를 전달해야 하므로 회원 선택 필수.
    if (input.cz_type === 3 && (!Array.isArray(input.member_ids) || input.member_ids.length === 0)) {
      throw new BadRequestException('코드입력쿠폰은 발급 대상 회원을 최소 1명 이상 선택해야 합니다.');
    }
    this.logger.log(
      `[create] cz_type=${input.cz_type} subject=${input.subject} member_ids=${JSON.stringify(input.member_ids ?? null)}`,
    );

    // 코드입력쿠폰(cz_type=3) 은 cp_id 자동 생성 (sample/lib/shop.lib.php:get_coupon_id 동일 규칙)
    // — 16자, 사용 문자 ABCDEFGHJKLMNPQRSTUVWXYZ123456789 (혼동 문자 I/O/0 제외), XXXX-XXXX-XXXX-XXXX 포맷
    // 그 외 종류는 cp_id 사용 안함 → null 강제.
    const cpId = input.cz_type === 3 ? await this.generateUniqueCpId() : null;

    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO coupon_zone (
        subject, cz_type, cp_method, cp_target, cz_point, cp_type, cp_id,
        cz_period, cz_start, cz_end, is_active
      ) VALUES (
        ${input.subject.trim()}, ${input.cz_type ?? 0}, ${input.cp_method ?? 0},
        ${input.cp_target ?? null}, ${input.cz_point ?? 0}, ${input.cp_type ?? false},
        ${cpId}, ${input.cz_period ?? 0},
        ${input.cz_start ?? null}, ${input.cz_end ?? null}, ${input.is_active ?? true}
      ) RETURNING id
    `;
    const zoneId = rows[0].id;

    // 회원 매핑 — 다운로드/코드입력쿠폰만 의미 있음. 다른 cz_type 은 무시.
    if ((input.cz_type === 0 || input.cz_type === 3) && Array.isArray(input.member_ids) && input.member_ids.length > 0) {
      const added = await this.replaceMembers(zoneId, input.member_ids);
      this.logger.log(
        `[create→replaceMembers] zone_id=${zoneId} input_ids=${JSON.stringify(input.member_ids)} inserted=${added.length}`,
      );
      // 코드입력쿠폰(cz_type=3) 은 발급 직후 코드를 알림톡으로 안내.
      // 다운로드쿠폰(cz_type=0) 은 코드 자체가 없어 별도 안내 없음.
      if (input.cz_type === 3) {
        const fresh = await this.getById(zoneId);
        await this.notifyCouponCode(fresh, added);
      }
    }
    return this.getById(zoneId);
  }

  /** 쿠폰번호(cp_id) 생성 — sample/lib/shop.lib.php:get_coupon_id 동일 규칙. 충돌 시 최대 8회 재시도. */
  private async generateUniqueCpId(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = makeCouponCode();
      const dup = await this.sql<{ cnt: string }[]>`SELECT count(*)::text AS cnt FROM coupon_zone WHERE cp_id = ${code}`;
      if (Number(dup[0].cnt) === 0) return code;
    }
    throw new BadRequestException('쿠폰번호 생성에 실패했습니다. 다시 시도해 주세요.');
  }

  async update(id: number, input: Partial<CouponZoneInput>) {
    const cur = await this.getById(id);
    this.logger.log(
      `[update] zone_id=${id} cur.cz_type=${cur.cz_type} member_ids=${JSON.stringify(input.member_ids ?? null)}`,
    );
    // 정책: 등록 후 cz_type(쿠폰종류) 변경 금지 — 항상 기존 값 유지
    //       cp_id(쿠폰번호) 도 자동 생성된 값을 보호 — 항상 기존 값 유지
    await this.sql`
      UPDATE coupon_zone SET
        subject = ${input.subject?.trim() ?? cur.subject},
        cz_type = ${cur.cz_type},
        cp_method = ${input.cp_method ?? cur.cp_method},
        cp_target = ${input.cp_target !== undefined ? input.cp_target : cur.cp_target},
        cz_point = ${input.cz_point ?? cur.cz_point},
        cp_type = ${input.cp_type ?? cur.cp_type},
        cp_id = ${cur.cp_id},
        cz_period = ${input.cz_period ?? cur.cz_period},
        cz_start = ${input.cz_start !== undefined ? input.cz_start : cur.cz_start},
        cz_end = ${input.cz_end !== undefined ? input.cz_end : cur.cz_end},
        is_active = ${input.is_active ?? cur.is_active},
        updated_at = now()
      WHERE id = ${id}
    `;

    // 회원 매핑 동기화 — input.member_ids 가 명시적으로 전달된 경우에만 갱신.
    // 다운로드/코드입력쿠폰만 의미 있음.
    if ((cur.cz_type === 0 || cur.cz_type === 3) && Array.isArray(input.member_ids)) {
      const added = await this.replaceMembers(id, input.member_ids);
      // 코드입력쿠폰(cz_type=3): 신규 추가 회원 + 기존 회원 중 아직 알림톡이 안 나간(notified_at IS NULL) 회원
      // 모두 발송 시도. 이렇게 하면 BizM 미승인 / 휴대폰 누락 등으로 첫 발송 실패한 회원에게도
      // 수정 시 자동 재시도된다.
      if (cur.cz_type === 3 && added.length > 0) {
        const pending = added.filter((m) => !m.notified_at);
        if (pending.length > 0) {
          const fresh = await this.getById(id);
          await this.notifyCouponCode(fresh, pending);
        }
      }
    }
    return this.getById(id);
  }

  async remove(id: number) {
    const result = await this.sql`DELETE FROM coupon_zone WHERE id = ${id}`;
    if (result.count === 0) throw new NotFoundException('쿠폰존을 찾을 수 없습니다.');
    return { ok: true };
  }

  /**
   * zone 의 발급 대상 회원 목록 조회 — UI 가 폼 진입 시 호출.
   */
  async getMembers(zoneId: number): Promise<CouponZoneMemberRow[]> {
    return this.sql<CouponZoneMemberRow[]>`
      SELECT czm.id, czm.member_id, m.name, m.mb_id, m.phone,
             to_char(czm.notified_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS notified_at
        FROM coupon_zone_member czm
        JOIN member m ON m.id = czm.member_id
       WHERE czm.zone_id = ${zoneId}
       ORDER BY czm.id ASC
    `;
  }

  /**
   * zone 의 회원 매핑을 입력 배열로 통째 교체.
   * 기존에 존재했던 회원의 notified_at/status/reason 은 보존하고,
   * 새로 추가된 회원만 NULL 상태로 들어간다. (DELETE+INSERT 가 아닌 SET 차집합 방식)
   *
   * member.id 는 bigint 컬럼이라 postgres.js 의 기본 int4 array 직렬화로는
   * ANY() 매칭이 0행 나오는 케이스가 있다. 안전하게 string 으로 캐스트해 넘긴다.
   */
  private async replaceMembers(zoneId: number, memberIds: Array<number | string>): Promise<CouponZoneMemberRow[]> {
    // member.id 는 bigint → JS 측에서 string 으로 들어오는 케이스가 흔하다.
    // 숫자/문자 모두 받아 양의 정수 문자열로 정규화.
    const idStrs = Array.from(
      new Set(
        memberIds
          .map((v) => (typeof v === 'number' ? String(Math.trunc(v)) : String(v).trim()))
          .filter((s) => /^[1-9][0-9]*$/.test(s)),
      ),
    );
    if (idStrs.length === 0) {
      await this.sql`DELETE FROM coupon_zone_member WHERE zone_id = ${zoneId}`;
      return [];
    }
    // 1) 빠진 회원만 삭제 (기존 행의 notified_at 등 메타 유지)
    await this.sql`
      DELETE FROM coupon_zone_member
       WHERE zone_id = ${zoneId}
         AND member_id <> ALL(${idStrs}::bigint[])
    `;
    // 2) 신규 회원만 INSERT (uq_coupon_zone_member 로 중복 방지)
    await this.sql`
      INSERT INTO coupon_zone_member (zone_id, member_id)
      SELECT ${zoneId}, m.id FROM member m
       WHERE m.id = ANY(${idStrs}::bigint[])
      ON CONFLICT (zone_id, member_id) DO NOTHING
    `;
    return this.getMembers(zoneId);
  }

  /**
   * 코드입력쿠폰 발급 안내 알림톡(coupon_req2) 발송.
   * 템플릿 변수: #{쿠폰명} #{쿠폰번호} #{유효기간}
   * 발송 결과는 coupon_zone_member.(notified_at/notify_status/notify_reason) 에 기록되며,
   * 실패(template_not_found / phone_missing / bizm_rejected 등) 시 다음 수정에서 재시도된다.
   */
  private async notifyCouponCode(zone: CouponZoneRow, members: CouponZoneMemberRow[]): Promise<void> {
    if (!zone.cp_id) {
      this.logger.warn(`[coupon_req2 skip] zone_id=${zone.id} cp_id 없음 (cz_type=${zone.cz_type})`);
      return;
    }
    const validity = formatValidity(zone.cz_start, zone.cz_end, zone.cz_period);
    this.logger.log(
      `[coupon_req2 start] zone_id=${zone.id} cp_id=${zone.cp_id} members=${members.length}`,
    );
    for (const m of members) {
      if (!m.phone) {
        this.logger.warn(`[coupon_req2 skip] member_id=${m.member_id} 휴대폰 없음`);
        await this.recordNotifyResult(zone.id, m.member_id, false, 'phone_missing');
        continue;
      }
      try {
        const r = await this.sms.sendAlimtalkByCode(
          'coupon_req_v2',
          m.phone,
          {
            쿠폰명: zone.subject,
            쿠폰번호: zone.cp_id,
            유효기간: validity,
            // BizM 콘솔 등록 버튼 URL = https://sajuplan.com/#{url} → 마이페이지 쿠폰함으로 이동
            //   ※ prefix 는 BizM(카카오 비즈톡) 콘솔의 템플릿 등록값 — 코드가 아니라 콘솔에서 변경
            url: 'mypage/coupons',
          },
          '사주플랜 쿠폰 발급',
        );
        if (r.ok) {
          this.logger.log(`[coupon_req2 ok] member_id=${m.member_id} phone=${m.phone}`);
          await this.recordNotifyResult(zone.id, m.member_id, true, r.reason ?? null);
        } else {
          this.logger.warn(`[coupon_req2 fail] member_id=${m.member_id} reason=${r.reason ?? 'unknown'}`);
          await this.recordNotifyResult(zone.id, m.member_id, false, r.reason ?? 'unknown');
        }
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        this.logger.error(`[coupon_req2 error] member_id=${m.member_id}: ${reason}`);
        await this.recordNotifyResult(zone.id, m.member_id, false, reason.slice(0, 200));
      }
    }
  }

  /** coupon_zone_member 의 발송 결과 기록 — 0062 마이그레이션의 3개 컬럼 update. */
  private async recordNotifyResult(
    zoneId: number,
    memberId: number,
    ok: boolean,
    reason: string | null,
  ): Promise<void> {
    if (ok) {
      await this.sql`
        UPDATE coupon_zone_member
           SET notified_at = now(), notify_status = 'ok', notify_reason = ${reason}
         WHERE zone_id = ${zoneId} AND member_id = ${memberId}
      `;
    } else {
      await this.sql`
        UPDATE coupon_zone_member
           SET notify_status = 'fail', notify_reason = ${reason}
         WHERE zone_id = ${zoneId} AND member_id = ${memberId}
      `;
    }
  }
}

function formatValidity(start: string | null, end: string | null, periodDays: number): string {
  const fmt = (s: string | null) => {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const a = fmt(start);
  const b = fmt(end);
  if (a && b) return `${a} ~ ${b}`;
  if (b) return `~${b}`;
  if (periodDays > 0) return `발급일로부터 ${periodDays}일`;
  return '상시';
}

const COUPON_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';

function makeCouponCode(): string {
  let raw = '';
  for (let i = 0; i < 16; i++) raw += COUPON_CHARS[Math.floor(Math.random() * COUPON_CHARS.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}
