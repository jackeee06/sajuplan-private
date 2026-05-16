import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { ResetService } from './reset.service';
import { SettlementCronService } from './settlement-cron.service';
import { GradeCronService } from './grade-cron.service';
import { RetryCronService } from './retry-cron.service';
import { HealthCheckService } from './health-check.service';
import { CronTokenGuard } from './cron-token.guard';
import { OpsAlertModule } from '../shared/ops-alert/ops-alert.module';
import { M2netPushModule } from '../pg-callbacks/m2net-push.module';
import { M2netModule } from '../shared/m2net/m2net.module';

@Module({
  imports: [OpsAlertModule, M2netPushModule, M2netModule],
  controllers: [CronController],
  providers: [SettlementCronService, ResetService, GradeCronService, RetryCronService, HealthCheckService, CronTokenGuard],
})
export class CronModule {}
