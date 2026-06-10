import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { M2netService } from '../../shared/m2net/m2net.service';

export interface PublicCoupon {
  id: number;
  title: string;
  /** 적립 포인트 (cz_point) */
  point: number;
  /** 사용 가능 만료일 — 'YYYY.MM.DD' 형식 (없으면 빈 문자열) */
  expired_at: string;
  /** 사용한 시각 — 'YYYY.MM.DD' 형식 (사용 전이면 빈 문자열) */
  used_at: string;
  used: boolean;
}

const TZ = 'Asia/Seoul';

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  // KST 기준 'YYYY.MM.DD'
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(dt)
    .replaceAll(' ', '')
    .replaceAll('.', '.')
    .replace(/\.$/, ''); // '2026. 04. 30' → '2026.04.30'
  return fmt;
}

@Injectable()
export class UserCouponsService {
  private readonly logger = new Logger(UserCouponsService.name);
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly m2net: M2netService,
  ) {}

  /** 회원 쿠폰 목록 — status=available(사용 전, 만료 전) | used(사용 완료, hidden_at IS NULL) */
  async list(memberId: number, status: 'available' | 'used'): Promise<PublicCoupon[]> {
    type Row = {
      id: number;
      title: string;
      cz_point: number | null;
      ends_at: Date | null;
      used_at: Date | null;
    };
    const rows =
      status === 'available'
        ? await this.sql<Row[]>`
            SELECT c.id, c.title, COALESCE(cz.cz_point, 0) AS cz_point,
                   c.ends_at, c.used_at
              FROM coupon c
              LEFT JOIN coupon_zone cz ON cz.id = c.zone_id
             WHERE c.member_id = ${memberId}
               AND c.used_at IS NULL
               AND (c.ends_at IS NULL OR c.ends_at > now())
             ORDER BY c.created_at DESC
          `
        : await this.sql<Row[]>`
            SELECT c.id, c.title, COALESCE(cz.cz_point, 0) AS cz_point,
                   c.ends_at, c.used_at
              FROM coupon c
              LEFT JOIN coupon_zone cz ON cz.id = c.zone_id
             WHERE c.member_id = ${memberId}
               AND c.used_at IS NOT NULL
               AND c.hidden_at IS NULL
             ORDER BY c.used_at DESC
          `;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      point: Number(r.cz_point ?? 0),
      expired_at: fmtDate(r.ends_at),
      used_at: fmtDate(r.used_at),
      used: r.used_at != null,
    }));
  }

  /** 보유 쿠폰 사용 — used_at 마킹 + 포인트 적립 + member.point 동기화 */
  async use(memberId: number, couponId: number): Promise<{ point: number; new_balance: number }> {
    try {
      const result = await this.useImpl(memberId, couponId);
      // m2net 잔액 동기화 — 트랜잭션 커밋 후 비동기 실행 (실패해도 쿠폰 사용은 성공 처리)
      this.syncM2netCoin(memberId, result.point).catch(() => {});
      return result;
    } catch (e) {
      this.logger.error(
        `[coupon.use] memberId=${memberId} couponId=${couponId} ` +
          `error=${e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e)}`,
      );
      if (
        e instanceof BadRequestException ||
        e instanceof NotFoundException ||
        e instanceof ConflictException
      ) {
        throw e;
      }
      throw new BadRequestException(`쿠폰 사용 중 오류가 발생했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async useImpl(memberId: number, couponId: number): Promise<{ point: number; new_balance: number }> {
    return this.sql.begin(async (tx) => {
      // sample/shop/ajax.coupondownload.php 와 동일한 단순 흐름:
      //   1) used_at IS NULL 인 row 만 used_at = now() 로 마킹 (atomic, RETURNING) — 중복 클릭 방지
      //   2) coupon_zone 에서 cz_point 조회
      //   3) 포인트 적립 + 이력 기록
      const updated = await tx<{
        id: number;
        title: string;
        zone_id: number | null;
        ends_at: Date | null;
      }[]>`
        UPDATE coupon
           SET used_at = now()
         WHERE id = ${couponId}
           AND member_id = ${memberId}
           AND used_at IS NULL
         RETURNING id, title, zone_id, ends_at
      `;
      const c = updated[0];
      if (!c) {
        // 행이 없으면 — (a) 다른 회원 쿠폰, (b) 이미 사용됨, (c) 존재하지 않음
        const exists = await tx<{ used_at: Date | null }[]>`
          SELECT used_at FROM coupon WHERE id = ${couponId} AND member_id = ${memberId} LIMIT 1
        `;
        if (exists.length === 0) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
        throw new ConflictException('이미 사용된 쿠폰입니다.');
      }
      if (c.ends_at && c.ends_at <= new Date()) {
        // 만료된 쿠폰을 사용 시도 — 마킹은 됐지만 적립 막고 롤백
        throw new BadRequestException('사용 기한이 만료된 쿠폰입니다.');
      }

      // cz_point 조회 (zone_id 없거나 zone 삭제된 경우 0 처리)
      let point = 0;
      if (c.zone_id != null) {
        const z = await tx<{ cz_point: number | null }[]>`
          SELECT cz_point FROM coupon_zone WHERE id = ${c.zone_id} LIMIT 1
        `;
        point = Number(z[0]?.cz_point ?? 0);
      }
      if (point <= 0) {
        throw new BadRequestException('적립 포인트가 없는 쿠폰입니다.');
      }

      const newBalance = await this.creditPointInTx(tx, memberId, point, c.title || '쿠폰 적립', 'coupon_use');

      await tx`
        INSERT INTO coupon_history (coupon_id, member_id, discount_value, used_at)
        VALUES (${couponId}, ${memberId}, ${point}, now())
      `;

      return { point, new_balance: newBalance };
    });
  }

  /**
   * 쿠폰코드 입력 → 쿠폰 발급 + 즉시 사용 처리 + 포인트 적립.
   * (트랜잭션 커밋 후 m2net 동기화 포함)
   *  - coupon_zone.cz_type=3 (코드입력)이고 cp_id 일치하는 활성 쿠폰존 조회
   *  - 다운로드 한도(cz_download) 검증 후 coupon row 생성
   *  - 즉시 used_at 마킹 + 포인트 적립
   *  - 회원당 1회만 사용 가능 (이미 발급/사용된 같은 zone 이면 차단)
   */
  async redeem(memberId: number, code: string): Promise<{ point: number; new_balance: number }> {
    const trimmed = (code || '').trim();
    if (!trimmed) throw new BadRequestException('쿠폰번호를 입력해주세요.');

    const result = await this.sql.begin(async (tx) => {
      // [BUG FIX 2026-06-10] 동시성 락 — 같은 회원이 같은 코드를 동시에 2번 입력하면
      //   아래 COUNT 중복검사가 둘 다 0을 읽고 둘 다 INSERT → 쿠폰 2개 + 코인 2배 발급 가능.
      //   coupon 테이블에 (zone_id, member_id) UNIQUE 제약이 없으므로 advisory lock 으로 직렬화.
      await tx`SELECT pg_advisory_xact_lock(7777005, ${memberId})`;

      const zoneRows = await tx<{
        id: number;
        subject: string;
        cz_point: number;
        cz_type: number;
        cz_period: number;
        cz_download: number;
        cz_start: Date | null;
        cz_end: Date | null;
        is_active: boolean;
      }[]>`
        SELECT id, subject, cz_point, cz_type, cz_period, cz_download,
               cz_start, cz_end, is_active
          FROM coupon_zone
         WHERE cz_type = 3
           AND cp_id = ${trimmed}
         LIMIT 1
      `;
      const zone = zoneRows[0];
      if (!zone || !zone.is_active) {
        throw new NotFoundException('유효하지 않은 쿠폰번호입니다.');
      }
      const now = new Date();
      if (zone.cz_start && zone.cz_start > now) {
        throw new BadRequestException('아직 사용 가능한 시작일이 되지 않았습니다.');
      }
      if (zone.cz_end && zone.cz_end < now) {
        throw new BadRequestException('만료된 쿠폰입니다.');
      }

      // 회원당 중복 등록 차단
      const dup = await tx<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM coupon
         WHERE zone_id = ${zone.id} AND member_id = ${memberId}
      `;
      if (Number(dup[0]?.count ?? 0) > 0) {
        throw new ConflictException('이미 등록한 쿠폰입니다.');
      }

      const point = Number(zone.cz_point ?? 0);
      if (point <= 0) {
        throw new BadRequestException('적립 포인트가 없는 쿠폰입니다.');
      }

      // 만료일 — cz_period(다운로드 후 사용가능 일수) 또는 cz_end
      const endsAt = zone.cz_period > 0
        ? new Date(now.getTime() + zone.cz_period * 24 * 60 * 60 * 1000)
        : zone.cz_end;

      // coupon row 생성 + 즉시 사용
      const inserted = await tx<{ id: number }[]>`
        INSERT INTO coupon (
          zone_id, member_id, title, ends_at, used_at, created_at
        ) VALUES (
          ${zone.id}, ${memberId}, ${zone.subject}, ${endsAt}, now(), now()
        )
        RETURNING id
      `;

      // 포인트 적립
      const newBalance = await this.creditPointInTx(tx, memberId, point, zone.subject || '쿠폰 적립', 'coupon_redeem');

      // 이력
      await tx`
        INSERT INTO coupon_history (coupon_id, member_id, discount_value, used_at)
        VALUES (${inserted[0].id}, ${memberId}, ${point}, now())
      `;

      // 다운로드 카운트 증가
      await tx`UPDATE coupon_zone SET cz_download = cz_download + 1 WHERE id = ${zone.id}`;

      return { point, new_balance: newBalance };
    });

    // m2net 잔액 동기화 — 트랜잭션 커밋 후 비동기 실행
    this.syncM2netCoin(memberId, result.point).catch(() => {});
    return result;
  }

  /** 사용내역 숨김 — 본인 화면에서만 안 보이게 (이력은 보존) */
  async hide(memberId: number, couponId: number): Promise<void> {
    const rows = await this.sql<{ id: number }[]>`
      UPDATE coupon
         SET hidden_at = now()
       WHERE id = ${couponId}
         AND member_id = ${memberId}
         AND used_at IS NOT NULL
       RETURNING id
    `;
    if (rows.length === 0) {
      throw new NotFoundException('해당 쿠폰을 찾을 수 없거나 이미 삭제된 항목입니다.');
    }
  }

  /** 트랜잭션 내 포인트 적립 + member.point/point 집계 동기화 */
  private async creditPointInTx(
    // postgres.js 의 `Sql.begin` 내 콜백 인자는 TransactionSql 로 Sql 과 시그니처가 미묘히 다름.
    // 사용하는 메서드는 동일하므로 어차피 호환되지만 TS 오버로드 충돌 회피용으로 any 로 받음.
    // (이 메서드는 동일 모듈 내에서만 호출).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    memberId: number,
    delta: number,
    content: string,
    relAction: string,
  ): Promise<number> {
    // 만료일 — 포인트 정책에서 지정 일수
    const termRows = await tx<{ value: string | null }[]>`
      SELECT value FROM setting WHERE namespace = 'member' AND key = 'point_term' LIMIT 1
    `;
    const term = Number(termRows[0]?.value ?? 0) || 0;
    let expireDate: string | null = null;
    if (term > 0) {
      const dt = new Date();
      dt.setDate(dt.getDate() + term - 1);
      expireDate = dt.toISOString().slice(0, 10);
    }

    // point row 보장
    let ptRows = await tx<{ free_balance: number; paid_balance: number }[]>`
      SELECT free_balance, paid_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
    `;
    if (ptRows.length === 0) {
      await tx`
        INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
        VALUES (${memberId}, 0, 0, 0, 0)
        ON CONFLICT (member_id) DO NOTHING
      `;
      ptRows = await tx<{ free_balance: number; paid_balance: number }[]>`
        SELECT free_balance, paid_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
      `;
    }
    const free = Number(ptRows[0].free_balance);
    const paid = Number(ptRows[0].paid_balance);
    const balanceAfter = free + paid + delta;

    await tx`
      INSERT INTO point_history (
        member_id, content, earn_point, use_point, balance_after,
        is_paid, is_expired, expire_date, rel_action, actor_type
      ) VALUES (
        ${memberId}, ${content}, ${delta}, 0, ${balanceAfter},
        false, false, ${expireDate}, ${relAction}, 'system'
      )
    `;

    await tx`
      UPDATE point SET
        free_balance = free_balance + ${delta},
        total_earned = total_earned + ${delta},
        updated_at = now()
       WHERE member_id = ${memberId}
    `;
    await tx`UPDATE member SET point = point + ${delta}, updated_at = now() WHERE id = ${memberId}`;

    return balanceAfter;
  }

  /** 쿠폰 적립 후 m2net 잔액 동기화 — 실패해도 로그만 남기고 무시 */
  private async syncM2netCoin(memberId: number, delta: number): Promise<void> {
    if (delta <= 0) return;
    const rows = await this.sql<{ m2net_membid: string | null }[]>`
      SELECT m2net_membid FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const mb1 = rows[0]?.m2net_membid;
    if (!mb1) return;
    const sync = await this.m2net.addMemberCoin(mb1, delta);
    if (!sync.ok) {
      this.logger.warn(
        `[coupon.m2net] sync 실패 memberId=${memberId} mb1=${mb1} delta=${delta} err=${sync.error}`,
      );
    } else {
      this.logger.log(`[coupon.m2net] sync 완료 memberId=${memberId} mb1=${mb1} +${delta}`);
    }
  }
}
