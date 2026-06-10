import { Module } from '@nestjs/common';
import { GradeUpgradeService } from './grade-upgrade.service';
import { SmsModule } from '../../user/sms/sms.module';

@Module({
  imports: [SmsModule],
  providers: [GradeUpgradeService],
  exports: [GradeUpgradeService],
})
export class GradeUpgradeModule {}
