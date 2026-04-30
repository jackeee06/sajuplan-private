import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { BoardOpsController } from './board-ops.controller';
import { BoardOpsService } from './board-ops.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [BoardOpsController],
  providers: [BoardOpsService],
  exports: [BoardOpsService],
})
export class BoardOpsModule {}
