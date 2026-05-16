import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { ResetService } from './reset.service';
import { SettlementCronService } from './settlement-cron.service';
import { GradeCronService } from './grade-cron.service';

@Module({
  controllers: [CronController],
  providers: [SettlementCronService, ResetService, GradeCronService],
})
export class CronModule {}
