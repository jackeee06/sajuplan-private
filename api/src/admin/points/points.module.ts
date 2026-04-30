import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
