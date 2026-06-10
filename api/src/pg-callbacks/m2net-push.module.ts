import { Module } from '@nestjs/common';
import { M2netPushController } from './m2net-push.controller';
import { M2netPushService } from './m2net-push.service';
import { CallbackIpAllowlistGuard } from './callback-ip-allowlist.guard';
import { OpsAlertModule } from '../shared/ops-alert/ops-alert.module';
import { GradeUpgradeModule } from '../shared/grade-upgrade/grade-upgrade.module';

@Module({
  imports: [OpsAlertModule, GradeUpgradeModule],
  controllers: [M2netPushController],
  providers: [M2netPushService, CallbackIpAllowlistGuard],
  exports: [M2netPushService, CallbackIpAllowlistGuard],
})
export class M2netPushModule {}
