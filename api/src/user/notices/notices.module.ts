import { Module } from '@nestjs/common';
import { UserNoticesController } from './notices.controller';
import { UserNoticesService } from './notices.service';

@Module({
  controllers: [UserNoticesController],
  providers: [UserNoticesService],
})
export class UserNoticesModule {}
