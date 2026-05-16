import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { ResetService } from './reset.service';
import { SettlementCronService } from './settlement-cron.service';
import { GradeCronService } from './grade-cron.service';
import { CronTokenGuard } from './cron-token.guard';
import { OpsAlertModule } from '../shared/ops-alert/ops-alert.module';

@Module({
  imports: [OpsAlertModule],
  controllers: [CronController],
  providers: [SettlementCronService, ResetService, GradeCronService, CronTokenGuard],
})
export class CronModule {}
