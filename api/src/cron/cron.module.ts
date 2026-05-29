import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { ResetService } from './reset.service';
import { SettlementCronService } from './settlement-cron.service';
import { GradeCronService } from './grade-cron.service';
import { RetryCronService } from './retry-cron.service';
import { HealthCheckService } from './health-check.service';
import { DailySummaryService } from './daily-summary.service';
import { CronTokenGuard } from './cron-token.guard';
import { OpsAlertModule } from '../shared/ops-alert/ops-alert.module';
import { M2netPushModule } from '../pg-callbacks/m2net-push.module';
import { M2netModule } from '../shared/m2net/m2net.module';
import { UserConsultModule } from '../user/consult/consult.module';
import { UserChatModule } from '../user/chat/chat.module';

@Module({
  imports: [OpsAlertModule, M2netPushModule, M2netModule, UserConsultModule, UserChatModule],
  controllers: [CronController],
  providers: [SettlementCronService, ResetService, GradeCronService, RetryCronService, HealthCheckService, DailySummaryService, CronTokenGuard],
})
export class CronModule {}
