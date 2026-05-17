import { BadRequestException, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ResetService } from './reset.service';
import { SettlementCronService } from './settlement-cron.service';
import { GradeCronService } from './grade-cron.service';
import { RetryCronService } from './retry-cron.service';
import { HealthCheckService } from './health-check.service';
import { CronTokenGuard } from './cron-token.guard';
import { OpsAlertService } from '../shared/ops-alert/ops-alert.service';

/**
 * 외부 cron 진입점.
 *
 * 모든 라우트는 CronTokenGuard 로 보호. CRON_TOKEN env 와 일치하는 ?token=... 필요.
 *
 * crontab 예:
 *   5 0 1 * * curl -s 'https://api.sajumoon.kr/api/cron/grade/recalculate?token=$CRON_TOKEN' >> /var/log/sajumoon_grade.log 2>&1
 *   0 4 1 * * curl -s 'https://api.sajumoon.kr/api/cron/settlement/monthly?token=$CRON_TOKEN' >> /var/log/sajumoon_settlement.log 2>&1
 *
 * 실패 시 동작:
 *   각 핸들러는 try/catch 로 감싸 예외 발생 시 OpsAlertService 로 알림톡 발송.
 *   이후 원본 예외를 다시 throw 해서 HTTP 500 + crontab 로그에도 남김.
 */
@Controller('cron')
@UseGuards(CronTokenGuard)
export class CronController {
  constructor(
    private readonly settlement: SettlementCronService,
    private readonly reset: ResetService,
    private readonly grade: GradeCronService,
    private readonly retryCron: RetryCronService,
    private readonly healthCheck: HealthCheckService,
    private readonly opsAlert: OpsAlertService,
  ) {}

  // [Phase G] DB 일관성 health-check — 18개 invariant 자동 점검 + Critical 위반 시 OpsAlert.
  //   GET /api/cron/health-check
  //   crontab 권장: 매시간 정각 — '0 * * * * curl ...health-check?token=...'
  @Get('health-check')
  async healthCheckRun() {
    return this.healthCheck.runAll();
  }

  // 운영자 알림 테스트 — 휴대폰 등록 확인용. CronTokenGuard 보호.
  //   GET /api/cron/test-alert?token=...
  @Get('test-alert')
  async testAlert() {
    const r = await this.opsAlert.send(
      '테스트 알림',
      '운영자 휴대폰 등록 확인 테스트입니다. 이 메시지를 받으셨다면 OpsAlert 정상 작동입니다.',
    );
    return { ok: true, result: r };
  }

  // [Audit C-#9] 채팅 정산 재시도 — M2NET 일시 장애로 미정산된 chat_room 처리.
  //   GET /api/cron/retry/chat-settle
  //   crontab 예 (10분 간격): '0,10,20,30,40,50 * * * * curl ...retry/chat-settle?token=...'
  @Get('retry/chat-settle')
  async retryChatSettle(@Query('limit') limit?: string) {
    const n = limit ? Math.max(1, Math.min(100, Number(limit) || 20)) : 20;
    return this.retryCron.retryChatSettles(n);
  }

  // [Audit C-#10] 결제 M2NET 적립 재시도 — m2net 적립 실패한 payment 재시도.
  //   GET /api/cron/retry/payment-m2net
  //   crontab 예 (10분 간격): '0,10,20,30,40,50 * * * * curl ...retry/payment-m2net?token=...'
  @Get('retry/payment-m2net')
  async retryPaymentM2net(@Query('limit') limit?: string) {
    const n = limit ? Math.max(1, Math.min(100, Number(limit) || 20)) : 20;
    return this.retryCron.retryPaymentM2netSync(n);
  }

  /**
   * 매월 1일 등급 재산정.
   *
   * 옵션:
   *   ?month=YYYY-MM  특정 월 강제 (직전 1개월 산정 대상). 생략 시 전월.
   *   ?test=1         dry-run. DB 변경 0.
   *   ?mb_id=xxx      특정 상담사만 (테스트용).
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
    try {
      return await this.grade.recalculate(monthArg, testOnly, mbIdArg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.opsAlert.send(
        '등급 재산정 크론 실패',
        `month=${monthArg ?? '전월'}\n${msg}`,
      );
      throw e;
    }
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
    try {
      return await this.settlement.runMonthly(monthArg, testOnly, mbIdArg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.opsAlert.send(
        '월별 정산 크론 실패',
        `month=${monthArg ?? '전월'}\n${msg}`,
      );
      throw e;
    }
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
   *
   * [Audit E-W9] 토큰 누출 시 매출 손실 큼 — 실행 시작/완료 양쪽 OpsAlert 발송.
   */
  @Post('settlement/rollback')
  async rollback(@Query('month') month?: string) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month=YYYY-MM required');
    }
    await this.opsAlert.send(
      '⚠️ 정산 롤백 요청',
      `month=${month}\n— 실행 시작. 정상 요청이 아니라면 즉시 CRON_TOKEN 회전 + 로그 점검.`,
    );
    try {
      const result = await this.settlement.rollbackMonth(month);
      await this.opsAlert.send(
        '정산 롤백 완료',
        `month=${month}\n복원된 row 수: ${(result as { restored?: number })?.restored ?? '?'}`,
      );
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.opsAlert.send(
        '정산 롤백 실패',
        `month=${month}\n${msg}`,
      );
      throw e;
    }
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
