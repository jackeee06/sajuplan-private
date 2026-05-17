import { Module } from '@nestjs/common';
import { ChargeController } from './charge.controller';
import { PgCallbackController } from './pg-callback.controller';
import { ChargeService } from './charge.service';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';
import { OpsAlertModule } from '../../shared/ops-alert/ops-alert.module';
import { M2netPushModule } from '../../pg-callbacks/m2net-push.module';

/**
 * 사용자 측 포인트 충전 (Phase B).
 *  - 일반결제(카드/가상계좌/간편결제): /api/user/charge/prepare → form submit → /api/pg/charge/callback
 *  - 사주문페이(BillKey): /api/user/charge/autopay-register → DB + 엠투넷 PUT
 *  - 자동충전: /api/user/charge/auto-config → 엠투넷이 자율 트리거 → /api/pg/charge/autopay-push
 *
 * [Audit E-C1] M2netPushModule import — CallbackIpAllowlistGuard 사용 (PG 콜백 IP 검증).
 */
@Module({
  imports: [AuthModule, SmsModule, OpsAlertModule, M2netPushModule],
  controllers: [ChargeController, PgCallbackController],
  providers: [ChargeService],
})
export class ChargeModule {}
