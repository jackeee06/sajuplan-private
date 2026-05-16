import { BadRequestException, Controller, Get, Post, Query } from '@nestjs/common';
import { ResetService } from './reset.service';
import { SettlementCronService } from './settlement-cron.service';
import { GradeCronService } from './grade-cron.service';

/**
 * 외부 cron 진입점.
 *
 * 운영 호출 URL (매월 1일 04:00 KST 기준 예):
 *   GET https://api.sajumoon.kr/api/cron/settlement/monthly
 *
 * 옵션:
 *   ?month=YYYY-MM    특정 월 강제 (생략 시 KST 전월)
 *   ?test=1           dry-run. settlement_monthly 만 계산. 포인트 차감/플래그 갱신 0
 *   ?mb_id=demonster1 특정 상담사 한 명만 처리 (테스트용)
 *
 * 멱등성:
 *   같은 (mb_id, month) 의 settlement_monthly row 가 이미 있으면 → 계산값만 UPDATE.
 *   포인트 차감/플래그 갱신은 스킵 (두 번 돌려도 안전).
 *
 * crontab 예:
 *   0 4 1 * * curl -s 'https://api.sajumoon.kr/api/cron/settlement/monthly' >> /var/log/sajumoon_settlement.log 2>&1
 *
 * TODO(임시): 가드 제거 상태 — 테스트 끝나면 CronTokenGuard 복구 필요.
 *   import 와 @UseGuards(CronTokenGuard) 한 줄 복원하면 됨.
 */
@Controller('cron')
export class CronController {
  constructor(
    private readonly settlement: SettlementCronService,
    private readonly reset: ResetService,
    private readonly grade: GradeCronService,
  ) {}

  /**
   * 매월 1일 등급 재산정.
   *
   * 운영 호출:
   *   GET https://api.sajumoon.kr/api/cron/grade/recalculate
   *
   * 옵션:
   *   ?month=YYYY-MM  특정 월 강제 (직전 1개월 산정 대상). 생략 시 전월.
   *   ?test=1         dry-run. DB 변경 0.
   *   ?mb_id=xxx      특정 상담사만 (테스트용).
   *
   * crontab 예 (KST 매월 1일 0시 5분):
   *   5 0 1 * * curl -s 'https://api.sajumoon.kr/api/cron/grade/recalculate' >> /var/log/sajumoon_grade.log 2>&1
   *
   * 멱등성: grade_recalculated_at 이 당월 1일 이후면 회원별 skip.
   */
  @Get('grade/recalculate')
  async gradeRecalculate(
    @Query('month') month?: string,
    @Query('test') test?: string,
    @Query('mb_id') mbId?: string,
  ) {
    const monthArg = month && /^\d{4}-\d{2}$/.test(month) ? month : undefined;
    const testOnly = test === '1' || test === 'true';
    const mbIdArg = mbId && /^[A-Za-z0-9._-]{1,100}$/.test(mbId) ? mbId : undefined;
    return this.grade.recalculate(monthArg, testOnly, mbIdArg);
  }

  @Get('settlement/monthly')
  async settlementMonthly(
    @Query('month') month?: string,
    @Query('test') test?: string,
    @Query('mb_id') mbId?: string,
  ) {
    const monthArg = month && /^\d{4}-\d{2}$/.test(month) ? month : undefined;
    const testOnly = test === '1' || test === 'true';
    const mbIdArg = mbId && /^[A-Za-z0-9._-]{1,100}$/.test(mbId) ? mbId : undefined;
    return this.settlement.runMonthly(monthArg, testOnly, mbIdArg);
  }

  /**
   * 진단: GET /api/cron/settlement/diagnose?mb_id=xxx&month=YYYY-MM
   * 0원 정산 원인 추적용. 각 WHERE 절 단계별 카운트/합계 반환.
   */
  @Get('settlement/diagnose')
  async diagnose(@Query('mb_id') mbId?: string, @Query('month') month?: string) {
    if (!mbId || !/^[A-Za-z0-9._-]{1,100}$/.test(mbId)) {
      throw new BadRequestException('mb_id required');
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month=YYYY-MM required');
    }
    return this.settlement.diagnose(mbId, month);
  }

  /**
   * 롤백: POST /api/cron/settlement/rollback?month=YYYY-MM
   * 해당 월의 settlement_monthly 전 row + 정산 차감 point_history + 플래그 되돌림.
   * GET 안 만든 이유는 운영 데이터 변경이라 GET 으로 노출하면 위험. (가드 임시 제거 상태)
   */
  @Post('settlement/rollback')
  async rollback(@Query('month') month?: string) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month=YYYY-MM required');
    }
    return this.settlement.rollbackMonth(month);
  }

  /**
   * 운영 데이터 일괄 초기화 — settlement_monthly / point_history / point / member.point /
   *   coupon / coupon_history / consultation.calc_flag·is_settled.
   *
   *   POST /api/cron/reset/all?confirm=YES_DELETE_ALL
   *
   * confirm 토큰 일치하지 않으면 거부. 한 번 실행하면 복구 불가능.
   * 결제 본체(payment / consultation / payment_method) 는 보존.
   */
  @Post('reset/all')
  async resetAll(@Query('confirm') confirm?: string) {
    if (confirm !== 'YES_DELETE_ALL') {
      throw new BadRequestException('confirm=YES_DELETE_ALL required');
    }
    return this.reset.resetAll();
  }

  /**
   * 자동충전 진단 — GET /api/cron/diagnose/autopay?mb_id=xxx&hours=24
   *
   * 통화 중 자동충전 사고 추적용. 회원의 최근 payment / point_history / point 잔액 +
   * autopay-push.log 의 해당 회원 라인 tail 반환.
   */
  @Get('diagnose/autopay')
  async diagnoseAutopay(@Query('mb_id') mbId?: string, @Query('hours') hours?: string) {
    if (!mbId || !/^[A-Za-z0-9._-]{1,100}$/.test(mbId)) {
      throw new BadRequestException('mb_id required');
    }
    const h = Math.min(168, Math.max(1, Number(hours) || 24));
    return this.reset.diagnoseAutopay(mbId, h);
  }
}
