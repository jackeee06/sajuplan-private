import { Module } from '@nestjs/common';
import { SmsModule } from '../../user/sms/sms.module';
import { PromoterCoreService } from './promoter-core.service';

/**
 * 모집인 보상 공용 코어 — 적립/귀속/환불void/대시보드/알림톡.
 * m2net-push, auth(가입), 환불, 관리자/공개 모집인 모듈에서 주입한다.
 * (SQL 은 DbModule @Global 로 주입됨 — 별도 import 불필요)
 */
@Module({
  imports: [SmsModule],
  providers: [PromoterCoreService],
  exports: [PromoterCoreService],
})
export class PromoterCoreModule {}
