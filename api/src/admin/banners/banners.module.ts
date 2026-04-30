import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
