import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AdminAttendanceController } from './attendance.controller';
import { AdminAttendanceService } from './attendance.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminAttendanceController],
  providers: [AdminAttendanceService],
  exports: [AdminAttendanceService],
})
export class AdminAttendanceModule {}
