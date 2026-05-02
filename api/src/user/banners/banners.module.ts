import { Module } from '@nestjs/common';
import { UserBannersController } from './banners.controller';
import { UserBannersService } from './banners.service';

@Module({
  controllers: [UserBannersController],
  providers: [UserBannersService],
})
export class UserBannersModule {}
