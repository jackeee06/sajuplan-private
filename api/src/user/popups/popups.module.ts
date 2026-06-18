import { Module } from '@nestjs/common';
import { UserPopupsController } from './popups.controller';
import { UserPopupsService } from './popups.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // OptionalUserGuard(JwtService) DI
  controllers: [UserPopupsController],
  providers: [UserPopupsService],
})
export class UserPopupsModule {}
