import { Module } from '@nestjs/common';
import { M2netPushController } from './m2net-push.controller';
import { M2netPushService } from './m2net-push.service';

@Module({
  controllers: [M2netPushController],
  providers: [M2netPushService],
  exports: [M2netPushService],
})
export class M2netPushModule {}
