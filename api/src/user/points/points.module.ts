import { Module } from '@nestjs/common';
import { UserPointsController } from './points.controller';
import { UserPointsService } from './points.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserPointsController],
  providers: [UserPointsService],
})
export class UserPointsModule {}
