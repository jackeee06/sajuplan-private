import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { ResetService } from './reset.service';
import { SettlementCronService } from './settlement-cron.service';

@Module({
  controllers: [CronController],
  providers: [SettlementCronService, ResetService],
})
export class CronModule {}
